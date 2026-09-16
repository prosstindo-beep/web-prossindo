import { AdminAccount, AdminSession, Freelancer, Member, WaLead } from './types';

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

// Database Proxy operations to /api/db/data
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
    const params = new URLSearchParams({ table });
    if (options.select) params.set('select', options.select);
    if (options.order) params.set('order', options.order);
    if (options.ascending !== undefined) params.set('ascending', String(options.ascending));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.single) params.set('single', 'true');
    if (options.maybeSingle) params.set('maybeSingle', 'true');
    if (options.filterField && options.filterValue !== undefined) {
      params.set('filterField', options.filterField);
      params.set('filterValue', options.filterValue);
      if (options.ilike) params.set('ilike', 'true');
    }

    try {
      const res = await fetch(`/api/db/data?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...getAuthHeaders()
        }
      });
      const json = await res.json();
      return json;
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Gagal terhubung ke database proxy' } };
    }
  },

  async insert<T = any>(table: string, records: any | any[]): Promise<{ data: T | T[] | null; error: { message: string } | null }> {
    try {
      const res = await fetch('/api/db/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ table, data: records })
      });
      const json = await res.json();
      return json;
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Gagal menyimpan data' } };
    }
  },

  async update<T = any>(table: string, data: any, match: Record<string, any>, { upsert = false, ilike = false } = {}): Promise<{ data: T | T[] | null; error: { message: string } | null }> {
    try {
      const res = await fetch('/api/db/data', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ table, data, match, upsert, ilike })
      });
      const json = await res.json();
      return json;
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Gagal memperbarui data' } };
    }
  },

  async delete(table: string, match: Record<string, any>): Promise<{ success: boolean; error: { message: string } | null }> {
    try {
      const res = await fetch('/api/db/data', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ table, match })
      });
      const json = await res.json();
      return json;
    } catch (err: any) {
      return { success: false, error: { message: err.message || 'Gagal menghapus data' } };
    }
  }
};

// WhatsApp Config API
export async function getWaConfig(): Promise<string> {
  try {
    const res = await fetch('/api/config/wa');
    if (res.ok) {
      const data = await res.json();
      if (data.wa_number) return data.wa_number;
    }
  } catch (e) {
    // fallback
  }
  return localStorage.getItem('adminWa') || '6285111029242';
}

export async function saveWaConfig(waNumber: string): Promise<boolean> {
  try {
    const res = await fetch('/api/config/wa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ wa_number: waNumber })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Upload Freelancer Images to Supabase Storage (Bucket: 'freelancer-images')
export async function uploadFreelancerImagesToStorage(
  images: Array<{ image: string; name?: string }>
): Promise<{ success: boolean; urls: string[]; message?: string }> {
  try {
    const res = await fetch('/api/upload/freelancer-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ images })
    });
    const json = await res.json();
    if (res.ok && json.success) {
      return { success: true, urls: json.urls || [json.url] };
    }
    return { success: false, urls: [], message: json.message || 'Gagal mengunggah gambar' };
  } catch (err: any) {
    return { success: false, urls: [], message: err.message || 'Gagal terhubung ke endpoint upload' };
  }
}

// Admin API
export async function loginAdminApi(emailOrUsername: string, password: string): Promise<{
  success: boolean;
  session?: AdminSession;
  message?: string;
}> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername, password })
    });
    const json = await res.json();
    if (res.ok && json.success && json.session) {
      return { success: true, session: json.session };
    }
    return { success: false, message: json.message || 'Kredensial admin salah atau tidak cocok.' };
  } catch (err: any) {
    return { success: false, message: 'Terjadi kesalahan jaringan saat login: ' + err.message };
  }
}

export async function fetchAdminsApi(): Promise<AdminAccount[]> {
  try {
    const res = await fetch('/api/admin/list', {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.admins)) return data.admins;
    }
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
    const res = await fetch('/api/admin/create-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return { success: res.ok && json.success, message: json.message };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function deleteAdminApi(id: string | number): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/admin/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    return { success: res.ok && json.success, message: json.message };
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
    const res = await fetch('/api/member/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const json = await res.json();
    if (res.ok && json.success && json.member) {
      return { success: true, member: json.member };
    }
    return { success: false, message: json.message || 'Gagal autentikasi member.' };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
