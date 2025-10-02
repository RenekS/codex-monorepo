import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import ColumnFilter from './ColumnFilter';

function TemplateList({ onSelectTemplate }) {
  const [vehicleTemplates, setVehicleTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Převod URLSearchParams na objekt filtrů
  const getFiltersFromURL = () => {
    const searchParams = new URLSearchParams(location.search);
    return Object.fromEntries(searchParams);
  };

  // Načtení dat šablon z API na základě aktuálních filtrů
  const fetchData = async (filters) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/search-vehicle-templates`, { params: filters });
      setVehicleTemplates(response.data);
    } catch (error) {
      console.error('Error loading vehicle templates:', error);
    }
  };

  // Aktualizace filtrů a načtení dat při změně URL
  useEffect(() => {
    const filters = getFiltersFromURL();
    fetchData(filters);
  }, [location.search]);

  // Funkce pro aktualizaci filtrů a URL
  const handleFilterChange = (filterName, value) => {
    const searchParams = new URLSearchParams(location.search);
    if (value) {
      searchParams.set(filterName, value);
    } else {
      searchParams.delete(filterName);
    }
    // Aktualizace URL s novými filtry
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  };

  // Funkce pro označení vybrané šablony a aktualizaci stavu
  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
    onSelectTemplate(templateId);
  };

  return (
    <div className="table-responsive">
      <table className="table table-bordered table-striped table-hover"> {/* Přidání Bootstrap tříd */}
        <thead>
          <tr>
            <th>
              Číslo šablony
              <ColumnFilter filterName="templateId" onChange={handleFilterChange} placeholder="Filtrovat číslo šablony" />
            </th>
            
            <th>
              Název šablony
              <ColumnFilter filterName="templateName" onChange={handleFilterChange} placeholder="Filtrovat název šablony" />
            </th>
            <th>
              Druh vozidla
              <ColumnFilter filterName="type" onChange={handleFilterChange} placeholder="Filter druh vozidla" />
            </th>
            <th>
              Počet náprav
              <ColumnFilter filterName="numberOfAxles" onChange={handleFilterChange} placeholder="Filtrovat počet náprav" />
            </th>
            <th>
              Aktivní
              <ColumnFilter filterName="active" onChange={handleFilterChange} placeholder="Ano/Ne" />
            </th>
          </tr>
        </thead>
        <tbody>
          {vehicleTemplates.map(template => (
            <tr key={template.templateId} 
                className={template.templateId === selectedTemplateId ? 'table-primary' : ''} // Podmíněné použití třídy
                onClick={() => handleSelectTemplate(template.templateId)}
                style={{cursor: 'pointer'}}>
              <td>{template.templateId}</td>
              <td>{template.templateName}</td>
              <td>{template.Type}</td>
              <td>{template.numberOfAxles}</td>
              <td>{template.active ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TemplateList;
