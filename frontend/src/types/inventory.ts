/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NORMAL' | 'aman' | 'menipis' | 'habis';

export * from './transaction';
export * from './auth';
export * from './ticket';
export type { Produk, Tipe, Jenis, Atribut, AtributOpsi } from '../services/catalogApi';
export type { Box, BoxContentItem, SearchStockItemResult } from '../services/stockApi';
export type { RequestRecord, RequestStatus, RequestTimelineEntry } from '../services/requestApi';
