/**
 * Frontend Auth, Checklist & Trash API Service Layer
 * FieldOps IT — Single Unified Model
 */

import { clearAuthToken, requestJson, setAuthToken, apiFetch } from './httpClient';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'developer' | 'admin' | 'technician' | 'warehouse_admin' | 'supervisor' | 'superadmin';
  department: string;
  phone?: string;
  status: string;
  created_at?: string;
  is_master_admin?: boolean;
  feature_permissions?: Record<string, boolean> | null;
}

export interface TrashEntry {
  id: string;
  jenis_objek: 'item' | 'produk' | 'tipe' | 'jenis' | 'box' | 'akun';
  objek_id: string;
  snapshot: string;
  dihapus_oleh: string;
  nama_penghapus?: string;
  dihapus_pada: string;
  aktivitas_id: string;
  purge_setelah: string;
  status: 'menunggu' | 'dipulihkan' | 'dibersihkan';
  sisa_hari?: number;
}

export interface BagToolEntry {
  tipe_id: number;
  nama_produk: string;
  nama_tipe: string;
  kategori_barang?: 'Alat' | 'Barang Habis Pakai';
  tipe_stok?: string;
  mode_stok?: 'per_id' | 'jumlah';
  jumlah: number;
  kode_id?: string | null;
  catatan?: string | null;
  stok_tersedia?: number;
}

export interface ToolBagRecord {
  id: string;
  nama_tas: string;
  keterangan: string;
  dibuat_oleh_id: string;
  dibuat_oleh_nama: string;
  dibuat_pada: string;
  items: BagToolEntry[];
  total_unit: number;
}

interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  token?: string;
  message?: string;
}

interface BasicResponse {
  success: boolean;
  message: string;
  user?: UserProfile;
}

const LAST_LOGIN_KEY = 'fieldops_last_login_ts';

