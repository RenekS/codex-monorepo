import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Tooltip,
  Alert,
  Button,
  TablePagination
} from '@mui/material';
import axios from 'axios';
import PriceListFilterModal from './PriceListFilterModal';
import PriceListItemsModal from './PriceListItemsModal';

// Pole porovnávaných (editovatelných) hodnot – přidané sloupce MS (M+S) a Mountain jsou vloženy za sloupec Pattern
const comparedFields = [
  "EAN",
  "DisplayName",
  "Manufacturer",
  "Pattern",
  "MS",         // bude zobrazeno jako M+S
  "Mountain",   // zobrazí se jako Mountain
  "RetailPrice_CZ",
  "Axle",
  "TyreUsage",
  "Width",
  "Profile",
  "Diameter",
  "LoadIndexFrom",
  "LoadIndexTo",
  "SpeedIndex",
  "SpeedIndexTo",
  "ImageUrl",
  "TagV2021_FuelEfficiencyClass",
  "TagV2021_RollingNoise",
  "TagV2021_RollingNoise_dB",
  "TagV2021_WetGripClass"
];

// Neporovnávané sloupce – pouze zobrazení původní hodnoty
const nonComparedFields = [
  "1_eshop",
  "2_pult",
  "3_servis",
  "4_vo",
  "5_vip",
  "6_indiv",
  "7_dopravci",
  "B2B"
];

// EditableCell – lokální stav se aktualizuje až při onBlur
const EditableCell = memo(({ value, onCommit }) => {
  const [localValue, setLocalValue] = useState(value || '');
  
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  return (
    <TextField
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => onCommit(localValue)}
      variant="outlined"
      size="small"
      fullWidth
    />
  );
});

