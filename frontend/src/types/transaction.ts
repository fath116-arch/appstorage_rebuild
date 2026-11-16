/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CanonicalTransactionView } from '../services/activityApi';

export type TransactionType = 'IN' | 'OUT' | 'TRANSFER' | 'SYSTEM';

export type ReferenceType =
  | 'TICKET_EXTERNAL'
  | 'PURCHASE_ORDER'
  | 'ROUTINE_MAINTENANCE'
  | 'EMERGENCY_REPAIR'
  | 'RETURN_RESTOCK'
  | 'INITIAL_COUNT'
  | 'REQUEST_PICKUP'
  | 'REQUEST_RETURN'
  | 'CORRECTION'
  | string;

export type Transaction = CanonicalTransactionView;

export interface WeeklySummary {
  weekLabel: string;
  startDate: string;
  endDate: string;
  totalInflow: number;
  totalOutflow: number;
  topMovingItems: Array<{
    itemId: string;
    itemName: string;
    sku: string;
    outflowCount: number;
  }>;
}