export function getLastLoginTime(): number {
  try {
    const raw = localStorage.getItem(LAST_LOGIN_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export const api = {
  // Auth API
  async login(username: string, passwordAttempt: string): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    const { data } = await requestJson<AuthResponse>('/api/auth/login', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ username, password: passwordAttempt })
    });
    if (data.token) {
      setAuthToken(data.token);
    }
    if (data.success) {
      try {
        localStorage.setItem(LAST_LOGIN_KEY, String(Date.now()));
      } catch {
        // Ignore storage error
      }
    }
    return data;
  },

  async getMe(): Promise<{ success: boolean; user?: UserProfile }> {
    const { ok, data } = await requestJson<{ success: boolean; user?: UserProfile }>('/api/auth/me');
    if (!ok) return { success: false };
    return data;
  },

  async logout(): Promise<void> {
    clearAuthToken();
    try {
      localStorage.removeItem(LAST_LOGIN_KEY);
    } catch {
      // Ignore storage error
    }
    await requestJson('/api/auth/logout', { method: 'POST' });
  },

  async requestConfirmationToken(payload: {
    actionType: string;
    targetId: string;
    targetName?: string;
    objectNameTyped?: string;
    reauthPassword?: string;
    lastLoginTime?: number;
  }): Promise<{
    success: boolean;
    tier: number;
    token?: string;
    expiresInSeconds?: number;
    message: string;
    requiresReauth?: boolean;
  }> {
    const { data } = await requestJson<{
      success: boolean;
      tier: number;
      token?: string;
      expiresInSeconds?: number;
      message: string;
      requiresReauth?: boolean;
    }>('/api/auth/confirm-token', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        lastLoginTime: payload.lastLoginTime ?? getLastLoginTime()
      })
    });
    return data;
  },

  async getUsers(): Promise<UserProfile[]> {
    const { data } = await requestJson<{ users?: UserProfile[] }>('/api/auth/users');
    return data.users || [];
  },

  async approveUser(userId: string): Promise<{ success: boolean; message: string }> {
    const { data } = await requestJson<BasicResponse>(`/api/auth/users/${userId}/approve`, { method: 'POST' });
    return data;
  },

  async rejectUser(userId: string): Promise<{ success: boolean; message: string }> {
    const { data } = await requestJson<BasicResponse>(`/api/auth/users/${userId}/reject`, { method: 'POST' });
    return data;
  },

  async updateUserStatus(userId: string, status: string): Promise<{ success: boolean; message: string }> {
    const { data } = await requestJson<BasicResponse>(`/api/auth/users/${userId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
    return data;
  },

  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    const { data } = await requestJson<BasicResponse>(`/api/auth/users/${userId}`, { method: 'DELETE' });
    return data;
  },

  async createUser(userData: {
    username: string;
    name: string;
    email: string;
    role: string;
    department?: string;
    phone?: string;
    password: string;
    status?: string;
  }): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    const { data } = await requestJson<BasicResponse>('/api/auth/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    return data;
  },

  async resetPassword(data: { username: string; email?: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    const { data: resData } = await requestJson<BasicResponse>('/api/auth/reset-password', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify(data)
    });
    return resData;
  },

  async adminResetPassword(userId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const { data } = await requestJson<BasicResponse>(`/api/auth/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword })
    });
    return data;
  },

  async updateUserFeatures(
    userId: string,
    featurePermissions: Record<string, boolean> | null
  ): Promise<{ success: boolean; message: string; user?: UserProfile }> {
    const { data } = await requestJson<BasicResponse>(`/api/auth/users/${userId}/features`, {
      method: 'PUT',
      body: JSON.stringify({ feature_permissions: featurePermissions })
    });
    return data;
  },

  // Trash (14-Day Retention)
  async getTrash(): Promise<TrashEntry[]> {
    const { ok, data } = await requestJson<{ trash?: TrashEntry[] }>('/api/auth/trash');
    if (!ok) return [];
    return data.trash || [];
  },

  async purgeTrash(): Promise<{ success: boolean; purgedCount: number }> {
    return apiFetch<{ success: boolean; purgedCount: number }>(
      '/api/auth/trash/purge',
      { method: 'POST' },
      'Gagal membersihkan tempat sampah kedaluwarsa.'
    );
  },

  // Weekly Reports (canonical)
  async getWeeklyReport(week: 'current' | 'previous' | 'all' = 'current'): Promise<Record<string, unknown>> {
    const { data } = await requestJson<Record<string, unknown>>(`/api/reports/weekly?week=${encodeURIComponent(week)}`);
    return data;
  },

  // Checklists & Multi-Tas Lapangan
  async listBags(): Promise<ToolBagRecord[]> {
    const { ok, data } = await requestJson<{ bags?: ToolBagRecord[] }>('/api/checklists/bags');
    if (!ok) return [];
    return data.bags || [];
  },

  async createBag(payload: {
    nama_tas: string;
    keterangan?: string;
    items: Array<{ tipe_id: number; jumlah: number; kode_id?: string | null; catatan?: string | null }>;
  }): Promise<{ success: boolean; bag: ToolBagRecord; message?: string }> {
    return apiFetch(
      '/api/checklists/bags',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal membuat Tas Lapangan baru.'
    );
  },

  async updateBag(
    id: string,
    payload: {
      nama_tas: string;
      keterangan?: string;
      items: Array<{ tipe_id: number; jumlah: number; kode_id?: string | null; catatan?: string | null }>;
    }
  ): Promise<{ success: boolean; bag: ToolBagRecord; message?: string }> {
    return apiFetch(
      `/api/checklists/bags/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(payload) },
      'Gagal memperbarui Tas Lapangan.'
    );
  },

  async deleteBag(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch(
      `/api/checklists/bags/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      'Gagal menghapus Tas Lapangan.'
    );
  },

  async getChecklists(): Promise<Array<Record<string, unknown>>> {
    const { data } = await requestJson<{ checklists?: Array<Record<string, unknown>> }>('/api/checklists');
    return data.checklists || [];
  },

  async createChecklist(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return apiFetch(
      '/api/checklists',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal menyimpan checklist.'
    );
  }
};

export const apiService = api;
