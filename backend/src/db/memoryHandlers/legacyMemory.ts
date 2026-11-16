/**
 * Memory Query Handler: Operational Auxiliary & Migration Read Fallbacks
 * (api_keys, checklists, whatsapp_config, whatsapp_logs, plus startup consolidation readbacks)
 */

import { memoryStore } from '../memoryStore';

export function handleLegacyMemoryQuery(_cleanSql: string, upper: string, params: any[]): any {
  // Startup read fallback for DataConsolidationService (legacy snapshot check)
  if (upper.startsWith('SELECT') && upper.includes('FROM ITEMS')) {
    return Array.from(memoryStore.items.values()).filter(it => !it.is_deleted);
  }

  // Startup read fallback for DataConsolidationService (legacy transactions check)
  if (upper.startsWith('SELECT') && upper.includes('FROM TRANSACTIONS')) {
    const list = Array.from(memoryStore.transactions.values());
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
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

  // Legacy mutation branches removed (all mutations now flow through canonical tables)

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
