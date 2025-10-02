import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Button,
  Grid,
  TextField
} from '@mui/material';

// -------- Helpers: safe date parsing & formatting --------
function parseDateSafe(value) {
  if (!value) return null;
  if (value === '0000-00-00' || value === '0000-00-00 00:00:00') return null;

  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;

    const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      const [, dd, mm, yyyy, HH = '00', MM = '00', SS = '00'] = m;
      const d = new Date(`${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`);
      return isNaN(d.getTime()) ? null : d;
    }

    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(s)) {
      const d = new Date(s.replace(' ', 'T'));
      return isNaN(d.getTime()) ? null : d;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(`${s}T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function formatDateYMD(date) {
  if (!date) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function NP_OrderList() {
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [filterDodaciList, setFilterDodaciList] = useState('');

  // --- Import UI state ---
  const [importDodaciList, setImportDodaciList] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputId = 'np-import-xls-input';

  useEffect(() => {
    fetchPackingHeaders();
  }, []);

  const fetchPackingHeaders = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`${process.env.REACT_APP_API_URL}/np/list`);

      const withParsed = (Array.isArray(data) ? data : []).map((row) => {
        const parsedDate = parseDateSafe(row.datum);
        return { ...row, _parsedDate: parsedDate };
      });

      withParsed.sort((a, b) => {
        const ta = a._parsedDate ? a._parsedDate.getTime() : -Infinity;
        const tb = b._parsedDate ? b._parsedDate.getTime() : -Infinity;
        return tb - ta;
      });

      setHeaders(withParsed);
    } catch (err) {
      console.error('❌ Chyba při načítání packing headers:', err);
      setError('Nepodařilo se načíst seznam dodacích listů.');
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (id) => {
    navigate(`/np/detail/${id}`);
  };

  const filteredHeaders = headers.filter((h) => {
    if (!filterDodaciList) return true;
    const val = (h.dodaci_list ?? '').toString().toLowerCase();
    return val.includes(filterDodaciList.toLowerCase());
  });

  // --- Import handlers ---
  const onChooseFile = (e) => {
    const f = e.target.files?.[0] || null;
    setImportFile(f);
    // pokud není vyplněno, zkus doplnit dodací list z názvu souboru (např. NCB250058)
    if (f && !importDodaciList) {
      const m = f.name.match(/(NCB\d{6})/i);
      if (m) setImportDodaciList(m[1].toUpperCase());
    }
  };

  const doImport = async () => {
    if (!importDodaciList) {
      setError('Vyplň dodací list pro import.');
      return;
    }
    if (!importFile) {
      setError('Vyber XLS/XLSX soubor k importu.');
      return;
    }

    setError('');
    setImporting(true);
    try {
      const form = new FormData();
      form.append('dodaci_list', importDodaciList);
      form.append('file', importFile);

      await axios.post(
        `${process.env.REACT_APP_API_URL}/import-packing-list`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      // po importu obnov seznam
      await fetchPackingHeaders();

      // reset file inputu
      setImportFile(null);
      const inputEl = document.getElementById(fileInputId);
      if (inputEl) inputEl.value = '';
    } catch (err) {
      console.error('❌ Chyba při importu:', err);
      setError(
        err?.response?.data?.message ||
        'Import se nepodařil. Zkontroluj formát souboru a názvy sloupců.'
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Seznam dodacích listů
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                label="Filtrovat dle dodacího listu"
                fullWidth
                value={filterDodaciList}
                onChange={(e) => setFilterDodaciList(e.target.value)}
                placeholder="NCB250023"
              />
            </Grid>

            {/* --- Import sekce --- */}
            <Grid item xs={12} sm={3}>
              <TextField
                label="Dodací list (pro import)"
                fullWidth
                value={importDodaciList}
                onChange={(e) => setImportDodaciList(e.target.value.toUpperCase())}
                placeholder="NCB250058"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <input
                id={fileInputId}
                type="file"
                accept=".xls,.xlsx"
                onChange={onChooseFile}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                onClick={() => document.getElementById(fileInputId)?.click()}
                disabled={importing}
                sx={{ mr: 1 }}
              >
                Vybrat XLS/XLSX
              </Button>
              <Typography variant="body2" component="span">
                {importFile ? importFile.name : 'Soubor nevybrán'}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                variant="contained"
                onClick={doImport}
                disabled={importing}
                fullWidth
              >
                {importing ? 'Importuji…' : 'IMPORTOVAT NP Z XLS'}
              </Button>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Button
                variant="contained"
                onClick={fetchPackingHeaders}
                disabled={loading}
              >
                {loading ? 'Načítám...' : 'Aktualizovat'}
              </Button>
            </Grid>
          </Grid>

          {error && (
            <Typography color="error" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>NP číslo</TableCell>
              <TableCell>Dodací list</TableCell>
              <TableCell>Datum</TableCell>
              <TableCell>Dodavatel</TableCell>
              <TableCell>Adresa dodavatele</TableCell>
              <TableCell align="center">Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredHeaders.map((h) => {
              const formattedDate = formatDateYMD(h._parsedDate);
              return (
                <TableRow
                  key={h.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(h.id)}
                >
                  <TableCell>{h.id}</TableCell>
                  <TableCell>{h.np_number || '-'}</TableCell>
                  <TableCell>{h.dodaci_list || '-'}</TableCell>
                  <TableCell>{formattedDate || '-'}</TableCell>
                  <TableCell>{h.supplier_name || '-'}</TableCell>
                  <TableCell>{h.supplier_address || '-'}</TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(h.id);
                      }}
                    >
                      Detail
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredHeaders.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  Žádné záznamy k zobrazení
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}

export default NP_OrderList;
