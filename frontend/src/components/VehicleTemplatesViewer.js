import React, { useState } from 'react';
import TemplateList from './TemplateList';
import TyreSection from './TyreSection';

function VehicleTemplatesViewer() {
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [title, setTitle] = useState(''); // Přidání stavu pro nadpis

  // Tuto funkci předáte do TemplateList pro aktualizaci vybrané šablony a nadpisu
  const handleSelectTemplate = (templateId, templateName) => {
    setSelectedTemplateId(templateId);
    setTitle(templateName); // Nastavte nadpis na název šablony nebo jakoukoliv jinou hodnotu
  
  
  
  };
  return (
    <div className="vehicle-templates-viewer d-flex flex-column">
      {/* Přidaná sekce s nadpisem */}
      <div className="header-section">
        <h2>Seznam šablon vozidel</h2>
      </div>
      <div className="content-section d-flex">
        <div className="template-list">
          <TemplateList onSelectTemplate={handleSelectTemplate} />
        </div>
        <div className="tyre-section">
        <TyreSection templateId={selectedTemplateId} title={title} />
        </div>
      </div>
    </div>
  );
}

export default VehicleTemplatesViewer;
