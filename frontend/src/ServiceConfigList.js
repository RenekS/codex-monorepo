import React, { useState, useEffect } from 'react';
import { getServiceConfigurations } from './ServiceConfig';

const ServiceConfigList = () => {
  const [serviceConfigurations, setServiceConfigurations] = useState([]);

  useEffect(() => {
    const fetchServiceConfigurations = async () => {
      const configs = await getServiceConfigurations();
      setServiceConfigurations(configs);
    };
    fetchServiceConfigurations();
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Seznam Konfigurací Servisních Služeb</h3>
      </div>
      <div className="card-body">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>ID Služby</th>
              <th>Typ Hodnoty</th>
              <th>Hodnota</th>
              <th>Dodatečná Hodnota Vyžadována</th>
              <th>Jednotka Dodatečné Hodnoty</th>
            </tr>
          </thead>
          <tbody>
            {serviceConfigurations.map((config) => (
              <tr key={config.id}>
                <td>{config.id}</td>
                <td>{config.service_id}</td>
                <td>{config.value_type}</td>
                <td>{config.value}</td>
                <td>{config.additional_value_required ? 'Ano' : 'Ne'}</td>
                <td>{config.additional_value_unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ServiceConfigList;
