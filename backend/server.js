

require('dotenv').config();

const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const xml2js = require('xml2js');
const sql = require('mssql');
const puppeteer = require('puppeteer');
const zlib = require('zlib');
const { Buffer } = require('buffer');
const fs = require('fs');
const path = require('path');
const sax = require('sax');
const ftp = require("basic-ftp");
const http = require('http');
const app = express();
const server = http.createServer(app);
const mqtt = require('mqtt');
const { format } = require('date-fns');
const raynetApiKey = process.env.RAYNET_API_KEY;
const raynetInstanceName = process.env.RAYNET_INSTANCE_NAME;
const raynetUsername = process.env.RAYNET_USERNAME;
const prestaApiKey = process.env.PRESTASHOP_API_KEY;
const prestaApi_URL = process.env.PRESTASHOP_API_URL;
const pneutyresApiKey = process.env.PNEUTYRES_API_KEY;
const pneutyresApi_URL = process.env.PNEUTYRES_API_URL;
const pneuB2bFtpHost = process.env.PNEUB2B_FTP_HOST || 'ftp.pneub2b.eu';
const pneuB2bLogin = process.env.PNEUB2B_LOGIN || 'PneuB2B.11503';
const pneuB2bPassword = process.env.PNEUB2B_PASSWORD || 'pz243ec3';
const pneuB2bHttpUrl = process.env.PNEUB2B_HTTP_URL || 'http://www.pneub2b.eu/PartnerCommunication.ashx';
const cron = require('node-cron');
const util = require('util');
const { v4: uuidv4 } = require('uuid');
const js2xmlparser = require('js2xmlparser');
const parser = new xml2js.Parser();
const os = require('os');
const FormData = require('form-data');
const pdfParse = require('pdf-parse');
const QRCode = require('qrcode');
const sharp  = require('sharp');
const { spawnSync } = require('child_process');
const pythons = ['python'];
const csv = require('csv-parser');
const PDFDocument = require('pdfkit');


const AGENT_BASE = process.env.AGENT_URL || 'http://127.0.0.1:4321';
const sleep = (ms)=>new Promise(r=>setTimeout(r, ms));

// === OpenAI API - START ===
const OpenAI = require('openai');
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY není nastaveno – /api/chat a /api/assistant nebudou fungovat.');
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// === OpenAI API - END ===

// Vytvoření Authorization header metodou Base64 (API_KEY s prázdným heslem)
const authorizationHeader = `Basic ${Buffer.from(`${prestaApiKey}:`).toString('base64')}`;

// Konfigurace adresáře se soubory
const patternImagesDir = '\\\\10.60.5.41\\aif\\Images\\Patterns\\';

//mapování cenových skupin Raynet
const cenoveSkupinyMap = {
  '1-ESHOP': 225,
  '2-PULT': 226,
  '3-SERVIS': 227,
  '4-VO': 228,
  '5-VIP': 229,
  '6-INDIV': 230,
  '7-DOPRAVCI': 231,
};

// Promise wrappery pro mysql (callback API)
function getConn(pool) {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, conn) => (err ? reject(err) : resolve(conn)));
  });
}
function exec(connOrPool, sql, params = []) {
  return new Promise((resolve, reject) => {
    connOrPool.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}
function begin(conn) {
  return new Promise((resolve, reject) => conn.beginTransaction(err => (err ? reject(err) : resolve())));
}
function commit(conn) {
  return new Promise((resolve, reject) => conn.commit(err => (err ? reject(err) : resolve())));
}
function rollback(conn) {
  return new Promise((resolve) => conn.rollback(() => resolve()));
}


// FTP nastavení - přejmenováno
const FTP_B2B_CONFIG = {
  host: pneuB2bFtpHost,
  user: pneuB2bLogin,
  password: pneuB2bPassword,
  secure: false
};

// funkce pro logování začátku úlohy
function logCronJobStart(jobName) {
  const runId = uuidv4(); // Generování unikátního ID pro toto spuštění
  const sql = 'INSERT INTO cron_job_logs (run_id, job_name, event_type, event_time) VALUES (?, ?, ?, NOW())';
  poolC5pneutyres.query(sql, [runId, jobName, 'start'], (error) => {
    if (error) {
      console.error('Chyba při zapisování startu cron úlohy:', error);
    }
  });
  return runId;
}

// funkce pro logování konce úlohy
function logCronJobEnd(runId, jobName, status, message, errorMessage) {
  const sql = `
    INSERT INTO cron_job_logs (run_id, job_name, event_type, event_time, status, message, error_message)
    VALUES (?, ?, ?, NOW(), ?, ?, ?)
  `;
  poolC5pneutyres.query(sql, [runId, jobName, 'end', status, message, errorMessage], (error) => {
    if (error) {
      console.error('Chyba při zapisování ukončení cron úlohy:', error);
    }
  });
}

// Probuzení render každých 10 minut, aby neusnul :)
cron.schedule('*/10 * * * *', () => {
  console.log('Cron: Pinging frontend a backend, aby render nezusnul.');

  // Pingnutí frontendové instance
  axios.get('https://czs-raynet-frontend.onrender.com/')
    .then(response => {
      console.log(`Frontend ping: Status ${response.status}`);
    })
    .catch(error => {
      console.error('Frontend ping error:', error.message);
    });

  // Pingnutí backendové instance
  axios.get('https://czs-raynet-backend.onrender.com/')
    .then(response => {
      console.log(`Backend ping: Status ${response.status}`);
    })
    .catch(error => {
      console.error('Backend ping error:', error.message);
    });
});

// ===== Pomocný normalizátor výsledků (aby fungovalo s mysql i mysql2) =====
async function q(pool, sql, params = []) {
  const r = await pool.query(sql, params);
  // mysql2 vrací [rows, fields], mysql vrací rows; sjednotíme na rows:
  return Array.isArray(r) && Array.isArray(r[0]) ? r[0] : r;
}


// Automatické spuštění nahrávání dat pneumatik každý den ve 3:00 ráno
cron.schedule('0 3 * * *', () => {
  const jobName = 'upload-tyres';
  const runId = logCronJobStart(jobName);

  axios.get('http://localhost:3000/upload-tyres?truncate=true')
    .then(response => {
      logCronJobEnd(runId, jobName, 'success', 'Data byla úspěšně nahrána.', null);
      console.log('Data pneumatik byla automaticky nahrána do databáze.');
    })
    .catch(error => {
      logCronJobEnd(runId, jobName, 'failure', null, error.message);
      console.error('Chyba při automatickém nahrávání dat pneumatik:', error);
    });
});

// Cron úloha aktualizace B2B každých 30 minut
cron.schedule('*/30 * * * *', () => {
  const jobName = 'update-inventory';
  const runId = logCronJobStart(jobName);

  axios.get('http://localhost:3000/updateInventory')
    .then(response => {
      logCronJobEnd(runId, jobName, 'success', 'Inventář byl úspěšně aktualizován.', null);
      console.log('Endpoint /updateInventory byl úspěšně spuštěn.');
    })
    .catch(error => {
      logCronJobEnd(runId, jobName, 'failure', null, error.message);
      console.error('Chyba při spouštění endpointu /updateInventory:', error);
    });
});


// Cron úloha aktualizace B2B products každých 30 minut
cron.schedule('*/30 * * * *', () => {
  const jobName = 'b2b-products';
  const runId = logCronJobStart(jobName);

  axios.get('https://pneu-tyres.cz/b2b.php')
    .then(response => {
      logCronJobEnd(runId, jobName, 'success', 'Produkty na Pneu-B2B úspěšně aktualizovány.', null);
      console.log('Endpoint b2b.php byl úspěšně spuštěn.');
    })
    .catch(error => {
      logCronJobEnd(runId, jobName, 'failure', null, error.message);
      console.error('Chyba při spouštění endpointu /updateInventory:', error);
    });
});

// Cron úloha aktualizace PointS products každých 30 minut
cron.schedule('*/30 * * * *', () => {
  const jobName = 'points-products';
  const runId = logCronJobStart(jobName);

  axios.get('https://pneu-tyres.cz/points.php')
    .then(response => {
      logCronJobEnd(runId, jobName, 'success', 'Produkty na PointS úspěšně aktualizovány.', null);
      console.log('Endpoint b2b.php byl úspěšně spuštěn.');
    })
    .catch(error => {
      logCronJobEnd(runId, jobName, 'failure', null, error.message);
      console.error('Chyba při spouštění endpointu /updateInventory:', error);
    });
});


// Automatické spouštění výpočtu denních nájezdů každý den ve 2:00 ráno
cron.schedule('0 2 * * *', () => {
  const jobName = 'calculate-daily-distances';
  const runId = logCronJobStart(jobName);

  axios.post('http://10.60.101.150:3000/calculate-daily-distances')
    .then(response => {
      logCronJobEnd(runId, jobName, 'success', 'Denní nájezdy byly automaticky vypočítány a uloženy.', null);
      console.log('Denní nájezdy byly automaticky vypočítány a uloženy.');
    })
    .catch(error => {
      logCronJobEnd(runId, jobName, 'failure', null, error.message);
      console.error('Chyba při automatickém výpočtu denních nájezdů:', error);
    });
});

// Automatické spouštění aktualizace skladem každou hodinu
cron.schedule('*/30 * * * *', () => {
  const jobName = 'update-skladem';
  const runId = logCronJobStart(jobName);

  axios.get('http://10.60.101.150:3000/update-skladem')
    .then(response => {
      logCronJobEnd(runId, jobName, 'success', 'Aktualizace skladem byla úspěšně provedena.', null);
      console.log('Aktualizace skladem byla úspěšně provedena.');
    })
    .catch(error => {
      logCronJobEnd(runId, jobName, 'failure', null, error.message);
      console.error('Chyba při automatické aktualizaci skladem:', error);
    });
});

// Automatické spouštění aktualizace skladem tavinox
cron.schedule('*/30 * * * *', () => {
  const jobName = 'update-skladem-tavinox';
  const runId = logCronJobStart(jobName);

  axios.get('http://10.60.101.150:3000/sync-stock-tavinox')
    .then(response => {
      logCronJobEnd(runId, jobName, 'success', 'Aktualizace skladem byla úspěšně provedena.', null);
      console.log('Aktualizace skladem byla úspěšně provedena.');
    })
    .catch(error => {
      logCronJobEnd(runId, jobName, 'failure', null, error.message);
      console.error('Chyba při automatické aktualizaci skladem:', error);
    });
});




// Automatické spouštění aktualizace skladem každou hodinu
cron.schedule('0 * * * *', () => {
  const jobName = 'specifické ceny';
  const runId = logCronJobStart(jobName);

  axios.get('http://10.60.101.150:3000/create-specific-prices')
    .then(response => {
      logCronJobEnd(runId, jobName, 'success', 'Aktualizace specifických cen úspěšná.', null);
      console.log('Aktualizace skladem byla úspěšně provedena.');
    })
    .catch(error => {
      logCronJobEnd(runId, jobName, 'failure', null, error.message);
      console.error('Chyba při vytváření specifických cen:', error);
    });
});


// konfigurace RaynetAPI
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



// Funkce pro získání produktů z Raynet CRM
async function fetchProductsRaynet(params = {}) {
  try {
    const response = await raynetApi.get('product/', { params });
    return response.data;
  } catch (error) {
    console.error('Chyba při načítání produktů z Raynet CRM:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Funkce pro vytvoření nového produktu v Raynet CRM
async function createProductRaynet(productData) {
  try {
    const response = await raynetApi.put('product', productData);
    return response.data;
  } catch (error) {
    console.error(
      'Chyba při vytváření produktu v Raynet CRM:',
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}


// Funkce pro aktualizaci produktu v Raynet CRM
async function updateProductRaynet(productId, productData) {
  try {
    const response = await raynetApi.post(`product/${productId}`, productData);
    return response.data;
  } catch (error) {
    console.error('Chyba při aktualizaci produktu v Raynet CRM:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// NEJDŘÍVE MUSÍ BÝT DEFINOVANÝ mssqlConfig
const mssqlConfig = {
  server: process.env.DB_SERVER || '10.60.5.43',
  database: process.env.DB_DATABASE || 'AxProdCS',
  user: process.env.DB_USER || 'eshop_pt',
  password: process.env.DB_PASSWORD || 'FEya45.-dd',
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true', 
    enableArithAbort: true,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    multipleActiveResultSets: true
  }
};

// Tato funkce je staré jednorázové připojení (používají ho starší endpointy)
async function connectToMSSQL() {
  try {
    await sql.connect(mssqlConfig);
    console.log('Connected to the MSSQL database successfully (old method)');
  } catch (err) {
    console.error('Failed to connect to the MSSQL database (old method):', err);
  }
}

// NOVÉ connection pool připojení
const poolPromiseMSSQL = new sql.ConnectionPool(mssqlConfig)
  .connect()
  .then(pool => {
    console.log('Connected to MSSQL Database (connection pool)');
    return pool;
  })
  .catch(err => {
    console.error('MSSQL Connection Failed (connection pool)!', err);
    throw err;
  });

// Funkce pro dotazy na connection pool (použití v nových endpointech)
function queryMSSQL(query, params) {
  return poolPromiseMSSQL.then(pool => {
    const request = pool.request();
    // Přidání parametrů, pokud existují
    if (params && params.length > 0) {
      params.forEach(param => {
        // Předpokládáme, že každý param je objekt { name, type, value }
        request.input(param.name, param.type, param.value);
      });
    }
    return request.query(query);
  });
}


// Konfigurace MySQL databáze - dočasně, není pool
const db = mysql.createConnection({
  host: 'pneu-tyres.cz',
  user: 'c5sluzbyint',
  password: '!VN7Ts!VN7TsT4cmGyqT4cmGyq!V',
  database: 'c5sluzbyint'
});




// Konfigurace připojení k databázi pro pool
const poolC5tpms = mysql.createPool({
  connectionLimit: 10,
  host: 'Ww35.virthost.cz',
  user: 'c5tpms',
  password: '7#3JXtuGvWv',
  database: 'c5tpms',
  charset: 'utf8mb4',
  namedPlaceholders: true
});
// Funkce pro Dotazy MSSQL
function queryMSSQL(query, params) {
  return poolPromiseMSSQL.then(pool => {
    const request = pool.request();
    // Přidání parametrů, pokud existují
    if (params && params.length > 0) {
      params.forEach(param => {
        // Předpokládáme, že každý param je objekt { name: 'paramName', type: sql.Type, value: value }
        request.input(param.name, param.type, param.value);
      });
    }
    return request.query(query);
  });
}

const poolC5pneutyres = mysql.createPool({
  connectionLimit: 10,
  host: 'Ww35.virthost.cz',
  user: 'c5pneutyres',
  password: 'tuzckXUMF!4',
  database: 'c5pneutyres',
  charset: 'utf8mb4',
  namedPlaceholders: true
});

const poolC5sluzbyint = mysql.createPool({
  connectionLimit: 10,
  host: 'pneu-tyres.cz',
  user: 'c5sluzbyint',
  password: '!VN7Ts!VN7TsT4cmGyqT4cmGyq!V',
  database: 'c5sluzbyint',
  charset: 'utf8mb4',
  namedPlaceholders: true
});

/* === Databázové připojení pro Tavinox === */
const poolC5tavinox = mysql.createPool({
  connectionLimit: 10,
  host: 'Ww35.virthost.cz',
  user: 'c5b2btavinoxcom',
  password: 'RRYtf_Yht69Ytf_Yht69',
  database: 'c5b2btavinoxcom',
  charset: 'utf8mb4',
  namedPlaceholders: true
});


function queryC5sluzbyint(sql, params) {
  return new Promise((resolve, reject) => {
    poolC5sluzbyint.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}
// Promisifikace metod
poolC5tpms.getConnection = util.promisify(poolC5tpms.getConnection);
poolC5tpms.query = util.promisify(poolC5tpms.query);
poolC5pneutyres.getConnection = util.promisify(poolC5pneutyres.getConnection);
poolC5pneutyres.query = util.promisify(poolC5pneutyres.query);
poolC5sluzbyint.query = util.promisify(poolC5sluzbyint.query);
poolC5tavinox.getConnection = util.promisify(poolC5tavinox.getConnection);
poolC5tavinox.query = util.promisify(poolC5tavinox.query);



app.use((req, res, next) => {
  console.log(`Příchozí požadavek: ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  credentials: true

}));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

function query(pool, sql, params) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

poolC5tpms.query('SELECT 1 + 1 AS solution', (err, results) => {
  if (err) {
    console.error('Chyba při testování spojení s databází:', err);
    return;
  }
  console.log('Testovací dotaz na databázi byl úspěšný, výsledek: ', results[0].solution);
});




// Funkce pro parsování XML souboru
async function parseXML(filePath) {
  const parser = new xml2js.Parser({ explicitArray: false });
  const xml = fs.readFileSync(filePath, "utf-8");
  return parser.parseStringPromise(xml);
}

// Funkce pro stažení XML souboru z FTP
async function fetchXMLFromFTP(ftpDetails, localXMLPath) {
  const client = new ftp.Client();
  client.ftp.verbose = true;
  try {
    await client.access({
      host: ftpDetails.host,
      user: ftpDetails.user,
      password: ftpDetails.password,
      secure: ftpDetails.secure
    });
    await client.downloadTo(localXMLPath, ftpDetails.remoteFilePath);
  } catch (error) {
    console.error(error);
  }
  client.close();
}

// Mapování „souborů“ na příkazy PneuB2B ProfiData
const allowedPneuB2bFiles = new Map([
  // sortiment dostupných položek
  ['Product_list.xml', 'products_list'],

  // kompletní sortiment včetně nedostupných položek
  ['Product_list_full.xml', 'products_list_full'],

  // stav skladu + ceny všech dostupných položek
  ['Stock_Price_list.xml', 'stock_price_list'],

  // pokud tenhle tvůj interní export existuje,
  // zatím ho mapujeme na stejné data jako stock_price_list
  ['B2B_stock_products_list_tyres.xml', 'stock_price_list']
]);

app.get('/pneub2b/product-list', async (req, res) => {
  const file = (req.query.file || 'Product_list.xml').toString();
  const cmd = allowedPneuB2bFiles.get(file);

  if (!cmd) {
    return res.status(400).json({ error: 'Unsupported file requested.' });
  }

  // Složka, kam se bude ukládat (můžeš změnit např. na 'import')
  const importDir = path.join(__dirname, 'import');
  const targetPath = path.join(importDir, file);

  try {
    const response = await axios.get(pneuB2bHttpUrl, {
      auth: { username: pneuB2bLogin, password: pneuB2bPassword },
      params: { cmd },                  // přesně podle datasheetu
      responseType: 'arraybuffer',      // stahujeme binárně
      timeout: 60000,
      // volitelné: gzip komprese, jak doporučují v dokumentu
      headers: {
        'Accept-Encoding': 'gzip'
      }
    });

    await fs.promises.mkdir(importDir, { recursive: true });

    // přepíše existující soubor, pokud tam už je
    await fs.promises.writeFile(targetPath, response.data);

    // vrátíme jen malý JSON – žádné velké XML do response
    return res.json({
      status: 'ok',
      file,
      path: targetPath,
      size: response.data.length
    });
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    console.error('PneuB2B HTTP fetch failed:', error.message);
    return res
      .status(status)
      .json({ error: 'Failed to fetch or save XML' });
  }
});


// Detaily pro připojení k FTP a cestu k souboru
const ftpDetails = {
  host: pneuB2bFtpHost,
  user: pneuB2bLogin,
  password: pneuB2bPassword,
  remoteFilePath: "./products.xml"
};
const localXMLPath = path.join(__dirname, "temp_products.xml");

// MQTT připojovací údaje
const mqttConfig = {
  broker: 'mqtt://47.115.58.90',
  port: 2883,
  clientId: 'ls5t2vf5o96lb7uertj5826zm2zwnnj8',
  topics: [
    '/cgw/350916060611152/data-report',
    '/cgw/351516175515329/data-report',
  ]
};

// Připojení k MQTT brokeru
const mqttClient = mqtt.connect(mqttConfig.broker, {
  port: mqttConfig.port,
  clientId: mqttConfig.clientId,
  keepalive: 60,
  reconnectPeriod: 1000
});

mqttClient.on('connect', function () {
  console.log('Připojení k MQTT brokeru bylo úspěšné.');
  mqttConfig.topics.forEach(topic => {
    mqttClient.subscribe(topic, function (err) {
      if (err) {
        console.error(`Chyba při přihlašování k odběru na téma ${topic}:`, err);
      } else {
        
      }
    });
  });
});

mqttClient.on('message', async function (topic, message) {
  

  try {
    var hexData = message.toString('hex');
    if (!hexData) {
      
      return;
    }
    

    const deviceId = topic.split('/')[2];
    const timestamp = Date.now(); // Získání timestampu v milisekundách

    const sensorData = parseMQTTData(hexData);
    

    if (sensorData.length > 0) {
      const sqlQueries = await createSQLQueries(deviceId, sensorData);
      

      for (const sql of sqlQueries) {
        await new Promise((resolve, reject) => {
          poolC5tpms.query(sql, (err, results) => {
            if (err) return reject(err);
            resolve(results);
          });
        });
      }
      
    } else {
      
    }
  } catch (error) {
    
  }
});

mqttClient.on('error', function (err) {
  
});

mqttClient.on('close', function () {
  
});

mqttClient.on('reconnect', function () {
  
});

mqttClient.on('offline', function () {
  
});

mqttClient.on('end', function () {
  
});

// Funkce pro konverzi hexadecimálního řetězce na pole JSON objektů
function parseMQTTData(data) {
  const sensorData = [];
  let currentIndex = 0;
  const currentTimestamp = Date.now(); // Získání timestampu v milisekundách

  while (currentIndex < data.length) {
    // Extrahuj GNSS data pokud jsou k dispozici
    if (data.substring(currentIndex, currentIndex + 4) === 'c600') {
      const header = data.substring(currentIndex + 4, currentIndex + 8); 
      const altitudeHex = data.substring(currentIndex + 8, currentIndex + 16);
      const latitudeHex = data.substring(currentIndex + 16, currentIndex + 24);
      const longitudeHex = data.substring(currentIndex + 24, currentIndex + 32);

      const altitude = convertHexToFloat(altitudeHex);
      const latitude = convertCoordinate(convertHexToFloat(longitudeHex));
      const longitude = convertCoordinate(convertHexToFloat(latitudeHex));

      sensorData.push({
        type: 'gnss',
        data: {
          macAddress: 'Neznámý',
          longitude, // Správné přiřazení longitude
          latitude, // Správné přiřazení latitude
          altitude,
          timestamp: currentTimestamp
        }
      });

      currentIndex += 32; // Posun za délku zpracovaných GNSS dat

    } else if (data.substring(currentIndex, currentIndex + 6) === '80eaca') {
      const macAddress = data.substring(currentIndex, currentIndex + 12);
      const pressureStartIndex = currentIndex + 12;
      const pressureHex = rearrangeData(data.substring(pressureStartIndex, pressureStartIndex + 8));
      const pressure = parseInt(pressureHex, 16) * 0.00001;

      const temperatureStartIndex = pressureStartIndex + 8;
      const temperatureHex = rearrangeData(data.substring(temperatureStartIndex, temperatureStartIndex + 8));
      const temperaturePrecalc = parseInt(temperatureHex, 16);
      const temperaturePrecalcSigned = convertUnsignedToSigned(temperaturePrecalc);
      const temperature = temperaturePrecalcSigned * 0.01;

      const batteryPercentageStartIndex = temperatureStartIndex + 8;
      const batteryPercentageHex = data.substring(batteryPercentageStartIndex, batteryPercentageStartIndex + 2);
      const batteryPercentage = parseInt(batteryPercentageHex, 16);

      const leakingStartIndex = batteryPercentageStartIndex + 2;
      const leakingValue = data.substring(leakingStartIndex, leakingStartIndex + 2);
      let leaking = leakingValue !== "00";

      const rssiStartIndex = leakingStartIndex + 2;
      const rssiHex = data.substring(rssiStartIndex, rssiStartIndex + 2);
      const rssiUnsigned = parseInt(rssiHex, 16);
      const rssiSigned = convertUnsignedToSigned(rssiUnsigned);

     

      sensorData.push({
        type: 'adv_data',
        data: {
          macAddress,
          pressure,
          temperature,
          batteryPercentage,
          leaking,
          rssi: rssiSigned,
          longitude: null, 
          latitude: null,
          altitude: null,
          timestamp: currentTimestamp
        }
      });

      currentIndex += 42; // Posun za délku zpracovaných BLE dat včetně RSSI
    } else {
      currentIndex += 2; // Přeskoč neznámá data
    }
  }

  return sensorData;
}

// Pomocné funkce pro převod dat
function rearrangeData(data) {
  return data[6] + data[7] + data[4] + data[5] + data[2] + data[3] + data[0] + data[1];
}

function convertUnsignedToSigned(unsignedInt) {
  if (unsignedInt > 127) {
    return unsignedInt - 256;
  }
  return unsignedInt;
}

function convertHexToFloat(hexStr) {
  function swapEndian(hexStr) {
    return hexStr.match(/../g).reverse().join('');
  }

  const swappedHex = swapEndian(hexStr);
 
  const buffer = Buffer.from(swappedHex, 'hex');
  const floatValue = buffer.readFloatBE(0);
 

  return floatValue;
}

function convertCoordinate(value) {
  const degrees = Math.floor(Math.abs(value) / 100);
  const minutes = Math.abs(value) % 100;
  const decimalDegrees = degrees + (minutes / 60);
  return value < 0 ? -decimalDegrees : decimalDegrees;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius of the Earth in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // in meters
  return distance;
}

// Funkce pro získání předchozího záznamu a výpočet delta hodnoty
async function getPreviousRecordAndCalculateDelta(deviceId, latitude, longitude, timestamp) {
  const query = `
    SELECT
      OLD.id,
      OLD.device_id,
      OLD.timestamp,
      OLD.latitude,
      OLD.longitude,
      (6371 * acos(cos(radians(?)) * cos(radians(OLD.latitude)) * cos(radians(OLD.longitude) - radians(?)) + sin(radians(?)) * sin(radians(OLD.latitude)))) AS distance
    FROM
      parsed_gnss_data AS OLD
    WHERE
      OLD.device_id = ? AND
      OLD.timestamp < ?
    ORDER BY
      OLD.timestamp DESC
    LIMIT 1;
  `;

  const [lastRecord] = await new Promise((resolve, reject) => {
    poolC5tpms.query(query, [latitude, longitude, latitude, deviceId, timestamp], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

  

  let delta = null;
  if (lastRecord) {
    delta = lastRecord.distance;
   
  }

  return delta;
}

// Funkce pro vytvoření SQL dotazů z pole JSON objektů
async function createSQLQueries(deviceId, sensorData) {
  const sqlQueries = [];

  for (const data of sensorData) {
    let sql;
    switch (data.type) {
      case 'gnss':
        console.log(`Creating SQL query for GNSS data: ${JSON.stringify(data.data)}`);
        const delta = await getPreviousRecordAndCalculateDelta(deviceId, data.data.latitude, data.data.longitude, data.data.timestamp);
        sql = `INSERT INTO parsed_gnss_data (device_id, timestamp, longitude, latitude, altitude, delta) VALUES ('${deviceId}', ${data.data.timestamp}, ${data.data.longitude}, ${data.data.latitude}, ${data.data.altitude}, ${delta});`;
        break;
      case 'adv_data':
        sql = `INSERT INTO parsed_ad_data (locationId, timestamp, macAddress, pressure, temperature, batteryPercentage, leaking, rssi, longitude, latitude, altitude) VALUES ('${deviceId}', ${data.data.timestamp}, '${data.data.macAddress}', ${data.data.pressure}, ${data.data.temperature}, ${data.data.batteryPercentage}, ${data.data.leaking ? 1 : 0}, ${data.data.rssi}, NULL, NULL, NULL);`;
        break;
      default:
        break;
    }
    if (sql) {
      sqlQueries.push(sql);
    }
  }

  return sqlQueries;
}

// Nastavení multer pro zpracování nahrávaných souborů
const uploadMulter = multer({ storage: multer.memoryStorage() });



const ownerMap = {
  "KOVAŘÍK ALEŠ": 154,
  "BRTNA JAN": 166,
  "HINK DAVID": 18,
  "VALČÍKOVÁ OLGA": 167,
  "FORMAN BOHUMIL": 168,
  "JENÍK PAVEL": 17,
  "KOMENDIR LUMÍR": 66,
  "MATLOCHA KAMIL": 170,
  "CHRÁSTKOVÁ JANA": 169,
  "SCHNEER RENÉ": 13 // fallback
};

const strediskoMap = {
  "OSTRAVA": 235,
  "ZLÍN": 242,
  "ZLIN": 242,
  "PRAHA": 261,
  "BRNO": 262,
  "NEPŘIŘAZENO": 263,
  "CB": 264
};


async function addItemToBusinessCaseRaynet(businessCaseId, itemData) {
  try {
    if (!businessCaseId) {
      throw new Error('Neplatné businessCaseId');
    }

    // Sestavíme payload podle přesných požadavků
    const itemPayload = {
      productCode: itemData.productCode,
      name: itemData.name || 'Bez názvu',
      count: typeof itemData.count === 'number' ? itemData.count : 1,
      price: typeof itemData.price === 'number' ? itemData.price : 0,
      taxRate: typeof itemData.taxRate === 'number' ? itemData.taxRate : 21,
      discountPercent: typeof itemData.discountPercent === 'number' ? itemData.discountPercent : 0,
      cost: typeof itemData.cost === 'number' ? itemData.cost : 0,
      description: itemData.description || 'Bez popisu'
    };

    // Pokud je priceList dostupný a je číslo, přidáme jej do payloadu
    if (typeof itemData.priceList === 'number') {
      itemPayload.priceList = itemData.priceList;
    }

    console.log('Item Payload pro vytvoření:', JSON.stringify(itemPayload, null, 2));

    // Volání Raynet API pro přidání položky do obchodního případu
    const response = await raynetApi.put(`/businessCase/${businessCaseId}/item/`, itemPayload);

    console.log('Položka přidána do obchodního případu:', JSON.stringify(response.data, null, 2));
    return response.data;

  } catch (error) {
    console.error(`Chyba při přidávání položky do obchodního případu ${businessCaseId}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}


// Funkce pro získání ID klasifikace na základě code01
async function getClassificationIdByCode(code, type) {
  try {
    let endpoint;
    if (type === 1) {
      endpoint = '/businessCaseClassification1/';
    } else if (type === 2) {
      endpoint = '/businessCaseClassification2/';
    } else {
      throw new Error('Neplatný typ klasifikace');
    }

    console.log(`Volám API pro získání klasifikace z endpointu: ${endpoint}`);
    const response = await raynetApi.get(endpoint);
    
    // Logování vrácených dat
    console.log(`Data vrácená z endpointu ${endpoint}:`, JSON.stringify(response.data, null, 2));
    
    const classifications = response.data.data;

    // Najdeme klasifikaci podle code01
    const classification = classifications.find(cls => cls.code01.toLowerCase() === code.toLowerCase());
    
    if (classification) {
      console.log(`Klasifikace nalezena: ID=${classification.id}, code01=${classification.code01}`);
    } else {
      console.warn(`Klasifikace s code01="${code}" nebyla nalezena.`);
    }

    return classification ? classification.id : null;
  } catch (error) {
    console.error('Chyba při získávání ID klasifikace:', error.response ? error.response.data : error.message);
    throw error;
  }
}


// Funkce pro vytvoření nového obchodního případu
async function createBusinessCase(data) {
  try {
    // Nastavení 'category' na základě hodnoty 'data.category'
    const categoryValue = data.category === 20103 ? 108 : 107;

    const requestData = {
      name: data.name,
      company: data.company, // Přidáno company
      description: data.description,
      code: data.code, // Přidáno code, pokud je potřeba
      businessCaseClassification1: data.businessCaseClassification1, // Přidáno classification1
      businessCaseClassification2: data.businessCaseClassification2, // Přidáno classification2
      owner: data.owner,
      businessCasePhase: data.businessCasePhase || 5,
      category: categoryValue, // Nastavená hodnota 'category'
      ...(data.validFrom && { validFrom: data.validFrom }),
      ...(data.validTill && { validTill: data.validTill }),
      ...(data.securityLevel && { securityLevel: data.securityLevel }),
      // Přidejte další pole dle potřeby a dokumentace
    };
    
    console.log('Request data for createBusinessCase:', JSON.stringify(requestData, null, 2));
    
    const response = await raynetApi.put('/businessCase/', requestData);
    return response.data.data;
  } catch (error) {
    console.error(`Chyba při vytváření obchodního případu:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

async function updateBusinessCase(businessCaseId, data) {
  try {
    // Nastavení 'category' na základě hodnoty 'data.category'
    const categoryValue = data.category === 20103 ? 108 : 107;

    const requestData = {
      name: data.name,
      description: data.description,
      company: data.company, // Ujistěte se, že je to platné ID společnosti
      businessCaseClassification1: data.businessCaseClassification1,
      businessCaseClassification2: data.businessCaseClassification2,
      owner: data.owner,
      businessCasePhase: data.businessCasePhase || 5,
      category: categoryValue, // Nastavená hodnota 'category'
    
      ...(data.securityLevel && { securityLevel: data.securityLevel }),
      ...(data.validFrom && { validFrom: data.validFrom }),
      ...(data.validTill && { validTill: data.validTill }),
      // Přidejte další pole dle potřeby a dokumentace
    };

    console.log('Request data for updateBusinessCase:', JSON.stringify(requestData, null, 2));
    const response = await raynetApi.post(`/businessCase/${businessCaseId}/`, requestData);
    return response.data.data;
  } catch (error) {
    if (error.response) {
      console.error(`Chyba při aktualizaci obchodního případu s ID ${businessCaseId}:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(`Chyba při aktualizaci obchodního případu s ID ${businessCaseId}:`, error.message);
    }
    // Rozhodněte se, zda chcete chybu znovu vyvolat nebo pokračovat
    throw error; // Nebo nepoužívejte throw, pokud chcete pokračovat
  }
}


// Function to find company ID by ICO
async function findCompanyIdByICO(ico) {
  try {
    const response = await raynetApi.get('/company/', {
      params: {
        customFields: 'true',
        ico: ico
      }
    });
    const companies = response.data.data;
    if (companies.length > 0) {
      return companies[0].id;
    } else {
      console.warn(`Company with ICO "${ico}" not found.`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching company by ICO:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function findCompanyIdByRegNumber(regNumber) {
  try {
    console.log(`Hledám společnost s IČ: ${regNumber}`);
    const response = await raynetApi.get('/company/', {
      params: {
        limit: 1000,
        'regNumber[EQ]': regNumber, // Používáme operátor EQ pro přesnou shodu
      },
    });
    const companies = response.data.data;
    if (companies.length > 0) {
      console.log(`Společnost nalezena s ID: ${companies[0].id}`);
      return companies[0].id;
    } else {
      console.log(`Společnost s IČ ${regNumber} nebyla nalezena.`);
      return null;
    }
  } catch (error) {
    console.error(`Chyba při hledání společnosti s IČ ${regNumber}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}


//funkce pro získání ID teritoria
async function getTerritoryIdByName(territoryName) {
  try {
    console.log(`Hledám teritorium s názvem: ${territoryName}`);
    // Získáme seznam teritorií
    const response = await raynetApi.get('/territory/');
    const territories = response.data.data;

    // Normalizujeme názvy pro porovnávání (bez diakritiky, malá písmena)
    function normalizeString(str) {
      return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    const normalizedTerritoryName = normalizeString(territoryName);

    // Najdeme teritorium s odpovídajícím názvem
    const territory = territories.find(t => normalizeString(t.code01) === normalizedTerritoryName);

    if (territory) {
      console.log(`Teritorium nalezeno: ID=${territory.id}, code01=${territory.code01}`);
      return territory.id;
    } else {
      console.warn(`Teritorium s názvem "${territoryName}" nebylo nalezeno.`);
      return null;
    }
  } catch (error) {
    console.error(`Chyba při získávání teritorií:`, error.response ? error.response.data : error.message);
    return null;
  }
}


//funkce pro vytvoření nového klienta
async function createCompany(data) {
  try {
    const requestData = {
      name: data.name,
      regNumber: data.regNumber,
      person: false, // Nastavte na false pro právnické osoby
      rating: 'A',
      state: 'B_ACTUAL',
      role: 'B_PARTNER',
      addresses: [
        {
          address: {
            name: 'Sídlo klienta',
            street: data.street || 'Neuvedena', // Zajistěte, aby street nebyla prázdná
            city: data.city,
            zipCode: data.zipCode || '00000', // Zajistěte, aby zipCode nebyl prázdný
            country: 'CZ',
          },
          territory: data.territory,
          primary: true,
        },
      ],
    };
    console.log('Request data for createCompany:', JSON.stringify(requestData, null, 2));
    const response = await raynetApi.put('/company/', requestData);
    console.log('Klient vytvořen:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error(`Chyba při vytváření klienta:`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    throw error;
  }
}

// Volá Raynet API pro úpravu custom fields (volitelných polí) klienta
// Funkce pro update custom fields klienta + logování limitu
async function updateCompanyCustomFields(companyId, customFields) {
  try {
    const requestData = { customFields };
    const response = await raynetApi.post(`/company/${companyId}/`, requestData);
    updateRaynetRateLimit(response?.headers);
    console.log('Raynet response:', JSON.stringify(response.data, null, 2));
    return response.data; // může být {} pokud Raynet nic nevrací
  } catch (error) {
    updateRaynetRateLimit(error?.response?.headers);
    console.error(`Chyba při aktualizaci custom fields klienta s ID ${companyId}:`,
      error.response ? JSON.stringify(error.response.data, null, 2) : error.message
    );
    throw error;
  }
}

// Na začátek souboru přidej:
let lastRaynetRateLimit = null;

function updateRaynetRateLimit(headers) {
  if (!headers) return;
  function getHeader(name) {
    if (!headers) return undefined;
    let val = headers[name];
    if (val !== undefined) return val;
    return headers[name.toLowerCase()];
  }
  lastRaynetRateLimit = {
    remaining: getHeader('x-ratelimit-remaining'),
    limit: getHeader('x-ratelimit-limit'),
    reset: getHeader('x-ratelimit-reset')
  };
  console.log('Aktualizován Raynet Rate Limit:', lastRaynetRateLimit);
}

//funkce pro aktuaoizaci klienta
async function updateCompany(companyId, data) {
  try {
    const requestData = {
      // Aktualizujeme pouze pole, která potřebujeme
      // Aktualizujeme teritorium u primární adresy
      addresses: [
        {
          id: data.primaryAddressId, // ID primární adresy
          territory: data.territory,
          // Můžete aktualizovat další pole adresy, pokud je to potřeba
        },
      ],
      // Přidejte další pole dle potřeby
    };
    console.log('Request data for updateCompany:', JSON.stringify(requestData, null, 2));
    const response = await raynetApi.post(`/company/${companyId}/`, requestData);
    console.log('Klient aktualizován:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error(`Chyba při aktualizaci klienta s ID ${companyId}:`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    throw error;
  }
}


// Funkce pro získání detailu společnosti
async function getCompanyDetail(companyId) {
  try {
    const response = await raynetApi.get(`company/${companyId}/`);
    return response.data.data;
  } catch (error) {
    console.error(`Chyba při získávání detailu společnosti s ID ${companyId}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}


//funkce pro úpravu adresy klienta

async function updateCompanyAddressRaynet(companyId, addressId, addressData) {
  try {
    console.log(`Odesílám data pro aktualizaci adresy s ID ${addressId} u společnosti s ID ${companyId}:`, JSON.stringify(addressData, null, 2));
    const response = await raynetApi.post(`company/${companyId}/address/${addressId}/`, addressData);
    console.log('Adresa byla úspěšně aktualizována:', response.data.data);
    return response.data.data;
  } catch (error) {
    console.error(`Chyba při aktualizaci adresy s ID ${addressId} u společnosti s ID ${companyId}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

// funkce pro výmaz všech položek z obchodního případu
async function deleteAllItemsFromBusinessCase(businessCaseId) {
  try {
    // Načteme obchodní případ včetně položek
    console.log(`Načítám položky obchodního případu ${businessCaseId} pro smazání.`);
    const response = await raynetApi.get(`/businessCase/${businessCaseId}/`);
    const businessCaseDataResponse = response.data.data;

    if (businessCaseDataResponse && businessCaseDataResponse.items) {
      const items = businessCaseDataResponse.items;
      console.log(`Nalezeno ${items.length} položek:`, items);

      if (items.length > 0) {
        for (const item of items) {
          console.log(`Připravuji se mazat položku s ID ${item.id} z obchodního případu ${businessCaseId}`);
          try {
            await raynetApi.delete(`/businessCase/${businessCaseId}/item/${item.id}/`);
            console.log(`Položka s ID ${item.id} byla smazána z obchodního případu ${businessCaseId}.`);
          } catch (deleteError) {
            console.error(`Chyba při mazání položky s ID ${item.id}:`, deleteError.response ? deleteError.response.data : deleteError.message);
            // Pokračujeme i přes chybu při mazání položky
          }
        }
        console.log(`Všechny položky z obchodního případu ${businessCaseId} byly zpracovány.`);
      } else {
        console.log(`Obchodní případ ${businessCaseId} neobsahuje žádné položky k odstranění.`);
      }
    } else {
      console.log(`Odpověď z API neobsahuje položky pro obchodní případ ${businessCaseId}.`);
    }
  } catch (error) {
    console.error(`Chyba při načítání nebo mazání položek z obchodního případu ${businessCaseId}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

// Hledá objednávku podle custom field (např. PPR_e8ef9) a hodnoty (např. SalesId)
async function findSalesOrderByCustomField(fieldKey, value) {
  try {
    let offset = 0;
    const limit = 1000;
    let found = null;

    while (true) {
      const response = await raynetApi.get('/salesOrder/', {
        params: {
          limit,
          offset,
          // Pro efektivitu přidej časový filtr, pokud máš validFrom >= '2025-07-01':
          // 'validFrom[GE]': '2025-07-01',
        }
      });
      const salesOrders = response.data.data;
      if (!salesOrders || salesOrders.length === 0) break;

      for (const order of salesOrders) {
        if (order[fieldKey] && order[fieldKey] == value) {
          console.log(`Objednávka nalezena s ID: ${order.id}`);
          return order;
        }
      }

      // Posuň offset na další stránku
      if (salesOrders.length < limit) break;
      offset += limit;
    }

    console.log(`Objednávka s ${fieldKey} = ${value} nebyla nalezena.`);
    return null;
  } catch (error) {
    console.error(`Chyba při hledání objednávky přes ${fieldKey}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}


async function createSalesOrder(data) {
  try {
    const requestData = {
      name: data.name,
      company: data.company, // ID klienta
      businessCase: data.businessCase, // ID obchodního případu
      PPR_e8ef9: data.PPR_e8ef9, // Custom pole – SalesId
      totalAmount: data.totalAmount,
      description: data.description,
      validFrom: data.validFrom,
      validTill: data.validTill,
      requestDeliveryDate: data.requestDeliveryDate,
      // Další pole dle potřeby: owner, person, salesOrderStatus, category, estimatedValue...
    };

    console.log('Request data for createSalesOrder:', JSON.stringify(requestData, null, 2));
    // V Raynetu je pro vytvoření objednávky metoda PUT (ověř dle své dokumentace)
    const response = await raynetApi.put('/salesOrder/', requestData);
    return response.data.data;
  } catch (error) {
    console.error('Chyba při vytváření objednávky:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function updateSalesOrder(salesOrderId, data) {
  try {
    const requestData = {
      name: data.name,
      company: data.company,
      businessCase: data.businessCase,
      PPR_e8ef9: data.PPR_e8ef9,
      totalAmount: data.totalAmount,
      description: data.description,
      validFrom: data.validFrom,
      validTill: data.validTill,
      requestDeliveryDate: data.requestDeliveryDate,
      // Další pole dle potřeby
    };

    console.log('Request data for updateSalesOrder:', JSON.stringify(requestData, null, 2));
    // Pro update použij POST na /salesOrder/{id}/
    const response = await raynetApi.post(`/salesOrder/${salesOrderId}/`, requestData);
    return response.data.data;
  } catch (error) {
    console.error(`Chyba při aktualizaci objednávky s ID ${salesOrderId}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

async function addItemToSalesOrder(salesOrderId, itemData) {
  try {
    if (!salesOrderId) throw new Error('Neplatné salesOrderId');
    const itemPayload = {
      productCode: itemData.productCode,
      name: itemData.name || 'Bez názvu',
      count: typeof itemData.count === 'number' ? itemData.count : 1,
      price: typeof itemData.price === 'number' ? itemData.price : 0,
      taxRate: typeof itemData.taxRate === 'number' ? itemData.taxRate : 21,
      discountPercent: typeof itemData.discountPercent === 'number' ? itemData.discountPercent : 0,
      description: itemData.description || 'Bez popisu'
      // Další pole dle potřeby
    };
    console.log('Přidávám položku do objednávky:', JSON.stringify(itemPayload, null, 2));
    const response = await raynetApi.put(`/salesOrder/${salesOrderId}/item/`, itemPayload);
    return response.data;
  } catch (error) {
    console.error(`Chyba při přidávání položky do objednávky ${salesOrderId}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

async function deleteAllItemsFromSalesOrder(salesOrderId) {
  try {
    console.log(`Načítám položky objednávky ${salesOrderId} pro smazání.`);
    const response = await raynetApi.get(`/salesOrder/${salesOrderId}/`);
    const salesOrderDataResponse = response.data.data;
    if (salesOrderDataResponse && salesOrderDataResponse.items) {
      const items = salesOrderDataResponse.items;
      console.log(`Nalezeno ${items.length} položek:`, items);
      if (items.length > 0) {
        for (const item of items) {
          try {
            await raynetApi.delete(`/salesOrder/${salesOrderId}/item/${item.id}/`);
            console.log(`Položka s ID ${item.id} byla smazána z objednávky ${salesOrderId}.`);
          } catch (deleteError) {
            console.error(`Chyba při mazání položky s ID ${item.id}:`, deleteError.response ? deleteError.response.data : deleteError.message);
          }
        }
        console.log(`Všechny položky z objednávky ${salesOrderId} byly zpracovány.`);
      } else {
        console.log(`Objednávka ${salesOrderId} neobsahuje žádné položky k odstranění.`);
      }
    } else {
      console.log(`Odpověď z API neobsahuje položky pro objednávku ${salesOrderId}.`);
    }
  } catch (error) {
    console.error(`Chyba při načítání nebo mazání položek z objednávky ${salesOrderId}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}


// pomocná funkce pro založení adresy
async function createCompanyByRegNumber(regNumber) {
  let mysqlConnection;
  try {
    console.log('Received regNumber:', regNumber);

    if (!regNumber) {
      throw new Error('Parametr regNumber je povinný.');
    }

    // Připojení k MSSQL
    await sql.connect(mssqlConfig);
    const mssqlRequest = new sql.Request();

    // Parametrizovaný SQL dotaz pro MSSQL
    const mssqlQuery = `
      SELECT TOP 1
        [CustName] AS billingName,
        [CustStreet] AS billingStreet,
        [CustCity] AS billingCity,
        [CustZipCode] AS billingZipCode,
        [CustCountryRegionId] AS billingCountry,
        [RegNum] AS regNumber
      FROM [AxProdCS].[dbo].[ItsIFSalesTable]
      WHERE [SalesStatusText] IS NOT NULL
        AND [SalesStatusText] != ''
       
        AND [RegNum] = @regNumber
    `;

    mssqlRequest.input('regNumber', sql.VarChar, regNumber);
    const mssqlResult = await mssqlRequest.query(mssqlQuery);
    console.log('MSSQL Query Result:', mssqlResult.recordset);

    if (mssqlResult.recordset.length === 0) {
      throw new Error('Žádná data nalezena pro zadané regNumber.');
    }

    // Připojení k MySQL
    mysqlConnection = await poolC5tpms.getConnection();
    // Promisify the connection's query method
    mysqlConnection.query = util.promisify(mysqlConnection.query);

    const mysqlQuery = `
      SELECT ICO, Jmeno_OZ_Kstzs
      FROM AX_PPR
      WHERE ICO = ?
      LIMIT 1
    `;

    const record = mssqlResult.recordset[0];

    // Logování hodnoty record.regNumber
    console.log(`Hodnota record.regNumber: "${record.regNumber}" s délkou ${record.regNumber.length}`);
    console.log(`Typ record.regNumber: ${typeof record.regNumber}`);

    // Ujisti se, že je to řetězec a odstraníš bílé znaky
    const regNumberForQuery = record.regNumber.trim();

    // Logování před dotazem
    console.log('Spouštím MySQL dotaz:', mysqlQuery);
    console.log('S parametrem:', regNumberForQuery);

    let jmenoOZKstzs = null;
    let territoryName = null;

    try {
      const mysqlRows = await mysqlConnection.query(mysqlQuery, [regNumberForQuery]);

      console.log('Výsledky MySQL dotazu:', mysqlRows);

      if (mysqlRows.length > 0) {
        const mysqlRecord = mysqlRows[0];
        jmenoOZKstzs = mysqlRecord.Jmeno_OZ_Kstzs;
        territoryName = extractStrediskoName(mysqlRecord.Jmeno_OZ_Kstzs);
      } else {
        console.warn(`Žádný záznam v AX_PPR pro ICO: ${regNumberForQuery}`);
      }
    } catch (mysqlError) {
      console.error(`Chyba při dotazu do MySQL pro ICO ${regNumberForQuery}:`, mysqlError.message);
      // Pokračujeme bez těchto dat
    }

    // Získání teritoria pomocí territoryName, pokud existuje
    let territoryId = null;
    if (territoryName) {
      territoryId = await getTerritoryIdByName(territoryName);
    }

    const addressData = {
      name: record.billingName,
      regNumber: record.regNumber,
      state: 'B_ACTUAL',
      rating: 'A',
      role: 'A_SUBSCRIBER',
      addresses: [
        {
          address: {
            name: 'Sídlo klienta',
            street: record.billingStreet,
            city: record.billingCity,
            zipCode: record.billingZipCode,
            country: record.billingCountry
          },
          territory: territoryId
        }
      ],
    };

    console.log('Vytvářím novou společnost s daty:', JSON.stringify(addressData, null, 2));

    const createdCompany = await createCompanyRaynet(addressData);

    console.log('Společnost byla úspěšně vytvořena:', createdCompany);

    return createdCompany;
  } catch (error) {
    console.error('Chyba při vytváření společnosti:', error.message);
    throw error;
  } finally {
    if (mysqlConnection) {
      mysqlConnection.release();
    }
    sql.close(); // Zavření MSSQL připojení
  }
}

async function ensureProductExistsOrCreateOrUpdate(product) {
  const { productCode } = product;

  try {
    // Vyhledání produktu podle kódu
    console.log(`Volám GET /product/ s parametry: { code: "${productCode}", limit: 1 }`);
    const response = await raynetApi.get('/product/', {
      params: {
        code: productCode,
        limit: 1,
      },
    });

    const products = response.data.data;

    console.log(`GET /product/ vráceno ${products.length} produktů pro kód "${productCode}".`);

    if (products.length === 0) {
      // Produkt neexistuje, vytvoříme nový pomocí PUT
      // Přemapování 'productCode' na 'code' a odstranění nepotřebných polí
      const { productCode, count, discountPercent, ...productData } = product;
      const formattedProductData = {
        ...productData,
        code: productCode, // Převedení 'productCode' na 'code'
      };

      console.log(`Produkt s kódem "${productCode}" neexistuje. Volám PUT /product/ s daty:`, formattedProductData);
      const newProductResponse = await raynetApi.put('/product/', formattedProductData);
      console.log(`Produkt s kódem "${productCode}" byl úspěšně vytvořen:`, newProductResponse.data);
      return newProductResponse.data;
    } else if (products.length === 1) {
      // Produkt existuje, aktualizujeme ho pomocí POST
      // Přemapování 'productCode' na 'code' a odstranění nepotřebných polí
      const { productCode, count, discountPercent, ...updateData } = product;
      const formattedUpdateData = {
        ...updateData,
        code: productCode, // Převedení 'productCode' na 'code'
      };

      const existingProduct = products[0];
      const productId = existingProduct.id;
      console.log(`Produkt s kódem "${productCode}" nalezen: ID=${productId}. Volám POST /product/${productId} s daty:`, formattedUpdateData);
      const updatedProductResponse = await raynetApi.post(`/product/${productId}`, formattedUpdateData);
      console.log(`Produkt s ID ${productId} byl úspěšně aktualizován:`, updatedProductResponse.data);
      return updatedProductResponse.data;
    } else {
      // Více produktů se stejným kódem, což by nemělo nastat
      throw new Error(`Více produktů se stejným kódem: ${productCode}`);
    }
  } catch (error) {
    console.error(`Chyba při zajišťování produktu "${productCode}":`, error.response ? error.response.data : error.message);
    throw error;
  }
}

// Funkce pro získání všech obchodních případů s využitím stránkování
async function getAllBusinessCasesPaginated() {
  let offset = 0;
  const limit = 1000;
  let allBusinessCases = [];
  let moreData = true;

  while (moreData) {
    const response = await raynetApi.get('businessCase/', {
      params: { offset, limit }
    });
    const data = response.data.data;
    allBusinessCases = allBusinessCases.concat(data);

    if (data.length < limit) {
      moreData = false;
    } else {
      offset += limit;
    }
  }

  return allBusinessCases;
}

function extractOwnerAndTerritory(salesGroupName) {
  if (!salesGroupName) {
    return {
      ownerId: ownerMap["SCHNEER RENÉ"],       // fallback
      territoryId: strediskoMap["NEPŘIŘAZENO"] // fallback
    };
  }

  const parts = salesGroupName.split('_');
  let rawOwner = "";
  let rawStredisko = "";

  if (parts.length > 1) {
    rawOwner = parts[0].trim().toUpperCase();  // "MARTINEC RADEK"
    // Část za podtržítkem může mít např. "ZLÍN 20120"
    rawStredisko = parts[1].split(' ')[0].trim().toUpperCase(); // "ZLÍN"
  } else {
    // Bez podtržítka – bereme celé jako jméno
    rawOwner = salesGroupName.trim().toUpperCase();
  }

  const foundOwnerId = ownerMap[rawOwner] || ownerMap["SCHNEER RENÉ"];
  const foundTerId = strediskoMap[rawStredisko] || strediskoMap["NEPŘIŘAZENO"];

  return {
    ownerId: foundOwnerId,
    territoryId: foundTerId
  };
}



// Funkce pro vymazání obchodního případu podle ID
async function deleteBusinessCase(id) {
  await raynetApi.delete(`businessCase/${id}/`);
  console.log(`Obchodní případ s ID ${id} byl smazán.`);
}
/**
 * Zpracuje řetězec typu "Neugebauer Erik_OSTRAVA 20160" a vrátí:
 *   - territoryName = "OSTRAVA"
 *   - ownerFullNameRaw = "Neugebauer Erik"   // (příjmení + jméno)
 *   - category = 20160
 */


function extractTerritoryAndOwnerRaw(input) {
  if (!input) return { territoryName: null, ownerFullNameRaw: null, category: null };

  // Extrahuje číselnou hodnotu na konci řetězce
  const categoryMatch = input.match(/(\d+)$/);
  const category = categoryMatch ? parseInt(categoryMatch[1], 10) : null;

  // Odstraní trailing číslo a případnou mezeru před ním
  const trimmed = input.replace(/\s*\d+$/, '');
  // Teď je trimmed např. "Neugebauer Erik_OSTRAVA"

  // Rozdělí podle "_"
  const parts = trimmed.split('_');
  // parts[0] = "Neugebauer Erik", parts[1] = "OSTRAVA"

  if (!parts[1]) {
    // Pokud se nenašla "_", nemáme teritorium
    return {
      territoryName: null,
      ownerFullNameRaw: parts[0].trim(), // Celé se považuje za jméno
      category: category,
    };
  } else {
    return {
      territoryName: parts[1].trim(),
      ownerFullNameRaw: parts[0].trim(),
      category: category,
    };
  }
}




// Aktualizujte funkci findOwnerIdInRaynet, aby používala userMap
async function findOwnerIdInRaynet(ownerFullNameRaw) {
  if (!ownerFullNameRaw) {
    // Pokud nic nemáme, vrátíme default ID 13
    return 18;
  }

  // Rozložíme "Neugebauer Erik" => lastName="Neugebauer", firstName="Erik"
  const [lastName, firstName] = ownerFullNameRaw.split(' ');

  if (!lastName || !firstName) {
    // Nesprávný formát, vrátíme default ID
    return 18;
  }

  // fullName pro vyhledávání v Raynetu = "Erik Neugebauer"
  const fullNameForRaynet = `${firstName} ${lastName}`;

  try {
    // Zavoláme Raynet API pro získání všech userAccount
    console.log(`Volám GET /userAccount/ s parametry: { limit: 1000 }`);
    const response = await raynetApi.get('/userAccount/', {
      params: {
        limit: 1000, // Nastavte limit podle potřeby
      },
    });
    const users = response.data.data;

    console.log(`Získáno ${users.length} uživatelů z Raynetu.`);

    // Najdeme uživatele s person.fullName == "Erik Neugebauer"
    const found = users.find(u => u.person?.fullName === fullNameForRaynet);

    if (found && found.person && found.person.id) {
      console.log(`Osoba nalezena: Person ID=${found.person.id}, FullName=${found.person.fullName}`);
      return found.person.id; // person.id
    } else {
      console.warn(`Osoba "${fullNameForRaynet}" nebyla nalezena. Používám defaultní ID 13.`);
      // Nic jsme nenašli, vrátíme default
      return 18;
    }
  } catch (error) {
    console.error('Chyba při vyhledávání osoby v Raynetu:', error.message);
    return 18; // Fallback na defaultní ID
  }
}

function getSecurityLevelId(strediskoName, securityLevels) {
  if (!strediskoName || !securityLevels || securityLevels.length === 0) return null;

  const normalizedStredisko = strediskoName.toLowerCase();

  // Najdeme securityLevel, jehož název obsahuje název střediska
  const matchedLevel = securityLevels.find(level => 
    level.name.toLowerCase().includes(normalizedStredisko)
  );

  if (matchedLevel) {
    return matchedLevel.id;
  } else {
    console.warn(`Nenalezena securityLevel pro středisko: ${strediskoName}`);
    return null;
  }
}

async function findBusinessCaseByName(salesId) {
  const response = await raynetApi.get('/businessCase/', {
    params: {
      'name[EQ]': salesId,
      limit: 2
    }
  });
  const cases = response.data.data;
  return cases.length ? cases[0] : null;
}


async function findSalesOrderByName(salesId) {
  try {
    const response = await raynetApi.get('/salesOrder/', {
      params: {
        'name[EQ]': salesId,
        limit: 2
      }
    });
    const salesOrders = response.data.data;
    if (salesOrders.length > 0) {
      console.log(`Objednávka s name=${salesId} nalezena, ID: ${salesOrders[0].id}`);
      return salesOrders[0];
    } else {
      console.log(`Objednávka s name=${salesId} nenalezena.`);
      return null;
    }
  } catch (error) {
    console.error(`Chyba při hledání objednávky přes name:`, error.response ? error.response.data : error.message);
    throw error;
  }
}


async function findBusinessCaseByCustomField(fieldKey, value) {
  try {
    // Můžeš případně použít filtr "validFrom" nebo jiné pole pro omezení výsledků!
    const response = await raynetApi.get('/businessCase/', {
      params: {
        limit: 1000,
        // například jen případy od určitého data:
        // 'validFrom[GE]': '2025-07-01'
      }
    });
    const businessCases = response.data.data;
    // Nyní prohledáme pole ručně
    for (const bc of businessCases) {
      if (bc[fieldKey] && bc[fieldKey] == value) {
        console.log(`Obchodní případ nalezen s ID: ${bc.id}`);
        return bc;
      }
    }
    console.log(`Obchodní případ s ${fieldKey} = ${value} nebyl nalezen.`);
    return null;
  } catch (error) {
    console.error(`Chyba při hledání obchodního případu přes ${fieldKey}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

async function findBusinessCaseByCode(code) {
  try {
    console.log(`Hledám obchodní případ s kódem: ${code}`);
    const response = await raynetApi.get('/businessCase/', {
      params: {
        limit: 1000,
        'code[EQ]': code, // Používáme operátor EQ pro přesnou shodu
      },
    });
    const businessCases = response.data.data;
    if (businessCases.length > 0) {
      console.log(`Obchodní případ nalezen s ID: ${businessCases[0].id}`);
      return businessCases[0];
    } else {
      console.log(`Obchodní případ s kódem ${code} nebyl nalezen.`);
      return null;
    }
  } catch (error) {
    console.error(`Chyba při hledání obchodního případu s kódem ${code}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

async function createCompanyRaynet(companyData) {
  try {
    const response = await raynetApi.put('/company/', companyData);
    return response;
  } catch (error) {
    console.error('Chyba při vytváření společnosti v Raynet CRM:', error);
    throw error;
  }
}

function parseCzechDate(dateString) {
  if (!dateString) return null;
  const parts = dateString.split('.');
  if (parts.length < 3) return null;

  const day = parts[0].padStart(2, '0');   // "14"
  const month = parts[1].padStart(2, '0'); // "08"
  const year = parts[2].trim();           // "2019"

  return `${year}-${month}-${day}`;       // "2019-08-14"
}


function dbQuery(pool, sql, params = []) {
  return new Promise((resolve, reject) => {
    // podpora i pro objektový tvar { sql, values }
    if (sql && typeof sql === 'object' && typeof sql.sql === 'string') {
      params = Array.isArray(sql.values) ? sql.values : params;
      sql = sql.sql;
    }

    if (typeof sql !== 'string' || sql.trim().length === 0) {
      const err = new Error('Empty SQL passed to dbQuery');
      err.code = 'ER_EMPTY_QUERY_LOCAL';
      console.error('[DB] Empty SQL in dbQuery. Incoming params =', params);
      return reject(err);
    }

    // pro jistotu log, ať vidíš, co se posílá (můžeš si to po odladění vypnout)
    // console.debug('[DB] SQL:', sql, 'PARAMS:', params);

    pool.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

async function getCompanyDetails(companyId) {
  try {
    // GET /company/{companyId}
    const response = await raynetApi.get(`/company/${companyId}/`);
    return response.data?.data || null;
  } catch (error) {
    console.error(`Chyba při načítání dat firmy (ID: ${companyId}):`, error.response ? JSON.stringify(error.response.data) : error.message);
    return null;
  }
}

async function updateCompanyInRaynet(companyId, updateData) {
  try {
    // POST https://app.raynet.cz/api/v2/company/{companyId}/
    const response = await raynetApi.post(`/company/${companyId}/`, updateData);
    return response.data;
  } catch (error) {
    console.error(
      `Chyba při aktualizaci firmy (ID: ${companyId}):`,
      error.response ? JSON.stringify(error.response.data) : error.message
    );
    throw error;
  }
}

// Funkce pro mapování hodnoty Náprava

const mapNaprava = async (connection, napravaOriginal) => {
  if (!napravaOriginal) return null;

  // Načtení všech pozic s jejich synonymy
  const [rows] = await connection.query('SELECT value, synonyms FROM pozice');

  // Vytvoření mapy synonym na standardní hodnoty
  const synonymsMap = {};

  rows.forEach(row => {
    const standardValue = row.value;
    if (row.synonyms) {
      const synonyms = row.synonyms.split(',').map(syn => syn.trim().toLowerCase());
      synonyms.forEach(syn => {
        synonymsMap[syn] = standardValue;
      });
    }
    // Přidání standardní hodnoty do mapy
    synonymsMap[standardValue.toLowerCase()] = standardValue;
  });

  // Normalizace importované hodnoty
  const normalizedNaprava = napravaOriginal.trim().toLowerCase();

  // Návrat standardní hodnoty nebo původní hodnoty, pokud není nalezena
  return synonymsMap[normalizedNaprava] || napravaOriginal;
};


// Definice zákaznických skupin
const customerGroups = [
  '1_eshop',
  '2_pult',
  '3_servis',
  '4_vo',
  '5_vip',
  '6_indiv',
  '7_dopravci',
  'B2B'
];

// Funkce pro načtení cenových dat pro konkrétní skupinu a akci
const loadPricingData = async (tableName, groupName, actionName, pool) => {
  console.log(`Loading pricing data from table: ${tableName} for group: ${groupName}, action: ${actionName}`);

  if (!groupName) {
    console.warn(`Group name is undefined or empty for table: ${tableName}`);
    return new Map();
  }

  const query = `
    SELECT
      polozka AS C_Polozky,
      \`${groupName}\` AS Cena,
      platnost_od AS PlatnostOd,
      platnost_do AS PlatnostDo
    FROM ${tableName}
    WHERE \`${groupName}\` IS NOT NULL AND \`${groupName}\` != ''
  `;
  console.log(`Constructed SQL query for table ${tableName}, group ${groupName}: ${query}`);

  let results;
  try {
    results = await new Promise((resolve, reject) => {
      poolC5sluzbyint.query(query, (err, rows) => {
        if (err) {
          console.error(`Error executing query on table ${tableName}, group ${groupName}:`, err);
          return reject(err);
        }
        console.log(`Successfully retrieved ${rows.length} rows from table ${tableName} for group ${groupName}`);
        resolve(rows);
      });
    });
  } catch (err) {
    console.error(`Failed to load pricing data from table ${tableName}, group ${groupName}:`, err);
    return new Map();
  }

  const today = new Date();
  const priceMap = new Map();

  results.forEach(row => {
    const { C_Polozky, Cena, PlatnostOd, PlatnostDo } = row;
    const validFrom = PlatnostOd ? new Date(PlatnostOd) : null;
    const validTo = PlatnostDo ? new Date(PlatnostDo) : null;

    if ((!validFrom || validFrom <= today) && (!validTo || validTo >= today)) {
      const cenaFloat = parseFloat(Cena);
      if (isNaN(cenaFloat)) {
        console.warn(`Invalid Cena for C_Polozky=${C_Polozky} in table ${tableName}, group ${groupName}: Cena=${Cena}`);
        return;
      }
      priceMap.set(C_Polozky, {
        Cena: cenaFloat,
        PlatnostOd: validFrom ? validFrom.toISOString().split('T')[0] : null,
        PlatnostDo: validTo ? validTo.toISOString().split('T')[0] : null,
        MarketingovaAkce: actionName,
      });
      console.log(`Added to priceMap: C_Polozky=${C_Polozky}, Cena=${Cena}, Action=${actionName}`);
    } else {
      console.log(`Skipping C_Polozky=${C_Polozky} due to invalid date range.`);
    }
  });

  console.log(`Final priceMap size for table ${tableName}, group ${groupName}: ${priceMap.size}`);
  return priceMap;
};

// Funkce pro kombinaci map s prioritou: Vyprodej > Akce > Netto
const combinePriorityMaps = (vyprodejMap, akceMap, nettoMap) => {
  const combinedMap = new Map();

  // Přidání vyprodej mapy do kombinované mapy
  vyprodejMap.forEach((value, key) => {
    combinedMap.set(key, value);
  });

  // Přidání akce mapy pouze pokud klíč ještě není v kombinované mapě
  akceMap.forEach((value, key) => {
    if (!combinedMap.has(key)) {
      combinedMap.set(key, value);
    }
  });

  // Přidání netto mapy pouze pokud klíč ještě není v kombinované mapě
  nettoMap.forEach((value, key) => {
    if (!combinedMap.has(key)) {
      combinedMap.set(key, value);
    }
  });

  return combinedMap;
};

// Funkce pro načtení základních slev pro všechny skupiny podle sheetName
const loadBaseDiscounts = async (pool, sheetName) => {
  console.log('Loading base discounts from table IMPORT_CZS_Kalkulace_cen_zakladni_slevy for sheetName:', sheetName);

  const query = `
    SELECT
      1_eshop,
      2_pult,
      3_servis,
      4_vo,
      5_vip,
      6_indiv,
      7_dopravci,
      B2B
    FROM IMPORT_CZS_Kalkulace_cen_zakladni_slevy
    WHERE cenove_skupiny = ?
    LIMIT 1
  `;
  console.log(`Constructed SQL query for base discounts: ${query}`);

  let results;
  try {
    results = await new Promise((resolve, reject) => {
      poolC5sluzbyint.query(query, [sheetName], (err, rows) => {
        if (err) {
          console.error('Error executing base discount query:', err);
          return reject(err);
        }
        console.log(`Successfully retrieved ${rows.length} rows for base discounts.`);
        resolve(rows);
      });
    });
  } catch (err) {
    console.error('Failed to load base discounts:', err);
    return {}; // Vrátí prázdný objekt v případě chyby
  }

  if (!results || results.length === 0) {
    console.warn('No rows found in base discount table for sheetName:', sheetName);
    return {};
  }

  const row = results[0];
  const baseDiscounts = {};

  customerGroups.forEach(group => {
    const discount = parseFloat(row[group]);
    baseDiscounts[group] = isNaN(discount) ? 0 : discount;
    console.log(`Base discount for group ${group}: ${baseDiscounts[group]}%`);
  });

  return baseDiscounts;
};


// Funkce pro odstranění diakritiky
const removeDiacritics = (str) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// Funkce pro vytvoření validního slugu pro link_rewrite
const slugify = (str) => {
  if (!str) return "";
  return removeDiacritics(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
};

// Rekurzivní funkce pro odstranění klíčů obsahujících znak '$'
function stripDollarKeys(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(stripDollarKeys);
  const newObj = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.includes('$')) continue;
    newObj[key] = stripDollarKeys(value);
  }
  return newObj;
}

// Funkce pro odstranění prázdných hodnot (null, undefined, nebo prázdný řetězec)
function removeEmpty(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) {
    return obj.map(removeEmpty).filter(v => v !== null && v !== undefined && v !== "");
  }
  const newObj = {};
  Object.keys(obj).forEach(key => {
    const value = removeEmpty(obj[key]);
    if (value !== null && value !== undefined && value !== "") {
      newObj[key] = value;
    }
  });
  return newObj;
}

// Mapy pro atributové hodnoty podle screenshotů
const PRUMER_MAP = {
  "15": "1",
  "18": "2",
  "22": "3",
  "28": "4",
  "35": "5",
  "42": "8",
  "54": "9",
  "76,1": "10",
  "88,9": "11",
  "108": "12"
};

const SACEK_MAP = {
  "1": "13",
  "5": "14",
  "10": "15",
  "20": "16"
};

const KRABICE_MAP = {
  "1": "17",
  "2": "18",
  "3": "19",
  "4": "20",
  "5": "21",
  "6": "22",
  "8": "23",
  "10": "24",
  "12": "25",
  "15": "26",
  "18": "27",
  "20": "28",
  "25": "29",
  "30": "30",
  "35": "31",
  "40": "32",
  "50": "33",
  "60": "34",
  "70": "35",
  "80": "36",
  "90": "37",
  "100": "38",
  "120": "39",
  "130": "40",
  "150": "41",
  "160": "42",
  "180": "43",
  "200": "44",
  "250": "45",
  "300": "46",
  "350": "47",
  "500": "48",
  "1000": "49",
  "1500": "50",
  "3000": "51"
};

// Pomocná funkce, která vrátí promise pro SQL dotaz
function queryPromise(sql) {
  return new Promise((resolve, reject) => {
    poolC5pneutyres.query(sql, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
}


// Helper funkce pro formátování data
function formatDate(date) {
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  const hours = ('0' + date.getHours()).slice(-2);
  const minutes = ('0' + date.getMinutes()).slice(-2);
  const seconds = ('0' + date.getSeconds()).slice(-2);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Funkce, která aktualizuje stav skladu pro daný produkt v PrestaShopu
async function updatePrestaShopStock(productRef, newStock) {
  // 1. Získání informací o produktu z PrestaShopu s parametrem display
  const productsResponse = await axios.get(
    `${pneutyresApi_URL}/products?filter[reference]=${productRef}&display=[id,reference]`,
    { auth: { username: pneutyresApiKey, password: '' } }
  );
  const parser = new xml2js.Parser();
  const productsJson = await parser.parseStringPromise(productsResponse.data);
  let products = (productsJson.prestashop.products && productsJson.prestashop.products[0].product) || [];
  if (!Array.isArray(products)) {
    products = [products].filter(Boolean);
  }
  if (products.length === 0) {
    throw new Error(`Produkt s referencí ${productRef} nebyl nalezen v PrestaShopu`);
  }
  const product = products[0];
  // Tímto by měl být id dostupný, protože jsme explicitně požádali o zobrazení
  const productId = product.id[0];

  // 2. Získání záznamu stock_available pro tento produkt
  const stockResponse = await axios.get(
    `${pneutyresApi_URL}/stock_availables?filter[id_product]=${productId}`,
    { auth: { username: pneutyresApiKey, password: '' } }
  );
  const stockJson = await parser.parseStringPromise(stockResponse.data);
  let stockArr = stockJson?.prestashop?.stock_availables?.[0]?.stock_available || [];
  if (!Array.isArray(stockArr)) stockArr = [stockArr].filter(Boolean);
  if (!stockArr.length) {
    throw new Error(`Stock_available záznam nenalezen pro produkt ${productId}`);
  }
  const stockRecordId = stockArr[0].$.id;

  // 3. Sestavení XML payloadu pro aktualizaci skladu
  const updateObj = {
    prestashop: {
      stock_available: {
        id: [stockRecordId],
        id_product: [productId],
        id_product_attribute: ['0'],
        depends_on_stock: ['0'],
        out_of_stock: ['2'],
        quantity: [newStock.toString()],
        id_shop: ['1']
      }
    }
  };
  const builder = new xml2js.Builder({ xmldec: { version: '1.0', encoding: 'UTF-8' } });
  const updateXml = builder.buildObject(updateObj);

  // 4. Odeslání PUT požadavku pro aktualizaci skladu v PrestaShopu
  await axios.put(
    `${pneutyresApi_URL}/stock_availables`,
    updateXml,
    {
      auth: { username: pneutyresApiKey, password: '' },
      headers: { 'Content-Type': 'application/xml' }
    }
  );

  return { productId, productRef, newStock };
}


// univerzální funkce pro zjištění či vytvoření hodnoty vlastnosti
async function getOrCreateFeatureValue(featureId, featureValueName) {
  if (!featureValue) return null;
  const filterUrl = `${prestaApiUrl}/product_feature_values?filter[id_feature]=[${featureId}]&filter[value]=[${encodeURIComponent(value)}]&display=full`;

  try {
    const checkResp = await axios.get(filterUrl, {
      auth: { username: prestaApiKey, password: '' },
      headers: { 'Content-Type': 'text/xml' }
    });
    const parsed = await parser.parseStringPromise(checkResp.data);

    if (parsed && parsed.prestashop && parsed.prestashop.product_feature_values && parsed.prestashop.product_feature_values.product_feature_value) {
      let foundValue = parsed.prestashop.product_feature_values.product_feature_value;
      if (Array.isArray(found)) found = found[0];
      return found.id;
    }

    // Neexistuje, vytvořím
    const payload = {
      product_feature_value: {
        id_feature: featureId,
        value: {
          language: { "@": { id: "1" }, "#": value }
        }
      }
    };
    const cleanPayload = removeEmpty(payload);
    const xmlPayload = js2xmlparser.parse("prestashop", cleanPayload, { declaration: { include: true } });
    await axios.post(`${prestaApiUrl}/product_feature_values`, xmlBody, {
      auth: { username: prestaApiKey, password: '' },
      headers: { 'Content-Type': 'text/xml' }
    });

    // Získat id nově vytvořené hodnoty
    const respAfterCreate = await axios.get(filterUrl, {
      auth: { username: prestaApiKey, password: '' },
      headers: { 'Content-Type': 'text/xml' }
    });
    const parsedAfterCreate = await parser.parseStringPromise(respAfterCreate.data);
    let created = parsedAfterCreate.prestashop.product_feature_values.product_feature_value;
    if (Array.isArray(created)) created = created[0];
    return created.id;

  } catch (error) {
    console.error("Chyba při getOrCreateFeatureValue:", error.message);
    return null;
  }
}

// Pomocná funkce pro formátování data na "YYYY-MM-DD HH:MM:SS"
function formatDate(date) {
  const pad = n => n < 10 ? '0' + n : n;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}



// Definice cest a relevantních skladových lokací
const xmlFileStockPath = '\\\\10.60.5.41\\import\\pneu-sklad.xml'; // UNC cesta k XML souboru
const validLocations = ['02010305', '00000300', '04000310', '03000310', '02010300', '04000400', '03000300', '00000600'];


// Unifikovaná funkce pro čtení parametru z body nebo query

function getParam(req, key, defVal) {
  return (req.body && req.body[key] != null)
    ? req.body[key]
    : (req.query && req.query[key] != null ? req.query[key] : defVal);
}
//komprese digital link
function compressGS1DigitalLink(uri) {
  // === PLACEHOLDER IMPLEMENTATION ===
  // Zatím jen Base64URL z původního řetězce, aby flow fungovalo.
  const buf = Buffer.from(uri, 'utf8');
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper pro sledování rate-limitů (volitelně)

function updateRateLimit(headers) {
  if (headers['x-ratelimit-limit']) {
    lastRaynetRateLimit = {
      limit: headers['x-ratelimit-limit'],
      remaining: headers['x-ratelimit-remaining'],
      reset: headers['x-ratelimit-reset'],
    };
  }
}

// Najdi obchodní případ podle name (SalesId) a companyId
async function findBusinessCaseByNameAndCompany(salesId, companyId) {
  try {
    const resp = await raynetApi.get('/businessCase/', {
      params: { 'name[EQ]': salesId, 'company[EQ]': companyId, limit: 2 }
    });
    const list = resp.data?.data || [];
    if (list.length > 1) {
      console.warn(`[BC] Duplicitní name+company pro ${salesId} / ${companyId} – beru první ID=${list[0].id}`);
    }
    return list[0] || null;
  } catch (err) {
    console.error('Chyba při findBusinessCaseByNameAndCompany:', err.response?.data || err.message);
    throw err;
  }
}

// Najdi objednávku podle name (SalesId) a companyId
async function findSalesOrderByNameAndCompany(salesId, companyId) {
  try {
    const resp = await raynetApi.get('/salesOrder/', {
      params: { 'name[EQ]': salesId, 'company[EQ]': companyId, limit: 2 }
    });
    const list = resp.data?.data || [];
    if (list.length > 1) {
      console.warn(`[SO] Duplicitní name+company pro ${salesId} / ${companyId} – beru první ID=${list[0].id}`);
    }
    return list[0] || null;
  } catch (err) {
    console.error('Chyba při findSalesOrderByNameAndCompany:', err.response?.data || err.message);
    throw err;
  }
}

// bezpečné volání "uvolnění váhy" – ověřuje res.ok a zkouší /clear jako první
async function releaseScale(opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const body = JSON.stringify({
    minPlacedKg: 0.2,
    stableMs: 700,
    timeoutMs: 15000,
    ...opts,
  });

// Vytvoř PDF štítek 50x100 mm do Bufferu
async function buildLabelPDF({
  carton_code,           // např. z procedury
  carton_index,          // pořadí krabice
  measurement_id,        // id měření
  weight,                // naměřeno (kg)
  position,              // 0..N (0 = RK)
  pallet_slot_id,        // slot id
  item_code,             // line.item_number
  batch_text,            // můžeš dosadit šarži, nebo ponech prázdné
}) {
  // rozměry v bodech (1 mm = 2.83465 pt)
  const mm = (x)=> x * 2.83465;
  const W = mm(50);     // 50 mm (šířka)
  const H = mm(100);    // 100 mm (výška)

  const doc = new PDFDocument({ size: [W, H], margin: 0 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const finished = new Promise((res)=> doc.on('end', ()=>res(Buffer.concat(chunks))));

  // 1/3 výška pro QR
  const h1 = H/3;
  const h2 = (H/3)*2;

  // QR payload – jednoduché JSON
  const qrPayload = {
    carton_code, id: measurement_id, weight, position, pallet_slot_id
  };
  const qrPng = await QRCode.toBuffer(JSON.stringify(qrPayload), { margin: 0, scale: 6 });

  // QR centrovaně do horní třetiny
  const qrSize = Math.min(h1 * 0.9, W * 0.9);
  const qrX = (W - qrSize)/2;
  const qrY = (h1 - qrSize)/2;
  doc.image(qrPng, qrX, qrY, { width: qrSize, height: qrSize });

  // oddělovač
  doc.moveTo(0, h1).lineTo(W, h1).stroke();

  // Prostředek (2/3): šarže, kód, číslo krabice, váha
  doc.fontSize(9);
  let y = h1 + mm(4);
  const padX = mm(4);

  if (batch_text) {
    doc.font('Helvetica-Bold').text(`Šarže: ${batch_text}`, padX, y, { width: W - padX*2, align: 'left' });
    y += mm(6);
  }

  doc.font('Helvetica').text(`Kód: ${item_code || '-'}`, padX, y, { width: W - padX*2, align: 'left' });
  y += mm(6);

  doc.font('Helvetica').text(`Číslo krabice: ${carton_index != null ? carton_index : '-'}`, padX, y, { width: W - padX*2, align: 'left' });
  y += mm(6);

  doc.font('Helvetica-Bold').fontSize(12).text(`Váha: ${Number(weight).toFixed(3)} kg`, padX, y, { width: W - padX*2, align: 'left' });
  y += mm(10);

  doc.moveTo(0, h2).lineTo(W, h2).stroke();

  // Spodní 1/3: Position nebo RK
  const isRK = Number(position) === 0;
  const posText = isRK ? 'RK' : String(position);
  doc.font('Helvetica-Bold');
  doc.fontSize(isRK ? 48 : 48); // velké číslo/RK
  doc.text(posText, 0, h2 + (H - h2 - mm(48))/2 - mm(2), {
    width: W,
    align: 'center'
  });

  doc.end();
  return finished;
}

async function printPdfBufferToDefaultPrinter(pdfBuffer) {
  const tmp = path.join(os.tmpdir(), `label_${Date.now()}.pdf`);
  await fs.promises.writeFile(tmp, pdfBuffer);
  try {
    await print(tmp, {
      printer: process.env.LABEL_PRINTER || "Brother", // např. "Citizen CL-S521"
      orientation: 'portrait',
      scale: 'noscale',  // 1:1 dle PDF (50×100 mm)
      silent: true
    });
  } finally {
    fs.promises.unlink(tmp).catch(()=>{});
  }
}

async function tryPost(path, withBody = true) {
    try {
      const r = await fetch(AGENT_BASE + path, {
        method: 'POST',
        headers: withBody ? headers : undefined,
        body: withBody ? body : undefined,
      });
      return r.ok; // jen 2xx => true
    } catch {
      return false;
    }
  }

  // Preferuj soft-clear (čeká na prázdnou/stabilní váhu)
  if (await tryPost('/clear', true)) return true;
  if (await tryPost('/wait-clear', true)) return true;

  // /tare a /zero na S50 vrací 501 → nespouštěj úspěch
  await tryPost('/zero', false);
  await tryPost('/tare', false);

  return false;
}

// ===== helpers (lokální) =====
const norm = s => String(s ?? '').trim();

const extractQr = (raw) => {
  const s = norm(raw);
  if (!s) return '';
  if (s.startsWith('{') && s.endsWith('}')) {
    try { const o = JSON.parse(s); return norm(o.carton_code || o.code || ''); } catch {}
  }
  return s;
};

/** Zajistí/vrátí řádek v NP_Lines (per header+produkt). Případně aktualizuje pcs_per_carton. */
async function ensureLine(conn, headerId, product_code, upc) {
  let rows = await exec(conn,
    `SELECT id, pcs_per_carton
       FROM NP_Lines
      WHERE header_id = ? AND item_number = ? AND (pallet_id IS NULL OR pallet_id = 0)
      LIMIT 1`,
    [headerId, product_code]
  );
  if (rows.length) {
    const id = rows[0].id;
    if (Number(upc||0) > 0 && Number(rows[0].pcs_per_carton||0) !== Number(upc)) {
      await exec(conn, `UPDATE NP_Lines SET pcs_per_carton = ? WHERE id = ?`, [Number(upc), id]);
    }
    return id;
  }
  const ins = await exec(conn,
    `INSERT INTO NP_Lines
       (header_id, item_number, popis, rozmer, objednano, jednotka, pcs_per_carton, prijato, zbyvajici_mnozstvi)
     VALUES (?, ?, ?, NULL, 0, 'ks', ?, 0, 0)`,
    [headerId, product_code, product_code, Number(upc||1)]
  );
  return ins.insertId;
}

// EAN normalizace: vrátí unikátní kandidáty (leading zero, 12→13 padding)
function eanCandidates(raw) {
  const s = norm(raw).replace(/\s+/g, '');
  if (!s) return [];
  const noLead = s.replace(/^0+/, '');
  const pad12_to13  = s.length === 12 ? ('0' + s) : s;
  const pad12_to13b = noLead.length === 12 ? ('0' + noLead) : noLead;
  const addLeading0 = s.length === 13 ? ('0' + s) : null;        // <— NOVÉ
  const addLeading0b= noLead.length === 13 ? ('0' + noLead) : null; // <— NOVÉ
  return Array.from(new Set(
    [s, noLead, pad12_to13, pad12_to13b, addLeading0, addLeading0b].filter(Boolean)
  ));
}

// vygeneruje další carton_code = `${prefix}-${product}-${NNNN}`
async function generateNextCartonCode(conn, prefix, productCode) {
  const like = `${prefix}-${productCode}-%`;
  const rows = await exec(conn,
    `SELECT carton_code
       FROM NP_Measurements
      WHERE carton_code LIKE ?
      ORDER BY carton_code DESC
      LIMIT 1`,
    [like]
  );
  let next = 1;
  if (rows.length) {
    const last = String(rows[0].carton_code || '');
    const parts = last.split('-');
    const tail = parts[parts.length - 1];
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  const suffix = String(next).padStart(4, '0');
  return `${prefix}-${productCode}-${suffix}`;
}

// načtení slot summary (pro návrat po commitu)
async function fetchSlotSummary(conn, slotId) {
  // můžeš klidně volat svou existující logiku; pro stručnost zkráceno:
  const meas = await exec(conn,
    `SELECT carton_code FROM NP_Measurements WHERE pallet_slot_id = ?`,
    [slotId]
  );
  // jen čísla; reálný summary si bereš ze svého endpointu /api/slot/:id/stock
  return { measured_cartons: meas.length };
}

async function nextCartonCode(conn, headerId, product_code) {
  // prefix z NP_Header.np_number (např. NP1)
  const h = await exec(conn, `SELECT np_number FROM NP_Header WHERE id = ? LIMIT 1`, [headerId]);
  const prefix = norm(h?.[0]?.np_number || 'NP');

  // najdi max suffix pro daný prefix+produkt
  const like = `${prefix}-${product_code}-%`;
  const r = await exec(conn,
    `SELECT MAX(CAST(SUBSTRING_INDEX(carton_code,'-',-1) AS UNSIGNED)) AS mx
       FROM NP_Measurements
      WHERE carton_code LIKE ?`,
    [like]
  );
  const next = String((Number(r?.[0]?.mx || 0) + 1)).padStart(4, '0');
  return `${prefix}-${product_code}-${next}`;
}


// E N D P O I N T Y 

// Resolve carton_code -> produkt (a vazby) pro aktuální objednávku
// ✅ server.js — nahraď tímto celý endpoint /wms/carton/resolve
app.get('/wms/carton/resolve', async (req, res) => {
  // inline parser: vytáhne carton_code z ?carton_code= nebo z GS1 DL (?91=)
  const extractCarton = (rawCode, rawCarton) => {
    const s = (v) => (v == null ? '' : String(v)).trim();
    const carton = s(rawCarton);
    if (carton) return carton;
    const code = s(rawCode);
    if (!code) return '';
    try {
      const u = new URL(code, 'http://x'); // base pro relative
      const ai91 = u.searchParams.get('91');
      if (ai91) return ai91.trim();
    } catch(_) {}
    // fallback: ruční parsování query ?91=
    const m = code.match(/[?&]91=([^&#]+)/);
    if (m) return decodeURIComponent(m[1]).trim();
    return '';
  };

  try {
    const cartonCode = extractCarton(req.query.code, req.query.carton_code);
    const orderNumber = String(req.query.order_number || '').trim();
    if (!cartonCode) return res.status(400).json({ ok: false, error: 'carton_code is required.' });

    const rows = await dbQuery(
      poolC5sluzbyint,
      `SELECT 
         m.id              AS measurement_id,
         m.carton_code,
         m.pallet_slot_id  AS slot_id_from,
         COALESCE(m.qty,0) AS qty,
         l.item_number     AS product_code,
         oraw.Product_Id   AS product_id
       FROM NP_Measurements m
       LEFT JOIN NP_Lines l 
              ON l.id = m.line_id
       LEFT JOIN Orders_raw oraw
              ON oraw.Order_Number = ? 
             AND (oraw.ItsItemName2 = l.item_number OR oraw.Product_Id = l.item_number)
       WHERE m.carton_code = ?
       ORDER BY m.id DESC
       LIMIT 1`,
      [orderNumber || null, cartonCode]
    );

    if (!rows.length) return res.status(404).json({ ok: false, error: 'Krabice nenalezena.' });
    const r = rows[0];
    return res.json({
      ok: true,
      measurement_id: r.measurement_id,
      carton_code: r.carton_code,
      slot_id_from: r.slot_id_from,
      product_code: r.product_code,
      product_id: r.product_id,
      qty: Number(r.qty || 0)
    });
  } catch (e) {
    console.error('[/wms/carton/resolve] error', e);
    return res.status(500).json({ ok: false, error: e.message || 'Server error' });
  }
});



// PATCH /api/measurement/:id/qty
// Body: { qty: number >= 0 }
app.patch('/api/measurement/:id/qty', async (req, res) => {
  const id = Number(req.params.id);
  const qty = Number(req.body?.qty);

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, error: 'Bad measurement id' });
  }
  if (!Number.isFinite(qty) || qty < 0) {
    return res.status(400).json({ success: false, error: 'Bad qty' });
  }

  let conn;
  try {
    conn = await getConn(poolC5sluzbyint);
    const r = await exec(conn, `UPDATE NP_Measurements SET qty = ? WHERE id = ?`, [qty, id]);
    res.json({ success: true, affected: r?.affectedRows || 0 });
  } catch (err) {
    console.error('PATCH /api/measurement/:id/qty error', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  } finally {
    if (conn) conn.release?.();
  }
});


// BE – vrátí data pro štítek (FE si vygeneruje PDF a vytiskne)
app.get('/api/labels/measurement/:id', async (req,res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success:false, message:'Bad id' });
  try {
    const [m] = await exec(conn,
      `SELECT m.id, m.carton_code, m.carton_index, m.line_id, m.pallet_slot_id, s.slot_name,
              l.item_number AS product_code
         FROM NP_Measurements m
         JOIN NP_Lines l ON l.id = m.line_id
         LEFT JOIN WH_pallet_slots s ON s.id = m.pallet_slot_id
        WHERE m.id = ? LIMIT 1`, [id]);
    if (!m) return res.status(404).json({ success:false, message:'Not found' });
    res.json({ success:true, label:m });
  } catch (e) {
    res.status(500).json({ success:false, message:e.message });
  }
});

app.post('/api/initial-inventory/peek-code', async (req, res) => {
  const { slotId, code } = req.body || {};
  const sId = Number(slotId);
  if (!Number.isFinite(sId) || !code) {
    return res.status(400).json({ success: false, message: 'slotId a code jsou povinné' });
  }
  let conn;
  try {
    conn = await getConn(poolC5sluzbyint);

    const raw = norm(code);
    let carton = '', ean = '';
    // JSON ve stringu?
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const o = JSON.parse(raw);
        carton = norm(o.carton_code || o.code);
        ean    = norm(o.ean);
      } catch {}
    }
    if (!carton && !ean) {
      if (raw.includes('-') && raw.split('-').length >= 3) carton = raw;
      else if (/^\d{8,14}$/.test(raw)) ean = raw;
    }

    // QR?
    if (carton) {
      const found = await exec(conn,
        `SELECT id, pallet_slot_id FROM NP_Measurements WHERE carton_code = ? LIMIT 1`, [carton]);
      if (found.length) {
        if (Number(found[0].pallet_slot_id) === sId) {
          return res.json({ success:true, kind:'qr_same_slot', impact_cartons:0 });
        } else {
          return res.json({ success:true, kind:'qr_other_slot', impact_cartons:1 });
        }
      }
      // nový QR – odvoď produkt z kódu
      const parts = carton.split('-');
      const product_code = parts.length >= 2 ? norm(parts[1]) : '';
      if (!product_code) {
        return res.json({ success:true, kind:'qr_new', impact_cartons:0, error:'Nelze odvodit produkt z QR' });
      }
      return res.json({ success:true, kind:'qr_new', impact_cartons:1, product_code, upc:1 });
    }

    // EAN?
    if (ean) {
      const cands = eanCandidates(ean);
      if (!cands.length) {
        return res.json({ success:true, kind:'ean_unknown', impact_cartons:0, error:'Neplatný EAN' });
      }
      const ph = cands.map(()=>'?').join(',');
      const rows = await exec(conn,
        `SELECT \`Kod\` AS code, \`Krabice ks\` AS pcs_per_carton
           FROM Tavinox_komplet
          WHERE \`EAN Krabice\` IN (${ph})
          LIMIT 1`, cands);
      if (!rows.length) {
        return res.json({ success:true, kind:'ean_unknown', impact_cartons:0, error:'EAN nenalezen (EAN Krabice)' });
      }
      const product_code = norm(rows[0].code);
      const upc = Number(rows[0].pcs_per_carton || 1) || 1;
      return res.json({ success:true, kind:'ean_mapped', impact_cartons:1, product_code, upc });
    }

    return res.json({ success:true, kind:'unknown', impact_cartons:0, error:'Neznámý formát' });
  } catch (err) {
    console.error('peek-code error', err);
    return res.status(500).json({ success:false, message: err.message || 'Server error' });
  } finally {
    if (conn) conn.release?.();
  }
});

// QR → přesun; EAN → lookup v Tavinox_komplet, NP_Lines (NP1), vygenerovat šarži a vložit do NP_Measurements
// POST /api/initial-inventory/commit-slot
app.post('/api/initial-inventory/commit-slot', async (req, res) => {
  const { slotId, npHeaderId, scans } = req.body || {};
  const slot_id = Number(slotId);
  const header_id = Number(npHeaderId);

  if (!Number.isFinite(slot_id) || !Number.isFinite(header_id) || !Array.isArray(scans) || scans.length === 0) {
    return res.status(400).json({ success: false, message: 'Neplatný payload (slotId, npHeaderId, scans).' });
  }

  // Pomocné utilitky (lokálně, aby nebyly závislosti na jiných částech)
  const looksLikeQr = (s) => typeof s === 'string' && s.includes('-') && s.split('-').length >= 3;
  const parseProd = (code) => {
    const s = String(code ?? '').trim().split('-');
    return s.length >= 2 ? String(s[1]).trim() : '';
  };
  const pad4 = (n) => String(n).padStart(4, '0');

  let conn;
  try {
    // connection helpers
    const getConn = () => new Promise((resolve, reject) =>
      poolC5sluzbyint.getConnection((err, c) => err ? reject(err) : resolve(c))
    );
    const q = (sql, params=[]) => new Promise((resolve, reject) =>
      conn.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
    );
    const begin = () => new Promise((resolve, reject) => conn.beginTransaction(err => err ? reject(err) : resolve()));
    const commit = () => new Promise((resolve, reject) => conn.commit(err => err ? reject(err) : resolve()));
    const rollback = () => new Promise((resolve) => conn.rollback(() => resolve()));

    conn = await getConn();
    await begin();

    // 1) validace slotu + prefix z NP_Header
    const rowsSlot = await q(`SELECT id, slot_name FROM WH_pallet_slots WHERE id=? LIMIT 1`, [slot_id]);
    if (!rowsSlot.length) {
      await rollback(); conn.release();
      return res.status(404).json({ success:false, message:'Slot nenalezen.' });
    }
    const slot_name = rowsSlot[0].slot_name || '';

    const rowsHdr = await q(`SELECT id, np_number FROM NP_Header WHERE id=? LIMIT 1`, [header_id]);
    if (!rowsHdr.length) {
      await rollback(); conn.release();
      return res.status(404).json({ success:false, message:'NP_Header nenalezen.' });
    }
    const np_prefix = rowsHdr[0].np_number || `NP${header_id}`;

    // 2) pomocné funkce

    // vrátí/nebo založí řádek v NP_Lines (pallet_id = NULL)
    async function getOrCreateLine(headerId, itemNumber, pcsPerCarton) {
      const sel = await q(
        `SELECT id, pcs_per_carton FROM NP_Lines
          WHERE header_id=? AND item_number=? AND pallet_id IS NULL
          LIMIT 1`,
        [headerId, itemNumber]
      );
      if (sel.length) {
        // pokud posíláme pcsPerCarton > 0, můžeme aktualizovat
        const lineId = sel[0].id;
        if (Number(pcsPerCarton) > 0) {
          await q(`UPDATE NP_Lines SET pcs_per_carton=? WHERE id=?`, [Number(pcsPerCarton), lineId]);
        }
        return lineId;
      }
      const r = await q(
        `INSERT INTO NP_Lines
           (header_id, pallet_id, item_number, popis, rozmer, objednano, jednotka, pcs_per_carton, prijato, zbyvajici_mnozstvi)
         VALUES
           (?, NULL, ?, ?, NULL, 0, 'ks', ?, 0, GREATEST(0, 0 - 0))`,
        [headerId, itemNumber, itemNumber, Number(pcsPerCarton||0)]
      );
      return r.insertId;
    }

    // spočítá další pořadí krabice pro daný line_id a zamkne řádky
    async function nextCartonIndex(lineId) {
      const [mx] = await q(
        `SELECT IFNULL(MAX(carton_index),0) AS mx
           FROM NP_Measurements
          WHERE line_id = ?
          FOR UPDATE`,
        [lineId]
      );
      return Number(mx.mx || 0) + 1;
    }

    // zvýší prijato na řádku o units (upc)
    async function bumpLinePrijato(lineId, units) {
      await q(
        `UPDATE NP_Lines
            SET prijato = IFNULL(prijato,0) + ?,
                zbyvajici_mnozstvi = GREATEST(IFNULL(objednano,0) - (IFNULL(prijato,0)), 0)
          WHERE id = ?`,
        [Number(units||0), lineId]
      );
    }

    // najde measurement dle carton_code
    async function findMeasurementByCode(code) {
      const r = await q(`SELECT id, line_id, pallet_slot_id, qty, carton_index, carton_code FROM NP_Measurements WHERE carton_code=? LIMIT 1`, [code]);
      return r.length ? r[0] : null;
    }

    // vloží measurement (carton_code může být z QR nebo generovaný)
    async function insertMeasurement({ line_id, carton_code, carton_index, qty, pallet_slot_id }) {
      const ins = await q(
        `INSERT INTO NP_Measurements
           (line_id, user_id, carton_index, carton_code, measured_weight, pallet_slot_id, qty)
         VALUES
           (?, 0, ?, ?, 0, ?, ?)`,
        [line_id, Number(carton_index), String(carton_code), Number(pallet_slot_id), Number(qty||0)]
      );
      return ins.insertId;
    }

    // counters & response accumulators
    let moved_count = 0;
    let created_count = 0;
    let updated_qty_count = 0;
    let unassigned_count = 0; // neřešíme v tomto endpointu, zůstává 0
    const created_details = []; // pro tisk

    // 3) zpracování skenů (sekvenčně kvůli zámkům)
    for (const s of scans) {
      const raw = String(s?.code ?? '').trim();
      if (!raw) continue;

      const kind = String(s?.kind || '').trim();
      const upc = Number(s?.upc || 0) || 1;

      // preferuj FE product_code, jinak odvoď z kódu
      const product_code = String(s?.product_code || parseProd(raw) || '').trim();

      if (looksLikeQr(raw)) {
        // QR – existuje v DB?
        const found = await findMeasurementByCode(raw);
        if (found) {
          // případná změna slotu (jen když je jiný)
          if (Number(found.pallet_slot_id) !== slot_id) {
            await q(`UPDATE NP_Measurements SET pallet_slot_id=? WHERE id=?`, [slot_id, found.id]);
            moved_count += 1;
          }
          // případná změna qty
          if (upc > 0 && Number(found.qty || 0) !== upc) {
            await q(`UPDATE NP_Measurements SET qty=? WHERE id=?`, [upc, found.id]);
            updated_qty_count += 1;
          }
          // nic dalšího – je to existující krabice
        } else {
          // QR není v DB → založíme
          const lineId = await getOrCreateLine(header_id, product_code, upc);
          const idx = await nextCartonIndex(lineId);
          // carton_code ponecháme přesně tak, jak bylo naskenováno (raw)
          const newId = await insertMeasurement({
            line_id: lineId,
            carton_code: raw,
            carton_index: idx,
            qty: upc,
            pallet_slot_id: slot_id
          });
          await bumpLinePrijato(lineId, upc); // navýšit přijaté kusy
          created_count += 1;
          created_details.push({
            id: newId,
            carton_code: raw,
            product_code,
            slot_id,
            slot_name,
            carton_index: idx
          });
        }
      } else {
        // EAN → musíme založit measurement s novou šarží
        const lineId = await getOrCreateLine(header_id, product_code, upc);
        const idx = await nextCartonIndex(lineId);
        const carton_code = `${np_prefix}-${product_code}-${pad4(idx)}`;

        const newId = await insertMeasurement({
          line_id: lineId,
          carton_code,
          carton_index: idx,
          qty: upc,
          pallet_slot_id: slot_id
        });
        await bumpLinePrijato(lineId, upc);

        created_count += 1;
        created_details.push({
          id: newId,
          carton_code,
          product_code,
          slot_id,
          slot_name,
          carton_index: idx
        });
      }
    }

    // 4) označit slot jako inventarizovaný
    await q(
      `UPDATE WH_pallet_slots
          SET inventarisation='1',
              inventarisation_date = NOW()
        WHERE id = ?`,
      [slot_id]
    );

    await commit();
    conn.release();

    return res.json({
      success: true,
      moved_count,
      created_count,
      updated_qty_count,
      unassigned_count,
      created_details
    });
  } catch (err) {
    try { if (conn) await new Promise(r => conn.rollback(() => r())); } catch {}
    try { if (conn) conn.release(); } catch {}
    console.error('commit-slot error', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

app.post('/api/initial-inventory/reassign-to-unassigned', async (req, res) => {
  const { fromSlotId, rows = [], strategy = 'oldest', carton_codes = [] } = req.body || {};
  const slotId = Number(fromSlotId);

  if (!Number.isFinite(slotId) || ( (!Array.isArray(rows) || rows.length === 0) && (!Array.isArray(carton_codes) || carton_codes.length === 0) )) {
    return res.status(400).json({ success: false, error: 'Chybí fromSlotId a rows/carton_codes.' });
  }
  if (slotId === UNASSIGNED_SLOT_ID) {
    return res.status(400).json({ success: false, error: 'Zdrojový slot nemůže být NEZARAZENO.' });
  }

  let conn;
  try {
    conn = await getConn(poolC5sluzbyint);
    await begin(conn);

    // Ověř, že zdrojový slot existuje
    const slotChk = await exec(conn, `SELECT id, slot_name FROM WH_pallet_slots WHERE id = ? LIMIT 1`, [slotId]);
    if (!slotChk?.length) {
      await rollback(conn);
      return res.status(404).json({ success: false, error: 'Zdrojový slot neexistuje.' });
    }

    const moved = [];
    const orderBy = strategy === 'newest' ? 'DESC' : 'ASC';

    // 1) Explicitní seznam carton_codes má prioritu
    if (Array.isArray(carton_codes) && carton_codes.length) {
      // vytáhni jejich id v aktuálním slotu
      const ph = carton_codes.map(() => '?').join(',');
      const found = await exec(conn,
        `SELECT id, carton_code
           FROM NP_Measurements
          WHERE pallet_slot_id = ?
            AND carton_code IN (${ph})`,
        [slotId, ...carton_codes]
      );

      if (found.length) {
        const ids = found.map(r => r.id);
        const idph = ids.map(() => '?').join(',');
        await exec(conn,
          `UPDATE NP_Measurements
              SET pallet_slot_id = ?
            WHERE id IN (${idph})`,
          [UNASSIGNED_SLOT_ID, ...ids]
        );
        moved.push(...found.map(r => ({ carton_code: r.carton_code })));
      }
    }

    // 2) Řádková reassign logika podle product_code a počtu kartonů
    for (const row of (rows || [])) {
      const product_code = String(row?.product_code || '').trim();
      const cartons = Number(row?.cartons || 0);
      if (!product_code || cartons <= 0) continue;

      // najdi konkrétní kartony v tomto slotu (carton_code obsahuje "-ItsItemName2-")
      const found = await exec(conn,
        `SELECT id, carton_code
           FROM NP_Measurements
          WHERE pallet_slot_id = ?
            AND carton_code LIKE CONCAT('%-', ?, '-%')
          ORDER BY measured_at ${orderBy}
          LIMIT ?`,
        [slotId, product_code, cartons]
      );
      if (!found.length) continue;

      const ids = found.map(r => r.id);
      const idph = ids.map(() => '?').join(',');

      await exec(conn,
        `UPDATE NP_Measurements
            SET pallet_slot_id = ?
          WHERE id IN (${idph})`,
        [UNASSIGNED_SLOT_ID, ...ids]
      );

      moved.push(...found.map(r => ({ carton_code: r.carton_code, product_code })));
    }

    await commit(conn);
    return res.json({ success: true, moved_count: moved.length, moved, to_slot_id: UNASSIGNED_SLOT_ID, to_slot_name: UNASSIGNED_SLOT_NAME });
  } catch (err) {
    try { if (conn) await rollback(conn); } catch {}
    console.error('reassign-to-unassigned error', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  } finally {
    if (conn) conn.release?.();
  }
});
// GET /api/slot/:slotId/stock
// Vrátí rozpad po produktu (ItsItemName2): kolik kartonů je změřeno (NP_Measurements),
// kolik bylo vydáno z tohoto slotu (WH_IssueItems), a výsledný zůstatek v ks i kartonech.
// GET /api/slot/:slotId/stock
// Vrací souhrn po produktu + NOVĚ i detail krabic s qty.
// Zachovává staré pole carton_codes pro kompatibilitu.
app.get('/api/slot/:slotId/stock', async (req, res) => {
  const slotId = Number(req.params.slotId);
  if (!Number.isFinite(slotId)) {
    return res.status(400).json({ success: false, error: 'Neplatné slotId' });
  }

  const norm = v => String(v ?? '').trim();

  const mode = (arr) => {
    if (!arr || !arr.length) return null;
    const counts = new Map();
    let best = null, bestc = 0;
    for (const v of arr) {
      const c = (counts.get(v) || 0) + 1;
      counts.set(v, c);
      if (c > bestc) { best = v; bestc = c; }
    }
    return best;
  };

  try {
    // 1) Slot info
    const slotRows = await query(poolC5sluzbyint,
      'SELECT id, slot_name FROM WH_pallet_slots WHERE id = ? LIMIT 1', [slotId]);
    if (!slotRows || !slotRows.length) {
      return res.status(404).json({ success: false, error: 'Slot nenalezen' });
    }
    const slot = slotRows[0];

    // 2) Všechny krabice v tomto slotu + jejich řádek z NP_Lines
    const rows = await query(poolC5sluzbyint,
      `SELECT
         m.id,
         m.carton_code,
         m.qty,
         m.measured_at,
         m.line_id,
         l.item_number      AS product_code,
         l.pcs_per_carton   AS pcs_per_carton
       FROM NP_Measurements m
       JOIN NP_Lines l ON l.id = m.line_id
      WHERE m.pallet_slot_id = ?`,
      [slotId]
    );

    // 3) Seskupení dle produktu
    const byProd = new Map(); // product_code -> { cartons: [{id, carton_code, qty, measured_at}], count, pcs_per_carton }
    for (const r of rows) {
      const prod = norm(r.product_code);
      if (!prod) continue;
      const rec = byProd.get(prod) || { cartons: [], count: 0, pcs_per_carton: Number(r.pcs_per_carton || 0) || 0 };
      rec.cartons.push({
        id: r.id,
        carton_code: norm(r.carton_code),
        qty: Number(r.qty || 0),
        measured_at: r.measured_at
      });
      rec.count += 1;
      if (!rec.pcs_per_carton && Number(r.pcs_per_carton || 0) > 0) {
        rec.pcs_per_carton = Number(r.pcs_per_carton);
      }
      byProd.set(prod, rec);
    }

    // 4) Výdeje z tohoto slotu (pokud vedeš)
    const issues = await query(poolC5sluzbyint,
      `SELECT product_id, 
              SUM(COALESCE(qty_units,0))   AS issued_units,
              SUM(COALESCE(qty_cartons,0)) AS issued_cartons
         FROM WH_IssueItems
        WHERE slot_id_from = ?
        GROUP BY product_id`,
      [slotId]
    );
    const issuedMap = new Map(); // product_id -> { issued_units, issued_cartons }
    for (const r of issues) {
      issuedMap.set(norm(r.product_id), {
        issued_units: Number(r.issued_units || 0),
        issued_cartons: Number(r.issued_cartons || 0),
      });
    }

    // 5) Sestavení summary
    const summary = [];
    const allProds = new Set([...byProd.keys(), ...issuedMap.keys()]);

    for (const prod of allProds) {
      const rec = byProd.get(prod) || { cartons: [], count: 0, pcs_per_carton: 0 };
      const qties = rec.cartons.map(c => Number(c.qty || 0)).filter(x => x > 0);

      // Default UPC: preferuj NP_Lines.pcs_per_carton; když není, vezmi mód z existujících nenulových qty; jinak 1
      const upcDefault = Number(rec.pcs_per_carton || 0) > 0
        ? Number(rec.pcs_per_carton)
        : (mode(qties) || 1);

      // jednotky = suma qty, prázdná qty → nahrazena defaultem
      const measured_units = rec.cartons.reduce(
        (sum, c) => sum + (Number(c.qty || 0) > 0 ? Number(c.qty) : upcDefault),
        0
      );
      const measured_cartons = rec.count;

      const iss = issuedMap.get(prod) || { issued_units: 0, issued_cartons: 0 };
      const balance_units = measured_units - iss.issued_units;
      const balance_cartons_est = upcDefault > 0 ? balance_units / upcDefault : 0;

      summary.push({
        product_code: prod,
        units_per_carton: upcDefault,
        measured_cartons,
        measured_units,
        issued_units: iss.issued_units,
        issued_cartons: iss.issued_cartons,
        balance_units,
        balance_cartons_est,

        // kompatibilita se starým FE:
        carton_codes: rec.cartons.map(c => c.carton_code),

        // detail pro FE (edit qty přes PATCH /api/measurement/:id/qty)
        cartons_detail: rec.cartons
      });
    }

    // 6) Totals
    const totals = summary.reduce((acc, r) => {
      acc.measured_units += r.measured_units;
      acc.issued_units += r.issued_units;
      acc.balance_units += r.balance_units;
      return acc;
    }, { measured_units: 0, issued_units: 0, balance_units: 0 });

    res.json({
      success: true,
      slot: { id: slot.id, slot_name: slot.slot_name },
      summary,
      totals
    });
  } catch (err) {
    console.error('GET /api/slot/:slotId/stock error', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// 1. Endpoint: Get list of pallet slots
// GET /api/pallet-slots
app.get('/api/pallet-slots', async (req, res) => {
  const inv = req.query.inventarisation;
  let conn;
  try {
    conn = await new Promise((resolve, reject) =>
      poolC5sluzbyint.getConnection((err, c) => err ? reject(err) : resolve(c))
    );

    let sql = `SELECT id, slot_name, product_id, status, inventarisation, inventarisation_date
               FROM WH_pallet_slots`;
    const params = [];

    if (inv === '0' || inv === 0) {
      sql += ` WHERE inventarisation = '0'`;
    } // jinak vše

    sql += ` ORDER BY slot_name`;

    const [rows] = await new Promise((resolve, reject) =>
      conn.query(sql, params, (err, results) => err ? reject(err) : resolve([results]))
    );

    res.json({ success: true, slots: rows });
  } catch (err) {
    console.error("Error fetching pallet slots:", err);
    res.status(500).json({ success: false, message: "Failed to retrieve pallet slots." });
  } finally {
    if (conn) conn.release();
  }
});


// 2. Endpoint: Handle scanning of a box on a selected pallet slot
// POST /api/initial-inventory/scan (PUBLIC)
// Uloží naskenovaný karton do NP_Measurements
app.post('/api/initial-inventory/scan', async (req, res) => {
  const { palletSlotId, code } = req.body || {};
  const slotId = Number(palletSlotId);
  const cartonCode = String(code || '').trim();

  if (!Number.isFinite(slotId) || !cartonCode) {
    return res.status(400).json({ success: false, message: "palletSlotId a code jsou povinné." });
  }

  let conn;
  try {
    conn = await getConn(poolC5sluzbyint);
    await begin(conn);

    // Ověř, že slot existuje
    const slotChk = await exec(conn,
      `SELECT id, slot_name 
         FROM WH_pallet_slots 
        WHERE id = ? 
        LIMIT 1`,
      [slotId]
    );
    if (!slotChk?.length) {
      await rollback(conn);
      return res.status(404).json({ success: false, message: "Slot neexistuje." });
    }

    // Najdi, jestli už tento carton_code v DB existuje
    const existing = await exec(conn,
      `SELECT id FROM NP_Measurements WHERE carton_code = ? LIMIT 1`,
      [cartonCode]
    );

    let newCartonCode = null;

    if (existing.length === 0) {
      // vlož nový záznam
      await exec(conn,
        `INSERT INTO NP_Measurements 
           (pallet_slot_id, carton_code, measured_at) 
         VALUES (?, ?, NOW())`,
        [slotId, cartonCode]
      );
    } else {
      // pokud už existuje – vytvoř nový unikátní kód se suffixem
      newCartonCode = `${cartonCode}-${Date.now()}`;
      await exec(conn,
        `INSERT INTO NP_Measurements 
           (pallet_slot_id, carton_code, measured_at) 
         VALUES (?, ?, NOW())`,
        [slotId, newCartonCode]
      );
    }

    await commit(conn);

    return res.json({
      success: true,
      newCartonCode
    });
  } catch (err) {
    try { if (conn) await rollback(conn); } catch {}
    console.error("scan error", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  } finally {
    if (conn) conn.release?.();
  }
});

/**
 * POST /wms/issues
 * Body: { orderNumber: string }
 * Vytvoří (nebo vrátí existující 'open') hlavičku výdejky pro objednávku.
 */
app.post('/wms/issues', async (req, res) => {
  try {
    const orderNumber = String(req.body?.orderNumber || '').trim();
    if (!orderNumber) return res.status(400).json({ ok: false, error: 'Chybí orderNumber.' });

    // zkus najít otevřenou
    let rows = await q(poolC5sluzbyint, `
      SELECT id, doc_no, status, order_number
      FROM WH_Issues
      WHERE order_number = ? AND status = 'open'
      ORDER BY id DESC LIMIT 1
    `, [orderNumber]);

    if (rows.length) {
      return res.json({ ok: true, issueId: rows[0].id, docNo: rows[0].doc_no, status: rows[0].status });
    }

    // založ novou
    const ins = await q(poolC5sluzbyint, `
      INSERT INTO WH_Issues (doc_no, status, order_number)
      VALUES (NULL, 'open', ?)
    `, [orderNumber]);

    const issueId = ins.insertId || ins?.[0]?.insertId;
    // očísluj
    await q(poolC5sluzbyint, `
      UPDATE WH_Issues
      SET doc_no = CONCAT('ISS-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(?, 6, '0'))
      WHERE id = ?
    `, [issueId, issueId]);

    const hdr = await q(poolC5sluzbyint, `SELECT id, doc_no, status FROM WH_Issues WHERE id=?`, [issueId]);
    return res.json({ ok: true, issueId, docNo: hdr[0].doc_no, status: hdr[0].status });
  } catch (err) {
    console.error('ERR POST /wms/issues', err);
    return res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

/**
 * POST /wms/issues/:issueId/line
 * Body: { productId: string, deltaUnits: number, slotName?: string|null, cartonCode?: string|null, operationType?: 'pick'|'control'|'overpick' }
 * Přidá řádek do výdejky (delta v kusech). Pokud dodáš cartonCode, zkusí navázat measurement_id.
 */
app.post('/wms/issues/:issueId/line', async (req, res) => {
  try {
    const issueId = parseInt(req.params.issueId, 10);
    if (!Number.isInteger(issueId) || issueId <= 0) {
      return res.status(400).json({ ok:false, error:'Neplatné issueId.' });
    }
    const { productId, deltaUnits, cartonCode, operationType='pick' } = req.body || {};
    if (!productId) return res.status(400).json({ ok:false, error:'productId je povinné.' });
    if (typeof deltaUnits !== 'number' || !Number.isFinite(deltaUnits) || deltaUnits === 0) {
      return res.status(400).json({ ok:false, error:'deltaUnits musí být nenulové číslo.' });
    }
    const carton = String(cartonCode || '').trim();
    if (!carton) return res.status(400).json({ ok:false, error:'cartonCode je povinné (musíš skenovat krabici).' });

    let conn;
    try {
      conn = await getConn(poolC5sluzbyint);
      await begin(conn);

      const hdr = await exec(conn, `SELECT id, status FROM WH_Issues WHERE id=? LIMIT 1`, [issueId]);
      if (!hdr.length) { await rollback(conn); return res.status(404).json({ ok:false, error:'Výdejka nenalezena.' }); }
      if (hdr[0].status !== 'open') { await rollback(conn); return res.status(400).json({ ok:false, error:'Výdejka není open.' }); }

      // Najdi krabici (measurement + slot)
      const m = await exec(conn,
        `SELECT id AS measurement_id, pallet_slot_id AS slot_id, COALESCE(qty,0) AS qty, carton_code
           FROM NP_Measurements WHERE carton_code = ? LIMIT 1`, [carton]);
      if (!m.length) { await rollback(conn); return res.status(404).json({ ok:false, error:'Krabice (carton_code) nenalezena.' }); }
      const measurementId = m[0].measurement_id;
      const slotIdFrom    = Number(m[0].slot_id) || 0;
      const cartonFinal   = String(m[0].carton_code || carton);

      // line_no
      const ln = await exec(conn, `SELECT COALESCE(MAX(line_no),0)+10 AS ln FROM WH_IssueItems WHERE issue_id=?`, [issueId]);
      const lineNo = Number(ln?.[0]?.ln || 10);

      await exec(conn,
        `INSERT INTO WH_IssueItems
           (issue_id, line_no, product_id, slot_id_from, carton_code, measurement_id,
            qty_units, qty_cartons, qty_sachets, operation_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)` ,
        [issueId, lineNo, String(productId), slotIdFrom, cartonFinal, measurementId, Number(deltaUnits), String(operationType)]
      );

      // Pohyb zásoby jen pro PICK
      if (operationType === 'pick') {
        if (deltaUnits > 0) {
          await exec(conn, `UPDATE NP_Measurements SET qty = GREATEST(COALESCE(qty,0) - ?, 0) WHERE id = ?`, [Number(deltaUnits), measurementId]);
        } else if (deltaUnits < 0) {
          await exec(conn, `UPDATE NP_Measurements SET qty = COALESCE(qty,0) + ? WHERE id = ?`, [Math.abs(Number(deltaUnits)), measurementId]);
        }
      }

      await commit(conn);
      return res.json({ ok:true, issueId, productId, deltaUnits, operationType, carton_code: cartonFinal, slot_id_from: slotIdFrom });
    } catch (err) {
      try { if (conn) await rollback(conn); } catch {}
      throw err;
    } finally {
      if (conn) conn.release?.();
    }
  } catch (err) {
    console.error('ERR POST /wms/issues/:issueId/line', err);
    return res.status(500).json({ ok:false, error: err.message || 'Server error' });
  }
});

/**
 * POST /wms/issues/:issueId/save
 * Zatím jen potvrzení uložení "open" výdejky (no-op pro budoucí rozšíření).
 */
app.post('/wms/issues/:issueId/save', async (req, res) => {
  try {
    const issueId = parseInt(req.params.issueId, 10);
    if (!Number.isInteger(issueId) || issueId <= 0) {
      return res.status(400).json({ ok: false, error: 'Neplatné issueId.' });
    }
    const r = await q(poolC5sluzbyint, `SELECT id, doc_no, status FROM WH_Issues WHERE id=?`, [issueId]);
    if (!r.length) return res.status(404).json({ ok: false, error: 'Výdejka nenalezena.' });
    return res.json({ ok: true, issueId, status: r[0].status, docNo: r[0].doc_no });
  } catch (err) {
    console.error('ERR POST /wms/issues/:issueId/save', err);
    return res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

/**
 * POST /wms/issues/:issueId/post
 * Uzavře výdejku (status -> posted). (Logika účtování můžeš doplnit později.)
 */
app.post('/wms/issues/:issueId/post', async (req, res) => {
  try {
    const issueId = parseInt(req.params.issueId, 10);
    if (!Number.isInteger(issueId) || issueId <= 0) {
      return res.status(400).json({ ok: false, error: 'Neplatné issueId.' });
    }
    const upd = await q(poolC5sluzbyint, `
      UPDATE WH_Issues SET status='posted' WHERE id=? AND status='open'
    `, [issueId]);

    // mysql vrací affectedRows na různých místech; zkusíme zjistit "něco se změnilo?"
    const changed = (upd.affectedRows ?? upd?.[0]?.affectedRows ?? 0) > 0;
    if (!changed) {
      const r = await q(poolC5sluzbyint, `SELECT status FROM WH_Issues WHERE id=?`, [issueId]);
      return res.status(400).json({ ok: false, error: `Nelze uzavřít, status je '${r[0]?.status || 'unknown'}'.` });
    }
    return res.json({ ok: true, issueId, status: 'posted' });
  } catch (err) {
    console.error('ERR POST /wms/issues/:issueId/post', err);
    return res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

/**
 * POST /wms/order/:orderNumber/picked
 * Body: { product_code, item_id?, slotName?, pickedQty, controlQty?, issueId?, cartonCode?, operationType? }
 *
 * - spočítá delta (pickedQty - dosavadní stav v Orders_raw)
 * - vloží řádek do WH_IssueItems (ledger) k otevřené výdejce (najde / vytvoří)
 * - aktualizuje Orders_raw (kvůli UI)
 */
app.post('/wms/order/:orderNumber/picked', async (req, res) => {
  const orderNumber = String(req.params.orderNumber || '').trim();
  const body = req.body || {};
  const product_code = (body.product_code ?? body.productId ?? '').trim(); // očekáváme ITS klíč
  const item_id      = (body.item_id ?? '').trim();
  const slotName     = body.slotName ?? null;
  const pickedQty    = Number(body.pickedQty);
  const controlQty   = (body.controlQty == null ? null : Number(body.controlQty));
  const issueIdBody  = body.issueId ?? null;
  const cartonCode   = body.cartonCode ?? null;
  let operationType  = body.operationType || 'pick';

  if (!orderNumber) return res.status(400).json({ success: false, error: 'Chybí orderNumber.' });
  if (!product_code) return res.status(400).json({ success: false, error: 'product_code (ItsItemName2) je povinné.' });
  if (Number.isNaN(pickedQty)) return res.status(400).json({ success: false, error: 'pickedQty musí být číslo.' });

  let conn;
  try {
    conn = await getConn(poolC5sluzbyint);
    await begin(conn);

    const map = await exec(conn,
      `SELECT Product_Id AS ax, ItsItemName2 AS its, Product_Picked AS prevPicked, COALESCE(Product_Picked_Check,0) AS prevControl
         FROM Orders_raw
        WHERE Order_Number = ? AND (Product_Id = ? OR ItsItemName2 = ?)
        LIMIT 1`,
      [orderNumber, product_code, product_code]
    );
    if (!map.length) {
      await rollback(conn);
      return res.status(404).json({ success: false, error: 'Položka není v Orders_raw pro danou objednávku.' });
    }
    const its = String(map[0].its || '').trim();
    const ax  = String(map[0].ax  || '').trim();
    const prevPicked  = Number(map[0].prevPicked || 0);
    const prevControl = Number(map[0].prevControl || 0);
    if (!its || !ax) {
      await rollback(conn);
      return res.status(404).json({ success: false, error: 'Chybí ITS/AX mapování v Orders_raw.' });
    }

    let deltaUnits = 0;
    if (operationType === 'control') {
      if (controlQty == null || Number.isNaN(controlQty)) {
        await rollback(conn);
        return res.status(400).json({ success: false, error: 'Pro control je nutné dodat controlQty.' });
      }
      deltaUnits = Number(controlQty) - prevControl;
    } else {
      deltaUnits = Number(pickedQty) - prevPicked;
    }
    if (!Number.isFinite(deltaUnits) || deltaUnits === 0) {
      await commit(conn);
      return res.json({ success: true, orderNumber, item: { ax, its }, deltaUnits: 0, operationType });
    }

    let issueId = null;
    if (issueIdBody) {
      const r = await exec(conn, `SELECT id FROM WH_Issues WHERE id=? AND status='open' LIMIT 1`, [issueIdBody]);
      if (r.length) issueId = issueIdBody;
    }
    if (!issueId) {
      const open = await exec(conn, `SELECT id FROM WH_Issues WHERE order_number=? AND status='open' ORDER BY id DESC LIMIT 1`, [orderNumber]);
      if (open.length) issueId = open[0].id;
      else {
        const ins = await exec(conn, `INSERT INTO WH_Issues (doc_no, status, order_number) VALUES (NULL, 'open', ?)`, [orderNumber]);
        issueId = ins.insertId;
        await exec(conn, `UPDATE WH_Issues SET doc_no = CONCAT('ISS-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(?, 6, '0')) WHERE id=?`, [issueId, issueId]);
      }
    }

    let measurementId = null;
    let slotIdFrom = null;
    if (cartonCode) {
      const m = await exec(conn,
        `SELECT id AS measurement_id, pallet_slot_id AS slot_id FROM NP_Measurements WHERE carton_code = ? LIMIT 1`,
        [cartonCode]
      );
      if (m.length) {
        measurementId = m[0].measurement_id;
        slotIdFrom    = m[0].slot_id;
      }
    }

    const ln = await exec(conn, `SELECT COALESCE(MAX(line_no),0)+10 AS ln FROM WH_IssueItems WHERE issue_id=?`, [issueId]);
    const lineNo = Number(ln?.[0]?.ln || 10);

    await exec(conn,
      `INSERT INTO WH_IssueItems
         (issue_id, line_no, product_id, slot_id_from, carton_code, measurement_id,
          qty_units, qty_cartons, qty_sachets, operation_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      [issueId, lineNo, its, slotIdFrom, cartonCode || null, measurementId, deltaUnits, operationType]
    );

    if (measurementId && operationType === 'pick') {
      if (deltaUnits > 0) {
        await exec(conn, `UPDATE NP_Measurements SET qty = GREATEST(COALESCE(qty,0) - ?, 0) WHERE id = ?`, [deltaUnits, measurementId]);
      } else if (deltaUnits < 0) {
        await exec(conn, `UPDATE NP_Measurements SET qty = COALESCE(qty,0) + ? WHERE id = ?`, [Math.abs(deltaUnits), measurementId]);
      }
    }

    let newPicked = prevPicked;
    let newControl = prevControl;
    if (operationType === 'control') {
      newControl = Number(controlQty);
    } else {
      newPicked = Number(pickedQty);
      if (newControl > newPicked) newControl = newPicked;
    }

    await exec(conn,
      `UPDATE Orders_raw
          SET Product_Picked = ?,
              Product_Picked_Check = ?,
              Position = COALESCE(?, Position)
        WHERE Order_Number = ? AND Product_Id = ?`,
      [newPicked, newControl, slotName, orderNumber, ax]
    );

    await commit(conn);
    return res.json({ success: true, orderNumber, item: { ax, its }, deltaUnits, operationType, issueId });
  } catch (err) {
    try { if (conn) await rollback(conn); } catch {}
    console.error('ERR POST /wms/order/:orderNumber/picked', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  } finally {
    if (conn) conn.release?.();
  }
});

//log čtečky
app.post('/wms/scanlog', (req, res) => {
  try {
    const evt = req.body || {};
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
      ua: req.headers['user-agent'] || null,
      ...evt
    }) + '\n';
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'scanner.log');
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFile(logFile, line, () => {});
    console.log('[SCAN]', line.trim());
    res.json({ ok: true });
  } catch (e) {
    console.error('[/wms/scanlog] error', e);
    res.status(500).json({ ok: false, error: e.message || 'log error' });
  }
});


// === GPT Chat endpoint (JSON i stream) ===
app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], model = 'gpt-5', stream = false } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OPENAI_API_KEY není nastaveno' });
    }

    if (!stream) {
      // Jednorázová odpověď (JSON)
      const completion = await openai.chat.completions.create({
        model,
        messages,
      });
      return res.json({ reply: completion.choices?.[0]?.message || null });
    }

    // Stream (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const streamResp = await openai.chat.completions.create({
      model,
      messages,
      stream: true,
    });

    for await (const chunk of streamResp) {
      const delta = chunk?.choices?.[0]?.delta?.content || '';
      if (delta) res.write(`data: ${delta}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    } catch {
      res.status(500).json({ error: err.message });
    }
  }
});

// === Assistant endpoint s tool-callingem (Raynet search) ===
app.post('/api/assistant', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OPENAI_API_KEY není nastaveno' });
    }

    const { messages = [], model = 'gpt-5' } = req.body || {};

    // Definice "nástrojů" (funkcí), které může model zavolat
    const tools = [
      {
        type: 'function',
        function: {
          name: 'raynet_searchBusinessCases',
          description: 'Najdi obchodní případy v Raynet CRM dle přesného name (=code).',
          parameters: {
            type: 'object',
            properties: {
              nameEQ: { type: 'string', description: 'Hodnota pro filter name[EQ]' },
              limit: { type: 'integer', minimum: 1, maximum: 1000, default: 10 },
            },
            required: ['nameEQ']
          }
        }
      }
    ];

    // 1) Dotaz na model (může si vyžádat zavolání funkce)
    const first = await openai.chat.completions.create({
      model,
      messages,
      tools
    });

    const call = first.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      // Model nic nevolal – vrať rovnou odpověď modelu
      return res.json({ reply: first.choices?.[0]?.message || null });
    }

    // 2) Provedeme volání Raynetu na serveru
    let toolResult = { error: 'raynetApi není k dispozici na serveru' };
    if (typeof raynetApi?.get === 'function') {
      const args = JSON.parse(call.function.arguments || '{}');
      const resp = await raynetApi.get('/businessCase/', {
        params: { 'name[EQ]': args.nameEQ, limit: args.limit || 10 }
      });
      toolResult = resp.data?.data || [];
    }

    // 3) Vrátíme výsledek jako "tool" zprávu a necháme model sepsat finální odpověď
    const second = await openai.chat.completions.create({
      model,
      messages: [
        ...messages,
        first.choices[0].message,
        {
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(toolResult)
        }
      ]
    });

    return res.json({ reply: second.choices?.[0]?.message || null });
  } catch (err) {
    console.error('Assistant error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/business-cases', async (req, res) => {
  try {
    const from = '2025-01-01';
    const to   = '2025-03-31';
    const limit = 1000;
    let offset = 0;
    let allCases = [];

    while (true) {
      const response = await raynetApi.get('/businessCase/', {
        params: {
          limit,
          offset,
          'validFrom[GE]': from,
          'validFrom[LE]': to,
        }
      });
      updateRateLimit(response.headers);

      const batch = response.data.data;
      allCases = allCases.concat(batch);

      if (batch.length < limit) break;
      offset += limit;
    }

    res.json({
      success: true,
      count: allCases.length,
      rateLimit: lastRaynetRateLimit,
      data: allCases
    });
  } catch (err) {
    console.error('Chyba při načítání obchodních případů:', err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
      rateLimit: lastRaynetRateLimit
    });
  }
});

// server/routes/klienti.js (nebo přímo v app.js)
app.get('/klienti', (req, res) => {
  const where = [];
  const params = [];

  // Helpers
  const numCol = (col) => `CAST(REPLACE(\`${col}\`, ',', '.') AS DECIMAL(15,6))`;
  const dateCol = (col) => `STR_TO_DATE(\`${col}\`, '%e.%c.%Y %H:%i')`;

  // 1) BBOX: bbox=south,west,north,east
  if (req.query.bbox) {
    const parts = String(req.query.bbox).split(',').map(Number);
    if (parts.length === 4 && parts.every(v => Number.isFinite(v))) {
      const [south, west, north, east] = parts;
      where.push(`${numCol('Zemepisna_sirka')} BETWEEN ? AND ?`);
      params.push(south, north);
      where.push(`${numCol('Zemepisna_delka')} BETWEEN ? AND ?`);
      params.push(west, east);
    }
  }

  // 2) has_coords
  if (req.query.has_coords === 'true') {
    where.push(`\`Zemepisna_sirka\` IS NOT NULL AND \`Zemepisna_sirka\` <> ''`);
    where.push(`\`Zemepisna_delka\` IS NOT NULL AND \`Zemepisna_delka\` <> ''`);
  }

  // 3) fulltext / fallback LIKE přes jméno+adresu
  if (req.query.q) {
    const q = String(req.query.q).trim();
    // pokud máš FULLTEXT index: ALTER TABLE c5tpms.Klienti ADD FULLTEXT ft_name_addr (Nazev_jmeno, Mesto_kontaktni, Ulice_kontaktni);
    // where.push(`MATCH(\`Nazev_jmeno\`,\`Mesto_kontaktni\`,\`Ulice_kontaktni\`) AGAINST (? IN BOOLEAN MODE)`);
    // params.push(q + '*');
    where.push(`CONCAT_WS(' ', \`Nazev_jmeno\`, \`Mesto_kontaktni\`, \`Ulice_kontaktni\`) LIKE ?`);
    params.push(`%${q}%`);
  }

  // 4) IN seznamy: Rating_in=A,B,C ; Stav_in=... ; Kategorie_in=...
  ['Rating', 'Stav', 'Kategorie', 'Vlastnik'].forEach(col => {
  const key = col + '_in';
  if (req.query[key]) {
    const list = String(req.query[key]).split(',').map(s => s.trim()).filter(Boolean);
    if (list.length) {
      where.push('`' + col + '` IN (' + list.map(()=> '?').join(',') + ')');
      params.push(...list);
    }
  }
});

  // 5) LIKE (stávající chování) ..._like
  Object.keys(req.query).forEach(key => {
    if (key.endsWith('_like')) {
      const col = key.replace(/_like$/, '');
      where.push('`' + col + '` LIKE ?');
      params.push('%' + req.query[key] + '%');
    }
  });

  // 6) min/max pro numerické string sloupce (např. 2025_Kc, "Rozjednáno za")
  const numRanges = [
    { keyMin: 'min_2025_kc', keyMax: 'max_2025_kc', col: '2025_Kc' },
    { keyMin: 'min_rozjednano', keyMax: 'max_rozjednano', col: 'Rozjednáno za' },
  ];
  numRanges.forEach(({keyMin, keyMax, col}) => {
    if (req.query[keyMin] != null && req.query[keyMin] !== '') {
      where.push(`${numCol(col)} >= ?`);
      params.push(Number(String(req.query[keyMin]).replace(',', '.')) || 0);
    }
    if (req.query[keyMax] != null && req.query[keyMax] !== '') {
      where.push(`${numCol(col)} <= ?`);
      params.push(Number(String(req.query[keyMax]).replace(',', '.')) || 0);
    }
  });

  // 7) dny od poslední aktivity / do naplánované
  if (req.query.last_activity_days_max) {
    where.push(`TIMESTAMPDIFF(DAY, ${dateCol('Posledni_aktivita')}, NOW()) <= ?`);
    params.push(Number(req.query.last_activity_days_max));
    // zároveň ignoruj null (bez hodnoty):
    where.push(`${dateCol('Posledni_aktivita')} IS NOT NULL`);
  }
  if (req.query.next_activity_days_max) {
    where.push(`${dateCol('Naplanovana_aktivita')} IS NOT NULL`);
    where.push(`TIMESTAMPDIFF(DAY, NOW(), ${dateCol('Naplanovana_aktivita')}) BETWEEN 0 AND ?`);
    params.push(Number(req.query.next_activity_days_max));
  }

  // 8) whitelist sortování
  const sortMap = {
    'Nazev_jmeno': '`Nazev_jmeno`',
    '2025_Kc':     numCol('2025_Kc'),
    'Rozjednano_za': numCol('Rozjednáno za'),
    'Posledni_aktivita': dateCol('Posledni_aktivita'),
    'Naplanovana_aktivita': dateCol('Naplanovana_aktivita'),
  };
  const sortBy = sortMap[String(req.query.sort_by || '').trim()] || '`Nazev_jmeno`';
  const sortDir = String(req.query.sort_dir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  // 9) limit/offset
  const limit  = Math.min(Math.max(parseInt(req.query.limit || '500', 10), 1), 1000);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

  const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
  const sql = `
    SELECT *
    FROM c5tpms.Klienti
    ${whereSql}
    ORDER BY ${sortBy} ${sortDir}
    LIMIT ${offset}, ${limit}
  `;

  poolC5tpms.query(sql, params, (err, rows) => {
    if (err) {
      console.error('Chyba při načítání klientů:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, count: rows.length, data: rows });
  });
});

app.get('/raynet/update-sales-orders-AX-fromMSSQL', async (req, res) => {
  try {
    console.log('=== /raynet/update-sales-orders-AX-fromMSSQL (name+company; code generuje Raynet) ===');

    // Data od 1.7.2025 (jak jsme měli pro testy)
    const msSqlQuery = `
      SELECT 
        T.SalesId,
        T.RegNum,
        T.CustName,
        T.SalesGroupName,
        T.SalesStatusText,
        T.ReceiptDateRequested,
        L.ItemId,
        L.DeliveredQty,
        L.SalesQty,
        L.SalesPrice,
        L.LinePercent,
        I.ItemName,
        I.ItemGroupId,
        I.PurchLineDisc
      FROM [AxProdCS].[dbo].[ItsIFSalesTable] T
      JOIN [AxProdCS].[dbo].[ItsIFSalesLine] L ON T.SalesId = L.SalesId
      JOIN [AxProdCS].[dbo].[ItsIFInventTable] I ON L.ItemId = I.ItemId
      WHERE T.ReceiptDateRequested >= '2024-08-01'
  AND T.ReceiptDateRequested <  '2024-10-15'
      ORDER BY T.RegNum, T.SalesId;
    `;

    const result = await queryMSSQL(msSqlQuery, []);
    const rows = result.recordset || [];
    if (!rows.length) {
      return res.json({ success: true, message: 'Žádná data od 1.7.2025.' });
    }

    // Seskupení podle SalesId => 1 OP + 1 objednávka = více řádků (položky)
    const salesMap = {};
    for (const row of rows) {
      if (!salesMap[row.SalesId]) salesMap[row.SalesId] = [];
      salesMap[row.SalesId].push(row);
    }

    let createdBC = 0, updatedBC = 0, createdSO = 0, updatedSO = 0, skipped = 0;

    for (const salesId in salesMap) {
      try {
        const lines = salesMap[salesId];
        const { RegNum, ReceiptDateRequested, SalesStatusText } = lines[0];

        // validFrom / validTill = datum požadovaného dodání (necháváme na jeden den)
        const parsedDate = new Date(ReceiptDateRequested);
        const yyyy = parsedDate.getFullYear();
        const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(parsedDate.getDate()).padStart(2, '0');
        const validFrom = `${yyyy}-${mm}-${dd}`;
        const validTill = validFrom;

        // 1) Společnost podle IČ/RegNum
        let company = await findCompanyByRegNumber(RegNum);
        if (!company) company = await createCompanyByRegNumber(RegNum);
        if (!company || !company.id) {
          console.warn(`[${salesId}] Společnost pro RegNum ${RegNum} se nepodařilo najít/vytvořit – přeskočeno.`);
          skipped++; 
          continue;
        }
        const companyId = company.id;

        // 2) Stav OP/objednávky podle plnění a SalesStatusText
        let allDelivered = true, anyDelivered = false;
        for (const line of lines) {
          const del = parseFloat(line.DeliveredQty) || 0;
          const ord = parseFloat(line.SalesQty) || 0;
          if (del > 0) anyDelivered = true;
          if (del < ord) allDelivered = false;
        }

        // UPRAV si ID podle číselníků ve tvém Raynetu:
        let businessCasePhase; // např. 1=Otevřeno, 2=Částečné, 5=Výhra, 7=Zrušeno, 8=Dodáno
        let salesOrderStatus;  // např. 1=Otevřená, 3=Částečně, 4=Dodáno, 5=Uzavřeno, 7=Zrušeno

        if (SalesStatusText === 'Fakturováno') {
          businessCasePhase = 5;
          salesOrderStatus = 5;
        } else if (SalesStatusText === 'Zrušeno') {
          businessCasePhase = 7;
          salesOrderStatus = 7;
        } else if (allDelivered) {
          businessCasePhase = 8;
          salesOrderStatus  = 4;
        } else if (anyDelivered) {
          businessCasePhase = 2;
          salesOrderStatus  = 3;
        } else {
          businessCasePhase = 1;
          salesOrderStatus  = 1;
        }

        // 3) OBCHODNÍ PŘÍPAD (vyhledat přes name+company, code neposílat)
        let businessCase = await findBusinessCaseByNameAndCompany(salesId, companyId);
        const bcData = {
          name: salesId,                    // name = SalesId
          company: companyId,
          description: 'Import z MSSQL AX data',
          validFrom,
          validTill,
          businessCasePhase                // code NEPOSÍLÁME -> vygeneruje Raynet sám
        };

        let businessCaseId;
        if (!businessCase) {
          const created = await createBusinessCase(bcData);
          businessCaseId = created.id;
          createdBC++;
          console.log(`[BC] Vytvořen: ${salesId} -> ID ${businessCaseId}`);
        } else {
          businessCaseId = businessCase.id;
          await updateBusinessCase(businessCaseId, bcData);
          updatedBC++;
          console.log(`[BC] Aktualizován: ${salesId} -> ID ${businessCaseId}`);
        }

        // Reset položek OP a znovu vložit z DeliveredQty
        await deleteAllItemsFromBusinessCase(businessCaseId);
        for (const line of lines) {
          const price = parseFloat(line.SalesPrice) || 0;
          const discountPercent = parseFloat(line.LinePercent) || 0;
          const effectivePrice = price * (1 - discountPercent / 100);
          await addItemToBusinessCaseRaynet(businessCaseId, {
            productCode: line.ItemId,
            count: parseFloat(line.DeliveredQty) || 0,
            price: effectivePrice,
            discountPercent,
            taxRate: 21,
            name: line.ItemName,
            description: line.PurchLineDisc || ''
          });
        }

        // 4) OBJEDNÁVKA (vyhledat přes name+company, code neposílat)
        let salesOrder = await findSalesOrderByNameAndCompany(salesId, companyId);

        // totalAmount (chceš-li přesněji, zohledni slevu)
        const totalAmount = lines.reduce((sum, l) => {
          const p  = parseFloat(l.SalesPrice)   || 0;
          const dp = parseFloat(l.LinePercent)  || 0;
          const q  = parseFloat(l.SalesQty)     || 0;
          const eff = p * (1 - dp/100);
          return sum + eff * q;
        }, 0);

        const soData = {
          name: salesId,               // name = SalesId
          company: companyId,
          businessCase: businessCaseId,
          totalAmount,
          description: `Objednávka vytvořena z AX. SalesId: ${salesId}`,
          validFrom,
          validTill,
          requestDeliveryDate: validTill,
          salesOrderStatus              // code NEPOSÍLÁME
        };

        let salesOrderId;
        if (!salesOrder) {
          const created = await createSalesOrder(soData);
          salesOrderId = created.id;
          createdSO++;
          console.log(`[SO] Vytvořena: ${salesId} -> ID ${salesOrderId}`);
        } else {
          salesOrderId = salesOrder.id;
          await updateSalesOrder(salesOrderId, soData);
          updatedSO++;
          console.log(`[SO] Aktualizována: ${salesId} -> ID ${salesOrderId}`);
        }

        // Reset položek objednávky a vložit z SalesQty
        await deleteAllItemsFromSalesOrder(salesOrderId);
        for (const line of lines) {
          const price = parseFloat(line.SalesPrice) || 0;
          const discountPercent = parseFloat(line.LinePercent) || 0;
          const effectivePrice = price * (1 - discountPercent / 100);
          await addItemToSalesOrder(salesOrderId, {
            productCode: line.ItemId,
            count: parseFloat(line.SalesQty) || 0,
            price: effectivePrice,
            discountPercent,
            taxRate: 21,
            name: line.ItemName,
            description: line.PurchLineDisc || ''
          });
        }

      } catch (e) {
        skipped++;
        console.error(`Chyba při zpracování SalesId ${salesId}:`, e.response?.data || e.message);
      }
    }

    const msg = `Hotovo. BC nové:${createdBC}, BC upd:${updatedBC}, SO nové:${createdSO}, SO upd:${updatedSO}, přeskočeno:${skipped}`;
    console.log(msg);
    res.json({ success: true, message: msg });

  } catch (err) {
    console.error('Chyba endpointu:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});




app.get('/get-tav-order-details/:id', async (req, res) => {
  /* 0) validace & převod ID */
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, error: 'Neplatné ID objednávky.' });
  }

  /* 1) HLAVIČKA objednávky */
  const headerSql = `
    SELECT
        o.id_order                         AS OrderID,
        o.reference                        AS Number,
        o.payment                          AS PaymentType,
        CONCAT(c.firstname,' ',c.lastname) AS CustomerName,
        c.siret                            AS CustomerRegNo,
        a.address1                         AS CustomerStreet,
        a.city                             AS CustomerCity,
        a.postcode                         AS CustomerZip,
        o.total_paid_tax_incl              AS TotalPrice,
        cur.iso_code                       AS Currency,
        osl.name                           AS Status,
        o.date_add                         AS DateOfImport
    FROM ps_orders o
    JOIN ps_customer          c ON c.id_customer    = o.id_customer
    JOIN ps_address           a ON a.id_address     = o.id_address_invoice
    JOIN ps_currency          cur ON cur.id_currency = o.id_currency
    JOIN ps_order_history     oh ON oh.id_order      = o.id_order
         AND oh.id_order_history = (
              SELECT oh2.id_order_history
              FROM   ps_order_history oh2
              WHERE  oh2.id_order = o.id_order
              ORDER BY oh2.date_add DESC
              LIMIT 1
         )
    JOIN ps_order_state_lang  osl ON osl.id_order_state = oh.id_order_state
                                   AND osl.id_lang       = o.id_lang
    WHERE o.id_order = ?;          -- ⬅️  poziční placeholder
  `;

  /* 2) POLOŽKY objednávky */
  const itemsSql = `
    SELECT
        od.id_order_detail      AS ID,
        od.product_reference    AS PartNo,
        od.product_ean13        AS EAN,
        od.product_name         AS Description,
        od.unit_price_tax_incl  AS UnitPrice,
        od.total_price_tax_incl AS TotalPrice
    FROM ps_order_detail od
    WHERE od.id_order = ?;       -- ⬅️  stejný placeholder
  `;

  try {
    /* spustíme dotazy paralelně */
    const [headerRows, itemsRows] = await Promise.all([
      poolC5tavinox.query(headerSql, [orderId]),
      poolC5tavinox.query(itemsSql,  [orderId])
    ]);

    if (headerRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Objednávka nenalezena.' });
    }

    res.json({
      orderDetails: headerRows[0],   // první (jediný) řádek hlavičky
      orderItems  : itemsRows        // všechny položky
    });
  } catch (err) {
    console.error('Chyba SQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.get('/get-pt-order-details/:id', async (req, res) => {
  /* 0) validace & převod ID */
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, error: 'Neplatné ID objednávky.' });
  }

  /* 1) HLAVIČKA objednávky */
  const headerSql = `
    SELECT
        o.id_order                         AS OrderID,
        o.reference                        AS Number,
        o.payment                          AS PaymentType,
        CONCAT(c.firstname,' ',c.lastname) AS CustomerName,
        c.siret                            AS CustomerRegNo,
        a.address1                         AS CustomerStreet,
        a.city                             AS CustomerCity,
        a.postcode                         AS CustomerZip,
        o.total_paid_tax_incl              AS TotalPrice,
        cur.iso_code                       AS Currency,
        osl.name                           AS Status,
        o.date_add                         AS DateOfImport
    FROM ps_orders o
    JOIN ps_customer          c ON c.id_customer    = o.id_customer
    JOIN ps_address           a ON a.id_address     = o.id_address_invoice
    JOIN ps_currency          cur ON cur.id_currency = o.id_currency
    JOIN ps_order_history     oh ON oh.id_order      = o.id_order
         AND oh.id_order_history = (
              SELECT oh2.id_order_history
              FROM   ps_order_history oh2
              WHERE  oh2.id_order = o.id_order
              ORDER BY oh2.date_add DESC
              LIMIT 1
         )
    JOIN ps_order_state_lang  osl ON osl.id_order_state = oh.id_order_state
                                   AND osl.id_lang       = o.id_lang
    WHERE o.id_order = ?;          -- ⬅️  poziční placeholder
  `;

  /* 2) POLOŽKY objednávky */
  const itemsSql = `
    SELECT
        od.id_order_detail      AS ID,
        od.product_reference    AS PartNo,
        od.product_ean13        AS EAN,
        od.product_name         AS Description,
        od.unit_price_tax_incl  AS UnitPrice,
        od.total_price_tax_incl AS TotalPrice
    FROM ps_order_detail od
    WHERE od.id_order = ?;       -- ⬅️  stejný placeholder
  `;

  try {
    /* spustíme dotazy paralelně */
    const [headerRows, itemsRows] = await Promise.all([
      poolC5pneutyres.query(headerSql, [orderId]),
      poolC5pneutyres.query(itemsSql,  [orderId])
    ]);

    if (headerRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Objednávka nenalezena.' });
    }

    res.json({
      orderDetails: headerRows[0],   // první (jediný) řádek hlavičky
      orderItems  : itemsRows        // všechny položky
    });
  } catch (err) {
    console.error('Chyba SQL:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /get-pt-orders – přehled objednávek z PrestaShop DB
app.get('/get-pt-orders', async (req, res) => {
  try {
    const {
      Number, PaymentType, CustomerName, Status,  // filtry z URL ?Number=...
      page = 1, limit = 100                       // jednoduchá stránkování
    } = req.query;

    const offset = (page - 1) * limit;

    const sql = `
      SELECT
    o.id_order                                                       AS OrderID,          -- interní ID (klíč v Reactu)
    o.reference                                                      AS Number,           -- číslo / reference objednávky
    o.payment                                                        AS PaymentType,      -- způsob platby
    CONCAT(c.firstname, ' ', c.lastname)                             AS CustomerName,     -- jméno zákazníka
    o.total_paid_tax_incl                                            AS TotalPrice,       -- celkem s DPH
    cur.iso_code                                                     AS Currency,         -- ISO kód měny
    osl.name                                                         AS Status,           -- aktuální stav
    o.date_add                                                       AS DateOfImport      -- datum vytvoření
FROM          ps_orders o
INNER JOIN    ps_customer            c   ON c.id_customer      = o.id_customer
INNER JOIN    ps_currency            cur ON cur.id_currency    = o.id_currency
INNER JOIN    ps_order_history       oh  ON oh.id_order        = o.id_order
             AND oh.id_order_history = (
                   SELECT oh2.id_order_history                    -- poslední záznam = aktuální stav
                   FROM   ps_order_history oh2
                   WHERE  oh2.id_order = o.id_order
                   ORDER BY oh2.date_add DESC
                   LIMIT 1
             )
INNER JOIN    ps_order_state_lang   osl ON osl.id_order_state  = oh.id_order_state
                                         
ORDER BY      o.date_add DESC
;
    `;

    const rows = await poolC5pneutyres.query(sql, {
      Number, PaymentType, CustomerName, Status, limit: +limit, offset
    });

    res.json(rows);            // React čeká přímo pole objektů
  } catch (err) {
    console.error('Chyba při načítání objednávek:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /get-pt-orders – přehled objednávek z PrestaShop DB
app.get('/get-tav-orders', async (req, res) => {
  try {
    const {
      Number, PaymentType, CustomerName, Status,  // filtry z URL ?Number=...
      page = 1, limit = 100                       // jednoduchá stránkování
    } = req.query;

    const offset = (page - 1) * limit;

    const sql = `
      SELECT
    o.id_order                                                       AS OrderID,          -- interní ID (klíč v Reactu)
    o.reference                                                      AS Number,           -- číslo / reference objednávky
    o.payment                                                        AS PaymentType,      -- způsob platby
    CONCAT(c.firstname, ' ', c.lastname)                             AS CustomerName,     -- jméno zákazníka
    o.total_paid_tax_incl                                            AS TotalPrice,       -- celkem s DPH
    cur.iso_code                                                     AS Currency,         -- ISO kód měny
    osl.name                                                         AS Status,           -- aktuální stav
    o.date_add                                                       AS DateOfImport      -- datum vytvoření
FROM          ps_orders o
INNER JOIN    ps_customer            c   ON c.id_customer      = o.id_customer
INNER JOIN    ps_currency            cur ON cur.id_currency    = o.id_currency
INNER JOIN    ps_order_history       oh  ON oh.id_order        = o.id_order
             AND oh.id_order_history = (
                   SELECT oh2.id_order_history                    -- poslední záznam = aktuální stav
                   FROM   ps_order_history oh2
                   WHERE  oh2.id_order = o.id_order
                   ORDER BY oh2.date_add DESC
                   LIMIT 1
             )
INNER JOIN    ps_order_state_lang   osl ON osl.id_order_state  = oh.id_order_state
                                         
ORDER BY      o.date_add DESC
;
    `;

    const rows = await poolC5tavinox.query(sql, {
      Number, PaymentType, CustomerName, Status, limit: +limit, offset
    });

    res.json(rows);            // React čeká přímo pole objektů
  } catch (err) {
    console.error('Chyba při načítání objednávek:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});



// -----------------------------------------------------------------------------
//  ENDPOINT: /sync-stock-tavinox   –   aktualizuje skladové stavy kombinací
// -----------------------------------------------------------------------------
app.get('/sync-stock-tavinox', async (req, res) => {
  try {
    console.log('\n=== /sync-stock-tavinox START ===');

    const prestaApiKey = process.env.PRESTASHOP_API_KEY;
    const prestaApiUrl = process.env.PRESTASHOP_API_URL;
    const parser = new xml2js.Parser({ explicitArray: false });

    const combos = [];
    const step = 500;
    for (let i = 0; ; i += step) {
      const url = `${prestaApiUrl}/combinations?display=[id,id_product,reference]&limit=${i},${step}`;
      const xml = await axios.get(url, {
        auth: { username: prestaApiKey, password: '' },
        headers: { 'Content-Type': 'text/xml' }
      });
      const json = await parser.parseStringPromise(xml.data);
      let list = json?.prestashop?.combinations?.combination;
      if (!list) break;
      if (!Array.isArray(list)) list = [list];

      combos.push(
        ...list.map(c => ({
          idComb: c.id,
          productId: typeof c.id_product === 'object' ? c.id_product._ : c.id_product,
          reference: c.reference?.trim() || ''
        }))
      );
      if (list.length < step) break;
    }
    console.log(`✓ Načteno ${combos.length} kombinací z PrestaShopu`);

    await sql.connect(mssqlConfig);

    const mssqlSql = `
      SELECT SUM(s.PhysicalInvent - s.ReservPhysical) AS qty
      FROM [AxProdCS].[dbo].[ItsIFInventTable] t
      JOIN [AxProdCS].[dbo].[ItsIFInventSum] s ON s.ItemId = t.ItemId
      WHERE t.ItsItemName2 = @ref
      GROUP BY t.ItsItemName2
    `;

    let updated = 0;
    const errors = [];

    for (const { idComb, productId, reference } of combos) {
      if (!reference) continue;

      const qtyRes = await new sql.Request()
        .input('ref', sql.VarChar, reference)
        .query(mssqlSql);

      const qty = Number(qtyRes.recordset[0]?.qty || 0);
      console.log(`► ${reference} → qty=${qty}`);

      let stockId;
      try {
        const stockXml = await axios.get(
          `${prestaApiUrl}/stock_availables?filter[id_product_attribute]=[${idComb}]&display=[id]`,
          { auth: { username: prestaApiKey, password: '' }, headers: { 'Content-Type': 'text/xml' } }
        );
        const stockJson = await parser.parseStringPromise(stockXml.data);
        stockId = stockJson?.prestashop?.stock_availables?.stock_available?.id;
        if (!stockId) {
          console.warn(`   ✗ stock_available nenalezen (${reference})`);
          continue;
        }
      } catch (e) {
        console.warn(`   ✗ stock_available GET error (${reference}):`, e.message);
        errors.push({ reference, err: e.message });
        continue;
      }

      try {
        const currentXml = await axios.get(
          `${prestaApiUrl}/stock_availables/${stockId}`,
          { auth: { username: prestaApiKey, password: '' }, headers: { 'Content-Type': 'text/xml' } }
        );
        const currentJson = await parser.parseStringPromise(currentXml.data);
        const node = currentJson.prestashop.stock_available;
        const oldQty = node.quantity;

        node.id = stockId;
        node.quantity = qty.toString();

       const builder = new xml2js.Builder({
  cdata: true,
  headless: true,
  rootName: 'prestashop',
  xmldec: { version: '1.0', encoding: 'UTF-8' },
  renderOpts: { pretty: false }
});

const newObj = {
  $: { 'xmlns:xlink': 'http://www.w3.org/1999/xlink' },
  stock_available: node
};

const newXml = builder.buildObject(newObj);

        console.log(`\n--- XML PAYLOAD pro stockId=${stockId}, reference=${reference} ---\n${newXml}\n---------------------------------\n`);

        await axios.put(
          `${prestaApiUrl}/stock_availables/${stockId}`,
          newXml,
          { auth: { username: prestaApiKey, password: '' }, headers: { 'Content-Type': 'text/xml' } }
        );

        console.log(`   • stock ${stockId}  ${oldQty} → ${qty}`);
        updated++;
      } catch (e) {
        console.error(`   ✗ stock PUT error (${reference}):`, e.message);
        if (e.response?.data) console.error('     ↳ API:', e.response.data);
        errors.push({ reference, err: e.message });
      }
    } // <-- konec smyčky FOR

    console.log(`\n=== HOTOVO – aktualizováno ${updated} kombinací, errors=${errors.length} ===`);
    res.json({ success: true, updated, errors });

  } catch (err) {
    console.error('✗ fatal:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}); 




// GET /create-specific-prices-tavinox
app.get('/create-specific-prices-tavinox', async (req, res) => {
  try {
    console.log('\n=== /create-specific-prices-tavinox START ===');

    /* ------------------------------------------------------------------ */
    /* 1) PrestaShop – stáhneme všechny kombinace                        */
    /* ------------------------------------------------------------------ */
    const prestaApiKey = process.env.PRESTASHOP_API_KEY;
    const prestaApiUrl = process.env.PRESTASHOP_API_URL;
    const parser       = new xml2js.Parser({ explicitArray: false });

    const combos = [];            // { id, productId, reference }
    const step   = 500;
    for (let idx = 0; ; idx += step) {
      const url = `${prestaApiUrl}/combinations?display=[id,id_product,reference]&limit=${idx},${step}`;
      const xml = await axios.get(url, {
        auth: { username: prestaApiKey, password: '' },
        headers: { 'Content-Type': 'text/xml' }
      });
      const json = await parser.parseStringPromise(xml.data);
      let list   = json?.prestashop?.combinations?.combination;
      if (!list) break;
      if (!Array.isArray(list)) list = [list];

      combos.push(
        ...list.map(c => ({
          id: c.id,
          productId: typeof c.id_product === 'object' ? c.id_product._ : c.id_product,
          reference: c.reference?.trim() || ''
        }))
      );
      if (list.length < step) break;
    }

    console.log(`✓ Přijaté reference (${combos.length}):`);
    console.log(Array.from(new Set(combos.map(c => c.reference))).join(', '));

    /* ------------------------------------------------------------------ */
    /* 2) MSSQL (cenová skupina) + MySQL (procenta slev)                  */
    /* ------------------------------------------------------------------ */
    await sql.connect(mssqlConfig);
    console.log('✓ MSSQL připojeno');

    const groupMap = { '1_eshop': 4, '3_servis': 5, '4_vo': 6, '5_vip': 7, '6_indiv': 8,'Meta-Gas': 9, 'Arseco': 10 };

    const basicSQL = `
      SELECT
        ROUND(\`1_eshop\`) AS \`1_eshop\`,
        ROUND(\`3_servis\`) AS \`3_servis\`,
        ROUND(\`4_vo\`) AS \`4_vo\`,
        ROUND(\`5_vip\`) AS \`5_vip\`,
        ROUND(\`6_indiv\`) AS \`6_indiv\`,
        ROUND(\`Meta-Gas\`) AS \`Meta-Gas\`,
        ROUND(\`Arseco\`) AS \`Arseco\`
      FROM IMPORT_CZS_Tavinox_zakladni_slevy
      WHERE cenove_skupiny = ?
      LIMIT 1
    `;

    const pad = n => (n < 10 ? '0' + n : n);
    const formatDate = d =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const from = formatDate(new Date(Date.now() - 86_400_000)); // včerejšek
    const to   = '0000-00-00 00:00:00';

    let created = 0;
    const errors = [];

    /* ------------------------------------------------------------------ */
    /* 3) Smyčka přes KAŽDOU kombinaci                                    */
    /* ------------------------------------------------------------------ */
    for (const { id: idComb, productId, reference } of combos) {
      if (!reference) continue;

      /* 3.A  – zjisti cenovou skupinu z MSSQL (ItsItemName2) */
      const groupRes = await new sql.Request()
        .input('ref', sql.VarChar, reference)
        .query(`
          SELECT TOP 1 [PurchLineDisc] AS priceGroup
          FROM [AxProdCS].[dbo].[ItsIFInventTable]
          WHERE [ItsItemName2] = @ref
        `);

      const priceGroup = groupRes.recordset[0]?.priceGroup?.trim();
      console.log(`► ${reference} | priceGroup "${priceGroup || 'N/A'}"`);
      if (!priceGroup) continue;

      /* 3.B  – načti procenta slev z MySQL */
      const [row] = await query(poolC5pneutyres, basicSQL, [priceGroup]);
      if (!row) { console.warn('   ✗ žádná sleva'); continue; }

      const discounts = {};
      for (const g of Object.keys(groupMap)) {
        const v = Number(row[g]);
        if (!isNaN(v) && v) discounts[g] = v;
      }
      if (!Object.keys(discounts).length) continue;

      /* 3.C  – smaž EXISTUJÍCÍ specifické ceny pro kombinaci */
      try {
        const oldXML  = await axios.get(
          `${prestaApiUrl}/specific_prices?filter[id_product_attribute]=[${idComb}]`,
          { auth: { username: prestaApiKey, password: '' }, headers: { 'Content-Type': 'text/xml' } }
        );
        const oldJSON = await parser.parseStringPromise(oldXML.data);
        let items = oldJSON?.prestashop?.specific_prices?.specific_price;
        if (items) {
          if (!Array.isArray(items)) items = [items];
          for (const s of items)
            await axios.delete(`${prestaApiUrl}/specific_prices/${s.$.id}`, {
              auth: { username: prestaApiKey, password: '' }, headers: { 'Content-Type': 'text/xml' }
            });
        }
      } catch (delErr) {
        console.warn('   ✗ problém při mazání SP:', delErr.message);
      }

      /* 3.D  – vytvoř nové procentuální SP */
      for (const [grp, pct] of Object.entries(discounts)) {
        const reductionDec = (pct / 100).toFixed(2);

        const payload = `
<prestashop>
  <specific_price>
    <id_product>${productId}</id_product>
    <id_product_attribute>${idComb}</id_product_attribute>
    <id_shop>1</id_shop>
    <id_shop_group>0</id_shop_group>
    <id_cart>0</id_cart>
    <id_currency>0</id_currency>
    <id_country>0</id_country>
    <id_group>${groupMap[grp]}</id_group>
    <id_customer>0</id_customer>
    <id_specific_price_rule>0</id_specific_price_rule>
    <price>-1</price>
    <from_quantity>1</from_quantity>
    <reduction>${reductionDec}</reduction>
    <reduction_type>percentage</reduction_type>
    <reduction_tax>0</reduction_tax>
    <from>${from}</from>
    <to>${to}</to>
  </specific_price>
</prestashop>`.trim();

        console.debug(`   • POST SP ${reference} – group=${grp}, -${pct}%`);

        try {
          await axios.post(`${prestaApiUrl}/specific_prices`, payload, {
            auth: { username: prestaApiKey, password: '' },
            headers: { 'Content-Type': 'text/xml' }
          });
          created++;
        } catch (e) {
          console.error('   ✗ create error:', e.message);
          if (e.response?.data) console.error('   ↳ API response:', e.response.data);
          errors.push({ reference, group: grp, api: e.message });
        }
      }
    }

    console.log(`\n=== HOTOVO – vytvořeno ${created} SP, errors=${errors.length} ===`);
    res.json({ success: true, created, errors });

  } catch (err) {
    console.error('✗ fatal:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/import-b2b-ftp', async (req, res) => {
  const FILES = [
    { name: 'Export/BlockedProducts_CzechStyle.csv',    type: 'blocked' },
    { name: 'Export/InvalidPriceStatistics_CzechStyle.csv', type: 'invalid_price' },
    { name: 'Export/PairedProducts_CzechStyle.csv',      type: 'paired' },
    { name: 'Export/PriceStatistics_CzechStyle.csv',     type: 'price_statistics' },
    { name: 'Export/SummaryProducts_CzechStyle.csv',      type: 'summary' },
    { name: 'Export/UnPairedProducts_CzechStyle.csv',     type: 'unpaired' }
  ];

  const ftp = require('basic-ftp');
  const csv = require('csv-parser');
  const fs = require('fs');
  const path = require('path');
  // poolC5pneutyres již definováno ve vrchní části server.js

  const FTP_B2B_CONFIG = {
    host: pneuB2bFtpHost,
    user: pneuB2bLogin,
    password: pneuB2bPassword,
    secure: false
  };

  const client = new ftp.Client();
  const results = [];
  const tmpDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

  try {
    await client.access(FTP_B2B_CONFIG);

    for (const file of FILES) {
      const remotePath = file.name;
      const filename   = path.basename(remotePath);
      const localPath  = path.join(tmpDir, filename);

      // 1. Stáhni soubor z FTP
      try {
        await client.downloadTo(localPath, remotePath);
      } catch (e) {
        results.push({ file: remotePath, type: file.type, success: false, error: 'Soubor nestáhnut: ' + e.message });
        continue;
      }

      // 2. Vlož dávku do hlavičky
      let batchId;
      try {
        const insertResult = await poolC5pneutyres.query(
          `INSERT INTO IMPORT_CZS_B2B_ProductImportBatch
             (type, filename, downloaded_at, row_count, status)
           VALUES (?, ?, NOW(), ?, ?)`,
          [file.type, filename, 0, 'processing']
        );
        batchId = insertResult.insertId;
      } catch (err) {
        results.push({ file: remotePath, type: file.type, success: false, error: 'Nelze vložit dávku: ' + err.message });
        continue;
      }

      // 3. Připrav import_file_data a řádky
      let rowCount = 0;
      const rows = [];

      if (file.type === 'summary') {
        // Pro summary soubor zapíšeme celý řetězec včetně oddělovače
        const content = fs.readFileSync(localPath, 'utf8').trim();
        rows.push([
          batchId,                  // batch_id
          file.type,                // type
          null, /*product_id*/      // ostatní sloupce prázdné
          null, /*part_no*/
          null, /*ean*/
          null, /*display_name*/
          null, /*manufacturer*/
          null, /*code_internal1*/
          null, /*code_internal2*/
          null, /*supplier_price*/
          null, /*best_price*/
          null, /*worst_price*/
          null, /*price_diff_best*/
          null, /*price_diff_worst*/
          null, /*price_position*/
          null, /*currency_code*/
          null, /*stock_amount*/
          content                   // import_file_data
        ]);
        rowCount = 1;
      } else {
        // Standardní parsování CSV
        await new Promise((resolve, reject) => {
          fs.createReadStream(localPath)
            .pipe(csv({ separator: ';' }))
            .on('data', row => {
              // zachováme původní export_file_data, pokud existuje
              const raw = row['ImportFileData'] || null;
              rows.push([
                batchId, file.type,
                row['Product ID'] || null,
                row['PartNo']       || null,
                row['EAN']          || null,
                row['Display Name'] || null,
                row['Manufacturer'] || null,
                row['CodeInternal1']|| null,
                row['CodeInternal2']|| null,
                row["Supplier's Price"] || null,
                row['Best Price']       || null,
                row['Worst Price']      || null,
                row['Price Difference Best[%]']  || null,
                row['Price Difference Worst[%]'] || null,
                row['Price Position']   || null,
                row['Currency Code']    || null,
                row['StockAmount']      || null,
                raw                     // import_file_data
              ]);
              rowCount++;
            })
            .on('end', resolve)
            .on('error', reject);
        });
      }

      // 4. Bulk insert řádků
      if (rows.length) {
        try {
          await poolC5pneutyres.query(
            `INSERT INTO IMPORT_CZS_B2B_ProductImportRow (
               batch_id, type, product_id, part_no, ean, display_name,
               manufacturer, code_internal1, code_internal2,
               supplier_price, best_price, worst_price,
               price_diff_best, price_diff_worst, price_position,
               currency_code, stock_amount, import_file_data
             ) VALUES ?`,
            [rows]
          );
        } catch (err) {
          results.push({ file: remotePath, type: file.type, success: false, error: 'Nelze vložit řádky: ' + err.message });
          continue;
        }
      }

      // 5. Update počtu řádků a stav dávky
      try {
        await poolC5pneutyres.query(
          `UPDATE IMPORT_CZS_B2B_ProductImportBatch
             SET row_count = ?, status = ?
           WHERE batch_id = ?`,
          [rowCount, 'done', batchId]
        );
      } catch (err) {
        results.push({ file: remotePath, type: file.type, success: false, error: 'Nelze aktualizovat dávku: ' + err.message });
        continue;
      }

      results.push({ file: remotePath, type: file.type, success: true, rowCount });
      fs.unlinkSync(localPath);
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.close();
  }
});


// GET /import-b2b-batches-latest – nejnovější dávka každého typu
app.get('/import-b2b-batches', async (req, res) => {
  try {
    const sql = `
      SELECT b.*
      FROM IMPORT_CZS_B2B_ProductImportBatch AS b
      INNER JOIN (
        SELECT
          type,
          MAX(downloaded_at) AS max_date
        FROM IMPORT_CZS_B2B_ProductImportBatch
        GROUP BY type
      ) AS recent
        ON b.type = recent.type
       AND b.downloaded_at = recent.max_date
      ORDER BY b.type;
    `;

    const batches = await poolC5pneutyres.query(sql);
    res.json({ success: true, batches });
  } catch (err) {
    console.error('Chyba při načítání nejnovějších batchů:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /import-b2b-batch-details?batch_id=123
app.get('/import-b2b-batch-details', async (req, res) => {
  const { batch_id } = req.query;
  if (!batch_id) {
    return res
      .status(400)
      .json({ success: false, error: 'Chybí parametr batch_id' });
  }

  try {
    // Ověření existence dávky
    const batches = await poolC5pneutyres.query(
      `SELECT batch_id
         FROM IMPORT_CZS_B2B_ProductImportBatch
        WHERE batch_id = ?
        LIMIT 1`,
      [batch_id]
    );

    if (batches.length === 0) {
      return res.json({ success: true, rows: [] });
    }

    // Načtení řádků s levým spojením na ceník pro získání Nazev
    const rows = await poolC5pneutyres.query(
      `SELECT 
         COALESCE(r.display_name, c.Nazev) AS display_name,
         c.Nazev        AS nazev,
         r.part_no      AS part_no,
         r.ean          AS ean
       FROM IMPORT_CZS_B2B_ProductImportRow AS r
       LEFT JOIN IMPORT_CZS_Ceny_B2B AS c
         ON c.C_Polozky = r.part_no
       WHERE r.batch_id = ?
       ORDER BY r.part_no`,
      [batch_id]
    );

    return res.json({ success: true, rows });
  } catch (err) {
    console.error('Chyba při načítání detailů batch:', err);
    return res
      .status(500)
      .json({ success: false, error: err.message });
  }
});




app.all('/qrcode', (req, res) => {
  /* 1) vstupy ------------------------------------------------------ */
  let  data       = getParam(req, 'data', null);
  let  segments   = Array.isArray(req.body.segments) ? req.body.segments : null;
  const compress  = req.body.compress === true;

  const format  = (getParam(req,'type','png')).toLowerCase();   // png|svg|jpg
  const version = parseInt(getParam(req,'version','0'),10) || 0;
  const ecc     = (getParam(req,'ecc','Q')).toLowerCase();      // l|m|q|h
  const border  = parseInt(getParam(req,'margin','4'),10);
  const scale   = parseInt(getParam(req,'scale','1'),10);

  /* Debug: vstupní JSON / query ----------------------------------- */
  console.log('--- QR‑DEBUG: REQUEST --------------------------------');
  console.log('raw data   :', data);
  console.log('segments[] :', segments);
  console.log('compress   :', compress, '| version:', version, 'ecc:', ecc.toUpperCase());
  console.log('------------------------------------------------------');

  if (!data && !segments) {
    return res.status(400).json({ error: 'Chybí parametr data nebo segments.' });
  }

  /* 2) Komprese, pokud zapnuta ------------------------------------ */
  if (compress && data) {
    const token = compressGS1DigitalLink(data);
    data = `${process.env.BASE_URL}/${token}`;
    console.log('QR‑DEBUG: compressed →', data);
  }

  /* 3) Automatická segmentace URL ".../01/<digits>" --------------- */
  if (!segments && data) {
    const m = data.match(/^(.*\/01\/)(\d+)$/i);
    if (m) {
      const prefix  = m[1].toUpperCase();
      const numeric = m[2];
      segments = [
        { mode: 'alphanumeric', data: prefix },
        { mode: 'numeric',      data: numeric }
      ];
      console.log('QR‑DEBUG: auto‑segmented →', segments);
    }
  }

  /* 4) dataArgs pro Python skript ---------------------------------- */
  const dataArgs = segments
    ? segments.map(s =>
        s.mode === 'alphanumeric'
          ? String(s.data).toUpperCase()
          : String(s.data)
      )
    : [ String(data) ];

  console.log('QR‑DEBUG: dataArgs →', dataArgs);

  /* 5) Funkce runSegno -------------------------------------------- */
  const script = path.resolve(__dirname, 'scripts', 'gen_qr.py');
  function runSegno(verToUse) {
    const args = [
      script,
      ...dataArgs,
      '--format', format,
      '--error',  ecc,
      '--version', String(verToUse),
      '--border', String(border)
    ];
    if (format !== 'svg') args.push('--scale', String(scale));

    console.log('QR‑DEBUG: segno args:', args.join(' '));

    for (const py of ['python', 'py']) {
      const proc = spawnSync(py, args, { encoding:'buffer' });
      if (!(proc.error && proc.error.code === 'ENOENT')) return proc;
    }
    return { error:{ code:'NO_PYTHON', message:'Python not found'} };
  }

  /* 6) Pokus o generování ----------------------------------------- */
  let ver = segments && segments.length === 2 ? 3 : Math.max(version, 4);
  let proc = runSegno(ver);

  /* 7) Kapacita nestačí? Získám min. verzi z chyb. hlášky ---------- */
  if (!proc.error && proc.status !== 0) {
    const err = proc.stderr.toString();
    const m   = err.match(/minimum version required[^\d]*(\d+)/i);
    if (m) {
      ver  = parseInt(m[1],10);
      console.log(`QR‑DEBUG: zvýšení verze → ${ver}`);
      proc = runSegno(ver);
    }
  }

  /* 8) Chyby interpreteru / segna --------------------------------- */
  if (proc.error) {
    console.error('Python error:', proc.error);
    return res.status(500).json({ error: proc.error.message });
  }
  if (proc.status !== 0) {
    console.error('Segno error:\n', proc.stderr.toString());
    return res.status(500).json({ error: proc.stderr.toString() });
  }

  /* 9) Info o skutečné verzi -------------------------------------- */
  if (!version || ver !== version) {
    res.set('X-Minimum-Version', String(ver));
    console.log(`QR‑DEBUG: skutečná verze → ${ver}`);
  }

  /* 10) Odeslání výsledku ----------------------------------------- */
  const out = proc.stdout;
  console.log(`QR‑DEBUG: output bytes ${out.length}`);
  console.log('------------------------------------------------------\n');

  if (format === 'svg')
    return res.type('image/svg+xml').send(out);
  if (format === 'jpg' || format === 'jpeg')
    return res.type('image/jpeg').send(out);

  // default PNG
  res.type('image/png').send(out);
});



// POST endpoint pro import DL z XLS a uložení do DB
app.post('/import-packing-list', uploadMulter.single('file'), async (req, res) => {
  console.log('[IMPORT-PACKING] Endpoint triggered');
  if (!req.file) {
    console.error('[IMPORT-PACKING] No file in request');
    return res.status(400).json({ success: false, message: 'Chybí XLS soubor' });
  }

  const { dodaci_list } = req.body;
  console.log('[IMPORT-PACKING] Received dodaci_list:', dodaci_list);
  if (!dodaci_list) {
    console.error('[IMPORT-PACKING] Missing dodaci_list');
    return res.status(400).json({ success: false, message: 'Chybí dodaci_list' });
  }

  let conn;
  try {
    // 1) Připojení k DB
    conn = await new Promise((resolve, reject) =>
      poolC5sluzbyint.getConnection((err, c) => err ? reject(err) : resolve(c))
    );

    // 2) Upsert NP_Header dle dodaci_list
    console.log('[IMPORT-PACKING] Upsert NP_Header for', dodaci_list);
    const headerResult = await new Promise((resolve, reject) =>
      conn.query(
        `INSERT INTO NP_Header (dodaci_list, datum)
         VALUES (?, CURDATE())
         ON DUPLICATE KEY UPDATE
           datum = VALUES(datum),
           id = LAST_INSERT_ID(id)`,
        [dodaci_list],
        (err, result) => err ? reject(err) : resolve(result)
      )
    );
    const headerId = headerResult.insertId;
    console.log('[IMPORT-PACKING] Header upsert ID:', headerId);

    // 3) Načtení XLS a výběr prvního listu
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    console.log('[IMPORT-PACKING] Parsing sheet:', sheetName);

    // 4) Zjištění rozsahu a merge buněk
    const ref = ws['!ref'];
    const rangeInfo = xlsx.utils.decode_range(ref);
    const merges = ws['!merges'] || [];

    // 5) Najdi řádek s hlavičkou (kde je "Item No.")
    let headerRow = rangeInfo.s.r;
    for (let r = rangeInfo.s.r; r <= rangeInfo.s.r + 10; r++) {
      const cell = xlsx.utils.encode_cell({ r, c: rangeInfo.s.c });
      if (ws[cell]?.v === 'Item No.') { headerRow = r; break; }
    }
    console.log('[IMPORT-PACKING] Header row index:', headerRow);

    // 6) Načti a vyčisti názvy sloupců
    const headers = [];
    for (let c = rangeInfo.s.c; c <= rangeInfo.e.c; c++) {
      const cellRef = xlsx.utils.encode_cell({ r: headerRow, c });
      const rawVal = ws[cellRef]?.v;
      let cleaned = rawVal ? rawVal.toString() : `UNKNOWN_${c}`;
      // Odstranění zalomení řádků, NBSP, více mezer, převod fullwidth závorek
      cleaned = cleaned
        .replace(/\r?\n/g, ' ')
        .replace(/\u00A0/g, ' ')
        .replace(/[（]/g, '(')
        .replace(/[）]/g, ')')
        .replace(/\s+/g, ' ')
        .trim();
      headers.push(cleaned);
    }
    console.log('[IMPORT-PACKING] Cleaned Columns:', headers);

    // 7) Propaguj merge hodnot pro klíčové sloupce (palety)
    ['Pallet No', 'PALLET Weight', 'Volume (cbm)'].forEach(colName => {
      const idx = headers.indexOf(colName);
      if (idx < 0) return;
      merges.filter(m => m.s.c <= idx && m.e.c >= idx).forEach(m => {
        const val = ws[xlsx.utils.encode_cell({ r: m.s.r, c: m.s.c })]?.v;
        for (let rr = m.s.r; rr <= m.e.r; rr++) {
          const cellRef = xlsx.utils.encode_cell({ r: rr, c: idx });
          ws[cellRef] = { t: 's', v: val };
        }
      });
    });

    // 8) Načti datové řádky pod hlavičkou
    let data = xlsx.utils.sheet_to_json(ws, {
      header: headers,
      range: headerRow + 1,
      defval: null,
      raw: false
    });
    console.log('[IMPORT-PACKING] Total rows before filter:', data.length);

    // 9) Filtrace: ignoruj prázdné a "TOTAL"
    data = data.filter(row => {
      const it = row['Item No.'];
      return it && it.toString().trim() && it.toString().toUpperCase() !== 'TOTAL';
    });
    console.log('[IMPORT-PACKING] Rows after filter:', data.length);

    // 10) Upsert palet (NP_Pallets) dle header_id + pallet_no
const palletsMap = {};
data.forEach(row => {
  const pn = row['Pallet No'];
  if (pn && !palletsMap[pn]) {
    const w = Number(row['PALLET Weight']) || 0;
    const v = Number(row['Volume (cbm)']) || 0;
    palletsMap[pn] = { pallet_no: pn, weight: w, volume: v };
  }
});
console.log('[IMPORT-PACKING] Unique pallets to upsert:', Object.keys(palletsMap).length);
for (const pn of Object.keys(palletsMap)) {
  const p = palletsMap[pn];
  const res2 = await new Promise((resolve, reject) =>
    conn.query(
      `INSERT INTO NP_Pallets (header_id, pallet_no, pallet_weight, volume_cbm)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         pallet_weight = VALUES(pallet_weight),
         volume_cbm = VALUES(volume_cbm),
         id = LAST_INSERT_ID(id)`,
      [headerId, p.pallet_no, p.weight, p.volume],
      (err, r2) => err ? reject(err) : resolve(r2)
    )
  );
  palletsMap[pn].id = res2.insertId;
  console.log('[IMPORT-PACKING] Pallet upserted:', pn, 'ID:', res2.insertId);
}

// 11) Upsert řádků (NP_Lines) dle header_id + pallet_id + item_number// 11) Upsert řádků (NP_Lines) dle header_id + pallet_id + item_number
const toNum = x => { const n = Number(x); return isNaN(n) ? 0 : n; };
const lines = data.map(row => [
  headerId,
  palletsMap[row['Pallet No']]?.id || null,
  row['Item No.'], row['Description'], row['Size'], row['Unit'],
  toNum(row['QTY (PCS)']), toNum(row['PCS/ CARTON']), toNum(row['CARTONS']),
  toNum(row['GW/CTN (Kg)']), toNum(row['Ttl GW (kg)']), toNum(row['Ttl NW (kg)'])
]);
console.log('[IMPORT-PACKING] Lines to upsert:', lines.length);
if (lines.length) {
  await new Promise((resolve, reject) =>
    conn.query(
      `INSERT INTO NP_Lines
         (header_id, pallet_id, item_number, popis, rozmer, jednotka,
          objednano, pcs_per_carton, carton_size,
          gross_weight_ctn_kg, total_gross_weight, total_net_weight)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         popis = VALUES(popis),
         rozmer = VALUES(rozmer),
         jednotka = VALUES(jednotka),
         objednano = VALUES(objednano),
         pcs_per_carton = VALUES(pcs_per_carton),
         carton_size = VALUES(carton_size),
         gross_weight_ctn_kg = VALUES(gross_weight_ctn_kg),
         total_gross_weight = VALUES(total_gross_weight),
         total_net_weight = VALUES(total_net_weight),
         id = LAST_INSERT_ID(id)`,
      [lines],
      err => err ? reject(err) : resolve()
    )
  );
  console.log('[IMPORT-PACKING] NP_Lines upserted');
}
  } catch (err) {
    console.error('[IMPORT-PACKING] ERROR caught:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn?.release();
    console.log('[IMPORT-PACKING] Connection released');
  }
});


// GET informace pro NP_detail
app.get('/np/list-expanded', async (req, res) => {
  let conn;

  try {
    // 1) Získáme připojení
    conn = await new Promise((resolve, reject) =>
      poolC5sluzbyint.getConnection((err, c) => (err ? reject(err) : resolve(c)))
    );

    // 2) Sestavíme SQL s JOINy a agregacemi
    //
    // - h = NP_Header
    // - p = NP_Pallets
    // - l = NP_Lines
    // 
    // Agregujeme COUNT(DISTINCT p.id) jako pallet_count,
    // COUNT(l.id) jako line_count,
    // SUM(l.objednano) jako total_ordered,
    // SUM(l.total_net_weight) jako total_net_weight
    //
    // Používáme LEFT JOIN, aby se vrátily i ty hlavičky, které dosud nemají palety či řádky.
    const sql = `
      SELECT
        h.id,
        h.np_number,
        h.dodaci_list,
        h.datum,
        h.supplier_name,
        h.supplier_address,
        COUNT(DISTINCT p.id)        AS pallet_count,
        COUNT(l.id)                 AS line_count,
        COALESCE(SUM(l.objednano), 0)        AS total_ordered,
        COALESCE(SUM(l.total_net_weight), 0) AS total_net_weight
      FROM NP_Header AS h
      LEFT JOIN NP_Pallets AS p ON p.header_id = h.id
      LEFT JOIN NP_Lines   AS l ON l.pallet_id  = p.id
      GROUP BY
        h.id,
        h.np_number,
        h.dodaci_list,
        h.datum,
        h.supplier_name,
        h.supplier_address
      ORDER BY h.datum DESC
    `;

    // 3) Spustíme dotaz
    const [rows] = await new Promise((resolve, reject) => {
      conn.query(sql, (err, results) => (err ? reject(err) : resolve([results])));
    });

    // 4) Vrátíme načtená data
    return res.json(rows);
  } catch (err) {
    console.error('[NP][LIST-EXPANDED] ERROR:', err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// GET seznam dodacích listů

// GET /np/list — načte záznamy z NP_Header podle filtru
app.get('/np/list', async (req, res) => {
  console.log('[NP-LIST] Endpoint triggered with query:', req.query);
  const { dateFrom, dateTo, npNumber, supplierName } = req.query;
  let conn;
  try {
    // 1) Získej připojení
    conn = await new Promise((resolve, reject) =>
      poolC5sluzbyint.getConnection((err, c) => err ? reject(err) : resolve(c))
    );

    // 2) Sestav SQL s optional filtry
    let sql = `
      SELECT
        id,
        np_number,
        dodaci_list,
        datum,
        supplier_name,
        supplier_address
      FROM NP_Header
      WHERE 1=1
    `;
    const params = [];

    if (dateFrom) {
      sql += ' AND datum >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND datum <= ?';
      params.push(dateTo);
    }
    if (npNumber) {
      sql += ' AND np_number LIKE ?';
      params.push(`%${npNumber}%`);
    }
    if (supplierName) {
      sql += ' AND supplier_name LIKE ?';
      params.push(`%${supplierName}%`);
    }

    // 3) Seřaďte (nepovinné) např. podle data
    sql += ' ORDER BY datum DESC';

    // 4) Proveď dotaz
    const rows = await new Promise((resolve, reject) =>
      conn.query(sql, params, (err, results) => err ? reject(err) : resolve(results))
    );

    // 5) Odeslat JSON
    res.json(rows);
  } catch (err) {
    console.error('[NP-LIST] ERROR:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
    console.log('[NP-LIST] Connection released');
  }
});


// server.js (nebo váš router soubor)
// na začátku server.js už máte něco jako:
// const pool = require('./db'); // nebo odkud váš pool importujete

// /np/detail/:id — header + palety + řádky + kódy + slot + počty naskenovaných kusů + ALOKACE
// /np/detail/:id — header + palety + řádky + kódy + slot + počty naskenovaných kusů + ALOKACE
app.get('/np/detail/:id', async (req, res) => {
  const headerId = parseInt(req.params.id, 10);

  // 1) Header
  poolC5sluzbyint.query(
    `SELECT id, np_number, dodaci_list, datum, supplier_name, supplier_address
       FROM NP_Header
      WHERE id = ?`,
    [headerId],
    (err, headerRows) => {
      if (err) {
        console.error('Error fetching NP_Header:', err);
        return res.status(500).json({ error: 'DB error' });
      }
      if (headerRows.length === 0) {
        return res.status(404).json({ error: 'NP_Header not found' });
      }
      const header = headerRows[0];

      // 2) Palety + řádky + kódy + slot + agregace měření
      const sql = `
        SELECT
          p.id              AS pallet_id,
          p.pallet_no,
          p.pallet_weight,
          p.volume_cbm,

          l.id              AS line_id,
          l.item_number,              -- = Kod_produktu2
          l.popis,
          l.rozmer,
          l.jednotka,
          l.objednano,
          l.pcs_per_carton,
          l.carton_size,
          l.gross_weight_ctn_kg,
          l.total_gross_weight,
          l.total_net_weight,
          l.prijato,
          l.zbyvajici_mnozstvi,

          k.Kod_produktu2   AS product_kod2,
          k.Gtin            AS tk_gtin,
          k.Nazev           AS tk_nazev,
          k.EAN_krabice     AS tk_ean_krabice,
          k.Krabice_ks      AS tk_ks_v_krabici,
          k.EAN             AS tk_ean_produkt,
          k.EAN_sacek       AS tk_ean_sacek,
          k.Sacek_ks        AS tk_kusu_v_sacku,
          k.Sacku_v_krabici AS tk_sacku_v_krabici,

          s.id              AS pallet_slot_id,
          s.slot_name       AS slot_name,

          CASE
            WHEN COALESCE(NULLIF(k.Krabice_ks,0), NULLIF(l.pcs_per_carton,0)) IS NULL
              THEN 0
            ELSE CEILING(l.objednano / COALESCE(NULLIF(k.Krabice_ks,0), NULLIF(l.pcs_per_carton,0)))
          END AS ordered_boxes,

          COALESCE(m.scanned_count, 0) AS scanned_count

        FROM NP_Pallets p
        JOIN NP_Lines l
          ON l.pallet_id = p.id

        LEFT JOIN Tavinox_Kody k
          ON k.Druh_polozky  = 'Základní položka'
         AND k.Kod_produktu2 = l.item_number

        LEFT JOIN WH_pallet_slots s
          ON s.product_id = l.item_number

        LEFT JOIN (
          SELECT line_id, pallet_id, COUNT(*) AS scanned_count
            FROM NP_Measurements
           GROUP BY line_id, pallet_id
        ) m
          ON m.line_id   = l.id
         AND m.pallet_id = p.id

        WHERE p.header_id = ?
        ORDER BY p.id, l.id
      `;

      poolC5sluzbyint.query(sql, [headerId], (err2, rows) => {
        if (err2) {
          console.error('Error fetching pallets/lines:', err2);
          return res.status(500).json({ error: 'DB error' });
        }

        // 3) Seskupení do palet
        const palletsMap = {};
        for (const r of rows) {
          if (!palletsMap[r.pallet_id]) {
            palletsMap[r.pallet_id] = {
              id:            r.pallet_id,
              pallet_no:     r.pallet_no,
              pallet_weight: r.pallet_weight,
              volume_cbm:    r.volume_cbm,
              lines:         []
            };
          }
          palletsMap[r.pallet_id].lines.push({
            id:                   r.line_id,
            item_number:          r.item_number,
            popis:                r.popis,
            rozmer:               r.rozmer,
            jednotka:             r.jednotka,
            objednano:            Number(r.objednano),
            pcs_per_carton:       r.pcs_per_carton,
            carton_size:          r.carton_size,
            gross_weight_ctn_kg:  r.gross_weight_ctn_kg,
            total_gross_weight:   r.total_gross_weight,
            total_net_weight:     r.total_net_weight,
            prijato:              r.prijato,
            zbyvajici_mnozstvi:   r.zbyvajici_mnozstvi,

            product_kod2:         r.product_kod2 || null,
            tk_gtin:              r.tk_gtin || null,
            tk_nazev:             r.tk_nazev || null,
            tk_ean_krabice:       r.tk_ean_krabice || null,
            tk_ks_v_krabici:      r.tk_ks_v_krabici || null,
            tk_ean_sacek:         r.tk_ean_sacek || null,
            tk_kusu_v_sacku:      r.tk_kusu_v_sacku || null,
            tk_sacku_v_krabici:   r.tk_sacku_v_krabici || null,

            pallet_slot_id:       r.pallet_slot_id || null,
            slot_name:            r.slot_name || null,

            ordered_boxes:        Number(r.ordered_boxes) || 0,

            // počet naskenovaných kartonů na této paletě u této řádky
            scanned_count:        Number(r.scanned_count) || 0,

            // NOVÉ – doplníme níže: allocations = [{slot_id, cartons, slot_name}]
            allocations:          []
          });
        }

        // 4) Připravíme dvě doplňkové dotazy: sumarizace skenů + alokace slotů
        const summarySql = `
          SELECT pallet_id, line_id, COUNT(*) AS scanned_count
            FROM NP_Measurements
           WHERE pallet_id IN (SELECT id FROM NP_Pallets WHERE header_id = ?)
           GROUP BY pallet_id, line_id
           ORDER BY pallet_id, line_id
        `;

        const allocSql = `
          SELECT a.line_id, a.slot_id, a.cartons, s.slot_name
            FROM NP_Line_Slot_Allocations a
            LEFT JOIN WH_pallet_slots s ON s.id = a.slot_id
           WHERE a.line_id IN (
                 SELECT l.id
                   FROM NP_Lines l
                   JOIN NP_Pallets p ON l.pallet_id = p.id
                  WHERE p.header_id = ?
           )
        `;

        // 4a) Alokace
        poolC5sluzbyint.query(allocSql, [headerId], (errA, allocRows) => {
          if (errA) {
            console.error('Error fetching allocations:', errA);
            return res.status(500).json({ error: 'DB error' });
          }
          const allocByLine = {};
          for (const a of allocRows) {
            const lid = Number(a.line_id);
            if (!allocByLine[lid]) allocByLine[lid] = [];
            allocByLine[lid].push({
              slot_id:   Number(a.slot_id),
              cartons:   Number(a.cartons),
              slot_name: a.slot_name || null
            });
          }

          // 4b) Summary skenů
          poolC5sluzbyint.query(summarySql, [headerId], (err3, summaryRows) => {
            if (err3) {
              console.error('Error fetching scanned summary:', err3);
              return res.status(500).json({ error: 'DB error' });
            }

            // 5) Doinjektujeme allocations do jednotlivých line
            const palletsArr = Object.values(palletsMap);
            for (const p of palletsArr) {
              p.lines = (p.lines || []).map(L => ({
                ...L,
                allocations: allocByLine[L.id] || []
              }));
            }

            // 6) Odpověď
            res.json({
              header,
              pallets: palletsArr,
              scanned_summary: summaryRows.map(r => ({
                pallet_id: Number(r.pallet_id),
                line_id:   Number(r.line_id),
                scanned_count: Number(r.scanned_count) || 0
              }))
            });
          });
        });
      });
    }
  );
});


// /np/allocate-slots
app.post('/np/allocate-slots', (req, res) => {
  const { line_id, allocations } = req.body || {};
  if (!line_id || !Array.isArray(allocations)) {
    return res.status(400).json({ error: 'line_id a allocations jsou povinné' });
  }
  const rows = allocations
    .filter(a => a && a.slot_id && Number(a.cartons) > 0)
    .map(a => [Number(line_id), Number(a.slot_id), Number(a.cartons)]);

  if (!rows.length) return res.json({ ok: true, updated: 0 });

  const sql = `
    INSERT INTO NP_Line_Slot_Allocations (line_id, slot_id, cartons)
    VALUES ?
    ON DUPLICATE KEY UPDATE cartons = VALUES(cartons)
  `;
  poolC5sluzbyint.query(sql, [rows], (err, result) => {
    if (err) {
      console.error('allocate-slots error:', err);
      return res.status(500).json({ error: 'DB error' });
    }
    res.json({ ok: true, updated: result?.affectedRows || 0 });
  });
});
// ===== NP Measurements: inline (un)assign endpoints for pallet_slot_id (NULL = free) =====
// Drop this block anywhere before server.listen(...).
// Prereqs: Express 'app', MySQL exec helper 'exec', and pool 'poolC5sluzbyint'.

// POST /np/measurements/set-slot
// Body: { pallet_slot_id: number|null|"null"|""|"0",
//         measurement_ids?: number[], line_id?: number, carton_index?: number, carton_code?: string }
app.post('/np/measurements/set-slot', async (req, res) => {
  // Inline helpers (scoped to this handler)
  const normalizeSlotId = (raw) => {
    if (raw === undefined || raw === null) return null;
    const s = String(raw).trim().toLowerCase();
    if (s === "" || s === "null" || s === "undefined" || s === "0") return null;
    const n = Number(s);
    return (!Number.isFinite(n) || n <= 0) ? null : n;
  };
  const collectIds = async () => {
    let ids = Array.isArray(req.body?.measurement_ids) ? req.body.measurement_ids : [];
    ids = ids.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
    if (ids.length) return ids;

    const line_id = Number(req.body?.line_id ?? req.query?.line_id);
    const carton_index = Number(req.body?.carton_index ?? req.query?.carton_index);
    const carton_code = (req.body?.carton_code ?? req.query?.carton_code)
      ? String(req.body?.carton_code ?? req.query?.carton_code).trim()
      : null;

    if (carton_code) {
      const r = await exec(poolC5sluzbyint, "SELECT id FROM NP_Measurements WHERE carton_code = ? LIMIT 1", [carton_code]);
      if (r && r.length) return [r[0].id];
    } else if (Number.isFinite(line_id) && Number.isFinite(carton_index)) {
      const r = await exec(poolC5sluzbyint,
        "SELECT id FROM NP_Measurements WHERE line_id = ? AND carton_index = ? LIMIT 1",
        [line_id, carton_index]
      );
      if (r && r.length) return [r[0].id];
    }
    return [];
  };

  try {
    const slotId = normalizeSlotId(req.body?.pallet_slot_id ?? req.query?.pallet_slot_id);
    const ids = await collectIds();
    if (!ids.length) {
      return res.status(400).json({ success:false, error:"No target measurement(s). Provide measurement_ids OR (line_id & carton_index) OR carton_code." });
    }

    // If assigning (slotId != null), validate slot and pick its pallet_id
    let palletId = null;
    if (slotId != null) {
      const r = await exec(poolC5sluzbyint, "SELECT id, pallet_id FROM WH_pallet_slots WHERE id = ? LIMIT 1", [slotId]);
      if (!r || !r.length) return res.status(404).json({ success:false, error:"Target slot not found." });
      palletId = r[0].pallet_id ?? null;
    }

    const placeholders = ids.map(() => "?").join(",");
    const sql = `
      UPDATE NP_Measurements
      SET
        pallet_slot_id = ?,
        pallet_id      = ?,
        prep_position  = CASE WHEN ? IS NULL THEN 0 ELSE prep_position END
      WHERE id IN (${placeholders})
    `;
    const params = [slotId, palletId, slotId, ...ids];
    const result = await exec(poolC5sluzbyint, sql, params);

    return res.json({ success:true, updated: result.affectedRows, pallet_slot_id: slotId, pallet_id: palletId, ids });
  } catch (e) {
    console.error("[/np/measurements/set-slot] error:", e);
    return res.status(500).json({ success:false, error:e.message });
  }
});

// POST /np/measurements/unassign
// Body: { measurement_ids?: number[], line_id?: number, carton_index?: number, carton_code?: string }
app.post('/np/measurements/unassign', async (req, res) => {
  // Inline id collector to avoid global helpers
  const collectIds = async () => {
    let ids = Array.isArray(req.body?.measurement_ids) ? req.body.measurement_ids : [];
    ids = ids.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
    if (ids.length) return ids;

    const line_id = Number(req.body?.line_id ?? req.query?.line_id);
    const carton_index = Number(req.body?.carton_index ?? req.query?.carton_index);
    const carton_code = (req.body?.carton_code ?? req.query?.carton_code)
      ? String(req.body?.carton_code ?? req.query?.carton_code).trim()
      : null;

    if (carton_code) {
      const r = await exec(poolC5sluzbyint, "SELECT id FROM NP_Measurements WHERE carton_code = ? LIMIT 1", [carton_code]);
      if (r && r.length) return [r[0].id];
    } else if (Number.isFinite(line_id) && Number.isFinite(carton_index)) {
      const r = await exec(poolC5sluzbyint,
        "SELECT id FROM NP_Measurements WHERE line_id = ? AND carton_index = ? LIMIT 1",
        [line_id, carton_index]
      );
      if (r && r.length) return [r[0].id];
    }
    return [];
  };

  try {
    const ids = await collectIds();
    if (!ids.length) {
      return res.status(400).json({ success:false, error:"No target measurement(s). Provide measurement_ids OR (line_id & carton_index) OR carton_code." });
    }

    const placeholders = ids.map(() => "?").join(",");
    const sql = `
      UPDATE NP_Measurements
      SET pallet_slot_id = NULL,
          pallet_id      = NULL,
          prep_position  = 0
      WHERE id IN (${placeholders})
    `;
    const result = await exec(poolC5sluzbyint, sql, ids);
    return res.json({ success:true, updated: result.affectedRows, pallet_slot_id: null, pallet_id: null, ids });
  } catch (e) {
    console.error("[/np/measurements/unassign] error:", e);
    return res.status(500).json({ success:false, error:e.message });
  }
});

// (Optional) POST /np/slots/:slotId/free  — unassign all measurements in given slot
// Body: { confirm: true }
app.post('/np/slots/:slotId/free', async (req, res) => {
  // Local normalizer
  const normalizeSlotId = (raw) => {
    if (raw === undefined || raw === null) return null;
    const s = String(raw).trim().toLowerCase();
    if (s === "" || s === "null" || s === "undefined" || s === "0") return null;
    const n = Number(s);
    return (!Number.isFinite(n) || n <= 0) ? null : n;
  };

  try {
    if (!req.body?.confirm) {
      return res.status(400).json({ success:false, error:"Confirmation missing. Send { confirm: true } in body." });
    }
    const slotId = normalizeSlotId(req.params.slotId);
    if (slotId == null) return res.status(400).json({ success:false, error:"Invalid slotId." });

    const result = await exec(poolC5sluzbyint, `
      UPDATE NP_Measurements
      SET pallet_slot_id = NULL,
          pallet_id      = NULL,
          prep_position  = 0
      WHERE pallet_slot_id = ?
    `, [slotId]);

    return res.json({ success:true, freed: result.affectedRows, slotId });
  } catch (e) {
    console.error("[/np/slots/:slotId/free] error:", e);
    return res.status(500).json({ success:false, error:e.message });
  }
});


// vložení údajů o příjmu balíku (OK i NOK)
app.post('/np/measure', async (req, res) => {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    // --- 0) Načtení + přetypování vstupů -----------------------------------
    let {
      line_id,
      pallet_slot_id: raw_slot_id,
      measured_weight,
      prep_position,
      pallet_id = null,
      user_id = 1,
      ean = null,
    } = req.body || {};

    line_id         = Number(line_id);
    measured_weight = Number(measured_weight);
    prep_position   = Number(prep_position);
    user_id         = Number(user_id);
    pallet_id       = pallet_id == null ? null : Number(pallet_id);

    const pallet_slot_id = (prep_position === 0)
      ? null
      : (raw_slot_id == null ? null : Number(raw_slot_id));

    // --- 1) Validace --------------------------------------------------------
    if (!Number.isFinite(line_id) ||
        !Number.isFinite(measured_weight) ||
        !Number.isFinite(prep_position)) {
      return res.status(400).json({ error: 'Neplatné typy vstupů.' });
    }
    if (measured_weight <= 0) {
      return res.status(400).json({ error: 'measured_weight musí být kladné číslo.' });
    }
    if (!Number.isInteger(prep_position) || prep_position < 0) {
      return res.status(400).json({ error: 'prep_position musí být nezáporné celé číslo (0 = mimo slot/RK).' });
    }

    // --- 2) Ověřit existenci NP_Lines --------------------------------------
    const lineRows = await dbQuery(
      poolC5sluzbyint,
      'SELECT id, item_number, pallet_id AS line_pallet_id FROM NP_Lines WHERE id = ? LIMIT 1',
      [line_id]
    );
    if (!lineRows.length) {
      return res.status(404).json({ error: 'NP_Lines neexistuje.' });
    }
    const itemCode       = lineRows[0]?.item_number || null;
    const linePalletFrom = lineRows[0]?.line_pallet_id ?? null;

    // --- 3) Ověřit slot (pokud je) -----------------------------------------
    if (pallet_slot_id != null) {
      const slotRows = await dbQuery(
        poolC5sluzbyint,
        'SELECT id FROM WH_pallet_slots WHERE id = ? LIMIT 1',
        [pallet_slot_id]
      );
      if (!slotRows.length) {
        return res.status(404).json({ error: 'WH_pallet_slots neexistuje.' });
      }
    }

    // --- 4) Volání procedury s retry (ER_LOCK_WAIT_TIMEOUT) ----------------
    const callOnce = () => {
      const sql = 'CALL `c5sluzbyint`.`sp_add_carton_measurement`(?, ?, ?, ?, ?, ?)';
      const params = [
        line_id,           // p_line_id
        user_id,           // p_user_id
        measured_weight,   // p_weight
        pallet_slot_id,    // p_slot_id (null pokud RK)
        prep_position,     // p_prep_pos (0 = RK)
        pallet_id          // p_pallet_id (null pokud neznám)
      ];
      return dbQuery(poolC5sluzbyint, sql, params);
    };

    await dbQuery(poolC5sluzbyint, 'SET SESSION innodb_lock_wait_timeout = 3');

    let rows;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        rows = await callOnce();
        break;
      } catch (err) {
        if (err?.code === 'ER_LOCK_WAIT_TIMEOUT' && attempt < 3) {
          console.warn(`⚠️ ER_LOCK_WAIT_TIMEOUT (pokus ${attempt}/3) – retry za chvíli…`);
          await delay(200 * attempt);
          continue;
        }
        if (err?.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'Duplicitní carton_index. Zkuste akci zopakovat.' });
        }
        console.error('❌ Chyba CALL sp_add_carton_measurement:', err);
        return res.status(500).json({ error: 'Chyba databáze (procedura).', detail: err?.message || String(err) });
      }
    }

    // --- 5) Vytěžit OUT data z procedury -----------------------------------
    let out = null;
    if (Array.isArray(rows)) {
      for (const r of rows) {
        if (Array.isArray(r) && r.length && r[0]?.measurement_id != null) {
          out = r[0];
          break;
        }
      }
    }

    // --- 6) Zjistit "reálné" line_id/pallet_id čerstvě zapsaného záznamu ---
    // (když FE neposlal pallet_id, zkusíme ho dočíst z uloženého měření; případně z řádky)
    let realLineId = line_id;
    let realPalletId = pallet_id;

    if (out?.measurement_id != null) {
      const measRows = await dbQuery(
        poolC5sluzbyint,
        'SELECT line_id, pallet_id FROM NP_Measurements WHERE id = ? LIMIT 1',
        [out.measurement_id]
      );
      if (measRows.length) {
        realLineId   = Number(measRows[0].line_id);
        realPalletId = measRows[0].pallet_id != null ? Number(measRows[0].pallet_id) : null;
      }
    }

    if (realPalletId == null) {
      // fallback: paletu vezmi z NP_Lines, pokud tam je
      realPalletId = linePalletFrom != null ? Number(linePalletFrom) : null;
    }

    // --- 7) Dát dohromady aktuální count (server-truth) ---------------------
    let countRow;
    if (realPalletId != null) {
      // count specificky pro dvojici (line_id, pallet_id)
      countRow = await dbQuery(
        poolC5sluzbyint,
        `SELECT COUNT(*) AS scanned_count
           FROM NP_Measurements
          WHERE line_id = ? AND pallet_id = ?`,
        [realLineId, realPalletId]
      );
    } else {
      // nemáme paletu → alespoň count per line_id (vrátíme pallet_id=null)
      countRow = await dbQuery(
        poolC5sluzbyint,
        `SELECT COUNT(*) AS scanned_count
           FROM NP_Measurements
          WHERE line_id = ?`,
        [realLineId]
      );
    }
    const scanned_count = Number(countRow?.[0]?.scanned_count || 0);

    // --- 8) Odpověď (zpět i shape, který očekává FE) -----------------------
    return res.status(201).json({
      success: true,
      result : out || null,
      ean,
      meta   : { item_code: itemCode },
      // pro tvůj hook: rovnou přibalíme "line", aby sis mohl propsat scanned_boxes
      line: {
        id: realLineId,
        pallet_id: realPalletId,  // může být null
        scanned_count
      }
    });

  } catch (e) {
    console.error('❌ Neošetřená chyba /np/measure:', e);
    return res.status(500).json({ error: 'Neočekávaná chyba.' });
  }
});


// uložení (nebo smazání) poslední zadané váhy k řádku NP_Lines
app.post('/np/weight-save', async (req, res) => {
  try {
    let { line_id, weight } = req.body || {};

    // přetypování a sanitizace
    line_id = Number(line_id);
    if (!Number.isInteger(line_id) || line_id <= 0) {
      return res.status(400).json({ error: 'Neplatný line_id.' });
    }

    // "" nebo null → ukládáme NULL, jinak číslo >= 0
    let w = null;
    if (weight !== '' && weight != null) {
      w = Number(weight);
      if (!Number.isFinite(w) || w < 0) {
        return res.status(400).json({ error: 'weight musí být nezáporné číslo nebo prázdné.' });
      }
    }

    // existuje řádek?
    const row = await dbQuery(
      poolC5sluzbyint,
      'SELECT id FROM NP_Lines WHERE id = ? LIMIT 1',
      [line_id]
    );
    if (!row.length) {
      return res.status(404).json({ error: 'NP_Lines neexistuje.' });
    }

    // UPDATE real_weight (přizpůsob názvu sloupce, pokud se jmenuje jinak)
    await dbQuery(
      poolC5sluzbyint,
      'UPDATE NP_Lines SET real_weight = ? WHERE id = ?',
      [w, line_id]
    );

    // když smažu (NULL), pošlu 204; když uložím číslo, pošlu 200 s echo
    if (w == null) return res.status(204).end();
    return res.json({ ok: true, line_id, real_weight: w });

  } catch (e) {
    console.error('❌ /np/weight-save error:', e);
    return res.status(500).json({ error: 'Chyba při ukládání weight.' });
  }
});


// ============================================================
// Cartons (NP_Measurements) – CRUD pro FE dialog se seznamem
// ============================================================

// Pomocná funkce: aktuální scanned_count pro (line_id[, pallet_id])
async function getScannedCount(lineId, palletId) {
  if (palletId != null) {
    const r = await dbQuery(
      poolC5sluzbyint,
      `SELECT COUNT(*) AS scanned_count
         FROM NP_Measurements
        WHERE line_id = ? AND pallet_id = ?`,
      [lineId, palletId]
    );
    return Number(r?.[0]?.scanned_count || 0);
  } else {
    const r = await dbQuery(
      poolC5sluzbyint,
      `SELECT COUNT(*) AS scanned_count
         FROM NP_Measurements
        WHERE line_id = ?`,
      [lineId]
    );
    return Number(r?.[0]?.scanned_count || 0);
  }
}

// ------------------------------------------------------------
// GET /np/cartons/by-line?line_id=&pallet_id=&limit=&offset=
// Vrací seznam balíků (cartons) pro řádek (a volitelně konkrétní paletu)
app.get('/np/cartons/by-line', async (req, res) => {
  try {
    let { line_id, pallet_id = null, limit = 500, offset = 0 } = req.query || {};
    line_id   = Number(line_id);
    pallet_id = pallet_id == null ? null : Number(pallet_id);
    limit     = Math.min(2000, Math.max(1, Number(limit) || 500));
    offset    = Math.max(0, Number(offset) || 0);

    if (!Number.isInteger(line_id) || line_id <= 0) {
      return res.status(400).json({ error: 'Chybí nebo je neplatné line_id.' });
    }

    let rows;
    if (pallet_id != null && Number.isInteger(pallet_id)) {
      rows = await dbQuery(
        poolC5sluzbyint,
        `SELECT id,
                carton_code,
                measured_weight AS weight,
                pallet_id,
                pallet_slot_id,
                prep_position,
                NULL AS created_at              -- DB nemá sloupec → držíme shape
           FROM NP_Measurements
          WHERE line_id = ? AND pallet_id = ?
          ORDER BY id DESC
          LIMIT ? OFFSET ?`,
        [line_id, pallet_id, limit, offset]
      );
    } else {
      rows = await dbQuery(
        poolC5sluzbyint,
        `SELECT id,
                carton_code,
                measured_weight AS weight,
                pallet_id,
                pallet_slot_id,
                prep_position,
                NULL AS created_at              -- DB nemá sloupec → držíme shape
           FROM NP_Measurements
          WHERE line_id = ?
          ORDER BY id DESC
          LIMIT ? OFFSET ?`,
        [line_id, limit, offset]
      );
    }

    const scanned_count = await getScannedCount(line_id, pallet_id);
    return res.json({
      line_id,
      pallet_id,
      scanned_count,
      cartons: rows || []
    });
  } catch (e) {
    console.error('❌ GET /np/cartons/by-line error:', e);
    return res.status(500).json({ error: 'Chyba při čtení seznamu balíků.' });
  }
});

// ------------------------------------------------------------
// GET /np/cartons/:cartonId
// Vrací detail jednoho balíku
app.get('/np/cartons/:cartonId', async (req, res) => {
  try {
    const cartonId = Number(req.params.cartonId);
    if (!Number.isInteger(cartonId) || cartonId <= 0) {
      return res.status(400).json({ error: 'Neplatné cartonId.' });
    }
    const rows = await dbQuery(
      poolC5sluzbyint,
      `SELECT m.id,
              m.line_id,
              m.pallet_id,
              m.pallet_slot_id,
              m.prep_position,
              m.carton_code,
              m.measured_weight AS weight,
              NULL AS created_at,              -- alias kvůli FE
              l.item_number
         FROM NP_Measurements m
         LEFT JOIN NP_Lines l ON l.id = m.line_id
        WHERE m.id = ?
        LIMIT 1`,
      [cartonId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Carton nenalezen.' });
    return res.json({ carton: rows[0] });
  } catch (e) {
    console.error('❌ GET /np/cartons/:cartonId error:', e);
    return res.status(500).json({ error: 'Chyba při čtení balíku.' });
  }
});

// ------------------------------------------------------------
// PATCH /np/cartons/:cartonId
// body: { measured_weight?, pallet_slot_id?, prep_position? }
app.patch('/np/cartons/:cartonId', async (req, res) => {
  try {
    const cartonId = Number(req.params.cartonId);
    if (!Number.isInteger(cartonId) || cartonId <= 0) {
      return res.status(400).json({ error: 'Neplatné cartonId.' });
    }

    let {
      measured_weight = undefined,
      pallet_slot_id  = undefined,
      prep_position   = undefined,
    } = req.body || {};

    // dynamická SET část
    const sets = [];
    const vals = [];

    if (typeof measured_weight !== 'undefined') {
      const w = Number(measured_weight);
      if (!Number.isFinite(w) || w <= 0) {
        return res.status(400).json({ error: 'measured_weight musí být kladné číslo.' });
      }
      sets.push('measured_weight = ?');
      vals.push(w);
    }

    if (typeof pallet_slot_id !== 'undefined') {
      if (pallet_slot_id == null) {
        sets.push('pallet_slot_id = NULL');
      } else {
        const sid = Number(pallet_slot_id);
        if (!Number.isInteger(sid) || sid <= 0) {
          return res.status(400).json({ error: 'pallet_slot_id musí být celé číslo nebo null.' });
        }
        const s = await dbQuery(poolC5sluzbyint, 'SELECT id FROM WH_pallet_slots WHERE id = ? LIMIT 1', [sid]);
        if (!s.length) return res.status(404).json({ error: 'WH_pallet_slots neexistuje.' });
        sets.push('pallet_slot_id = ?');
        vals.push(sid);
      }
    }

    if (typeof prep_position !== 'undefined') {
      const pp = Number(prep_position);
      if (!Number.isInteger(pp) || pp < 0) {
        return res.status(400).json({ error: 'prep_position musí být nezáporné celé číslo.' });
      }
      sets.push('prep_position = ?');
      vals.push(pp);
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'Není co aktualizovat.' });
    }

    vals.push(cartonId);
    await dbQuery(
      poolC5sluzbyint,
      `UPDATE NP_Measurements SET ${sets.join(', ')} WHERE id = ?`,
      vals
    );

    // vrať upravený záznam
    const after = await dbQuery(
      poolC5sluzbyint,
      `SELECT m.id,
              m.line_id,
              m.pallet_id,
              m.pallet_slot_id,
              m.prep_position,
              m.carton_code,
              m.measured_weight AS weight,
              NULL AS created_at
         FROM NP_Measurements m
        WHERE m.id = ? LIMIT 1`,
      [cartonId]
    );
    if (!after.length) return res.status(404).json({ error: 'Carton po update nenalezen.' });
    return res.json({ ok: true, carton: after[0] });
  } catch (e) {
    console.error('❌ PATCH /np/cartons/:cartonId error:', e);
    return res.status(500).json({ error: 'Chyba při editaci balíku.' });
  }
});

// ------------------------------------------------------------
// DELETE /np/cartons/:cartonId
// Smaže jeden balík a vrátí i aktuální scanned_count pro FE
app.delete('/np/cartons/:cartonId', async (req, res) => {
  try {
    const cartonId = Number(req.params.cartonId);
    if (!Number.isInteger(cartonId) || cartonId <= 0) {
      return res.status(400).json({ error: 'Neplatné cartonId.' });
    }

    // zjisti line_id a pallet_id před smazáním
    const row = await dbQuery(
      poolC5sluzbyint,
      'SELECT line_id, pallet_id FROM NP_Measurements WHERE id = ? LIMIT 1',
      [cartonId]
    );
    if (!row.length) return res.status(404).json({ error: 'Carton nenalezen.' });

    const lineId   = Number(row[0].line_id);
    const palletId = row[0].pallet_id != null ? Number(row[0].pallet_id) : null;

    await dbQuery(poolC5sluzbyint, 'DELETE FROM NP_Measurements WHERE id = ?', [cartonId]);

    const scanned_count = await getScannedCount(lineId, palletId);

    return res.json({
      ok: true,
      deleted_id: cartonId,
      line: { id: lineId, pallet_id: palletId, scanned_count }
    });
  } catch (e) {
    console.error('❌ DELETE /np/cartons/:cartonId error:', e);
    return res.status(500).json({ error: 'Chyba při mazání balíku.' });
  }
});

// ------------------------------------------------------------
// DELETE /np/cartons/by-line   body: { line_id, pallet_id? }
// Smaže všechny balíky pro řádek (volitelně jen pro danou paletu)
app.delete('/np/cartons/by-line', async (req, res) => {
  try {
    let { line_id, pallet_id = null } = req.body || {};
    line_id   = Number(line_id);
    pallet_id = pallet_id == null ? null : Number(pallet_id);

    if (!Number.isInteger(line_id) || line_id <= 0) {
      return res.status(400).json({ error: 'Neplatné line_id.' });
    }

    let result;
    if (pallet_id != null && Number.isInteger(pallet_id)) {
      result = await dbQuery(
        poolC5sluzbyint,
        'DELETE FROM NP_Measurements WHERE line_id = ? AND pallet_id = ?',
        [line_id, pallet_id]
      );
    } else {
      result = await dbQuery(
        poolC5sluzbyint,
        'DELETE FROM NP_Measurements WHERE line_id = ?',
        [line_id]
      );
    }

    const scanned_count = await getScannedCount(line_id, pallet_id);

    return res.json({
      ok: true,
      affected: result?.affectedRows ?? null,
      line: { id: line_id, pallet_id, scanned_count }
    });
  } catch (e) {
    console.error('❌ DELETE /np/cartons/by-line error:', e);
    return res.status(500).json({ error: 'Chyba při hromadném mazání balíků.' });
  }
});

// ------------------------------------------------------------
// POST /np/cartons/:cartonId/reprint
// Vrátí data potřebná pro reprint (tisk necháváš na FE/agentovi)
app.post('/np/cartons/:cartonId/reprint', async (req, res) => {
  try {
    const cartonId = Number(req.params.cartonId);
    if (!Number.isInteger(cartonId) || cartonId <= 0) {
      return res.status(400).json({ error: 'Neplatné cartonId.' });
    }

    const rows = await dbQuery(
      poolC5sluzbyint,
      `SELECT m.id                  AS measurement_id,
              m.carton_code,
              m.measured_weight     AS weight,
              m.pallet_slot_id,
              m.prep_position,
              m.line_id,
              NULL AS created_at,                    -- pro konzistentní shape
              l.item_number
         FROM NP_Measurements m
         LEFT JOIN NP_Lines l ON l.id = m.line_id
        WHERE m.id = ?
        LIMIT 1`,
      [cartonId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Carton nenalezen.' });

    return res.json({ ok: true, carton: rows[0] });
  } catch (e) {
    console.error('❌ POST /np/cartons/:cartonId/reprint error:', e);
    return res.status(500).json({ error: 'Chyba při reprintu balíku.' });
  }
});

// POST endpoint pro import NP z PDF a uložení do DB


/* ---------- /save‑np ---------- */
// Existující importy a uploadMulter definováno nahoře
// const multer = require('multer');
// const uploadMulter = multer({ storage: multer.memoryStorage() });
// const pdfParse = require('pdf-parse');
// const { poolC5sluzbyint } = require('./db');

/**
 * POST /save-np
 * Uloží nový nákupní příkaz (hlavička + řádky) pouze pokud NP číslo dosud neexistuje.
 */
app.post('/save-np', uploadMulter.single('file'), async (req, res) => {
  if (!req.file?.buffer) {
    console.log('[NP] Chybí PDF soubor');
    return res.status(400).json({ message: 'Chybí PDF soubor.' });
  }
  let conn;
  try {
    // 1) Parse PDF → řádky
    const pdfText = (await pdfParse(req.file.buffer)).text;
    const rows = pdfText.split('\n')
      .map(l => l.trim().normalize('NFKD').replace(/[\u0000-\u001F]/g, ''))
      .filter(Boolean);

    // 2) Hlavička: NP číslo, dodací list, datum
    const npRow   = rows.find(l => /NP\d{4,}/i.test(l));
    const dlRow   = rows.find(l => /NCB\d{4,}/i.test(l));
    const dateRow = rows.find(l => l.startsWith('Datum'));
    const header = {
      np_number   : npRow   ? npRow.match(/NP\d{4,}/i)[0]   : null,
      dodaci_list : dlRow   ? dlRow.match(/NCB\d{4,}/i)[0]  : null,
      datum       : null
    };
    if (dateRow) {
      const [d, m, y] = dateRow.replace('Datum', '').trim().split('.');
      header.datum = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    console.log('[NP] Hlavička:', header);

    // 3) Duplicitní kontrola
    conn = await new Promise((r, j) => poolC5sluzbyint.getConnection((e, c) => e ? j(e) : r(c)));
    const [exists] = await new Promise((r, j) =>
      conn.query(
        'SELECT COUNT(*) AS cnt FROM NP_Header WHERE np_number = ?',
        [header.np_number],
        (e, results) => e ? j(e) : r(results)
      )
    );
    if (exists.cnt > 0) {
      console.log('[NP] NP číslo již existuje:', header.np_number);
      return res.status(409).json({ message: 'Tento nákupní příkaz již byl uložen.' });
    }

    // 4) Vendor block
    const vStart = rows.findIndex(l => /NingBo IPC|CHINA/i.test(l));
    const vEnd   = rows.findIndex((l, i) => i > vStart && l.endsWith('CHN'));
    if (vStart > -1 && vEnd > -1) {
      const vb = rows.slice(vStart, vEnd + 1).filter(l => !/^Množství:/i.test(l));
      header.supplier_name    = vb.shift();
      header.supplier_address = vb.join(', ');
    }

    // 5) Položky
    const qtyReg  = /(\d{1,3},\d{2})\s*ks\s*(\d{1,3},\d{2})/i;
    const codeReg = /^([A-Z]{2}\d{6})(?:\s*)(.+)/;
    const items   = [];
    rows.forEach((line, i) => {
      const cm = line.match(codeReg);
      if (!cm) return;
      const code = cm[1], desc = cm[2].trim();
      let qtyLine, qIdx;
      for (let j = 1; j <= 4 && i + j < rows.length; j++) {
        if (qtyReg.test(rows[i + j])) { qtyLine = rows[i + j]; qIdx = i + j; break; }
      }
      if (!qtyLine) return;
      const [, ord, rec] = qtyLine.match(qtyReg);
      const objednano = parseFloat(ord.replace(',', '.'));
      const prijato   = parseFloat(rec.replace(',', '.'));
      const mnoMatch  = (rows[qIdx + 1] || '').match(/Množství:\s*(\d{1,3},\d{2})/);
      const zbyvajici = mnoMatch ? parseFloat(mnoMatch[1].replace(',', '.')) : objednano - prijato;
      items.push({ item_number: code, popis: desc, objednano, jednotka: 'ks', prijato, zbyvajici });
    });
    console.log('[NP] Položek:', items.length);

    // 6) Uložení
    const hdrRes = await new Promise((r, j) =>
      conn.query(
        'INSERT INTO NP_Header (np_number,dodaci_list,datum,supplier_name,supplier_address) VALUES (?,?,?,?,?)',
        [header.np_number, header.dodaci_list, header.datum, header.supplier_name, header.supplier_address],
        (e, r2) => e ? j(e) : r(r2)
      )
    );
    const headerId = hdrRes.insertId;

    if (items.length) {
      const bulk = items.map(it => [
        headerId, it.item_number, it.popis,
        it.objednano, it.jednotka, it.prijato, it.zbyvajici
      ]);
      await new Promise((r, j) =>
        conn.query(
          'INSERT INTO NP_Lines (header_id,item_number,popis,objednano,jednotka,prijato,zbyvajici_mnozstvi) VALUES ?',
          [bulk], (e) => e ? j(e) : r()
        )
      );
    }

    res.json({ success: true, np: header.np_number, lines_saved: items.length });
  } catch (err) {
    console.error('[NP] ERROR:', err);
    res.status(err.code === 'ER_BAD_NULL_ERROR' ? 400 : 500).json({ message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// Nastavit referenční váhu krabice (gross_weight_ctn_kg) pro řádek NP_Lines
// Body: { line_id: number, new_gross_weight_ctn_kg: number }
// Nastavit referenční váhu krabice (gross_weight_ctn_kg) + vrátit aktuální řádek
// Body: { line_id: number, new_gross_weight_ctn_kg: number }
app.post('/np/set-ref-weight', async (req, res) => {
  const lineId = Number(req.body?.line_id);
  const newValRaw = Number(req.body?.new_gross_weight_ctn_kg);

  if (!Number.isFinite(lineId) || !Number.isFinite(newValRaw)) {
    return res.status(400).json({ message: 'Neplatný line_id nebo new_gross_weight_ctn_kg.' });
  }
  const newVal = Math.round(newValRaw * 100) / 100;

  let conn;
  try {
    conn = await new Promise((resolve, reject) =>
      poolC5sluzbyint.getConnection((e, c) => (e ? reject(e) : resolve(c)))
    );

    const [exists] = await new Promise((resolve, reject) =>
      conn.query('SELECT id, header_id, pallet_id FROM NP_Lines WHERE id = ?', [lineId],
        (e, results) => e ? reject(e) : resolve(results))
    );
    if (!exists) return res.status(404).json({ message: 'Řádek NP_Lines nebyl nalezen.' });

    await new Promise((resolve, reject) =>
      conn.query('UPDATE NP_Lines SET gross_weight_ctn_kg = ? WHERE id = ?', [newVal, lineId],
        (e) => e ? reject(e) : resolve())
    );

    // vrať sjednocený "line" (stejné sloupce jako v /np/detail)
    const q = `
      SELECT
        l.id              AS line_id,
        l.item_number,
        l.popis,
        l.rozmer,
        l.jednotka,
        l.objednano,
        l.pcs_per_carton,
        l.carton_size,
        l.gross_weight_ctn_kg,
        l.total_gross_weight,
        l.total_net_weight,
        l.prijato,
        l.zbyvajici_mnozstvi,

        k.Kod_produktu2   AS product_kod2,
        k.Gtin            AS tk_gtin,
        k.Nazev           AS tk_nazev,
        k.EAN_krabice     AS tk_ean_krabice,
        k.Krabice_ks      AS tk_ks_v_krabici,
        k.EAN             AS tk_ean_produkt,
        k.EAN_sacek       AS tk_ean_sacek,
        k.Sacek_ks        AS tk_kusu_v_sacku,
        k.Sacku_v_krabici AS tk_sacku_v_krabici,

        s.id              AS pallet_slot_id,
        s.slot_name       AS slot_name,

        CASE
          WHEN COALESCE(NULLIF(k.Krabice_ks,0), NULLIF(l.pcs_per_carton,0)) IS NULL
            THEN 0
          ELSE CEILING(l.objednano / COALESCE(NULLIF(k.Krabice_ks,0), NULLIF(l.pcs_per_carton,0)))
        END AS ordered_boxes

      FROM NP_Lines l
      LEFT JOIN Tavinox_Kody k
        ON k.Druh_polozky  = 'Základní položka'
       AND k.Kod_produktu2 = l.item_number
      LEFT JOIN WH_pallet_slots s
        ON s.product_id = l.item_number
      WHERE l.id = ?
      LIMIT 1
    `;
    const [row] = await new Promise((resolve, reject) =>
      conn.query(q, [lineId], (e, results) => e ? reject(e) : resolve(results))
    );

    const line = row ? {
      id:                   row.line_id,
      item_number:          row.item_number,
      popis:                row.popis,
      rozmer:               row.rozmer,
      jednotka:             row.jednotka,
      objednano:            Number(row.objednano),
      pcs_per_carton:       row.pcs_per_carton,
      carton_size:          row.carton_size,
      gross_weight_ctn_kg:  row.gross_weight_ctn_kg,
      total_gross_weight:   row.total_gross_weight,
      total_net_weight:     row.total_net_weight,
      prijato:              row.prijato,
      zbyvajici_mnozstvi:   row.zbyvajici_mnozstvi,
      product_kod2:         row.product_kod2 || null,
      tk_gtin:              row.tk_gtin || null,
      tk_nazev:             row.tk_nazev || null,
      tk_ean_krabice:       row.tk_ean_krabice || null,
      tk_ks_v_krabici:      row.tk_ks_v_krabici || null,
      tk_ean_sacek:         row.tk_ean_sacek || null,
      tk_kusu_v_sacku:      row.tk_kusu_v_sacku || null,
      tk_sacku_v_krabici:   row.tk_sacku_v_krabici || null,
      pallet_slot_id:       row.pallet_slot_id || null,
      slot_name:            row.slot_name || null,
      ordered_boxes:        Number(row.ordered_boxes) || 0
    } : null;

    return res.json({
      success: true,
      line_id: lineId,
      gross_weight_ctn_kg: newVal,
      line
    });
  } catch (err) {
    console.error('[NP] set-ref-weight ERROR:', err);
    return res.status(500).json({ message: err.message || 'Chyba serveru.' });
  } finally {
    if (conn) conn.release();
  }
});


// jen uloží počet krabic ke konkrétnímu line; přizpůsob si tabulku/sloupec
app.post('/np/box-scan', async (req, res) => {
  try {
    let { line_id, count } = req.body || {};
    line_id = Number(line_id);
    count   = Number(count);
    if (!Number.isInteger(line_id) || line_id <= 0) return res.status(400).json({ error:'Neplatný line_id' });
    if (!Number.isInteger(count) || count < 0)      return res.status(400).json({ error:'Neplatný count' });

    // pokud máš sloupec scanned_boxes v NP_Lines:
    await dbQuery(poolC5sluzbyint, 'UPDATE NP_Lines SET scanned_boxes = ? WHERE id = ?', [count, line_id]);

    return res.json({ ok:true, line_id, scanned_boxes: count });
  } catch (e) {
    console.error('❌ /np/box-scan:', e);
    return res.status(500).json({ error: 'Chyba /np/box-scan' });
  }
});

/**
 * GET /np_orders_list
 * Vrátí seznam všech uložených nákupních příkazů.
 */
app.get('/wms/purchase_list', async (req, res) => {
  let conn;
  try {
    conn = await new Promise((r, j) => poolC5sluzbyint.getConnection((e, c) => e ? j(e) : r(c)));
    const rows = await new Promise((r, j) =>
      conn.query(
        'SELECT id, np_number, dodaci_list, datum, supplier_name, supplier_address, created_at FROM NP_Header ORDER BY datum DESC',
        (e, results) => e ? j(e) : r(results)
      )
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[NP_LIST] ERROR:', err);
    res.status(500).json({ message: err.message });
  } finally {
    if (conn) conn.release();
  }
});




/* ------------------------------------------------------------------ */







// Endpoint pro aktualizaci stavu skladu
app.get('/updateInventory', async (req, res) => {
  try {
    console.log('Starting inventory update process');

    // 1. Načtení XML souboru
    const xmlData = fs.readFileSync(xmlFileStockPath, 'utf8');

    // 2. Rozparsování XML pomocí xml2js
    const parser = new xml2js.Parser({ explicitArray: false });
    const parsedXml = await parser.parseStringPromise(xmlData);

    // Předpokládáme, že data jsou ve struktuře:
    // parsedXml.Envelope.Body.MessageParts.InventoryOnhand.InventSum
    let inventSums = parsedXml.Envelope.Body.MessageParts.InventoryOnhand.InventSum;
    if (!Array.isArray(inventSums)) {
      inventSums = [inventSums];
    }

    // 3. Akumulace dat do objektu podle ItemId (Produkt)
    const inventory = {}; // Klíč: ItemId, hodnota: objekt s hodnotami pro jednotlivé sklady
    inventSums.forEach(sum => {
      const itemId = sum.ItemId;
      // Převedeme AvailPhysical na číslo (pokud není číslo, použijeme 0)
      const availPhysical = parseFloat(sum.AvailPhysical) || 0;

      // Získáme InventLocationId – nejprve z InventDim, případně i z vnořeného InventLocation
      let inventLocationId = sum.InventDim && sum.InventDim.InventLocationId;
      if (!inventLocationId && sum.InventDim && sum.InventDim.InventLocation) {
        inventLocationId = sum.InventDim.InventLocation.InventLocationId;
      }

      if (!itemId) return; // Pokud nemáme položku, přeskočíme

      // Inicializace dat pro danou položku, pokud ještě neexistují
      if (!inventory[itemId]) {
        inventory[itemId] = {
          Produkt: itemId,
          'Sklad_02010305': 0,
          'Sklad_00000300': 0,
          'Sklad_04000310': 0,
          'Sklad_03000310': 0,
          'Sklad_02010300': 0,
          'Sklad_04000400': 0,
          'Sklad_03000300': 0,
          'Sklad_00000600': 0
        };
      }
      // Pokud je inventLocationId mezi platnými, přičteme hodnotu
      if (validLocations.includes(inventLocationId)) {
        const column = 'Sklad_' + inventLocationId;
        inventory[itemId][column] += availPhysical;
      }
    });

    // 4. Transformace akumulovaných dat do pole řádků pro INSERT
    const rows = [];
    for (const itemId in inventory) {
      const row = inventory[itemId];
      // Vypočítáme Celkem jako součet všech skladových hodnot
      const celkem = validLocations.reduce((sum, loc) => sum + (row['Sklad_' + loc] || 0), 0);
      row.Celkem = celkem;
      // Nastavíme aktuální datum a čas
      row.Dat_UPD = new Date();
      rows.push(row);
    }

    // 5. TRUNCATE tabulky IMPORT_PNEU_SKLAD
    await new Promise((resolve, reject) => {
      poolC5pneutyres.query('TRUNCATE TABLE IMPORT_PNEU_SKLAD', (err, result) => {
        if (err) return reject(err);
        console.log('Table IMPORT_PNEU_SKLAD truncated successfully');
        resolve(result);
      });
    });

    // 6. Hromadný INSERT dat do tabulky IMPORT_PNEU_SKLAD
    if (rows.length > 0) {
      const insertValues = rows.map(row => [
        row.Produkt,
        row['Sklad_02010305'].toString(),
        row['Sklad_00000300'].toString(),
        row['Sklad_04000310'].toString(),
        row['Sklad_03000310'].toString(),
        row['Sklad_02010300'].toString(),
        row['Sklad_04000400'].toString(),
        row['Sklad_03000300'].toString(),
        row['Sklad_00000600'].toString(),
        row.Celkem.toString(),
        row.Dat_UPD
      ]);

      const insertQuery = `
        INSERT INTO IMPORT_PNEU_SKLAD
          (Produkt, Sklad_02010305, Sklad_00000300, Sklad_04000310, Sklad_03000310,
           Sklad_02010300, Sklad_04000400, Sklad_03000300, Sklad_00000600, Celkem, Dat_UPD)
        VALUES ?
      `;
      await new Promise((resolve, reject) => {
        poolC5pneutyres.query(insertQuery, [insertValues], (err, result) => {
          if (err) return reject(err);
          console.log('Data inserted successfully into IMPORT_PNEU_SKLAD');
          resolve(result);
        });
      });
    } else {
      console.log('No rows to insert.');
    }

    // 7. Zavolání externího endpointu pro další aktualizaci
    const endpointResponse = await axios.get('https://pneu-tyres.cz/b2b.php');
    console.log('External endpoint called successfully:', endpointResponse.data);

    res.json({
      message: 'Inventory updated successfully',
      endpointResponse: endpointResponse.data
    });
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ error: error.message });
  }
});


// S P R Á V A   C E N Í K Ů   A   P R O D U K T Ů

// Endpoint pro tvorbu (nebo update) specifických cen
app.get('/create-specific-prices', async (req, res) => {
  try {
    console.log('=== /create-specific-prices endpoint byl zavolán ===');

    // Pomocné funkce
    const toNum = (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      const s = String(v).replace(',', '.').trim();
      if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'nan') return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };
    const hasFixedValue = (val) => {
      const n = toNum(val);
      // 0 nebo null = „nenastaveno“ → nebereme jako fix
      return n !== null && n !== 0;
    };
    const formatDate = (d) => {
      const pad = (x) => String(x).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    // 1) Načtení PartNo + PriceGroup z Products
    const productsQuery = `
      SELECT PartNo, PriceGroup
      FROM Products
    `;
    const products = await query(poolC5tpms, productsQuery);
    if (!products || products.length === 0) {
      return res.status(404).json({ error: 'Žádné produkty nenalezeny v tabulce Products.' });
    }
    console.log(`Načteno ${products.length} produktů z tabulky Products.`);

    // 2) Načtení produktů z PrestaShop (id, reference)
    const prestaApiKey = process.env.PNEUTYRES_API_KEY;
    const prestaApiUrl = process.env.PNEUTYRES_API_URL;

    console.log('Volám PrestaShop API pro načtení produktů...');
    const prestaResponse = await axios.get(
      `${prestaApiUrl}/products?display=[id,reference]`,
      {
        auth: { username: prestaApiKey, password: '' },
        headers: { 'Content-Type': 'text/xml', 'Accept': 'application/xml' }
      }
    );

    const parser = new xml2js.Parser({ explicitArray: false });
    const prestaJson = await parser.parseStringPromise(prestaResponse.data);

    let prestaProducts = [];
    if (
      prestaJson &&
      prestaJson.prestashop &&
      prestaJson.prestashop.products &&
      prestaJson.prestashop.products.product
    ) {
      prestaProducts = prestaJson.prestashop.products.product;
      if (!Array.isArray(prestaProducts)) prestaProducts = [prestaProducts];
    }
    console.log(`PrestaShop API vrátilo ${prestaProducts.length} produktů.`);

    // Mapa reference (PartNo) -> id produktu v Presta
    const prestaMapping = {};
    prestaProducts.forEach(prod => {
      if (prod && prod.reference && prod.id) {
        prestaMapping[prod.reference] = prod.id;
      }
    });

    // Mapa skupin -> id_group v Presta
    const customerGroupMapping = {
      "1_eshop": 6,
      "2_pult": 7,
      "3_servis": 8,
      "4_vo": 9,
      "5_vip": 10,
      "6_indiv": 11,
      "7_dopravci": 12,
      "Conti": 14
    };

    // Statistika
    let createdOrUpdatedCount = 0;
    const errors = [];

    // Dotaz: načti VŠECHNY aktivní řádky (výprodej/akce/netto) pro daný PartNo, bez LIMIT 1
    const discountAllQuery = `
      SELECT 
        polozka, 
        ROUND(\`1_eshop\`) AS \`1_eshop\`,
        ROUND(\`2_pult\`) AS \`2_pult\`,
        ROUND(\`3_servis\`) AS \`3_servis\`,
        ROUND(\`4_vo\`)    AS \`4_vo\`,
        ROUND(\`5_vip\`)   AS \`5_vip\`,
        ROUND(\`6_indiv\`) AS \`6_indiv\`,
        ROUND(\`7_dopravci\`) AS \`7_dopravci\`,
        platnost_od, platnost_do, datum_zapsani, zapsal, marze, B2B, Conti, EXT_eshop, zdroj
      FROM (
        SELECT 
          polozka, 
          \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
          platnost_od, platnost_do, datum_zapsani, zapsal, marze, B2B, Conti, EXT_eshop, 'vyprodej' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_vyprodej
        WHERE CURDATE() BETWEEN platnost_od AND platnost_do

        UNION ALL
        SELECT 
          polozka, 
          \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
          platnost_od, platnost_do, datum_zapsani, zapsal, marze, B2B, Conti, EXT_eshop, 'akce_polozka' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_akce_polozka
        WHERE CURDATE() BETWEEN platnost_od AND platnost_do

        UNION ALL
        SELECT 
          polozka, 
          \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
          platnost_od, platnost_do, datum_zapsani, NULL AS zapsal, NULL AS marze, NULL AS B2B, Conti, NULL AS EXT_eshop, 'netto' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_netto
        WHERE CURDATE() BETWEEN platnost_od AND platnost_do
      ) AS combined
      WHERE polozka = ?
      ORDER BY CASE zdroj 
        WHEN 'vyprodej' THEN 1
        WHEN 'akce_polozka' THEN 2
        WHEN 'netto' THEN 3
      END
    `;

    const basicDiscountQuery = `
      SELECT 
        ROUND(\`1_eshop\`) AS \`1_eshop\`,
        ROUND(\`2_pult\`) AS \`2_pult\`,
        ROUND(\`3_servis\`) AS \`3_servis\`,
        ROUND(\`4_vo\`)    AS \`4_vo\`,
        ROUND(\`5_vip\`)   AS \`5_vip\`,
        ROUND(\`6_indiv\`) AS \`6_indiv\`,
        ROUND(\`7_dopravci\`) AS \`7_dopravci\`,
        B2B, Conti, EXT_eshop, cenove_skupiny, jmeno
      FROM IMPORT_CZS_Kalkulace_cen_zakladni_slevy
      WHERE cenove_skupiny = ?
      LIMIT 1
    `;

    // 3) Iterace přes produkty
    for (const product of products) {
      const partNo = product.PartNo;
      const priceGroup = product.PriceGroup;

      // 3.1) Všechny aktivní řádky pro položku (výprodej, akce, netto)
      const activeRows = await query(poolC5pneutyres, discountAllQuery, [partNo]);

      // 3.2) Základní slevy pro příslušnou cenovou skupinu
      const basicDiscountResults = await query(poolC5pneutyres, basicDiscountQuery, [priceGroup]);
      const basicDiscount = (basicDiscountResults && basicDiscountResults.length > 0) ? basicDiscountResults[0] : null;

      // 3.3) Pro každou skupinu vyber první nenulovou fixní hodnotu dle priority zdroje
      const groups = ["1_eshop", "2_pult", "3_servis", "4_vo", "5_vip", "6_indiv", "7_dopravci", "Conti"];
      const specificPrices = {};

      // Helper: najdi první nenulovou hodnotu dle pořadí řádků (ty jsou už seřazené podle priority)
      const firstNonZeroFromActive = (groupKey) => {
        for (const row of activeRows) {
          const v = toNum(row[groupKey]);
          if (hasFixedValue(v)) return v;
        }
        return null;
      };

      for (const g of groups) {
        if (g === 'Conti') {
          const basicVal = toNum(basicDiscount && basicDiscount[g]);
          if (basicVal) {
            specificPrices[g] = { type: 'percentage', value: basicVal, reason: 'basic_conti' };
            console.log(`(${partNo}) Conti → základní sleva ${basicVal}%`);
          } else {
            specificPrices[g] = null;
            console.log(`(${partNo}) Conti → základní sleva není k dispozici`);
          }
          continue;
        }

        const activeVal = firstNonZeroFromActive(g);
        if (hasFixedValue(activeVal)) {
          specificPrices[g] = { type: 'fixed', value: activeVal, reason: 'active_first_nonzero' };
          console.log(`(${partNo}) ${g} → FIX ${activeVal} z aktivních (výprodej/akce/netto).`);
        } else {
          const basicVal = toNum(basicDiscount && basicDiscount[g]);
          if (basicVal) {
            specificPrices[g] = { type: 'percentage', value: basicVal, reason: 'fallback_basic' };
            console.log(`(${partNo}) ${g} → fallback BASIC ${basicVal}% (aktivní nic/0).`);
          } else {
            specificPrices[g] = null;
            console.log(`(${partNo}) ${g} → bez slevy (ani aktivní, ani základní).`);
          }
        }
      }

      // 3.4) Presta ID dle reference = PartNo
      const prestaId = prestaMapping[partNo];
      if (!prestaId) {
        console.warn(`Pro produkt ${partNo} nebylo nalezeno odpovídající PrestaShop id.`);
        continue;
      }
      console.log(`Zpracovávám produkt ${partNo} s PrestaShop id: ${prestaId}`);

      // 3.5) Datum od včerejška, do = neomezeně
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const from = formatDate(yesterday);
      const to = '0000-00-00 00:00:00';

      // 3.6) Načtení a smazání existujících specific_prices pro produkt
      const getSPUrl = `${prestaApiUrl}/specific_prices?filter[id_product]=[${prestaId}]`;
      console.log(`Volám PrestaShop API pro načtení specifických cen: ${getSPUrl}`);

      let existingSPIds = [];
      try {
        const spResponse = await axios.get(getSPUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml', 'Accept': 'application/xml' }
        });

        const spJson = await parser.parseStringPromise(spResponse.data);
        if (
          spJson &&
          spJson.prestashop &&
          spJson.prestashop.specific_prices &&
          spJson.prestashop.specific_prices.specific_price
        ) {
          let specificPriceEntries = spJson.prestashop.specific_prices.specific_price;
          if (!Array.isArray(specificPriceEntries)) specificPriceEntries = [specificPriceEntries];
          existingSPIds = specificPriceEntries.map(sp => sp.$.id);
          console.log(`(${partNo}) nalezeno ${existingSPIds.length} existujících specific_price.`);
        } else {
          console.log(`(${partNo}) existující specific_price nenalezeny.`);
        }
      } catch (getError) {
        console.warn(`(${partNo}) Chyba při načítání specific_prices: ${getError.message}`);
      }

      for (const spId of existingSPIds) {
        const deleteUrl = `${prestaApiUrl}/specific_prices/${spId}`;
        try {
          await axios.delete(deleteUrl, {
            auth: { username: prestaApiKey, password: '' },
            headers: { 'Content-Type': 'text/xml', 'Accept': 'application/xml' }
          });
          console.log(`(${partNo}) smazána specific_price ID ${spId}.`);
        } catch (deleteError) {
          console.error(`(${partNo}) Chyba při mazání specific_price ID ${spId}: ${deleteError.message}`);
          errors.push({ product: partNo, specificPriceId: spId, error: deleteError.message });
        }
      }

      // 3.7) Vytvoření nových specific_prices pro každou skupinu
      for (const group of Object.keys(customerGroupMapping)) {
        const discountData = specificPrices[group];
        if (!discountData) continue;

        const groupId = customerGroupMapping[group];
        let specificPricePayload = '';

        if (discountData.type === 'fixed') {
          specificPricePayload = `
<prestashop>
  <specific_price>
    <id_product>${prestaId}</id_product>
    <id_shop>1</id_shop>
    <id_shop_group></id_shop_group>
    <id_cart>0</id_cart>
    <id_product_attribute></id_product_attribute>
    <id_currency>1</id_currency>
    <id_country>0</id_country>
    <id_group>${groupId}</id_group>
    <id_customer>0</id_customer>
    <id_specific_price_rule></id_specific_price_rule>
    <price>${discountData.value}</price>
    <from_quantity>1</from_quantity>
    <reduction>0</reduction>
    <reduction_tax>0</reduction_tax>
    <reduction_type>amount</reduction_type>
    <from>${from}</from>
    <to>${to}</to>
  </specific_price>
</prestashop>
          `.trim();
        } else if (discountData.type === 'percentage') {
          const reductionValue = (parseFloat(discountData.value) / 100).toFixed(2);
          specificPricePayload = `
<prestashop>
  <specific_price>
    <id_product>${prestaId}</id_product>
    <id_shop>1</id_shop>
    <id_shop_group></id_shop_group>
    <id_cart>0</id_cart>
    <id_product_attribute></id_product_attribute>
    <id_currency>1</id_currency>
    <id_country>0</id_country>
    <id_group>${groupId}</id_group>
    <id_customer>0</id_customer>
    <id_specific_price_rule></id_specific_price_rule>
    <price>-1</price>
    <from_quantity>1</from_quantity>
    <reduction>${reductionValue}</reduction>
    <reduction_tax>0</reduction_tax>
    <reduction_type>percentage</reduction_type>
    <from>${from}</from>
    <to>${to}</to>
  </specific_price>
</prestashop>
          `.trim();
        }

        try {
          const createResponse = await axios.post(
            `${prestaApiUrl}/specific_prices`,
            specificPricePayload,
            {
              auth: { username: prestaApiKey, password: '' },
              headers: { 'Content-Type': 'text/xml', 'Accept': 'application/xml' }
            }
          );
          console.log(`(${partNo}) vytvořena specific_price pro skupinu ${group}.`);
          createdOrUpdatedCount++;
        } catch (createError) {
          console.error(`(${partNo}) Chyba při vytváření specific_price pro skupinu ${group}: ${createError.message}`);
          if (createError.response && createError.response.data) {
            console.error(`API error data: ${createError.response.data}`);
          }
          errors.push({ product: partNo, group, error: createError.message });
        }
      }
    }

    const message = `Bylo zpracováno ${createdOrUpdatedCount} specifických cen.`;
    console.log(message);
    return res.status(200).json({ success: true, message, errors });

  } catch (error) {
    console.error('Chyba při zpracování specifických cen:', error.message);
    return res.status(500).json({ success: false, message: 'Chyba při zpracování specifických cen.', error: error.message });
  }
});



//CENOVÁ POLITIKA DLE PartNo

app.get('/discount/:partNo', async (req, res) => {
  const partNo = req.params.partNo;

  try {
    // 1. Načteme informace o produktu z poolC5tpms (tabulka products)
    const productQuery = `
      SELECT PartNo, PriceGroup
      FROM Products
      WHERE PartNo = ?
      LIMIT 1
    `;
    const productResults = await query(poolC5tpms, productQuery, [partNo]);
    if (!productResults || productResults.length === 0) {
      return res.status(404).json({ error: 'Produkt nebyl nalezen v tabulce products.' });
    }
    const product = productResults[0];

    // 2. Dotaz na aktivní slevovou akci z poolC5pneutyres – hledáme podle PartNo (polozka) nebo podle PriceGroup (cenove_skupiny)
    // U pravidel vyprodej, akce_polozka a netto se kontroluje platnost pomocí CURDATE(), zatímco zakladni_slevy se nefiltrují časově.
    const discountQuery = `
      SELECT 
        polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
        platnost_od, platnost_do, datum_zapsani, zapsal, marze, B2B, EXT_eshop, cenove_skupiny, jmeno, zdroj
      FROM (
        SELECT 
          polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
          platnost_od, platnost_do, datum_zapsani, zapsal, marze, B2B, EXT_eshop, NULL AS cenove_skupiny, NULL AS jmeno, 'vyprodej' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_vyprodej
        WHERE CURDATE() BETWEEN platnost_od AND platnost_do
        UNION
        SELECT 
          polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
          platnost_od, platnost_do, datum_zapsani, zapsal, marze, B2B, EXT_eshop, NULL AS cenove_skupiny, NULL AS jmeno, 'akce_polozka' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_akce_polozka
        WHERE CURDATE() BETWEEN platnost_od AND platnost_do
        UNION
        SELECT 
          polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
          platnost_od, platnost_do, datum_zapsani, NULL AS zapsal, NULL AS marze, NULL AS B2B, NULL AS EXT_eshop, NULL AS cenove_skupiny, NULL AS jmeno, 'netto' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_netto
        WHERE CURDATE() BETWEEN platnost_od AND platnost_do
      ) AS combined
      WHERE polozka = ? OR cenove_skupiny = ?
      ORDER BY CASE zdroj 
        WHEN 'vyprodej' THEN 1
        WHEN 'akce_polozka' THEN 2
        WHEN 'netto' THEN 3
      END
      LIMIT 1
    `;
    const discountResults = await query(poolC5pneutyres, discountQuery, [partNo, product.PriceGroup]);
    // Aktivní slevová akce může být prázdná, pokud neexistuje platné pravidlo.
    const activeDiscount = discountResults && discountResults.length > 0 ? discountResults[0] : null;

    // 3. Dotaz na základní slevy – bez časového omezení.
    const basicDiscountQuery = `
      SELECT 
        NULL AS polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
        NULL AS platnost_od, NULL AS platnost_do, datum_zapsani, NULL AS zapsal, NULL AS marze, B2B, EXT_eshop, cenove_skupiny, jmeno, 'zakladni_slevy' AS zdroj
      FROM IMPORT_CZS_Kalkulace_cen_zakladni_slevy
      WHERE cenove_skupiny = ?
      LIMIT 1
    `;
    const basicDiscountResults = await query(poolC5pneutyres, basicDiscountQuery, [product.PriceGroup]);
    const basicDiscount = basicDiscountResults && basicDiscountResults.length > 0 ? basicDiscountResults[0] : null;

    // 4. Zpracování výsledku
    let activeDiscountInfo = {};
    if (activeDiscount) {
      // U pravidel "vyprodej", "akce_polozka", "netto" předpokládáme, že hodnoty sloupců představují ceny po slevě.
      activeDiscountInfo = {
        discountType: activeDiscount.zdroj,
        priceValues: {
          '1_eshop': activeDiscount['1_eshop'],
          '2_pult': activeDiscount['2_pult'],
          '3_servis': activeDiscount['3_servis'],
          '4_vo': activeDiscount['4_vo'],
          '5_vip': activeDiscount['5_vip'],
          '6_indiv': activeDiscount['6_indiv'],
          '7_dopravci': activeDiscount['7_dopravci']
        }
      };
    }

    let basicDiscountInfo = {};
    if (basicDiscount) {
      // U "zakladni_slevy" zobrazíme hodnoty sloupců jako základní slevové hodnoty.
      basicDiscountInfo = {
        discountType: 'zakladni_slevy',
        discountValues: {
          '1_eshop': basicDiscount['1_eshop'],
          '2_pult': basicDiscount['2_pult'],
          '3_servis': basicDiscount['3_servis'],
          '4_vo': basicDiscount['4_vo'],
          '5_vip': basicDiscount['5_vip'],
          '6_indiv': basicDiscount['6_indiv'],
          '7_dopravci': basicDiscount['7_dopravci']
        }
      };
    }

    res.json({
      product,
      activeDiscount: activeDiscountInfo,  // Aktuální slevová akce (může být prázdná, pokud neexistuje)
      basicDiscount: basicDiscountInfo     // Základní slevy – vypíšou se vždy, pokud existují
    });
  } catch (error) {
    console.error('Error fetching discount promotion:', error);
    res.status(500).json({ error: 'Chyba při načítání slevové akce.' });
  }
});




// načtení produktůz AX pro správu ceníků
app.get('/ax_items', async (req, res) => {
  try {
    await sql.connect(mssqlConfig);
    const request = new sql.Request();

    // Základní SQL dotaz s mapováním sloupců:
    let query = `
      SELECT
        [ItemId] AS PartNo,
        [ItemName] AS DisplayName,
        [ItsItemName3] AS Manufacturer,
        [ItsItemName2] AS Dezén,
        [ItsItemName2] AS Pattern,
        [ItsProducerCode],
        [ItsAssortmentCode],
        [ItsTyreSeasonality],
        [ItsTyrePosition] AS Axle,
        [ItsTyreUseMode] AS TyreUsage,
        [ItsTyreSectionWidth] AS Width,
        [ItsTyreRIMDiameter] AS Diameter,
        [ItsTyreConstructionCode] AS ConstructionType,
        [ItsTyreSpeedIndexCode],
        [ItsTyreLoadIndexCode],
        [ItsReinforced],
        [ItsMSMark] AS MS,
        [ItsFlangeProtection],
        [ItsTyreTubeType],
        [ItsRunFlatType],
        [ItsTyreAspectRatio],
        [ItsTyreAspectRatioDescription],
        [ItsWebAvailable],
        [ItsWebAvailableB2B],
        [ItsWebAvailableExt],
        [ItsMarketingActionId],
        [ItsActionDateFrom],
        [ItsActionDateTo],
        [ItsActionPrice],
        [ItsMaxTyrePatternHigh],
        [ItsMaxTyreDrivenDistance],
        [ItsEnergeticEfficiency],
        [ItsWetBrake],
        [ItsOutLoudness],
        [ItsRetentionalNumber],
        [ItsItemDescription],
        [ItsSnowflakeInMountain] as Mountain,
        [ItemGroupId],
        [UnitId],
        [NetWeight],
        [TaraWeight],
        [GrossWeight],
        [ItemType],
        [PurchLineDisc],
        [SalesPrice],
        [SalesPriceDate],
        [PrimaryVendorId],
        [ExternalItemId],
        [PurchStopped],
        [InventStopped],
        [SalesStopped],
        [ItsItemEAN],
        [RecyclingUnitAmount],
        [ItsItemIdFreight],
        [PdsFreightAllocationGroupId],
        [MarkupGroupId],
        [ItsURLPicture],
        [ItsURLEprel],
        [ItsURLQRCode],
        [ItsProducerCategory],
        [ItsCanvasCount],
        [InventPrice],
        [DataAreaId],
        [Partition],
        [ItsJoinedItemName]
      FROM [AxProdCS].[dbo].[ItsIFInventTable]
    `;

    // Dynamická konstrukce WHERE klauzule
    let whereClauses = [];
    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'partNos') {
        // Rozdělení hodnoty podle čárek a odstranění prázdných položek
        const partNosArr = value.split(',').map(item => item.trim()).filter(item => item);
        if (partNosArr.length > 0) {
          // Vytvoříme parametry pro každý partNo
          const inParams = [];
          partNosArr.forEach((p, index) => {
            const paramName = `partNo_${index}`;
            request.input(paramName, sql.VarChar, p);
            inParams.push(`@${paramName}`);
          });
          whereClauses.push(`[ItemId] IN (${inParams.join(',')})`);
        }
      } else if (value === '""') {
        // Kontrola hodnoty jako řetězec obsahující dvojité uvozovky
        whereClauses.push(`([${key}] IS NULL OR [${key}] = '')`);
      } else if (value.includes('|')) {
        // Rozdělení hodnoty na více vzorů oddělených '|'
        const patterns = value.split('|').map(v => v.replace(/\*/g, '%'));
        const orClauses = patterns.map((pattern, index) => {
          const paramName = `${key}_${index}`;
          request.input(paramName, sql.VarChar, pattern);
          return `[${key}] LIKE @${paramName}`;
        }).join(' OR ');
        whereClauses.push(`(${orClauses})`);
      } else {
        // Přímé použití hodnoty s nahrazením '*' za '%' pro LIKE
        const paramName = key;
        const pattern = value.replace(/\*/g, '%');
        request.input(paramName, sql.VarChar, pattern);
        whereClauses.push(`[${key}] LIKE @${paramName}`);
      }
    }
    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Spuštění dotazu
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Database query failed:', err);
    res.status(500).send('Internal Server Error');
  }
});


// Nový endpoint, který synchronizuje stav skladu pouze u produktů, jejichž hodnota se změnila
app.get('/sync-changed-stock', async (req, res) => {
  // Načte snapshot z tabulky stock_snapshot (uložený předchozí stav)
  async function loadPreviousSnapshotFromDB() {
    const rows = await poolC5pneutyres.query('SELECT Produkt, Celkem FROM stock_snapshot');
    const snapshot = {};
    if (Array.isArray(rows)) {
      rows.forEach(row => {
        // Ujistěte se, že název sloupce odpovídá (např. row.Produkt nebo row.produkt)
        snapshot[row.Produkt] = parseFloat(row.Celkem);
      });
    }
    return snapshot;
  }
  
  // Uloží nebo aktualizuje snapshot pro jeden produkt v DB
  async function saveProductSnapshot(productRef, newStock) {
    const now = formatDate(new Date());
    const query = `
      INSERT INTO stock_snapshot (Produkt, Celkem, last_updated)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE Celkem = VALUES(Celkem), last_updated = VALUES(last_updated)
    `;
    await poolC5pneutyres.query(query, [productRef, newStock, now]);
  }
  
  // Získá aktuální stav skladu z XML souboru
  async function getCurrentStock() {
    const fs = require('fs');
    const xml2js = require('xml2js');
    const xmlData = await new Promise((resolve, reject) => {
      fs.readFile('\\\\10.60.5.41\\aif\\import\\pneu-sklad.xml', 'utf8', (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });
    const result = await new Promise((resolve, reject) => {
      xml2js.parseString(xmlData, { explicitArray: false }, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
    const inventory = result.Envelope.Body.MessageParts.InventoryOnhand;
    let inventSums = [];
    if (inventory && inventory.InventSum) {
      inventSums = Array.isArray(inventory.InventSum)
        ? inventory.InventSum
        : [inventory.InventSum];
    }
    const stockMap = {};
    inventSums.forEach(item => {
      stockMap[item.ItemId] = (stockMap[item.ItemId] || 0) + parseFloat(item.AvailPhysical);
    });
    return stockMap;
  }
  
  try {
    const previousSnapshot = await loadPreviousSnapshotFromDB();
    const currentSnapshot = await getCurrentStock();
    
    const changedProducts = [];
    // Pro vytvoření sjednocené množiny všech produktů z obou snapshotů
    const allProducts = new Set([...Object.keys(previousSnapshot), ...Object.keys(currentSnapshot)]);
    allProducts.forEach(prod => {
      const prevVal = previousSnapshot.hasOwnProperty(prod) ? previousSnapshot[prod] : 0;
      const currVal = currentSnapshot.hasOwnProperty(prod) ? currentSnapshot[prod] : 0;
      if (prevVal !== currVal) {
        changedProducts.push({ productRef: prod, previous: prevVal, current: currVal });
      }
    });
    
    // Pro každý produkt, u kterého došlo ke změně, provedeme synchronizaci v PrestaShopu
    const updateResults = [];
    for (const prodChange of changedProducts) {
      try {
        const result = await updatePrestaShopStock(prodChange.productRef, prodChange.current);
        // Aktualizujeme snapshot pro daný produkt
        await saveProductSnapshot(prodChange.productRef, prodChange.current);
        updateResults.push({ productRef: prodChange.productRef, status: 'updated', details: result });
      } catch (err) {
        updateResults.push({ productRef: prodChange.productRef, status: 'error', details: err.message });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'Synchronizace změn ve skladových množstvích dokončena pouze pro změněné produkty',
      updates: updateResults
    });
    
  } catch (error) {
    console.error('Chyba při synchronizaci změn ve skladových množstvích:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Chyba při synchronizaci změn ve skladových množstvích',
      details: error.message
    });
  }
});


// hlídání změn množství skladem
app.get('/check-stock-changes', async (req, res) => {
  // Načtení předchozího snapshotu z DB
  async function loadPreviousSnapshotFromDB() {
    const rows = await poolC5pneutyres.query('SELECT Produkt, Celkem FROM stock_snapshot');
    const snapshot = {};
    if (Array.isArray(rows)) {
      rows.forEach(row => {
        // Pokud jsou názvy sloupců jinak (např. malými písmeny), upravte zde přístup
        snapshot[row.Produkt] = parseFloat(row.Celkem);
      });
    }
    return snapshot;
  }

  // Uložení snapshotu do DB: provede INSERT/UPDATE a smaže záznamy, které v aktuálním snapshotu chybí.
  async function saveSnapshotToDB(snapshot) {
    const now = formatDate(new Date());
    const updatePromises = [];
    for (const produkt in snapshot) {
      const celkem = snapshot[produkt];
      const query = `
        INSERT INTO stock_snapshot (Produkt, Celkem, last_updated)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE Celkem = VALUES(Celkem), last_updated = VALUES(last_updated)
      `;
      updatePromises.push(poolC5pneutyres.query(query, [produkt, celkem, now]));
    }
    await Promise.all(updatePromises);

    // Smažeme produkty, které již nejsou v aktuálním snapshotu
    const currentProducts = Object.keys(snapshot);
    if (currentProducts.length > 0) {
      const placeholders = currentProducts.map(() => '?').join(',');
      const deleteQuery = `DELETE FROM stock_snapshot WHERE Produkt NOT IN (${placeholders})`;
      await poolC5pneutyres.query(deleteQuery, currentProducts);
    }
  }

  // Získání aktuálního stavu skladů z tabulky IMPORT_PNEU_SKLAD
  async function getCurrentStock() {
    const rows = await poolC5pneutyres.query('SELECT Produkt, Celkem FROM IMPORT_PNEU_SKLAD');
    const stockMap = {};
    rows.forEach(row => {
      // Ujistěte se, že název sloupce odpovídá – případně použijte row.produkt či row.celkem
      stockMap[row.Produkt] = parseFloat(row.Celkem);
    });
    return stockMap;
  }

  try {
    const previousSnapshot = await loadPreviousSnapshotFromDB();
    const currentSnapshot = await getCurrentStock();

    const changedProducts = [];
    // Vytvoříme množinu všech produktů z obou snapshotů
    const allProducts = new Set([
      ...Object.keys(previousSnapshot),
      ...Object.keys(currentSnapshot)
    ]);

    allProducts.forEach(produkt => {
      // Pokud produkt v předchozím snapshotu chybí, považujeme jeho hodnotu za 0
      const previousValue = previousSnapshot.hasOwnProperty(produkt) ? previousSnapshot[produkt] : 0;
      const currentValue = currentSnapshot.hasOwnProperty(produkt) ? currentSnapshot[produkt] : 0;
      if (previousValue !== currentValue) {
        let changeType = 'updated';
        if (previousValue === 0 && currentValue > 0) {
          changeType = 'new';
        } else if (previousValue > 0 && currentValue === 0) {
          changeType = 'updated to 0';
        }
        changedProducts.push({
          Produkt: produkt,
          previous: previousValue,
          current: currentValue,
          changeType
        });
      }
    });

    await saveSnapshotToDB(currentSnapshot);

    return res.status(200).json({
      success: true,
      message: 'Kontrola skladových změn dokončena',
      changes: changedProducts
    });
  } catch (error) {
    console.error('Chyba při kontrole skladových změn:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Chyba při kontrole skladových změn',
      details: error.message
    });
  }
});



// Předpokládáme, že již máte inicializovaný Express server a poolC5tpms (MySQL connection pool)
// a potřebné balíčky jsou nainstalovány (axios, xml2js, js2xmlparser, form-data, fs, os, path, util)


// Endpoint pro vytvoření/aktualizaci produktů s kombinacemi podle vzoru pro jednoduchý produkt
app.get('/prestashop/create-products-with-combinations', async (req, res) => {
  let connection;
  try {
    console.log("=== /prestashop/create-products-with-combinations endpoint byl zavolán ===");

    // 1) Připojení k databázi
    connection = await poolC5tpms.getConnection();
    connection.query = util.promisify(connection.query);

    // 2) Konfigurace Prestashop API a vytvoření parseru pro XML
    const prestaApiUrl = process.env.PNEUTYRES_API_URL;
    const prestaApiKey = process.env.PNEUTYRES_API_KEY;
    const parser = new xml2js.Parser({ explicitArray: false });

    // -------------------------------------------------------------------------------------
    // Pomocné funkce
    // -------------------------------------------------------------------------------------
    function slugify(text) {
      return text.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
    }

    function removeEmpty(obj) {
      if (typeof obj !== 'object' || obj === null) return obj;
      return Object.keys(obj).reduce((acc, key) => {
        const value = removeEmpty(obj[key]);
        if (value !== '' && value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, Array.isArray(obj) ? [] : {});
    }

    async function getOrCreateManufacturerInPrestashop(manufacturerName) {
      if (!manufacturerName) {
        console.log("ManufacturerName je prázdný -> vracím null");
        return null;
      }
      try {
        const filterUrl = `${prestaApiUrl}/manufacturers?filter[name]=[${encodeURIComponent(manufacturerName)}]&display=full`;
        console.log(`Hledám výrobce "${manufacturerName}" v PrestaShopu GET: ${filterUrl}`);
        const checkResp = await axios.get(filterUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml' }
        });
        const parsed = await parser.parseStringPromise(checkResp.data);
        console.log("Odpověď z PrestaShopu při hledání výrobce:", JSON.stringify(parsed, null, 2));

        if (parsed?.prestashop?.manufacturers?.manufacturer) {
          let found = parsed.prestashop.manufacturers.manufacturer;
          if (Array.isArray(found)) {
            found = found[0];
          }
          if (found && found.id) {
            console.log(`Výrobce "${manufacturerName}" existuje s ID: ${found.id}`);
            return found.id;
          }
        }

        console.log(`Výrobce "${manufacturerName}" neexistuje, vytvářím ho...`);
        const newManufacturerPayload = {
          manufacturer: {
            active: "1",
            name: manufacturerName
          }
        };
        const cleanPayload = removeEmpty(newManufacturerPayload);
        const manufacturerXml = js2xmlparser.parse("prestashop", cleanPayload, { declaration: { include: true } });
        console.log("XML payload pro vytvoření výrobce:");
        console.log(manufacturerXml);

        await axios.post(
          `${prestaApiUrl}/manufacturers`,
          manufacturerXml,
          {
            auth: { username: prestaApiKey, password: '' },
            headers: { 'Content-Type': 'text/xml' }
          }
        );
        console.log(`Výrobce "${manufacturerName}" byl úspěšně vytvořen.`);

        const checkNewResp = await axios.get(filterUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml' }
        });
        const parsedNew = await parser.parseStringPromise(checkNewResp.data);
        if (parsedNew?.prestashop?.manufacturers?.manufacturer) {
          let createdMf = parsedNew.prestashop.manufacturers.manufacturer;
          if (Array.isArray(createdMf)) {
            createdMf = createdMf[0];
          }
          if (createdMf && createdMf.id) {
            console.log(`Nově vytvořený výrobce "${manufacturerName}" má ID: ${createdMf.id}`);
            return createdMf.id;
          }
        }
        console.error(`Nepodařilo se získat ID výrobce "${manufacturerName}"`);
        return null;
      } catch (err) {
        console.error("Chyba při getOrCreateManufacturerInPrestashop:", err.message);
        if (err.response?.data) {
          console.error("Response data:", err.response.data);
        }
        return null;
      }
    }

    async function getOrCreateFeatureValue(featureId, valueName) {
      if (!valueName) {
        console.log(`Hodnota pro feature ${featureId} je prázdná -> vracím null`);
        return null;
      }
      try {
        const filterUrl = `${prestaApiUrl}/product_feature_values?filter[id_feature]=[${featureId}]&filter[value]=[${encodeURIComponent(valueName)}]&display=full`;
        console.log(`GET: ${filterUrl}`);
        const checkResp = await axios.get(filterUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml' }
        });
        const parsed = await parser.parseStringPromise(checkResp.data);

        if (parsed?.prestashop?.product_feature_values?.product_feature_value) {
          let found = parsed.prestashop.product_feature_values.product_feature_value;
          if (Array.isArray(found)) {
            found = found[0];
          }
          if (found?.id) {
            console.log(`Feature value "${valueName}" existuje s ID: ${found.id}`);
            return found.id;
          }
        }

        console.log(`Feature value "${valueName}" neexistuje, vytvářím ji (featureId = ${featureId})...`);
        const payload = {
          product_feature_value: {
            id_feature: featureId.toString(),
            value: {
              language: {
                "@": { id: "1" },
                "#": valueName
              }
            }
          }
        };
        const cleanPayload = removeEmpty(payload);
        const xmlPayload = js2xmlparser.parse("prestashop", cleanPayload, { declaration: { include: true } });
        console.log("XML payload pro vytvoření feature value:");
        console.log(xmlPayload);

        await axios.post(
          `${prestaApiUrl}/product_feature_values`,
          xmlPayload,
          {
            auth: { username: prestaApiKey, password: '' },
            headers: { 'Content-Type': 'text/xml' }
          }
        );
        console.log(`Feature value "${valueName}" byla úspěšně vytvořena.`);

        const checkNewResp = await axios.get(filterUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml' }
        });
        const parsedNew = await parser.parseStringPromise(checkNewResp.data);
        if (parsedNew?.prestashop?.product_feature_values?.product_feature_value) {
          let created = parsedNew.prestashop.product_feature_values.product_feature_value;
          if (Array.isArray(created)) {
            created = created[0];
          }
          if (created?.id) {
            console.log(`Nově vytvořená feature value "${valueName}" má ID: ${created.id}`);
            return created.id;
          }
        }
        console.error(`Nepodařilo se získat ID pro feature value "${valueName}"`);
        return null;
      } catch (error) {
        console.error("Chyba při getOrCreateFeatureValue:", error.message);
        if (error.response?.data) {
          console.error("Response data:", error.response.data);
        }
        return null;
      }
    }

    async function removeProductImages(productId) {
      try {
        console.log(`--- Odstraňuji obrázky produktu s ID: ${productId} ---`);
        const imagesUrl = `${prestaApiUrl}/images/products/${productId}`;
        console.log(`GET -> ${imagesUrl}`);
        const resp = await axios.get(imagesUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml' }
        });
        const parsed = await parser.parseStringPromise(resp.data);
        console.log(`Parsed obrázky produktu ${productId}:`, JSON.stringify(parsed, null, 2));

        if (parsed?.prestashop?.image?.declination) {
          let images = parsed.prestashop.image.declination;
          if (!Array.isArray(images)) {
            images = [images];
          }
          console.log(`Produkt ${productId} má ${images.length} obrázků, začínám mazat...`);
          for (const img of images) {
            const imageId = img.$?.['xlink:href'] ? img.$['xlink:href'].split('/').pop() : null;
            if (!imageId) {
              console.warn("Obrázek nemá platné ID, přeskočím.");
              continue;
            }
            const deleteUrl = `${prestaApiUrl}/images/products/${productId}/${imageId}`;
            console.log(`DELETE -> ${deleteUrl}`);
            try {
              const deleteResp = await axios.delete(deleteUrl, {
                auth: { username: prestaApiKey, password: '' },
                headers: { 'Content-Type': 'text/xml' }
              });
              console.log(`Obrázek ${imageId} smazán, status = ${deleteResp.status}`);
            } catch (deleteErr) {
              console.error(`Chyba při mazání obrázku ${imageId}: ${deleteErr.message}`);
              if (deleteErr.response) {
                console.error("PrestaShop response data:", deleteErr.response.data);
              }
            }
          }
        } else {
          console.log(`Produkt ${productId} nemá žádné obrázky.`);
        }
      } catch (error) {
        console.error(`Chyba při získávání obrázků produktu ${productId}: ${error.message}`);
        if (error.response) {
          console.error("PrestaShop response data:", error.response.data);
        }
      }
    }

    async function updateProductImage(productId, imageUrl) {
      try {
        await removeProductImages(productId);
        let imageStream;
        if (imageUrl.startsWith('\\\\')) {
          console.log(`Obrázek načítám z UNC cesty: ${imageUrl}`);
          imageStream = fs.createReadStream(imageUrl);
        } else {
          const modifiedImageUrl = imageUrl.includes('?')
            ? `${imageUrl}&b2buserid=6956`
            : `${imageUrl}?b2buserid=6956`;
          console.log(`Obrázek načítám z URL: ${modifiedImageUrl}`);
          const response = await axios.get(modifiedImageUrl, { responseType: 'stream' });
          imageStream = response.data;
        }
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `temp_image_${productId}.jpg`);
        const writer = fs.createWriteStream(tempFilePath);
        imageStream.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        console.log(`Obrázek uložen do dočasného souboru: ${tempFilePath}`);

        const form = new FormData();
        form.append('image', fs.createReadStream(tempFilePath));
        const uploadUrl = `${prestaApiUrl}/images/products/${productId}/`;
        console.log(`Nahrávám obrázek na: ${uploadUrl}`);
        const uploadResp = await axios.post(uploadUrl, form, {
          auth: { username: prestaApiKey, password: '' },
          headers: form.getHeaders()
        });
        console.log(`Obrázek nahrán, status: ${uploadResp.status}`);

        fs.unlinkSync(tempFilePath);
      } catch (error) {
        console.error(`Chyba při nahrávání obrázku k produktu ${productId}: ${error.message}`);
        if (error.response) {
          console.error("Response data:", error.response.data);
        }
      }
    }

    // -------------------------------------------------------------------------------------
    // MAPOVACÍ objekty pro vlastnosti
    // -------------------------------------------------------------------------------------
    const fuelEfficiencyMapping = {
      "D": "221927",
      "C": "221926",
      "B": "221925",
      "A": "221924",
      "G": "221930",
      "F": "221929",
      "E": "221928"
    };

    const wetGripMapping = {
      "G": "221938",
      "F": "221937",
      "E": "221936",
      "D": "221935",
      "C": "221934",
      "B": "221933",
      "A": "221932"
    };

    const rollingNoiseMapping = {
      "E": "221943",
      "D": "221942",
      "C": "221941",
      "B": "221940",
      "A": "221939"
    };

    const rollingNoiseDbMapping = {
      "80": "221956",
      "79": "221955",
      "78": "221954",
      "77": "221953",
      "76": "221952",
      "75": "221951",
      "74": "221950",
      "73": "221949",
      "72": "221948",
      "71": "221947",
      "70": "221946",
      "69": "221945",
      "68": "221944"
    };

    // -------------------------------------------------------------------------------------
    // Hlavní logika – načtení produktů z DB a zpracování
    // -------------------------------------------------------------------------------------
    const query = `
      SELECT
        PartNo,
        DisplayName,
        EAN,
        RetailPrice_CZ AS price,
        Width,
        Profile,
        Diameter,
        ImageUrl,
        Manufacturer,
        Axle AS Naprava,
        TyreUsage AS Provoz,
        MS,
        Mountain,
        TagV2021_FuelEfficiencyClass,
        TagV2021_WetGripClass,
        TagV2021_RollingNoise,
        TagV2021_RollingNoise_dB,
        Weight,
        Pattern
      FROM Products
    `;
    const products = await connection.query(query);
    console.log(`Nalezeno ${products.length} produktů pro zpracování.`);

    let totalProcessed = 0;
    let totalErrors = 0;

    for (const product of products) {
      const {
        PartNo,
        DisplayName,
        EAN,
        price,
        Width,
        Profile,
        Diameter,
        ImageUrl,
        Manufacturer,
        Naprava,
        Provoz,
        MS,
        Mountain,
        TagV2021_FuelEfficiencyClass,
        TagV2021_WetGripClass,
        TagV2021_RollingNoise,
        TagV2021_RollingNoise_dB,
        Weight,
        Pattern
      } = product;

      console.log("\n------------------------------------------------------");
      console.log(`Zpracovávám produkt s PartNo "${PartNo}"`);
      console.log("------------------------------------------------------\n");

      const manufacturerPsId = await getOrCreateManufacturerInPrestashop(Manufacturer);
      console.log(`Výrobce "${Manufacturer}" -> ID: ${manufacturerPsId}`);

      const linkRewrite = slugify(DisplayName);

      let cleanedWidth = Width ? Width.toString().replace(/\.00$/, '') : "";
      let widthPsId = null;
      if (cleanedWidth) {
        try {
          const q = `SELECT ps_id FROM sirka WHERE value = ? LIMIT 1`;
          const r = await connection.query(q, [cleanedWidth]);
          if (r?.length > 0) {
            widthPsId = r[0].ps_id;
          }
        } catch (err) {
          console.error(`Chyba při SELECT sirka pro ${cleanedWidth}:`, err.message);
        }
      }

      let cleanedProfile = Profile ? Profile.toString().replace(/\.00$/, '') : "";
      let profilePsId = null;
      if (cleanedProfile) {
        try {
          const q = `SELECT ps_id FROM profil WHERE value = ? LIMIT 1`;
          const r = await connection.query(q, [cleanedProfile]);
          if (r?.length > 0) {
            profilePsId = r[0].ps_id;
          }
        } catch (err) {
          console.error(`Chyba při SELECT profil pro ${cleanedProfile}:`, err.message);
        }
      }

      let cleanedDiameter = Diameter ? Diameter.toString().replace(/\.00$/, '') : "";
      let rafekPsId = null;
      if (cleanedDiameter) {
        try {
          const q = `SELECT ps_id FROM rafek WHERE value = ? LIMIT 1`;
          const r = await connection.query(q, [cleanedDiameter]);
          if (r?.length > 0) {
            rafekPsId = r[0].ps_id;
          }
        } catch (err) {
          console.error(`Chyba při SELECT rafek pro ${cleanedDiameter}:`, err.message);
        }
      }

      let napravPsId = null;
      if (Naprava) {
        try {
          const q = `SELECT ps_id FROM pozice WHERE value = ? LIMIT 1`;
          const r = await connection.query(q, [Naprava]);
          if (r?.length > 0) {
            napravPsId = r[0].ps_id;
          }
        } catch (err) {
          console.error(`Chyba při SELECT pozice pro ${Naprava}:`, err.message);
        }
      }

      let provozPsId = null;
      if (Provoz) {
        try {
          const q = `SELECT ps_id FROM zpusob_uziti WHERE value = ? LIMIT 1`;
          const r = await connection.query(q, [Provoz]);
          if (r?.length > 0) {
            provozPsId = r[0].ps_id;
          }
        } catch (err) {
          console.error(`Chyba při SELECT zpusob_uziti pro ${Provoz}:`, err.message);
        }
      }

      const productFeatures = [];
      if (widthPsId) {
        productFeatures.push({ id: "94", id_feature_value: widthPsId.toString() });
      }
      if (profilePsId) {
        productFeatures.push({ id: "95", id_feature_value: profilePsId.toString() });
      }
      if (rafekPsId) {
        productFeatures.push({ id: "96", id_feature_value: rafekPsId.toString() });
      }
      if (napravPsId) {
        productFeatures.push({ id: "97", id_feature_value: napravPsId.toString() });
      }
      if (provozPsId) {
        productFeatures.push({ id: "98", id_feature_value: provozPsId.toString() });
      }

      if (MS && MS.toString().trim().toLowerCase() === "ano") {
        productFeatures.push({ id: "99", id_feature_value: "221922" });
      } else {
        console.warn(`Hodnota M+S (MS: ${MS}) u produktu s PartNo: ${PartNo} není "Ano" nebo je prázdná, není přidána.`);
      }

      if (Mountain && Mountain.toString().trim().toLowerCase() === "ano") {
        productFeatures.push({ id: "100", id_feature_value: "221923" });
      } else {
        console.warn(`Hodnota Vločka v Hoře (Mountain: ${Mountain}) u produktu s PartNo: ${PartNo} není "Ano" nebo je prázdná, není přidána.`);
      }

      if (TagV2021_FuelEfficiencyClass && TagV2021_FuelEfficiencyClass.toString().trim().toLowerCase() !== "ne") {
        const valueStr = TagV2021_FuelEfficiencyClass.toString().trim();
        if (fuelEfficiencyMapping[valueStr]) {
          productFeatures.push({ id: "101", id_feature_value: fuelEfficiencyMapping[valueStr] });
        } else {
          console.warn(`Neočekávaná hodnota Valivého odporu (TagV2021_FuelEfficiencyClass: ${TagV2021_FuelEfficiencyClass}) u produktu s PartNo: ${PartNo}`);
        }
      } else {
        console.warn(`Chybí nebo je neplatná hodnota Valivého odporu (TagV2021_FuelEfficiencyClass) u produktu s PartNo: ${PartNo}`);
      }

      if (TagV2021_WetGripClass && TagV2021_WetGripClass.toString().trim().toLowerCase() !== "ne") {
        const valueStr = TagV2021_WetGripClass.toString().trim();
        if (wetGripMapping[valueStr]) {
          productFeatures.push({ id: "102", id_feature_value: wetGripMapping[valueStr] });
        } else {
          console.warn(`Neočekávaná hodnota Přilnavosti (TagV2021_WetGripClass: ${TagV2021_WetGripClass}) u produktu s PartNo: ${PartNo}`);
        }
      } else {
        console.warn(`Chybí nebo je neplatná hodnota Přilnavosti (TagV2021_WetGripClass) u produktu s PartNo: ${PartNo}`);
      }

      if (TagV2021_RollingNoise && TagV2021_RollingNoise.toString().trim().toLowerCase() !== "ne") {
        const valueStr = TagV2021_RollingNoise.toString().trim();
        if (rollingNoiseMapping[valueStr]) {
          productFeatures.push({ id: "103", id_feature_value: rollingNoiseMapping[valueStr] });
        } else {
          console.warn(`Neočekávaná hodnota Hlučnosti (TagV2021_RollingNoise: ${TagV2021_RollingNoise}) u produktu s PartNo: ${PartNo}`);
        }
      } else {
        console.warn(`Chybí nebo je neplatná hodnota Hlučnosti (TagV2021_RollingNoise) u produktu s PartNo: ${PartNo}`);
      }

      if (TagV2021_RollingNoise_dB && TagV2021_RollingNoise_dB.toString().trim().toLowerCase() !== "ne") {
        const valueStr = TagV2021_RollingNoise_dB.toString().trim();
        if (rollingNoiseDbMapping[valueStr]) {
          productFeatures.push({ id: "104", id_feature_value: rollingNoiseDbMapping[valueStr] });
        } else {
          console.warn(`Neočekávaná hodnota Hlučnosti (dB) (TagV2021_RollingNoise_dB: ${TagV2021_RollingNoise_dB}) u produktu s PartNo: ${PartNo}`);
        }
      } else {
        console.warn(`Chybí nebo je neplatná hodnota Hlučnosti (dB) (TagV2021_RollingNoise_dB) u produktu s PartNo: ${PartNo}`);
      }

      if (Pattern && Pattern.toString().trim() !== "") {
        const patternValue = Pattern.toString().trim();
        const patternPsId = await getOrCreateFeatureValue(105, patternValue);
        if (patternPsId) {
          productFeatures.push({ id: "105", id_feature_value: patternPsId.toString() });
        } else {
          console.warn(`Nepodařilo se získat id pro Dezén (Pattern: ${patternValue}) u produktu s PartNo: ${PartNo}`);
        }
      } else {
        console.warn(`Chybí hodnota Dezén (Pattern) u produktu s PartNo: ${PartNo}`);
      }

      let productDataWeight;
      if (Weight && Weight.toString().trim() !== "" && Weight.toString().trim().toLowerCase() !== "ne") {
        productDataWeight = Weight.toString();
      } else {
        console.warn(`Chybí nebo je neplatná hodnota Weight u produktu s PartNo: ${PartNo}`);
      }

      const productData = {
        product: {
          reference: PartNo || "",
          ean13: EAN || "",
          price: price ? price.toString() : "0.00",
          active: "1",
          advanced_stock_management: "0",
          low_stock_alert: "0",
          id_category_default: "8",
          id_shop_default: "1",
          minimal_quantity: "1",
          available_for_order: "1",
          state: "1",
          id_manufacturer: manufacturerPsId ? manufacturerPsId.toString() : "0",
          id_tax_rules_group: "1",
          name: {
            language: [
              { "@": { id: "1" }, "#": DisplayName || "" }
            ]
          },
          link_rewrite: {
            language: [
              { "@": { id: "1" }, "#": linkRewrite }
            ]
          },
          associations: {
            categories: {
              category: [{ id: "8" }]
            }
          }
        }
      };

      if (productFeatures.length > 0) {
        productData.product.associations = productData.product.associations || {};
        productData.product.associations.product_features = {
          product_feature: productFeatures
        };
      }

      if (typeof productDataWeight !== 'undefined') {
        productData.product.weight = productDataWeight;
      }

      const checkUrl = `${prestaApiUrl}/products?filter[reference]=[${PartNo}]&display=full`;
      let existingProductId = null;
      try {
        const checkResp = await axios.get(checkUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml' }
        });
        const parsedCheck = await parser.parseStringPromise(checkResp.data);
        if (parsedCheck?.prestashop?.products?.product) {
          let foundProd = parsedCheck.prestashop.products.product;
          if (Array.isArray(foundProd)) {
            foundProd = foundProd[0];
          }
          existingProductId = foundProd?.id;
          if (existingProductId) {
            console.log(`Produkt s referencí ${PartNo} existuje, ID: ${existingProductId}`);
          }
        } else {
          console.log(`Produkt s referencí ${PartNo} nebyl nalezen, bude vytvořen.`);
        }
      } catch (err) {
        console.error(`Chyba při kontrole produktu ${PartNo}:`, err.message);
      }

      const finalPayload = removeEmpty(productData);
      const xmlBody = js2xmlparser.parse("prestashop", finalPayload, { declaration: { include: true } });
      console.log("=== FINAL PAYLOAD (JSON) pro produkt:", PartNo, "===");
      console.log(JSON.stringify(finalPayload, null, 2));
      console.log("=== FINAL PAYLOAD (XML) pro produkt:", PartNo, "===");
      console.log(xmlBody);

      let productId = null;
      if (existingProductId) {
        finalPayload.product.id = existingProductId;
        const xmlUpdate = js2xmlparser.parse("prestashop", finalPayload, { declaration: { include: true } });
        try {
          await axios.put(
            `${prestaApiUrl}/products/${existingProductId}`,
            xmlUpdate,
            {
              auth: { username: prestaApiKey, password: '' },
              headers: { 'Content-Type': 'text/xml' }
            }
          );
          productId = existingProductId;
          console.log(`Produkt ${PartNo} byl úspěšně aktualizován (ID ${existingProductId}).`);
          totalProcessed++;
        } catch (err) {
          totalErrors++;
          console.error(`Chyba při aktualizaci produktu ${PartNo}:`, err.response ? err.response.data : err.message);
        }
      } else {
        try {
          await axios.post(
            `${prestaApiUrl}/products`,
            xmlBody,
            {
              auth: { username: prestaApiKey, password: '' },
              headers: { 'Content-Type': 'text/xml' }
            }
          );
          const newCheckResp = await axios.get(checkUrl, {
            auth: { username: prestaApiKey, password: '' },
            headers: { 'Content-Type': 'text/xml' }
          });
          const newParsed = await parser.parseStringPromise(newCheckResp.data);
          if (newParsed?.prestashop?.products?.product) {
            let createdProd = newParsed.prestashop.products.product;
            if (Array.isArray(createdProd)) {
              createdProd = createdProd[0];
            }
            productId = createdProd?.id;
          }
          console.log(`Nový produkt ${PartNo} byl vytvořen, ID = ${productId}`);
          totalProcessed++;
        } catch (err) {
          totalErrors++;
          console.error(`Chyba při vytváření produktu ${PartNo}:`, err.response ? err.response.data : err.message);
        }
      }

      // Kontrola a aktualizace/vytvoření kombinace pro produkt
      if (productId) {
        // Načteme kombinace pomocí endpointu specifického pro daný produkt
        const combUrl = `${prestaApiUrl}/products/${productId}/combinations?display=full`;
        let existingCombination = null;
        try {
          const combResp = await axios.get(combUrl, {
            auth: { username: prestaApiKey, password: '' },
            headers: { 'Content-Type': 'text/xml' }
          });
          const parsedComb = await parser.parseStringPromise(combResp.data);
          if (parsedComb?.prestashop?.combinations?.combination) {
            let combArray = parsedComb.prestashop.combinations.combination;
            if (!Array.isArray(combArray)) {
              combArray = [combArray];
            }
            // Vypišme detailně každou kombinaci:
            for (const comb of combArray) {
              console.log(`Combination ID: ${comb.id}, default_on: ${comb.default_on}`);
              let optionValues = comb.associations?.product_option_values?.product_option_value;
              if (Array.isArray(optionValues)) {
                console.log("Option values:", optionValues.map(val => val.id_attribute));
              } else if (optionValues) {
                console.log("Option value:", optionValues.id_attribute);
              }
            }
            // Hledáme kombinaci, která má ve svých associations produktovou volbu s id_attribute "27" a default_on "1"
            existingCombination = combArray.find(c => {
              let optionValues = c.associations?.product_option_values?.product_option_value;
              let hasAttribute = false;
              if (Array.isArray(optionValues)) {
                hasAttribute = optionValues.some(val => val.id_attribute === "27");
              } else if (optionValues && optionValues.id_attribute) {
                hasAttribute = (optionValues.id_attribute === "27");
              }
              console.log(`Checking combination ${c.id}: default_on=${c.default_on}, hasAttribute27=${hasAttribute}`);
              return hasAttribute && c.default_on === "1";
            });
            if (existingCombination) {
              console.log(`Found existing combination: ID=${existingCombination.id}`);
            } else {
              console.log("No existing combination found with attribute id 27 a default_on=1");
            }
          }
        } catch (err) {
          console.error(`Chyba při získávání kombinací pro produkt ${productId}:`, err.message);
        }

        const combinationData = {
          combination: {
            id_product: productId.toString(),
            default_on: "1",
            minimal_quantity: "1",
            associations: {
              product_option_values: {
                product_option_value: [
                  { id_attribute: "27" }
                ]
              }
            }
          }
        };
        const combinationPayload = removeEmpty(combinationData);
        const xmlCombination = js2xmlparser.parse("prestashop", combinationPayload, { declaration: { include: true } });
        console.log("=== FINAL PAYLOAD (XML) pro kombinaci ===");
        console.log(xmlCombination);

        try {
          if (existingCombination && existingCombination.id) {
            const updateUrl = `${prestaApiUrl}/combinations/${existingCombination.id}`;
            const xmlUpdateComb = js2xmlparser.parse("prestashop", combinationPayload, { declaration: { include: true } });
            console.log(`Aktualizuji existující kombinaci s ID ${existingCombination.id} na URL: ${updateUrl}`);
            await axios.put(
              updateUrl,
              xmlUpdateComb,
              {
                auth: { username: prestaApiKey, password: '' },
                headers: { 'Content-Type': 'text/xml' }
              }
            );
            console.log(`Kombinace pro produkt ${PartNo} byla úspěšně aktualizována.`);
          } else {
            console.log(`Vytvářím novou kombinaci pro produkt ${PartNo}...`);
            await axios.post(
              `${prestaApiUrl}/combinations`,
              xmlCombination,
              {
                auth: { username: prestaApiKey, password: '' },
                headers: { 'Content-Type': 'text/xml' }
              }
            );
            console.log(`K produktu ${PartNo} byla vytvořena nová kombinace.`);
          }
        } catch (err) {
          console.error(`Chyba při vytváření/aktualizaci kombinace pro produkt ${PartNo}: ${err.message}`);
          if (err.response) {
            console.error("HTTP status:", err.response.status);
            console.error("Response data:", err.response.data);
          }
        }

        // Nahrání obrázku, pokud je k dispozici URL
        if (ImageUrl) {
          await updateProductImage(productId, ImageUrl);
        }
      }
    }

    console.log(`\n===== Hotovo: Zpracováno ${totalProcessed} produktů, Chyb: ${totalErrors} =====\n`);
    return res.status(200).json({
      success: true,
      message: `Celkem zpracováno ${totalProcessed} produktů, chyb: ${totalErrors}`
    });
  } catch (error) {
    console.error("Chyba v endpointu /prestashop/create-products-with-combinations:", error.message);
    return res.status(500).json({
      success: false,
      message: "Chyba při zpracování produktů",
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});





// vytvoření produktů v prestashop
app.get('/prestashop/create-simple-products', async (req, res) => {
  let connection;
  try {
    console.log("=== /prestashop/create-simple-products endpoint byl zavolán ===");

    // 1) Připojení k databázi
    connection = await poolC5tpms.getConnection();
    connection.query = util.promisify(connection.query);

    // 2) Konfigurace Prestashop API
    const prestaApiUrl = process.env.PNEUTYRES_API_URL;
    const prestaApiKey = process.env.PNEUTYRES_API_KEY;

    // Pomocné moduly
    const parser = new xml2js.Parser({ explicitArray: false });

    // -------------------------------------------------------------------------------------
    // FUNKCE: "slugify" pro link_rewrite
    // -------------------------------------------------------------------------------------
    function slugify(text) {
      return text.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
    }

    // -------------------------------------------------------------------------------------
    // FUNKCE: Odstranění prázdných/null/undefined hodnot z JSONu
    // -------------------------------------------------------------------------------------
    function removeEmpty(obj) {
      if (typeof obj !== 'object' || obj === null) return obj;
      return Object.keys(obj).reduce((acc, key) => {
        const value = removeEmpty(obj[key]);
        if (value !== '' && value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, Array.isArray(obj) ? [] : {});
    }

    // -------------------------------------------------------------------------------------
    // FUNKCE: Zjištění / založení výrobce
    // -------------------------------------------------------------------------------------
    async function getOrCreateManufacturerInPrestashop(manufacturerName) {
      if (!manufacturerName) {
        console.log("ManufacturerName je prázdný -> vracím null");
        return null;
      }
      try {
        const filterUrl = `${prestaApiUrl}/manufacturers?filter[name]=[${encodeURIComponent(manufacturerName)}]&display=full`;
        console.log(`Hledám výrobce "${manufacturerName}" v PrestaShopu GET: ${filterUrl}`);
        const checkResp = await axios.get(filterUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml' }
        });
        const parsed = await parser.parseStringPromise(checkResp.data);
        console.log("Odpověď z Presta při hledání výrobce:", JSON.stringify(parsed, null, 2));

        if (parsed?.prestashop?.manufacturers?.manufacturer) {
          let found = parsed.prestashop.manufacturers.manufacturer;
          if (Array.isArray(found)) {
            found = found[0];
          }
          if (found && found.id) {
            console.log(`Výrobce "${manufacturerName}" existuje s ID: ${found.id}`);
            return found.id;
          }
        }

        // Pokud výrobce neexistuje, založíme nového
        console.log(`Výrobce "${manufacturerName}" neexistuje, jdu ho vytvořit...`);
        const newManufacturerPayload = {
          manufacturer: {
            active: "1",
            name: manufacturerName
          }
        };
        const cleanPayload = removeEmpty(newManufacturerPayload);
        const manufacturerXml = js2xmlparser.parse("prestashop", cleanPayload, { declaration: { include: true } });
        console.log("XML payload pro vytvoření výrobce:");
        console.log(manufacturerXml);

        await axios.post(
          `${prestaApiUrl}/manufacturers`,
          manufacturerXml,
          {
            auth: { username: prestaApiKey, password: '' },
            headers: { 'Content-Type': 'text/xml' }
          }
        );
        console.log(`Výrobce "${manufacturerName}" byl úspěšně vytvořen.`);

        // Znovu zkontrolujeme, abychom získali ID nově vytvořeného výrobce
        const checkNewResp = await axios.get(filterUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml' }
        });
        const parsedNew = await parser.parseStringPromise(checkNewResp.data);
        if (parsedNew?.prestashop?.manufacturers?.manufacturer) {
          let createdMf = parsedNew.prestashop.manufacturers.manufacturer;
          if (Array.isArray(createdMf)) {
            createdMf = createdMf[0];
          }
          if (createdMf && createdMf.id) {
            console.log(`Nově vytvořený výrobce "${manufacturerName}" má ID: ${createdMf.id}`);
            return createdMf.id;
          }
        }
        console.error(`Nepodařilo se získat ID nově vytvořeného výrobce "${manufacturerName}"`);
        return null;
      } catch (err) {
        console.error("Chyba při getOrCreateManufacturerInPrestashop:", err.message);
        if (err.response?.data) {
          console.error("Response data:", err.response.data);
        }
        return null;
      }
    }

    // -------------------------------------------------------------------------------------
    // FUNKCE: Zjištění / založení nové hodnoty pro danou feature
    // -------------------------------------------------------------------------------------
    async function getOrCreateFeatureValue(featureId, valueName) {
      if (!valueName) {
        console.log(`Hodnota pro feature ${featureId} je prázdná -> vracím null`);
        return null;
      }

      try {
        // 1) Ověříme, zda daná hodnota už existuje
        const filterUrl = `${prestaApiUrl}/product_feature_values?filter[id_feature]=[${featureId}]&filter[value]=[${encodeURIComponent(valueName)}]&display=full`;
        console.log(`GET -> ${filterUrl}`);
        const checkResp = await axios.get(filterUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml' }
        });
        const parsed = await parser.parseStringPromise(checkResp.data);

        if (parsed?.prestashop?.product_feature_values?.product_feature_value) {
          let found = parsed.prestashop.product_feature_values.product_feature_value;
          if (Array.isArray(found)) {
            found = found[0];
          }
          // Pokud existuje, vracíme jeho ID
          if (found?.id) {
            console.log(`FeatureValue "${valueName}" už existuje s ID ${found.id}`);
            return found.id;
          }
        }

        // 2) Neexistuje – založíme ji
        console.log(`FeatureValue "${valueName}" neexistuje, jdu založit (featureId = ${featureId})...`);
        const payload = {
          product_feature_value: {
            id_feature: featureId.toString(),
            value: {
              language: {
                "@": { id: "1" },
                "#": valueName
              }
            }
          }
        };
        const cleanPayload = removeEmpty(payload);
        const xmlPayload = js2xmlparser.parse("prestashop", cleanPayload, { declaration: { include: true } });
        console.log("XML payload pro vytvoření hodnoty feature:");
        console.log(xmlPayload);

        await axios.post(
          `${prestaApiUrl}/product_feature_values`,
          xmlPayload,
          {
            auth: { username: prestaApiKey, password: '' },
            headers: { 'Content-Type': 'text/xml' }
          }
        );
        console.log(`FeatureValue "${valueName}" pro featureId ${featureId} byla úspěšně vytvořena.`);

        // 3) Znovu provedeme GET, abychom si z ní vytáhli ID
        const checkNewResp = await axios.get(filterUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml' }
        });
        const parsedNew = await parser.parseStringPromise(checkNewResp.data);
        if (parsedNew?.prestashop?.product_feature_values?.product_feature_value) {
          let created = parsedNew.prestashop.product_feature_values.product_feature_value;
          if (Array.isArray(created)) {
            created = created[0];
          }
          if (created?.id) {
            console.log(`Nově vytvořená hodnota feature "${valueName}" má ID: ${created.id}`);
            return created.id;
          }
        }
        console.error(`Nepodařilo se zjistit ID nově vytvořené hodnoty feature (valueName="${valueName}")`);
        return null;

      } catch (error) {
        console.error("Chyba při getOrCreateFeatureValue:", error.message);
        if (error.response?.data) {
          console.error("Response data:", error.response.data);
        }
        return null;
      }
    }

    // -------------------------------------------------------------------------------------
    // FUNKCE: Smazání všech obrázků produktu
    // -------------------------------------------------------------------------------------
    async function removeProductImages(productId) {
      try {
        console.log(`\n--- Odstraňuji obrázky produktu s ID: ${productId} ---`);
        const imagesUrl = `${prestaApiUrl}/images/products/${productId}`;
        console.log(`GET -> ${imagesUrl}`);
        const resp = await axios.get(imagesUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml' }
        });
        const parsed = await parser.parseStringPromise(resp.data);
        console.log(`PARSED obrázky produktu ${productId}:\n`, JSON.stringify(parsed, null, 2));

        if (parsed?.prestashop?.image?.declination) {
          let images = parsed.prestashop.image.declination;
          if (!Array.isArray(images)) images = [images];
          console.log(`Produkt ${productId} má ${images.length} obrázků, jdu je mazat...`);

          for (const img of images) {
            const imageId = img.$?.['xlink:href'] ? img.$['xlink:href'].split('/').pop() : null;
            if (!imageId) {
              console.warn(`Obrázek nemá platné ID, přeskočen.`, img);
              continue;
            }
            const deleteUrl = `${prestaApiUrl}/images/products/${productId}/${imageId}`;
            console.log(`DELETE -> ${deleteUrl}`);
            try {
              const deleteResp = await axios.delete(deleteUrl, {
                auth: { username: prestaApiKey, password: '' },
                headers: { 'Content-Type': 'text/xml' }
              });
              console.log(`Obrázek ${imageId} smazán, status = ${deleteResp.status}`);
            } catch (deleteErr) {
              console.error(`Chyba při mazání obrázku ${imageId}: ${deleteErr.message}`);
              if (deleteErr.response) {
                console.error('PrestaShop response data:', deleteErr.response.data);
              }
            }
          }
        } else {
          console.log(`Produkt ${productId} nemá žádné obrázky podle endpointu /images/products.`);
        }
      } catch (error) {
        console.error(`Chyba při získávání obrázků produktu ${productId}: ${error.message}`);
        if (error.response) {
          console.error('PrestaShop response data:', error.response.data);
        }
      }
    }

    // -------------------------------------------------------------------------------------
    // FUNKCE: Nahraje nový obrázek k produktu, předtím smaže staré.
    // Obrázek se může načíst buď z URL nebo z lokální UNC cesty.
    // -------------------------------------------------------------------------------------
    async function updateProductImage(productId, imageUrl) {
      try {
        // Nejprve smažu staré obrázky
        await removeProductImages(productId);
        let imageStream;

        // Rozlišení, zda se jedná o URL nebo lokální UNC cestu
        if (imageUrl.startsWith('\\\\')) {
          // Lokální UNC cesta – přímo vytvoříme read stream
          console.log(`Obrázek se načítá z lokální UNC cesty: ${imageUrl}`);
          imageStream = fs.createReadStream(imageUrl);
        } else {
          // Předpokládáme HTTP URL – upravíme URL přidáním parametru b2buserid=6956
          const modifiedImageUrl = imageUrl.includes('?')
            ? `${imageUrl}&b2buserid=6956`
            : `${imageUrl}?b2buserid=6956`;
          console.log(`Obrázek se načítá z URL: ${modifiedImageUrl}`);
          const response = await axios.get(modifiedImageUrl, { responseType: 'stream' });
          imageStream = response.data;
        }

        // Uložíme obrázek do dočasného souboru
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `temp_image_${productId}.jpg`);
        const writer = fs.createWriteStream(tempFilePath);
        imageStream.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        console.log(`Obrázek stažen do ${tempFilePath}`);

        // Připravím form-data
        const form = new FormData();
        form.append('image', fs.createReadStream(tempFilePath));
        const uploadUrl = `${prestaApiUrl}/images/products/${productId}/`;
        console.log(`Nahrávám obrázek na: ${uploadUrl}`);

        const uploadResp = await axios.post(uploadUrl, form, {
          auth: { username: prestaApiKey, password: '' },
          headers: form.getHeaders()
        });
        console.log(`Upload úspěšný, status ->`, uploadResp.status);

        // Smažu dočasný soubor
        fs.unlinkSync(tempFilePath);
      } catch (error) {
        console.error(`Chyba při nahrávání obrázku k produktu ${productId}:`, error.message);
        if (error.response) {
          console.error('Response data:', error.response.data);
        }
      }
    }

    // 3) Načtení produktů z tabulky Products včetně nových sloupců
    const query = `
      SELECT
        PartNo,
        DisplayName,
        EAN,
        \`1_eshop\`,
        Width,
        Profile,
        Diameter,
        ImageUrl,
        Manufacturer,
        Axle AS Naprava,
        TyreUsage AS Provoz,
        MS,
        Mountain,
        TagV2021_FuelEfficiencyClass,
        TagV2021_WetGripClass,
        TagV2021_RollingNoise,
        TagV2021_RollingNoise_dB,
        Weight,
        Pattern
      FROM Products
    `;
    const products = await connection.query(query);
    console.log(`Nalezeno ${products.length} produktů pro zpracování.`);

    let totalProcessed = 0;
    let totalErrors = 0;

    // ---------------------------------------------------------------------
    // MAPOVACÍ objekty pro některé vlastnosti (kde se jen dohledává ID)
    // ---------------------------------------------------------------------
    const fuelEfficiencyMapping = {
      "D": "221927",
      "C": "221926",
      "B": "221925",
      "A": "221924",
      "G": "221930",
      "F": "221929",
      "E": "221928"
    };

    const wetGripMapping = {
      "G": "221938",
      "F": "221937",
      "E": "221936",
      "D": "221935",
      "C": "221934",
      "B": "221933",
      "A": "221932"
    };

    const rollingNoiseMapping = {
      "E": "221943",
      "D": "221942",
      "C": "221941",
      "B": "221940",
      "A": "221939"
    };

    const rollingNoiseDbMapping = {
      "80": "221956",
      "79": "221955",
      "78": "221954",
      "77": "221953",
      "76": "221952",
      "75": "221951",
      "74": "221950",
      "73": "221949",
      "72": "221948",
      "71": "221947",
      "70": "221946",
      "69": "221945",
      "68": "221944"
    };

    // -----------------------------------------------------------------------
    // HLAVNÍ CYKLUS - procházení jednotlivých produktů
    // -----------------------------------------------------------------------
    for (const product of products) {
      const {
        PartNo,
        DisplayName,
        EAN,
        '1_eshop': price,
        Width,
        Profile,
        Diameter,
        ImageUrl,
        Manufacturer,
        Naprava,   // alias Axle
        Provoz,    // alias TyreUsage
        MS,
        Mountain,
        TagV2021_FuelEfficiencyClass,
        TagV2021_WetGripClass,
        TagV2021_RollingNoise,
        TagV2021_RollingNoise_dB,
        Weight,
        Pattern
      } = product;

      console.log("\n------------------------------------------------------");
      console.log(`Zpracovávám produkt s PartNo "${PartNo}"`);
      console.log(`   DisplayName: ${DisplayName}`);
      console.log(`   EAN: ${EAN}`);
      console.log(`   Price: ${price}`);
      console.log(`   Manufacturer: ${Manufacturer}`);
      console.log(`   Náprava (Axle): ${Naprava}`);
      console.log(`   Provoz (TyreUsage): ${Provoz}`);
      console.log(`   MS: ${MS}`);
      console.log(`   Mountain: ${Mountain}`);
      console.log(`   TagV2021_FuelEfficiencyClass: ${TagV2021_FuelEfficiencyClass}`);
      console.log(`   TagV2021_WetGripClass: ${TagV2021_WetGripClass}`);
      console.log(`   TagV2021_RollingNoise: ${TagV2021_RollingNoise}`);
      console.log(`   TagV2021_RollingNoise_dB: ${TagV2021_RollingNoise_dB}`);
      console.log(`   Weight: ${Weight}`);
      console.log(`   Pattern (Dezén): ${Pattern}`);
      console.log("------------------------------------------------------\n");

      // 1) Výrobce
      const manufacturerPsId = await getOrCreateManufacturerInPrestashop(Manufacturer);
      console.log(`Výrobce "${Manufacturer}" -> ID v PrestaShopu: ${manufacturerPsId}`);

      // 2) Vytvořím link_rewrite
      const linkRewrite = slugify(DisplayName);

      // 3) Zjištění ps_id pro stávající vlastnosti (šířka, profil, ráfek) - pokud chceš i tam dynamicky zakládat, použij stejnou logiku
      let cleanedWidth = Width ? Width.toString().replace(/\.00$/, '') : "";
      let widthPsId = null;
      if (cleanedWidth) {
        try {
          const q = `SELECT ps_id FROM sirka WHERE value = ? LIMIT 1`;
          const r = await connection.query(q, [cleanedWidth]);
          if (r?.length > 0) {
            widthPsId = r[0].ps_id;
          }
        } catch (err) {
          console.error(`Chyba při SELECT sirka pro ${cleanedWidth}:`, err.message);
        }
      }

      let cleanedProfile = Profile ? Profile.toString().replace(/\.00$/, '') : "";
      let profilePsId = null;
      if (cleanedProfile) {
        try {
          const q = `SELECT ps_id FROM profil WHERE value = ? LIMIT 1`;
          const r = await connection.query(q, [cleanedProfile]);
          if (r?.length > 0) {
            profilePsId = r[0].ps_id;
          }
        } catch (err) {
          console.error(`Chyba při SELECT profil pro ${cleanedProfile}:`, err.message);
        }
      }

      let cleanedDiameter = Diameter ? Diameter.toString().replace(/\.00$/, '') : "";
      let rafekPsId = null;
      if (cleanedDiameter) {
        try {
          const q = `SELECT ps_id FROM rafek WHERE value = ? LIMIT 1`;
          const r = await connection.query(q, [cleanedDiameter]);
          if (r?.length > 0) {
            rafekPsId = r[0].ps_id;
          }
        } catch (err) {
          console.error(`Chyba při SELECT rafek pro ${cleanedDiameter}:`, err.message);
        }
      }

      // 4) Zpracování Nápravy (alias Axle)
      let napravPsId = null;
      if (Naprava) {
        try {
          const q = `SELECT ps_id FROM pozice WHERE value = ? LIMIT 1`;
          const r = await connection.query(q, [Naprava]);
          if (r?.length > 0) {
            napravPsId = r[0].ps_id;
          }
        } catch (err) {
          console.error(`Chyba při SELECT pozice pro ${Naprava}:`, err.message);
        }
      }

      // 5) Zpracování Provozu (alias TyreUsage)
      let provozPsId = null;
      if (Provoz) {
        try {
          const q = `SELECT ps_id FROM zpusob_uziti WHERE value = ? LIMIT 1`;
          const r = await connection.query(q, [Provoz]);
          if (r?.length > 0) {
            provozPsId = r[0].ps_id;
          }
        } catch (err) {
          console.error(`Chyba při SELECT zpusob_uziti pro ${Provoz}:`, err.message);
        }
      }

      // 6) Sestavení pole vlastností pro produkt (feature values)
      const productFeatures = [];

      if (widthPsId) {
        productFeatures.push({ id: "94", id_feature_value: widthPsId.toString() });
      }
      if (profilePsId) {
        productFeatures.push({ id: "95", id_feature_value: profilePsId.toString() });
      }
      if (rafekPsId) {
        productFeatures.push({ id: "96", id_feature_value: rafekPsId.toString() });
      }
      if (napravPsId) {
        productFeatures.push({ id: "97", id_feature_value: napravPsId.toString() });
      }
      if (provozPsId) {
        productFeatures.push({ id: "98", id_feature_value: provozPsId.toString() });
      }

      // 7) Zpracování nových vlastností – data jsou načtena přímo z tabulky Products
      // M+S – očekává se hodnota "Ano"
      if (MS) {
        if (MS.trim().toLowerCase() === "ano") {
          productFeatures.push({ id: "99", id_feature_value: "221922" });
        } else {
          console.warn(`Struktura dat M+S neodpovídá očekávání (MS: ${MS}). Očekává se "Ano".`);
        }
      } else {
        console.warn("Chybí hodnota M+S (MS) u produktu s PartNo:", PartNo);
      }

      // Vločka v Hoře – očekává se hodnota "Ano"
      if (Mountain) {
        if (Mountain.trim().toLowerCase() === "ano") {
          productFeatures.push({ id: "100", id_feature_value: "221933" });
        } else {
          console.warn(`Struktura dat Vločka v Hoře neodpovídá očekávání (Mountain: ${Mountain}). Očekává se "Ano".`);
        }
      } else {
        console.warn("Chybí hodnota Vločka v Hoře (Mountain) u produktu s PartNo:", PartNo);
      }

      // Valivý odpor – mapování
      if (TagV2021_FuelEfficiencyClass) {
        const valueStr = TagV2021_FuelEfficiencyClass.toString().trim();
        if (fuelEfficiencyMapping[valueStr]) {
          productFeatures.push({ id: "101", id_feature_value: fuelEfficiencyMapping[valueStr] });
        } else {
          console.warn(`Neočekávaná hodnota Valivého odporu (TagV2021_FuelEfficiencyClass: ${TagV2021_FuelEfficiencyClass}) u produktu s PartNo: ${PartNo}`);
        }
      } else {
        console.warn("Chybí hodnota Valivého odporu (TagV2021_FuelEfficiencyClass) u produktu s PartNo:", PartNo);
      }

      // Přilnavost – mapování
      if (TagV2021_WetGripClass) {
        const valueStr = TagV2021_WetGripClass.toString().trim();
        if (wetGripMapping[valueStr]) {
          productFeatures.push({ id: "102", id_feature_value: wetGripMapping[valueStr] });
        } else {
          console.warn(`Neočekávaná hodnota Přilnavosti (TagV2021_WetGripClass: ${TagV2021_WetGripClass}) u produktu s PartNo: ${PartNo}`);
        }
      } else {
        console.warn("Chybí hodnota Přilnavosti (TagV2021_WetGripClass) u produktu s PartNo:", PartNo);
      }

      // Hlučnost – mapování
      if (TagV2021_RollingNoise) {
        const valueStr = TagV2021_RollingNoise.toString().trim();
        if (rollingNoiseMapping[valueStr]) {
          productFeatures.push({ id: "103", id_feature_value: rollingNoiseMapping[valueStr] });
        } else {
          console.warn(`Neočekávaná hodnota Hlučnosti (TagV2021_RollingNoise: ${TagV2021_RollingNoise}) u produktu s PartNo: ${PartNo}`);
        }
      } else {
        console.warn("Chybí hodnota Hlučnosti (TagV2021_RollingNoise) u produktu s PartNo:", PartNo);
      }

      // Hlučnost (db) – mapování
      if (TagV2021_RollingNoise_dB) {
        const valueStr = TagV2021_RollingNoise_dB.toString().trim();
        if (rollingNoiseDbMapping[valueStr]) {
          productFeatures.push({ id: "104", id_feature_value: rollingNoiseDbMapping[valueStr] });
        } else {
          console.warn(`Neočekávaná hodnota Hlučnosti (db) (TagV2021_RollingNoise_dB: ${TagV2021_RollingNoise_dB}) u produktu s PartNo: ${PartNo}`);
        }
      } else {
        console.warn("Chybí hodnota Hlučnosti (db) (TagV2021_RollingNoise_dB) u produktu s PartNo:", PartNo);
      }

      // Dezén (Pattern) - teď už s logikou "pokud neexistuje -> vytvořím"
      if (Pattern) {
        const patternValue = Pattern.toString().trim();
        // Získáme ID feature value pro Dezén
        const patternPsId = await getOrCreateFeatureValue(105, patternValue);
        if (patternPsId) {
          productFeatures.push({ id: "105", id_feature_value: patternPsId.toString() });
        } else {
          console.warn(`Nepodařilo se založit / získat id pro Dezén (Pattern: ${patternValue}) u produktu s PartNo: ${PartNo}`);
        }
      } else {
        console.warn("Chybí hodnota Dezén (Pattern) u produktu s PartNo:", PartNo);
      }

      // 8) Vytvoření produktu (payload)
      const productData = {
        product: {
          reference: PartNo || "",
          ean13: EAN || "",
          price: price ? price.toString() : "0.00",
          active: "1",
          advanced_stock_management: "0",
          low_stock_alert: "0",
          id_category_default: "8",
          id_shop_default: "1",
          minimal_quantity: "1",
          available_for_order: "1",
          state: "1",
          id_manufacturer: manufacturerPsId ? manufacturerPsId.toString() : "0",
          name: {
            language: [
              { "@": { id: "1" }, "#": DisplayName || "" }
            ]
          },
          link_rewrite: {
            language: [
              { "@": { id: "1" }, "#": linkRewrite }
            ]
          },
          associations: {
            categories: {
              category: [{ id: "8" }]
            }
          }
        }
      };

      // Pokud máme nějaké features, vložíme je
      if (productFeatures.length > 0) {
        productData.product.associations = productData.product.associations || {};
        productData.product.associations.product_features = {
          product_feature: productFeatures
        };
      }

      // 9) Hmotnost
      if (Weight) {
        productData.product.weight = Weight.toString();
      } else {
        console.warn(`Chybí hodnota Weight u produktu s PartNo: ${PartNo}`);
      }

      // 10) Ověření, zda produkt existuje, create nebo update
      const checkUrl = `${prestaApiUrl}/products?filter[reference]=[${PartNo}]&display=full`;
      let existingProductId = null;
      try {
        const checkResp = await axios.get(checkUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml' }
        });
        const parsed = await parser.parseStringPromise(checkResp.data);

        if (parsed?.prestashop?.products?.product) {
          let foundProd = parsed.prestashop.products.product;
          if (Array.isArray(foundProd)) {
            foundProd = foundProd[0];
          }
          existingProductId = foundProd?.id;
          if (existingProductId) {
            console.log(`Produkt s referencí ${PartNo} existuje, ID: ${existingProductId}`);
          }
        } else {
          console.log(`Produkt s referencí ${PartNo} nebyl v PrestaShopu nalezen (bude vytvořen).`);
        }
      } catch (err) {
        console.error(`Chyba při kontrole existence produktu ${PartNo}:`, err.message);
      }

      // 11) Převod do XML
      const finalPayload = removeEmpty(productData);
      const xmlBody = js2xmlparser.parse("prestashop", finalPayload, { declaration: { include: true } });

      console.log("=== FINAL PAYLOAD (JSON) pro produkt:", PartNo, "===");
      console.log(JSON.stringify(finalPayload, null, 2));
      console.log("=== FINAL PAYLOAD (XML) pro produkt:", PartNo, "===");
      console.log(xmlBody);

      // 12) CREATE nebo UPDATE
      let productId = null;

      if (existingProductId) {
        // UPDATE
        finalPayload.product.id = existingProductId;
        const xmlUpdate = js2xmlparser.parse("prestashop", finalPayload, { declaration: { include: true } });

        try {
          await axios.put(
            `${prestaApiUrl}/products/${existingProductId}`,
            xmlUpdate,
            {
              auth: { username: prestaApiKey, password: '' },
              headers: { 'Content-Type': 'text/xml' }
            }
          );
          productId = existingProductId;
          console.log(`Produkt ${PartNo} (ID ${existingProductId}) byl úspěšně aktualizován.`);
          totalProcessed++;
        } catch (err) {
          totalErrors++;
          console.error(`Chyba při aktualizaci produktu ${PartNo}:`, err.response ? err.response.data : err.message);
        }

      } else {
        // CREATE
        try {
          await axios.post(
            `${prestaApiUrl}/products`,
            xmlBody,
            {
              auth: { username: prestaApiKey, password: '' },
              headers: { 'Content-Type': 'text/xml' }
            }
          );

          // Zjistíme ID nově vytvořeného produktu
          const newCheckResp = await axios.get(checkUrl, {
            auth: { username: prestaApiKey, password: '' },
            headers: { 'Content-Type': 'text/xml' }
          });
          const newParsed = await parser.parseStringPromise(newCheckResp.data);

          if (newParsed?.prestashop?.products?.product) {
            let createdProd = newParsed.prestashop.products.product;
            if (Array.isArray(createdProd)) {
              createdProd = createdProd[0];
            }
            productId = createdProd?.id;
          }
          console.log(`Nový produkt s referencí ${PartNo} byl vytvořen, ID = ${productId}`);
          totalProcessed++;
        } catch (err) {
          totalErrors++;
          console.error(`Chyba při vytváření produktu ${PartNo}:`, err.response ? err.response.data : err.message);
        }
      }

      // 13) Nahrání obrázku, pokud je
      if (productId && ImageUrl) {
        await updateProductImage(productId, ImageUrl);
      }
    }

    console.log(`\n===== Hotovo: Zpracováno ${totalProcessed} produktů, Chyb: ${totalErrors} =====\n`);
    return res.status(200).json({
      success: true,
      message: `Celkem zpracováno ${totalProcessed} produktů, chyb: ${totalErrors}`
    });
  } catch (error) {
    console.error("Chyba v endpointu /prestashop/create-simple-products:", error.message);
    return res.status(500).json({
      success: false,
      message: "Chyba při zpracování produktů",
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});







app.get('/sync-stock-advanced', async (req, res) => {
  try {
    console.log('=== /sync-stock-advanced endpoint byl zavolán ===');

    // 1. Načtení produktů (jen id a reference) z PrestaShop API
    const productsResponse = await axios.get(`${pneutyresApi_URL}/products?display=[id,reference]`, {
      auth: {
        username: pneutyresApiKey,
        password: '' // heslo je prázdné
      }
    });
    const productsJson = await parser.parseStringPromise(productsResponse.data);
    const products = productsJson.prestashop.products[0].product;
    console.log(`Načteno ${products.length} produktů z PrestaShopu`);

    // Výsledky aktualizací pro report
    let updateResults = [];

    // 2. Pro každý produkt načteme kombinace
    for (const prod of products) {
      const productId = prod.id[0];
      
      // Načteme kombinace daného produktu
      const combResponse = await axios.get(
        `${pneutyresApi_URL}/combinations?filter[id_product]=[${productId}]&display=full`,
        { auth: { username: pneutyresApiKey, password: '' } }
      );
      const combJson = await parser.parseStringPromise(combResponse.data);
      
      // Pokud produkt nemá žádné kombinace, přeskočíme ho
      if (!combJson.prestashop.combinations) {
        console.log(`Produkt ${productId} nemá žádné kombinace.`);
        continue;
      }
      
      // Získáme data kombinací a zajistíme, že máme pole
      let combinations = combJson.prestashop.combinations[0].combination;
      if (!Array.isArray(combinations)) {
        combinations = [combinations];
      }
      
      // 3. Projdeme všechny kombinace
      for (const combination of combinations) {
        // Pokud je kombinace prázdná nebo nemá definované associations, přeskočíme ji.
        if (!combination || !combination.associations || !combination.associations[0]) {
          console.warn(`Produkt ${productId}, kombinace neobsahuje associations.`);
          continue;
        }
        
        let aktualizovat = false;
        const associations = combination.associations[0];
        if (
          associations.product_option_values &&
          associations.product_option_values[0] &&
          associations.product_option_values[0].product_option_value
        ) {
          let optionValues = associations.product_option_values[0].product_option_value;
          // Zajistíme, že optionValues je pole
          const optionsArray = Array.isArray(optionValues) ? optionValues : [optionValues];
          for (const option of optionsArray) {
            if (!option) continue;
            // Zkontrolujeme, zda máme definované id_attribute_group a id
            if (option.id_attribute_group && option.id_attribute_group[0] && option.id && option.id[0]) {
              const idAttributeGroup = option.id_attribute_group[0];
              const idValue = option.id[0];
              if (idAttributeGroup === "13" && idValue === "1") {
                aktualizovat = true;
                break;
              }
            }
          }
        }

        // Pokud jsme identifikovali kombinaci s atributem sklad = CZS, aktualizujeme stock_available na 0
        if (aktualizovat) {
          const stockResponse = await axios.get(
            `${pneutyresApi_URL}/stock_availables?filter[id_product]=[${productId}]&filter[id_product_attribute]=[${combination.id[0]}]&display=full`,
            { auth: { username: pneutyresApiKey, password: '' } }
          );
          const stockJson = await parser.parseStringPromise(stockResponse.data);
          
          if (
            stockJson.prestashop.stock_availables &&
            stockJson.prestashop.stock_availables[0].stock_available &&
            stockJson.prestashop.stock_availables[0].stock_available.length > 0
          ) {
            const stockRecord = stockJson.prestashop.stock_availables[0].stock_available[0];
            const stockId = stockRecord.id[0];

            // Připravíme XML payload pro update – nastavíme quantity na 0
            const updateXml = `<prestashop>
  <stock_available>
    <id>${stockId}</id>
    <quantity>0</quantity>
  </stock_available>
</prestashop>`;

            await axios.put(`${pneutyresApi_URL}/stock_availables/${stockId}`, updateXml, {
              auth: { username: pneutyresApiKey, password: '' },
              headers: { 'Content-Type': 'application/xml' }
            });

            console.log(`Produkt ${productId}, kombinace ${combination.id[0]} (sklad=CZS) aktualizován na 0.`);
            updateResults.push({
              productId,
              combinationId: combination.id[0],
              updated: true
            });
          } else {
            console.warn(`Pro produkt ${productId}, kombinaci ${combination.id[0]} nebyl nalezen stock_available záznam.`);
            updateResults.push({
              productId,
              combinationId: combination.id[0],
              updated: false,
              error: 'Stock available not found'
            });
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Synchronizace advanced stock management (atribut sklad=CZS) dokončena.',
      updates: updateResults
    });
  } catch (error) {
    console.error('Chyba při synchronizaci advanced stock:', error);
    return res.status(500).json({
      success: false,
      message: 'Chyba při synchronizaci advanced stock management.',
      details: error.message
    });
  }
});


// SYNCHRONIZACE skladů jednoduchých produktů
app.get('/pt-sync-stock', async (req, res) => {
  try {
    console.log('=== /pt-sync-stock endpoint byl zavolán ===');

    // 1. Načtení produktů z PrestaShopu (jen id a reference)
    const productsResponse = await axios.get(`${pneutyresApi_URL}/products?display=[id,reference]`, {
      auth: { username: pneutyresApiKey, password: '' }
    });
    const productsJson = await parser.parseStringPromise(productsResponse.data);
    const products = (productsJson.prestashop.products && productsJson.prestashop.products[0].product) || [];
    console.log(`Načteno ${products.length} produktů z PrestaShopu`);

    // 2. Načtení skladových dat ze SQL
    const sql = `SELECT Produkt, Celkem FROM IMPORT_PNEU_SKLAD`;
    const sqlResults = await queryPromise(sql);
    const stockMap = {};
    sqlResults.forEach(row => {
      stockMap[row.Produkt] = parseFloat(row.Celkem);
    });
    console.log('SQL data načtena, nalezeno záznamů:', Object.keys(stockMap).length);

    // 3. Aktualizace stock_availables pro každý produkt
    const updatePromises = products.map(async (prod) => {
      const productId = prod.id[0];
      const reference = prod.reference[0];
      const newStock = stockMap.hasOwnProperty(reference) ? stockMap[reference] : 0;

      try {
        console.log(`\nZpracovávám produkt ID=${productId}, reference=${reference}, nové množství=${newStock}`);

        // Získání stock_available podle id_product
        const stockResponse = await axios.get(
          `${pneutyresApi_URL}/stock_availables?filter[id_product]=${productId}`,
          { auth: { username: pneutyresApiKey, password: '' } }
        );
        const stockJson = await parser.parseStringPromise(stockResponse.data);

        // --- PRO DEBUG: zobrazíme, jak vypadá JSON po parseStringPromise ---
        // console.log('Výsledek stockJson:', JSON.stringify(stockJson, null, 2));

        // stock_availables bývá pole, i když je tam jen jeden element
        const stockAvailablesNode = stockJson?.prestashop?.stock_availables;
        if (!stockAvailablesNode) {
          const msg = `Nenalezen <stock_availables> u produktu ${productId} (ref: ${reference})`;
          console.error(msg);
          return { productId, reference, newStock, updated: false, error: msg };
        }

        // Vezmeme první prvek pole stock_availables
        // a z něj vyextrahujeme pole stock_available
        const firstStockAvailableArray = Array.isArray(stockAvailablesNode)
          ? stockAvailablesNode[0]?.stock_available
          : stockAvailablesNode.stock_available;

        // Ujistíme se, že máme pole se záznamy
        let stockArr = Array.isArray(firstStockAvailableArray)
          ? firstStockAvailableArray
          : [firstStockAvailableArray].filter(Boolean);

        if (!stockArr.length) {
          const msg = `Stock_available záznam nenalezen pro produkt ${productId} (ref: ${reference})`;
          console.error(msg);
          return { productId, reference, newStock, updated: false, error: msg };
        }

        // Každý stock_available má atribut $.id
        const stockRecordId = stockArr[0]?.$?.id;
        if (!stockRecordId) {
          const msg = `Nepodařilo se získat ID stock_available pro produkt ${productId} (ref: ${reference})`;
          console.error(msg);
          return { productId, reference, newStock, updated: false, error: msg };
        }

        // XML payload pro aktualizaci
        const updateObj = {
          prestashop: {
            stock_available: {
              id: [stockRecordId],
              id_product: [productId],
              id_product_attribute: ['0'],
              depends_on_stock: ['0'],
              out_of_stock: ['2'],
              quantity: [newStock.toString()],
              id_shop: ['1']
            }
          }
        };

        const builder = new xml2js.Builder({ xmldec: { version: '1.0', encoding: 'UTF-8' } });
        const updateXml = builder.buildObject(updateObj);

        // PUT request s kompletním payloadem
        await axios.put(`${pneutyresApi_URL}/stock_availables`, updateXml, {
          auth: { username: pneutyresApiKey, password: '' },
          headers: { 'Content-Type': 'application/xml' }
        });

        console.log(`Aktualizován produkt ${productId} (ref: ${reference}) na množství ${newStock}`);
        return { productId, reference, newStock, updated: true };
      } catch (err) {
        console.error(`Chyba u produktu ${productId} (ref: ${reference}):`, err.message);
        return { productId, reference, newStock, updated: false, error: err.message };
      }
    });

    const updateResults = await Promise.all(updatePromises);
    return res.status(200).json({
      success: true,
      message: 'Synchronizace skladu dokončena',
      updates: updateResults
    });
  } catch (error) {
    console.error('Chyba při synchronizaci skladu:', error);
    return res.status(500).json({
      success: false,
      message: 'Chyba při synchronizaci skladu',
      details: error.message
    });
  }
});

app.get('/filter-templates', (req, res) => {
  const { isActive } = req.query;
  let sql = 'SELECT * FROM Analytic_FilterTemplates';
  const params = [];

  if (isActive !== undefined) {
    sql += ' WHERE isActive = ?';
    params.push(isActive === 'true' ? 1 : 0);
  }

  poolC5tpms.query(sql, params, (err, results) => {
    if (err) {
      console.error('Chyba při načítání ceníků:', err);
      return res.status(500).json({ error: 'Chyba při načítání dat.' });
    }
    res.json(results);
  });
});


// Upsert do tabulky Products z PLOR
app.post('/upsert-to-products', (req, res) => {
  const products = req.body.data;

  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'Žádné položky k upsertu.' });
  }

  const sql = `INSERT INTO c5tpms.Products
    (
      PartNo, EAN, DisplayName, Manufacturer, Axle, TyreUsage, RetailPrice_CZ, Width, Profile,
      LoadIndexFrom, LoadIndexTo, SpeedIndex, Weight, Pattern, Diameter, ConstructionType,
      \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`, B2B
    )
    VALUES ?
    ON DUPLICATE KEY UPDATE
      EAN=VALUES(EAN),
      DisplayName=VALUES(DisplayName),
      Manufacturer=VALUES(Manufacturer),
      Axle=VALUES(Axle),
      TyreUsage=VALUES(TyreUsage),
      RetailPrice_CZ=VALUES(RetailPrice_CZ),
      Width=VALUES(Width),
      Profile=VALUES(Profile),
      LoadIndexFrom=VALUES(LoadIndexFrom),
      LoadIndexTo=VALUES(LoadIndexTo),
      SpeedIndex=VALUES(SpeedIndex),
      Weight=VALUES(Weight),
      Pattern=VALUES(Pattern),
      Diameter=VALUES(Diameter),
      ConstructionType=VALUES(ConstructionType),
      \`1_eshop\`=VALUES(\`1_eshop\`),
      \`2_pult\`=VALUES(\`2_pult\`),
      \`3_servis\`=VALUES(\`3_servis\`),
      \`4_vo\`=VALUES(\`4_vo\`),
      \`5_vip\`=VALUES(\`5_vip\`),
      \`6_indiv\`=VALUES(\`6_indiv\`),
      \`7_dopravci\`=VALUES(\`7_dopravci\`),
      B2B=VALUES(B2B)`;

  const values = products.map((p) => [
    p.C_Polozky,
    p.EAN,
    p.Nazev,
    p.Vyrobce,
    p.Naprava,
    p.Provoz,
    p.Cena,
    p.Sirka,
    p.Profil,
    p['Index nosnosti']?.split('/')[0] || null,
    p['Index nosnosti']?.split('/')[1] || null,
    p['Index rychlosti']?.toUpperCase() || null,
    parseFloat(p.Hmotnost) || null,
    p.Dezen || null,
    p.Rafek || null,
    p.Konstrukce || null,
    p["1_eshop"] || null,
    p["2_pult"] || null,
    p["3_servis"] || null,
    p["4_vo"] || null,
    p["5_vip"] || null,
    p["6_indiv"] || null,
    p["7_dopravci"] || null,
    p.B2B || null,
  ]);

  poolC5tpms.query(sql, [values], (err) => {
    if (err) {
      console.error('Chyba při upsertu položek:', err);
      return res.status(500).json({ error: 'Chyba při ukládání dat do databáze.' });
    }
    res.json({ message: 'Data byla úspěšně importována.' });
  });
});


// SYNCHRONIZACE KOMBINACÍ
// ================================================================================================================
//  Kompletní endpoint /pt-sync-stock-combinations s rozšířeným logováním
// ================================================================================================================

app.get('/pt-sync-stock-combinations', async (req, res) => {
  try {
    console.log('=== /pt-sync-stock-combinations endpoint byl zavolán ===');

    // 1) Načítání produktů z PrestaShopu
    console.log('Načítám seznam produktů z PrestaShopu...');
    const productsResponse = await axios.get(`${pneutyresApi_URL}/products?display=[id,reference]`, {
      auth: { username: pneutyresApiKey, password: '' }
    });
    console.log('Odezva PrestaShop /products:', productsResponse.status, productsResponse.statusText);
    console.log('Response data (raw):', productsResponse.data);

    // 2) Parsování XML
    console.log('Parsování XML odpovědi s produkty...');
    const productsJson = await parser.parseStringPromise(productsResponse.data);
    console.log('Výsledek parseStringPromise (productsJson):', JSON.stringify(productsJson, null, 2));

    const products = (productsJson.prestashop.products && productsJson.prestashop.products[0].product) || [];
    console.log(`Načteno ${products.length} produktů z PrestaShopu.`);

    // 3) Načtení skladových dat ze SQL
    console.log('Spouštím SQL dotaz na IMPORT_PNEU_SKLAD...');
    const sql = 'SELECT Produkt, Celkem FROM IMPORT_PNEU_SKLAD';
    const sqlResults = await queryPromise(sql);
    console.log('SQL výsledky (prvních 5 záznamů):', sqlResults.slice(0,5));

    // Vytvoříme mapu reference -> množství
    const stockMap = {};
    sqlResults.forEach((row) => {
      if (row && row.Produkt) {
        stockMap[row.Produkt] = parseFloat(row.Celkem) || 0;
      }
    });
    console.log('SQL data načtena, počet záznamů:', Object.keys(stockMap).length);

    // 4) Pro každý produkt načteme kombinace a aktualizujeme
    const updateResults = [];

    for (const prod of products) {
      const productId = prod.id[0];
      const reference = prod.reference[0];
      const newStock = stockMap[reference] || 0;

      console.log('--------------------------------------------------------------------------------');
      console.log(`Zpracovávám produkt: ID=${productId}, Reference=${reference}, newStock=${newStock}`);

      try {
        // 4.1) Získání kombinací produktu
        console.log(`Načítám kombinace pro produkt ID=${productId}...`);
        const combinationsResponse = await axios.get(
          `${pneutyresApi_URL}/combinations?filter[id_product]=${productId}`,
          { auth: { username: pneutyresApiKey, password: '' } }
        );
        console.log('Odezva /combinations:', combinationsResponse.status, combinationsResponse.statusText);
        console.log('Response data (raw):', combinationsResponse.data);

        // 4.2) Parsování kombinací
        const combinationsJson = await parser.parseStringPromise(combinationsResponse.data);
        console.log('Výsledek parseStringPromise (combinationsJson):', JSON.stringify(combinationsJson, null, 2));

        const combinationsNode = combinationsJson?.prestashop?.combinations?.[0]?.combination;
        const combinations = Array.isArray(combinationsNode) ? combinationsNode : [];
        console.log(`Nalezeno ${combinations.length} kombinací.`);

        let combinationFound = false;

        // 4.3) Projdeme kombinace
        for (const comb of combinations) {
          // OPRAVA: Bezpečně načteme ID kombinace
          const combinationId = comb.id?.[0] || comb.$?.id;
          if (!combinationId) {
            console.log('Nepodařilo se získat ID kombinace. Přeskakuji...');
            continue;
          }
          console.log(`Kontroluji kombinaci ID=${combinationId}...`);

          // 4.4) Detaily kombinace (atributy)
          console.log(`Načítám detail kombinace ID=${combinationId}...`);
          const combDetailResp = await axios.get(`${pneutyresApi_URL}/combinations/${combinationId}`, {
            auth: { username: pneutyresApiKey, password: '' }
          });
          console.log('Odezva /combinations/${id}:', combDetailResp.status, combDetailResp.statusText);
          console.log('Response data (raw):', combDetailResp.data);

          const combDetailJson = await parser.parseStringPromise(combDetailResp.data);
          console.log('Výsledek parseStringPromise (combDetailJson):', JSON.stringify(combDetailJson, null, 2));

          // Vnořené objekty
          const comboObj = combDetailJson?.prestashop?.combination?.[0];
          const assocObj = comboObj?.associations?.[0];
          const povArrayObj = assocObj?.product_option_values?.[0];
          const options = povArrayObj?.product_option_value || [];

          console.log(`Kombinace ID=${combinationId} obsahuje ${options.length} atribut(ů).`);

          // 4.5) Hledáme, zda je tam atribut ID=27
          const hasDesiredAttribute = options.some((opt) => {
            const attributeId = opt.id?.[0] || opt.$?.id; // OPRAVA i tady
            return attributeId === '27';
          });

          if (hasDesiredAttribute) {
            console.log(`Kombinace ID=${combinationId} má požadovaný atribut s ID=27`);
            combinationFound = true;

            // 4.6) Načtení stock_available pro kombinaci
            console.log(
              `Načítám stock_availables pro product=${productId}, combination=${combinationId}...`
            );
            const stockResp = await axios.get(
              `${pneutyresApi_URL}/stock_availables?filter[id_product]=${productId}&filter[id_product_attribute]=${combinationId}`,
              { auth: { username: pneutyresApiKey, password: '' } }
            );
            console.log('Odezva /stock_availables:', stockResp.status, stockResp.statusText);
            console.log('Response data (raw):', stockResp.data);

            const stockJson = await parser.parseStringPromise(stockResp.data);
            console.log('Výsledek parseStringPromise (stockJson):', JSON.stringify(stockJson, null, 2));

            const stockAvailablesNode = stockJson?.prestashop?.stock_availables;
            if (!stockAvailablesNode) {
              const msg = `Nenalezen <stock_availables> u produktu ${productId}, kombinace ${combinationId}`;
              console.error(msg);
              updateResults.push({ productId, reference, newStock, updated: false, error: msg });
              break;
            }

            const firstSAArray = Array.isArray(stockAvailablesNode)
              ? stockAvailablesNode[0]?.stock_available
              : stockAvailablesNode.stock_available;
            const stockArray = Array.isArray(firstSAArray)
              ? firstSAArray
              : [firstSAArray].filter(Boolean);

            if (!stockArray.length) {
              const msg = `Stock_available záznam nenalezen pro produkt ${productId}, kombinace ${combinationId}`;
              console.error(msg);
              updateResults.push({ productId, reference, newStock, updated: false, error: msg });
              break;
            }

            const stockRecordId = stockArray[0]?.$?.id;
            if (!stockRecordId) {
              const msg = `Nepodařilo se získat ID stock_available pro produkt ${productId}, kombinace ${combinationId}`;
              console.error(msg);
              updateResults.push({ productId, reference, newStock, updated: false, error: msg });
              break;
            }

            // 4.7) Sestavení XML pro PUT
            const updateObj = {
              prestashop: {
                stock_available: {
                  id: [stockRecordId],
                  id_product: [productId],
                  id_product_attribute: [combinationId],
                  depends_on_stock: ['0'],
                  out_of_stock: ['2'],
                  quantity: [newStock.toString()],
                  id_shop: ['1']
                }
              }
            };

            const builder = new xml2js.Builder({ xmldec: { version: '1.0', encoding: 'UTF-8' } });
            const updateXml = builder.buildObject(updateObj);

            console.log('=== XML payload pro PUT /stock_availables ===');
            console.log(updateXml);

            // 4.8) PUT požadavek
            try {
              const putResp = await axios.put(`${pneutyresApi_URL}/stock_availables`, updateXml, {
                auth: { username: pneutyresApiKey, password: '' },
                headers: { 'Content-Type': 'application/xml' }
              });
              console.log('Odezva PUT /stock_availables:', putResp.status, putResp.statusText);
              console.log('Response data (raw):', putResp.data);

              console.log(
                `Aktualizováno množství kombinace (productId=${productId}, combinationId=${combinationId}) na: ${newStock}`
              );
              updateResults.push({
                productId,
                reference,
                combinationId,
                newStock,
                updated: true
              });
            } catch (putErr) {
              console.error('Chyba při PUT /stock_availables:', putErr);
              updateResults.push({
                productId,
                reference,
                combinationId,
                newStock,
                updated: false,
                error: putErr.message
              });
            }

            // nalezli jsme kombinaci => vyskočíme z for-cyklu
            break;
          }
        }

        // Pokud po všem nenajdeme atribut 27
        if (!combinationFound) {
          const msg = `Nenalezena kombinace s atributem [hodnota=27] pro produkt ${productId} (ref: ${reference})`;
          console.log(msg);
          updateResults.push({ productId, reference, newStock, updated: false, error: msg });
        }
      } catch (err) {
        console.error(`Chyba při zpracování produktu ID=${productId}, reference=${reference}:`, err);
        updateResults.push({
          productId,
          reference,
          newStock,
          updated: false,
          error: err.message
        });
      }
    }

    // 5) Výsledná odpověď
    console.log('=== Synchronizace skladu kombinací dokončena ===');
    return res.status(200).json({
      success: true,
      message: 'Synchronizace skladu kombinací dokončena',
      updates: updateResults
    });
  } catch (error) {
    console.error('Chyba při synchronizaci skladu kombinací:', error);
    return res.status(500).json({
      success: false,
      message: 'Chyba při synchronizaci skladu kombinací',
      details: error.message
    });
  }
});




// Endpoint pro aktualizaci produktu
app.put('/update_product', (req, res) => {
  const updatedProduct = req.body;

  // Validace: PartNo je povinný (slouží jako identifikátor)
  if (!updatedProduct.PartNo) {
    return res.status(400).json({ error: 'PartNo je povinný.' });
  }

  // Destrukturování relevantních polí – dle porovnávaných hodnot ve vašem UI
  const {
    PartNo,
    EAN,
    DisplayName,
    Manufacturer,
    RetailPrice_CZ,
    Axle,
    TyreUsage,
    Width,
    Profile,
    Diameter,
    LoadIndexFrom,
    LoadIndexTo,
    SpeedIndex,
    SpeedIndexTo,
    ImageUrl,
    TagV2021_FuelEfficiencyClass,
    TagV2021_RollingNoise,
    TagV2021_RollingNoise_dB,
    TagV2021_WetGripClass,
    Pattern,
    MS,
    Mountain,
  } = updatedProduct;

  const sql = `
    UPDATE Products
    SET 
      EAN = ?,
      DisplayName = ?,
      Manufacturer = ?,
      RetailPrice_CZ = ?,
      Axle = ?,
      TyreUsage = ?,
      Width = ?,
      Profile = ?,
      Diameter = ?,
      LoadIndexFrom = ?,
      LoadIndexTo = ?,
      SpeedIndex = ?,
      SpeedIndexTo = ?,
      ImageUrl = ?,
      TagV2021_FuelEfficiencyClass = ?,
      TagV2021_RollingNoise = ?,
      TagV2021_RollingNoise_dB = ?,
      TagV2021_WetGripClass = ?,
      Pattern = ?,
      MS = ?,
      Mountain = ?
    WHERE PartNo = ?
  `;

  poolC5tpms.query(sql, [
    EAN,
    DisplayName,
    Manufacturer,
    RetailPrice_CZ,
    Axle,
    TyreUsage,
    Width,
    Profile,
    Diameter,
    LoadIndexFrom,
    LoadIndexTo,
    SpeedIndex,
    SpeedIndexTo,
    ImageUrl,
    TagV2021_FuelEfficiencyClass,
    TagV2021_RollingNoise,
    TagV2021_RollingNoise_dB,
    TagV2021_WetGripClass,
    Pattern,
    MS,
    Mountain,
    PartNo
    
  ], (err, results) => {
    if (err) {
      console.error('Chyba při aktualizaci produktu:', err);
      return res.status(500).json({ error: 'Chyba při aktualizaci produktu.' });
    }
    res.json({ message: 'Produkt úspěšně aktualizován.' });
  });
});

// GET /products – načte všechny produkty
app.get('/products', (req, res) => {
  const sql = 'SELECT * FROM Products';
  poolC5tpms.query(sql, (err, results) => {
    if (err) {
      console.error('Chyba při načítání produktů:', err);
      return res.status(500).json({ error: 'Chyba při načítání produktů.' });
    }
    res.json(results);
  });
});
// seznam produktů z ceníku
app.get('/price-list-items', (req, res) => {
  const { filterId } = req.query;
  if (!filterId) {
    return res.status(400).json({ error: 'Missing filterId' });
  }
  const sql = 'SELECT * FROM IMPORT_CZS_Analytic_PLOR WHERE Verze = ?';
  poolC5tpms.query(sql, [filterId], (err, results) => {
    if (err) {
      console.error('Chyba při načítání položek ceníku:', err);
      return res.status(500).json({ error: 'Chyba při načítání dat.' });
    }
    res.json(results);
  });
});


// GET /b2b_products – načte produkty z B2B, které odpovídají partNo předaným z frontendu
app.get('/b2b_products', (req, res) => {
  // Očekáváme query parametr partNos, který může být buď řetězec s čárkami nebo pole
  let { partNos } = req.query;

  if (!partNos) {
    return res.status(400).json({ error: 'Nebyla předána žádná hodnota partNo.' });
  }

  // Pokud je partNos řetězec, rozdělíme jej podle čárek
  if (typeof partNos === 'string') {
    partNos = partNos.split(',').map(item => item.trim());
  }

  const sql = 'SELECT * FROM IMPORT_CZS_ProduktyB2B WHERE partNo IN (?)';
  poolC5pneutyres.query(sql, [partNos], (err, results) => {
    if (err) {
      console.error('Chyba při načítání B2B produktů:', err);
      return res.status(500).json({ error: 'Chyba při načítání B2B produktů.' });
    }
    res.json(results);
  });
});


// A N A L Ý Z A
// Endpoint pro získání detailních informací pro dashboard
app.get('/an/sales-details/by-year', async (req, res) => {
  // Přijímáme dotazovací parametry: year a groupBy
  const { year, groupBy } = req.query;
  
  // Volitelný filtr pro rok – pokud není zadán, vybíráme za celé období (např. od roku 2020 do 2026)
  let dateFilter = "";
  if (year) {
    dateFilter = `AND YEAR(h.ReceiptDateRequested) = ${year}`;
  }
  
  // Podle parametru groupBy nastavíme sloupce a GROUP BY klauzuli
  let selectClause = "";
  let groupClause = "";
  if (groupBy === "center") {
    // Středisko = posledních 5 znaků SalesGroupName
    selectClause = `RIGHT(h.SalesGroupName, 5) AS Center`;
    groupClause = `RIGHT(h.SalesGroupName, 5)`;
  } else if (groupBy === "salesrep") {
    // Obchodní zástupce – použijeme CASE výraz, který ověří, zda SalesGroupName obsahuje podtržítko.
    selectClause = `
      CASE 
        WHEN CHARINDEX('_', h.SalesGroupName) > 0 
        THEN LEFT(h.SalesGroupName, CHARINDEX('_', h.SalesGroupName)-1) 
        ELSE h.SalesGroupName 
      END AS SalesRep
    `;
    groupClause = `
      CASE 
        WHEN CHARINDEX('_', h.SalesGroupName) > 0 
        THEN LEFT(h.SalesGroupName, CHARINDEX('_', h.SalesGroupName)-1) 
        ELSE h.SalesGroupName 
      END
    `;
  } else {
    // Výchozí seskupení – pokud není zadaný groupBy, použijeme obchodní zástupce
    selectClause = `
      CASE 
        WHEN CHARINDEX('_', h.SalesGroupName) > 0 
        THEN LEFT(h.SalesGroupName, CHARINDEX('_', h.SalesGroupName)-1) 
        ELSE h.SalesGroupName 
      END AS SalesRep
    `;
    groupClause = `
      CASE 
        WHEN CHARINDEX('_', h.SalesGroupName) > 0 
        THEN LEFT(h.SalesGroupName, CHARINDEX('_', h.SalesGroupName)-1) 
        ELSE h.SalesGroupName 
      END
    `;
  }

  // Sestavíme SQL dotaz
  const salesQuery = `
    SELECT
      YEAR(h.ReceiptDateRequested) AS SalesYear,
      MONTH(h.ReceiptDateRequested) AS SalesMonth,
      inv.PurchLineDisc,
      ${selectClause},
      COUNT(DISTINCT h.SalesId) AS TotalOrders,
      SUM(l.SalesPrice * l.DeliveredQty) AS TotalSales,
      SUM(CASE WHEN inv.ItemGroupId = '01040' THEN l.DeliveredQty ELSE 0 END) AS TotalQtyPneu,
      SUM(CASE WHEN inv.ItemGroupId = '01040' THEN l.SalesPrice * l.DeliveredQty ELSE 0 END) AS TotalSalesPneu,
      SUM(CASE WHEN inv.ItemGroupId IN ('02040','03040') THEN l.DeliveredQty ELSE 0 END) AS TotalQtyProtektory,
      SUM(CASE WHEN inv.ItemGroupId IN ('02040','03040') THEN l.SalesPrice * l.DeliveredQty ELSE 0 END) AS TotalSalesProtektory
    FROM [AxProdCS].[dbo].[ItsIFSalesTable] h
    JOIN [AxProdCS].[dbo].[ItsIFSalesLine] l ON h.SalesId = l.SalesId
    JOIN [AxProdCS].[dbo].[ItsIFInventTable] inv ON l.ItemId = inv.ItemId
    WHERE
      h.ReceiptDateRequested >= '2020-01-01'
      AND h.ReceiptDateRequested < '2026-01-01'
      AND h.SalesStatusText = 'Fakturováno'
      ${dateFilter}
    GROUP BY
      YEAR(h.ReceiptDateRequested),
      MONTH(h.ReceiptDateRequested),
      inv.PurchLineDisc,
      ${groupClause}
    ORDER BY
      SalesYear,
      SalesMonth,
      inv.PurchLineDisc;
  `;

  try {
    const result = await queryMSSQL(salesQuery, []);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error in /an/sales-details/by-year:", error);
    res.status(500).json({ error: error.message });
  }
});


//endpoint pro získání všeobecných informací pro dashboard
app.get('/an/sales-details', async (req, res) => {
  // SQL dotaz – sumární údaje podle SalesGroupName
  const salesQuery = `
    SELECT
  h.SalesGroupName,
  SUM(l.DeliveredQty) AS TotalOrders,  -- celkový počet kusů (případně dodaných)
  SUM(l.SalesPrice * l.DeliveredQty) AS TotalSales,
  
  -- Pro pneumatiky: součet kusů a tržeb
  SUM(CASE WHEN inv.ItemGroupId = '01040' THEN l.DeliveredQty ELSE 0 END) AS TotalOrdersPneu,
  SUM(CASE WHEN inv.ItemGroupId = '01040' THEN l.SalesPrice * l.DeliveredQty ELSE 0 END) AS TotalSalesPneu,
  
  -- Pro protektory: součet kusů a tržeb
  SUM(CASE WHEN inv.ItemGroupId IN ('02040','03040') THEN l.DeliveredQty ELSE 0 END) AS TotalOrdersProtektory,
  SUM(CASE WHEN inv.ItemGroupId IN ('02040','03040') THEN l.SalesPrice * l.DeliveredQty ELSE 0 END) AS TotalSalesProtektory
FROM [AxProdCS].[dbo].[ItsIFSalesTable] h
JOIN [AxProdCS].[dbo].[ItsIFSalesLine] l ON h.SalesId = l.SalesId
JOIN [AxProdCS].[dbo].[ItsIFInventTable] inv ON l.ItemId = inv.ItemId
WHERE
  h.ReceiptDateRequested >= '2025-01-01'
  AND h.ReceiptDateRequested < '2026-01-01'
  AND RIGHT(h.SalesGroupName, 5) IN ('20120','20101','20102','20110','20160')
  AND h.SalesStatusText = 'Fakturováno'
GROUP BY
  h.SalesGroupName
ORDER BY
  h.SalesGroupName;
  `;

  // Dotaz pro plánovací údaje z MySQL
  const planQuery = `SELECT * FROM OZ_planovani`;

  try {
    // 1) Načtení prodejních dat z MSSQL
    const mssqlResult = await queryMSSQL(salesQuery, []);
    const salesDetails = mssqlResult.recordset || [];

    // 2) Načtení plánovacích dat z MySQL
    const planRows = await new Promise((resolve, reject) => {
      poolC5tpms.query(planQuery, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

    // 3) Seskupení dat do objektu středisek
    const strediskaObj = {};

    // Zpracování prodejních dat – seskupení podle SalesGroupName
    salesDetails.forEach(sd => {
      // Ze SalesGroupName extrahujeme středisko – posledních 5 znaků
      const center = sd.SalesGroupName.slice(-5);
      // Obchodní zástupce – část před posledních 6 znaků
      const namePart = sd.SalesGroupName.slice(0, -6).trim();
      const rep = namePart.split('_')[0].trim();

      if (!strediskaObj[center]) {
        strediskaObj[center] = {
          stredisko: center,
          aggregatedPlan: {},
          actualData: { 
            totalOrders: 0,
            totalSales: 0,
            totalOrdersPneu: 0,
            totalSalesPneu: 0,
            totalOrdersProtektory: 0,
            totalSalesProtektory: 0 
          },
          fulfillment: {},
          obchodniZastupci: {}
        };
      }
      // Přidání repa do střediska
      if (!strediskaObj[center].obchodniZastupci[rep]) {
        strediskaObj[center].obchodniZastupci[rep] = {
          jmeno: rep,
          planData: {},
          actualData: { 
            totalOrders: 0,
            totalSales: 0,
            totalOrdersPneu: 0,
            totalSalesPneu: 0,
            totalOrdersProtektory: 0,
            totalSalesProtektory: 0 
          },
          fulfillment: {}
        };
      }
      // Agregujeme prodejní údaje do repa
      const repActual = strediskaObj[center].obchodniZastupci[rep].actualData;
      repActual.totalOrders += sd.TotalOrders;
      repActual.totalSales += sd.TotalSales;
      repActual.totalOrdersPneu += sd.TotalOrdersPneu;
      repActual.totalSalesPneu += sd.TotalSalesPneu;
      repActual.totalOrdersProtektory += sd.TotalOrdersProtektory;
      repActual.totalSalesProtektory += sd.TotalSalesProtektory;

      // Agregujeme prodejní údaje do střediska
      const centerActual = strediskaObj[center].actualData;
      centerActual.totalOrders += sd.TotalOrders;
      centerActual.totalSales += sd.TotalSales;
      centerActual.totalOrdersPneu += sd.TotalOrdersPneu;
      centerActual.totalSalesPneu += sd.TotalSalesPneu;
      centerActual.totalOrdersProtektory += sd.TotalOrdersProtektory;
      centerActual.totalSalesProtektory += sd.TotalSalesProtektory;
    });

    // 4) Zpracování plánovacích dat – seskupíme podle střediska a repa
    planRows.forEach(row => {
      const center = row.Stredisko;
      const rep = row.Obchodni_zastupce.trim();

      if (!strediskaObj[center]) {
        strediskaObj[center] = {
          stredisko: center,
          aggregatedPlan: {},
          actualData: { 
            totalOrders: 0,
            totalSales: 0,
            totalOrdersPneu: 0,
            totalSalesPneu: 0,
            totalOrdersProtektory: 0,
            totalSalesProtektory: 0 
          },
          fulfillment: {},
          obchodniZastupci: {}
        };
      }
      if (!strediskaObj[center].obchodniZastupci[rep]) {
        strediskaObj[center].obchodniZastupci[rep] = {
          jmeno: rep,
          planData: {},
          actualData: { 
            totalOrders: 0,
            totalSales: 0,
            totalOrdersPneu: 0,
            totalSalesPneu: 0,
            totalOrdersProtektory: 0,
            totalSalesProtektory: 0 
          },
          fulfillment: {}
        };
      }
      // Převod hodnot z plánovacích dat na čísla
      const repPlan = {
        pneuPlanKs: parseFloat(row.Nakladni_pneu_plan_ks) || 0,
        pneuPlanTrzba: parseFloat(row.Nakladni_pneu_plan_trzba) || 0,
        protPlanKs: parseFloat(row.Protektory_plan_ks) || 0,
        protPlanTrzba: parseFloat(row.Protektory_plan_trzba) || 0,
        totalPlanTrzba: parseFloat(row.Plan_trzba_2025) || 0,
        Pocet_akt_klientu_24: parseFloat(row.Pocet_akt_klientu_24) || 0,
        Pocet_akt_klientu_23: parseFloat(row.Pocet_akt_klientu_23) || 0
      };
      strediskaObj[center].obchodniZastupci[rep].planData = repPlan;

      // Agregace plánovacích dat do střediska – sumujeme přes repy
      const centerPlan = strediskaObj[center].aggregatedPlan;
      Object.keys(repPlan).forEach(key => {
        centerPlan[key] = (centerPlan[key] || 0) + repPlan[key];
      });
    });

    // 5) Výpočet procentuálního plnění na úrovni repa i střediska
    Object.values(strediskaObj).forEach(centerObj => {
      // Na úrovni střediska: CELKEM se počítá z tržeb
      centerObj.fulfillment.totalPct = centerObj.aggregatedPlan.totalPlanTrzba > 0
        ? ((centerObj.actualData.totalSales / centerObj.aggregatedPlan.totalPlanTrzba) * 100).toFixed(1)
        : '0';

      Object.values(centerObj.obchodniZastupci).forEach(repObj => {
        repObj.fulfillment = {
          pneuPct: repObj.planData.pneuPlanKs > 0
            ? ((repObj.actualData.totalOrdersPneu / repObj.planData.pneuPlanKs) * 100).toFixed(1)
            : '0',
          protPct: repObj.planData.protPlanKs > 0
            ? ((repObj.actualData.totalOrdersProtektory / repObj.planData.protPlanKs) * 100).toFixed(1)
            : '0',
          totalPct: repObj.planData.totalPlanTrzba > 0
            ? ((repObj.actualData.totalSales / repObj.planData.totalPlanTrzba) * 100).toFixed(1)
            : '0'
        };
      });
    });

    // 6) Převod do pole s hierarchií středisek a prodejců
    const strediska = Object.values(strediskaObj).map(centerObj => {
      const obchodniZastupci = Object.values(centerObj.obchodniZastupci).map(repObj => ({
        jmeno: repObj.jmeno,
        planData: repObj.planData,
        actualData: repObj.actualData,
        fulfillment: repObj.fulfillment
      }));
      return {
        stredisko: centerObj.stredisko,
        aggregatedPlan: centerObj.aggregatedPlan,
        actualData: centerObj.actualData,
        fulfillment: centerObj.fulfillment,
        obchodniZastupci: obchodniZastupci
      };
    });

    res.json({ strediska });
  } catch (error) {
    console.error('Error in /an/sales-details:', error);
    res.status(500).json({ error: error.message });
  }
});




app.get('/an/plan-data', (req, res) => {
  const planQuery = 'SELECT * FROM OZ_planovani';

  poolC5tpms.query(planQuery, (err, results) => {
    if (err) {
      console.error('Error fetching plan data from MySQL:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ planData: results });
  });
});


app.get('/prestashop/sync-all-combinations', async (req, res) => {
  let connection;
  try {
    console.log("=== /prestashop/sync-all-combinations endpoint byl zavolán ===");

    connection = await poolC5tpms.getConnection();
    connection.query = util.promisify(connection.query);

    const prestaApiUrl = process.env.PRESTASHOP_API_URL;
    const prestaApiKey = process.env.PRESTASHOP_API_KEY;

    const uniqueQuery = `
      SELECT DISTINCT ps_id
      FROM Tavinox_kody
      WHERE ps_id IS NOT NULL
    `;
    const uniqueProducts = await connection.query(uniqueQuery);
    console.log(`Nalezeno ${uniqueProducts.length} unikátních ps_id.`);

    let totalCombosSynced = 0;
    let totalErrors = 0;

    async function deleteExistingCombinations(psId) {
      const getCombosUrl = `${prestaApiUrl}/combinations?filter[id_product]=[${psId}]`;
      try {
        console.log(`Mazání existujících kombinací pro produkt ${psId}...`);
        const response = await axios.get(getCombosUrl, {
          auth: { username: prestaApiKey, password: '' },
          headers: { 'Content-Type': 'text/xml' }
        });
        const parser = new xml2js.Parser({ explicitArray: false });
        const jsonData = await parser.parseStringPromise(response.data);
        let existingCombos = [];
        if (
          jsonData &&
          jsonData.prestashop &&
          jsonData.prestashop.combinations &&
          jsonData.prestashop.combinations.combination
        ) {
          existingCombos = jsonData.prestashop.combinations.combination;
          if (!Array.isArray(existingCombos)) {
            existingCombos = [existingCombos];
          }
        }
        for (const combo of existingCombos) {
          const deleteUrl = `${prestaApiUrl}/combinations/${combo.id}`;
          console.log(`Mažu kombinaci s ID ${combo.id} pro produkt ${psId}`);
          await axios.delete(deleteUrl, {
            auth: { username: prestaApiKey, password: "" },
            headers: { "Content-Type": "text/xml" }
          });
        }
        console.log(`Všechny kombinace pro produkt ${psId} byly smazány.`);
      } catch (err) {
        console.error(`Chyba při mazání kombinací pro produkt ${psId}:`, err.message);
      }
    }

    async function createCombinationForProduct(psId, reference, quantity, ean13, attributeValueIds) {
      if (ean13 && ean13.length === 14 && ean13.startsWith("0")) {
        console.log(`Upravujeme ean13 z ${ean13} na ${ean13.substring(1)}`);
        ean13 = ean13.substring(1);
      }

      const combinationData = {
        combination: {
          id_product: psId,
          reference: reference,
          ean13: ean13,
          quantity: quantity,
          minimal_quantity: "1",
          associations: {
            product_option_values: {
              product_option_value: attributeValueIds.map(id => ({ id: id.toString() }))
            }
          }
        }
      };

      const finalPayload = removeEmpty(combinationData);
      const xmlBody = js2xmlparser.parse("prestashop", finalPayload, { declaration: { include: true } });

      try {
        await axios.post(
          `${prestaApiUrl}/combinations`,
          xmlBody,
          {
            auth: { username: prestaApiKey, password: '' },
            headers: { 'Content-Type': 'text/xml' }
          }
        );
        console.log(`Kombinace ${reference} pro produkt ${psId} byla vytvořena.`);
      } catch (err) {
        throw new Error(`Chyba při vytváření kombinace ${reference} pro produkt ${psId}: ${err.response ? err.response.data : err.message}`);
      }
    }

    for (const productObj of uniqueProducts) {
      const psId = productObj.ps_id;
      await deleteExistingCombinations(psId);

      const productRowsQuery = `
        SELECT 
          Kod_produktu2, 
          EAN_sacek, 
          EAN_krabice, 
          Sacek_ks, 
          Krabice_ks,
          Druh_polozky
        FROM Tavinox_kody
        WHERE ps_id = ?
          AND Druh_polozky = 'Základní položka'
        GROUP BY Kod_produktu2
      `;
      const mainRows = await connection.query(productRowsQuery, [psId]);
      if (!mainRows || mainRows.length === 0) {
        console.log(`Pro ps_id=${psId} nebyl nalezen řádek s Druh_polozky='Základní položka', přeskočuji.`);
        continue;
      }

      for (const row of mainRows) {
        const { Kod_produktu2, EAN_sacek, EAN_krabice, Sacek_ks, Krabice_ks } = row;
        const kod2Parts = Kod_produktu2.split('.');
        let prumerValExtracted = kod2Parts[1] || "";
        if (!PRUMER_MAP[prumerValExtracted]) {
          prumerValExtracted = prumerValExtracted.substring(0, 2);
        }
        const prumerValueId = PRUMER_MAP[prumerValExtracted];
        if (!prumerValueId) {
          console.log(`Nenalezena hodnota průměru pro ps_id=${psId}, přeskočuji...`);
          continue;
        }

        const attributeValueIds = [prumerValueId];
        if (parseInt(Sacek_ks) > 0) {
          const sacekValId = SACEK_MAP[Sacek_ks];
          if (sacekValId) attributeValueIds.push(sacekValId);
        }
        if (parseInt(Krabice_ks) > 0) {
          const krabiceValId = KRABICE_MAP[Krabice_ks];
          if (krabiceValId) attributeValueIds.push(krabiceValId);
        }
        if (attributeValueIds.length > 1) {
          try {
            await createCombinationForProduct(psId, Kod_produktu2, parseInt(Sacek_ks) + parseInt(Krabice_ks), EAN_sacek || EAN_krabice, attributeValueIds);
            totalCombosSynced++;
          } catch (err) {
            totalErrors++;
            console.error(err.message);
          }
        }
      }
    }

    return res.status(200).json({ success: true, message: `Celkem kombinací synchronizováno: ${totalCombosSynced}, chyb: ${totalErrors}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Chyba při synchronizaci kombinací", error: error.message });
  } finally {
    if (connection) connection.release();
  }
});





//update základních produktů
app.get('/prestashop/complete-update-from-ps', async (req, res) => {
  let connection;
  try {
    console.log("=== /prestashop/complete-update-from-ps endpoint byl zavolán ===");

    connection = await poolC5tpms.getConnection();
    connection.query = util.promisify(connection.query);

    // Upravený SELECT dotaz načítá i další potřebná pole
    const selectQuery = `
      SELECT 
         ps_id, 
         Kod_produktu1, 
         Kod_produktu2, 
         Nazev, 
         EAN, 
         Kategorie, 
         EAN_sacek, 
         EAN_krabice, 
         Sacek_ks, 
         Krabice_ks, 
         Druh_polozky
      FROM Tavinox_kody
      WHERE ps_id IS NOT NULL
    `;
    const sqlProducts = await connection.query(selectQuery);
    console.log(`Načteno ${sqlProducts.length} záznamů z DB k aktualizaci.`);

    // Skupinování záznamů podle ps_id (tj. jednoho produktu)
    const groupedProducts = {};
    sqlProducts.forEach(row => {
      const key = row.ps_id;
      if (!groupedProducts[key]) {
        groupedProducts[key] = [];
      }
      groupedProducts[key].push(row);
    });
    console.log(`Skupin: ${Object.keys(groupedProducts).length}`);

    const prestaApiUrl = process.env.PRESTASHOP_API_URL;
    const prestaApiKey = process.env.PRESTASHOP_API_KEY;
    const options = { declaration: { include: true } };

    const parser = new xml2js.Parser({ explicitArray: false });

    // Pole universalFields – odstranili jsme position_in_category
    const universalFields = {
      id_manufacturer: "1",
      id_supplier: "1",
      id_tax_rules_group: "1",
      // position_in_category: "1", // odstraněno
      type: "simple",
      id_shop_default: "1",
      width: "0.000000",
      height: "0.000000",
      depth: "0.000000",
      weight: "0.000000",
      state: "1",
      additional_delivery_times: "1",
      product_type: "combinations",
      ecotax: "0.000000",
      minimal_quantity: "1",
      price: "0.000000",
      wholesale_price: "0.000000",
      unit_price: "0.000000",
      unit_price_ratio: "0.000000",
      additional_shipping_cost: "0.000000",
      active: "1",
      redirect_type: "default",
      available_date: "0000-00-00",
      condition: "new",
      show_price: "1",
      indexed: "1",
      visibility: "both",
      date_add: "2025-01-25 10:57:28",
      date_upd: "2025-01-25 11:08:11",
      pack_stock_type: "3",
      id_default_combination: "0"
    };

    let updatedCount = 0;
    let errorCount = 0;

    // Pro každý produkt (skupinu záznamů)
    for (const psId in groupedProducts) {
      const groupRows = groupedProducts[psId];
      // Vybereme řádek s "Základní položka", pokud existuje, jinak první řádek
      const mainRow = groupRows.find(r => r.Druh_polozky === "Základní položka") || groupRows[0];

      // Rozdělení Kod_produktu2 na dvě části (pokud je potřeba)
      const kod2Parts = mainRow.Kod_produktu2.split('.');
      const productRef = kod2Parts[0];
      // const prumerVal = kod2Parts[1]; // už nepotřebujeme, pokud netvoříme kombinace

      console.log(`\n=== Zpracovávám produkt s ps_id=${psId}, Kod_produktu1=${mainRow.Kod_produktu1} ===`);

      try {
        const getResponse = await axios.get(`${prestaApiUrl}/products/${psId}`, {
          auth: { username: prestaApiKey, password: "" },
          headers: { "Content-Type": "text/xml" }
        });
        console.log(`[${psId}] GET /products/${psId} - úspěch, parsování...`);

        const psJson = await parser.parseStringPromise(getResponse.data);
        let productData = psJson.prestashop.product;
        console.log(`[${psId}] Původní productData načteno.`);

        productData = stripDollarKeys(productData);
        console.log(`[${psId}] Odstraněny klíče obsahující '$'.`);

        // Odstraňujeme nepotřebná pole
        const removableFields = [
          "id_default_image",
          "quantity",
          "delivery_in_stock",
          "delivery_out_stock",
          "meta_description",
          "meta_keywords",
          "meta_title",
          "description",
          "description_short",
          "available_now",
          "available_later",
          "new",
          "supplier_reference",
          "location",
          "isbn",
          "upc",
          "mpn",
          "unity",
          "low_stock_threshold",
          "position_in_category"
        ];
        removableFields.forEach(field => {
          if (productData.hasOwnProperty(field)) {
            console.log(`[${psId}] Odstraňuji pole ${field}`);
            delete productData[field];
          }
        });

        if (productData.manufacturer_name) {
          console.log(`[${psId}] Odstraňuji manufacturer_name`);
          delete productData.manufacturer_name;
        }

        if (productData.associations) {
          if (productData.associations.categories && productData.associations.categories.category) {
            console.log(`[${psId}] Transformuji associations.categories...`);
            let cats = productData.associations.categories.category;
            if (!Array.isArray(cats)) {
              cats = [cats];
            }
            cats = cats.map(cat => {
              if (cat.$ && cat.$.id) {
                return { id: cat.$.id };
              }
              if (typeof cat === "object" && cat.id) {
                return { id: cat.id };
              }
              return cat;
            });
            productData.associations.categories.category = cats;
          }
          if (productData.associations.hasOwnProperty("tags")) {
            console.log(`[${psId}] Odstraňuji associations.tags`);
            delete productData.associations.tags;
          }
          if (productData.associations.hasOwnProperty("attachments")) {
            console.log(`[${psId}] Odstraňuji associations.attachments`);
            delete productData.associations.attachments;
          }
          const removableAssoc = [
            "combinations",
            "images",
            "product_option_values",
            "product_features",
            "product_bundle",
            "stock_availables",
            "accessories"
          ];
          removableAssoc.forEach(a => {
            if (productData.associations[a]) {
              console.log(`[${psId}] Odstraňuji associations.${a}`);
              delete productData.associations[a];
            }
          });
        }

        console.log(`[${psId}] Sloučím data z DB: Kod_produktu1=${mainRow.Kod_produktu1}, Kod_produktu2=${mainRow.Kod_produktu2}, EAN=${mainRow.EAN}, Nazev=${mainRow.Nazev}, Kategorie=${mainRow.Kategorie}`);

        // Nastavení nové reference produktu (část před tečkou z Kod_produktu2)
        productData.reference = productRef;

        // Pokud v DB chybí název, můžeme definovat nějaký fallback – zde neřešeno
        if (mainRow.Nazev) {
          const nameValue = mainRow.Nazev;
          productData.name = {
            language: [
              { "@": { id: "1" }, "#": nameValue }
            ]
          };
          productData.link_rewrite = {
            language: [
              { "@": { id: "1" }, "#": slugify(nameValue) }
            ]
          };
        }

        if (mainRow.Kategorie) {
          productData.id_category_default = mainRow.Kategorie.toString();
        }

        // Aplikace univerzálních polí
        Object.keys(universalFields).forEach(field => {
          productData[field] = universalFields[field];
        });

        // Zajištění přiřazení kategorie do associations (pokud neexistuje)
        if (!productData.associations) {
          productData.associations = {};
        }
        if (
          !productData.associations.categories ||
          !productData.associations.categories.category ||
          (Array.isArray(productData.associations.categories.category) &&
            productData.associations.categories.category.length === 0)
        ) {
          productData.associations.categories = {
            category: [{ id: productData.id_category_default }]
          };
        }

        // --- Vše ohledně tvorby kombinací je odstraněno ---

        console.log(`[${psId}] Produkt po sloučení s DB a univerzálními poli:`, JSON.stringify(productData, null, 2));

        let updatePayload = { product: productData };
        updatePayload = removeEmpty(updatePayload);
        console.log(`[${psId}] Payload po removeEmpty:`, JSON.stringify(updatePayload, null, 2));

        const xmlPayload = js2xmlparser.parse("prestashop", updatePayload, options);
        console.log(`[${psId}] Generovaný XML payload:`);
        console.log(xmlPayload);

        const putResponse = await axios.put(`${prestaApiUrl}/products/${psId}`, xmlPayload, {
          auth: { username: prestaApiKey, password: "" },
          headers: { "Content-Type": "text/xml" }
        });
        console.log(`[${psId}] PUT úspěšný:`, putResponse.status, putResponse.statusText);
        updatedCount++;
      } catch (error) {
        errorCount++;
        console.error(`[${psId}] Chyba při aktualizaci:`, error.response ? error.response.data : error.message);
      }
    }

    const summary = `Aktualizováno ${updatedCount} produktů, chyba u ${errorCount} produktů.`;
    console.log("[Výsledek]", summary);
    return res.status(200).json({ success: true, message: summary });
  } catch (err) {
    console.error("Chyba v endpointu:", err.message);
    return res.status(500).json({
      success: false,
      message: "Chyba při aktualizaci produktů.",
      error: err.message
    });
  } finally {
    if (connection) connection.release();
  }
});










app.get('/prestashop/tx_fill-ps-id', async (req, res) => {
  let connection;
  try {
    console.log('=== /prestashop/fill-ps-id endpoint byl zavolán ===');

    // Získání připojení z poolu
    connection = await poolC5tpms.getConnection();
    connection.query = util.promisify(connection.query);

    const prestaApiKey = process.env.PRESTASHOP_API_KEY;
    const prestaApiUrl = process.env.PRESTASHOP_API_URL;

    // Zavoláme PrestaShop API, omezíme výpis na id a reference (kde reference je nyní část z Kod_produktu2 před tečkou)
    const response = await axios.get(
      `${prestaApiUrl}/products?display=[id,reference]`,
      {
        auth: {
          username: prestaApiKey,
          password: ''
        },
        headers: {
          'Content-Type': 'text/xml'
        }
      }
    );

    // Převod XML odpovědi na JSON pomocí xml2js
    const parser = new xml2js.Parser({ explicitArray: false });
    const jsonData = await parser.parseStringPromise(response.data);

    // Očekávaná struktura odpovědi:
    // {
    //   prestashop: {
    //     products: {
    //       product: [
    //         { id: "123", reference: "NA10FF" },
    //         { id: "124", reference: "NA10FG" },
    //         ...
    //       ]
    //     }
    //   }
    // }
    let products = [];
    if (
      jsonData &&
      jsonData.prestashop &&
      jsonData.prestashop.products &&
      jsonData.prestashop.products.product
    ) {
      products = jsonData.prestashop.products.product;
      // Pokud je jen jeden produkt, zajistíme, že budeme mít pole
      if (!Array.isArray(products)) {
        products = [products];
      }
    }

    console.log(`PrestaShop API vrátilo ${products.length} produktů.`);

    let updatedCount = 0;
    let errorCount = 0;

    // Pro každý produkt z PrestaShopu aktualizujeme SQL záznamy podle shody reference
    for (const prod of products) {
      const prestashopId = prod.id;
      const reference = prod.reference;

      if (!prestashopId || !reference) {
        console.warn(
          `Přeskočeno, chybí id nebo reference u produktu: ${JSON.stringify(prod)}`
        );
        continue;
      }

      // Aktualizujeme záznamy v tabulce Tavinox_kody:
      // nastavíme ps_id tam, kde je hodnota získaná z Kod_produktu2 (část před tečkou) shodná s referencí z PrestaShopu.
      const updateQuery = `
        UPDATE Tavinox_kody 
        SET ps_id = ? 
        WHERE SUBSTRING_INDEX(Kod_produktu2, '.', 1) = ?
      `;
      try {
        await connection.query(updateQuery, [prestashopId, reference]);
        console.log(`Produkt s referencí ${reference} byl aktualizován (ps_id: ${prestashopId}).`);
        updatedCount++;
      } catch (dbError) {
        console.error(`Chyba při aktualizaci produktu s referencí ${reference}:`, dbError.message);
        errorCount++;
      }
    }

    const message = `Aktualizováno ${updatedCount} produktů, chyba u ${errorCount} produktů.`;
    console.log(message);
    return res.status(200).json({ success: true, message });
  } catch (error) {
    console.error('Chyba při načítání produktů a aktualizaci SQL:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Chyba při načítání produktů a aktualizaci SQL.',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});




app.get('/prestashop/tx_create-products', async (req, res) => {
  let connection;
  try {
    console.log('=== /prestashop/create-products endpoint byl zavolán ===');

    // Získání připojení z poolu
    connection = await poolC5tpms.getConnection();
    connection.query = util.promisify(connection.query);

    // Načtení všech záznamů z tabulky Tavinox_kody s "Základní položka"
    const selectQuery = `
      SELECT * FROM Tavinox_kody
      WHERE Druh_polozky = 'Základní položka'
    `;
    const products = await connection.query(selectQuery);
    console.log(`Načteno ${products.length} záznamů z tabulky Tavinox_kody.`);

    // Seskupíme produkty podle unikátní hodnoty v Kod_produktu2 (část před tečkou)
    const groupedProducts = {};
    products.forEach(product => {
      if (product.Kod_produktu2) {
        const parts = product.Kod_produktu2.split('.');
        const productRef = parts[0];
        // Pokud již skupina existuje, přeskočíme další záznam
        if (!groupedProducts[productRef]) {
          groupedProducts[productRef] = product;
        }
      }
    });
    const uniqueProducts = Object.values(groupedProducts);
    console.log(`Skupinováno na ${uniqueProducts.length} unikátních produktů dle Kod_produktu2 (před tečkou).`);

    const prestaApiKey = process.env.PRESTASHOP_API_KEY;
    const prestaApiUrl = process.env.PRESTASHOP_API_URL;

    let createdCount = 0;
    const options = {
      declaration: {
        include: true
      }
    };

    for (const product of uniqueProducts) {
      // Úprava EAN: odstraní počáteční nulu, pokud je délka 14 znaků
      let eanValue = product.EAN;
      if (eanValue && eanValue.length === 14 && eanValue.startsWith('0')) {
        eanValue = eanValue.substring(1);
      }

      // Z Kod_produktu2 získáme referenci (část před tečkou)
      const parts = product.Kod_produktu2.split('.');
      const productRef = parts[0];

      // Sestavení JSON payloadu dle struktury PrestaShop API pro vytvoření nového produktu.
      const productPayload = {
        product: {
          id_shop_default: "1",
          id_category_default: product.Kategorie, // očekává se číslo kategorie (např. "7")
          reference: productRef,                     // použití čistého kódu (bez hodnoty za tečkou)
          ean13: eanValue,                           // upravený EAN
          price: "0.00",                             // výchozí cena – případně upravte
          wholesale_price: "0.00",
          on_sale: "0",
          online_only: "0",
          minimal_quantity: "1",
          active: "1",
          name: {
            language: [
              {
                "@": { id: "1" },
                "#": product.Nazev
              }
            ]
          },
          link_rewrite: {
            language: [
              {
                "@": { id: "1" },
                "#": slugify(product.Nazev)
              }
            ]
          },
          meta_title: {
            language: [
              {
                "@": { id: "1" },
                "#": product.Nazev
              }
            ]
          },
          meta_description: {
            language: [
              {
                "@": { id: "1" },
                "#": ""
              }
            ]
          },
          description: {
            language: [
              {
                "@": { id: "1" },
                "#": ""
              }
            ]
          }
        }
      };

      // Odstraníme prázdné hodnoty, abychom do XML nezahrnovali nepovinná pole s prázdným obsahem.
      const cleanPayload = removeEmpty(productPayload);

      // Převod JSON payloadu na XML
      const xmlPayload = js2xmlparser.parse("prestashop", cleanPayload, options);
      console.log("Vytvářen XML payload:", xmlPayload);

      try {
        // Vytvoření produktu pomocí PrestaShop API – metoda POST
        const createResponse = await axios.post(
          `${prestaApiUrl}/products`,
          xmlPayload,
          {
            auth: {
              username: prestaApiKey,
              password: ''
            },
            headers: {
              'Content-Type': 'text/xml'
            }
          }
        );
        console.log(`Produkt s referencí ${productRef} byl vytvořen.`, createResponse.data);
        createdCount++;
      } catch (err) {
        console.error(
          `Chyba při vytváření produktu s referencí ${productRef}:`,
          err.response ? err.response.data : err.message
        );
      }
    }

    const message = `Vytvořeno ${createdCount} produktů v PrestaShop.`;
    console.log(message);
    return res.status(200).json({ success: true, message });
  } catch (error) {
    console.error('Chyba při zakládání produktů v PrestaShop:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Chyba při zakládání produktů v PrestaShop.',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});








// Endpoint pro získání detailu produktu v tavinox s výstupem jako JSON
app.get('/tx_products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    console.log(`=== /tav_products/${productId} endpoint byl zavolán ===`);

    // Získání přihlašovacích údajů z .env
    const prestaApiKey = process.env.PRESTASHOP_API_KEY;
    const prestaApiUrl = process.env.PRESTASHOP_API_URL;

    // Volání PrestaShop API s parametrem output_format=JSON
    const response = await axios.get(`${prestaApiUrl}/products/${productId}?output_format=JSON`, {
      auth: {
        username: prestaApiKey, // API klíč z .env
        password: ''            // heslo je prázdné
      }
    });

    console.log('Odpověď z PrestaShop API:', response.data);

    return res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    if (error.response) {
      console.error('Chyba při získávání produktu:', error.response.status, error.response.data);
      return res.status(error.response.status).json({
        success: false,
        message: 'Chyba při získávání produktu z PrestaShop API',
        details: error.response.data,
      });
    } else if (error.request) {
      console.error('Žádná odpověď od PrestaShop API:', error.request);
      return res.status(500).json({
        success: false,
        message: 'Žádná odpověď od PrestaShop API',
        details: error.request,
      });
    } else {
      console.error('Nastala chyba:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Nastala chyba při získávání produktu z PrestaShop API',
        details: error.message,
      });
    }
  }
});


// Endpoint pro test přístupu k API (volání kořenové URL /api/)
app.get('/api-test', async (req, res) => {
  try {
    const response = await axios.get(prestaApi_URL, {
      headers: {
        // Posíláme Authorization header
        Authorization: authorizationHeader
      }
    });
    // PrestaShop API vrací XML se seznamem zdrojů.
    res.type('application/xml');
    res.send(response.data);
  } catch (error) {
    console.error('Chyba při testování API:', error.message);
    res.status(500).json({ error: 'Chyba při testování API' });
  }
});


app.get('/tx_products', async (req, res) => {
  try {
    console.log('=== /tx_products endpoint byl zavolán ===');

    // Zavoláme PrestaShop API pro získání produktů
    const response = await axios.get(`${prestaApi_URL}/products`, {
      auth: {
        username: prestaApiKey, // API klíč jako řetězec
        password: '' // heslo je prázdné
      }
    });

    console.log('Odpověď z PrestaShop API:', response.data);

    // Pokud API vrací data ve formátu, který můžeme přímo odeslat
    // (například JSON, případně XML, pokud je to vhodné pro klienta)
    return res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    // Pokud API vrací odpověď s chybovým kódem, můžeme získat podrobnosti
    if (error.response) {
      console.error('Chyba při získávání produktů:', error.response.status, error.response.data);
      return res.status(error.response.status).json({
        success: false,
        message: 'Chyba při získávání produktů z PrestaShop API',
        details: error.response.data,
      });
    } else if (error.request) {
      console.error('Žádná odpověď od PrestaShop API:', error.request);
      return res.status(500).json({
        success: false,
        message: 'Žádná odpověď od PrestaShop API',
        details: error.request,
      });
    } else {
      console.error('Nastala chyba:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Nastala chyba při získávání produktů z PrestaShop API',
        details: error.message,
      });
    }
  }
});



app.get('/pt_products', async (req, res) => {
  try {
    console.log('=== /pt_products endpoint byl zavolán ===');

    // Voláme API s parametrem display, abychom získali pouze id a reference
    const response = await axios.get(`${pneutyresApi_URL}/products?display=[id,reference]`, {
      auth: {
        username: pneutyresApiKey, // API klíč
        password: ''              // heslo je prázdné
      }
    });

    // Převod XML odpovědi na JSON
    const jsonData = await parser.parseStringPromise(response.data);
    console.log('Parsed data:', jsonData);

    return res.status(200).json({
      success: true,
      data: jsonData,
    });
  } catch (error) {
    if (error.response) {
      console.error('Chyba při získávání produktů:', error.response.status, error.response.data);
      return res.status(error.response.status).json({
        success: false,
        message: 'Chyba při získávání produktů z PrestaShop API',
        details: error.response.data,
      });
    } else if (error.request) {
      console.error('Žádná odpověď od PrestaShop API:', error.request);
      return res.status(500).json({
        success: false,
        message: 'Žádná odpověď od PrestaShop API',
        details: error.request,
      });
    } else {
      console.error('Nastala chyba:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Nastala chyba při získávání produktů z PrestaShop API',
        details: error.message,
      });
    }
  }
});



// Endpoint pro import dat ze souboru tavinox.xlsx (list "GTINy") do tabulky TX_products
app.post('/import-xlsx-tx-products', async (req, res) => {
  let connection;
  try {
    // Sestavení cesty k souboru tavinox.xlsx (soubor je ve stejném adresáři jako server.js)
    const filePath = path.join(__dirname, 'tavinox.xlsx');
    if (!fs.existsSync(filePath)) {
      return res.status(400).send(`Soubor ${filePath} nebyl nalezen.`);
    }

    // Načtení souboru jako buffer
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = 'GTINy';

    if (!workbook.SheetNames.includes(sheetName)) {
      return res.status(400).send(`List '${sheetName}' nebyl nalezen.`);
    }

    const worksheet = workbook.Sheets[sheetName];
    // Převod listu do pole objektů (každý objekt odpovídá jednomu řádku)
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { raw: false });

    // Získání připojení z poolu
    connection = await new Promise((resolve, reject) => {
      poolC5sluzbyint.getConnection((err, conn) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });
    await connection.beginTransaction();

    // Objekt mapování – přiřazuje názvy sloupců v XLSX na názvy sloupců v tabulce TX_products
    const mapping = {
      'Gtin': 'Gtin',
      'TradeItemDescription.Value': 'TradeItemDescription_Value',
      'TradeItemDescription.LanguageCode': 'TradeItemDescription_LanguageCode',
      'ProductNetContent.Value': 'ProductNetContent_Value',
      'ProductNetContent.MeasureUnit': 'ProductNetContent_MeasureUnit',
      'ProductNetContent.MeasureUnitCode': 'ProductNetContent_MeasureUnitCode',
      'GpcId': 'GpcId',
      'TradeItemUnitDescriptorCode': 'TradeItemUnitDescriptorCode',
      'TradeItemUnitDescriptor': 'TradeItemUnitDescriptor',
      'IsTradeItemAConsumerUnit': 'IsTradeItemAConsumerUnit',
      'ChildGtin.Quantity': 'ChildGtin_Quantity',
      'ChildGtin.Gtin': 'ChildGtin_Gtin',
      'TargetMarket.CountryCode': 'TargetMarket_CountryCode_1',
      'TargetMarket.CountryName': 'TargetMarket_CountryName_1',
      'TargetMarket.AdditionalTradeItemIdentification': 'TargetMarket_AdditionalTradeItemIdentification_1',
      'TargetMarket.ExternalProductImageUrl': 'TargetMarket_ExternalProductImageUrl_1',
      'CreatedDateTime': 'CreatedDateTime',
      'LastChangeDateTime': 'LastChangeDateTime',
      'EAN': 'EAN',
      'EAN sáček': 'EAN_sacek',
      'EAN Krabice': 'EAN_Krabice',
      'Druh položky': 'Druh_polozky',
      'Produktová řada': 'Produktova_rada',
      'Kategorie': 'Kategorie',
      'Prefix kategorie': 'Prefix_kategorie',
      'Kód kategorie': 'Kod_kategorie',
      'Podkategorie': 'Podkategorie',
      'Provedení': 'Provedeni',
      'Kod provedení': 'Kod_provedeni',
      'Varianta': 'Varianta',
      'Oddělovač': 'Oddelovac',
      'Kód produktu': 'Kod_produktu',
      'Prefix Kód produktu': 'Prefix_Kod_produktu',
      'Druh materiálu': 'Druh_materialu',
      'Skupina položek AX': 'Skupina_polozek_AX',
      'Skupina řádkové slevy AX': 'Skupina_radkove_slevy_AX',
      'Dodavatel': 'Dodavatel',
      'IČO Dodavatele': 'ICO_Dodavatele',
      'Země původu': 'Zeme_puvodu',
      'Norma': 'Norma',
      'Třída materiálu': 'Trida_materialu',
      'Průměr': 'Prumer',
      'Úhel [°]': 'Uhel',
      'Váha [kg]': 'Vaha_kg',
      'Průměr (D) [mm]': 'Prumer_D_mm',
      'Tloušťka stěny (T) [mm]': 'Tloustka_steny_T_mm',
      'Rozměr': 'Rozmer',
      'First line engraving': 'First_line_engraving',
      'Second line engraving': 'Second_line_engraving',
      'Third line engraving': 'Third_line_engraving',
      'Fourth line engraving': 'Fourth_line_engraving',
      'Engraving on back filename': 'Engraving_on_back_filename',
      'GS1 digitallink': 'GS1_digitallink',
      'L [mm]': 'L_mm',
      'Rozměr (L1) [mm]': 'Rozmer_L1_mm',
      'Rozměr (Z) [mm]': 'Rozmer_Z_mm',
      'Rozměr (Z1) [mm]': 'Rozmer_Z1_mm',
      'Rozměr (S) [mm]': 'Rozmer_S_mm',
      'Rozměr (S1) [mm]': 'Rozmer_S1_mm',
      'Prm. (d) [mm]': 'Prm_d_mm',
      'Počet děr (n)': 'Pocet_der',
      'Rozměr (H)': 'Rozmer_H',
      'Rozměr (D1)  [mm]': 'Rozmer_D1_mm',
      'Rozměr (D2)  [mm]': 'Rozmer_D2_mm',
      'Sáček ks': 'Sacek_ks',
      'Sáček jednotka EN': 'Sacek_jednotka_EN',
      'Počet sáčků v krabici': 'Pocet_sacku_v_krabici',
      'Jednotka sacky v krabici EN': 'Jednotka_sacky_v_krabici_EN',
      'Krabice ks': 'Krabice_ks',
      'Krabice jednotka EN': 'Krabice_jednotka_EN',
      'UNC obrazek stitek': 'UNC_obrazek_stitek',
      'Popis štítek EN': 'Popis_stitek_EN',
      'Popis štítek CZ': 'Popis_stitek_CZ',
      'Popis štítek CZ bez rozměru': 'Popis_stitek_CZ_bez_rozmeru',
      'Druh zápisu': 'Druh_zapisu',
      'Název': 'Nazev',
      'Zkrácený popis štítek CZ PH': 'Zkrateny_popis_stitek_CZ_PH',
      'RZZZ': 'RZZZ',
      'Nákupní cena CN [USD]': 'Nakupni_cena_CN_USD',
      'Původní cena': 'Puvodni_cena',
      'Zdražení': 'Zdrazeni',
      'bbb': 'bbb',
      'nárůst': 'narust',
      'fa': 'fa',
      'Drawing_url': 'Drawing_url',
      'picture_url': 'picture_url',
      'Typ Krabice': 'Typ_Krabice',
      'Rozměr Krabice': 'Rozmer_Krabice',
      'Rozměr sáčku': 'Rozmer_sacku',
      'x11': 'x11',
      'Objednávka 0': 'Objednavka_0',
      'Objednávka krabic 0': 'Objednavka_krabic_0',
      '1. Objednávka ks': 'Objednavka_1_ks',
      '1. Objednávka krabic': 'Objednavka_1_krabic',
      '1 objednávka cena za položky': 'Objednavka_cena_za_polozky_1',
      'Váha zboží 1. objednávky [kg]': 'Vaha_zbozi_1_objednavky_kg',
      'NC Zboží po Michalovi CZK': 'NC_Zbozi_po_Michalovi_CZK',
      'Cena dopravy CZK': 'Cena_dopravy_CZK',
      'Cena cla': 'Cena_cla',
      'Základní kalkulace NC sklad': 'Zakladni_kalkulace_NC_sklad',
      'NC po clu a doprave za  3000USD, USD je 24': 'NC_po_clu_a_doprave_3000USD',
      'NC po clu a doprave za  5000USD, USD je 24': 'NC_po_clu_a_doprave_5000USD',
      'NC po clu a doprave za  7000USD, USD je 24': 'NC_po_clu_a_doprave_7000USD',
      'NC po clu a doprave za  10000USD, USD je 24': 'NC_po_clu_a_doprave_10000USD',
      'ARSECO DPC': 'ARSECO_DPC',
      'Kod ARSECO': 'Kod_ARSECO',
      'ARSECO 50% TENDR': 'ARSECO_50_TENDR',
      'ARSECO ARENA': 'ARSECO_ARENA',
      'Nákup VO DE EUR': 'Nakup_VO_DE_EUR',
      'Nákup VO DE CZK': 'Nakup_VO_DE_CZK',
      'Násobek DE vs Nákupní cena CN': 'Nasobek_DE_vs_Nakupni_cena_CN',
      'Nejlevnější na Inet': 'Nejlepsi_na_Inet',
      'rozdíl nákup vs internet koeficient': 'rozdil_nakup_vs_internet_koeficient',
      'NC priblizebna sklad': 'NC_priblizebna_sklad',
      'Cenik TP316L': 'Cenik_TP316L',
      'PC ARSECO TAVINOX': 'PC_ARSECO_TAVINOX',
      'PC VO1 TAVINOX': 'PC_VO1_TAVINOX',
      'Hruba marze PC ARSECO TAVINOX': 'Hruba_marze_PC_ARSECO_TAVINOX',
      'Hruba marze PC VO1 TAVINOX': 'Hruba_marze_PC_VO1_TAVINOX',
      '2. Objednávka ks': 'Objednavka_2_ks',
      '2. Objednávka krabic': 'Objednavka_2_krabic',
      '3. Objednávka ks': 'Objednavka_3_ks',
      '3. Objednávka krabic': 'Objednavka_3_krabic',
      '4. Objednávka ks': 'Objednavka_4_ks',
      '4. Objednávka krabic': 'Objednavka_4_krabic'
    };

    // Pro každý řádek z listu "GTINy" sestavíme a provedeme INSERT dotaz
    for (const row of jsonData) {
      const insertValues = [];
      const columns = [];
      for (const [xlsxKey, dbCol] of Object.entries(mapping)) {
        columns.push(dbCol);
        // Pokud hodnota v řádku neexistuje, vložíme NULL
        insertValues.push(row[xlsxKey] !== undefined ? row[xlsxKey] : null);
      }
      const sql = `INSERT INTO TX_products (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
      await new Promise((resolve, reject) => {
        connection.query(sql, insertValues, (err, result) => {
          if (err) {
            console.error("Chyba při vkládání řádku:", err, "Řádek:", row);
            return reject(err);
          }
          resolve(result);
        });
      });
    }

    await connection.commit();
    res.send('Data byla úspěšně importována do tabulky TX_products.');
  } catch (error) {
    console.error('Chyba při zpracování souboru nebo vkládání dat:', error);
    if (connection) {
      await connection.rollback();
    }
    res.status(500).send('Chyba při zpracování souboru nebo vkládání dat.');
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// úprava zákazníku dle tabulky Zakaznici_AX
// Nový GET endpoint pro aktualizaci dat z tabulky Zakaznici_AX a jejich uložení do Raynet CRM
app.get('/raynet/update-zakaznici', async (req, res) => {
  let connection;

  // Statické mapování pro Radkova_sleva -> companyClassification1
  const zakazniciMap = {
    "7-DOPRAVCI": 231,
    "6-INDIV": 230,
    "5-VIP": 229,
    "4-VO": 228,
    "3-SERVIS": 227,
    "2-PULT": 226,
    "1-ESHOP": 225
  };

  // Statické mapování pro CompanyClassification3 z Jmeno_OZ_Karta
  const companyClassification3Map = {
    "OSTRAVA": 235,
    "ZLÍN": 242,
    "ZLIN": 242,
    "PRAHA": 261,
    "BRNO": 262,
    "NEPŘIŘAZENO": 263,
    "CB": 264
  };

  // Statické mapování pro owner na základě jména extrahovaného ze sloupce Jmeno_OZ_Karta.
  // Klíče jsou v uppercase – pokud owner nenajdeme, defaultně se nastaví na René Schneer (id: 13)
  const ownerMap = {
    "KOVAŘÍK ALEŠ": 154,
    "BRTNA JAN": 166,
    "HINK DAVID": 18,
    "VALČÍKOVÁ OLGA": 167,
    "FORMAN BOHUMIL": 168,
    "JENÍK PAVEL": 17,
    "KOMENDIR LUMÍR": 66,
    "MATLOCHA KAMIL": 170,
    "CHRÁSTKOVÁ JANA": 169
    // Další mapping lze doplnit podle potřeby
  };

  try {
    console.log('=== /raynet/update-zakaznici byl zavolán ===');
    console.log('Připojuji se k MySQL databázi (poolC5tpms)...');
    connection = await poolC5tpms.getConnection();

    // Načteme unikátní ICO, Radkova_sleva a Jmeno_OZ_Karta z tabulky Zakaznici_AX (omezeno na ICO = '01744224')
    const sql = `
      SELECT DISTINCT
        ICO,
        Radkova_sleva,
        Jmeno_OZ_Karta
      FROM
        Zakaznici_AX
      WHERE
        Radkova_sleva IS NOT NULL
        AND Radkova_sleva != ''
      
    `;

    console.log('Spouštím SQL dotaz:', sql);
    const rows = await new Promise((resolve, reject) => {
      connection.query(sql, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    console.log(`Načteno ${rows.length} záznamů (ICO vs. Radkova_sleva).`);
    const uniqueSkupiny = [...new Set(rows.map(row => row.Radkova_sleva.trim().toUpperCase()))];
    console.log('Unikátní hodnoty Radkova_sleva:', uniqueSkupiny);
    uniqueSkupiny.forEach(skupina => {
      if (!zakazniciMap[skupina]) {
        console.warn(`Nenastaveno mapování pro zákaznickou skupinu: "${skupina}"`);
      }
    });

    let countUpdated = 0;
    let countSkipped = 0;
    let countErrors = 0;
    const errorDetails = [];

    for (const row of rows) {
      const { ICO, Radkova_sleva, Jmeno_OZ_Karta } = row;
      console.log(`\n=== Zpracovávám ICO: ${ICO} ===`);

      // Najdeme firmu v Raynet CRM podle IČ
      const company = await findCompanyByRegNumber(ICO);
      if (!company) {
        console.warn(`Firma s IČ ${ICO} nebyla nalezena v Raynet CRM. Přeskakuji...`);
        countSkipped++;
        continue;
      }
      const companyId = company.id;
      console.log(`Nalezena firma (ID: ${companyId}) pro IČ ${ICO}. Aktualizuji zákaznickou skupinu...`);

      // Mapování Radkova_sleva na Raynet ID (companyClassification1)
      const customerGroup = Radkova_sleva.trim().toUpperCase();
      const raynetGroupId = zakazniciMap[customerGroup];
      if (!raynetGroupId) {
        console.warn(`Nenalezeno Raynet ID pro zákaznickou skupinu "${Radkova_sleva}". Přeskakuji...`);
        countSkipped++;
        continue;
      }
      console.log(`Mapování Radkova_sleva "${Radkova_sleva}" na Raynet ID: ${raynetGroupId}`);

      // Extrakce pro companyClassification3 z Jmeno_OZ_Karta – vezmeme část za podtržítkem (první slovo)
      let classification3Value = "";
      let ownerName = "";
      if (Jmeno_OZ_Karta) {
        const parts = Jmeno_OZ_Karta.split('_');
        if (parts.length > 1) {
          classification3Value = parts[1].split(' ')[0].trim().toUpperCase();
          ownerName = parts[0].trim().toUpperCase();
        } else {
          ownerName = Jmeno_OZ_Karta.trim().toUpperCase();
        }
      }
      let classification3Id = companyClassification3Map[classification3Value];
      if (!classification3Id) {
        console.warn(`Nenalezeno mapování pro CompanyClassification3 s hodnotou "${classification3Value}" získanou z Jmeno_OZ_Karta "${Jmeno_OZ_Karta}". Nastavuji "NEPŘIŘAZENO".`);
        classification3Id = companyClassification3Map["NEPŘIŘAZENO"];
      }
      console.log(`Mapování CompanyClassification3 "${classification3Value}" na Raynet ID: ${classification3Id}`);

      // Mapování vlastníka – hledáme v ownerMap podle extrahovaného jména (ownerName).
      let ownerId = ownerMap[ownerName];
      if (!ownerId) {
        console.warn(`Nenalezeno mapování pro vlastníka "${ownerName}". Nastavuji defaultního vlastníka "René Schneer".`);
        ownerId = 13;
      }
      console.log(`Mapování vlastníka "${ownerName}" na Raynet Owner ID: ${ownerId}`);

      // Načteme aktuální data firmy z Raynet CRM
      const currentCompanyData = await getCompanyDetails(companyId);
      if (!currentCompanyData) {
        console.warn(`Nenalezena aktuální data pro firmu (ID: ${companyId}). Přeskakuji...`);
        countSkipped++;
        continue;
      }
      console.log(`Aktuální data firmy (ID: ${companyId}):`, currentCompanyData);

      // Připravíme aktualizační objekt – aktualizujeme obě klasifikace, securityLevel a nastavíme vlastníka
      const updatedCompanyData = {
        companyClassification1: raynetGroupId,
        companyClassification3: classification3Id,
        securityLevel: 7,
        owner: ownerId,
        customFields: {
          ...currentCompanyData.customFields,
          Lonsky_zis_7aac1: raynetGroupId,
          CompanyClassification3: classification3Id
        }
      };

      console.log(`Aktualizační data pro firmu (ID: ${companyId}):`, updatedCompanyData);

      try {
        await updateCompanyInRaynet(companyId, updatedCompanyData);
        console.log(`Firma (ID: ${companyId}) úspěšně aktualizována pro IČ ${ICO}.`);
        countUpdated++;
      } catch (err) {
        console.error(`Chyba při aktualizaci firmy (ID: ${companyId}):`, err.message);
        countErrors++;
        errorDetails.push({ ICO, companyId, error: err.message });
      }
    }

    const message = `Aktualizace dokončena. Aktualizováno: ${countUpdated}, Přeskočeno: ${countSkipped}, Chyby: ${countErrors}`;
    console.log(message);
    return res.status(200).json({
      success: true,
      message,
      details: { updated: countUpdated, skipped: countSkipped, errors: countErrors, errorDetails }
    });
  } catch (error) {
    console.error('Chyba při aktualizaci dat z Zakaznici_AX:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Nastala chyba při aktualizaci dat z Zakaznici_AX.',
      error: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});






// Nový GET endpoint pro aktualizaci cenových skupin u klientů dle ICO
app.get('/raynet/update-cenove-skupiny', async (req, res) => {
  let connection;

  try {
    console.log('=== /raynet/update-cenove-skupiny byl zavolán ===');
    console.log('Připojuji se k MySQL databázi...');
    connection = await poolC5tpms.getConnection();

    // 1) Načteme unikátní ICO a Cenova_skupina z AX_PPR
    const sql = `
      SELECT DISTINCT
        ICO,
        Cenova_skupina
      FROM
        AX_PPR
      WHERE
        Cenova_skupina IS NOT NULL
        AND Cenova_skupina != ''
    `;

    console.log('Spouštím SQL dotaz:', sql);
    const rows = await poolC5tpms.query(sql);

    console.log(`Načteno ${rows.length} záznamů (ICO vs. Cenova_skupina).`);

    // Logování unikátních hodnot Cenova_skupina pro ověření
    const uniqueCenoveSkupiny = [...new Set(rows.map(row => row.Cenova_skupina.trim()))];
    console.log('Unikátní hodnoty Cenova_skupina:', uniqueCenoveSkupiny);

    // Kontrola, které hodnoty nejsou mapovány
    uniqueCenoveSkupiny.forEach(skupina => {
      if (!cenoveSkupinyMap[skupina]) {
        console.warn(`Nenastaveno mapování pro Cenova_skupina: "${skupina}"`);
      }
    });

    let countUpdated = 0;
    let countSkipped = 0;
    let countErrors = 0;
    const errorDetails = [];

    // 2) Pro každý řádek najdi firmu v Raynetu podle ICO a zaktualizuj její customFields
    for (const row of rows) {
      const { ICO, Cenova_skupina } = row;
      console.log(`\n=== Zpracovávám ICO: ${ICO} ===`);

      // Najít firmu v Raynet CRM
      const company = await findCompanyByRegNumber(ICO);
      if (!company) {
        console.warn(`Firma s IČ ${ICO} nebyla nalezena v Raynet CRM. Přeskakuji...`);
        countSkipped++;
        continue;
      }

      // ID firmy, se kterou budeme pracovat
      const companyId = company.id;
      console.log(`Nalezena firma (ID: ${companyId}) pro IČ ${ICO}. Aktualizuji Cenova_skupina...`);

      // Získat Raynet ID pro Cenova_skupina
      const cenovaSkupinaTrimmed = Cenova_skupina.trim();
      const raynetCenovaId = cenoveSkupinyMap[cenovaSkupinaTrimmed];
      if (!raynetCenovaId) {
        console.warn(`Nenalezeno Raynet ID pro Cenova_skupina "${Cenova_skupina}". Přeskakuji...`);
        countSkipped++;
        continue;
      }

      console.log(`Mapování Cenova_skupina "${Cenova_skupina}" na Raynet ID: ${raynetCenovaId}`);

      // 3) Načíst aktuální data firmy
      const currentCompanyData = await getCompanyDetails(companyId);
      if (!currentCompanyData) {
        console.warn(`Nenalezena aktuální data pro firmu (ID: ${companyId}). Přeskakuji...`);
        countSkipped++;
        continue;
      }

      console.log(`Aktuální data firmy (ID: ${companyId}):`, currentCompanyData);

      // 4) Aktualizovat potřebná pole
      const updatedCompanyData = {
        // Přepíšeme pouze pole, která chceme aktualizovat
        companyClassification1: raynetCenovaId, // Aktualizace Cenova_skupina
        customFields: {
          ...currentCompanyData.customFields, // Zachováme ostatní customFields
          Lonsky_zis_7aac1: raynetCenovaId   // Aktualizace Cenova_skupina
        }
      };

      console.log(`Updated Company Data for (ID: ${companyId}):`, updatedCompanyData);

      // 5) Aktualizuj firmu v Raynetu
      try {
        await updateCompanyInRaynet(companyId, updatedCompanyData);
        console.log(`Firma (ID: ${companyId}) úspěšně aktualizována pro IČ ${ICO}.`);
        countUpdated++;
      } catch (err) {
        // Pokud dojde k chybě při POST, zaznamenáme ji a pokračujeme
        console.error(`Chyba při aktualizaci firmy (ID: ${companyId}):`, err.message);
        countErrors++;
        errorDetails.push({ ICO, companyId, error: err.message });
      }
    }

    const message = `Aktualizace dokončena. Úspěšně aktualizováno: ${countUpdated}, přeskočeno: ${countSkipped}, chyby: ${countErrors}`;
    console.log(message);

    return res.status(200).json({
      success: true,
      message,
      details: {
        updated: countUpdated,
        skipped: countSkipped,
        errors: countErrors,
        errorDetails
      }
    });
  } catch (error) {
    console.error('Chyba při aktualizaci Cenova_skupina:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Nastala chyba při aktualizaci Cenova_skupina v Raynet CRM.',
      error: error.message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// Endpoint pro aktualizaci vlastních polí (customFields) u klientů dle ICO – zdroj dat z MSSQL
// s ohledem na ItsIFCustInvoiceTrans (faktury) a vyčíslením Pneu a Protektorů
app.get('/raynet/update-company-fields-2023-2024', async (req, res) => {
  try {
    console.log('=== /raynet/update-company-fields-2023-2024 byl zavolán ===');
    console.log('Připojuji se k MSSQL databázi...');

    // Nový dotaz: souhrn podle ICO + CustName, plus vygenerování 
    // celkové hodnoty (TotalLineAmount) a dvou nových sloupců 
    // pro pneu (01040) a protektory (02040,03040).
    // Vybíráme pro rok 2024 jako příklad (můžete změnit i roky).
    const queryStr = `
      SELECT
          t.RegNum AS ICO,
          t.CustName,
          SUM(cit.Qty) AS TotalQty,
          SUM(cit.LineAmountMst) AS TotalLineAmount,
          SUM(CASE WHEN inv.ItemGroupId = '01040' THEN cit.LineAmountMst ELSE 0 END) AS TotalSalesPneu,
          SUM(CASE WHEN inv.ItemGroupId IN ('02040','03040') THEN cit.LineAmountMst ELSE 0 END) AS TotalSalesProtektory,
          YEAR(cit.InvoiceDate) AS Rok
      FROM [AxProdCS].[dbo].[ItsIFCustInvoiceTrans] cit
      JOIN [AxProdCS].[dbo].[ItsIFSalesLine] l 
          ON cit.InventTransId = l.InventTransId
      JOIN [AxProdCS].[dbo].[ItsIFSalesTable] t 
          ON l.SalesId = t.SalesId
      JOIN [AxProdCS].[dbo].[ItsIFInventTable] inv
          ON l.ItemId = inv.ItemId
      WHERE t.SalesStatusText = 'Fakturováno'
            AND YEAR(cit.InvoiceDate) IN (2022, 2023, 2024, 2025)
      GROUP BY 
          t.RegNum,
          t.CustName,
          YEAR(cit.InvoiceDate)
    `;

    // Spustíme dotaz a načteme výsledky
    const result = await queryMSSQL(queryStr, []);
    console.log(`Načteno ${result.recordset.length} řádků z MSSQL.`);

    // Nyní musíme data agregovat do podoby:
    // companySales = {
    //   [ICO]: {
    //      Pneu: {2022: val, 2023: val, 2024: val, 2025: val}, 
    //      Protektory: { ... },
    //      Celkove: { ... }
    //   }
    // }
    // Tentokrát vycházíme z fakturační tabulky a spojujeme s ItemGroupId => 
    // Budeme brát součty pro Celkove, Pneu, Protektory. Z recordsetu vyzvedneme roky a ICO.

    const companySales = {};
    for (const row of result.recordset) {
      const { ICO, CustName, TotalQty, TotalLineAmount, TotalSalesPneu, TotalSalesProtektory, Rok } = row;

      if (!companySales[ICO]) {
        // Struktura: Pneu, Protektory, Celkove
        companySales[ICO] = {
          CustName: CustName,
          Pneu: { 2022: 0, 2023: 0, 2024: 0, 2025: 0 },
          Protektory: { 2022: 0, 2023: 0, 2024: 0, 2025: 0 },
          Celkove: { 2022: 0, 2023: 0, 2024: 0, 2025: 0 },
        };
      }

      // Uložíme sumy do konkrétního roku
      companySales[ICO].Pneu[Rok] += (TotalSalesPneu || 0);
      companySales[ICO].Protektory[Rok] += (TotalSalesProtektory || 0);
      companySales[ICO].Celkove[Rok] += (TotalLineAmount || 0);
    }

    let countUpdated = 0;
    let countSkipped = 0;

    // Pro každé ICO provedeme aktualizaci v Raynet
    for (const ICO in companySales) {
      console.log(`\n=== Zpracovávám ICO: ${ICO} ===`);
      const { Pneu, Protektory, Celkove } = companySales[ICO];

      // Hledáme firmu v Raynet podle IČ
      const company = await findCompanyByRegNumber(ICO);
      if (!company) {
        console.warn(`Firma s IČ ${ICO} nebyla nalezena v Raynet CRM. Přeskakuji...`);
        countSkipped++;
        continue;
      }

      const companyId = company.id;
      console.log(`Nalezena firma (ID: ${companyId}) pro IČ ${ICO}. Aktualizuji customFields...`);

      // Příklad logiky pro aktivitu:
      const sum2025 = Celkove[2025] || 0;
      const sum2024 = Celkove[2024] || 0;
      let aktivitaText;
      if (sum2025 > 0) {
        aktivitaText = "Aktivní";
      } else if (sum2025 === 0 && sum2024 > 0) {
        aktivitaText = "Spící";
      } else {
        aktivitaText = "Neaktivní";
      }

      // Připravíme data do custom fields
      const updateData = {
        customFields: {
          // Pneumatiky
          Pneu_2022_c3d4b: (Pneu[2022] || 0).toString(),
          Pneu_2023_c0d53: (Pneu[2023] || 0).toString(),
          Pneu_2024_3bcca: (Pneu[2024] || 0).toString(),
          Pneu_2025_23a7e: (Pneu[2025] || 0).toString(),
          // Protektory
          Protektory_f173c: (Protektory[2022] || 0).toString(),
          Protektory_b1cab: (Protektory[2023] || 0).toString(),
          Protektory_ba1af: (Protektory[2024] || 0).toString(),
          Protektory_f267b: (Protektory[2025] || 0).toString(),
          // Celkové tržby
          "2022_878ae": (Celkove[2022] || 0).toString(),
          "2023_dce17": (Celkove[2023] || 0).toString(),
          "2024_5e717": (Celkove[2024] || 0).toString(),
          "2025_7e3e9": (Celkove[2025] || 0).toString(),
          // Aktivita
          Aktivita_54b91: aktivitaText
        }
      };

      try {
        await updateCompanyInRaynet(companyId, updateData);
        console.log(`Firma (ID: ${companyId}) úspěšně aktualizována pro IČ ${ICO}.`);
        countUpdated++;
      } catch (err) {
        console.error(`Chyba při aktualizaci firmy (ID: ${companyId}):`, err.message);
      }
    }

    const message = `Aktualizace dokončena. Úspěšně aktualizováno: ${countUpdated}, přeskočeno: ${countSkipped}`;
    console.log(message);
    return res.status(200).json({
      success: true,
      message
    });

  } catch (error) {
    console.error('Chyba při aktualizaci customFields:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Nastala chyba při aktualizaci záznamů v Raynet CRM.',
      error: error.message,
    });
  }
});



// Nový endpoint pro aktualizaci customField Email_ce5be z databáze MySQL (poolC5tpms)
// s využitím MySQL knihovny
app.get('/raynet/update-email-customfield', (req, res) => {
  console.log('=== /raynet/update-email-customfield byl zavolán ===');
  console.log('Připojuji se k databázi poolC5tpms (MySQL)...');

  // Dotaz pro načtení dat z tabulky WDL_klienti
  const queryStr = `
    SELECT 
      Kategorie, 
      Email, 
      Web, 
      Tel1, 
      IC 
    FROM c5tpms.WDL_klienti
  `;

  poolC5tpms.query(queryStr, async (err, results) => {
    if (err) {
      console.error('Chyba při načítání dat:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Chyba při načítání dat z databáze.',
        error: err.message,
      });
    }

    console.log(`Načteno ${results.length} řádků z c5tpms.WDL_klienti.`);
    let countUpdated = 0;
    let countSkipped = 0;

    // Iterace přes všechny načtené klienty
    for (const row of results) {
      const { IC, Email } = row;
      console.log(`\n=== Zpracovávám IČ: ${IC} ===`);

      try {
        // Hledáme firmu v Raynet podle IČ (pole IC odpovídá RegNum)
        const company = await findCompanyByRegNumber(IC);
        if (!company) {
          console.warn(`Firma s IČ ${IC} nebyla nalezena v Raynet CRM. Přeskakuji...`);
          countSkipped++;
          continue;
        }

        const companyId = company.id;
        console.log(`Nalezena firma (ID: ${companyId}) pro IČ ${IC}. Aktualizuji customField Email_ce5be...`);

        // Připravíme objekt updateData s hodnotou Email z MySQL
        const updateData = {
          customFields: {
            Email_ce5be: Email || ''
          }
        };

        await updateCompanyInRaynet(companyId, updateData);
        console.log(`Firma (ID: ${companyId}) úspěšně aktualizována pro IČ ${IC}.`);
        countUpdated++;
      } catch (updateErr) {
        console.error(`Chyba při aktualizaci firmy s IČ ${IC}:`, updateErr.message);
      }
    }

    const message = `Aktualizace dokončena. Úspěšně aktualizováno: ${countUpdated}, přeskočeno: ${countSkipped}`;
    console.log(message);
    return res.status(200).json({
      success: true,
      message
    });
  });
});

//W M S

// GET: načte aktuální šablony (předpokládáme, že pracujeme s jediným záznamem)
app.get('/api/templateSettings', async (req, res) => {
  try {
    const query = 'SELECT * FROM WH_template_settings LIMIT 1';
    const results = await poolC5sluzbyint.query(query);
    if (results.length === 0) {
      return res.json({ templateSettings: null });
    }
    const row = results[0];
    // Převedeme uložené JSON řetězce na objekty
    row.floor_heights = JSON.parse(row.floor_heights);
    row.section_widths = JSON.parse(row.section_widths);
    row.pallet_sizes = JSON.parse(row.pallet_sizes);
    res.json({ templateSettings: row });
  } catch (err) {
    console.error('Error fetching template settings:', err);
    res.status(500).json({ error: 'Error fetching template settings' });
  }
});

// POST: založení nových šablon
app.post('/api/templateSettings', async (req, res) => {
  const { floorHeights, sectionWidths, palletSizes } = req.body;
  if (!floorHeights || !sectionWidths || !palletSizes) {
    return res.status(400).json({ error: 'Missing template data' });
  }
  try {
    const floorHeightsStr = JSON.stringify(floorHeights);
    const sectionWidthsStr = JSON.stringify(sectionWidths);
    const palletSizesStr = JSON.stringify(palletSizes);
    const query = `
      INSERT INTO WH_template_settings (floor_heights, section_widths, pallet_sizes, updated_at)
      VALUES (?, ?, ?, NOW())
    `;
    const result = await poolC5sluzbyint.query(query, [floorHeightsStr, sectionWidthsStr, palletSizesStr]);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Error creating template settings:', err);
    res.status(500).json({ error: 'Error creating template settings' });
  }
});

// PUT: aktualizace šablon (podle id)
app.put('/api/templateSettings/:id', async (req, res) => {
  const { id } = req.params;
  const { floorHeights, sectionWidths, palletSizes } = req.body;
  if (!floorHeights || !sectionWidths || !palletSizes) {
    return res.status(400).json({ error: 'Missing template data' });
  }
  try {
    const floorHeightsStr = JSON.stringify(floorHeights);
    const sectionWidthsStr = JSON.stringify(sectionWidths);
    const palletSizesStr = JSON.stringify(palletSizes);
    const query = `
      UPDATE WH_template_settings
      SET floor_heights = ?, section_widths = ?, pallet_sizes = ?, updated_at = NOW()
      WHERE id = ?
    `;
    await poolC5sluzbyint.query(query, [floorHeightsStr, sectionWidthsStr, palletSizesStr, id]);
    res.json({ success: true, id });
  } catch (err) {
    console.error('Error updating template settings:', err);
    res.status(500).json({ error: 'Error updating template settings' });
  }
});

// DELETE: smazání šablon
app.delete('/api/templateSettings/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'DELETE FROM WH_template_settings WHERE id = ?';
    await poolC5sluzbyint.query(query, [id]);
    res.json({ success: true, id });
  } catch (err) {
    console.error('Error deleting template settings:', err);
    res.status(500).json({ error: 'Error deleting template settings' });
  }
});


// GET /items-tavinox
app.get('/items-tavinox', async (req, res) => {
  // ====== Helpery (uvnitř endpointu, jak chceš) ==========================
  // Povolené sklady v AX – natvrdo (jen z těchto se počítají sumy a detaily)
  const AX_ALLOWED_LOCATIONS = ['06000000', '04000501']; // uprav dle potřeby

  // Normalizace mysql2 výsledků (array vs [rows, fields])
  const mysqlRows = (rs) => {
    if (!rs) return [];
    if (Array.isArray(rs)) {
      if (Array.isArray(rs[0])) return rs[0]; // mysql2/promise
      return rs;                              // mysql
    }
    return rs;
  };

  const norm = (v) => (v == null ? '' : String(v).trim());

  // Sestaví IN seznam @loc0, @loc1, ... pro MSSQL Request
  const bindAxLocations = (request, baseName, locations) => {
    const names = [];
    locations.forEach((loc, i) => {
      const p = `${baseName}${i}`;
      request.input(p, sql.VarChar, loc);
      names.push(`@${p}`);
    });
    return names.join(',');
  };

  try {
    // ====== 1) AX – tabulka položek + sumy fyz./rez. jen z povolených skladů ======
    await sql.connect(mssqlConfig);

    const request1 = new sql.Request();
    let query1 = `
      SELECT
          t.[ItemId],
          t.[ItemName],
          t.[ItsItemName3],
          t.[ItsItemName2],
          t.[ItsProducerCode],
          t.[ItsAssortmentCode],
          t.[ItsWebAvailable],
          t.[ItsWebAvailableB2B],
          t.[ItsWebAvailableExt],
          t.[ItsMarketingActionId],
          t.[ItsActionDateFrom],
          t.[ItsActionDateTo],
          t.[ItsActionPrice],
          t.[ItemGroupId],
          t.[UnitId],
          t.[NetWeight],
          t.[TaraWeight],
          t.[GrossWeight],
          t.[ItemType],
          t.[PurchLineDisc],
          t.[SalesPrice],
          t.[SalesPriceDate],
          t.[PrimaryVendorId],
          t.[ExternalItemId],
          t.[PurchStopped],
          t.[InventStopped],
          t.[SalesStopped],
          t.[ItsItemEAN],
          t.[RecyclingUnitAmount],
          t.[ItsItemIdFreight],
          t.[PdsFreightAllocationGroupId],
          t.[MarkupGroupId],
          t.[ItsURLPicture],
          t.[ItsURLEprel],
          t.[ItsURLQRCode],
          t.[ItsProducerCategory],
          t.[ItsCanvasCount],
          t.[DataAreaId],
          t.[Partition],
          t.[ItsJoinedItemName],
          invAgg.TotalPhysicalInvent,
          invAgg.TotalReservPhysical
      FROM [AxProdCS].[dbo].[ItsIFInventTable] t
      OUTER APPLY (
        SELECT
          CAST(SUM(CAST(s.[PhysicalInvent] AS float)) AS float) AS TotalPhysicalInvent,
          CAST(SUM(CAST(s.[ReservPhysical]  AS float)) AS float) AS TotalReservPhysical
        FROM [AxProdCS].[dbo].[ItsIFInventSum] s
        WHERE s.[ItemId] = t.[ItemId]
          AND s.[InventLocationId] IN (***LOC_INNER***)
      ) invAgg
    `;

    // pevné omezení na skupiny (ponechávám jak jsi měl; můžeš upravit/odstranit)
    const fixedClauses = ['([ItemGroupId] = @grp1 OR [ItemGroupId] = @grp2)'];
    request1.input('grp1', sql.VarChar, '08200');
    request1.input('grp2', sql.VarChar, '24500');

    // doplnění IN seznamu pro OUTER APPLY součet (jen povolené sklady)
    const locListInner = bindAxLocations(request1, 'locIn', AX_ALLOWED_LOCATIONS);
    query1 = query1.replace('***LOC_INNER***', locListInner);

    // dynamické filtry (LIKE), zachovávám kompatibilitu se stávajícím FE
    const dynamicClauses = [];
    for (const [key, value] of Object.entries(req.query)) {
      if (['includeStockByLocation', 'includeWarehouse', 'includeCartons'].includes(key)) continue;
      if (value === '""') {
        dynamicClauses.push(`([${key}] IS NULL OR [${key}] = '')`);
      } else if (String(value).includes('|')) {
        const patterns = String(value).split('|').map(v => v.replace(/\*/g, '%'));
        const orClauses = patterns.map((pattern, index) => {
          const paramName = `${key}_${index}`;
          request1.input(paramName, sql.VarChar, pattern);
          return `[${key}] LIKE @${paramName}`;
        }).join(' OR ');
        dynamicClauses.push(`(${orClauses})`);
      } else {
        const paramName = key;
        const pattern = String(value).replace(/\*/g, '%');
        request1.input(paramName, sql.VarChar, pattern);
        dynamicClauses.push(`[${key}] LIKE @${paramName}`);
      }
    }
    const allClauses = [...fixedClauses, ...dynamicClauses];
    if (allClauses.length > 0) query1 += ' WHERE ' + allClauses.join(' AND ');

    const base = await request1.query(query1);
    const items = base.recordset || [];

    // ====== 2) AX – rozpad po skladech (pouze povolené sklady), volitelně ======
    if (req.query.includeStockByLocation === '1' && items.length > 0) {
      const request2 = new sql.Request();

      // IN seznam ItemId
      const inParams = items.map((row, i) => {
        const p = `id${i}`;
        request2.input(p, sql.VarChar, row.ItemId);
        return '@' + p;
      }).join(',');

      // omez na povolené sklady (natvrdo)
      const locList = bindAxLocations(request2, 'axloc', AX_ALLOWED_LOCATIONS);

      const query2 = `
        SELECT s.[ItemId], s.[InventLocationId], s.[PhysicalInvent], s.[ReservPhysical]
        FROM [AxProdCS].[dbo].[ItsIFInventSum] s
        WHERE s.[ItemId] IN (${inParams})
          AND s.[InventLocationId] IN (${locList})
      `;

      const details = await request2.query(query2);
      const byItem = new Map();
      (details.recordset || []).forEach(r => {
        const arr = byItem.get(r.ItemId) || [];
        arr.push({
          InventLocationId: r.InventLocationId,
          PhysicalInvent: r.PhysicalInvent,
          ReservPhysical: r.ReservPhysical
        });
        byItem.set(r.ItemId, arr);
      });

      items.forEach(it => {
        it.StockByLocation = byItem.get(it.ItemId) || [];
      });
    }

    // ====== 3) MySQL – per-slot stav v JEDNOTKÁCH (Measurements.qty - Issues.qty_units), volitelně ======
    let slotUnitsByProduct = new Map();
    if (req.query.includeWarehouse === '1') {
      const rsSlot = await poolC5sluzbyint.query(`
        SELECT
          l.item_number   AS product_code,
          m.pallet_slot_id AS slot_id,
          s.slot_name      AS slot_name,
          SUM(GREATEST(COALESCE(m.qty,0) - COALESCE(i.issued_units,0), 0)) AS units_remaining
        FROM NP_Measurements m
        LEFT JOIN NP_Lines l
          ON l.id = m.line_id
        LEFT JOIN (
          SELECT measurement_id, SUM(qty_units) AS issued_units
          FROM WH_IssueItems
          WHERE operation_type IN ('pick','overpick')
          GROUP BY measurement_id
        ) i ON i.measurement_id = m.id
        LEFT JOIN WH_pallet_slots s
          ON s.id = m.pallet_slot_id
        WHERE m.pallet_slot_id IS NOT NULL
          AND l.item_number IS NOT NULL AND l.item_number <> ''
        GROUP BY l.item_number, m.pallet_slot_id, s.slot_name
        HAVING units_remaining > 0
        ORDER BY l.item_number, m.pallet_slot_id
      `);

      const rows = mysqlRows(rsSlot);
      slotUnitsByProduct = new Map();
      rows.forEach(r => {
        const pid = norm(r.product_code);
        if (!pid) return;
        const arr = slotUnitsByProduct.get(pid) || [];
        arr.push({
          slot_id: r.slot_id,
          slot_name: r.slot_name || null,
          units: Number(r.units_remaining || 0)
        });
        slotUnitsByProduct.set(pid, arr);
      });
    }

    // ====== 4) MySQL – rozpad na jednotlivé krabice (per Measurement), volitelně ======
    let cartonsByProduct = new Map();
    if (req.query.includeCartons === '1') {
      const rsC = await poolC5sluzbyint.query(`
        SELECT
          m.id              AS measurement_id,
          l.item_number     AS product_code,
          m.pallet_slot_id  AS slot_id,
          s.slot_name       AS slot_name,
          COALESCE(m.qty,0)         AS qty_units_in,
          COALESCE(i.issued_units,0) AS issued_units,
          GREATEST(COALESCE(m.qty,0) - COALESCE(i.issued_units,0), 0) AS units_remaining
        FROM NP_Measurements m
        LEFT JOIN NP_Lines l
          ON l.id = m.line_id
        LEFT JOIN WH_pallet_slots s
          ON s.id = m.pallet_slot_id
        LEFT JOIN (
          SELECT measurement_id, SUM(qty_units) AS issued_units
          FROM WH_IssueItems
          WHERE operation_type IN ('pick','overpick')
          GROUP BY measurement_id
        ) i ON i.measurement_id = m.id
        WHERE m.pallet_slot_id IS NOT NULL
          AND l.item_number IS NOT NULL AND l.item_number <> ''
        HAVING units_remaining > 0
        ORDER BY l.item_number, m.id
      `);

      const rows = mysqlRows(rsC);
      cartonsByProduct = new Map();
      rows.forEach(r => {
        const pid = norm(r.product_code);
        if (!pid) return;
        const arr = cartonsByProduct.get(pid) || [];
        arr.push({
          measurement_id : r.measurement_id,
          slot_id        : r.slot_id,
          slot_name      : r.slot_name || null,
          qty_units_in   : Number(r.qty_units_in || 0),
          issued_units   : Number(r.issued_units || 0),
          units_remaining: Number(r.units_remaining || 0)
        });
        cartonsByProduct.set(pid, arr);
      });
    }

    // ====== 5) Napojit sloty/krabice k AX položkám (klíč = ItsItemName2) ======
    items.forEach(it => {
      const codeKey = norm(it.ItsItemName2); // očekáváme shodu s NP_Lines.item_number
      if (req.query.includeWarehouse === '1') {
        it.WarehouseSlots = codeKey ? (slotUnitsByProduct.get(codeKey) || []) : [];
      }
      if (req.query.includeCartons === '1') {
        it.WarehouseCartons = codeKey ? (cartonsByProduct.get(codeKey) || []) : [];
      }
    });

    // hotovo
    res.json(items);

  } catch (err) {
    console.error('Database query failed:', err);
    res.status(500).json({ error: 'Internal Server Error', detail: err.message });
  }
});



// Aktualizace budovy
app.put('/api/warehouse/:buildingId', (req, res) => {
  const { buildingId } = req.params;
  const { buildingName } = req.body;

  if (!buildingName) {
    return res.status(400).json({ error: 'Název budovy je povinný' });
  }

  const updateQuery = `UPDATE WH_buildings SET name = ?, updated_at = NOW() WHERE id = ?`;

  poolC5sluzbyint.query(updateQuery, [buildingName, buildingId], (err, results) => {
    if (err) {
      console.error('Chyba při aktualizaci budovy:', err);
      return res.status(500).json({ error: 'Chyba při aktualizaci budovy' });
    }
    res.json({ success: true, buildingId });
  });
});

// Mazání budovy
app.delete('/api/warehouse/:buildingId', (req, res) => {
  const { buildingId } = req.params;

  const deleteQuery = `DELETE FROM WH_buildings WHERE id = ?`;

  poolC5sluzbyint.query(deleteQuery, [buildingId], (err, results) => {
    if (err) {
      console.error('Chyba při mazání budovy:', err);
      return res.status(500).json({ error: 'Chyba při mazání budovy' });
    }
    res.json({ success: true, buildingId });
  });
});

// Mazání regálu
app.delete('/api/shelf/:shelfId', (req, res) => {
  const { shelfId } = req.params;

  const deleteQuery = `DELETE FROM WH_shelves WHERE id = ?`;

  poolC5sluzbyint.query(deleteQuery, [shelfId], (err, results) => {
    if (err) {
      console.error('Chyba při mazání regálu:', err);
      return res.status(500).json({ error: 'Chyba při mazání regálu' });
    }
    res.json({ success: true, shelfId });
  });
});

// Aktualizace regálu
app.put('/api/shelf/:shelfId', (req, res) => {
  const { shelfId } = req.params;
  const { shelfName } = req.body;

  if (!shelfName) {
    return res.status(400).json({ error: 'Název regálu je povinný' });
  }

  const updateQuery = `UPDATE WH_shelves SET name = ?, updated_at = NOW() WHERE id = ?`;

  poolC5sluzbyint.query(updateQuery, [shelfName, shelfId], (err, results) => {
    if (err) {
      console.error('Chyba při aktualizaci regálu:', err);
      return res.status(500).json({ error: 'Chyba při aktualizaci regálu' });
    }
    res.json({ success: true, shelfId });
  });
});

// Přidání nového regálu
app.post('/api/shelf', (req, res) => {
  const { warehouseId, shelfName } = req.body;

  if (!warehouseId || !shelfName) {
    return res.status(400).json({ error: 'ID skladu (budovy) a název regálu jsou povinné' });
  }

  // Vložíme hodnotu do sloupce "building_id"
  const insertQuery = `INSERT INTO WH_shelves (building_id, name, created_at) VALUES (?, ?, NOW())`;

  poolC5sluzbyint.query(insertQuery, [warehouseId, shelfName], (err, results) => {
    if (err) {
      console.error('Chyba při přidávání regálu:', err);
      return res.status(500).json({ error: 'Chyba při přidávání regálu' });
    }
    res.json({ success: true, shelfId: results.insertId, warehouseId, shelfName });
  });
});


// Endpoint pro uložení kompletní konfigurace regálu včetně paletových míst
app.put('/api/shelf/details/:shelfId', (req, res) => {
  const shelfId = req.params.shelfId;
  const { buildingId, shelfName, floors, sections } = req.body;

  console.log('--- Ukládání detailů regálu ---');
  console.log('Přijatá data:', { shelfId, buildingId, shelfName, floors, sections });

  if (!buildingId || !shelfName || !Array.isArray(floors) || !Array.isArray(sections)) {
    console.error('Chybějící povinná data');
    return res.status(400).json({ error: 'Nedostatečná data – buildingId, shelfName, floors i sections jsou povinné' });
  }

  poolC5sluzbyint.getConnection((connErr, connection) => {
    if (connErr) {
      console.error('Chyba při získání připojení:', connErr);
      return res.status(500).json({ error: 'Interní chyba serveru při získání připojení' });
    }

    connection.beginTransaction((transErr) => {
      if (transErr) {
        connection.release();
        console.error('Chyba při zahájení transakce:', transErr);
        return res.status(500).json({ error: 'Interní chyba serveru při zahájení transakce' });
      }

      // 1. Aktualizace regálu (WH_shelves)
      const updateShelfQuery = `
        UPDATE WH_shelves
        SET name = ?, updated_at = NOW()
        WHERE id = ? AND building_id = ?
      `;
      console.log('SQL - Aktualizace regálu:', updateShelfQuery, [shelfName, shelfId, buildingId]);
      connection.query(updateShelfQuery, [shelfName, shelfId, buildingId], (err, shelfResult) => {
        if (err) {
          console.error('Chyba při aktualizaci regálu:', err);
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ error: 'Chyba při aktualizaci regálu' });
          });
        }
        console.log('Regál aktualizován, výsledky:', shelfResult);

        // 2. Upsert pater (WH_floors)
        const floorTasks = floors.map((floor, index) => {
          return new Promise((resolve, reject) => {
            const floorNumber = (floor.floorNumber !== null && floor.floorNumber !== undefined)
              ? floor.floorNumber
              : index + 1;
            const floorQuery = `
              INSERT INTO WH_floors (shelf_id, floor_number, height, created_at)
              VALUES (?, ?, ?, NOW())
              ON DUPLICATE KEY UPDATE height = VALUES(height), updated_at = NOW()
            `;
            console.log('SQL - Vložení/upsert patra:', floorQuery, [shelfId, floorNumber, floor.height]);
            connection.query(floorQuery, [shelfId, floorNumber, floor.height], (err, result) => {
              if (err) return reject(err);
              console.log(`Patro číslo ${floorNumber} zpracováno, výsledky:`, result);
              resolve(result);
            });
          });
        });

        Promise.all(floorTasks)
          .then(() => {
            // 3. Upsert sekcí (WH_sections)
            const sectionTasks = sections.map(section => {
              return new Promise((resolve, reject) => {
                const palletSlotsCount = section.numberOfPalletSlots === 0 ? 1 : section.numberOfPalletSlots;
                const sectionQuery = `
                  INSERT INTO WH_sections (id, shelf_id, name, width, numberOfPalletSlots, created_at)
                  VALUES (?, ?, ?, ?, ?, NOW())
                  ON DUPLICATE KEY UPDATE 
                    name = VALUES(name),
                    width = VALUES(width),
                    numberOfPalletSlots = VALUES(numberOfPalletSlots),
                    updated_at = NOW()
                `;
                // Pokud section.id není předáno, necháme DB auto-generovat (null)
                const sectionId = section.id || null;
                console.log('SQL - Insert/Update sekce:', sectionQuery, [sectionId, shelfId, section.name, section.width, palletSlotsCount]);
                connection.query(sectionQuery, [sectionId, shelfId, section.name, section.width, palletSlotsCount], (err, result) => {
                  if (err) {
                    console.error(`Chyba při insert/update sekce s id ${section.id}:`, err);
                    return reject(err);
                  }
                  // Uložení vygenerovaného ID, pokud nebylo předáno
                  section.id = section.id || result.insertId;
                  console.log(`Sekce s id ${section.id} vložena/updatována, výsledky:`, result);
                  resolve(result);
                });
              });
            });

            Promise.all(sectionTasks)
              .then(() => {
                // 4. Upsert paletových míst (WH_pallet_slots)
                // Pro každou sekci zpracujeme její pole palletSlots (pokud existuje)
                const palletSlotTasks = [];
                sections.forEach(section => {
                  if (section.palletSlots && Array.isArray(section.palletSlots)) {
                    section.palletSlots.forEach(slot => {
                      palletSlotTasks.push(new Promise((resolve, reject) => {
                        const slotId = slot.id || null;
                        const palletSlotQuery = `
                          INSERT INTO WH_pallet_slots (id, section_id, floor_number, position, product_id, status, created_at)
                          VALUES (?, ?, ?, ?, ?, ?, NOW())
                          ON DUPLICATE KEY UPDATE 
                            product_id = VALUES(product_id),
                            status = VALUES(status),
                            updated_at = NOW()
                        `;
                        console.log('SQL - Insert/Update paletového místa:', palletSlotQuery, [slotId, section.id, slot.floor_number, slot.position, slot.product_id, slot.status]);
                        connection.query(palletSlotQuery, [slotId, section.id, slot.floor_number, slot.position, slot.product_id, slot.status], (err, result) => {
                          if (err) {
                            console.error(`Chyba při insert/update paletového místa ve sekci ${section.id}:`, err);
                            return reject(err);
                          }
                          slot.id = slot.id || result.insertId;
                          console.log(`Paletové místo ve sekci ${section.id} (floor: ${slot.floor_number}, position: ${slot.position}) zpracováno, výsledky:`, result);
                          resolve(result);
                        });
                      }));
                    });
                  }
                });

                Promise.all(palletSlotTasks)
                  .then(() => {
                    // 5. Commit transakce
                    connection.commit((commitErr) => {
                      if (commitErr) {
                        console.error('Chyba při commitu transakce:', commitErr);
                        return connection.rollback(() => {
                          connection.release();
                          res.status(500).json({ error: 'Chyba při commitu transakce' });
                        });
                      }
                      console.log('Transakce úspěšně commitována.');
                      connection.release();
                      res.json({ success: true });
                    });
                  })
                  .catch(palletSlotErr => {
                    console.error('Chyba při zpracování paletových míst:', palletSlotErr);
                    connection.rollback(() => {
                      connection.release();
                      res.status(500).json({ error: 'Chyba při aktualizaci paletových míst', details: palletSlotErr });
                    });
                  });
              })
              .catch(sectionErr => {
                console.error('Chyba při zpracování sekcí:', sectionErr);
                connection.rollback(() => {
                  connection.release();
                  res.status(500).json({ error: 'Chyba při aktualizaci sekcí', details: sectionErr });
                });
              });
          })
          .catch(floorErr => {
            console.error('Chyba při zpracování pater:', floorErr);
            connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: 'Chyba při aktualizaci pater', details: floorErr });
            });
          });
      });
    });
  });
});


// nové paletové místo
app.post('/api/pallet_slot', (req, res) => {
  const { sectionId, floorNumber, position, productId, status } = req.body;
  if (!sectionId || !floorNumber || !position) {
    return res.status(400).json({ error: 'Chybí povinné parametry: sectionId, floorNumber, position' });
  }
  poolC5sluzbyint.getConnection((connErr, connection) => {
    if (connErr) {
      console.error('Chyba při získání připojení:', connErr);
      return res.status(500).json({ error: 'Interní chyba serveru při získání připojení' });
    }
    const query = `
      INSERT INTO WH_pallet_slots (section_id, floor_number, position, product_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    connection.query(query, [sectionId, floorNumber, position, productId || null, status || 'volno'], (err, result) => {
      connection.release();
      if (err) {
        console.error('Chyba při vkládání paletového místa:', err);
        return res.status(500).json({ error: 'Chyba při vkládání paletového místa' });
      }
      res.json({ success: true, slotId: result.insertId });
    });
  });
});


// aktualizace paletového místa
app.put('/api/pallet_slot/:slotId', (req, res) => {
  const slotId = req.params.slotId;
  const { productId, status, floorNumber, position } = req.body;
  if (!slotId) {
    return res.status(400).json({ error: 'Chybí slotId' });
  }
  poolC5sluzbyint.getConnection((connErr, connection) => {
    if (connErr) {
      console.error('Chyba při získání připojení:', connErr);
      return res.status(500).json({ error: 'Interní chyba serveru při získání připojení' });
    }
    const query = `
      UPDATE WH_pallet_slots
      SET product_id = ?, status = ?, floor_number = ?, position = ?, updated_at = NOW()
      WHERE id = ?
    `;
    connection.query(query, [productId || null, status || 'volno', floorNumber, position, slotId], (err, result) => {
      connection.release();
      if (err) {
        console.error('Chyba při aktualizaci paletového místa:', err);
        return res.status(500).json({ error: 'Chyba při aktualizaci paletového místa' });
      }
      res.json({ success: true });
    });
  });
});

// odstranění paletového místa
app.delete('/api/pallet_slot/:slotId', (req, res) => {
  const slotId = req.params.slotId;
  if (!slotId) {
    return res.status(400).json({ error: 'Chybí slotId' });
  }
  // Získáme spojení z poolu
  poolC5sluzbyint.getConnection((connErr, connection) => {
    if (connErr) {
      console.error('Chyba při získání připojení:', connErr);
      return res.status(500).json({ error: 'Interní chyba serveru při získání připojení' });
    }
    const query = `DELETE FROM WH_pallet_slots WHERE id = ?`;
    connection.query(query, [slotId], (err, result) => {
      connection.release();
      if (err) {
        console.error('Chyba při mazání paletového místa:', err);
        return res.status(500).json({ error: 'Chyba při mazání paletového místa' });
      }
      res.json({ success: true });
    });
  });
});


// Endpoint pro vytvoření nového regálu s kompletní konfigurací
app.post('/api/shelf', (req, res) => {
  const { buildingId, shelfName, floors, sections } = req.body;
  if (!buildingId || !shelfName || !Array.isArray(floors) || !Array.isArray(sections)) {
    return res.status(400).json({ error: 'Nedostatečná data – buildingId, shelfName, floors i sections jsou povinné' });
  }

  poolC5sluzbyint.getConnection((connErr, connection) => {
    if (connErr) {
      console.error('Chyba při získání připojení:', connErr);
      return res.status(500).json({ error: 'Interní chyba serveru při získání připojení' });
    }

    connection.beginTransaction((transErr) => {
      if (transErr) {
        connection.release();
        console.error('Chyba při zahájení transakce:', transErr);
        return res.status(500).json({ error: 'Interní chyba serveru při zahájení transakce' });
      }

      // 1. Vložení regálu do WH_shelves
      const insertShelfQuery = `
        INSERT INTO WH_shelves (building_id, name, created_at)
        VALUES (?, ?, NOW())
      `;
      connection.query(insertShelfQuery, [buildingId, shelfName], (err, shelfResult) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            console.error('Chyba při vložení regálu:', err);
            res.status(500).json({ error: 'Chyba při vložení regálu' });
          });
        }
        const newShelfId = shelfResult.insertId;
        console.log('Regál vložen, ID:', newShelfId);

        // 2. Vložení pater do WH_floors
        const floorTasks = floors.map((floor, index) => {
          return new Promise((resolve, reject) => {
            // Pokud floor.floorNumber není nastaven, použijeme index+1
            const floorNumber = (floor.floorNumber !== null && floor.floorNumber !== undefined)
              ? floor.floorNumber
              : index + 1;
            const floorQuery = `
              INSERT INTO WH_floors (shelf_id, floor_number, height, created_at)
              VALUES (?, ?, ?, NOW())
              ON DUPLICATE KEY UPDATE height = VALUES(height), updated_at = NOW()
            `;
            connection.query(floorQuery, [newShelfId, floorNumber, floor.height], (err, result) => {
              if (err) return reject(err);
              console.log(`Patro číslo ${floorNumber} vloženo/updatováno, výsledky:`, result);
              resolve(result);
            });
          });
        });

        Promise.all(floorTasks)
          .then(() => {
            // 3. Vložení sekcí do WH_sections
            const sectionTasks = sections.map(section => {
              return new Promise((resolve, reject) => {
                // Pokud je numberOfPalletSlots 0, uložíme 1
                const palletSlotsCount = section.numberOfPalletSlots === 0 ? 1 : section.numberOfPalletSlots;
                const sectionQuery = `
                  INSERT INTO WH_sections (shelf_id, name, width, numberOfPalletSlots, created_at)
                  VALUES (?, ?, ?, ?, NOW())
                  ON DUPLICATE KEY UPDATE 
                    name = VALUES(name),
                    width = VALUES(width),
                    numberOfPalletSlots = VALUES(numberOfPalletSlots),
                    updated_at = NOW()
                `;
                connection.query(sectionQuery, [newShelfId, section.name, section.width, palletSlotsCount], (err, result) => {
                  if (err) return reject(err);
                  console.log(`Sekce vložena/updatována, výsledky:`, result);
                  resolve(result);
                });
              });
            });

            Promise.all(sectionTasks)
              .then(() => {
                connection.commit((commitErr) => {
                  if (commitErr) {
                    return connection.rollback(() => {
                      connection.release();
                      console.error('Chyba při commitu transakce:', commitErr);
                      res.status(500).json({ error: 'Chyba při commitu transakce' });
                    });
                  }
                  connection.release();
                  res.json({ success: true, shelfId: newShelfId });
                });
              })
              .catch(sectionErr => {
                connection.rollback(() => {
                  connection.release();
                  console.error('Chyba při zpracování sekcí:', sectionErr);
                  res.status(500).json({ error: 'Chyba při zpracování sekcí', details: sectionErr });
                });
              });
          })
          .catch(floorErr => {
            connection.rollback(() => {
              connection.release();
              console.error('Chyba při zpracování pater:', floorErr);
              res.status(500).json({ error: 'Chyba při zpracování pater', details: floorErr });
            });
          });
      });
    });
  });
});

// Přidat regál
app.post('/api/warehouse', (req, res) => {
  const { buildingName, shelfCount } = req.body;

  // 1. Ověříme, že máme hodnoty
  if (!buildingName || !shelfCount) {
    return res
      .status(400)
      .json({ error: 'Název budovy a počet regálů jsou povinné' });
  }

  // 2. Kontrola počtu regálů
  const count = parseInt(shelfCount, 10);
  if (isNaN(count) || count <= 0) {
    return res
      .status(400)
      .json({ error: 'Počet regálů musí být číslo větší než 0' });
  }

  // 3. Získáme připojení z poolu
  poolC5sluzbyint.getConnection((err, connection) => {
    if (err) {
      console.error('Chyba při získání spojení s databází:', err);
      return res.status(500).json({ error: 'Database connection error' });
    }

    // 4. Začneme transakci
    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        console.error('Chyba při zahájení transakce:', err);
        return res.status(500).json({ error: 'Database transaction error' });
      }

      // 5. Nejprve vložíme záznam do WH_buildings
      const insertBuildingQuery = `
        INSERT INTO WH_buildings (name, created_at) 
        VALUES (?, NOW())
      `;
      connection.query(insertBuildingQuery, [buildingName], (err, result) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            console.error('Chyba při ukládání budovy:', err);
            res.status(500).json({ error: 'Chyba při ukládání budovy' });
          });
        }

        // Získáme ID vložené budovy
        const buildingId = result.insertId;

        // 6. Vložíme regály v cyklu
        const insertShelfQuery = `
          INSERT INTO WH_shelves (building_id, name, created_at)
          VALUES (?, ?, NOW())
        `;

        let i = 1;
        function insertOneShelf() {
          // pokud už jsme všechny regály uložili, commitujeme
          if (i > count) {
            return connection.commit((err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error('Chyba při potvrzení transakce:', err);
                  res
                    .status(500)
                    .json({ error: 'Chyba při potvrzení transakce' });
                });
              }

              // Vše OK
              connection.release();
              res.json({ success: true, buildingId });
            });
          }

          // Vložíme jeden regál
          connection.query(
            insertShelfQuery,
            [buildingId, `Regál ${i}`],
            (err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error('Chyba při ukládání regálu:', err);
                  res.status(500).json({ error: 'Chyba při ukládání regálu' });
                });
              }

              i++;
              insertOneShelf(); // rekurzivně vložíme další
            }
          );
        }

        // Spustíme vkládání regálů
        insertOneShelf();
      });
    });
  });
});




// Endpoint pro získání objednávek z MSSQL
app.get('/wms/orders_list', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    let queryStr = `
      SELECT 
        SalesId AS Order_Number,
        ShippingDateRequested AS Date,
        Payment,
        DlvMode AS Delivery,
        SalesStatusText AS Status,
        RegNum,
        CustName,
        DeliveryName,
        DeliveryPhone,
        DeliveryEmail
      FROM 
        dbo.ItsIFSalesTable
    `;

    let conditions = [];
    let params = [];

    if (dateFrom) {
      conditions.push('ShippingDateRequested >= @dateFrom');
      params.push({ name: 'dateFrom', type: sql.Date, value: dateFrom });
    }
    if (dateTo) {
      conditions.push('ShippingDateRequested <= @dateTo');
      params.push({ name: 'dateTo', type: sql.Date, value: dateTo });
    }

    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await queryMSSQL(queryStr, params);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching data from MSSQL (pool):', err);
    res.status(500).send(`Error fetching data from MSSQL database: ${err.message}`);
  }
});

app.get('/wms/orders_list_tavinox', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    /* 1) Základ dotazu – už obsahuje WHERE */
    let queryStr = `
      SELECT DISTINCT
        st.SalesId               AS Order_Number,
        st.ShippingDateRequested AS [Date],
        st.Payment,
        st.DlvMode               AS Delivery,
        st.SalesStatusText       AS Status,
        st.RegNum,
        st.CustName,
        st.DeliveryName,
        st.DeliveryPhone,
        st.DeliveryEmail
      FROM dbo.ItsIFSalesTable  AS st
      JOIN dbo.ItsIFSalesLine   AS sl  ON sl.SalesId = st.SalesId
      JOIN dbo.ItsIFInventSum   AS inv ON inv.ItemId = sl.ItemId
                                      AND inv.InventLocationId = '04000501'
      WHERE sl.InventLocationId       = '04000501'
        AND st.ShippingDateRequested >= '2024-01-01'
    `;                                           /* ⬅️ bez středníku! */

    /* 2) Volitelné filtry z query stringu */
    const params = [];
    if (dateFrom) {
      queryStr += ' AND st.ShippingDateRequested >= @dateFrom';
      params.push({ name: 'dateFrom', type: sql.DateTime2, value: dateFrom });
    }
    if (dateTo) {
      queryStr += ' AND st.ShippingDateRequested <= @dateTo';
      params.push({ name: 'dateTo', type: sql.DateTime2, value: dateTo });
    }

    /* 3) Dotaz s parametry */
    const result = await queryMSSQL(queryStr, params);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching data from MSSQL:', err);
    res.status(500).send(`Error fetching data from MSSQL database: ${err.message}`);
  }
});

// Endpoint pro aktualizaci hodnoty picking 1/0 v databázy
app.post('/wms/update_picking', async (req, res) => {
  const { Order_Number, Picking } = req.body;

  try {
    // SQL dotaz pro aktualizaci hodnoty 'Picking' v tabulce 'Orders_List'
    const sql = `UPDATE Orders_List SET Picking = ? WHERE Order_Number = ?`;
    await db.query(sql, [Picking, Order_Number]);

    // Odeslání odpovědi klientovi
    res.json({ message: 'Picking status updated successfully' });
  } catch (error) {
    console.error('Error updating picking status:', error);
    res.status(500).send(`Error updating picking status: ${error.message}`);
  }
});



app.get('/wms/sync_orders_list', async (req, res) => {
  const dateFrom = '2025-01-01';

  // 1) MSSQL: vybíráme jen skutečně existující sloupce
  const mssqlQuery = `
    SELECT
      SalesId                   AS DocumentID,
      SalesId                   AS Order_Number,
      PurchOrderFormNum,
      DlvMode,
      Payment,
      VATNum,
      DeliveryName,
      DeliveryPhone,
      DeliveryEmail,
      ShippingDateRequested,
      ReceiptDateRequested,
      ItsVehicleNotes,
      ItsTradeCode,
      ItsTransportCode,
      SalesStatusText,
      RegNum,
      CustName,
      DeliveryStreet,
      DeliveryCity,
      DeliveryZipCode,
      DeliveryCountryRegionId,
      SalesInvoiceList,
      LPARecId,
      CustPhone,
      CustEmail,
      LineDisc,
      SalesGroup,
      SalesGroupName,
      DataAreaId,
      Partition,
      CustStreet,
      CustCity,
      CustZipCode,
      CustCountryRegionId
    FROM dbo.ItsIFSalesTable
    WHERE ShippingDateRequested >= @dateFrom
  `;

  try {
    const { recordset } = await queryMSSQL(mssqlQuery, [
      { name: 'dateFrom', type: sql.Date, value: dateFrom }
    ]);

    if (recordset.length === 0) {
      return res.json({ message: `Žádné objednávky od ${dateFrom}` });
    }

    // 2) MySQL UPSERT
    const upsertSql = `
      INSERT INTO Orders_List (
        DocumentID, Order_Number, PurchOrderFormNum, DlvMode, Payment, VATNum,
        DeliveryName, DeliveryPhone, DeliveryEmail,
        ShippingDateRequested, ReceiptDateRequested,
        ItsVehicleNotes, ItsTradeCode, ItsTransportCode,
        SalesStatusText, RegNum, CustName,
        DeliveryStreet, DeliveryCity, DeliveryZipCode, DeliveryCountryRegionId,
        SalesInvoiceList, LPARecId,
        CustPhone, CustEmail,
        LineDisc, SalesGroup, SalesGroupName,
        DataAreaId, \`Partition\`,
        CustStreet, CustCity, CustZipCode, CustCountryRegionId,
        synced_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        PurchOrderFormNum       = VALUES(PurchOrderFormNum),
        DlvMode                 = VALUES(DlvMode),
        Payment                 = VALUES(Payment),
        VATNum                  = VALUES(VATNum),
        DeliveryName            = VALUES(DeliveryName),
        DeliveryPhone           = VALUES(DeliveryPhone),
        DeliveryEmail           = VALUES(DeliveryEmail),
        ShippingDateRequested   = VALUES(ShippingDateRequested),
        ReceiptDateRequested    = VALUES(ReceiptDateRequested),
        ItsVehicleNotes         = VALUES(ItsVehicleNotes),
        ItsTradeCode            = VALUES(ItsTradeCode),
        ItsTransportCode        = VALUES(ItsTransportCode),
        SalesStatusText         = VALUES(SalesStatusText),
        RegNum                  = VALUES(RegNum),
        CustName                = VALUES(CustName),
        DeliveryStreet          = VALUES(DeliveryStreet),
        DeliveryCity            = VALUES(DeliveryCity),
        DeliveryZipCode         = VALUES(DeliveryZipCode),
        DeliveryCountryRegionId = VALUES(DeliveryCountryRegionId),
        SalesInvoiceList        = VALUES(SalesInvoiceList),
        LPARecId                = VALUES(LPARecId),
        CustPhone               = VALUES(CustPhone),
        CustEmail               = VALUES(CustEmail),
        LineDisc                = VALUES(LineDisc),
        SalesGroup              = VALUES(SalesGroup),
        SalesGroupName          = VALUES(SalesGroupName),
        DataAreaId              = VALUES(DataAreaId),
        \`Partition\`            = VALUES(\`Partition\`),
        CustStreet              = VALUES(CustStreet),
        CustCity                = VALUES(CustCity),
        CustZipCode             = VALUES(CustZipCode),
        CustCountryRegionId     = VALUES(CustCountryRegionId),
        synced_at               = VALUES(synced_at)
    `;

    let synced = 0;
    const errors = [];

    for (const o of recordset) {
      const params = [
        o.DocumentID,
        o.Order_Number,
        o.PurchOrderFormNum,
        o.DlvMode,
        o.Payment,
        o.VATNum,
        o.DeliveryName,
        o.DeliveryPhone,
        o.DeliveryEmail,
        o.ShippingDateRequested,
        o.ReceiptDateRequested,
        o.ItsVehicleNotes,
        o.ItsTradeCode,
        o.ItsTransportCode,
        o.SalesStatusText,
        o.RegNum,
        o.CustName,
        o.DeliveryStreet,
        o.DeliveryCity,
        o.DeliveryZipCode,
        o.DeliveryCountryRegionId,
        o.SalesInvoiceList,
        o.LPARecId,
        o.CustPhone,
        o.CustEmail,
        o.LineDisc,
        o.SalesGroup,
        o.SalesGroupName,
        o.DataAreaId,
        o.Partition,
        o.CustStreet,
        o.CustCity,
        o.CustZipCode,
        o.CustCountryRegionId,
        new Date()
      ];
      try {
        await queryC5sluzbyint(upsertSql, params);
        synced++;
      } catch (e) {
        errors.push({ DocumentID: o.DocumentID, error: e.message });
      }
    }

    res.json({
      message: `Synchronizováno ${synced} záznamů.`,
      errors: errors.length ? errors : undefined
    });

  } catch (err) {
    console.error('Chyba synchronizace:', err);
    res.status(500).send(`Chyba synchronizace: ${err.message}`);
  }
});



// GET /wms/order/:orderNumber – MSSQL → MySQL + EANy + sloty (+ uloží ItsItemName2 do Orders_raw)
app.get('/wms/order/:orderNumber', async (req, res) => {
  const orderNumber = req.params.orderNumber;

  // helpery
  const run = async (pool, sql, params = []) => {
    const r = await pool.query(sql, params);
    return Array.isArray(r) && Array.isArray(r[0]) ? r[0] : r;
  };
  const norm  = v => String(v ?? '').trim();
  const asArr = v => Array.isArray(v) ? v : (v == null ? [] : [v]);

  try {
    // 1) MSSQL řádky objednávky
    const mssqlQuery = `
      SELECT
        sl.SalesId,
        sl.ItemId,
        sl.ItemName,
        iv.ItsItemName2,
        sl.SalesQty,
        sl.SalesUnit,
        sl.BarCode,
        sl.InventLocationId,
        sl.WMSLocationId,
        sl.NetWeight,
        sl.UnitVolume,
        sl.DeliveredQty
      FROM dbo.ItsIFSalesLine   AS sl
      LEFT JOIN dbo.ItsIFInventTable AS iv
        ON iv.ItemId = sl.ItemId
      WHERE sl.SalesId = @orderNumber
    `;
    const { recordset: orderLines } = await queryMSSQL(mssqlQuery, [
      { name: 'orderNumber', type: sql.NVarChar, value: orderNumber }
    ]);
    if (!orderLines.length) {
      return res.status(404).json({ success: false, error: 'Objednávka nenalezena.' });
    }

    // 2) Klíče (ItsItemName2 = primární „kód“)
    const codes = Array.from(new Set(orderLines.map(l => norm(l.ItsItemName2)).filter(Boolean)));

    const eanMap  = new Map();
    const slotMap = new Map();

    // 2a) EANy z TAVINOX_KOMPLET (Kod = ItsItemName2)
    if (codes.length) {
      const ph = codes.map(() => '?').join(',');
      const eanSql = `
        SELECT
          \`Kod\`,
          \`EAN\`          AS EAN_Base,
          \`EAN sacek\`    AS EAN_Pouch,
          \`EAN Krabice\`  AS EAN_Box,
          \`Sacek ks\`     AS QTY_Pouch,
          \`Krabice ks\`   AS QTY_Box
        FROM TAVINOX_KOMPLET
        WHERE TradeItemUnitDescriptorCode = 'BASE_UNIT_OR_EACH'
          AND \`Kod\` IN (${ph})
      `;
      const eanRows = await run(poolC5tavinox, eanSql, codes);
      eanRows.forEach(r => {
        eanMap.set(norm(r.Kod), {
          EAN_Base:  r.EAN_Base?.toString() ?? null,
          EAN_Pouch: r.EAN_Pouch?.toString() ?? null,
          EAN_Box:   r.EAN_Box?.toString() ?? null,
          QTY_Pouch: r.QTY_Pouch ?? null,
          QTY_Box:   r.QTY_Box ?? null
        });
      });

      // 2b) sloty z WH_pallet_slots (product_id = ItsItemName2)
      const slotSql = `
        SELECT
          TRIM(CAST(product_id AS CHAR)) AS product_id,
          slot_name,
          status,
          floor_number
        FROM WH_pallet_slots
        WHERE TRIM(CAST(product_id AS CHAR)) IN (${ph})
      `;
      const slotRows = await run(poolC5sluzbyint, slotSql, codes);
      slotRows.forEach(r => {
        const key = norm(r.product_id);
        if (!slotMap.has(key)) slotMap.set(key, []);
        slotMap.get(key).push({
          slot_name:   r.slot_name,
          status:      r.status,
          floorNumber: r.floor_number
        });
      });
    }

    // 3) Pick count z Orders_raw (klíč = Product_Id)
    const pickSql = `
      SELECT Product_Id, Product_Picked, Product_Picked_Check
      FROM Orders_raw
      WHERE Order_Number = ?
    `;
    const pickRows = await run(poolC5sluzbyint, pickSql, [orderNumber]);
    const pickMap = new Map(
      pickRows.map(r => [
        norm(r.Product_Id),
        {
          picked: Number(r.Product_Picked) || 0,
          check:  Number(r.Product_Picked_Check) || 0
        }
      ])
    );

    // 4) Obohacení pro FE
    const enriched = orderLines.map(line => {
      const code      = norm(line.ItsItemName2); // ItsItemName2
      const itemIdKey = norm(line.ItemId);       // AX ItemId

      const eanInfo = eanMap.get(code) || {};
      const baseEAN = eanInfo.EAN_Base || line.BarCode?.toString() || null;

      const slots = slotMap.get(code) || [];
      const slot_names = Array.from(new Set(slots.map(s => s.slot_name))).filter(Boolean);
      const slot_names_joined = asArr(slot_names).join(', ');

      const ItemName_str      = norm(line.ItemName);
      const Product_Ean_str   = norm(baseEAN);
      const WMSLocationId_str = norm(line.WMSLocationId);

      return {
        ...line,
        Product_Id: itemIdKey,
        Position:   itemIdKey, // (ponecháno dle tvé logiky)
        EAN_Base:   baseEAN,
        EAN_Pouch:  eanInfo.EAN_Pouch || null,
        EAN_Box:    eanInfo.EAN_Box   || null,
        QTY_Pouch:  eanInfo.QTY_Pouch || null,
        QTY_Box:    eanInfo.QTY_Box   || null,

        Product_Picked:       (pickMap.get(itemIdKey) || {}).picked || 0,
        Product_Picked_Check: (pickMap.get(itemIdKey) || {}).check  || 0,

        // sloty
        slot_names,
        slots,
        slot_names_joined,

        // safe-stringy
        ItemName_str,
        Product_Ean_str,
        WMSLocationId_str
      };
    });

    // 5) UPSERT do Orders_raw – NOVĚ ukládáme i ItsItemName2
    const upsertSql = `
      INSERT INTO Orders_raw
        (Order_Number, Position, Shop_Id, Product_Id, ItsItemName2,
         Product_Name, Product_Ean, Product_Quantity,
         EAN_Pouch, EAN_Box, QTY_Box, QTY_Pouch)
      VALUES
        (?, ?, ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        ItsItemName2     = VALUES(ItsItemName2),
        Product_Name     = VALUES(Product_Name),
        Product_Ean      = VALUES(Product_Ean),
        Product_Quantity = VALUES(Product_Quantity),
        EAN_Pouch        = VALUES(EAN_Pouch),
        EAN_Box          = VALUES(EAN_Box),
        QTY_Box          = VALUES(QTY_Box),
        QTY_Pouch        = VALUES(QTY_Pouch)
    `;
    for (const item of enriched) {
      await poolC5sluzbyint.query(upsertSql, [
        orderNumber,
        item.Position,
        item.InventLocationId || '1',
        item.Product_Id,
        item.ItsItemName2 || item.Product_Id, // ⬅️ uložíme Its kód (fallback AX, kdyby chyběl)
        item.ItemName,
        item.EAN_Base,
        item.SalesQty,
        item.EAN_Pouch,
        item.EAN_Box,
        item.QTY_Box,
        item.QTY_Pouch
      ]);
    }

    res.json({ orderNumber, items: enriched });
  } catch (err) {
    console.error('Error in /wms/order:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Endpoint pro aktualizaci napickovaného množství
app.post('/wms/updatePickedQuantity', async (req, res) => {
  try {
    const { orderNumber, productReference, pickedQuantity } = req.body;
    const sqlUpdatePicked = `
      UPDATE Orders_raw
      SET Product_Picked = ?
      WHERE Order_Number = ? AND Product_Reference = ?
    `;
    await dbQuery(sqlUpdatePicked, [pickedQuantity, orderNumber, productReference]);

    res.send({ status: 'Updated successfully' });
  } catch (error) {
    console.error('Error updating picked quantity:', error);
    res.status(500).send(`Error updating picked quantity: ${error.message}`);
  }
});

// === Picked orders list + souhrny ===
// hlavní, co volá FE:
app.get('/api/orders/picked', async (req, res) => {
  try {
    // Použijeme helper q + poolC5sluzbyint (promisified pool)
    // 1) vybereme aktivní (Picking=1) objednávky z Orders_List
    const orders = await q(poolC5sluzbyint,
      `SELECT Order_Number
         FROM Orders_List
        WHERE Picking = 1`
    );

    if (!orders.length) return res.json([]);

    // 2) načteme souhrny z Orders_raw pro vybrané objednávky
    const orderNos = orders.map(o => o.Order_Number);
    const placeholders = orderNos.map(() => '?').join(',');

    const sums = await q(poolC5sluzbyint, `
      SELECT 
        r.Order_Number,
        COUNT(*)                                      AS lines_count,
        SUM(r.SalesQty)                               AS total_qty,
        SUM(COALESCE(r.Product_Picked,0))             AS total_picked,
        SUM(COALESCE(r.Product_Picked_Check,0))       AS total_checked,
        SUM(CASE WHEN COALESCE(r.Product_Picked,0) = r.SalesQty THEN 1 ELSE 0 END) AS lines_completed
      FROM Orders_raw r
      WHERE r.Order_Number IN (${placeholders})
      GROUP BY r.Order_Number
    `, orderNos);

    // 3) spojíme a vrátíme
    const byNo = new Map(sums.map(x => [String(x.Order_Number), x]));
    const out = orders.map(o => {
      const s = byNo.get(String(o.Order_Number)) || {};
      return {
        Order_Number: o.Order_Number,
        lines_count: Number(s.lines_count || 0),
        lines_completed: Number(s.lines_completed || 0),
        total_qty: Number(s.total_qty || 0),
        total_picked: Number(s.total_picked || 0),
        total_checked: Number(s.total_checked || 0),
        // doplníme i procenta pro UI (bez dělení nulou)
        picked_ratio: (Number(s.total_qty) > 0) ? Number((s.total_picked / s.total_qty).toFixed(4)) : 0,
        checked_ratio: (Number(s.total_qty) > 0) ? Number((s.total_checked / s.total_qty).toFixed(4)) : 0
      };
    });

    // volitelně seřaď podle „nejméně hotové nahoře“ (nech klidně jak chceš)
    out.sort((a, b) => a.picked_ratio - b.picked_ratio);

    res.json(out);
  } catch (err) {
    console.error('Error in /api/orders/picked:', err);
    res.status(500).send('Server Error: ' + (err?.message || err));
  }
});

// alias kvůli zpětné kompatibilitě (FE už používá /api/...):
app.get('/wms/orders/picked', (req, res, next) => {
  req.url = '/api/orders/picked';
  next();
});

// Seznam naskenovaných linek (krabice/sáčky) pro item_id v dané objednávce
// GET /wms/order/:orderNumber/picked-items?item_id=TP003060
// Vrátí naskenované (ledger) řádky pro danou objednávku a položku.
// item_id může být buď Product_Id (AX), nebo ItsItemName2.
app.get('/wms/order/:orderNumber/picked-items', async (req, res) => {
  const orderNumber = String(req.params.orderNumber || '').trim();
  const itemIdParam = String(req.query.item_id || '').trim();

  if (!orderNumber || !itemIdParam) {
    return res.status(400).json({ error: 'Missing orderNumber or item_id' });
  }

  let conn;
  try {
    conn = await getConn(poolC5sluzbyint);

    // 1) Zjisti ledger key (ItsItemName2) z Orders_raw – bez JOINu
    //    Umožníme match jak přes Product_Id (AX), tak přes ItsItemName2.
    const map = await exec(
      conn,
      `SELECT ItsItemName2 AS product_ledger_key
         FROM Orders_raw
        WHERE Order_Number = ?
          AND (Product_Id = ? OR ItsItemName2 = ?)
        LIMIT 1`,
      [orderNumber, itemIdParam, itemIdParam]
    );

    if (!map || !map.length) {
      // Nemáme řádek pro tu položku v dané objednávce → nic k vrácení
      return res.json([]);
    }

    const productKey = String(map[0].product_ledger_key || '').trim();
    if (!productKey) return res.json([]);

    // 2) Najdi otevřené výdejky (může jich být víc; použijeme všechny)
    const issues = await exec(
      conn,
      `SELECT id
         FROM WH_Issues
        WHERE order_number = ? AND status = 'open'
        ORDER BY id DESC`,
      [orderNumber]
    );

    if (!issues || !issues.length) {
      // žádná otevřená výdejka → nemáme co vrátit
      return res.json([]);
    }

    const issueIds = issues.map(r => r.id);
    const placeholders = issueIds.map(() => '?').join(',');

    // 3) Načti ledger řádky pro daný produkt a otevřené výdejky
    const rows = await exec(
      conn,
      `SELECT
          i.id,
          i.issue_id,
          i.line_no,
          i.product_id,
          i.carton_code,
          i.measurement_id,
          i.slot_id_from,
          i.qty_units,
          i.qty_cartons,
          i.qty_sachets,
          i.created_at
         FROM WH_IssueItems i
        WHERE i.issue_id IN (${placeholders})
          AND i.product_id = ?
        ORDER BY i.id DESC`,
      [...issueIds, productKey]
    );

    return res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('GET /wms/order/:orderNumber/picked-items error', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    if (conn && conn.release) conn.release();
  }
});

// Smazání vybraných linek a úprava Orders_raw.Product_Picked
app.delete('/wms/order/:orderNumber/picked-items', async (req, res) => {
  const orderNumber = String(req.params.orderNumber || '').trim();
  const { item_id: itemId, line_ids: lineIds } = req.body || {};
  const lineIdsArr = Array.isArray(lineIds) ? lineIds.map(Number).filter(n => Number.isFinite(n)) : [];

  if (!orderNumber || !itemId || lineIdsArr.length === 0) {
    return res.status(400).json({ error: 'Missing orderNumber, item_id or line_ids' });
  }

  let conn;
  try {
    conn = await getConn(poolC5sluzbyint);
    await begin(conn);

    // 1) Najdi klíče v Orders_raw (bez JOINu):
    //    - product_ledger_key = ItsItemName2 → tím filtrováme WH_IssueItems.product_id
    //    - product_raw_id     = Product_Id (AX) → tím updatujeme Orders_raw
    const map = await exec(conn,
      `SELECT ItsItemName2 AS product_ledger_key, Product_Id AS product_raw_id
         FROM Orders_raw
        WHERE Order_Number = ?
          AND (Product_Id = ? OR ItsItemName2 = ?)
        LIMIT 1`,
      [orderNumber, String(itemId), String(itemId)]
    );

    if (!map || !map.length) {
      await rollback(conn);
      return res.status(404).json({ error: 'Item not found in Orders_raw' });
    }

    const productKey = String(map[0].product_ledger_key || '').trim(); // ItsItemName2
    const productRaw = String(map[0].product_raw_id || '').trim();     // AX Product_Id

    if (!productKey) {
      await rollback(conn);
      return res.status(404).json({ error: 'Ledger key (ItsItemName2) not found for item in Orders_raw' });
    }

    // 2) Otevřené výdejky pro order
    const issues = await exec(conn,
      `SELECT id FROM WH_Issues
        WHERE order_number = ? AND status = 'open'
        ORDER BY id DESC`,
      [orderNumber]
    );
    if (!issues.length) {
      await rollback(conn);
      return res.status(404).json({ error: 'No open issue for this order' });
    }

    const issueIds = issues.map(x => x.id);
    const issuePH  = issueIds.map(() => '?').join(',');
    const linesPH  = lineIdsArr.map(() => '?').join(',');

    // 3) Ověř, že mazané řádky existují a patří k danému produktu + issue; sečti qty
    const lines = await exec(conn,
      `SELECT i.id, i.qty_units
         FROM WH_IssueItems i
        WHERE i.issue_id IN (${issuePH})
          AND i.product_id = ?
          AND i.id IN (${linesPH})
        FOR UPDATE`,
      [...issueIds, productKey, ...lineIdsArr]
    );

    if (!lines.length) {
      await rollback(conn);
      return res.status(404).json({ error: 'Lines to delete not found' });
    }

    const totalUnits = lines.reduce((s, r) => s + Number(r.qty_units || 0), 0);

    // 4) Smaž řádky z ledgeru
    await exec(conn,
      `DELETE FROM WH_IssueItems
        WHERE id IN (${linesPH})`,
      lineIdsArr
    );

    // 5) Sniž Orders_raw.Product_Picked (nepodkroč 0) pro AX Product_Id
    await exec(conn,
      `UPDATE Orders_raw
          SET Product_Picked = GREATEST(0, COALESCE(Product_Picked,0) - ?)
        WHERE Order_Number = ? AND Product_Id = ?`,
      [totalUnits, orderNumber, productRaw]
    );

    // (volitelné) můžeš vrátit i aktuální stav po update:
    const after = await exec(conn,
      `SELECT Product_Picked
         FROM Orders_raw
        WHERE Order_Number = ? AND Product_Id = ?
        LIMIT 1`,
      [orderNumber, productRaw]
    );

    await commit(conn);
    res.json({
      ok: true,
      removedLines: lines.length,
      removedUnits: totalUnits,
      productId: productRaw,
      productKey, // ItsItemName2
      newPicked: Number(after?.[0]?.Product_Picked ?? 0)
    });
  } catch (err) {
    try { if (conn) await rollback(conn); } catch {}
    console.error('DELETE picked-items error', err);
    res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    if (conn) conn.release?.();
  }
});

// GET /wms/order/:orderNumber/recalc-picked?item_id=TP000090
//    nebo /wms/order/:orderNumber/recalc-picked?its=NA10FF.28
//    volitelně ?scope=open  -> sčítá jen otevřené výdejky
app.get('/wms/order/:orderNumber/recalc-picked', async (req, res) => {
  const orderNumber = String(req.params.orderNumber || '').trim();

  // query aliasy: item_id (AX), its/product_code (ItsItemName2)
  const itemIdParam   = (req.query.item_id || req.query.ax || '').toString().trim();
  const itsParam      = (req.query.its || req.query.product_code || '').toString().trim();
  const scope         = (req.query.scope || 'all').toString().trim().toLowerCase(); // 'all' | 'open'

  if (!orderNumber || (!itemIdParam && !itsParam)) {
    return res.status(400).json({ error: 'Missing orderNumber or item_id/its' });
  }

  let conn;
  try {
    conn = await getConn(poolC5sluzbyint);
    await begin(conn);

    // 1) Najdi řádek v Orders_raw a získej obě identity (AX i ITS)
    const map = await exec(conn,
      `SELECT ItsItemName2 AS its, Product_Id AS ax
         FROM Orders_raw
        WHERE Order_Number = ?
          AND (Product_Id = ? OR ItsItemName2 = ?)
        LIMIT 1`,
      [orderNumber, itemIdParam || itsParam, itemIdParam || itsParam]
    );

    if (!map || !map.length) {
      await rollback(conn);
      return res.status(404).json({ error: 'Item not found in Orders_raw for this order' });
    }

    const its = String(map[0].its || '').trim(); // ledger key
    const ax  = String(map[0].ax  || '').trim(); // Orders_raw key

    if (!its || !ax) {
      await rollback(conn);
      return res.status(404).json({ error: 'Missing ITS/AX mapping in Orders_raw' });
    }

    // 2) Sečti qty z WH_IssueItems pro danou objednávku a ITS kód
    //    scope=open  -> jen otevřené výdejky; jinak všechny (open i closed)
    const sumSql =
      scope === 'open'
        ? `SELECT COALESCE(SUM(i.qty_units),0) AS s
             FROM WH_IssueItems i
             JOIN WH_Issues h ON h.id = i.issue_id
            WHERE h.order_number = ? AND h.status = 'open' AND i.product_id = ?`
        : `SELECT COALESCE(SUM(i.qty_units),0) AS s
             FROM WH_IssueItems i
             JOIN WH_Issues h ON h.id = i.issue_id
            WHERE h.order_number = ? AND i.product_id = ?`;

    const sum = await exec(conn, sumSql, [orderNumber, its]);
    const picked = Number(sum?.[0]?.s || 0);

    // 3) Aktualizuj Orders_raw (Product_Picked) + stáhni kontrolu pokud je vyšší
    await exec(conn,
      `UPDATE Orders_raw
          SET Product_Picked = ?,
              Product_Picked_Check = LEAST(COALESCE(Product_Picked_Check,0), ?)
        WHERE Order_Number = ? AND Product_Id = ?`,
      [picked, picked, orderNumber, ax]
    );

    await commit(conn);
    return res.json({
      ok: true,
      orderNumber,
      item: { ax, its },
      scope: scope === 'open' ? 'open' : 'all',
      picked
    });
  } catch (e) {
    try { if (conn) await rollback(conn); } catch {}
    console.error('GET /wms/order/:orderNumber/recalc-picked error', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  } finally {
    if (conn) conn.release?.();
  }
});


// Endpoint pro aktualizaci pickovaných objednávek
app.get('/wms/process_picking_orders', async (req, res) => {
  try {
    // Přiřazení čísla pickingu pro každou objednávku
    await dbQuery('SET @row_number = 0;');
    await dbQuery(`
      UPDATE Orders_List
      SET Picking_Position = (@row_number:=@row_number + 1)
      WHERE Picking = 1
      ORDER BY Order_Number;
    `);

    // Volání externího API pro získání detailů objednávek
    const pickingOrdersResult = await dbQuery('SELECT Order_Number FROM Orders_List WHERE Picking = 1');
    const orderNumbers = pickingOrdersResult.map(order => order.Order_Number);
    const orderNumbersString = orderNumbers.join(',');

    const response = await axios.post('https://eurofaktura.cz/WebServicesCZ/API', {
      username: "INFO@ZDRAVYKRAM.CZ",
      md5pass: "c5ea5bf426f32ea6c674d044a418e7a6",
      token: "F0514496FEBA0D00B091E288020E0B93",
      method: "SalesOrderGet",
      parameters: { number: orderNumbersString }
    });

    // Zpracování a vložení detailů objednávek
    await Promise.all(response.data.response.result.flatMap(orderDetails =>
      orderDetails.Items.map(item => {
        if (item.productCode) {
          const sqlOrdersRaw = `
            INSERT INTO Orders_raw (Order_Number, Position, Shop_Id, Product_Name, Product_Ean, Product_Quantity)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE Product_Name = VALUES(Product_Name), Product_Ean = VALUES(Product_Ean), Product_Quantity = VALUES(Product_Quantity)
          `;
          return dbQuery(sqlOrdersRaw, [orderDetails.number, item.position, '1', item.description, item.productBarCode, item.quantity]);
        }
        return Promise.resolve();
      })
    ));

    // Načtení a odeslání aktualizovaných dat
   const ordersRawResult = await dbQuery(`
  SELECT Orders_raw.*, Orders_List.Picking, Orders_List.Picking_Position,
         COALESCE(Orders_raw.Product_Picked, 0) AS Product_Picked
  FROM Orders_raw
  INNER JOIN Orders_List ON Orders_raw.Order_Number = Orders_List.Order_Number
  WHERE Orders_List.Picking = 1
`);   

    res.json(ordersRawResult);
  } catch (error) {
    console.error('Error processing picking orders:', error);
    res.status(500).send(`Error processing picking orders: ${error.message}`);
  }
});

//výpis zákaznických skupin
app.get('/raynet/territory', async (req, res) => {
  try {
    console.log('=== /raynet/get-companyClassification1 endpoint byl zavolán ===');

    // Zavoláme Raynet API pro získání bezpečnostních úrovní
    const response = await raynetApi.get('/territory/');
    
    // Extrahujeme data z odpovědi
    const { success, totalCount, data } = response.data;
    
    if (success) {
      console.log(`Získáno ${totalCount} bezpečnostních úrovní.`);
      return res.status(200).json({
        success: true,
        totalCount: totalCount,
        data: data,
      });
    } else {
      console.warn('Raynet API vrátilo neúspěšný response.');
      return res.status(500).json({
        success: false,
        message: 'Nepodařilo se získat bezpečnostní úrovně z Raynet CRM.',
      });
    }
  } catch (error) {
    console.error('Chyba při získávání bezpečnostních úrovní z Raynet CRM:', error.response ? error.response.data : error.message);
    res.status(500).json({
      success: false,
      message: 'Chyba při získávání bezpečnostních úrovní z Raynet CRM.',
      error: error.message,
    });
  }
});

//výpis zákaznických skupin
app.get('/raynet/businessCasePhase', async (req, res) => {
  try {
    console.log('=== /raynet/get-businessCasePhase endpoint byl zavolán ===');

    // Zavoláme Raynet API pro získání bezpečnostních úrovní
    const response = await raynetApi.get('/businessCasePhase/');
    
    // Extrahujeme data z odpovědi
    const { success, totalCount, data } = response.data;
    
    if (success) {
      console.log(`Získáno ${totalCount} bezpečnostních úrovní.`);
      return res.status(200).json({
        success: true,
        totalCount: totalCount,
        data: data,
      });
    } else {
      console.warn('Raynet API vrátilo neúspěšný response.');
      return res.status(500).json({
        success: false,
        message: 'Nepodařilo se získat bezpečnostní úrovně z Raynet CRM.',
      });
    }
  } catch (error) {
    console.error('Chyba při získávání bezpečnostních úrovní z Raynet CRM:', error.response ? error.response.data : error.message);
    res.status(500).json({
      success: false,
      message: 'Chyba při získávání bezpečnostních úrovní z Raynet CRM.',
      error: error.message,
    });
  }
});

// Endpoint pro získání enum hodnot pro custom pole Aktivita_2_b3bab u entity Company
app.get('/raynet/get-aktivita-enum', async (req, res) => {
  try {
    console.log('=== /raynet/get-aktivita-enum endpoint byl zavolán ===');
    // Voláme Raynet API (předpokládáme, že raynetApi je správně nakonfigurovaný axios instance)
    const response = await raynetApi.get('/customField/enum/Company/Aktivita_54b91');
    
    // Předpokládáme, že odpověď má strukturu { success: true, data: [...] }
    const { success, data } = response.data;
    
    if (success) {
      console.log('Enum hodnoty pro Aktivita_2_b3bab:', data);
      return res.status(200).json({
        success: true,
        data: data,
      });
    } else {
      console.warn('Raynet API vrátilo neúspěšný response.');
      return res.status(500).json({
        success: false,
        message: 'Nepodařilo se získat enum hodnoty pro Aktivita_2_b3bab.',
      });
    }
  } catch (error) {
    console.error('Chyba při získávání enum hodnot pro Aktivita_2_b3bab:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Chyba při získávání enum hodnot pro Aktivita_2_b3bab.',
      error: error.message,
    });
  }
});

// výpis bezpečnostních úrovní
app.get('/raynet/get-security-levels', async (req, res) => {
  try {
    console.log('=== /raynet/get-security-levels endpoint byl zavolán ===');

    // Zavoláme Raynet API pro získání bezpečnostních úrovní
    const response = await raynetApi.get('/securityLevel/');
    
    // Extrahujeme data z odpovědi
    const { success, totalCount, data } = response.data;
    
    if (success) {
      console.log(`Získáno ${totalCount} bezpečnostních úrovní.`);
      return res.status(200).json({
        success: true,
        totalCount: totalCount,
        data: data,
      });
    } else {
      console.warn('Raynet API vrátilo neúspěšný response.');
      return res.status(500).json({
        success: false,
        message: 'Nepodařilo se získat bezpečnostní úrovně z Raynet CRM.',
      });
    }
  } catch (error) {
    console.error('Chyba při získávání bezpečnostních úrovní z Raynet CRM:', error.response ? error.response.data : error.message);
    res.status(500).json({
      success: false,
      message: 'Chyba při získávání bezpečnostních úrovní z Raynet CRM.',
      error: error.message,
    });
  }
});

// výpis uživatelských účtů
app.get('/raynet/get-user-accounts', async (req, res) => {
  // Získání limitu z query parametrů, defaultně 1000
  const limit = parseInt(req.query.limit) || 1000;

  try {
    console.log(`Volám GET /userAccount/ s parametry: { limit: ${limit} }`);

    // Zavolání Raynet API pro získání uživatelských účtů
    const response = await raynetApi.get('/userAccount/', {
      params: {
        limit: limit,
      },
    });

    const users = response.data.data;

    console.log(`GET /userAccount/ vráceno ${users.length} uživatelských účtů.`);

    // Odeslání seznamu uživatelů jako JSON odpověď
    res.json({
      success: true,
      count: users.length,
      users: users,
    });
  } catch (error) {
    console.error('Chyba při získávání uživatelských účtů:', error.response ? error.response.data : error.message);
    res.status(500).json({
      success: false,
      message: 'Chyba při získávání uživatelských účtů.',
      error: error.message,
    });
  }
});

// Nový endpoint pro získání ID uživatele
app.get('/raynet/get-owner-id', async (req, res) => {
  const { jmenoOZKstzs } = req.query;

  if (!jmenoOZKstzs) {
    return res.status(400).json({ error: 'Chybí parametr jmenoOZKstzs.' });
  }

  try {
    // Extrakce teritoria a surového jména vlastníka
    const { territoryName, ownerFullNameRaw } = extractTerritoryAndOwnerRaw(jmenoOZKstzs);

    // Vyhledání ID vlastníka v Raynetu
    const ownerId = await findOwnerIdInRaynet(ownerFullNameRaw);

    res.json({
      success: true,
      territoryName,
      ownerId, // nyní obsahuje person.id
    });
  } catch (error) {
    console.error('Chyba při získávání owner ID:', error.message);
    res.status(500).json({ error: 'Chyba při získávání owner ID.' });
  }
});

// Endpoint pro vymazání všech obchodních případů pomocí GET požadavku
app.get('/raynet/delete-all-business-cases', async (req, res) => {
  try {
    console.log('Začínám proces vymazání všech obchodních případů.');

    // Získání všech obchodních případů
    const businessCases = await getAllBusinessCasesPaginated();
    console.log(`Nalezeno ${businessCases.length} obchodních případů.`);

    if (businessCases.length === 0) {
      console.log('Žádné obchodní případy k vymazání.');
      return res.status(200).json({ message: 'Žádné obchodní případy k vymazání.' });
    }

    // Mazání postupně jeden po druhém
    for (const businessCase of businessCases) {
      try {
        await deleteBusinessCase(businessCase.id);
      } catch (error) {
        console.error(`Chyba při mazání obchodního případu ID ${businessCase.id}:`, error.response ? error.response.data : error.message);
        // Pokračujeme dál i při chybě
      }
    }

    console.log('Všechny obchodní případy byly vymazány.');
    res.status(200).json({ message: 'Všechny obchodní případy byly úspěšně vymazány.' });
  } catch (error) {
    console.error('Chyba při vymazávání obchodních případů:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Chyba při vymazávání obchodních případů.' });
  }
});



// Endpoint pro aktualizaci pole Prodano v tabulce IMPORT_CZS_Kalkulace_cen_netto
app.get('/update-prodano', async (req, res) => {
  try {
    // Krok 1: Získání seznamu aktivních položek z MySQL databáze
    const mysqlQuery = `
      SELECT polozka, platnost_od, platnost_do, \`Limit\`
      FROM IMPORT_CZS_Kalkulace_cen_netto
      WHERE Aktivni = 1
    `;

    const items = await query(poolC5pneutyres, mysqlQuery);

    if (items.length === 0) {
      return res.status(200).json({ message: 'Žádné aktivní položky nebyly nalezeny v tabulce IMPORT_CZS_Kalkulace_cen_netto.' });
    }

    // Vytvoření mapy pro rychlý přístup k položkám podle polozka
    const itemMap = {};
    let minDate = null;
    let maxDate = null;

    items.forEach(item => {
      itemMap[item.polozka] = {
        platnost_od: item.platnost_od ? new Date(item.platnost_od) : null,
        platnost_do: item.platnost_do ? new Date(item.platnost_do) : null,
        limit: item.Limit !== null ? parseInt(item.Limit, 10) : 0,
        prodano: 0, // Inicializace prodano na 0
      };

      // Aktualizace minDate a maxDate pro časové filtry
      if (item.platnost_od) {
        const platnostOd = new Date(item.platnost_od);
        if (!minDate || platnostOd < minDate) {
          minDate = platnostOd;
        }
      }

      if (item.platnost_do) {
        const platnostDo = new Date(item.platnost_do);
        if (!maxDate || platnostDo > maxDate) {
          maxDate = platnostDo;
        }
      }
    });

    if (!minDate || !maxDate) {
      return res.status(400).json({ message: 'Chybí platnost_od nebo platnost_do u některých položek.' });
    }

    // Převod dat na formát YYYY-MM-DD pro použití v SQL dotazu
    const minDateString = minDate.toISOString().split('T')[0];
    const maxDateString = maxDate.toISOString().split('T')[0];

    // Krok 2: Získání prodejních dat z MSSQL databáze
    const itemIds = items.map(item => `'${item.polozka}'`).join(',');

    const mssqlQuery = `
      SELECT sl.ItemId, SUM(sl.SalesQty) AS TotalSales, st.ReceiptDateRequested
      FROM ItsIFSalesLine sl
      JOIN ItsIFSalesTable st ON sl.SalesId = st.SalesId
      WHERE sl.ItemId IN (${itemIds})
        AND st.SalesStatusText != 'Stornováno'
        AND st.ReceiptDateRequested BETWEEN '${minDateString}' AND '${maxDateString}'
      GROUP BY sl.ItemId, st.ReceiptDateRequested
    `;

    const mssqlResult = await sql.query(mssqlQuery);

    // Krok 3: Zpracování výsledků a výpočet prodaných kusů pro každou položku
    mssqlResult.recordset.forEach(record => {
      const itemId = record.ItemId;
      const receiptDate = new Date(record.ReceiptDateRequested);
      const salesQty = record.TotalSales;

      const item = itemMap[itemId];

      if (item && item.platnost_od && item.platnost_do) {
        if (receiptDate >= item.platnost_od && receiptDate <= item.platnost_do) {
          item.prodano += salesQty;
        }
      }
    });

    // Krok 4: Aktualizace pole Prodano v MySQL databázi a kontrola Limit pro nastavení Aktivni na 0
    // Vytvoření transakce
    poolC5pneutyres.getConnection((err, connection) => {
      if (err) {
        console.error('Chyba při získávání připojení:', err);
        return res.status(500).json({ message: 'Chyba při získávání připojení k databázi.' });
      }

      connection.beginTransaction(async err => {
        if (err) {
          connection.release();
          console.error('Chyba při zahájení transakce:', err);
          return res.status(500).json({ message: 'Chyba při zahájení transakce.' });
        }

        try {
          for (const polozka in itemMap) {
            const prodano = itemMap[polozka].prodano;
            const limit = itemMap[polozka].limit;

            // Aktualizace 'Prodano'
            const updateProdanoQuery = `
              UPDATE IMPORT_CZS_Kalkulace_cen_netto
              SET Prodano = ?
              WHERE polozka = ?
            `;

            await query(connection, updateProdanoQuery, [prodano, polozka]);

            // Kontrola, zda 'prodano' > 'limit' a 'limit' != 0
            if (limit !== 0 && prodano > limit) {
              // Aktualizace 'Aktivni' na 0
              const updateAktivniQuery = `
                UPDATE IMPORT_CZS_Kalkulace_cen_netto
                SET Aktivni = 0
                WHERE polozka = ?
              `;

              await query(connection, updateAktivniQuery, [polozka]);
            }
          }

          // Commit transakce
          connection.commit(err => {
            if (err) {
              connection.rollback(() => {
                connection.release();
                console.error('Chyba při commit transakce:', err);
                return res.status(500).json({ message: 'Chyba při commit transakce.' });
              });
            } else {
              connection.release();
              res.json({ message: 'Pole Prodano bylo úspěšně aktualizováno a Aktivni bylo nastaveno na 0, pokud bylo potřeba.' });
            }
          });
        } catch (error) {
          connection.rollback(() => {
            connection.release();
            console.error('Chyba při aktualizaci pole Prodano nebo Aktivni:', error);
            return res.status(500).json({ message: 'Chyba při aktualizaci pole Prodano nebo Aktivni.' });
          });
        }
      });
    });
  } catch (error) {
    console.error('Chyba v /update-prodano endpointu:', error);
    res.status(500).json({ message: 'Chyba při zpracování požadavku.' });
  }
});



// import dat z csv
// Endpoint pro import dat z CSV souboru do tabulky AX_PPR
app.get('/import-csv', async (req, res) => {
  const filePath = path.join(__dirname, 'Ostrava_CMR-upr.csv');

  try {
    // Zkontrolujeme, zda soubor existuje
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'CSV soubor nebyl nalezen.'
      });
    }

    // Připojení k MySQL databázi
    console.log('Připojuji se k MySQL databázi...');
    const connection = await poolC5tpms.getConnection();
    connection.query = util.promisify(connection.query);

    // Vyprázdnění tabulky před importem
    const truncateQuery = 'TRUNCATE TABLE `c5tpms`.`AX_PPR`;';
    console.log('Vyprázdňuji tabulku AX_PPR...');
    await connection.query(truncateQuery);
    console.log('Tabulka AX_PPR byla vyprázdněna.');

    // Načtení dat z CSV souboru s použitím správného kódování
    const loadQuery = `
      LOAD DATA LOCAL INFILE ?
      INTO TABLE \`c5tpms\`.\`AX_PPR\`
      CHARACTER SET 'cp1250'
      FIELDS TERMINATED BY ';'
      ENCLOSED BY '"'
      LINES TERMINATED BY '\n'
      IGNORE 1 LINES
      (
        ICO,
        Nazev_obd,
        Cenova_skupina,
        Jmeno_OZ_Kstzs,
        Rok,
        Obdobi,
        Datum,
        PP,
        Faktura,
        Diskont,
        C_polozky,
        Nazev1,
        Nazev2,
        Nazev3,
        Mnozstvi,
        Nakupni_vyrobni_cena,
        Skutecna_prodejni_cena,
        Marze,
        Prepoctena_marze,
        Soucet_z_prepoctena_Marze,
        Soucet_z_pc_na_ks,
        Soucet_z_PM_na_ks
      )
      SET Nakupni_vyrobni_cena = NULLIF(REPLACE(Nakupni_vyrobni_cena, ',', '.'), '');
    `;

    // Spuštění SQL dotazu pro import dat
    console.log('Importuji data z CSV souboru...');
    await connection.query(loadQuery, [filePath]);
    console.log('Data byla úspěšně naimportována.');

    // Uzavření připojení
    connection.release();

    // Odpověď klientovi
    res.status(200).json({
      success: true,
      message: 'Data byla úspěšně naimportována do tabulky AX_PPR.'
    });
  } catch (error) {
    console.error('Chyba při importu dat z CSV:', error.message);
    res.status(500).json({
      success: false,
      message: 'Chyba při importu dat z CSV.',
      error: error.message
    });
  }
});



app.get('/raynet/update-business-cases-AX-fromMSSQL', async (req, res) => {
  let connection;
  try {
    console.log('=== /raynet/update-business-cases-AX-fromMSSQL endpoint byl zavolán ===');

    // SQL dotaz: načítá data pro rok 2025 pro všechny RegNum
    const msSqlQuery = `
      SELECT 
  T.SalesId,
  T.RegNum,
  T.CustName,
  T.SalesGroupName,
  T.SalesStatusText,
  T.ReceiptDateRequested,
  L.ItemId,
  L.DeliveredQty,
  L.SalesPrice,
  L.LinePercent,
  I.ItemName,
  I.ItemGroupId,
  I.PurchLineDisc
FROM [AxProdCS].[dbo].[ItsIFSalesTable] T
JOIN [AxProdCS].[dbo].[ItsIFSalesLine] L ON T.SalesId = L.SalesId
JOIN [AxProdCS].[dbo].[ItsIFInventTable] I ON L.ItemId = I.ItemId
WHERE YEAR(T.ReceiptDateRequested) = 2025
  AND MONTH(T.ReceiptDateRequested) IN (1,2,3)
ORDER BY T.RegNum, T.SalesId;
    `;

    console.log('Spouštím SELECT z MSSQL...');
    const result = await queryMSSQL(msSqlQuery, []);
    const rows = result.recordset;
    console.log(`Načteno ${rows.length} řádků z MSSQL pro rok 2025.`);

    if (rows.length === 0) {
      console.warn('SQL dotaz nevrátil žádná data. Zkontrolujte filtr a data v databázi.');
      return res.status(200).json({ success: true, message: 'SQL dotaz nevrátil žádná data.' });
    }

    // Seskupíme řádky podle SalesId
    const salesMap = {};
    for (const row of rows) {
      const { SalesId } = row;
      if (!salesMap[SalesId]) {
        salesMap[SalesId] = [];
      }
      salesMap[SalesId].push(row);
    }

    let totalProcessed = 0;
    let totalSkipped = 0;

    // Zpracování každého obchodního případu
    for (const salesId in salesMap) {
      console.log(`\n=== Zpracovávám SalesId: ${salesId} ===`);
      const lines = salesMap[salesId];
      if (!lines || lines.length === 0) {
        console.warn(`Žádné řádky pro SalesId ${salesId}. Přeskakuji...`);
        totalSkipped++;
        continue;
      }

      const { RegNum, CustName, SalesGroupName, SalesStatusText, ReceiptDateRequested } = lines[0];
      const parsedDate = new Date(ReceiptDateRequested);
      const validFrom = parsedDate.toISOString().slice(0, 10);
      const validTill = validFrom; // stejná hodnota

      // Určení businessCasePhase:
      //  1) Pokud je SalesStatusText === 'Fakturováno' => 5
      //  2) Pokud je SalesStatusText === 'Zrušeno' => 7
      //  3) Jinak, pokud všechny DeliveredQty = 0 => 1, jinak => 8
      let businessCasePhase;
      if (SalesStatusText === 'Fakturováno') {
        businessCasePhase = 5;
        console.log('SalesStatusText = Fakturováno => businessCasePhase = 5');
      } else if (SalesStatusText === 'Zrušeno') {
        businessCasePhase = 7;
        console.log('SalesStatusText = Zrušeno => businessCasePhase = 7');
      } else {
        let allZero = true;
        for (const line of lines) {
          if ((parseFloat(line.DeliveredQty) || 0) > 0) {
            allZero = false;
            break;
          }
        }
        businessCasePhase = allZero ? 1 : 8;
        console.log(`SalesStatusText != 'Fakturováno' a != 'Zrušeno'. allZero=${allZero} => phase=${businessCasePhase}`);
      }

      try {
        console.log(`Hledám společnost s IČ: ${RegNum}`);
        let company = await findCompanyByRegNumber(RegNum);
        if (!company) {
          console.log(`Společnost s IČ ${RegNum} neexistuje, vytvářím...`);
          company = await createCompanyByRegNumber(RegNum);
          if (!company || !company.id) {
            console.warn(`Nepodařilo se vytvořit společnost s IČ ${RegNum}. Přeskakuji SalesId ${salesId}.`);
            totalSkipped++;
            continue;
          }
        }
        const companyId = company.id;
        console.log(`Společnost s IČ ${RegNum} nalezena, ID: ${companyId}.`);

        const { ownerId, territoryId } = extractOwnerAndTerritory(SalesGroupName);
        console.log(`Extrahováno z SalesGroupName: ownerId = ${ownerId}, territoryId = ${territoryId}`);

        console.log(`Hledám obchodní případ s kódem: ${salesId}`);
        let businessCase = await findBusinessCaseByCode(salesId);
        let businessCaseId;
        const businessCaseData = {
          code: salesId,
          name: `Obchodní případ ${salesId}`,
          description: 'Import z MSSQL AX data',
          company: companyId,
          state: 'OFFERED',
          owner: ownerId,
          territory: territoryId,
          businessCasePhase: businessCasePhase,
          validFrom: validFrom,
          validTill: validTill
        };

        if (!businessCase) {
          console.log(`Obchodní případ ${salesId} neexistuje, vytvářím...`);
          businessCase = await createBusinessCase(businessCaseData);
          businessCaseId = businessCase.id;
          console.log(`Obchodní případ vytvořen, ID: ${businessCaseId}`);
        } else {
          businessCaseId = businessCase.id;
          console.log(`Obchodní případ s kódem ${salesId} nalezen, ID: ${businessCaseId}. Aktualizuji...`);
          await updateBusinessCase(businessCaseId, businessCaseData);
          console.log(`Obchodní případ ${businessCaseId} aktualizován.`);
        }

        // Mazání existujících položek
        try {
          console.log(`Načítám položky z obchodního případu ${businessCaseId} pro smazání...`);
          const bcResp = await raynetApi.get(`/businessCase/${businessCaseId}/`);
          if (bcResp.data && bcResp.data.data && bcResp.data.data.items) {
            const items = bcResp.data.data.items;
            console.log(`Nalezeno ${items.length} položek k odstranění.`);
            for (const item of items) {
              try {
                await raynetApi.delete(`/businessCase/${businessCaseId}/item/${item.id}/`);
                console.log(`Odstraněna položka ID ${item.id}`);
              } catch (delErr) {
                console.error(`Chyba při mazání položky ID ${item.id}:`, delErr.message);
              }
            }
          }
        } catch (loadErr) {
          console.error(`Chyba při načítání položek obchodního případu ${businessCaseId}:`, loadErr.message);
        }

        // Přidání nových položek – výpočet efektivní ceny se slevou
        for (const line of lines) {
          const productCode = line.ItemId;
          const count = parseFloat(line.DeliveredQty) || 0;
          const originalPrice = parseFloat(line.SalesPrice) || 0;
          const discountPercent = parseFloat(line.LinePercent) || 0;
          const effectivePrice = originalPrice * (1 - discountPercent / 100);
          const name = line.ItemName || "Bez názvu";
          const description = line.PurchLineDisc || "Bez popisu";

          const itemPayload = {
            productCode,
            count,
            price: effectivePrice,
            taxRate: 21,
            discountPercent,
            name,
            description
          };

          try {
            console.log(`Přidávám položku:`, itemPayload, `do obchodního případu ${businessCaseId}`);
            await addItemToBusinessCaseRaynet(businessCaseId, itemPayload);
            console.log(`Položka s productCode=${productCode} úspěšně přidána.`);
          } catch (itemErr) {
            console.error(`Chyba při přidávání položky do BC ${businessCaseId}:`, itemErr.message);
          }
        }

        totalProcessed++;
        console.log(`Dokončeno zpracování SalesId ${salesId}.`);
      } catch (errBC) {
        console.error(`Chyba při zpracování SalesId ${salesId}:`, errBC.message);
        totalSkipped++;
      }
    }

    const summary = `Aktualizace z MSSQL dokončena. Zpracováno: ${totalProcessed}, přeskočeno: ${totalSkipped}.`;
    console.log(summary);
    res.status(200).json({ success: true, message: summary });

  } catch (error) {
    console.error('Chyba při /raynet/update-business-cases-AX-fromMSSQL:', error.message);
    res.status(500).json({
      success: false,
      message: 'Chyba při aktualizaci obchodních případů z MSSQL.',
      error: error.message
    });
  }
});



app.get('/api/test-sales', async (req, res) => {
  try {
    console.log('Spouštím SELECT z MSSQL pro RegNum = 01400100...');
    const queryStr = `
      SELECT TOP (1000)
        T.SalesId,
        T.RegNum,
        T.CustName,
        L.ItemId,
        L.DeliveredQty,
        L.SalesPrice,
        I.ItemName,
        I.ItemGroupId,
        I.PurchLineDisc
      FROM [AxProdCS].[dbo].[ItsIFSalesTable] T
      JOIN [AxProdCS].[dbo].[ItsIFSalesLine] L 
        ON T.SalesId = L.SalesId
      JOIN [AxProdCS].[dbo].[ItsIFInventTable] I 
        ON L.ItemId = I.ItemId
      WHERE T.RegNum = '01400100'
      ORDER BY T.SalesId;
    `;
    const result = await queryMSSQL(queryStr, []);
    const rows = result.recordset;
    console.log(`Načteno ${rows.length} řádků z MSSQL pro RegNum=01400100.`);
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Chyba při načítání dat z MSSQL:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint pro tvrdou aktualizaci obchodních případů
app.get('/raynet/update-business-cases_AX_PPR', async (req, res) => {
  let connection;
  try {
    console.log('=== /update-business-cases_AX_PPR endpoint byl zavolán ===');
    console.log('=== Zahajuji aktualizaci obchodních případů ===');
    console.log('Připojuji se k MySQL databázi...');

    // Získání připojení z poolu
    connection = await poolC5tpms.getConnection();

    // Promisify the connection's query method
    connection.query = util.promisify(connection.query);

    // Načtení bezpečnostních úrovní z Raynet API
    console.log('Načítám bezpečnostní úrovně z Raynet CRM...');
    const securityResponse = await raynetApi.get('/securityLevel/');
    const { success: securitySuccess, data: securityLevels } = securityResponse.data;

    if (!securitySuccess) {
      throw new Error('Nepodařilo se získat bezpečnostní úrovně z Raynet CRM.');
    }

    console.log(`Získáno ${securityLevels.length} bezpečnostních úrovní.`);

    // Načtení unikátních SalesId (PP), ICO a Jmeno_OZ_Kstzs z tabulky AX_PPR
    const salesIdQuery = `
      SELECT DISTINCT PP, ICO, Jmeno_OZ_Kstzs
      FROM AX_PPR
    `;
    console.log('SQL dotaz pro načtení SalesId:', salesIdQuery);
    const salesIdRows = await connection.query(salesIdQuery);
    const salesIds = salesIdRows.map(row => ({
      PP: row.PP,
      ICO: row.ICO,
      Jmeno_OZ_Kstzs: row.Jmeno_OZ_Kstzs
    }));

    console.log(`Načteno ${salesIds.length} SalesId z MySQL.`);

    for (const { PP: salesId, ICO: ico, Jmeno_OZ_Kstzs: jmenoOZKstzs } of salesIds) {
      console.log(`\n--- Zpracovávám SalesId: ${salesId} ---`);
      try {
        // Extrahuji teritorium, uživatele a category z Jmeno_OZ_Kstzs
        console.log(`Extrahuji teritorium, uživatele a category z: ${jmenoOZKstzs}`);
        const { territoryName, ownerFullNameRaw, category } = extractTerritoryAndOwnerRaw(jmenoOZKstzs);

        if (!territoryName) {
          console.warn(`Nepodařilo se extrahovat teritorium z "${jmenoOZKstzs}". Pokračuji bez teritoria pro SalesId ${salesId}.`);
        }

        // Uložení 'category' do proměnné pro další použití
        const categoryVariable = category;
        console.log(`Category pro SalesId ${salesId} je: ${categoryVariable}`);

        // Zjištění ownerId
        const ownerId = await findOwnerIdInRaynet(ownerFullNameRaw);
        console.log(`ownerId pro "${ownerFullNameRaw}" je: ${ownerId}`);

        // Sestavení dat pro business case
        const businessCaseData = {
          code: salesId,
          name: `Obchodní případ ${salesId}`,
          description: 'Automaticky vytvořený/aktualizovaný obchodní případ',
          company: null, // Zpočátku nastavíme na null
          territory: null, // Zpočátku nastavíme na null
          state: 'OFFERED',
          owner: ownerId, // ID uživatele z Raynetu
          category: categoryVariable // Uložení category
        };

        // Získání ID teritoria
        let territoryId = null;
        if (territoryName) {
          try {
            console.log(`Získávám ID teritoria pro: ${territoryName}`);
            territoryId = await getTerritoryIdByName(territoryName);
            if (!territoryId) {
              console.warn(`Teritorium "${territoryName}" nebylo nalezeno. Pokračuji bez teritoria pro SalesId ${salesId}.`);
            } else {
              businessCaseData.territory = territoryId;
            }
          } catch (territoryError) {
            console.error(`Chyba při získávání ID teritoria pro "${territoryName}":`, territoryError.message);
            console.warn(`Pokračuji bez teritoria pro SalesId ${salesId}.`);
          }
        }

        // Získání ID klienta (společnosti) podle IČ
        console.log(`Získávám ID klienta pro IČ: ${ico}`);
        let company = await findCompanyByRegNumber(ico);

        let companyId;
        if (!company) {
          console.warn(`Společnost s IČ ${ico} nebyla nalezena v Raynet CRM. Pokouším se vytvořit novou společnost.`);
          try {
            company = await createCompanyByRegNumber(ico);
            if (company && company.id) {
              companyId = company.id;
              console.log(`Nová společnost s IČ ${ico} byla vytvořena s ID: ${companyId}.`);
              businessCaseData.company = companyId;
            } else {
              console.error(`Nepodařilo se vytvořit společnost s IČ ${ico}. Přeskakuji SalesId ${salesId}.`);
              continue;
            }
          } catch (creationError) {
            console.error(`Chyba při vytváření společnosti s IČ ${ico}:`, creationError.message);
            // Pokud se nepodaří společnost vytvořit, přeskočíme tento SalesId
            continue;
          }
        } else {
          companyId = company.id;
          businessCaseData.company = companyId;
          console.log(`Společnost s IČ ${ico} nalezena s ID: ${companyId}.`);
        }

        // Najdeme obchodní případ podle kódu (SalesId)
        console.log(`Hledám obchodní případ s kódem: ${salesId}`);
        let businessCase = await findBusinessCaseByCode(salesId);
        let businessCaseId;

        if (!businessCase) {
          console.log(`Obchodní případ nebyl nalezen, vytvářím nový.`);
          try {
            console.log('Request data for createBusinessCase:', JSON.stringify(businessCaseData, null, 2));
            businessCase = await createBusinessCase(businessCaseData);
            businessCaseId = businessCase.id;
            console.log(`Nový obchodní případ vytvořen s ID: ${businessCaseId}`);
          } catch (error) {
            console.error(`Chyba při vytváření obchodního případu:`, error.response ? error.response.data : error.message);
            continue;
          }
        } else {
          console.log(`Obchodní případ nalezen s ID: ${businessCase.id}, aktualizuji.`);
          try {
            businessCaseId = businessCase.id;
            console.log('Request data for updateBusinessCase:', JSON.stringify(businessCaseData, null, 2));
            await updateBusinessCase(businessCaseId, businessCaseData);
            console.log(`Obchodní případ s ID: ${businessCaseId} byl aktualizován.`);
          } catch (error) {
            console.error(`Chyba při aktualizaci obchodního případu s ID ${businessCaseId}:`, error.response ? error.response.data : error.message);
            continue;
          }
        }

        // Přiřazení securityLevel ID
        const strediskoName = territoryName || extractStrediskoName(jmenoOZKstzs);
        const securityLevelId = getSecurityLevelId(strediskoName, securityLevels);

        if (securityLevelId) {
          businessCaseData.securityLevel = securityLevelId;
          console.log(`Přiřazeno securityLevel ID: ${securityLevelId} pro středisko: ${strediskoName}`);
          
          try {
            if (!businessCase) {
              // Pokud jsme nově vytvořili business case
              businessCase = await createBusinessCase(businessCaseData);
              businessCaseId = businessCase.id;
              console.log(`Nový obchodní případ aktualizován s securityLevel ID: ${securityLevelId}`);
            } else {
              // Pokud jsme aktualizovali existující business case
              await updateBusinessCase(businessCaseId, businessCaseData);
              console.log(`Obchodní případ s ID: ${businessCaseId} aktualizován s securityLevel ID: ${securityLevelId}`);
            }
          } catch (error) {
            console.error(`Chyba při aktualizaci securityLevel pro obchodní případ ID ${businessCaseId}:`, error.response ? error.response.data : error.message);
          }
        } else {
          console.warn(`SecurityLevel ID nebylo nalezeno pro středisko: ${strediskoName}`);
        }

        // Vymažeme všechny položky z obchodního případu (abychom je znovu přidali)
        try {
          console.log(`Načítám položky obchodního případu ${businessCaseId} pro smazání.`);
          const response = await raynetApi.get(`/businessCase/${businessCaseId}/`);
          const businessCaseDataResponse = response.data.data;

          if (businessCaseDataResponse && businessCaseDataResponse.items) {
            const items = businessCaseDataResponse.items;
            console.log(`Nalezeno ${items.length} položek:`, items);

            if (items.length > 0) {
              for (const item of items) {
                console.log(`Mažu položku s ID ${item.id} z obchodního případu ${businessCaseId}`);
                try {
                  await raynetApi.delete(`/businessCase/${businessCaseId}/item/${item.id}/`);
                  console.log(`Položka s ID ${item.id} byla smazána.`);
                } catch (deleteError) {
                  console.error(`Chyba při mazání položky s ID ${item.id}:`, deleteError.response ? deleteError.response.data : deleteError.message);
                  console.warn(`Pokračuji i přes chybu při mazání položky s ID ${item.id}.`);
                }
              }
              console.log(`Všechny položky z obchodního případu ${businessCaseId} byly odstraněny nebo zpracovány.`);
            } else {
              console.log(`Obchodní případ ${businessCaseId} neobsahuje žádné položky k odstranění.`);
            }
          } else {
            console.log(`Odpověď z API neobsahuje položky pro obchodní případ ${businessCaseId}.`);
          }
        } catch (error) {
          console.error(`Chyba při načítání nebo mazání položek z obchodního případu ${businessCaseId}:`, error.response ? error.response.data : error.message);
        }

        // Načteme produkty pro daný SalesId (včetně sloupce Datum!)
        console.log(`Načítám produkty pro SalesId: ${salesId}`);
        const productQuery = `
          SELECT 
            C_polozky AS productCode,
            Nazev1 AS name,
            Mnozstvi AS count,
            ROUND(Soucet_z_pc_na_ks, 0) AS price,
            CASE WHEN Nakupni_vyrobni_cena IS NULL OR Mnozstvi = 0 THEN 0 ELSE ROUND(Nakupni_vyrobni_cena / Mnozstvi, 0) END AS cost,
            Datum
          FROM AX_PPR
          WHERE PP = ?;
        `;
        console.log('SQL dotaz pro načtení produktů:', productQuery);
        const productRows = await connection.query(productQuery, [salesId]);

        console.log(`Načteno ${productRows.length} produktů pro SalesId ${salesId}:`, productRows);

        if (!productRows || productRows.length === 0) {
          console.warn(`Žádné produkty nalezeny pro SalesId ${salesId}. Přeskakuji tento obchodní případ.`);
          continue;
        }

        //
        // Převedeme Datum (první řádek) na ISO a nastavíme do businessCaseData validFrom a validTill
        //
        const dateString = productRows[0].Datum; // např. "14.8.2019"
        const isoDate = parseCzechDate(dateString); // např. "2019-08-14"
        if (isoDate) {
          businessCaseData.validFrom = isoDate;
          businessCaseData.validTill = isoDate;
          console.log(`validFrom a validTill budou nastaveny na: ${isoDate}`);
        }

        // Vytvoříme/aktualizujeme business case, aby se validFrom/validTill props projevily
        try {
          if (!businessCase) {
            // Obchodní případ ještě neexistoval
            console.log('Vytvářím obchodní případ znovu, kvůli validFrom/validTill...');
            businessCase = await createBusinessCase(businessCaseData);
            businessCaseId = businessCase.id;
            console.log(`Nový obchodní případ s nastaveným validFrom/validTill: ${businessCaseId}`);
          } else {
            // Pouze ho aktualizujeme
            console.log('Aktualizuji existující businessCase kvůli validFrom/validTill...');
            await updateBusinessCase(businessCaseId, businessCaseData);
            console.log(`Obchodní případ s ID ${businessCaseId} byl aktualizován (validFrom/validTill).`);
          }
        } catch (error) {
          console.error(`Chyba při nastavování validFrom/validTill pro obchodní případ ${businessCaseId}:`, error.response ? error.response.data : error.message);
        }

        //
        // Připravíme pole products
        //
        const products = productRows.map(product => ({
          productCode: product.productCode,
          count: parseFloat(product.count) || 0,
          name: product.name && product.name.trim() !== '' ? product.name : 'Bez názvu',
          description: product.name && product.name.trim() !== '' ? product.name : 'Bez popisu',
          price: parseFloat(product.price) || 0,
          taxRate: 21,
          discountPercent: 0,
          cost: parseFloat(product.cost) || 0
        }));

        // Nejdříve zajistíme, aby produkt v Raynet CRM existoval nebo byl aktualizován
        for (const product of products) {
          console.log(`Zajišťuji produkt v Raynet CRM: ${product.productCode}`);
          try {
            const raynetProduct = await ensureProductExistsOrCreateOrUpdate(product);
            console.log(`Produkt ${product.productCode} existuje v Raynet CRM, přidávám ho do obchodního případu ${businessCaseId}...`);

            // Přidání produktu do obchodního případu
            await addItemToBusinessCaseRaynet(businessCaseId, product);
            console.log(`Produkt ${product.productCode} byl úspěšně přidán do obchodního případu ${businessCaseId}.`);
          } catch (error) {
            console.error(`Chyba při zajišťování nebo přidávání produktu ${product.productCode}:`, error.message);
          }
        }

        console.log(`Produkty pro SalesId ${salesId} byly úspěšně přidány do obchodního případu ID ${businessCaseId}.`);

      } catch (error) {
        console.error(`Chyba při zpracování SalesId ${salesId}:`, error.response ? error.response.data : error.message);
        continue; // Přeskočíme na další SalesId
      }
    }

    console.log('=== Aktualizace obchodních případů dokončena ===');
    res.status(200).json({
      success: true,
      message: 'Obchodní případy byly úspěšně aktualizovány.',
    });
  } catch (error) {
    console.error('Chyba při aktualizaci obchodních případů:', error.message);
    res.status(500).json({
      success: false,
      message: 'Chyba při aktualizaci obchodních případů.',
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});













// Upravený endpoint pro export adres do Raynet CRM
app.get('/raynet-addresses', async (req, res) => {
  let mysqlConnection;
  try {
    const regNumber = req.query.regNumber || req.query.regNum;

    console.log('Received regNumber:', regNumber);

    if (!regNumber) {
      return res.status(400).json({ error: 'Parametr regNumber je povinný.' });
    }

    // Připojení k MSSQL
    await sql.connect(mssqlConfig);
    const mssqlRequest = new sql.Request();

    // Parametrizovaný SQL dotaz pro MSSQL
    const mssqlQuery = `
      SELECT
        [CustName] AS billingName,
        [CustStreet] AS billingStreet,
        [CustCity] AS billingCity,
        [CustZipCode] AS billingZipCode,
        [CustCountryRegionId] AS billingCountry,
        [RegNum] AS regNumber,
        [DeliveryName] AS deliveryName,
        [DeliveryStreet] AS deliveryStreet,
        [DeliveryCity] AS deliveryCity,
        [DeliveryZipCode] AS deliveryZipCode,
        [DeliveryCountryRegionId] AS deliveryCountry,
        [SalesId],
        [PurchOrderFormNum],
        [SalesStatusText],
        [ShippingDateRequested],
        [ReceiptDateRequested]
      FROM [AxProdCS].[dbo].[ItsIFSalesTable]
      WHERE [SalesStatusText] IS NOT NULL
        AND [SalesStatusText] != ''
        AND [RegNum] = @regNumber
    `;

    mssqlRequest.input('regNumber', sql.VarChar, regNumber);
    const mssqlResult = await mssqlRequest.query(mssqlQuery);
    console.log('MSSQL Query Result:', mssqlResult.recordset);

    if (mssqlResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Žádná data nalezena pro zadané regNumber.' });
    }

    // Připojení k MySQL
    mysqlConnection = await poolC5tpms.getConnection();
    // Promisify the connection's query method
    mysqlConnection.query = util.promisify(mysqlConnection.query);

    const mysqlQuery = `
      SELECT ICO, Jmeno_OZ_Kstzs
      FROM AX_PPR
      WHERE ICO = ?
      LIMIT 1
    `;

    // Mapování dat s MySQL
    const addressMap = {};

    for (const record of mssqlResult.recordset) {
      const billingKey = `${record.regNumber}`;

      if (!addressMap[billingKey]) {
        addressMap[billingKey] = {
          billingAddress: {
            name: record.billingName,
            street: record.billingStreet,
            city: record.billingCity,
            zipCode: record.billingZipCode,
            country: record.billingCountry,
            regNumber: record.regNumber
          },
          deliveryAddresses: {},
          salesRecords: [],
          jmenoOZKstzs: null,
          territoryName: null
        };
      }

      // Logování hodnoty record.regNumber
      console.log(`Hodnota record.regNumber: "${record.regNumber}" s délkou ${record.regNumber.length}`);
      console.log(`Typ record.regNumber: ${typeof record.regNumber}`);

      // Ujisti se, že je to řetězec a odstraníš bílé znaky
      const regNumberForQuery = record.regNumber.trim();

      // Logování před dotazem
      console.log('Spouštím MySQL dotaz:', mysqlQuery);
      console.log('S parametrem:', regNumberForQuery);

      try {
        const mysqlRows = await mysqlConnection.query(mysqlQuery, [regNumberForQuery]);

        console.log('Výsledky MySQL dotazu:', mysqlRows);

        if (mysqlRows.length > 0) {
          const mysqlRecord = mysqlRows[0];
          addressMap[billingKey].jmenoOZKstzs = mysqlRecord.Jmeno_OZ_Kstzs;
          addressMap[billingKey].territoryName = extractStrediskoName(mysqlRecord.Jmeno_OZ_Kstzs);
        } else {
          console.warn(`Žádný záznam v AX_PPR pro ICO: ${regNumberForQuery}`);
        }
      } catch (mysqlError) {
        console.error(`Chyba při dotazu do MySQL pro ICO ${regNumberForQuery}:`, mysqlError.message);
        // Pokračujeme bez těchto dat
      }

      // Zpracování deliveryAddresses a salesRecords
      const deliveryKey = `${record.deliveryName}|${record.deliveryStreet}|${record.deliveryCity}|${record.deliveryZipCode}|${record.deliveryCountry}`;
      if (record.deliveryName) {
        if (!addressMap[billingKey].deliveryAddresses[deliveryKey]) {
          addressMap[billingKey].deliveryAddresses[deliveryKey] = {
            name: record.deliveryName,
            street: record.deliveryStreet,
            city: record.deliveryCity,
            zipCode: record.deliveryZipCode,
            country: record.deliveryCountry,
            salesIds: []
          };
        }
        addressMap[billingKey].deliveryAddresses[deliveryKey].salesIds.push(record.SalesId);
      }

      addressMap[billingKey].salesRecords.push({
        salesId: record.SalesId,
        purchaseOrderNumber: record.PurchOrderFormNum,
        status: record.SalesStatusText,
        shippingDateRequested: record.ShippingDateRequested,
        receiptDateRequested: record.ReceiptDateRequested
      });
    }

    const addresses = Object.values(addressMap).map(address => {
      return {
        billingAddress: address.billingAddress,
        deliveryAddresses: Object.values(address.deliveryAddresses),
        salesRecords: address.salesRecords,
        jmenoOZKstzs: address.jmenoOZKstzs,
        territoryName: address.territoryName
      };
    });

    console.log('Addresses after merging with MySQL data:', addresses);

    const processedAddresses = [];
    const failedAddresses = [];

    for (const address of addresses) {
      try {
        // Získání teritoria pomocí territoryName, pokud existuje
        let territoryId = null;
        if (address.territoryName) {
          territoryId = await getTerritoryIdByName(address.territoryName);
        }

        // Kontrola, zda již společnost existuje v Raynet CRM podle IČO
        const existingCompany = await findCompanyByRegNumber(address.billingAddress.regNumber);

        if (existingCompany) {
          // Získáme detail společnosti pro získání ID primární adresy
          const companyDetail = await getCompanyDetail(existingCompany.id);
          const primaryAddress = companyDetail.addresses.find(addr => addr.primary);

          if (!primaryAddress) {
            console.error(`Primární adresa nebyla nalezena pro společnost s ID ${existingCompany.id}`);
            continue; // Nebo můžeš rozhodnout, jak tuto situaci řešit
          }

          const primaryAddressId = primaryAddress.id;

          // Připravíme data pro aktualizaci adresy
          const addressData = {
            address: {
              name: primaryAddress.address.name || 'Sídlo klienta',
              street: primaryAddress.address.street || address.billingAddress.street,
              city: primaryAddress.address.city || address.billingAddress.city,
              zipCode: primaryAddress.address.zipCode || address.billingAddress.zipCode,
              country: primaryAddress.address.country || address.billingAddress.country
              // Můžeš přidat další údaje adresy, pokud je potřeba
            },
            territory: territoryId
            // Můžeš přidat také `contactInfo`, pokud je potřeba
          };

          console.log(`Aktualizuji adresu s ID ${primaryAddressId} u společnosti s ID ${existingCompany.id} s daty:`, JSON.stringify(addressData, null, 2));

          await updateCompanyAddressRaynet(existingCompany.id, primaryAddressId, addressData);
        } else {
          // Vytvoříme novou společnost
          const companyData = {
            name: address.billingAddress.name,
            regNumber: address.billingAddress.regNumber,
            state: 'B_ACTUAL',
            rating: 'A',
            role: 'A_SUBSCRIBER',
            addresses: [
              {
                address: {
                  name: 'Sídlo klienta',
                  street: address.billingAddress.street,
                  city: address.billingAddress.city,
                  zipCode: address.billingAddress.zipCode,
                  country: address.billingAddress.country
                },
                territory: territoryId
              }
            ],
          };

          console.log('Vytvářím novou společnost s daty:', JSON.stringify(companyData, null, 2));

          await createCompanyRaynet(companyData);
        }

        processedAddresses.push({ companyName: address.billingAddress.name, status: 'success' });
      } catch (addressError) {
        console.error(`Chyba při zpracování adresy pro společnost ${address.billingAddress.name}:`, addressError.response ? addressError.response.data : addressError.message);
        failedAddresses.push({ companyName: address.billingAddress.name, error: addressError.message });
      }
    }

    res.status(200).json({
      success: failedAddresses.length === 0,
      processedAddresses,
      failedAddresses,
    });
  } catch (error) {
    console.error('Chyba při získávání adres ze systému Raynet CRM:', error);
    res.status(500).json({ error: 'Chyba při získávání adres ze systému Raynet CRM.' });
  } finally {
    if (mysqlConnection) {
      mysqlConnection.release();
    }
    sql.close(); // Zavření MSSQL připojení
  }
});



async function findCompanyByRegNumber(regNumber) {
  try {
    const response = await raynetApi.get('company/', {
      params: {
        limit: 1000,
        regNumber: regNumber,
      },
    });
    const companies = response.data.data;
    return companies.length > 0 ? companies[0] : null;
  } catch (error) {
    console.error(`Chyba při hledání společnosti s IČ ${regNumber}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}






// Endpoint pro export adres do Raynet CRM (GET metoda)
app.get('/raynet-address-export', async (req, res) => {
  try {
    // Předdefinované adresy, které budou exportovány
    const addresses = [
      {
        companyId: "12345",
        addressLine1: "123 Hlavní ulice",
        city: "Brno",
        postalCode: "60200",
        country: "CZ"
      },
      {
        companyId: "67890",
        addressLine1: "456 Vedlejší ulice",
        city: "Praha",
        postalCode: "10000",
        country: "CZ"
      }
    ];

    const exportedAddresses = [];
    const failedAddresses = [];

    for (const address of addresses) {
      try {
        // Zkontrolujeme, zda adresa již existuje podle identifikátoru nebo jiného unikátního atributu
        const existingCompany = await findCompanyById(address.companyId);

        if (existingCompany) {
          // Aktualizujeme existující adresu
          const updatedAddress = await updateCompanyAddressRaynet(existingCompany.id, address);
          exportedAddresses.push(updatedAddress.data);
        } else {
          // Vytvoříme novou adresu
          const newCompany = await createCompanyRaynet(address);
          exportedAddresses.push(newCompany.data);
        }
      } catch (addressError) {
        console.error(`Chyba při zpracování adresy pro společnost ${address.companyId}:`, addressError);
        failedAddresses.push({ companyId: address.companyId, error: addressError.message });
      }
    }

    res.status(200).json({
      success: failedAddresses.length === 0,
      exportedAddresses,
      failedAddresses,
    });
  } catch (error) {
    console.error('Chyba při exportu adres do Raynet CRM:', error);
    res.status(500).json({ error: 'Chyba při exportu adres do Raynet CRM.' });
  }
});

// Pomocné funkce pro práci s Raynet API

async function findCompanyById(companyId) {
  try {
    const response = await raynetApi.get(`company/${companyId}/`);
    return response.data.data;
  } catch (error) {
    console.error(`Chyba při hledání společnosti s ID ${companyId}:`, error);
    throw error;
  }
}






// Endpoint pro získání seznamu pneumatik pro dané RZ
app.get('/tyre_list_by_rz/:rz', (req, res) => {
  const { rz } = req.params;
  const sql = `
    SELECT tl.*
    FROM tyre_list tl
    JOIN vehicle_data vd ON vd.idCar = tl.IdCar
    WHERE vd.RZ = ?
  `;
  poolC5tpms.query(sql, [rz], (err, results) => {
    if (err) {
      console.error('Chyba při získávání seznamu pneumatik:', err);
      return res.status(500).send('Chyba serveru');
    }
    res.json(results);
  });
});

// Endpoint pro získání všech měření pneumatik podle registrační značky

app.get('/tyre_info/all/:RZ', async (req, res) => {
  const { RZ } = req.params;

  if (!RZ) {
    return res.status(400).json({ message: 'Registrační značka nebyla poskytnuta.' });
  }

  let connection;
  try {
    connection = await new Promise((resolve, reject) => {
      poolC5tpms.getConnection((err, conn) => {
        if (err) {
          console.error('Chyba při získání připojení k databázi:', err);
          return reject(err);
        } else {
          resolve(conn);
        }
      });
    });

    const query = `
      SELECT
        tmd.detail_id,
        tmd.measurement_id,
        tmd.tyre_position,
        tmd.tyre_id,
        tmd.outer_tread_depth,
        tmd.center_tread_depth,
        tmd.inner_tread_depth,
        tmd.tyre_rotated,
        tmd.measured_pressure,
        tmd.tpms_pressure,
        tmd.datum,
        tm.vehicle_id,
        tm.technician_id,
        tm.measurement_date,
        tm.location_id,
        tm.odometer_reading,
        td.TyreName,
        td.idealPressure,
        td.RZ,
        td.TyrePrice,
        td.TyreMin,
        tl.Id AS tyre_list_Id,
        tl.PartNo,
        tl.TyreName AS tyre_list_TyreName,
        tl.TyreNo,
        tl.Mounted,
        tl.Demounted,
        tl.Mileage,
        tl.MileageDate,
        tl.Rotated,
        tl.TyrePrice AS tyre_list_TyrePrice,
        tl.Position AS tyre_list_Position,
        tl.IdCar AS tyre_list_IdCar,
        tl.TyreMin AS tyre_list_TyreMin,
        tl.TyreMax AS tyre_list_TyreMax,
        tl.MountedAtOdom AS tyre_list_MountedAtOdom,
        tl.DemountedAtOdom AS tyre_list_DemountedAtOdom,
        tl.DemountedAtDeep
      FROM
        tyre_measurement_details tmd
      LEFT JOIN
        tyre_measurements tm
      ON
        tmd.measurement_id = tm.measurement_id
      LEFT JOIN
        tyre_data td
      ON
        tm.vehicle_id = td.idCar AND tmd.tyre_position = td.position
      LEFT JOIN
        tyre_list tl
      ON
        td.idCar = tl.IdCar AND td.position = tl.Position
      WHERE
        td.RZ = ?
      ORDER BY
        tmd.measurement_id, tmd.tyre_position;
    `;

    const rows = await new Promise((resolve, reject) => {
      connection.query(query, [RZ], (err, results) => {
        if (err) {
          console.error('Chyba při vykonání SQL dotazu:', err);
          return reject(err);
        }
        resolve(results);
      });
    });

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Žádné informace nebyly nalezeny.' });
    }

    // Zpracování měření a správné přiřazení pneumatik na základě dat a časů montáže/demontáže
    const measurements = {};

    rows.forEach(row => {
      const measurement_id = row.measurement_id;

      if (!measurements[measurement_id]) {
        measurements[measurement_id] = {
          measurement_id: measurement_id,
          vehicle_id: row.vehicle_id,
          technician_id: row.technician_id,
          measurement_date: row.measurement_date,
          location_id: row.location_id,
          odometer_reading: row.odometer_reading,
          tyres: []
        };
      }

      // Převod dat na objekty Date pro porovnání včetně času
      const measurementDateTime = new Date(row.measurement_date);
      const mountedDateTime = row.Mounted ? new Date(row.Mounted) : new Date('1970-01-01');
      const demountedDateTime = row.Demounted ? new Date(row.Demounted) : new Date('9999-12-31');

      // Kontrola, zda datum měření spadá mezi montáž a demontáž pneumatiky
      if (measurementDateTime >= mountedDateTime && measurementDateTime <= demountedDateTime) {
        measurements[measurement_id].tyres.push({
          detail_id: row.detail_id,
          tyre_position: row.tyre_position,
          tyre_id: row.tyre_id,
          outer_tread_depth: row.outer_tread_depth,
          center_tread_depth: row.center_tread_depth,
          inner_tread_depth: row.inner_tread_depth,
          tyre_rotated: row.tyre_rotated,
          measured_pressure: row.measured_pressure,
          tpms_pressure: row.tpms_pressure,
          datum: row.datum,
          tyre_data: {
            TyreName: row.TyreName,
            idealPressure: row.idealPressure,
            RZ: row.RZ,
            TyrePrice: row.TyrePrice,
            TyreMin: row.TyreMin
          },
          tyre_list: {
            Id: row.tyre_list_Id,
            PartNo: row.PartNo,
            TyreName: row.tyre_list_TyreName,
            TyreNo: row.TyreNo,
            Mounted: row.Mounted,
            Demounted: row.Demounted,
            Mileage: row.Mileage,
            MileageDate: row.MileageDate,
            Rotated: row.Rotated,
            TyrePrice: row.tyre_list_TyrePrice,
            Position: row.tyre_list_Position,
            IdCar: row.tyre_list_IdCar,
            TyreMin: row.tyre_list_TyreMin,
            TyreMax: row.tyre_list_TyreMax,
            MountedAtOdom: row.tyre_list_MountedAtOdom,
            DemountedAtOdom: row.tyre_list_DemountedAtOdom,
            DemountedAtDeep: row.DemountedAtDeep // Přidáno pro případné další využití
          }
        });
      }
    });

    // Převod objektu measurements na pole
    const enrichedMeasurements = Object.values(measurements);

    res.status(200).json(enrichedMeasurements);
  } catch (error) {
    console.error('Chyba při získávání informací o pneumatikách:', error);
    res.status(500).json({ message: 'Vnitřní chyba serveru při načítání dat.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// Endpoint pro získání informací o pneumatikách podle registrační značky
app.get('/tyre_info/:RZ', async (req, res) => {
  const { RZ } = req.params;

  if (!RZ) {
    return res.status(400).json({ message: 'Registrační značka nebyla poskytnuta.' });
  }

  let connection;
  try {
    connection = await new Promise((resolve, reject) => {
      poolC5tpms.getConnection((err, conn) => {
        if (err) {
          console.error('Chyba při získání připojení k databázi:', err);
          return reject(err);
        } else {
          resolve(conn);
        }
      });
    });

    const query = `
      SELECT
        tmd.detail_id,
        tmd.measurement_id,
        tmd.tyre_position,
        tmd.tyre_id,
        tmd.outer_tread_depth,
        tmd.center_tread_depth,
        tmd.inner_tread_depth,
        tmd.tyre_rotated,
        tmd.measured_pressure,
        tmd.tpms_pressure,
        tmd.datum,
        tm.vehicle_id,
        tm.technician_id,
        tm.measurement_date,
        tm.location_id,
        tm.odometer_reading,
        td.TyreName,
        td.idealPressure,
        td.RZ,
        td.TyrePrice,
        td.TyreMin,
        tl.Id AS tyre_list_Id,
        tl.PartNo,
        tl.TyreName AS tyre_list_TyreName,
        tl.TyreNo,
        tl.Mounted,
        tl.Demounted,
        tl.Mileage,
        tl.MileageDate,
        tl.Rotated,
        tl.TyrePrice AS tyre_list_TyrePrice,
        tl.Position AS tyre_list_Position,
        tl.IdCar AS tyre_list_IdCar,
        tl.TyreMin AS tyre_list_TyreMin,
        tl.TyreMax AS tyre_list_TyreMax,
        tl.MountedAtOdom AS tyre_list_MountedAtOdom,
        tl.DemountedAtOdom AS tyre_list_DemountedAtOdom
      FROM
        tyre_measurement_details tmd
      LEFT JOIN
        tyre_measurements tm
      ON
        tmd.measurement_id = tm.measurement_id
      LEFT JOIN
        tyre_data td
      ON
        tm.vehicle_id = td.idCar AND tmd.tyre_position = td.position
      LEFT JOIN
        tyre_list tl
      ON
        td.TyreNO = tl.TyreNo
      WHERE
        td.RZ = ?
        AND tm.measurement_date = (
          SELECT MAX(tm2.measurement_date)
          FROM tyre_measurement_details tmd2
          LEFT JOIN tyre_measurements tm2 ON tmd2.measurement_id = tm2.measurement_id
          WHERE tmd2.tyre_position = tmd.tyre_position AND td.RZ = ?
        )
      ORDER BY
        tmd.tyre_position;
    `;

    const rows = await new Promise((resolve, reject) => {
      connection.query(query, [RZ, RZ], (err, results) => {
        if (err) {
          console.error('Chyba při vykonání SQL dotazu:', err);
          return reject(err);
        }
        resolve(results);
      });
    });

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Žádné informace nebyly nalezeny.' });
    }

    res.status(200).json(rows);
  } catch (error) {
    console.error('Chyba při získávání informací o pneumatikách:', error);
    res.status(500).json({ message: 'Vnitřní chyba serveru při načítání dat.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});
// Endpoint pro získání informací o vozidle, společnosti a parkování
app.get('/vehicle_info/:RZ', async (req, res) => {
  const { RZ } = req.params;

  if (!RZ) {
    return res.status(400).json({ message: 'Registrační značka nebyla poskytnuta.' });
  }

  let connection;
  try {
    connection = await new Promise((resolve, reject) => {
      poolC5tpms.getConnection((err, conn) => {
        if (err) {
          console.error('Chyba při získání připojení k databázi:', err);
          return reject(err);
        } else {
          resolve(conn);
        }
      });
    });

    const query = `
      SELECT v.*, c.*, p.*
      FROM c5tpms.vehicle_data v
      LEFT JOIN c5tpms.company_data c ON v.companyId = c.companyId
      LEFT JOIN c5tpms.parking_data p ON c.companyId = p.companyId
      WHERE v.RZ = ?
    `;

    const rows = await new Promise((resolve, reject) => {
      connection.query(query, [RZ], (err, results) => {
        if (err) {
          console.error('Chyba při vykonání SQL dotazu:', err);
          return reject(err);
        }
        resolve(results);
      });
    });

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Žádné informace nebyly nalezeny.' });
    }

    const vehicleData = rows[0];

    const vehicle = {
      RZ: vehicleData.RZ,
      model: vehicleData.model || null,
      year: vehicleData.year || null,

      // Přidej další pole vozidla podle potřeby
    };

    const company = {
      companyName: vehicleData.companyName || null,
      companyAddress: vehicleData.companyAddress || null,
      companyPSC: vehicleData.companyPSC || null,
      // Přidej další pole společnosti podle potřeby
    };

    const parking = {
      parkingLocation: vehicleData.parkingLocation || null,
      parkingPosition: vehicleData.parkingPosition || null,
      parkingAddress: vehicleData.parkingAddress || null,
      contactPerson: vehicleData.contactPerson || null,
      contactPhone: vehicleData.contactPhone || null,
      // Přidej další pole parkování podle potřeby
    };

    res.status(200).json({ vehicle, company, parking });
  } catch (error) {
    console.error('Chyba při získávání informací o vozidle:', error);
    res.status(500).json({ message: 'Vnitřní chyba serveru při načítání dat.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});
// Získání názvu pneu dle PartNo
app.get('/getProductByPartNo', (req, res) => {
  const { PartNo } = req.query;

  console.log(`Received request for PartNo: ${PartNo}`);

  if (!PartNo) {
    console.log('No PartNo provided');
    return res.status(400).json({ error: 'PartNo is required' });
  }

  const query = 'SELECT DisplayName FROM IMPORT_CZS_ProduktyB2B WHERE PartNo = ?';

  poolC5pneutyres.query(query, [PartNo], (err, result) => {
    if (err) {
      console.error('Error fetching product:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Zkontrolujeme, zda jsme obdrželi nějaké výsledky
    if (result.length === 0) {
      console.log('Product not found');
      return res.status(404).json({ error: 'Product not found' });
    }

    const displayName = result[0].DisplayName;

    // Pokud displayName není definován, vrátíme chybu
    if (!displayName) {
      console.error('displayName is undefined in the result row.');
      return res.status(500).json({ error: 'Internal server error' });
    }

    console.log(`Found displayName: ${displayName}`);
    res.json({ displayName });
  });
});









// Endpoint pro získání posledního měření pro dané vozidlo
app.get('/tyre-measurements/last/:vehicle_id', async (req, res) => {
  const { vehicle_id } = req.params;

  try {
    // Získání posledního měření
    const [measurementRows] = await poolC5tpms.query(
      `SELECT * FROM measurement_data WHERE tyreId = ? ORDER BY datum DESC LIMIT 1`,
      [vehicle_id]
    );

    if (measurementRows.length === 0) {
      return res.status(404).json({ message: 'Žádná měření nebyla nalezena.' });
    }

    const measurement = measurementRows[0];

    // Získání detailů měření
    const [detailRows] = await poolC5tpms.query(
      `SELECT * FROM tyre_measurement_details WHERE measurement_id = ?`,
      [measurement.measurementId]
    );

    res.status(200).json({ measurement, details: detailRows });
  } catch (error) {
    console.error('Chyba při získávání posledního měření:', error);
    res.status(500).json({ message: 'Chyba při získávání posledního měření.' });
  }
});

// Endpoint pro porovnání s předchozím měřením
app.get('/tyre-measurements/compare/:tyre_id', async (req, res) => {
  const { tyre_id } = req.params;

  try {
    // Získání dvou nejnovějších měření pro danou pneumatiku
    const [rows] = await poolC5tpms.query(
      `SELECT tmd.*, md.datum
       FROM tyre_measurement_details tmd
       JOIN measurement_data md ON tmd.measurement_id = md.measurementId
       WHERE tmd.tyre_id = ?
       ORDER BY md.datum DESC
       LIMIT 2`,
      [tyre_id]
    );

    if (rows.length < 2) {
      return res.status(404).json({ message: 'Není dostatek dat pro porovnání.' });
    }

    const currentMeasurement = rows[0];
    const previousMeasurement = rows[1];

    // Výpočet rozdílů v hloubkách dezénu
    const outerWear = previousMeasurement.outer_tread_depth - currentMeasurement.outer_tread_depth;
    const centerWear = previousMeasurement.center_tread_depth - currentMeasurement.center_tread_depth;
    const innerWear = previousMeasurement.inner_tread_depth - currentMeasurement.inner_tread_depth;

    res.status(200).json({
      currentMeasurement,
      previousMeasurement,
      differences: {
        outerWear,
        centerWear,
        innerWear
      }
    });
  } catch (error) {
    console.error('Chyba při porovnávání měření:', error);
    res.status(500).json({ message: 'Chyba při porovnávání měření.' });
  }
});

// Endpoint pro porovnání s předchozím měřením
app.get('/tyre-measurements/compare/:tyre_id', async (req, res) => {
  const { tyre_id } = req.params;

  try {
    // Získání dvou nejnovějších měření pro danou pneumatiku
    const [rows] = await poolC5tpms.query(
      `SELECT tmd.*, md.datum
       FROM tyre_measurement_details tmd
       JOIN measurement_data md ON tmd.measurement_id = md.measurementId
       WHERE tmd.tyre_id = ?
       ORDER BY md.datum DESC
       LIMIT 2`,
      [tyre_id]
    );

    if (rows.length < 2) {
      return res.status(404).json({ message: 'Není dostatek dat pro porovnání.' });
    }

    const currentMeasurement = rows[0];
    const previousMeasurement = rows[1];

    // Výpočet rozdílů v hloubkách dezénu
    const outerWear = previousMeasurement.outer_tread_depth - currentMeasurement.outer_tread_depth;
    const centerWear = previousMeasurement.center_tread_depth - currentMeasurement.center_tread_depth;
    const innerWear = previousMeasurement.inner_tread_depth - currentMeasurement.inner_tread_depth;

    res.status(200).json({
      currentMeasurement,
      previousMeasurement,
      differences: {
        outerWear,
        centerWear,
        innerWear
      }
    });
  } catch (error) {
    console.error('Chyba při porovnávání měření:', error);
    res.status(500).json({ message: 'Chyba při porovnávání měření.' });
  }
});

// Endpoint pro získání detailů měření
app.get('/tyre-measurements/:measurement_id', async (req, res) => {
  const { measurement_id } = req.params;

  try {
    // Získání hlavního záznamu měření
    const [measurementRows] = await poolC5tpms.query(
      `SELECT * FROM tyre_measurements WHERE measurement_id = ?`,
      [measurement_id]
    );

    if (measurementRows.length === 0) {
      return res.status(404).json({ message: 'Měření nebylo nalezeno.' });
    }

    const measurement = measurementRows[0];

    // Získání detailů měření
    const [detailRows] = await poolC5tpms.query(
      `SELECT * FROM tyre_measurement_details WHERE measurement_id = ?`,
      [measurement_id]
    );

    res.status(200).json({ measurement, details: detailRows });
  } catch (error) {
    console.error('Chyba při získávání měření:', error);
    res.status(500).json({ message: 'Chyba při získávání měření.' });
  }
});

// Endpoint pro vytvoření nového měření
app.post('/tyre-measurements', async (req, res) => {
  const { vehicle_id, technician_id, measurement_date, location_id, odometer_reading, measurements } = req.body;

  const connection = await poolC5tpms.getConnection();

  try {
    await connection.beginTransaction();

    // Vložení záznamu do tabulky tyre_measurements
    const [measurementResult] = await connection.query(
      `INSERT INTO tyre_measurements (vehicle_id, technician_id, measurement_date, location_id, odometer_reading)
       VALUES (?, ?, ?, ?, ?)`,
      [vehicle_id, technician_id, measurement_date, location_id, odometer_reading]
    );

    const measurement_id = measurementResult.insertId;

    // Vložení detailů měření pro každou pneumatiku
    for (const detail of measurements) {
      const {
        tyre_position,
        tyre_id,
        outer_tread_depth,
        center_tread_depth,
        inner_tread_depth,
        tyre_rotated,
        measured_pressure,
        tpms_pressure
      } = detail;

      await connection.query(
        `INSERT INTO tyre_measurement_details (measurement_id, tyre_position, tyre_id, outer_tread_depth, center_tread_depth, inner_tread_depth, tyre_rotated, measured_pressure, tpms_pressure)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [measurement_id, tyre_position, tyre_id, outer_tread_depth, center_tread_depth, inner_tread_depth, tyre_rotated, measured_pressure, tpms_pressure]
      );
    }

    await connection.commit();
    res.status(201).json({ message: 'Měření bylo úspěšně uloženo.' });
  } catch (error) {
    await connection.rollback();
    console.error('Chyba při ukládání měření:', error);
    res.status(500).json({ message: 'Chyba při ukládání měření.' });
  } finally {
    connection.release();
  }
});


// Endpoint pro získání posledního data denního nájezdu pro dané RZ
app.get('/get-last-daily-distance-date/:rz', (req, res) => {
  const { rz } = req.params;
  const sql = 'SELECT MAX(date) as lastDate FROM daily_vehicle_distance WHERE rz = ?';
  poolC5tpms.query(sql, [rz], (err, results) => {
    if (err) {
      console.error('Chyba při získávání posledního data denního nájezdu:', err);
      return res.status(500).send('Chyba serveru');
    }
    const lastDate = results[0].lastDate;
    res.json({ lastDate });
  });
});

// Endpoint pro získání nejstaršího GPS data pro dané RZ
app.get('/get-earliest-gps-date/:rz', (req, res) => {
  const { rz } = req.params;
  const sql = `
    SELECT MIN(p.timestamp) as earliestTimestamp
    FROM parsed_gnss_data p
    JOIN vehicle_data v ON v.deviceId = p.device_id
    WHERE v.RZ = ?
  `;
  poolC5tpms.query(sql, [rz], (err, results) => {
    if (err) {
      console.error('Chyba při získávání nejstaršího GPS data:', err);
      return res.status(500).send('Chyba serveru');
    }
    const earliestTimestamp = results[0].earliestTimestamp;
    const earliestDate = earliestTimestamp ? new Date(parseInt(earliestTimestamp)).toISOString().split('T')[0] : null;
    res.json({ earliestDate });
  });
});

// Endpoint pro uložení denního nájezdu
app.post('/save-daily-distance', (req, res) => {
  const { rz, date, distance } = req.body;
  const sql = `
    INSERT INTO daily_vehicle_distance (rz, date, distance)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE distance = VALUES(distance)
  `;
  poolC5tpms.query(sql, [rz, date, distance], (err, results) => {
    if (err) {
      console.error('Chyba při ukládání denního nájezdu:', err);
      return res.status(500).send('Chyba serveru');
    }
    res.status(200).send('Denní nájezd uložen.');
  });
});

// odebrání položky z nákupních slev
app.delete('/delete-data-nakupni-slevy/:cenove_skupiny', (req, res) => {
  const cenove_skupiny = req.params.cenove_skupiny;

  const sql = `
    DELETE FROM IMPORT_CZS_Kalkulace_cen_nakupni_slevy 
    WHERE cenove_skupiny = ?;
  `;

  poolC5pneutyres.query(sql, [cenove_skupiny], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    if (results.affectedRows === 0) {
      return res.status(404).send('Item not found');
    }
    res.sendStatus(200);
  });
});
// získání dat z nákupních slev
app.get('/get-kalkulace-nakupni-slevy', (req, res) => {
  const filters = req.query;
  let sql = `
    SELECT *
    FROM IMPORT_CZS_Kalkulace_cen_nakupni_slevy
    WHERE 1=1
  `;

  const sqlValues = [];

  Object.keys(filters).forEach(filter => {
    sql += ` AND ${filter} LIKE ?`;
    sqlValues.push(`%${filters[filter]}%`);
  });

  poolC5pneutyres.query(sql, sqlValues, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});



/**
 * (D) Dynamický Endpoint: Získání enumerations pro custom fields
 *     GET /raynet/custom-fields-enum/product/:fieldName
 * - Zavolá https://app.raynet.cz/api/v2/customField/enum/product/<fieldName> a vrátí enumerace
 */
app.get('/raynet/custom-fields-enum/product/:fieldName', async (req, res) => {
  try {
    const { fieldName } = req.params;
    // Zavoláme Raynet
    const raynetResp = await raynetApi.get(`customField/enum/product/${fieldName}/`);
    // Vrátíme enumeraci
    res.json({
      success: true,
      fieldName,
      data: raynetResp.data.data // Předpokládáme, že enumerace bude v .data
    });
  } catch (error) {
    console.error(`Chyba při načítání enumerací pro pole ${req.params.fieldName}:`, error.response ? error.response.data : error.message);
    res.status(500).json({
      success: false,
      error: `Chyba při načítání enumerací pro pole ${req.params.fieldName}`
    });
  }
});




// aktualizace nákupních slev
app.put('/update-data-nakupni-slevy', (req, res) => {
  const newData = req.body;

  console.log('Received data:', JSON.stringify(newData, null, 2)); // Logování příchozích dat pro debugování

  const updatePromises = newData.map(item => {
    if (!item) {
      console.error('Received null or undefined item');
      return Promise.reject(new Error('Received null or undefined item'));
    }

    const {
      cenove_skupiny,
      jmeno = '',
      '1_eshop': eshop = '',
      '2_pult': pult = '',
      '3_servis': servis = '',
      '4_vo': vo = '',
      '5_vip': vip = '',
      '6_indiv': indiv = '',
      '7_dopravci': dopravci = '',
      B2B = '',
      EXT_eshop = '',
      isNew = false // Nastavení výchozí hodnoty pro isNew
    } = item;

    console.log('Processing item:', {
      cenove_skupiny,
      jmeno,
      eshop,
      pult,
      servis,
      vo,
      vip,
      indiv,
      dopravci,
      B2B,
      EXT_eshop,
      isNew
    });

    let sql;
    let values;

    if (isNew) {
      sql = `
        INSERT INTO IMPORT_CZS_Kalkulace_cen_nakupni_slevy 
        (cenove_skupiny, jmeno, 1_eshop, 2_pult, 3_servis, 4_vo, 5_vip, 6_indiv, 7_dopravci, datum_zapsani, B2B, EXT_eshop)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
        ON DUPLICATE KEY UPDATE
        jmeno = VALUES(jmeno),
        1_eshop = VALUES(1_eshop),
        2_pult = VALUES(2_pult),
        3_servis = VALUES(3_servis),
        4_vo = VALUES(4_vo),
        5_vip = VALUES(5_vip),
        6_indiv = VALUES(6_indiv),
        7_dopravci = VALUES(7_dopravci),
        datum_zapsani = NOW(),
        B2B = VALUES(B2B),
        EXT_eshop = VALUES(EXT_eshop);
      `;
      values = [cenove_skupiny, jmeno, eshop, pult, servis, vo, vip, indiv, dopravci, B2B, EXT_eshop];
    } else {
      sql = `
        UPDATE IMPORT_CZS_Kalkulace_cen_nakupni_slevy 
        SET 
          jmeno = ?,
          1_eshop = ?,
          2_pult = ?,
          3_servis = ?,
          4_vo = ?,
          5_vip = ?,
          6_indiv = ?,
          7_dopravci = ?,
          datum_zapsani = NOW(),
          B2B = ?,
          EXT_eshop = ?
        WHERE cenove_skupiny = ?;
      `;
      values = [jmeno, eshop, pult, servis, vo, vip, indiv, dopravci, B2B, EXT_eshop, cenove_skupiny];
    }

    console.log('Executing SQL:', sql);
    console.log('With values:', values);

    return new Promise((resolve, reject) => {
      poolC5pneutyres.query(sql, values, (error, results) => {
        if (error) {
          console.error('Error executing SQL:', error);
          reject(error);
        } else {
          console.log('SQL query executed successfully:', results);
          resolve(results);
        }
      });
    });
  });

  Promise.all(updatePromises)
    .then(results => {
      console.log('All data successfully updated:', results);
      res.sendStatus(200);
    })
    .catch(error => {
      console.error('Failed to update data:', error);
      res.status(500).send('Internal server error');
    });
});




// Aktualizace aktivních ceníků
app.post('/update-price-list-activation', async (req, res) => {
  try {
    const currentDate = new Date().toISOString().split('T')[0]; // Aktuální datum ve formátu 'YYYY-MM-DD'

    const query = `
      UPDATE Analytic_FilterTemplates
      SET isActive = CASE
        WHEN (validFrom IS NULL OR validFrom <= ?) AND (validTo IS NULL OR validTo >= ?) THEN 1
        ELSE 0
      END
    `;

    await db.query(query, [currentDate, currentDate]);

    res.json({ message: 'Aktivace ceníků byla aktualizována.' });
  } catch (error) {
    console.error('Chyba při aktualizaci aktivace ceníků:', error);
    res.status(500).json({ error: 'Chyba při aktualizaci aktivace ceníků.' });
  }
});

//RayNet - Endpoint pro získání produktových linií
app.get('/raynet/product-lines', async (req, res) => {
  try {
    const productLines = await fetchProductLinesRaynet();
    res.json(productLines);
  } catch (error) {
    res.status(500).json({ error: 'Chyba při načítání produktových linií z Raynet CRM' });
  }
});

// Funkce pro získání produktových linií z RayNet
async function fetchProductLinesRaynet() {
  try {
    const response = await raynetApi.get('productLine/');
    return response.data;
  } catch (error) {
    console.error('Chyba při načítání produktových linií z Raynet CRM:', error.response ? error.response.data : error.message);
    throw error;
  }
}
// RayNet - Endpoint pro získání konfigurace custom fields
app.get('/raynet/custom-fields-config', async (req, res) => {
  try {
    const customFieldsConfig = await fetchCustomFieldsRaynet();
    res.json(customFieldsConfig);
  } catch (error) {
    res.status(500).json({ error: 'Chyba při načítání custom fields z Raynet CRM' });
  }
});

// Funkce pro získání konfigurace custom fields z RayNet
async function fetchCustomFieldsRaynet() {
  try {
    const response = await raynetApi.get('customField/config/');
    return response.data;
  } catch (error) {
    console.error('Chyba při načítání custom fields z Raynet CRM:', error.response ? error.response.data : error.message);
    throw error;
  }
}


// DELETE endpoint pro smazání společností s chybným IČ
app.delete('/raynet/delete-companies-bad-regnum', async (req, res) => {
  try {
    // Načteme všechny společnosti
    const response = await raynetApi.get('/company/', {
      params: {
        limit: 1000,  // V případě potřeby můžete implementovat stránkování
      },
    });
    
    const companies = response.data.data;
    // Vyfiltrujeme společnosti, jejichž regNumber začíná na "Stavebnictvi!O"
    const companiesToDelete = companies.filter(company => 
      company.regNumber && company.regNumber.startsWith('Stavebnictvi!O')
    );
    
    // Pro každou společnost provedeme DELETE požadavek
    for (const company of companiesToDelete) {
      try {
        await raynetApi.delete(`/company/${company.id}/`);
        console.log(`Společnost s ID ${company.id} byla smazána.`);
      } catch (deleteError) {
        console.error(`Chyba při mazání společnosti s ID ${company.id}:`, deleteError.message);
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Smazáno ${companiesToDelete.length} společností s chybným IČ.`,
    });
  } catch (error) {
    console.error('Chyba při získávání společností:', error.message);
    res.status(500).json({
      success: false,
      message: 'Chyba při získávání společností.',
      error: error.message,
    });
  }
});


/// GET endpoint, který načte společnosti podle LIKE filtru a poté je smaže
app.get('/raynet/get-delete-company-by-regnum-like/:regNumber', async (req, res) => {
  const regNumber = req.params.regNumber;

  try {
    console.log(`Načítám data pro společnosti s IČ začínající ${regNumber}`);
    
    // Načteme společnosti podle LIKE filtru
    const response = await raynetApi.get('/company/', {
      params: {
        limit: 1000,
        'regNumber[LIKE]': `${regNumber}%`,  // LIKE operátor, kde % značí libovolný následující řetězec
      },
    });
    
    const companies = response.data.data;
    
    if (companies.length === 0) {
      console.warn(`Společnosti začínající IČ ${regNumber} nebyly nalezeny.`);
      return res.status(404).json({
        success: false,
        message: `Společnosti začínající IČ ${regNumber} nebyly nalezeny.`,
      });
    }
    
    let deletedCount = 0;
    let errors = [];
    
    // Iterujeme přes všechny nalezené společnosti a smažeme je
    for (const company of companies) {
      try {
        await raynetApi.delete(`/company/${company.id}`);
        console.log(`Společnost s ID ${company.id} byla smazána.`);
        deletedCount++;
      } catch (deleteError) {
        console.error(`Chyba při mazání společnosti s ID ${company.id}:`, deleteError.message);
        errors.push({ id: company.id, error: deleteError.message });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Smazáno ${deletedCount} společností s IČ začínající ${regNumber}.`,
      errors: errors
    });
  } catch (error) {
    console.error(`Chyba při načítání společností s IČ začínající ${regNumber}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Chyba při načítání společností.',
      error: error.message,
    });
  }
});



// GET endpoint pro získání informací o společnosti podle IČ s LIKE filtrem
app.get('/raynet/get-company-by-regnum-like/:regNumber', async (req, res) => {
  const regNumber = req.params.regNumber;

  try {
    console.log(`Načítám data pro společnosti s IČ začínající ${regNumber}`);
    
    // Zavoláme Raynet API a použijeme operátor LIKE pro filtrování
    const response = await raynetApi.get('/company/', {
      params: {
        limit: 1000,
        'regNumber[LIKE]': `${regNumber}%`,  // LIKE operátor, kde % značí libovolný následující řetězec
      },
    });

    const companies = response.data.data;

    if (companies.length === 0) {
      console.warn(`Společnost začínající IČ ${regNumber} nebyla nalezena.`);
      return res.status(404).json({
        success: false,
        message: `Společnost začínající IČ ${regNumber} nebyla nalezena.`,
      });
    }

    // Vrátíme JSON se všemi nalezenými společnostmi
    res.status(200).json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error(`Chyba při načítání společností s IČ začínající ${regNumber}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Chyba při načítání společností.',
      error: error.message,
    });
  }
});


// GET pro získání informací o společnosti podle IČ
app.get('/raynet/get-company-by-regnum/:regNumber', async (req, res) => {
  const regNumber = req.params.regNumber;

  try {
      console.log(`Načítám data pro společnost s IČ: ${regNumber}`);
      
      // Zavoláme Raynet API pro načtení detailu společnosti
      const response = await raynetApi.get('/company/', {
          params: {
              limit: 1000,
              'regNumber[EQ]': regNumber, // Používáme operátor EQ pro přesnou shodu
          },
      });

      const companies = response.data.data;

      if (companies.length === 0) {
          console.warn(`Společnost s IČ ${regNumber} nebyla nalezena.`);
          return res.status(404).json({
              success: false,
              message: `Společnost s IČ ${regNumber} nebyla nalezena.`,
          });
      }

      // Vrátíme JSON s daty nalezené společnosti (první z výsledků)
      res.status(200).json({
          success: true,
          data: companies[0]  // Vracíme pouze první nalezenou společnost
      });
  } catch (error) {
      console.error(`Chyba při načítání společnosti s IČ ${regNumber}:`, error.message);
      res.status(500).json({
          success: false,
          message: 'Chyba při načítání společnosti.',
          error: error.message,
      });
  }
});



// GET pro získání informací o obchodním případu
app.get('/raynet/get-business-case/:id', async (req, res) => {
  const businessCaseId = req.params.id;

  try {
    console.log(`Načítám data pro obchodní případ s ID: ${businessCaseId}`);
    
    // Zavoláme Raynet API pro načtení detailu obchodního případu
    const response = await raynetApi.get(`/businessCase/${businessCaseId}/`);
    const businessCaseData = response.data.data;

    if (!businessCaseData) {
      console.warn(`Obchodní případ s ID ${businessCaseId} nebyl nalezen.`);
      return res.status(404).json({
        success: false,
        message: `Obchodní případ s ID ${businessCaseId} nebyl nalezen.`,
      });
    }

    // Vrátíme JSON s daty obchodního případu
    res.status(200).json({
      success: true,
      data: businessCaseData
    });
  } catch (error) {
    console.error(`Chyba při načítání obchodního případu s ID ${businessCaseId}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Chyba při načítání obchodního případu.',
      error: error.message,
    });
  }
});


//RayNet - Endpoint pro získání kategorií produktů
app.get('/raynet/product-categories', async (req, res) => {
  try {
    const categories = await fetchProductCategoriesRaynet();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Chyba při načítání kategorií produktů z Raynet CRM' });
  }
});

// Funkce pro získání kategorií produktů z RayNet
async function fetchProductCategoriesRaynet() {
  try {
    const response = await raynetApi.get('productCategory/');
    return response.data;
  } catch (error) {
    console.error('Chyba při načítání kategorií z Raynet CRM:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Nový endpoint pro načítání produktových linií
app.get('/productLines', async (req, res) => {
  try {
    await sql.connect(mssqlConfig);
    const result = await sql.query(`SELECT id, value FROM productLines`);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Chyba při načítání produktových linií:', error);
    res.status(500).json({ error: 'Chyba při načítání produktových linií.' });
  }
});

// RayNet - Endpoint pro získání produktů s podporou filtrování podle id, code a name
app.get('/raynet/products', async (req, res) => {
  try {
    // Očekáváme volitelné query parametry: id, code a name
    const { id, code, name } = req.query;

    // Stránkovací parametry
    const limit = 1000;
    let offset = 0;
    let allProducts = [];
    let finished = false;

    // Iterace přes všechny stránky, dokud se vrátí méně než limit produktů
    while (!finished) {
      const response = await raynetApi.get('product/', {
        params: { offset, limit }
      });

      const productsPage = response.data.data || [];
      allProducts = allProducts.concat(productsPage);

      if (productsPage.length < limit) {
        finished = true;
      } else {
        offset += limit;
      }
    }

    let products = allProducts;

    // Filtrování podle parametru 'id'
    if (id) {
      const searchId = id.toString().trim();
      products = products.filter(p => p.id && p.id.toString().trim() === searchId);
      return res.json({
        success: true,
        totalCount: products.length,
        data: products
      });
    }

    // Filtrování podle parametru 'code'
    if (code) {
      const searchCode = code.trim().toLowerCase();
      products = products.filter(p =>
        p.code && p.code.trim().toLowerCase() === searchCode
      );

      if (products.length === 0) {
        // Produkt neexistuje
        return res.json({ success: true, totalCount: 0, data: [] });
      } else if (products.length === 1) {
        // Jeden produkt nalezen
        return res.json({ success: true, totalCount: 1, data: [products[0]] });
      } else {
        // Více produktů se stejným kódem => chyba
        return res.status(400).json({
          error: 'Bylo nalezeno více produktů se stejným kódem.',
          totalCount: products.length,
          data: products
        });
      }
    }

    // Filtrování podle parametru 'name' s operátorem like
    if (name) {
      const searchName = name.trim().toLowerCase();
      products = products.filter(p =>
        p.name && p.name.trim().toLowerCase().includes(searchName)
      );

      return res.json({
        success: true,
        totalCount: products.length,
        data: products
      });
    }

    // Pokud nebyl zadán ani id, ani code, ani name – vrátíme všechny produkty
    return res.json({
      success: true,
      totalCount: products.length,
      data: products,
    });
  } catch (error) {
    console.error('Chyba při načítání produktů z Raynet CRM:', 
      error.response ? error.response.data : error.message);
    return res.status(500).json({ error: 'Chyba při načítání produktů z Raynet CRM.' });
  }
});



// RayNet Endpoint pro vytvoření nového produktu
app.put('/raynet/product', async (req, res) => {
  try {
    const {
      code,
      name,
      unit, // Ensure 'unit' is received
      category,
      productLine,
      cost,
      price,
      customFields, // Ensure 'customFields' is received
    } = req.body;

    // Validation checks (as before)

    // Send data to Raynet API
    const newProduct = await createProductRaynet({
      code,
      name,
      unit,
      category: category,
      productLine: productLine,
      cost,
      price,
      customFields,
    });

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Chyba při vytváření produktu v Raynet CRM:', error);
    res.status(500).json({ error: 'Chyba při vytváření produktu v Raynet CRM.' });
  }
});

// RayNet Endpoint pro aktualizaci existujícího produktu
app.post('/raynet/product/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const {
      code,
      name,
      unit,
      category,
      productLine,
      cost,
      price,
      customFields,
    } = req.body;

    // Validace vstupních dat dle potřeby

    // Aktualizace produktu v Raynetu
    const updatedProduct = await updateProductRaynet(productId, {
      code,
      name,
      unit,
      category,
      productLine,
      cost,
      price,
      customFields,
    });

    res.json(updatedProduct.data);
  } catch (error) {
    console.error('Chyba při aktualizaci produktu v Raynet CRM:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Chyba při aktualizaci produktu v Raynet CRM.' });
  }
});



// Nový endpoint pro hromadné omezení platnosti ceníků
// Endpoint pro hromadné omezení platnosti ceníků
app.post('/raynet/price-lists/limit-validity', async (req, res) => {
  try {
    const { priceListIds, validTill } = req.body;

    // Validace vstupních dat
    if (!priceListIds || !Array.isArray(priceListIds) || priceListIds.length === 0) {
      return res.status(400).json({ error: 'Neplatný seznam ID ceníků.' });
    }

    if (!validTill) {
      return res.status(400).json({ error: 'Chybí datum platnosti validTill.' });
    }

    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    let errorDetails = [];

    // Iterace přes všechny ID ceníků
    for (const id of priceListIds) {
      try {
        console.log(`Aktualizuji ceník ID ${id} s validTill: ${validTill}`);
        
        // Volání Raynet API pro aktualizaci platnosti ceníku
        // V request body zadáme pouze pole, které chceme změnit
        await raynetApi.post(`priceList/${id}`, { validTill });

        updatedCount++;
      } catch (error) {
        console.error(`Chyba při aktualizaci ceníku ${id}:`, error.response ? error.response.data : error.message);

        // Kontrola, zda ceník nebyl nalezen (např. status 404)
        if (error.response && error.response.status === 404) {
          notFoundCount++;
        } else {
          errorCount++;
          errorDetails.push({ priceListId: id, error: error.message });
        }
      }
    }

    // Sestavení odpovědi
    const responsePayload = {
      success: true,
      updatedCount,
      notFoundCount,
      errorCount,
      errors: errorDetails,
    };

    res.json(responsePayload);
  } catch (error) {
    console.error('Chyba při hromadném omezení platnosti ceníků:', error.message);
    res.status(500).json({ error: 'Chyba při omezení platnosti ceníků' });
  }
});



// Získej informace o ceníku Raynet s podporou filtrování
app.get('/raynet/price-lists', async (req, res) => {
  try {
    // Připravení parametrů pro dotaz na Raynet API
    const params = {
      ...req.query, // Všechny query parametry z požadavku
      limit: req.query.limit || 1000,
      offset: req.query.offset || 0,
    };

    // Odstranění prázdných parametrů
    for (const key of Object.keys(params)) {
      if (params[key] === undefined || params[key] === null || params[key] === '') {
        delete params[key];
      }
    }

    // Volání Raynet API s připravenými parametry
    const response = await raynetApi.get('priceList/', { params });

    // Vrácení dat klientovi
    res.json(response.data);
  } catch (error) {
    console.error('Chyba při načítání ceníků z Raynet CRM:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Chyba při načítání ceníků z Raynet CRM' });
  }
});


//Založ nový ceník Raynet
app.put('/raynet/price-list', async (req, res) => {
  try {
    const { name, code, currency, validFrom, category } = req.body;

    const priceListData = {
      name,
      code,
      currency: currency, // Correct: Passing currency ID as integer
      validFrom,
      category: category,  // Correct: Passing category ID as integer
    };

    const response = await raynetApi.put('priceList', priceListData);
    res.status(201).json(response.data);
  } catch (error) {
    console.error('Chyba při vytváření ceníku v Raynet CRM:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Chyba při vytváření ceníku v Raynet CRM.' });
  }
});


// Endpoint pro vytvoření nových ceníků na základě verze a kategorií
app.post('/raynet/create-price-lists-from-version', async (req, res) => {
  try {
    const { verze, validFrom, validTill } = req.body;

    if (!verze) {
      return res.status(400).json({ error: 'Chybí parameter verze.' });
    }

    if (!validFrom) {
      return res.status(400).json({ error: 'Chybí parameter validFrom.' });
    }

    // Načtení kategorií ceníků
    const categoriesResponse = await raynetApi.get('priceListCategory/');
    const categories = categoriesResponse.data.data;

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(404).json({ error: 'Nebyly nalezeny žádné kategorie ceníků.' });
    }

    // Načtení měn a nalezení CZK
    const currenciesResponse = await raynetApi.get('currency/');
    const currencies = currenciesResponse.data.data;
    const czkCurrency = currencies.find(c => c.code02 === 'CZK');

    if (!czkCurrency) {
      return res.status(500).json({ error: 'Měna CZK nebyla nalezena.' });
    }

    const createdPriceLists = [];
    const failedPriceLists = [];

    // Vytvoření ceníků pro každou kategorii
    for (const category of categories) {
      const categoryCode = category.code01; // Opraveno z category.value na category.code01

      // Sestavení kódu a jména ceníku
      const priceListCode = `CENIK_${verze}_${categoryCode}`;

      const priceListData = {
        name: priceListCode,
        code: priceListCode,
        currency: czkCurrency.id,
        validFrom,
        category: category.id
      };

      if (validTill) {
        priceListData.validTill = validTill;
      }

      try {
        const response = await raynetApi.put('priceList', priceListData);
        createdPriceLists.push(response.data);
      } catch (error) {
        console.error(
          `Chyba při vytváření ceníku ${priceListCode}:`,
          error.response ? error.response.data : error.message
        );
        failedPriceLists.push({
          code: priceListCode,
          error: error.response ? error.response.data : error.message
        });
      }
    }

    res.json({
      success: failedPriceLists.length === 0,
      createdPriceLists,
      failedPriceLists
    });
  } catch (error) {
    console.error('Chyba při zakládání ceníků z verze:', error);
    res.status(500).json({ error: 'Chyba při zakládání ceníků.' });
  }
});

// Endpoint pro vytvoření jednoho ceníku na základě verze
app.put('/raynet/create-price-list', async (req, res) => {
  try {
    const {
      verze,
      code,
      validFrom,
      validTill,
      category,
      selectedSheet,
      owner,
      description
    } = req.body;

    console.log('Přijatá data:', req.body);

    // Validace vstupních parametrů
    if (!verze) {
      console.log('Chybí parametr verze (název ceníku).');
      return res.status(400).json({ error: 'Chybí parametr verze (název ceníku).' });
    }

    if (!code) {
      console.log('Chybí parametr code (kód ceníku).');
      return res.status(400).json({ error: 'Chybí parametr code (kód ceníku).' });
    }

    if (!validFrom) {
      console.log('Chybí parametr validFrom.');
      return res.status(400).json({ error: 'Chybí parametr validFrom.' });
    }

    if (typeof category !== 'number') {
      console.log('Chybí nebo je nesprávný parametr category.');
      return res.status(400).json({ error: 'Chybí nebo je nesprávný parametr category.' });
    }

    if (typeof code !== 'string') {
      console.log('Parametr code musí být typu string.');
      return res.status(400).json({ error: 'Parametr code musí být typu string.' });
    }

    // Načtení měn a nalezení CZK
    let currencies;
    try {
      const currenciesResponse = await raynetApi.get('currency/');
      currencies = currenciesResponse.data.data;
      console.log('Načtené měny:', currencies);
    } catch (error) {
      console.error('Chyba při načítání měn z Raynet API:', error.response ? error.response.data : error.message);
      return res.status(500).json({ error: 'Chyba při načítání měn z Raynet API.' });
    }

    const czkCurrency = currencies.find(c => c.code02 === 'CZK');
    console.log('Nalezená měna CZK:', czkCurrency);

    // Nastavení 'currency' na CZK, nebo na pevnou hodnotu 3, pokud CZK nebyla nalezena
    const currencyId = czkCurrency ? czkCurrency.id : 3;
    if (!czkCurrency) {
      console.warn('Měna CZK nebyla nalezena, nastavena pevná hodnota currency na 3.');
    }

    // Sestavení názvu a kódu ceníku
    const priceListName = verze; // Název ceníku (verze)
    const priceListCode = code;  // Kód ceníku (code) - žádné úpravy

    // Data pro vytvoření ceníku
    const priceListData = {
      name: priceListName,
      code: priceListCode,
      owner: owner || null,
      currency: currencyId,
      category: category,
      validFrom,
      validTill: validTill || null,
      description: description || '',
      selectedSheet: selectedSheet || null
    };

    console.log('Data pro vytvoření ceníku:', priceListData);

    // Vytvoření ceníku v Raynet CRM (PUT)
    try {
      const response = await raynetApi.put('priceList', priceListData);
      console.log('Odpověď z Raynet API při vytváření ceníku:', response.data);

      const createdPriceList = response.data.data;

      res.json({
        success: true,
        createdPriceList: {
          priceListId: createdPriceList.id
        },
        failedPriceLists: []
      });
    } catch (error) {
      console.error(
        `Chyba při vytváření ceníku ${priceListCode}:`,
        error.response ? error.response.data : error.message
      );
      res.status(500).json({
        success: false,
        createdPriceList: null,
        failedPriceLists: [{
          code: priceListCode,
          error: error.response ? error.response.data : error.message
        }]
      });
    }

  } catch (error) {
    console.error('Chyba při zakládání ceníku:', error);
    res.status(500).json({ error: 'Chyba při zakládání ceníku.' });
  }
});

// Získej kategorie Ceníku Raynet
app.get('/raynet/price-list-categories', async (req, res) => {
  try {
    const response = await raynetApi.get('priceListCategory/');
    res.json(response.data);
  } catch (error) {
    console.error('Chyba při načítání kategorií ceníků z Raynet CRM:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Chyba při načítání kategorií ceníků z Raynet CRM' });
  }
});


//Získej kategorie Ceníku Raynet
app.get('/raynet/price-list-categories', async (req, res) => {
  try {
    const response = await raynetApi.get('priceListCategory/');
    res.json(response.data);
  } catch (error) {
    console.error('Chyba při načítání kategorií ceníků z Raynet CRM:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Chyba při načítání kategorií ceníků z Raynet CRM' });
  }
});


// Přiřaď produkty k ceníku
app.put('/raynet/price-list/:priceListId/item', async (req, res) => {
  try {
    const { priceListId } = req.params;
    const priceListItemData = req.body; // Přijmeme data tak, jak jsou

    const endpoint = `priceList/${priceListId}/item/`;

    const response = await raynetApi.put(endpoint, priceListItemData);
    res.status(201).json(response.data);
  } catch (error) {
    console.error(
      'Chyba při vytváření položky ceníku v Raynet CRM:',
      error.response ? error.response.data : error.message
    );
    res.status(500).json({
      error: 'Chyba při vytváření položky ceníku v Raynet CRM.',
      details: error.response ? error.response.data : error.message,
    });
  }
});

// Endpoint pro export dat do Raynet CRM
app.post('/raynet-export', async (req, res) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Žádná data k exportu.' });
    }

    const exportedProducts = [];
    const failedProducts = [];

    // Získání seznamu měn
    const availableCurrenciesResponse = await fetchAvailableCurrencies();
    console.log('Dostupné měny:', availableCurrenciesResponse);

    // Přístup k poli měn
    const availableCurrencies = availableCurrenciesResponse.data;

    // Hledání měny 'CZK' podle code02
    const czkCurrency = availableCurrencies.find(currency => currency.code02 === 'CZK');

    if (!czkCurrency) {
      throw new Error('ID pro měnu CZK nebylo nalezeno.');
    }

    const priceListName = 'VášCeník'; // Nastavte název ceníku nebo jej přijměte z frontendu
    let priceListId = await getPriceListIdByName(priceListName);

    if (!priceListId) {
      // Pokud ceník neexistuje, vytvoříme nový
      const newPriceList = await createPriceListRaynet({
        name: priceListName,
        code: 'CENIK001', // Unikátní kód ceníku
        currency: czkCurrency.id, // Použijeme získané ID měny
        validFrom: new Date().toISOString().split('T')[0], // Dnešní datum
        category: 1, // ID kategorie ceníku
      });
      priceListId = newPriceList.id;
    }

    for (const product of data) {
      try {
        // Zkontrolujeme, zda produkt již existuje podle kódu
        const existingProduct = await findProductByCode(product.code);

        if (existingProduct) {
          // Aktualizujeme existující produkt
          const updatedProduct = await updateProductRaynet(existingProduct.id, product);
          exportedProducts.push(updatedProduct.data);

          // Přidáme produkt do ceníku
          await assignProductToPriceList(priceListId, existingProduct.id, product.price);
        } else {
          // Vytvoříme nový produkt
          const newProduct = await createProductRaynet(product);
          exportedProducts.push(newProduct.data);

          // Přidáme produkt do ceníku
          await assignProductToPriceList(priceListId, newProduct.data.id, product.price);
        }
      } catch (productError) {
        console.error(`Chyba při zpracování produktu ${product.code}:`, productError);
        failedProducts.push({ code: product.code, error: productError.message });
      }
    }

    res.status(200).json({
      success: failedProducts.length === 0,
      exportedProducts,
      failedProducts,
    });
  } catch (error) {
    console.error('Chyba při exportu do Raynet CRM:', error);
    res.status(500).json({ error: 'Chyba při exportu do Raynet CRM.' });
  }
});

// Pomocné funkce pro práci s Raynet API

// Funkce pro získání dostupných měn z Raynet CRM
async function fetchAvailableCurrencies() {
  try {
    const response = await raynetApi.get('currency/');
    return response.data; // Vracíme celou odpověď
  } catch (error) {
    console.error('Chyba při načítání měn z Raynet CRM:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Funkce pro získání ID ceníku podle jeho názvu
async function getPriceListIdByName(name) {
  try {
    const response = await raynetApi.get('priceList/', {
      params: {
        limit: 100, // Získejte maximální počet položek v rámci jednoho požadavku
      },
    });

    const priceLists = response.data.data;
    // Najdeme ceník podle názvu ve vrácených datech
    const matchingPriceList = priceLists.find((priceList) => priceList.name === name);

    return matchingPriceList ? matchingPriceList.id : null;
  } catch (error) {
    console.error('Chyba při načítání ceníku v Raynet CRM:', error);
    throw error;
  }
}

// Funkce pro vytvoření nového ceníku v Raynet CRM
async function createPriceListRaynet(priceListData) {
  try {
    const response = await raynetApi.put('priceList', priceListData);
    return response.data;
  } catch (error) {
    console.error('Chyba při vytváření ceníku v Raynet CRM:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Funkce pro nalezení produktu podle kódu
async function findProductByCode(code) {
  try {
    const response = await raynetApi.get('product/', {
      params: { code: code },
    });
    const products = response.data.data;
    return products.length > 0 ? products[0] : null;
  } catch (error) {
    console.error(`Chyba při hledání produktu s kódem ${code}:`, error);
    throw error;
  }
}




// Funkce pro přiřazení produktu k ceníku
async function assignProductToPriceList(priceListId, productId, price) {
  try {
    const priceListItemData = {
      product: productId,
      price: price,
    };
    const response = await raynetApi.put(`priceList/${priceListId}/item/`, priceListItemData);
    return response;
  } catch (error) {
    console.error('Chyba při přidávání produktu do ceníku v Raynet CRM:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Endpoint pro získání seznamu měn z Raynet CRM
app.get('/raynet/currencies', async (req, res) => {
  try {
    const response = await raynetApi.get('currency/');
    res.json(response.data); // Vracíme celou odpověď od Raynetu
  } catch (error) {
    console.error('Chyba při načítání měn z Raynet CRM:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Chyba při načítání měn z Raynet CRM' });
  }
});

// Endpoint pro získání hodnot ceníku s marketingovými akcemi a základní slevou
app.get('/get-catalog-data', async (req, res) => {
  const { versionName, selectedPriceGroup } = req.query;

  if (!versionName) {
    return res.status(400).json({ message: 'Chybí parametr versionName.' });
  }

  if (!selectedPriceGroup) {
    return res.status(400).json({ message: 'Chybí parametr selectedPriceGroup.' });
  }

  let connection;
  let pneuConnection;

  try {
    // 1) Připojení k původní databázi (např. c5tpms)
    connection = await new Promise((resolve, reject) => {
      poolC5tpms.getConnection((err, conn) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });

    // 2) Vyhledání filterId pro zadaný versionName (LIKE)
    const likePattern = `${versionName}%`;
    console.log('[get-catalog-data] Dotaz na Analytic_FilterTemplates s LIKE:', likePattern);

    const filters = await new Promise((resolve, reject) => {
      connection.query(
        `SELECT filterId, filterName
         FROM Analytic_FilterTemplates
         WHERE filterName LIKE ?`,
        [likePattern],
        (err, results) => {
          if (err) {
            console.error('[get-catalog-data] Chyba při dotazu na Analytic_FilterTemplates:', err);
            return reject(err);
          }
          console.log('[get-catalog-data] Výsledek FilterTemplates:', results);
          resolve(results);
        }
      );
    });

    if (!filters || filters.length === 0) {
      console.log('[get-catalog-data] Žádné filtry nenalezeny pro versionName:', versionName);
      return res.status(404).json({ message: 'Pro zadanou verzi nebyly nalezeny žádné filtry.' });
    }

    // 3) Získáme pole filterIds
    const filterIds = filters.map(filter => ({
      filterId: filter.filterId,
      filterName: filter.filterName,
    }));
    const filterIdList = filterIds.map(f => f.filterId);

    console.log('[get-catalog-data] Dotaz na IMPORT_CZS_Analytic_PLOR s filterIds:', filterIdList);

    const rows = await new Promise((resolve, reject) => {
      connection.query(
        `SELECT *
         FROM IMPORT_CZS_Analytic_PLOR
         WHERE Verze IN (?)`,
        [filterIdList],
        (err, results) => {
          if (err) {
            console.error('[get-catalog-data] Chyba při dotazu na IMPORT_CZS_Analytic_PLOR:', err);
            return reject(err);
          }
          console.log('[get-catalog-data] Výsledek Analytic_PLOR:', results);
          resolve(results);
        }
      );
    });

    if (!rows || rows.length === 0) {
      console.log('[get-catalog-data] PLOR nevrátil žádné řádky pro filterIds:', filterIdList);
      return res.status(404).json({
        message: 'Pro zadané filterIds nebyly nalezeny žádné záznamy.',
      });
    }

    // 4) Transformace získaných dat
    const transformed = rows.map(r => ({
      filterId: r.Verze,
      C_Polozky: r.C_Polozky,
      Cena: r.Cena !== null ? String(r.Cena) : '',
      Prodej_cena:
        r.Prodej_cena !== null && r.Prodej_cena !== 'undefined'
          ? String(r.Prodej_cena)
          : '0',
      AkcniCena: r.AkcniCena || '',
      Nazev: r.Nazev || '',
      Rozmer: r.Rozmer || '',
      Naprava: r.Naprava || '',
      Provoz: r.Provoz || '',
      M_S: r.M_S || '',
      TPM_S: r.TPM_S || '',
      MarketingovaAkce: r.MarketingovaAkce || '',
      PlatnostOd: r.PlatnostOd || '',
      PlatnostDo: r.PlatnostDo || '',
      Vyrobce: r.Vyrobce || '',
      CenovaSkupina: r.CenovaSkupina || '',
      ZakaznickaSkupina: r.ZakaznickaSkupina || '',
      RNpricelistId: r.RNpricelistId || null,
      Hodnota_slevy: null,
      Marze_vyucisleno_nakup: null,
      Marze_procent_nakup: null,
      Marze_vyucisleno_sklad: null,
      Marze_procent_sklad: null,
      Nakup_cena: null,
      Nakladova_cena: '',
      nakup_sleva: '0.0',
      Sklad_Zlin: '0',
      Sklad_Praha: '0',
      Sklad_Ostrava: '0',
      Sklad_Brno: '0',
      Sklad_CeskeBudejovice: '0',
      Celkem: '0',
      dostupnost: 'NENÍ SKLADEM',
    }));

    console.log('[get-catalog-data] Data transformována:', transformed);

    // 5) Připojení k poolC5pneutyres
    pneuConnection = await new Promise((resolve, reject) => {
      poolC5pneutyres.getConnection((err, conn) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });

    // 5a) Zjištění "sleva" => Nakup_cena (pokud existují skupiny)
    const uniqueGroups = [
      ...new Set(transformed.map(t => t.ZakaznickaSkupina).filter(z => z)),
    ];

    if (uniqueGroups.length > 0) {
      const skupinyPlaceholders = uniqueGroups.map(() => '?').join(', ');
      const slevaQuery = `
        SELECT Cenove_skupiny, Sleva
        FROM c5pneutyres.IMPORT_CZS_Kalkulace_cen_nakupni_podminky
        WHERE Cenove_skupiny IN (${skupinyPlaceholders})
      `;

      const slevaRows = await new Promise((resolve, reject) => {
        pneuConnection.query(slevaQuery, uniqueGroups, (err, results) => {
          if (err) {
            console.error(
              '[get-catalog-data] Chyba dotazu Kalkulace_cen_nakupni_podminky:',
              err
            );
            return reject(err);
          }
          console.log(
            '[get-catalog-data] Výsledek Kalkulace_cen_nakupni_podminky:',
            results
          );
          resolve(results);
        });
      });

      const slevaMap = {};
      slevaRows.forEach(row => {
        slevaMap[row.Cenove_skupiny] = parseFloat(row.Sleva) || 0;
      });

      for (const item of transformed) {
        const cenaNumber = parseFloat(item.Cena) || 0;
        const group = item.ZakaznickaSkupina;
        const slevaValue = slevaMap[group] || 0;
        const nakupCena = cenaNumber * (1 - slevaValue / 100);

        item.Nakup_cena = Math.round(nakupCena).toString();
        item.nakup_sleva = slevaValue.toFixed(1);
      }
    }

    // 5b) Skladové informace (IMPORT_PNEU_SKLAD)
    const cPolozkyUnique = [
      ...new Set(transformed.map(item => item.C_Polozky).filter(cp => cp)),
    ];
    console.log('[get-catalog-data] Dotaz na IMPORT_PNEU_SKLAD:', cPolozkyUnique);

    if (cPolozkyUnique.length > 0) {
      const skladPlaceholders = cPolozkyUnique.map(() => '?').join(', ');
      const skladQuery = `
        SELECT
          Produkt,
          Sklad_02010305,
          Sklad_00000300,
          Sklad_04000310,
          Sklad_03000310,
          Sklad_00000600,
          Celkem
        FROM c5pneutyres.IMPORT_PNEU_SKLAD
        WHERE Produkt IN (${skladPlaceholders})
      `;

      const skladRows = await new Promise((resolve, reject) => {
        pneuConnection.query(skladQuery, cPolozkyUnique, (err, results) => {
          if (err) {
            console.error(
              '[get-catalog-data] Chyba dotazu IMPORT_PNEU_SKLAD:',
              err
            );
            return reject(err);
          }
          console.log('[get-catalog-data] Výsledek IMPORT_PNEU_SKLAD:', results);
          resolve(results);
        });
      });

      const skladMap = {};
      skladRows.forEach(row => {
        skladMap[row.Produkt] = {
          Sklad_Zlin: parseInt(row.Sklad_02010305) || 0,
          Sklad_Praha: parseInt(row.Sklad_00000300) || 0,
          Sklad_Ostrava: parseInt(row.Sklad_04000310) || 0,
          Sklad_Brno: parseInt(row.Sklad_03000310) || 0,
          Sklad_CeskeBudejovice: parseInt(row.Sklad_00000600) || 0,
          Celkem: parseInt(row.Celkem) || 0,
        };
      });

      transformed.forEach(item => {
        const skl = skladMap[item.C_Polozky] || {
          Sklad_Zlin: 0,
          Sklad_Praha: 0,
          Sklad_Ostrava: 0,
          Sklad_Brno: 0,
          Sklad_CeskeBudejovice: 0,
          Celkem: 0,
        };

        item.Sklad_Zlin = skl.Sklad_Zlin.toString();
        item.Sklad_Praha = skl.Sklad_Praha.toString();
        item.Sklad_Ostrava = skl.Sklad_Ostrava.toString();
        item.Sklad_Brno = skl.Sklad_Brno.toString();
        item.Sklad_CeskeBudejovice = skl.Sklad_CeskeBudejovice.toString();
        item.Celkem = skl.Celkem.toString();
        item.dostupnost = skl.Celkem > 0 ? 'SKLADEM' : 'NENÍ SKLADEM';
      });
    } else {
      console.log('[get-catalog-data] Žádné produkty pro IMPORT_PNEU_SKLAD.');
    }

    // 5c) Nákladová cena (Import_CZS_Nakladova_cena)
    if (cPolozkyUnique.length > 0) {
      console.log('[get-catalog-data] Dotaz na Import_CZS_Nakladova_cena:', cPolozkyUnique);

      const nakladPlaceholders = cPolozkyUnique.map(() => '?').join(', ');
      const nakladQuery = `
        SELECT Polozka, Nazev, Skladova_cena
        FROM c5pneutyres.Import_CZS_Nakladova_cena
        WHERE Polozka IN (${nakladPlaceholders})
      `;

      const nakladRows = await new Promise((resolve, reject) => {
        pneuConnection.query(nakladQuery, cPolozkyUnique, (err, results) => {
          if (err) {
            console.error('[get-catalog-data] Chyba Import_CZS_Nakladova_cena:', err);
            return reject(err);
          }
          console.log('[get-catalog-data] Výsledek Import_CZS_Nakladova_cena:', results);
          resolve(results);
        });
      });

      const nakladMap = {};
      nakladRows.forEach(row => {
        nakladMap[row.Polozka] = {
          Nazev: row.Nazev || '',
          Skladova_cena: parseFloat(row.Skladova_cena) || 0,
        };
      });

      transformed.forEach(item => {
        const polozkaData = nakladMap[item.C_Polozky];
        if (polozkaData) {
          item.Nakladova_cena = polozkaData.Skladova_cena.toFixed(2);
        } else {
          item.Nakladova_cena = '';
        }
      });
    }

    // 6) Načtení marketingových akcí
    const marketingActionsQuery = `
      SELECT
        polozka,
        CASE
          WHEN MarketingovaAkce = 'Vyprodej' THEN 1
          WHEN MarketingovaAkce = 'Akce položka' THEN 2
          WHEN MarketingovaAkce = 'Netto' THEN 3
        END AS Priority,
        MarketingovaAkce,
        Cena,
        PlatnostOd,
        PlatnostDo
      FROM (
        SELECT
          polozka,
          'Vyprodej' AS MarketingovaAkce,
          \`${selectedPriceGroup}\` AS Cena,
          platnost_od AS PlatnostOd,
          platnost_do AS PlatnostDo
        FROM c5pneutyres.IMPORT_CZS_Kalkulace_cen_vyprodej
        WHERE \`${selectedPriceGroup}\` IS NOT NULL
          AND \`${selectedPriceGroup}\` <> ''
          AND (platnost_od IS NULL OR platnost_od <= CURDATE())
          AND (platnost_do IS NULL OR platnost_do >= CURDATE())

        UNION ALL

        SELECT
          polozka,
          'Akce položka' AS MarketingovaAkce,
          \`${selectedPriceGroup}\` AS Cena,
          platnost_od AS PlatnostOd,
          platnost_do AS PlatnostDo
        FROM c5pneutyres.IMPORT_CZS_Kalkulace_cen_akce_polozka
        WHERE \`${selectedPriceGroup}\` IS NOT NULL
          AND \`${selectedPriceGroup}\` <> ''
          AND (platnost_od IS NULL OR platnost_od <= CURDATE())
          AND (platnost_do IS NULL OR platnost_do >= CURDATE())

        UNION ALL

        SELECT
          polozka,
          'Netto' AS MarketingovaAkce,
          \`${selectedPriceGroup}\` AS Cena,
          platnost_od AS PlatnostOd,
          platnost_do AS PlatnostDo
        FROM c5pneutyres.IMPORT_CZS_Kalkulace_cen_netto
        WHERE \`${selectedPriceGroup}\` IS NOT NULL
          AND \`${selectedPriceGroup}\` <> ''
          AND (platnost_od IS NULL OR platnost_od <= CURDATE())
          AND (platnost_do IS NULL OR platnost_do >= CURDATE())
      ) AS MarketingActions
      ORDER BY Priority
    `;

    const marketingActionsRows = await new Promise((resolve, reject) => {
      pneuConnection.query(marketingActionsQuery, (err, results) => {
        if (err) {
          console.error('[get-catalog-data] Chyba při dotazu na marketingové akce:', err);
          return reject(err);
        }
        console.log('[get-catalog-data] Výsledek marketingových akcí:', results);
        resolve(results);
      });
    });

    // Vytvoření mapy marketingových akcí pro každou polozku s nejvyšší prioritou (tj. nejmenší číslo)
    const marketingMap = new Map();
    marketingActionsRows.forEach(row => {
      const current = marketingMap.get(row.polozka);
      if (!current || row.Priority < current.Priority) {
        marketingMap.set(row.polozka, {
          MarketingovaAkce: row.MarketingovaAkce,
          Cena: parseFloat(row.Cena) || 0,
          PlatnostOd: row.PlatnostOd || '',
          PlatnostDo: row.PlatnostDo || '',
          Priority: row.Priority,
        });
      }
    });

    // 6b) Načtení základní slevy
    let baseDiscountMap = new Map();
    if (selectedPriceGroup) {
      const baseDiscountQuery = `
        SELECT
          cenove_skupiny,
          \`${selectedPriceGroup}\` AS discountPercentage
        FROM IMPORT_CZS_Kalkulace_cen_zakladni_slevy
      `;

      const baseDiscountResults = await new Promise((resolve, reject) => {
        pneuConnection.query(baseDiscountQuery, (err, results) => {
          if (err) {
            console.error('[get-catalog-data] Chyba při dotazu na základní slevy:', err);
            return reject(err);
          }
          console.log('[get-catalog-data] Výsledek základních slev:', results);
          resolve(results);
        });
      });

      baseDiscountResults.forEach(row => {
        baseDiscountMap.set(row.cenove_skupiny, parseFloat(row.discountPercentage) || 0);
      });
    }

    // 7) Aplikace marketingových akcí / základní slevy a výpočty
    transformed.forEach(item => {
      const polozka = item.C_Polozky;
      const cenovaSkupina = item.ZakaznickaSkupina;
      let finalMarketingAkce = 'Základní sleva';
      let finalPlatnostOd = '';
      let finalPlatnostDo = '';
      let finalCena = parseFloat(item.Cena) || 0;

      if (marketingMap.has(polozka)) {
        const marketingInfo = marketingMap.get(polozka);
        finalMarketingAkce = marketingInfo.MarketingovaAkce;
        finalPlatnostOd = marketingInfo.PlatnostOd;
        finalPlatnostDo = marketingInfo.PlatnostDo;
        finalCena = marketingInfo.Cena;
      } else if (cenovaSkupina && baseDiscountMap.has(cenovaSkupina)) {
        const baseDiscount = baseDiscountMap.get(cenovaSkupina);
        finalCena = Math.round(finalCena * (1 - baseDiscount / 100));
      }

      // Nastavení do původních polí
      item.MarketingovaAkce = finalMarketingAkce;
      item.PlatnostOd = finalPlatnostOd;
      item.PlatnostDo = finalPlatnostDo;
      item.Prodej_cena = String(finalCena);

      // Finální výpočty:
      const cenaNum = parseFloat(item.Cena) || 0;
      const prodejCenaNum = parseFloat(item.Prodej_cena) || 0;
      const nakupCenaNum = parseFloat(item.Nakup_cena) || 0;
      const nakladovaCenaNum = parseFloat(item.Nakladova_cena) || 0;

      // Hodnota_slevy = ((Cena - Prodej_cena)/Cena)*100 => 1 desetinné
      let hodnotaSlevy = 0.0;
      if (cenaNum > 0) {
        hodnotaSlevy = ((cenaNum - prodejCenaNum) / cenaNum) * 100;
      }
      item.Hodnota_slevy = hodnotaSlevy.toFixed(1);

      // Marze_vyucisleno_nakup = Prodej_cena - Nakup_cena => 2 desetinné
      const marzeVyucislenoNakup = prodejCenaNum - nakupCenaNum;
      item.Marze_vyucisleno_nakup = marzeVyucislenoNakup.toFixed(2);

      // Marze_procent_nakup = (Marze_vyucisleno_nakup / Nakup_cena) * 100 => 1 desetinné
      let marzeProcentNakup = 0.0;
      if (nakupCenaNum > 0) {
        marzeProcentNakup = (marzeVyucislenoNakup / nakupCenaNum) * 100;
      }
      item.Marze_procent_nakup = marzeProcentNakup.toFixed(1);

      // Marze_vyucisleno_sklad = Prodej_cena - Nakladova_cena => 2 desetinné
      const marzeVyucislenoSklad = prodejCenaNum - nakladovaCenaNum;
      item.Marze_vyucisleno_sklad = marzeVyucislenoSklad.toFixed(2);

      // Marze_procent_sklad = (Marze_vyucisleno_sklad / Nakladova_cena) * 100 => 1 desetinné
      let marzeProcentSklad = 0.0;
      if (nakladovaCenaNum > 0) {
        marzeProcentSklad = (marzeVyucislenoSklad / nakladovaCenaNum) * 100;
      }
      item.Marze_procent_sklad = marzeProcentSklad.toFixed(1);
    });

    // 8) Seskupení dat podle filterId
    const groupedData = filterIds.map(filter => ({
      filterId: filter.filterId,
      filterName: filter.filterName,
      data: transformed.filter(row => row.filterId === filter.filterId),
    }));

    console.log('[get-catalog-data] Data seskupena:', JSON.stringify(groupedData, null, 2));
    res.status(200).json({ data: groupedData });
    console.log('[get-catalog-data] Odpověď úspěšně odeslána klientovi.');

  } catch (error) {
    console.error('Chyba při načítání dat z SQL:', error);
    return res.status(500).json({ message: 'Chyba při načítání dat z SQL.' });
  } finally {
    if (connection) {
      console.log('[get-catalog-data] Uvolňuji připojení c5tpms.');
      connection.release();
    }
    if (pneuConnection) {
      console.log('[get-catalog-data] Uvolňuji připojení c5pneutyres.');
      pneuConnection.release();
    }
  }
});



// Endpoint pro získání správných hodnot
app.post('/get-correct-values', async (req, res) => {
  const { itemIds } = req.body;

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({ message: 'Žádná itemIds nebyla poskytnuta.' });
  }

  try {
    await sql.connect(mssqlConfig);
    const request = new sql.Request();

    // Vytvoříme seznam parametrů pro itemIds
    itemIds.forEach((id, index) => {
      request.input(`itemId${index}`, sql.VarChar, id);
    });

    // Připravíme parametrizovaný dotaz s dynamickými parametry
    const query = `
      SELECT
        [ItemId],
        [ItemName],
        [ItsTyrePosition],
        [ItsTyreUseMode],
        [ItsMSMark],
        [ItsSnowflakeInMountain]
      FROM [dbo].[ItsIFInventTable]
      WHERE ItemId IN (${itemIds.map((_, index) => `@itemId${index}`).join(', ')})
    `;

    const result = await request.query(query);

    const foundItems = result.recordset.reduce((acc, item) => {
      acc[item.ItemId] = {
        ItemName: item.ItemName,
        ItsTyrePosition: item.ItsTyrePosition,
        ItsTyreUseMode: item.ItsTyreUseMode,
        ItsMSMark: item.ItsMSMark,
        ItsSnowflakeInMountain: item.ItsSnowflakeInMountain,
      };
      return acc;
    }, {});

    const notFoundItems = itemIds.filter(id => !foundItems[id]);

    res.json({ values: foundItems, notFoundItems });
  } catch (error) {
    console.error('Chyba při získávání správných hodnot:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.post('/save-catalog-data', (req, res) => {
  const {
    data,
    userId,
    versionName,
    filterName,
    selectedView,
    sheetName,
    validFrom,
    validTo,
    isActive,
    manufacturer
  } = req.body;

  // 1) Validace
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ message: 'Žádná data nebyla poskytnuta.' });
  }
  if (!sheetName) {
    return res.status(400).json({ message: 'Parametr sheetName (Skupina produktu) je povinný.' });
  }

  // 2) Připojení z poolu
  poolC5tpms.getConnection((err, connection) => {
    if (err) {
      console.error('Chyba při získávání připojení:', err);
      return res.status(500).json({ message: 'Chyba při získávání připojení k databázi.' });
    }

    // 3) Spuštění transakce
    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        console.error('Chyba při zahájení transakce:', err);
        return res.status(500).json({ message: 'Chyba při zahájení transakce.' });
      }

      // 4) INSERT do Analytic_FilterTemplates -> získáme filterId
      const componentType = 'PLOR';
      const filterValues = `Skupina produktu: ${sheetName}`;
      const filterURL = '';
      const isActiveValue = (isActive === true || isActive === 1) ? 1 : 0;

      const filterInsertData = [
        userId,
        componentType,
        filterName,
        filterValues,
        filterURL,
        validFrom || null,
        validTo || null,
        isActiveValue,
        manufacturer || 'Unknown'
      ];

      const insertFilterQuery = `
        INSERT INTO Analytic_FilterTemplates
        (userId, componentType, filterName, filterValues, filterURL, validFrom, validTo, isActive, Manufacturer)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      connection.query(insertFilterQuery, filterInsertData, (err, filterResult) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            console.error('Chyba při vkládání do Analytic_FilterTemplates:', err);
            res.status(500).json({
              message: 'Chyba při ukládání filtru.',
              details: err.message
            });
          });
        }

        const filterId = filterResult.insertId;
        console.log('Nový filterId:', filterId);

        if (!filterId) {
          return connection.rollback(() => {
            connection.release();
            console.error('insertId nebyl získán po vložení do Analytic_FilterTemplates.');
            res.status(500).json({
              message: 'Chyba při ukládání filtru. insertId nebyl získán.'
            });
          });
        }

        // Pokud byste potřebovali nějakou globální slevu:
        let discountPercentage = 0;

        // 5) Funkce, která vkládá do IMPORT_CZS_Analytic_PLOR
        const insertPlor = (row, callback) => {
          // Příklad: spočítáme Prodej_cena jako Cena
          const Cena = row.Cena ? parseFloat(row.Cena) : 0;
          const Prodej_cena = Cena;
          // Marketing akce data
          const M_Akce_Od = row.M_Akce_Od || '1970-01-01';
          const M_Akce_Do = row.M_Akce_Do || '1970-01-01';

          // Mapping do pole: sloupec `Verze` = filterId
          // Sloupec `Vyrobce` = param `manufacturer`
          const insertData = [
            /* 1)  Verze = filterId */        filterId || null,
            /* 2)  C_Polozky */               row.C_Polozky || null,
            /* 3)  C_Polozky2 */              row.C_Polozky2 || null,
            /* 4)  C_Polozky3 */              row.C_Polozky3 || null,
            /* 5)  C_Polozky4 */              row.C_Polozky4 || null,
            /* 6)  EAN */                     row.EAN || null,
            /* 7)  EAN2 */                    row.EAN2 || null,
            /* 8)  EAN3 */                    row.EAN3 || null,
            /* 9)  EAN4 */                    row.EAN4 || null,
            /* 10) Nazev */                   row.Nazev || null,
            /* 11) Rozmer */                  row.Rozmer || null,
            /* 12) Cena */                    Cena || null,
            /* 13) CenaPoSleve */             row.CenaPoSleve || null,
            /* 14) AkcniCena */               row.AkcniCena || null,
            /* 15) Prodej_cena */             Prodej_cena,
            /* 16) Uzivatel */                userId || null,
            /* 17) Skupina_radkove_slevy */   row.Skupina_radkove_slevy || null,
            /** (18) Vyrobce = param "manufacturer" **/
            manufacturer || null,
            /* 19) Naprava */                row.Naprava || null,
            /* 20) Provoz */                 row.Provoz || null,
            /* 21) Trida_vyrobce */          row.Trida_vyrobce || null,
            /* 22) CenovaSkupina */          row.CenovaSkupina || null,
            /* 23) M_S */                    row.M_S || null,
            /* 24) TPM_S */                  row.TPM_S || null,
            /* 25) Index nosnosti */         row["Index nosnosti"] || null,
            /* 26) Index rychlosti */        row["Index rychlosti"] || null,
            /* 27) 1_eshop */                row["1_eshop"] || '',
            /* 28) 2_pult */                 row["2_pult"] || '',
            /* 29) 3_servis */               row["3_servis"] || '',
            /* 30) 4_vo */                   row["4_vo"] || '',
            /* 31) 5_vip */                  row["5_vip"] || '',
            /* 32) 6_indiv */                row["6_indiv"] || '',
            /* 33) 7_dopravci */             row["7_dopravci"] || '',
            /* 34) B2B */                    row["B2B"] || '',
            /* 35) Stitek */                 row["Stitek"] || '',
            /* 36) Valivy_odpor */           row["Valivy_odpor"] || '',
            /* 37) Prilnavost */             row["Prilnavost"] || '',
            /* 38) Hluk_db */                row["Hluk_db"] || '',
            /* 39) TT_TL */                  row["TT_TL"] || '',
            /* 40) Hmotnost */               row["Hmotnost"] || '',
            /* 41) Hloubka_dezenu */         row["Hloubka_dezenu"] || '',
            /* 42) Zesileni */               row["Zesileni"] || '',
            /* 43) VybraneZobrazeni */       selectedView || null,
            /* 44) ZakaznickaSkupina */      row.ZakaznickaSkupina || null,
            /* 45) RNpricelistId */          row.RNpricelistId || null,
            /* 46) Sleva */                  row.Sleva || discountPercentage.toString(),
            /* 47) Marketingova_akce */      row.MarketingovaAkce || '',
            /* 48) M_Akce_Od */              M_Akce_Od,
            /* 49) M_Akce_Do */              M_Akce_Do,
            /* 50) M_Akce_Cena */            row.M_Akce_Cena || null,
            /* 51) Dezen */                  row.Dezén || null,
            /* 52) Sirka */                  row["Šířka"] || null,
            /* 53) Profil */                 row.Profil || null,
            /* 54) Rafek */                  row.Ráfek || null,
            /* 55) Obrazek */                row.Obrázek || null,
            /* 56) count */                  row.count || null
          ];

          const insertPlorQuery = `
            INSERT INTO IMPORT_CZS_Analytic_PLOR
            (
              \`Verze\`,
              \`C_Polozky\`,
              \`C_Polozky2\`,
              \`C_Polozky3\`,
              \`C_Polozky4\`,
              \`EAN\`,
              \`EAN2\`,
              \`EAN3\`,
              \`EAN4\`,
              \`Nazev\`,
              \`Rozmer\`,
              \`Cena\`,
              \`CenaPoSleve\`,
              \`AkcniCena\`,
              \`Prodej_cena\`,
              \`Uzivatel\`,
              \`Skupina_radkove_slevy\`,
              \`Vyrobce\`,
              \`Naprava\`,
              \`Provoz\`,
              \`Trida_vyrobce\`,
              \`CenovaSkupina\`,
              \`M_S\`,
              \`TPM_S\`,
              \`Index nosnosti\`,
              \`Index rychlosti\`,
              \`1_eshop\`,
              \`2_pult\`,
              \`3_servis\`,
              \`4_vo\`,
              \`5_vip\`,
              \`6_indiv\`,
              \`7_dopravci\`,
              \`B2B\`,
              \`Stitek\`,
              \`Valivy_odpor\`,
              \`Prilnavost\`,
              \`Hluk_db\`,
              \`TT_TL\`,
              \`Hmotnost\`,
              \`Hloubka_dezenu\`,
              \`Zesileni\`,
              \`VybraneZobrazeni\`,
              \`ZakaznickaSkupina\`,
              \`RNpricelistId\`,
              \`Sleva\`,
              \`Marketingova_akce\`,
              \`M_Akce_Od\`,
              \`M_Akce_Do\`,
              \`M_Akce_Cena\`,
              \`Dezen\`,
              \`Sirka\`,
              \`Profil\`,
              \`Rafek\`,
              \`Obrazek\`,
              \`count\`
            )
            VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?
            )
          `;

          // Provedení query
          connection.query(insertPlorQuery, insertData, (err, plorResult) => {
            if (err) {
              return callback(err);
            }
            callback(null);
          });
        }; // konec insertPlor

        // 6) Vložení všech řádků z `data`
        if (data.length === 0) {
          return connection.commit(err => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error('Chyba při commitování transakce:', err);
                res.status(500).json({
                  message: 'Chyba při commitování transakce.',
                  details: err.message
                });
              });
            }
            connection.release();
            return res.status(200).json({ message: 'Data byla úspěšně uložena.', filterId });
          });
        }

        let countRows = 0;
        let hasError = false;

        data.forEach(row => {
          insertPlor(row, (err) => {
            if (hasError) return;

            if (err) {
              hasError = true;
              return connection.rollback(() => {
                connection.release();
                console.error('Chyba při vkládání do PLOR:', err);
                res.status(500).json({
                  message: 'Chyba při ukládání položky.',
                  details: err.message
                });
              });
            }

            countRows++;
            if (countRows === data.length) {
              // 7) Commit
              connection.commit(err => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error('Chyba při commitování transakce:', err);
                    res.status(500).json({
                      message: 'Chyba při commitování transakce.',
                      details: err.message
                    });
                  });
                }

                connection.release();
                res.status(200).json({
                  message: 'Data byla úspěšně uložena.',
                  filterId
                });
              });
            }
          });
        });
      });
    });
  });
});

// Endpoint pro zneplatnění ceníků v SQL tabulce
app.post('/invalidate-price-lists-in-sql', async (req, res) => {
  const { validFrom, selectedSheet } = req.body;

  console.log('--- [invalidate-price-lists-in-sql] Požadavek přijat ---');
  console.log('Příchozí data:', { validFrom, selectedSheet });

  // Ověření vstupních dat
  if (!validFrom || !selectedSheet) {
    console.warn('[invalidate-price-lists-in-sql] Chybí požadované parametry validFrom nebo selectedSheet.');
    return res.status(200).json({ 
      success: false, 
      message: 'Chybí požadované parametry: "validFrom" nebo "selectedSheet".' 
    });
  }

  let connection;
  try {
    // Připojení k databázi
    console.log('[invalidate-price-lists-in-sql] Získávám databázové spojení...');
    connection = await new Promise((resolve, reject) => {
      poolC5tpms.getConnection((err, conn) => {
        if (err) {
          console.error('[invalidate-price-lists-in-sql] Chyba při získávání databázového spojení:', err);
          return reject(err);
        }
        console.log('[invalidate-price-lists-in-sql] Databázové spojení úspěšně získáno.');
        resolve(conn);
      });
    });

    // Definice SQL dotazu
    const query = `
      UPDATE Analytic_FilterTemplates
      SET validTo = DATE_SUB(STR_TO_DATE(?, '%Y-%m-%d'), INTERVAL 1 DAY)
      WHERE filterURL LIKE ? AND (validTo IS NULL OR validTo >= STR_TO_DATE(?, '%Y-%m-%d'))
    `;

    const filterValuePattern = `%Skupina produktu: ${selectedSheet}%`;
    console.log('[invalidate-price-lists-in-sql] Používám pattern pro filterURL:', filterValuePattern);

    console.log('[invalidate-price-lists-in-sql] Provádím UPDATE dotaz s parametry:', {
      validFromParam: validFrom,
      filterValuePattern,
      validFromFilter: validFrom
    });

    const updateResult = await new Promise((resolve, reject) => {
      connection.query(query, [validFrom, filterValuePattern, validFrom], (err, results) => {
        if (err) {
          console.error('[invalidate-price-lists-in-sql] Chyba při vykonávání SQL dotazu:', err);
          return reject(err);
        }
        console.log('[invalidate-price-lists-in-sql] SQL dotaz proveden. Výsledek:', results);
        resolve(results);
      });
    });

    console.log(`[invalidate-price-lists-in-sql] Počet aktualizovaných záznamů: ${updateResult.affectedRows}`);

    if (updateResult.affectedRows === 0) {
      // Pokud se nic neaktualizovalo, není to technická chyba, jen informace
      console.warn('[invalidate-price-lists-in-sql] Nebyly nalezeny žádné záznamy k aktualizaci.');
      return res.status(200).json({
        success: false,
        message: 'Nebyly nalezeny žádné záznamy k aktualizaci.'
      });
    }

    console.log('[invalidate-price-lists-in-sql] Platnost ceníků byla úspěšně aktualizována.');
    res.status(200).json({ 
      success: true, 
      message: 'Platnost ceníků byla úspěšně aktualizována.' 
    });
  } catch (error) {
    console.error('[invalidate-price-lists-in-sql] Nastala chyba při zpracování požadavku:', error);
    // I v případě chyby se pokusíme vrátit status 200, aby frontend mohl pokračovat dál, bez technické chyby
    // (Pokud ale opravdu jde o technickou chybu, je dobré ji logovat a případně reagovat jinak)
    return res.status(200).json({
      success: false,
      message: 'Došlo k chybě při aktualizaci platnosti ceníků.',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
      console.log('[invalidate-price-lists-in-sql] Databázové spojení uvolněno.');
    }
    console.log('--- [invalidate-price-lists-in-sql] Zpracování požadavku dokončeno ---');
  }
});


app.post('/raynet/update-price-list-in-sql', async (req, res) => {
  // Přijímáme parametry: priceListId, validFrom, validTo, filterName
  const { priceListId, validFrom, validTo, filterName } = req.body;

  // Log vstupních dat
  console.log('Přijatý request pro update-price-list-in-sql:', {
    priceListId,
    validFrom,
    validTo,
    filterName
  });

  // Validace vstupních parametrů
  if (!priceListId) {
    console.error('Chybí priceListId.');
    return res.status(400).json({ message: 'Chybí priceListId.' });
  }
  if (!filterName) {
    console.error('Chybí filterName.');
    return res.status(400).json({ message: 'Chybí filterName.' });
  }

  let connection;
  try {
    connection = await new Promise((resolve, reject) => {
      poolC5tpms.getConnection((err, conn) => {
        if (err) {
          console.error('Chyba při získávání databázového spojení:', err);
          return reject(err);
        }
        console.log('Databázové spojení navázáno.');
        resolve(conn);
      });
    });

    // Sestavení SQL dotazu a hodnot pro update
    const updateQuery = `
      UPDATE Analytic_FilterTemplates 
      SET RNpricelistId = ?,
          validFrom = ?,
          validTo = ?
      WHERE filterName = ?
    `;
    const updateValues = [priceListId, validFrom || null, validTo || null, filterName];
    console.log('Spouštím SQL dotaz:', updateQuery, updateValues);

    const updateResult = await new Promise((resolve, reject) => {
      connection.query(updateQuery, updateValues, (err, results) => {
        if (err) {
          console.error('Chyba při vykonávání SQL dotazu:', err);
          return reject(err);
        }
        resolve(results);
      });
    });

    console.log(`SQL dotaz úspěšně proveden, affectedRows: ${updateResult.affectedRows}`);
    if (updateResult.affectedRows === 0) {
      console.warn(`Nebyly nalezeny žádné záznamy k aktualizaci pro filterName=${filterName}.`);
      return res.status(404).json({ message: 'Nebyly nalezeny žádné záznamy k aktualizaci.' });
    }

    res.status(200).json({ message: 'Ceník v SQL byl aktualizován.' });
  } catch (error) {
    console.error('Chyba při aktualizaci ceníku v SQL:', error);
    res.status(500).json({ message: 'Chyba při aktualizaci ceníku v SQL.', details: error.message });
  } finally {
    if (connection) {
      connection.release();
      console.log('Databázové spojení uvolněno.');
    }
  }
});



// Endpoint pro získání dat z IMPORT_CZS_Analytic_PLOR na základě FilterID (Verze) a platnosti ceníku
app.get('/get-products', async (req, res) => {
  const { filterId } = req.query;

  if (!filterId) {
    return res.status(400).json({ message: 'FilterID nebylo poskytnuto.' });
  }

  let connection;
  try {
    connection = await new Promise((resolve, reject) => {
      poolC5tpms.getConnection((err, conn) => {
        if (err) {
          console.error('Chyba při získání připojení k databázi:', err);
          return reject(err);
        } else {
          resolve(conn);
        }
      });
    });

    // Získání aktuálního data ve formátu YYYY-MM-DD
    const currentDate = new Date().toISOString().split('T')[0];

    // Dotaz pro získání aktivních ceníků
    const query = `
      SELECT plor.*, aft.isActive, aft.validFrom, aft.validTo
      FROM IMPORT_CZS_Analytic_PLOR AS plor
      JOIN Analytic_FilterTemplates AS aft ON plor.Verze = aft.filterId
      WHERE plor.Verze = ?
      
    `;

    const products = await new Promise((resolve, reject) => {
      connection.query(query, [filterId, currentDate, currentDate], (err, results) => {
        if (err) {
          console.error('Chyba při vykonání SQL dotazu:', err);
          return reject(err);
        }
        resolve(results);
      });
    });

    // Kontrola, zda byly nalezeny produkty
    if (products.length === 0) {
      return res.status(404).json({ message: 'Žádná data nebyla nalezena pro zadaný filterId.' });
    }

    // Vrácení nalezených produktů
    res.status(200).json(products);
  } catch (error) {
    console.error('Chyba při načítání dat:', error);
    res.status(500).json({ message: 'Vnitřní chyba serveru při načítání dat.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});



// app.post('/applyMarketingActions', ...)
// Předpokládám, že máte dostupný objekt poolC5pneutyres (pro ceníky)
// a také poolC5tpms (pro tabulku Import_GY) 
// a pomocné funkce loadPricingData, combinePriorityMaps, loadBaseDiscounts, customerGroups atd.
// Zde je kompletní endpoint:

app.post('/applyMarketingActions', async (req, res) => {
  console.log('Received request to /applyMarketingActions');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  try {
    const { data, sheetName } = req.body;
    if (!sheetName) {
      console.warn('sheetName is missing in the request.');
      return res.status(400).json({ message: 'sheetName is required.' });
    }

    if (!Array.isArray(data) || data.length === 0) {
      console.warn('Validation failed: No data provided.');
      return res.status(400).json({ message: 'No data provided.' });
    }

    // 1. Načtení marketingových dat pro všechny skupiny
    const finalMarketingMaps = {};

    for (const group of customerGroups) {
      console.log(`=== Loading marketing data for group: ${group} ===`);

      // Načtení dat z vyprodej
      const vyprodejMap = await loadPricingData(
        'IMPORT_CZS_Kalkulace_cen_vyprodej',
        group,
        'Výprodej',
        poolC5pneutyres
      );

      // Načtení dat z akce_polozka
      const akceMap = await loadPricingData(
        'IMPORT_CZS_Kalkulace_cen_akce_polozka',
        group,
        'Akce položka',
        poolC5pneutyres
      );

      // Načtení dat z netto
      const nettoMap = await loadPricingData(
        'IMPORT_CZS_Kalkulace_cen_netto',
        group,
        'Netto',
        poolC5pneutyres
      );

      // Kombinace map s prioritou
      const combinedMap = combinePriorityMaps(vyprodejMap, akceMap, nettoMap);
      finalMarketingMaps[group] = combinedMap;

      console.log(`Final marketing map for group ${group} has ${combinedMap.size} entries.`);
    }

    // 2. Načtení základních slev podle sheetName
    const baseDiscounts = await loadBaseDiscounts(poolC5pneutyres, sheetName);
    console.log('Loaded base discounts:', baseDiscounts);

    // 2.1. Načtení dat z c5tpms.Import_GY (doplnění Nakoupeno, Skladem, SklademKc)
    const importGyRows = await new Promise((resolve, reject) => {
      poolC5tpms.query(
        'SELECT C_Polozky, Nakoupeno, Skladem, SklademKc FROM Import_GY',
        (error, results) => {
          if (error) return reject(error);
          resolve(results);
        }
      );
    });

    const gyDataMap = new Map();
    importGyRows.forEach(row => {
      if (row.C_Polozky) {
        gyDataMap.set(row.C_Polozky, row);
      }
    });
    console.log(`Loaded ${gyDataMap.size} rows from Import_GY.`);

    // 2.2. Načtení nákupních podmínek z tabulky IMPORT_CZS_Kalkulace_cen_nakupni_podminky
    //     (podle sheetName = Cenove_skupiny)
    let slevaPercent = 0;
    let foundPurchaseCond = false;
    try {
      const purchaseRows = await new Promise((resolve, reject) => {
        poolC5pneutyres.query(
          'SELECT * FROM IMPORT_CZS_Kalkulace_cen_nakupni_podminky WHERE Cenove_skupiny = ?',
          [sheetName],
          (error, results) => {
            if (error) return reject(error);
            resolve(results);
          }
        );
      });
      if (purchaseRows && purchaseRows.length > 0) {
        foundPurchaseCond = true;
        const row = purchaseRows[0];
        slevaPercent = parseFloat(row.Sleva) || 0;
        console.log(`Loaded purchase condition for sheetName=${sheetName}, Sleva=${slevaPercent}%`);
      } else {
        console.log(`No purchase condition found for sheetName=${sheetName}`);
      }
    } catch (err) {
      console.error('Error loading purchase conditions:', err);
    }

    // 2.3. Načtení dat z tabulky IMPORT_CZS_Kalkulace_cen_nakupni_akce (Invoice_price2 pro C_Polozky)
    const importNakupniAkceRows = await new Promise((resolve, reject) => {
      poolC5pneutyres.query(
        'SELECT C_Polozky, Invoice_price2 FROM IMPORT_CZS_Kalkulace_cen_nakupni_akce',
        (error, results) => {
          if (error) return reject(error);
          resolve(results);
        }
      );
    });
    const nakupniAkceMap = new Map();
    importNakupniAkceRows.forEach(row => {
      if (row.C_Polozky) {
        nakupniAkceMap.set(row.C_Polozky, row.Invoice_price2);
      }
    });
    console.log(`Loaded ${nakupniAkceMap.size} rows from IMPORT_CZS_Kalkulace_cen_nakupni_akce.`);

    // 2.4. Načtení dat z tabulky IMPORT_CZS_ProduktyB2B (SPILowestPrice podle PartNo)
    let produktyB2BMap = new Map();
    try {
      const importProduktyB2BRows = await new Promise((resolve, reject) => {
        poolC5pneutyres.query(
          'SELECT PartNo, SPILowestPrice FROM IMPORT_CZS_ProduktyB2B',
          (error, results) => {
            if (error) return reject(error);
            resolve(results);
          }
        );
      });
      importProduktyB2BRows.forEach(row => {
        if (row.PartNo) {
          produktyB2BMap.set(row.PartNo, row.SPILowestPrice);
        }
      });
      console.log(`Loaded ${produktyB2BMap.size} rows from IMPORT_CZS_ProduktyB2B.`);
    } catch (err) {
      console.error('Error loading IMPORT_CZS_ProduktyB2B data:', err);
      // Pokud je načítání kritické, můžeš zvážit vrácení chyby
      // return res.status(500).json({ message: 'Error loading product data.' });
    }

    // 3. Zpracování každé položky dat a aplikace marketingových akcí
    console.log('Processing data items to apply marketing actions.');
    const updatedData = data.map((item, index) => {
      console.log(`Processing item ${index + 1}/${data.length}: C_Polozky=${item.C_Polozky}`);

      const updatedItem = { ...item };

      // Parse původní cena (z "Cena")
      const originalCena = parseFloat(item.Cena) || 0;

      // --- Marketingová logika pro jednotlivé skupiny ---
      customerGroups.forEach(group => {
        const marketingMap = finalMarketingMaps[group];
        let finalPrice = originalCena;
        let marketingAction = '';
        let platnostOd = null;
        let platnostDo = null;

        if (marketingMap && marketingMap.has(item.C_Polozky)) {
          const marketingInfo = marketingMap.get(item.C_Polozky);
          finalPrice = marketingInfo.Cena ? Math.round(marketingInfo.Cena) : originalCena;
          marketingAction = marketingInfo.MarketingovaAkce || '';
          platnostOd = marketingInfo.PlatnostOd || null;
          platnostDo = marketingInfo.PlatnostDo || null;
          console.log(
            `Group ${group}: Found marketing price ${finalPrice} (${marketingAction}) for C_Polozky=${item.C_Polozky}`
          );
        } else if (baseDiscounts[group] > 0) {
          finalPrice = Math.round(originalCena * (1 - baseDiscounts[group] / 100));
          marketingAction = 'Základní sleva';
          console.log(
            `Group ${group}: Applied base discount ${baseDiscounts[group]}%, finalPrice=${finalPrice}`
          );
        } else {
          console.log(
            `Group ${group}: No marketing price or discount applied, finalPrice remains ${finalPrice}`
          );
        }

        // Uložení výsledné ceny a marketing akce do sloupců (např. "1_eshop", "2_pult"...)
        updatedItem[group] = String(finalPrice);
        updatedItem[`MarketingovaAkce_${group}`] = marketingAction;
        updatedItem[`PlatnostOd_${group}`] = platnostOd;
        updatedItem[`PlatnostDo_${group}`] = platnostDo;
      });

      // --- Doplnění údajů z tabulky Import_GY (pokud existují) ---
      const gyRow = gyDataMap.get(item.C_Polozky);
      if (gyRow) {
        updatedItem.Nakoupeno = gyRow.Nakoupeno;
        updatedItem.Skladem = gyRow.Skladem;
        updatedItem.SklademKc = gyRow.SklademKc;
      } else {
        updatedItem.Nakoupeno = '';
        updatedItem.Skladem = '';
        updatedItem.SklademKc = '';
      }

      // --- Výpočet Nákup - základní sleva (z Prodej_cena, pokud není, tak z Cena) ---
      if (foundPurchaseCond) {
        const priceToDiscount =
          parseFloat(updatedItem.Prodej_cena) || parseFloat(updatedItem.Cena) || 0;

        updatedItem.Sleva = String(slevaPercent);
        updatedItem.Nakup_zakladni_sleva = String(
          Math.round(priceToDiscount * (1 - slevaPercent / 100))
        );
      } else {
        updatedItem.Sleva = '0';
        updatedItem.Nakup_zakladni_sleva = '0';
      }

      // --- Doplnění pole Nakupni_akce z tabulky IMPORT_CZS_Kalkulace_cen_nakupni_akce ---
      // (pokud existuje pro danou C_Polozky)
      const invoicePrice2 = nakupniAkceMap.get(item.C_Polozky) || '';
      updatedItem.Nakupni_akce = invoicePrice2;

      // --- Doplnění SPILowestPrice z IMPORT_CZS_ProduktyB2B ---
      const spiLowestPrice = produktyB2BMap.get(item.C_Polozky);
      if (spiLowestPrice !== undefined && spiLowestPrice !== null) {
        updatedItem.SPILowestPrice = String(spiLowestPrice);
        console.log(`Set SPILowestPrice=${spiLowestPrice} for C_Polozky=${item.C_Polozky}`);
      } else {
        updatedItem.SPILowestPrice = '';
        console.log(`No SPILowestPrice found for C_Polozky=${item.C_Polozky}`);
      }

      return updatedItem;
    });

    console.log('All data items processed successfully.');
    res.json({ data: updatedData });
  } catch (error) {
    console.error('Error processing data:', error);
    res.status(500).send('Internal server error.');
  }
});




// Endpoint pro aktualizaci prodejních cen
app.post('/update-sales-prices', async (req, res) => {
  const { version, selectedPriceGroup } = req.body;

  // Validace vstupních parametrů
  if (!version || !selectedPriceGroup) {
    return res.status(400).json({ message: 'Verze a cenová skupina jsou povinné.' });
  }

  let tpmsConnection, pneutyresConnection;
  try {
    // Připojení k databázím
    tpmsConnection = await new Promise((resolve, reject) => {
      poolC5tpms.getConnection((err, conn) => {
        if (err) return reject(err);
        resolve(conn);
      });
    });

    pneutyresConnection = await new Promise((resolve, reject) => {
      poolC5pneutyres.getConnection((err, conn) => {
        if (err) return reject(err);
        resolve(conn);
      });
    });

    console.log(`Začínám aktualizaci Prodej_cena pro Verze=${version}, Cenová skupina=${selectedPriceGroup}`);

    // 1. Získání 'CenovaSkupina' na základě 'Skupina produktu' z Analytic_FilterTemplates
    const cenovaSkupinaQuery = `
      SELECT 
        TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(filterValues, 'Cenová skupina: ', -1), ';', 1)) AS CenovaSkupina
      FROM Analytic_FilterTemplates
      WHERE filterValues LIKE ?
      LIMIT 1
    `;

    const cenovaSkupinaResults = await new Promise((resolve, reject) => {
      tpmsConnection.query(cenovaSkupinaQuery, [`%Skupina produktu: ${selectedPriceGroup}%`], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    if (cenovaSkupinaResults.length === 0 || !cenovaSkupinaResults[0].CenovaSkupina) {
      return res.status(404).json({ message: `Cenová skupina pro skupinu produktu '${selectedPriceGroup}' nebyla nalezena.` });
    }

    const cenovaSkupina = cenovaSkupinaResults[0].CenovaSkupina.trim();
    console.log(`Mapováno selectedPriceGroup '${selectedPriceGroup}' na CenovaSkupina '${cenovaSkupina}'`);

    // 2. Získání slevy z tabulky základních slev
    const discountQuery = `
      SELECT
        ?? AS discountPercentage
      FROM IMPORT_CZS_Kalkulace_cen_zakladni_slevy
      WHERE cenove_skupiny = ?
      LIMIT 1
    `;

    const discountResults = await new Promise((resolve, reject) => {
      pneutyresConnection.query(discountQuery, [cenovaSkupina, selectedPriceGroup], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    if (discountResults.length === 0 || !discountResults[0].discountPercentage) {
      return res.status(404).json({ message: `Sleva pro zákaznickou skupinu '${cenovaSkupina}' a cenovou skupinu '${selectedPriceGroup}' nebyla nalezena.` });
    }

    const discountPercentage = parseFloat(discountResults[0].discountPercentage);
    console.log(`Získaná sleva pro zákaznickou skupinu '${cenovaSkupina}': ${discountPercentage}%`);

    // 3. Načtení produktů z IMPORT_CZS_Analytic_PLOR
    const productsQuery = `
      SELECT Verze, C_Polozky, Prodej_cena AS CenaZakl
      FROM IMPORT_CZS_Analytic_PLOR
      WHERE Verze = ?
    `;

    const products = await new Promise((resolve, reject) => {
      tpmsConnection.query(productsQuery, [version], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    console.log(`Načteno produktů pro Verze=${version}: ${products.length}`);

    if (products.length === 0) {
      return res.status(404).json({ message: `Žádné produkty nalezeny pro Verze='${version}'.` });
    }

    // 4. Aktualizace Prodej_cena
    const updatePromises = products.map(product => {
      const { C_Polozky, CenaZakl } = product;
      const cena = parseFloat(CenaZakl) || 0;
      const cenaPoSleve = Math.round(cena * (1 - discountPercentage / 100));

      console.log(`Produkt: ${C_Polozky}, CenaZakl: ${cena}, CenaPoSleve: ${cenaPoSleve} (Sleva: ${discountPercentage}%)`);

      return new Promise((resolve, reject) => {
        // Aktualizace Prodej_cena v tabulce IMPORT_CZS_Ceny_B2B
        const updateQuery = `
          UPDATE IMPORT_CZS_Ceny_B2B 
          SET Prodej_cena = ? 
          WHERE Verze = ? AND C_Polozky = ?
        `;
        pneutyresConnection.query(updateQuery, [cenaPoSleve, version, C_Polozky], (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });
    });

    await Promise.all(updatePromises);

    console.log(`Prodejní ceny byly úspěšně aktualizovány.`);
    res.status(200).json({ message: 'Prodejní ceny byly úspěšně aktualizovány.' });

  } catch (error) {
    console.error('Chyba při aktualizaci prodejních cen:', error);
    res.status(500).json({ message: 'Chyba při aktualizaci prodejních cen.', details: error.message });
  } finally {
    if (tpmsConnection) {
      tpmsConnection.release();
      console.log('Databázové spojení TPMS bylo uvolněno.');
    }
    if (pneutyresConnection) {
      pneutyresConnection.release();
      console.log('Databázové spojení Pneutyres bylo uvolněno.');
    }
  }
});

// GET /get-discount - Načtení slevy podle cenové a zákaznické skupiny
app.get('/get-discount', (req, res) => {
  const { sheetName, customerGroup } = req.query;  // Upraveno pro použití sheetName a customerGroup

  if (!sheetName || !customerGroup) {
    return res.status(400).json({ error: 'Musíte zadat cenovou skupinu (sheetName) a zákaznickou skupinu (customerGroup)' });
  }

  // Příprava SQL dotazu
  const query = `SELECT ?? FROM IMPORT_CZS_Kalkulace_cen_zakladni_slevy WHERE cenove_skupiny = ?`;

  // Vložení proměnných do dotazu
  poolC5pneutyres.query(query, [customerGroup, sheetName], (error, results) => {
    if (error) {
      console.error('Chyba při načítání slevy:', error);
      return res.status(500).json({ error: 'Chyba při načítání slevy' });
    }

    // Kontrola, zda byly nalezeny nějaké výsledky
    if (results.length === 0) {
      return res.status(404).json({ error: 'Sleva nebyla nalezena' });
    }

    // Vrácení slevy
    res.status(200).json({ sleva: results[0][customerGroup] });
  });
});


// GET /sirka
app.get('/sirka', (req, res) => {
  poolC5tpms.query('SELECT id, value, synonyms FROM sirka', (error, results) => {
    if (error) {
      console.error('Chyba při načítání dat z tabulky pozice:', error);
      return res.status(500).json({ error: 'Chyba při načítání dat z tabulky pozice' });
    }
    console.log('Sending Pozice Data:', results); // Logování dat, která jsou odesílána
    res.status(200).json(results);
  });
});

// GET /profil
app.get('/profil', (req, res) => {
  poolC5tpms.query('SELECT id, value, synonyms FROM profil', (error, results) => {
    if (error) {
      console.error('Chyba při načítání dat z tabulky pozice:', error);
      return res.status(500).json({ error: 'Chyba při načítání dat z tabulky pozice' });
    }
    console.log('Sending Pozice Data:', results); // Logování dat, která jsou odesílána
    res.status(200).json(results);
  });
});

// GET /rafek
app.get('/rafek', (req, res) => {
  poolC5tpms.query('SELECT id, value, synonyms FROM rafek', (error, results) => {
    if (error) {
      console.error('Chyba při načítání dat z tabulky pozice:', error);
      return res.status(500).json({ error: 'Chyba při načítání dat z tabulky pozice' });
    }
    console.log('Sending Pozice Data:', results); // Logování dat, která jsou odesílána
    res.status(200).json(results);
  });
});

// GET /dezen
app.get('/dezen', (req, res) => {
  poolC5tpms.query('SELECT id, value, synonyms FROM dezen', (error, results) => {
    if (error) {
      console.error('Chyba při načítání dat z tabulky pozice:', error);
      return res.status(500).json({ error: 'Chyba při načítání dat z tabulky pozice' });
    }
    console.log('Sending Pozice Data:', results); // Logování dat, která jsou odesílána
    res.status(200).json(results);
  });
});

// GET /ms
app.get('/ms', (req, res) => {
  poolC5tpms.query('SELECT id, value, synonyms FROM ms', (error, results) => {
    if (error) {
      console.error('Chyba při načítání dat z tabulky pozice:', error);
      return res.status(500).json({ error: 'Chyba při načítání dat z tabulky pozice' });
    }
    console.log('Sending Pozice Data:', results); // Logování dat, která jsou odesílána
    res.status(200).json(results);
  });
});

// GET /tpmsf
app.get('/tpmsf', (req, res) => {
  poolC5tpms.query('SELECT id, value, synonyms FROM tpmsf', (error, results) => {
    if (error) {
      console.error('Chyba při načítání dat z tabulky pozice:', error);
      return res.status(500).json({ error: 'Chyba při načítání dat z tabulky pozice' });
    }
    console.log('Sending Pozice Data:', results); // Logování dat, která jsou odesílána
    res.status(200).json(results);
  });
});

// POST /ms_synonymum
app.post('/ms_synonymum', (req, res) => {
  const { existingValue, newSynonym } = req.body;
  // Načteme stávající synonyms
  poolC5tpms.query(
    'SELECT synonyms FROM ms WHERE value = ?',
    [existingValue],
    (error, results) => {
      if (error) {
        console.error('Chyba při hledání existingValue v ms:', error);
        return res.status(500).json({ error: 'Chyba při hledání existingValue.' });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: 'Hodnota nebyla nalezena.' });
      }
      const oldSynonyms = results[0].synonyms || '';
      const synonymsArr = oldSynonyms
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== '');

      if (synonymsArr.includes(newSynonym)) {
        // Synonymum už existuje
        return res.status(400).json({ error: 'Synonymum již existuje.' });
      }
      const newSynonyms = [...synonymsArr, newSynonym].join(', ');

      // Aktualizace
      poolC5tpms.query(
        'UPDATE ms SET synonyms = ? WHERE value = ?',
        [newSynonyms, existingValue],
        (errUpdate) => {
          if (errUpdate) {
            console.error('Chyba při update synonyms v ms:', errUpdate);
            return res.status(500).json({ error: 'Chyba při update synonyms v ms.' });
          }
          return res.status(200).json({ success: true, message: 'Synonymum přidáno.' });
        }
      );
    }
  );
});


// POST /ms_add
app.post('/ms_add', (req, res) => {
  const { value, synonyms } = req.body;
  if (!value) {
    return res.status(400).json({ error: 'Pole "value" je povinné.' });
  }
  poolC5tpms.query(
    'INSERT INTO ms (value, synonyms) VALUES (?, ?)',
    [value, synonyms || ''],
    (error) => {
      if (error) {
        console.error('Chyba při insert do ms:', error);
        return res.status(500).json({ error: 'Chyba při insert do ms.' });
      }
      return res.status(201).json({ success: true, message: 'Nová hodnota přidána do ms.' });
    }
  );
});

// POST /sirka_synonymum
app.post('/sirka_synonymum', (req, res) => {
  const { existingValue, newSynonym } = req.body;
  // Načteme stávající synonyms
  poolC5tpms.query(
    'SELECT synonyms FROM sirka WHERE value = ?',
    [existingValue],
    (error, results) => {
      if (error) {
        console.error('Chyba při hledání existingValue v ms:', error);
        return res.status(500).json({ error: 'Chyba při hledání existingValue.' });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: 'Hodnota nebyla nalezena.' });
      }
      const oldSynonyms = results[0].synonyms || '';
      const synonymsArr = oldSynonyms
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== '');

      if (synonymsArr.includes(newSynonym)) {
        // Synonymum už existuje
        return res.status(400).json({ error: 'Synonymum již existuje.' });
      }
      const newSynonyms = [...synonymsArr, newSynonym].join(', ');

      // Aktualizace
      poolC5tpms.query(
        'UPDATE sirka SET synonyms = ? WHERE value = ?',
        [newSynonyms, existingValue],
        (errUpdate) => {
          if (errUpdate) {
            console.error('Chyba při update synonyms v ms:', errUpdate);
            return res.status(500).json({ error: 'Chyba při update synonyms v ms.' });
          }
          return res.status(200).json({ success: true, message: 'Synonymum přidáno.' });
        }
      );
    }
  );
});


// POST /sirka_add
app.post('/sirka_add', (req, res) => {
  const { value, synonyms } = req.body;
  if (!value) {
    return res.status(400).json({ error: 'Pole "value" je povinné.' });
  }
  poolC5tpms.query(
    'INSERT INTO sirka (value, synonyms) VALUES (?, ?)',
    [value, synonyms || ''],
    (error) => {
      if (error) {
        console.error('Chyba při insert do ms:', error);
        return res.status(500).json({ error: 'Chyba při insert do ms.' });
      }
      return res.status(201).json({ success: true, message: 'Nová hodnota přidána do ms.' });
    }
  );
});


// GET /pozice
app.get('/pozice', (req, res) => {
  poolC5tpms.query('SELECT id, value, synonyms, ps_id FROM pozice', (error, results) => {
    if (error) {
      console.error('Chyba při načítání dat z tabulky pozice:', error);
      return res.status(500).json({ error: 'Chyba při načítání dat z tabulky pozice' });
    }
    console.log('Sending Pozice Data:', results); // Logování dat, která jsou odesílána
    res.status(200).json(results);
  });
});

// GET /zesileni
app.get('/zesileni', (req, res) => {
  poolC5tpms.query('SELECT id, value, synonyms FROM zesileni', (error, results) => {
    if (error) {
      console.error('Chyba při načítání dat z tabulky pozice:', error);
      return res.status(500).json({ error: 'Chyba při načítání dat z tabulky pozice' });
    }
    console.log('Sending Pozice Data:', results); // Logování dat, která jsou odesílána
    res.status(200).json(results);
  });
});
// GET /zpusob_uziti
app.get('/zpusob_uziti', (req, res) => {
  poolC5tpms.query('SELECT id, value, ps_id, synonyms FROM zpusob_uziti', (error, results) => {
    if (error) {
      console.error('Chyba při načítání dat z tabulky pozice:', error);
      return res.status(500).json({ error: 'Chyba při načítání dat z tabulky pozice' });
    }
    console.log('Sending Pozice Data:', results); // Logování dat, která jsou odesílána
    res.status(200).json(results);
  });
});

// GET /index_nosnosti
app.get('/index_nosnosti', (req, res) => {
  poolC5tpms.query('SELECT id, value, synonyms FROM index_nosnosti', (error, results) => {
    if (error) {
      console.error('Chyba při načítání dat z tabulky index_nosnosti:', error);
      return res.status(500).json({ error: 'Chyba při načítání dat z tabulky pozice' });
    }
    console.log('Sending Pozice Data:', results); // Logování dat, která jsou odesílána
    res.status(200).json(results);
  });
});

// GET /index_rychlosti
app.get('/index_rychlosti', (req, res) => {
  poolC5tpms.query('SELECT id, value, synonyms FROM index_rychlosti', (error, results) => {
    if (error) {
      console.error('Chyba při načítání dat z tabulky index_rychlosti:', error);
      return res.status(500).json({ error: 'Chyba při načítání dat z tabulky pozice' });
    }
    console.log('Sending Pozice Data:', results); // Logování dat, která jsou odesílána
    res.status(200).json(results);
  });
});

// Endpoint pro získání dodatečních informací pro importexportmodal
app.get('/get-details-from-sheet', async (req, res) => {
  const { sheetName } = req.query;
  if (!sheetName || sheetName.length !== 7) {
    return res.status(400).send("Invalid sheet name");
  }

  try {
    const query = `
      SELECT 
        manufacturer,
        (SELECT description FROM skupiny_polozek_kategorie WHERE name = SUBSTRING(?, 3, 3)) AS category,
        (SELECT description FROM skupiny_polozek_druh WHERE name = SUBSTRING(?, 6, 2)) AS type
      FROM skupiny_polozek
      WHERE name = ?;
    `;
    
    poolC5tpms.query(query, [sheetName, sheetName, sheetName], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Chyba serveru");
      }

      if (result.length === 0) {
        return res.status(404).send("No data found for the sheet");
      }

      res.json(result[0]);
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});




app.get('/catalogs', async (req, res) => {
  try {
    poolC5tpms.query('SELECT * FROM catalogs', (err, results) => {
      if (err) return res.status(500).send('Chyba serveru');
      
      const updatedResults = results.map(catalog => ({
        ...catalog,
        columns: JSON.parse(catalog.columns), // Pokud jsou sloupce uložené jako JSON, je potřeba je parsovat
      }));

      res.json(updatedResults);
    });
  } catch (err) {
    console.error('Chyba při načítání číselníků:', err);
    res.status(500).send('Chyba serveru');
  }
});



// Endpoint pro získání struktury číselníku
app.get('/catalogs/:id/structure', async (req, res) => {
  const { id } = req.params;
  try {
    const [catalog] = await new Promise((resolve, reject) => {
      poolC5tpms.query('SELECT * FROM catalogs WHERE id = ?', [id], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
    if (!catalog) {
      return res.status(404).send('Číselník nenalezen');
    }
    res.json(catalog);
  } catch (err) {
    console.error('Chyba při získávání struktury číselníku:', err);
    res.status(500).send('Chyba serveru');
  }
});

app.post('/catalogs', async (req, res) => {
  const { name, description, columns } = req.body;

  if (!name || !columns) {
    return res.status(400).send('Název a sloupce jsou povinné');
  }

  try {
    await new Promise((resolve, reject) => {
      poolC5tpms.query(
        'INSERT INTO catalogs (name, description, columns) VALUES (?, ?, ?)',
        [name, description, JSON.stringify(columns)],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });
    res.status(201).send('Číselník úspěšně přidán');
  } catch (err) {
    console.error('Chyba při přidávání nového číselníku:', err);
    res.status(500).send('Chyba serveru');
  }
});



// Endpoint pro získání cen B2B se základními, netto, akčními a výprodejovými slevami
app.get('/getCurrentB2BProductAndPrices', async (req, res) => {
  try {
    // Připojení k MSSQL
    await sql.connect(mssqlConfig);
    const request = new sql.Request();
    
    // Základní dotaz z MSSQL s podmínkou pro ItsWebAvailableB2B
    let query = `
      SELECT 
          [ItemId] AS PartNo,
          [ItemName] AS Name,
          [ItsItemName3] AS Manufacturer,
          [ItsItemEAN] AS EAN,
          [ExternalItemId] AS CodeInternal1,
          [PurchLineDisc], -- Potřebné pro propojení s tabulkou základních slev
          [SalesPrice] -- Základní cena produktu
      FROM [AxProdCS].[dbo].[ItsIFInventTable]
      WHERE [ItsWebAvailableB2B] = 'Ano'
    `;

    const mssqlResults = await request.query(query);
    const products = mssqlResults.recordset;

    // Připojení k MySQL pro základní slevy
    const mysqlBaseDiscountQuery = `
      SELECT
        cenove_skupiny,
        B2B AS discountPercentage
      FROM IMPORT_CZS_Kalkulace_cen_zakladni_slevy
    `;

    const baseDiscountResults = await new Promise((resolve, reject) => {
      poolC5pneutyres.query(mysqlBaseDiscountQuery, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    // Mapování slev na cenové skupiny
    const discountMap = new Map();
    baseDiscountResults.forEach(row => {
      discountMap.set(row.cenove_skupiny, parseFloat(row.discountPercentage));
    });

    // Připojení k MySQL pro netto ceny
    const mysqlNettoQuery = `
      SELECT
        polozka AS PartNo,
        B2B AS nettoPrice,
        platnost_od,
        platnost_do,
        Aktivni
      FROM IMPORT_CZS_Kalkulace_cen_netto
      WHERE Aktivni = 1
    `;

    const nettoResults = await new Promise((resolve, reject) => {
      poolC5pneutyres.query(mysqlNettoQuery, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    // Mapování netto cen na ItemId a zohlednění časové platnosti
    const nettoPriceMap = new Map();
    const today = new Date();

    nettoResults.forEach(row => {
      const { PartNo, nettoPrice, platnost_od, platnost_do } = row;
      const validFrom = platnost_od ? new Date(platnost_od) : null;
      const validTo = platnost_do ? new Date(platnost_do) : null;

      if ((!validFrom || validFrom <= today) && (!validTo || validTo >= today)) {
        nettoPriceMap.set(PartNo, {
          price: parseFloat(nettoPrice),
          validFrom,
          validTo,
        });
      }
    });

    // Připojení k MySQL pro akční ceny
    const mysqlAkceQuery = `
      SELECT
        polozka AS PartNo,
        B2B AS akcePrice,
        platnost_od,
        platnost_do,
        Aktivni
      FROM IMPORT_CZS_Kalkulace_cen_akce_polozka
      WHERE Aktivni = 1
    `;

    const akceResults = await new Promise((resolve, reject) => {
      poolC5pneutyres.query(mysqlAkceQuery, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    // Mapování akčních cen na ItemId a zohlednění časové platnosti
    const akcePriceMap = new Map();
    akceResults.forEach(row => {
      const { PartNo, akcePrice, platnost_od, platnost_do } = row;
      const validFrom = platnost_od ? new Date(platnost_od) : null;
      const validTo = platnost_do ? new Date(platnost_do) : null;

      if ((!validFrom || validFrom <= today) && (!validTo || validTo >= today)) {
        akcePriceMap.set(PartNo, {
          price: parseFloat(akcePrice),
          validFrom,
          validTo,
        });
      }
    });

    // Připojení k MySQL pro výprodejové ceny
    const mysqlVyprodejQuery = `
      SELECT
        polozka AS PartNo,
        B2B AS vyprodejPrice,
        platnost_od,
        platnost_do,
        Aktivni
      FROM IMPORT_CZS_Kalkulace_cen_vyprodej
      WHERE Aktivni = 1
    `;

    const vyprodejResults = await new Promise((resolve, reject) => {
      poolC5pneutyres.query(mysqlVyprodejQuery, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    // Mapování výprodejových cen na ItemId a zohlednění časové platnosti
    const vyprodejPriceMap = new Map();
    vyprodejResults.forEach(row => {
      const { PartNo, vyprodejPrice, platnost_od, platnost_do } = row;
      const validFrom = platnost_od ? new Date(platnost_od) : null;
      const validTo = platnost_do ? new Date(platnost_do) : null;

      if ((!validFrom || validFrom <= today) && (!validTo || validTo >= today)) {
        vyprodejPriceMap.set(PartNo, {
          price: parseFloat(vyprodejPrice),
          validFrom,
          validTo,
        });
      }
    });

    // Výpočet ceny po slevě pro každý produkt s prioritou pravidel
    const productsWithPrices = products.map(product => {
      let finalPrice = parseFloat(product.SalesPrice);
      let priceRuleApplied = "Base Price"; // Výchozí pravidlo, pokud se žádné jiné neuplatní
      let discountPercentage = 0; // Výchozí hodnota, pokud není žádná sleva
      let validFrom = null;
      let validTo = null;

      const baseDiscountPercentage = discountMap.get(product.PurchLineDisc) || 0;
      const baseDiscountedPrice = finalPrice * (1 - baseDiscountPercentage / 100);

      const vyprodejInfo = vyprodejPriceMap.get(product.PartNo);
      const akceInfo = akcePriceMap.get(product.PartNo);
      const nettoInfo = nettoPriceMap.get(product.PartNo);

      if (vyprodejInfo !== undefined) {
        finalPrice = vyprodejInfo.price;
        priceRuleApplied = "Vyprodej Price";
        validFrom = vyprodejInfo.validFrom;
        validTo = vyprodejInfo.validTo;
        discountPercentage = 0; // Nastavíme na 0, protože výprodej přepíše jakoukoli jinou slevu
      } else if (akceInfo !== undefined) {
        finalPrice = akceInfo.price;
        priceRuleApplied = "Akce Price";
        validFrom = akceInfo.validFrom;
        validTo = akceInfo.validTo;
        discountPercentage = 0; // Nastavíme na 0, protože akce přepíše základní slevu
      } else if (nettoInfo !== undefined) {
        finalPrice = nettoInfo.price;
        priceRuleApplied = "Netto Price";
        validFrom = nettoInfo.validFrom;
        validTo = nettoInfo.validTo;
        discountPercentage = 0; // Nastavíme na 0, protože netto přepíše základní slevu
      } else {
        finalPrice = baseDiscountedPrice;
        discountPercentage = baseDiscountPercentage;
        priceRuleApplied = discountPercentage > 0 ? "Base Discount" : "No Discount";
      }

      return {
        PartNo: product.PartNo,
        Name: product.Name,
        Manufacturer: product.Manufacturer,
        EAN: product.EAN,
        CodeInternal1: product.CodeInternal1,
        PurchLineDisc: product.PurchLineDisc,
        SalesPrice: parseFloat(product.SalesPrice).toFixed(2),
        DiscountPercentage: discountPercentage.toFixed(2),
        FinalPrice: finalPrice.toFixed(2),
        PriceRuleApplied: priceRuleApplied, // Nový sloupec pro identifikaci použitého pravidla
        ValidFrom: validFrom ? validFrom.toISOString().split('T')[0] : null,
        ValidTo: validTo ? validTo.toISOString().split('T')[0] : null
      };
    });

    // Připojení k MySQL pro vymazání a naplnění tabulky IMPORT_CZS_Ceny_B2B
    const deleteB2BQuery = `DELETE FROM IMPORT_CZS_Ceny_B2B`;
    await new Promise((resolve, reject) => {
      poolC5pneutyres.query(deleteB2BQuery, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    // Vložení nových dat do tabulky IMPORT_CZS_Ceny_B2B
    const insertB2BQuery = `
      INSERT INTO IMPORT_CZS_Ceny_B2B 
      (C_Polozky, Nazev, Nazev3, Prodej, EAN, Sleva, C_Ext, Marketingova_akce, M_akce_od, M_akce_do) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const product of productsWithPrices) {
      // Pokud je aktivní základní sleva, nastavíme `Prodej` na původní cenu bez slevy
      const salePrice = product.PriceRuleApplied === "Base Discount" ? product.SalesPrice : product.FinalPrice;

      const insertValues = [
        product.PartNo,
        product.Name,
        product.Manufacturer,
        salePrice, // Použití původní ceny pro základní slevu
        product.EAN,
        product.DiscountPercentage,
        product.CodeInternal1,
        product.PriceRuleApplied,
        product.ValidFrom,
        product.ValidTo
      ];

      await new Promise((resolve, reject) => {
        poolC5pneutyres.query(insertB2BQuery, insertValues, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });
    }

    // Odstranění záznamů v tabulce IMPORT_CZS_Ceny_B2B, které mají odpovídající produkty ve zdrojových tabulkách, ale jsou nyní neaktivní
    const deleteInactiveProductsQuery = `
      DELETE FROM IMPORT_CZS_Ceny_B2B
      WHERE C_Polozky IN (
        SELECT PartNo
        FROM (
          SELECT polozka AS PartNo FROM IMPORT_CZS_Kalkulace_cen_akce_polozka WHERE Aktivni = 0
          UNION
          SELECT polozka AS PartNo FROM IMPORT_CZS_Kalkulace_cen_netto WHERE Aktivni = 0
          UNION
          SELECT polozka AS PartNo FROM IMPORT_CZS_Kalkulace_cen_vyprodej WHERE Aktivni = 0
        ) AS inactiveProducts
      )
    `;

    await new Promise((resolve, reject) => {
      poolC5pneutyres.query(deleteInactiveProductsQuery, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    res.json({ message: 'Data successfully processed and inserted into the B2B table.' });

  } catch (error) {
    console.error('Error processing data:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/getCurrentPointSProductAndPrices', async (req, res) => {
  try {
    await sql.connect(mssqlConfig);
    const request = new sql.Request();
    const mssqlQuery = `
      SELECT
        [ItemId],
        [PurchLineDisc],
        [ExternalItemId],
        [ItsJoinedItemName],
        [ItsItemName2],
        [ItsEnergeticEfficiency],
        [ItsWetBrake],
        [ItsOutLoudness],
        [ItsItemName3],
        [ItsJoinedItemName] AS Popis,
        [ItemGroupId],
        [ItsProducerCode],
        [ItsItemEAN],
        [ItsTyreSectionWidth],
        [ItsTyreRIMDiameter],
        [ItsTyreAspectRatio],
        [SalesPrice],
        [ItsTyreConstructionCode],
        [ItsTyreSpeedIndexCode],
        [ItsTyreLoadIndexCode],
        [GrossWeight],
        [ItsReinforced],
        [ItsMSMark],
        [ItsSnowflakeInMountain],
        [ItsTyreSeasonality],
        [ItsAssortmentCode],
        [ItsAssortmentCode] AS Kategorie_zbozi,
        [ItsTyreTubeType],
        [ItsTyrePosition],
        [ItsProducerCategory],
        [ItsTyreUseMode]
      FROM [AxProdCS].[dbo].[ItsIFInventTable]
      WHERE [ItsWebAvailable] = 'Ano' and ItemGroupId = '01040';
    `;
    const mssqlResults = await request.query(mssqlQuery);
    const products = mssqlResults.recordset;

    const [
      baseDiscountRows,
      nettoRows,
      akceRows,
      vyprodejRows
    ] = await Promise.all([
      new Promise((r, j) => poolC5pneutyres.query(
        'SELECT cenove_skupiny, PointS AS discountPercentage FROM IMPORT_CZS_Kalkulace_cen_zakladni_slevy',
        (e, rows) => e ? j(e) : r(rows)
      )),
      new Promise((r, j) => poolC5pneutyres.query(
        'SELECT polozka, PointS AS nettoPrice, platnost_od, platnost_do, Aktivni FROM IMPORT_CZS_Kalkulace_cen_netto WHERE Aktivni=1',
        (e, rows) => e ? j(e) : r(rows)
      )),
      new Promise((r, j) => poolC5pneutyres.query(
        'SELECT polozka, PointS AS akcePrice, platnost_od, platnost_do, Aktivni FROM IMPORT_CZS_Kalkulace_cen_akce_polozka WHERE Aktivni=1',
        (e, rows) => e ? j(e) : r(rows)
      )),
      new Promise((r, j) => poolC5pneutyres.query(
        'SELECT polozka, PointS AS vyprodejPrice, platnost_od, platnost_do, Aktivni FROM IMPORT_CZS_Kalkulace_cen_vyprodej WHERE Aktivni=1',
        (e, rows) => e ? j(e) : r(rows)
      )),
    ]);

    const baseDiscountMap = new Map(
      baseDiscountRows.map(r => [r.cenove_skupiny, parseFloat(r.discountPercentage)])
    );
    function buildDateMap(rows, key) {
      const map = new Map();
      const now = new Date();
      rows.forEach(r => {
        const from = r.platnost_od ? new Date(r.platnost_od) : null;
        const to   = r.platnost_do ? new Date(r.platnost_do) : null;
        if ((!from || from <= now) && (!to || to >= now)) {
          map.set(String(r.polozka), parseFloat(r[key]));
        }
      });
      return map;
    }
    const nettoMap    = buildDateMap(nettoRows, 'nettoPrice');
    const akceMap     = buildDateMap(akceRows, 'akcePrice');
    const vyprodejMap = buildDateMap(vyprodejRows, 'vyprodejPrice');

    const finalProducts = products.map(p => {
      const basePrice = parseFloat(p.SalesPrice);
      let price = null, rule = null, sleva = 0, m_akce_cena = null;
      const itemIdStr = String(p.ItemId);
      const discGroup = String(p.PurchLineDisc);

      if (vyprodejMap.has(itemIdStr)) {
        price = vyprodejMap.get(itemIdStr);
        rule = 'Vyprodej Price';
        m_akce_cena = price.toFixed(2);
      } else if (akceMap.has(itemIdStr)) {
        price = akceMap.get(itemIdStr);
        rule = 'Akce Price';
        m_akce_cena = price.toFixed(2);
      } else if (nettoMap.has(itemIdStr)) {
        price = nettoMap.get(itemIdStr);
        rule = 'Netto Price';
        m_akce_cena = price.toFixed(2);
      } else if (!isNaN(basePrice)) {
        const d = baseDiscountMap.get(discGroup) || 0;
        if (d > 0) {
          price = basePrice * (1 - d / 100);
          sleva = d;
          rule = 'Base Discount';
          m_akce_cena = price.toFixed(2);
        } else {
          price = basePrice;
          rule = 'Base Price';
          m_akce_cena = null;
        }
      }

      if (!(typeof price === 'number' && !isNaN(price) && price > 0)) return null;

      return {
        C_Polozky:              p.ItemId,
        Katalogove_cislo:       p.ItemId,
        Vlastni_objednaci_cislo:p.ExternalItemId,
        Nazev:                  p.ItsJoinedItemName,
        Nazev2:                 p.ItsItemName2,
        Valivy_odpor:           p.ItsEnergeticEfficiency,
        Prilnavost_na_mokru:    p.ItsWetBrake,
        Hluk_tridy:             p.ItsOutLoudness,
        Nazev3:                 p.ItsItemName3,
        Popis:                  p.Popis,
        Skupina:                p.PurchLineDisc,
        Vyrobce:                p.ItsProducerCode,
        Prodej:                 p.SalesPrice,
        EAN:                    p.ItsItemEAN,
        Sirka:                  p.ItsTyreSectionWidth,
        Rafek:                  p.ItsTyreRIMDiameter,
        Profil:                 p.ItsTyreAspectRatio,
        Sleva:                  sleva ? sleva.toFixed(2) : null,
        Marketingova_akce:      rule,
        M_akce_cena:            m_akce_cena,
        Konstrukce:             p.ItsTyreConstructionCode,
        Index_rychlosti:        p.ItsTyreSpeedIndexCode,
        Index_hmotnosti:        p.ItsTyreLoadIndexCode,
        Hmotnost:               p.GrossWeight,
        Zesilena:               p.ItsReinforced,
        M_S:                    p.ItsMSMark,
        '3PMSF':                p.ItsSnowflakeInMountain,
        Obdobi:                 p.ItsTyreSeasonality,
        Kategorie_vozu:         p.ItsAssortmentCode,
        Kategorie_zbozi:        p.Kategorie_zbozi,
        TL:                     p.ItsTyreTubeType,
        Naprava:                p.ItsTyrePosition,
        Provoz:                 p.ItsTyreUseMode,
        Trida_vyrobce:           p.ItsProducerCategory,
        Datum_zmeny:            new Date()
      };
    }).filter(Boolean);

    const columns = [
      'C_Polozky','Katalogove_cislo','Vlastni_objednaci_cislo','Nazev','Nazev2','Valivy_odpor','Prilnavost_na_mokru','Hluk_tridy','Nazev3','Popis',
      'Skupina','Vyrobce','Prodej','EAN','Sirka','Rafek','Profil','Sleva','Marketingova_akce','M_akce_cena','Konstrukce','Index_rychlosti',
      'Index_hmotnosti','Hmotnost','Zesilena','M_S','3PMSF','Obdobi','Kategorie_vozu','Kategorie_zbozi','TL','Naprava','Provoz','Trida_vyrobce','Datum_zmeny'
    ];

    await new Promise((resolve, reject) =>
      poolC5pneutyres.query('DELETE FROM IMPORT_CZS_Ceny_PointS', err => err ? reject(err) : resolve())
    );

    const placeholders = columns.map(() => '?').join(', ');
    const insertSQL = `INSERT INTO IMPORT_CZS_Ceny_PointS (${columns.join(', ')}) VALUES (${placeholders})`;

    for (const prod of finalProducts) {
      const vals = columns.map(col => prod[col]);
      await new Promise((resolve, reject) => {
        poolC5pneutyres.query(insertSQL, vals, err => err ? reject(err) : resolve());
      });
    }

    res.json({ message: 'POINTS data zpracována a vložena včetně všech cenových pravidel.' });

  } catch (err) {
    res.status(500).send('Chyba při importu produktů.');
  }
});




// Nový endpoint /ax-data
app.get('/ax-data', async (req, res) => {
  const codesParam = req.query.codes;

  if (!codesParam) {
    return res.status(400).json({ error: 'Chybí parametr "codes"' });
  }

  // Rozdělení kódů na pole a odstranění prázdných hodnot
  const codes = codesParam.split(',').map(code => code.trim()).filter(code => code !== '');

  if (codes.length === 0) {
    return res.status(400).json({ error: 'Nebyl poskytnut žádný platný Kód položky' });
  }

  // Limit pro počet kódů, které lze předat najednou (např. 100)
  if (codes.length > 100) {
    return res.status(400).json({ error: 'Příliš mnoho kódů položek. Maximální počet je 100.' });
  }

  try {
    // Připojení k databázi
    await sql.connect(mssqlConfig);
    const request = new sql.Request();

    // Dynamické vytvoření parametrů pro SQL dotaz
    codes.forEach((code, index) => {
      request.input(`code${index}`, sql.VarChar, code);
    });

    // Sestavení WHERE IN klauzule s parametry
    const inClause = codes.map((_, index) => `@code${index}`).join(',');

    // SQL dotaz s aliasy pro přejmenování sloupců
    const query = `
      SELECT
          [ItemId] AS "Kód položky",
          [ItemName] AS "Nazev",
          [ItsItemName3] AS "Výrobce",
          [ItsItemName2] AS "Dezen",
          [ItsProducerCode] AS "Kód výrobce",
          [ItsAssortmentCode] AS "Kód sortimentu",
          [ItsTyreSeasonality] AS "Sezónnost",
          [ItsTyrePosition] AS "Naprava",
          [ItsTyreUseMode] AS "Provoz",
          [ItsTyreSectionWidth] AS "Šířka",
          [ItsTyreRIMDiameter] AS "Rafek",
          [ItsTyreConstructionCode] AS "Konstrukční kód",
          [ItsTyreSpeedIndexCode] AS "Index rychlosti",
          [ItsTyreLoadIndexCode] AS "Index nosnosti",
          [ItsReinforced] AS "Zesílení",
          [ItsMSMark] AS "M_S",
          [ItsFlangeProtection] AS "Ochrana ráfku",
          [ItsTyreTubeType] AS "TL/TT",
          [ItsRunFlatType] AS "Run Flat typ",
          [ItsTyreAspectRatio] AS "Profil",
          [ItsTyreAspectRatioDescription] AS "Popis profilu",
          [ItsWebAvailable] AS "Web dostupný",
          [ItsWebAvailableB2B] AS "Web dostupný B2B",
          [ItsWebAvailableExt] AS "Web dostupný externě",
          [ItsMarketingActionId] AS "Marketingová akce",
          [ItsActionDateFrom] AS "Platnost od",
          [ItsActionDateTo] AS "Platnost do",
          [ItsActionPrice] AS "Marketingová cena",
          [ItsMaxTyrePatternHigh] AS "Max. hloubka vzorku",
          [ItsMaxTyreDrivenDistance] AS "Max. ujetá vzdálenost",
          [ItsEnergeticEfficiency] AS "Valivy_odpor",
          [ItsWetBrake] AS "Přilnavost",
          [ItsOutLoudness] AS "Hluk_db",
          [ItsItemDescription] AS "Popis položky",
          [ItsSnowflakeInMountain] AS "3PMSF",
          [ItemGroupId] AS "ID skupiny položek",
          [UnitId] AS "ID jednotky",
          [GrossWeight] AS "Hmotnost",
          [ItemType] AS "Typ položky",
          [PurchLineDisc] AS "Sleva z nákupu",
          [SalesPrice] AS "Cena",
          [SalesPriceDate] AS "Datum prodejní ceny",
          [PrimaryVendorId] AS "ID hlavního dodavatele",
          [ExternalItemId] AS "Externí ID položky",
          [PurchStopped] AS "Zastaveno nákupem",
          [InventStopped] AS "Zastaveno inventurou",
          [SalesStopped] AS "Zastaveno prodejem",
          [ItsItemEAN] AS "EAN",
          [RecyclingUnitAmount] AS "Množství recyklace",
          [ItsItemIdFreight] AS "ID přepravy položky",
          [PdsFreightAllocationGroupId] AS "ID skupiny alokace přepravy",
          [MarkupGroupId] AS "ID skupiny marže",
          [ItsURLPicture] AS "URL obrázku",
          [ItsURLEprel] AS "URL eprelu",
          [ItsURLQRCode] AS "URL QR kódu",
          [ItsProducerCategory] AS "Kategorie výrobce",
          [ItsCanvasCount] AS "Počet plátna",
          [DataAreaId] AS "ID datové oblasti",
          [Partition] AS "Partition",
          [ItsJoinedItemName] AS "Připojený název položky"
      FROM [AxProdCS].[dbo].[ItsIFInventTable]
      WHERE [ItemId] IN (${inClause})
    `;

    const result = await request.query(query);

    // Zavření připojení
    await sql.close();

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (error) {
    console.error('Chyba při získávání AX dat:', error);
    res.status(500).json({ error: 'Interní chyba serveru' });
  } finally {
    // Ujistěte se, že připojení je zavřeno
    await sql.close();
  }
});



app.get('/items', async (req, res) => {
  try {
      await sql.connect(mssqlConfig);
      const request = new sql.Request();

      // Příprava základního SQL dotazu
      let query = `
          SELECT TOP 1000
              [ItemId],
              [ItemName],
              [ItsItemName3],
              [ItsItemName2],
              [ItsProducerCode],
              [ItsAssortmentCode],
              [ItsTyreSeasonality],
              [ItsTyrePosition],
              [ItsTyreUseMode],
              [ItsTyreSectionWidth],
              [ItsTyreRIMDiameter],
              [ItsTyreConstructionCode],
              [ItsTyreSpeedIndexCode],
              [ItsTyreLoadIndexCode],
              [ItsReinforced],
              [ItsMSMark],
              [ItsFlangeProtection],
              [ItsTyreTubeType],
              [ItsRunFlatType],
              [ItsTyreAspectRatio],
              [ItsTyreAspectRatioDescription],
              [ItsWebAvailable],
              [ItsWebAvailableB2B],
              [ItsWebAvailableExt],
              [ItsMarketingActionId],
              [ItsActionDateFrom],
              [ItsActionDateTo],
              [ItsActionPrice],
              [ItsMaxTyrePatternHigh],
              [ItsMaxTyreDrivenDistance],
              [ItsEnergeticEfficiency],
              [ItsWetBrake],
              [ItsOutLoudness],
              [ItsItemDescription],
              [ItsSnowflakeInMountain],
              [ItemGroupId],
              [UnitId],
              [NetWeight],
              [TaraWeight],
              [GrossWeight],
              [ItemType],
              [PurchLineDisc],
              [SalesPrice],
              [SalesPriceDate],
              [PrimaryVendorId],
              [ExternalItemId],
              [PurchStopped],
              [InventStopped],
              [SalesStopped],
              [ItsItemEAN],
              [RecyclingUnitAmount],
              [ItsItemIdFreight],
              [PdsFreightAllocationGroupId],
              [MarkupGroupId],
              [ItsURLPicture],
              [ItsURLEprel],
              [ItsURLQRCode],
              [ItsProducerCategory],
              [ItsCanvasCount],
              [DataAreaId],
              [Partition],
              [ItsJoinedItemName]

          FROM [AxProdCS].[dbo].[ItsIFInventTable]
      `;

     // Dynamická konstrukce WHERE klauzule
let whereClauses = [];
for (const [key, value] of Object.entries(req.query)) {
if (value === '""') { // Kontrola hodnoty jako řetězce obsahující dvojité uvozovky
  whereClauses.push(`([${key}] IS NULL OR [${key}] = '')`);
} else if (value.includes('|')) {
  // Rozdělení hodnoty na více vzorů oddělených '|'
  const patterns = value.split('|').map(v => v.replace(/\*/g, '%'));
  const orClauses = patterns.map((pattern, index) => {
      const paramName = `${key}_${index}`;
      request.input(paramName, sql.VarChar, pattern);
      return `[${key}] LIKE @${paramName}`;
  }).join(' OR ');
  whereClauses.push(`(${orClauses})`);
} else {
  // Přímé použití hodnoty s nahrazením '*' za '%' pro LIKE
  const paramName = key;
  const pattern = value.replace(/\*/g, '%');
  request.input(paramName, sql.VarChar, pattern);
  whereClauses.push(`[${key}] LIKE @${paramName}`);
}
}
if (whereClauses.length > 0) {
query += ' WHERE ' + whereClauses.join(' AND ');
}

      // Spuštění dotazu
      const result = await request.query(query);
      res.json(result.recordset);
  } catch (err) {
      console.error('Database query failed:', err);
      res.status(500).send('Internal Server Error');
  }
});



// ---------------------------------------------------------------------------
// WAREHOUSE V2  (kompatibilní s FE: shelves → floors → sections → pallet_slots)
// Dostupné na /warehouse/v2 i /api/warehouse-v2
// Query: ?includeCartons=1  → dopočítá cartons_count a occupancy
// ---------------------------------------------------------------------------
app.get(['/warehouse/v2', '/api/warehouse-v2'], async (req, res) => {
  const norm = (v) => (v == null ? '' : String(v).trim());
  const includeCartons = String(req.query.includeCartons || '0') === '1';

  // default kapacit
  const LAYERS_PER_PALLET = 6;
  const CRATES_PER_LAYER = { A: 11, B: 9 }; // A=11, B=9 krabic na vrstvu

  try {
    // 1) Základní struktura skladu (NEtaháme capacity_cartons – v DB není)
    const [buildings, shelves, floors, sections, slots] = await Promise.all([
      dbQuery(poolC5sluzbyint, 'SELECT id, name FROM WH_buildings', []),
      dbQuery(poolC5sluzbyint, 'SELECT id, building_id, name FROM WH_shelves', []),
      dbQuery(poolC5sluzbyint, 'SELECT id, shelf_id, floor_number, height FROM WH_floors', []),
      dbQuery(poolC5sluzbyint, 'SELECT id, shelf_id, name FROM WH_sections', []),
      dbQuery(
        poolC5sluzbyint,
        `SELECT id, section_id, slot_name, floor_number, position, product_id, status
           FROM WH_pallet_slots
         ORDER BY section_id, floor_number DESC, position ASC`,
        []
      )
    ]);

    // 2) Typ krabice z Tavinox_komplet (pozor na přesný název sloupce!)
    let cartonTypeByProduct = new Map();
    try {
      const tav = await dbQuery(
        poolC5sluzbyint,
        'SELECT TRIM(`Kod`) AS product_code, UPPER(TRIM(`Typ Krabice`)) AS carton_type FROM Tavinox_komplet',
        []
      );
      cartonTypeByProduct = new Map(
        (tav || [])
          .map(r => [norm(r.product_code), (r.carton_type === 'B' ? 'B' : 'A')])
          .filter(([code]) => !!code)
      );
    } catch (e) {
      // když tabulka/sloupec není, drž se 'A'
      cartonTypeByProduct = new Map();
    }

    // 3) Počítání krabic ve slotech (includeCartons)
    let cartonsCountBySlot = new Map();
    if (includeCartons) {
      try {
        // přesný zůstatek: qty - vydané z WH_IssueItems
        const meas = await dbQuery(
          poolC5sluzbyint,
          `
          SELECT m.id AS mid, m.pallet_slot_id AS slot_id, COALESCE(m.qty,0) AS qty_units_in
            FROM NP_Measurements m
           WHERE m.pallet_slot_id IS NOT NULL
          `,
          []
        );
        const issuedAgg = await dbQuery(
          poolC5sluzbyint,
          `
          SELECT measurement_id, SUM(qty_units) AS issued_units
            FROM WH_IssueItems
           WHERE operation_type IN ('pick','overpick')
           GROUP BY measurement_id
          `,
          []
        );
        const issuedByMeas = new Map(
          (issuedAgg || []).map(r => [Number(r.measurement_id), Number(r.issued_units || 0)])
        );
        const tmp = new Map(); // slot_id -> count (jen krabice se zůstatkem > 0)
        for (const r of (meas || [])) {
          const sid = Number(r.slot_id);
          const remain = Math.max(Number(r.qty_units_in || 0) - Number(issuedByMeas.get(Number(r.mid)) || 0), 0);
          if (remain > 0) {
            tmp.set(sid, (tmp.get(sid) || 0) + 1);
          }
        }
        cartonsCountBySlot = tmp;
      } catch (e) {
        // fallback: prostý COUNT(*)
        const cnt = await dbQuery(
          poolC5sluzbyint,
          `
          SELECT pallet_slot_id AS slot_id, COUNT(*) AS cartons_count
            FROM NP_Measurements
           WHERE pallet_slot_id IS NOT NULL
           GROUP BY pallet_slot_id
          `,
          []
        );
        cartonsCountBySlot = new Map(
          (cnt || []).map(r => [Number(r.slot_id), Number(r.cartons_count || 0)])
        );
      }
    }

    // 4) Indexy pro skládání stromu
    const shelvesByBuilding = new Map();
    for (const sh of (shelves || [])) {
      const list = shelvesByBuilding.get(sh.building_id) || [];
      list.push({ id: sh.id, name: sh.name, floors: [], sections: [] });
      shelvesByBuilding.set(sh.building_id, list);
    }

    const floorsByShelf = new Map();
    for (const fl of (floors || [])) {
      const list = floorsByShelf.get(fl.shelf_id) || [];
      list.push({ id: fl.id, floor_number: Number(fl.floor_number || 0), height: Number(fl.height || 0) });
      floorsByShelf.set(fl.shelf_id, list);
    }

    const sectionsByShelf = new Map();
    const sectionsIndex = new Map();
    for (const sec of (sections || [])) {
      const obj = { id: sec.id, name: sec.name, pallet_slots: [] };
      const list = sectionsByShelf.get(sec.shelf_id) || [];
      list.push(obj);
      sectionsByShelf.set(sec.shelf_id, list);
      sectionsIndex.set(sec.id, obj);
    }

    // 5) Dosazení slotů a dopočet kapacit/obsazenosti
    for (const sl of (slots || [])) {
      const secObj = sectionsIndex.get(sl.section_id);
      if (!secObj) continue;

      const productCode = norm(sl.product_id) || null;
      const cType = cartonTypeByProduct.get(productCode) || 'A';
      const perLayer = CRATES_PER_LAYER[cType] || 11;
      const maxCartons = perLayer * LAYERS_PER_PALLET; // dopočet kapacity

      const cartonsCnt = includeCartons ? (cartonsCountBySlot.get(Number(sl.id)) || 0) : 0;
      const occCount = Math.min(cartonsCnt, maxCartons || cartonsCnt);
      const occPct = maxCartons ? Math.round((occCount / maxCartons) * 100) : 0;

      secObj.pallet_slots.push({
        id: sl.id,
        slot_name: sl.slot_name || `${secObj.name}-${sl.position ?? ''}`,
        floor_number: Number(sl.floor_number ?? 0),
        position: Number(sl.position ?? 0),
        status: sl.status || (cartonsCnt > 0 || productCode ? 'obsazeno' : 'volno'),

        // identifikace a kapacity
        product_id: productCode,
        capacity_cartons: maxCartons,       // ← dopočteno (A/B * vrstvy)
        cartons_count: cartonsCnt,          // ← spočítané (zůstatek nebo COUNT)

        // doplňkové informace pro UI
        carton_type: cType,                 // 'A' | 'B'
        per_layer_capacity: perLayer,       // 11 / 9
        layers_capacity: LAYERS_PER_PALLET, // 6
        occupancy_cartons: occCount,
        occupancy_pct: occPct
      });
    }

    // 6) Zkompletuj strom: shelves ← floors/sections, buildings ← shelves
    const warehouses = (buildings || []).map(b => {
      const shs = (shelvesByBuilding.get(b.id) || []).map(sh => {
        sh.floors = (floorsByShelf.get(sh.id) || [])
          .sort((a,b) => (b.floor_number - a.floor_number));
        sh.sections = (sectionsByShelf.get(sh.id) || [])
          .map(sec => {
            sec.pallet_slots.sort((a,b) =>
              (b.floor_number - a.floor_number) || (a.position - b.position)
            );
            return sec;
          })
          .sort((a,b) => String(a.name).localeCompare(String(b.name), 'cs', { numeric:true, sensitivity:'base' }));
        return sh;
      });
      return { id: b.id, name: b.name, shelves: shs };
    });

    res.json({ warehouses });
  } catch (err) {
    console.error('❌ /warehouse/v2 failed:', err);
    res.status(500).json({ error: 'Internal Server Error', detail: err.message });
  }
});





// Export dat do CSV AxLiveProductsEdit
app.get('/export-csv', (req, res) => {
  const sql = `
    SELECT *
    FROM ItsIFInventTable;
  `;

  sql.connect(mssqlConfig, err => {
    if (err) {
      console.error('Error connecting to MSSQL:', err);
      return res.status(500).send('Server error');
    }

    const request = new sql.Request();
    request.query(sql, (err, result) => {
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).send('Server error');
      }

      const fields = Object.keys(result.recordset[0]);
      const opts = { fields };
      try {
        const csv = parse(result.recordset, opts);
        fs.writeFileSync('export.csv', csv);
        res.download('export.csv');
      } catch (err) {
        console.error('Error generating CSV:', err);
        res.status(500).send('Server error');
      }
    });
  });
});

// Získání dat z ItsIFInventTable s filtrováním
app.get('/get-invent-table-data', (req, res) => {
  let sqlQuery = `
    SELECT *
    FROM ItsIFInventTable
    WHERE 1=1
  `;

  const queryParams = [];
  Object.keys(req.query).forEach(key => {
    sqlQuery += ` AND ${key} LIKE ?`;
    queryParams.push(`%${req.query[key]}%`);
  });

  sql.connect(mssqlConfig, err => {
    if (err) {
      console.error('Error connecting to MSSQL:', err);
      return res.status(500).send('Server error');
    }

    const request = new sql.Request();
    request.query(sqlQuery, queryParams, (err, result) => {
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).send('Server error');
      }
      res.json(result.recordset);
    });
  });
});


// Získání konfigurace pohledů
app.get('/get-view-config', (req, res) => {
  const viewName = req.query.view_name;

  const sql = `
    SELECT view_name, column_name, editable, value_source, enum_table
    FROM ViewConfig
    WHERE view_name = ?;
  `;

  poolC5tpms.query(sql, [viewName], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});


//endpoint pro kalendář české budějovice
app.get('/api/calendar', async (req, res) => {
  const dealerID = 1242;  // Pevně stanovené dealerID
  const { taskID, startdate } = req.query; // Získání taskID a startdate z query parametrů URL

  const apiURL = `https://www.rezervacenajisto.cz/api/calendar/getCalendar/${dealerID}?taskID=${taskID}&startdate=${startdate}`;
  const apiKey = 'E499F9BAE7E73ECC60E96702CDBCCB81';

  try {
      const response = await fetch(apiURL, {
          method: 'GET',
          headers: {
              'X-Api-Key': apiKey,
              'Accept': 'application/json'
          }
      });

      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      res.status(200).json(data);
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
});




// Endpoint pro získání objednávek z API Eurofaktura
app.get('/EForders', async (req, res) => {
  const { dateFrom, dateTo, status } = req.query;
  const url = 'https://eurofaktura.cz/WebServicesCZ/API';
  const requestData = {
    username: "INFO@ZDRAVYKRAM.CZ",
    md5pass: "c5ea5bf426f32ea6c674d044a418e7a6",
    token: "F0514496FEBA0D00B091E288020E0B93",
    method: "SalesOrderList",
    parameters: {
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      status: status || null
    }
  };

  try {
    const response = await axios.post(url, requestData, {
      headers: { 'Content-Type': 'application/json' }
    });
    const orders = response.data.response.result;
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send(`Error fetching orders: ${error.message}`);
  }
});

// Endpoint pro získání objednávek z databáze MySQL s použitím poolC5sluzbyint
app.get('/eforders_list', async (req, res) => {
  const { dateFrom, dateTo, status, payment, delivery } = req.query;

  let sql = `SELECT * FROM Orders_List`;
  let conditions = [];
  let queryParams = [];

  if (dateFrom) {
    conditions.push(`Date >= ?`);
    queryParams.push(dateFrom);
  }

  if (dateTo) {
    conditions.push(`Date <= ?`);
    queryParams.push(dateTo);
  }

  // Zpracování více hodnot pro status
  if (status) {
    let statuses = [];
    if (Array.isArray(status)) {
        // Pokud je status pole, přiřaď ho přímo
        statuses = status;
    } else {
        // Jinak předpokládej, že je to řetězec a rozděl ho
        statuses = status.split(',');
    }
    const statusPlaceholders = statuses.map(() => '?').join(',');
    conditions.push(`Status IN (${statusPlaceholders})`);
    queryParams.push(...statuses);
}


  // Zpracování více hodnot pro payment
  if (payment) {
    let payments = [];
    if (Array.isArray(payment)) {
        // Pokud je status pole, přiřaď ho přímo
        payments = payment;
    } else {
        // Jinak předpokládej, že je to řetězec a rozděl ho
        payments = payment.split(',');
    }
    const paymentPlaceholders = payments.map(() => '?').join(',');
    conditions.push(`Payment IN (${paymentPlaceholders})`);
    queryParams.push(...payments);
}


  // Zpracování více hodnot pro delivery
  if (delivery) {
    let deliveries = [];
    if (Array.isArray(delivery)) {
        // Pokud je status pole, přiřaď ho přímo
        deliveries = delivery;
    } else {
        // Jinak předpokládej, že je to řetězec a rozděl ho
        deliveries = delivery.split(',');
    }
    const deliveryPlaceholders = deliveries.map(() => '?').join(',');
    conditions.push(`Delivery IN (${deliveryPlaceholders})`);
    queryParams.push(...deliveries);
}
 

  if (conditions.length) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }

  try {
    const result = await queryC5sluzbyint(sql, queryParams);
    res.json(result);
  } catch (err) {
    console.error('Error fetching data from database:', err);
    res.status(500).send(`Error fetching data from database: ${err.message}`);
  }
});


// Endpoint pro aktualizaci hodnoty picking 1/0 v databázi s použitím poolC5sluzbyint
app.post('/efupdate_picking', async (req, res) => {
  const { Order_Number, Picking } = req.body;

  try {
    // SQL dotaz pro aktualizaci hodnoty 'Picking' v tabulce 'Orders_List'
    const sql = `UPDATE Orders_List SET Picking = ? WHERE Order_Number = ?`;
    await queryC5sluzbyint(sql, [Picking, Order_Number]);

    // Odeslání odpovědi klientovi
    res.json({ message: 'Picking status updated successfully' });
  } catch (error) {
    console.error('Error updating picking status:', error);
    res.status(500).send(`Error updating picking status: ${error.message}`);
  }
});



// Endpoint pro získání detailů konkrétní objednávky s použitím poolC5sluzbyint
app.get('/eforder/:orderNumber', async (req, res) => {
  const orderNumber = req.params.orderNumber; // Oprava z req.params.orderNumber na req.params.EForderNumber
  const url = 'https://eurofaktura.cz/WebServicesCZ/API';
  const requestData = {
    username: "INFO@ZDRAVYKRAM.CZ",
    md5pass: "c5ea5bf426f32ea6c674d044a418e7a6",
    token: "F0514496FEBA0D00B091E288020E0B93",
    method: "SalesOrderGet",
    parameters: { number: orderNumber }
  };

  try {
    const response = await axios.post(url, requestData, {
      headers: { 'Content-Type': 'application/json' }
    });
    const orderDetails = response.data.response.result[0];

    for (const item of orderDetails.Items) {
      if (item.productCode) { // Kontrola, zda existuje kód produktu
        const sqlOrdersRaw = `INSERT INTO Orders_raw (Order_Number, Position, Shop_Id, Product_Name, Product_Ean, Product_Quantity)
                          VALUES (?, ?, ?, ?, ?, ?)
                          ON DUPLICATE KEY UPDATE Product_Name = VALUES(Product_Name), Product_Ean = VALUES(Product_Ean), Product_Quantity = VALUES(Product_Quantity)`;
        await queryC5sluzbyint(sqlOrdersRaw, [orderNumber, item.position, '1', item.description, item.productBarCode, item.quantity]);
      }
    }
    const filteredItems = orderDetails.Items.filter(item => item.productCode);
    res.json({ ...orderDetails, Items: filteredItems });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).send(`Error fetching order details: ${error.message}`);
  }
});




// Endpoint pro výpis objednávek s použitím poolC5sluzbyint
app.post('/efupdate_orders_list', async (req, res) => {
  const url = 'https://eurofaktura.cz/WebServicesCZ/API';
  const requestData = {
    username: "INFO@ZDRAVYKRAM.CZ",
    md5pass: "c5ea5bf426f32ea6c674d044a418e7a6",
    token: "F0514496FEBA0D00B091E288020E0B93",
    method: "SalesOrderList",
    parameters: {}
  };

  try {
    const response = await axios.post(url, requestData, {
      headers: { 'Content-Type': 'application/json' }
    });
    const orders = response.data.response.result;

    for (const order of orders) {
      const orderNumber = order.number;
      const shopId = '1'; // Pevně daná hodnota
      const date = order.date;
      const payment = order.methodOfPayment;
      const delivery = order.deliveryMethod;
      const documentId = order.documentID;
      const status = order.status;

      const sqlOrdersList = `INSERT INTO Orders_List (Order_Number, Shop_Id, Date, Payment, Delivery, Status, DocumentID)
                             VALUES (?, ?, ?, ?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE
                             Shop_Id = VALUES(Shop_Id), Date = VALUES(Date), Payment = VALUES(Payment),
                             Delivery = VALUES(Delivery), Status = VALUES(Status), DocumentID = VALUES(DocumentID)`;
      await queryC5sluzbyint(sqlOrdersList, [orderNumber, shopId, date, payment, delivery, status, documentId]);

      for (const item of order.Items) {
        if (item.productCode !== '') {
          const sqlOrdersRaw = `INSERT INTO Orders_raw (Order_Number, Position, Product_Reference)
                                VALUES (?, ?, ?)
                                ON DUPLICATE KEY UPDATE Product_Reference = VALUES(Product_Reference)`;
          await queryC5sluzbyint(sqlOrdersRaw, [orderNumber, item.position, item.productCode]);
        }
      }
    }

    // Po vložení/aktualizaci dat do Orders_raw
    const deleteSql = `DELETE FROM Orders_raw WHERE Product_Reference IS NULL`;
    await queryC5sluzbyint(deleteSql);

    res.send('Orders list and items updated successfully');
  } catch (error) {
    console.error('Error updating orders list:', error);
    res.status(500).send(`Error updating orders list: ${error.message}`);
  }
});


app.get('/efprocess_picking_orders', async (req, res) => {
  try {
    // Nastavení počáteční hodnoty pro řazení a aktualizace pozic pickingu
    await queryC5sluzbyint('SET @row_number = 0;');
    await queryC5sluzbyint(`
      UPDATE Orders_List
      SET Picking_Position = (@row_number:=@row_number + 1)
      WHERE Picking = 1
      ORDER BY Order_Number;
    `);

    // Volání externího API pro získání detailů objednávek
    const pickingOrdersResult = await queryC5sluzbyint('SELECT Order_Number FROM Orders_List WHERE Picking = 1');
    const orderNumbers = pickingOrdersResult.map(order => order.Order_Number);
    const orderNumbersString = orderNumbers.join(',');

    const response = await axios.post('https://eurofaktura.cz/WebServicesCZ/API', {
      username: "INFO@ZDRAVYKRAM.CZ",
      md5pass: "c5ea5bf426f32ea6c674d044a418e7a6",
      token: "F0514496FEBA0D00B091E288020E0B93",
      method: "SalesOrderGet",
      parameters: { number: orderNumbersString }
    });

    // Zpracování a vložení detailů objednávek
    await Promise.all(response.data.response.result.flatMap(orderDetails =>
      orderDetails.Items.map(item => {
        if (item.productCode) {
          const sqlOrdersRaw = `
            INSERT INTO Orders_raw (Order_Number, Position, Shop_Id, Product_Name, Product_Ean, Product_Quantity)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE Product_Name = VALUES(Product_Name), Product_Ean = VALUES(Product_Ean), Product_Quantity = VALUES(Product_Quantity)
          `;
          return queryC5sluzbyint(sqlOrdersRaw, [orderDetails.number, item.position, '1', item.description, item.productBarCode, item.quantity]);
        }
        return Promise.resolve();
      })
    ));

    // Načtení a odeslání aktualizovaných dat
    const ordersRawResult = await queryC5sluzbyint(`
      SELECT Orders_raw.*, Orders_List.Picking, Orders_List.Picking_Position,
             COALESCE(Orders_raw.Product_Picked, 0) AS Product_Picked
      FROM Orders_raw
      INNER JOIN Orders_List ON Orders_raw.Order_Number = Orders_List.Order_Number
      WHERE Orders_List.Picking = 1
    `);

    res.json(ordersRawResult);
  } catch (error) {
    console.error('Error processing picking orders:', error);
    res.status(500).send(`Error processing picking orders: ${error.message}`);
  }
});


// Endpoint pro aktualizaci napickovaného množství s použitím poolC5sluzbyint
app.post('/efupdatePickedQuantity', async (req, res) => {
  try {
    const { orderNumber, productReference, pickedQuantity } = req.body;
    const sqlUpdatePicked = `
      UPDATE Orders_raw
      SET Product_Picked = ?
      WHERE Order_Number = ? AND Product_Reference = ?
    `;
    await queryC5sluzbyint(sqlUpdatePicked, [pickedQuantity, orderNumber, productReference]);

    res.send({ status: 'Updated successfully' });
  } catch (error) {
    console.error('Error updating picked quantity:', error);
    res.status(500).send(`Error updating picked quantity: ${error.message}`);
  }
});

app.get('/EForders/picked', async (req, res) => {
  try {
      const result = await queryC5sluzbyint('SELECT * FROM Orders_List WHERE Picking = 1');
      res.json(result);
  } catch (error) {
      console.error('Error fetching picked orders:', error);
      res.status(500).send('Server Error: ' + error.message);
  }
});

// Stáhnout data z XML pro B2B, uloženého na FTP
app.get('/FTP_B2Bproducts', async (req, res) => {
  // Detaily pro připojení k FTP a cestu k souboru
  const ftpDetails = {
    host: pneuB2bFtpHost,
    user: pneuB2bLogin,
    password: pneuB2bPassword,
    secure: false, // Předpokládá se, že připojení není zabezpečené, pokud je, změňte na true
    remoteFilePath: "./products.xml"
  };
  const localXMLPath = path.join(__dirname, "temp_products.xml");

  try {
    // Stažení souboru XML z FTP
    const client = new ftp.Client();
    client.ftp.verbose = true;
    await client.access({
      host: ftpDetails.host,
      user: ftpDetails.user,
      password: ftpDetails.password,
      secure: ftpDetails.secure
    });
    await client.downloadTo(localXMLPath, ftpDetails.remoteFilePath);
    client.close();

    // Parsování XML souboru
    const parsedData = await parseXML(localXMLPath);
    const items = parsedData.Request.Items.Item;
    // Extrahování dat o PartNo a StockAmount
    const products = items.map(item => {
      return {
        PartNo: item.$.PartNo,
        StockAmount: item.$.StockAmount
      };
    });
    

    // Odeslání dat jako JSON odpovědi
    res.json(products);
  } catch (error) {
    console.error('Error fetching and parsing XML data:', error);
    res.status(500).send('Server error');
  }
});

// Helpers for PneuB2B import (tyres)
function parseNumber(value) {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function parseIntSafe(value) {
  const num = parseInt(value, 10);
  return Number.isFinite(num) ? num : null;
}

async function truncateTable() {
  return new Promise((resolve, reject) => {
    poolC5pneutyres.query('TRUNCATE TABLE IMPORT_CZS_ProduktyB2B', err => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function extractPriceSection(item, sectionName) {
  const prefix = sectionName === 'StockPriceInfo' ? 'StockPriceInfo' : sectionName;
  const pick = (field) => {
    const key = `${prefix}_${field}`;
    if (Object.prototype.hasOwnProperty.call(item, key)) return item[key];
    if (prefix === 'StockPriceInfo' && Object.prototype.hasOwnProperty.call(item, field)) return item[field];
    return undefined;
  };

  return {
    currency: pick('Currency') || null,
    deliveryTime: pick('DeliveryTime') || null,
    deliveryTimeTerm: pick('DeliveryTimeTerm') || null,
    rpFree: pick('RPFree') || null,
    stockAmount: parseIntSafe(pick('StockAmount')),
    suppliersCountry: pick('SuppliersCountry') || null,
    totalPrice: parseNumber(pick('TotalPrice')),
    totalPriceCZK: parseNumber(pick('TotalPriceCZK')),
    totalPriceIncDelivery: parseNumber(pick('TotalPriceIncDelivery')),
    totalPriceIncDeliveryCZK: parseNumber(pick('TotalPriceIncDeliveryCZK')),
    totalPriceIncDeliveryComputed: parseNumber(pick('TotalPriceIncDeliveryComputed')),
  };
}

async function processBatch(batch) {
  if (!batch.length) return;

  const columns = [
    'ID', 'PartNo', 'EAN', 'ManufacturerID', 'Manufacturer', 'TyreUsage',
    'SPICurrency', 'SPIDeliveryTime', 'SPIDeliveryTimeTerm', 'SPIRPFree', 'SPIStockAmount', 'SPISuppliersCountry', 'SPITotalPrice', 'SPITotalPriceCZK', 'SPITotalPriceIncDelivery', 'SPITotalPriceIncDeliveryCZK', 'SPITotalPriceIncDeliveryComputed',
    'SPI24Currency', 'SPI24DeliveryTime', 'SPI24DeliveryTimeTerm', 'SPI24RPFree', 'SPI24StockAmount', 'SPI24SuppliersCountry', 'SPI24TotalPrice', 'SPI24TotalPriceCZK', 'SPI24TotalPriceIncDelivery', 'SPI24TotalPriceIncDeliveryCZK', 'SPI24TotalPriceIncDeliveryComputed',
    'SPI48Currency', 'SPI48DeliveryTime', 'SPI48DeliveryTimeTerm', 'SPI48RPFree', 'SPI48StockAmount', 'SPI48SuppliersCountry', 'SPI48TotalPrice', 'SPI48TotalPriceCZK', 'SPI48TotalPriceIncDelivery', 'SPI48TotalPriceIncDeliveryCZK', 'SPI48TotalPriceIncDeliveryComputed',
    'SPILowestPrice', 'SPILowestPriceAmount', 'B2B_AvailableAmount', 'Web_AvailableAmount', 'ActionPrice', 'ModificationDate'
  ];

  const rows = batch.map(item => {
    const spi = extractPriceSection(item, 'StockPriceInfo');
    const spi24 = extractPriceSection(item, 'StockPriceInfo_24');
    const spi48 = extractPriceSection(item, 'StockPriceInfo_48');

    const candidates = [spi, spi24, spi48].filter(p => typeof p.totalPrice === 'number');
    let lowestPrice = 0;
    let lowestAmount = 0;
    if (candidates.length) {
      const lowest = candidates.reduce((acc, curr) => {
        if (!acc || curr.totalPrice < acc.totalPrice) return curr;
        return acc;
      }, null);
      lowestPrice = lowest.totalPrice || 0;
      lowestAmount = lowest.stockAmount || 0;
    }

    const stockAmount = spi.stockAmount ?? 0;

    return [
      parseIntSafe(item.ID) || 0,
      item.PartNo || null,
      item.EAN || null,
      parseIntSafe(item.ManufacturerID),
      item.Manufacturer || null,
      item.TyreUsage || null,

      spi.currency,
      spi.deliveryTime,
      spi.deliveryTimeTerm,
      spi.rpFree,
      spi.stockAmount,
      spi.suppliersCountry,
      spi.totalPrice,
      spi.totalPriceCZK,
      spi.totalPriceIncDelivery,
      spi.totalPriceIncDeliveryCZK,
      spi.totalPriceIncDeliveryComputed,

      spi24.currency,
      spi24.deliveryTime,
      spi24.deliveryTimeTerm,
      spi24.rpFree,
      spi24.stockAmount,
      spi24.suppliersCountry,
      spi24.totalPrice,
      spi24.totalPriceCZK,
      spi24.totalPriceIncDelivery,
      spi24.totalPriceIncDeliveryCZK,
      spi24.totalPriceIncDeliveryComputed,

      spi48.currency,
      spi48.deliveryTime,
      spi48.deliveryTimeTerm,
      spi48.rpFree,
      spi48.stockAmount,
      spi48.suppliersCountry,
      spi48.totalPrice,
      spi48.totalPriceCZK,
      spi48.totalPriceIncDelivery,
      spi48.totalPriceIncDeliveryCZK,
      spi48.totalPriceIncDeliveryComputed,

      lowestPrice,
      lowestAmount,
      stockAmount,
      stockAmount,
      0,
      new Date()
    ];
  });

  const placeholders = columns.map(() => '?').join(', ');
  const sql = `
    INSERT INTO IMPORT_CZS_ProduktyB2B (${columns.join(', ')})
    VALUES ?
    ON DUPLICATE KEY UPDATE ${columns.map(col => `${col}=VALUES(${col})`).join(', ')}
  `;

  return new Promise((resolve, reject) => {
    poolC5pneutyres.query(sql, [rows], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function updateData() {
  // Rezervováno pro navazující logiku po importu (např. další synchronizace).
  return Promise.resolve();
}

// nahrát data z XML B2B – včetně STAŽENÍ z PneuB2B do /backend/import
app.get('/upload-tyres', async (req, res) => {
  try {
    const shouldTruncate = req.query.truncate === 'true';

    if (shouldTruncate) {
      await truncateTable(); // Vyprázdní tabulku, pokud je parametr truncate nastaven na true
    }

    // 1) Nejprve stáhnout aktuální XML z PneuB2B
    const importDir = path.join(__dirname, 'import');
    const xmlFilePath = path.join(importDir, 'B2B_stock_products_list_tyres.xml');

    try {
      const response = await axios.get(pneuB2bHttpUrl, {
        auth: { username: pneuB2bLogin, password: pneuB2bPassword },
        params: { cmd: 'stock_price_list' }, // podle dokumentace ProfiData
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'Accept-Encoding': 'gzip'
        }
      });

      await fs.promises.mkdir(importDir, { recursive: true });
      // writeFile přepíše existující soubor – přesně jak chceš
      await fs.promises.writeFile(xmlFilePath, response.data);
      console.log('PneuB2B stock_price_list stažen a uložen do:', xmlFilePath);
    } catch (downloadErr) {
      console.error('Failed to download XML from PneuB2B:', downloadErr.message);
      return res.status(500).send('Failed to download XML from PneuB2B');
    }

    // 2) Teď otevřeme LOKÁLNÍ soubor z /backend/import a naparsujeme ho
    const stream = fs.createReadStream(xmlFilePath);
    const saxStream = sax.createStream(true);

    let currentTyre = {};
    let currentTagName = null;
    let currentPriceSection = null;
    let tyres = [];
    const batchSize = 100;

    saxStream.on("opentag", node => {
      if (node.name === "Tyre") {
        currentTyre = {};
      } else if (["StockPriceInfo", "StockPriceInfo_24", "StockPriceInfo_48"].includes(node.name)) {
        currentPriceSection = node.name;
      } else {
        currentTagName = node.name;
      }
    });

    saxStream.on("closetag", name => {
      if (name === "Tyre") {
        tyres.push(currentTyre);
        currentTyre = {};
        if (tyres.length >= batchSize) {
          // nečekáme na resolve, ale běží to paralelně – tak, jak jsi to měl
          processBatch(tyres.splice(0, batchSize)).catch(err => {
            console.error('Failed to process batch:', err);
          });
        }
      }
      if (["StockPriceInfo", "StockPriceInfo_24", "StockPriceInfo_48"].includes(name)) {
        currentPriceSection = null;
      }
      currentTagName = null;
    });

    saxStream.on("text", text => {
      const value = text.trim();
      if (!value || !currentTagName || currentTagName === "Tyres") return;

      if (currentPriceSection) {
        currentTyre[`${currentPriceSection}_${currentTagName}`] = value;
      } else {
        currentTyre[currentTagName] = value;
      }
    });

    saxStream.on("end", async () => {
      try {
        if (tyres.length > 0) {
          await processBatch(tyres);
        }
        await updateData();
        res.send('Successfully downloaded and uploaded tyres data to database');
      } catch (e) {
        console.error('Failed to process remaining tyres or update data:', e);
        res.status(500).send('Failed to process tyres data');
      }
    });

    saxStream.on("error", error => {
      console.error('Failed to process XML file:', error);
      res.status(500).send('Failed to upload tyres data');
    });

    stream.pipe(saxStream);
  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).send('An error occurred during the process');
  }
});


// Aktualizace B2B dat z products.xml (B2B_AvailableAmount, Web_AvailableAmount, ActionPrice)
app.post('/refreshTyreData', async (req, res) => {
  console.log('Received request for /refreshTyreData');

  try {
    console.log('Načítání XML z FTP (products.xml)...');
    await fetchXMLFromFTP(ftpDetails, localXMLPath);
    console.log('XML načteno.');
    const xmlData = await parseXML(localXMLPath);
    console.log('XML zpracováno.');

    let xmlItems = xmlData?.Request?.Items?.Item || [];
    if (!Array.isArray(xmlItems)) {
      xmlItems = [xmlItems];
    }

    // PartNo -> { StockAmount, ActionPrice }
    const xmlItemsData = xmlItems.reduce((acc, item) => {
      const attrs = item.$ || {};
      const partNo = attrs.PartNo;
      if (!partNo) return acc;

      const stockAmount = attrs.StockAmount
        ? parseInt(attrs.StockAmount, 10) || 0
        : 0;

      const actionPrice = attrs.Price
        ? parseFloat(attrs.Price) || 0
        : 0;

      acc[partNo] = {
        StockAmount: stockAmount,
        ActionPrice: actionPrice,
      };

      return acc;
    }, {});

    console.log(
      'Zpracovaná data z products.xml (ukázka):',
      Object.entries(xmlItemsData).slice(0, 10)
    );

    let updatedRows = 0;

    for (const [partNo, data] of Object.entries(xmlItemsData)) {
      const updateQuery = `
        UPDATE IMPORT_CZS_ProduktyB2B
        SET
          B2B_AvailableAmount = ?,
          Web_AvailableAmount = ?,
          ActionPrice = ?
        WHERE PartNo = ?
      `;

      await new Promise((resolve, reject) => {
        poolC5pneutyres.query(
          updateQuery,
          [data.StockAmount, data.StockAmount, data.ActionPrice, partNo],
          (err, result) => {
            if (err) {
              console.error('Error executing update query for PartNo:', partNo, err);
              reject(err);
              return;
            }
            updatedRows += result.affectedRows;
            resolve(result);
          }
        );
      });
    }

    console.log('Aktualizace dokončena, změněné řádky:', updatedRows);

    res.json({
      message: 'B2B data byla aktualizována z products.xml',
      itemsInXml: Object.keys(xmlItemsData).length,
      rowsUpdated: updatedRows,
    });
  } catch (error) {
    console.error('Error refreshing tyre data:', error);
    res.status(500).send('Error processing your request');
  } finally {
    try {
      console.log('Odstraňování dočasného souboru products.xml...');
      fs.unlinkSync(localXMLPath);
      console.log('Dočasný soubor odstraněn.');
    } catch (e) {
      console.warn('Nepodařilo se odstranit dočasný soubor:', e?.message);
    }
  }
});


// Získání B2B dat z DB pro konkrétní PartNo (bez práce s FTP)
app.post('/getTyreData', (req, res) => {
  console.log('Received request for /getTyreData with params:', req.body);

  const items = req.body.items || [];
  if (!Array.isArray(items) || items.length === 0) {
    console.log('Nebyla předána žádná položka (items je prázdné pole).');
    return res.json([]);
  }

  const placeholders = items.map(() => '?').join(',');

  const sqlQuery = `
    SELECT
      b.ID,
      b.PartNo,
      b.SPILowestPrice,
      b.SPILowestPriceAmount,
      b.B2B_AvailableAmount,
      b.Web_AvailableAmount,
      b.ActionPrice,
      s.Celkem
    FROM IMPORT_CZS_ProduktyB2B b
    LEFT JOIN IMPORT_PNEU_SKLAD s ON b.PartNo = s.Produkt
    WHERE b.PartNo IN (${placeholders})
  `;

  poolC5pneutyres.query(sqlQuery, items, (err, result) => {
    if (err) {
      console.error('Error executing SQL query:', err);
      return res.status(500).send('Error processing your request');
    }
    console.log('Počet vrácených B2B záznamů:', result.length);
    res.json(result);
  });
});





// Endpoint pro select objednávek B2B
app.get('/b2b_select_orders', (req, res) => {
  const sqlQuery = `
    SELECT
      B2B_Orders.ID AS OrderID,
      B2B_Orders.Number AS OrderNumber,
      B2B_Orders.Currency,
      B2B_Orders.TotalPrice,
      B2B_Orders.PaymentType,
      B2B_Orders.DeliveryStreet,
      B2B_Orders.DeliveryCity,
      B2B_Orders.DeliveryZip,
      B2B_Customers.Name AS CustomerName,
      B2B_Customers.RegNo AS CustomerRegNo
    FROM
      B2B_Orders
    INNER JOIN
      B2B_Customers ON B2B_Orders.CustomerID = B2B_Customers.ID;
  `;

  pool.query(sqlQuery, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(results);
  });
});

// Endpoint pro získání nových objednávek z B2B
app.get('/b2b_orders', async (req, res) => {
  try {
    const url = 'http://beta.pneub2b.eu/SupplierCommunication.ashx';
    const params = new URLSearchParams({ cmd: 'orders_new' });
    const auth = {
      auth: {
        username: '17',
        password: 'dodavatel'
      }
    };

    const response = await axios.get(`${url}?${params}`, auth);
    const ordersXml = response.data; // XML data

    // Parsování XML na JavaScript objekt
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(ordersXml);


    for (const order of result.OrdersArray.Orders[0].Order) {
      // Uložení dodavatele
      const supplier = order.Supplier[0];
      await query(poolC5tpms,
        `INSERT INTO B2B_Suppliers (ID, Name, RegNo, VatNo, Street, City, Zip, Country, CountryID, BankAccountNumber, BankCode, BankName, IBAN, SwiftCode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE Name=VALUES(Name), RegNo=VALUES(RegNo), VatNo=VALUES(VatNo), Street=VALUES(Street), City=VALUES(City), Zip=VALUES(Zip), Country=VALUES(Country), CountryID=VALUES(CountryID), BankAccountNumber=VALUES(BankAccountNumber), BankCode=VALUES(BankCode), BankName=VALUES(BankName), IBAN=VALUES(IBAN), SwiftCode=VALUES(SwiftCode)`,
        [supplier.ID, supplier.Name, supplier.RegNo, supplier.VatNo, supplier.Street, supplier.City, supplier.Zip, supplier.Country, supplier.CountryID, supplier.BankAccountNumber, supplier.BankCode, supplier.BankName, supplier.IBAN, supplier.SwiftCode]
      );

      // Uložení zákazníka
      const customer = order.Customer[0];
      await query(poolC5tpms,
        `INSERT INTO B2B_Customers (ID, Name, RegNo, VatNo, Street, City, Zip, BankAccountNumber, BankCode, BankName, IBAN, SwiftCode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE Name=VALUES(Name), RegNo=VALUES(RegNo), VatNo=VALUES(VatNo), Street=VALUES(Street), City=VALUES(City), Zip=VALUES(Zip), BankAccountNumber=VALUES(BankAccountNumber), BankCode=VALUES(BankCode), BankName=VALUES(BankName), IBAN=VALUES(IBAN), SwiftCode=VALUES(SwiftCode)`,
        [customer.ID, customer.Name, customer.RegNo, customer.VatNo, customer.Street, customer.City, customer.Zip, customer.BankAccountNumber, customer.BankCode, customer.BankName, customer.IBAN, customer.SwiftCode]
      );

      // Uložení objednávky
      await query(poolC5tpms,
        `INSERT INTO B2B_Orders (ID, Number, Currency, TotalPrice, PaymentType, SupplierID, CustomerID, DeliveryStreet, DeliveryCity, DeliveryZip, BatchID, Status, DateOfImport, ConfirmationStatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Accepted', NOW(), 0)
        ON DUPLICATE KEY UPDATE Number=VALUES(Number), Currency=VALUES(Currency), TotalPrice=VALUES(TotalPrice), PaymentType=VALUES(PaymentType), SupplierID=VALUES(SupplierID), CustomerID=VALUES(CustomerID), DeliveryStreet=VALUES(DeliveryStreet), DeliveryCity=VALUES(DeliveryCity), DeliveryZip=VALUES(DeliveryZip), BatchID=VALUES(BatchID), Status='Accepted', DateOfImport=NOW(), ConfirmationStatus=0`,
        [order.ID, order.Number, order.Currency, order.TotalPrice, order.PaymentType, supplier.ID, customer.ID, order.DeliveryAddress[0].Street, order.DeliveryAddress[0].City, order.DeliveryAddress[0].Zip, result.OrdersArray.$.BatchID]
      );

     // Uložení položek objednávky
for (const item of order.Items[0].Item) {
    // Příprava a ošetření číselných hodnot
    const amount = parseInt(item.Amount, 10) || 0;
    const unitPrice = parseFloat(item.UnitPrice) || 0;
    const totalPrice = parseFloat(item.TotalPrice) || 0;
    const vatRate = item.VatRate || null;

    // Získání hodnot, které mohou být undefined/null a nastavení defaultních hodnot
    const partNo = item.PartNo || "N/A"; // Příklad pro PartNo, pokud není k dispozici, nastavíme "N/A"
    const manufacturerID = item.ManufacturerID || null;
    const manufacturerName = item.ManufacturerName || "N/A";
    const description = item.Description || "N/A";
    const state = item.State || "N/A";
    const type = item.Type || "N/A";
    const isIndividualDeliveryFee = item.IsIndividualDeliveryFee || false;
    const productCategoryID = item.ProductCategoryID || null;
    const productCategoryName = item.ProductCategoryName || "N/A";
    const tagFuelEfficiencyClass = item.Product && item.Product[0] && item.Product[0].Tag_FuelEfficiencyClass ? item.Product[0].Tag_FuelEfficiencyClass : "N/A";
    const tagRollingNoise = item.Product && item.Product[0] && item.Product[0].Tag_RollingNoise ? item.Product[0].Tag_RollingNoise : "N/A";
    const tagRollingNoiseDb = item.Product && item.Product[0] && item.Product[0].Tag_RollingNoise_dB ? parseInt(item.Product[0].Tag_RollingNoise_dB, 10) : null;
    const tagWetGripClass = item.Product && item.Product[0] && item.Product[0].Tag_WetGripClass ? item.Product[0].Tag_WetGripClass : "N/A";
    const tagWinter = item.Product && item.Product[0] && item.Product[0].Tag_Winter ? !!item.Product[0].Tag_Winter : false;
    const tagFrost = item.Product && item.Product[0] && item.Product[0].Tag_Frost ? !!item.Product[0].Tag_Frost : false;
    const tagClass = item.Product && item.Product[0] && item.Product[0].Tag_Class ? item.Product[0].Tag_Class : "N/A";

    await query(poolC5tpms,
        `INSERT INTO B2B_Items (ID, OrderID, PartNo, ManufacturerID, ManufacturerName, CodeInternal1, EAN, Description, State, Amount, UnitPrice, Type, IsIndividualDeliveryFee, ProductCategoryID, ProductCategoryName, TotalPrice, VatRate, Tag_FuelEfficiencyClass, Tag_RollingNoise, Tag_RollingNoise_dB, Tag_WetGripClass, Tag_Winter, Tag_Frost, Tag_Class)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE OrderID=VALUES(OrderID), PartNo=VALUES(PartNo), ManufacturerID=VALUES(ManufacturerID), ManufacturerName=VALUES(ManufacturerName), CodeInternal1=VALUES(CodeInternal1), EAN=VALUES(EAN), Description=VALUES(Description), State=VALUES(State), Amount=VALUES(Amount), UnitPrice=VALUES(UnitPrice), Type=VALUES(Type), IsIndividualDeliveryFee=VALUES(IsIndividualDeliveryFee), ProductCategoryID=VALUES(ProductCategoryID), ProductCategoryName=VALUES(ProductCategoryName), TotalPrice=VALUES(TotalPrice), VatRate=VALUES(VatRate), Tag_FuelEfficiencyClass=VALUES(Tag_FuelEfficiencyClass), Tag_RollingNoise=VALUES(Tag_RollingNoise), Tag_RollingNoise_dB=VALUES(Tag_RollingNoise_dB), Tag_WetGripClass=VALUES(Tag_WetGripClass), Tag_Winter=VALUES(Tag_Winter), Tag_Frost=VALUES(Tag_Frost), Tag_Class=VALUES(Tag_Class)`,
        [item.ID, order.ID, partNo, manufacturerID, manufacturerName, item.CodeInternal1, item.EAN, description, state, amount, unitPrice, type, isIndividualDeliveryFee, productCategoryID, productCategoryName, totalPrice, vatRate, tagFuelEfficiencyClass, tagRollingNoise, tagRollingNoiseDb, tagWetGripClass, tagWinter, tagFrost, tagClass]
    );
}}


   

  const batchID = result.OrdersArray.$.BatchID;
    let xmlResponse = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';
    result.OrdersArray.Orders[0].Order.forEach(order => {
      xmlResponse += `    <TransferItem OrderNumber="${order.Number}" State="Accepted" Message="Objednávka byla úspěšně přijata do SQL a je ve zpracování." />\n`;
    });
    xmlResponse += '</Response>';
    console.log('Odesílám XML odpověď:', xmlResponse);
    // Aktualizace ConfirmationStatus na 1 pro všechny objednávky v batch
    await query(poolC5tpms, `UPDATE B2B_Orders SET ConfirmationStatus=1 WHERE BatchID=?`, [batchID]);
    console.log('Odesílám XML odpověď:', xmlResponse);
    // Odeslání XML odpovědi
    res.header("Content-Type", "application/xml");
    res.send(xmlResponse);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Chyba při získávání nebo zpracování dat o objednávkách' });
  }
});



// Endpoin přihlášení
const JWT_SECRET = 'váš_super_tajný_klíč'; // Uložte tento klíč na bezpečném místě!

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Ověření uživatelského jména a hesla...
  const sql = 'SELECT id, username, hashedPassword FROM users WHERE username = ?';
  poolC5tpms.query(sql, [username], async (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }

    if (results.length === 0) {
      return res.status(401).send('Neplatné uživatelské jméno nebo heslo');
    }

    const user = results[0];

    // Porovnání hesla s hashem v databázi
    const match = await bcrypt.compare(password, user.hashedPassword);
    if (!match) {
      return res.status(401).send('Neplatné uživatelské jméno nebo heslo');
    }

    // NAČTI PRÁVA K ROUTÁM tohoto usera
    const rightsSql = 'SELECT route FROM user_routes WHERE user_id = ? AND can_access = 1';
    poolC5tpms.query(rightsSql, [user.id], (rightsErr, rightsResults) => {
      if (rightsErr) {
        console.error('Error fetching user routes:', rightsErr);
        return res.status(500).send('Server error');
      }
      // Vytvoření pole povolených rout
      const allowedRoutes = rightsResults.map(r => r.route);

      // Vytvoření JWT
      const token = jwt.sign({ username: user.username, userID: user.id }, JWT_SECRET, { expiresIn: '24h' });

      // Odeslání JWT a práv klientovi
      res.json({ token, routes: allowedRoutes });
    });
  });
});

// Endpoint pro registraci
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Kontrola, zda uživatelské jméno a heslo byly zadány
  if (!username || !password) {
    return res.status(400).send('Uživatelské jméno a heslo jsou povinné');
  }

  // Ověření, zda uživatelské jméno již neexistuje
  const userExistsSql = 'SELECT * FROM users WHERE username = ?';
  poolC5tpms.query(userExistsSql, [username], async (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }

    if (results.length > 0) {
      return res.status(409).send('Uživatelské jméno již existuje');
    }

    // Hashování hesla
    const hashedPassword = await bcrypt.hash(password, 10);

    // Vložení nového uživatele do databáze
    const insertSql = 'INSERT INTO users (username, hashedPassword) VALUES (?, ?)';
    poolC5tpms.query(insertSql, [username, hashedPassword], (insertErr, insertResults) => {
      if (insertErr) {
        console.error('Error executing query:', insertErr);
        return res.status(500).send('Server error');
      }

      // Registrace byla úspěšná
      res.status(201).send('Uživatel byl úspěšně zaregistrován');
    });
  });
});


// Nastavení multer pro zpracování nahrávaných souborů
const upload = multer({ storage: multer.memoryStorage() });
// IMPORT xls do PLOR
// IMPORT xls do PLOR
app.post('/import-xlsx-an-PLOR', upload.single('file'), async (req, res) => {
  const userId = req.body.userID;
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const versionName = req.body.versionName;
  const componentType = 'PLOR';
  const selectedSheets = JSON.parse(req.body.selectedSheets || '[]');
  let connection;

  try {
    connection = await new Promise((resolve, reject) => {
      poolC5tpms.getConnection((err, conn) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });

    await connection.beginTransaction();

    const filterId = await new Promise((resolve, reject) => {
      const filterData = [userId, componentType, versionName, '', ''];
      connection.query(
        'INSERT INTO Analytic_FilterTemplates (userId, componentType, filterName, filterValues, filterURL) VALUES (?, ?, ?, ?, ?)',
        filterData,
        (err, result) => {
          if (err) reject(err);
          else resolve(result.insertId);
        }
      );
    });

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });

    for (const sheetName of selectedSheets) {
      if (!workbook.SheetNames.includes(sheetName)) {
        console.error(`Sheet '${sheetName}' not found.`);
        continue;
      }
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { raw: false });

      for (const row of jsonData) {
        // Mapování 'Náprava' pomocí mapNaprava
        const mappedNaprava = await mapNaprava(connection, row['Náprava'] || '');

        // Mapování dalších polí pomocí mapField
        const mappedProvoz = await mapField(connection, 'provoz', row['Provoz'] || '');
        const mappedM_S = await mapField(connection, 'ms', row['M+S'] || '');
        const mappedPMSF = await mapField(connection, 'tpmsf', row['3PMSF'] || '');

        const insertData = [
          filterId,
          row['Č. položky'] || null,
          row['Cena'] ? parseFloat(row['Cena'].toString().replace(/[^0-9,.-]/g, '').replace(',', '.')) : null,
          mappedNaprava,
          mappedProvoz,
          mappedM_S,
          mappedPMSF
        ];

        await new Promise((resolve, reject) => {
          connection.query(
            'INSERT INTO IMPORT_CZS_Analytic_PLOR (Verze, C_Polozky, Cena, Naprava, Provoz, MS, PMSF) VALUES (?, ?, ?, ?, ?, ?, ?)',
            insertData,
            (err, results) => {
              if (err) reject(err);
              else resolve(results);
            }
          );
        });
      }
    }

    await connection.commit();
    res.send('Data byla úspěšně importována a mapována na standardní hodnoty.');
  } catch (error) {
    console.error('Error processing file or inserting data:', error);
    if (connection) {
      await connection.rollback();
    }
    res.status(500).send('Error processing file or inserting data');
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// GET /mapNaprava
app.get('/mapNaprava', async (req, res) => {
  try {
    connection = await new Promise((resolve, reject) => {
      poolC5tpms.getConnection((err, conn) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });

    connection.query('SELECT * FROM mapNaprava', (err, results) => {
      if (err) {
        console.error('Error fetching mapNaprava:', err);
        res.status(500).send('Error fetching mapNaprava');
      } else {
        res.json(results);
      }
    });
  } catch (error) {
    console.error('Error connecting to database:', error);
    res.status(500).send('Database connection error');
  } finally {
    if (connection) connection.release();
  }
});

// Data v ProductList
app.get('/productlist', async (req, res) => {
  try {
    await sql.connect(mssqlConfig);
    const request = new sql.Request();

    let query = `
      SELECT TOP 1000
        [ItemId],
        [ItemName],
        [ItsItemName3],
        [PurchLineDisc],
        [SalesPrice],
        [ItsWebAvailableB2B],
        [ItsWebAvailable]
      FROM [AxProdCS].[dbo].[ItsIFInventTable]
    `;

    let whereClauses = [];
    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'activeRuleFilter') continue; // Při tvorbě MSSQL dotazu vynechejte 'activeRuleFilter'
      if (value === '""') {
        whereClauses.push(`([${key}] IS NULL OR [${key}] = '')`);
      } else if (value.includes('|')) {
        const patterns = value.split('|').map(v => v.replace(/\*/g, '%').toLowerCase());
        const orClauses = patterns.map((pattern, index) => {
          const paramName = `${key}_${index}`;
          request.input(paramName, sql.VarChar, pattern);
          return `LOWER([${key}]) LIKE @${paramName}`;
        }).join(' OR ');
        whereClauses.push(`(${orClauses})`);
      } else {
        const paramName = key;
        const pattern = value.replace(/\*/g, '%').toLowerCase();
        request.input(paramName, sql.VarChar, pattern);
        whereClauses.push(`LOWER([${key}]) LIKE @${paramName}`);
      }
    }
    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    const mssqlResult = await request.query(query);
    const products = mssqlResult.recordset;

    const itemIds = products.map(product => product.ItemId);
    const purchLineDiscs = products.map(product => product.PurchLineDisc);
    if (itemIds.length === 0) {
      return res.json([]);
    }
    const placeholders = itemIds.map(() => '?').join(',');
    const purchLineDiscsPlaceholders = purchLineDiscs.map(() => '?').join(',');

    const sqlQuery = `
      SELECT 
        polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
        platnost_od, platnost_do, datum_zapsani, zapsal, marze, B2B, EXT_eshop, cenove_skupiny, jmeno, zdroj
      FROM (
        SELECT 
          polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
          platnost_od, platnost_do, datum_zapsani, zapsal, marze, B2B, EXT_eshop, NULL AS cenove_skupiny, NULL AS jmeno, 'vyprodej' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_vyprodej
        WHERE CURDATE() BETWEEN platnost_od AND platnost_do
        UNION
        SELECT 
          polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
          platnost_od, platnost_do, datum_zapsani, zapsal, marze, B2B, EXT_eshop, NULL AS cenove_skupiny, NULL AS jmeno, 'akce_polozka' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_akce_polozka
        WHERE CURDATE() BETWEEN platnost_od AND platnost_do
        UNION
        SELECT 
          polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
          platnost_od, platnost_do, datum_zapsani, NULL AS zapsal, NULL AS marze, NULL AS B2B, NULL AS EXT_eshop, NULL AS cenove_skupiny, NULL AS jmeno, 'netto' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_netto
        WHERE CURDATE() BETWEEN platnost_od AND platnost_do
        UNION
        SELECT 
          NULL AS polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
          NULL AS platnost_od, NULL AS platnost_do, datum_zapsani, NULL AS zapsal, NULL AS marze, B2B, EXT_eshop, cenove_skupiny, jmeno, 'zakladni_slevy' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_zakladni_slevy
      ) AS combined
      WHERE polozka IN (${placeholders}) OR cenove_skupiny IN (${purchLineDiscsPlaceholders})
      ORDER BY CASE zdroj 
        WHEN 'vyprodej' THEN 1
        WHEN 'akce_polozka' THEN 2
        WHEN 'netto' THEN 3
        WHEN 'zakladni_slevy' THEN 4
      END
    `;

    const params = [...itemIds, ...purchLineDiscs];

    poolC5pneutyres.query(sqlQuery, params, (err, results) => {
      if (err) {
        console.error('Error executing MySQL query:', err);
        return res.status(500).send('Server error');
      }

      const productMap = results.reduce((acc, item) => {
        if (item.zdroj === 'zakladni_slevy') {
          acc[item.cenove_skupiny] = item;
        } else {
          acc[item.polozka] = item;
        }
        return acc;
      }, {});

      const combinedData = products.map(product => {
        const rule = productMap[product.ItemId] || productMap[product.PurchLineDisc] || {};
        return {
          ...product,
          ...rule,
          aktivni_pravidlo: rule.zdroj || 'none'
        };
      });

      // Filtr na základě aktivního pravidla
      const activeRuleFilter = req.query.activeRuleFilter || 'all';
      const filteredData = activeRuleFilter === 'all' ? combinedData : combinedData.filter(item => item.aktivni_pravidlo === activeRuleFilter);

      res.json(filteredData);
    });
  } catch (err) {
    console.error('Database query failed:', err);
    res.status(500).send('Internal Server Error');
  }
});

//product detail
// Endpoint pro získání detailů produktu včetně cenových politik
app.get('/productdetail/:polozka', async (req, res) => {
  const polozka = req.params.polozka;
  
  try {
    // Dotaz do MySQL (c5pneutyres) pro získání cenových politik
    const pricePolicies = await query(poolC5pneutyres, `
      SELECT 
        polozka, 
        \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`, 
        platnost_od, platnost_do, datum_zapsani, zapsal, marze, B2B, EXT_eshop, cenove_skupiny, jmeno, zdroj
      FROM (
        SELECT 
          polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`, 
          platnost_od, platnost_do, datum_zapsani, zapsal, marze, B2B, EXT_eshop, NULL AS cenove_skupiny, NULL AS jmeno, 'vyprodej' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_vyprodej
        WHERE polozka = ?
        UNION
        SELECT 
          polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`, 
          platnost_od, platnost_do, datum_zapsani, zapsal, marze, B2B, EXT_eshop, NULL AS cenove_skupiny, NULL AS jmeno, 'akce_polozka' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_akce_polozka
        WHERE polozka = ?
        UNION
        SELECT 
          polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`, 
          platnost_od, platnost_do, datum_zapsani, NULL AS zapsal, NULL AS marze, NULL AS B2B, NULL AS EXT_eshop, NULL AS cenove_skupiny, NULL AS jmeno, 'netto' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_netto
        WHERE polozka = ?
        UNION
        SELECT 
          NULL AS polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`, 
          NULL AS platnost_od, NULL AS platnost_do, datum_zapsani, NULL AS zapsal, NULL AS marze, B2B, EXT_eshop, cenove_skupiny, jmeno, 'zakladni_slevy' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_zakladni_slevy
        WHERE cenove_skupiny = (SELECT PurchLineDisc FROM ItsIFInventTable WHERE ItemId = ?)
      ) AS combined
    `, [polozka, polozka, polozka, polozka]);

    // Dotaz do MSSQL pro získání základních informací o produktu
    const result = await sql.query(`
      SELECT 
        ItemId, ItemName, ItsItemName3, ItsItemName2, ItsProducerCode, ItsAssortmentCode, 
        ItsTyreSeasonality, ItsTyrePosition, ItsTyreUseMode, ItsTyreSectionWidth, ItsTyreRIMDiameter, 
        ItsTyreConstructionCode, ItsTyreSpeedIndexCode, ItsTyreLoadIndexCode, ItsReinforced, ItsMSMark, 
        ItsFlangeProtection, ItsTyreTubeType, ItsRunFlatType, ItsTyreAspectRatio, ItsTyreAspectRatioDescription, 
        ItsWebAvailable, ItsWebAvailableB2B, ItsWebAvailableExt, ItsMarketingActionId, ItsActionDateFrom, ItsActionDateTo, 
        ItsActionPrice, ItsMaxTyrePatternHigh, ItsMaxTyreDrivenDistance, ItsEnergeticEfficiency, ItsWetBrake, 
        ItsOutLoudness, ItsRetentionalNumber, ItsItemDescription, ItsSnowflakeInMountain, ItemGroupId, UnitId, 
        NetWeight, TaraWeight, GrossWeight, ItemType, PurchLineDisc, SalesPrice, SalesPriceDate, PrimaryVendorId, 
        ExternalItemId, PurchStopped, InventStopped, SalesStopped, ItsItemEAN, RecyclingUnitAmount, ItsItemIdFreight, 
        PdsFreightAllocationGroupId, MarkupGroupId, ItsURLPicture, ItsURLEprel, ItsURLQRCode, ItsProducerCategory, 
        ItsCanvasCount, DataAreaId, Partition, ItsJoinedItemName
      FROM dbo.ItsIFInventTable
      WHERE ItemId = @polozka
    `, { input: 'polozka', value: polozka });

    const productDetails = result.recordset[0];

    res.json({
      product: productDetails,
      pricePolicies: pricePolicies
    });
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});





app.get('/pricepolicies/:polozka', async (req, res) => {
  const polozka = req.params.polozka;
  try {
    const query = `
      SELECT 
        polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
        platnost_od, platnost_do, zdroj
      FROM (
        SELECT 
          polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
          platnost_od, platnost_do, 'vyprodej' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_vyprodej
        WHERE polozka = ?
        UNION
        SELECT 
          polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
          platnost_od, platnost_do, 'akce_polozka' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_akce_polozka
        WHERE polozka = ?
        UNION
        SELECT 
          polozka, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`,
          platnost_od, platnost_do, 'netto' AS zdroj
        FROM IMPORT_CZS_Kalkulace_cen_netto
        WHERE polozka = ?
      ) AS combined
    `;
    const [results] = await db.execute(query, [polozka, polozka, polozka]);
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching price policies');
  }
});
app.get('/basicdiscounts/:polozka', async (req, res) => {
  const polozka = req.params.polozka;
  try {
    const query = `
      SELECT 
        cenove_skupiny, \`1_eshop\`, \`2_pult\`, \`3_servis\`, \`4_vo\`, \`5_vip\`, \`6_indiv\`, \`7_dopravci\`
      FROM IMPORT_CZS_Kalkulace_cen_zakladni_slevy
      WHERE cenove_skupiny = (SELECT PurchLineDisc FROM ItsIFInventTable WHERE ItemId = ?)
    `;
    const [results] = await db.execute(query, [polozka]);
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching basic discounts');
  }
});










// Odebrání položky z kalkulace-netto
app.delete('/delete-data-netto/:polozka', (req, res) => {
  const polozka = req.params.polozka;

  const sql = `
    DELETE FROM IMPORT_CZS_Kalkulace_cen_netto 
    WHERE polozka = ?;
  `;

  poolC5pneutyres.query(sql, [polozka], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    if (results.affectedRows === 0) {
      return res.status(404).send('Item not found');
    }
    res.sendStatus(200);
  });
});





// Získání dat pro tabulku kalkulace-netto
app.get('/get-kalkulace-cen-netto', (req, res) => {
  const filters = req.query;
  const status = filters.status;
  delete filters.status;

  // Definujte povolené sloupce a jejich operátory
  const allowedFilters = [
    'polozka', '1_eshop', '2_pult', '3_servis', '4_vo', '5_vip', '6_indiv', '7_dopravci',
    'platnost_od', 'platnost_do', 'popis_pneu_tyres', 'popis_heureka', 'datum_zapsani',
    'marze', 'zapsal', 'B2B', 'EXT_eshop', 'nazev_polozky', 'Name','Prodano', 'Limit', 'Aktivni'
  ];
  
  let sql = `
    SELECT A.*, 
           COALESCE(C.Name, 'Není v Pneu-tyres.cz') AS Name
    FROM IMPORT_CZS_Kalkulace_cen_netto A
    LEFT JOIN ps_product B ON A.polozka = B.reference
    LEFT JOIN ps_product_lang C ON C.id_product = B.id_product
    WHERE 1=1
  `;  // Přidáno WHERE 1=1 pro usnadnění přidávání AND podmínek

  const sqlValues = [];

  // Přidání filtrování na základě statusu (valid, invalid, expiring)
  const today = new Date().toISOString().split('T')[0];
  if (status === 'valid') {
    sql += ` AND (A.platnost_od IS NULL OR A.platnost_od <= ?)`;
    sql += ` AND (A.platnost_do IS NULL OR A.platnost_do >= ?)`;
    sqlValues.push(today, today);
  } else if (status === 'expiring') {
    sql += ` AND A.platnost_do > ? AND A.platnost_do <= ?`;
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    sqlValues.push(today, nextWeekStr);
  } else if (status === 'invalid') {
    sql += ` AND (A.platnost_do IS NOT NULL AND A.platnost_do < ?)`;
    sqlValues.push(today);
  }

  Object.keys(filters).forEach(filter => {
    if (allowedFilters.includes(filter)) {
      if (filter === 'Name') {
        sql += ` AND C.${filter} LIKE ?`;
        sqlValues.push(`%${filters[filter]}%`);
      } else {
        sql += ` AND A.${filter} LIKE ?`;
        sqlValues.push(`%${filters[filter]}%`);
      }
    }
    // Pokud filtr není povolený, je ignorován
  });

  poolC5pneutyres.query(sql, sqlValues, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});







app.put('/update-data-netto', (req, res) => {
  let newData = req.body;

  console.log('Received data:', JSON.stringify(newData, null, 2));

  const updatePromises = newData.map(async item => {
    if (!item || !item.polozka) {
      console.error('Invalid item:', item);
      return Promise.reject(new Error('Invalid item'));
    }

    // Získání polí a hodnot z item
    const fields = Object.keys(item);
    const values = Object.values(item);

    // Odstranění pole 'id' z INSERT a UPDATE částí
    const insertFields = fields
      .filter(field => field !== 'id')
      .map(field => `\`${field}\``)
      .join(', ');

    const insertPlaceholders = fields
      .filter(field => field !== 'id')
      .map(() => '?')
      .join(', ');

    const updateFields = fields
      .filter(field => field !== 'polozka' && field !== 'id') // Neaktualizovat 'polozka' a 'id'
      .map(field => `\`${field}\` = VALUES(\`${field}\`)`)
      .join(', ');

    const sql = `
      INSERT INTO IMPORT_CZS_Kalkulace_cen_netto (${insertFields})
      VALUES (${insertPlaceholders})
      ON DUPLICATE KEY UPDATE ${updateFields};
    `;

    console.log('Executing SQL:', sql);
    console.log('With values:', values.filter((_, index) => fields[index] !== 'id'));

    return new Promise((resolve, reject) => {
      poolC5pneutyres.query(sql, values.filter((_, index) => fields[index] !== 'id'), (error, results) => {
        if (error) {
          console.error('Error executing SQL:', error);
          reject(error);
        } else {
          console.log('SQL query executed successfully:', results);
          resolve(results);
        }
      });
    });
  });

  Promise.all(updatePromises)
    .then(results => {
      console.log('All data successfully updated:', results);
      res.sendStatus(200);
    })
    .catch(error => {
      console.error('Failed to update data:', error);
      res.status(500).send('Internal server error');
    });
});








// Odebrání položky z kalkulace-akce-polozka
app.delete('/delete-data-akcepolozka/:polozka', (req, res) => {
  const polozka = req.params.polozka;

  const sql = `
    DELETE FROM IMPORT_CZS_Kalkulace_cen_akce_polozka 
    WHERE polozka = ?;
  `;

  poolC5pneutyres.query(sql, [polozka], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    if (results.affectedRows === 0) {
      return res.status(404).send('Item not found');
    }
    res.sendStatus(200);
  });
});

// Získání dat pro tabulku kalkulace-akce-polozka
app.get('/get-kalkulace-cen-akcepolozka', (req, res) => {
  const filters = req.query;
  const status = filters.status;
  delete filters.status;

  // Definujte povolené sloupce a jejich operátory
  const allowedFilters = [
    'polozka', '1_eshop', '2_pult', '3_servis', '4_vo', '5_vip', '6_indiv', '7_dopravci',
    'platnost_od', 'platnost_do', 'popis_pneu_tyres', 'popis_heureka', 'datum_zapsani',
    'marze', 'zapsal', 'B2B', 'EXT_eshop', 'nazev_polozky', 'Name','Skladem'
  ];
  
  let sql = `
    SELECT A.*, 
           COALESCE(C.Name, 'Není v Pneu-tyres.cz') AS Name
    FROM IMPORT_CZS_Kalkulace_cen_akce_polozka A
    LEFT JOIN ps_product B ON A.polozka = B.reference
    LEFT JOIN ps_product_lang C ON C.id_product = B.id_product
    WHERE 1=1
  `;  // Přidáno WHERE 1=1 pro usnadnění přidávání AND podmínek

  const sqlValues = [];

  // Přidání filtrování na základě statusu (valid, invalid, expiring)
  const today = new Date().toISOString().split('T')[0];
  if (status === 'valid') {
    sql += ` AND (A.platnost_od IS NULL OR A.platnost_od <= ?)`;
    sql += ` AND (A.platnost_do IS NULL OR A.platnost_do >= ?)`;
    sqlValues.push(today, today);
  } else if (status === 'expiring') {
    sql += ` AND A.platnost_do > ? AND A.platnost_do <= ?`;
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    sqlValues.push(today, nextWeekStr);
  } else if (status === 'invalid') {
    sql += ` AND (A.platnost_do IS NOT NULL AND A.platnost_do < ?)`;
    sqlValues.push(today);
  }

  Object.keys(filters).forEach(filter => {
    if (allowedFilters.includes(filter)) {
      if (filter === 'Name') {
        sql += ` AND C.${filter} LIKE ?`;
        sqlValues.push(`%${filters[filter]}%`);
      } else {
        sql += ` AND A.${filter} LIKE ?`;
        sqlValues.push(`%${filters[filter]}%`);
      }
    }
    // Pokud filtr není povolený, je ignorován
  });

  poolC5pneutyres.query(sql, sqlValues, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});

  


// Endpoint pro načítání dat z IMPORT_CZS_ProduktyB2B
app.get('/get-import-produktyb2b', (req, res) => {
  const filters = req.query;
  let sql = `
  SELECT 
    ID,
    PartNo,
    EAN,
    DisplayName,
    Manufacturer,
    Width,
    Profile,
    Diameter,
    Axle,
    TyreUsage,
    MarketSegmentation,
    SPILowestPrice,
    SPILowestPriceAmount
  FROM IMPORT_CZS_ProduktyB2B 
  WHERE ProductCategoryName LIKE 'Pneu_NAKL%'
  `;

  const sqlValues = [];
  Object.keys(filters).forEach(filter => {
    if (filter === 'Manufacturer' && Array.isArray(filters[filter])) {
      sql += ' AND (';
      sql += filters[filter].map(() => 'Manufacturer = ?').join(' OR ');
      sql += ')';
      sqlValues.push(...filters[filter]);
    } else if (Array.isArray(filters[filter])) {
      sql += ` AND ${filter} IN (${filters[filter].map(() => '?').join(', ')})`;
      sqlValues.push(...filters[filter]);
    } else {
      sql += ` AND ${filter} LIKE ?`;
      sqlValues.push(`%${filters[filter]}%`);
    }
  });

  sql += ' LIMIT 500';

  poolC5pneutyres.query(sql, sqlValues, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});

// Endpoint pro načítání dat z IMPORT_CZS_ProduktyB2B
app.get('/get-product-stock', (req, res) => {
  const sql = `
    SELECT *
    FROM IMPORT_PNEU_SKLAD
  `;

  poolC5pneutyres.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});




// filtrování produktů B2B
app.get('/get-filter-values', (req, res) => {
  const filterColumns = ['Manufacturer', 'Width', 'Profile', 'Diameter', 'Axle', 'TyreUsage', 'MarketSegmentation'];
  const currentFilters = req.query;

  const promises = filterColumns.map(column => {
    return new Promise((resolve, reject) => {
      // Speciální zacházení pro Manufacturer
      if (column === 'Manufacturer' && currentFilters.Manufacturer) {
        const selectedManufacturers = Array.isArray(currentFilters.Manufacturer)
          ? currentFilters.Manufacturer
          : [currentFilters.Manufacturer];

        // Vytvoření podmínky pro ostatní filtry bez zohlednění Manufacturer
        const otherFilters = filterColumns.filter(col => col !== 'Manufacturer');
        const conditions = otherFilters
          .filter(filterKey => currentFilters[filterKey])
          .map(filterKey => {
            const values = Array.isArray(currentFilters[filterKey]) ? currentFilters[filterKey] : [currentFilters[filterKey]];
            const placeholders = values.map(() => '?').join(', ');
            return `${filterKey} IN (${placeholders})`;
          })
          .join(' AND ');

        const sql = `
          SELECT DISTINCT Manufacturer
          FROM IMPORT_CZS_ProduktyB2B
          WHERE Manufacturer IS NOT NULL
            AND ProductCategoryName LIKE 'Pneu_NAKL%'
            ${conditions ? `AND ${conditions}` : ''}
          ORDER BY Manufacturer ASC
        `;

        const queryValues = otherFilters
          .filter(filterKey => currentFilters[filterKey])
          .flatMap(filterKey => Array.isArray(currentFilters[filterKey]) ? currentFilters[filterKey] : [currentFilters[filterKey]]);

        poolC5pneutyres.query(sql, queryValues, (err, results) => {
          if (err) {
            return reject(err);
          }
          const allManufacturers = results.map(row => row.Manufacturer);
          const uniqueManufacturers = Array.from(new Set([...selectedManufacturers, ...allManufacturers]));
          resolve({ column, values: uniqueManufacturers });
        });
      } else {
        // Obecný dotaz pro ostatní sloupce
        const conditions = Object.keys(currentFilters)
          .filter(filterKey => filterColumns.includes(filterKey) && currentFilters[filterKey] && filterKey !== 'Manufacturer')
          .map(filterKey => {
            const values = Array.isArray(currentFilters[filterKey]) ? currentFilters[filterKey] : [currentFilters[filterKey]];
            const placeholders = values.map(() => '?').join(', ');
            return `${filterKey} IN (${placeholders})`;
          })
          .join(' AND ');

        const sql = `
          SELECT DISTINCT ${column}
          FROM IMPORT_CZS_ProduktyB2B
          WHERE ${column} IS NOT NULL
            AND ProductCategoryName LIKE 'Pneu_NAKL%'
            ${conditions ? `AND ${conditions}` : ''}
          ORDER BY ${column} ASC
        `;

        const queryValues = Object.keys(currentFilters)
          .filter(filterKey => filterColumns.includes(filterKey) && currentFilters[filterKey] && filterKey !== 'Manufacturer')
          .flatMap(filterKey => Array.isArray(currentFilters[filterKey]) ? currentFilters[filterKey] : [currentFilters[filterKey]]);

        poolC5pneutyres.query(sql, queryValues, (err, results) => {
          if (err) {
            return reject(err);
          }
          resolve({ column, values: results.map(row => row[column]) });
        });
      }
    });
  });

  Promise.all(promises)
    .then(filterValues => {
      const response = filterValues.reduce((acc, curr) => {
        acc[curr.column] = curr.values;
        return acc;
      }, {});
      res.json(response);
    })
    .catch(err => {
      console.error('Error fetching filter values:', err);
      res.status(500).send('Server error');
    });
});

// Endpoint pro aktualizaci skladem, popis_pneu_tyres a Informace pro obě tabulky pomocí GET metody
app.get('/update-skladem', (req, res) => {
  poolC5pneutyres.getConnection((err, connection) => {
    if (err) {
      console.error('Chyba při získávání připojení:', err);
      return res.status(500).json({ message: 'Chyba při získávání připojení k databázi.' });
    }

    // Začátek transakce
    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        console.error('Chyba při zahájení transakce:', err);
        return res.status(500).json({ message: 'Chyba při zahájení transakce.' });
      }

      // Funkce pro aktualizaci jedné tabulky
      const updateTable = (tableName, callback) => {
        // Krok 1: Aktualizace Skladem
        const updateSklademSQL = `
          UPDATE ${tableName} AS akce
          JOIN IMPORT_PNEU_SKLAD AS sklad ON akce.polozka = sklad.Produkt
          SET akce.Skladem = CAST(REPLACE(sklad.Celkem, ',', '.') AS DECIMAL(10,2))
        `;

        connection.query(updateSklademSQL, (err, updateSklademResult) => {
          if (err) {
            return callback(err);
          }

          // Krok 1.1: Aktualizace Informace pro aktualizované Skladem
          const updateInformaceSklademSQL = `
            UPDATE ${tableName} AS akce
            JOIN IMPORT_PNEU_SKLAD AS sklad ON akce.polozka = sklad.Produkt
            SET akce.Informace = 'Skladem aktualizováno'
            WHERE sklad.Produkt IS NOT NULL
          `;

          connection.query(updateInformaceSklademSQL, (err, updateInformaceSklademResult) => {
            if (err) {
              return callback(err);
            }

            // Krok 2: Aktualizace popis_pneu_tyres
            const updatePopisSQL = `
              UPDATE ${tableName} AS akce
              LEFT JOIN IMPORT_PNEU_SKLAD AS sklad ON akce.polozka = sklad.Produkt
              SET akce.popis_pneu_tyres = 'Vypnout'
              WHERE sklad.Produkt IS NULL AND akce.platnost_do > CURDATE()
            `;

            connection.query(updatePopisSQL, (err, updatePopisResult) => {
              if (err) {
                return callback(err);
              }

              // Krok 2.1: Aktualizace Informace pro aktualizované popis_pneu_tyres
              const updateInformacePopisSQL = `
                UPDATE ${tableName} AS akce
                LEFT JOIN IMPORT_PNEU_SKLAD AS sklad ON akce.polozka = sklad.Produkt
                SET akce.Informace = 'Popis_pneu_tyres nastaveno na Vypnout'
                WHERE sklad.Produkt IS NULL AND akce.platnost_do > CURDATE()
              `;

              connection.query(updateInformacePopisSQL, (err, updateInformacePopisResult) => {
                if (err) {
                  return callback(err);
                }

                // Krok 3: Získání seznamu položek, které byly nastaveny na 'Vypnout'
                const selectUpdatedItemsSQL = `
                  SELECT akce.polozka
                  FROM ${tableName} AS akce
                  LEFT JOIN IMPORT_PNEU_SKLAD AS sklad ON akce.polozka = sklad.Produkt
                  WHERE sklad.Produkt IS NULL AND akce.platnost_do > CURDATE()
                `;

                connection.query(selectUpdatedItemsSQL, (err, updatedItems) => {
                  if (err) {
                    return callback(err);
                  }

                  // Shromáždění výsledků pro tuto tabulku
                  const results = {
                    updatedSklademRows: updateSklademResult.affectedRows,
                    updatedInformaceSklademRows: updateInformaceSklademResult.affectedRows,
                    updatedPopisRows: updatePopisResult.affectedRows,
                    updatedInformacePopisRows: updateInformacePopisResult.affectedRows,
                    itemsVypnout: updatedItems.map(item => item.polozka),
                  };

                  callback(null, results);
                });
              });
            });
          });
        });
      };

      // Aktualizace pro obě tabulky
      updateTable('IMPORT_CZS_Kalkulace_cen_akce_polozka', (err, resultsAkce) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            console.error('Chyba při aktualizaci tabulky akce_polozka:', err);
            res.status(500).json({ message: 'Chyba při aktualizaci tabulky akce_polozka.' });
          });
        }

        updateTable('IMPORT_CZS_Kalkulace_cen_vyprodej', (err, resultsVyprodej) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error('Chyba při aktualizaci tabulky vyprodej:', err);
              res.status(500).json({ message: 'Chyba při aktualizaci tabulky vyprodej.' });
            });
          }

          // Commit transakce
          connection.commit(err => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error('Chyba při commit transakce:', err);
                res.status(500).json({ message: 'Chyba při commit transakce.' });
              });
            }

            connection.release();
            res.json({
              message: 'Aktualizace Skladem, popis_pneu_tyres a Informace byla úspěšná pro obě tabulky.',
              akce_polozka: resultsAkce,
              vyprodej: resultsVyprodej,
            });
          });
        });
      });
    });
  });
});




// UpdateDataAkcePolozka.js (nebo součást vašeho hlavního serverového souboru)

app.put('/update-data-akcepolozka', (req, res) => {
  let newData = req.body;

  console.log('Received data for akce_polozka:', JSON.stringify(newData, null, 2));

  const updatePromises = newData.map(async item => {
    if (!item || !item.polozka) {
      console.error('Invalid item:', item);
      return Promise.reject(new Error('Invalid item'));
    }

    // Získání klíčů a hodnot z položky
    const fields = Object.keys(item);
    const values = Object.values(item);

    // Odstraníme pole 'id' z INSERT (a pro UPDATE také)
    const insertFields = fields
      .filter(field => field !== 'id')
      .map(field => `\`${field}\``)
      .join(', ');
    const insertPlaceholders = fields
      .filter(field => field !== 'id')
      .map(() => '?')
      .join(', ');

    // Pro UPDATE nechceme aktualizovat 'polozka' ani 'id'
    const updateFields = fields
      .filter(field => field !== 'polozka' && field !== 'id')
      .map(field => `\`${field}\` = VALUES(\`${field}\`)`)
      .join(', ');

    const sql = `
      INSERT INTO IMPORT_CZS_Kalkulace_cen_akce_polozka (${insertFields})
      VALUES (${insertPlaceholders})
      ON DUPLICATE KEY UPDATE ${updateFields};
    `;

    // Vytáhneme hodnoty pro INSERT (vynecháme 'id')
    const filteredValues = values.filter((_, index) => fields[index] !== 'id');

    console.log('Executing SQL for akce_polozka:', sql);
    console.log('With values:', filteredValues);

    return new Promise((resolve, reject) => {
      poolC5pneutyres.query(sql, filteredValues, (error, results) => {
        if (error) {
          console.error('Error executing SQL for akce_polozka:', error);
          reject(error);
        } else {
          console.log('SQL query executed successfully for akce_polozka:', results);
          resolve(results);
        }
      });
    });
  });

  Promise.all(updatePromises)
    .then(results => {
      console.log('All data for akce_polozka successfully updated:', results);
      res.sendStatus(200);
    })
    .catch(error => {
      console.error('Failed to update data for akce_polozka:', error);
      res.status(500).send('Internal server error');
    });
});




// Endpoint pro odstranění dat pro výprodej
app.delete('/delete-data-vyprodej/:polozka', (req, res) => {
  const polozka = req.params.polozka;

  if (!polozka) {
    return res.status(400).send('Položka není specifikována');
  }

  const sql = `DELETE FROM IMPORT_CZS_Kalkulace_cen_vyprodej WHERE polozka = ?`;

  poolC5pneutyres.query(sql, [polozka], (err, results) => {
    if (err) {
      console.error('Error executing DELETE query for vyprodej:', err);
      return res.status(500).send('Server error');
    }

    if (results.affectedRows === 0) {
      return res.status(404).send('Položka nenalezena');
    }

    res.sendStatus(200);
  });
});


// Endpoint pro aktualizaci dat pro výprodej
// UpdateDataVyprodej.js (nebo součást vašeho hlavního serverového souboru)

app.put('/update-data-vyprodej', (req, res) => {
  let newData = req.body;

  console.log('Received data for vyprodej:', JSON.stringify(newData, null, 2));

  const updatePromises = newData.map(async item => {
    if (!item || !item.polozka) {
      console.error('Invalid item:', item);
      return Promise.reject(new Error('Invalid item'));
    }

    // Získání polí a hodnot z item
    const fields = Object.keys(item);
    const values = fields.map(field => item[field]);

    // Odstranění pole 'id' z INSERT a UPDATE částí
    const filteredFields = fields.filter(field => field !== 'id');

    const insertFields = filteredFields.map(field => `\`${field}\``).join(', ');
    const insertPlaceholders = filteredFields.map(() => '?').join(', ');

    const updateFields = filteredFields
      .filter(field => field !== 'polozka') // Neaktualizovat 'polozka'
      .map(field => `\`${field}\` = VALUES(\`${field}\`)`)
      .join(', ');

    const sql = `
      INSERT INTO IMPORT_CZS_Kalkulace_cen_vyprodej (${insertFields})
      VALUES (${insertPlaceholders})
      ON DUPLICATE KEY UPDATE ${updateFields};
    `;

    // Filtrace hodnot odpovídajících filteredFields
    const filteredValues = filteredFields.map(field => item[field]);

    console.log('Executing SQL for vyprodej:', sql);
    console.log('With values:', filteredValues);

    return new Promise((resolve, reject) => {
      poolC5pneutyres.query(sql, filteredValues, (error, results) => {
        if (error) {
          console.error('Error executing SQL for vyprodej:', error);
          reject(error);
        } else {
          console.log('SQL query executed successfully for vyprodej:', results);
          resolve(results);
        }
      });
    });
  });

  Promise.all(updatePromises)
    .then(results => {
      console.log('All data for vyprodej successfully updated:', results);
      res.sendStatus(200);
    })
    .catch(error => {
      console.error('Failed to update data for vyprodej:', error);
      res.status(500).send('Internal server error');
    });
});

//odebrání položky ze základních slev
app.delete('/delete-data-zakladni-slevy/:cenove_skupiny', (req, res) => {
  const cenove_skupiny = req.params.cenove_skupiny;

  const sql = `
    DELETE FROM IMPORT_CZS_Kalkulace_cen_zakladni_slevy 
    WHERE cenove_skupiny = ?;
  `;

  poolC5pneutyres.query(sql, [cenove_skupiny], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    if (results.affectedRows === 0) {
      return res.status(404).send('Item not found');
    }
    res.sendStatus(200);
  });
});

//získání dat ze základních slev
app.get('/get-kalkulace-zakladni-slevy', (req, res) => {
  const filters = req.query;
  let sql = `
  SELECT *
  FROM IMPORT_CZS_Kalkulace_cen_zakladni_slevy
  WHERE 1=1
  `;

  const sqlValues = [];

  Object.keys(filters).forEach(filter => {
    sql += ` AND ${filter} LIKE ?`;
    sqlValues.push(`%${filters[filter]}%`);
  });

  poolC5pneutyres.query(sql, sqlValues, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});


//získání dat ze základních slev
app.get('/get-tavinox-zakladni-slevy', (req, res) => {
  const filters = req.query;
  let sql = `
  SELECT *
  FROM IMPORT_CZS_Tavinox_zakladni_slevy
  WHERE 1=1
  `;

  const sqlValues = [];

  Object.keys(filters).forEach(filter => {
    sql += ` AND ${filter} LIKE ?`;
    sqlValues.push(`%${filters[filter]}%`);
  });

  poolC5pneutyres.query(sql, sqlValues, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});


//aktualizace základních slev
app.put('/update-data-zakladni-slevy', (req, res) => {
  const newData = req.body;

  console.log('Received data:', JSON.stringify(newData, null, 2)); // Logování příchozích dat pro debugování

  const updatePromises = newData.map(item => {
    if (!item) {
      console.error('Received null or undefined item');
      return Promise.reject(new Error('Received null or undefined item'));
    }

    const {
      cenove_skupiny,
      jmeno = '',
      '1_eshop': eshop = '',
      '2_pult': pult = '',
      '3_servis': servis = '',
      '4_vo': vo = '',
      '5_vip': vip = '',
      '6_indiv': indiv = '',
      '7_dopravci': dopravci = '',
      B2B = '',
      EXT_eshop = '',
      PointS = '',
      isNew = false // Nastavení výchozí hodnoty pro isNew
    } = item;

    console.log('Processing item:', {
      cenove_skupiny,
      jmeno,
      eshop,
      pult,
      servis,
      vo,
      vip,
      indiv,
      dopravci,
      B2B,
      PointS,
      EXT_eshop,
      isNew
    });

    let sql;
    let values;

    if (isNew) {
      sql = `
        INSERT INTO IMPORT_CZS_Kalkulace_cen_zakladni_slevy 
        (cenove_skupiny, jmeno, 1_eshop, 2_pult, 3_servis, 4_vo, 5_vip, 6_indiv, 7_dopravci, datum_zapsani, B2B, PointS, EXT_eshop)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
        ON DUPLICATE KEY UPDATE
        jmeno = VALUES(jmeno),
        1_eshop = VALUES(1_eshop),
        2_pult = VALUES(2_pult),
        3_servis = VALUES(3_servis),
        4_vo = VALUES(4_vo),
        5_vip = VALUES(5_vip),
        6_indiv = VALUES(6_indiv),
        7_dopravci = VALUES(7_dopravci),
        datum_zapsani = NOW(),
        B2B = VALUES(B2B),
        PointS = VALUES(PointS),
        EXT_eshop = VALUES(EXT_eshop);
      `;
      values = [cenove_skupiny, jmeno, eshop, pult, servis, vo, vip, indiv, dopravci, B2B, PointS, EXT_eshop];
    } else {
      sql = `
        UPDATE IMPORT_CZS_Kalkulace_cen_zakladni_slevy 
        SET 
          jmeno = ?,
          1_eshop = ?,
          2_pult = ?,
          3_servis = ?,
          4_vo = ?,
          5_vip = ?,
          6_indiv = ?,
          7_dopravci = ?,
          datum_zapsani = NOW(),
          B2B = ?,
          PointS = ?,
          EXT_eshop = ?
        WHERE cenove_skupiny = ?;
      `;
      values = [jmeno, eshop, pult, servis, vo, vip, indiv, dopravci, B2B, PointS, EXT_eshop, cenove_skupiny];
    }

    console.log('Executing SQL:', sql);
    console.log('With values:', values);

    return new Promise((resolve, reject) => {
      poolC5pneutyres.query(sql, values, (error, results) => {
        if (error) {
          console.error('Error executing SQL:', error);
          reject(error);
        } else {
          console.log('SQL query executed successfully:', results);
          resolve(results);
        }
      });
    });
  });

  Promise.all(updatePromises)
    .then(results => {
      console.log('All data successfully updated:', results);
      res.sendStatus(200);
    })
    .catch(error => {
      console.error('Failed to update data:', error);
      res.status(500).send('Internal server error');
    });
});



// Uložení dat do ImportCenyB2B
app.post('/update-kalkulace-slevy-B2B', (req, res) => {
  const { cPolozky, updates } = req.body; // Přijímáme více aktualizací

  if (!cPolozky || !updates || !Array.isArray(updates)) {
    return res.status(400).send('Invalid request data');
  }

  const validFields = ['Nazev', 'Nazev2', 'Nazev3', 'Prodej', 'EAN', 'Sirka', 'Rafek', 'Profil', 'SK_radkove_slevy', 'SK_polozek', 'Sleva', 'C_Ext', 'DOT', 'Datum zmeny', 'Dostupnost_Web', 'Dostupnost_B2B', 'AX_B2B', 'Zmenil'];

  // Filtrujeme pouze platné aktualizace
  const validUpdates = updates.filter(update => validFields.includes(update.field) && typeof update.value !== 'undefined');

  // Pokud neexistují žádné platné aktualizace, vraťte chybu
  if (validUpdates.length === 0) {
    return res.status(400).send('No valid updates provided');
  }

  // Pro každou platnou aktualizaci spustit SQL příkaz
  validUpdates.forEach(update => {
    const sql = `UPDATE IMPORT_CZS_Ceny_B2B SET ${update.field} = ? WHERE C_Polozky = ?`;

    poolC5pneutyres.query(sql, [update.value, cPolozky], (err, result) => {
      if (err) {
        console.error('Error executing update query:', err);
        return res.status(500).send('Server error during update');
      }
      if (result.affectedRows === 0) {
        return res.status(404).send('No row found with the given C_Polozky');
      }
    });
  });

  // Odpověď po úspěšné aktualizaci
  res.send('Update successful for provided fields');
});


// generování PDF pomocí pupeteer
app.get('/generate-pdf/:orderId', async (req, res) => {
  const { orderId } = req.params; // Získání orderId z URL
  const targetUrl = `http://localhost:3001/objednavka-b2b-detail/${orderId}`; // Dynamické vytvoření cílové URL

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(targetUrl, { waitUntil: 'networkidle2' });

  // Nastavení pro PDF
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
  });

  await browser.close();

  // Odeslání PDF jako odpověď
  res.contentType('application/pdf');
  res.send(pdf);
});

// Detail B2B objednávky
app.get('/get-b2b-order-details/:orderId', (req, res) => {
  const { orderId } = req.params;
  poolC5tpms.query(`SELECT 
  B2B_Orders.*, 
  B2B_Customers.Name AS CustomerName, 
  B2B_Customers.RegNo AS CustomerRegNo, 
  B2B_Customers.VatNo, 
  B2B_Customers.Street AS CustomerStreet, 
  B2B_Customers.City AS CustomerCity, 
  B2B_Customers.Zip AS CustomerZip, 
  B2B_Customers.BankAccountNumber, 
  B2B_Customers.BankCode, 
  B2B_Customers.BankName, 
  B2B_Customers.IBAN, 
  B2B_Customers.SwiftCode
FROM B2B_Orders
INNER JOIN B2B_Customers ON B2B_Orders.CustomerID = B2B_Customers.ID
WHERE B2B_Orders.ID = ?`, [orderId], (err, orderResults) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }

    poolC5tpms.query('SELECT * FROM B2B_Items WHERE OrderID = ?', [orderId], (err, itemResults) => {
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).send('Server error');
      }

      // Převod výsledků na prostý objekt, pokud je to potřeba
      const orderDetails = JSON.parse(JSON.stringify(orderResults));
      const orderItems = JSON.parse(JSON.stringify(itemResults));

      res.json({ orderDetails: orderDetails[0], orderItems });
    });
  });
});

// Získání dat o objednávkách B2B
app.get('/get-b2b-orders', (req, res) => {
  
 
  
  let sql = `
  SELECT
      o.ID AS OrderID,
      o.Number,
      o.Currency,
      o.TotalPrice,
      o.PaymentType,
      o.SupplierID,
      o.CustomerID,
      o.DeliveryStreet,
      o.DeliveryCity,
      o.DeliveryZip,
      o.BatchID,
      o.Status,
      o.DateOfImport,
      o.ConfirmationStatus,
      c.Name AS CustomerName,
      c.RegNo,
      c.VatNo,
      c.Street AS CustomerStreet,
      c.City AS CustomerCity,
      c.Zip AS CustomerZip,
      c.BankAccountNumber,
      c.BankCode,
      c.BankName,
      c.IBAN,
      c.SwiftCode
  FROM
      B2B_Orders o
  JOIN B2B_Customers c ON o.CustomerID = c.ID;`;

  const params = req.query;

  const filters = Object.keys(params).map(key => {
    // Zde je důležité zajistit, že klíče jsou bezpečné a odpovídají sloupcům v databázi
    // a hodnoty jsou správně escapovány
    return mysql.escapeId(key) + '=' + mysql.escape(params[key]);
  });

  if (filters.length) {
    sql += ' WHERE ' + filters.join(' AND ');
  }

  poolC5tpms.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});


// Endpoint pro získání dat pro výprodej

app.get('/get-kalkulace-cen-vyprodej', (req, res) => {
  const filters = req.query;
  const status = filters.status;
  delete filters.status;

  // Definujte povolené sloupce a jejich operátory
  const allowedFilters = [
    'polozka', '1_eshop', '2_pult', '3_servis', '4_vo', '5_vip', '6_indiv', '7_dopravci',
    'platnost_od', 'platnost_do', 'popis_pneu_tyres', 'popis_heureka', 'datum_zapsani',
    'marze', 'zapsal', 'B2B', 'EXT_eshop', 'nazev_polozky', 'Name','Skladem'
  ];
  
  let sql = `
    SELECT A.*, 
           COALESCE(C.Name, 'Není v Pneu-tyres.cz') AS Name
    FROM IMPORT_CZS_Kalkulace_cen_vyprodej A
    LEFT JOIN ps_product B ON A.polozka = B.reference
    LEFT JOIN ps_product_lang C ON C.id_product = B.id_product
    WHERE 1=1
  `;  // Přidáno WHERE 1=1 pro usnadnění přidávání AND podmínek

  const sqlValues = [];

  // Přidání filtrování na základě statusu (valid, invalid, expiring)
  const today = new Date().toISOString().split('T')[0];
  if (status === 'valid') {
    sql += ` AND (A.platnost_od IS NULL OR A.platnost_od <= ?)`;
    sql += ` AND (A.platnost_do IS NULL OR A.platnost_do >= ?)`;
    sqlValues.push(today, today);
  } else if (status === 'expiring') {
    sql += ` AND A.platnost_do > ? AND A.platnost_do <= ?`;
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    sqlValues.push(today, nextWeekStr);
  } else if (status === 'invalid') {
    sql += ` AND (A.platnost_do IS NOT NULL AND A.platnost_do < ?)`;
    sqlValues.push(today);
  }

  Object.keys(filters).forEach(filter => {
    if (allowedFilters.includes(filter)) {
      if (filter === 'Name') {
        sql += ` AND C.${filter} LIKE ?`;
        sqlValues.push(`%${filters[filter]}%`);
      } else {
        sql += ` AND A.${filter} LIKE ?`;
        sqlValues.push(`%${filters[filter]}%`);
      }
    }
    // Pokud filtr není povolený, je ignorován
  });

  poolC5pneutyres.query(sql, sqlValues, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});





// Select dat a porovnání mezi _IMP a _PLOR
app.get('/get-comparison-data', (req, res) => {
  const plorVerze = req.query.plorVerze;
  const impVerze = req.query.impVerze;

  if (!plorVerze || !impVerze) {
    return res.status(400).send('Chybějící parametry verze.');
  }

  const sql = `
    SELECT 
      PLOR.Verze,
      PLOR.C_Polozky,
      PLOR.C_Polozky2,
      PLOR.C_Polozky3,
      PLOR.C_Polozky4,
      PLOR.EAN,
      PLOR.EAN2,
      PLOR.EAN3,
      PLOR.EAN4,
      COALESCE(PLOR.Nazev, IMP.nazev_produktu) AS Nazev,
      PLOR.Cena,
      PLOR.Prodej_cena AS Prodej_PLOR,
      PLOR.Uzivatel,
      PLOR.Skupina_radkove_slevy,
      IMP.externi_cislo_polozky AS Ext_cislo_AX,
      IMP.prodej_cena AS Prodej_AX,
      IMP.dostupnost_web AS dostupnost_Web_AX,
      IMP.dostupnost_b2b AS dostupnost_B2B_AX,
      IMP.prodej_datum_ceny AS prodej_datum_ceny_AX,
      IMP.c_polozky AS C_Polozky_AX,
      CASE
        WHEN IMP.id IS NULL THEN 'NESPÁROVÁNO - pouze v PLOR'
        WHEN PLOR.C_Polozky IS NULL THEN 'NESPÁROVÁNO - pouze v IMP'
        ELSE CONCAT_WS(', ',
          CASE 
            WHEN PLOR.C_Polozky = IMP.c_polozky THEN 'C_Polozky=IMP_c_polozky'
            WHEN PLOR.C_Polozky2 = IMP.c_polozky THEN 'C_Polozky2=IMP_c_polozky'
            WHEN PLOR.C_Polozky3 = IMP.c_polozky THEN 'C_Polozky3=IMP_c_polozky'
            WHEN PLOR.C_Polozky4 = IMP.c_polozky THEN 'C_Polozky4=IMP_c_polozky'
            WHEN PLOR.C_Polozky = IMP.externi_cislo_polozky THEN 'Ext_cislo_polozky=C_Polozky'
            WHEN PLOR.C_Polozky2 = IMP.externi_cislo_polozky THEN 'Ext_cislo_polozky=C_Polozky2'
            WHEN PLOR.C_Polozky3 = IMP.externi_cislo_polozky THEN 'Ext_cislo_polozky=C_Polozky3'
            WHEN PLOR.C_Polozky4 = IMP.externi_cislo_polozky THEN 'Ext_cislo_polozky=C_Polozky4'
          END,
          CASE 
            WHEN PLOR.Cena = IMP.prodej_cena THEN 'Prodej shodný'
            ELSE 'Prodej neshodný'
          END
        )
      END AS shoda
    FROM 
      IMPORT_CZS_Analytic_PLOR AS PLOR
    LEFT JOIN 
      IMPORT_CZS_Analytik_IMP AS IMP ON PLOR.C_Polozky = IMP.c_polozky OR 
                                        PLOR.C_Polozky2 = IMP.c_polozky OR 
                                        PLOR.C_Polozky3 = IMP.c_polozky OR 
                                        PLOR.C_Polozky4 = IMP.c_polozky OR 
                                        PLOR.C_Polozky = IMP.externi_cislo_polozky OR
                                        PLOR.C_Polozky2 = IMP.externi_cislo_polozky OR
                                        PLOR.C_Polozky3 = IMP.externi_cislo_polozky OR
                                        PLOR.C_Polozky4 = IMP.externi_cislo_polozky
    WHERE PLOR.Verze = ? AND IMP.Verze = ?

    UNION ALL

    SELECT 
      NULL AS Verze,
      IMP.c_polozky AS C_Polozky_AX,
      NULL AS C_Polozky2,
      NULL AS C_Polozky3,
      NULL AS C_Polozky4,
      NULL AS EAN,
      NULL AS EAN2,
      NULL AS EAN3,
      NULL AS EAN4,
      IMP.nazev_produktu AS Nazev,
      IMP.naklady_cena AS Imp_Cena,
      IMP.prodej_cena AS Prodej_PLOR,
      NULL AS Uzivatel,
      NULL AS Skupina_radkove_slevy,
      IMP.externi_cislo_polozky AS Ext_cislo_AX,
      IMP.prodej_cena AS Prodej_AX,
      IMP.dostupnost_web AS dostupnost_Web_AX,
      IMP.dostupnost_b2b AS dostupnost_B2B_AX,
      IMP.prodej_datum_ceny AS Prodej_Datum_Ceny_AX,
      IMP.c_polozky AS C_Polozky_AX,
      'NESPÁROVÁNO - pouze v IMP' AS Shoda
    FROM 
      IMPORT_CZS_Analytik_IMP AS IMP
    WHERE IMP.Verze = ? AND NOT EXISTS (
      SELECT 1 FROM IMPORT_CZS_Analytic_PLOR AS PLOR WHERE 
        IMP.c_polozky = PLOR.C_Polozky OR 
        IMP.c_polozky = PLOR.C_Polozky2 OR 
        IMP.c_polozky = PLOR.C_Polozky3 OR 
        IMP.c_polozky = PLOR.C_Polozky4 OR 
        IMP.externi_cislo_polozky = PLOR.C_Polozky OR
        IMP.externi_cislo_polozky = PLOR.C_Polozky2 OR
        IMP.externi_cislo_polozky = PLOR.C_Polozky3 OR
        IMP.externi_cislo_polozky = PLOR.C_Polozky4
    )
  `;

  // Více parametrů 'impVerze' pro obě části dotazu
  poolC5tpms.query(sql, [plorVerze, impVerze, impVerze], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});

  

//Import dat z CZS_Analytik
app.get('/get-import-data-CZS-Analytik', (req, res) => {
  const sql = 'SELECT * FROM IMPORT_CZS_Analytik_IMP';

  poolC5tpms.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
    } else {
      res.json(results);
    }
  });
});

//Endpoint pro aktualizaci dat z Mikrotik KNOT
app.get('/update-parsed-data', (req, res) => {
  const sql = `
    UPDATE tyre_data td
    INNER JOIN (
      SELECT 
        pd.macAddress, 
        pd.pressure, 
        pd.temperature
      FROM 
        parsed_ad_data pd
      INNER JOIN (
        SELECT 
          macAddress, 
          MAX(timestamp) AS maxTimestamp
        FROM 
          parsed_ad_data
        GROUP BY 
          macAddress
      ) AS subq ON pd.macAddress = subq.macAddress AND pd.timestamp = subq.maxTimestamp
    ) AS latestData ON td.macAddress = latestData.macAddress
    SET 
      td.actualTemp = latestData.temperature,
      td.actualPressure = latestData.pressure,
      td.actualPressure20 = ROUND(latestData.pressure * (293.15 / (latestData.temperature + 273.15)), 2);
  `;

  poolC5tpms.query(sql, (err, result) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }
    res.send('Data byla úspěšně aktualizována');
  });
});
// Endpoint pro odebrání TPMS
app.post('/remove-sensor', (req, res) => {
  const { RZ, position } = req.body;

  const sql = `
    DELETE FROM tyre_data
    WHERE RZ = ? AND position = ?;
  `;

  poolC5tpms.query(sql, [RZ, position], (err, result) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }
    res.send('Senzor byl úspěšně odebrán');
  });
});

// Nový endpoint pro získávání údajů o senzorech
app.get('/sensorsRZ/:RZ', (req, res) => {
  const { RZ } = req.params;

  const sensorsSql = `
    SELECT p1.*, t.position, t.idealPressure,tyreID, tyreSize, tyreProfil, tyreRim, RZ,
           FROM_UNIXTIME(p1.timestamp / 1000, '%Y-%m-%d %H:%i:%s') AS formatted_timestamp,
           p1.pressure AS current_pressure,
           p1.temperature AS current_temperature,
           RIGHT(p1.macAddress, 6) AS short_macAddress
    FROM parsed_ad_data p1
    JOIN (
        SELECT macAddress, MAX(timestamp) AS max_timestamp
        FROM parsed_ad_data
        GROUP BY macAddress
    ) p2 ON p1.macAddress = p2.macAddress AND p1.timestamp = p2.max_timestamp
    JOIN tyre_data t ON p1.macAddress = t.macAddress
    WHERE t.RZ = ?
    ORDER BY t.position ASC;
  `;

  poolC5tpms.query(sensorsSql, [RZ], (err, sensorsResults) => {
    if (err) {
      console.error('Error executing sensors query:', err);
      res.status(500).send('Server error');
      return;
    }

    sensorsResults.forEach(sensor => {
      const currentPressure = sensor.current_pressure;
      const currentTemperature = sensor.current_temperature;
      const adjustedPressure = currentPressure * (293 / (273 + currentTemperature));
      sensor.adjusted_pressure_20C = adjustedPressure;
    });

    res.json(sensorsResults);
  });
});


// Endpoint pro získání aktuálních senzorů s přiřazením k vozidlům
app.get('/sensors', (req, res) => {
  const { locationId } = req.query;

  if (!locationId) {
      return res.status(400).json({ error: 'locationId je povinný parametr' });
  }

  const sql = `
      SELECT p1.*, t.position, t.RZ, t.idealPressure,
             FROM_UNIXTIME(p1.timestamp / 1000, '%Y-%m-%d %H:%i:%s') AS formatted_timestamp,
             p1.pressure AS current_pressure,
             p1.temperature AS current_temperature,
             RIGHT(p1.macAddress, 6) AS short_macAddress
      FROM parsed_ad_data p1
      JOIN (
          SELECT macAddress, MAX(timestamp) as max_timestamp
          FROM parsed_ad_data
          WHERE locationId = ?
          GROUP BY macAddress
      ) p2 ON p1.macAddress = p2.macAddress AND p1.timestamp = p2.max_timestamp
      LEFT JOIN tyre_data t ON p1.macAddress = t.macAddress
      WHERE p1.timestamp >= UNIX_TIMESTAMP() * 1000 - 6000000000000 -- posledních 10 minut=600000
      ORDER BY t.position ASC;
  `;

  poolC5tpms.query(sql, [locationId], (error, results) => {
      if (error) {
          console.error('Error fetching sensors data:', error);
          return res.status(500).json({ error: 'Chyba při získávání dat z čidel.' });
      }

      res.json(results);
  });
});

app.get('/sensorsRZs', (req, res) => {
  const { RZs } = req.query;

  if (!RZs) {
    return res.status(400).json({ error: 'RZs je povinný parametr' });
  }

  const RZList = RZs.split(',');

  const placeholders = RZList.map(() => '?').join(',');
  const sensorsSql = `
    SELECT 
    p1.*, 
    t.position, 
    t.idealPressure, 
    t.RZ,
    FROM_UNIXTIME(p1.timestamp / 1000, '%Y-%m-%d %H:%i:%s') AS formatted_timestamp,
    p1.pressure AS current_pressure,
    p1.temperature AS current_temperature,
    RIGHT(p1.macAddress, 6) AS short_macAddress,
    d.deviceName, 
    d.idCar,
    d.longitude, 
    d.latitude
FROM parsed_ad_data p1
JOIN (
    SELECT macAddress, MAX(timestamp) AS max_timestamp
    FROM parsed_ad_data
    GROUP BY macAddress
) p2 ON p1.macAddress = p2.macAddress AND p1.timestamp = p2.max_timestamp
JOIN tyre_data t ON p1.macAddress = t.macAddress
LEFT JOIN device_list d ON (
    (d.identification = 'MAC' AND p1.locationId = d.MacAddress)
    OR (d.identification = 'IMEI' AND p1.locationId = d.IMEI)
) 
WHERE t.RZ IN (${placeholders})
ORDER BY t.RZ ASC, t.position ASC;
  `;

  poolC5tpms.query(sensorsSql, RZList, (err, sensorsResults) => {
    if (err) {
      console.error('Error executing sensors query:', err);
      res.status(500).send('Server error');
      return;
    }

    sensorsResults.forEach(sensor => {
      const currentPressure = sensor.current_pressure;
      const currentTemperature = sensor.current_temperature;
      const adjustedPressure = currentPressure * (293 / (273 + currentTemperature));
      sensor.adjusted_pressure_20C = adjustedPressure;
    });

    res.json(sensorsResults);
  });
});


// Endpoint pro aktualizaci informací o pneumatice
app.post('/update-tyre-data', (req, res) => {
  const { position, macAddress, RZ } = req.body;

  // Krok 1: Aktualizace původního vozidla (odstranění čipu)
  const removeOldChip = `
  UPDATE tyre_data
  SET macAddress = NULL
  WHERE macAddress = ? AND (RZ != ? OR position != ?);
`;
poolC5tpms.query(removeOldChip, [macAddress, RZ, position], (err, result) => {
  
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }

    // Krok 2: Aktualizace nebo vložení dat pro nový vůz
    const sql = `
      INSERT INTO tyre_data (position, macAddress, RZ)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
      macAddress = VALUES(macAddress);
    `;
    poolC5tpms.query(sql, [position, macAddress, RZ], (err, result) => {
      if (err) {
        console.error('Error executing query:', err);
        res.status(500).send('Server error');
        return;
      }
      res.send('Data byla úspěšně uložena nebo aktualizována');
    });
  });
});


// Endpoint pro aktualizaci zobrazených dat ze senzoru
app.get('/vehicle-tyre-data', (req, res) => {
  const vehicleRZ = req.query.rz;
  if (!vehicleRZ) {
    res.status(400).send('Missing vehicle RZ parameter');
    return;
  }

  const sql = `
    SELECT
      tyre_data.position,
      tyre_data.actualPressure,
      tyre_data.actualPressure20,
      tyre_data.actualTemp
    FROM tyre_data
    WHERE tyre_data.RZ = ?`;

  poolC5tpms.query(sql, [vehicleRZ], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }
    console.log('Vehicle tyre data for RZ:', vehicleRZ, results);
    res.json(results);
  });
});



// Endpoint pro získání dat z kalendáře
app.get('/getCalendarStatus', async (req, res) => {
    try {
        const response = await axios.get(`https://www.bookingforsure.eu/calendar/getCalendar/1147?taskID=1&startdate=2024-01-23&enddate=2024-01-23&tirediameter=IN
TEGER&tirewithdisk=[Y|N] `, {
            headers: {
                'x-api-key': 'F4342F19D53CED42D9C68F32B243B57C', // Aktualizovaný API klíč
                'Accept': 'application/json'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Chyba při získávání dat z kalendáře:', error);
        res.status(500).send('Chyba při získávání dat z kalendáře');
    }
});

// endpoint pro získání výpisu aktivních čidel
app.get('/available-tpms-sensors', (req, res) => {
  const sql = `
    SELECT p1.*, 
           FROM_UNIXTIME(p1.timestamp / 1000, '%Y %D %M %H:%i:%s') AS formatted_timestamp,
           t.RZ AS SPZ, 
           t.position AS Pozice
    FROM parsed_ad_data p1
    JOIN (
        SELECT macAddress, MAX(timestamp) as max_timestamp
        FROM parsed_ad_data
    --    WHERE timestamp > UNIX_TIMESTAMP(NOW() - INTERVAL 2 HOUR) * 1000 AND leaking = 1
        GROUP BY macAddress
    ) p2 ON p1.macAddress = p2.macAddress AND p1.timestamp = p2.max_timestamp
    LEFT JOIN tyre_data t ON p1.macAddress = t.macAddress
    -- WHERE p1.timestamp > UNIX_TIMESTAMP(NOW() - INTERVAL 2 HOUR) * 1000 AND p1.leaking = 1;
  `;

  poolC5tpms.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }
    res.json(results);
  });
});

app.get('/compare-tpms-data', (req, res) => {
    const vehicleRZ = req.query.rz;
    if (!vehicleRZ) {
        return res.status(400).send('Chybí parametr vozidla RZ');
    }

    // SQL dotaz pro získání aktuálních dat TPMS senzorů
    const tpmsSql = `
        SELECT p1.*, 
               FROM_UNIXTIME(p1.timestamp / 1000, '%Y %D %M %H:%i:%s') AS formatted_timestamp,
               t.RZ AS SPZ, 
               t.position AS Pozice
        FROM parsed_ad_data p1
        JOIN (
            SELECT macAddress, MAX(timestamp) as max_timestamp
            FROM parsed_ad_data
            GROUP BY macAddress
        ) p2 ON p1.macAddress = p2.macAddress AND p1.timestamp = p2.max_timestamp
        LEFT JOIN tyre_data t ON p1.macAddress = t.macAddress;`;

    // SQL dotaz pro získání dat z montážního listu
    const sheetSql = `
         SELECT sd.*, td.*
    FROM sheet_data sd
    LEFT JOIN tyre_data td ON sd.vozidlo = td.RZ
    WHERE sd.vozidlo = ? AND sd.cislo_montazniho_listu = '1';`;

    // Provedení SQL dotazů
    poolC5tpms.query(tpmsSql, (tpmsErr, tpmsResults) => {
        if (tpmsErr) {
            console.error('Error executing TPMS query:', tpmsErr);
            return res.status(500).send('Server error');
        }

        poolC5tpms.query(sheetSql, [vehicleRZ], (sheetErr, sheetResults) => {
            if (sheetErr) {
                console.error('Error executing sheet data query:', sheetErr);
                return res.status(500).send('Server error');
            }

            // Zpracování výsledků a porovnání dat
            const sheetData = sheetResults.length > 0 ? JSON.parse(sheetResults[0].pneumatiky_stav || '[]') : [];
            const comparedData = tpmsResults.map(tpmsSensor => {
                // Zjistěte, zda jsou data senzoru shodná s daty v montážním listu
                // ...
                return {
                    ...tpmsSensor,
                    // další informace z porovnání
                };
            });

            res.json(comparedData);
        });
    });
});
// Endpoint pro uložení konfigurace pneuservisu
  app.post('/service-configuration', (req, res) => {
  const { service_id, value_type, value, additional_value_required, additional_value_unit } = req.body;

  const insertSql = `
    INSERT INTO service_configurations (service_id, value_type, value, additional_value_required, additional_value_unit)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    value_type = VALUES(value_type),
    value = VALUES(value),
    additional_value_required = VALUES(additional_value_required),
    additional_value_unit = VALUES(additional_value_unit);
  `;

  poolC5tpms.query(insertSql, [service_id, value_type, value, additional_value_required, additional_value_unit], (err, result) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }
    res.send('Konfigurace služby byla úspěšně uložena');
  });
});

// Endpoint pro načtení konfigurace pneuservisu
app.get('/services', (req, res) => {
  const sql = `
    SELECT s.id as service_id, s.name, sc.id as config_id, sc.value_type, sc.value, sc.additional_value_required, sc.additional_value_unit
    FROM services s
    LEFT JOIN service_configurations sc ON s.id = sc.service_id;
  `;

  poolC5tpms.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }
    res.json(results);
  });
});

// Endpoint pro odstranění konfigurace služby
  app.delete('/service-configuration/:configId', (req, res) => {
  const { configId } = req.params;

  const sql = `
    DELETE FROM service_configurations
    WHERE id = ?;
  `;

  poolC5tpms.query(sql, [configId], (err, result) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }
    res.send('Konfigurace služby byla úspěšně odstraněna');
  });
});
// endpoint pro uložení montážního listu
app.post('/save-sheet-data', (req, res) => {
  const { cislo_montazniho_listu, stav, zakaznik, vozidlo, provedene_prace, pneumatiky_stav } = req.body;

  // Příprava SQL dotazu pro vložení nebo aktualizaci dat
  const sql = `
    INSERT INTO sheet_data (cislo_montazniho_listu, stav, zakaznik, vozidlo, provedene_prace, pneumatiky_stav)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    stav = VALUES(stav),
    zakaznik = VALUES(zakaznik),
    vozidlo = VALUES(vozidlo),
    provedene_prace = VALUES(provedene_prace),
    pneumatiky_stav = VALUES(pneumatiky_stav);
  `;

  // Data pro vložení nebo aktualizaci
  const values = [cislo_montazniho_listu, stav, zakaznik, vozidlo, JSON.stringify(provedene_prace), JSON.stringify(pneumatiky_stav)];

  // Spuštění SQL dotazu
  poolC5tpms.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }
    res.send('Data byla úspěšně uložena nebo aktualizována');
  });
});



//získání seznamu služeb
app.get('/service_tasks', (req, res) => {
  const sql = 'SELECT * FROM service_tasks';

  poolC5tpms.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }
    res.json(results);
  });
});

// vytvořit nebo načíst montážní list
app.get('/get-or-create-sheet', (req, res) => {
  const vehicleRZ = req.query.rz;
  const tpmsData = req.query.tpmsData; // Přijímáme tpmsData z URL

  if (!vehicleRZ) {
    return res.status(400).send('Chybí parametr vozidla RZ');
  }

  // Příprava SQL dotazu pro získání montážního listu
  const getSql = `
    SELECT *
    FROM sheet_data
    WHERE cislo_montazniho_listu = '1' AND vozidlo = ?;
  `;

  // Spuštění dotazu pro získání montážního listu
  poolC5tpms.query(getSql, [vehicleRZ], (getErr, getResult) => {
    if (getErr) {
      console.error('Error executing query:', getErr);
      return res.status(500).send('Server error');
    }

    if (getResult.length === 0) {
      // Montážní list neexistuje, vytvořit nový záznam
      const createSql = `
        INSERT INTO sheet_data (cislo_montazniho_listu, vozidlo, TPMS_data)
        VALUES ('1', ?, ?);
      `;

      poolC5tpms.query(createSql, [vehicleRZ, tpmsData], (createErr, createResult) => {
        if (createErr) {
          console.error('Error executing query:', createErr);
          return res.status(500).send('Server error');
        }

        res.json({ message: 'Montážní list byl vytvořen', data: createResult });
      });
    } else {
      // Montážní list existuje, aktualizovat data
      const updateSql = `
        UPDATE sheet_data
        SET TPMS_data = ?
        WHERE cislo_montazniho_listu = '1' AND vozidlo = ?;
      `;

      poolC5tpms.query(updateSql, [tpmsData, vehicleRZ], (updateErr, updateResult) => {
        if (updateErr) {
          console.error('Error executing query:', updateErr);
          return res.status(500).send('Server error');
        }

        res.json({ message: 'Montážní list byl aktualizován', data: updateResult });
      });
    }
  });
});

// Endpoint pro získání a uložení dat o nákladních penumatikách z B2B
app.get('/updateB2BTyresData', (req, res) => {
  const url = 'http://beta.pneub2b.eu/SupplierCommunication.ashx';
  const params = new URLSearchParams({
      cmd: 'getTyres', // Tento parametr by měl být aktualizován podle skutečného příkazu API
      // další potřebné parametry, například pro filtrování pouze nákladních pneumatik
  });

  axios.get(`${url}?${params}`)
      .then(response => {
          const parser = new xml2js.Parser();
          parser.parseStringPromise(response.data).then(result => {
              const tyres = result.Tyres.Tyre.map(tyre => [
                  tyre.ID[0],
                  tyre.PartNo[0],
                  tyre.EAN[0],
                  tyre.DisplayName[0],
                  parseInt(tyre.ManufacturerID[0]),
                  tyre.Manufacturer[0],
                  parseInt(tyre.PatternID[0]),
                  tyre.Pattern[0],
                  parseInt(tyre.Width[0]),
                  parseInt(tyre.Profile[0]),
                  parseInt(tyre.Diameter[0]),
                  tyre.LoadIndexFrom[0],
                  tyre.SpeedIndex[0],
                  tyre.Usage[0],
                  parseInt(tyre.VehicleTypeCode[0]),
                  parseFloat(tyre.RetailPrice_CZ[0]),
                  tyre.RetailPriceCurrency_CZ[0],
                  tyre.TyreUsage[0]
              ]);

              const sql = `INSERT INTO TruckTyres (ID, PartNo, EAN, DisplayName, ManufacturerID, Manufacturer, PatternID, Pattern, Width, Profile, Diameter, LoadIndexFrom, SpeedIndex, Usage, VehicleTypeCode, RetailPrice_CZ, RetailPriceCurrency_CZ, TyreUsage) VALUES ? ON DUPLICATE KEY UPDATE PartNo=VALUES(PartNo), EAN=VALUES(EAN), DisplayName=VALUES(DisplayName), ManufacturerID=VALUES(ManufacturerID), Manufacturer=VALUES(Manufacturer), PatternID=VALUES(PatternID), Pattern=VALUES(Pattern), Width=VALUES(Width), Profile=VALUES(Profile), Diameter=VALUES(Diameter), LoadIndexFrom=VALUES(LoadIndexFrom), SpeedIndex=VALUES(SpeedIndex), Usage=VALUES(Usage), VehicleTypeCode=VALUES(VehicleTypeCode), RetailPrice_CZ=VALUES(RetailPrice_CZ), RetailPriceCurrency_CZ=VALUES(RetailPriceCurrency_CZ), TyreUsage=VALUES(TyreUsage)`;

              poolC5tpms.query(sql, [tyres], (error, results) => {
                  if (error) throw error;
                  res.send('Data o nákladních pneumatikách byla úspěšně aktualizována.');
              });
          }).catch(err => {
              console.error('Error parsing XML:', err);
              res.status(500).send('Chyba při parsování XML.');
          });
      })
      .catch(error => {
          console.error('Error fetching data:', error);
          res.status(500).send('Chyba při získávání dat z API.');
      });
});


app.get('/updateB2BTyresData', (req, res) => {
  const url = 'http://beta.pneub2b.eu/SupplierCommunication.ashx';
  const username = '0';
  const password = 'PartnerPa$$w0Rd';
  const base64Auth = Buffer.from(`${username}:${password}`).toString('base64');
  const params = new URLSearchParams({
      cmd: 'products_list',
      VehicleTypeCode: '8'
  });

  axios.get(`${url}?${params.toString()}`, {
    headers: {
      'Authorization': `Basic ${base64Auth}`,
      'Accept-Encoding': 'gzip'
    },
    responseType: 'arraybuffer'
  })
  .then(response => {
    zlib.gunzip(response.data, (err, decompressed) => {
      if (err) {
        console.error('Error decompressing data:', err);
        res.status(500).send('Chyba při dekomprimaci dat.');
        return;
      }

      const parser = new xml2js.Parser();
      parser.parseString(decompressed.toString(), (err, result) => {
        if (err) {
          console.error('Error parsing XML:', err);
          res.status(500).send('Chyba při parsování XML.');
          return;
        }

        // Zpracování a ukládání dat
        const tyres = result.Response.Tyres[0].Tyre.map(tyre => ({
          ID: tyre.ID[0],
          PartNo: tyre.PartNo[0],
          DisplayName: tyre.DisplayName[0],
          Manufacturer: tyre.Manufacturer[0],
          Width: tyre.Width[0],
          Profile: tyre.Profile[0],
          Diameter: tyre.Diameter[0],
          LoadIndex: tyre.LoadIndexFrom[0],
          SpeedIndex: tyre.SpeedIndex[0],
          VehicleTypeCode: tyre.VehicleTypeCode[0],
          RetailPrice_CZ: tyre.RetailPrice_CZ[0],
          RetailPriceCurrency_CZ: tyre.RetailPriceCurrency_CZ[0],
          TyreUsage: tyre.TyreUsage[0]
        }));

        // Příklad ukládání dat do databáze
        const sql = 'INSERT INTO TruckTyres SET ? ON DUPLICATE KEY UPDATE PartNo=VALUES(PartNo), DisplayName=VALUES(DisplayName), Manufacturer=VALUES(Manufacturer), Width=VALUES(Width), Profile=VALUES(Profile), Diameter=VALUES(Diameter), LoadIndex=VALUES(LoadIndex), SpeedIndex=VALUES(SpeedIndex), VehicleTypeCode=VALUES(VehicleTypeCode), RetailPrice_CZ=VALUES(RetailPrice_CZ), RetailPriceCurrency_CZ=VALUES(RetailPriceCurrency_CZ), TyreUsage=VALUES(TyreUsage)';
        tyres.forEach(tyre => {
          poolC5tpms.query(sql, tyre, (error, results) => {
            if (error) throw error;
            // Zde můžete logovat úspěšné vložení nebo aktualizaci
          });
        });

        res.send('Data o nákladních pneumatikách byla úspěšně aktualizována.');
      });
    });
  })
  .catch(error => {
      console.error('Error fetching data:', error);
      res.status(500).send('Chyba při získávání dat z API.');
  });
});
  // Načítání všech šablon s detaily náprav
  app.get('/templates', (req, res) => {
    const sql = `
      SELECT vt.templateId, vt.templateName, vt.numberOfAxles, vt.Active, ad.*
      FROM VehicleTemplates vt
      LEFT JOIN AxleDetails ad ON vt.templateId = ad.templateId
      ORDER BY vt.templateId, ad.axlePosition;
    `;

    poolC5tpms.query(sql, (err, results) => {
      if (err) {
        console.error('Error executing query:', err);
        res.status(500).send('Server error');
        return;
      }
      res.json(results);
    });
  });

  

  // Endpoint pro vyhledávání vozidla a zápis informací
app.get('/search-vehicles', (req, res) => {
  const searchTerm = req.query.term;
  console.log('Search request received with term:', searchTerm);

  const vehicleSql = `
    SELECT 
      vehicle_data.RZ,
      vehicle_data.TPMS,
      vehicle_data.GPS,
      vehicle_data.Measurement,
      COALESCE(vehicle_data.tachographKm, 'Není k dispozici') AS tachographKm,
      vehicle_data.vehicleType,
      vehicle_data.templateId,
      company_data.companyName
    FROM vehicle_data
    LEFT JOIN company_data ON vehicle_data.companyId = company_data.companyId
    WHERE vehicle_data.RZ LIKE ?
    GROUP BY vehicle_data.RZ`;

  poolC5tpms.query(vehicleSql, ['%' + searchTerm + '%'], (err, vehicleResults) => {
    if (err) {
      console.error('Error executing vehicle query:', err);
      res.status(500).send('Server error');
      return;
    }

    if (vehicleResults.length === 0) {
      res.json([]);
      return;
    }

    // Získání šablonových detailů pro každé vozidlo
    const templatePromises = vehicleResults.map(vehicle => {
      return new Promise((resolve, reject) => {
        const templateSql = `
          SELECT vt.templateId, vt.templateName, vt.reserveCount, vt.Type, vt.Active, ad.*
          FROM VehicleTemplates vt
          LEFT JOIN AxleDetails ad ON vt.templateId = ad.templateId
          WHERE vt.templateId = ?
          ORDER BY ad.axlePosition;
        `;
        
        poolC5tpms.query(templateSql, [vehicle.templateId], (templateErr, templateResults) => {
          if (templateErr) {
            return reject(templateErr);
          }
          
          vehicle.templateDetails = templateResults;
          resolve(vehicle);
        });
      });
    });

    // Čekání na dokončení všech šablonových dotazů a odeslání odpovědi
    Promise.all(templatePromises)
      .then(results => res.json(results))
      .catch(err => {
        console.error('Error executing template query:', err);
        res.status(500).send('Server error');
      });
  });
});

  // Získání LocationID, DeviceName na základě deviceID
app.get('/get_location_id', (req, res) => {
  const { deviceID } = req.query;

  if (!deviceID) {
      return res.status(400).json({ error: 'deviceID je povinný parametr' });
  }

  const sql = `
      SELECT
          deviceName,
          CASE
              WHEN identification = 'IMEI' THEN IMEI
              WHEN identification = 'Mac' THEN MacAddress
              ELSE NULL
          END AS locationID
      FROM device_list
      WHERE deviceID = ?
  `;

  poolC5tpms.query(sql, [deviceID], (error, results) => {
      if (error) {
          console.error('Error fetching location ID:', error);
          return res.status(500).json({ error: 'Chyba při získávání locationID.' });
      }

      if (results.length > 0) {
          res.json({
              deviceID,
              locationID: results[0].locationID,
              deviceName: results[0].deviceName || 'N/A'
          });
      } else {
          res.status(404).json({ error: 'Location ID nenalezeno pro daný deviceID.' });
      }
  });
});

// Přidání nového servisního listu
app.post('/add_service_sheet', (req, res) => {
  const { vehicle_registration, service_date, service_time, deviceID, worker_id, notes } = req.body;

  if (!vehicle_registration || !service_date || !service_time || !deviceID || !worker_id) {
      return res.status(400).json({ error: 'Všechna povinná pole musí být vyplněna.' });
  }

  const addServiceSheetSql = `
      INSERT INTO ServiceSheets (vehicle_registration, service_date, service_time, deviceID, worker_id, notes)
      VALUES (?, ?, ?, ?, ?, ?)
  `;

  poolC5tpms.query(addServiceSheetSql, [vehicle_registration, service_date, service_time, deviceID, worker_id, notes], (error, results) => {
      if (error) {
          console.error('Error inserting new service sheet:', error);
          return res.status(500).json({ error: 'Chyba při ukládání nového servisního listu.' });
      }

      res.status(200).json({ message: 'Servisní list byl úspěšně přidán.', serviceSheetId: results.insertId });
  });
});

//přidání řádků servisního listu
app.post('/add_service_tasks', (req, res) => {
  const { serviceSheetId, tasks } = req.body;

  if (!serviceSheetId || !tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'serviceSheetId a tasks jsou povinné parametry.' });
  }

  const addTaskSql = `
      INSERT INTO ServiceSheets_rows (serviceSheetId, taskId, count, note, noteActive, date)
      VALUES ?
  `;

  const taskValues = tasks.map(task => [
      serviceSheetId,
      task.id,
      task.count || 0,
      task.note || null,
      task.noteActive ? 1 : 0,
      new Date()
  ]);

  poolC5tpms.query(addTaskSql, [taskValues], (error, results) => {
      if (error) {
          console.error('Error inserting tasks:', error);
          return res.status(500).json({ error: 'Chyba při ukládání úkolů.' });
      }

      res.status(200).json({ message: 'Úkoly byly úspěšně přidány.' });
  });
});

// vyhledání aktivních vozidel během posledních 10 minut podle ID zařízení
app.get('/active_vehicles', (req, res) => {
  const { deviceID } = req.query;

  if (!deviceID) {
    return res.status(400).json({ error: 'deviceID je povinný parametr' });
  }

  const activeVehiclesSql = `
    SELECT DISTINCT
        td.RZ AS vehicle_registration
    FROM
        parsed_ad_data p1
    JOIN 
        device_list d ON p1.locationId = d.macAddress
    LEFT JOIN 
        tyre_data td ON p1.macAddress = td.macAddress
    WHERE 
        p1.timestamp >= UNIX_TIMESTAMP(NOW() - INTERVAL 1000 MINUTE) * 1000
        AND d.deviceID = ?
        AND td.RZ IS NOT NULL
    ORDER BY 
        td.RZ;
  `;

  poolC5tpms.query(activeVehiclesSql, [deviceID], (error, results) => {
    if (error) {
      console.error('Error executing active vehicles query:', error);
      return res.status(500).json({ error: 'Server error' });
    }

    res.json(results);
  });
});



  // Deaktivace/aktivace šablony
  app.patch('/templates/:templateId/active', (req, res) => {  
    const { templateId } = req.params;
    const { active } = req.body; 

    const sql = `UPDATE VehicleTemplates SET Active = ? WHERE templateId = ?`;
    const params = [active ? 1 : 0, templateId];

    poolC5tpms.query(sql, params, (err, result) => {
      if (err) {
        console.error('Error executing query:', err);
        res.status(500).send('Server error');
        return;
      }
      res.send(`Šablona ${active ? 'aktivována' : 'deaktivována'}`);
    });
  });
// Endpoint pro získání seznamu šablon vozidel
app.get('/search-vehicle-templates', async (req, res) => {
  const { templateName, type, numberOfAxles, active } = req.query;

  let sqlQuery = 'SELECT * FROM VehicleTemplates WHERE 1=1'; // Základní dotaz
  let queryParams = [];

  if (templateName) {
    sqlQuery += ' AND templateName LIKE ?';
    queryParams.push(`%${templateName}%`);
  }

  if (type) {
    sqlQuery += ' AND Type = ?';
    queryParams.push(type);
  }

  if (numberOfAxles) {
    sqlQuery += ' AND numberOfAxles = ?';
    queryParams.push(parseInt(numberOfAxles, 10));
  }

  if (active !== undefined) {
    sqlQuery += ' AND Active = ?';
    queryParams.push(active === 'true' ? 1 : 0);
  }

  try {
    const results = await query(poolC5tpms, sqlQuery, queryParams);
    res.json(results);
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).send('Server error');
  }
});
// enpoint pro získání servisních služeb
app.get('/service_tasks', (req, res) => {
  const sql = 'SELECT * FROM service_tasks';

  poolC5tpms.query(sql, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }
    res.json(results);
  });
});

   //endpoint bez RZ
// Endpoint pro požadavky pouze s templateId
app.get('/templates/:templateId', (req, res) => {
  const { templateId } = req.params;

  // SQL dotaz pro získání detailů šablony a náprav
  const templateSql = `
      SELECT vt.templateId, vt.templateName, vt.reserveCount, vt.Type, vt.Active, ad.*
      FROM VehicleTemplates vt
      LEFT JOIN AxleDetails ad ON vt.templateId = ad.templateId
      WHERE vt.templateId = ?
      ORDER BY ad.axlePosition;
  `;

  poolC5tpms.query(templateSql, [templateId], (templateErr, templateResults) => {
      if (templateErr) {
          console.error('Error executing template query:', templateErr);
          return res.status(500).send('Server error');
      }

      // Protože RZ není definováno, nebudeme získávat data senzorů.
      // Spojení výsledků do jedné odpovědi bez dat senzorů
      const response = {
          templateDetails: templateResults,
          sensorsData: [] // Bez dat senzorů, protože RZ není poskytnuto
      };

      res.json(response);
  });
});

// Endpoint pro načítání GPS dat podle registrační značky (RZ)
app.get('/gps-data-by-rz/:rz', (req, res) => {
  console.log(`Received request for RZ: ${req.params.rz}`);
  const { rz } = req.params;

  const gpsDataByRzSql = `
    SELECT p.device_id, p.timestamp, p.longitude, p.latitude, p.altitude
    FROM parsed_gnss_data p
    JOIN vehicle_data v ON v.deviceId = p.device_id
    WHERE v.RZ = ? AND p.device_id IS NOT NULL
    ORDER BY p.timestamp DESC
    LIMIT 1;
  `;

  poolC5tpms.query(gpsDataByRzSql, [rz], (err, results) => {
    if (err) {
      console.error('Error fetching GPS data by RZ:', err);
      return res.status(500).send('Server error');
    }

    res.json(results);
  });
});

// Endpoint pro načítání GPS dat podle časového intervalu a RZ
app.get('/gps-data-by-timestamp', async (req, res) => {
  const { startTime, endTime, rz } = req.query;

  try {
    const gpsDataByTimestampSql = `
      SELECT p.device_id, p.timestamp, p.longitude, p.latitude, p.delta
      FROM parsed_gnss_data p
      JOIN vehicle_data v ON v.deviceId = p.device_id
      WHERE p.timestamp >= ? AND p.timestamp <= ? AND p.delta >= 0.01 AND v.RZ = ?
      ORDER BY p.timestamp ASC;
    `;

    poolC5tpms.query(gpsDataByTimestampSql, [startTime, endTime, rz], (err, results) => {
      if (err) {
        console.error('Chyba při načítání GPS dat podle timestamp:', err);
        return res.status(500).send('Chyba serveru');
      }

      res.json(results);
    });
  } catch (error) {
    console.error('Chyba při načítání GPS dat podle timestamp:', error);
    res.status(500).send('Chyba serveru');
  }
});

// Endpoint pro odstranění čidla
app.post('/remove-sensor', (req, res) => {
  const { macAddress, position, RZ } = req.body;

  const sql = `
    DELETE FROM tyre_data
    WHERE macAddress = ? AND position = ? AND RZ = ?;
  `;

  poolC5tpms.query(sql, [macAddress, position, RZ], (err, result) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).send('Server error');
      return;
    }
    res.send({ success: true, message: 'Senzor byl úspěšně odstraněn.' });
  });
});

// Endpoint pro získání dat o konkrétním senzoru
app.get('/sensor-data/:macAddress', (req, res) => {
  const { macAddress } = req.params;

  const sensorDataSql = `
      SELECT p1.*, t.position, t.idealPressure, 
             FROM_UNIXTIME(p1.timestamp / 1000, '%Y-%m-%d %H:%i:%s') AS formatted_timestamp,
             p1.pressure AS current_pressure,
             p1.temperature AS current_temperature,
             RIGHT(p1.macAddress, 4) AS short_macAddress
      FROM parsed_ad_data p1
      JOIN (
          SELECT macAddress, MAX(timestamp) as max_timestamp
          FROM parsed_ad_data
          WHERE macAddress = ?
          GROUP BY macAddress
      ) p2 ON p1.macAddress = p2.macAddress AND p1.timestamp = p2.max_timestamp
      JOIN tyre_data t ON p1.macAddress = t.macAddress
      WHERE p1.macAddress = ?
      ORDER BY p1.timestamp DESC
      LIMIT 1;
  `;

  poolC5tpms.query(sensorDataSql, [macAddress, macAddress], (err, results) => {
    if (err) {
      console.error('Error executing sensor data query:', err);
      return res.status(500).send('Server error');
    }

    if (results.length === 0) {
      return res.status(404).send('Sensor data not found');
    }

    const sensorData = results[0];
    const currentPressure = sensorData.current_pressure;
    const currentTemperature = sensorData.current_temperature;
    const adjustedPressure = currentPressure * (293 / (273 + currentTemperature));

    const response = {
      ...sensorData,
      adjusted_pressure_20C: adjustedPressure
    };

    res.json(response);
  });
});

app.get('/templates/:templateId/:RZ', async (req, res) => {
  const { RZ } = req.params;

  const sensorsSql = `
    SELECT p1.*, t.position, 
           FROM_UNIXTIME(p1.timestamp / 1000, '%Y-%m-%d %H:%i:%s') AS formatted_timestamp,
           p1.pressure AS current_pressure,
           p1.temperature AS current_temperature,
           RIGHT(p1.macAddress, 6) AS short_macAddress
    FROM parsed_ad_data p1
    JOIN (
        SELECT macAddress, MAX(timestamp) AS max_timestamp
        FROM parsed_ad_data
        GROUP BY macAddress
    ) p2 ON p1.macAddress = p2.macAddress AND p1.timestamp = p2.max_timestamp
    JOIN tyre_data t ON p1.macAddress = t.macAddress
    WHERE t.RZ = ?
    ORDER BY t.position ASC;
  `;

  try {
    const [sensorsResults] = await poolC5tpms.query(sensorsSql, [RZ]);

    if (!Array.isArray(sensorsResults)) {
      throw new TypeError('Expected sensorsResults to be an array');
    }

    sensorsResults.forEach(sensor => {
      const currentPressure = sensor.current_pressure;
      const currentTemperature = sensor.current_temperature;
      const adjustedPressure = currentPressure * (293 / (273 + currentTemperature));
      sensor.adjusted_pressure_20C = adjustedPressure;
    });

    res.json(sensorsResults);
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).send('Server error');
  }
});


// získání detailních dat o vozidle
app.get('/vehicle-data/:RZ', (req, res) => {
  const { RZ } = req.params;

  const vehicleDataSql = `
      SELECT vd.RZ, vd.templateId, vd.tractor, vd.tachographKm, vd.vehicleType, vd.companyId, vd.deviceId,
             td.position, td.macAddress, td.treadDepth1, td.treadDepth2, td.treadDepth3, td.idealPressure, td.maxDepth, td.actualTemp, td.actualPressure20, td.actualPressure,
             ad.axleId, ad.axleType, ad.driveType, ad.mountType, ad.section, ad.axlePosition, ad.idealPressure_kpa, ad.GAWR
      FROM vehicle_data vd
      LEFT JOIN tyre_data td ON vd.RZ = td.RZ
      LEFT JOIN AxleDetails ad ON vd.templateId = ad.templateId
      WHERE vd.RZ = ?;
  `;

  poolC5tpms.query(vehicleDataSql, [RZ], (err, results) => {
      if (err) {
          console.error('Error executing vehicle data query:', err);
          return res.status(500).send('Server error');
      }

      // Zpracování dat pro zobrazení v požadovaném formátu
      const processedData = results.reduce((acc, row) => {
          if (!acc.RZ) {
              acc.RZ = row.RZ;
              acc.templateId = row.templateId;
              acc.tractor = row.tractor;
              acc.tachographKm = row.tachographKm;
              acc.vehicleType = row.vehicleType;
              acc.companyId = row.companyId;
              acc.deviceId = row.deviceId;
              acc.positions = {};
              acc.axles = {};
          }

          // Přidání pozic
          if (row.position) {
              if (!acc.positions[row.position]) {
                  acc.positions[row.position] = {
                      macAddress: row.macAddress,
                      treadDepth1: row.treadDepth1,
                      treadDepth2: row.treadDepth2,
                      treadDepth3: row.treadDepth3,
                      idealPressure: row.idealPressure,
                      maxDepth: row.maxDepth,
                      actualTemp: row.actualTemp,
                      actualPressure20: row.actualPressure20,
                      actualPressure: row.actualPressure
                  };
              }
          }

          // Přidání náprav
          if (row.axleId) {
              if (!acc.axles[row.axleId]) {
                  acc.axles[row.axleId] = {
                      axleType: row.axleType,
                      driveType: row.driveType,
                      mountType: row.mountType,
                      section: row.section,
                      axlePosition: row.axlePosition,
                      idealPressure_kpa: row.idealPressure_kpa,
                      GAWR: row.GAWR
                  };
              }
          }

          return acc;
      }, {});

      res.json(processedData);
  });
});
// Endpoint pro získání seznamu vozidel podle servisního vozidla
app.get('/search-service-vehicles', (req, res) => {
  const { serviceVehicle } = req.query;

  let sqlQuery = `
    SELECT DISTINCT v.*
    FROM vehicle_data v
    JOIN tyre_data t ON v.RZ = t.RZ
    JOIN parsed_ad_data p ON t.macAddress = p.macAddress
    JOIN device_list d ON p.locationId = d.MacAddress
    WHERE d.servicePoint = 1
    AND p.timestamp > UNIX_TIMESTAMP(NOW() - INTERVAL 15 MINUTE) * 1000
  `;

  // Přidejte podmínku pro konkrétní servisní vozidlo, pokud je zadáno
  if (serviceVehicle) {
    sqlQuery += ` AND d.deviceName = ?`;
  }

  // Logování pro diagnostiku
  console.log('Executing SQL query:', sqlQuery, 'with params:', serviceVehicle ? [serviceVehicle] : []);

  // Provedení dotazu
  poolC5tpms.query(sqlQuery, serviceVehicle ? [serviceVehicle] : [], (error, results) => {
    if (error) {
      console.error('Error executing query:', error);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});    
// Endpoint pro získání seznamu všech vozidel s filtry
app.get('/search-vehicle-from-list', (req, res) => {
  const { RZ, tractor, tachographKm, vehicleType, companyId, onRange } = req.query;

  let sqlQueryBase = `SELECT DISTINCT v.* FROM vehicle_data v`;
  let joins = ``;
  let whereConditions = [];
  let queryParams = [];

  if (onRange === '1') {
    joins += ` JOIN tyre_data t ON v.RZ = t.RZ
               JOIN parsed_ad_data p ON t.macAddress = p.macAddress
               AND p.timestamp > UNIX_TIMESTAMP(NOW() - INTERVAL 10 MINUTE) * 1000`;
  }

  if (RZ) {
    whereConditions.push('v.RZ LIKE ?');
    queryParams.push(`%${RZ}%`);
  }
  if (tractor !== undefined) {
    whereConditions.push('v.tractor = ?');
    queryParams.push(parseInt(tractor));
  }
  if (tachographKm) {
    whereConditions.push('v.tachographKm LIKE ?');
    queryParams.push(`%${tachographKm}%`);
  }
  if (vehicleType) {
    whereConditions.push('v.vehicleType = ?');
    queryParams.push(vehicleType);
  }
  if (companyId) {
    whereConditions.push('v.companyId = ?');
    queryParams.push(companyId);
  }

  let whereClause = whereConditions.length > 0 ? ` WHERE ${whereConditions.join(' AND ')}` : '';
  let sqlQuery = `${sqlQueryBase}${joins}${whereClause}`;

  // Logování pro ověření SQL dotazu
  console.log('Executing SQL query for vehicles:', sqlQuery, 'with params:', queryParams);

  // Provedení dotazu
  poolC5tpms.query(sqlQuery, queryParams, (error, results) => {
    if (error) {
      console.error('Error executing query:', error);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});

 
// Endpoint pro načtení seznamu servisních vozidel
app.get('/service-vehicles', (req, res) => {
  const sqlQuery = `SELECT deviceID, deviceName, MacAddress as locationId FROM device_list WHERE servicePoint = 1`;
  
  poolC5tpms.query(sqlQuery, (error, results) => {
    if (error) {
      console.error('Error executing query:', error);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});


  
// Endpoint pro získání kompletního seznamu vozidel
app.get('/all-vehicles', (req, res) => {
  const sqlQuery = `SELECT * FROM vehicle_data`;

  poolC5tpms.query(sqlQuery, (error, results) => {
    if (error) {
      console.error('Error executing query:', error);
      return res.status(500).send('Server error');
    }
    res.json(results); // Vrací kompletní seznam vozidel
  });
});

// Nový endpoint pro získávání všech vozidel a jejich senzorů
app.get('/vehicles-with-sensors', async (req, res) => {
  try {
    // Načtení všech vozidel
    const vehiclesSql = `SELECT * FROM vehicle_data`;
    const vehiclesResults = await poolC5tpms.query(vehiclesSql);

    // Pro každé vozidlo načteme senzory
    const vehiclesWithSensors = await Promise.all(vehiclesResults.map(async (vehicle) => {
      const sensorsSql = `
        SELECT p1.*, t.position, t.idealPressure, 
               FROM_UNIXTIME(p1.timestamp / 1000, '%Y-%m-%d %H:%i:%s') AS formatted_timestamp,
               p1.pressure AS current_pressure,
               p1.temperature AS current_temperature,
               RIGHT(p1.macAddress, 6) AS short_macAddress
        FROM parsed_ad_data p1
        JOIN (
            SELECT macAddress, MAX(timestamp) AS max_timestamp
            FROM parsed_ad_data
            GROUP BY macAddress
        ) p2 ON p1.macAddress = p2.macAddress AND p1.timestamp = p2.max_timestamp
        JOIN tyre_data t ON p1.macAddress = t.macAddress
        WHERE t.RZ = ?
        AND p1.timestamp > UNIX_TIMESTAMP(NOW() - INTERVAL 10 MINUTE) * 1000
        ORDER BY t.position ASC;
      `;

      const sensorsResults = await poolC5tpms.query(sensorsSql, [vehicle.RZ]);

      // Porovnáme hodnoty tlaku s doporučeným hustěním
      sensorsResults.forEach(sensor => {
        const currentPressure = sensor.current_pressure;
        const currentTemperature = sensor.current_temperature;
        const adjustedPressure = currentPressure * (293 / (273 + currentTemperature));
        sensor.adjusted_pressure_20C = adjustedPressure;

        if (sensor.idealPressure) {
          if (adjustedPressure < sensor.idealPressure * 0.8) {
            sensor.criticalLevel = 'red'; // Kritická hodnota
          } else if (adjustedPressure < sensor.idealPressure * 0.9) {
            sensor.criticalLevel = 'orange'; // Oranžová hodnota
          } else if (adjustedPressure < sensor.idealPressure) {
            sensor.criticalLevel = 'yellow'; // Žlutá hodnota
          } else {
            sensor.criticalLevel = 'green'; // V pořádku
          }
        } else {
          sensor.criticalLevel = 'unknown'; // Neznámá ideální hodnota
        }
      });

      vehicle.sensors = sensorsResults;
      return vehicle;
    }));

    // Generování výsledného seznamu s indikátory
    const results = vehiclesWithSensors.map(vehicle => {
      const criticalLevels = vehicle.sensors.map(sensor => sensor.criticalLevel);
      let indicator = 'green';

      if (criticalLevels.includes('red')) {
        indicator = 'red';
      } else if (criticalLevels.includes('orange')) {
        indicator = 'orange';
      } else if (criticalLevels.includes('yellow')) {
        indicator = 'yellow';
      }

      return {
        ...vehicle,
        indicator,
        sensors: vehicle.sensors,
      };
    });

    res.json(results);
  } catch (error) {
    console.error('Error fetching vehicles with sensors:', error);
    res.status(500).send('Server error');
  }
});

// získání informací o pneumatice
app.get('/getTires', async (req, res) => {
  const { width, profile, diameter, manufacturer, pattern, loadIndex, speedIndex } = req.query;

  if (!width || !profile || !diameter || !manufacturer || !pattern || !loadIndex || !speedIndex) {
    return res.status(400).send('Width, profile, diameter, manufacturer, pattern, loadIndex, and speedIndex are required');
  }

  const formattedDiameter = parseFloat(diameter.replace('R', '')).toFixed(2);

  // Rozdělení loadIndex na LoadIndexFrom a LoadIndexTo
  const [LoadIndexFrom, LoadIndexTo] = loadIndex.includes('/')
    ? loadIndex.split('/').map(index => parseInt(index, 10))
    : [parseInt(loadIndex, 10), parseInt(loadIndex, 10)];

  // Rozdělení speedIndex na SpeedIndex a SpeedIndexTo
  const [SpeedIndex, SpeedIndexTo] = speedIndex.includes('/')
    ? speedIndex.split('/')
    : [speedIndex, speedIndex];

  const query = `
    SELECT PartNo 
    FROM IMPORT_CZS_ProduktyB2B 
    WHERE Width = ? AND Profile = ? AND Diameter = ? AND Manufacturer = ? AND Pattern = ? 
    AND LoadIndexFrom <= ? AND LoadIndexTo >= ? AND SpeedIndex = ?
    LIMIT 1
  `;

  try {
    const results = await new Promise((resolve, reject) => {
      poolC5pneutyres.query(query, [width, profile, formattedDiameter, manufacturer, pattern, LoadIndexFrom, LoadIndexTo, SpeedIndex], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).send('Tire not found');
    }
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).send('Server error');
  }
});



app.get('/getManufacturers', async (req, res) => {
  const { width, profile, diameter } = req.query;

  // Ověření, že všechny hodnoty jsou definované
  if (!width || !profile || !diameter) {
    return res.status(400).send('Width, profile, and diameter are required');
  }

  // Převést tyreRim na formát používaný v databázi (např. R22.5 na 22.50)
  const formattedDiameter = parseFloat(diameter.replace('R', '')).toFixed(2);

  const query = `
    SELECT DISTINCT Manufacturer 
    FROM IMPORT_CZS_ProduktyB2B 
    WHERE Width = ? AND Profile = ? AND Diameter = ?
  `;

  try {
    const results = await new Promise((resolve, reject) => {
      poolC5pneutyres.query(query, [width, profile, formattedDiameter], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    res.json(results);
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).send('Server error');
  }
});


// aktualizace kódu pneumatiky
app.post('/updateTire', async (req, res) => {
  const { tyreLabel, partNo, RZ, tyreNo } = req.body;

  if (!tyreLabel || !partNo || !RZ) {
    return res.status(400).send('Tyre label, part number, and RZ are required');
  }

  // Aktualizovaný dotaz
  const query = `
    UPDATE tyre_data
    SET TyreId = ?, 
        TyreNO = ?,  -- Sériové číslo bude buď zadané, nebo NULL
        Updated = NOW()  -- Uložíme aktuální datum a čas změny
    WHERE position = ? AND RZ = ?
  `;

  try {
    const results = await new Promise((resolve, reject) => {
      poolC5tpms.query(query, [partNo, tyreNo || null, tyreLabel, RZ], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).send('Server error');
  }
});



app.get('/getPatterns', async (req, res) => {
  const { width, profile, diameter, manufacturer } = req.query;

  if (!width || !profile || !diameter || !manufacturer) {
    return res.status(400).send('Width, profile, diameter, and manufacturer are required');
  }

  const formattedDiameter = parseFloat(diameter.replace('R', '')).toFixed(2);

  const query = `
    SELECT DISTINCT Pattern 
    FROM IMPORT_CZS_ProduktyB2B 
    WHERE Width = ? AND Profile = ? AND Diameter = ? AND Manufacturer = ?
  `;

  try {
    const results = await new Promise((resolve, reject) => {
      poolC5pneutyres.query(query, [width, profile, formattedDiameter, manufacturer], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    res.json(results);
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).send('Server error');
  }
});

//Endpoint pro načítání indexů nosnosti
app.get('/getLoadIndexes', async (req, res) => {
  const { width, profile, diameter, manufacturer, pattern } = req.query;

  if (!width || !profile || !diameter || !manufacturer || !pattern) {
    return res.status(400).send('Width, profile, diameter, manufacturer, and pattern are required');
  }

  const formattedDiameter = parseFloat(diameter.replace('R', '')).toFixed(2);

  const query = `
    SELECT DISTINCT LoadIndexFrom, LoadIndexTo 
    FROM IMPORT_CZS_ProduktyB2B 
    WHERE Width = ? AND Profile = ? AND Diameter = ? AND Manufacturer = ? AND Pattern = ?
  `;

  try {
    const results = await new Promise((resolve, reject) => {
      poolC5pneutyres.query(query, [width, profile, formattedDiameter, manufacturer, pattern], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    const loadIndexes = results.map(row => {
      if (row.LoadIndexFrom === row.LoadIndexTo) {
        return row.LoadIndexFrom.toString();
      } else if (!row.LoadIndexTo) {
        return row.LoadIndexFrom.toString();
      } else {
        return `${row.LoadIndexFrom}/${row.LoadIndexTo}`;
      }
    });

    res.json(loadIndexes);
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).send('Server error');
  }
});

// Endpoint pro načítání indexu rychlosti
app.get('/getSpeedIndexes', async (req, res) => {
  const { width, profile, diameter, manufacturer, pattern, loadIndex } = req.query;

  if (!width || !profile || !diameter || !manufacturer || !pattern || !loadIndex) {
    return res.status(400).send('Width, profile, diameter, manufacturer, pattern, and load index are required');
  }

  const formattedDiameter = parseFloat(diameter.replace('R', '')).toFixed(2);

  const query = `
    SELECT DISTINCT SpeedIndex, SpeedIndexTo 
    FROM IMPORT_CZS_ProduktyB2B 
    WHERE Width = ? AND Profile = ? AND Diameter = ? AND Manufacturer = ? AND Pattern = ? AND (LoadIndexFrom = ? OR LoadIndexTo = ?)
  `;

  try {
    const results = await new Promise((resolve, reject) => {
      poolC5pneutyres.query(query, [width, profile, formattedDiameter, manufacturer, pattern, loadIndex, loadIndex], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    const speedIndexes = results.map(row => {
      if (row.SpeedIndex === row.SpeedIndexTo) {
        return row.SpeedIndex;
      } else if (!row.SpeedIndexTo) {
        return row.SpeedIndex;
      } else {
        return `${row.SpeedIndex}/${row.SpeedIndexTo}`;
      }
    });

    res.json(speedIndexes);
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).send('Server error');
  }
});




// Endpoint pro přidání nového vozidla
app.post('/add-vehicle', (req, res) => {
const { RZ, templateId, tractor, tachographKm, vehicleType, companyId, deviceId } = req.body;

const sql = `
  INSERT INTO vehicle_data (RZ, templateId, tractor, tachographKm, vehicleType, companyId, deviceId)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const values = [RZ, templateId, tractor, tachographKm, vehicleType, companyId, deviceId];

poolC5tpms.query(sql, values, (error, results) => {
  if (error) {
    console.error('Error inserting vehicle:', error);
    res.status(500).json({ error: 'Error inserting vehicle' });
  } else {
    res.status(200).json({ message: 'Vehicle added successfully', results });
  }
});
});


// Endpoint pro zjištění existující verze
app.post('/get-existing-versions', (req, res) => {
  const { date, sheetName } = req.body;

  // Odstranění prefixu 'CENIK_' z vzoru verze
  const versionPattern = `${date}_${sheetName}_V%`;

  console.log(`Přijaté data - date: ${date}, sheetName: ${sheetName}`);
  console.log(`Sestavený versionPattern: ${versionPattern}`);

  const sql = 'SELECT filterName FROM Analytic_FilterTemplates WHERE filterName LIKE ?';

  poolC5tpms.query(sql, [versionPattern], (err, results) => {
    if (err) {
      console.error('Chyba při dotazu:', err);
      return res.status(500).json({ message: 'Chyba při dotazu do databáze' });
    }
    console.log(`Nalezené verze: ${JSON.stringify(results)}`);
    res.json({ versions: results });
  });
});


//Endpoint pro vyhledání seznamu verzí
app.get('/search-versions', async (req, res) => {
  const componentType = req.query.componentType;

  if (!componentType) {
    return res.status(400).json({ error: 'componentType query parameter is required' });
  }

  let connection;
  try {
    connection = await new Promise((resolve, reject) => {
      poolC5tpms.getConnection((err, conn) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });

    const rows = await new Promise((resolve, reject) => {
      const query = 'SELECT * FROM Analytic_FilterTemplates WHERE componentType = ?';
      connection.query(query, [componentType], (err, results) => {
        if (err) reject(err);
        else resolve(results);  // Opraveno: Vrací všechny výsledky, ne jen jeden
      });
    });

    res.json(rows); // Vrací všechny šablony v odpovědi jako JSON

  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ error: 'Error fetching versions' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

//Import do tabulky IMP a vytvoření verze
app.post('/saveDataWithFilterToImp', async (req, res) => {
  const { data, filterName, userId, filterValues, filterURL, componentType } = req.body;

  let connection;

  try {
    // Používáme poolC5tpms pro získání připojení
    connection = await new Promise((resolve, reject) => {
      poolC5tpms.getConnection((err, conn) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });

    await connection.beginTransaction();

    // Vložení do tabulky Analytic_FilterTemplates
    const filterResult = await new Promise((resolve, reject) => {
      connection.query(
        'INSERT INTO Analytic_FilterTemplates (userId, componentType, filterName, filterValues, filterURL) VALUES (?, ?, ?, ?, ?)',
        [userId, componentType, filterName, filterValues, filterURL],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    const filterId = filterResult.insertId; // Získání ID nové šablony, které bude použito jako verze

    console.log('filterResult:', filterResult);  // Debug log

    // Příprava dotazu pro INSERT do tabulky IMPORT_CZS_Analytik_IMP
    const insertQuery = `
      INSERT INTO IMPORT_CZS_Analytik_IMP 
        (dodavatel, externi_cislo_polozky, nazev_produktu, prodej_cena, minimalni_prodejni_cena, v_akci_od, 
        v_akci_do, akcni_cena, marketingove_akce, c_polozky, dostupnost_web, dostupnost_b2b, 
        skupina_radkove_slevy, sk_polozek, naklady_cena, prodej_datum_ceny, Verze)
      VALUES ?
    `;

    // Připravení dat pro batch insert
    const preparedData = data.map(item => [
      item.dodavatel, item.externi_cislo_polozky, item.nazev_produktu, item.prodej_cena,
      item.minimalni_prodejni_cena, item.v_akci_od, item.v_akci_do, item.akcni_cena,
      item.marketingove_akce, item.c_polozky, item.dostupnost_web, item.dostupnost_b2b,
      item.skupina_radkove_slevy, item.sk_polozek, item.naklady_cena, item.prodej_datum_ceny, filterId // Používá se filterId jako verze
    ]);

    // Vložení dat do tabulky IMPORT_CZS_Analytik_IMP
    await new Promise((resolve, reject) => {
      connection.query(insertQuery, [preparedData], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // Potvrzení transakce
    await connection.commit();
    res.json({ message: 'Data byla úspěšně uložena.' });
  } catch (error) {
    if (connection) await connection.rollback(); // Vrácení transakce v případě chyby
    console.error('Chyba při ukládání dat:', error);
    res.status(500).json({ error: 'Chyba při ukládání dat.' });
  } finally {
    if (connection) connection.release();
  }
});
// Získání dat z cen B2B
app.get('/get-cenyb2b', (req, res) => {
  const filters = req.query;
  let sql = `
    SELECT * FROM IMPORT_CZS_Ceny_B2B WHERE 1=1
  `;

  const sqlValues = [];

  Object.keys(filters).forEach(filter => {
    sql += ` AND ${filter} LIKE ?`;
    sqlValues.push(`%${filters[filter]}%`);
  });

  poolC5pneutyres.query(sql, sqlValues, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    res.json(results);
  });
});

// Aktualizace dat v cenách B2B
app.put('/update-data-cenyb2b', (req, res) => {
  const newData = req.body;

  // Průběh UPSERT pro každý záznam
  const upsertPromises = newData.map(item => {
    const {
      C_Polozky,
      Nazev = '',
      Nazev2 = '',
      Nazev3 = '',
      Prodej = '',
      EAN = '',
      Sirka = '',
      Rafek = '',
      Profil = '',
      SK_radkove_slevy = '',
      SK_polozek = '',
      Sleva = '',
      C_Ext = '',
      DOT = '',
      Datum_zmeny = '',
      Dostupnost_Web = '',
      Dostupnost_B2B = '',
      AX_B2B = '',
      Zmenil = '',
      Marketingova_akce = '',
      M_akce_od = null,
      M_akce_do = null,
      M_akce_cena = ''
    } = item;

    const sql = `
      INSERT INTO IMPORT_CZS_Ceny_B2B (
        C_Polozky, Nazev, Nazev2, Nazev3, Prodej, EAN, Sirka, Rafek, Profil,
        SK_radkove_slevy, SK_polozek, Sleva, C_Ext, DOT, Datum_zmeny, Dostupnost_Web,
        Dostupnost_B2B, AX_B2B, Zmenil, Marketingova_akce, M_akce_od, M_akce_do, M_akce_cena
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        Nazev = VALUES(Nazev),
        Nazev2 = VALUES(Nazev2),
        Nazev3 = VALUES(Nazev3),
        Prodej = VALUES(Prodej),
        EAN = VALUES(EAN),
        Sirka = VALUES(Sirka),
        Rafek = VALUES(Rafek),
        Profil = VALUES(Profil),
        SK_radkove_slevy = VALUES(SK_radkove_slevy),
        SK_polozek = VALUES(SK_polozek),
        Sleva = VALUES(Sleva),
        C_Ext = VALUES(C_Ext),
        DOT = VALUES(DOT),
        Datum_zmeny = VALUES(Datum_zmeny),
        Dostupnost_Web = VALUES(Dostupnost_Web),
        Dostupnost_B2B = VALUES(Dostupnost_B2B),
        AX_B2B = VALUES(AX_B2B),
        Zmenil = VALUES(Zmenil),
        Marketingova_akce = VALUES(Marketingova_akce),
        M_akce_od = VALUES(M_akce_od),
        M_akce_do = VALUES(M_akce_do),
        M_akce_cena = VALUES(M_akce_cena)
    `;

    const values = [
      C_Polozky, Nazev, Nazev2, Nazev3, Prodej, EAN, Sirka, Rafek, Profil,
      SK_radkove_slevy, SK_polozek, Sleva, C_Ext, DOT, Datum_zmeny, Dostupnost_Web,
      Dostupnost_B2B, AX_B2B, Zmenil, Marketingova_akce, M_akce_od, M_akce_do, M_akce_cena
    ];

    return new Promise((resolve, reject) => {
      poolC5pneutyres.query(sql, values, (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  });

  Promise.all(upsertPromises)
    .then(results => {
      res.sendStatus(200);
    })
    .catch(error => {
      console.error('Failed to upsert data:', error);
      res.status(500).send('Internal server error');
    });
});



// Odebrání položky z cen B2B
app.delete('/delete-data-cenyb2b/:C_Polozky', (req, res) => {
  const C_Polozky = req.params.C_Polozky;

  const sql = `
    DELETE FROM IMPORT_CZS_Ceny_B2B 
    WHERE C_Polozky = ?;
  `;

  poolC5pneutyres.query(sql, [C_Polozky], (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      return res.status(500).send('Server error');
    }
    if (results.affectedRows === 0) {
      return res.status(404).send('Item not found');
    }
    res.sendStatus(200);
  });
});










// Spuštění HTTP serveru
const port = process.env.PORT || 3000;

// ========== GS1 Digital Link for labels (with measured_weight) ==========
app.get('/np/gs1-link', async (req, res) => {
  try {
    const level = String(getParam(req, 'level', 'box') || 'box').toLowerCase(); // 'box' or 'product'
    const item_code = String(getParam(req, 'item_code', '') || '').trim();
    const carton_code = String(getParam(req, 'carton_code', '') || '').trim();

    if (!item_code && !carton_code) {
      return res.status(400).json({ success:false, error:'Missing item_code or carton_code' });
    }

    // np_number from carton_code prefix before first '-'
    let np_number = null;
    const m = carton_code.match(/^([^-\s]+)/);
    if (m) np_number = m[1];

    // header data (heat, mfg) by np_number
    let heat_no = null, mfg = null;
    if (np_number) {
      try {
        const rows = await exec(poolC5sluzbyint,
          "SELECT heat_no, mfg FROM NP_Header WHERE np_number = ? LIMIT 1",
          [np_number]
        );
        if (rows && rows.length) {
          heat_no = rows[0].heat_no ? String(rows[0].heat_no).trim() : null;
          mfg     = rows[0].mfg     ? String(rows[0].mfg).trim()     : null; // may be YYMMDD or MM/YYYY
        }
      } catch(e) { console.warn('[gs1-link] header lookup', e.message); }
    }

    // product GTINs and O-ring by item_code
    let gtin_product = null, gtin_box = null, o_ring = null;
    if (item_code) {
      try {
        const rows = await exec(poolC5sluzbyint,
          "SELECT `Gtin` AS gtin_product, `EAN Krabice` AS gtin_box, `O_ring` AS o_ring FROM `Tavinox_komplet` WHERE `Kod` = ? LIMIT 1",
          [item_code]
        );
        if (rows && rows.length) {
          gtin_product = rows[0].gtin_product ? String(rows[0].gtin_product).trim() : null;
          gtin_box     = rows[0].gtin_box     ? String(rows[0].gtin_box).trim()     : null;
          o_ring       = rows[0].o_ring       ? String(rows[0].o_ring).trim()       : null;
        }
      } catch(e) { console.warn('[gs1-link] Tavinox_komplet lookup', e.message); }
    }

    // choose GTIN
    const chosen_gtin = (level === 'product' ? (gtin_product || gtin_box) : (gtin_box || gtin_product));
    if (!chosen_gtin) {
      return res.status(404).json({ success:false, error:'GTIN not found for item_code' });
    }

    // measured_weight by carton_code (latest)
    let measured_weight = null, measured_at = null;
    try {
      if (carton_code) {
        const r = await exec(poolC5sluzbyint,
          "SELECT measured_weight, measured_at FROM NP_Measurements WHERE carton_code = ? ORDER BY measured_at DESC LIMIT 1",
          [carton_code]
        );
        if (r && r.length) {
          measured_weight = r[0].measured_weight;
          measured_at = r[0].measured_at;
        }
      }
    } catch(e) { console.warn('[gs1-link] measurements lookup', e.message); }

    // build Digital Link
    const base = (process.env.BASE_URL || 'https://id.tavinox.com').replace(/\/+$/, '');
    const qs = new URLSearchParams();
    if (heat_no) qs.set('10', heat_no);      // trimmed so no leading '+' appears
    if (mfg)     qs.set('11', mfg);
    if (o_ring)  qs.set('240', o_ring);

    const url = `${base}/01/${encodeURIComponent(chosen_gtin)}${qs.toString() ? ('?' + qs.toString()) : ''}`;

    return res.json({
      success: true,
      url,
      ai: { '01': chosen_gtin, '10': heat_no, '11': mfg, '240': o_ring },
      level,
      measured_weight,
      measured_at
    });
  } catch (err) {
    console.error('[gs1-link] error:', err);
    return res.status(500).json({ success:false, error: err.message });
  }
});

server.listen(port, () => {
    console.log(`Server běží na portu ${port}`);
   
});
