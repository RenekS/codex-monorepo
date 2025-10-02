import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function ServiceConfig() {
  const [configurations, setConfigurations] = useState([]);
  const [form, setForm] = useState({
    service_id: '',
    value_type: '',
    value: '',
    additional_value_required: false,
    additional_value_unit: '',
  });

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const fetchConfigurations = async () => {
    try {
      const response = await fetch(`${API_URL}/services`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      setConfigurations(data);
    } catch (error) {
      console.error('Error fetching configurations:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = `${API_URL}/service-configuration`;
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      };
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      fetchConfigurations();
      setForm({ service_id: '', value_type: '', value: '', additional_value_required: false, additional_value_unit: '' });
    } catch (error) {
      console.error('Error saving configuration:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prevForm) => ({
      ...prevForm,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  return (
    <div className="content">
      <div className="container-fluid">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Nastavení Pneuservisu</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Typ hodnoty:</label>
                <input className="form-control" name="value_type" value={form.value_type} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Hodnota:</label>
                <input className="form-control" name="value" value={form.value} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Je požadována další hodnota:</label>
                <input className="form-check-input" name="additional_value_required" type="checkbox" checked={form.additional_value_required} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Jednotka další hodnoty:</label>
                <input className="form-control" name="additional_value_unit" value={form.additional_value_unit} onChange={handleChange} />
              </div>
              <button type="submit" className="btn btn-primary">Uložit Konfiguraci</button>
            </form>
          </div>
        </div>
        
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Existující Konfigurace</h3>
          </div>
          <div className="card-body">
            <ul className="list-group">
              {configurations.map((config) => (
                <li key={config.config_id} className="list-group-item">
                  {config.name} - {config.value_type}: {config.value} {config.additional_value_required && `+ ${config.additional_value_unit}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServiceConfig;
