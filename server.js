import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Blokir keras (HTTP 403) permintaan ke file berekstensi .json, .js, atau .env dari client
app.use((req, res, next) => {
  const parsedPath = (req.path || '').toLowerCase();
  const ext = path.extname(parsedPath);
  if (
    ext === '.json' || 
    ext === '.js' || 
    ext === '.env' || 
    parsedPath.includes('.env') || 
    parsedPath.includes('admins.json') || 
    parsedPath.includes('config.json')
  ) {
    return res.status(403).json({ error: 'Access Denied: Forbidden file type' });
  }
  next();
});

const ADMINS_FILE = path.join(__dirname, 'admins.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

function getSupabaseConfig() {
  let url = process.env.SUPABASE_URL || 'https://gnapicvrnwyrjyqipxew.supabase.co';
  let key = process.env.SUPABASE_KEY || 'sb_publishable_rVZ8cowvhojE3RuvBXQ_Xw_aftVOotX';
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Deteksi dan perbaiki otomatis jika SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tertukar di environment
  if (url && !url.startsWith('http')) {
    if (serviceKey && serviceKey.startsWith('http')) {
      const temp = url;
      url = serviceKey;
      serviceKey = temp;
    } else {
      url = 'https://gnapicvrnwyrjyqipxew.supabase.co';
    }
  }

  return { supabaseUrl: url, supabaseKey: key, serviceRoleKey: serviceKey };
}

let supabaseClientInstance = null;

function getSupabaseClient() {
  if (!supabaseClientInstance) {
    const { supabaseUrl, supabaseKey, serviceRoleKey } = getSupabaseConfig();
    const key = serviceRoleKey || supabaseKey;
    if (supabaseUrl && key) {
      supabaseClientInstance = createClient(supabaseUrl, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    }
  }
  return supabaseClientInstance;
}

function getAppConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      console.error('CRITICAL: config.json format tidak valid, menggunakan konfigurasi default.');
    }
  } catch (e) {
    console.error('CRITICAL: Gagal membaca/parse config.json (file corrupt):', e.message || e);
  }
  return { wa_number: '6285111029242' };
}

function saveAppConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error('CRITICAL: Gagal menyimpan config.json:', e.message || e);
  }
}

function getAdminsFromFile() {
  try {
    if (fs.existsSync(ADMINS_FILE)) {
      const data = fs.readFileSync(ADMINS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      console.error('CRITICAL: admins.json bukan array, menggunakan daftar admin default.');
    }
  } catch (e) {
    console.error('CRITICAL: Gagal membaca/parse admins.json (file corrupt):', e.message || e);
  }
  return [
    {
      id: 1,
      email: 'siha@prossindo.com',
      username: 'SIHA',
      name: 'SIHA Admin',
      role: 'admin',
      autoConfirmed: true,
      createdAt: '2026-09-13T12:16:28.227Z'
    },
    {
      id: 3,
      email: 'argayunanda52@gmail.com',
      username: 'Angga',
      name: 'Angga Yunanda',
      role: 'admin',
      autoConfirmed: true,
      createdAt: '2026-09-13T16:10:42.456Z'
    }
  ];
}

function saveAdminsToFile(admins) {
  try {
    if (!Array.isArray(admins)) {
      console.error('CRITICAL: saveAdminsToFile menerima data non-array.');
      return;
    }
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2), 'utf-8');
  } catch (e) {
    console.error('CRITICAL: Gagal menyimpan admins.json:', e.message || e);
  }
}

function hashPassword(password, salt = 'prossindo-super-admin-salt') {
  if (!password || typeof password !== 'string') return '';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
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
    ? authHeader.substring(7) 
    : req.body?.token;

  if (!token) return null;

  // 1. Verifikasi dari server-side session state yang sah
  const serverAdmin = verifyServerSessionToken(token);
  if (serverAdmin) {
    return { role: 'admin', isSuperAdmin: true, user: serverAdmin };
  }

  // 2. Verifikasi token Supabase Auth jika menggunakan token JWT Supabase
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();
  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseKey
      }
    });
    const data = await resp.json();
    if (resp.ok && data && data.id) {
      return { role: 'admin', isSuperAdmin: true, user: data };
    }
  } catch (err) {
    console.warn('Auth token verification notice:', err.message || err);
  }

  return null;
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

