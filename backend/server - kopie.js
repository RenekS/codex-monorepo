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
const mqtt = require('mqtt');
const { format } = require('date-fns');

const app = express();
const server = http.createServer(app);

// Konfigurace připojení k databázím
const poolC5tpms = mysql.createPool({
  connectionLimit: 10,
  host: 'Ww35.virthost.cz',
  user: 'c5tpms',
  password: 'wfxboWREwfxboWRE!C7!C7',
  database: 'c5tpms'
});

const poolC5pneutyres = mysql.createPool({
  connectionLimit: 10,
  host: 'Ww35.virthost.cz',
  user: 'c5pneutyres',
  password: 'tuzckXUMF!4',
  database: 'c5pneutyres'
});

const poolC5sluzbyint = mysql.createPool({
  connectionLimit: 10,
  host: 'pneu-tyres.cz',
  user: 'c5sluzbyint',
  password: '!VN7Ts!VN7TsT4cmGyqT4cmGyq!V',
  database: 'c5sluzbyint'
});

// MSSQL konfigurace připojení
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
    MultipleActiveResultSets: true
  }
};

// Připojení k MSSQL databázi a ověření připojení
async function connectToMSSQL() {
  try {
    await sql.connect(mssqlConfig);
    console.log('Connected to the MSSQL database successfully');

    // Testovací dotaz pro ověření připojení
    const result = await sql.query`SELECT 1 AS test`;
    if (result.recordset[0].test === 1) {
      console.log('MSSQL connection test passed successfully.');
    } else {
      console.error('MSSQL connection test failed.');
    }
  } catch (err) {
    console.error('Failed to connect to the MSSQL database:', err);
  }
}

connectToMSSQL();



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

// Detaily pro připojení k FTP a cestu k souboru
const ftpDetails = {
  host: "ftp.pneub2b.eu",
  user: "PneuB2B.11503",
  password: "pz243ec3",
  remoteFilePath: "./products.xml"
};
const localXMLPath = path.join(__dirname, "temp_products.xml");






// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  credentials: true
}));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// Helper functions
function query(pool, sql, params) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

// Načtení endpoint modulů
const serviceRoutes = require('./routes/Service');
const analysisRoutes = require('./routes/Analysis');
const priceRoutes = require('./routes/Price');
const b2bRoutes = require('./routes/B2B');

// Inicializace endpoint modulů
serviceRoutes(app, query, poolC5tpms, poolC5pneutyres, poolC5sluzbyint, sql, axios, fs, path, xml2js, ftp, sax, mqtt);
analysisRoutes(app, query, poolC5tpms, poolC5pneutyres, poolC5sluzbyint, sql, axios, fs, path, xml2js, ftp, sax, mqtt);
priceRoutes(app, query, poolC5tpms, poolC5pneutyres, poolC5sluzbyint, sql, axios, fs, path, xml2js, ftp, sax, mqtt);
b2bRoutes(app, query, poolC5tpms, poolC5pneutyres, poolC5sluzbyint, sql, axios, fs, path, xml2js, ftp, sax, mqtt);



function queryC5sluzbyint(sql, params) {
  return new Promise((resolve, reject) => {
    poolC5sluzbyint.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}


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
        console.log(`Přihlášen k odběru na téma: ${topic}`);
      }
    });
  });
});

mqttClient.on('message', async function (topic, message) {
  console.log(`Zpráva přijata na téma ${topic}:`, message.toString());

  try {
    var hexData = message.toString('hex');
    if (!hexData) {
      console.log('Přijata prázdná zpráva, ignorováno.');
      return;
    }
    console.log('Hexadecimální data:', hexData);

    const deviceId = topic.split('/')[2];
    const timestamp = Date.now(); // Získání timestampu v milisekundách

    const sensorData = parseMQTTData(hexData);
    console.log('Parsovaná data:', sensorData);

    if (sensorData.length > 0) {
      const sqlQueries = await createSQLQueries(deviceId, sensorData);
      console.log('SQL dotazy:', sqlQueries);

      for (const sql of sqlQueries) {
        await new Promise((resolve, reject) => {
          poolC5tpms.query(sql, (err, results) => {
            if (err) return reject(err);
            resolve(results);
          });
        });
      }
      console.log('Data úspěšně vložena do databáze.');
    } else {
      console.log('Nebyla přijata žádná data k vložení do databáze.');
    }
  } catch (error) {
    console.error('Chyba při zpracování přijaté zprávy:', error);
  }
});

