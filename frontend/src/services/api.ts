/**
 * Frontend API Service Layer
 * Single communication gateway to FieldOps IT Express backend
 */

import { apiFetch, clearAuthToken, requestJson, setAuthToken } from './httpClient';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'developer' | 'admin' | 'warehouse_admin' | 'technician' | 'supervisor' | 'superadmin';
  department: string;
  phone?: string;
  status: string;
  created_at?: string;
  is_master_admin?: boolean;
}

export interface InventoryItem {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  category_id?: string;
  categoryId?: string;
  categoryName?: string;
  quantity: number;
  min_stock_alert?: number;
  minStockAlert?: number;
  unit: string;
  location?: string;
  specs?: string;
  unit_cost?: number;
  unitCost?: number;
  status?: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'IN_STOCK';
  is_deleted?: boolean;
  deleted_at?: string | null;
  notes?: string;
  lastUpdated?: string;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface Transaction {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  item_id?: string;
  itemId?: string;
  item_name?: string;
  itemName?: string;
  item_sku?: string;
  itemSku?: string;
  item_unit?: string;
  unit?: string;
  quantity: number;
  previous_qty?: number;
  new_qty?: number;
  reference_type?: string;
  referenceType?: string;
  reference_number?: string;
  referenceNumber?: string;
  recipient_destination?: string;
  recipientOrDestination?: string;
  performed_by?: string;
  performedBy?: string;
  notes?: string;
  apiSource?: string;
  created_at?: string;
  date?: string;
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

export interface StockMutationResponse {
  success: boolean;
  message: string;
  lowStockAlertTriggered?: boolean;
  [key: string]: unknown;
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
    return data;
  },

  async register(userData: { username: string; name?: string; email?: string; role?: string; department?: string; password: string }): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    clearAuthToken();
    const { data } = await requestJson<AuthResponse>('/api/auth/register', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify(userData)
    });
    return data;
  },

  async getMe(): Promise<{ success: boolean; user?: UserProfile }> {
    const { ok, data } = await requestJson<{ success: boolean; user?: UserProfile }>('/api/auth/me');
    if (!ok) return { success: false };
    return data;
  },

  async logout(): Promise<void> {
    clearAuthToken();
    await requestJson('/api/auth/logout', { method: 'POST' });
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

  // Inventory API
  async getItems(includeDeleted: boolean = false): Promise<InventoryItem[]> {
    const { data } = await requestJson<{ items?: InventoryItem[] }>(`/api/inventory/items?includeDeleted=${includeDeleted}`);
    return data.items || [];
  },

  async scanItem(code: string): Promise<{ success: boolean; found: boolean; message: string; item?: InventoryItem }> {
    const { data } = await requestJson<{ success: boolean; found: boolean; message: string; item?: InventoryItem }>(
      `/api/inventory/scan/${encodeURIComponent(code)}`
    );
    return data;
  },

  async getCategories(): Promise<Category[]> {
    const { data } = await requestJson<{ categories?: Category[] }>('/api/inventory/categories');
    return data.categories || [];
  },

  async createItem(item: Partial<InventoryItem>): Promise<InventoryItem> {
    const data = await apiFetch<{ item: InventoryItem }>(
      '/api/inventory/items',
      { method: 'POST', body: JSON.stringify(item) },
      'Gagal menambahkan barang.'
    );
    return data.item;
  },

  async updateItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    const data = await apiFetch<{ item: InventoryItem }>(
      `/api/inventory/items/${id}`,
      { method: 'PUT', body: JSON.stringify(updates) },
      'Gagal memperbarui barang.'
    );
    return data.item;
  },

  async deleteItem(id: string): Promise<void> {
    await apiFetch(`/api/inventory/items/${id}`, { method: 'DELETE' }, 'Gagal menghapus barang.');
  },

  async restoreItem(id: string): Promise<void> {
    await apiFetch(`/api/inventory/items/${id}/restore`, { method: 'POST' }, 'Gagal memulihkan barang.');
  },

  async permanentDeleteItem(id: string): Promise<void> {
    await apiFetch(`/api/inventory/items/${id}/permanent`, { method: 'DELETE' }, 'Gagal menghapus barang permanen.');
  },

  async createCategory(cat: { code: string; name: string; description?: string }): Promise<Category> {
    const data = await apiFetch<{ category: Category }>(
      '/api/inventory/categories',
      { method: 'POST', body: JSON.stringify(cat) },
      'Gagal membuat kategori.'
    );
    return data.category;
  },

  // Transactions API
  async getTransactions(limit: number = 100): Promise<Transaction[]> {
    const { data } = await requestJson<{ transactions?: Transaction[] }>(`/api/transactions?limit=${limit}`);
    return data.transactions || [];
  },

  async stockIn(payload: { itemId: string; quantity: number; referenceNumber?: string; sourceOrVendor?: string; notes?: string }): Promise<StockMutationResponse> {
    return apiFetch<StockMutationResponse>(
      '/api/transactions/in',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal mencatat stok masuk.'
    );
  },

  async stockOut(payload: { itemId: string; quantity: number; referenceNumber?: string; recipientOrDestination?: string; notes?: string }): Promise<StockMutationResponse> {
    return apiFetch<StockMutationResponse>(
      '/api/transactions/out',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal mencatat stok keluar.'
    );
  },

  async batchStockOut(payload: { items: Array<{ itemId: string; quantity: number }>; referenceNumber?: string; recipientOrDestination?: string; notes?: string }): Promise<StockMutationResponse> {
    return apiFetch<StockMutationResponse>(
      '/api/transactions/batch-out',
      { method: 'POST', body: JSON.stringify(payload) },
      'Gagal mencatat batch stok keluar.'
    );
  },

  // Weekly Reports
  async getWeeklyReport(): Promise<Record<string, unknown>> {
    const { data } = await requestJson<Record<string, unknown>>('/api/reports/weekly');
    return data;
  },

  // Checklists
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