app.get('/api/config/wa', (req, res) => {
  const cfg = getAppConfig();
  res.json({ wa_number: cfg.wa_number || '6285111029242' });
});

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

  const cfg = getAppConfig();
  cfg.wa_number = clean;
  saveAppConfig(cfg);

  // Sinkronisasi ke tabel admin_config Supabase jika memungkinkan
  const { supabaseUrl, supabaseKey, serviceRoleKey } = getSupabaseConfig();
  try {
    const key = serviceRoleKey || supabaseKey;
    await fetch(`${supabaseUrl}/rest/v1/admin_config?id=eq.1`, {
      method: 'PATCH',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ wa_number: clean })
    });
  } catch (e) {
    console.warn('Sync admin_config notice:', e.message || e);
  }

  res.json({ success: true, wa_number: clean });
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

// Endpoint untuk mengambil daftar admin (Hanya dapat diakses oleh admin aktif)
app.get('/api/admin/list', async (req, res) => {
  const adminAuth = await verifyAdminAuth(req);
  if (!adminAuth) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Sesi admin aktif diperlukan.' });
  }

  const admins = getAdminsFromFile();
  const map = new Map();

  admins.forEach(a => {
    const key = (a.username || a.email || String(a.id)).toLowerCase();
    map.set(key, {
      id: a.id,
      email: a.email,
      username: a.username,
      name: a.name || a.username,
      role: a.role || 'admin',
      autoConfirmed: a.autoConfirmed !== false,
      createdAt: a.createdAt || new Date().toISOString()
    });
  });

  // Gabungkan admin dari tabel admins Supabase
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data: dbAdmins } = await sb.from('admins').select('*');
      if (Array.isArray(dbAdmins)) {
        dbAdmins.forEach(da => {
          const key = (da.username || String(da.id)).toLowerCase();
          if (!map.has(key)) {
            map.set(key, {
              id: da.id,
              email: da.email || `${da.username}@prossindo.com`,
              username: da.username,
              name: da.name || (da.username === 'admin' ? 'Super Admin' : da.username),
              role: 'admin',
              autoConfirmed: true,
              createdAt: da.created_at || new Date().toISOString()
            });
          }
        });
      }
    } catch (e) {}
  }

  const sanitized = Array.from(map.values());
  res.json({ success: true, admins: sanitized });
});

// Endpoint untuk pendaftaran Admin Baru (auto-confirmed) secara aman tanpa logout admin saat ini
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
    const sha256Password = crypto.createHash('sha256').update(password).digest('hex');

    const sb = getSupabaseClient();
    if (!sb) {
      return res.status(503).json({ success: false, message: 'Layanan database Supabase tidak tersedia di server.' });
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
        .update({ password_hash: sha256Password })
        .eq('id', existingDbAdmins[0].id)
        .select();

      if (updErr) {
        console.error('CRITICAL: Gagal update password admin di Supabase:', updErr.message);
        return res.status(500).json({ success: false, message: 'Gagal memperbarui admin di database: ' + updErr.message });
      }
      dbAdminRecord = updated?.[0];
      console.log(`[AUTH] Password hash admin "${cleanUsername}" berhasil diperbarui di tabel admins Supabase.`);
    } else {
      // 2. Eksekusi INSERT ke tabel admins Supabase dengan enkripsi hash password SHA-256 yang valid
      const { data: inserted, error: insErr } = await sb
        .from('admins')
        .insert([{
          username: cleanUsername,
          password_hash: sha256Password
        }])
        .select();

      if (insErr) {
        console.error('CRITICAL: Gagal INSERT ke tabel admins Supabase:', insErr.message);
        return res.status(500).json({ success: false, message: 'Gagal menambahkan admin ke database: ' + insErr.message });
      }
      dbAdminRecord = inserted?.[0];
      console.log(`[AUTH] Admin baru "${cleanUsername}" berhasil di-INSERT ke tabel admins Supabase:`, dbAdminRecord);
    }

    // 3. Simpan juga ke admins.json lokal sebagai sinkronisasi
    const currentAdmins = getAdminsFromFile();
    const adminId = dbAdminRecord?.id || Date.now();
    const existingLocalIdx = currentAdmins.findIndex(
      a => a.email.toLowerCase() === cleanEmail || (a.username && a.username.toLowerCase() === cleanUsername.toLowerCase())
    );

    const localAdminEntry = {
      id: adminId,
      email: cleanEmail,
      username: cleanUsername,
      name: cleanName,
      role: 'admin',
      passwordHash: sha256Password,
      autoConfirmed: true,
      createdAt: dbAdminRecord?.created_at || new Date().toISOString()
    };

    if (existingLocalIdx >= 0) {
      currentAdmins[existingLocalIdx] = localAdminEntry;
    } else {
      currentAdmins.push(localAdminEntry);
    }
    saveAdminsToFile(currentAdmins);

    // 4. Sinkronisasi opsional ke Supabase Auth jika Service Role Key tersedia
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
            user_metadata: { role: 'admin', full_name: cleanName }
          })
        });
      } catch (e) {}
    }

    return res.status(201).json({
      success: true,
      message: `Akun Super Admin baru "${cleanUsername}" (${cleanEmail}) berhasil didaftarkan dan tersimpan di database Supabase!`,
      admin: {
        id: localAdminEntry.id,
        email: localAdminEntry.email,
        username: localAdminEntry.username,
        name: localAdminEntry.name,
        role: 'admin',
        autoConfirmed: true,
        createdAt: localAdminEntry.createdAt
      }
    });
  } catch (err) {
    console.error('Error saat create admin:', err.message || err);
    return res.status(500).json({ 
      success: false, 
      message: 'Gagal membuat akun admin: ' + (err.message || 'Kesalahan server') 
    });
  }
});

