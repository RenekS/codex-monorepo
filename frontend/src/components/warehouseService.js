import axios from 'axios';

/* ------------------------------------------------------------------ */
/* BUILDINGS / WAREHOUSES                                             */
/* ------------------------------------------------------------------ */
export async function createWarehouse(buildingName, shelfCount) {
  try {
    const response = await axios.post(
      `${process.env.REACT_APP_API_URL}/api/warehouse`,
      { buildingName, shelfCount }
    );
    return response.data;
  } catch (error) {
    console.error('Chyba při vytváření skladu:', error);
    throw error;
  }
}

export async function getWarehouses() {
  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/warehouse`);
    return response.data; // backend vrací např. { warehouses: [...] }
  } catch (error) {
    console.error('Chyba při načítání skladů:', error);
    throw error;
  }
}

/**
 * Nové: v2 endpoint, který vrací také rozpad krabic a reconciliation (AX vs WH)
 * - includeCartons=1 → slot.cartons = [{measurement_id, qty_units_in, issued_units, units_remaining}, ...]
 * - includeRecon=1   → reconciliation.{byAxItemId, byProduct, unmappedProducts}
 */
export async function getWarehousesV2({ includeCartons = 1, includeRecon = 1 } = {}) {
  const api = process.env.REACT_APP_API_URL;
  const url = `${api}/api/warehouse-v2?includeCartons=${includeCartons}&includeRecon=${includeRecon}`;
  try {
    const { data } = await axios.get(url);
    return data; // očekáváme { warehouses, reconciliation?, ... }
  } catch (error) {
    console.error('Chyba při načítání skladů (v2):', error);
    throw error;
  }
}

export async function updateWarehouse(buildingId, buildingName) {
  try {
    const response = await axios.put(
      `${process.env.REACT_APP_API_URL}/api/warehouse/${buildingId}`,
      { buildingName }
    );
    return response.data;
  } catch (error) {
    console.error('Chyba při aktualizaci budovy:', error);
    throw error;
  }
}

export async function deleteWarehouse(buildingId) {
  try {
    const response = await axios.delete(
      `${process.env.REACT_APP_API_URL}/api/warehouse/${buildingId}`
    );
    return response.data;
  } catch (error) {
    console.error('Chyba při mazání budovy:', error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* SHELVES                                                            */
/* ------------------------------------------------------------------ */
export async function addShelf(warehouseId, shelfName) {
  try {
    const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/shelf`, {
      warehouseId,
      shelfName,
    });
    return response.data;
  } catch (error) {
    console.error('Chyba při přidávání regálu:', error);
    throw error;
  }
}

export async function updateShelf(shelfId, shelfName) {
  try {
    const response = await axios.put(
      `${process.env.REACT_APP_API_URL}/api/shelf/${shelfId}`,
      { shelfName }
    );
    return response.data;
  } catch (error) {
    console.error('Chyba při aktualizaci regálu:', error);
    throw error;
  }
}

export async function deleteShelf(shelfId) {
  try {
    const response = await axios.delete(
      `${process.env.REACT_APP_API_URL}/api/shelf/${shelfId}`
    );
    return response.data;
  } catch (error) {
    console.error('Chyba při mazání regálu:', error);
    throw error;
  }
}

// Detailní informace o regálu (patra, sekce, sloty)
export async function updateShelfDetails(shelfData) {
  try {
    const response = await axios.put(
      `${process.env.REACT_APP_API_URL}/api/shelf/details/${shelfData.shelfId}`,
      shelfData
    );
    return response.data;
  } catch (error) {
    console.error('Chyba při upsertu detailů regálu:', error);
    throw error;
  }
}

// Vytvoření regálu s detailem jedním requestem
export async function createShelf(shelfData) {
  try {
    const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/shelf`, shelfData);
    return response.data;
  } catch (error) {
    console.error('Chyba při vytváření regálu:', error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* TEMPLATE SETTINGS                                                  */
/* ------------------------------------------------------------------ */
export async function getTemplateSettings() {
  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/templateSettings`);
    return response.data;
  } catch (error) {
    console.error('Chyba při načítání šablon:', error);
    throw error;
  }
}

export async function createTemplateSettings(templateData) {
  try {
    const response = await axios.post(
      `${process.env.REACT_APP_API_URL}/api/templateSettings`,
      templateData
    );
    return response.data;
  } catch (error) {
    console.error('Chyba při zakládání šablon:', error);
    throw error;
  }
}

export async function updateTemplateSettings(id, templateData) {
  try {
    const response = await axios.put(
      `${process.env.REACT_APP_API_URL}/api/templateSettings/${id}`,
      templateData
    );
    return response.data;
  } catch (error) {
    console.error('Chyba při aktualizaci šablon:', error);
    throw error;
  }
}

export async function deleteTemplateSettings(id) {
  try {
    const response = await axios.delete(
      `${process.env.REACT_APP_API_URL}/api/templateSettings/${id}`
    );
    return response.data;
  } catch (error) {
    console.error('Chyba při mazání šablon:', error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* PALLET SLOTS                                                       */
/* ------------------------------------------------------------------ */
export async function addPalletSlot({ sectionId, floorNumber, position, productId, status }) {
  try {
    const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/pallet_slot`, {
      sectionId,
      floorNumber,
      position,
      productId: productId || null,
      status: status || 'volno',
    });
    return response.data;
  } catch (error) {
    console.error('Chyba při přidávání paletového místa:', error);
    throw error;
  }
}

export async function deletePalletSlot(slotId) {
  try {
    const response = await axios.delete(
      `${process.env.REACT_APP_API_URL}/api/pallet_slot/${slotId}`
    );
    return response.data;
  } catch (error) {
    console.error('Chyba při mazání paletového místa:', error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* NOVÉ FUNKCE                                                        */
/* ------------------------------------------------------------------ */
export async function searchProducts(query) {
  if (!query || query.length < 2) return [];

  try {
    const response = await axios.get(
      `${process.env.REACT_APP_API_URL}/api/products/search`,
      { params: { q: query.trim() } }
    );
    return response.data;
  } catch (error) {
    console.error('Chyba při vyhledávání produktů:', error);
    return [];
  }
}

export async function assignProductToSlot(slotId, productId) {
  try {
    const response = await axios.put(
      `${process.env.REACT_APP_API_URL}/api/pallet_slot/${slotId}/product`,
      {
        productId,
        status: productId ? 'obsazeno' : 'volno',
      }
    );
    return response.data;
  } catch (error) {
    console.error('Chyba při přiřazování produktu k slotu:', error);
    throw error;
  }
}
