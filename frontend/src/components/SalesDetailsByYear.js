// SalesDetailsByYear.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Box, 
  Button, 
  CircularProgress, 
  Checkbox, 
  FormControl, 
  FormControlLabel, 
  InputLabel, 
  MenuItem, 
  Paper, 
  Select, 
  Typography 
} from '@mui/material';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Pomocná funkce pro formátování čísel (zaokrouhluje na celé číslo a používá lokalizaci cs-CZ)
const formatNumber = (val) => {
  if (typeof val !== 'number') return val || '';
  return Math.round(val).toLocaleString('cs-CZ');
};

const SalesDetailsByYear = ({ detail, onBack, groupBy = 'salesrep' }) => {
  // Výběr primárního roku
  const [primaryYear, setPrimaryYear] = useState('2025');
  // Porovnávání je ve výchozím stavu zapnuté
  const [compareEnabled, setCompareEnabled] = useState(true);
  // Stav pro počet srovnávacích roků (1 = porovnáváme 2 roky celkem, 2 = porovnáváme 3 roky)
  const [numCompareYears, setNumCompareYears] = useState(2); // nastaveno na maximum (primární + 2)
  // Srovnávací roky – výchozí hodnoty
  const [compareYear, setCompareYear] = useState('2024');
  const [compareYear3, setCompareYear3] = useState('2023');

  // Stavy pro načtení actual dat z endpointu
  const [primaryData, setPrimaryData] = useState([]);
  const [compareData, setCompareData] = useState([]);
  const [compareData3, setCompareData3] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Načítání plánových dat
  const [planData, setPlanData] = useState(null);
  useEffect(() => {
    const fetchPlanData = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/an/plan-data`);
        setPlanData(response.data.planData);
      } catch (err) {
        console.error(err);
      }
    };
    fetchPlanData();
  }, []);

  // Checkboxy pro výběr metrik – ve výchozím stavu povoleny jen Celkové tržby
  const [showTotalSales, setShowTotalSales] = useState(true);
  const [showTireSales, setShowTireSales] = useState(false);
  const [showTireQty, setShowTireQty] = useState(false);
  const [showProtectorSales, setShowProtectorSales] = useState(false);
  const [showProtectorQty, setShowProtectorQty] = useState(false);
  const [cumulativeEnabled, setCumulativeEnabled] = useState(false);

  const monthNames = [
    'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
    'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
  ];

  // Funkce pro volání endpointu /an/sales-details/by-year
  const fetchYearData = async (year) => {
    const response = await axios.get(
      `${process.env.REACT_APP_API_URL}/an/sales-details/by-year`,
      { params: { year, groupBy } }
    );
    return response.data;
  };

  // Načítání dat při změně roků, detailu, počtu srovnávacích let či groupBy
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        let dataPrimary = await fetchYearData(primaryYear);
        let dataCompare = [];
        let dataCompare3 = [];
        // Pokud je detail typu rep, vyfiltrujeme data podle obchodníka
        if (detail && detail.type === 'rep') {
          dataPrimary = dataPrimary.filter(item =>
            (item.SalesRep || "").trim().toUpperCase() === detail.data.jmeno.trim().toUpperCase()
          );
        }
        if (compareEnabled) {
          dataCompare = await fetchYearData(compareYear);
          if (detail && detail.type === 'rep') {
            dataCompare = dataCompare.filter(item =>
              (item.SalesRep || "").trim().toUpperCase() === detail.data.jmeno.trim().toUpperCase()
            );
          }
          // Pokud má být porovnáváno 3 roky, načteme i druhý srovnávací rok
          if (numCompareYears === 2) {
            dataCompare3 = await fetchYearData(compareYear3);
            if (detail && detail.type === 'rep') {
              dataCompare3 = dataCompare3.filter(item =>
                (item.SalesRep || "").trim().toUpperCase() === detail.data.jmeno.trim().toUpperCase()
              );
            }
          }
        }
        setPrimaryData(aggregateByMonth(dataPrimary));
        setCompareData(compareEnabled ? aggregateByMonth(dataCompare) : []);
        setCompareData3(compareEnabled && numCompareYears === 2 ? aggregateByMonth(dataCompare3) : []);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Chyba při načítání dat');
        setLoading(false);
      }
    };
    fetchData();
  }, [primaryYear, compareEnabled, numCompareYears, compareYear, compareYear3, detail, groupBy]);

  // Agregace dat podle měsíce – sčítáme metriky z actual dat
  const aggregateByMonth = (dataArray) => {
    const aggregated = {};
    for (let m = 1; m <= 12; m++) {
      aggregated[m] = {
        TotalSales: 0,
        TotalSalesPneu: 0,
        TotalQtyPneu: 0,
        TotalSalesProtektory: 0,
        TotalQtyProtektory: 0,
      };
    }
    dataArray.forEach(item => {
      const m = parseInt(item.SalesMonth, 10);
      if (!isNaN(m)) {
        aggregated[m].TotalSales += Number(item.TotalSales) || 0;
        aggregated[m].TotalSalesPneu += Number(item.TotalSalesPneu) || 0;
        aggregated[m].TotalQtyPneu += Number(item.TotalQtyPneu) || 0;
        aggregated[m].TotalSalesProtektory += Number(item.TotalSalesProtektory) || 0;
        aggregated[m].TotalQtyProtektory += Number(item.TotalQtyProtektory) || 0;
      }
    });
    const result = [];
    for (let m = 1; m <= 12; m++) {
      result.push({
        month: m,
        monthName: monthNames[m - 1],
        TotalSales: aggregated[m].TotalSales,
        TotalSalesPneu: aggregated[m].TotalSalesPneu,
        TotalQtyPneu: aggregated[m].TotalQtyPneu,
        TotalSalesProtektory: aggregated[m].TotalSalesProtektory,
        TotalQtyProtektory: aggregated[m].TotalQtyProtektory,
      });
    }
    return result;
  };

  // Filtrace plánových dat podle detailu (pro obchodníka)
  let planRow = null;
  if (planData && detail && detail.type === 'rep') {
    planRow = planData.find(row => row.Obchodni_zastupce.trim().toUpperCase() === detail.data.jmeno.trim().toUpperCase());
  }
  // Pro plán celkových tržeb používáme pevný roční plán z roku 2025
  const annualPlanTotalSales = planRow ? Number(planRow['Plan_trzba_2025']) || 0 : 0;

  // Slučovací logika: pro každý měsíc vytvoříme záznam s daty pro primární rok, případně srovnávací roky a s plánem.
  const mergedData = [];
  for (let m = 1; m <= 12; m++) {
    const primaryRecord = primaryData.find(rec => rec.month === m) || {
      TotalSales: 0,
      TotalSalesPneu: 0,
      TotalQtyPneu: 0,
      TotalSalesProtektory: 0,
      TotalQtyProtektory: 0,
    };
    const compareRecord = compareEnabled 
      ? (compareData.find(rec => rec.month === m) || {
          TotalSales: 0,
          TotalSalesPneu: 0,
          TotalQtyPneu: 0,
          TotalSalesProtektory: 0,
          TotalQtyProtektory: 0,
        })
      : null;
    // Pokud porovnáváme 3 roky, přidáme data z druhého srovnávacího roku
    const compareRecord3 = (compareEnabled && numCompareYears === 2)
      ? (compareData3.find(rec => rec.month === m) || {
          TotalSales: 0,
          TotalSalesPneu: 0,
          TotalQtyPneu: 0,
          TotalSalesProtektory: 0,
          TotalQtyProtektory: 0,
        })
      : null;
    mergedData.push({
      month: m,
      monthName: monthNames[m - 1],
      primaryTotalSales: primaryRecord.TotalSales,
      primarySalesPneu: primaryRecord.TotalSalesPneu,
      primaryQtyPneu: primaryRecord.TotalQtyPneu,
      primarySalesProtektory: primaryRecord.TotalSalesProtektory,
      primaryQtyProtektory: primaryRecord.TotalQtyProtektory,
      compareTotalSales: compareEnabled ? compareRecord.TotalSales : undefined,
      compareSalesPneu: compareEnabled ? compareRecord.TotalSalesPneu : undefined,
      compareQtyPneu: compareEnabled ? compareRecord.TotalQtyPneu : undefined,
      compareSalesProtektory: compareEnabled ? compareRecord.TotalSalesProtektory : undefined,
      compareQtyProtektory: compareEnabled ? compareRecord.TotalQtyProtektory : undefined,
      compareTotalSales3: (compareEnabled && numCompareYears === 2) ? compareRecord3.TotalSales : undefined,
      compareSalesPneu3: (compareEnabled && numCompareYears === 2) ? compareRecord3.TotalSalesPneu : undefined,
      compareQtyPneu3: (compareEnabled && numCompareYears === 2) ? compareRecord3.TotalQtyPneu : undefined,
      compareSalesProtektory3: (compareEnabled && numCompareYears === 2) ? compareRecord3.TotalSalesProtektory : undefined,
      compareQtyProtektory3: (compareEnabled && numCompareYears === 2) ? compareRecord3.TotalQtyProtektory : undefined,
      // Plán celkových tržeb
      planTotalSales: cumulativeEnabled
        ? annualPlanTotalSales * m / 12
        : annualPlanTotalSales / 12,
      planTireSales: planRow 
        ? (cumulativeEnabled 
            ? Number(planRow.Nakladni_pneu_plan_trzba) * m / 12 
            : Number(planRow.Nakladni_pneu_plan_trzba) / 12)
        : 0,
      planTireQty: planRow 
        ? (cumulativeEnabled 
            ? Number(planRow.Nakladni_pneu_plan_ks) * m / 12 
            : Number(planRow.Nakladni_pneu_plan_ks) / 12)
        : 0,
      planProtectorSales: planRow 
        ? (cumulativeEnabled 
            ? Number(planRow.Protektory_plan_trzba) * m / 12 
            : Number(planRow.Protektory_plan_trzba) / 12)
        : 0,
      planProtectorQty: planRow 
        ? (cumulativeEnabled 
            ? Number(planRow.Protektory_plan_ks) * m / 12 
            : Number(planRow.Protektory_plan_ks) / 12)
        : 0,
    });
  }

  // Kumulace – kumulujeme data pro primární i srovnávací řady (druhý srovnávací řádek pouze pokud porovnáváme 3 roky)
  let displayData = mergedData;
  if (cumulativeEnabled) {
    let runningPrimaryTotalSales = 0,
        runningPrimarySalesPneu = 0,
        runningPrimaryQtyPneu = 0,
        runningPrimarySalesProtektory = 0,
        runningPrimaryQtyProtektory = 0;
    let runningCompareTotalSales = 0,
        runningCompareSalesPneu = 0,
        runningCompareQtyPneu = 0,
        runningCompareSalesProtektory = 0,
        runningCompareQtyProtektory = 0;
    let runningCompareTotalSales3 = 0,
        runningCompareSalesPneu3 = 0,
        runningCompareQtyPneu3 = 0,
        runningCompareSalesProtektory3 = 0,
        runningCompareQtyProtektory3 = 0;
    displayData = mergedData.map(item => {
      runningPrimaryTotalSales += item.primaryTotalSales;
      runningPrimarySalesPneu += item.primarySalesPneu;
      runningPrimaryQtyPneu += item.primaryQtyPneu;
      runningPrimarySalesProtektory += item.primarySalesProtektory;
      runningPrimaryQtyProtektory += item.primaryQtyProtektory;
      
      const newItem = {
        ...item,
        primaryTotalSales: runningPrimaryTotalSales,
        primarySalesPneu: runningPrimarySalesPneu,
        primaryQtyPneu: runningPrimaryQtyPneu,
        primarySalesProtektory: runningPrimarySalesProtektory,
        primaryQtyProtektory: runningPrimaryQtyProtektory,
      };

      if (compareEnabled) {
        runningCompareTotalSales += item.compareTotalSales || 0;
        runningCompareSalesPneu += item.compareSalesPneu || 0;
        runningCompareQtyPneu += item.compareQtyPneu || 0;
        runningCompareSalesProtektory += item.compareSalesProtektory || 0;
        runningCompareQtyProtektory += item.compareQtyProtektory || 0;

        newItem.compareTotalSales = runningCompareTotalSales;
        newItem.compareSalesPneu = runningCompareSalesPneu;
        newItem.compareQtyPneu = runningCompareQtyPneu;
        newItem.compareSalesProtektory = runningCompareSalesProtektory;
        newItem.compareQtyProtektory = runningCompareQtyProtektory;

        if (numCompareYears === 2) {
          runningCompareTotalSales3 += item.compareTotalSales3 || 0;
          runningCompareSalesPneu3 += item.compareSalesPneu3 || 0;
          runningCompareQtyPneu3 += item.compareQtyPneu3 || 0;
          runningCompareSalesProtektory3 += item.compareSalesProtektory3 || 0;
          runningCompareQtyProtektory3 += item.compareQtyProtektory3 || 0;
          newItem.compareTotalSales3 = runningCompareTotalSales3;
          newItem.compareSalesPneu3 = runningCompareSalesPneu3;
          newItem.compareQtyPneu3 = runningCompareQtyPneu3;
          newItem.compareSalesProtektory3 = runningCompareSalesProtektory3;
          newItem.compareQtyProtektory3 = runningCompareQtyProtektory3;
        }
      }
      return newItem;
    });
  }

  const chartData = displayData;

  return (
    <Box sx={{ p: 2 }}>
      {onBack && (
        <Button variant="contained" onClick={onBack} sx={{ mb: 2 }}>
          Zpět
        </Button>
      )}
      {detail ? (
        <Typography variant="h4" sx={{ mb: 2 }}>
          Detailní prodeje {detail.type === 'center' ? 'střediska' : 'obchodníka'}: {detail.type === 'center' ? detail.data.stredisko : detail.data.jmeno}
        </Typography>
      ) : (
        <Typography variant="h4" sx={{ mb: 2 }}>
          Prodejní přehled podle roku
        </Typography>
      )}
      
      {/* Řídící prvky pro volbu roku, porovnávání a počet srovnávacích let */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl sx={{ minWidth: 120 }}>
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
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel id="num-compare-label">Počet porovnávaných let</InputLabel>
              <Select
                labelId="num-compare-label"
                value={numCompareYears}
                label="Počet porovnávaných let"
                onChange={(e) => setNumCompareYears(Number(e.target.value))}
              >
                <MenuItem value={1}>2 roky (primární + 1)</MenuItem>
                <MenuItem value={2}>3 roky (primární + 2)</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 120 }}>
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
              <FormControl sx={{ minWidth: 120 }}>
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
          control={<Checkbox checked={cumulativeEnabled} onChange={(e) => setCumulativeEnabled(e.target.checked)} />}
          label="Kumulativní zobrazení"
        />
      </Box>

      {/* Výběr metrik */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControlLabel
          control={<Checkbox checked={showTotalSales} onChange={(e) => setShowTotalSales(e.target.checked)} />}
          label="Celkové tržby"
        />
        <FormControlLabel
          control={<Checkbox checked={showTireSales} onChange={(e) => setShowTireSales(e.target.checked)} />}
          label="Tržby za pneu"
        />
        <FormControlLabel
          control={<Checkbox checked={showTireQty} onChange={(e) => setShowTireQty(e.target.checked)} />}
          label="Kusy pneu"
        />
        <FormControlLabel
          control={<Checkbox checked={showProtectorSales} onChange={(e) => setShowProtectorSales(e.target.checked)} />}
          label="Tržby za protektory"
        />
        <FormControlLabel
          control={<Checkbox checked={showProtectorQty} onChange={(e) => setShowProtectorQty(e.target.checked)} />}
          label="Kusy protektorů"
        />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <>
          {/* Graf */}
          <Box sx={{ width: '100%', height: 400, mb: 4 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthName" label={{ value: 'Měsíc', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Hodnota', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => formatNumber(value)} />
                <Legend />
                {showTotalSales && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="primaryTotalSales"
                      name={`Celkové tržby ${primaryYear}`}
                      stroke="#1f77b4"  // modrá pro primární rok
                      strokeWidth={4}   // tlustší čára
                      dot={{ r: 6, fill: '#1f77b4', strokeWidth: 2 }}  // zvýrazněné tečky
                    />
                    {compareEnabled && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="compareTotalSales"
                          name={`Celkové tržby ${compareYear}`}
                          stroke="#ff7f0e"  // oranžová pro srovnávací rok
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#ff7f0e', strokeWidth: 1 }}
                        />
                        {numCompareYears === 2 && (
                          <Line
                            type="monotone"
                            dataKey="compareTotalSales3"
                            name={`Celkové tržby ${compareYear3}`}
                            stroke="#2ca02c"  // zelená pro druhý srovnávací rok
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#2ca02c', strokeWidth: 1 }}
                          />
                        )}
                      </>
                    )}
                    <Line
                      type="monotone"
                      dataKey="planTotalSales"
                      name="Plán celkové tržby"
                      stroke="#000000"
                      dot={false}
                    />
                  </>
                )}
                {showTireSales && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="primarySalesPneu"
                      name={`Tržby za pneu ${primaryYear}`}
                      stroke="#ff7300"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#ff7300", strokeWidth: 1 }}
                    />
                    {compareEnabled && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="compareSalesPneu"
                          name={`Tržby za pneu ${compareYear}`}
                          stroke="#ff7300"
                          strokeDasharray="5 5"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#ff7300", strokeWidth: 1 }}
                        />
                        {numCompareYears === 2 && (
                          <Line
                            type="monotone"
                            dataKey="compareSalesPneu3"
                            name={`Tržby za pneu ${compareYear3}`}
                            stroke="#ff7300"
                            strokeDasharray="2 2"
                            strokeWidth={3}
                            dot={{ r: 4, fill: "#ff7300", strokeWidth: 1 }}
                          />
                        )}
                      </>
                    )}
                    <Line
                      type="monotone"
                      dataKey="planTireSales"
                      name="Plán tržby za pneu"
                      stroke="#ff7300"
                      dot={false}
                    />
                  </>
                )}
                {showTireQty && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="primaryQtyPneu"
                      name={`Kusy pneu ${primaryYear}`}
                      stroke="#387908"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#387908", strokeWidth: 1 }}
                    />
                    {compareEnabled && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="compareQtyPneu"
                          name={`Kusy pneu ${compareYear}`}
                          stroke="#387908"
                          strokeDasharray="5 5"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#387908", strokeWidth: 1 }}
                        />
                        {numCompareYears === 2 && (
                          <Line
                            type="monotone"
                            dataKey="compareQtyPneu3"
                            name={`Kusy pneu ${compareYear3}`}
                            stroke="#387908"
                            strokeDasharray="2 2"
                            strokeWidth={3}
                            dot={{ r: 4, fill: "#387908", strokeWidth: 1 }}
                          />
                        )}
                      </>
                    )}
                    <Line
                      type="monotone"
                      dataKey="planTireQty"
                      name="Plán kusů pneu"
                      stroke="#387908"
                      dot={false}
                    />
                  </>
                )}
                {showProtectorSales && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="primarySalesProtektory"
                      name={`Tržby za protektory ${primaryYear}`}
                      stroke="#003399"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#003399", strokeWidth: 1 }}
                    />
                    {compareEnabled && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="compareSalesProtektory"
                          name={`Tržby za protektory ${compareYear}`}
                          stroke="#003399"
                          strokeDasharray="5 5"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#003399", strokeWidth: 1 }}
                        />
                        {numCompareYears === 2 && (
                          <Line
                            type="monotone"
                            dataKey="compareSalesProtektory3"
                            name={`Tržby za protektory ${compareYear3}`}
                            stroke="#003399"
                            strokeDasharray="2 2"
                            strokeWidth={3}
                            dot={{ r: 4, fill: "#003399", strokeWidth: 1 }}
                          />
                        )}
                      </>
                    )}
                    <Line
                      type="monotone"
                      dataKey="planProtectorSales"
                      name="Plán tržby za protektory"
                      stroke="#000000"
                      dot={false}
                    />
                  </>
                )}
                {showProtectorQty && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="primaryQtyProtektory"
                      name={`Kusy protektorů ${primaryYear}`}
                      stroke="#990099"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#990099", strokeWidth: 1 }}
                    />
                    {compareEnabled && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="compareQtyProtektory"
                          name={`Kusy protektorů ${compareYear}`}
                          stroke="#990099"
                          strokeDasharray="5 5"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#990099", strokeWidth: 1 }}
                        />
                        {numCompareYears === 2 && (
                          <Line
                            type="monotone"
                            dataKey="compareQtyProtektory3"
                            name={`Kusy protektorů ${compareYear3}`}
                            stroke="#990099"
                            strokeDasharray="2 2"
                            strokeWidth={3}
                            dot={{ r: 4, fill: "#990099", strokeWidth: 1 }}
                          />
                        )}
                      </>
                    )}
                    <Line
                      type="monotone"
                      dataKey="planProtectorQty"
                      name="Plán kusů protektorů"
                      stroke="#000000"
                      dot={false}
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </Box>
          
          {/* Tabulka s měsíčními daty */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Měsíční data
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Měsíc</th>
                    {showTotalSales && (
                      <>
                        <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Celkové tržby {primaryYear}</th>
                        {compareEnabled && (
                          <>
                            <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Celkové tržby {compareYear}</th>
                            {numCompareYears === 2 && (
                              <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Celkové tržby {compareYear3}</th>
                            )}
                          </>
                        )}
                        <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Plán celkové tržby</th>
                      </>
                    )}
                    {showTireSales && (
                      <>
                        <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Tržby za pneu {primaryYear}</th>
                        {compareEnabled && (
                          <>
                            <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Tržby za pneu {compareYear}</th>
                            {numCompareYears === 2 && (
                              <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Tržby za pneu {compareYear3}</th>
                            )}
                          </>
                        )}
                        <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Plán tržby za pneu</th>
                      </>
                    )}
                    {showTireQty && (
                      <>
                        <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Kusy pneu {primaryYear}</th>
                        {compareEnabled && (
                          <>
                            <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Kusy pneu {compareYear}</th>
                            {numCompareYears === 2 && (
                              <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Kusy pneu {compareYear3}</th>
                            )}
                          </>
                        )}
                        <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Plán kusů pneu</th>
                      </>
                    )}
                    {showProtectorSales && (
                      <>
                        <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Tržby za protektory {primaryYear}</th>
                        {compareEnabled && (
                          <>
                            <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Tržby za protektory {compareYear}</th>
                            {numCompareYears === 2 && (
                              <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Tržby za protektory {compareYear3}</th>
                            )}
                          </>
                        )}
                        <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Plán tržby za protektory</th>
                      </>
                    )}
                    {showProtectorQty && (
                      <>
                        <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Kusy protektorů {primaryYear}</th>
                        {compareEnabled && (
                          <>
                            <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Kusy protektorů {compareYear}</th>
                            {numCompareYears === 2 && (
                              <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Kusy protektorů {compareYear3}</th>
                            )}
                          </>
                        )}
                        <th style={{ border: '1px solid #ccc', padding: '8px', backgroundColor: '#f5f5f5' }}>Plán kusů protektorů</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {mergedData.map((row, index) => (
                    <tr key={index}>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>{row.monthName}</td>
                      {showTotalSales && (
                        <>
                          <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.primaryTotalSales)}</td>
                          {compareEnabled && (
                            <>
                              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.compareTotalSales)}</td>
                              {numCompareYears === 2 && (
                                <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.compareTotalSales3)}</td>
                              )}
                            </>
                          )}
                          <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.planTotalSales)}</td>
                        </>
                      )}
                      {showTireSales && (
                        <>
                          <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.primarySalesPneu)}</td>
                          {compareEnabled && (
                            <>
                              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.compareSalesPneu)}</td>
                              {numCompareYears === 2 && (
                                <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.compareSalesPneu3)}</td>
                              )}
                            </>
                          )}
                          <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.planTireSales)}</td>
                        </>
                      )}
                      {showTireQty && (
                        <>
                          <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.primaryQtyPneu)}</td>
                          {compareEnabled && (
                            <>
                              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.compareQtyPneu)}</td>
                              {numCompareYears === 2 && (
                                <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.compareQtyPneu3)}</td>
                              )}
                            </>
                          )}
                          <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.planTireQty)}</td>
                        </>
                      )}
                      {showProtectorSales && (
                        <>
                          <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.primarySalesProtektory)}</td>
                          {compareEnabled && (
                            <>
                              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.compareSalesProtektory)}</td>
                              {numCompareYears === 2 && (
                                <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.compareSalesProtektory3)}</td>
                              )}
                            </>
                          )}
                          <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.planProtektorSales)}</td>
                        </>
                      )}
                      {showProtectorQty && (
                        <>
                          <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.primaryQtyProtektory)}</td>
                          {compareEnabled && (
                            <>
                              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.compareQtyProtektory)}</td>
                              {numCompareYears === 2 && (
                                <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.compareQtyProtektory3)}</td>
                              )}
                            </>
                          )}
                          <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>{formatNumber(row.planProtektorQty)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default SalesDetailsByYear;
