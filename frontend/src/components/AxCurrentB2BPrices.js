import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import {
  Box,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  TableSortLabel
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';

function AxCurrentB2BPrices() {
  const [data, setData] = useState([]);
  const [filterValues, setFilterValues] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const filterLabels = {
    Manufacturer: 'Výrobce',
    Width: 'Šířka',
    Profile: 'Profil',
    Diameter: 'Ráfek',
    Axle: 'Náprava',
    TyreUsage: 'Provoz',
    MarketSegmentation: 'Segmentace trhu'
  };

  useEffect(() => {
    fetchFilterValues();
  }, [filterValues]);

  const fetchFilterValues = async () => {
    try {
      const params = new URLSearchParams(filterValues).toString();
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/get-filter-values?${params}`);
      setFilterOptions(response.data);
    } catch (error) {
      console.error('Error loading filter values:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const searchParams = new URLSearchParams(location.search);
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/getCurrentB2BPrices`, { params: Object.fromEntries(searchParams) });
        setData(response.data);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    fetchData();
  }, [location]);

  const handleFilterChange = (filterName, filterValue) => {
    const newFilterValues = { ...filterValues, [filterName]: filterValue };
    setFilterValues(newFilterValues);

    const newSearchParams = new URLSearchParams(location.search);
    Object.keys(newFilterValues).forEach(key => {
      if (Array.isArray(newFilterValues[key])) {
        newSearchParams.delete(key);
        newFilterValues[key].forEach((value) => {
          newSearchParams.append(key, value);
        });
      } else if (newFilterValues[key]) {
        newSearchParams.set(key, newFilterValues[key]);
      } else {
        newSearchParams.delete(key);
      }
    });

    navigate(`${location.pathname}?${newSearchParams.toString()}`);
  };

  const clearFilter = (filterName) => {
    handleFilterChange(filterName, []);
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedData = data.sort((a, b) => {
    if (orderBy) {
      if (a[orderBy] < b[orderBy]) {
        return order === 'asc' ? -1 : 1;
      }
      if (a[orderBy] > b[orderBy]) {
        return order === 'asc' ? 1 : -1;
      }
      return 0;
    }
    return 0;
  });

  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <h2>Aktuální ceny B2B</h2>

      <Box display="flex" justifyContent="space-between" marginBottom={2} flexWrap="wrap">
        {Object.keys(filterOptions).map((filterKey, index) => (
          <Box key={index} display="flex" alignItems="center" style={{ minWidth: 150, marginRight: 8 }}>
            <FormControl fullWidth>
              <InputLabel>{filterLabels[filterKey] || filterKey}</InputLabel>
              <Select
                multiple={filterKey === 'Manufacturer'}
                value={Array.isArray(filterValues[filterKey]) ? filterValues[filterKey] : (filterKey === 'Manufacturer' ? [] : (filterValues[filterKey] || ''))}
                onChange={(e) => handleFilterChange(filterKey, e.target.value)}
                renderValue={(selected) => (
                  Array.isArray(selected) ? (
                    <Box display="flex" flexWrap="wrap">
                      {selected.map(value => (
                        <Chip key={value} label={value} style={{ margin: 2 }} />
                      ))}
                    </Box>
                  ) : selected
                )}
              >
                <MenuItem value="">
                  <em>Žádný</em>
                </MenuItem>
                {(filterKey === 'Manufacturer' ? Array.from(new Set([...(filterOptions[filterKey] || []), ...(filterValues[filterKey] || [])])) : filterOptions[filterKey])
                  .map((option, index) => (
                    <MenuItem key={index} value={option}>
                      {option}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <IconButton onClick={() => clearFilter(filterKey)} aria-label="clear" size="small" style={{ marginLeft: 8 }}>
              <ClearIcon />
            </IconButton>
          </Box>
        ))}
      </Box>

      <Paper style={{ flex: 1 }}>
        <TableContainer style={{ height: '100%', overflowX: 'auto' }}>
          <Table stickyHeader aria-label="sticky table">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'ItemId'}
                    direction={orderBy === 'ItemId' ? order : 'asc'}
                    onClick={() => handleRequestSort('ItemId')}
                  >
                    Číslo položky
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'Manufacturer'}
                    direction={orderBy === 'Manufacturer' ? order : 'asc'}
                    onClick={() => handleRequestSort('Manufacturer')}
                  >
                    Výrobce
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'ItemName'}
                    direction={orderBy === 'ItemName' ? order : 'asc'}
                    onClick={() => handleRequestSort('ItemName')}
                  >
                    Název
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'EAN'}
                    direction={orderBy === 'EAN' ? order : 'asc'}
                    onClick={() => handleRequestSort('EAN')}
                  >
                    EAN
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'Axle'}
                    direction={orderBy === 'Axle' ? order : 'asc'}
                    onClick={() => handleRequestSort('Axle')}
                  >
                    Náprava
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'TyreUsage'}
                    direction={orderBy === 'TyreUsage' ? order : 'asc'}
                    onClick={() => handleRequestSort('TyreUsage')}
                  >
                    Provoz
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'MarketSegmentation'}
                    direction={orderBy === 'MarketSegmentation' ? order : 'asc'}
                    onClick={() => handleRequestSort('MarketSegmentation')}
                  >
                    Segmentace trhu
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'currentB2BPrice'}
                    direction={orderBy === 'currentB2BPrice' ? order : 'asc'}
                    onClick={() => handleRequestSort('currentB2BPrice')}
                  >
                    Cena AX
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'tyreInfo.SPITotalPrice'}
                    direction={orderBy === 'tyreInfo.SPITotalPrice' ? order : 'asc'}
                    onClick={() => handleRequestSort('tyreInfo.SPITotalPrice')}
                  >
                    Nejnižší cena B2B
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'tyreInfo.SPIStockAmount'}
                    direction={orderBy === 'tyreInfo.SPIStockAmount' ? order : 'asc'}
                    onClick={() => handleRequestSort('tyreInfo.SPIStockAmount')}
                  >
                    Dostupné B2B
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'ruleApplied'}
                    direction={orderBy === 'ruleApplied' ? order : 'asc'}
                    onClick={() => handleRequestSort('ruleApplied')}
                  >
                    Použité pravidlo
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedData.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.ItemId}</TableCell>
                  <TableCell>{item.tyreInfo.Manufacturer}</TableCell>
                  <TableCell>{item.ItemName}</TableCell>
                  <TableCell>{item.tyreInfo.EAN}</TableCell>
                  <TableCell>{item.tyreInfo.Axle}</TableCell>
                  <TableCell>{item.tyreInfo.TyreUsage}</TableCell>
                  <TableCell>{item.tyreInfo.MarketSegmentation}</TableCell>
                  <TableCell>{item.currentB2BPrice}</TableCell>
                  <TableCell>{item.tyreInfo.SPITotalPrice}</TableCell>
                  <TableCell>{item.tyreInfo.SPIStockAmount}</TableCell>
                  <TableCell>{item.ruleApplied}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default AxCurrentB2BPrices;
