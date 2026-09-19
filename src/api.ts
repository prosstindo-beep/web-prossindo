import { AdminAccount, AdminSession, Member } from './types';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const envBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

    // Cegah pengiriman request langsung ke domain Supabase jika VITE_API_BASE_URL salah dikonfigurasi
    if (!envBase || envBase.includes('supabase.co') || envBase.includes('your-project')) {
      return '';
    }

    // Jika diakses dari HTTPS (misal preview Cloud Run ais-dev-... / ais-pre-...),
    // memanggil http:// akan diblokir keras oleh browser dengan error "Failed to fetch" (Mixed Content)
    if (window.location.protocol === 'https:' && envBase.startsWith('http://')) {
      return '';
    }

    // Jika envBase mengarah ke localhost/127.0.0.1 tetapi halaman dibuka dari host remote
    if (
      (envBase.includes('localhost') || envBase.includes('127.0.0.1')) &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return '';
    }

    // Jika origin sama, gunakan path relatif '' agar request otomatis diarahkan ke server yang sama
    if (envBase === window.location.origin) {
      return '';
    }

    return envBase;
  }
  return '';
}

export function getApiBase(): string {
  return getApiBaseUrl();
}

const API_BASE = getApiBaseUrl();

// ==========================================
// TOKEN & AUTH HEADERS HELPER
// ==========================================

export function getAuthToken(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return '';
  }

  // 1. Periksa penyimpanan sesi admin utama 'supabase_admin_session'
  try {
    const raw = localStorage.getItem('supabase_admin_session');
    if (raw) {
      // Cek jika raw merupakan string token langsung tanpa JSON format
      const trimmedRaw = raw.trim();
      if (
        (trimmedRaw.startsWith('ey') || trimmedRaw.length >= 20 || trimmedRaw.includes('.')) &&
        !trimmedRaw.startsWith('{') &&
        !trimmedRaw.startsWith('[')
      ) {
        return trimmedRaw;
      }

      const parsed = JSON.parse(trimmedRaw);
      if (typeof parsed === 'string' && parsed.trim()) {
        return parsed.trim();
      }
      if (parsed && typeof parsed === 'object') {
        const token =
          parsed.access_token ||
          parsed.token ||
          parsed.session?.access_token ||
          parsed.session?.token ||
          parsed.user?.token ||
          parsed.user?.access_token;
        if (token && typeof token === 'string' && token.trim()) {
          return token.trim();
        }
      }
    }
  } catch (e) {
    // Fallback bila raw string tidak valid JSON tapi ada isinya
    try {
      const fallbackRaw = localStorage.getItem('supabase_admin_session');
      if (fallbackRaw && typeof fallbackRaw === 'string' && fallbackRaw.trim().length >= 10) {
        return fallbackRaw.trim();
      }
    } catch {}
  }

  // 2. Periksa data sesi di 'currentUser'
  try {
    const userRaw = localStorage.getItem('currentUser');
    if (userRaw) {
      const parsedUser = JSON.parse(userRaw);
      if (parsedUser && typeof parsedUser === 'object') {
        const t = parsedUser.access_token || parsedUser.token || parsedUser.sessionToken;
        if (t && typeof t === 'string' && t.trim()) return t.trim();
      }
    }
  } catch (e) {}

  // 3. Periksa kunci cadangan umum token
  const fallbackKeys = ['admin_token', 'token', 'access_token', 'auth_token'];
  for (const key of fallbackKeys) {
    try {
      const val = localStorage.getItem(key);
      if (val && typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          const p = JSON.parse(trimmed);
          if (p && typeof p === 'object') {
            const t = p.access_token || p.token;
            if (t && typeof t === 'string' && t.trim()) return t.trim();
          }
        } else {
          return trimmed;
        }
      }
    } catch (e) {}
  }

  return '';
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return {
    'Authorization': `Bearer ${token}`,
    'X-Admin-Token': token,
    'X-Access-Token': token
  };
}

// ==========================================
// TOKEN VERIFICATION API (SESSION RESTORE)
// ==========================================

export async function verifyAuthApi(customToken?: string): Promise<{
  authenticated: boolean;
  role?: string;
  user?: any;
  message?: string;
}> {
  const token = customToken || getAuthToken();
  if (!token) {
    return { authenticated: false, message: 'Token otentikasi tidak ditemukan.' };
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ token })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.authenticated === true) {
      return {
        authenticated: true,
        role: data.role || data.user?.role || 'admin',
        user: data.user
      };
    }

    return {
      authenticated: false,
      message: data.message || 'Sesi otentikasi tidak valid atau telah kedaluwarsa.'
    };
  } catch (err: any) {
    return {
      authenticated: false,
      message: err.message || 'Gagal menghubungi server untuk verifikasi otentikasi.'
    };
  }
}

