// ZakladniSlevy.js

import React, { useState, useEffect } from 'react';

function ZakladniSlevy() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(process.env.REACT_APP_API_URL + '/get-kalkulace-cen-netto')
      .then(response => response.json())
      .then(data => setData(data))
      .catch(error => console.error('Error fetching data:', error));
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Netto</h3>
      </div>
      <div className="card-body">
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>Položka</th>
              <th>E-shop</th>
              <th>Pult</th>
              <th>Servis</th>
              <th>VO</th>
              <th>VIP</th>
              <th>Indiv</th>
              <th>Dopravci</th>
              <th>Datum Zapsání</th>
              <th>B2B</th>
              <th>EXT E-shop</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                <td>{row.polozka}</td>
                <td>{row['1_eshop']}</td>
                <td>{row['2_pult']}</td>
                <td>{row['3_servis']}</td>
                <td>{row['4_vo']}</td>
                <td>{row['5_vip']}</td>
                <td>{row['6_indiv']}</td>
                <td>{row['7_dopravci']}</td>
                <td>{row.datum_zapsani}</td>
                <td>{row.B2B}</td>
                <td>{row.EXT_eshop}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ZakladniSlevy;