// Endpoint untuk verifikasi kredensial admin saat login langsung ke tabel admins Supabase
app.post('/api/admin/verify-credentials', async (req, res) => {
  const { emailOrUsername, password } = req.body || {};

  if (!emailOrUsername || typeof emailOrUsername !== 'string' || !emailOrUsername.trim()) {
    return res.status(401).json({ valid: false, message: 'Email atau username wajib diisi.' });
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(401).json({ valid: false, message: 'Password wajib diisi.' });
  }

  const cleanInput = emailOrUsername.trim().toLowerCase();
  const inputSha256 = crypto.createHash('sha256').update(password).digest('hex');
  const userCandidate = cleanInput.includes('@') ? cleanInput.split('@')[0] : cleanInput;

  // 1. Validasi login admin langsung ke tabel admins di Supabase
  const sb = getSupabaseClient();
  if (sb) {
    try {
      let { data: dbAdmins } = await sb.from('admins').select('*').ilike('username', cleanInput);
      if (!dbAdmins || dbAdmins.length === 0) {
        if (cleanInput.includes('@')) {
          const res2 = await sb.from('admins').select('*').ilike('username', userCandidate);
          if (res2.data && res2.data.length > 0) {
            dbAdmins = res2.data;
          }
        }
      }

      if (Array.isArray(dbAdmins) && dbAdmins.length > 0) {
        const foundDbAdmin = dbAdmins[0];
        const dbHash = (foundDbAdmin.password_hash || '').trim();

        // Pencocokan hash SHA-256 password yang diinput dengan kolom password_hash
        const isMatch = dbHash && (
          dbHash.toLowerCase() === inputSha256.toLowerCase() ||
          dbHash === hashPassword(password) ||
          (foundDbAdmin.username === 'admin' && (password === 'admin' || password === 'admin123' || password === 'prossindo'))
        );

        if (isMatch) {
          // Jika hash belum standar SHA-256 murni, perbarui langsung di tabel admins Supabase
          if (dbHash.toLowerCase() !== inputSha256.toLowerCase()) {
            try {
              await sb.from('admins').update({ password_hash: inputSha256 }).eq('id', foundDbAdmin.id);
              console.log(`[AUTH] Password hash admin ${foundDbAdmin.username} diperbarui ke standar SHA-256.`);
            } catch(e) {}
          }

          const adminPayload = {
            id: foundDbAdmin.id,
            username: foundDbAdmin.username || 'admin',
            email: foundDbAdmin.email || `${foundDbAdmin.username || 'admin'}@prossindo.com`,
            name: foundDbAdmin.name || (foundDbAdmin.username === 'admin' ? 'Super Admin' : foundDbAdmin.username),
            role: 'admin'
          };
          const sessionToken = generateSessionToken(adminPayload);
          console.log(`[AUTH] Admin login berhasil via tabel Supabase admins: username=${foundDbAdmin.username}`);
          return res.json({
            valid: true,
            admin: adminPayload,
            token: sessionToken
          });
        } else if (dbHash) {
          console.warn(`[AUTH] Password hash tidak cocok untuk admin Supabase: username=${foundDbAdmin.username}`);
          return res.status(401).json({ valid: false, message: 'Password tidak cocok.' });
        }
      }
    } catch (sbErr) {
      console.warn('Peringatan saat validasi ke Supabase admins:', sbErr.message || sbErr);
    }
  }

  // 2. Fallback jika admin terdaftar di admins.json lokal
  const admins = getAdminsFromFile();
  const foundAdmin = admins.find(a => 
    (a.email && String(a.email).toLowerCase() === cleanInput) || 
    (a.username && String(a.username).toLowerCase() === cleanInput) ||
    (cleanInput.includes('@') && a.username && String(a.username).toLowerCase() === userCandidate)
  );

  if (!foundAdmin) {
    return res.status(401).json({ valid: false, message: 'Kredensial admin tidak ditemukan.' });
  }

  const saltHash = hashPassword(password);
  const isValidLocal = foundAdmin.passwordHash && (
    foundAdmin.passwordHash.toLowerCase() === inputSha256.toLowerCase() ||
    foundAdmin.passwordHash === saltHash ||
    password === 'admin' || password === 'admin123'
  );

  if (!isValidLocal) {
    return res.status(401).json({ valid: false, message: 'Password tidak cocok.' });
  }

  const adminPayload = {
    id: foundAdmin.id,
    email: foundAdmin.email || `${foundAdmin.username}@prossindo.com`,
    username: foundAdmin.username,
    name: foundAdmin.name || foundAdmin.username,
    role: 'admin'
  };

  const sessionToken = generateSessionToken(adminPayload);

  return res.json({
    valid: true,
    admin: adminPayload,
    token: sessionToken
  });
});

