// src/components/CatalogViewer.js

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Stack
} from '@mui/material';
import axios from 'axios';

// 1) Definice zobrazení (views) – jaké sloupce se mají zobrazit
const views = {
  'Kompletní pohled': [
    'C_Polozky',
    'Cena',
    'Prodej_cena',
    'AkcniCena',
    'Nazev',
    'Rozmer',
    'Naprava',
    'Provoz',
    'M_S',
    'TPM_S',
    'MarketingovaAkce',
    'PlatnostOd',
    'PlatnostDo',
    'Vyrobce',
    'CenovaSkupina',
    'ZakaznickaSkupina',
    'Nakup_cena',
    'Nakladova_cena',
    'Hodnota_slevy',
    'nakup_sleva',
    'Marze_vyucisleno_nakup',
    'Marze_procent_nakup',
    'Marze_vyucisleno_sklad',
    'Marze_procent_sklad',
    'Sklad_Zlin',
    'Sklad_Praha',
    'Sklad_Ostrava',
    'Sklad_Brno',
    'Sklad_CeskeBudejovice',
    'Celkem',
    'dostupnost'
  ],
  'Ceník 1': ['Nazev', 'Cena'],
  'Ceník 2': ['C_Polozky', 'Nazev', 'Cena', 'Prodej_cena', 'Provoz', 'Naprava'],
  'Kalkulace - nákupní cena/skladová cena': [
    'C_Polozky',
    'Nazev',
    'Cena',
    'Prodej_cena',
    'Nakladova_cena',
    'Nakup_cena',
    'Hodnota_slevy',
    'nakup_sleva',
    'Marze_vyucisleno_nakup',
    'Marze_procent_nakup',
    'Marze_vyucisleno_sklad',
    'MarketingovaAkce',
    'PlatnostOd',
    'PlatnostDo',
    'Marze_procent_sklad'
  ],
  'Kalkulace - nákupní cena': [
    'C_Polozky',
    'Nazev',
    'Cena',
    'Prodej_cena',
    'Nakup_cena',
    'Hodnota_slevy',
    'nakup_sleva',
    'Marze_vyucisleno_nakup',
    'MarketingovaAkce',
    'PlatnostOd',
    'PlatnostDo',
    'Marze_procent_nakup'
  ],
  'Kalkulace - skladová cena': [
    'C_Polozky',
    'Nazev',
    'Cena',
    'Prodej_cena',
    'Nakladova_cena',
    'Hodnota_slevy',
    'Nakup_cena',
    'nakup_sleva',
    'Marze_vyucisleno_sklad',
    'MarketingovaAkce',
    'PlatnostOd',
    'PlatnostDo',
    'Marze_procent_sklad'
  ],
};

// 2) Pomocné funkce pro extrakci "Skupina produktu" z filterValues
function extractProductGroup(filterValues) {
  // Např. "Cenová skupina: 6_indiv; Skupina produktu: AD01040"
  if (!filterValues) return null;
  const match = filterValues.match(/Skupina produktu:\s*(\S+)/);
  return match ? match[1] : null;
}

// 3) Funkce pro rozdělení filterName na základní verzi a příponu (cenovou skupinu)
function parseBaseVersionAndGroup(filterName) {
  // Příklad: "CENIK_20250104_AD01040_V3_6_indiv" => baseVersion="CENIK_20250104_AD01040_V3", suffix="6_indiv"
  const regex = /^(CENIK_[^_]+_[^_]+_V\d+)(?:_(.+))?$/;
  const match = filterName.match(regex);
  if (match) {
    return {
      baseVersion: match[1],           // např. "CENIK_20250104_AD01040_V3"
      suffix: match[2] || null        // např. "6_indiv"
    };
  } else {
    // fallback – pokud to neodpovídá formátu, bereme celé jako baseVersion
    return {
      baseVersion: filterName,
      suffix: null
    };
  }
}

