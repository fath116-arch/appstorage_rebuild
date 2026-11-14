/**
 * Memory Query Handler: Stock v2 & Requests
 * (box, item, stok_jumlah, request)
 */

import { memoryStore } from '../memoryStore';

export function handleStockMemoryQuery(_cleanSql: string, upper: string, params: any[]): any {
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
      const activeItemsCount = Array.from(memoryStore.item_v2.values()).filter(i => i.box_id === b.id && i.status === 'aktif').length;
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

  // ITEM (v2)
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

  if (upper.startsWith('UPDATE ITEM SET STATUS') || upper.startsWith('UPDATE ITEM SET')) {
    if (upper.includes('STATUS = "KELUAR"') || upper.includes("STATUS = 'KELUAR'")) {
      const it = memoryStore.item_v2.get(params[0]);
      if (it) {
        it.status = 'keluar';
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    if (upper.includes('STATUS = "AKTIF", BOX_ID = ?, KONDISI = ?, CATATAN_KONDISI = ? WHERE ID = ?') || upper.includes("STATUS = 'AKTIF', BOX_ID = ?, KONDISI = ?, CATATAN_KONDISI = ? WHERE ID = ?")) {
      const it = memoryStore.item_v2.get(params[3]);
      if (it) {
        it.status = 'aktif';
        it.box_id = params[0];
        it.kondisi = params[1];
        it.catatan_kondisi = params[2];
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    if (upper.includes('STATUS = "AKTIF", BOX_ID = ? WHERE ID = ?') || upper.includes("STATUS = 'AKTIF', BOX_ID = ? WHERE ID = ?")) {
      const it = memoryStore.item_v2.get(params[1]);
      if (it) {
        it.status = 'aktif';
        it.box_id = params[0];
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
    if (upper.includes('WHERE UPPER(I.KODE_ID) = UPPER(?)')) {
      const target = String(params[0]).toUpperCase();
      const match = Array.from(memoryStore.item_v2.values()).find(i => i.kode_id.toUpperCase() === target);
      if (!match) return [];
      const b = memoryStore.box.get(match.box_id);
      const t = memoryStore.tipe.get(match.tipe_id);
      const p = t ? memoryStore.produk.get(t.produk_id) : null;
      return [{
        ...match,
        kode_box: b ? b.kode : '',
        nama_tipe: t ? t.nama_tipe : '',
        nama_produk: p ? p.nama : ''
      }];
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
    return [{ total, rusak, baru, baik, perlu_perbaikan, count }];
  }

  if (upper.startsWith('SELECT') && upper.includes('FROM ITEM')) {
    if (params.length > 0) {
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
    return sj ? [{ ...sj }] : [];
  }

  if (upper.startsWith('UPDATE STOK_JUMLAH SET JUMLAH = JUMLAH - ? WHERE TIPE_ID = ? AND BOX_ID = ?')) {
    const key = `${params[1]}_${params[2]}`;
    const sj = memoryStore.stok_jumlah.get(key);
    if (sj) {
      sj.jumlah = Math.max(0, sj.jumlah - Number(params[0]));
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('UPDATE STOK_JUMLAH SET JUMLAH = JUMLAH + ? WHERE TIPE_ID = ? AND BOX_ID = ?')) {
    const key = `${params[1]}_${params[2]}`;
    const sj = memoryStore.stok_jumlah.get(key);
    if (sj) {
      sj.jumlah += Number(params[0]);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('INSERT INTO STOK_JUMLAH')) {
    const key = `${params[0]}_${params[1]}`;
    memoryStore.stok_jumlah.set(key, {
      tipe_id: parseInt(String(params[0]), 10),
      box_id: params[1],
      jumlah: Number(params[2])
    });
    return { affectedRows: 1 };
  }

  if (upper.includes('FROM STOK_JUMLAH') && (upper.includes('SUM(') || upper.includes('COALESCE'))) {
    const tipeId = parseInt(String(params[0]), 10);
    const total = Array.from(memoryStore.stok_jumlah.values())
      .filter(s => s.tipe_id === tipeId)
      .reduce((acc, c) => acc + (c.jumlah || 0), 0);
    return [{ total }];
  }

  if (upper.includes('FROM STOK_JUMLAH') && upper.includes('WHERE TIPE_ID = ?') && upper.includes('JUMLAH > 0')) {
    const tipeId = parseInt(String(params[0]), 10);
    const list = Array.from(memoryStore.stok_jumlah.values()).filter(s => s.tipe_id === tipeId && s.jumlah > 0);
    return list.map(s => {
      const b = memoryStore.box.get(s.box_id);
      return {
        ...s,
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
        nama_tipe: t ? t.nama_tipe : '',
        nama_produk: p ? p.nama : '',
        jenis_nama: j ? j.nama : ''
      };
    });
    enriched.sort((a, b) => a.nama_produk.localeCompare(b.nama_produk) || a.nama_tipe.localeCompare(b.nama_tipe));
    return enriched;
  }

  // REQUEST (Tahap 6)
  if (upper.startsWith('INSERT INTO REQUEST')) {
    const req = {
      id: params[0],
      pemohon_id: params[1],
      penyetuju_id: null,
      tipe_id: parseInt(String(params[2]), 10),
      box_id: params[3] || null,
      kode_id: params[4] || null,
      jumlah: parseInt(String(params[5]), 10) || 1,
      alasan: params[6],
      catatan_penolakan: null,
      status: 'menunggu',
      dibuat_pada: new Date().toISOString(),
      diproses_pada: null
    };
    memoryStore.request.set(req.id, req);
    return { affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE REQUEST')) {
    if (upper.includes("STATUS = 'DISETUJUI'")) {
      const req = memoryStore.request.get(params[1]);
      if (req && req.status === 'menunggu') {
        req.status = 'disetujui';
        req.penyetuju_id = params[0];
        req.diproses_pada = new Date().toISOString();
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
    if (upper.includes("STATUS = 'DITOLAK'")) {
      const req = memoryStore.request.get(params[2]);
      if (req && req.status === 'menunggu') {
        req.status = 'ditolak';
        req.penyetuju_id = params[0];
        req.catatan_penolakan = params[1];
        req.diproses_pada = new Date().toISOString();
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }
  }

  if (upper.includes('FROM REQUEST R')) {
    let list = Array.from(memoryStore.request.values());

    if (upper.includes('WHERE R.ID = ?')) {
      const req = memoryStore.request.get(params[0]);
      if (!req) return [];
      list = [req];
    }

    if (upper.includes('R.PEMOHON_ID = ?')) {
      const pId = params[0];
      list = list.filter(r => r.pemohon_id === pId);
    }

    if (upper.includes('R.STATUS = ?')) {
      const stIdx = upper.includes('R.PEMOHON_ID = ?') ? 1 : 0;
      const st = params[stIdx];
      list = list.filter(r => r.status === st);
    }

    const enriched = list.map(r => {
      const u1 = memoryStore.users.get(r.pemohon_id);
      const u2 = r.penyetuju_id ? memoryStore.users.get(r.penyetuju_id) : null;
      const t = memoryStore.tipe.get(r.tipe_id);
      const p = t ? memoryStore.produk.get(t.produk_id) : null;
      const b = r.box_id ? memoryStore.box.get(r.box_id) : null;
      return {
        ...r,
        nama_pemohon: u1 ? u1.name : '',
        username_pemohon: u1 ? u1.username : '',
        nama_penyetuju: u2 ? u2.name : '',
        username_penyetuju: u2 ? u2.username : '',
        nama_tipe: t ? t.nama_tipe : '',
        nama_produk: p ? p.nama : '',
        kode_box: b ? b.kode : ''
      };
    });

    enriched.sort((a, b) => new Date(b.dibuat_pada).getTime() - new Date(a.dibuat_pada).getTime());
    return enriched;
  }

  return undefined;
}
