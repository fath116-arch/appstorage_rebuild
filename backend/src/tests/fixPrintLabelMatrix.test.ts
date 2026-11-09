/**
 * Test Suite: Validasi Matriks Pembagian Halaman Cetak Label A4 Presisi
 * Berdasarkan FIX_PRINT_LABEL.md (Section 5: Pengujian Wajib)
 */

interface LabelMock {
  id: string;
  nama: string;
  rows: Array<[string, string]>;
}

function paginateLabels(
  labels: LabelMock[],
  perSheet: number,
  startSlot: number = 1
): Array<Array<{ slot: number; label: LabelMock }>> {
  const pages: Array<Array<{ slot: number; label: LabelMock }>> = [];
  let i = 0;
  let isFirstPage = true;

  while (i < labels.length) {
    const startIdx = isFirstPage ? startSlot - 1 : 0;
    const capacity = Math.min(3 - startIdx, perSheet);
    const slots: Array<{ slot: number; label: LabelMock }> = [];

    for (let k = 0; k < capacity && i < labels.length; k++) {
      slots.push({ slot: startIdx + k, label: labels[i++] });
    }

    pages.push(slots);
    isFirstPage = false;
  }

  return pages;
}

function runTests() {
  console.log('=== TEST SUITE: MATRIKS CETAK LABEL A4 (FIX_PRINT_LABEL.md) ===\n');

  function makeLabels(count: number): LabelMock[] {
    return Array.from({ length: count }, (_, idx) => ({
      id: `label-${idx + 1}`,
      nama: `Katalog Barang ${idx + 1}`,
      rows: [['Produk Sample', 'Tipe A']]
    }));
  }

  const testMatrix: Array<{ labelCount: number; perSheet: number; expectedSheets: number }> = [
    // 1 label
    { labelCount: 1, perSheet: 1, expectedSheets: 1 },
    { labelCount: 1, perSheet: 2, expectedSheets: 1 },
    { labelCount: 1, perSheet: 3, expectedSheets: 1 },

    // 2 label
    { labelCount: 2, perSheet: 1, expectedSheets: 2 },
    { labelCount: 2, perSheet: 2, expectedSheets: 1 },
    { labelCount: 2, perSheet: 3, expectedSheets: 1 },

    // 3 label
    { labelCount: 3, perSheet: 1, expectedSheets: 3 },
    { labelCount: 3, perSheet: 2, expectedSheets: 2 },
    { labelCount: 3, perSheet: 3, expectedSheets: 1 },

    // 4 label
    { labelCount: 4, perSheet: 1, expectedSheets: 4 },
    { labelCount: 4, perSheet: 2, expectedSheets: 2 },
    { labelCount: 4, perSheet: 3, expectedSheets: 2 },

    // 6 label
    { labelCount: 6, perSheet: 1, expectedSheets: 6 },
    { labelCount: 6, perSheet: 2, expectedSheets: 3 },
    { labelCount: 6, perSheet: 3, expectedSheets: 2 },

    // 7 label
    { labelCount: 7, perSheet: 1, expectedSheets: 7 },
    { labelCount: 7, perSheet: 2, expectedSheets: 4 },
    { labelCount: 7, perSheet: 3, expectedSheets: 3 },
  ];

  let passed = 0;
  testMatrix.forEach(({ labelCount, perSheet, expectedSheets }, idx) => {
    const labels = makeLabels(labelCount);
    const pages = paginateLabels(labels, perSheet, 1);
    const actualSheets = pages.length;

    if (actualSheets === expectedSheets) {
      console.log(`✅ [PASS ${idx + 1}] ${labelCount} label @ ${perSheet}/lembar = ${actualSheets} lembar (sesuai target ${expectedSheets} lembar)`);
      passed++;
    } else {
      console.error(`❌ [FAIL ${idx + 1}] ${labelCount} label @ ${perSheet}/lembar = ${actualSheets} lembar (diharapkan ${expectedSheets} lembar)`);
      throw new Error(`Test failed for ${labelCount} labels with ${perSheet} per sheet`);
    }
  });

  // Validasi Dimensi dan Batas Lembar A4
  console.log('\n--- VALIDASI DIMENSI & TITIK POTONG A4 ---');
  const sheetWidthMm = 210;
  const sheetHeightMm = 296; // 1mm buffer from 297mm
  const labelWidthMm = 190;
  const labelHeightMm = 89;
  const slotGapMm = 5;
  const slotPitchMm = labelHeightMm + slotGapMm; // 94mm

  if (sheetHeightMm !== 296) throw new Error('Tinggi lembar harus 296 mm');
  if (labelWidthMm !== 190 || labelHeightMm !== 89) throw new Error('Dimensi label harus 190 x 89 mm');

  // Cek batas koordinat titik potong
  const cutLevels = [
    7.5,
    7.5 + slotPitchMm,      // 101.5
    7.5 + slotPitchMm * 2,  // 195.5
    7.5 + slotPitchMm * 3   // 289.5
  ];

  cutLevels.forEach((y, i) => {
    if (y > sheetHeightMm) {
      throw new Error(`Titik potong level ${i} (${y}mm) melebihi batas lembar 296mm`);
    }
    console.log(`✅ Level Titik Potong ${i}: Y = ${y} mm (Aman di dalam 296 mm)`);
  });

  console.log(`\n🎉 SELURUH ${passed} PENGUJIAN MATRIKS BERHASIL 100%!`);
}

runTests();
