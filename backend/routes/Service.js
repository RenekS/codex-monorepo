module.exports = function(app, query, poolC5tpms, poolC5pneutyres, poolC5sluzbyint, sql, axios, fs, path, xml2js, ftp, sax, mqtt) {
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
  
  // Endpoint pro načítání GPS dat podle časového intervalu
  app.get('/gps-data-by-timestamp', async (req, res) => {
    const { startTime, endTime } = req.query;
  
    try {
      const gpsDataByTimestampSql = `
        SELECT p.device_id, p.timestamp, p.longitude, p.latitude, p.delta
        FROM parsed_gnss_data p
        JOIN vehicle_data v ON v.deviceId = p.device_id
        WHERE p.timestamp >= ? AND p.timestamp <= ? AND p.delta >= 0.01
        ORDER BY p.timestamp DESC;
      `;
  
      poolC5tpms.query(gpsDataByTimestampSql, [startTime, endTime], (err, results) => {
        if (err) {
          console.error('Error fetching GPS data by timestamp:', err);
          return res.status(500).send('Server error');
        }
  
        res.json(results);
      });
    } catch (error) {
      console.error('Error fetching GPS data by timestamp:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Endpoint pro požadavky s RZ
  app.get('/templates/:templateId/:RZ', (req, res) => {
    const { templateId, RZ } = req.params;
  
    // SQL dotaz pro získání detailů šablony a náprav
    const templateSql = `
        SELECT vt.templateId, vt.templateName, vt.reserveCount, vt.Type, vt.Active, ad.*
        FROM VehicleTemplates vt
        LEFT JOIN AxleDetails ad ON vt.templateId = ad.templateId
        WHERE vt.templateId = ?
        ORDER BY ad.axlePosition;
    `;
  
    // SQL dotaz pro získání nejnovějších dat senzorů napárovaných s RZ a seřazení podle pozice
    const sensorsSql = `
        SELECT p1.*, t.position, 
               FROM_UNIXTIME(p1.timestamp / 1000, '%Y-%m-%d %H:%i:%s') AS formatted_timestamp,
               p1.pressure AS current_pressure,
               p1.temperature AS current_temperature,
               RIGHT(p1.macAddress, 4) AS short_macAddress
        FROM parsed_ad_data p1
        JOIN (
            SELECT macAddress, MAX(timestamp) as max_timestamp,
            locationId
            FROM parsed_ad_data
            GROUP BY macAddress
        ) p2 ON p1.macAddress = p2.macAddress AND p1.timestamp = p2.max_timestamp
        JOIN tyre_data t ON p1.macAddress = t.macAddress
        WHERE t.RZ = ?
        ORDER BY t.position ASC;
    `;
  
    // Nejprve získáme detaily šablony a náprav
    poolC5tpms.query(templateSql, [templateId], (templateErr, templateResults) => {
        if (templateErr) {
            console.error('Error executing template query:', templateErr);
            return res.status(500).send('Server error');
        }
  
        // Poté získáme nejnovější data senzorů
        poolC5tpms.query(sensorsSql, [RZ], (sensorsErr, sensorsResults) => {
            if (sensorsErr) {
                console.error('Error executing sensors query:', sensorsErr);
                return res.status(500).send('Server error');
            }
  
            // Přidání výpočtu "Tlak při 20°C" do výsledků senzorů
            const sensorsDataWithAdjustedPressure = sensorsResults.map(sensor => {
                const currentPressure = sensor.current_pressure;
                const currentTemperature = sensor.current_temperature;
  
                // Výpočet tlaku při 20°C (předpokládá se ideální plyn)
                const adjustedPressure = currentPressure * (293 / (273 + currentTemperature));
  
                return {
                    ...sensor,
                    adjusted_pressure_20C: adjustedPressure
                };
            });
  
            // Spojení výsledků do jedné odpovědi
            const response = {
                templateDetails: templateResults,
                sensorsData: sensorsDataWithAdjustedPressure
            };
  
            res.json(response);
        });
    });
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
    const sqlQuery = `SELECT deviceName FROM device_list WHERE servicePoint = 1`;
    
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



// Zde budou endpointy pro Service
};
  