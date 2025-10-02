// Dashboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
// Importujeme detailní komponentu, nyní SalesDetailsByYear
import SalesDetailsByYear from './SalesDetailsByYear';
import SalesDetailsTabs from './SalesDetailsTabs';

const formatNumber = (val) => {
  if (typeof val !== 'number') return val || '';
  return Math.round(val).toLocaleString('cs-CZ');
};

const computePercent = (actual, plan) => {
  if (!plan || plan === 0) return '0';
  return ((actual / plan) * 100).toFixed(1);
};

function FilterBox({ centers, reps, selectedCenter, selectedRep, onFilterChange }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
      <FormControl sx={{ minWidth: 150 }}>
        <InputLabel id="center-label">Středisko</InputLabel>
        <Select
          labelId="center-label"
          value={selectedCenter}
          label="Středisko"
          onChange={(e) => onFilterChange('center', e.target.value)}
        >
          <MenuItem value="">Vše</MenuItem>
          {centers.map((center) => (
            <MenuItem key={center} value={center}>
              {center}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl sx={{ minWidth: 150 }}>
        <InputLabel id="rep-label">Obchodní zástupce</InputLabel>
        <Select
          labelId="rep-label"
          value={selectedRep}
          label="Obchodní zástupce"
          onChange={(e) => onFilterChange('rep', e.target.value)}
        >
          <MenuItem value="">Vše</MenuItem>
          {reps.map((rep) => (
            <MenuItem key={rep} value={rep}>
              {rep}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}

function DashBoard() {
  const [strediskaData, setStrediskaData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Stav pro rozbalení řádků
  const [expandedCenters, setExpandedCenters] = useState({});
  const [expandedReps, setExpandedReps] = useState({});

  // Filtry
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedRep, setSelectedRep] = useState('');
  const [centers, setCenters] = useState([]);
  const [reps, setReps] = useState([]);

  // Pokud je vybrán detail (obchodník nebo středisko), uložíme jej sem
  // detail: { type: 'center' | 'rep', data: ..., center?: string }
  const [selectedDetail, setSelectedDetail] = useState(null);

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_URL}/an/sales-details`)
      .then((response) => {
        const data = response.data?.strediska || [];
        setStrediskaData(data);
        setLoading(false);

        // Sestavíme seznam středisek a obchodníků pro filtry
        const centersSet = new Set();
        const repsSet = new Set();
        data.forEach((st) => {
          centersSet.add(st.stredisko);
          st.obchodniZastupci.forEach((repObj) => {
            repsSet.add(repObj.jmeno);
          });
        });
        setCenters([...centersSet].sort());
        setReps([...repsSet].sort());
      })
      .catch((err) => {
        console.error(err);
        setError('Chyba při načítání dat.');
        setLoading(false);
      });
  }, []);

  const handleFilterChange = (filterType, value) => {
    if (filterType === 'center') {
      setSelectedCenter(value);
      if (!value) {
        const allReps = new Set();
        strediskaData.forEach((st) => {
          st.obchodniZastupci.forEach((repObj) => allReps.add(repObj.jmeno));
        });
        setReps([...allReps].sort());
        setSelectedRep('');
      } else {
        const found = strediskaData.find((st) => st.stredisko === value);
        if (found) {
          const stReps = found.obchodniZastupci.map((r) => r.jmeno);
          setReps(stReps.sort());
          setSelectedRep('');
        } else {
          setReps([]);
          setSelectedRep('');
        }
      }
    } else {
      setSelectedRep(value);
    }
  };

  const toggleCenter = (center) => {
    setExpandedCenters((prev) => ({ ...prev, [center]: !prev[center] }));
  };

  const toggleRep = (center, repName) => {
    const key = `${center}-${repName}`;
    setExpandedReps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleBackFromDetail = () => {
    setSelectedDetail(null);
  };

  // Pokud je vybrán detail, vykreslíme komponentu SalesDetailsByYear s předanými daty a callbackem onBack
  if (selectedDetail) {
    return (
      <SalesDetailsTabs
        detail={selectedDetail}
        onBack={handleBackFromDetail}
        groupBy="salesrep" // nebo "center" podle potřeby
      />
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Typography color="error" variant="h6" align="center" sx={{ mt: 5 }}>
        {error}
      </Typography>
    );
  }

  const filteredStrediska = strediskaData
    .filter((st) => (selectedCenter ? st.stredisko === selectedCenter : true))
    .sort((a, b) => a.stredisko.localeCompare(b.stredisko));

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Přehled prodejů – PNEUMATIKY / PROTEKTORY / CELKEM
      </Typography>
      <FilterBox
        centers={centers}
        reps={reps}
        selectedCenter={selectedCenter}
        selectedRep={selectedRep}
        onFilterChange={handleFilterChange}
      />
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Úroveň</TableCell>
              <TableCell>Název</TableCell>
              <TableCell colSpan={3} align="center" style={{ borderLeft: '1px solid #ccc', borderRight: '1px solid #ccc' }}>
                PNEUMATIKY
              </TableCell>
              <TableCell colSpan={3} align="center" style={{ borderLeft: '1px solid #ccc', borderRight: '1px solid #ccc' }}>
                PROTEKTORY
              </TableCell>
              <TableCell colSpan={3} align="center" style={{ borderLeft: '1px solid #ccc' }}>
                CELKEM (tržby)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell />
              <TableCell />
              <TableCell>Prodáno ks</TableCell>
              <TableCell>Plán ks</TableCell>
              <TableCell>% plnění</TableCell>
              <TableCell>Prodáno ks</TableCell>
              <TableCell>Plán ks</TableCell>
              <TableCell>% plnění</TableCell>
              <TableCell>Tržby</TableCell>
              <TableCell>Plán tržby</TableCell>
              <TableCell>% plnění</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredStrediska.map((st) => {
              const aggregatedPlan = st.aggregatedPlan || {};
              const actualData = st.actualData || {};

              const centerPneuQty = actualData.totalOrdersPneu || 0;
              const centerPneuPlan = parseFloat(aggregatedPlan.pneuPlanKs || 0);
              const centerPneuPct = centerPneuPlan ? computePercent(centerPneuQty, centerPneuPlan) : '0';

              const centerProtQty = actualData.totalOrdersProtektory || 0;
              const centerProtPlan = parseFloat(aggregatedPlan.protPlanKs || 0);
              const centerProtPct = centerProtPlan ? computePercent(centerProtQty, centerProtPlan) : '0';

              const centerTotalTrzba = actualData.totalSales || 0;
              const centerTotalPlan = parseFloat(aggregatedPlan.totalPlanTrzba || 0);
              const centerTotalPct = centerTotalPlan ? computePercent(centerTotalTrzba, centerTotalPlan) : '0';

              const isCenterExpanded = !!expandedCenters[st.stredisko];

              return (
                <React.Fragment key={st.stredisko}>
                  <TableRow
                    sx={{ backgroundColor: '#dcedc8', cursor: 'pointer' }}
                    onClick={() => {
                      // Po kliknutí na řádek střediska otevřeme detail SalesDetailsByYear
                      setSelectedDetail({ type: 'center', data: st });
                    }}
                  >
                    <TableCell>
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCenter(st.stredisko);
                        }}
                      >
                        {isCenterExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      Středisko
                    </TableCell>
                    <TableCell>{st.stredisko}</TableCell>
                    <TableCell>{centerPneuQty}</TableCell>
                    <TableCell>{formatNumber(centerPneuPlan)}</TableCell>
                    <TableCell>{centerPneuPct}</TableCell>
                    <TableCell>{centerProtQty}</TableCell>
                    <TableCell>{formatNumber(centerProtPlan)}</TableCell>
                    <TableCell>{centerProtPct}</TableCell>
                    <TableCell>{formatNumber(centerTotalTrzba)}</TableCell>
                    <TableCell>{formatNumber(centerTotalPlan)}</TableCell>
                    <TableCell>{centerTotalPct}</TableCell>
                  </TableRow>
                  {isCenterExpanded &&
                    st.obchodniZastupci
                      .filter((rep) => (selectedRep ? rep.jmeno === selectedRep : true))
                      .map((rep) => {
                        const repPlan = rep.planData || {};
                        const repActual = rep.actualData || {};

                        const repPneuQty = repActual.totalOrdersPneu || 0;
                        const repPneuPlan = parseFloat(repPlan.pneuPlanKs || 0);
                        const repPneuPct = repPneuPlan ? computePercent(repPneuQty, repPneuPlan) : '0';

                        const repProtQty = repActual.totalOrdersProtektory || 0;
                        const repProtPlan = parseFloat(repPlan.protPlanKs || 0);
                        const repProtPct = repProtPlan ? computePercent(repProtQty, repProtPlan) : '0';

                        const repTotalTrzba = repActual.totalSales || 0;
                        const repTotalPlan = parseFloat(repPlan.totalPlanTrzba || 0);
                        const repTotalPct = repTotalPlan ? computePercent(repTotalTrzba, repTotalPlan) : '0';

                        const repKey = `${st.stredisko}-${rep.jmeno}`;
                        const isRepExpanded = !!expandedReps[repKey];

                        return (
                          <React.Fragment key={rep.jmeno}>
                            <TableRow
                              sx={{ backgroundColor: '#f3e5f5', cursor: 'pointer' }}
                              onClick={() => {
                                // Po kliknutí na řádek obchodníka otevřeme detail SalesDetailsByYear
                                setSelectedDetail({ type: 'rep', data: rep, center: st.stredisko });
                              }}
                            >
                              <TableCell sx={{ pl: 4 }}>
                                <IconButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRep(st.stredisko, rep.jmeno);
                                  }}
                                >
                                  {isRepExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </IconButton>
                                Obchodník
                              </TableCell>
                              <TableCell>{rep.jmeno}</TableCell>
                              <TableCell>{repPneuQty}</TableCell>
                              <TableCell>{formatNumber(repPneuPlan)}</TableCell>
                              <TableCell>{repPneuPct}</TableCell>
                              <TableCell>{repProtQty}</TableCell>
                              <TableCell>{formatNumber(repProtPlan)}</TableCell>
                              <TableCell>{repProtPct}</TableCell>
                              <TableCell>{formatNumber(repTotalTrzba)}</TableCell>
                              <TableCell>{formatNumber(repTotalPlan)}</TableCell>
                              <TableCell>{repTotalPct}</TableCell>
                            </TableRow>
                          </React.Fragment>
                        );
                      })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default DashBoard;
