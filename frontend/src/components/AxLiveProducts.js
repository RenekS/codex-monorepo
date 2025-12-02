import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ColumnFilter from './ColumnFilter';
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
  TablePagination,
} from '@mui/material';

function AxLiveProducts() {
  const [data, setData] = useState([]);
  const [tyreData, setTyreData] = useState([]);
  const [filterValues, setFilterValues] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const componentType = 'PLAX';

  // 1) Načtení AX produktů z /items (stejně jako dřív)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const searchParams = new URLSearchParams(location.search);
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/items`,
          { params: Object.fromEntries(searchParams) }
        );
        setData(response.data || []);
        setPage(0);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    fetchData();
  }, [location]);

  // 2) Odvozený rozdíl ceny (AX akční cena vs nejnižší B2B) – jen v paměti
  const dataWithDiff = useMemo(() => {
    return data.map(item => {
      let priceDifference = 'N/A';

      if (item.ItsActionPrice === 0) {
        priceDifference = 'Uprav akční cenu';
      } else if (
        item.nejnizsiCena !== null &&
        item.nejnizsiCena !== undefined &&
        item.ItsActionPrice !== null &&
        item.ItsActionPrice !== undefined &&
        item.ItsActionPrice !== 0
      ) {
        priceDifference = item.nejnizsiCena - item.ItsActionPrice;
      }

      return { ...item, priceDifference };
    });
  }, [data]);

  // 3) Stránkování na frontendu
  const visibleRows = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return dataWithDiff.slice(start, end);
  }, [dataWithDiff, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 4) Otisk výsledků – tvůj původní kód
  const saveDataWithFilterToImp = async () => {
    const filterNameUserInput = prompt(
      'Zadejte název filtru:',
      'DefaultníNázevFiltru'
    );
    if (!filterNameUserInput) {
      alert(
        'Uložení filtru bylo zrušeno, protože nebyl zadán žádný název filtru.'
      );
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
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/saveDataWithFilterToImp`,
        {
          data: preparedData,
          filterName: filterNameUserInput,
          userId: currentUser?.userID,
          filterValues: JSON.stringify(
            Object.fromEntries(new URLSearchParams(location.search))
          ),
          filterURL: `http://localhost:3001/ax-live-products${location.search}`,
          componentType: 'PLAX',
        }
      );

      alert('Data byla úspěšně uložena: ' + JSON.stringify(response.data));
    } catch (error) {
      console.error('Nepodařilo se uložit data:', error);
      alert('Nepodařilo se uložit data. Zkuste to prosím znovu.');
    }
  };

  // 5) NOVÉ tlačítko – aktualizace B2B dat z products.xml (jen update v DB)
  const refreshTyreData = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/refreshTyreData`);
      alert('B2B data byla aktualizována z products.xml');
    } catch (error) {
      console.error('Error refreshing tyre data:', error);
      alert('Chyba při aktualizaci B2B dat, zkontroluj log serveru.');
    }
  };

  // 6) Načtení B2B dat z DB pro aktuální položky (zobrazení)
  const fetchTyreData = async () => {
    const itemIds = data.map(item => item.ItemId);
    if (!itemIds || itemIds.length === 0) {
      alert('Nejsou načtené žádné AX produkty.');
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/getTyreData`,
        { items: itemIds }
      );
      const fetchedTyreData = response.data || [];

      console.log('B2B data z /getTyreData:', fetchedTyreData);

      setTyreData(fetchedTyreData);

      const updatedData = data.map(item => {
        const tyreInfo = fetchedTyreData.find(
          tyre => tyre.PartNo === item.ItemId
        );
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
      alert('Chyba při načítání B2B dat, zkontroluj log serveru.');
    }
  };

  const handleFilterChange = (filterName, filterValue) => {
    setFilterValues(prev => ({ ...prev, [filterName]: filterValue }));
    // Předpokládám, že ColumnFilter sám řeší změnu URL / filtrování
  };

  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <h2>Produkty AX</h2>

      <div className="mb-3 d-flex gap-2">
        <button
          onClick={saveDataWithFilterToImp}
          className="btn btn-success"
        >
          Otisk výsledků
        </button>

        <button
          onClick={refreshTyreData}
          className="btn btn-warning"
        >
          Aktualizovat B2B z XML
        </button>

        <button
          onClick={fetchTyreData}
          className="btn btn-primary"
        >
          Načíst data z B2B (DB)
        </button>
      </div>

      <Paper style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TableContainer style={{ flex: 1, overflowX: 'auto' }}>
          <Table stickyHeader aria-label="sticky table">
            <TableHead>
              <TableRow>
                <TableCell>
                  ID dodavatele{' '}
                  <ColumnFilter
                    filterName="PrimaryVendorId"
                    initialValue={filterValues['PrimaryVendorId']}
                    onChange={value =>
                      handleFilterChange('PrimaryVendorId', value)
                    }
                  />
                </TableCell>
                <TableCell>
                  Číslo položky{' '}
                  <ColumnFilter
                    filterName="ItemId"
                    initialValue={filterValues['ItemId']}
                    onChange={value => handleFilterChange('ItemId', value)}
                  />
                </TableCell>
                <TableCell>
                  Výrobce{' '}
                  <ColumnFilter
                    filterName="ItsItemName3"
                    initialValue={filterValues['ItsItemName3']}
                    onChange={value =>
                      handleFilterChange('ItsItemName3', value)
                    }
                  />
                </TableCell>
                <TableCell>
                  Sk. řád. slevy{' '}
                  <ColumnFilter
                    filterName="PurchLineDisc"
                    initialValue={filterValues['PurchLineDisc']}
                    onChange={value =>
                      handleFilterChange('PurchLineDisc', value)
                    }
                  />
                </TableCell>
                <TableCell>
                  Název{' '}
                  <ColumnFilter
                    filterName="ItemName"
                    initialValue={filterValues['ItemName']}
                    onChange={value => handleFilterChange('ItemName', value)}
                  />
                </TableCell>
                <TableCell>
                  Externí číslo položky{' '}
                  <ColumnFilter
                    filterName="ExternalName"
                    initialValue={filterValues['ExternalName']}
                    onChange={value =>
                      handleFilterChange('ExternalName', value)
                    }
                  />
                </TableCell>
                <TableCell>
                  Prodejní cena{' '}
                  <ColumnFilter
                    filterName="SalesPrice"
                    initialValue={filterValues['SalesPrice']}
                    onChange={value =>
                      handleFilterChange('SalesPrice', value)
                    }
                  />
                </TableCell>
                <TableCell>
                  V akci od{' '}
                  <ColumnFilter
                    filterName="ItsActionDateFrom"
                    initialValue={filterValues['ItsActionDateFrom']}
                    onChange={value =>
                      handleFilterChange('ItsActionDateFrom', value)
                    }
                  />
                </TableCell>
                <TableCell>
                  V akci do{' '}
                  <ColumnFilter
                    filterName="ItsActionDateTo"
                    initialValue={filterValues['ItsActionDateTo']}
                    onChange={value =>
                      handleFilterChange('ItsActionDateTo', value)
                    }
                  />
                </TableCell>
                <TableCell>
                  Akční cena{' '}
                  <ColumnFilter
                    filterName="ItsActionPrice"
                    initialValue={filterValues['ItsActionPrice']}
                    onChange={value =>
                      handleFilterChange('ItsActionPrice', value)
                    }
                  />
                </TableCell>
                <TableCell>
                  Marketingová akce{' '}
                  <ColumnFilter
                    filterName="ItsMarketingActionId"
                    initialValue={filterValues['ItsMarketingActionId']}
                    onChange={value =>
                      handleFilterChange('ItsMarketingActionId', value)
                    }
                  />
                </TableCell>
                <TableCell>
                  Dostupnost Web{' '}
                  <ColumnFilter
                    filterName="ItsWebAvailable"
                    initialValue={filterValues['ItsWebAvailable']}
                    onChange={value =>
                      handleFilterChange('ItsWebAvailable', value)
                    }
                  />
                </TableCell>
                <TableCell>
                  Dostupnost B2B{' '}
                  <ColumnFilter
                    filterName="ItsWebAvailableB2B"
                    initialValue={filterValues['ItsWebAvailableB2B']}
                    onChange={value =>
                      handleFilterChange('ItsWebAvailableB2B', value)
                    }
                  />
                </TableCell>
                <TableCell>
                  Skupina řádkové slevy{' '}
                  <ColumnFilter
                    filterName="ItemGroupId"
                    initialValue={filterValues['ItemGroupId']}
                    onChange={value =>
                      handleFilterChange('ItemGroupId', value)
                    }
                  />
                </TableCell>
                <TableCell>
                  Datum prodejní ceny{' '}
                  <ColumnFilter
                    filterName="SalesPriceDate"
                    initialValue={filterValues['SalesPriceDate']}
                    onChange={value =>
                      handleFilterChange('SalesPriceDate', value)
                    }
                  />
                </TableCell>
                <TableCell>Nejnižší Cena B2B</TableCell>
                <TableCell>Množství B2B</TableCell>
                <TableCell>Rozdíl ceny</TableCell>
                <TableCell>Celkem PT</TableCell>
                <TableCell>Spárováno</TableCell>
                <TableCell>B2B sklad</TableCell>
                <TableCell>Web sklad</TableCell>
                <TableCell>B2B akční cena</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {visibleRows.map((item, index) => (
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
                  <TableCell>{item.celkemPT ?? 'N/A'}</TableCell>
                  <TableCell>
                    {item.ID ? (
                      <a
                        href={`https://pneub2b.eu/TyreDetail.aspx?id=${item.ID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ano
                      </a>
                    ) : (
                      ''
                    )}
                  </TableCell>
                  <TableCell>{item.B2B_AvailableAmount}</TableCell>
                  <TableCell>{item.Web_AvailableAmount}</TableCell>
                  <TableCell>{item.ActionPrice}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          rowsPerPageOptions={[25, 50, 100]}
          count={dataWithDiff.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
}

export default AxLiveProducts;
