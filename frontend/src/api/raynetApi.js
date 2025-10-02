// src/api/raynetApi.js

import axios from 'axios';
import qs from 'qs';

// Funkce pro získání dostupných měn z Raynet CRM
export const fetchAvailableCurrencies = async () => {
  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/raynet/currencies`);
    return response.data.data; // Vracíme pole měn
  } catch (error) {
    console.error('Chyba při načítání měn z Raynet CRM:', error);
    throw error;
  }
};
// funkce pro aktualizaci cen dle aktuálně nastavených marketingových akcí
export const updateSalesPrices = async (version, selectedSheet) => {
  try {
    console.log('Aktualizuji prodejní ceny pro verzi:', version, 'a skupinu:', selectedSheet);

    const response = await axios.post(`${process.env.REACT_APP_API_URL}/update-sales-prices`, {
      version,
      selectedPriceGroup: selectedSheet
    });

    if (response.status === 200) {
      console.log('Prodejní ceny byly úspěšně aktualizovány.');
      return response.data; // Pokud je potřeba vracet data
    } else {
      throw new Error(response.data.message || 'Neznámá chyba při aktualizaci prodejních cen.');
    }
  } catch (error) {
    console.error('Chyba při aktualizaci prodejních cen:', error);
    throw error;
  }
};

// Funkce pro získání ID ceníku podle jeho názvu
export const getPriceListIdByName = async (name) => {
  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/raynet/price-lists`, {
      params: {
        limit: 100,
      },
    });
    const priceLists = response.data.data;
    const matchingPriceList = priceLists.find((priceList) => priceList.name === name);
    return matchingPriceList ? matchingPriceList.id : null;
  } catch (error) {
    console.error('Chyba při načítání ceníků z Raynet CRM:', error);
    throw error;
  }
};

// Funkce pro vytvoření nového ceníku v Raynet CRM
export const createPriceListRaynet = async (priceListData) => {
  try {
    console.log('Odesílám PUT požadavek na vytvoření ceníku:', priceListData);
    const response = await axios.put(
      `${process.env.REACT_APP_API_URL}/raynet/price-list`,
      priceListData
    );
    console.log('Response z vytvoření ceníku:', response.data);
    return response.data;
  } catch (error) {
    console.error('Chyba při vytváření ceníku v Raynet CRM:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Funkce pro nalezení produktu podle kódu
export const findProductByCode = async (code) => {
  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/raynet/products`, {
      params: { code: code },
    });
    const products = response.data.data;
    return products.length > 0 ? products[0] : null;
  } catch (error) {
    console.error(`Chyba při hledání produktu s kódem ${code}:`, error);
    throw error;
  }
};

// Funkce pro vytvoření nového produktu v Raynet CRM
export const createProductRaynet = async (productData) => {
  try {
    console.log('Odesílám PUT požadavek na vytvoření produktu:', productData);
    const response = await axios.put(
      `${process.env.REACT_APP_API_URL}/raynet/product`,
      productData
    );
    console.log('Response z vytvoření produktu:', response.data);
    return response;
  } catch (error) {
    console.error('Chyba při vytváření produktu v Raynet CRM:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Funkce pro aktualizaci existujícího produktu v Raynet CRM
export const updateProductRaynet = async (productId, productData) => {
  try {
    const response = await axios.post(
      `${process.env.REACT_APP_API_URL}/raynet/product/${productId}`,
      productData
    );
    return response;
  } catch (error) {
    console.error('Chyba při aktualizaci produktu v Raynet CRM:', error);
    throw error;
  }
};
// Funkce pro přiřazení produktu k ceníku
export const assignProductToPriceList = async (priceListId, productId, price, cost) => {
  try {
    const priceListItemData = {
      product: productId,
      price: price,
      cost: cost,
    };

    // Ujistíme se, že priceListId je číslo
    const numericPriceListId = Number(priceListId);
    if (isNaN(numericPriceListId)) {
      throw new Error(`priceListId '${priceListId}' není číslo`);
    }

    // Zavoláme váš backend endpoint
    // Tento endpoint je definován na vašem serveru a provádí PUT požadavek do Raynetu
    const response = await axios.put(
      `${process.env.REACT_APP_API_URL}/raynet/price-list/${numericPriceListId}/item`,
      priceListItemData
    );
    return response;
  } catch (error) {
    console.error('Chyba při přidávání produktu do ceníku v Raynet CRM:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Nová funkce pro aktualizaci validTill ceníku
export const updatePriceListValidTo = async (priceListId, newValidTo) => {
  try {
    const updateData = {
      validTill: newValidTo,
    };
    const response = await axios.patch(
      `${process.env.REACT_APP_API_URL}/raynet/priceList/${priceListId}/`,
      updateData,
      {
        headers: {
          'X-Auth-Token': process.env.RAYNET_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`Ceník ${priceListId} aktualizován s validTill: ${newValidTo}`);
    return response.data;
  } catch (error) {
    console.error(`Chyba při aktualizaci validTill pro ceník ${priceListId}:`, error);
    throw error;
  }
};

// Funkce pro získání aktivních ceníků podle produktové skupiny (selectedSheet)
export const fetchActivePriceListsByProductGroup = async (productGroupName) => {
  const today = new Date().toISOString().split('T')[0];
  const queryParams = {
    offset: 0,
    limit: 1000, // Maximální počet vrácených ceníků
    'code[LIKE]': `%${productGroupName}%`,
    'validFrom[LE]': today,
    sortColumn: 'code',
    sortDirection: 'DESC',
  };

  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/raynet/price-lists`, {
      params: queryParams, // Opraveno na 'queryParams'
      paramsSerializer: params => qs.stringify(params, { encode: true }),
    });
    return response.data.data;
  } catch (error) {
    console.error(`Chyba při získávání aktivních ceníků pro produktovou skupinu ${productGroupName}:`, error);
    throw error;
  }
};

// Nová funkce pro hromadné omezení platnosti vybraných ceníků
export const limitPriceListsValidity = async (priceListIds, newValidTo) => {
  try {
    const response = await axios.post(
      `${process.env.REACT_APP_API_URL}/raynet/price-lists/limit-validity`,
      {
        priceListIds,
        validTill: newValidTo,
      }
    );
    return response.data;
  } catch (error) {
    console.error('Chyba při hromadném omezení platnosti ceníků:', error.response ? error.response.data : error.message);
    throw error;
  }
};
export const updatePriceListValidTillRaynet = async (priceListId, validTill) => {
  try {
    const response = await axios.post(
      `${process.env.RAYNET_BASE_URL}/raynet/priceList/${priceListId}`,
      { validTill },
      {
        headers: {
          'X-Auth-Token': process.env.RAYNET_TOKEN,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error(`Chyba při aktualizaci ceníku ${priceListId} v Raynet CRM:`, error.response ? error.response.data : error.message);
    throw error;
  }
};