// ==========================================
// BACKEND DATABASE PROXY (/api/db/:table)
// ==========================================

export interface DbSelectOptions {
  select?: string;
  order?: string;
  ascending?: boolean;
  limit?: number;
  single?: boolean;
  maybeSingle?: boolean;
  filterField?: string;
  filterValue?: any;
  ilike?: boolean;
}

export const dbProxy = {
  async select<T = any>(
    table: string,
    options: DbSelectOptions = {}
  ): Promise<{ data: T[] | T | null; error: { message: string } | null }> {
    try {
      const params = new URLSearchParams();
      if (options.select) params.append('select', options.select);
      if (options.order) params.append('order', options.order);
      if (options.ascending !== undefined) params.append('ascending', String(options.ascending));
      if (options.limit !== undefined) params.append('limit', String(options.limit));
      if (options.single) params.append('single', 'true');
      if (options.maybeSingle) params.append('maybeSingle', 'true');
      if (options.filterField && options.filterValue !== undefined) {
        params.append('filterField', options.filterField);
        params.append('filterValue', String(options.filterValue));
      }
      if (options.ilike) params.append('ilike', 'true');

      const queryString = params.toString();
      const url = `${API_BASE}/api/db/${encodeURIComponent(table)}${queryString ? `?${queryString}` : ''}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...getAuthHeaders()
        }
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok && !json.data && json.error) {
        return { data: null, error: json.error };
      }
      return {
        data: json.data !== undefined ? json.data : null,
        error: json.error || null
      };
    } catch (err: any) {
      console.error(`[dbProxy.select] Error query ke tabel ${table}:`, err);
      return { data: null, error: { message: err.message || 'Network error' } };
    }
  },

  async insert<T = any>(
    table: string,
    records: any | any[]
  ): Promise<{ data: T | T[] | null; error: { message: string } | null }> {
    try {
      const url = `${API_BASE}/api/db/${encodeURIComponent(table)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ data: records })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok && json.error) {
        return { data: null, error: json.error };
      }
      return {
        data: json.data !== undefined ? json.data : null,
        error: json.error || null
      };
    } catch (err: any) {
      console.error(`[dbProxy.insert] Error insert ke tabel ${table}:`, err);
      return { data: null, error: { message: err.message || 'Network error' } };
    }
  },

  async update<T = any>(
    table: string,
    data: any,
    match: Record<string, any>,
    options: { ilike?: boolean; upsert?: boolean } = {}
  ): Promise<{ data: T | T[] | null; error: { message: string } | null }> {
    try {
      const url = `${API_BASE}/api/db/${encodeURIComponent(table)}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          data,
          match,
          ilike: options.ilike === true,
          upsert: options.upsert === true
        })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok && json.error) {
        return { data: null, error: json.error };
      }
      return {
        data: json.data !== undefined ? json.data : null,
        error: json.error || null
      };
    } catch (err: any) {
      console.error(`[dbProxy.update] Error update ke tabel ${table}:`, err);
      return { data: null, error: { message: err.message || 'Network error' } };
    }
  },

  async delete(
    table: string,
    match: Record<string, any>
  ): Promise<{ success: boolean; error: { message: string } | null }> {
    try {
      let url = `${API_BASE}/api/db/${encodeURIComponent(table)}`;
      if (match.id !== undefined) {
        url += `?id=${encodeURIComponent(match.id)}`;
      }
      if (match.username !== undefined) {
        url += `${url.includes('?') ? '&' : '?'}username=${encodeURIComponent(match.username)}`;
      }

      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ match })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok && json.error) {
        return { success: false, error: json.error };
      }
      return {
        success: json.success !== false,
        error: json.error || null
      };
    } catch (err: any) {
      console.error(`[dbProxy.delete] Error delete di tabel ${table}:`, err);
      return { success: false, error: { message: err.message || 'Network error' } };
    }
  }
};

// ==========================================
// WHATSAPP CONFIG API (/api/config/wa)
// ==========================================

export async function getWaConfig(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/config/wa`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...getAuthHeaders()
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.wa_number) {
        return String(data.wa_number).trim();
      }
    }
  } catch (err) {
    console.error('[CONFIG WA] Gagal memuat nomor WhatsApp dari backend:', err);
  }
  return '6285111029242';
}

export async function testWaConnectionApi(): Promise<{ success: boolean; wa_number: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/config/wa`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...getAuthHeaders()
      }
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: true, wa_number: data.wa_number || '6285111029242' };
    }
  } catch (err) {
    console.error('[CONFIG WA] Gagal tes koneksi WhatsApp:', err);
  }
  return { success: false, wa_number: '6285111029242' };
}

export async function saveWaConfig(waNumber: string): Promise<boolean> {
  const clean = String(waNumber).replace(/[^0-9]/g, '');
  if (clean.length < 8) return false;

  try {
    const res = await fetch(`${API_BASE}/api/config/wa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ wa_number: clean })
    });

    const data = await res.json().catch(() => ({}));
    return res.ok && data.success === true;
  } catch (err) {
    console.error('[CONFIG WA] Gagal menyimpan nomor WhatsApp ke backend:', err);
    return false;
  }
}

