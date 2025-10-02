import React, { useState, useEffect } from 'react';
import {
  Box, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Typography, Modal, Select, MenuItem, FormControl,
  InputLabel, Grid, TextField, IconButton, Checkbox, CircularProgress,
  Snackbar, Alert, FormControlLabel, Switch, FormGroup
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import axios from 'axios';

// Import vlastních komponent
import ExportImportModal from './ExportImportModal';
import RaynetPriceListModal from './RaynetPriceListModal';
import SynonymConflictModal from './SynonymConflictModal';
import ExportXLSModal from './ExportXLSModal';
import { useAuth } from '../AuthContext';

const CatalogImport = () => {
  // Kontext uživatele
  const { currentUser } = useAuth();

  // --------------------- STAVOVÉ PROMĚNNÉ ---------------------

  // Data načtená z importu, do kterých později doplňujeme i data z AX, Eshop, Raynet
  const [data, setData] = useState([]);

  // Definice možných "view" (zobrazení tabulky) a vybrané view
  const [selectedView, setSelectedView] = useState('Ceník 1');
  const [views, setViews] = useState({
    'Ceník 1': ['Checkbox', 'Nazev', 'Cena'],
    'Ceník 2': ['Checkbox', 'C_Polozky', 'Nazev', 'Cena', 'CenaPoSleve', 'Provoz', 'Naprava', 'M_S', 'TPM_S'],
    'Kalkulace - nákladová cena': [
      'C_Polozky', 'Nazev', 'Vyrobce', 'Skladem', 'Nakoupeno', 'SklademKc',
      'B2B', 'SPILowestPrice', 'Cena', 'Sleva', 'Nakup_zakladni_sleva', 'Nakupni_akce'
    ],
    'Kalkulace - nákladová cena + prodejní ceny': [
      'C_Polozky', 'Nazev', 'Vyrobce', 'Skladem', 'Nakoupeno', 'SklademKc',
      'B2B', 'SPILowestPrice', 'Cena', 'Sleva', 'Nakup_zakladni_sleva', 'Nakupni_akce',
      '1_eshop', '2_pult', '3_servis', '4_vo', '5_vip', '6_indiv', '7_dopravci'
    ],
    'Kompletní pohled': [
      'Checkbox', 'C_Polozky', 'Nazev', 'Cena', 'CenaPoSleve', 'Provoz', 'Naprava',
      'Vyrobce', 'Skladem', 'Nakoupeno', 'SklademKc', 'B2B', 'SPILowestPrice',
      'Sleva', 'Nakup_zakladni_sleva', 'Nakupni_akce', 'AkcniCena', 'Rozmer',
      'Dezén', 'Šířka', 'Profil', 'Ráfek', 'EAN', 'Obrázek', 'M_S', 'TPM_S',
      'Index nosnosti', 'Index rychlosti', 'Zesileni', '1_eshop', '2_pult',
      '3_servis', '4_vo', '5_vip', '6_indiv', '7_dopravci', 'Stitek', 'PR',
      'Valivy_odpor', 'Prilnavost', 'Hluk_db', 'TT_TL', 'Hmotnost',
      'Hloubka_dezenu', 'MarketingovaAkce', 'PlatnostOd', 'PlatnostDo',
      'Vyrobce', 'CenovaSkupina', 'ZakaznickaSkupina', 'Nakladova_cena'
    ]
  });
  const handleExportWithSave = async () => {
    try {
      // Nejprve uložíme data.
      await handleSave();
      // Po úspěšném uložení otevřeme modal, ve kterém proběhne exportní logika.
      setOpenExportModal(true);
    } catch (error) {
      console.error('Chyba při exportu s uložením:', error);
      setSnackbarMessage('Chyba při exportu s uložením. Zkontrolujte konzoli.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };
// Přidej novou funkci pro export do B2B
const handleExportB2B = async () => {
  try {
    // Zavoláme endpoint pro export do B2B (endpoint si pojmenuj dle potřeby)
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/export-b2b`);
    setSnackbarMessage("Export do B2B byl úspěšný!");
    setSnackbarSeverity("success");
    setSnackbarOpen(true);
  } catch (error) {
    console.error("Chyba při exportu do B2B:", error);
    setSnackbarMessage("Chyba při exportu do B2B. Zkontrolujte konzoli.");
    setSnackbarSeverity("error");
    setSnackbarOpen(true);
  }
};

  // Zda jsou všechny checkboxy vybrány
  const [selectAll, setSelectAll] = useState(false);

  // Stav pro minimalizaci / rozbalení panelu
  const [minimized, setMinimized] = useState(false);

  // Stavy pro otevírání modalů
  const [openModal, setOpenModal] = useState(false);         // Modal pro import
  const [openExportModal, setOpenExportModal] = useState(false);   // Modal pro export do Raynet
  const [openExportXLSModal, setOpenExportXLSModal] = useState(false); // Modal pro export XLS

  // Stavy pro Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  // Filtrační a verzovací stavy
  const [version, setVersion] = useState('');
  const [mainVersion, setMainVersion] = useState(''); // Volitelný stav, pokud byl v původním kódu
  const [selectedSheet, setSelectedSheet] = useState('');
  const [selectedPriceGroup, setSelectedPriceGroup] = useState('');
  const [supplier, setSupplier] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [discount, setDiscount] = useState(null);

  // Validace dat + stavy pro data z endpoints
  const [isValidationDataLoaded, setIsValidationDataLoaded] = useState(false);
  const [poziceData, setPoziceData] = useState([]);
  const [zpusobUzitiData, setZpusobUzitiData] = useState([]);
  const [msData, setMsData] = useState([]);
  const [tpmsfData, setTpmsfData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [productLineData, setProductLineData] = useState([]);
  const [indexNosnostiData, setIndexNosnostiData] = useState([]);
  const [indexRychlostiData, setIndexRychlostiData] = useState([]);
  const [zesileniData, setZesileniData] = useState([]);
  const [sirkaData, setSirkaData] = useState([]);
  const [profilData, setProfilData] = useState([]);
  const [rafekData, setRafekData] = useState([]);
  const [dezenData, setDezenData] = useState([]);

  // Stavy pro doplňování dat z endpointů AX, Eshop, Raynet
  const [showAX, setShowAX] = useState(false);
  const [showEshop, setShowEshop] = useState(false);
  const [showRaynet, setShowRaynet] = useState(false);
  const [axData, setAxData] = useState({});
  const [eshopData, setEshopData] = useState({});
  const [raynetData, setRaynetData] = useState({});

  // Stavy pro řešení konfliktů
  const [conflictList, setConflictList] = useState([]);
  const [synonymModalOpen, setSynonymModalOpen] = useState(false);

  // Stav indikující, zda probíhá export
  const [isExporting, setIsExporting] = useState(false);

  // --------------------- MAPOVÁNÍ SYNONYM ---------------------
  const mapSynonym = (originalValue, dataSet) => {
    if (!originalValue) return '';
    if (!isValidationDataLoaded || !dataSet || dataSet.length === 0) return originalValue;
    const normalized = String(originalValue).trim().toLowerCase();
    for (const item of dataSet) {
      if (!item) continue;
      const synonymsArr = (item.synonyms || '').split(',').map(s => s.trim().toLowerCase());
      if (item.value.trim().toLowerCase() === normalized || synonymsArr.includes(normalized)) {
        return item.value;
      }
    }
    return originalValue;
  };

  // --------------------- VIDITELNOST SLOUPCŮ ---------------------
  const isColumnVisible = (column) => {
    if (!selectedView || !views[selectedView]) {
      console.error(`Selected view '${selectedView}' does not exist in views.`);
      return false;
    }
    return views[selectedView].includes(column);
  };

  // --------------------- HANDLER PRO CHECKBOXY AX / ESHOP / RAYNET ---------------------
  const handleCheckboxChange = async (event, type) => {
    const isChecked = event.target.checked;

    if (type === 'AX') {
      setShowAX(isChecked);
      if (isChecked) {
        try {
          const codes = data.map(row => row.C_Polozky).filter(code => code);
          if (codes.length === 0) {
            setSnackbarMessage("Žádné Kódy položek k načtení.");
            setSnackbarSeverity("warning");
            setSnackbarOpen(true);
            return;
          }
          const response = await axios.get(`${process.env.REACT_APP_API_URL}/ax-data`, {
            params: { codes: codes.join(',') }
          });
          if (response.data.success) {
            const axDataMap = {};
            response.data.data.forEach(item => {
              axDataMap[item["Kód položky"]] = item;
            });
            setAxData(axDataMap);
            console.log('AX Data načtena:', axDataMap);
          } else {
            setSnackbarMessage("Nepodařilo se načíst AX data.");
            setSnackbarSeverity("error");
            setSnackbarOpen(true);
          }
        } catch (error) {
          console.error('Chyba při načítání AX dat:', error);
          setSnackbarMessage("Chyba při načítání AX dat.");
          setSnackbarSeverity("error");
          setSnackbarOpen(true);
        }
      } else {
        setAxData({});
      }
    }

    // Pokud máte podobnou logiku i pro Eshop a Raynet, sem patří
    // ...
  };

  // --------------------- FUNKCE PRO SLUČENÍ DAT Z AX ---------------------
  const mergeProductRowWithAX = (productRow) => {
    const axRecord = axData[productRow.C_Polozky];
    if (!axRecord) return productRow;
    const merged = { ...productRow };

    // Mapping pro aktualizaci vybraných hodnot u výběrových polí
    const selectedMapping = {
      "Naprava": { selected: "SelectedNaprava", dataset: poziceData },
      "Provoz": { selected: "SelectedProvoz", dataset: zpusobUzitiData },
      "M_S": { selected: "SelectedM_S", dataset: msData },
      "TPM_S": { selected: "SelectedTPM_S", dataset: tpmsfData },
      "Index nosnosti": { selected: "SelectedIndex nosnosti", dataset: indexNosnostiData },
      "Index rychlosti": { selected: "SelectedIndex rychlosti", dataset: indexRychlostiData },
      "Zesileni": { selected: "SelectedZesileni", dataset: zesileniData },
      "Šířka": { selected: "SelectedSirka", dataset: sirkaData },
      "Profil": { selected: "SelectedProfil", dataset: profilData },
      "Rafek": { selected: "SelectedRafek", dataset: rafekData },
      "Dezen": { selected: "SelectedDezen", dataset: dezenData }
    };

    Object.keys(axRecord).forEach(key => {
      if (
        merged[key] === undefined ||
        merged[key] === null ||
        (typeof merged[key] === 'string' && merged[key].trim() === '')
      ) {
        let newValue;
        if (
          ["Naprava", "Provoz", "M_S", "TPM_S", "Zesileni", "Šířka", "Profil", "Ráfek", "Dezén", "Index nosnosti", "Index rychlosti"].includes(key) &&
          typeof axRecord[key] === 'string'
        ) {
          newValue = axRecord[key].toLowerCase();
        } else {
          newValue = axRecord[key];
        }
        merged[key] = newValue;
        if (selectedMapping[key]) {
          // Nastavení vybrané hodnoty pomocí mapSynonym funkce
          merged[selectedMapping[key].selected] = mapSynonym(newValue, selectedMapping[key].dataset);
          // Pokud existuje i "Original" verze, aktualizujeme ji také
          const originalField = "Original" + key;
          if (merged.hasOwnProperty(originalField)) {
            merged[originalField] = newValue;
          }
        }
      }
    });
    return merged;
  };

  // --------------------- SLUČOVÁNÍ DAT PO NAČTENÍ AX ---------------------
  const [dataMerged, setDataMerged] = useState(false);
  useEffect(() => {
    if (showAX && !dataMerged && Object.keys(axData).length > 0) {
      const mergedData = data.map(row => mergeProductRowWithAX(row));
      setData(mergedData);
      setDataMerged(true);
    }
  }, [showAX, axData, data, dataMerged]);

  // --------------------- FUNKCE PRO MAPOVÁNÍ CUSTOM FIELDS ---------------------
  const mapCustomFields = (productRow) => {
    const customFieldMapping = {
      'Index nosnosti': 'Index_Nosn_85ad2',
      'Index rychlosti': 'Index_rych_a74ff',
      'Naprava': 'Naprava_fe9fa',
      'Provoz': 'Provoz_2c25f',
      'M_S': 'M_S_50472',
      'TPM_S': 'Vlocka_v_h_d2e18',
      'Zesileni': 'Zesileni',
      'Sirka': 'Sirka_04504',
      'Profil': 'Profil_c69ed',
      'Rafek': 'Rafek_1f4ee',
      'Dezén': 'Dezen_e771c',
      'Prilnavost': 'Prilnavost_73dbd',
      'Hmotnost': 'Hmotnost_b88b1',
      'Rozmer': 'Rozmer_5ce97'
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
          // Konverze na string
          const asString = String(value).trim();
          if (asString !== '') {
            result[raynetField] = asString;
          }
        }
      }
    });
    return result;
  };

  // --------------------- FUNKCE PRO VYTVOŘENÍ / UPDATE PRODUKTU ---------------------
  const createOrUpdateProduct = async (productRow, manufacturer) => {
    try {
      console.log(`createOrUpdateProduct: Hledám produkt s kódem: ${productRow.C_Polozky}.`);
      const searchResponse = await axios.get(`${process.env.REACT_APP_API_URL}/raynet/products?code=${productRow.C_Polozky}`);
      let productId;
      if (searchResponse.data && searchResponse.data.id) {
        productId = searchResponse.data.id;
        console.log(`Produkt nalezen s ID: ${productId}.`);
      } else {
        console.log(`Produkt ${productRow.C_Polozky} nebyl nalezen, vytvářím nový.`);
        const createProductPayload = {
          code: productRow.C_Polozky,
          name: `${manufacturer} ${productRow.Nazev}`,
          unit: productRow.unit || 'ks',
          category: 144, // Případně upravte dle potřeby
          productLine: productRow.productLine ? productRow.productLine.id : 149,
          cost: parseFloat(productRow.Nakup_cena) || 0,
          price: parseFloat(productRow.Cena) || 0,
          customFields: mapCustomFields(productRow)
        };
        const createProductResponse = await axios.post(`${process.env.REACT_APP_API_URL}/raynet/create-product`, createProductPayload);
        productId = createProductResponse.data.id;
      }
      if (!productId) {
        throw new Error(`Nelze získat ID produktu pro kód: ${productRow.C_Polozky}`);
      }
      return productId;
    } catch (error) {
      console.error(`createOrUpdateProduct: Chyba při vytváření/aktualizaci produktu ${productRow.C_Polozky}:`, error);
      throw new Error(`Error in createOrUpdateProduct: ${error.message}`);
    }
  };

  // --------------------- FUNKCE PRO PŘIŘAZENÍ PRODUKTU DO CENÍKU ---------------------
  const assignProduct = async (priceListId, productId, finalPrice, purchasePrice) => {
    try {
      console.log(`Přiřazuji produkt ID ${productId} k ceníku ${priceListId}, cena ${finalPrice}, nákup ${purchasePrice}.`);
      const assignResponse = await axios.post(`${process.env.REACT_APP_API_URL}/raynet/assign-product`, {
        priceListId,
        productId,
        finalPrice,
        purchasePrice
      });
      console.log('assignProductToPriceList:', assignResponse.data);
      return true;
    } catch (error) {
      console.error(`Chyba při přiřazení produktu ${productId}:`, error);
      return false;
    }
  };

  // --------------------- FUNKCE PRO APLIKACI MARKETINGOVÝCH AKCÍ ---------------------
  const applyMarketingActions = async (rows) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/applyMarketingActions`,
        { data: rows, sheetName: selectedSheet || null }
      );
      const updatedData = response.data.data; 
      setData(updatedData);
    } catch (error) {
      console.error('Chyba při aplikaci marketingových akcí:', error);
      setSnackbarMessage("Chyba při aplikaci marketingových akcí.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  // --------------------- HLAVNÍ FUNKCE EXPORTU ---------------------
 

  // --------------------- FUNKCE PRO IMPORT SOUBORU ---------------------
  const handleFileUpload = async (
    file,
    selectedSheet,
    selectedPriceGroup,
    prodLineId,
    catId,
    typeValue,
    categoryValue,
    manufacturerValue
  ) => {
    if (!isValidationDataLoaded) {
      alert("Validační data ještě nejsou načtena. Zkuste to za chvíli.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target.result;
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[selectedSheet], { header: 1 });
      const headers = sheetData[0];

      const getValue = (row, columnName) => {
        const idx = headers.indexOf(columnName);
        if (idx === -1) return '';
        return row[idx] !== undefined ? row[idx] : '';
      };

      const rows = sheetData.slice(1).map(row => {
        let cena = 0;
        const cenaIndex = headers.indexOf('Cena');
        if (cenaIndex !== -1) {
          cena = row[cenaIndex] !== undefined ? parseFloat(row[cenaIndex]) : 0;
        }
        const cenaPoSleve = discount ? Math.round(cena * (1 - discount / 100)) : cena;
        const rowData = {
          IsChecked: false,
          IsNewItem: false,
          C_Polozky: getValue(row, 'Č. položky'),
          Cena: cena !== 0 ? String(cena) : '',
          Prodej_cena: cena !== 0 ? String(cena) : '',
          CenaPoSleve: String(cenaPoSleve),
          Nazev: getValue(row, 'Název'),
          Rozmer: getValue(row, 'Rozměr') || '',
          Dezén: getValue(row, 'Dezén') || '',
          'Šířka': getValue(row, 'Šířka') || '',
          Profil: getValue(row, 'Profil') || '',
          Ráfek: getValue(row, 'Ráfek') || '',
          EAN: getValue(row, 'EAN') || '',
          Obrázek: getValue(row, 'Obrázek') || '',
          Naprava: mapSynonym(getValue(row, 'Náprava') || '', poziceData),
          OriginalNaprava: getValue(row, 'Náprava') || '',
          SelectedNaprava: mapSynonym(getValue(row, 'Náprava') || '', poziceData),
          Provoz: mapSynonym(getValue(row, 'Provoz') || '', zpusobUzitiData),
          OriginalProvoz: getValue(row, 'Provoz') || '',
          SelectedProvoz: mapSynonym(getValue(row, 'Provoz') || '', zpusobUzitiData),
          M_S: mapSynonym(getValue(row, 'M+S') || '', msData),
          OriginalM_S: getValue(row, 'M+S') || '',
          SelectedM_S: mapSynonym(getValue(row, 'M+S') || '', msData),
          TPM_S: mapSynonym(getValue(row, '3PMSF') || '', tpmsfData),
          OriginalTPM_S: getValue(row, '3PMSF') || '',
          SelectedTPM_S: mapSynonym(getValue(row, '3PMSF') || '', tpmsfData),
          "Index nosnosti": mapSynonym(getValue(row, 'Index nosnosti') || '', indexNosnostiData),
          "OriginalIndex nosnosti": getValue(row, 'Index nosnosti') || '',
          "SelectedIndex nosnosti": mapSynonym(getValue(row, 'Index nosnosti') || '', indexNosnostiData),
          "Index rychlosti": mapSynonym(getValue(row, 'Index rychlosti') || '', indexRychlostiData),
          "OriginalIndex rychlosti": getValue(row, 'Index rychlosti') || '',
          "SelectedIndex rychlosti": mapSynonym(getValue(row, 'Index rychlosti') || '', indexRychlostiData),
          Zesileni: getValue(row, 'Zesileni') || '',
          SelectedZesileni: mapSynonym(getValue(row, 'Zesileni') || '', zesileniData),
          Sirka: mapSynonym(getValue(row, 'Šířka') || '', sirkaData),
          OriginalSirka: getValue(row, 'Šířka') || '',
          SelectedSirka: mapSynonym(getValue(row, 'Šířka') || '', sirkaData),
          Profil: mapSynonym(getValue(row, 'Profil') || '', profilData),
          OriginalProfil: getValue(row, 'Profil') || '',
          SelectedProfil: mapSynonym(getValue(row, 'Profil') || '', profilData),
          Rafek: mapSynonym(getValue(row, 'Ráfek') || '', rafekData),
          OriginalRafek: getValue(row, 'Ráfek') || '',
          SelectedRafek: mapSynonym(getValue(row, 'Ráfek') || '', rafekData),
          Dezen: mapSynonym(getValue(row, 'Dezén') || '', dezenData),
          OriginalDezen: getValue(row, 'Dezén') || '',
          SelectedDezen: mapSynonym(getValue(row, 'Dezén') || '', dezenData),
          '1_eshop': '',
          Stitek: getValue(row, 'Štítek') || '',
          PR: getValue(row, 'PR') || '',
          Valivy_odpor: getValue(row, 'Valivý odpor') || '',
          Prilnavost: getValue(row, 'Přilnavost') || '',
          Hluk_db: getValue(row, 'Hluk (db)') || '',
          TT_TL: getValue(row, 'TT/TL') || '',
          Hmotnost: getValue(row, 'Hmotnost') || '',
          Hloubka_dezenu: getValue(row, 'Hloubka dezénu') || '',
          MarketingovaAkce: '',
          PlatnostOd: '',
          PlatnostDo: '',
          Vyrobce: manufacturerValue || '',
          CenovaSkupina: selectedPriceGroup || '',
          ZakaznickaSkupina: selectedPriceGroup || '',
          Nakladova_cena: getValue(row, 'Nakladova_cena') || '',
          Nakoupeno: '',
          Skladem: '',
          SklademKc: '',
          Sleva: '',
          Nakup_zakladni_sleva: '',
          Nakupni_akce: '',
          SPILowestPrice: '',
        };
        return rowData;
      });

      const filteredRows = rows.filter(r => r.C_Polozky && r.C_Polozky !== '');
      await applyMarketingActions(filteredRows);
    };
    reader.readAsArrayBuffer(file);
  };

  // --------------------- SUBMIT MODALU (IMPORT) ---------------------
  const handleModalSubmit = (formData) => {
    if (!isValidationDataLoaded) {
      alert("Data pro /pozice a další ještě nejsou načtena. Zkuste to za chvíli!");
      return;
    }
    const versionValue = formData.get('versionName');
    const selectedSheetValue = formData.get('selectedSheet');
    const selectedPriceGroupFromForm = formData.get('selectedPriceGroup');
    const supplierValue = formData.get('supplier');
    const categoryValue = formData.get('category');
    const typeValue = formData.get('type');
    const manufacturerValue = formData.get('manufacturer');

    setSupplier(supplierValue);
    setCategory(categoryValue);
    setType(typeValue);
    setManufacturer(manufacturerValue);

    if (selectedPriceGroupFromForm !== null && selectedPriceGroupFromForm !== undefined) {
      setSelectedPriceGroup(selectedPriceGroupFromForm);
    }

    const productLineItem = productLineData.find(item => item.code01 === typeValue);
    const categoryItem = categoryData.find(item => item.code01 === categoryValue);
    const pLineId = productLineItem ? productLineItem.id : null;
    const cId = categoryItem ? categoryItem.id : null;

    setData([]);
    setDiscount(null);
    setMinimized(false);
    setSelectedSheet(selectedSheetValue);

    let finalVersionValue = versionValue || '';
    setVersion(finalVersionValue);

    if (formData.has('file')) {
      const file = formData.get('file');
      handleFileUpload(
        file,
        selectedSheetValue,
        selectedPriceGroupFromForm,
        pLineId,
        cId,
        typeValue,
        categoryValue,
        manufacturerValue
      );
    }
    setOpenModal(false);
  };

  // --------------------- GENEROVÁNÍ NOVÉ VERZE ---------------------
  const generateNewVersion = async (baseVersion, sheetName) => {
    const match = baseVersion.match(/^(\d{8})_(.+)_V(\d+)$/);
    if (!match) {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateString = `${year}${month}${day}`;
      return `${dateString}_${sheetName}_V1`;
    }
    const datePart = match[1];
    const sheetPart = match[2];
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/get-existing-versions`, {
        date: datePart,
        sheetName: sheetPart
      });
      const versionNumbers = new Set();
      response.data.versions.forEach((versionObj) => {
        const vMatch = versionObj.filterName.match(/_V(\d+)(?:_|$)/);
        if (vMatch) {
          const versionNumber = parseInt(vMatch[1], 10);
          versionNumbers.add(versionNumber);
        }
      });
      let maxVersionNumber = 0;
      versionNumbers.forEach((vn) => {
        if (vn > maxVersionNumber) maxVersionNumber = vn;
      });
      const newVersionNumber = maxVersionNumber + 1;
      return `${datePart}_${sheetPart}_V${newVersionNumber}`;
    } catch (error) {
      console.error('Error generating new version:', error);
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateString = `${year}${month}${day}`;
      return `${dateString}_${sheetPart}_V1`;
    }
  };

  // --------------------- ULOŽENÍ DO DB (HANDLESAVE) ---------------------
  const handleSave = async () => {
    try {
      let currentVersion = version;
      const baseMatch = currentVersion.match(/^(\d{8})_(.+)_V(\d+)$/);
      let datePart, sheetPart;
      if (baseMatch) {
        datePart = baseMatch[1];
        sheetPart = baseMatch[2];
      } else {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        datePart = `${year}${month}${day}`;
        sheetPart = selectedSheet;
        currentVersion = `${datePart}_${sheetPart}_V1`;
        setVersion(currentVersion);
      }

      // Zjištění, zda existuje verze
      const responseVersions = await axios.post(`${process.env.REACT_APP_API_URL}/get-existing-versions`, {
        date: datePart,
        sheetName: sheetPart
      });
      const existingVersions = responseVersions.data.versions.map(ver => ver.filterName);
      const versionExists = existingVersions.some(filterName => filterName.startsWith(currentVersion));

      if (versionExists) {
        const confirmed = window.confirm('Pracujete se starou verzí. Chcete vytvořit novou verzi?');
        if (confirmed) {
          const generatedVersion = await generateNewVersion(currentVersion, sheetPart);
          setVersion(generatedVersion);
          currentVersion = generatedVersion;
        } else {
          return;
        }
      }

      // Kontrola nekompletních řádků
      const incompleteRows = data.filter(
        r =>
          !r.SelectedNaprava ||
          !r.SelectedProvoz ||
          !r.SelectedM_S ||
          !r.SelectedTPM_S ||
          !r.SelectedZesileni ||
          !r.SelectedSirka ||
          !r.SelectedProfil ||
          !r.SelectedRafek ||
          !r.SelectedDezen
      );
      if (incompleteRows.length > 0) {
        const proceed = window.confirm('Data nejsou kompletní. Chcete přesto pokračovat v uložení?');
        if (!proceed) return;
      }

      await axios.post(`${process.env.REACT_APP_API_URL}/save-catalog-data`, {
        data: data,
        userId: currentUser.userID,
        versionName: currentVersion,
        filterName: currentVersion,
        selectedView: selectedView,
        sheetName: selectedSheet,
        validFrom: validFrom || null,
        validTo: validTo || null,
        isActive: isActive,
        manufacturer: manufacturer
      });

      setSnackbarMessage('Data byla úspěšně uložena!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Chyba při ukládání dat:', error);
      setSnackbarMessage('Chyba při ukládání dat. Zkontrolujte konzoli.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // --------------------- DOPLNĚNÍ DAT Z GET-CATALOG-DATA ---------------------
  const handleMergeDataFromEndpoint = async () => {
    try {
      if (!version) {
        alert("Pole 'Verze' je prázdné. Nelze stáhnout data z endpointu.");
        return;
      }

      const response = await axios.get(`${process.env.REACT_APP_API_URL}/get-catalog-data`, {
        params: { versionName: version }
      });

      const { data: groupedData } = response.data;
      const allItemsFromEndpoint = groupedData.reduce((acc, group) => acc.concat(group.data || []), []);
      const endpointMap = {};
      for (const item of allItemsFromEndpoint) {
        if (item["Kód položky"]) {
          endpointMap[item["Kód položky"]] = item;
        }
      }

      const mergedData = data.map(originalRow => {
        const { C_Polozky } = originalRow;
        if (!C_Polozky) return originalRow;
        const endpointItem = endpointMap[C_Polozky];
        if (!endpointItem) return originalRow;

        // Doplnění vybraných polí
        ['AkcniCena', 'MarketingovaAkce', 'PlatnostOd', 'PlatnostDo', 'Nakoupeno', 'Skladem', 'SklademKc', 'Sleva', 'Nakup_zakladni_sleva', 'Nakupni_akce', 'SPILowestPrice'].forEach(field => {
          if (!originalRow[field] && endpointItem[field]) {
            originalRow[field] = endpointItem[field];
          }
        });

        if (!originalRow['1_eshop'] && endpointItem['1_eshop']) {
          originalRow['1_eshop'] = endpointItem['1_eshop'];
        }

        if (!originalRow.SelectedZesileni && endpointItem["Zesileni"]) {
          originalRow.SelectedZesileni = endpointItem["Zesileni"];
          originalRow.Zesileni = endpointItem["Zesileni"];
        }

        return originalRow;
      });

      setData(mergedData);
      setSnackbarMessage("Data z endpointu byla úspěšně doplněna!");
      setSnackbarSeverity("success");
      setSnackbarOpen(true);

    } catch (error) {
      console.error("Chyba při doplňování dat z endpointu /get-catalog-data:", error);
      setSnackbarMessage("Chyba při doplňování dat z endpointu. Zkontrolujte konzoli.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  // --------------------- USEEFFECT: Načítání validačních dat ---------------------
  useEffect(() => {
    const fetchValidationData = async () => {
      try {
        const results = await Promise.allSettled([
          axios.get(`${process.env.REACT_APP_API_URL}/pozice`),
          axios.get(`${process.env.REACT_APP_API_URL}/zpusob_uziti`),
          axios.get(`${process.env.REACT_APP_API_URL}/ms`),
          axios.get(`${process.env.REACT_APP_API_URL}/tpmsf`),
          axios.get(`${process.env.REACT_APP_API_URL}/raynet/product-categories`),
          axios.get(`${process.env.REACT_APP_API_URL}/raynet/product-lines`),
          axios.get(`${process.env.REACT_APP_API_URL}/index_nosnosti`),
          axios.get(`${process.env.REACT_APP_API_URL}/index_rychlosti`),
          axios.get(`${process.env.REACT_APP_API_URL}/zesileni`),
          axios.get(`${process.env.REACT_APP_API_URL}/sirka`),
          axios.get(`${process.env.REACT_APP_API_URL}/profil`),
          axios.get(`${process.env.REACT_APP_API_URL}/rafek`),
          axios.get(`${process.env.REACT_APP_API_URL}/dezen`)
        ]);

        setPoziceData(results[0].status === "fulfilled" ? results[0].value.data : []);
        setZpusobUzitiData(results[1].status === "fulfilled" ? results[1].value.data : []);
        setMsData(results[2].status === "fulfilled" ? results[2].value.data : []);
        setTpmsfData(results[3].status === "fulfilled" ? results[3].value.data : []);
        setCategoryData(results[4].status === "fulfilled" ? results[4].value.data.data : []);
        setProductLineData(results[5].status === "fulfilled" ? results[5].value.data.data : []);
        setIndexNosnostiData(results[6].status === "fulfilled" ? results[6].value.data : []);
        setIndexRychlostiData(results[7].status === "fulfilled" ? results[7].value.data : []);
        setZesileniData(results[8].status === "fulfilled" ? results[8].value.data : []);
        setSirkaData(results[9].status === "fulfilled" ? results[9].value.data : []);
        setProfilData(results[10].status === "fulfilled" ? results[10].value.data : []);
        setRafekData(results[11].status === "fulfilled" ? results[11].value.data : []);
        setDezenData(results[12].status === "fulfilled" ? results[12].value.data : []);

        setIsValidationDataLoaded(true);
      } catch (error) {
        console.error('Chyba při načítání validačních dat:', error);
      }
    };
    fetchValidationData();
  }, []);

  // --------------------- USEEFFECT: Načítání slevy ---------------------
  useEffect(() => {
    if (selectedPriceGroup && selectedSheet) {
      const fetchDiscount = async () => {
        try {
          const response = await axios.get(`${process.env.REACT_APP_API_URL}/get-discount`, {
            params: { sheetName: selectedSheet, customerGroup: selectedPriceGroup }
          });
          setDiscount(parseFloat(response.data.sleva));
        } catch (error) {
          console.error('Chyba při získávání slevy:', error);
        }
      };
      fetchDiscount();
    } else {
      setDiscount(null);
    }
  }, [selectedPriceGroup, selectedSheet]);

  // --------------------- USEEFFECT: Recalculation + marketingActions po slevě ---------------------
  useEffect(() => {
    if (discount !== null && data.length > 0) {
      // Recalculation
      const recalculatePrices = () => {
        const updatedData = data.map(row => {
          const cena = parseFloat(row.Cena) || 0;
          const cenaPoSleve = discount ? Math.round(cena * (1 - discount / 100)) : cena;
          return { ...row, CenaPoSleve: String(cenaPoSleve) };
        });
        setData(updatedData);
      };
      recalculatePrices();
    }
  }, [discount]);

  useEffect(() => {
    if (discount !== null && data.length > 0) {
      applyMarketingActions(data);
    }
  }, [discount]);

  // --------------------- FUNKCE PRO KONTROLU KONFLIKTŮ ---------------------
  const handleCheckConflicts = () => {
    if (!isValidationDataLoaded) {
      alert("Validační data nejsou načtena.");
      return;
    }
    const synonymColumns = [
      { columnKey: 'Naprava', originalKey: 'OriginalNaprava', dataSet: poziceData, endpoint: '/pozice' },
      { columnKey: 'Provoz', originalKey: 'OriginalProvoz', dataSet: zpusobUzitiData, endpoint: '/zpusob_uziti' },
      { columnKey: 'M_S', originalKey: 'OriginalM_S', dataSet: msData, endpoint: '/ms' },
      { columnKey: 'TPM_S', originalKey: 'OriginalTPM_S', dataSet: tpmsfData, endpoint: '/tpmsf' },
      { columnKey: 'Index nosnosti', originalKey: 'OriginalIndex nosnosti', dataSet: indexNosnostiData, endpoint: '/index_nosnosti' },
      { columnKey: 'Index rychlosti', originalKey: 'OriginalIndex rychlosti', dataSet: indexRychlostiData, endpoint: '/index_rychlosti' },
      { columnKey: 'Zesileni', originalKey: 'Zesileni', dataSet: zesileniData, endpoint: '/zesileni' },
      { columnKey: 'Šířka', originalKey: 'OriginalSirka', dataSet: sirkaData, endpoint: '/sirka' },
      { columnKey: 'Profil', originalKey: 'OriginalProfil', dataSet: profilData, endpoint: '/profil' },
      { columnKey: 'Ráfek', originalKey: 'OriginalRafek', dataSet: rafekData, endpoint: '/rafek' },
      { columnKey: 'Dezén', originalKey: 'OriginalDezen', dataSet: dezenData, endpoint: '/dezen' }
    ];

    const conflicts = [];
    data.forEach((row) => {
      synonymColumns.forEach((col) => {
        let originalVal = row[col.originalKey] || ''; 
        originalVal = String(originalVal);
        if (!originalVal.trim()) return;
        const normalized = originalVal.trim().toLowerCase();
        let found = false;
        col.dataSet.forEach(item => {
          if (!item) return;
          const synonymsArr = (item.synonyms || '').split(',').map(s => s.trim().toLowerCase());
          if ((item.value && item.value.trim().toLowerCase() === normalized) || synonymsArr.includes(normalized)) {
            found = true;
          }
        });
        if (!found) {
          conflicts.push({
            columnKey: col.columnKey,
            originalValue: originalVal,
            dataSet: col.dataSet,
            endpoint: col.endpoint
          });
        }
      });
    });
    if (conflicts.length === 0) {
      alert('Žádné neznámé hodnoty nenalezeny.');
      return;
    }
    setConflictList(conflicts);
    setSynonymModalOpen(true);
  };

  // --------------------- FUNKCE PRO ŘEŠENÍ KONFLIKTU ---------------------
  const handleConflictResolved = async (endpoint) => {
    try {
      const fullEndpoint = `${process.env.REACT_APP_API_URL}${endpoint}`;
      const resp = await axios.get(fullEndpoint);
      switch (endpoint) {
        case '/pozice': setPoziceData(resp.data); break;
        case '/zpusob_uziti': setZpusobUzitiData(resp.data); break;
        case '/ms': setMsData(resp.data); break;
        case '/tpmsf': setTpmsfData(resp.data); break;
        case '/index_nosnosti': setIndexNosnostiData(resp.data); break;
        case '/index_rychlosti': setIndexRychlostiData(resp.data); break;
        case '/zesileni': setZesileniData(resp.data); break;
        case '/sirka': setSirkaData(resp.data); break;
        case '/profil': setProfilData(resp.data); break;
        case '/rafek': setRafekData(resp.data); break;
        case '/dezen': setDezenData(resp.data); break;
        default: break;
      }

      // Odstranění vyřešených konfliktů
      setConflictList(prev => prev.filter(conflict => conflict.endpoint !== endpoint));

      // Pokud už nejsou konflikty, zavřeme modal
      if (conflictList.filter(conflict => conflict.endpoint === endpoint).length === 1) {
        const remainingConflicts = conflictList.filter(conflict => conflict.endpoint !== endpoint);
        if (remainingConflicts.length === 0) {
          setSynonymModalOpen(false);
          setSnackbarMessage('Všechny konflikty byly vyřešeny.');
          setSnackbarSeverity('success');
          setSnackbarOpen(true);
        }
      }
    } catch (error) {
      console.error('Chyba při znovunačtení endpointu:', error);
      setSnackbarMessage("Chyba při znovunačtení endpointu. Zkontrolujte konzoli.");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  // --------------------- RENDER ---------------------
  return (
    <Box sx={{ paddingLeft: '10px', paddingRight: '10px', position: 'relative', maxWidth: '100%', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      <Typography variant="h4" gutterBottom>
        Import Ceníků
      </Typography>

      {/* Hlavní ovládací panel */}
      <Box
        sx={{
          padding: '10px',
          border: '1px solid lightgray',
          boxSizing: 'border-box',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          backgroundColor: 'white'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Button variant="contained" onClick={() => setOpenModal(true)}>
            Importovat
          </Button>
          <Button variant="contained" color="primary" onClick={handleSave} sx={{ ml: 2 }}>
            Uložit
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleExportWithSave} // export do Raynet
            sx={{ ml: 2 }}
          >
            Exportovat do Raynet
          </Button>
          {/* Nové tlačítko Exportovat do B2B */}
          <Button
            variant="contained"
            color="secondary"
            onClick={handleExportB2B}
            sx={{ ml: 2 }}
          >
            Exportovat do B2B
          </Button>
          <Button
            variant="outlined"
            onClick={handleMergeDataFromEndpoint}
            sx={{ ml: 2 }}
          >
            Doplnit data z endpointu
          </Button>
          <Button
            variant="outlined"
            onClick={() => setOpenExportXLSModal(true)}
            sx={{ ml: 2 }}
          >
            Export XLS
          </Button>
        </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel control={<Switch checked={isActive} disabled />} label="Aktivní ceník" />
            <IconButton onClick={() => setMinimized(!minimized)}>
              {minimized ? <ExpandMore /> : <ExpandLess />}
            </IconButton>
          </Box>
        </Box>

        {!minimized && (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField label="Dodavatel" value={supplier} fullWidth size="small" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField label="Verze" value={version} fullWidth size="small" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField label="Výrobce" value={manufacturer} fullWidth size="small" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField label="Kategorie" value={category} fullWidth size="small" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField label="Druh" value={type} fullWidth size="small" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                label="Platnost od"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                label="Platnost do"
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            {discount !== null && (
              <Grid item xs={12} sm={6} md={2.4}>
                <TextField
                  label="Sleva (%)"
                  value={discount}
                  fullWidth
                  size="small"
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            )}
            <Grid item xs={12} sm={6} md={2.4}>
              <FormControl fullWidth size="small">
                <InputLabel>Výběr zobrazení</InputLabel>
                <Select
                  value={selectedView}
                  label="Výběr zobrazení"
                  onChange={(e) => setSelectedView(e.target.value)}
                >
                  {Object.keys(views).map(viewKey => (
                    <MenuItem key={viewKey} value={viewKey}>{viewKey}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <FormControl fullWidth size="small">
                <InputLabel>Výběr cenové skupiny</InputLabel>
                <Select
                  value={selectedPriceGroup || ''}
                  label="Výběr cenové skupiny"
                  onChange={(e) => setSelectedPriceGroup(e.target.value)}
                >
                  <MenuItem value=""><em>Žádná cenová skupina</em></MenuItem>
                  {['1_eshop', '2_pult', '3_servis', '4_vo', '5_vip', '6_indiv', '7_dopravci', 'B2B']
                    .map(group => (
                      <MenuItem key={group} value={group}>{group}</MenuItem>
                    ))
                  }
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        )}

        {/* Checkboxy pro AX, Eshop, Raynet */}
        <Box sx={{ mt: 2 }}>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showAX}
                  onChange={(e) => handleCheckboxChange(e, 'AX')}
                />
              }
              label="AX"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showEshop}
                  onChange={(e) => handleCheckboxChange(e, 'Eshop')}
                />
              }
              label="Eshop"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showRaynet}
                  onChange={(e) => handleCheckboxChange(e, 'Raynet')}
                />
              }
              label="Raynet"
            />
          </FormGroup>
        </Box>

        {/* Tlačítko pro konflikty */}
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={handleCheckConflicts}>
            Zkontrolovat neznámé hodnoty
          </Button>
        </Box>
      </Box>

      {/* Tabulka s importovanými daty */}
      <Box
        sx={{
          height: minimized ? 'calc(100vh - 190px)' : 'calc(100vh - 180px - 190px)',
          overflowX: 'auto',
          overflowY: 'auto',
          mt: 2
        }}
      >
        {data.length > 0 && (
          <TableContainer component={Paper} sx={{ maxHeight: '100%' }}>
            <Table stickyHeader style={{ tableLayout: 'auto', minWidth: '1600px' }}>
              <TableHead sx={{ position: 'sticky', top: 0, zIndex: 1000 }}>
                <TableRow>
                  {views[selectedView].map((columnName, colIndex) => (
                    isColumnVisible(columnName) && (
                      <TableCell key={colIndex}>
                        {columnName === 'Checkbox'
                          ? (
                            <Checkbox
                              checked={selectAll}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const newData = data.map(row => ({ ...row, IsChecked: checked }));
                                setData(newData);
                                setSelectAll(checked);
                              }}
                            />
                          ) : (
                            columnName
                          )
                        }
                      </TableCell>
                    )
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((row, rowIndex) => (
                  <React.Fragment key={rowIndex}>
                    <TableRow sx={{ height: '36px' }} style={{ backgroundColor: row.IsNewItem ? '#ffcccc' : 'inherit' }}>
                      {views[selectedView].map((columnName, colIndex) => (
                        isColumnVisible(columnName) && (
                          <TableCell key={colIndex} sx={{ p: 1 }}>
                            {columnName === 'Checkbox' ? (
                              <Checkbox
                                checked={row.IsChecked || false}
                                onChange={(e) => {
                                  const newData = [...data];
                                  newData[rowIndex].IsChecked = e.target.checked;
                                  setData(newData);
                                  setSelectAll(newData.every(r => r.IsChecked));
                                }}
                              />
                            ) : (
                              row[columnName] || ''
                            )}
                          </TableCell>
                        )
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={views[selectedView].length} sx={{ p: 0, m: 0, border: 'none', height: '8px' }}>
                        <Box sx={{ borderBottom: '2px solid #000' }}></Box>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Modal pro Import */}
      <Modal open={openModal} onClose={() => setOpenModal(false)}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4
          }}
        >
          <ExportImportModal
            handleClose={() => setOpenModal(false)}
            onSubmit={handleModalSubmit}
            productLineId={null}
            categoryId={null}
            onSheetSelect={setSelectedSheet}
          />
        </Box>
      </Modal>

      {/* Modal pro export do Raynet */}
      <RaynetPriceListModal
        open={openExportModal}
        onClose={() => setOpenExportModal(false)}
        version={version}
        selectedSheet={selectedSheet}
        validFrom={validFrom}
        validTo={validTo}
        manufacturer={manufacturer}
        mainVersion={mainVersion}
        data={data}
        additionalColumns={{}}
      />

      {/* Modal pro export XLS */}
      <ExportXLSModal
        open={openExportXLSModal}
        onClose={() => setOpenExportXLSModal(false)}
        data={data}
        axData={axData}
        eshopData={eshopData}
        raynetData={raynetData}
        selectedView={selectedView}
        visibleColumns={views[selectedView]}
        version={version}
      />

      {/* Modal pro konflikty synonym */}
      <SynonymConflictModal
        open={synonymModalOpen}
        onClose={() => setSynonymModalOpen(false)}
        conflicts={conflictList}
        onSuccess={handleConflictResolved}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage.split('\n').map((str, idx) => (
            <span key={idx}>
              {str}
              <br />
            </span>
          ))}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CatalogImport;
