import React, { useState, useEffect } from 'react';
import { createServiceConfiguration, getServiceConfigurations, updateServiceConfiguration } from './ServiceConfig';

const ServiceConfigForm = () => {
  const [serviceConfigurations, setServiceConfigurations] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);

  const fetchServiceConfigurations = async () => {
    const configs = await getServiceConfigurations();
    setServiceConfigurations(configs);
  };

  useEffect(() => {
    fetchServiceConfigurations();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const serviceConfiguration = {
      service_id: form.service_id.value,
      value_type: form.value_type.value,
      value: form.value.value,
      additional_value_required: form.additional_value_required.checked,
      additional_value_unit: form.additional_value_unit.value,
    };

    if (selectedConfig) {
      await updateServiceConfiguration(selectedConfig.id, serviceConfiguration);
    } else {
      await createServiceConfiguration(serviceConfiguration);
    }
    fetchServiceConfigurations();
    form.reset();
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Konfigurace Servisních Služeb</h3>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="service_id">ID Služby</label>
            <input type="number" className="form-control" id="service_id" name="service_id" required />
          </div>
          <div className="form-group">
            <label htmlFor="value_type">Typ Hodnoty</label>
            <input type="text" className="form-control" id="value_type" name="value_type" required />
          </div>
          <div className="form-group">
            <label htmlFor="value">Hodnota</label>
            <input type="text" className="form-control" id="value" name="value" required />
          </div>
          <div className="form-group">
            <label htmlFor="additional_value_required">Vyžadována Dodatečná Hodnota</label>
            <input type="checkbox" id="additional_value_required" name="additional_value_required" />
          </div>
          <div className="form-group">
            <label htmlFor="additional_value_unit">Jednotka Dodatečné Hodnoty</label>
            <input type="text" className="form-control" id="additional_value_unit" name="additional_value_unit" />
          </div>
          <button type="submit" className="btn btn-primary">Uložit Konfiguraci</button>
        </form>
      </div>
    </div>
  );
};

export default ServiceConfigForm;
