import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Percayai proxy reversibel pertama (NGINX/Cloud Run/Vercel) untuk identifikasi IP yang aman
app.set('trust proxy', 1);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// CORS Middleware untuk menangani request dari browser / iframe preview
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Blokir keras (HTTP 403) permintaan ke file sensitif server, secrets, dan database lokal
app.use((req, res, next) => {
  const parsedPath = (req.path || '').toLowerCase();
  if (
    parsedPath.includes('.env') || 
    parsedPath.includes('server.js') || 
    parsedPath.includes('admins.json') || 
    parsedPath.includes('config.json') ||
    parsedPath.endsWith('package.json') ||
    parsedPath.endsWith('tsconfig.json')
  ) {
    return res.status(403).json({ error: 'Access Denied: Forbidden file' });
  }
  next();
});

// ==========================================
// RATE LIMITERS (express-rate-limit)
// ==========================================

// 1. Batasi login admin maksimal 5 percobaan per 15 menit untuk mencegah brute-force
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 5, // Maksimal 5 percobaan
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    trustProxy: false
  },
  message: {
    success: false,
    valid: false,
    message: 'Terlalu banyak percobaan login admin (maksimal 5 kali). Silakan coba lagi setelah 15 menit.'
  }
});

// 2. Batasi endpoint wa_leads / pendaftaran lead maksimal 10 permintaan per menit untuk mencegah spam database
const waLeadsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 10, // Maksimal 10 permintaan
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    forwardedHeader: false,
    trustProxy: false
  },
  message: {
    data: null,
    error: {
      message: 'Terlalu banyak permintaan pembuatan lead WhatsApp (maksimal 10 per menit). Harap tunggu 1 menit.'
    }
  }
});

// Middleware untuk menerapkan waLeadsLimiter khusus operasi tabel wa_leads
const checkWaLeadsRateLimit = (req, res, next) => {
  const targetTable = String(req.params.table || req.body?.table || req.query?.table || '').toLowerCase();
  if (targetTable === 'wa_leads') {
    return waLeadsLimiter(req, res, next);
  }
  next();
};

function getSupabaseConfig() {
  let url = process.env.SUPABASE_URL || '';
  let key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // Deteksi dan perbaiki otomatis jika SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tertukar di environment
  if (url && !url.startsWith('http')) {
    if (serviceKey && serviceKey.startsWith('http')) {
      const temp = url;
      url = serviceKey;
      serviceKey = temp;
    } else if (key && key.startsWith('http')) {
      const temp = url;
      url = key;
      key = temp;
    }
  }

  // Jika SUPABASE_URL kosong atau masih placeholder 'your-project', gunakan fallback dari VITE_SUPABASE_URL atau VITE_API_BASE_URL jika berisi domain Supabase
  if (!url || url.includes('your-project') || !url.startsWith('http')) {
    if (process.env.VITE_SUPABASE_URL && !process.env.VITE_SUPABASE_URL.includes('your-project')) {
      url = process.env.VITE_SUPABASE_URL;
    } else if (process.env.VITE_API_BASE_URL && process.env.VITE_API_BASE_URL.includes('supabase.co')) {
      url = process.env.VITE_API_BASE_URL;
    }
  }

  if (!key || key.includes('your-anon-key')) {
    if (process.env.VITE_SUPABASE_ANON_KEY) {
      key = process.env.VITE_SUPABASE_ANON_KEY;
    }
  }

  return { supabaseUrl: url, supabaseKey: key, serviceRoleKey: serviceKey };
}

let supabaseClientInstance = null;

function getSupabaseClient() {
  if (!supabaseClientInstance) {
    const { supabaseUrl, supabaseKey, serviceRoleKey } = getSupabaseConfig();
    const key = serviceRoleKey || supabaseKey;
    if (supabaseUrl && key && (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))) {
      try {
        supabaseClientInstance = createClient(supabaseUrl, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
      } catch (e) {
        console.warn('[SUPABASE] Server client creation failed:', e.message);
      }
    }
  }
  return supabaseClientInstance;
}

// ==========================================
// DEFAULT APP CONFIG
// ==========================================

let appWaNumber = '6285111029242';

// Operasi konfigurasi WhatsApp ke Supabase
async function getAppConfigFromDb() {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('admin_config')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (!error && data && data.wa_number) {
        return { wa_number: String(data.wa_number).trim() };
      }
    } catch (err) {
      console.warn('[CONFIG] Peringatan saat membaca admin_config dari Supabase:', err.message || err);
    }
  }
  return { wa_number: appWaNumber };
}

