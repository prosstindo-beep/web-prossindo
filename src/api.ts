import { createClient } from '@supabase/supabase-js';
import { AdminAccount, AdminSession, Freelancer, Member, WaLead } from './types';

// Inisialisasi Supabase Client menggunakan Environment Variables Vite
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getAuthToken(): string {
  try {
    const raw = localStorage.getItem('supabase_admin_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.access_token || parsed.token || '';
    }
  } catch (e) {
    // Ignore error
  }
  return '';
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Database Proxy langsung menggunakan Supabase Client
export const dbProxy = {
  async select<T = any>(table: string, options: {
    select?: string;
    order?: string;
    ascending?: boolean;
    limit?: number;
    single?: boolean;
    maybeSingle?: boolean;
    filterField?: string;
    filterValue?: any;
    ilike?: boolean;
  } = {}): Promise<{ data: T[] | T | null; error: { message: string } | null }> {
    try {
      let query: any = supabase.from(table).select(options.select || '*');

      if (options.filterField && options.filterValue !== undefined) {
        if (options.ilike) {
          query = query.ilike(options.filterField, `%${options.filterValue}%`);
        } else {
          query = query.eq(options.filterField, options.filterValue);
        }
      }

      if (options.order) {
        query = query.order(options.order, { ascending: options.ascending ?? true });
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.single) {
        const { data, error } = await query.single();
        return { data, error: error ? { message: error.message } : null };
      }

      if (options.maybeSingle) {
        const { data, error } = await query.maybeSingle();
        return { data, error: error ? { message: error.message } : null };
      }

      const { data, error } = await query;
      return { data, error: error ? { message: error.message } : null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Gagal terhubung ke Supabase' } };
    }
  },

  async insert<T = any>(table: string, records: any | any[]): Promise<{ data: T | T[] | null; error: { message: string } | null }> {
    try {
      const payload = Array.isArray(records) ? records : [records];
      const { data, error } = await supabase.from(table).insert(payload).select();
      return { data: Array.isArray(records) ? data : (data ? data[0] : null), error: error ? { message: error.message } : null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Gagal menyimpan data' } };
    }
  },

  async update<T = any>(table: string, data: any, match: Record<string, any>, { ilike = false } = {}): Promise<{ data: T | T[] | null; error: { message: string } | null }> {
    try {
      let query: any = supabase.from(table).update(data);
      Object.entries(match).forEach(([k, v]) => {
        if (ilike) {
          query = query.ilike(k, `%${v}%`);
        } else {
          query = query.eq(k, v);
        }
      });
      const { data: updated, error } = await query.select();
      return { data: updated, error: error ? { message: error.message } : null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Gagal memperbarui data' } };
    }
  },

  async delete(table: string, match: Record<string, any>): Promise<{ success: boolean; error: { message: string } | null }> {
    try {
      let query: any = supabase.from(table).delete();
      Object.entries(match).forEach(([k, v]) => {
        query = query.eq(k, v);
      });
      const { error } = await query;
      return { success: !error, error: error ? { message: error.message } : null };
    } catch (err: any) {
      return { success: false, error: { message: err.message || 'Gagal menghapus data' } };
    }
  }
};

// WhatsApp Config API
export async function getWaConfig(): Promise<string> {
  try {
    const { data } = await supabase.from('config').select('value').eq('key', 'wa_number').maybeSingle();
    if (data?.value) return data.value;
  } catch (e) {
    // fallback
  }
  return localStorage.getItem('adminWa') || '6285111029242';
}

export async function saveWaConfig(waNumber: string): Promise<boolean> {
  try {
    localStorage.setItem('adminWa', waNumber);
    const { error } = await supabase.from('config').upsert({ key: 'wa_number', value: waNumber }, { onConflict: 'key' });
    return !error;
  } catch (e) {
    return false;
  }
}

// Upload Gambar Freelancer langsung ke Supabase Storage (Bucket: 'freelancer-images')
export async function uploadFreelancerImagesToStorage(
  images: Array<{ image: string; name?: string }>
): Promise<{ success: boolean; urls: string[]; message?: string }> {
  try {
    const urls: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img.image) continue;

      if (img.image.startsWith('http://') || img.image.startsWith('https://')) {
        urls.push(img.image);
        continue;
      }

      const base64Data = img.image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const fileName = `${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.png`;

      const { error } = await supabase.storage
        .from('freelancer-images')
        .upload(fileName, buffer, { contentType: 'image/png', upsert: true });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('freelancer-images')
        .getPublicUrl(fileName);

      urls.push(publicUrlData.publicUrl);
    }
    return { success: true, urls };
  } catch (err: any) {
    return { success: false, urls: [], message: err.message || 'Gagal mengunggah gambar' };
  }
}

// Admin API
export async function loginAdminApi(emailOrUsername: string, password: string): Promise<{
  success: boolean;
  session?: AdminSession;
  message?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .or(`email.eq.${emailOrUsername},username.eq.${emailOrUsername}`)
      .eq('password', password)
      .maybeSingle();

    if (error || !data) {
      return { success: false, message: 'Kredensial admin salah atau tidak cocok.' };
    }

    const session: AdminSession = {
      user: {
        id: data.id,
        email: data.email,
        username: data.username,
        name: data.name || data.username
      },
      access_token: `admin-token-${data.id}-${Date.now()}`
    };

    localStorage.setItem('supabase_admin_session', JSON.stringify(session));
    return { success: true, session };
  } catch (err: any) {
    return { success: false, message: 'Terjadi kesalahan saat login: ' + err.message };
  }
}

export async function fetchAdminsApi(): Promise<AdminAccount[]> {
  try {
    const { data, error } = await supabase.from('admins').select('*');
    if (!error && Array.isArray(data)) return data;
  } catch (e) {
    // fallback
  }
  return [];
}

export async function createAdminApi(data: { email: string; password: string; name: string; username: string }): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const { error } = await supabase.from('admins').insert([data]);
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Admin berhasil dibuat' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function deleteAdminApi(id: string | number): Promise<{ success: boolean; message?: string }> {
  try {
    const { error } = await supabase.from('admins').delete().eq('id', id);
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Admin berhasil dihapus' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// Member API
export async function loginMemberApi(username: string): Promise<{
  success: boolean;
  member?: Member;
  message?: string;
}> {
  try {
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      return { success: false, message: 'Username tidak boleh kosong.' };
    }

    // Cek apakah member sudah ada di database
    const { data: existing } = await supabase
      .from('members')
      .select('*')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (existing) {
      return { success: true, member: existing };
    }

    // Jika belum ada, otomatis daftarkan member baru
    const newMember = {
      username: cleanUsername,
      created_at: new Date().toISOString()
    };

    const { data: created, error: createError } = await supabase
      .from('members')
      .insert([newMember])
      .select()
      .maybeSingle();

    if (createError || !created) {
      return { success: true, member: { id: Date.now().toString(), username: cleanUsername } as Member };
    }

    return { success: true, member: created };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal autentikasi member.' };
  }
}
