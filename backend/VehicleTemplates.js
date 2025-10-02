module.exports = function(app, pool) {
  // Načítání všech šablon s detaily náprav
  app.get('/api/templates', (req, res) => {
    const sql = `
      SELECT vt.templateId, vt.templateName, vt.numberOfAxles, vt.Active, ad.*
      FROM VehicleTemplates vt
      LEFT JOIN AxleDetails ad ON vt.templateId = ad.templateId
      ORDER BY vt.templateId, ad.axlePosition;
    `;

    pool.query(sql, (err, results) => {
      if (err) {
        console.error('Error executing query:', err);
        res.status(500).send('Server error');
        return;
      }
      res.json(results);
    });
  });

  // Načítání detailů jednotlivé šablony
  app.get('/api/templates/:templateId', (req, res) => { // Opravena cesta (z '/API/' na '/api/')
    const { templateId } = req.params;
    const sql = `
      SELECT vt.templateId, vt.templateName, vt.numberOfAxles, vt.Active, ad.*
      FROM VehicleTemplates vt
      LEFT JOIN AxleDetails ad ON vt.templateId = ad.templateId
      WHERE vt.templateId = ?
      ORDER BY ad.axlePosition;
    `;

    pool.query(sql, [templateId], (err, results) => {
      if (err) {
        console.error('Error executing query:', err);
        res.status(500).send('Server error');
        return;
      }
      res.json(results);
    });
  });


  // Endpoint pro vyhledávání vozidla a zápis informací
  app.get('/api/search-vehicles', (req, res) => { // Opravena cesta (z '/API/' na '/api/')
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

    pool.query(sql, ['%' + searchTerm + '%'], (err, results) => {
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
  app.post('/api/templates', (req, res) => {
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

    pool.query(sql, params, (err, result) => {
      if (err) {
        console.error('Error executing query:', err);
        res.status(500).send('Server error');
        return;
      }
      res.send('Šablona byla úspěšně aktualizována/vytvořena');
    });
  });

  // Deaktivace/aktivace šablony
  app.patch('/api/templates/:templateId/active', (req, res) => { // Opravena cesta (z '/API/' na '/api/')
    const { templateId } = req.params;
    const { active } = req.body; // Předpokládáme, že 'active' je boolean hodnota

    const sql = `UPDATE VehicleTemplates SET Active = ? WHERE templateId = ?`;
    const params = [active ? 1 : 0, templateId];

    pool.query(sql, params, (err, result) => {
      if (err) {
        console.error('Error executing query:', err);
        res.status(500).send('Server error');
        return;
      }
      res.send(`Šablona ${active ? 'aktivována' : 'deaktivována'}`);
    });
  });

}; // Toto je správné uzavření modulu
