/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CatalogV2Manager } from './catalog/CatalogV2Manager';

interface InventoryCatalogProps {
  onOpenStockIn?: (item?: { kode_id?: string; tipe_id?: number }) => void;
  onOpenStockOut?: (item?: { kode_id?: string; tipe_id?: number }) => void;
  onOpenChecklist?: () => void;
  onOpenRestore?: () => void;
}

export const InventoryCatalog: React.FC<InventoryCatalogProps> = ({
  onOpenChecklist,
  onOpenRestore,
  onOpenStockIn,
  onOpenStockOut,
}) => {
  return (
    <CatalogV2Manager
      onOpenChecklist={onOpenChecklist}
      onOpenRestore={onOpenRestore}
      onOpenStockInItem={onOpenStockIn}
      onOpenStockOutItem={onOpenStockOut}
    />
  );
};
