/**
 * Memory Query Handler: Canonical Stock, Box, Item & Requests
 * (box, item, stok_jumlah, request)
 */

import { memoryStore } from '../memoryStore';
import { normalizeDbDateToIso } from '../../utils/timezone';

export function handleStockMemoryQuery(cleanSql: string, upper: string, params: any[]): any {
  // BOX
  if (upper.startsWith('INSERT INTO BOX')) {
    const b = {
      id: params[0],
      kode: params[1],
      keterangan: params[2] || null,
      aktif: 1,
      dibuat_pada: new Date().toISOString()
    };
    memoryStore.box.set(b.id, b);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('SELECT B.*') && upper.includes('FROM BOX B')) {
    const list = Array.from(memoryStore.box.values()).filter(b => b.aktif === 1 || b.aktif === true);
    const enriched = list.map(b => {
      const activeItemsCount = Array.from(memoryStore.item_v2.values()).filter(i => i.box_id === b.id && (i.status === 'aktif' || i.status === 'dipesan')).length;
      const sjCount = Array.from(memoryStore.stok_jumlah.values()).filter(s => s.box_id === b.id).reduce((acc, c) => acc + (c.jumlah || 0), 0);
      return { ...b, total_item: activeItemsCount + sjCount };
    });
    enriched.sort((a, b) => a.kode.localeCompare(b.kode));
    return enriched;
  }

  if (upper.startsWith('SELECT * FROM BOX WHERE ID = ?')) {
    const b = memoryStore.box.get(params[0]);
    return b ? [{ ...b }] : [];
  }

  if (upper.startsWith('SELECT * FROM BOX WHERE UPPER(KODE) = ?')) {
    const code = String(params[0]).toUpperCase();
    const match = Array.from(memoryStore.box.values()).find(b => b.kode.toUpperCase() === code);
    return match ? [{ ...match }] : [];
  }

  if (upper.startsWith('UPDATE BOX SET AKTIF = 0 WHERE ID = ?')) {
    const b = memoryStore.box.get(params[0]);
    if (b) {
      b.aktif = 0;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.includes('FROM ITEM WHERE BOX_ID = ?')) {
    const boxId = params[0];
    const total = Array.from(memoryStore.item_v2.values()).filter(
      i => i.box_id === boxId && (i.status === 'aktif' || i.status === 'dipesan')
    ).length;
    return [{ total }];
  }

  if (upper.includes('FROM STOK_JUMLAH WHERE BOX_ID = ?')) {
    const boxId = params[0];
    const rows = Array.from(memoryStore.stok_jumlah.values()).filter(s => s.box_id === boxId);
    const total = rows.reduce((acc, s) => acc + Number(s.jumlah || 0), 0);
    const reserved = rows.reduce((acc, s) => acc + Number(s.reserved_qty || 0), 0);
    return [{ total, reserved }];
  }

  if (upper.includes('FROM REQUEST WHERE (BOX_ID = ? OR RETURN_BOX_ID = ?)')) {
    const boxId = params[0];
    const total = Array.from(memoryStore.request.values()).filter(
      r => (r.box_id === boxId || r.return_box_id === boxId) && ['diajukan', 'menunggu', 'disetujui'].includes(r.status)
    ).length;
    return [{ total }];
  }

  if (upper.startsWith('SELECT ID FROM BOX WHERE KODE = "BOX-A-01"')) {
    const match = Array.from(memoryStore.box.values()).find(b => b.kode === 'BOX-A-01');
    return match ? [{ id: match.id }] : [];
  }

  // ITEM
  if (upper.startsWith('INSERT INTO ITEM (')) {
    const isNewSchema = upper.includes('KONDISI');
    const it = {
      id: params[0],
      kode_id: params[1],
      tipe_id: parseInt(String(params[2]), 10),
      box_id: params[3],
      status: upper.includes("'AKTIF'") || upper.includes('"AKTIF"') ? 'aktif' : (params[4] || 'aktif'),
      kondisi: isNewSchema ? (params[4] || 'Baik') : 'Baik',
      catatan_kondisi: isNewSchema ? (params[5] || null) : null,
      reserved_for_request_id: null as string | null,
      reserved_for_user_id: null as string | null,
      dibuat_pada: new Date().toISOString()
    };
    memoryStore.item_v2.set(it.id, it);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE ITEM SET KONDISI')) {
    const target = params[2];
    const it = memoryStore.item_v2.get(target) || Array.from(memoryStore.item_v2.values()).find(i => i.id === target || i.kode_id === target);
    if (it) {
      it.kondisi = params[0];
      it.catatan_kondisi = params[1] || null;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('UPDATE ITEM SET BOX_ID = ? WHERE ID = ?')) {
    const it = memoryStore.item_v2.get(params[1]);
    if (it) {
      it.box_id = params[0];
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('UPDATE ITEM SET RESERVED_FOR_REQUEST_ID')) {
    const reqId = params[params.length - 1];
    let count = 0;
    for (const it of memoryStore.item_v2.values()) {
      if (it.reserved_for_request_id === reqId) {
        if (upper.includes("STATUS = 'AKTIF'") || upper.includes('STATUS = "AKTIF"')) {
          it.status = 'aktif';
        }
        it.reserved_for_request_id = null;
        it.reserved_for_user_id = null;
        count++;
      }
    }
    return { affectedRows: count };
  }

  if (upper.startsWith('UPDATE ITEM SET STATUS') || upper.startsWith('UPDATE ITEM SET')) {
    if (upper.includes("STATUS = 'DIPESAN'") || upper.includes('STATUS = "DIPESAN"')) {
      const it = memoryStore.item_v2.get(params[2]);
      if (it) {
        it.status = 'dipesan';
        it.reserved_for_request_id = params[0];
        it.reserved_for_user_id = params[1];
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    if (upper.includes('STATUS = "KELUAR"') || upper.includes("STATUS = 'KELUAR'")) {
      const it = memoryStore.item_v2.get(params[0]);
      if (it) {
        it.status = 'keluar';
        it.reserved_for_request_id = null;
        it.reserved_for_user_id = null;
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    if (upper.includes('STATUS = "AKTIF", BOX_ID = ?, KONDISI = ?, CATATAN_KONDISI = ?') || upper.includes("STATUS = 'AKTIF', BOX_ID = ?, KONDISI = ?, CATATAN_KONDISI = ?")) {
      const it = memoryStore.item_v2.get(params[3]);
      if (it) {
        it.status = 'aktif';
        it.box_id = params[0];
        it.kondisi = params[1];
        it.catatan_kondisi = params[2];
        it.reserved_for_request_id = null;
        it.reserved_for_user_id = null;
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    if (upper.includes('STATUS = "AKTIF", BOX_ID = ? WHERE ID = ?') || upper.includes("STATUS = 'AKTIF', BOX_ID = ? WHERE ID = ?")) {
      const it = memoryStore.item_v2.get(params[1]);
      if (it) {
        it.status = 'aktif';
        it.box_id = params[0];
        it.reserved_for_request_id = null;
        it.reserved_for_user_id = null;
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    if (upper.includes('BOX_ID = ?')) {
      const it = memoryStore.item_v2.get(params[2]);
      if (it) {
        it.status = params[0];
        it.box_id = params[1];
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    const it = memoryStore.item_v2.get(params[1]);
    if (it) {
      it.status = params[0];
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('SELECT I.*') && upper.includes('FROM ITEM I')) {
    if (upper.includes('WHERE UPPER(I.KODE_ID) = UPPER(?)') || upper.includes('WHERE I.ID = ?')) {
      const target = String(params[0]).toUpperCase();
      const match = upper.includes('WHERE I.ID = ?')
        ? memoryStore.item_v2.get(params[0])
        : Array.from(memoryStore.item_v2.values()).find(i => i.kode_id.toUpperCase() === target);
      if (!match) return [];
      const b = memoryStore.box.get(match.box_id);
      const t = memoryStore.tipe.get(match.tipe_id);
      const p = t ? memoryStore.produk.get(t.produk_id) : null;
      return [{
        ...match,
        kode_box: b ? b.kode : '',
        nama_tipe: t ? t.nama_tipe : '',
        nama_produk: p ? p.nama : '',
        produk_id: p ? p.id : null,
        kategori_barang: p ? (p.kategori_barang || 'Barang Habis Pakai') : 'Barang Habis Pakai',
        tipe_stok: p ? (p.tipe_stok || 'unit') : 'unit'
      }];
    }

    // Search endpoint query across aktif + out + dipesan items for active produk/tipe
    if (upper.includes('LIKE UPPER(?)') && upper.includes('JOIN BOX B')) {
      const q = String(params[0] || '').replace(/%/g, '').toUpperCase();
      let list = Array.from(memoryStore.item_v2.values()).map(i => {
        const b = memoryStore.box.get(i.box_id);
        const t = memoryStore.tipe.get(i.tipe_id);
        const p = t ? memoryStore.produk.get(t.produk_id) : null;
        const j = p ? memoryStore.jenis.get(p.jenis_id) : null;
        return {
          ...i,
          kode_box: b ? b.kode : '',
          nama_tipe: t ? t.nama_tipe : '',
          nama_produk: p ? p.nama : '',
          produk_id: p ? p.id : null,
          produk_aktif: p ? (p.aktif === 1 || p.aktif === true) : false,
          tipe_aktif: t ? (t.aktif === 1 || t.aktif === true) : false,
          jenis_nama: j ? j.nama : '',
          kategori_barang: p ? (p.kategori_barang || 'Barang Habis Pakai') : 'Barang Habis Pakai',
          tipe_stok: p ? (p.tipe_stok || 'unit') : 'unit'
        };
      }).filter(row => row.produk_aktif && row.tipe_aktif);

      if (q.length > 0) {
        list = list.filter(row =>
          row.kode_id.toUpperCase().includes(q) ||
          row.nama_produk.toUpperCase().includes(q) ||
          row.nama_tipe.toUpperCase().includes(q) ||
          row.kode_box.toUpperCase().includes(q)
        );
      }

      list.sort((a, b) => {
        const score = (s: string) => (s === 'aktif' ? 0 : s === 'dipesan' ? 1 : 2);
        return score(a.status) - score(b.status) || a.nama_produk.localeCompare(b.nama_produk) || a.kode_id.localeCompare(b.kode_id);
      });
      return list.slice(0, 50);
    }

    if (upper.includes('WHERE I.BOX_ID = ? AND I.STATUS = \'AKTIF\'')) {
      const boxId = params[0];
      const list = Array.from(memoryStore.item_v2.values()).filter(i => i.box_id === boxId && i.status === 'aktif');
      const enriched = list.map(i => {
        const t = memoryStore.tipe.get(i.tipe_id);
        const p = t ? memoryStore.produk.get(t.produk_id) : null;
        const j = p ? memoryStore.jenis.get(p.jenis_id) : null;
        return {
          ...i,
          nama_tipe: t ? t.nama_tipe : '',
          nama_produk: p ? p.nama : '',
          jenis_nama: j ? j.nama : ''
        };
      });
      enriched.sort((a, b) => a.nama_produk.localeCompare(b.nama_produk) || a.nama_tipe.localeCompare(b.nama_tipe) || a.kode_id.localeCompare(b.kode_id));
      return enriched;
    }

    if (upper.includes('WHERE I.STATUS = \'KELUAR\'') || upper.includes('WHERE STATUS = \'KELUAR\'')) {
      let list = Array.from(memoryStore.item_v2.values()).filter(i => i.status === 'keluar');

      if (upper.includes('UPPER(I.KODE_ID) LIKE') || upper.includes('UPPER(P.NAMA) LIKE')) {
        const q = String(params[0]).replace(/%/g, '').toUpperCase();
        list = list.filter(i => {
          const t = memoryStore.tipe.get(i.tipe_id);
          const p = t ? memoryStore.produk.get(t.produk_id) : null;
          return i.kode_id.toUpperCase().includes(q) || (p && p.nama.toUpperCase().includes(q)) || (t && t.nama_tipe.toUpperCase().includes(q));
        });
      }

      const enriched = list.map(i => {
        const b = memoryStore.box.get(i.box_id);
        const t = memoryStore.tipe.get(i.tipe_id);
        const p = t ? memoryStore.produk.get(t.produk_id) : null;
        const j = p ? memoryStore.jenis.get(p.jenis_id) : null;
        return {
          ...i,
          kode_box: b ? b.kode : '',
          nama_tipe: t ? t.nama_tipe : '',
          nama_produk: p ? p.nama : '',
          jenis_nama: j ? j.nama : ''
        };
      });
      enriched.sort((a, b) => new Date(b.dibuat_pada).getTime() - new Date(a.dibuat_pada).getTime());
      return enriched;
    }

    if (upper.includes('WHERE I.TIPE_ID = ? AND I.STATUS = \'AKTIF\'') || upper.includes('WHERE TIPE_ID = ? AND STATUS = \'AKTIF\'')) {
      const tipeId = parseInt(String(params[0]), 10);
      let list = Array.from(memoryStore.item_v2.values()).filter(i => i.tipe_id === tipeId && i.status === 'aktif');
      if (upper.includes("KONDISI != 'RUSAK'")) {
        list = list.filter(i => i.kondisi !== 'Rusak');
      }
      return list.map(i => {
        const b = memoryStore.box.get(i.box_id);
        return {
          ...i,
          box_kode: b ? b.kode : '',
          box_keterangan: b ? b.keterangan : ''
        };
      });
    }
  }

  if (upper.includes('SELECT B.ID AS BOX_ID, B.KODE AS BOX_KODE') && upper.includes('FROM ITEM')) {
    const tipeId = parseInt(String(params[0]), 10);
    let list = Array.from(memoryStore.item_v2.values()).filter(i => i.tipe_id === tipeId && i.status === 'aktif');
    if (upper.includes("KONDISI != 'RUSAK'")) {
      list = list.filter(i => i.kondisi !== 'Rusak');
    }
    const boxMap: Record<string, { box_id: string; box_kode: string; box_keterangan: string; jumlah: number }> = {};
    for (const it of list) {
      const b = memoryStore.box.get(it.box_id);
      if (!boxMap[it.box_id]) {
        boxMap[it.box_id] = {
          box_id: it.box_id,
          box_kode: b ? b.kode : it.box_id,
          box_keterangan: b ? b.keterangan || '' : '',
          jumlah: 0
        };
      }
      boxMap[it.box_id].jumlah++;
    }
    return Object.values(boxMap);
  }

  if (upper.includes('FROM ITEM') && (upper.includes('COUNT(') || upper.includes('COUNT ('))) {
    const tipeId = parseInt(String(params[0]), 10);
    if (upper.includes("WHERE TIPE_ID = ? AND STATUS = 'DIPESAN'") || upper.includes('WHERE TIPE_ID = ? AND STATUS = "DIPESAN"')) {
      const reservedCount = Array.from(memoryStore.item_v2.values()).filter(
        i => i.tipe_id === tipeId && i.status === 'dipesan'
      ).length;
      return [{ total: reservedCount, count: reservedCount }];
    }
    const items = Array.from(memoryStore.item_v2.values()).filter(i => i.tipe_id === tipeId && i.status === 'aktif');
    const total = items.length;
    let rusak = 0;
    let baru = 0;
    let baik = 0;
    let perlu_perbaikan = 0;
    for (const it of items) {
      const k = it.kondisi || 'Baik';
      if (k === 'Rusak') rusak++;
      else if (k === 'Baru') baru++;
      else if (k === 'Perlu Perbaikan') perlu_perbaikan++;
      else baik++;
    }
    const count = upper.includes("KONDISI != 'RUSAK'")
      ? items.filter(i => (i.kondisi || 'Baik') !== 'Rusak').length
      : total;
    return [{ total, rusak, baru, baik, perlu_perbaikan, dipesan: 0, count }];
  }

  if (upper.startsWith('SELECT') && upper.includes('FROM ITEM')) {
    if (params.length > 0 && (upper.includes('WHERE ID = ?') || upper.includes('WHERE ID = ? OR KODE_ID = ?'))) {
      const target = String(params[0]).toLowerCase();
      const target2 = params[1] ? String(params[1]).toLowerCase() : target;
      const it = memoryStore.item_v2.get(params[0]) || Array.from(memoryStore.item_v2.values()).find(i =>
        i.id.toLowerCase() === target ||
        i.kode_id.toLowerCase() === target ||
        i.id.toLowerCase() === target2 ||
        i.kode_id.toLowerCase() === target2
      );
      return it ? [{ ...it }] : [];
    }
    return Array.from(memoryStore.item_v2.values());
  }

  // STOK_JUMLAH
  if (upper.includes('FROM STOK_JUMLAH') && upper.includes('WHERE TIPE_ID = ? AND BOX_ID = ?')) {
    const key = `${params[0]}_${params[1]}`;
    const sj = memoryStore.stok_jumlah.get(key);
    return sj ? [{ ...sj, reserved_qty: sj.reserved_qty || 0 }] : [];
  }

  if (upper.startsWith('UPDATE STOK_JUMLAH SET RESERVED_QTY')) {
    const key = `${params[1]}_${params[2]}`;
    const sj = memoryStore.stok_jumlah.get(key);
    if (sj) {
      if (upper.includes('+ ?')) {
        sj.reserved_qty = (sj.reserved_qty || 0) + Number(params[0]);
      } else if (upper.includes('- ?')) {
        sj.reserved_qty = Math.max(0, (sj.reserved_qty || 0) - Number(params[0]));
      }
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('UPDATE STOK_JUMLAH SET JUMLAH = JUMLAH - ?')) {
    const key = `${params[1]}_${params[2]}`;
    const sj = memoryStore.stok_jumlah.get(key);
    if (sj) {
      sj.jumlah = Math.max(0, sj.jumlah - Number(params[0]));
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('UPDATE STOK_JUMLAH SET JUMLAH = JUMLAH + ?')) {
    const key = `${params[1]}_${params[2]}`;
    const sj = memoryStore.stok_jumlah.get(key);
    if (sj) {
      sj.jumlah += Number(params[0]);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('UPDATE STOK_JUMLAH SET JUMLAH = ?')) {
    const key = `${params[1]}_${params[2]}`;
    const sj = memoryStore.stok_jumlah.get(key);
    if (sj) {
      sj.jumlah = Number(params[0]);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('INSERT INTO STOK_JUMLAH')) {
    const key = `${params[0]}_${params[1]}`;
    memoryStore.stok_jumlah.set(key, {
      tipe_id: parseInt(String(params[0]), 10),
      box_id: params[1],
      jumlah: Number(params[2]),
      reserved_qty: 0
    });
    return { affectedRows: 1 };
  }

  if (upper.includes('FROM STOK_JUMLAH') && (upper.includes('SUM(') || upper.includes('COALESCE'))) {
    const tipeId = parseInt(String(params[0]), 10);
    const rows = Array.from(memoryStore.stok_jumlah.values()).filter(s => s.tipe_id === tipeId);
    const total = rows.reduce((acc, c) => acc + Math.max(0, (c.jumlah || 0) - (c.reserved_qty || 0)), 0);
    const reserved = rows.reduce((acc, c) => acc + (c.reserved_qty || 0), 0);
    return [{ total, reserved }];
  }

  if (upper.includes('FROM STOK_JUMLAH') && (upper.includes('WHERE TIPE_ID = ?') || upper.includes('WHERE SJ.TIPE_ID = ?')) && upper.includes('JUMLAH > 0')) {
    const tipeId = parseInt(String(params[0]), 10);
    const list = Array.from(memoryStore.stok_jumlah.values()).filter(s => s.tipe_id === tipeId && s.jumlah > 0);
    return list.map(s => {
      const b = memoryStore.box.get(s.box_id);
      return {
        ...s,
        reserved_qty: s.reserved_qty || 0,
        box_kode: b ? b.kode : '',
        box_keterangan: b ? b.keterangan : ''
      };
    });
  }

  if (upper.startsWith('SELECT SJ.*') && upper.includes('FROM STOK_JUMLAH SJ')) {
    const boxId = params[0];
    const list = Array.from(memoryStore.stok_jumlah.values()).filter(s => s.box_id === boxId && s.jumlah > 0);
    const enriched = list.map(s => {
      const t = memoryStore.tipe.get(s.tipe_id);
      const p = t ? memoryStore.produk.get(t.produk_id) : null;
      const j = p ? memoryStore.jenis.get(p.jenis_id) : null;
      return {
        ...s,
        reserved_qty: s.reserved_qty || 0,
        nama_tipe: t ? t.nama_tipe : '',
        nama_produk: p ? p.nama : '',
        jenis_nama: j ? j.nama : ''
      };
    });
    enriched.sort((a, b) => a.nama_produk.localeCompare(b.nama_produk) || a.nama_tipe.localeCompare(b.nama_tipe));
    return enriched;
  }

  // REQUEST
  if (upper.startsWith('SELECT ID FROM REQUEST') && upper.includes('TRANSACTION_OUT_ID = ?')) {
    const originId = params[0];
    const list = Array.from(memoryStore.request.values()).filter(
      r => r.transaction_out_id === originId && Boolean(r.return_condition) && ['diajukan', 'menunggu', 'disetujui'].includes(r.status)
    );
    return list.map(r => ({ id: r.id }));
  }

  if (upper.startsWith('SELECT TRANSACTION_OUT_ID FROM REQUEST')) {
    const list = Array.from(memoryStore.request.values()).filter(
      r => typeof r.transaction_out_id === 'string' && r.transaction_out_id.startsWith('req-') && ['diajukan', 'menunggu', 'disetujui'].includes(r.status)
    );
    return list.map(r => ({ transaction_out_id: r.transaction_out_id }));
  }

  if (upper.startsWith('INSERT INTO REQUEST')) {
    const isReturnSubmit = upper.includes('RETURN_CONDITION');
    const isPurchaseSubmit = upper.includes('PURCHASE_ITEM_NAME');
    const parsedTipeId = params[2] !== null && params[2] !== undefined ? parseInt(String(params[2]), 10) : null;
    const req: any = {
      id: params[0],
      pemohon_id: params[1],
      penyetuju_id: null,
      tipe_id: parsedTipeId !== null && !isNaN(parsedTipeId) ? parsedTipeId : null,
      box_id: params[3] || null,
      kode_id: params[4] || null,
      jumlah: parseInt(String(params[5]), 10) || 1,
      alasan: params[6],
      catatan_penolakan: null,
      status: params[7] || 'menunggu',
      actor_id: params[8] || params[1],
      recorded_by_id: params[9] || params[1],
      request_type: isReturnSubmit ? 'kembalikan' : isPurchaseSubmit ? 'beli' : 'ambil',
      purchase_item_name: isPurchaseSubmit ? (params[10] || null) : null,
      purchase_estimated_price: isPurchaseSubmit ? (params[11] !== undefined && params[11] !== null ? Number(params[11]) : null) : null,
      dibuat_pada: new Date().toISOString(),
      diproses_pada: null,
      taken_at: null,
      returned_at: null,
      returned_by_id: null,
      return_condition: isReturnSubmit ? (params[10] || null) : null,
      return_notes: isReturnSubmit ? (params[11] || null) : null,
      return_box_id: isReturnSubmit ? (params[12] || null) : null,
      allocated_item_ids: isReturnSubmit ? (params[13] || null) : null,
      transaction_out_id: isReturnSubmit ? (params[14] || null) : null,
      transaction_in_id: null
    };
    memoryStore.request.set(req.id, req);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE REQUEST')) {
    const id = params[params.length - 1];
    const req = memoryStore.request.get(id);
    if (!req) return { affectedRows: 0 };

    if (upper.includes("SET STATUS = 'DISETUJUI'")) {
      if (req.status !== 'menunggu' && req.status !== 'diajukan') return { affectedRows: 0 };
      req.status = 'disetujui';
      req.penyetuju_id = params[0];
      req.diproses_pada = new Date().toISOString();
      if (upper.includes('ALLOCATED_ITEM_IDS')) {
        req.allocated_item_ids = params[1] || null;
        req.box_id = params[2] || req.box_id;
      }
      return { affectedRows: 1 };
    }
    if (upper.includes("SET STATUS = 'DITOLAK'")) {
      if (req.status !== 'menunggu' && req.status !== 'diajukan') return { affectedRows: 0 };
      req.status = 'ditolak';
      req.penyetuju_id = params[0];
      req.catatan_penolakan = params[1];
      req.diproses_pada = new Date().toISOString();
      return { affectedRows: 1 };
    }
    if (upper.includes("SET STATUS = 'DIBATALKAN'")) {
      if (req.status !== 'menunggu' && req.status !== 'diajukan' && req.status !== 'disetujui') {
        return { affectedRows: 0 };
      }
      req.status = 'dibatalkan';
      req.catatan_penolakan = params[0] || 'Dibatalkan';
      req.diproses_pada = new Date().toISOString();
      return { affectedRows: 1 };
    }
    if (upper.includes("SET STATUS = 'DIAMBIL'")) {
      req.status = 'diambil';
      req.taken_at = params[0] ? (normalizeDbDateToIso(params[0]) || new Date().toISOString()) : new Date().toISOString();
      req.transaction_out_id = params[1] || req.transaction_out_id;
      if (params.length > 3 && params[2] !== undefined) {
        req.allocated_item_ids = params[2];
      }
      return { affectedRows: 1 };
    }
    if (upper.includes("SET STATUS = 'DIKEMBALIKAN'")) {
      req.status = 'dikembalikan';
      req.returned_at = params[0] ? (normalizeDbDateToIso(params[0]) || new Date().toISOString()) : new Date().toISOString();
      req.returned_by_id = params[1] || null;
      req.return_condition = params[2] || 'Baik';
      req.return_notes = params[3] || null;
      req.return_box_id = params[4] || null;
      req.transaction_in_id = params[5] || null;
      if (upper.includes('PENYETUJU_ID')) {
        req.penyetuju_id = params[6] || null;
        req.diproses_pada = new Date().toISOString();
      }
      return { affectedRows: 1 };
    }
    if (upper.includes("SET STATUS = 'SELESAI'")) {
      const allowedFromPurchase = req.request_type === 'beli' && req.status === 'disetujui';
      if (req.status !== 'diambil' && !allowedFromPurchase) return { affectedRows: 0 };
      req.status = 'selesai';
      req.returned_at = params[0] ? (normalizeDbDateToIso(params[0]) || new Date().toISOString()) : new Date().toISOString();
      req.returned_by_id = params[1] || null;
      req.return_condition = req.request_type === 'beli' ? 'Dibeli' : 'Terpakai';
      req.return_notes = params[2] || null;
      req.diproses_pada = new Date().toISOString();
      return { affectedRows: 1 };
    }
  }

  if (upper.includes('FROM REQUEST R')) {
    let list = Array.from(memoryStore.request.values());

    if (upper.includes('WHERE R.ID = ?')) {
      const req = memoryStore.request.get(params[0]);
      list = req ? [req] : [];
    } else {
      let idx = 0;
      if (upper.includes('R.PEMOHON_ID = ?')) {
        const pId = params[idx];
        idx += upper.includes('OR R.ACTOR_ID = ?') ? 2 : 1;
        list = list.filter(r => r.pemohon_id === pId || r.actor_id === pId);
      }
      if (upper.includes("R.STATUS IN ('MENUNGGU', 'DIAJUKAN', 'DISETUJUI')")) {
        list = list.filter(r => r.status === 'menunggu' || r.status === 'diajukan' || r.status === 'disetujui');
      } else if (upper.includes("R.STATUS = 'DIAMBIL'") || upper.includes('R.STATUS = "DIAMBIL"')) {
        list = list.filter(r => r.status === 'diambil');
      } else if (upper.includes("R.STATUS IN ('DIAJUKAN', 'MENUNGGU')")) {
        list = list.filter(r => r.status === 'menunggu' || r.status === 'diajukan');
      } else if (upper.includes('R.STATUS = ?')) {
        const st = params[idx++];
        if (st === 'menunggu' || st === 'diajukan') {
          list = list.filter(r => r.status === 'menunggu' || r.status === 'diajukan');
        } else {
          list = list.filter(r => r.status === st);
        }
      }
      if (upper.includes('LIKE UPPER(?)')) {
        const q = String(params[idx] || '').replace(/%/g, '').toUpperCase();
        list = list.filter(r => {
          const u1 = memoryStore.users.get(r.pemohon_id);
          const t = r.tipe_id ? memoryStore.tipe.get(r.tipe_id) : null;
          const p = t ? memoryStore.produk.get(t.produk_id) : null;
          return (
            (p && p.nama.toUpperCase().includes(q)) ||
            (t && t.nama_tipe.toUpperCase().includes(q)) ||
            (r.purchase_item_name && r.purchase_item_name.toUpperCase().includes(q)) ||
            (u1 && u1.name.toUpperCase().includes(q)) ||
            (r.alasan && r.alasan.toUpperCase().includes(q)) ||
            (r.kode_id && r.kode_id.toUpperCase().includes(q))
          );
        });
      }
    }

    const enriched = list.map(r => {
      const u1 = memoryStore.users.get(r.pemohon_id);
      const uActor = memoryStore.users.get(r.actor_id || r.pemohon_id);
      const u2 = r.penyetuju_id ? memoryStore.users.get(r.penyetuju_id) : null;
      const t = r.tipe_id ? memoryStore.tipe.get(r.tipe_id) : null;
      const p = t ? memoryStore.produk.get(t.produk_id) : null;
      const b = r.box_id ? memoryStore.box.get(r.box_id) : null;
      const rb = r.return_box_id ? memoryStore.box.get(r.return_box_id) : null;
      return {
        ...r,
        nama_pemohon: uActor?.name || u1?.name || '',
        username_pemohon: uActor?.username || u1?.username || '',
        nama_penyetuju: u2 ? u2.name : '',
        username_penyetuju: u2 ? u2.username : '',
        nama_tipe: t ? t.nama_tipe : (r.request_type === 'beli' ? 'Usulan Barang Baru' : ''),
        nama_produk: p ? p.nama : (r.purchase_item_name || ''),
        kategori_barang: p ? (p.kategori_barang || 'Barang Habis Pakai') : 'Barang Habis Pakai',
        tipe_stok: p ? (p.tipe_stok || 'unit') : 'unit',
        mode_stok: t ? t.mode_stok : 'jumlah',
        kode_box: b ? b.kode : '',
        return_box_kode: rb ? rb.kode : ''
      };
    });

    enriched.sort((a, b) => new Date(b.dibuat_pada).getTime() - new Date(a.dibuat_pada).getTime());
    return enriched;
  }

  return undefined;
}
