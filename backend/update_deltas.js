const mysql = require('mysql');

const poolC5tpms = mysql.createPool({
  connectionLimit: 10,
  host: 'Ww35.virthost.cz',
  user: 'c5tpms',
  password: 'wfxboWREwfxboWRE!C7!C7',
  database: 'c5tpms'
});

function haversineDistance(coords1, coords2) {
  function toRad(x) {
    return x * Math.PI / 180;
  }

  const [lat1, lon1] = coords1;
  const [lat2, lon2] = coords2;

  const R = 6371e3; // Radius of the Earth in meters
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c;

  return d;
}

async function updateDeltas(batchSize) {
  let lastId = 0;
  while (true) {
    const rows = await new Promise((resolve, reject) => {
      poolC5tpms.query(
        `SELECT t1.id AS current_id, t1.latitude AS current_lat, t1.longitude AS current_lon,
                t2.latitude AS prev_lat, t2.longitude AS prev_lon
         FROM parsed_gnss_data t1
         LEFT JOIN parsed_gnss_data t2 ON t1.device_id = t2.device_id AND t1.timestamp > t2.timestamp
         WHERE t2.id IS NOT NULL AND t1.id > ?
         ORDER BY t1.device_id, t1.timestamp
         LIMIT ?`,
        [lastId, batchSize],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });

    if (rows.length === 0) {
      console.log('All rows updated.');
      break;
    }

    for (const row of rows) {
      const delta = haversineDistance([row.current_lat, row.current_lon], [row.prev_lat, row.prev_lon]);
      await new Promise((resolve, reject) => {
        poolC5tpms.query(
          `UPDATE parsed_gnss_data SET delta = ? WHERE id = ?`,
          [delta, row.current_id],
          (err, results) => {
            if (err) return reject(err);
            resolve(results);
          }
        );
      });
    }

    lastId = rows[rows.length - 1].current_id;
    console.log(`Updated batch ending with ID: ${lastId}`);
  }
  poolC5tpms.end();
}

updateDeltas(100); // Change batch size if necessary
