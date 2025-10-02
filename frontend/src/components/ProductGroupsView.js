// ProductGroupsView.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Typography,
  Paper,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

// Seznam preferovaných značek
const PREFERRED_BRANDS = ['AD01040', 'SF01040', 'AP01040', 'HB01040', 'TU01040'];

// Pole názvů měsíců
const monthNames = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

// Funkce pro formátování čísel – zaokrouhluje na celé číslo a formátuje dle cs-CZ
const formatNumber = (val) => {
  if (typeof val !== 'number') return val || '';
  return Math.round(val).toLocaleString('cs-CZ');
};

// Pomocná funkce, která z "raw" dat spočítá měsíční agregaci a rekapitulaci pro koláčový graf
function computeData(rawData, detailedPreferred, cumulativeEnabled) {
  const monthlyBrandMap = {};
  for (let m = 1; m <= 12; m++) {
    monthlyBrandMap[m] = {};
  }
  rawData.forEach(item => {
    const m = parseInt(item.SalesMonth, 10);
    if (!m || m < 1 || m > 12) return;
    const brand = (item.PurchLineDisc || '').toUpperCase().trim();
    const totalSales = Number(item.TotalSales) || 0;
    if (PREFERRED_BRANDS.includes(brand)) {
      const key = detailedPreferred ? brand : 'PREFERRED';
      monthlyBrandMap[m][key] = (monthlyBrandMap[m][key] || 0) + totalSales;
    } else {
      monthlyBrandMap[m].NONPREF = (monthlyBrandMap[m].NONPREF || 0) + totalSales;
    }
  });
  const brandKeys = detailedPreferred ? [...PREFERRED_BRANDS, 'NONPREF'] : ['PREFERRED', 'NONPREF'];
  let monthlyData = [];
  for (let m = 1; m <= 12; m++) {
    const row = {
      month: m,
      monthName: monthNames[m - 1],
    };
    brandKeys.forEach(b => {
      row[b] = monthlyBrandMap[m][b] || 0;
    });
    monthlyData.push(row);
  }
  if (cumulativeEnabled) {
    const runningSums = {};
    brandKeys.forEach(b => runningSums[b] = 0);
    monthlyData = monthlyData.map(item => {
      const newItem = { ...item };
      brandKeys.forEach(b => {
        runningSums[b] += newItem[b];
        newItem[b] = runningSums[b];
      });
      return newItem;
    });
  }
  // Spočítáme celoroční součty pro koláčový graf
  const brandSums = {};
  brandKeys.forEach(b => brandSums[b] = 0);
  monthlyData.forEach(row => {
    brandKeys.forEach(b => {
      brandSums[b] += row[b];
    });
  });
  const pieData = brandKeys.map(b => ({
    name: b === 'NONPREF' ? 'Nepreferované' : (b === 'PREFERRED' ? 'Preferované' : b),
    value: brandSums[b],
  }));
  return { monthlyData, pieData, brandKeys };
}

// Definice barev
const COLORS = {
  AD01040: '#8884d8',
  SF01040: '#82ca9d',
  AP01040: '#ff7300',
  HB01040: '#003399',
  TU01040: '#990099',
  PREFERRED: '#8884d8',
  NONPREF: '#82ca9d',
};