async function saveAppConfigToDb(waNumber) {
  appWaNumber = waNumber;
  const sb = getSupabaseClient();
  if (!sb) {
    return { wa_number: waNumber };
  }

  const { data: existing, error: findErr } = await sb
    .from('admin_config')
    .select('id')
    .eq('id', 1)
    .maybeSingle();

  if (findErr) {
    console.warn('[CONFIG] Query check admin_config:', findErr.message);
  }

  if (existing) {
    const { data, error } = await sb
      .from('admin_config')
      .update({ wa_number: waNumber, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select();

    if (error) throw error;
    return data?.[0] || { wa_number: waNumber };
  } else {
    const { data, error } = await sb
      .from('admin_config')
      .insert([{ id: 1, wa_number: waNumber, updated_at: new Date().toISOString() }])
      .select();

    if (error) throw error;
    return data?.[0] || { wa_number: waNumber };
  }
}

// ==========================================
// SUPABASE STORAGE FOR FREELANCER IMAGES
// Bucket: 'freelancer-images'
// ==========================================

let bucketCheckPromise = null;
async function ensureFreelancerImagesBucket(sb) {
  if (!sb) return;
  if (!bucketCheckPromise) {
    bucketCheckPromise = (async () => {
      try {
        const { data: buckets } = await sb.storage.listBuckets();
        const exists = (buckets || []).some(b => b.name === 'freelancer-images');
        if (!exists) {
          console.log('[STORAGE] Membuat bucket public "freelancer-images" di Supabase...');
          await sb.storage.createBucket('freelancer-images', {
            public: true,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
          });
        }
      } catch (e) {
        console.warn('[STORAGE] Pemeriksaan bucket storage:', e.message || e);
      }
    })();
  }
  return bucketCheckPromise;
}

// Unggah data gambar (base64) ke Supabase Storage bucket 'freelancer-images' dan kembalikan URL publik
async function uploadImageToSupabaseStorage(base64Data, sb, preferredName = '') {
  if (!base64Data || typeof base64Data !== 'string') return null;
  // Jika sudah merupakan link URL eksternal (http/https), kembalikan langsung
  if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
    return base64Data;
  }

  await ensureFreelancerImagesBucket(sb);

  let mimeType = 'image/jpeg';
  let base64String = base64Data;
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    mimeType = matches[1];
    base64String = matches[2];
  }

  const buffer = Buffer.from(base64String, 'base64');
  let ext = mimeType.split('/')[1] || 'jpg';
  if (ext === 'jpeg') ext = 'jpg';
  if (preferredName && preferredName.includes('.')) {
    const extMatch = preferredName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extMatch)) {
      ext = extMatch === 'jpeg' ? 'jpg' : extMatch;
    }
  }

  const uniqueFilename = `freelancer-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

  const { data, error } = await sb.storage
    .from('freelancer-images')
    .upload(uniqueFilename, buffer, {
      contentType: mimeType,
      upsert: true
    });

  if (error) {
    console.error('[STORAGE] Gagal upload ke bucket freelancer-images:', error.message);
    throw error;
  }

  const { data: pubData } = sb.storage.from('freelancer-images').getPublicUrl(uniqueFilename);
  const publicUrl = pubData?.publicUrl;
  console.log(`[STORAGE] Berhasil upload gambar ke Supabase Storage: ${publicUrl}`);
  return publicUrl || null;
}

// Helper untuk memastikan semua gambar freelancer disimpan sebagai URL Supabase Storage, bukan Base64
async function processFreelancerImagesForStorage(images, sb) {
  if (!images || !sb) return images;
  let imgArray = [];
  if (typeof images === 'string') {
    try {
      imgArray = JSON.parse(images);
    } catch (e) {
      imgArray = [images];
    }
  } else if (Array.isArray(images)) {
    imgArray = [...images];
  } else {
    return images;
  }

  const finalUrls = [];
  for (const item of imgArray) {
    if (typeof item === 'string') {
      if (item.startsWith('data:image/')) {
        try {
          const uploadedUrl = await uploadImageToSupabaseStorage(item, sb);
          if (uploadedUrl) finalUrls.push(uploadedUrl);
        } catch (err) {
          console.warn('[STORAGE] Gagal konversi base64 ke Storage URL:', err.message);
        }
      } else if (item.startsWith('http://') || item.startsWith('https://')) {
        finalUrls.push(item);
      }
    }
  }
  return finalUrls;
}

// Server-side state sederhana (Map global) untuk melacak token sesi admin yang sah secara acak
const activeAdminSessions = new Map();

function generateSessionToken(adminData) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 jam masa berlaku
  activeAdminSessions.set(token, {
    user: adminData,
    expiresAt
  });
  return token;
}

function verifyServerSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const session = activeAdminSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeAdminSessions.delete(token);
    return null;
  }
  return session.user;
}

async function verifyAdminAuth(req) {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ')) 
    ? authHeader.substring(7).trim() 
    : (req.body?.token || req.query?.token);

  if (!token) return null;

  // 1. Periksa jika token merupakan server session token yang valid
  const sessionUser = verifyServerSessionToken(token);
  if (sessionUser && (sessionUser.role === 'admin' || !sessionUser.role)) {
    return { role: 'admin', isSuperAdmin: true, user: sessionUser };
  }

  const sb = getSupabaseClient();
  if (!sb) {
    return null;
  }

  try {
    // 2. Validasi token JWT langsung ke Supabase Auth
    let authUser = null;
    const { data: authData, error: authError } = await sb.auth.getUser(token);

    if (!authError && authData && authData.user) {
      authUser = authData.user;
    } else {
      return null;
    }

    if (!authUser) return null;

    const authEmail = (authUser.email || '').toLowerCase();
    const authCandidate = authEmail.includes('@') ? authEmail.split('@')[0] : authEmail;
    const metadataUsername = (authUser.user_metadata?.username || '').toLowerCase();

    // 2. Memastikan akun pengguna memiliki role = 'admin' pada tabel admins
    const { data: adminRows, error: dbError } = await sb
      .from('admins')
      .select('*');

    if (dbError || !Array.isArray(adminRows) || adminRows.length === 0) {
      console.warn('[AUTH] Gagal memuat tabel admins atau tabel kosong di Supabase:', dbError?.message);
      return null;
    }

    const matchedAdmin = adminRows.find(a => {
      const u = (a.username || '').toLowerCase();
      const e = (a.email || '').toLowerCase();
      const idStr = String(a.id || '');
      return (
        (e && e === authEmail) ||
        (u && (u === authEmail || u === authCandidate || (metadataUsername && u === metadataUsername))) ||
        (idStr && idStr === String(authUser.id))
      );
    });

    if (!matchedAdmin) {
      console.warn(`[AUTH] User JWT (${authEmail}) tidak ditemukan di tabel admins Supabase.`);
      return null;
    }

    // Pastikan akun memiliki role = 'admin'
    const roleValue = matchedAdmin.role || 'admin';
    if (roleValue !== 'admin') {
      console.warn(`[AUTH] User JWT (${authEmail}) tidak memiliki role 'admin' di tabel admins (role: ${roleValue}).`);
      return null;
    }

    return {
      role: 'admin',
      isSuperAdmin: true,
      user: {
        id: matchedAdmin.id,
        authId: authUser.id,
        email: matchedAdmin.email || authUser.email,
        username: matchedAdmin.username || authCandidate,
        name: matchedAdmin.name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || matchedAdmin.username,
        role: 'admin'
      }
    };
  } catch (err) {
    console.error('[AUTH] Kesalahan saat verifikasi token JWT admin:', err.message || err);
    return null;
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint status sistem (kredensial Supabase terisolasi dan TIDAK dibocorkan ke client)
app.get('/api/config', (req, res) => {
  const { supabaseUrl } = getSupabaseConfig();
  res.json({
    status: 'connected',
    isolated: true,
    supabaseConfigured: Boolean(supabaseUrl)
  });
});

// Mengambil konfigurasi WhatsApp langsung dari tabel admin_config Supabase
app.get('/api/config/wa', async (req, res) => {
  try {
    const cfg = await getAppConfigFromDb();
    res.json({ wa_number: cfg.wa_number || '6285111029242' });
  } catch (err) {
    console.error('Error fetching WA config from Supabase:', err.message || err);
    res.json({ wa_number: '6285111029242' });
  }
});

// Menyimpan pembaruan konfigurasi WhatsApp langsung dan penuh ke tabel admin_config Supabase
app.post('/api/config/wa', async (req, res) => {
  const adminAuth = await verifyAdminAuth(req);
  if (!adminAuth) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Sesi admin aktif diperlukan.' });
  }

  const { wa_number } = req.body || {};
  if (!wa_number) {
    return res.status(400).json({ success: false, message: 'Nomor WhatsApp diperlukan.' });
  }

  const clean = String(wa_number).replace(/[^0-9]/g, '');
  if (clean.length < 8) {
    return res.status(400).json({ success: false, message: 'Nomor WhatsApp minimal 8 angka.' });
  }

  try {
    await saveAppConfigToDb(clean);
    console.log(`[CONFIG] Nomor WhatsApp berhasil diperbarui ke tabel admin_config Supabase: ${clean}`);
    res.json({ success: true, wa_number: clean });
  } catch (err) {
    console.error('Error saat menyimpan nomor WhatsApp ke tabel admin_config Supabase:', err.message || err);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal memperbarui nomor WhatsApp di database: ' + (err.message || 'Kesalahan server') 
    });
  }
});

// Endpoint untuk verifikasi sesi Supabase Auth di sisi server
app.post('/api/auth/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith('Bearer ')) 
      ? authHeader.substring(7) 
      : req.body?.token;

    if (!token) {
      return res.status(401).json({ authenticated: false, message: 'Token otentikasi tidak ditemukan.' });
    }

    // Verifikasi sesi admin dari server-side state
    const serverAdmin = verifyServerSessionToken(token);
    if (serverAdmin) {
      return res.json({ authenticated: true, role: 'admin', user: serverAdmin });
    }

    const { supabaseUrl, supabaseKey } = getSupabaseConfig();
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseKey
      }
    });

    const data = await resp.json();
    if (resp.ok && data && data.id) {
      return res.json({ authenticated: true, user: data });
    } else {
      return res.status(401).json({ 
        authenticated: false, 
        message: data.msg || data.message || 'Sesi otentikasi tidak valid atau telah kedaluwarsa.' 
      });
    }
  } catch (err) {
    console.error('Auth verification error:', err.message || err);
    return res.status(401).json({ authenticated: false, message: 'Autentikasi gagal atau token tidak valid.' });
  }
});

// Endpoint untuk mengambil daftar admin (Hanya dapat diakses oleh admin aktif, langsung dari tabel admins Supabase)
app.get('/api/admin/list', async (req, res) => {
  const adminAuth = await verifyAdminAuth(req);
  if (!adminAuth) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Sesi admin aktif diperlukan.' });
  }

  const sb = getSupabaseClient();
  if (!sb) {
    return res.json({ success: true, admins: [] });
  }

  try {
    const { data: dbAdmins, error } = await sb
      .from('admins')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('[AUTH] Gagal membaca tabel admins Supabase:', error.message);
      return res.status(500).json({ success: false, message: 'Gagal memuat daftar admin dari database: ' + error.message });
    }

    const sanitized = (dbAdmins || []).map(a => {
      const u = a.username || 'admin';
      return {
        id: a.id,
        email: a.email || `${u.toLowerCase()}@prossindo.com`,
        username: u,
        name: a.name || (u.toLowerCase() === 'admin' ? 'Super Admin' : u),
        role: a.role || 'admin',
        autoConfirmed: true,
        createdAt: a.created_at || new Date().toISOString()
      };
    });

    res.json({ success: true, admins: sanitized });
  } catch (err) {
    console.error('Error in /api/admin/list:', err.message || err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat memuat daftar admin.' });
  }
});

// Endpoint untuk pendaftaran Admin Baru (auto-confirmed) secara langsung dan penuh ke database Supabase
app.post('/api/admin/create-admin', async (req, res) => {
  try {
    const adminAuth = await verifyAdminAuth(req);
    if (!adminAuth) {
      return res.status(401).json({ 
        success: false, 
        message: 'Akses ditolak. Anda harus login sebagai Super Admin untuk menambah admin baru.' 
      });
    }

    const { email, password, name, username } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ success: false, message: 'Format email admin baru tidak valid.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password admin baru minimal 6 karakter.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username || cleanEmail.split('@')[0]).trim().replace(/\s+/g, '_');
    const cleanName = (name || cleanUsername).trim();
    const bcryptPasswordHash = await bcrypt.hash(password, 10);

    const sb = getSupabaseClient();
    if (!sb) {
      return res.status(503).json({
        success: false,
        message: 'Layanan database Supabase tidak terhubung pada server.'
      });
    }

    // 1. Periksa apakah username sudah ada di tabel admins Supabase
    const { data: existingDbAdmins } = await sb
      .from('admins')
      .select('id, username')
      .ilike('username', cleanUsername);

    let dbAdminRecord = null;
    if (existingDbAdmins && existingDbAdmins.length > 0) {
      // Perbarui password hash jika admin dengan username ini sudah ada
      const { data: updated, error: updErr } = await sb
        .from('admins')
        .update({ 
          password_hash: bcryptPasswordHash,
          email: cleanEmail
        })
        .eq('id', existingDbAdmins[0].id)
        .select();

      if (updErr) {
        console.error('CRITICAL: Gagal update password admin di Supabase:', updErr.message);
        return res.status(500).json({ success: false, message: 'Gagal memperbarui admin di database: ' + updErr.message });
      }
      dbAdminRecord = updated?.[0];
      console.log(`[AUTH] Password hash admin "${cleanUsername}" berhasil diperbarui di tabel admins Supabase dengan bcrypt.`);
    } else {
      // 2. Eksekusi INSERT langsung ke tabel admins Supabase dengan hash bcrypt
      const { data: inserted, error: insErr } = await sb
        .from('admins')
        .insert([{
          username: cleanUsername,
          email: cleanEmail,
          password_hash: bcryptPasswordHash,
          role: 'admin'
        }])
        .select();

      if (insErr) {
        console.error('CRITICAL: Gagal INSERT ke tabel admins Supabase:', insErr.message);
        return res.status(500).json({ success: false, message: 'Gagal menambahkan admin ke database: ' + insErr.message });
      }
      dbAdminRecord = inserted?.[0];
      console.log(`[AUTH] Admin baru "${cleanUsername}" berhasil disimpan ke tabel admins Supabase:`, dbAdminRecord);
    }

    const adminEntry = {
      id: dbAdminRecord?.id || Date.now(),
      email: cleanEmail,
      username: cleanUsername,
      name: cleanName,
      role: 'admin',
      autoConfirmed: true,
      createdAt: dbAdminRecord?.created_at || new Date().toISOString()
    };

    // 3. Sinkronisasi opsional ke Supabase Auth jika Service Role Key tersedia
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    if (serviceRoleKey) {
      try {
        await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: cleanEmail,
            password: password,
            email_confirm: true,
            user_metadata: { role: 'admin', full_name: cleanName, username: cleanUsername }
          })
        });
      } catch (e) {}
    }

    return res.status(201).json({
      success: true,
      message: `Akun Super Admin baru "${cleanUsername}" (${cleanEmail}) berhasil didaftarkan dan tersimpan langsung di database Supabase!`,
      admin: adminEntry
    });
  } catch (err) {
    console.error('Error saat create admin:', err.message || err);
    return res.status(500).json({ 
      success: false, 
      message: 'Gagal membuat akun admin: ' + (err.message || 'Kesalahan server') 
    });
  }
});

// Handler login admin terpusat dengan bcrypt.compare dan tabel admins Supabase
async function handleAdminLogin(req, res) {
  try {
    const { emailOrUsername, email, username, identifier, password } = req.body || {};
    const inputIdentifier = (emailOrUsername || identifier || email || username || '').trim();

    if (!inputIdentifier) {
      return res.status(400).json({ 
        success: false, 
        valid: false, 
        message: 'Email atau username admin wajib diisi.' 
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ 
        success: false, 
        valid: false, 
        message: 'Password admin wajib diisi.' 
      });
    }

    // Validasi login admin langsung ke database Supabase
    const sb = getSupabaseClient();
    if (!sb) {
      return res.status(503).json({ 
        success: false, 
        valid: false, 
        message: 'Layanan database Supabase tidak terhubung pada server.' 
      });
    }

    const cleanInput = inputIdentifier.toLowerCase();
    const userCandidate = cleanInput.includes('@') ? cleanInput.split('@')[0] : cleanInput;

    // Ambil data admin dari tabel admins di Supabase
    const { data: dbAdmins, error: queryErr } = await sb
      .from('admins')
      .select('*');

    if (queryErr || !Array.isArray(dbAdmins) || dbAdmins.length === 0) {
      return res.status(401).json({ 
        success: false, 
        valid: false, 
        message: 'Kredensial admin tidak ditemukan di database Supabase.' 
      });
    }

    const foundDbAdmin = dbAdmins.find(a => {
      const u = (a.username || '').toLowerCase();
      const e = (a.email || '').toLowerCase();
      return (
        (e && e === cleanInput) ||
        (u && (u === cleanInput || u === userCandidate))
      );
    });

    if (!foundDbAdmin || !foundDbAdmin.password_hash) {
      return res.status(401).json({ 
        success: false, 
        valid: false, 
        message: 'Kredensial admin tidak ditemukan.' 
      });
    }

    // Gunakan bcrypt.compare untuk mencocokkan password input dengan password_hash di database Supabase
    const isMatch = await bcrypt.compare(password, foundDbAdmin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        valid: false, 
        message: 'Password tidak cocok.' 
      });
    }

    // Pastikan akun pengguna memiliki role = 'admin' pada tabel admins
    const roleValue = foundDbAdmin.role || 'admin';
    if (roleValue !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        valid: false, 
        message: 'Akses ditolak: Akun tidak memiliki hak akses role admin.' 
      });
    }

    const adminEmail = foundDbAdmin.email || `${foundDbAdmin.username}@prossindo.com`;
    const adminPayload = {
      id: foundDbAdmin.id,
      username: foundDbAdmin.username || 'admin',
      email: adminEmail,
      name: foundDbAdmin.name || (foundDbAdmin.username === 'admin' ? 'Super Admin' : foundDbAdmin.username),
      role: 'admin'
    };

    // Sinkronisasi/akuisisi token JWT Supabase Auth resmi
    let token = null;
    try {
      const authRes = await sb.auth.signInWithPassword({
        email: adminEmail,
        password: password
      });
      if (authRes.data?.session?.access_token) {
        token = authRes.data.session.access_token;
      }
    } catch (authErr) {
      console.warn('[AUTH] Notice saat sign in Supabase Auth:', authErr.message || authErr);
    }

    if (!token) {
      const { serviceRoleKey } = getSupabaseConfig();
      if (serviceRoleKey) {
        try {
          await sb.auth.admin.createUser({
            email: adminEmail,
            password: password,
            email_confirm: true,
            user_metadata: { role: 'admin', username: foundDbAdmin.username, name: adminPayload.name }
          });
          const retryAuth = await sb.auth.signInWithPassword({
            email: adminEmail,
            password: password
          });
          if (retryAuth.data?.session?.access_token) {
            token = retryAuth.data.session.access_token;
          }
        } catch (syncErr) {
          // Abaikan jika user sudah terdaftar di Supabase Auth
        }
      }
    }

    // Jika Supabase Auth JWT belum tersedia, gunakan server session token
    if (!token) {
      token = generateSessionToken(adminPayload);
    }

    console.log(`[AUTH] Admin login berhasil via bcrypt di tabel admins Supabase: username=${foundDbAdmin.username}`);
    return res.json({
      success: true,
      valid: true,
      message: 'Login admin berhasil.',
      admin: adminPayload,
      user: adminPayload,
      token: token
    });
  } catch (err) {
    console.error('[AUTH] Kesalahan pada endpoint login admin:', err.message || err);
    return res.status(500).json({ 
      success: false, 
      valid: false, 
      message: 'Terjadi kesalahan pada server saat autentikasi admin: ' + (err.message || 'Kesalahan server') 
    });
  }
}

// Endpoint login admin dengan proteksi Rate Limiter (maksimal 5 percobaan per 15 menit)
app.post('/api/admin/login', adminLoginLimiter, handleAdminLogin);
app.post('/api/admin/verify-credentials', adminLoginLimiter, handleAdminLogin);

// Endpoint untuk login member dengan verifikasi strict ke tabel members Supabase
app.post('/api/member/login', async (req, res) => {
  try {
    const { username } = req.body || {};

    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username member wajib diisi.' });
    }

    const cleanUsername = username.trim();
    const lowerUser = cleanUsername.toLowerCase();

    if (lowerUser === 'admin' || lowerUser === 'superadmin') {
      return res.status(400).json({ 
        success: false, 
        message: 'Akun Super Admin wajib login melalui menu Admin.' 
      });
    }

    const sb = getSupabaseClient();
    if (!sb) {
      return res.status(503).json({ success: false, message: 'Layanan database Supabase tidak terhubung pada server.' });
    }

    // Cari kecocokan username di tabel members Supabase (case-insensitive strict match)
    const { data: matchedMembers, error: queryErr } = await sb
      .from('members')
      .select('id, username, name, created_at')
      .ilike('username', cleanUsername);

    if (queryErr) {
      console.error('[MEMBER LOGIN] Gagal query tabel members Supabase:', queryErr.message);
      return res.status(500).json({ 
        success: false, 
        message: 'Gagal memverifikasi data member ke database Supabase.' 
      });
    }

    // Pastikan kecocokan exact match tanpa wildcard
    const foundMember = Array.isArray(matchedMembers)
      ? matchedMembers.find(m => String(m.username || '').trim().toLowerCase() === lowerUser)
      : null;

    if (!foundMember) {
      console.warn(`[MEMBER LOGIN] Login member ditolak: Username "${cleanUsername}" tidak terdaftar di tabel members.`);
      return res.status(401).json({
        success: false,
        message: 'Username tidak terdaftar. Silakan hubungi Admin untuk pendaftaran.'
      });
    }

    console.log(`[MEMBER LOGIN] Member terverifikasi valid: id=${foundMember.id}, username=${foundMember.username}`);

    return res.json({
      success: true,
      message: 'Login member berhasil.',
      member: {
        id: foundMember.id,
        username: foundMember.username,
        name: foundMember.name || foundMember.username,
        created_at: foundMember.created_at,
        role: 'member'
      }
    });
  } catch (err) {
    console.error('Error in /api/member/login:', err.message || err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat login member.' });
  }
});

// Endpoint untuk menghapus admin (Hanya dapat diakses oleh admin aktif, langsung dari tabel admins Supabase)
app.delete('/api/admin/:id', async (req, res) => {
  try {
    const adminAuth = await verifyAdminAuth(req);
    if (!adminAuth) {
      return res.status(401).json({ success: false, message: 'Akses ditolak.' });
    }

    const { id } = req.params;
    const cleanId = String(id).trim();

    // Lindungi akun superadmin utama agar tidak terhapus
    if (cleanId.toLowerCase() === 'admin') {
      return res.status(400).json({ success: false, message: 'Akun Super Admin utama tidak dapat dihapus.' });
    }

    const sb = getSupabaseClient();
    if (!sb) {
      return res.status(503).json({ success: false, message: 'Layanan database Supabase tidak terhubung pada server.' });
    }

    const numId = parseInt(cleanId, 10);
    let deleteQuery = sb.from('admins').delete();
    if (!isNaN(numId) && String(numId) === cleanId) {
      deleteQuery = deleteQuery.eq('id', numId);
    } else {
      deleteQuery = deleteQuery.ilike('username', cleanId);
    }

    const { error: delErr } = await deleteQuery;
    if (delErr) {
      console.error('[ADMIN] Gagal menghapus admin dari database Supabase:', delErr.message);
      return res.status(500).json({ success: false, message: 'Gagal menghapus admin dari database: ' + delErr.message });
    }

    console.log(`[AUTH] Admin "${cleanId}" berhasil dihapus dari tabel admins Supabase.`);
    return res.json({ success: true, message: 'Admin berhasil dihapus dari database.' });
  } catch (err) {
    console.error('Error saat menghapus admin:', err.message || err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus admin: ' + (err.message || 'Kesalahan server') });
  }
});

// ==========================================
// UPLOAD GAMBAR FREELANCER (SUPABASE STORAGE)
// Bucket: 'freelancer-images'
// ==========================================

app.post('/api/upload/freelancer-image', async (req, res) => {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth) {
      return res.status(401).json({ 
        success: false, 
        message: 'Akses ditolak: Hanya Super Admin yang berhak mengunggah gambar.' 
      });
    }

    const { image, images, filename } = req.body || {};
    const inputList = Array.isArray(images) ? images : (image ? [image] : []);

    if (inputList.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Harap sertakan data gambar untuk diunggah.' 
      });
    }

    const sb = getSupabaseClient();
    if (!sb) {
      const uploadedUrls = [];
      for (const item of inputList) {
        const rawData = (typeof item === 'object' && item !== null) ? (item.image || item.data) : item;
        if (!rawData || typeof rawData !== 'string') continue;
        uploadedUrls.push(rawData);
      }
      return res.json({
        success: true,
        url: uploadedUrls[0] || '',
        urls: uploadedUrls,
        message: 'Gambar berhasil diproses (mode penyimpanan lokal).'
      });
    }

    const uploadedUrls = [];
    for (const item of inputList) {
      const rawData = (typeof item === 'object' && item !== null) ? (item.image || item.data) : item;
      if (!rawData || typeof rawData !== 'string') continue;

      if (rawData.startsWith('http://') || rawData.startsWith('https://')) {
        uploadedUrls.push(rawData);
      } else {
        const customName = (typeof item === 'object' && item !== null && item.name) ? item.name : filename;
        const pubUrl = await uploadImageToSupabaseStorage(rawData, sb, customName);
        if (pubUrl) uploadedUrls.push(pubUrl);
      }
    }

    if (uploadedUrls.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Format gambar tidak valid atau gagal diproses.' 
      });
    }

    return res.json({
      success: true,
      url: uploadedUrls[0],
      urls: uploadedUrls,
      message: 'Gambar berhasil diunggah ke Supabase Storage (bucket: freelancer-images).'
    });
  } catch (err) {
    console.error('[STORAGE] Error upload freelancer image:', err.message || err);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengunggah gambar ke Supabase Storage: ' + (err.message || 'Kesalahan server')
    });
  }
});

// ==========================================
// BACKEND DATABASE PROXY (SUPABASE PROXY ARCHITECTURE)
// ==========================================

const ALLOWED_TABLES = new Set(['freelancers', 'members', 'admin_config', 'admins', 'wa_leads']);

function isValidTable(table) {
  return typeof table === 'string' && ALLOWED_TABLES.has(table.toLowerCase());
}

// 1. GET /api/db/data & GET /api/db/:table
async function handleDbSelect(req, res) {
  try {
    const table = req.params.table || req.query.table;
    if (!isValidTable(table)) {
      return res.status(400).json({ data: null, error: { message: `Tabel "${table}" tidak valid atau tidak diizinkan.` } });
    }

    const cleanTable = table.toLowerCase();

    // Proteksi: Tabel 'admins' dan 'wa_leads' memerlukan otorisasi admin untuk membaca
    if (cleanTable === 'admins' || cleanTable === 'wa_leads') {
      const auth = await verifyAdminAuth(req);
      if (!auth) {
        return res.status(401).json({ data: null, error: { message: 'Akses ditolak: Sesi admin aktif diperlukan untuk membaca data ini.' } });
      }
    }

    const sb = getSupabaseClient();
    if (!sb) {
      if (cleanTable === 'admin_config') {
        return res.json({ data: [{ id: 1, wa_number: appWaNumber }], error: null });
      }
      return res.json({ data: [], error: null });
    }

    const selectFields = req.query.select || '*';
    let query = sb.from(cleanTable).select(selectFields);

    if (req.query.order) {
      const ascending = req.query.ascending === 'true';
      query = query.order(req.query.order, { ascending });
    }

    if (req.query.limit) {
      const limitNum = parseInt(req.query.limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        query = query.limit(limitNum);
      }
    }

    // Filter query kolom
    if (req.query.filterField && req.query.filterValue !== undefined) {
      if (req.query.ilike === 'true') {
        query = query.ilike(req.query.filterField, req.query.filterValue);
      } else {
        query = query.eq(req.query.filterField, req.query.filterValue);
      }
    }

    if (req.query.single === 'true') {
      const { data, error } = await query.single();
      if (error) {
        return res.status(200).json({ data: null, error: { message: error.message, code: error.code } });
      }
      return res.json({ data, error: null });
    }

    if (req.query.maybeSingle === 'true') {
      const { data, error } = await query.maybeSingle();
      if (error) {
        return res.status(200).json({ data: null, error: { message: error.message, code: error.code } });
      }
      return res.json({ data, error: null });
    }

    const { data, error } = await query;
    if (error) {
      return res.status(200).json({ data: null, error: { message: error.message, code: error.code } });
    }

    return res.json({ data: data || [], error: null });
  } catch (err) {
    console.error('Error in DB Proxy Select:', err.message || err);
    return res.status(500).json({ data: null, error: { message: err.message || 'Internal Server Error' } });
  }
}

app.get('/api/db/data', handleDbSelect);
app.get('/api/db/:table', handleDbSelect);

// 2. POST /api/db/data & POST /api/db/:table
async function handleDbInsert(req, res) {
  try {
    const table = req.params.table || req.body.table;
    if (!isValidTable(table)) {
      return res.status(400).json({ data: null, error: { message: `Tabel "${table}" tidak valid.` } });
    }

    const cleanTable = table.toLowerCase();

    // Proteksi: Semua mutasi WAJIB admin, KECUALI 'wa_leads' (lead tracking pengunjung/member saat klik WhatsApp)
    if (cleanTable !== 'wa_leads') {
      const auth = await verifyAdminAuth(req);
      if (!auth) {
        return res.status(401).json({ data: null, error: { message: 'Akses ditolak: Sesi admin aktif diperlukan untuk menambah data.' } });
      }
    }

    let insertData = req.body.data !== undefined ? req.body.data : req.body;
    if (insertData && typeof insertData === 'object' && insertData.table) {
      const { table: _, ...rest } = insertData;
      insertData = rest;
    }

    let records = Array.isArray(insertData) ? insertData : [insertData];

    const sb = getSupabaseClient();
    if (!sb) {
      return res.status(503).json({ data: null, error: { message: 'Database Supabase tidak terhubung.' } });
    }

    // Sanitasi terstruktur sesuai skema kolom database Supabase
    if (cleanTable === 'wa_leads') {
      records = records.map(r => ({
        member_name: String(r.member_name || 'Member').trim(),
        talent_name: String(r.talent_name || 'Talent').trim(),
        service: String(r.service || '-').trim(),
        reference: String(r.reference || 'Katalog Talent').trim()
      }));
    } else if (cleanTable === 'freelancers') {
      records = await Promise.all(records.map(async r => {
        let imgs = r.images;
        if (typeof imgs === 'string') {
          try { imgs = JSON.parse(imgs); } catch(e) { imgs = [imgs]; }
        }
        const imgList = Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []);
        const storageUrls = await processFreelancerImagesForStorage(imgList, sb);
        return {
          name: String(r.name || 'Tanpa Nama').trim(),
          location: String(r.location || '-').trim(),
          status: String(r.status || 'Available').trim(),
          service: String(r.service || '-').trim(),
          description: String(r.description || '').trim(),
          images: storageUrls
        };
      }));
    } else if (cleanTable === 'members') {
      records = records.map(r => ({
        username: String(r.username || '').trim(),
        name: String(r.name || r.username || '').trim()
      })).filter(r => r.username.length > 0);
    }

    let { data, error } = await sb.from(cleanTable).insert(records).select();

    // Fallback otomatis jika ada error schema cache Supabase
    if (error && error.code === 'PGRST204' && cleanTable === 'wa_leads') {
      const sanitized = records.map(({ status, ...keep }) => keep);
      const retry = await sb.from(cleanTable).insert(sanitized).select();
      data = retry.data;
      error = retry.error;
    }

    if (error && error.code === 'PGRST204' && cleanTable === 'members') {
      const sanitized = records.map(({ name, ...keep }) => keep);
      const retry = await sb.from(cleanTable).insert(sanitized).select();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return res.status(400).json({ data: null, error: { message: error.message, code: error.code } });
    }

    return res.json({ data, error: null });
  } catch (err) {
    console.error('Error in DB Proxy Insert:', err.message || err);
    return res.status(500).json({ data: null, error: { message: err.message || 'Internal Server Error' } });
  }
}

app.post('/api/db/data', checkWaLeadsRateLimit, handleDbInsert);
app.post('/api/db/:table', checkWaLeadsRateLimit, handleDbInsert);

// 3. PUT /api/db/data & PUT /api/db/:table
async function handleDbUpdate(req, res) {
  try {
    const table = req.params.table || req.body.table;
    if (!isValidTable(table)) {
      return res.status(400).json({ data: null, error: { message: `Tabel "${table}" tidak valid.` } });
    }

    // WAJIB LINDUNGI: Mutasi PUT hanya untuk admin terotentikasi
    const auth = await verifyAdminAuth(req);
    if (!auth) {
      return res.status(401).json({ data: null, error: { message: 'Akses ditolak: Sesi admin aktif diperlukan untuk memperbarui data.' } });
    }

    const cleanTable = table.toLowerCase();
    let updateData = req.body.data !== undefined ? req.body.data : req.body;
    const match = req.body.match || {};
    const upsert = req.body.upsert === true;

    const sb = getSupabaseClient();
    if (!sb) {
      if (cleanTable === 'admin_config') {
        if (updateData.wa_number) {
          appWaNumber = String(updateData.wa_number).trim();
        }
        return res.json({ data: [{ id: 1, wa_number: appWaNumber }], error: null });
      }
      return res.status(503).json({ data: null, error: { message: 'Database Supabase tidak terhubung.' } });
    }

    // Sanitasi field updateData untuk freelancers dan simpan ke Supabase Storage
    if (cleanTable === 'freelancers' && updateData && typeof updateData === 'object') {
      if (updateData.images) {
        if (typeof updateData.images === 'string') {
          try { updateData.images = JSON.parse(updateData.images); } catch(e) { updateData.images = [updateData.images]; }
        }
        if (!Array.isArray(updateData.images)) {
          updateData.images = [updateData.images];
        }
        updateData.images = await processFreelancerImagesForStorage(updateData.images, sb);

        // Hapus foto lama dari Supabase Storage yang tidak lagi digunakan setelah edit
        const targetId = (match && match.id) || req.query.id;
        if (targetId) {
          try {
            const queryId = (!isNaN(Number(targetId)) && String(Number(targetId)) === String(targetId).trim()) ? Number(targetId) : targetId;
            const { data: oldRow } = await sb.from('freelancers').select('images').eq('id', queryId).maybeSingle();
            if (oldRow && oldRow.images) {
              let oldImgs = oldRow.images;
              if (typeof oldImgs === 'string') {
                try { oldImgs = JSON.parse(oldImgs); } catch (e) { oldImgs = [oldImgs]; }
              }
              if (Array.isArray(oldImgs)) {
                const currentImgs = Array.isArray(updateData.images) ? updateData.images : [];
                const toRemove = [];
                for (const oldUrl of oldImgs) {
                  if (typeof oldUrl === 'string' && oldUrl.includes('/freelancer-images/') && !currentImgs.includes(oldUrl)) {
                    const parts = oldUrl.split('/freelancer-images/');
                    if (parts[1]) {
                      const cleanFilename = decodeURIComponent(parts[1].split('?')[0]);
                      if (cleanFilename) toRemove.push(cleanFilename);
                    }
                  }
                }
                if (toRemove.length > 0) {
                  console.log('[STORAGE] Menghapus foto lama yang diganti:', toRemove);
                  await sb.storage.from('freelancer-images').remove(toRemove);
                }
              }
            }
          } catch (cleanErr) {
            console.warn('[STORAGE] Peringatan pembersihan foto lama:', cleanErr.message);
          }
        }
      }
    }

    if (upsert) {
      const { data, error } = await sb.from(cleanTable).upsert(updateData).select();
      if (error) {
        return res.status(400).json({ data: null, error: { message: error.message, code: error.code } });
      }
      return res.json({ data, error: null });
    }

    let query = sb.from(cleanTable).update(updateData);
    if (match && typeof match === 'object' && Object.keys(match).length > 0) {
      for (const [col, val] of Object.entries(match)) {
        let cleanVal = val;
        if (col === 'id' && typeof val === 'string' && !isNaN(Number(val)) && String(Number(val)) === val.trim()) {
          cleanVal = Number(val);
        }
        if (req.body.ilike === true) {
          query = query.ilike(col, cleanVal);
        } else {
          query = query.eq(col, cleanVal);
        }
      }
    } else if (req.query.id) {
      const cleanId = (!isNaN(Number(req.query.id)) && String(Number(req.query.id)) === String(req.query.id).trim()) ? Number(req.query.id) : req.query.id;
      query = query.eq('id', cleanId);
    } else {
      return res.status(400).json({ data: null, error: { message: 'Kriteria match / filter identitas data wajib ditentukan.' } });
    }

    const { data, error } = await query.select();
    if (error) {
      return res.status(400).json({ data: null, error: { message: error.message, code: error.code } });
    }

    return res.json({ data, error: null });
  } catch (err) {
    console.error('Error in DB Proxy Update:', err.message || err);
    return res.status(500).json({ data: null, error: { message: err.message || 'Internal Server Error' } });
  }
}

app.put('/api/db/data', handleDbUpdate);
app.put('/api/db/:table', handleDbUpdate);

// 4. DELETE /api/db/data & DELETE /api/db/:table
async function handleDbDelete(req, res) {
  try {
    const table = req.params.table || req.body?.table || req.query?.table;
    if (!isValidTable(table)) {
      return res.status(400).json({ success: false, error: { message: `Tabel "${table}" tidak valid.` } });
    }

    // WAJIB LINDUNGI: Mutasi DELETE hanya untuk admin terotentikasi
    const auth = await verifyAdminAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: { message: 'Akses ditolak: Sesi admin aktif diperlukan untuk menghapus data.' } });
    }

    const cleanTable = table.toLowerCase();
    const match = req.body?.match || {};
    const id = req.query?.id || req.body?.id || match.id;
    const username = req.query?.username || req.body?.username || match.username;

    const sb = getSupabaseClient();
    if (!sb) {
      return res.status(503).json({ success: false, error: { message: 'Database Supabase tidak terhubung.' } });
    }

    // Jika menghapus talent di freelancers, hapus juga file foto dari Supabase Storage bucket 'freelancer-images' jika ada
    if (cleanTable === 'freelancers' && id) {
      try {
        const queryId = (!isNaN(Number(id)) && String(Number(id)) === String(id).trim()) ? Number(id) : id;
        const { data: row } = await sb.from('freelancers').select('images').eq('id', queryId).maybeSingle();
        if (row && row.images) {
          let imgs = row.images;
          if (typeof imgs === 'string') {
            try { imgs = JSON.parse(imgs); } catch (e) { imgs = [imgs]; }
          }
          if (Array.isArray(imgs)) {
            const filesToRemove = [];
            for (const imgUrl of imgs) {
              if (typeof imgUrl === 'string' && imgUrl.includes('/freelancer-images/')) {
                const parts = imgUrl.split('/freelancer-images/');
                if (parts[1]) {
                  const cleaned = decodeURIComponent(parts[1].split('?')[0]);
                  if (cleaned) filesToRemove.push(cleaned);
                }
              }
            }
            if (filesToRemove.length > 0) {
              console.log('[STORAGE] Menghapus file foto talent dari bucket freelancer-images:', filesToRemove);
              await sb.storage.from('freelancer-images').remove(filesToRemove);
            }
          }
        }
      } catch (storageErr) {
        console.warn('[STORAGE] Gagal menghapus foto saat hapus talent:', storageErr.message || storageErr);
      }
    }

    let query = sb.from(cleanTable).delete();
    if (match && typeof match === 'object' && Object.keys(match).length > 0) {
      for (const [col, val] of Object.entries(match)) {
        let cleanVal = val;
        if (col === 'id' && typeof val === 'string' && !isNaN(Number(val)) && String(Number(val)) === val.trim()) {
          cleanVal = Number(val);
        }
        if (col === 'username') {
          query = query.ilike(col, String(cleanVal));
        } else {
          query = query.eq(col, cleanVal);
        }
      }
    } else if (id) {
      const cleanId = (!isNaN(Number(id)) && String(Number(id)) === String(id).trim()) ? Number(id) : id;
      query = query.eq('id', cleanId);
    } else if (username) {
      query = query.ilike('username', String(username));
    } else {
      return res.status(400).json({ success: false, error: { message: 'Kriteria penghapusan data tidak ditemukan.' } });
    }

    const { error } = await query;
    if (error) {
      return res.status(400).json({ success: false, error: { message: error.message, code: error.code } });
    }

    return res.json({ success: true, error: null });
  } catch (err) {
    console.error('Error in DB Proxy Delete:', err.message || err);
    return res.status(500).json({ success: false, error: { message: err.message || 'Internal Server Error' } });
  }
}

app.delete('/api/db/data', handleDbDelete);
app.delete('/api/db/:table', handleDbDelete);

// ==========================================
// VITE DEV & STATIC PRODUCTION SERVING
// ==========================================

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);
  let vite = null;

  if (!isProd && fs.existsSync(path.join(__dirname, 'vite.config.ts'))) {
    try {
      const { createServer: createViteServer } = await import('vite');
      vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR === 'true'
            ? false
            : {
                server: httpServer,
                clientPort: 443,
              },
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('[VITE] Middleware Vite berhasil diaktifkan untuk mode pengembangan.');
    } catch (err) {
      console.warn('[VITE] Vite middleware tidak aktif, menggunakan serving statis:', err.message);
    }
  }

  // Melayani file build statis jika direktori dist tersedia
  if (fs.existsSync(path.join(__dirname, 'dist'))) {
    app.use(express.static(path.join(__dirname, 'dist')));
  }

  // Fallback route untuk Single Page Application
  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    try {
      if (vite) {
        let template = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        return res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      }
      if (fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
        return res.sendFile(path.join(__dirname, 'dist', 'index.html'));
      }
      res.sendFile(path.join(__dirname, 'index.html'));
    } catch (err) {
      if (vite) vite.ssrFixStacktrace(err);
      next(err);
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch(err => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}

export default app;