// EditableRow – memoizovaná komponenta pro jednotlivý řádek tabulky
const EditableRow = memo(({
  product,
  getDisplayValue,
  onCellCommit,
  onOverwriteCellAx,
  onOverwriteCellB2B,
  onOverwriteRowAx,
  onOverwriteRowB2B,
  onOverwriteRowImg,
  comparedFields,
  nonComparedFields
}) => {
  const { PartNo } = product;
  return (
    <TableRow>
      <TableCell>{PartNo}</TableCell>
      {comparedFields.map(field => {
        const originalValue = product[field];
        const displayValue = getDisplayValue(PartNo, field, originalValue);
        const importedValueAX = product.axData ? product.axData[field] : null;
        const importedValueB2B = product.b2bData ? product.b2bData[field] : null;
        return (
          <TableCell key={field} align="center">
            <Box display="flex" flexDirection="column" alignItems="center">
              <EditableCell
                value={displayValue}
                onCommit={(val) => onCellCommit(PartNo, field, val)}
              />
              <Box display="flex" gap={1} mt={1}>
                {importedValueAX !== null &&
                 importedValueAX !== undefined &&
                 importedValueAX !== '' &&
                 importedValueAX !== originalValue && (
                  <Tooltip title="Přepsat původní hodnotu hodnotou z AX">
                    <Button
                      variant="contained"
                      onClick={() => onOverwriteCellAx(PartNo, field)}
                      style={{
                        minWidth: 0,
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        padding: 0,
                        fontSize: 10
                      }}
                    >
                      AX
                    </Button>
                  </Tooltip>
                )}
                {importedValueB2B !== null &&
                 importedValueB2B !== undefined &&
                 importedValueB2B !== '' &&
                 importedValueB2B !== originalValue && (
                  <Tooltip title="Přepsat původní hodnotu hodnotou z B2B">
                    <Button
                      variant="contained"
                      onClick={() => onOverwriteCellB2B(PartNo, field)}
                      style={{
                        minWidth: 0,
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        padding: 0,
                        fontSize: 10
                      }}
                    >
                      B2B
                    </Button>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </TableCell>
        );
      })}
      {nonComparedFields.map(field => (
        <TableCell key={field} align="center">
          {product[field] || '-'}
        </TableCell>
      ))}
      <TableCell align="center">
        <Box display="flex" gap={1}>
          {product.axData && (
            <Tooltip title="Přepsat celý řádek hodnotami z AX">
              <Button
                variant="contained"
                onClick={() => onOverwriteRowAx(PartNo)}
                style={{
                  minWidth: 0,
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  padding: 0,
                  fontSize: 10
                }}
              >
                AX
              </Button>
            </Tooltip>
          )}
          {product.b2bData && (
            <Tooltip title="Přepsat celý řádek hodnotami z B2B">
              <Button
                variant="contained"
                onClick={() => onOverwriteRowB2B(PartNo)}
                style={{
                  minWidth: 0,
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  padding: 0,
                  fontSize: 10
                }}
              >
                B2B
              </Button>
            </Tooltip>
          )}
          {product.PatternImageUrl && (
            <Tooltip title="Přepsat celý řádek hodnotou z Pattern">
              <Button
                variant="contained"
                onClick={() => onOverwriteRowImg(PartNo)}
                style={{
                  minWidth: 0,
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  padding: 0,
                  fontSize: 10
                }}
              >
                IMG
              </Button>
            </Tooltip>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
});

const ProductImportComparison = () => {
  const [products, setProducts] = useState([]);
  const [axProducts, setAxProducts] = useState([]);
  const [b2bProducts, setB2bProducts] = useState([]);
  const [patternImages, setPatternImages] = useState([]); // Stav pro seznam obrázků
  const [editedValues, setEditedValues] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [itemsModalOpen, setItemsModalOpen] = useState(false);
  const [selectedPriceListId, setSelectedPriceListId] = useState(null);
  
  // Stav pro stránkování
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Stav pro filtrování podle Manufacturer
  const [manufacturerFilter, setManufacturerFilter] = useState('');

  // Načtení původních dat z /products
  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/products`);
      setProducts(response.data);
    } catch (error) {
      console.error('Chyba při načítání produktů:', error);
    }
  };

  // Načtení B2B dat z /b2b_products pomocí PartNo
  const fetchB2BData = async () => {
    if (!products || products.length === 0) return;
    const partNos = products.map(product => product.PartNo).join(',');
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/b2b_products?partNos=${partNos}`);
      setB2bProducts(response.data);
    } catch (error) {
      console.error('Chyba při načítání B2B dat:', error);
    }
  };

  // Načtení AX dat – voláme endpoint /ax_items místo /ax_products
  const fetchAXData = async () => {
    if (!products || products.length === 0) return;
    const partNos = products.map(product => product.PartNo).join(',');
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/ax_items?partNos=${partNos}`);
      setAxProducts(response.data);
    } catch (error) {
      console.error('Chyba při načítání AX dat:', error);
    }
  };

  // Načtení obrázků z uložiště – endpoint vrací seznam souborů
  const fetchPatternImages = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/pattern_images`);
      setPatternImages(response.data);
    } catch (error) {
      console.error('Chyba při načítání obrázků:', error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Pomocná funkce – pokud má produkt hodnotu Pattern, najdeme odpovídající soubor
  const getPatternImageUrl = (product) => {
    if (!product.Pattern || patternImages.length === 0) return null;
    const patternLower = product.Pattern.toLowerCase();
    const jpgFile = patternImages.find(file => file.toLowerCase() === `${patternLower}.jpg`);
    if (jpgFile) {
      return `\\\\10.60.5.41\\aif\\Images\\Patterns\\${jpgFile}`;
    }
    const pngFile = patternImages.find(file => file.toLowerCase() === `${patternLower}.png`);
    if (pngFile) {
      return `\\\\10.60.5.41\\aif\\Images\\Patterns\\${pngFile}`;
    }
    return null;
  };

  // Sloučení dat s využitím useMemo
  const mergedData = useMemo(() => {
    return products.map(product => {
      const b2bData = b2bProducts.find(b => b.PartNo === product.PartNo) || null;
      const axData = axProducts.find(a => a.PartNo === product.PartNo) || null;
      const PatternImageUrl = getPatternImageUrl(product);
      return { ...product, b2bData, axData, PatternImageUrl };
    });
  }, [products, b2bProducts, axProducts, patternImages]);

  // Filtrování podle Manufacturer
  const filteredData = useMemo(() => {
    if (!manufacturerFilter) return mergedData;
    return mergedData.filter(product =>
      product.Manufacturer &&
      product.Manufacturer.toLowerCase().includes(manufacturerFilter.toLowerCase())
    );
  }, [mergedData, manufacturerFilter]);

  // Výpočet dat pro aktuální stránku
  const paginatedData = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  // Vrátí hodnotu pro zobrazení
  const getDisplayValue = useCallback((PartNo, field, originalValue) => {
    return editedValues[PartNo]?.[field] !== undefined ? editedValues[PartNo][field] : originalValue;
  }, [editedValues]);

  // Aktualizace hodnot
  const handleCellCommit = (PartNo, field, value) => {
    setEditedValues(prev => ({
      ...prev,
      [PartNo]: {
        ...prev[PartNo],
        [field]: value
      }
    }));
  };

  // Přepíše buňku – hodnotu z B2B
  const handleOverwriteCellB2B = (PartNo, field) => {
    const product = mergedData.find(p => p.PartNo === PartNo);
    if (product && product.b2bData && product.b2bData[field] !== undefined) {
      handleCellCommit(PartNo, field, product.b2bData[field]);
    }
  };

  // Přepíše buňku – hodnotu z AX
  const handleOverwriteCellAx = (PartNo, field) => {
    const product = mergedData.find(p => p.PartNo === PartNo);
    if (product && product.axData && product.axData[field] !== undefined) {
      handleCellCommit(PartNo, field, product.axData[field]);
    }
  };

  // Přepíše buňku – hodnotu z obrázku (Pattern)
  const handleOverwriteCellImg = (PartNo) => {
    const product = mergedData.find(p => p.PartNo === PartNo);
    if (product && product.PatternImageUrl) {
      handleCellCommit(PartNo, "ImageUrl", product.PatternImageUrl);
    }
  };

  // Přepíše celý řádek – hodnoty z B2B
  const handleOverwriteRowB2B = (PartNo) => {
    const product = mergedData.find(p => p.PartNo === PartNo);
    if (!product || !product.b2bData) return;
    comparedFields.forEach(field => {
      if (product.b2bData[field] !== undefined) {
        handleCellCommit(PartNo, field, product.b2bData[field]);
      }
    });
  };

  // Přepíše celý řádek – hodnoty z AX
  const handleOverwriteRowAx = (PartNo) => {
    const product = mergedData.find(p => p.PartNo === PartNo);
    if (!product || !product.axData) return;
    comparedFields.forEach(field => {
      if (product.axData[field] !== undefined) {
        handleCellCommit(PartNo, field, product.axData[field]);
      }
    });
  };

  // Přepíše celý řádek – hodnotu z Pattern (IMG)
  const handleOverwriteRowImg = (PartNo) => {
    const product = mergedData.find(p => p.PartNo === PartNo);
    if (product && product.PatternImageUrl) {
      handleCellCommit(PartNo, "ImageUrl", product.PatternImageUrl);
    }
  };

  // Přepíše celý sloupec – hodnoty z B2B
  const handleOverwriteColumnB2B = (field) => {
    mergedData.forEach(product => {
      if (product.b2bData && product.b2bData[field] !== undefined) {
        handleCellCommit(product.PartNo, field, product.b2bData[field]);
      }
    });
  };

  // Přepíše celý sloupec – hodnoty z AX
  const handleOverwriteColumnAx = (field) => {
    mergedData.forEach(product => {
      if (product.axData && product.axData[field] !== undefined) {
        handleCellCommit(product.PartNo, field, product.axData[field]);
      }
    });
  };

  // Přepíše celý sloupec – hodnoty z Pattern (IMG)
  const handleOverwriteColumnImg = () => {
    mergedData.forEach(product => {
      if (product.PatternImageUrl) {
        handleCellCommit(product.PartNo, "ImageUrl", product.PatternImageUrl);
      }
    });
  };

  // Uložení změn
  const handleSave = async () => {
    try {
      for (const PartNo in editedValues) {
        const product = mergedData.find(p => p.PartNo === PartNo);
        if (!product) continue;
        const updatedProduct = { ...product, ...editedValues[PartNo] };
        await axios.put(`${process.env.REACT_APP_API_URL}/update_product`, updatedProduct);
      }
      setSaveStatus('success');
      alert("Data byla úspěšně uložena.");
      fetchProducts();
    } catch (error) {
      console.error("Chyba při ukládání dat:", error);
      setSaveStatus('error');
      alert("Při ukládání dat došlo k chybě.");
    }
  };

  // Callback pro aplikaci filtrů z modalu
  const handleApplyFilters = (filters) => {
    setAppliedFilters(filters);
    setSelectedPriceListId(filters.filterId);
    setFilterModalOpen(false);
    setItemsModalOpen(true);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box p={2}>
      <Typography variant="h4" gutterBottom>
        Porovnání a import dat
      </Typography>
      <Box mb={2} display="flex" alignItems="center" gap={2}>
        <Button variant="contained" color="primary" onClick={fetchB2BData}>
          Načíst data z B2B
        </Button>
        <Button variant="contained" color="primary" onClick={fetchAXData}>
          Načíst data z AX
        </Button>
        <Button variant="contained" color="primary" onClick={fetchPatternImages}>
          Načíst obrázky z uložiště
        </Button>
        <Button variant="contained" color="secondary" onClick={handleSave}>
          Uložit importovaná data do ceníku
        </Button>
        <Button variant="contained" onClick={() => setFilterModalOpen(true)}>
          Filtr ceníků
        </Button>
      </Box>
      {/* Vstupní pole pro filtrování podle Manufacturer */}
      <Box mb={2}>
        <TextField
          label="Filtr podle Manufacturer"
          variant="outlined"
          value={manufacturerFilter}
          onChange={(e) => {
            setManufacturerFilter(e.target.value);
            setPage(0);
          }}
          fullWidth
        />
      </Box>
      <Box sx={{ overflowX: 'auto' }}>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 1500 }}>
            <TableHead>
              <TableRow>
                <TableCell>PartNo</TableCell>
                {comparedFields.map(field => (
                  <TableCell key={field} align="center">
                    <Box display="flex" flexDirection="column" alignItems="center">
                      {/* Upravíme popisek: pokud je pole "MS", zobrazí se "M+S", jinak se zobrazí název sloupce */}
                      {field === "MS" ? "M+S" : field}
                      <Box display="flex" gap={1}>
                        {field === "ImageUrl" && patternImages.length > 0 && (
                          <Tooltip title="Přepsat celý sloupec hodnotou z Pattern">
                            <Button
                              variant="contained"
                              onClick={handleOverwriteColumnImg}
                              style={{
                                minWidth: 0,
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                padding: 0,
                                fontSize: 10
                              }}
                            >
                              IMG
                            </Button>
                          </Tooltip>
                        )}
                        {axProducts.length > 0 && (
                          <Tooltip title="Přepsat celý sloupec hodnotami z AX">
                            <Button
                              variant="contained"
                              onClick={() => handleOverwriteColumnAx(field)}
                              style={{
                                minWidth: 0,
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                padding: 0,
                                fontSize: 10
                              }}
                            >
                              AX
                            </Button>
                          </Tooltip>
                        )}
                        {b2bProducts.length > 0 && (
                          <Tooltip title="Přepsat celý sloupec hodnotami z B2B">
                            <Button
                              variant="contained"
                              onClick={() => handleOverwriteColumnB2B(field)}
                              style={{
                                minWidth: 0,
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                padding: 0,
                                fontSize: 10
                              }}
                            >
                              B2B
                            </Button>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                ))}
                {nonComparedFields.map(field => (
                  <TableCell key={field} align="center">
                    {field}
                  </TableCell>
                ))}
                <TableCell align="center">Akce</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map(product => (
                <EditableRow
                  key={product.PartNo}
                  product={product}
                  getDisplayValue={getDisplayValue}
                  onCellCommit={handleCellCommit}
                  onOverwriteCellAx={handleOverwriteCellAx}
                  onOverwriteCellB2B={handleOverwriteCellB2B}
                  onOverwriteRowAx={handleOverwriteRowAx}
                  onOverwriteRowB2B={handleOverwriteRowB2B}
                  onOverwriteRowImg={handleOverwriteRowImg}
                  comparedFields={comparedFields}
                  nonComparedFields={nonComparedFields}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      <TablePagination
        component="div"
        count={filteredData.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
      {mergedData.some(product => (!product.b2bData && !product.axData)) && (
        <Box mt={2}>
          <Alert severity="warning">
            Některé produkty nejsou spárovány s daty z B2B nebo AX – pro tyto produkty nebude možno importovat data.
          </Alert>
        </Box>
      )}
      <PriceListFilterModal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        onApply={handleApplyFilters}
        initialValues={{ filterId: '', isActive: true }}
      />
      <PriceListItemsModal
        open={itemsModalOpen}
        onClose={() => setItemsModalOpen(false)}
        priceListId={selectedPriceListId}
      />
    </Box>
  );
};

export default ProductImportComparison;
