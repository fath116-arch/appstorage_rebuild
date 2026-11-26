/**
 * Auth, Sessions & Canonical Ledger Memory Query Handler
 * (users, sessions, audit_logs, pengaturan, sesi, transaksi, transaksi_detail, sampah_hapus, token_konfirmasi)
 */

import { persistUsersToSeed } from '../memorySeed';
import { memoryStore } from '../memoryStore';
import { normalizeDbDateToIso } from '../../utils/timezone';

export function handleAuthMemoryQuery(cleanSql: string, upper: string, params: any[]): any {
  // SELECT users
  if (upper.startsWith('SELECT') && upper.includes('FROM USERS')) {
    if (upper.includes('WHERE ID = ?')) {
      const match = memoryStore.users.get(params[0]);
      return match ? [match] : [];
    }
    if (upper.includes('WHERE') && (upper.includes('USERNAME') || upper.includes('EMAIL'))) {
      const target1 = String(params[0] || '').toLowerCase().trim();
      const target2 = params[1] ? String(params[1]).toLowerCase().trim() : target1;
      const match = Array.from(memoryStore.users.values()).find(u => {
        const uName = String(u.username || '').toLowerCase().trim();
        const uEmail = String(u.email || '').toLowerCase().trim();
        return uName === target1 || uEmail === target1 || uName === target2 || uEmail === target2;
      });
      return match ? [match] : [];
    }
    return Array.from(memoryStore.users.values());
  }

  // SELECT sessions
  if (upper.startsWith('SELECT') && upper.includes('FROM SESSIONS')) {
    if (upper.includes('WHERE SESSION_ID = ?')) {
      const s = memoryStore.sessions.get(params[0]);
      if (!s) return [];
      if (new Date(s.expires_at).getTime() < Date.now()) {
        memoryStore.sessions.delete(params[0]);
        return [];
      }
      return [s];
    }
  }

  // SESSIONS mutations
  if (upper.startsWith('INSERT INTO SESSIONS')) {
    memoryStore.sessions.set(params[0], {
      session_id: params[0],
      user_id: params[1],
      ip_address: params[2],
      user_agent: params[3],
      expires_at: normalizeDbDateToIso(params[4]) || String(params[4]),
      created_at: new Date().toISOString()
    });
    return { affectedRows: 1 };
  }

  if (upper.startsWith('DELETE FROM SESSIONS WHERE SESSION_ID = ?')) {
    memoryStore.sessions.delete(params[0]);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('DELETE FROM SESSIONS WHERE USER_ID = ?')) {
    const targetUserId = params[0];
    for (const [sId, sess] of memoryStore.sessions.entries()) {
      if (sess.user_id === targetUserId) {
        memoryStore.sessions.delete(sId);
      }
    }
    return { affectedRows: 1 };
  }

  // USERS mutations
  if (upper.startsWith('INSERT INTO USERS')) {
    const user = params.length === 7
      ? {
          id: params[0],
          username: String(params[1]).trim(),
          name: String(params[2]).trim(),
          email: String(params[3]).trim(),
          role: params[4],
          department: 'Dev & Master System Engineering',
          phone: '',
          password_hash: params[5],
          salt: params[6] || '',
          status: 'ACTIVE',
          created_at: new Date().toISOString()
        }
      : {
          id: params[0],
          username: String(params[1]).trim(),
          name: String(params[2]).trim(),
          email: String(params[3]).trim(),
          role: params[4],
          department: params[5] || 'IT Operations',
          phone: params[6] || '',
          password_hash: params[7],
          salt: params[8] || '',
          status: params[9] || 'ACTIVE',
          created_at: new Date().toISOString()
        };
    memoryStore.users.set(user.id, user);
    persistUsersToSeed();
    return { affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE USERS SET')) {
    const lastParam = params[params.length - 1];
    let user = memoryStore.users.get(lastParam);
    if (!user) {
      user = Array.from(memoryStore.users.values()).find(
        u => u.username === lastParam || u.id === lastParam || u.email === lastParam
      );
    }
    if (user) {
      if (upper.includes('FEATURE_PERMISSIONS = ?')) {
        user.feature_permissions = params[0];
        user.updated_at = new Date().toISOString();
      } else if (upper.includes('PASSWORD_HASH = ?') && upper.includes('SALT = ?')) {
        user.password_hash = params[0];
        user.salt = params[1] || '';
        user.updated_at = new Date().toISOString();
      } else if (upper.includes('STATUS = ?') && params.length === 2) {
        user.status = params[0];
        user.updated_at = new Date().toISOString();
      } else if (params.length >= 4) {
        user.password_hash = params[0];
        user.salt = params[1] || '';
        user.role = params[2] || user.role;
        user.status = 'ACTIVE';
        user.updated_at = new Date().toISOString();
      } else if (upper.includes('ROLE = ?') && upper.includes('STATUS = ?')) {
        user.role = params[0];
        user.status = params[1];
        user.updated_at = new Date().toISOString();
      }
      memoryStore.users.set(user.id, user);
      persistUsersToSeed();
    }
    return { affectedRows: 1 };
  }

  if (upper.startsWith('DELETE FROM USERS WHERE ID = ?') || upper.startsWith('DELETE FROM USERS WHERE USERNAME = ?')) {
    const target = params[0];
    const user = memoryStore.users.get(target) || Array.from(memoryStore.users.values()).find(u => u.username === target || u.id === target);
    if (user) {
      memoryStore.users.delete(user.id);
      for (const [sId, sess] of memoryStore.sessions.entries()) {
        if (sess.user_id === user.id) {
          memoryStore.sessions.delete(sId);
        }
      }
      persistUsersToSeed();
    }
    return { affectedRows: 1 };
  }

  // AUDIT_LOGS
  if (upper.startsWith('INSERT INTO AUDIT_LOGS')) {
    memoryStore.audit_logs.push({
      id: memoryStore.audit_logs.length + 1,
      user_id: params[0],
      action: params[1],
      table_name: params[2],
      record_id: params[3],
      before_state: params[4],
      after_state: params[5],
      ip_address: params[6],
      created_at: new Date().toISOString()
    });
    return { affectedRows: 1 };
  }

  // PENGATURAN
  if (upper.startsWith('SELECT') && upper.includes('FROM PENGATURAN')) {
    if (upper.includes('WHERE KUNCI = ?')) {
      const p = memoryStore.pengaturan.get(params[0]);
      return p ? [p] : [];
    }
    return Array.from(memoryStore.pengaturan.values());
  }

  if (upper.startsWith('INSERT INTO PENGATURAN')) {
    memoryStore.pengaturan.set(params[0], {
      kunci: params[0],
      nilai: String(params[1]),
      keterangan: params[2] || null,
      diperbarui_pada: new Date().toISOString()
    });
    return { affectedRows: 1 };
  }

  // SESI
  if (upper.startsWith('SELECT') && upper.includes('FROM SESI')) {
    const list = Array.from(memoryStore.sesi.values());
    if (upper.includes('WHERE USER_ID = ? AND DICABUT_PADA IS NULL')) {
      const filtered = list.filter(s => s.user_id === params[0] && !s.dicabut_pada);
      filtered.sort((a, b) => new Date(a.dibuat_pada).getTime() - new Date(b.dibuat_pada).getTime());
      return filtered;
    }
    if (upper.includes('WHERE S.ID = ?') || upper.includes('WHERE ID = ?')) {
      const match = memoryStore.sesi.get(params[0]);
      if (!match) return [];
      const user = memoryStore.users.get(match.user_id) || {};
      return [{ ...match, username: user.username, name: user.name, email: user.email, role: user.role, department: user.department, phone: user.phone, status: user.status, feature_permissions: user.feature_permissions || null }];
    }
    if (upper.includes('WHERE S.REFRESH_HASH = ?') || upper.includes('WHERE REFRESH_HASH = ?')) {
      const match = list.find(s => s.refresh_hash === params[0]);
      if (!match) return [];
      const user = memoryStore.users.get(match.user_id) || {};
      return [{ ...match, username: user.username, name: user.name, email: user.email, role: user.role, department: user.department, phone: user.phone, status: user.status, feature_permissions: user.feature_permissions || null }];
    }
    return list;
  }

  if (upper.startsWith('INSERT INTO SESI')) {
    memoryStore.sesi.set(params[0], {
      id: params[0],
      user_id: params[1],
      refresh_hash: params[2],
      device_id_hash: params[3],
      user_agent: params[4],
      ip: params[5],
      dibuat_pada: new Date().toISOString(),
      aktivitas_terakhir: new Date().toISOString(),
      kedaluwarsa_mutlak: normalizeDbDateToIso(params[6]) || String(params[6]),
      dicabut_pada: null
    });
    return { affectedRows: 1 };
  }

  if (upper.startsWith('DELETE FROM SESI WHERE ID = ?')) {
    const deleted = memoryStore.sesi.delete(params[0]);
    return { affectedRows: deleted ? 1 : 0 };
  }

  if (upper.startsWith('UPDATE SESI')) {
    if (upper.includes('SET DICABUT_PADA = NOW() WHERE ID = ?')) {
      const s = memoryStore.sesi.get(params[0]);
      if (s) s.dicabut_pada = new Date().toISOString();
      return { affectedRows: s ? 1 : 0 };
    }
    if (upper.includes('SET DICABUT_PADA = NOW() WHERE USER_ID = ?')) {
      let count = 0;
      for (const s of memoryStore.sesi.values()) {
        if (s.user_id === params[0] && !s.dicabut_pada) {
          s.dicabut_pada = new Date().toISOString();
          count++;
        }
      }
      return { affectedRows: count };
    }
    if (upper.includes('SET AKTIVITAS_TERAKHIR = NOW() WHERE ID = ?')) {
      const s = memoryStore.sesi.get(params[0]);
      if (s) s.aktivitas_terakhir = new Date().toISOString();
      return { affectedRows: s ? 1 : 0 };
    }
    if (upper.includes('SET REFRESH_HASH = ?')) {
      const s = memoryStore.sesi.get(params[params.length - 1]);
      if (s) {
        s.refresh_hash = params[0];
        s.aktivitas_terakhir = new Date().toISOString();
        s.ip = params[1];
        s.user_agent = params[2];
      }
      return { affectedRows: s ? 1 : 0 };
    }
  }

  // TRANSAKSI & TRANSAKSI_DETAIL (Canonical Ledger)
  if (upper.startsWith('SELECT') && upper.includes('FROM TRANSAKSI_DETAIL')) {
    let list = memoryStore.transaksi_detail_v2;
    if (upper.includes('WHERE TRANSAKSI_ID = ?')) {
      list = list.filter(d => d.transaksi_id === params[0]);
    } else if (upper.includes('WHERE TIPE_ID = ?')) {
      const tId = Number(params[0]);
      list = list.filter(d => Number(d.tipe_id) === tId);
    }
    return list.map(d => {
      const tx = memoryStore.transaksi_v2.get(d.transaksi_id);
      const actor = tx ? memoryStore.users.get(tx.actor_id || tx.pelaku_id) : null;
      return {
        ...d,
        id_aktivitas: tx?.id_aktivitas || '',
        aksi: tx?.aksi || '',
        waktu: tx?.occurred_at || tx?.waktu || '',
        occurred_at: tx?.occurred_at || tx?.waktu || '',
        recorded_at: tx?.recorded_at || tx?.waktu || '',
        catatan: tx?.catatan || '',
        nama_pelaku: tx?.actor_nama || actor?.name || tx?.pelaku_id || ''
      };
    });
  }

  if (upper.startsWith('SELECT') && upper.includes('FROM TRANSAKSI')) {
    if (upper.includes('WHERE ID_AKTIVITAS LIKE ?')) {
      const prefix = String(params[0]).replace('%', '');
      const list = Array.from(memoryStore.transaksi_v2.values()).filter(t => t.id_aktivitas.startsWith(prefix));
      list.sort((a, b) => b.id_aktivitas.localeCompare(a.id_aktivitas));
      return list.slice(0, 1);
    }

    let list = Array.from(memoryStore.transaksi_v2.values());

    if (upper.includes('WHERE T.ID = ?') || upper.includes('WHERE ID = ?')) {
      const match = memoryStore.transaksi_v2.get(params[0]);
      list = match ? [match] : [];
    } else if (upper.includes('WHERE T.REQUEST_ID = ?') || upper.includes('WHERE REQUEST_ID = ?')) {
      const reqId = params[0];
      list = list.filter(t => t.request_id === reqId);
    } else if (upper.includes('WHERE T.CORRECTION_OF_ID = ?')) {
      const cId = params[0];
      list = list.filter(t => t.correction_of_id === cId);
    } else {
      // Dynamic filter matching ActivityLogService.getLogs
      let pIdx = 0;
      if (upper.includes('AND T.REQUEST_ID = ?')) {
        const val = params[pIdx++];
        list = list.filter(t => t.request_id === val);
      }
      if (upper.includes('AND T.AKSI = ?')) {
        const val = params[pIdx++];
        list = list.filter(t => t.aksi === val);
      }
      const inMatch = upper.match(/AND T\.AKSI IN \(([^)]+)\)/);
      if (inMatch) {
        const count = inMatch[1].split('?').length - 1;
        const allowed = new Set(params.slice(pIdx, pIdx + count).map(String));
        pIdx += count;
        list = list.filter(t => allowed.has(String(t.aksi)));
      }
      const notInMatch = upper.match(/AND T\.AKSI NOT IN \(([^)]+)\)/);
      if (notInMatch) {
        const count = notInMatch[1].split('?').length - 1;
        const excluded = new Set(params.slice(pIdx, pIdx + count).map(String));
        pIdx += count;
        list = list.filter(t => !excluded.has(String(t.aksi)));
      }
      if (upper.includes('AND (LOWER(T.ID_AKTIVITAS) LIKE ?')) {
        const rawPattern = String(params[pIdx++] || '').toLowerCase();
        pIdx += 4;
        const needle = rawPattern.replace(/^%|%$/g, '');
        if (needle) {
          list = list.filter(t => {
            const uActor = memoryStore.users.get(t.actor_id || t.pelaku_id);
            const uPelaku = memoryStore.users.get(t.pelaku_id);
            const hay = [
              t.id_aktivitas,
              t.aksi,
              t.catatan || '',
              t.actor_nama || uActor?.name || uPelaku?.name || '',
              uActor?.username || uPelaku?.username || ''
            ]
              .join(' ')
              .toLowerCase();
            return hay.includes(needle);
          });
        }
      }
      if (upper.includes('AND (T.PELAKU_ID = ? OR T.ACTOR_ID = ?)')) {
        const val1 = params[pIdx++];
        pIdx++;
        list = list.filter(t => t.pelaku_id === val1 || t.actor_id === val1);
      } else if (upper.includes('AND T.PELAKU_ID = ?')) {
        const val = params[pIdx++];
        list = list.filter(t => t.pelaku_id === val);
      }
      if (upper.includes('AND COALESCE(T.OCCURRED_AT, T.WAKTU) >= ?')) {
        const fromMs = new Date(normalizeDbDateToIso(params[pIdx++]) || params[pIdx - 1]).getTime();
        list = list.filter(t => new Date(t.occurred_at || t.waktu).getTime() >= fromMs);
      } else if (upper.includes('AND T.WAKTU >= ?')) {
        const fromMs = new Date(params[pIdx++]).getTime();
        list = list.filter(t => new Date(t.waktu).getTime() >= fromMs);
      }
      if (upper.includes('AND COALESCE(T.OCCURRED_AT, T.WAKTU) <= ?')) {
        const toMs = new Date(normalizeDbDateToIso(params[pIdx++]) || params[pIdx - 1]).getTime();
        list = list.filter(t => new Date(t.occurred_at || t.waktu).getTime() <= toMs);
      } else if (upper.includes('AND T.WAKTU <= ?')) {
        const toMs = new Date(params[pIdx++]).getTime();
        list = list.filter(t => new Date(t.waktu).getTime() <= toMs);
      }
    }

    const enriched = list.map(t => {
      const uPelaku = memoryStore.users.get(t.pelaku_id);
      const uActor = memoryStore.users.get(t.actor_id || t.pelaku_id);
      const uRec = memoryStore.users.get(t.recorded_by_id || t.pelaku_id);
      const uApp = t.penyetuju_id ? memoryStore.users.get(t.penyetuju_id) : null;
      const details = memoryStore.transaksi_detail_v2.filter(d => d.transaksi_id === t.id);
      return {
        ...t,
        nama_pelaku: t.actor_nama || uActor?.name || uPelaku?.name || t.pelaku_id,
        username_pelaku: uActor?.username || uPelaku?.username || null,
        role_pelaku: uActor?.role || uPelaku?.role || null,
        actor_nama: t.actor_nama || uActor?.name || uPelaku?.name || t.pelaku_id,
        recorded_by_nama: t.recorded_by_nama || uRec?.name || t.recorded_by_id || t.pelaku_id,
        nama_penyetuju: uApp?.name || null,
        total_items: details.length
      };
    });

    enriched.sort((a, b) => new Date(b.occurred_at || b.waktu).getTime() - new Date(a.occurred_at || a.waktu).getTime());

    if (upper.includes('LIMIT ? OFFSET ?')) {
      const limit = Number(params[params.length - 2]) || 100;
      const offset = Number(params[params.length - 1]) || 0;
      return enriched.slice(offset, offset + limit);
    }
    if (upper.includes('LIMIT ?')) {
      const limit = Number(params[params.length - 1]) || 100;
      return enriched.slice(0, limit);
    }
    return enriched;
  }

  if (upper.startsWith('INSERT INTO TRANSAKSI (')) {
    const colMatch = cleanSql.match(/INSERT\s+INTO\s+transaksi\s*\(([^)]+)\)/i);
    if (colMatch && colMatch[1]) {
      const cols = colMatch[1].split(',').map(c => c.trim().toLowerCase());
      const tx: any = {
        waktu: new Date().toISOString(),
        occurred_at: new Date().toISOString(),
        recorded_at: new Date().toISOString(),
        is_on_behalf: 0,
        qty_total: 0
      };
      // Build SQL value tokens so literal NOW() is handled alongside ? placeholders
      const valuesPart = cleanSql.slice(cleanSql.toUpperCase().indexOf('VALUES'));
      const valMatch = valuesPart.match(/VALUES\s*\(([\s\S]*)\)/i);
      if (valMatch && valMatch[1]) {
        const valTokens = valMatch[1].split(',').map(v => v.trim());
        let pIdx = 0;
        cols.forEach((col, i) => {
          const tok = valTokens[i];
          if (tok === '?') {
            const raw = params[pIdx++];
            if (col === 'waktu' || col === 'occurred_at' || col === 'recorded_at') {
              tx[col] = normalizeDbDateToIso(raw) || raw;
            } else {
              tx[col] = raw;
            }
          } else if (tok && tok.toUpperCase().startsWith('NOW')) {
            tx[col] = new Date().toISOString();
          } else if (tok) {
            tx[col] = tok.replace(/^['"]|['"]$/g, '');
          }
        });
      }
      if (!tx.actor_id) tx.actor_id = tx.pelaku_id;
      if (!tx.recorded_by_id) tx.recorded_by_id = tx.pelaku_id;
      if (!tx.occurred_at) tx.occurred_at = tx.waktu;
      if (!tx.recorded_at) tx.recorded_at = tx.waktu;
      memoryStore.transaksi_v2.set(tx.id, tx);
      return { affectedRows: 1 };
    }
  }

  if (upper.startsWith('INSERT INTO TRANSAKSI_DETAIL')) {
    const d = {
      id: memoryStore.transaksi_detail_v2.length + 1,
      transaksi_id: params[0],
      tipe_id: params[1] || null,
      item_id: params[2] || null,
      kode_id: params[3] || null,
      nama_snapshot: params[4],
      jumlah: params[5] || 1,
      status_sebelum: params[6] || null,
      status_sesudah: params[7] || null
    };
    memoryStore.transaksi_detail_v2.push(d);
    return { affectedRows: 1 };
  }

  // SAMPAH_HAPUS
  if (upper.startsWith('SELECT') && upper.includes('FROM SAMPAH_HAPUS')) {
    const list = Array.from(memoryStore.sampah_hapus.values());
    if (upper.includes('WHERE S.STATUS = \'MENUNGGU\'') || upper.includes('WHERE STATUS = \'MENUNGGU\'')) {
      if (upper.includes('PURGE_SETELAH <= NOW()')) {
        const now = Date.now();
        return list.filter(s => s.status === 'menunggu' && new Date(s.purge_setelah).getTime() <= now);
      }
      const filtered = list.filter(s => s.status === 'menunggu');
      filtered.sort((a, b) => new Date(b.dibuat_pada || b.dihapus_pada).getTime() - new Date(a.dibuat_pada || a.dihapus_pada).getTime());
      return filtered;
    }
    if (upper.includes('WHERE S.ID = ?') || upper.includes('WHERE ID = ?')) {
      const match = memoryStore.sampah_hapus.get(params[0]);
      return match ? [match] : [];
    }
    return list;
  }

  if (upper.startsWith('INSERT INTO SAMPAH_HAPUS')) {
    const s = {
      id: params[0],
      jenis_objek: params[1],
      objek_id: params[2],
      snapshot: params[3],
      dihapus_oleh: params[4],
      dihapus_pada: new Date().toISOString(),
      aktivitas_id: params[5],
      purge_setelah: normalizeDbDateToIso(params[6]) || String(params[6]),
      status: 'menunggu'
    };
    memoryStore.sampah_hapus.set(s.id, s);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE SAMPAH_HAPUS')) {
    const s = memoryStore.sampah_hapus.get(params[params.length - 1]);
    if (s) {
      if (upper.includes('STATUS = "DIPULIHKAN"')) s.status = 'dipulihkan';
      if (upper.includes("STATUS = 'DIBERSIHKAN'")) {
        s.status = 'dibersihkan';
        s.snapshot = '';
      }
    }
    return { affectedRows: s ? 1 : 0 };
  }

  // TOKEN_KONFIRMASI
  if (upper.startsWith('SELECT') && upper.includes('FROM TOKEN_KONFIRMASI')) {
    if (upper.includes('WHERE TOKEN_HASH = ?')) {
      const match = Array.from(memoryStore.token_konfirmasi.values()).find(t => t.token_hash === params[0]);
      return match ? [match] : [];
    }
    return Array.from(memoryStore.token_konfirmasi.values());
  }

  if (upper.startsWith('INSERT INTO TOKEN_KONFIRMASI')) {
    const t = {
      id: params[0],
      token_hash: params[1],
      user_id: params[2],
      action_type: params[3],
      target_id: params[4],
      tier: params[5],
      expires_at: normalizeDbDateToIso(params[6]) || String(params[6]),
      used_at: null,
      created_at: new Date().toISOString()
    };
    memoryStore.token_konfirmasi.set(t.id, t);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE TOKEN_KONFIRMASI SET USED_AT = NOW() WHERE ID = ?')) {
    const t = memoryStore.token_konfirmasi.get(params[0]);
    if (t && !t.used_at) {
      t.used_at = new Date().toISOString();
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  return undefined;
}
