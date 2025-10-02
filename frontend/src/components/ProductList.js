import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ColumnFilter from './ColumnFilter';
import { Box, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Button } from '@mui/material';

function ProductList() {
  const [data, setData] = useState([]);
  const [tyreData, setTyreData] = useState([]);
  const [filterValues, setFilterValues] = useState({});
  const [activeRuleFilter, setActiveRuleFilter] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const searchParams = new URLSearchParams(filterValues);
        searchParams.append('activeRuleFilter', activeRuleFilter);

        console.log('Odesílám požadavek s parametry:', Object.fromEntries(searchParams));

        const response = await axios.get(`${process.env.REACT_APP_API_URL}/productlist`, { params: Object.fromEntries(searchParams) });
        setData(response.data);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    fetchData();
  }, [filterValues, activeRuleFilter]);

  const handleFilterChange = (filterName, filterValue) => {
    setFilterValues(prev => {
      const newFilters = { ...prev, [filterName]: filterValue };
      console.log('Filter změněny:', newFilters);
      return newFilters;
    });
  };

  const handleRuleFilterChange = (rule) => {
    setActiveRuleFilter(rule);
    console.log('Aktivní pravidlo změněno na:', rule);
  };

  const fetchTyreData = async () => {
    const itemIds = data.map(item => item.ItemId);
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/getTyreData`, { items: itemIds });
      const fetchedTyreData = response.data;

      setTyreData(fetchedTyreData);

      const updatedData = data.map(item => {
        const tyreInfo = fetchedTyreData.find(tyre => tyre.PartNo === item.ItemId);
        if (tyreInfo) {
          return {
            ...item,
            ...tyreInfo,
            celkemPT: tyreInfo.Celkem,
            nejnizsiCena: tyreInfo.SPILowestPrice,
            nejnizsiCenaMnozstvi: tyreInfo.SPILowestPriceAmount,
          };
        }
        return item;
      });

      setData(updatedData);
    } catch (error) {
      console.error('Error fetching tyre data:', error);
    }
  };

  return (
    <Box height="100vh" display="flex" flexDirection="column">
      <h2>Seznam produktů</h2>
      <Button variant="contained" color="primary" onClick={fetchTyreData} style={{ marginBottom: '16px' }}>
        Načíst data pneu
      </Button>

      <Paper style={{ flex: 1 }}>
        <TableContainer style={{ maxHeight: '100%' }}>
          <Table stickyHeader aria-label="sticky table">
            <TableHead>
              <TableRow>
                <TableCell>
                  Číslo položky
                  <ColumnFilter
                    filterName="ItemId"
                    initialValue={filterValues["ItemId"]}
                    onChange={handleFilterChange}
                  />
                </TableCell>
                <TableCell>
                  Výrobce
                  <ColumnFilter
                    filterName="ItsItemName3"
                    initialValue={filterValues["ItsItemName3"]}
                    onChange={handleFilterChange}
                  />
                </TableCell>
                <TableCell>
                  Sk. řád. slevy
                  <ColumnFilter
                    filterName="PurchLineDisc"
                    initialValue={filterValues["PurchLineDisc"]}
                    onChange={handleFilterChange}
                  />
                </TableCell>
                <TableCell>
                  Název
                  <ColumnFilter
                    filterName="ItemName"
                    initialValue={filterValues["ItemName"]}
                    onChange={handleFilterChange}
                  />
                </TableCell>
                <TableCell>
                  dostupné B2B
                  <ColumnFilter
                    filterName="ItsWebAvailableB2B"
                    initialValue={filterValues["ItsWebAvailableB2B"]}
                    onChange={handleFilterChange}
                  />
                </TableCell>
                <TableCell>
                  dostupné Web
                  <ColumnFilter
                    filterName="ItsWebAvailable"
                    initialValue={filterValues["ItsWebAvailable"]}
                    onChange={handleFilterChange}
                  />
                </TableCell>
                <TableCell>
                  Prodejní cena
                  <ColumnFilter
                    filterName="SalesPrice"
                    initialValue={filterValues["SalesPrice"]}
                    onChange={handleFilterChange}
                  />
                </TableCell>
                {/* Nové sloupce pro zobrazení dat z fetchTyreData */}
                <TableCell>Celkem PT</TableCell>
                <TableCell>Nejnižší cena</TableCell>
                <TableCell>Nejnižší cena množství</TableCell>
                <TableCell>B2B dostupné množství</TableCell>
                <TableCell>Aktivní pravidlo</TableCell>
                <TableCell>1_eshop</TableCell>
                <TableCell>2_pult</TableCell>
                <TableCell>3_servis</TableCell>
                <TableCell>4_vo</TableCell>
                <TableCell>5_vip</TableCell>
                <TableCell>6_indiv</TableCell>
                <TableCell>7_dopravci</TableCell>
                <TableCell>B2B</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.ItemId}</TableCell>
                  <TableCell>{item.ItsItemName3}</TableCell>
                  <TableCell>{item.PurchLineDisc}</TableCell>
                  <TableCell>{item.ItemName}</TableCell>
                  <TableCell>{item.ItsWebAvailableB2B}</TableCell>
                  <TableCell>{item.ItsWebAvailable}</TableCell>
                  <TableCell>{item.SalesPrice}</TableCell>
                  {/* Zobrazení nových dat z fetchTyreData */}
                  <TableCell>{item.celkemPT}</TableCell>
                  <TableCell>{item.nejnizsiCena}</TableCell>
                  <TableCell>{item.nejnizsiCenaMnozstvi}</TableCell>
                  <TableCell>{item.B2B_AvailableAmount}</TableCell>
                  <TableCell>{item.aktivni_pravidlo}</TableCell>
                  <TableCell>{item['1_eshop']}</TableCell>
                  <TableCell>{item['2_pult']}</TableCell>
                  <TableCell>{item['3_servis']}</TableCell>
                  <TableCell>{item['4_vo']}</TableCell>
                  <TableCell>{item['5_vip']}</TableCell>
                  <TableCell>{item['6_indiv']}</TableCell>
                  <TableCell>{item['7_dopravci']}</TableCell>
                  <TableCell>{item['B2B']}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default ProductList;
