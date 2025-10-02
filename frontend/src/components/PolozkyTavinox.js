import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/App.css';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 500];

function number(n) {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
}
function fmt(n) {
  return number(n).toLocaleString('cs-CZ');
}

export default function ItemsTavinoxList() {
  const api = process.env.REACT_APP_API_URL;

  // data
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // vyhledávání / filtry / řazení / stránkování
  const [search, setSearch] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // nové přepínače volání BE
  const [incAxByLoc, setIncAxByLoc] = useState(true);        // includeStockByLocation
  const [incWmsSlots, setIncWmsSlots] = useState(false);      // includeWarehouse
  const [incCartons,  setIncCartons]  = useState(false);      // includeCartons

  // nové filtry nad výsledky
  const [onlyWithWms, setOnlyWithWms] = useState(false);      // jen položky s WMS > 0
  const [onlyMismatch, setOnlyMismatch] = useState(false);    // jen rozdíly AX vs WMS

  const [sortKey, setSortKey] = useState('ItemId');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [expanded, setExpanded] = useState(() => new Set());

  // načtení
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (incAxByLoc) params.set('includeStockByLocation', '1');
        if (incWmsSlots) params.set('includeWarehouse', '1');
        if (incCartons)  params.set('includeCartons', '1');

        const url = `${api}/items-tavinox${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await axios.get(url);
        if (cancelled) return;

        const normalized = (res.data || []).map((r) => {
          const totalPhys = number(r.TotalPhysicalInvent);
          const totalRes  = number(r.TotalReservPhysical);
          const available = totalPhys - totalRes;

          // WMS součet jednotek (pokud dorazil WarehouseSlots)
          const wmsUnits = Array.isArray(r.WarehouseSlots)
            ? r.WarehouseSlots.reduce((s, x) => s + number(x.units), 0)
            : 0;

          // Δ = AX fyzicky − WMS (jednotky)
          const deltaUnits = totalPhys - wmsUnits;

          return {
            ...r,
            TotalPhysicalInvent: totalPhys,
            TotalReservPhysical: totalRes,
            Available: available,
            WMSUnits: wmsUnits,
            DeltaUnits: deltaUnits,
            StockByLocation: Array.isArray(r.StockByLocation) ? r.StockByLocation : [],
            WarehouseSlots: Array.isArray(r.WarehouseSlots) ? r.WarehouseSlots : [],
            WarehouseCartons: Array.isArray(r.WarehouseCartons) ? r.WarehouseCartons : [],
          };
        });

        setItems(normalized);
        setPage(1); // reset stránek při změně režimu
      } catch (e) {
        console.error('Error loading items-tavinox:', e);
        setError('Nepodařilo se načíst data. Zkuste to prosím znovu.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [api, incAxByLoc, incWmsSlots, incCartons]);

  // filtrování (fulltext + dostupnost + WMS presence + mismatch)
  const filtered = useMemo(() => {
    const s = (search || '').trim().toLowerCase();

    return items.filter((it) => {
      if (onlyAvailable && number(it.Available) <= 0) return false;
      if (onlyWithWms && number(it.WMSUnits) <= 0) return false;
      if (onlyMismatch && number(it.DeltaUnits) === 0) return false;

      if (!s) return true;
      const hay = [
        it.ItemId,
        it.ItsItemName2,        // kód2
        it.ItemName,
        it.ItsJoinedItemName,
        it.ItsProducerCode,
        it.ItsAssortmentCode,
        it.ItsItemEAN,
      ].map((v) => String(v ?? '').toLowerCase()).join(' | ');
      return hay.includes(s);
    });
  }, [items, search, onlyAvailable, onlyWithWms, onlyMismatch]);

  // řazení
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const A = a[sortKey];
      const B = b[sortKey];
      const na = number(A);
      const nb = number(B);
      let cmp;
      if (typeof A === 'number' || typeof B === 'number' || (!isNaN(na) && !isNaN(nb))) {
        cmp = na - nb;
      } else {
        cmp = String(A ?? '').localeCompare(String(B ?? ''), 'cs');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // stránkování
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const pageRows = useMemo(() => {
    const start = (pageClamped - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, pageClamped, pageSize]);

  // UI helpers
  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function expandAll() {
    setExpanded(new Set(pageRows.map((x) => x.ItemId)));
  }
  function collapseAll() {
    setExpanded(new Set());
  }
  function onSort(k) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  }
  function onChangePageSize(e) {
    const val = Number(e.target.value);
    setPageSize(val);
    setPage(1);
  }

  if (loading) return (
    <div className="container mt-5">
      <div className="alert alert-info">Načítám Tavinox položky…</div>
    </div>
  );
  if (error) return (
    <div className="container mt-5">
      <div className="alert alert-danger">{error}</div>
    </div>
  );

  return (
    <div className="container mt-5">
      <div className="card shadow-sm">
        <div className="card-header d-flex flex-wrap align-items-center gap-2">
          <h4 className="mb-0">Seznam zboží (Tavinox)</h4>

          {/* Fulltext + dostupnost */}
          <div className="ms-auto d-flex flex-wrap gap-2">
            <input
              className="form-control"
              placeholder="Hledat: kód, kód2, název, EAN…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ minWidth: 280 }}
            />

            <div className="form-check align-self-center">
              <input
                className="form-check-input"
                type="checkbox"
                id="onlyAvailable"
                checked={onlyAvailable}
                onChange={(e) => { setOnlyAvailable(e.target.checked); setPage(1); }}
              />
              <label className="form-check-label" htmlFor="onlyAvailable">
                Jen dostupné (&gt; 0)
              </label>
            </div>
          </div>
        </div>

        {/* Přepínače režimů volání + filtry mismatch/WMS */}
        <div className="card-body border-bottom">
          <div className="d-flex flex-wrap gap-3 align-items-center">
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="incAxByLoc"
                checked={incAxByLoc}
                onChange={(e) => setIncAxByLoc(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="incAxByLoc">
                AX sklady (includeStockByLocation)
              </label>
            </div>

            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="incWmsSlots"
                checked={incWmsSlots}
                onChange={(e) => setIncWmsSlots(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="incWmsSlots">
                WMS sloty (includeWarehouse)
              </label>
            </div>

            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="incCartons"
                checked={incCartons}
                onChange={(e) => setIncCartons(e.target.checked)}
                disabled={!incWmsSlots}
              />
              <label className="form-check-label" htmlFor="incCartons" title="Rozpad na jednotlivé krabice (Measurements)">
                Krabice (detail)
              </label>
            </div>

            <div className="vr" />

            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="onlyWithWms"
                checked={onlyWithWms}
                onChange={(e) => { setOnlyWithWms(e.target.checked); setPage(1); }}
                disabled={!incWmsSlots}
              />
              <label className="form-check-label" htmlFor="onlyWithWms">
                Jen s WMS (&gt; 0)
              </label>
            </div>

            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="onlyMismatch"
                checked={onlyMismatch}
                onChange={(e) => { setOnlyMismatch(e.target.checked); setPage(1); }}
                disabled={!incWmsSlots}
              />
              <label className="form-check-label" htmlFor="onlyMismatch">
                Jen rozdíly AX vs WMS
              </label>
            </div>

            <div className="ms-auto d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary" onClick={expandAll}>Rozbalit stránku</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={collapseAll}>Sbalit stránku</button>
            </div>
          </div>

          {/* Legenda */}
          {incWmsSlots && (
            <div className="mt-2 small text-muted">
              <span className="me-3"><strong>WMS</strong> = součet jednotek z WarehouseSlots</span>
              <span className="me-3"><strong>Δ</strong> = AX fyzicky − WMS</span>
              <span className="badge bg-danger">řádek = rozdíl</span>
            </div>
          )}
        </div>

        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: 48 }}></th>
                <th role="button" onClick={() => onSort('ItemId')}>Kód</th>
                <th role="button" onClick={() => onSort('ItsItemName2')}>Kód2</th>
                <th role="button" onClick={() => onSort('ItemName')}>Název</th>
                <th role="button" onClick={() => onSort('SalesPrice')}>Cena/ks</th>
                <th role="button" onClick={() => onSort('TotalPhysicalInvent')}>AX fyz.</th>
                <th role="button" onClick={() => onSort('TotalReservPhysical')}>AX rez.</th>
                <th role="button" onClick={() => onSort('Available')}>AX dostupné</th>
                {incWmsSlots && (
                  <>
                    <th role="button" onClick={() => onSort('WMSUnits')}>WMS (jedn.)</th>
                    <th role="button" onClick={() => onSort('DeltaUnits')}>Δ (AX−WMS)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((it) => {
                const isOpen = expanded.has(it.ItemId);
                const hasMismatch = incWmsSlots && number(it.DeltaUnits) !== 0;
                const rowClass = hasMismatch ? 'table-danger' : (it.Available > 0 ? '' : 'table-warning');

                return (
                  <React.Fragment key={it.ItemId}>
                    <tr className={rowClass}>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => toggleExpand(it.ItemId)}
                          title={isOpen ? 'Skrýt detail' : 'Zobrazit detail'}
                        >
                          {isOpen ? '−' : '+'}
                        </button>
                      </td>
                      <td><code>{it.ItemId}</code></td>
                      <td><code>{it.ItsItemName2 || '-'}</code></td>
                      <td>{it.ItemName || it.ItsJoinedItemName || '-'}</td>
                      <td>{fmt(it.SalesPrice)}</td>
                      <td>{fmt(it.TotalPhysicalInvent)}</td>
                      <td>{fmt(it.TotalReservPhysical)}</td>
                      <td><strong>{fmt(it.Available)}</strong></td>
                      {incWmsSlots && (
                        <>
                          <td>{fmt(it.WMSUnits)}</td>
                          <td className={number(it.DeltaUnits) !== 0 ? 'fw-bold text-danger' : ''}>
                            {fmt(it.DeltaUnits)}
                          </td>
                        </>
                      )}
                    </tr>

                    {isOpen && (
                      <tr>
                        <td></td>
                        <td colSpan={incWmsSlots ? 9 : 7} className="bg-light">
                          <div className="p-2 d-flex flex-column gap-3">

                            {/* AX rozpad po skladech */}
                            {incAxByLoc && (
                              <div>
                                <div className="fw-semibold mb-2">AX – rozpad po skladech</div>
                                {it.StockByLocation && it.StockByLocation.length > 0 ? (
                                  <div className="table-responsive">
                                    <table className="table table-sm mb-0">
                                      <thead>
                                        <tr>
                                          <th>Sklad (InventLocationId)</th>
                                          <th>Fyzicky</th>
                                          <th>Rezerv.</th>
                                          <th>Dostupné</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {it.StockByLocation.map((loc, idx) => {
                                          const ph = number(loc.PhysicalInvent);
                                          const rv = number(loc.ReservPhysical);
                                          const av = ph - rv;
                                          return (
                                            <tr key={`${it.ItemId}-${idx}-${loc.InventLocationId}`}>
                                              <td><code>{loc.InventLocationId}</code></td>
                                              <td>{fmt(ph)}</td>
                                              <td>{fmt(rv)}</td>
                                              <td><strong>{fmt(av)}</strong></td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="text-muted">Žádná data o skladech.</div>
                                )}
                              </div>
                            )}

                            {/* WMS sloty */}
                            {incWmsSlots && (
                              <div>
                                <div className="fw-semibold mb-2">WMS – sloty (jednotky)</div>
                                {it.WarehouseSlots && it.WarehouseSlots.length > 0 ? (
                                  <div className="table-responsive">
                                    <table className="table table-sm mb-0">
                                      <thead>
                                        <tr>
                                          <th>Slot</th>
                                          <th>Jednotek (po odečtu Issue)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {it.WarehouseSlots.map((s, idx) => (
                                          <tr key={`${it.ItemId}-slot-${idx}-${s.slot_id}`}>
                                            <td><code>{s.slot_name || s.slot_id}</code></td>
                                            <td>{fmt(s.units)}</td>
                                          </tr>
                                        ))}
                                        <tr className="table-light">
                                          <td className="text-end"><strong>Součet (WMS):</strong></td>
                                          <td><strong>{fmt(it.WMSUnits)}</strong></td>
                                        </tr>
                                        <tr className={number(it.DeltaUnits) !== 0 ? 'table-danger' : 'table-success'}>
                                          <td className="text-end"><strong>Δ (AX − WMS):</strong></td>
                                          <td><strong>{fmt(it.DeltaUnits)}</strong></td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="text-muted">Tento produkt není v žádném slotu WMS.</div>
                                )}
                              </div>
                            )}

                            {/* Krabice – rozpad (Measurements) */}
                            {incWmsSlots && incCartons && (
                              <div>
                                <div className="fw-semibold mb-2">WMS – rozpad krabic (Measurements)</div>
                                {it.WarehouseCartons && it.WarehouseCartons.length > 0 ? (
                                  <div className="table-responsive">
                                    <table className="table table-sm mb-0">
                                      <thead>
                                        <tr>
                                          <th>Measurement ID</th>
                                          <th>Slot</th>
                                          <th>Vloženo (ks)</th>
                                          <th>Vydáno (ks)</th>
                                          <th>Zbývá (ks)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {it.WarehouseCartons.map((c, idx) => (
                                          <tr key={`${it.ItemId}-ctn-${idx}-${c.measurement_id}`}>
                                            <td><code>{c.measurement_id}</code></td>
                                            <td><code>{c.slot_name || c.slot_id}</code></td>
                                            <td>{fmt(c.qty_units_in)}</td>
                                            <td>{fmt(c.issued_units)}</td>
                                            <td><strong>{fmt(c.units_remaining)}</strong></td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="text-muted">Bez detailních krabic (zapni „Krabice (detail)“).</div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={incWmsSlots ? 10 : 8} className="text-center p-4 text-muted">
                    Nic nenalezeno.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card-footer d-flex flex-wrap align-items-center gap-3">
          <div className="me-auto">
            Zobrazeno {pageRows.length} z {sorted.length} záznamů (celkem {items.length})
          </div>

          <div className="d-flex align-items-center gap-2">
            <label htmlFor="pageSize" className="mb-0">Na stránku:</label>
            <select
              id="pageSize"
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={pageSize}
              onChange={onChangePageSize}
            >
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <nav>
            <ul className="pagination mb-0">
              <li className={`page-item ${pageClamped <= 1 ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => setPage(1)}>&laquo;</button>
              </li>
              <li className={`page-item ${pageClamped <= 1 ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Předchozí
                </button>
              </li>
              <li className="page-item disabled">
                <span className="page-link">{pageClamped} / {totalPages}</span>
              </li>
              <li className={`page-item ${pageClamped >= totalPages ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Další
                </button>
              </li>
              <li className={`page-item ${pageClamped >= totalPages ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => setPage(totalPages)}>&raquo;</button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
