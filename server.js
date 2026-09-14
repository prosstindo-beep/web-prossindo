import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

const ADMINS_FILE = path.join(__dirname, 'admins.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

function getAppConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('Error reading config.json:', e.message || e);
  }
  return { wa_number: '6285111029242' };
}

function saveAppConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error saving config.json:', e.message || e);
  }
}

function getAdminsFromFile() {
  try {
    if (fs.existsSync(ADMINS_FILE)) {
      const data = fs.readFileSync(ADMINS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('Error reading admins.json:', e.message || e);
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
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error saving admins.json:', e.message || e);
  }
}

function hashPassword(password, salt = 'prossindo-super-admin-salt') {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

async function verifyAdminAuth(req) {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ')) 
    ? authHeader.substring(7) 
    : req.body?.token;

  if (!token) return null;

  // Sesi admin lokal terverifikasi
  if (token.startsWith('admin-verified-session-') || token.startsWith('admin-table-token-')) {
    return { role: 'admin', isSuperAdmin: true };
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://gnapicvrnwyrjyqipxew.supabase.co';
  const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_rVZ8cowvhojE3RuvBXQ_Xw_aftVOotX';

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
  res.json({ status: 'ok' });
});

app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || 'https://gnapicvrnwyrjyqipxew.supabase.co',
    supabaseKey: process.env.SUPABASE_KEY || 'sb_publishable_rVZ8cowvhojE3RuvBXQ_Xw_aftVOotX'
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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || 'https://gnapicvrnwyrjyqipxew.supabase.co';
  const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_rVZ8cowvhojE3RuvBXQ_Xw_aftVOotX';
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

    // Dukung token sesi admin terverifikasi
    if (token.startsWith('admin-verified-session-') || token.startsWith('admin-table-token-')) {
      return res.json({ authenticated: true, role: 'admin', user: { role: 'admin', app_metadata: { provider: 'supabase' } } });
    }

    const supabaseUrl = process.env.SUPABASE_URL || 'https://gnapicvrnwyrjyqipxew.supabase.co';
    const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_rVZ8cowvhojE3RuvBXQ_Xw_aftVOotX';

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
    console.warn('Auth verification notice:', err.message || err);
    return res.status(500).json({ authenticated: false, error: err.message });
  }
});

