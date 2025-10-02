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

function NPOrderList() {
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterDodaciList, setFilterDodaciList] = useState('');
  const navigate = useNavigate();

  useEffect(function () {
    fetchPackingHeaders();
  }, []);

  async function fetchPackingHeaders() {
    setLoading(true);
    setError('');
    try {
      const resp = await axios.get((process.env.REACT_APP_API_URL || '') + '/np/list');
      const data = Array.isArray(resp && resp.data) ? resp.data : [];
      const sorted = data.slice().sort(function (a, b) {
        const ad = a && a.datum ? new Date(a.datum).getTime() : 0;
        const bd = b && b.datum ? new Date(b.datum).getTime() : 0;
        return bd - ad; // newest first
      });
      setHeaders(sorted);
    } catch (e) {
      console.error('❌ NPOrderList fetch error:', e);
      setError('Nepodařilo se načíst seznam dodacích listů.');
    } finally {
      setLoading(false);
    }
  }

  function handleRowClick(id) {
    navigate('/np/detail/' + id);
  }

  const filteredHeaders = headers.filter(function (h) {
    if (!filterDodaciList) return true;
    const val = h && h.dodaci_list ? String(h.dodaci_list) : '';
    return val.toLowerCase().indexOf(filterDodaciList.toLowerCase()) !== -1;
  });

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
                onChange={function (e) { setFilterDodaciList(e.target.value); }}
                placeholder="NCB250023"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                variant="contained"
                onClick={fetchPackingHeaders}
                disabled={loading}
              >
                {loading ? 'Načítám…' : 'Aktualizovat'}
              </Button>
            </Grid>
          </Grid>
          {error ? (
            <Typography color="error" sx={{ mt: 1 }}>
              {error}
            </Typography>
          ) : null}
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
            {filteredHeaders.map(function (h) {
              let formattedDate = '';
              if (h && h.datum) {
                try {
                  const d = new Date(h.datum);
                  formattedDate = d.toISOString().split('T')[0];
                } catch (_) {}
              }
              return (
                <TableRow
                  key={h.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={function () { handleRowClick(h.id); }}
                >
                  <TableCell>{h.id}</TableCell>
                  <TableCell>{h.np_number || '-'}</TableCell>
                  <TableCell>{h.dodaci_list}</TableCell>
                  <TableCell>{formattedDate}</TableCell>
                  <TableCell>{h.supplier_name || '-'}</TableCell>
                  <TableCell>{h.supplier_address || '-'}</TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={function (e) {
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
            {filteredHeaders.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  Žádné záznamy k zobrazení
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}

export default NPOrderList;
