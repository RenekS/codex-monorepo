/****************************************************
 * src/components/RaynetPriceListModal.js
 ****************************************************/

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Typography,
  Box,
  Snackbar,
  Alert,
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody
} from '@mui/material';
import PropTypes from 'prop-types';
import axios from 'axios';
import {
  fetchActivePriceListsByProductGroup,
  findProductByCode,
  assignProductToPriceList,
  createProductRaynet,
  updateProductRaynet,
} from '../api/raynetApi';

// Konstanty
const PRODUCT_CATEGORY_ID = 144;
const PRICE_LIST_CODES = [
  { code: '1_eshop', name: 'Eshop' },
  { code: '2_pult', name: 'Pult' },
  { code: '3_servis', name: 'Servis' },
  { code: '4_vo', name: 'VO' },
  { code: '5_vip', name: 'VIP' },
  { code: '6_indiv', name: 'Indiv' },
  { code: '7_dopravci', name: 'Dopravci' },
];

// --- Definice funkce limitValidityForConflictingPriceLists ---
const limitValidityForConflictingPriceLists = async (conflictingPriceLists, newValidFrom) => {
  const newValidTill = (() => {
    const date = new Date(newValidFrom);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  })();
  const priceListIds = conflictingPriceLists.map(pl => pl.id);
  console.log(`Limituji platnost ceníků [${priceListIds.join(', ')}] do: ${newValidTill}`);
  try {
    const response = await axios.post(`${process.env.REACT_APP_API_URL}/raynet/price-lists/limit-validity`, {
      priceListIds,
      validTill: newValidTill
    });
    console.log('Odpověď z /raynet/price-lists/limit-validity:', response.data);
    return response.data;
  } catch (error) {
    console.error('Chyba při volání endpointu limit-validity:', error.response ? error.response.data : error.message);
    throw new Error('Chyba při aktualizaci platnosti ceníků');
  }
};
// ---------------------- Volání endpointu /raynet/price-lists ----------------------
const fetchCurrentPriceLists = async (queryParams = {}) => {
  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/raynet/price-lists`, {
      params: queryParams,
    });
    console.log('Získané ceníky z /raynet/price-lists:', response.data);
    // Předpokládáme, že response.data.data obsahuje pole ceníků
    return response.data.data;
  } catch (error) {
    console.error('Chyba při načítání ceníků z Raynet CRM:', error.response ? error.response.data : error.message);
    throw new Error('Chyba při načítání ceníků z Raynet CRM');
  }
};

// ---------------------- Wait for Catalog Function ----------------------
const waitForCatalog = async (priceListId, maxAttempts = 10, delayMs = 1000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const priceListsResponse = await fetchCurrentPriceLists({ id: priceListId });
      const catalogExists = priceListsResponse.some(pl => pl.id === priceListId || pl.priceListId === priceListId);
      if (catalogExists) {
        console.log(`Katalog s ID ${priceListId} nalezen při pokusu č. ${attempt}.`);
        return true;
      }
    } catch (error) {
      console.error('Chyba při kontrole existence katalogu:', error);
    }
    console.log(`Katalog s ID ${priceListId} nenalezen – čekám ${delayMs} ms (pokus č. ${attempt}).`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
};

// ---------------------- Výpočet nového validTill (den před validFrom) ----------------------
const calculateNewValidTill = (newValidFrom) => {
  const date = new Date(newValidFrom);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0]; // formát "YYYY-MM-DD"
};

// ---------------------- Omezení platnosti ceníků ----------------------
const limitPriceListsValidity = async (priceListIds, newValidTill) => {
  try {
    console.log(`Omezuji ceníky [${priceListIds.join(', ')}] do: ${newValidTill}`);
    const response = await axios.post(`${process.env.REACT_APP_API_URL}/raynet/price-lists/limit-validity`, {
      priceListIds,
      validTill: newValidTill,
    });
    console.log('Odpověď z /raynet/price-lists/limit-validity:', response.data);
    return response.data;
  } catch (error) {
    console.error('Chyba při volání /raynet/price-lists/limit-validity:', error.response ? error.response.data : error.message);
    throw new Error('Chyba při aktualizaci platnosti ceníků');
  }
};

// ---------------------- Ověření a aktualizace platnosti starých ceníků ----------------------
const updateExistingPriceListsValidity = async (newValidFrom, selectedSheet) => {
  console.log('updateExistingPriceListsValidity: newValidFrom:', newValidFrom, 'selectedSheet:', selectedSheet);
  try {
    // Můžeme předat i další parametry podle potřeby (např. code[LIKE], offset, limit apod.)
    const params = {
      offset: 0,
      limit: 1000,
      "code[LIKE]": "%SF01040%", // případně můžete použít dynamickou hodnotu např. `%${selectedSheet}%`
      ...(newValidFrom ? { "validFrom[LE]": newValidFrom } : {}),
      sortColumn: "code",
      sortDirection: "DESC"
    };

    const priceLists = await fetchCurrentPriceLists(params);

    // Datum importu (nového ceníku)
    const importedDate = new Date(newValidFrom);
    // Filtrovat pouze ty ceníky, jejichž interval platnosti obsahuje datum importu
    const filteredPriceLists = priceLists.filter(pl => {
      const plValidFrom = new Date(pl.validFrom);
      const plValidTill = pl.validTill ? new Date(pl.validTill) : new Date('9999-12-31');
      return plValidFrom <= importedDate && importedDate <= plValidTill;
    });

    // Seřadíme ceníky podle verze (očekáváme, že kód obsahuje "_V<number>")
    const sortedPriceLists = filteredPriceLists.sort((a, b) => {
      const extractVersion = (code) => {
        const match = code.match(/_V(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      };
      return extractVersion(b.code) - extractVersion(a.code);
    });

    // Uložíme pouze konfliktní ceníky do stavu (ty, které kolidují s datem importu)
    return sortedPriceLists;
  } catch (error) {
    console.error('Chyba při updateExistingPriceListsValidity:', error);
    throw error;
  }
};

// ---------------------- HLAVNÍ KOMPONENTA (Modal) ----------------------
const RaynetPriceListModal = (props) => {
  const {
    open,
    onClose,
    version,
    selectedSheet,
    validFrom,
    validTo,
    manufacturer,
    mainVersion,
    data,              // Data obsahující produkty k exportu
    additionalColumns,
    axData,
  } = props;

  const [isExporting, setIsExporting] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [existingPriceLists, setExistingPriceLists] = useState([]);
  const [loadingPriceLists, setLoadingPriceLists] = useState(true);
  const [priceListCategoryIds, setPriceListCategoryIds] = useState({});
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [customFieldsConfig, setCustomFieldsConfig] = useState(null);
  const [loadingCustomFields, setLoadingCustomFields] = useState(true);

  // ---------------------- useEffect pro otevření dialogu ----------------------
  useEffect(() => {
    if (open) {
      loadExistingPriceLists();
      fetchCustomFieldsConfig();
    }
  }, [open]);

  // ---------------------- Načtení custom fields config ----------------------
  const fetchCustomFieldsConfig = async () => {
    try {
      const resp = await axios.get(`${process.env.REACT_APP_API_URL}/raynet/custom-fields-config`);
      if (resp.data && resp.data.success) {
        setCustomFieldsConfig(resp.data.data);
        console.log('Custom Fields Config:', resp.data.data);
      } else {
        console.warn('Neúspěšné načtení custom fields config:', resp.data);
      }
    } catch (error) {
      console.error('Chyba při načítání custom fields:', error);
      setSnackbarMessage('Chyba při načítání custom fields z Raynet CRM.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setLoadingCustomFields(false);
      fetchPriceListCategories();
    }
  };

  // ---------------------- Načtení kategorií ceníků ----------------------
  const fetchPriceListCategories = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/raynet/price-list-categories`);
      console.log('Odpověď z /raynet/price-list-categories:', response.data);
      if (response.data && response.data.success) {
        const categories = response.data.data;
        const categoryIds = {};
        PRICE_LIST_CODES.forEach(group => {
          const foundCategory = categories.find(cat => cat.code01 === group.code);
          if (foundCategory) {
            categoryIds[group.code] = foundCategory.id;
            console.log(`Kategorie ${group.code} nalezena s ID: ${foundCategory.id}`);
          } else {
            console.warn(`Kategorie ${group.code} nebyla nalezena.`);
            setSnackbarMessage(`Kategorie ${group.code} nebyla nalezena.`);
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
          }
        });
        setPriceListCategoryIds(categoryIds);
      } else {
        console.warn('Neúspěšné načtení kategorií ceníků:', response.data);
      }
    } catch (error) {
      console.error('Chyba při načítání kategorií ceníků:', error);
      setSnackbarMessage('Chyba při načítání kategorií ceníků z Raynet CRM.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setCategoriesLoaded(true);
    }
  };

  // ---------------------- Načtení existujících ceníků (konfliktní) ----------------------
  // Použijeme upravenou logiku, která vezme pouze ty ceníky, jejichž interval platnosti obsahuje datum importu.
  const loadExistingPriceLists = async () => {
    setLoadingPriceLists(true);
    try {
      const conflicts = await updateExistingPriceListsValidity(validFrom, selectedSheet);
      setExistingPriceLists(conflicts);
    } catch (error) {
      console.error('Chyba při načítání existujících ceníků:', error);
      setSnackbarMessage('Chyba při načítání existujících ceníků.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setLoadingPriceLists(false);
    }
  };

  // ---------------------- Pomocné funkce ----------------------
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date)) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // ---------------------- Mapování custom fields ----------------------
  const mapCustomFields = (productRow) => {
    const customFieldMapping = {
      'SelectedIndex nosnosti': 'Index_nosn_85ad2',
      'SelectedIndex rychlosti': 'Index_rych_a74ff',
      'SelectedNaprava': 'Naprava_fe9fa',
      'SelectedProvoz': 'Provoz_2c25f',
      'SelectedM_S': 'M_S_50472',
      'SelectedTPM_S': 'Vlocka_v_h_d2e18',
      'SelectedZesileni': 'Zesileni',
      'SelectedSirka': 'Sirka_04504',
      'SelectedProfil': 'Profil_c69ed',
      'SelectedRafek': 'Rafek_1f4ee',
      'Dezen': 'Dezen_e771c',
      'Přilnavost': 'Prilnavost_51382',
      'Hmotnost': 'Hmotnost_b88b1',
      'Rozmer': 'Rozmer_5ce97',
      'Valivy_odpor': 'Spotreba_c9ea4',
      'Hluk_db' : 'Hluk_db_f9469'
    };

    const result = {};
    Object.keys(customFieldMapping).forEach(frontendKey => {
      const raynetField = customFieldMapping[frontendKey];
      const value = productRow[frontendKey];
      if (value !== undefined && value !== null) {
        if (typeof value === 'string') {
          const trimmedValue = value.trim();
          if (trimmedValue !== '') {
            result[raynetField] = trimmedValue;
          }
        } else {
          const asString = String(value).trim();
          if (asString !== '') {
            result[raynetField] = asString;
          }
        }
      }
    });
    return result;
  };

  // ---------------------- Vytvoření/aktualizace produktu ----------------------
  const createOrUpdateProduct = async (productRow, manufacturer) => {
    try {
      console.log(`createOrUpdateProduct: Hledám produkt s kódem: ${productRow.C_Polozky}.`);
      const searchResponse = await findProductByCode(productRow.C_Polozky);
      let productId;
      if (searchResponse && searchResponse.id) {
        productId = searchResponse.id;
        console.log(`Produkt nalezen s ID: ${productId}.`);
      } else {
        console.log(`Produkt ${productRow.C_Polozky} nebyl nalezen, vytvářím nový.`);
        const createProductPayload = {
          code: productRow.C_Polozky,
          name: `${manufacturer} ${productRow.Nazev}`,
          unit: productRow.unit || 'ks',
          category: PRODUCT_CATEGORY_ID,
          productLine: productRow.productLine ? productRow.productLine.id : 149,
          cost: parseFloat(productRow.Nakup_cena) || 0,
          price: parseFloat(productRow.Cena) || 0,
          customFields: mapCustomFields(productRow)
        };
        const createProductResponse = await createProductRaynet(createProductPayload);
        productId = createProductResponse.data.id;
      }
      if (!productId) {
        throw new Error(`Nelze získat ID produktu pro kód: ${productRow.C_Polozky}`);
      }
      return productId;
    } catch (error) {
      console.error(`createOrUpdateProduct: Chyba pro ${productRow.C_Polozky}:`, error);
      throw new Error(`Error in createOrUpdateProduct: ${error.message}`);
    }
  };

  // ---------------------- Přiřazení produktu do ceníku ----------------------
  const assignProduct = async (priceListId, productId, finalPrice, purchasePrice) => {
    try {
      console.log(`Přiřazuji produkt ID ${productId} k ceníku ${priceListId}, cena ${finalPrice}, nákup ${purchasePrice}.`);
      const assignResponse = await assignProductToPriceList(priceListId, productId, finalPrice, purchasePrice);
      console.log('Odpověď assignProductToPriceList:', assignResponse.data);
      return true;
    } catch (error) {
      console.error(`Chyba při přiřazení produktu ${productId}:`, error);
      return false;
    }
  };

  // ---------------------- HLAVNÍ FUNKCE EXPORTU ----------------------
  const handleExport = async () => {
    console.log('handleExport: Spouštím export do Raynet.');
    if (!validFrom) {
      setSnackbarMessage('Pole "Platnost od" musí být vyplněno před exportem.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    if (!data || data.length === 0) {
      setSnackbarMessage('Nejsou dostupná žádná data k exportu.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    setIsExporting(true);
    try {
      const versionName = mainVersion || version;
      if (!versionName) {
        setSnackbarMessage('Chybí verze pro export.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        setIsExporting(false);
        return;
      }
      
      // Před zahájením exportu zkontrolujeme, zda jsou konfliktní ceníky
      if (existingPriceLists.length > 0) {
        // Ihned zavoláme funkci, která zneplatní tyto ceníky
        console.log('Kolidující ceníky nalezeny – zahajuji zneplatnění.');
        await limitValidityForConflictingPriceLists(existingPriceLists, validFrom);
        console.log('Zneplatnění konfliktujících ceníků proběhlo úspěšně.');
      } else {
        console.log('Nebyly nalezeny žádné konfliktní ceníky.');
      }
      
      // Nyní pokračujeme v exportu – např. vytvoření nových ceníků a přiřazení produktů
      const formattedValidFrom = validFrom ? new Date(validFrom).toLocaleDateString() : '';
      const formattedValidTo = validTo ? new Date(validTo).toLocaleDateString() : null;
  
      // Definice všech cenových skupin
      const priceGroups = Object.keys({
        '1_eshop': true,
        '2_pult': true,
        '3_servis': true,
        '4_vo': true,
        '5_vip': true,
        '6_indiv': true,
        '7_dopravci': true,
        'B2B': true
      });
  
      const assignResults = { success: 0, failed: 0, errors: [] };
  
      for (const group of priceGroups) {
        let catalogVersionName = `Ceník ${manufacturer} od ${formattedValidFrom}`;
        if (formattedValidTo) {
          catalogVersionName += ` do ${formattedValidTo}`;
        }
        catalogVersionName += ` pro ${group.toUpperCase()}`;
        const priceListCode = `CENIK_${versionName}_${group.toUpperCase()}`;
        const priceListData = {
          verze: catalogVersionName,
          validFrom,
          validTill: validTo || null,
          category: priceListCategoryIds[group] || null,
          priceGroupCode: group,
          code: priceListCode
        };
  
        try {
          const createResponse = await axios.put(
            `${process.env.REACT_APP_API_URL}/raynet/create-price-list`,
            priceListData
          );
          console.log(`Odpověď z create-price-list pro ${group}:`, createResponse.data);
          if (createResponse.data.success) {
            const priceListId = createResponse.data.createdPriceList.priceListId;
            console.log(`Vytvořen ceník ID ${priceListId} pro skupinu ${group}.`);
  
            // NOVÁ LOGIKA: Po vytvoření ceníku čekáme, až bude katalog dostupný přes GET /raynet/price-lists
            const catalogFound = await waitForCatalog(priceListId, 10, 1000);
            if (catalogFound) {
              try {
                await axios.post(`${process.env.REACT_APP_API_URL}/raynet/update-price-list-in-sql`, {
                  priceListId,
                  validFrom,
                  validTo: validTo || null
                });
              } catch (sqlError) {
                assignResults.errors.push(`Ceník ${group}: Chyba při aktualizaci SQL.`);
              }
            } else {
              assignResults.errors.push(`Ceník ${group}: Katalog nebyl dostupný pro SQL update.`);
            }
  
            // Přiřazení produktů do nového ceníku
            for (const productRow of data) {
              const cPolozky = typeof productRow.C_Polozky === 'string'
                ? productRow.C_Polozky.trim()
                : String(productRow.C_Polozky).trim();
              if (!cPolozky) {
                assignResults.failed += 1;
                assignResults.errors.push(`Produkt s prázdným C_Polozky: ${JSON.stringify(productRow)}`);
                continue;
              }
              try {
                const productId = await createOrUpdateProduct(productRow, manufacturer);
                let finalPrice = parseFloat(productRow[group]);
                if (isNaN(finalPrice)) {
                  assignResults.failed += 1;
                  assignResults.errors.push(`Produkt ${cPolozky}: Cena '${group}' není číslo.`);
                  continue;
                }
                const assigned = await assignProduct(priceListId, productId, finalPrice, parseFloat(productRow.Nakup_cena) || 0);
                if (assigned) {
                  assignResults.success += 1;
                } else {
                  assignResults.failed += 1;
                  assignResults.errors.push(`Produkt ${cPolozky}: Chyba při přiřazení do ceníku ${group}.`);
                }
                // Update produktu v Raynet
                try {
                  const updatePayload = {
                    code: cPolozky,
                    name: `${manufacturer} ${productRow.Nazev}`,
                    unit: productRow.unit || 'ks',
                    category: PRODUCT_CATEGORY_ID,
                    description: productRow.description || '',
                    taxRate: parseFloat(productRow.taxRate) || 21,
                    productLine: productRow.productLine ? productRow.productLine.id : 149,
                    cost: parseFloat(productRow.Nakup_cena) || 0,
                    price: parseFloat(productRow.Cena) || 0,
                    tags: [],
                    customFields: mapCustomFields(productRow)
                  };
                  await axios.post(`${process.env.REACT_APP_API_URL}/raynet/update-product`, updatePayload);
                } catch (updErr) {
                  assignResults.failed += 1;
                  assignResults.errors.push(`Produkt ${cPolozky}: Chyba při update produktu.`);
                }
              } catch (prodError) {
                assignResults.failed += 1;
                assignResults.errors.push(`Produkt ${cPolozky}: ${prodError.message}`);
              }
            }
          } else {
            const failedPriceLists = createResponse.data.failedPriceLists;
            assignResults.failed += data.length;
            assignResults.errors.push(`Ceník ${group}: ${failedPriceLists.map(f => f.error).join(', ')}`);
            continue;
          }
        } catch (createError) {
          if (createError.response) {
            assignResults.errors.push(`Ceník ${group}: ${JSON.stringify(createError.response.data)}`);
          } else {
            assignResults.errors.push(`Ceník ${group}: ${createError.message}`);
          }
          assignResults.failed += data.length;
          continue;
        }
      } // konec smyčky pro cenové skupiny
  
      let finalMessage = `Přiřazeno ${assignResults.success} produktů do nových ceníků.`;
      if (assignResults.failed > 0 || assignResults.errors.length > 0) {
        finalMessage += `\nChyby při přiřazení: ${assignResults.failed}\n${assignResults.errors.join('\n')}`;
        console.warn(finalMessage);
      } else {
        console.log(finalMessage);
      }
      setSnackbarMessage(finalMessage);
      setSnackbarSeverity(assignResults.failed > 0 || assignResults.errors.length > 0 ? 'warning' : 'success');
    } catch (error) {
      console.error('handleExport: Chyba při exportu do Raynet:', error);
      setSnackbarMessage(error.message || 'Chyba při exportu do Raynet.');
      setSnackbarSeverity('error');
    } finally {
      setIsExporting(false);
      setSnackbarOpen(true);
      console.log('handleExport: Export dokončen.');
      onClose();
    }
  };
  

  // ---------------------- RENDER ----------------------
  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
        <DialogTitle>Exportovat do Raynet</DialogTitle>
        <DialogContent>
          {loadingPriceLists || !categoriesLoaded || loadingCustomFields ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Typography variant="h6" gutterBottom>
                Nalezly se následující kolidující ceníky:
              </Typography>
              {existingPriceLists.length > 0 ? (
                <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                  <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Kód</TableCell>
                          <TableCell>Název</TableCell>
                          <TableCell>Platnost od</TableCell>
                          <TableCell>Platnost do</TableCell>
                          <TableCell>Kategorie</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {existingPriceLists.map(priceList => (
                          <TableRow key={priceList.id}>
                            <TableCell>{priceList.code}</TableCell>
                            <TableCell>{priceList.name}</TableCell>
                            <TableCell>{formatDate(priceList.validFrom)}</TableCell>
                            <TableCell>{priceList.validTill ? formatDate(priceList.validTill) : '–'}</TableCell>
                            <TableCell>{priceList.category?.value || '–'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ) : (
                <Typography>Nebyly nalezeny žádné kolidující ceníky.</Typography>
              )}
              <Box sx={{ mt: 2 }}>
                <Typography>
                  Po potvrzení exportu budou staré ceníky omezeny do dne před <strong>{formatDate(validFrom)}</strong> a bude vytvořen nový ceník.
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        {!isExporting && (
          <DialogActions>
            <Button onClick={onClose} color="secondary">
              Zrušit
            </Button>
            <Button onClick={handleExport} color="primary" variant="contained" disabled={isExporting || loadingPriceLists || !categoriesLoaded || loadingCustomFields}>
              Potvrdit
            </Button>
          </DialogActions>
        )}
        {isExporting && (
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
              <CircularProgress />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Probíhá export do Raynet...
              </Typography>
            </Box>
          </DialogContent>
        )}
      </Dialog>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage.split('\n').map((str, idx) => (
            <span key={idx}>
              {str}
              <br />
            </span>
          ))}
        </Alert>
      </Snackbar>
    </>
  );
};

RaynetPriceListModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  version: PropTypes.string.isRequired,
  selectedSheet: PropTypes.string.isRequired,
  validFrom: PropTypes.string,
  validTo: PropTypes.string,
  mainVersion: PropTypes.string,
  manufacturer: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      C_Polozky: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      Cena: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      '1_eshop': PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      '2_pult': PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      '3_servis': PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      '4_vo': PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      '5_vip': PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      '6_indiv': PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      '7_dopravci': PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      Nakup_cena: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      Nazev: PropTypes.string,
      unit: PropTypes.string,
      productLine: PropTypes.shape({ id: PropTypes.number }),
      description: PropTypes.string,
      taxRate: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ).isRequired,
  additionalColumns: PropTypes.object,
  axData: PropTypes.object,
};

export default RaynetPriceListModal;
