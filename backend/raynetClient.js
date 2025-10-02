// raynetClient.js
const axios = require('axios');

// Načtení proměnných prostředí
require('dotenv').config();

// Raynet API Client Konfigurace
const raynetApiKey = process.env.RAYNET_API_KEY;
const raynetInstanceName = process.env.RAYNET_INSTANCE_NAME;
const raynetUsername = process.env.RAYNET_USERNAME;

// Vytvoření axios instance s výchozí konfigurací
const raynetApi = axios.create({
  baseURL: 'https://app.raynet.cz/api/v2/',
  headers: {
    'X-Instance-Name': raynetInstanceName,
  },
  auth: {
    username: raynetUsername,
    password: raynetApiKey,
  },
});



// Funkce pro GET požadavky
async function get(endpoint, params = {}) {
    try {
      const response = await raynetApi.get(endpoint, { params });
      return response.data;
    } catch (error) {
      console.error(`Chyba při načítání dat z Raynet API (${endpoint}):`, error.response ? error.response.data : error.message);
      throw error; // Propagujeme chybu dále
    }
  }

// Funkce pro POST požadavky
async function post(endpoint, data = {}) {
  try {
    const response = await raynetApi.post(endpoint, data);
    return response.data;
  } catch (error) {
    console.error(`Chyba při odesílání dat do Raynet API (${endpoint}):`, error.response ? error.response.data : error.message);
    throw error;
  }
}

// Funkce pro PUT požadavky
async function put(endpoint, data = {}) {
  try {
    const response = await raynetApi.put(endpoint, data);
    return response.data;
  } catch (error) {
    console.error(`Chyba při aktualizaci dat v Raynet API (${endpoint}):`, error.response ? error.response.data : error.message);
    throw error;
  }
}

// Export funkcí
module.exports = {
  get,
  post,
  put,
};