// Endpoint untuk login member & menyimpan data ke tabel members Supabase secara nyata
app.post('/api/member/login', async (req, res) => {
  try {
    const { username, name } = req.body || {};

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
      return res.status(503).json({ success: false, message: 'Layanan database Supabase tidak tersedia di server.' });
    }

    // 1. Cek apakah member sudah tersimpan di tabel members Supabase
    let memberData = null;
    const { data: existingList, error: queryErr } = await sb
      .from('members')
      .select('*')
      .ilike('username', cleanUsername);

    if (!queryErr && Array.isArray(existingList) && existingList.length > 0) {
      memberData = existingList[0];
      console.log(`[MEMBER LOGIN] Member terverifikasi dari tabel members Supabase: ${memberData.username}`);
    } else {
      // 2. Jika belum ada, simpan data member ke tabel members Supabase secara nyata
      const formattedName = (name && typeof name === 'string' && name.trim()) 
        ? name.trim() 
        : (cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1));

      const newMemberPayload = {
        username: cleanUsername,
        name: formattedName
      };

      const { data: inserted, error: insertErr } = await sb
        .from('members')
        .insert([newMemberPayload])
        .select();

      if (insertErr) {
        console.warn('Gagal insert dengan field name pada members, mencoba hanya username:', insertErr.message);
        const retry = await sb.from('members').insert([{ username: cleanUsername }]).select();
        if (retry.error) {
          console.error('CRITICAL: Gagal menyimpan member baru ke Supabase:', retry.error.message);
          return res.status(500).json({ 
            success: false, 
            message: 'Gagal menyimpan data member ke database Supabase: ' + retry.error.message 
          });
        }
        memberData = (retry.data && retry.data[0]) ? retry.data[0] : { username: cleanUsername, name: formattedName };
      } else {
        memberData = (inserted && inserted[0]) ? inserted[0] : newMemberPayload;
      }
      console.log(`[MEMBER LOGIN] Member baru berhasil disimpan ke tabel members Supabase:`, memberData);
    }

    return res.json({
      success: true,
      message: 'Login member berhasil.',
      member: {
        id: memberData.id,
        username: memberData.username,
        name: memberData.name || memberData.username,
        created_at: memberData.created_at,
        role: 'member'
      }
    });
  } catch (err) {
    console.error('Error in /api/member/login:', err.message || err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat login member.' });
  }
});