mqttClient.on('error', function (err) {
  console.error('Chyba MQTT klienta:', err);
});

mqttClient.on('close', function () {
  console.log('Spojení s MQTT brokerem bylo uzavřeno.');
});

mqttClient.on('reconnect', function () {
  console.log('Znovupřipojení k MQTT brokeru...');
});

mqttClient.on('offline', function () {
  console.log('MQTT klient je offline.');
});

mqttClient.on('end', function () {
  console.log('MQTT klient ukončil spojení.');
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

      console.log(`RSSI Hex: ${rssiHex}, RSSI Unsigned: ${rssiUnsigned}, RSSI Signed: ${rssiSigned}`);

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
  console.log('Originální hexadecimální data:', hexStr); // Zobraz originální data
  console.log('Swapped endian data:', swappedHex); // Zobraz data po přehození bytů

  const buffer = Buffer.from(swappedHex, 'hex');
  const floatValue = buffer.readFloatBE(0);
  console.log('Floating point hodnota:', floatValue); // Zobraz převedenou hodnotu

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

  console.log(`Previous record for deviceId ${deviceId}:`, lastRecord);

  let delta = null;
  if (lastRecord) {
    delta = lastRecord.distance;
    console.log(`Calculated delta: ${delta} meters`);
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

// E N D P O I N T Y

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
    host: "ftp.pneub2b.eu",
    user: "PneuB2B.11503",
    password: "pz243ec3",
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


//nahrát data z XML B2B


app.get('/upload-tyres', async (req, res) => {
  try {
    const shouldTruncate = req.query.truncate === 'true';

    // Pokud byl parametr truncate nastaven na true, smažte data
    if (shouldTruncate) {
      await truncateTable(); // První smažeme data
    }
    const xmlFilePath = path.join(__dirname, 'B2B_stock_products_list_tyres.xml');
    const stream = fs.createReadStream(xmlFilePath);
    const saxStream = sax.createStream(true);

    let currentTyre = {};
    let currentTagName = null;
    let tyres = [];
    let batchSize = 100;

    saxStream.on("opentag", node => {
      if (node.name === "Tyre") {
        currentTyre = {};
      } else {
        currentTagName = node.name; // Uložení názvu tagu pro použití v textové události
      }
    });

    saxStream.on("closetag", name => {
      if (name === "Tyre") {
        tyres.push(currentTyre);
        currentTyre = {};
        // Zpracování dávky, pokud dosáhneme požadované velikosti
        if (tyres.length >= batchSize) {
          processBatch(tyres.splice(0, batchSize)); // Zpracuje a vymaže zpracované pneumatiky
        }
      }
      currentTagName = null; // Reset názvu tagu po uzavření
    });

    saxStream.on("text", text => {
      if (currentTagName && currentTagName !== "Tyres") { // Ignorujeme název tabulky/nadřazený element
        currentTyre[currentTagName] = text; // Přiřazení textu k aktuálnímu tagu v objektu currentTyre
      }
    });

    saxStream.on("end", async () => {
      // Zpracování zbývajících pneumatik
      if (tyres.length > 0) {
        await processBatch(tyres);
      }
      // Po dokončení všech dávkových vložení aktualizujeme data
      await updateData();
      res.send('Successfully uploaded tyres data to database');
    });

    saxStream.on("error", error => {
      console.error('Failed to process XML file:', error);
      res.status(500).send('Failed to upload tyres data');
    });

    stream.pipe(saxStream); // Zde se stream napojí na saxStream
  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).send('An error occurred during the process');
  }
});

const truncateTable = async () => {
  const truncateTableSql = `TRUNCATE TABLE IMPORT_CZS_ProduktyB2B`;
  return new Promise((resolve, reject) => {
    poolC5pneutyres.query(truncateTableSql, (error) => {
      if (error) {
        console.error('Error truncating table:', error);
        reject(error);
      } else {
        console.log('Table truncated successfully');
        resolve();
      }
    });
  });
};

async function processBatch(batch) {
  const columnsToInclude = Object.keys(batch[0]).filter(column => column !== 'Tyres');
  const placeholders = batch.map(() => '(' + columnsToInclude.map(() => '?').join(', ') + ')').join(', ');
  const flatValues = batch.flatMap(tyre => columnsToInclude.map(key => tyre[key] !== undefined ? tyre[key] : null));
  const columns = columnsToInclude.map(column => `\`${column}\``).join(', ');
  const updateClause = columnsToInclude
      .filter(column => column !== 'ID') // Předpokládám, že ID je sloupec, který se má vyloučit z aktualizace
      .map(column => `\`${column}\` = VALUES(\`${column}\`)`).join(', ');

  const insertSql = `INSERT INTO IMPORT_CZS_ProduktyB2B (${columns}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE ${updateClause}`;

  return new Promise((resolve, reject) => {
    poolC5pneutyres.query(insertSql, flatValues, (error, results) => {
      if (error) {
        console.error('Error inserting batch:', error);
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

async function updateData() {
  const updateSql = `
    UPDATE IMPORT_CZS_ProduktyB2B
    SET SPILowestPrice = CASE
        WHEN SPITotalPriceCZK IS NOT NULL AND (SPI24TotalPriceCZK IS NULL OR SPITotalPriceCZK <= SPI24TotalPriceCZK) AND (SPI48TotalPriceCZK IS NULL OR SPITotalPriceCZK <= SPI48TotalPriceCZK) THEN SPITotalPriceCZK
        WHEN SPI24TotalPriceCZK IS NOT NULL AND (SPITotalPriceCZK IS NULL OR SPI24TotalPriceCZK < SPITotalPriceCZK) AND (SPI48TotalPriceCZK IS NULL OR SPI24TotalPriceCZK <= SPI48TotalPriceCZK) THEN SPI24TotalPriceCZK
        WHEN SPI48TotalPriceCZK IS NOT NULL AND (SPITotalPriceCZK IS NULL OR SPI48TotalPriceCZK < SPITotalPriceCZK) AND (SPI24TotalPriceCZK IS NULL OR SPI48TotalPriceCZK < SPI24TotalPriceCZK) THEN SPI48TotalPriceCZK
        ELSE NULL
    END,
    SPILowestPriceAmount = CASE
        WHEN SPILowestPrice = SPITotalPriceCZK THEN SPIStockAmount
        WHEN SPILowestPrice = SPI24TotalPriceCZK THEN SPI24StockAmount
        WHEN SPILowestPrice = SPI48TotalPriceCZK THEN SPI48StockAmount
        ELSE NULL
    END;
  `;

  return new Promise((resolve, reject) => {
    poolC5pneutyres.query(updateSql, (error) => {
      if (error) {
        console.error('Error updating data:', error);
        reject(error);
      } else {
        console.log('Data updated successfully');
        resolve();
      }
    });
  });
};



//získání dat z tabulky B2B
app.post('/getTyreData', async (req, res) => {
  console.log('Received request for /getTyreData with params:', req.body);
  const items = req.body.items;
  const placeholders = items.map(() => '?').join(',');

  try {
    // Načtení a zpracování XML souboru z FTP
    console.log("Načítání XML z FTP...");
    await fetchXMLFromFTP(ftpDetails, localXMLPath);
    console.log("XML načteno.");
    const xmlData = await parseXML(localXMLPath);
    console.log("XML zpracováno.");
       // Zpracování XML dat
       const xmlItemsData = xmlData.Request.Items.Item.reduce((acc, item) => {
        const partNo = item.$.PartNo; 
        const stockAmount = item.$.StockAmount;
        if (partNo && stockAmount !== undefined) {
          acc[partNo] = { StockAmount: stockAmount };
        }
        return acc;
      }, {});
    console.log("Zpracovaná data z FTP:", xmlItemsData); //
   
    // Aktualizace databáze podle získaných dat z XML
    console.log("Aktualizace B2B_AvailableAmount v databázi...");
    for (const [partNo, data] of Object.entries(xmlItemsData)) {
      console.log(`Aktualizace PartNo ${partNo} s StockAmount ${data.StockAmount}`);
      const updateQuery = `UPDATE IMPORT_CZS_ProduktyB2B SET B2B_AvailableAmount = ? WHERE PartNo = ?`;
      await new Promise((resolve, reject) => {
        poolC5pneutyres.query(updateQuery, [data.StockAmount, partNo], (err, result) => {
          if (err) {
            console.error("Error executing update query for PartNo:", partNo, err);
            reject(err);
            return;
          }
          console.log(`PartNo ${partNo} aktualizováno, počet změněných řádků: ${result.affectedRows}`);
          resolve(result);
        });
      });
    }
    console.log("Všechny položky byly aktualizovány.");

    // SQL dotaz pro získání aktualizovaných dat
    const sqlQuery = `SELECT
      b.ID,
      b.PartNo,
      b.SPILowestPrice,
      b.SPILowestPriceAmount,
      b.B2B_AvailableAmount,  
      s.Celkem
      FROM IMPORT_CZS_ProduktyB2B b
      LEFT JOIN IMPORT_PNEU_SKLAD s ON b.PartNo = s.Produkt
      WHERE b.PartNo IN (${placeholders});`;

    poolC5pneutyres.query(sqlQuery, items, (err, result) => {
      if (err) {
        console.error("Error executing SQL query:", err);
        res.status(500).send('Error processing your request');
        return;
      }
      // Zde již data z XML nejsou přidávána, protože byla aktualizována přímo v databázi
      res.json(result);
    });
  } catch (error) {
    console.error("Error processing the request:", error);
    res.status(500).send('Error processing your request');
  } finally {
    // Odstranění dočasného souboru
    console.log("Odstraňování dočasného souboru...");
    fs.unlinkSync(localXMLPath);
    console.log("Dočasný soubor odstraněn.");
  }
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
  const { id, username, password } = req.body;

  // Ověření uživatelského jména a hesla...
  // Předpokládejme, že máte tabulku users s uživatelskými jmény a hashovanými hesly
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

    // Vytvoření JWT
    const token = jwt.sign({ username: user.username, userID: user.id }, JWT_SECRET, { expiresIn: '24h' });

    // Odeslání JWT klientovi
    res.json({ token });
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
app.post('/import-xlsx-an-PLOR', upload.single('file'), async (req, res) => {
  const userId = req.body.userID;
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const versionName = req.body.versionName;
  const componentType = 'PLOR';
  // Deserializace selectedSheets z JSON
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

    // Vytvoření nového záznamu v Analytic_FilterTemplates a získání filterId
    const filterId = await new Promise((resolve, reject) => {
      const filterData = [userId, componentType, versionName, '', ''];
      connection.query('INSERT INTO Analytic_FilterTemplates (userId, componentType, filterName, filterValues, filterURL) VALUES (?, ?, ?, ?, ?)', filterData, (err, result) => {
        if (err) reject(err);
        else resolve(result.insertId);
      });
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
        const insertData = [
          filterId, // Použití filterId z nového záznamu
          row['Č. položky'] || null,
          row['Č. položky 2'] || null,
          row['Č. položky 3'] || null,
          row['Č. položky 4'] || null,
          row['EAN'] || null,
          row['EAN2'] || null,
          row['EAN3'] || null,
          row['EAN4'] || null,
          row['Název Produktu'] || null,
          row['Cena'] || null,
          row['Prodej - cena'] || null,
          // Doplnění dalších sloupců dle potřeby
        ];

        await new Promise((resolve, reject) => {
          connection.query('INSERT INTO IMPORT_CZS_Analytic_PLOR (Verze, C_Polozky, C_Polozky2, C_Polozky3, C_Polozky4, EAN, EAN2, EAN3, EAN4, Nazev, Cena, Prodej_cena) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', insertData, (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });
      }
    }

    await connection.commit();
    res.send('Data byla úspěšně importována.');
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
        [SalesPrice]
      FROM [AxProdCS].[dbo].[ItsIFInventTable]
    `;

    let whereClauses = [];
    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'activeRuleFilter') continue; // Při tvorbě MSSQL dotazu vynechejte 'activeRuleFilter'
      if (value === '""') {
        whereClauses.push(`([${key}] IS NULL OR [${key}] = '')`);
      } else if (value.includes('|')) {
        const patterns = value.split('|').map(v => v.replace(/\*/g, '%'));
        const orClauses = patterns.map((pattern, index) => {
          const paramName = `${key}_${index}`;
          request.input(paramName, sql.VarChar, pattern);
          return `[${key}] LIKE @${paramName}`;
        }).join(' OR ');
        whereClauses.push(`(${orClauses})`);
      } else {
        const paramName = key;
        const pattern = value.replace(/\*/g, '%');
        request.input(paramName, sql.VarChar, pattern);
        whereClauses.push(`[${key}] LIKE @${paramName}`);
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

// Získání dat z kalkulace-netto
app.get('/get-kalkulace-cen-netto', (req, res) => {
  const filters = req.query;
  let sql = `
  SELECT A.*, C.Name
  FROM IMPORT_CZS_Kalkulace_cen_netto A
  LEFT JOIN ps_product B ON A.polozka = B.reference
  LEFT JOIN ps_product_lang C ON C.id_product = B.id_product
  WHERE 1=1
  `;

  const sqlValues = [];

  Object.keys(filters).forEach(filter => {
    sql += ` AND A.${filter} LIKE ?`;
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




// aktualizace dat v kalkulace netto
app.put('/update-data-netto', (req, res) => {
  const newData = req.body;

  console.log('Received data:', JSON.stringify(newData, null, 2)); // Logování příchozích dat pro debugování

  const updatePromises = newData.map(item => {
    if (!item) {
      console.error('Received null or undefined item');
      return Promise.reject(new Error('Received null or undefined item'));
    }

    const {
      polozka,
      '1_eshop': eshop = '',
      '2_pult': pult = '',
      '3_servis': servis = '',
      '4_vo': vo = '',
      '5_vip': vip = '',
      '6_indiv': indiv = '',
      '7_dopravci': dopravci = '',
      platnost_od = null,
      platnost_do = null,
      popis_pneu_tyres = '',
      popis_heureka = '',
      isNew = false // Nastavení výchozí hodnoty pro isNew
    } = item;

    console.log('Processing item:', {
      polozka,
      eshop,
      pult,
      servis,
      vo,
      vip,
      indiv,
      dopravci,
      platnost_od,
      platnost_do,
      popis_pneu_tyres,
      popis_heureka,
      isNew
    });

    let sql;
    let values;

    if (isNew) {
      sql = `
        INSERT INTO IMPORT_CZS_Kalkulace_cen_netto 
        (polozka, 1_eshop, 2_pult, 3_servis, 4_vo, 5_vip, 6_indiv, 7_dopravci, platnost_od, platnost_do, popis_pneu_tyres, popis_heureka, datum_zapsani)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
        1_eshop = VALUES(1_eshop),
        2_pult = VALUES(2_pult),
        3_servis = VALUES(3_servis),
        4_vo = VALUES(4_vo),
        5_vip = VALUES(5_vip),
        6_indiv = VALUES(6_indiv),
        7_dopravci = VALUES(7_dopravci),
        platnost_od = VALUES(platnost_od),
        platnost_do = VALUES(platnost_do),
        popis_pneu_tyres = VALUES(popis_pneu_tyres),
        popis_heureka = VALUES(popis_heureka),
        datum_zapsani = NOW();
      `;
      values = [polozka, eshop, pult, servis, vo, vip, indiv, dopravci, platnost_od, platnost_do, popis_pneu_tyres, popis_heureka];
    } else {
      sql = `
        UPDATE IMPORT_CZS_Kalkulace_cen_netto 
        SET 
          1_eshop = ?,
          2_pult = ?,
          3_servis = ?,
          4_vo = ?,
          5_vip = ?,
          6_indiv = ?,
          7_dopravci = ?,
          platnost_od = ?,
          platnost_do = ?,
          popis_pneu_tyres = ?,
          popis_heureka = ?,
          datum_zapsani = NOW()
        WHERE polozka = ?;
      `;
      values = [eshop, pult, servis, vo, vip, indiv, dopravci, platnost_od, platnost_do, popis_pneu_tyres, popis_heureka, polozka];
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

// Získání dat z kalkulace-akce-polozka
app.get('/get-kalkulace-cen-akcepolozka', (req, res) => {
  const filters = req.query;
  let sql = `
  SELECT A.*, C.Name
  FROM IMPORT_CZS_Kalkulace_cen_akce_polozka A
  LEFT JOIN ps_product B ON A.polozka = B.reference
  LEFT JOIN ps_product_lang C ON C.id_product = B.id_product
  WHERE 1=1
  `;

  const sqlValues = [];

  Object.keys(filters).forEach(filter => {
    sql += ` AND A.${filter} LIKE ?`;
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




// aktualizace dat v kalkulace-akce-polozka
app.put('/update-data-akcepolozka', (req, res) => {
  const newData = req.body;

  console.log('Received data:', JSON.stringify(newData, null, 2)); // Logování příchozích dat pro debugování

  const updatePromises = newData.map(item => {
    if (!item) {
      console.error('Received null or undefined item');
      return Promise.reject(new Error('Received null or undefined item'));
    }

    const {
      polozka,
      '1_eshop': eshop = '',
      '2_pult': pult = '',
      '3_servis': servis = '',
      '4_vo': vo = '',
      '5_vip': vip = '',
      '6_indiv': indiv = '',
      '7_dopravci': dopravci = '',
      platnost_od = null,
      platnost_do = null,
      popis_pneu_tyres = '',
      popis_heureka = '',
      isNew = false // Nastavení výchozí hodnoty pro isNew
    } = item;

    console.log('Processing item:', {
      polozka,
      eshop,
      pult,
      servis,
      vo,
      vip,
      indiv,
      dopravci,
      platnost_od,
      platnost_do,
      popis_pneu_tyres,
      popis_heureka,
      isNew
    });

    let sql;
    let values;

    if (isNew) {
      sql = `
        INSERT INTO IMPORT_CZS_Kalkulace_cen_akce_polozka 
        (polozka, 1_eshop, 2_pult, 3_servis, 4_vo, 5_vip, 6_indiv, 7_dopravci, platnost_od, platnost_do, popis_pneu_tyres, popis_heureka, datum_zapsani)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
        1_eshop = VALUES(1_eshop),
        2_pult = VALUES(2_pult),
        3_servis = VALUES(3_servis),
        4_vo = VALUES(4_vo),
        5_vip = VALUES(5_vip),
        6_indiv = VALUES(6_indiv),
        7_dopravci = VALUES(7_dopravci),
        platnost_od = VALUES(platnost_od),
        platnost_do = VALUES(platnost_do),
        popis_pneu_tyres = VALUES(popis_pneu_tyres),
        popis_heureka = VALUES(popis_heureka),
        datum_zapsani = NOW();
      `;
      values = [polozka, eshop, pult, servis, vo, vip, indiv, dopravci, platnost_od, platnost_do, popis_pneu_tyres, popis_heureka];
    } else {
      sql = `
        UPDATE IMPORT_CZS_Kalkulace_cen_akce_polozka 
        SET 
          1_eshop = ?,
          2_pult = ?,
          3_servis = ?,
          4_vo = ?,
          5_vip = ?,
          6_indiv = ?,
          7_dopravci = ?,
          platnost_od = ?,
          platnost_do = ?,
          popis_pneu_tyres = ?,
          popis_heureka = ?,
          datum_zapsani = NOW()
        WHERE polozka = ?;
      `;
      values = [eshop, pult, servis, vo, vip, indiv, dopravci, platnost_od, platnost_do, popis_pneu_tyres, popis_heureka, polozka];
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


//odebrání položky z kalkulace-vyprodej
app.delete('/delete-data-vyprodej/:polozka', (req, res) => {
  const polozka = req.params.polozka;

  const sql = `
    DELETE FROM IMPORT_CZS_Kalkulace_cen_vyprodej 
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

//získání data z kalkulace-vyprodej
app.get('/get-kalkulace-cen-vyprodej', (req, res) => {
  const filters = req.query;
  let sql = `
  SELECT A.*, C.Name
  FROM IMPORT_CZS_Kalkulace_cen_vyprodej A
  LEFT JOIN ps_product B ON A.polozka = B.reference
  LEFT JOIN ps_product_lang C ON C.id_product = B.id_product
  WHERE 1=1
  `;

  const sqlValues = [];

  Object.keys(filters).forEach(filter => {
    sql += ` AND A.${filter} LIKE ?`;
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

//akktualizace dat v kalkulace-vyprodej
app.put('/update-data-vyprodej', (req, res) => {
  const newData = req.body;

  console.log('Received data:', JSON.stringify(newData, null, 2)); // Logování příchozích dat pro debugování

  const updatePromises = newData.map(item => {
    if (!item) {
      console.error('Received null or undefined item');
      return Promise.reject(new Error('Received null or undefined item'));
    }

    const {
      polozka,
      '1_eshop': eshop = '',
      '2_pult': pult = '',
      '3_servis': servis = '',
      '4_vo': vo = '',
      '5_vip': vip = '',
      '6_indiv': indiv = '',
      '7_dopravci': dopravci = '',
      platnost_od = null,
      platnost_do = null,
      popis_pneu_tyres = '',
      datum_zapsani = '',
      marze = '',
      zapsal = '',
      B2B = '',
      EXT_eshop = '',
      isNew = false // Nastavení výchozí hodnoty pro isNew
    } = item;

    console.log('Processing item:', {
      polozka,
      eshop,
      pult,
      servis,
      vo,
      vip,
      indiv,
      dopravci,
      platnost_od,
      platnost_do,
      popis_pneu_tyres,
      datum_zapsani,
      marze,
      zapsal,
      B2B,
      EXT_eshop,
      isNew
    });

    let sql;
    let values;

    if (isNew) {
      sql = `
        INSERT INTO IMPORT_CZS_Kalkulace_cen_vyprodej 
        (polozka, 1_eshop, 2_pult, 3_servis, 4_vo, 5_vip, 6_indiv, 7_dopravci, platnost_od, platnost_do, popis_pneu_tyres, datum_zapsani, marze, zapsal, B2B, EXT_eshop)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        1_eshop = VALUES(1_eshop),
        2_pult = VALUES(2_pult),
        3_servis = VALUES(3_servis),
        4_vo = VALUES(4_vo),
        5_vip = VALUES(5_vip),
        6_indiv = VALUES(6_indiv),
        7_dopravci = VALUES(7_dopravci),
        platnost_od = VALUES(platnost_od),
        platnost_do = VALUES(platnost_do),
        popis_pneu_tyres = VALUES(popis_pneu_tyres),
        datum_zapsani = VALUES(datum_zapsani),
        marze = VALUES(marze),
        zapsal = VALUES(zapsal),
        B2B = VALUES(B2B),
        EXT_eshop = VALUES(EXT_eshop);
      `;
      values = [polozka, eshop, pult, servis, vo, vip, indiv, dopravci, platnost_od, platnost_do, popis_pneu_tyres, datum_zapsani, marze, zapsal, B2B, EXT_eshop];
    } else {
      sql = `
        UPDATE IMPORT_CZS_Kalkulace_cen_vyprodej 
        SET 
          1_eshop = ?,
          2_pult = ?,
          3_servis = ?,
          4_vo = ?,
          5_vip = ?,
          6_indiv = ?,
          7_dopravci = ?,
          platnost_od = ?,
          platnost_do = ?,
          popis_pneu_tyres = ?,
          datum_zapsani = ?,
          marze = ?,
          zapsal = ?,
          B2B = ?,
          EXT_eshop = ?
        WHERE polozka = ?;
      `;
      values = [eshop, pult, servis, vo, vip, indiv, dopravci, platnost_od, platnost_do, popis_pneu_tyres, datum_zapsani, marze, zapsal, B2B, EXT_eshop, polozka];
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
        INSERT INTO IMPORT_CZS_Kalkulace_cen_zakladni_slevy 
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


// Získání dat z kalkulace-cen-vyprodej
app.get('/get-kalkulace-cen-vyprodej', (req, res) => {
  const sql = `
    SELECT *
    FROM IMPORT_CZS_Kalkulace_cen_vyprodej;
  `;

  poolC5pneutyres.query(sql, (err, results) => {
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
            WHEN PLOR.Prodej_cena = IMP.prodej_cena THEN 'Prodej shodný'
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
      IMP.naklady_cena AS Cena,
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


// Endpoint pro aktualizaci informací o pneumatice
app.post('/update-tyre-data', (req, res) => {
  const { position, macAddress, RZ } = req.body;

  // Krok 1: Aktualizace původního vozidla (odstranění čipu)
  const removeOldChip = `
  UPDATE tyre_data
  SET macAddress = NULL, actualTemp = NULL, actualPressure20 = NULL, actualPressure = NULL
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
      macAddress = VALUES(macAddress), actualTemp = VALUES(actualTemp), actualPressure20 = VALUES(actualPressure20), actualPressure = VALUES(actualPressure);
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
    const sql = `
      SELECT 
        vehicle_data.RZ,
        COALESCE(vehicle_data.tachographKm, 'Není k dispozici') AS tachographKm,
        vehicle_data.vehicleType,
        company_data.companyName,
        GROUP_CONCAT(
          CONCAT_WS('|', tyre_data.position, tyre_data.actualPressure, tyre_data.actualPressure20, tyre_data.actualTemp)
          ORDER BY tyre_data.position
        ) AS tyreSensors
      FROM vehicle_data
      LEFT JOIN company_data ON vehicle_data.companyId = company_data.companyId
      LEFT JOIN tyre_data ON vehicle_data.RZ = tyre_data.RZ
      WHERE vehicle_data.RZ LIKE ?
      GROUP BY vehicle_data.RZ`;

    poolC5tpms.query(sql, ['%' + searchTerm + '%'], (err, results) => {
      if (err) {
        console.error('Error executing query:', err);
        res.status(500).send('Server error');
        return;
      }
      console.log('Search results:', results);
      res.json(results);
    });
  });

  // Aktualizace nebo vytvoření šablony
  app.post('/templates', (req, res) => {
    const { templateId, templateName, numberOfAxles, active } = req.body;
    let sql, params;

    if (templateId) {
      // Aktualizace existující šablony
      sql = `UPDATE VehicleTemplates SET templateName = ?, numberOfAxles = ?, Active = ? WHERE templateId = ?`;
      params = [templateName, numberOfAxles, active, templateId];
    } else {
      // Vytvoření nové šablony
      sql = `INSERT INTO VehicleTemplates (templateName, numberOfAxles, Active) VALUES (?, ?, ?)`;
      params = [templateName, numberOfAxles, active];
    }

    poolC5tpms.query(sql, params, (err, result) => {
      if (err) {
        console.error('Error executing query:', err);
        res.status(500).send('Server error');
        return;
      }
      res.send('Šablona byla úspěšně aktualizována/vytvořena');
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

// Spuštění HTTP serveru a Node-RED
const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server běží na portu ${port}`);
   
});