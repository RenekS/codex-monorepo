import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';

export default function ImportDashboard() {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState([]);
  const [selected, setSelected] = useState({ batchId: null, type: null, timestamp: null });
  const [detailLoading, setDetailLoading] = useState(false);

  // Načte všechny dávky a rozdělí je podle timestamp
  const fetchBatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/import-b2b-batches`);
      if (res.data.success) {
        const data = res.data.batches;
        const map = {};
        data.forEach(b => {
          const key = b.downloaded_at;
          if (!map[key]) {
            map[key] = { timestamp: b.downloaded_at, types: {} };
          }
          map[key].types[b.type] = { batchId: b.batch_id, count: b.row_count };
        });
        setGroups(Object.values(map));
      } else {
        setError('Chyba v datech importu');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Načte detaily pro konkrétní batch_id
  const fetchDetails = async (batchId) => {
    setDetailLoading(true);
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/import-b2b-batch-details`,
        { params: { batch_id: batchId } }
      );
      if (res.data.success) {
        setDetails(res.data.rows);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Otevře modal pro daný typ a batch
  const handleCellClick = (batchId, type, timestamp) => {
    setSelected({ batchId, type, timestamp });
    setOpen(true);
    fetchDetails(batchId);
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  return (
    <Box p={4}>
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="h5">Import B2B CSV z FTP</Typography>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
          onClick={fetchBatches}
          disabled={loading}
        >
          {loading ? 'Načítám...' : 'Obnovit'}
        </Button>
      </Box>

      {error && <Typography color="error">{error}</Typography>}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><b>Datum</b></TableCell>
                <TableCell align="right"><b>Spárováno</b></TableCell>
                <TableCell align="right"><b>Nespárováno</b></TableCell>
                <TableCell align="right"><b>Blokováno</b></TableCell>
                <TableCell align="right"><b>Špatná cena</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map(group => (
                <TableRow key={group.timestamp} hover>
                  <TableCell>{dayjs(group.timestamp).format('DD.MM.YYYY HH:mm')}</TableCell>
                  {['paired','unpaired','blocked','invalid_price'].map(type => (
                    <TableCell
                      key={type}
                      align="right"
                      style={{ cursor: 'pointer', color: 'blue' }}
                      onClick={() => handleCellClick(group.types[type]?.batchId, type, group.timestamp)}
                    >
                      {group.types[type]?.count ?? 0}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} fullWidth maxWidth="md" onClose={() => setOpen(false)}>
        <DialogTitle>
          Detail importu {selected.type} {' '}
          {selected.timestamp && dayjs(selected.timestamp).format('DD.MM.YYYY HH:mm')}
          <IconButton
            aria-label="close"
            onClick={() => setOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Produkt</TableCell>
                    <TableCell align="right">Kód</TableCell>
                    <TableCell align="right">EAN</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.display_name || row.nazev}</TableCell>
                      <TableCell align="right">{row.part_no}</TableCell>
                      <TableCell align="right">{row.ean}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Zavřít</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