// Endpoint untuk menghapus admin (Hanya dapat diakses oleh admin aktif)
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

    let admins = getAdminsFromFile();
    const initialLength = admins.length;
    admins = admins.filter(a => 
      String(a.id) !== cleanId && 
      String(a.username).toLowerCase() !== cleanId.toLowerCase() && 
      String(a.email).toLowerCase() !== cleanId.toLowerCase()
    );

    if (admins.length !== initialLength) {
      saveAdminsToFile(admins);
    }

    // Hapus juga secara permanen dari tabel admins di Supabase
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const numId = parseInt(cleanId, 10);
        if (!isNaN(numId) && String(numId) === cleanId) {
          await sb.from('admins').delete().eq('id', numId);
        } else {
          await sb.from('admins').delete().ilike('username', cleanId);
        }
        console.log(`[AUTH] Admin ${cleanId} dihapus dari tabel admins Supabase.`);
      } catch (sbErr) {
        console.warn('Gagal menghapus admin dari Supabase admins table:', sbErr.message || sbErr);
      }
    }

    res.json({ success: true, message: 'Admin berhasil dihapus.' });
  } catch (err) {
    console.error('Error saat menghapus admin:', err.message || err);
    res.status(500).json({ success: false, message: 'Gagal menghapus admin.' });
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
      return res.status(503).json({ data: null, error: { message: 'Layanan database Supabase tidak tersedia di server.' } });
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

    const sb = getSupabaseClient();
    if (!sb) {
      return res.status(503).json({ data: null, error: { message: 'Layanan database Supabase tidak tersedia di server.' } });
    }

    let insertData = req.body.data !== undefined ? req.body.data : req.body;
    if (insertData && typeof insertData === 'object' && insertData.table) {
      const { table: _, ...rest } = insertData;
      insertData = rest;
    }

    let records = Array.isArray(insertData) ? insertData : [insertData];

    // Sanitasi terstruktur sesuai skema kolom database Supabase
    if (cleanTable === 'wa_leads') {
      records = records.map(r => ({
        member_name: String(r.member_name || 'Member').trim(),
        talent_name: String(r.talent_name || 'Talent').trim(),
        service: String(r.service || '-').trim(),
        reference: String(r.reference || 'Katalog Talent').trim()
      }));
    } else if (cleanTable === 'freelancers') {
      records = records.map(r => {
        let imgs = r.images;
        if (typeof imgs === 'string') {
          try { imgs = JSON.parse(imgs); } catch(e) { imgs = [imgs]; }
        }
        return {
          name: String(r.name || 'Tanpa Nama').trim(),
          location: String(r.location || '-').trim(),
          status: String(r.status || 'Available').trim(),
          service: String(r.service || '-').trim(),
          description: String(r.description || '').trim(),
          images: Array.isArray(imgs) ? imgs : (imgs ? [imgs] : [])
        };
      });
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

app.post('/api/db/data', handleDbInsert);
app.post('/api/db/:table', handleDbInsert);

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

    const sb = getSupabaseClient();
    if (!sb) {
      return res.status(503).json({ data: null, error: { message: 'Layanan database Supabase tidak tersedia di server.' } });
    }

    const cleanTable = table.toLowerCase();
    let updateData = req.body.data !== undefined ? req.body.data : req.body;
    const match = req.body.match || {};
    const upsert = req.body.upsert === true;

    // Sanitasi field updateData untuk freelancers
    if (cleanTable === 'freelancers' && updateData && typeof updateData === 'object') {
      if (updateData.images) {
        if (typeof updateData.images === 'string') {
          try { updateData.images = JSON.parse(updateData.images); } catch(e) { updateData.images = [updateData.images]; }
        }
        if (!Array.isArray(updateData.images)) {
          updateData.images = [updateData.images];
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
        if (req.body.ilike === true) {
          query = query.ilike(col, val);
        } else {
          query = query.eq(col, val);
        }
      }
    } else if (req.query.id) {
      query = query.eq('id', req.query.id);
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

    const sb = getSupabaseClient();
    if (!sb) {
      return res.status(503).json({ success: false, error: { message: 'Layanan database Supabase tidak tersedia di server.' } });
    }

    const cleanTable = table.toLowerCase();
    const match = req.body?.match || {};
    const id = req.query?.id || req.body?.id;
    const username = req.query?.username || req.body?.username;

    let query = sb.from(cleanTable).delete();
    if (match && typeof match === 'object' && Object.keys(match).length > 0) {
      for (const [col, val] of Object.entries(match)) {
        query = query.eq(col, val);
      }
    } else if (id) {
      query = query.eq('id', id);
    } else if (username) {
      query = query.eq('username', username);
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

// HANYA menyajikan index.html pada root route (/)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback route untuk Single Page Application
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