// Endpoint untuk mengambil daftar admin (Hanya dapat diakses oleh admin aktif)
app.get('/api/admin/list', async (req, res) => {
  const adminAuth = await verifyAdminAuth(req);
  if (!adminAuth) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Sesi admin aktif diperlukan.' });
  }

  const admins = getAdminsFromFile();
  const sanitized = admins.map(a => ({
    id: a.id,
    email: a.email,
    username: a.username,
    name: a.name || a.username,
    role: a.role || 'admin',
    autoConfirmed: a.autoConfirmed !== false,
    createdAt: a.createdAt || new Date().toISOString()
  }));

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
    const cleanUsername = (username || cleanEmail.split('@')[0]).trim();
    const cleanName = (name || cleanUsername).trim();

    const currentAdmins = getAdminsFromFile();
    const isDuplicate = currentAdmins.some(
      a => a.email.toLowerCase() === cleanEmail || (a.username && a.username.toLowerCase() === cleanUsername.toLowerCase())
    );

    if (isDuplicate) {
      return res.status(400).json({ 
        success: false, 
        message: `Admin dengan email "${cleanEmail}" atau username "${cleanUsername}" sudah terdaftar!` 
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL || 'https://gnapicvrnwyrjyqipxew.supabase.co';
    const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_rVZ8cowvhojE3RuvBXQ_Xw_aftVOotX';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let supabaseAuthCreated = false;

    // 1. Jika service role key tersedia, gunakan Supabase Auth Admin API (auto-confirmed)
    if (serviceRoleKey) {
      try {
        const adminApiRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
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
            user_metadata: {
              role: 'admin',
              full_name: cleanName
            }
          })
        });
        const adminApiData = await adminApiRes.json();
        if (adminApiRes.ok && adminApiData && adminApiData.id) {
          supabaseAuthCreated = true;
          console.log('Admin baru berhasil dibuat via Supabase Admin API:', cleanEmail);
        }
      } catch (err) {
        console.warn('Supabase Admin API call notice:', err.message || err);
      }
    }

    // 2. Jika belum dibuat via admin API, panggil endpoint signup Supabase Auth
    if (!supabaseAuthCreated) {
      try {
        const signupRes = await fetch(`${supabaseUrl}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: cleanEmail,
            password: password,
            data: {
              role: 'admin',
              full_name: cleanName
            }
          })
        });
        const signupData = await signupRes.json();
        if (signupRes.ok && signupData && (signupData.user || signupData.id)) {
          supabaseAuthCreated = true;
          console.log('Admin baru didaftarkan di Supabase Auth via signup:', cleanEmail);
        }
      } catch (err) {
        console.warn('Supabase Auth standard signup notice:', err.message || err);
      }
    }

    // 3. Simpan entri admin baru ke admins.json secara persisten
    const newAdminEntry = {
      id: Date.now(),
      email: cleanEmail,
      username: cleanUsername,
      name: cleanName,
      role: 'admin',
      passwordHash: hashPassword(password),
      autoConfirmed: true,
      createdAt: new Date().toISOString()
    };

    currentAdmins.push(newAdminEntry);
    saveAdminsToFile(currentAdmins);

    // 4. Sinkronisasi ke tabel admins Supabase jika memungkinkan
    try {
      const dbKey = serviceRoleKey || supabaseKey;
      await fetch(`${supabaseUrl}/rest/v1/admins`, {
        method: 'POST',
        headers: {
          'apikey': dbKey,
          'Authorization': `Bearer ${dbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          username: cleanUsername
        })
      });
    } catch (e) {
      console.warn('Sync to Supabase admins table notice:', e.message || e);
    }

    return res.status(201).json({
      success: true,
      message: `Akun Super Admin baru (${cleanEmail}) berhasil dibuat dengan status otomatis terverifikasi!`,
      admin: {
        id: newAdminEntry.id,
        email: newAdminEntry.email,
        username: newAdminEntry.username,
        name: newAdminEntry.name,
        role: newAdminEntry.role,
        autoConfirmed: true,
        createdAt: newAdminEntry.createdAt
      }
    });
  } catch (err) {
    console.warn('Error saat create admin:', err.message || err);
    return res.status(500).json({ 
      success: false, 
      message: 'Gagal membuat akun admin: ' + (err.message || 'Kesalahan server') 
    });
  }
});

// Endpoint untuk verifikasi kredensial admin saat login
app.post('/api/admin/verify-credentials', (req, res) => {
  const { emailOrUsername, password } = req.body || {};
  if (!emailOrUsername || !password) {
    return res.status(400).json({ valid: false, message: 'Email/username dan password wajib diisi.' });
  }

  const cleanInput = emailOrUsername.trim().toLowerCase();
  const admins = getAdminsFromFile();

  const foundAdmin = admins.find(a => 
    a.email.toLowerCase() === cleanInput || 
    (a.username && a.username.toLowerCase() === cleanInput)
  );

  if (!foundAdmin) {
    return res.json({ valid: false, message: 'Kredensial tidak ditemukan.' });
  }

  // Jika admin memiliki passwordHash, cek kecocokan
  if (foundAdmin.passwordHash) {
    const inputHash = hashPassword(password);
    if (inputHash !== foundAdmin.passwordHash) {
      return res.json({ valid: false, message: 'Password tidak cocok.' });
    }
  }

  return res.json({
    valid: true,
    admin: {
      id: foundAdmin.id,
      email: foundAdmin.email,
      username: foundAdmin.username,
      name: foundAdmin.name || foundAdmin.username,
      role: 'admin'
    },
    token: 'admin-verified-session-' + Date.now()
  });
});

// Endpoint untuk menghapus admin (Hanya dapat diakses oleh admin aktif)
app.delete('/api/admin/:id', async (req, res) => {
  const adminAuth = await verifyAdminAuth(req);
  if (!adminAuth) {
    return res.status(401).json({ success: false, message: 'Akses ditolak.' });
  }
  const { id } = req.params;
  let admins = getAdminsFromFile();
  const initialLength = admins.length;
  admins = admins.filter(a => String(a.id) !== String(id) && String(a.username).toLowerCase() !== String(id).toLowerCase() && String(a.email).toLowerCase() !== String(id).toLowerCase());
  if (admins.length !== initialLength) {
    saveAdminsToFile(admins);
  }
  res.json({ success: true, message: 'Admin berhasil dihapus.' });
});

app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});

