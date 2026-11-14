/**
 * Frontend Role-Based Access Control (RBAC) Helpers
 * FieldOps IT Inventory
 */

export function isDeveloperRole(role?: string | null): boolean {
  return role === 'developer' || role === 'superadmin';
}

export function isAdminOrDev(role?: string | null): boolean {
  return isDeveloperRole(role) || role === 'admin';
}

export function isWarehouseManager(role?: string | null): boolean {
  return isAdminOrDev(role) || role === 'warehouse_admin';
}
