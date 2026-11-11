/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CatalogV2Manager } from './catalog/CatalogV2Manager';
import { InventoryItem } from '../types';

interface InventoryCatalogProps {
  onOpenAddItem?: () => void;
  onOpenEditItem?: (item: InventoryItem) => void;
  onOpenStockIn?: (item?: any) => void;
  onOpenStockOut?: (item?: any) => void;
  onOpenDetail?: (item: InventoryItem) => void;
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