// ==========================================
// UPLOAD GAMBAR FREELANCER (/api/upload/freelancer-image)
// ==========================================

export async function uploadFreelancerImagesToStorage(
  images: Array<{ image: string; name?: string }>
): Promise<{ success: boolean; urls: string[]; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/upload/freelancer-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ images })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return {
        success: true,
        urls: data.urls || (data.url ? [data.url] : []),
        message: data.message
      };
    }

    return {
      success: false,
      urls: [],
      message: data.message || 'Gagal mengunggah gambar ke server.'
    };
  } catch (err: any) {
    console.error('[UPLOAD] Error upload freelancer images:', err);
    return {
      success: false,
      urls: [],
      message: err.message || 'Terjadi kesalahan jaringan saat mengunggah gambar.'
    };
  }
}

// ==========================================
// ADMIN AUTH & MANAGEMENT API (/api/admin/*)
// ==========================================

export async function loginAdminApi(
  emailOrUsername: string,
  password: string
): Promise<{
  success: boolean;
  session?: AdminSession;
  message?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ emailOrUsername, password })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success && data.token) {
      const userPayload = data.admin || data.user || {};
      const session: AdminSession = {
        access_token: data.token,
        token: data.token,
        user: {
          id: String(userPayload.id || ''),
          email: userPayload.email || `${emailOrUsername.trim()}@prossindo.com`,
          username: userPayload.username || emailOrUsername.trim(),
          name: userPayload.name || userPayload.username || 'Super Admin',
          role: 'admin'
        }
      };

      localStorage.setItem('supabase_admin_session', JSON.stringify(session));
      localStorage.setItem('admin_token', data.token);
      return { success: true, session };
    }

    return {
      success: false,
      message: data.message || 'Kredensial login admin tidak valid.'
    };
  } catch (err: any) {
    console.error('[ADMIN LOGIN] Error login admin API:', err);
    return {
      success: false,
      message: err.message || 'Gagal menghubungi server untuk autentikasi admin.'
    };
  }
}

export async function fetchAdminsApi(): Promise<AdminAccount[]> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/list`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...getAuthHeaders()
      }
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && Array.isArray(data.admins)) {
      return data.admins;
    }
    return [];
  } catch (err) {
    console.error('[ADMIN LIST] Error memuat daftar admin dari server:', err);
    return [];
  }
}

export async function createAdminApi(data: {
  email: string;
  password: string;
  name: string;
  username: string;
}): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/create-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(data)
    });

    const resData = await res.json().catch(() => ({}));
    if (res.ok && resData.success) {
      return {
        success: true,
        message: resData.message || 'Admin baru berhasil dibuat di database'
      };
    }

    return {
      success: false,
      message: resData.message || 'Gagal membuat admin baru.'
    };
  } catch (err: any) {
    console.error('[CREATE ADMIN] Error membuat admin:', err);
    return {
      success: false,
      message: err.message || 'Terjadi kesalahan jaringan saat membuat admin.'
    };
  }
}

export async function deleteAdminApi(id: string | number): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        ...getAuthHeaders()
      }
    });

    const resData = await res.json().catch(() => ({}));
    if (res.ok && resData.success) {
      return {
        success: true,
        message: resData.message || 'Admin berhasil dihapus dari database'
      };
    }

    return {
      success: false,
      message: resData.message || 'Gagal menghapus admin.'
    };
  } catch (err: any) {
    console.error('[DELETE ADMIN] Error menghapus admin:', err);
    return {
      success: false,
      message: err.message || 'Terjadi kesalahan jaringan saat menghapus admin.'
    };
  }
}

// ==========================================
// MEMBER AUTH API (/api/member/login)
// ==========================================

export async function loginMemberApi(
  username: string
): Promise<{
  success: boolean;
  member?: Member;
  message?: string;
}> {
  const cleanUsername = username.trim();
  if (!cleanUsername) {
    return { success: false, message: 'Username tidak boleh kosong.' };
  }

  try {
    const res = await fetch(`${API_BASE}/api/member/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ username: cleanUsername })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success && data.member) {
      return {
        success: true,
        member: data.member
      };
    }

    return {
      success: false,
      message: data.message || 'Username tidak terdaftar. Silakan hubungi Admin untuk pendaftaran.'
    };
  } catch (err: any) {
    console.error('[MEMBER LOGIN] Error login member API:', err);
    return {
      success: false,
      message: err.message || 'Gagal menghubungi server untuk login member.'
    };
  }
}