export default function ProductGroupsView({ detail, groupBy = 'salesrep' }) {
  // Ovládací stavy pro zobrazení let:
  const [primaryYear, setPrimaryYear] = useState('2025');
  const [compareEnabled, setCompareEnabled] = useState(true);
  // Stav pro počet srovnávacích let: 1 = primární + 1 (2 roky celkem), 2 = primární + 2 (3 roky celkem)
  const [numCompareYears, setNumCompareYears] = useState(1);
  const [compareYear, setCompareYear] = useState('2024');
  const [compareYear3, setCompareYear3] = useState('2023');

  // Další ovládací stavy
  const [cumulativeEnabled, setCumulativeEnabled] = useState(false);
  const [detailedPreferred, setDetailedPreferred] = useState(false);

  // Stavy pro načtení "raw" dat z API
  const [primaryRaw, setPrimaryRaw] = useState([]);
  const [compareRaw, setCompareRaw] = useState([]);
  const [compareRaw3, setCompareRaw3] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Efekt pro načítání dat – pro každý rok zvlášť
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // Načteme data pro primární rok
        const primaryRes = await axios.get(
          `${process.env.REACT_APP_API_URL}/an/sales-details/by-year`,
          { params: { year: primaryYear, groupBy } }
        );
        let rawPrimary = primaryRes.data;
        if (detail && detail.type === 'rep') {
          const repName = detail.data.jmeno.trim().toUpperCase();
          rawPrimary = rawPrimary.filter(item =>
            (item.SalesRep || '').trim().toUpperCase() === repName
          );
        }
        setPrimaryRaw(rawPrimary);

        if (compareEnabled) {
          const compareRes = await axios.get(
            `${process.env.REACT_APP_API_URL}/an/sales-details/by-year`,
            { params: { year: compareYear, groupBy } }
          );
          let rawCompare = compareRes.data;
          if (detail && detail.type === 'rep') {
            const repName = detail.data.jmeno.trim().toUpperCase();
            rawCompare = rawCompare.filter(item =>
              (item.SalesRep || '').trim().toUpperCase() === repName
            );
          }
          setCompareRaw(rawCompare);

          if (numCompareYears === 2) {
            const compareRes3 = await axios.get(
              `${process.env.REACT_APP_API_URL}/an/sales-details/by-year`,
              { params: { year: compareYear3, groupBy } }
            );
            let rawCompare3 = compareRes3.data;
            if (detail && detail.type === 'rep') {
              const repName = detail.data.jmeno.trim().toUpperCase();
              rawCompare3 = rawCompare3.filter(item =>
                (item.SalesRep || '').trim().toUpperCase() === repName
              );
            }
            setCompareRaw3(rawCompare3);
          } else {
            setCompareRaw3([]);
          }
        } else {
          setCompareRaw([]);
          setCompareRaw3([]);
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Chyba při načítání dat (ProductGroupsView).');
        setLoading(false);
      }
    };
    fetchData();
  }, [primaryYear, compareEnabled, numCompareYears, compareYear, compareYear3, groupBy, detail]);

  // Vypočítáme agregovaná data pro primární rok (pro sloupcový graf) a pro ostatní roky (pro area, pie, tabulku)
  const primaryData = primaryRaw.length ? computeData(primaryRaw, detailedPreferred, cumulativeEnabled) : null;
  const compareData = (compareEnabled && compareRaw.length) ? computeData(compareRaw, detailedPreferred, cumulativeEnabled) : null;
  const compareData3 = (compareEnabled && numCompareYears === 2 && compareRaw3.length) ? computeData(compareRaw3, detailedPreferred, cumulativeEnabled) : null;

  // Sestavíme pole grafů (každý prvek má rok a příslušná data)
  const charts = [];
  if (primaryData) {
    charts.push({ year: primaryYear, data: primaryData });
  }
  if (compareEnabled && compareData) {
    charts.push({ year: compareYear, data: compareData });
  }
  if (compareEnabled && numCompareYears === 2 && compareData3) {
    charts.push({ year: compareYear3, data: compareData3 });
  }

  // Pro sloupcový graf použijeme data z primárního roku – to znamená, že pro každý měsíc je jeden sloupec,
  // který je rozdělen na segmenty dle skupin (klíče v primaryData.brandKeys)
  const barData = primaryData ? primaryData.monthlyData : [];

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Prodeje dle skupiny produktů (preferované vs. nepreferované)
      </Typography>
      {/* Ovládací panel */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <FormControl size="small">
            <InputLabel id="primary-year-label">Rok</InputLabel>
            <Select
              labelId="primary-year-label"
              value={primaryYear}
              label="Rok"
              onChange={(e) => setPrimaryYear(e.target.value)}
            >
              <MenuItem value="2025">2025</MenuItem>
              <MenuItem value="2024">2024</MenuItem>
              <MenuItem value="2023">2023</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel 
            control={
              <Checkbox 
                checked={compareEnabled}
                onChange={(e) => setCompareEnabled(e.target.checked)}
              />
            }
            label="Porovnat roky"
          />
          {compareEnabled && (
            <>
              <FormControl size="small">
                <InputLabel id="num-compare-label">Počet let</InputLabel>
                <Select
                  labelId="num-compare-label"
                  value={numCompareYears}
                  label="Počet let"
                  onChange={(e) => setNumCompareYears(Number(e.target.value))}
                >
                  <MenuItem value={1}>2 roky (primární + 1)</MenuItem>
                  <MenuItem value={2}>3 roky (primární + 2)</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small">
                <InputLabel id="compare-year-label">Srovnávací rok 1</InputLabel>
                <Select
                  labelId="compare-year-label"
                  value={compareYear}
                  label="Srovnávací rok 1"
                  onChange={(e) => setCompareYear(e.target.value)}
                >
                  <MenuItem value="2025">2025</MenuItem>
                  <MenuItem value="2024">2024</MenuItem>
                  <MenuItem value="2023">2023</MenuItem>
                </Select>
              </FormControl>
              {numCompareYears === 2 && (
                <FormControl size="small">
                  <InputLabel id="compare-year3-label">Srovnávací rok 2</InputLabel>
                  <Select
                    labelId="compare-year3-label"
                    value={compareYear3}
                    label="Srovnávací rok 2"
                    onChange={(e) => setCompareYear3(e.target.value)}
                  >
                    <MenuItem value="2025">2025</MenuItem>
                    <MenuItem value="2024">2024</MenuItem>
                    <MenuItem value="2023">2023</MenuItem>
                  </Select>
                </FormControl>
              )}
            </>
          )}
          <FormControlLabel
            control={
              <Checkbox
                checked={cumulativeEnabled}
                onChange={(e) => setCumulativeEnabled(e.target.checked)}
              />
            }
            label="Kumulovaný průběh"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={detailedPreferred}
                onChange={(e) => setDetailedPreferred(e.target.checked)}
              />
            }
            label="Detailní rozpad preferovaných"
          />
        </Box>
      </Paper>
      {/* Sloupcový graf – zobrazuje data pouze z primárního roku jako jeden sloupec pro každý měsíc */}
      {barData.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" align="center" sx={{ mb: 1 }}>
            Sloupcový graf – Celkové tržby {primaryYear}
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthName" />
              <YAxis />
              <Tooltip formatter={(val) => formatNumber(val)} />
              <Legend />
              {primaryData.brandKeys.map(b => {
                const fillColor = COLORS[b] || '#ccc';
                const labelName = b === 'NONPREF' ? 'Nepreferované' : (b === 'PREFERRED' ? 'Preferované' : b);
                return (
                  <Bar
                    key={b}
                    dataKey={b}
                    name={labelName}
                    stackId="1"
                    fill={fillColor}
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      )}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <>
          <Grid container spacing={2}>
            {charts.map((chart) => (
              <Grid
                item
                xs={12}
                md={charts.length === 1 ? 12 : Math.floor(12 / charts.length)}
                key={chart.year}
              >
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" align="center" sx={{ mb: 1 }}>
                    Rok {chart.year}
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chart.data.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="monthName" />
                      <YAxis />
                      <Tooltip formatter={(val) => formatNumber(val)} />
                      <Legend />
                      {chart.data.brandKeys.map((b) => {
                        const color = COLORS[b] || '#aaa';
                        const labelName = b === 'NONPREF' ? 'Nepreferované' : (b === 'PREFERRED' ? 'Preferované' : b);
                        return (
                          <Area
                            key={b}
                            type="monotone"
                            dataKey={b}
                            name={labelName}
                            stroke={color}
                            fill={color}
                            fillOpacity={0.5}
                            stackId="1"
                          />
                        );
                      })}
                    </AreaChart>
                  </ResponsiveContainer>
                  <Box sx={{ mt: 2 }}>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={chart.data.pieData}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={80}
                          label={({ name, value }) => `${name} (${formatNumber(value)})`}
                        >
                          {chart.data.pieData.map((entry, idx) => {
                            const colorKey = (entry.name === 'Nepreferované')
                              ? 'NONPREF'
                              : (PREFERRED_BRANDS.includes(entry.name) || entry.name === 'Preferované' ? entry.name : 'NONPREF');
                            return (
                              <Cell
                                key={`cell-${idx}`}
                                fill={COLORS[colorKey] || '#ccc'}
                              />
                            );
                          })}
                        </Pie>
                        <Tooltip formatter={(val) => formatNumber(val)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box sx={{ mt: 2, overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.8rem'
                    }}>
                      <thead>
                        <tr>
                          <th style={{
                            border: '1px solid #ccc',
                            padding: '4px',
                            backgroundColor: '#f5f5f5',
                            textAlign: 'left'
                          }}>Měsíc</th>
                          {chart.data.brandKeys.map(b => (
                            <th key={b} style={{
                              border: '1px solid #ccc',
                              padding: '4px',
                              backgroundColor: '#f5f5f5',
                              textAlign: 'right'
                            }}>
                              {b === 'NONPREF' ? 'Nepreferované' : (b === 'PREFERRED' ? 'Preferované' : b)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {chart.data.monthlyData.map((row, idx) => (
                          <tr key={idx}>
                            <td style={{
                              border: '1px solid #ccc',
                              padding: '4px',
                              textAlign: 'left'
                            }}>{row.monthName}</td>
                            {chart.data.brandKeys.map(b => (
                              <td key={b} style={{
                                border: '1px solid #ccc',
                                padding: '4px',
                                textAlign: 'right'
                              }}>
                                {formatNumber(row[b])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
}
