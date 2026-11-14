/**
 * Centralized Role-Based Access Control (RBAC) Permission Matrix
 * FieldOps IT Inventory - v1.2.5 Paket 1
 */

export type UserRole =
  | 'developer'
  | 'admin'
  | 'warehouse_admin'
  | 'technician'
  | 'supervisor'
  | 'superadmin';

export const PERMISSION_GROUPS = {
  // Katalog: Read & box content view -> ALL ROLES
  CATALOG_READ: ['developer', 'admin', 'warehouse_admin', 'technician'] as UserRole[],

  // Katalog: Create product, storage box, attribute kinds -> developer, admin, warehouse_admin
  CATALOG_WRITE: ['developer', 'admin', 'warehouse_admin'] as UserRole[],

  // Katalog: Destructive deletion (jenis, product) -> developer, admin
  CATALOG_DELETE: ['developer', 'admin'] as UserRole[],

  // Setting API: Ticket API keys, system settings, user account management, trash purge -> ONLY developer, admin
  SETTING_API: ['developer', 'admin'] as UserRole[],

  // Menu Tools Items
  TOOLS_DATABASE: ['developer', 'admin'] as UserRole[],
  TOOLS_AUDIT: ['developer', 'admin'] as UserRole[],
  TOOLS_WA_ALERT_VIEW: ['developer', 'admin', 'warehouse_admin', 'technician'] as UserRole[],
  TOOLS_WA_ALERT_SETTINGS: ['developer', 'admin', 'warehouse_admin'] as UserRole[],
  TOOLS_HP_ACCESS: ['developer', 'admin', 'warehouse_admin', 'technician'] as UserRole[],
  TOOLS_EXCEL_EXPORT: ['developer', 'admin', 'warehouse_admin', 'technician'] as UserRole[],
  TOOLS_LABEL_PRINT: ['developer', 'admin', 'warehouse_admin', 'technician'] as UserRole[],
} as const;

export function isDeveloperRole(userRole?: string | null): boolean {
  return userRole === 'developer' || userRole === 'superadmin';
}

export function isAdminOrDev(userRole?: string | null): boolean {
  return isDeveloperRole(userRole) || userRole === 'admin';
}

export function isWarehouseManager(userRole?: string | null): boolean {
  return isAdminOrDev(userRole) || userRole === 'warehouse_admin';
}

export function isRoleAllowed(userRole: string, allowedRoles: readonly UserRole[]): boolean {
  if (isAdminOrDev(userRole)) {
    return true;
  }
  return allowedRoles.includes(userRole as UserRole);
}
