/**
 * Memory Query Handler: Legacy Tables
 * (items, categories, transactions, api_keys, checklists, whatsapp_config, whatsapp_logs)
 */

import { memoryStore } from '../memoryStore';

export function handleLegacyMemoryQuery(cleanSql: string, upper: string, params: any[]): any {
  // SELECT items
  if (upper.startsWith('SELECT') && upper.includes('FROM ITEMS')) {
    const list = Array.from(memoryStore.items.values()).filter(it => !it.is_deleted);
    if (upper.includes('WHERE (ID = ? OR UPPER(SKU) = UPPER(?))') || (upper.includes('WHERE') && upper.includes('ID = ?') && upper.includes('SKU = ?'))) {
      const target = String(params[0] || params[1] || '').toUpperCase();
      const match = list.find(it => it.id === params[0] || it.sku.toUpperCase() === target);
      return match ? [match] : [];
    }
    if (upper.includes('WHERE ID = ?')) {
      const match = memoryStore.items.get(params[0]);
      return match && !match.is_deleted ? [match] : [];
    }
    if (upper.includes('WHERE SKU = ?') || upper.includes('UPPER(SKU) = UPPER(?)')) {
      const target = String(params[0] || '').toLowerCase();
      const match = list.find(it => it.sku.toLowerCase() === target);
      return match ? [match] : [];
    }
    if (upper.includes('WHERE BARCODE = ?') || upper.includes('UPPER(BARCODE) = UPPER(?)')) {
      const target = String(params[0] || '').toLowerCase();
      const match = list.find(it => it.barcode && String(it.barcode).toLowerCase() === target);
      return match ? [match] : [];
    }
    return list;
  }

  // SELECT categories
  if (upper.startsWith('SELECT') && upper.includes('FROM CATEGORIES')) {
    if (upper.includes('WHERE ID = ?')) {
      const match = memoryStore.categories.get(params[0]);
      return match ? [match] : [];
    }
    return Array.from(memoryStore.categories.values());
  }

  // SELECT transactions (Enriched with Snapshot)
  if (upper.startsWith('SELECT') && upper.includes('FROM TRANSACTIONS')) {
    const enrichTx = (t: any) => {
      let itemName = t.nama_barang || t.item_name;
      let itemSku = t.sku || t.item_sku;
      let itemUnit = t.satuan || t.item_unit;

      if (!itemName || !itemSku || !itemUnit) {
        if (t.item_id && memoryStore.items.has(t.item_id)) {
          const it = memoryStore.items.get(t.item_id);
          itemName = itemName || it.name;
          itemSku = itemSku || it.sku;
          itemUnit = itemUnit || it.unit;
        }
        const tId = t.tipe_id ? Number(t.tipe_id) : (typeof t.item_id === 'number' || /^\d+$/.test(String(t.item_id)) ? Number(t.item_id) : null);
        if (tId && memoryStore.tipe.has(tId)) {
          const tipe = memoryStore.tipe.get(tId);
          const prod = memoryStore.produk.get(tipe?.produk_id);
          itemName = itemName || (prod ? `${prod.nama} - ${tipe.nama_tipe}` : tipe?.nama_tipe);
          itemSku = itemSku || tipe?.prefix_id || `TIPE-${tId}`;
          itemUnit = itemUnit || prod?.tipe_stok || 'unit';
        }
      }

      return {
        ...t,
        nama_barang: itemName || 'Barang IT',
        sku: itemSku || 'SKU',
        satuan: itemUnit || 'pcs',
        item_name: itemName || 'Barang IT',
        item_sku: itemSku || 'SKU',
        item_unit: itemUnit || 'pcs',
        tipe_mutasi: t.tipe_mutasi || (t.type === 'IN' ? 'MASUK' : 'KELUAR')
      };
    };

    if (upper.includes('SUM(')) {
      let sum = 0;
      const targetTipeId = params[0] ? Number(params[0]) : null;
      for (const t of memoryStore.transactions.values()) {
        const tTipeId = t.tipe_id ? Number(t.tipe_id) : null;
        if (!targetTipeId || tTipeId === targetTipeId || t.item_id === String(targetTipeId)) {
          const isMasuk = t.tipe_mutasi === 'MASUK' || t.type === 'IN';
          const qty = Number(t.quantity || 0);
          sum += isMasuk ? qty : -qty;
        }
      }
      return [{ total: Math.max(0, sum) }];
    }

    if (upper.includes('WHERE ID = ?') || upper.includes('WHERE T.ID = ?')) {
      const match = memoryStore.transactions.get(params[0]);
      return match ? [enrichTx(match)] : [];
    }
    if (upper.includes('WHERE ITEM_ID = ?') || upper.includes('WHERE T.ITEM_ID = ?') || upper.includes('WHERE T.TIPE_ID = ?')) {
      const filtered = Array.from(memoryStore.transactions.values()).filter(
        t => t.item_id === params[0] || String(t.tipe_id) === String(params[0]) || (params[1] && String(t.tipe_id) === String(params[1]))
      );
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return filtered.map(enrichTx);
    }
    const list = Array.from(memoryStore.transactions.values());
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list.map(enrichTx);
  }

  // SELECT api_keys
  if (upper.startsWith('SELECT') && upper.includes('FROM API_KEYS')) {
    if (upper.includes('WHERE API_KEY_HASH = ?')) {
      const match = Array.from(memoryStore.api_keys.values()).find(k => k.api_key_hash === params[0] && k.is_active);
      return match ? [match] : [];
    }
    return Array.from(memoryStore.api_keys.values());
  }

  // SELECT checklists
  if (upper.startsWith('SELECT') && upper.includes('FROM CHECKLISTS')) {
    if (upper.includes('WHERE ID = ?')) {
      const match = memoryStore.checklists.get(params[0]);
      return match ? [match] : [];
    }
    return Array.from(memoryStore.checklists.values()).reverse();
  }

  // SELECT whatsapp_config
  if (upper.startsWith('SELECT') && upper.includes('FROM WHATSAPP_CONFIG')) {
    const cfg = memoryStore.whatsapp_config.get('1') || {
      id: 1,
      gateway_type: 'fonnte',
      api_url: 'https://api.fonnte.com/send',
      api_token: '',
      target_phones: '',
      auto_alert_enabled: true
    };
    return [cfg];
  }

  // SELECT whatsapp_logs
  if (upper.startsWith('SELECT') && upper.includes('FROM WHATSAPP_LOGS')) {
    return Array.from(memoryStore.whatsapp_logs.values()).reverse();
  }

  // INSERT / UPDATE / DELETE items, categories, transactions, api_keys, checklists
  if (upper.startsWith('INSERT INTO ITEMS')) {
    const item = {
      id: params[0],
      sku: params[1],
      barcode: params[2],
      name: params[3],
      category_id: params[4],
      quantity: params[5],
      min_stock_alert: params[6],
      unit: params[7],
      location: params[8],
      specs: params[9],
      unit_cost: params[10],
      status: params[11],
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryStore.items.set(item.id, item);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('INSERT INTO CATEGORIES')) {
    memoryStore.categories.set(params[0], {
      id: params[0],
      code: params[1],
      name: params[2],
      description: params[3] || '',
      created_at: new Date().toISOString()
    });
    return { affectedRows: 1 };
  }

  if (upper.startsWith('DELETE FROM ITEMS WHERE ID = ?')) {
    memoryStore.items.delete(params[0]);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE ITEMS SET')) {
    if (upper.includes('IS_DELETED = TRUE')) {
      const item = memoryStore.items.get(params[0]);
      if (item) {
        item.is_deleted = true;
        item.deleted_at = new Date().toISOString();
      }
      return { affectedRows: 1 };
    }
    if (upper.includes('IS_DELETED = FALSE')) {
      const item = memoryStore.items.get(params[0]);
      if (item) {
        item.is_deleted = false;
        item.deleted_at = null;
      }
      return { affectedRows: 1 };
    }
    if (upper.includes('QUANTITY = ?')) {
      const item = memoryStore.items.get(params[params.length - 1]);
      if (item) {
        item.quantity = params[0];
        item.status = params[1];
        item.updated_at = new Date().toISOString();
      }
      return { affectedRows: 1 };
    }
    if (upper.includes('NAME = ?')) {
      const itemId = params[params.length - 1];
      const item = memoryStore.items.get(itemId);
      if (item) {
        item.name = params[0];
        item.category_id = params[1];
        item.quantity = params[2];
        item.min_stock_alert = params[3];
        item.unit = params[4];
        item.location = params[5];
        item.specs = params[6];
        item.unit_cost = params[7];
        item.status = params[8];
        item.updated_at = new Date().toISOString();
      }
      return { affectedRows: 1 };
    }
  }

  if (upper.startsWith('INSERT INTO TRANSACTIONS')) {
    const colMatch = cleanSql.match(/INSERT\s+INTO\s+transactions\s*\(([^)]+)\)/i);
    let tx: any = { created_at: new Date().toISOString() };
    if (colMatch && colMatch[1]) {
      const cols = colMatch[1].split(',').map(c => c.trim().toLowerCase());
      cols.forEach((col, idx) => {
        tx[col] = params[idx];
      });
      if (!tx.type && tx.tipe_mutasi) {
        tx.type = tx.tipe_mutasi === 'MASUK' ? 'IN' : 'OUT';
      }
      if (!tx.tipe_mutasi && tx.type) {
        tx.tipe_mutasi = tx.type === 'IN' ? 'MASUK' : 'KELUAR';
      }
    } else {
      tx = {
        id: params[0],
        type: params[1],
        tipe_mutasi: params[1] === 'IN' ? 'MASUK' : 'KELUAR',
        item_id: params[2],
        quantity: params[3],
        previous_qty: params[4],
        new_qty: params[5],
        reference_type: params[6],
        reference_number: params[7],
        recipient_destination: params[8],
        user_id: params[9],
        performed_by: params[10],
        notes: params[11],
        created_at: new Date().toISOString()
      };
    }
    memoryStore.transactions.set(tx.id, tx);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('INSERT INTO API_KEYS')) {
    memoryStore.api_keys.set(params[0], {
      id: params[0],
      name: params[1],
      api_key_hash: params[2],
      system_name: params[3],
      allowed_actions: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4],
      is_active: true,
      created_at: new Date().toISOString()
    });
    return { affectedRows: 1 };
  }

  if (upper.startsWith('INSERT INTO CHECKLISTS')) {
    memoryStore.checklists.set(params[0], {
      id: params[0],
      technician_id: params[1],
      technician_name: params[2],
      inspection_type: params[3],
      vehicle_or_kit_name: params[4],
      notes: params[5] || '',
      items_json: params[6],
      created_at: new Date().toISOString()
    });
    return { affectedRows: 1 };
  }

  return undefined;
}
