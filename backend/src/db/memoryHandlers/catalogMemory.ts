/**
 * Memory Query Handler: Catalog v2 Tables
 * (jenis, atribut, atribut_opsi, produk, tipe, tipe_nilai)
 */

import { memoryStore } from '../memoryStore';

export function handleCatalogMemoryQuery(_cleanSql: string, upper: string, params: any[]): any {
  // JENIS
  if (upper.startsWith('INSERT INTO JENIS')) {
    const nextId = memoryStore.jenis.size + 1;
    const j = {
      id: nextId,
      nama: params[0],
      sumber_id_bawaan: params[1] || 'manual',
      prefix_id_bawaan: params[2] || null,
      aktif: 1,
      dibuat_pada: new Date().toISOString()
    };
    memoryStore.jenis.set(nextId, j);
    return { insertId: nextId, id: nextId, affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE JENIS SET NAMA =')) {
    const id = parseInt(String(params[3]), 10);
    const j = memoryStore.jenis.get(id);
    if (j) {
      j.nama = params[0];
      j.sumber_id_bawaan = params[1] || 'manual';
      j.prefix_id_bawaan = params[2] || null;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('UPDATE JENIS SET AKTIF = 0 WHERE ID = ?')) {
    const id = parseInt(String(params[0]), 10);
    const j = memoryStore.jenis.get(id);
    if (j) {
      j.aktif = 0;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('SELECT J.*') && upper.includes('FROM JENIS J')) {
    const list = Array.from(memoryStore.jenis.values())
      .filter(j => j.aktif === 1 || j.aktif === true)
      .map(j => {
        const prodCount = Array.from(memoryStore.produk.values()).filter(p => p.jenis_id === j.id && (p.aktif === 1 || p.aktif === true)).length;
        return { ...j, total_produk: prodCount };
      });
    list.sort((a, b) => a.nama.localeCompare(b.nama));
    return list;
  }

  if (upper.startsWith('SELECT * FROM JENIS WHERE ID = ?')) {
    const id = parseInt(String(params[0]), 10);
    const j = memoryStore.jenis.get(id);
    return j ? [{ ...j }] : [];
  }

  if (upper.includes('FROM JENIS') && upper.includes('LOWER(NAMA) = LOWER(?)')) {
    const targetName = String(params[0] || '').toLowerCase().trim();
    const match = Array.from(memoryStore.jenis.values()).find(j => j.nama.toLowerCase().trim() === targetName);
    return match ? [{ id: match.id, nama: match.nama }] : [];
  }

  // ATRIBUT & ATRIBUT_OPSI
  if (upper.startsWith('INSERT INTO ATRIBUT (')) {
    const nextId = memoryStore.atribut.size + 1;
    const a = {
      id: nextId,
      jenis_id: parseInt(String(params[0]), 10),
      kode: params[1],
      nama: params[2],
      tipe_isian: params[3],
      satuan: params[4] || null,
      wajib: params[5] === 1 || params[5] === true ? 1 : 0,
      urutan: params[6] || 0,
      masuk_nama: params[7] === 1 || params[7] === true ? 1 : 0,
      dibuat_pada: new Date().toISOString()
    };
    memoryStore.atribut.set(nextId, a);
    return { insertId: nextId, id: nextId, affectedRows: 1 };
  }

  if (upper.startsWith('SELECT * FROM ATRIBUT WHERE JENIS_ID = ?')) {
    const jenisId = parseInt(String(params[0]), 10);
    const list = Array.from(memoryStore.atribut.values()).filter(a => a.jenis_id === jenisId);
    list.sort((a, b) => a.urutan - b.urutan || a.id - b.id);
    return list.map(item => ({ ...item }));
  }

  if (upper.startsWith('INSERT INTO ATRIBUT_OPSI')) {
    const nextId = memoryStore.atribut_opsi.size + 1;
    const ao = {
      id: nextId,
      atribut_id: parseInt(String(params[0]), 10),
      nilai: params[1],
      urutan: params[2] || 0
    };
    memoryStore.atribut_opsi.set(nextId, ao);
    return { insertId: nextId, id: nextId, affectedRows: 1 };
  }

  if (upper.startsWith('SELECT * FROM ATRIBUT_OPSI WHERE ATRIBUT_ID = ?')) {
    const atributId = parseInt(String(params[0]), 10);
    if (upper.includes('LOWER(NILAI) = LOWER(?)')) {
      const target = String(params[1]).toLowerCase();
      const match = Array.from(memoryStore.atribut_opsi.values())
        .filter(o => o.atribut_id === atributId && o.nilai.toLowerCase() === target);
      return match.map(m => ({ ...m }));
    }
    const list = Array.from(memoryStore.atribut_opsi.values()).filter(o => o.atribut_id === atributId);
    list.sort((a, b) => a.urutan - b.urutan || a.id - b.id);
    return list.map(item => ({ ...item }));
  }

  // PRODUK
  if (upper.startsWith('INSERT INTO PRODUK (')) {
    const nextId = memoryStore.produk.size + 1;
    const p = upper.includes('KATEGORI_BARANG') || params.length >= 7
      ? {
          id: nextId,
          jenis_id: parseInt(String(params[0]), 10),
          nama: params[1],
          kategori: params[2] || 'fast_moving',
          kategori_barang: params[3] || 'Barang Habis Pakai',
          tipe_stok: params[4] || 'unit',
          catatan: params[5] || null,
          aktif: 1,
          dibuat_oleh: params[6] || null,
          dibuat_pada: new Date().toISOString()
        }
      : {
          id: nextId,
          jenis_id: parseInt(String(params[0]), 10),
          nama: params[1],
          kategori: params[2] || 'fast_moving',
          kategori_barang: 'Barang Habis Pakai',
          tipe_stok: 'unit',
          catatan: params[3] || null,
          aktif: 1,
          dibuat_oleh: params[4] || null,
          dibuat_pada: new Date().toISOString()
        };
    memoryStore.produk.set(nextId, p);
    return { insertId: nextId, id: nextId, affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE PRODUK SET NAMA =')) {
    const id = parseInt(String(params[params.length - 1]), 10);
    const p = memoryStore.produk.get(id);
    if (p) {
      p.nama = params[0];
      p.kategori = params[1];
      if (params.length >= 6) {
        p.kategori_barang = params[2] || 'Barang Habis Pakai';
        p.tipe_stok = params[3] || 'unit';
        p.catatan = params[4] || null;
      } else {
        p.catatan = params[2] || null;
      }
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.startsWith('UPDATE PRODUK SET AKTIF = 0 WHERE ID = ?')) {
    const id = parseInt(String(params[0]), 10);
    const p = memoryStore.produk.get(id);
    if (p) {
      p.aktif = 0;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.includes('FROM PRODUK P') && upper.includes('WHERE P.ID = ?')) {
    const id = parseInt(String(params[0]), 10);
    const p = memoryStore.produk.get(id);
    if (!p) return [];
    const j = memoryStore.jenis.get(p.jenis_id);
    return [{ ...p, jenis_nama: j ? j.nama : '', kategori_barang: p.kategori_barang || 'Barang Habis Pakai', tipe_stok: p.tipe_stok || 'unit' }];
  }

  if (upper.includes('SELECT ID FROM PRODUK WHERE JENIS_ID = ? AND AKTIF = 1')) {
    const jenisId = parseInt(String(params[0]), 10);
    const prods = Array.from(memoryStore.produk.values())
      .filter(p => p.jenis_id === jenisId && (p.aktif === 1 || p.aktif === true));
    return prods.map(p => ({ id: p.id }));
  }

  if (upper.includes('SELECT DISTINCT TIPE_STOK FROM PRODUK')) {
    const set = new Set<string>();
    for (const p of memoryStore.produk.values()) {
      if (p.tipe_stok) set.add(p.tipe_stok.toLowerCase().trim());
    }
    return Array.from(set).map(tipe_stok => ({ tipe_stok }));
  }

  if (upper.startsWith('SELECT P.*') && upper.includes('FROM PRODUK P')) {
    let list = Array.from(memoryStore.produk.values()).filter(p => p.aktif === 1 || p.aktif === true);

    let paramIdx = 0;
    if (upper.includes('AND P.JENIS_ID = ?')) {
      const jId = parseInt(String(params[paramIdx++]), 10);
      list = list.filter(p => p.jenis_id === jId);
    }
    if (upper.includes('AND P.KATEGORI = ?')) {
      const kat = String(params[paramIdx++]);
      list = list.filter(p => p.kategori === kat);
    }
    if (upper.includes('P.KATEGORI_BARANG = ?')) {
      const katBarang = String(params[paramIdx++]);
      paramIdx++; // skip duplicate bound param
      list = list.filter(p => (p.kategori_barang || 'Barang Habis Pakai') === katBarang);
    }
    if (upper.includes('AND (LOWER(P.NAMA) LIKE ? OR LOWER(J.NAMA) LIKE ?)')) {
      const query = String(params[paramIdx]).replace(/%/g, '').toLowerCase();
      list = list.filter(p => {
        const j = memoryStore.jenis.get(p.jenis_id);
        const jName = j ? j.nama.toLowerCase() : '';
        return p.nama.toLowerCase().includes(query) || jName.includes(query);
      });
    }

    const mapped = list.map(p => {
      const j = memoryStore.jenis.get(p.jenis_id);
      const totalTipe = Array.from(memoryStore.tipe.values())
        .filter(t => t.produk_id === p.id && (t.aktif === 1 || t.aktif === true)).length;
      return {
        ...p,
        jenis_nama: j ? j.nama : '',
        kategori_barang: p.kategori_barang || 'Barang Habis Pakai',
        tipe_stok: p.tipe_stok || 'unit',
        total_tipe: totalTipe
      };
    });
    mapped.sort((a, b) => a.nama.localeCompare(b.nama));
    return mapped;
  }

  if (upper.includes('FROM PRODUK') && upper.includes('LOWER(NAMA) = LOWER(?)')) {
    const targetName = String(params[0] || '').toLowerCase().trim();
    const jId = params[1] ? parseInt(String(params[1]), 10) : null;
    const match = Array.from(memoryStore.produk.values()).find(p => {
      const nameMatch = p.nama.toLowerCase().trim() === targetName;
      return jId ? (nameMatch && p.jenis_id === jId) : nameMatch;
    });
    return match ? [{ id: match.id, nama: match.nama }] : [];
  }

  // TIPE
  if (upper.startsWith('INSERT INTO TIPE (')) {
    const nextId = memoryStore.tipe.size + 1;
    const t = {
      id: nextId,
      produk_id: parseInt(String(params[0]), 10),
      nama_tipe: params[1],
      catatan: params[2] || null,
      sumber_id: params[3] || 'manual',
      mode_stok: params[4] || 'per_id',
      prefix_id: params[5] || null,
      pola_id: params[6] || null,
      id_dikunci: 0,
      aktif: 1,
      dibuat_pada: new Date().toISOString()
    };
    memoryStore.tipe.set(nextId, t);
    return { insertId: nextId, id: nextId, affectedRows: 1 };
  }

  if (upper.startsWith('UPDATE TIPE SET SUMBER_ID =')) {
    const id = parseInt(String(params[params.length - 1]), 10);
    const t = memoryStore.tipe.get(id);
    if (t) {
      t.sumber_id = params[0];
      t.mode_stok = params[1];
      t.prefix_id = params[2] || null;
      t.pola_id = params[3] || null;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (upper.includes('SELECT ID FROM TIPE WHERE PRODUK_ID = ? AND NAMA_TIPE = ? AND AKTIF = 1')) {
    const prodId = parseInt(String(params[0]), 10);
    const namaTipe = String(params[1]);
    const match = Array.from(memoryStore.tipe.values())
      .filter(t => t.produk_id === prodId && t.nama_tipe === namaTipe && (t.aktif === 1 || t.aktif === true));
    return match.map(m => ({ id: m.id }));
  }

  if (upper.includes('FROM TIPE') && upper.includes('PRODUK_ID = ?') && upper.includes('LOWER(NAMA_TIPE) = LOWER(?)')) {
    const prodId = parseInt(String(params[0]), 10);
    const targetName = String(params[1] || '').toLowerCase().trim();
    const match = Array.from(memoryStore.tipe.values()).find(t => {
      const pMatch = t.produk_id === prodId;
      const nMatch = (t.nama_tipe || '').toLowerCase().trim() === targetName || (t.prefix_id || '').toLowerCase().trim() === targetName;
      return pMatch && nMatch;
    });
    return match ? [{ id: match.id }] : [];
  }

  // TIPE_NILAI
  if (upper.startsWith('INSERT INTO TIPE_NILAI')) {
    const key = `${params[0]}_${params[1]}`;
    memoryStore.tipe_nilai.set(key, {
      tipe_id: parseInt(String(params[0]), 10),
      atribut_id: parseInt(String(params[1]), 10),
      nilai_angka: params[2] !== undefined && params[2] !== null ? Number(params[2]) : null,
      opsi_id: params[3] !== undefined && params[3] !== null ? parseInt(String(params[3]), 10) : null,
      nilai_teks: params[4] || null
    });
    return { affectedRows: 1 };
  }

  if (upper.startsWith('SELECT TN.*') && upper.includes('FROM TIPE_NILAI TN')) {
    const tipeId = parseInt(String(params[0]), 10);
    const list = Array.from(memoryStore.tipe_nilai.values()).filter(tn => tn.tipe_id === tipeId);

    return list.map(tn => {
      const a = memoryStore.atribut.get(tn.atribut_id);
      const ao = tn.opsi_id ? memoryStore.atribut_opsi.get(tn.opsi_id) : null;
      return {
        tipe_id: tn.tipe_id,
        atribut_id: tn.atribut_id,
        nilai_angka: tn.nilai_angka,
        opsi_id: tn.opsi_id,
        nilai_teks: tn.nilai_teks,
        atribut_nama: a ? a.nama : '',
        tipe_isian: a ? a.tipe_isian : 'teks',
        satuan: a ? a.satuan : null,
        opsi_nilai: ao ? ao.nilai : null
      };
    });
  }

  if (upper.startsWith('SELECT') && upper.includes('FROM TIPE')) {
    if (upper.includes('WHERE T.ID = ?')) {
      const id = parseInt(String(params[0]), 10);
      const t = memoryStore.tipe.get(id);
      if (!t) return [];
      const prod = memoryStore.produk.get(t.produk_id);
      const jenis = prod ? memoryStore.jenis.get(prod.jenis_id) : null;
      return [{
        ...t,
        produk_nama: prod ? prod.nama : '',
        jenis_nama: jenis ? jenis.nama : '',
        tipe_stok: prod ? prod.tipe_stok : 'pcs'
      }];
    }

    if (upper.includes('FROM TIPE') && upper.includes('PRODUK_ID = ?') && upper.includes('AKTIF = 1')) {
      const prodId = parseInt(String(params[0]), 10);
      const list = Array.from(memoryStore.tipe.values())
        .filter(t => t.produk_id === prodId && (t.aktif === 1 || t.aktif === true));
      list.sort((a, b) => a.nama_tipe.localeCompare(b.nama_tipe));
      return list.map(t => {
        const prod = memoryStore.produk.get(t.produk_id);
        const jenis = prod ? memoryStore.jenis.get(prod.jenis_id) : null;
        return {
          ...t,
          produk_nama: prod ? prod.nama : '',
          jenis_nama: jenis ? jenis.nama : ''
        };
      });
    }
  }

  if (upper.startsWith('UPDATE TIPE SET ID_DIKUNCI = 1')) {
    const id = parseInt(String(params[0]), 10);
    const t = memoryStore.tipe.get(id);
    if (t) {
      t.id_dikunci = 1;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  return undefined;
}
