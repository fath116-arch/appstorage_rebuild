/**
 * Batch Label Printing Modal (FieldOps Inventory v2 - Tahap 7)
 * Presisi Cetak A4: 190 x 89 mm, 2 Tabel 5x3 per Label, SVG QR Tajam, Titik Potong 195 x 94 mm
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Printer, CheckSquare, Square, Sliders, QrCode, Grid } from 'lucide-react';
import qrcode from 'qrcode-generator';

interface LabelItem {
  id: string;
  nama: string;
  p: Array<[string, string]>; // [Nama Produk, Nama Tipe]
}

interface BatchLabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultJenisId?: number;
}

export const BatchLabelPrintModal: React.FC<BatchLabelPrintModalProps> = ({
  isOpen,
  onClose,
  defaultJenisId
}) => {
  const [data, setData] = useState<LabelItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [perSheet, setPerSheet] = useState<number>(3); // 1, 2, or 3
  const [startSlot, setStartSlot] = useState<number>(1); // 1, 2, or 3
  const [showDots, setShowDots] = useState<boolean>(true);
  const [baseUrl, setBaseUrl] = useState<string>('https://fieldops.local/katalog/');
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch data dari backend
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    fetch('/api/catalog/labels')
      .then(res => res.json())
      .then(resData => {
        if (isMounted && resData.success && Array.isArray(resData.labels)) {
          setData(resData.labels);
          const initialSet = new Set<string>();
          if (defaultJenisId) {
            initialSet.add(`jenis-${defaultJenisId}`);
          } else {
            resData.labels.forEach((it: LabelItem) => initialSet.add(it.id));
          }
          setSelectedIds(initialSet);
        }
      })
      .catch(() => {
        // Fallback default sample data jika MariaDB offline
        const sampleData: LabelItem[] = [
          {
            id: 'adaptor',
            nama: 'Adaptor',
            p: [
              ['Adaptor 12V Standar', '12V / 1A'],
              ['Adaptor 12V Standar', '12V / 2A'],
              ['Adaptor 12V Standar', '12V / 3A / Jack 5.5mm'],
              ['Adaptor 5V', '5V / 2A'],
              ['Adaptor 9V', '9V / 1A'],
              ['Adaptor 24V PoE', '24V / 1A / Injector']
            ]
          },
          {
            id: 'kabel',
            nama: 'Kabel UTP LAN',
            p: [
              ['Kabel UTP LAN', 'Cat6 / 305m'],
              ['Kabel Dropcore', '1 Core / 150m'],
              ['Patchcord UTP', 'Cat6 / 1m']
            ]
          },
          {
            id: 'modem',
            nama: 'ONU FiberHome Dualband',
            p: [
              ['ONU FiberHome Dualband', 'XPON / 4Port'],
              ['Modem EPON', 'EPON / 1Port'],
              ['Router Wi-Fi', 'Dualband AC1200']
            ]
          }
        ];
        if (isMounted) {
          setData(sampleData);
          setSelectedIds(new Set(sampleData.map(d => d.id)));
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, defaultJenisId]);

  // SVG QR Code Generator (Crisp High-Res Vector SVG)
  const generateQrSvg = (text: string) => {
    try {
      const q = qrcode(0, 'M');
      q.addData(text);
      q.make();
      const count = q.getModuleCount();
      let pathD = '';

      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (q.isDark(r, c)) {
            pathD += `M${c} ${r}h1v1h-1z`;
          }
        }
      }

      return `
        <svg viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges" style="width:100%;height:100%;display:block">
          <path d="${pathD}" fill="#000" />
        </svg>
      `;
    } catch {
      return `<svg viewBox="0 0 10 10"><text x="5" y="6" text-anchor="middle" font-size="3">QR</text></svg>`;
    }
  };

  // Process label cards & pagination logic
  const ROWS_PER_TABLE = 5;
  const ITEMS_PER_LABEL = ROWS_PER_TABLE * 2; // 10 items max per card

  const labelCards = useMemo(() => {
    const list: Array<{ d: LabelItem; idx: number; totalPages: number; rows: Array<[string, string]>; offset: number }> = [];

    data.filter(d => selectedIds.has(d.id)).forEach(d => {
      const numPages = Math.max(1, Math.ceil(d.p.length / ITEMS_PER_LABEL));
      for (let i = 0; i < numPages; i++) {
        list.push({
          d,
          idx: i,
          totalPages: numPages,
          rows: d.p.slice(i * ITEMS_PER_LABEL, (i + 1) * ITEMS_PER_LABEL),
          offset: i * ITEMS_PER_LABEL
        });
      }
    });

    return list;
  }, [data, selectedIds]);

  // Paginate to A4 sheets
  const pages = useMemo(() => {
    const paginated: Array<Array<{ slot: number; label: typeof labelCards[0] }>> = [];
    let i = 0;
    let isFirstPage = true;

    while (i < labelCards.length) {
      const startIdx = isFirstPage ? startSlot - 1 : 0;
      const capacity = Math.min(3 - startIdx, perSheet);
      const slots: Array<{ slot: number; label: typeof labelCards[0] }> = [];

      for (let k = 0; k < capacity && i < labelCards.length; k++) {
        slots.push({ slot: startIdx + k, label: labelCards[i++] });
      }

      paginated.push(slots);
      isFirstPage = false;
    }

    return paginated;
  }, [labelCards, startSlot, perSheet]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map(d => d.id)));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const logoSvg = `<svg viewBox="0 0 40 40" style="width:11mm"><path d="M6 36 17 5h21l-2 7H23l-1.5 5H33l-2 7H19.500L15 36z" fill="#0a9f4a"/><path d="M6 36 17 5h6L12 36z" fill="#056d31"/></svg>`;
  const cubeSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" style="width:9.5mm"><path d="M12 2.500 20.500 7v10L12 21.500 3.500 17V7z"/><path d="M3.500 7 12 11.500 20.500 7M12 11.500v10"/></svg>`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-area { display: block !important; padding: 0 !important; width: 210mm !important; margin: 0 !important; }
          .pw { width: 210mm !important; height: auto !important; margin: 0 !important; box-shadow: none !important; break-after: page; }
          .pw:last-child { break-after: auto; }
          .page { transform: none !important; }
        }
      `}</style>

      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header Modal */}
        <div className="no-print flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white font-display">
                  Cetak Label Batch A4 Presisi
                </h2>
                <span className="font-mono text-[10px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  190 × 89 mm
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Layout 2 tabel 5×3 per label, SVG QR tajam, &amp; titik potong celah 195 × 94 mm.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={pages.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang (Ctrl+P)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-0">
          
          {/* Controls Sidebar (no-print) */}
          <div className="no-print lg:col-span-4 p-5 border-r border-slate-800 bg-slate-900/70 space-y-5 text-xs overflow-y-auto">
            
            {/* Catalog Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-extrabold text-slate-200 uppercase tracking-wider text-[11px]">
                  Pilih Katalog Barang
                </label>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-emerald-400 hover:underline text-[11px] font-semibold"
                >
                  {selectedIds.size === data.length ? 'Kosongkan' : 'Pilih Semua'}
                </button>
              </div>

              {loading ? (
                <div className="p-4 text-center text-slate-500">Memuat katalog...</div>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {data.map(item => {
                    const isChecked = selectedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          const next = new Set(selectedIds);
                          if (isChecked) next.delete(item.id);
                          else next.add(item.id);
                          setSelectedIds(next);
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 font-semibold'
                            : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                          <span className="truncate">{item.nama}</span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                          {item.p.length} varian
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Labels per sheet */}
            <div className="space-y-2">
              <label className="font-extrabold text-slate-200 uppercase tracking-wider text-[11px]">
                Jumlah Label per Lembar A4
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPerSheet(num)}
                    className={`py-2 text-center font-bold rounded-xl border transition-all ${
                      perSheet === num
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'
                    }`}
                  >
                    {num} Label
                  </button>
                ))}
              </div>
            </div>

            {/* Starting slot */}
            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-200 uppercase tracking-wider text-[11px]">
                Mulai Dari Slot A4
              </label>
              <select
                value={startSlot}
                onChange={e => setStartSlot(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value={1}>Slot 1 (Atas)</option>
                <option value={2}>Slot 2 (Tengah)</option>
                <option value={3}>Slot 3 (Bawah)</option>
              </select>
              <p className="text-[10px] text-slate-400">
                Gunakan untuk mencetak ulang di kertas A4 stiker yang sudah terpakai sebagian.
              </p>
            </div>

            {/* Cut lines toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-800/40">
              <span className="font-medium text-slate-300">Tampilkan Titik Potong Celah</span>
              <input
                type="checkbox"
                checked={showDots}
                onChange={e => setShowDots(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* QR Base URL */}
            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-200 uppercase tracking-wider text-[11px]">
                URL Alamat QR Code
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Summary */}
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 space-y-1">
              <div className="font-bold flex items-center justify-between">
                <span>Total Label Dihasilkan:</span>
                <span className="font-mono text-sm">{labelCards.length} Kartu</span>
              </div>
              <div className="text-[11px] text-emerald-400/80 flex items-center justify-between">
                <span>Total Lembar Kertas A4:</span>
                <span className="font-mono text-sm font-bold">{pages.length} Lembar</span>
              </div>
            </div>

          </div>

          {/* Print Preview Area */}
          <div className="lg:col-span-8 p-4 bg-slate-950 flex flex-col items-center justify-start overflow-auto min-h-[500px]">
            {pages.length === 0 ? (
              <div className="my-auto text-center space-y-3 p-8 text-slate-500">
                <Grid className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm font-medium">Pilih minimal 1 katalog di panel sebelah kiri untuk melihat pratinjau cetak.</p>
              </div>
            ) : (
              <div className="print-area space-y-6 w-full flex flex-col items-center">
                {pages.map((slList, pageIdx) => (
                  <div
                    key={pageIdx}
                    className="pw relative bg-white shadow-2xl border border-slate-300 rounded-sm overflow-hidden shrink-0"
                    style={{
                      width: '210mm',
                      height: '296.5mm',
                      transform: 'scale(0.85)',
                      transformOrigin: 'top center',
                      color: '#111'
                    }}
                  >
                    <div className="page relative w-full h-full bg-white text-slate-900">
                      {slList.map(({ slot, label }) => {
                        const topMm = 10 + 94 * slot;
                        const labelTitle = `${label.d.nama.toUpperCase()}${label.totalPages > 1 ? ` (${label.idx + 1}/${label.totalPages})` : ''}`;
                        const titleFontSize = label.d.nama.length <= 16 ? '22pt' : label.d.nama.length <= 24 ? '17pt' : '13pt';

                        const renderTable = (startRow: number) => {
                          const cells: React.ReactNode[] = [
                            <div key="h1" className="c h font-black bg-slate-200 border-r border-b border-slate-700 text-[6.5pt] flex items-center justify-center">NO</div>,
                            <div key="h2" className="c h font-black bg-slate-200 border-r border-b border-slate-700 text-[6.5pt] flex items-center justify-center">NAMA PRODUK</div>,
                            <div key="h3" className="c h font-black bg-slate-200 border-b border-slate-700 text-[6.5pt] flex items-center justify-center">TIPE</div>
                          ];

                          for (let r = startRow; r < startRow + ROWS_PER_TABLE; r++) {
                            const pair = label.rows[r];
                            cells.push(
                              <div key={`n-${r}`} className="c n border-r border-b border-slate-400 text-[7.5pt] flex items-center justify-center">{pair ? label.offset + r + 1 : ''}</div>,
                              <div key={`p-${r}`} className="c border-r border-b border-slate-400 text-[7.5pt] px-1 flex items-center truncate">{pair ? pair[0] : ''}</div>,
                              <div key={`t-${r}`} className="c border-b border-slate-400 text-[7.5pt] px-1 flex items-center truncate">{pair ? pair[1] : ''}</div>
                            );
                          }

                          return (
                            <div className="tb grid grid-cols-[7mm_1fr_1fr] grid-rows-[6mm_repeat(5,1fr)] border border-slate-900 rounded-lg overflow-hidden min-h-0 min-w-0">
                              {cells}
                            </div>
                          );
                        };

                        const qrSvgContent = generateQrSvg(`${baseUrl}${label.d.id}`);

                        return (
                          <div
                            key={slot}
                            className="label absolute left-[10mm] w-[190mm] h-[89mm] border-[0.5mm] border-slate-900 rounded-[6mm] p-[3.5mm_4mm] flex flex-col gap-[2.5mm] bg-white text-slate-900"
                            style={{ top: `${topMm}mm` }}
                          >
                            {/* Label Header */}
                            <div className="lh flex items-center gap-[3mm] h-[19mm] shrink-0">
                              <img 
                                src="/logo.png" 
                                alt="FieldOps IT Logo" 
                                className="w-[11mm] h-[11mm] object-contain shrink-0" 
                                style={{ width: '11mm', height: '11mm', objectFit: 'contain' }} 
                              />
                              <div className="brand flex flex-col justify-center h-[14mm] pr-[3mm] border-r-[0.4mm] border-slate-900 shrink-0">
                                <b className="text-[15pt] font-extrabold leading-none">
                                  Field<i className="not-italic text-emerald-600">Ops</i>
                                </b>
                                <small className="text-[4.6pt] tracking-widest mt-1 font-semibold text-slate-700">
                                  INVENTORY MANAGEMENT SYSTEM
                                </small>
                              </div>
                              <div className="ttl flex-1 min-w-0">
                                <h2 className="m-0 font-extrabold leading-tight whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: titleFontSize }}>
                                  {labelTitle}
                                </h2>
                                <small className="block text-[5.4pt] tracking-widest mt-1 font-semibold text-slate-700">
                                  DATA BARANG • LEBIH TERTIB • LEBIH MUDAH
                                </small>
                              </div>
                              <div className="ico w-[16mm] h-[16mm] bg-emerald-600 rounded-[3.5mm] grid place-items-center shrink-0" dangerouslySetInnerHTML={{ __html: cubeSvg }} />
                            </div>

                            {/* Label Body (2 Tables + QR Code) */}
                            <div className="lb flex-1 min-h-0 grid grid-cols-[1fr_44mm] gap-[3mm]">
                              <div className="tbs grid grid-cols-2 gap-[2mm] min-h-0 min-w-0">
                                {renderTable(0)}
                                {renderTable(5)}
                              </div>
                              <div className="qr border-l-[0.5mm] border-slate-900 pl-[3mm] flex flex-col items-center justify-center">
                                <div className="qb w-[31mm] h-[31mm] p-[2mm] border-[0.6mm] border-emerald-600 rounded-[3mm]">
                                  <div dangerouslySetInnerHTML={{ __html: qrSvgContent }} className="w-full h-full" />
                                </div>
                                <span className="text-[6pt] font-extrabold text-center mt-2 leading-tight text-slate-900">
                                  SCAN UNTUK<br />LIHAT DETAIL
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Cut line dots */}
                      {showDots && slList.map(({ slot }) => {
                        const topMm = 7.5 + 94 * slot;
                        const dots = [
                          [7.5, topMm],
                          [202.5, topMm],
                          [7.5, topMm + 94],
                          [202.5, topMm + 94]
                        ];
                        return dots.map(([x, y], dIdx) => (
                          <i
                            key={`${slot}-${dIdx}`}
                            className="dot absolute w-[1mm] h-[1mm] rounded-full bg-slate-900 -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${x}mm`, top: `${y}mm` }}
                          />
                        ));
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="no-print px-5 py-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs text-slate-400">
          <span>Skala Cetak: 100% (A4 Portrait) · Celah antar titik potong: 195 × 94 mm</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700 transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
