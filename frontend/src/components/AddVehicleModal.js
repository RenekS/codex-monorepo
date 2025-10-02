import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import axios from 'axios';
import TemplateList from './TemplateList';

const AddVehicleModal = ({ show, onHide, onVehicleAdded }) => {
  const [rz, setRZ] = useState('');
  const [templateId, setTemplateId] = useState(null);
  const [tractor, setTractor] = useState(false);
  const [tachographKm, setTachographKm] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [deviceId, setDeviceId] = useState('');

  const handleSubmit = async () => {
    if (!rz || !templateId) {
      alert('Prosím, vyplňte SPZ a vyberte šablonu.');
      return;
    }

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/add-vehicle`, {
        RZ: rz,
        templateId,
        tractor: tractor ? 1 : 0,
        tachographKm,
        vehicleType,
        companyId,
        deviceId,
      });
      if (response.status === 200) {
        alert('Vozidlo bylo úspěšně přidáno.');
        onVehicleAdded();
        onHide(); // Zavře modální okno
      } else {
        alert('Při přidávání vozidla došlo k chybě.');
      }
    } catch (error) {
      console.error('Error adding vehicle:', error);
      alert('Při přidávání vozidla došlo k chybě.');
    }
  };

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Přidat nové vozidlo</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group controlId="rz">
            <Form.Label>SPZ</Form.Label>
            <Form.Control
              type="text"
              value={rz}
              onChange={(e) => setRZ(e.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="templateId">
            <Form.Label>Šablona vozidla</Form.Label>
            <TemplateList onSelectTemplate={setTemplateId} />
          </Form.Group>
          <Form.Group controlId="tractor">
            <Form.Check
              type="checkbox"
              label="Tahač"
              checked={tractor}
              onChange={(e) => setTractor(e.target.checked)}
            />
          </Form.Group>
          <Form.Group controlId="tachographKm">
            <Form.Label>Tachograf Km</Form.Label>
            <Form.Control
              type="text"
              value={tachographKm}
              onChange={(e) => setTachographKm(e.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="vehicleType">
            <Form.Label>Typ vozidla</Form.Label>
            <Form.Control
              type="text"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="companyId">
            <Form.Label>ID Společnosti</Form.Label>
            <Form.Control
              type="text"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="deviceId">
            <Form.Label>ID Zařízení</Form.Label>
            <Form.Control
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Zavřít</Button>
        <Button variant="primary" onClick={handleSubmit}>Přidat vozidlo</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddVehicleModal;