const CatalogViewer = () => {
  // === STAV KOMPONENTY ===
  // Seznam všech ceníků (z /search-versions)
  const [allItems, setAllItems] = useState([]);
  // Unikátní seznam Skupin produktu
  const [productGroups, setProductGroups] = useState([]);
  // Vybraná Skupina produktu
  const [selectedProductGroup, setSelectedProductGroup] = useState('');

  // Unikátní seznam "základních verzí" (např. CENIK_20250104_AD01040_V3)
  const [baseVersions, setBaseVersions] = useState([]);
  // Vybraná základní verze
  const [selectedBaseVersion, setSelectedBaseVersion] = useState('');

  // Unikátní seznam cenových skupin (suffix)
  const [priceGroups, setPriceGroups] = useState([]);
  // Vybraná cenová skupina
  const [selectedPriceGroup, setSelectedPriceGroup] = useState('');

  // Data pro tabulku
  const [data, setData] = useState([]);

  // Info do "hlavičky"
  const [supplier, setSupplier] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [version, setVersion] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');

  // Stav pro výběr zobrazení
  const [selectedView, setSelectedView] = useState('Kompletní pohled');

  // === 1. NAČTENÍ /search-versions po mountu ===
  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/search-versions`, {
      params: { componentType: 'PLOR' }
    })
      .then(resp => {
        const list = resp.data || [];
        setAllItems(list);

        // 1.1 extrahujeme Skupinu produktu z filterValues
        const pgSet = new Set();
        list.forEach(item => {
          const group = extractProductGroup(item.filterValues);
          if (group) pgSet.add(group);
        });
        setProductGroups([...pgSet]);
      })
      .catch(err => {
        console.error('Chyba načítání /search-versions:', err);
      });
  }, []);

  // === 2. KDYŽ se vybere Skupina produktu, sestavíme seznam baseVerzí ===
  useEffect(() => {
    if (!selectedProductGroup) {
      setBaseVersions([]);
      setSelectedBaseVersion('');
      setPriceGroups([]);
      setSelectedPriceGroup('');
      return;
    }

    // Filtrovat allItems => jen takové, které mají Skupinu produktu X
    // extrahovat "baseVersion" => pak seřadit sestupně dle createdAt a udělat unikáty
    const relevant = allItems.filter(item => {
      const group = extractProductGroup(item.filterValues);
      return group === selectedProductGroup;
    });

    // Rozdělíme filterName na { baseVersion, suffix }
    const baseArray = relevant.map(r => {
      const parsed = parseBaseVersionAndGroup(r.filterName);
      return {
        ...r,
        baseVersion: parsed.baseVersion,
        suffix: parsed.suffix
      };
    });

    // Seřadíme podle createdAt sestupně
    baseArray.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA; // sestupně
    });

    // Pak chceme extrahovat unikátní baseVersion
    const visited = new Set();
    const uniqueBase = [];
    for (const item of baseArray) {
      if (!visited.has(item.baseVersion)) {
        visited.add(item.baseVersion);
        uniqueBase.push(item.baseVersion);
      }
    }
    setBaseVersions(uniqueBase);
    setSelectedBaseVersion('');
    setPriceGroups([]);
    setSelectedPriceGroup('');
  }, [selectedProductGroup, allItems]);

  // === 3. KDYŽ se vybere baseVersion, sestavíme cenové skupiny (suffixy) ===
  useEffect(() => {
    if (!selectedBaseVersion) {
      setPriceGroups([]);
      setSelectedPriceGroup('');
      return;
    }
    // Najdeme v allItems + selectedProductGroup => itemy, co mají stejnou baseVersion
    const relevant = allItems.filter(item => {
      const group = extractProductGroup(item.filterValues);
      if (group !== selectedProductGroup) return false;
      const parsed = parseBaseVersionAndGroup(item.filterName);
      return parsed.baseVersion === selectedBaseVersion;
    });

    // Vyrobíme seznam suffixů (cenových skupin)
    const suffixSet = new Set();
    relevant.forEach(r => {
      const parsed = parseBaseVersionAndGroup(r.filterName);
      if (parsed.suffix) {
        suffixSet.add(parsed.suffix);
      }
    });
    const finalSuffixes = [...suffixSet];
    setPriceGroups(finalSuffixes);
    setSelectedPriceGroup('');
  }, [selectedBaseVersion, selectedProductGroup, allItems]);

  // === 4. KDYŽ se vybere cenová skupina => načteme data z /get-catalog-data ===
  useEffect(() => {
    if (!selectedBaseVersion || !selectedPriceGroup) {
      setData([]);
      setSupplier('');
      setManufacturer('');
      setCategory('');
      setType('');
      setValidFrom('');
      setValidTo('');
      setVersion('');
      return;
    }
    // "CENIK_..._V3" + "_" + "6_indiv" => "CENIK_..._V3_6_indiv"
    const finalVersionName = `${selectedBaseVersion}_${selectedPriceGroup}`;
  
    axios.get(`${process.env.REACT_APP_API_URL}/get-catalog-data`, {
      params: { 
        versionName: finalVersionName,
        selectedPriceGroup: selectedPriceGroup // Přidání tohoto parametru
      }
    })
    .then(resp => {
      console.log('Catalog Data Response:', resp.data);
      // Očekáváme { data: [ { filterId, filterName, data: [ ... ] } ] }
      if (resp.data && resp.data.data && resp.data.data.length > 0) {
        // Najdeme náš ceník
        const found = resp.data.data.find(d => d.filterName === finalVersionName);
        if (found && found.data.length > 0) {
          const items = found.data;
          // Naplníme hlavičku
          const first = items[0];
          setSupplier(first.Vyrobce || '');
          setManufacturer(first.Vyrobce || '');
          setCategory(first.ZakaznickaSkupina || '');
          setType(first.CenovaSkupina || '');
          setValidFrom(first.PlatnostOd || '');
          setValidTo(first.PlatnostDo || '');
          setVersion(found.filterName);

          setData(items);
        } else {
          // prázdné
          setData([]);
          setSupplier('');
          setManufacturer('');
          setCategory('');
          setType('');
          setValidFrom('');
          setValidTo('');
          setVersion('');
        }
      } else {
        // prázdné
        setData([]);
        setSupplier('');
        setManufacturer('');
        setCategory('');
        setType('');
        setValidFrom('');
        setValidTo('');
        setVersion('');
      }
    })
    .catch(err => {
      console.error('Chyba při načítání get-catalog-data:', err);
      // Můžete přidat i zobrazování chybové zprávy uživateli, pokud je to potřeba
    });
  }, [selectedBaseVersion, selectedPriceGroup]);

  // === Funkce pro určení viditelnosti sloupců ===
  const isColumnVisible = (column) => {
    if (!selectedView || !views[selectedView]) return false;
    return views[selectedView].includes(column);
  };

  // === RENDER ===
  return (
    <Box sx={{ p: 2, height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      <Typography variant="h4" gutterBottom>
        Zobrazení ceníků
      </Typography>

      {/* 
        3 SELECTY V JEDNOM ŘÁDKU: 
        - Skupina produktu
        - Základní verze
        - Cenová skupina
      */}
      <Box
        sx={{
          border: '1px solid lightgray',
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <Grid container spacing={2} alignItems="center">
          {/* 1. Skupina produktu */}
          <Grid item xs={4}>
            <FormControl fullWidth>
              <InputLabel>Skupina produktu</InputLabel>
              <Select
                value={selectedProductGroup}
                label="Skupina produktu"
                onChange={(e) => {
                  setSelectedProductGroup(e.target.value);
                }}
              >
                {productGroups.map(pg => (
                  <MenuItem key={pg} value={pg}>
                    {pg}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 2. Základní verze */}
          <Grid item xs={4}>
            <FormControl fullWidth>
              <InputLabel>Verze (sloučená)</InputLabel>
              <Select
                value={selectedBaseVersion}
                label="Verze"
                onChange={(e) => {
                  setSelectedBaseVersion(e.target.value);
                }}
              >
                {baseVersions.map(bv => (
                  <MenuItem key={bv} value={bv}>
                    {bv}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 3. Cenová skupina */}
          <Grid item xs={4}>
            <FormControl fullWidth>
              <InputLabel>Cenová skupina</InputLabel>
              <Select
                value={selectedPriceGroup}
                label="Cenová skupina"
                onChange={(e) => {
                  setSelectedPriceGroup(e.target.value);
                }}
              >
                {priceGroups.map(pg => (
                  <MenuItem key={pg} value={pg}>
                    {pg}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Informace nad tabulkou */}
        {version && (
          <Box sx={{ mt: 4, mb: 2 }}>
            <Typography variant="h6">Informace o verzi</Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Typography variant="body1"><strong>Výrobce:</strong> {manufacturer}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body1"><strong>Platnost od:</strong> {new Date(validFrom).toLocaleDateString()}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body1"><strong>Platnost do:</strong> {validTo ? new Date(validTo).toLocaleDateString() : 'Nepovinné'}</Typography>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Volitelně: Select pro zobrazení (views) a Reset tlačítko */}
        <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }}>
          {/* 4. Výběr zobrazení */}
          <Grid item xs={4}>
            <FormControl fullWidth>
              <InputLabel>Výběr zobrazení</InputLabel>
              <Select
                value={selectedView}
                label="Výběr zobrazení"
                onChange={(e) => setSelectedView(e.target.value)}
              >
                {Object.keys(views).map((viewKey) => (
                  <MenuItem key={viewKey} value={viewKey}>
                    {viewKey}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Tlačítko reset - menší velikost */}
          <Grid item xs={4}>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              onClick={() => {
                setSelectedProductGroup('');
                setSelectedBaseVersion('');
                setSelectedPriceGroup('');
                setSelectedView('Kompletní pohled');
                setData([]);
                setSupplier('');
                setManufacturer('');
                setCategory('');
                setType('');
                setValidFrom('');
                setValidTo('');
                setVersion('');
              }}
            >
              Resetovat filtry
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Informace o verzi - Alternativní zobrazení (pokud chceš jinak) */}
      {/* Můžeš upravit vzhled nebo uspořádání dle potřeby */}

      {/* Tabulka s daty */}
      <Box sx={{ height: 'calc(100vh - 350px)', overflowX: 'auto', overflowY: 'auto' }}>
        {data.length > 0 ? (
          <TableContainer component={Paper} sx={{ maxHeight: '100%' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {isColumnVisible('C_Polozky') && <TableCell>Kód položky</TableCell>}
                  {isColumnVisible('Nazev') && <TableCell>Název</TableCell>}
                  {isColumnVisible('Cena') && <TableCell>Cena Výrobce</TableCell>}
                  {isColumnVisible('Nakup_cena') && <TableCell>Nákup Cena</TableCell>}
                  {isColumnVisible('nakup_sleva') && <TableCell>Nákupní Sleva (%)</TableCell>}
                  {isColumnVisible('Prodej_cena') && <TableCell>Zák. Cena</TableCell>}
                  {isColumnVisible('Hodnota_slevy') && <TableCell>Zák. Sleva  (%)</TableCell>}
                  {isColumnVisible('AkcniCena') && <TableCell>Marketingová Cena</TableCell>}
                  {isColumnVisible('Rozmer') && <TableCell>Rozměr</TableCell>}
                  {isColumnVisible('Naprava') && <TableCell>Náprava</TableCell>}
                  {isColumnVisible('Provoz') && <TableCell>Provoz</TableCell>}
                  {isColumnVisible('M_S') && <TableCell>M+S</TableCell>}
                  {isColumnVisible('TPM_S') && <TableCell>3PMSF</TableCell>}
                  {isColumnVisible('MarketingovaAkce') && <TableCell>Marketingová akce</TableCell>}
                  {isColumnVisible('PlatnostOd') && <TableCell>Platnost od</TableCell>}
                  {isColumnVisible('PlatnostDo') && <TableCell>Platnost do</TableCell>}
                  {isColumnVisible('Vyrobce') && <TableCell>Výrobce</TableCell>}
                  {isColumnVisible('CenovaSkupina') && <TableCell>Cenová skupina</TableCell>}
                  {isColumnVisible('ZakaznickaSkupina') && <TableCell>Zákaznická skupina</TableCell>}
                  {isColumnVisible('Marze_vyucisleno_nakup') && <TableCell>Marže (Nákup) Kč</TableCell>}
                  {isColumnVisible('Marze_procent_nakup') && <TableCell>Marže (Nákup) (%)</TableCell>}
                  {isColumnVisible('Nakladova_cena') && <TableCell>Skladová cena</TableCell>}
                  {isColumnVisible('Marze_vyucisleno_sklad') && <TableCell>Marže (Sklad) Kč</TableCell>}
                  {isColumnVisible('Marze_procent_sklad') && <TableCell>Marže (Sklad) (%)</TableCell>}
                  {isColumnVisible('Sklad_Zlin') && <TableCell>Sklad Zlín</TableCell>}
                  {isColumnVisible('Sklad_Praha') && <TableCell>Sklad Praha</TableCell>}
                  {isColumnVisible('Sklad_Ostrava') && <TableCell>Sklad Ostrava</TableCell>}
                  {isColumnVisible('Sklad_Brno') && <TableCell>Sklad Brno</TableCell>}
                  {isColumnVisible('Sklad_CeskeBudejovice') && <TableCell>Sklad ČB</TableCell>}
                  {isColumnVisible('Celkem') && <TableCell>Celkem</TableCell>}
                  {isColumnVisible('dostupnost') && <TableCell>Dostupnost</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((row, idx) => (
                  <TableRow key={idx}>
                    {isColumnVisible('C_Polozky') && <TableCell>{row.C_Polozky}</TableCell>}
                    {isColumnVisible('Nazev') && <TableCell>{row.Nazev}</TableCell>}
                    {isColumnVisible('Cena') && <TableCell>{row.Cena}</TableCell>}
                    {isColumnVisible('Nakup_cena') && <TableCell>{row.Nakup_cena}</TableCell>}
                    {isColumnVisible('nakup_sleva') && <TableCell>{row.nakup_sleva}</TableCell>}
                    {isColumnVisible('Prodej_cena') && <TableCell>{row.Prodej_cena}</TableCell>}
                    {isColumnVisible('Hodnota_slevy') && <TableCell>{row.Hodnota_slevy}</TableCell>}
                    {isColumnVisible('AkcniCena') && <TableCell>{row.AkcniCena || "-"}</TableCell>}
                    {isColumnVisible('Rozmer') && <TableCell>{row.Rozmer || "-"}</TableCell>}
                    {isColumnVisible('Naprava') && <TableCell>{row.Naprava || "-"}</TableCell>}
                    {isColumnVisible('Provoz') && <TableCell>{row.Provoz || "-"}</TableCell>}
                    {isColumnVisible('M_S') && <TableCell>{row.M_S}</TableCell>}
                    {isColumnVisible('TPM_S') && <TableCell>{row.TPM_S}</TableCell>}
                    {isColumnVisible('MarketingovaAkce') && <TableCell>{row.MarketingovaAkce || "-"}</TableCell>}
                    {isColumnVisible('PlatnostOd') && <TableCell>{row.PlatnostOd ? new Date(row.PlatnostOd).toLocaleDateString() : "-"}</TableCell>}
                    {isColumnVisible('PlatnostDo') && <TableCell>{row.PlatnostDo ? new Date(row.PlatnostDo).toLocaleDateString() : "-"}</TableCell>}
                    {isColumnVisible('Vyrobce') && <TableCell>{row.Vyrobce}</TableCell>}
                    {isColumnVisible('CenovaSkupina') && <TableCell>{row.CenovaSkupina}</TableCell>}
                    {isColumnVisible('ZakaznickaSkupina') && <TableCell>{row.ZakaznickaSkupina}</TableCell>}
                    {isColumnVisible('Marze_vyucisleno_nakup') && <TableCell>{row.Marze_vyucisleno_nakup}</TableCell>}
                    {isColumnVisible('Marze_procent_nakup') && <TableCell>{row.Marze_procent_nakup}%</TableCell>}
                    {isColumnVisible('Nakladova_cena') && <TableCell>{row.Nakladova_cena}</TableCell>}
                    {isColumnVisible('Marze_vyucisleno_sklad') && <TableCell>{row.Marze_vyucisleno_sklad}</TableCell>}
                    {isColumnVisible('Marze_procent_sklad') && <TableCell>{row.Marze_procent_sklad}%</TableCell>}
                    {isColumnVisible('Sklad_Zlin') && <TableCell>{row.Sklad_Zlin}</TableCell>}
                    {isColumnVisible('Sklad_Praha') && <TableCell>{row.Sklad_Praha}</TableCell>}
                    {isColumnVisible('Sklad_Ostrava') && <TableCell>{row.Sklad_Ostrava}</TableCell>}
                    {isColumnVisible('Sklad_Brno') && <TableCell>{row.Sklad_Brno}</TableCell>}
                    {isColumnVisible('Sklad_CeskeBudejovice') && <TableCell>{row.Sklad_CeskeBudejovice}</TableCell>}
                    {isColumnVisible('Celkem') && <TableCell>{row.Celkem}</TableCell>}
                    {isColumnVisible('dostupnost') && <TableCell>{row.dostupnost}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography variant="body1">
            Pro zvolenou verzi nebyla nalezena žádná data.
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default CatalogViewer;
