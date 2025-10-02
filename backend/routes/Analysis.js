module.exports = function(app, query, poolC5tpms, poolC5pneutyres, poolC5sluzbyint, sql, axios, fs, path, xml2js, ftp, sax, mqtt) {
    
    
//E N D P O I N T AX VYHLEDÁVÁNÍ 
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
  
  
  
   // Endpoint pro synchronizaci dat v tabulce B2B
   app.get('/sync-data-b2b', async (req, res) => {
    try {
      console.log('Začíná synchronizace dat B2B');
  
      const itemsUrl = `http://localhost:3000/items?ItsWebAvailableB2B=Ano`;
      const discountsUrl = `http://localhost:3000/get-kalkulace-slevy-B2B`;
  
      console.log('Provádění požadavků na API...');
      const [itemsResponse, discountsResponse] = await Promise.all([
        axios.get(itemsUrl),
        axios.get(discountsUrl)
      ]);
      console.log('Data z API úspěšně načtena');
  
      const itemsData = itemsResponse.data;
      const discountData = discountsResponse.data;
      console.log(`Načteno ${itemsData.length} položek a ${discountData.length} slev`);
  
      const updatePromises = itemsData.map(item => {
        const matchingDiscount = discountData.find(d => d.C_Polozky === item.ItemId);
  
        // Původní příkaz pro vkládání nebo aktualizaci
        let query = `
          INSERT INTO c5pneutyres.IMPORT_CZS_Ceny_B2B
          (C_Polozky, Nazev, Nazev2, Nazev3, Prodej, EAN, Sirka, Profil, Rafek, SK_radkove_slevy, SK_polozek, Sleva, C_Ext, DOT, Datum_zmeny, Dostupnost_Web, Dostupnost_B2B, AX_B2B, Zmenil, Marketingova_akce, M_akce_Od, M_akce_Do, M_akce_cena)
          VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          Dostupnost_B2B = VALUES(Dostupnost_B2B);
        `;
  
        const values = [
          item.ItemId, item.ItemName, item.ItsItemName2, item.ItsItemName3, item.SalesPrice, item.ItsItemEAN,
          item.ItsTyreSectionWidth, item.ItsTyreAspectRatio, item.ItsTyreRIMDiameter, item.PurchLineDisc,
          item.ItemGroupId, matchingDiscount ? matchingDiscount.Sleva : null, item.ExternalItemId, null, // DOT hodnota nebyla specifikována
          item.ItsWebAvailable, item.ItsWebAvailableB2B, null, null, item.ItsMarketingActionId, item.ItsActionDateFrom, item.ItsActionDateTo, item.ItsActionPrice
        ];
  
        // Nový příkaz pro aktualizaci podle podmínek akce
        const updateSalePriceQuery = `
          UPDATE c5pneutyres.IMPORT_CZS_Ceny_B2B
          SET Prodej = IF(CURRENT_DATE() >= M_akce_Od AND CURRENT_DATE() <= M_akce_Do, M_akce_cena, Prodej), 
              Sleva = IF(CURRENT_DATE() >= M_akce_Od AND CURRENT_DATE() <= M_akce_Do, 0, Sleva)
          WHERE C_Polozky = ? AND CURRENT_DATE() >= M_akce_Od AND CURRENT_DATE() <= M_akce_Do;
        `;
  
        // Vytvoření promises pro obě SQL operace
        return Promise.all([
          new Promise((resolve, reject) => {
            poolC5pneutyres.query(query, values, (err, results) => {
              if (err) reject(err);
              else resolve(results);
            });
          }),
          new Promise((resolve, reject) => {
            poolC5pneutyres.query(updateSalePriceQuery, [item.ItemId], (err, results) => {
              if (err) reject(err);
              else resolve(results);
            });
          })
        ]);
      });
  
      await Promise.all(updatePromises.flat());
      console.log('Aktualizace databáze dokončena');
      res.json({ success: true, message: 'Data byla synchronizována' });
    } catch (error) {
      console.error('Chyba při synchronizaci dat:', error);
      res.status(500).json({ success: false, message: 'Interní chyba serveru při synchronizaci dat' });
    }
  });
   
  // Endpoint pro získání názvu tlačítka z VersionID po přímém zadání URL
  app.get('/get-name-filter-from-id', (req, res) => {
    const filterId = req.query.filterId;
    if (!filterId) {
        return res.status(400).send({ error: 'Missing filterId query parameter' });
    }
  
    // Změna SQL dotazu pro výběr z nové tabulky a použití filterId
    const sqlQuery = 'SELECT filterName FROM Analytic_FilterTemplates WHERE filterId = ?';
    poolC5tpms.query(sqlQuery, [filterId], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send({ error: 'Server error' });
        }
  
        if (results.length === 0) {
            return res.status(404).send({ error: 'Filter not found' });
        }
  
        const filterName = results[0].filterName;
        res.send({ filterId, filterName });
    });
  });
  
  app.post('/saveDataWithFilterToImp', (req, res) => {
    const { data, filterName, userId, componentType, filterValues, filterURL } = req.body;
  
    // Nejprve uložíme šablonu filtru
    poolC5tpms.query(
      `INSERT INTO Analytic_FilterTemplates (userId, componentType, filterName, filterValues, filterURL) VALUES (?, ?, ?, ?, ?)`,
      [userId, componentType, filterName, JSON.stringify(filterValues), filterURL],
      (error, results) => {
        if (error) {
          console.error('Chyba při ukládání šablony filtru:', error);
          return res.status(500).json({ error: "Nepodařilo se uložit šablonu filtru" });
        }
  
        // Získání filterId z prvního insertu
        const filterId = results.insertId;
  
        // Kontrola, jestli existují data pro druhý insert
        if (data && data.length > 0) {
          const values = data.map(item => [
            item.dodavatel, item.externi_cislo_polozky, item.nazev_produktu, item.prodej_cena, item.minimalni_prodejni_cena,
            item.v_akci_od, item.v_akci_do, item.akcni_cena, item.marketingove_akce, item.c_polozky, item.dostupnost_web,
            item.dostupnost_b2b, item.skupina_radkove_slevy, item.sk_polozek, item.naklady_cena, item.prodej_datum_ceny, filterId // Zde používáme filterId jako hodnotu pro pole Verze
          ]);
  
          // Druhý insert pro uložení dat s použitím filterId
          poolC5tpms.query(
            `INSERT INTO IMPORT_CZS_Analytik_IMP
              (dodavatel, externi_cislo_polozky, nazev_produktu, prodej_cena, minimalni_prodejni_cena,
               v_akci_od, v_akci_do, akcni_cena, marketingove_akce, c_polozky, dostupnost_web,
               dostupnost_b2b, skupina_radkove_slevy, sk_polozek, naklady_cena, prodej_datum_ceny, Verze)
            VALUES ?`,
            [values],
            (error) => {
              if (error) {
                console.error('Chyba při ukládání dat:', error);
                return res.status(500).json({ error: "Nepodařilo se uložit data" });
              }
  
              res.json({ message: "Data a filtr byly úspěšně uloženy", filterId: filterId });
            }
          );
        } else {
          // Pokud nejsou žádná data k vložení, stále vrátíme úspěch
          res.json({ message: "Filtr byl úspěšně uložen, ale nebyla vložena žádná data", filterId: filterId });
        }
      }
    );
  });
  
  
  // Endpoint pro uložení filtru
  app.post('/saveFilterTemplate', (req, res) => {
    const { userId, componentType, filterName, filterValues, filterURL } = req.body;
  
    if (!userId || !componentType || !filterName || !filterValues || !filterURL) {
      return res.status(400).send({ error: 'Missing required fields' });
    }
  
    const sqlQuery = `
      INSERT INTO Analytic_FilterTemplates (userId, componentType, filterName, filterValues, filterURL)
      VALUES (?, ?, ?, ?, ?)
    `;
  
    poolC5tpms.query(sqlQuery, [userId, componentType, filterName, filterValues, filterURL], (error, results) => {
      if (error) {
        console.error('Error inserting filter template:', error);
        return res.status(500).send({ error: 'Error saving filter template' });
      }
      res.send({ success: true, message: 'Filter template saved successfully', filterId: results.insertId });
    });
  });
  
    // Zde budou endpointy pro Analysis
  };
  