import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ColumnFilter from './ColumnFilter';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Box, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';

function AxLiveProducts() {
  const [data, setData] = useState([]);
  const [tyreData, setTyreData] = useState([]);
  const [filterValues, setFilterValues] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const componentType = "PLAX";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const searchParams = new URLSearchParams(location.search);
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/items`, { params: Object.fromEntries(searchParams) });
        setData(response.data);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    fetchData();
  }, [location]);

  useEffect(() => {
    const updatedData = data.map(item => {
      let priceDifference = "N/A";
      if (item.ItsActionPrice === 0) {
        priceDifference = "Uprav akční cenu";
      } else if (item.nejnizsiCena !== null && item.ItsActionPrice !== null && item.ItsActionPrice !== 0) {
        priceDifference = item.nejnizsiCena - item.ItsActionPrice;
      }
      return { ...item, priceDifference };
    });

    setData(updatedData);
  }, [data]);

  const saveDataWithFilterToImp = async () => {
    const filterNameUserInput = prompt('Zadejte název filtru:', 'DefaultníNázevFiltru');
    if (!filterNameUserInput) {
      alert('Uložení filtru bylo zrušeno, protože nebyl zadán žádný název filtru.');
      return;
    }

    const preparedData = data.map(item => ({
      dodavatel: item.PrimaryVendorId ?? '',
      externi_cislo_polozky: item.ExternalItemId ?? '',
      nazev_produktu: item.ItemName ?? '',
      prodej_cena: item.SalesPrice ?? 0,
      minimalni_prodejni_cena: item.MinSalesPrice ?? 0,
      v_akci_od: item.ItsActionDateFrom ?? '',
      v_akci_do: item.ItsActionDateTo ?? '',
      akcni_cena: item.ItsActionPrice ?? 0,
      marketingove_akce: item.ItsMarketingActionId ?? '',
      c_polozky: item.ItemId ?? '',
      dostupnost_web: item.ItsWebAvailable ? 'ANO' : 'NE',
      dostupnost_b2b: item.ItsWebAvailableB2B ? 'ANO' : 'NE',
      skupina_radkove_slevy: item.ItemGroupId ?? '',
      sk_polozek: item.SKU ?? 0,
      naklady_cena: item.CostPrice ?? 0,
      prodej_datum_ceny: item.SalesPriceDate ?? '',
      Verze: '1',
    }));

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/saveDataWithFilterToImp`, {
        data: preparedData,
        filterName: filterNameUserInput,
        userId: currentUser?.userID,
        filterValues: JSON.stringify(Object.fromEntries(new URLSearchParams(location.search))),
        filterURL: `http://localhost:3001/ax-live-products${location.search}`,
        componentType: 'PLAX'
      });

      alert('Data byla úspěšně uložena: ' + JSON.stringify(response.data));
    } catch (error) {
      console.error('Nepodařilo se uložit data:', error);
      alert('Nepodařilo se uložit data. Zkuste to prosím znovu.');
    }
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

  const handleFilterChange = (filterName, filterValue) => {
    setFilterValues(prev => ({ ...prev, [filterName]: filterValue }));
  };

  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <h2>Produkty AX</h2>
      <button onClick={saveDataWithFilterToImp} className="btn btn-success mb-3">Otisk výsledků</button>
      <button onClick={fetchTyreData} className="btn btn-primary mb-3">Načíst data z B2B</button>
      <Paper style={{ flex: 1 }}>
        <TableContainer style={{ height: '100%', overflowX: 'auto' }}>
          <Table stickyHeader aria-label="sticky table">
            <TableHead>
              <TableRow>
                <TableCell>ID dodavatele <ColumnFilter filterName="PrimaryVendorId" initialValue={filterValues["PrimaryVendorId"]} onChange={value => handleFilterChange("PrimaryVendorId", value)} /></TableCell>
                <TableCell>Číslo položky <ColumnFilter filterName="ItemId" initialValue={filterValues["ItemId"]} onChange={value => handleFilterChange("ItemId", value)} /></TableCell>
                <TableCell>Výrobce <ColumnFilter filterName="ItsItemName3" initialValue={filterValues["ItsItemName3"]} onChange={value => handleFilterChange("ItsItemName3", value)} /></TableCell>
                <TableCell>Sk. řád. slevy <ColumnFilter filterName="PurchLineDisc" initialValue={filterValues["PurchLineDisc"]} onChange={value => handleFilterChange("PurchLineDisc", value)} /></TableCell>
                <TableCell>Název <ColumnFilter filterName="ItemName" initialValue={filterValues["ItemName"]} onChange={value => handleFilterChange("ItemName", value)} /></TableCell>
                <TableCell>Externí číslo položky <ColumnFilter filterName="ExternalName" initialValue={filterValues["ExternalName"]} onChange={value => handleFilterChange("ExternalName", value)} /></TableCell>
                <TableCell>Prodejní cena <ColumnFilter filterName="SalesPrice" initialValue={filterValues["SalesPrice"]} onChange={value => handleFilterChange("SalesPrice", value)} /></TableCell>
                <TableCell>V akci od <ColumnFilter filterName="ItsActionDateFrom" initialValue={filterValues["ItsActionDateFrom"]} onChange={value => handleFilterChange("ItsActionDateFrom", value)} /></TableCell>
                <TableCell>V akci do <ColumnFilter filterName="ItsActionDateTo" initialValue={filterValues["ItsActionDateTo"]} onChange={value => handleFilterChange("ItsActionDateTo", value)} /></TableCell>
                <TableCell>Akční cena <ColumnFilter filterName="ItsActionPrice" initialValue={filterValues["ItsActionPrice"]} onChange={value => handleFilterChange("ItsActionPrice", value)} /></TableCell>
                <TableCell>Marketingová akce <ColumnFilter filterName="ItsMarketingActionId" initialValue={filterValues["PrimaryVendorId"]} onChange={value => handleFilterChange("PrimaryVendorId", value)} /></TableCell>
                <TableCell>Dostupnost Web <ColumnFilter filterName="ItsWebAvailable" initialValue={filterValues["ItsWebAvailable"]} onChange={value => handleFilterChange("ItsWebAvailable", value)} /></TableCell>
                <TableCell>Dostupnost B2B <ColumnFilter filterName="ItsWebAvailableB2B" initialValue={filterValues["ItsWebAvailableB2B"]} onChange={value => handleFilterChange("ItsWebAvailableB2B", value)} /></TableCell>
                <TableCell>Skupina řádkové slevy <ColumnFilter filterName="ItemGroupId" initialValue={filterValues["ItemGroupId"]} onChange={value => handleFilterChange("ItemGroupId", value)} /></TableCell>
                <TableCell>Datum prodejní ceny <ColumnFilter filterName="SalesPriceDate" initialValue={filterValues["SalesPriceDate"]} onChange={value => handleFilterChange("SalesPriceDate", value)} /></TableCell>
                <TableCell>Nejnižší Cena B2B</TableCell>
                <TableCell>Množství B2B</TableCell>
                <TableCell>Rozdíl ceny</TableCell>
                <TableCell>Celkem PT</TableCell>
                <TableCell>Spárováno</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.PrimaryVendorId}</TableCell>
                  <TableCell>{item.ItemId}</TableCell>
                  <TableCell>{item.ItsItemName3}</TableCell>
                  <TableCell>{item.PurchLineDisc}</TableCell>
                  <TableCell>{item.ItemName}</TableCell>
                  <TableCell>{item.ExternalName}</TableCell>
                  <TableCell>{item.SalesPrice}</TableCell>
                  <TableCell>{item.ItsActionDateFrom}</TableCell>
                  <TableCell>{item.ItsActionDateTo}</TableCell>
                  <TableCell>{item.ItsActionPrice}</TableCell>
                  <TableCell>{item.ItsMarketingActionId}</TableCell>
                  <TableCell>{item.ItsWebAvailable}</TableCell>
                  <TableCell>{item.ItsWebAvailableB2B}</TableCell>
                  <TableCell>{item.ItemGroupId}</TableCell>
                  <TableCell>{item.SalesPriceDate}</TableCell>
                  <TableCell>{item.nejnizsiCena}</TableCell>
                  <TableCell>{item.nejnizsiCenaMnozstvi}</TableCell>
                  <TableCell>{item.priceDifference}</TableCell>
                  <TableCell>{item.celkemPT ?? "N/A"}</TableCell>
                  <TableCell>
                    {item.ID ? <a href={`https://pneub2b.eu/TyreDetail.aspx?id=${item.ID}`} target="_blank" rel="noopener noreferrer">Ano</a> : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default AxLiveProducts;
