/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'developer' | 'admin' | 'technician';
export type AccountStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'REJECTED' | 'SUSPENDED';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  department: string;
  avatarUrl: string;
  phone: string;
  passwordHash?: string;
  salt?: string;
  status: AccountStatus;
  isMasterAdmin?: boolean;
}
