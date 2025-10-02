// VehicleViewer.js
import React, { useState } from 'react';
import VehicleList from './VehicleList';
import TyreSection from './TyreSection';
import axios from 'axios';
import {
  Box,
  Modal,
  IconButton,
  Toolbar,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

function VehicleViewer() {
  const theme = useTheme();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [templateDetails, setTemplateDetails] = useState([]);
  const [sensorsData, setSensorsData] = useState([]);
  const [activeFunctions, setActiveFunctions] = useState({
    tpms: false,
    gps: false,
    measurement: false,
  });
  const [modalOpen, setModalOpen] = useState(false);

  const handleSelectVehicle = async (vehicle) => {
    setSelectedVehicle(vehicle);
    setRefreshKey((prevKey) => prevKey + 1);

    try {
      const vehicleResponse = await axios.get(`${process.env.REACT_APP_API_URL}/search-vehicles`, {
        params: { term: vehicle.RZ },
      });

      const vehicleData = vehicleResponse.data.find((v) => v.RZ === vehicle.RZ);

      if (vehicleData) {
        setTemplateDetails(vehicleData.templateDetails);
        setSensorsData(vehicleData.sensorsData);

        setActiveFunctions({
          tpms: vehicleData.TPMS === 1,
          gps: vehicleData.GPS === 1,
          measurement: vehicleData.Measurement === 1,
        });
      }
    } catch (error) {
      console.error('Error fetching vehicle details:', error);
    }
  };

  const handleUpdateSensorsData = (data) => {
    setSensorsData(data);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}>
      {/* Přidáme Toolbar pro odsazení od AppBaru */}
      
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, flex: 1 }}>
        <Box
          sx={{
            flex: { xs: '1 1 auto', md: '0 0 40%' },
            backgroundColor: theme.palette.background.default,
            padding: '20px',
            borderRight: `1px solid ${theme.palette.divider}`,
          }}
        >
          <VehicleList
            onSelectVehicle={handleSelectVehicle}
            refreshKey={refreshKey}
            onUpdateSensorsData={handleUpdateSensorsData}
          />
        </Box>
        <Box sx={{ flex: { xs: '1 1 auto', md: '0 0 60%' }, padding: '20px' }}>
          {selectedVehicle && (
            <TyreSection
              templateId={selectedVehicle.templateId}
              title={selectedVehicle.RZ}
              RZ={selectedVehicle.RZ}
              refreshKey={refreshKey}
              tires={selectedVehicle}
              activeFunctions={activeFunctions}
              locationId={selectedVehicle.locationId}
              templateDetails={templateDetails}
              sensorsData={sensorsData}
              enableLeftClick={true}
              enableRightClick={true}
            />
          )}
        </Box>
      </Box>

      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '90%',
            height: '90%',
            backgroundColor: 'white',
            padding: '20px',
            overflowY: 'auto',
          }}
        >
          <IconButton onClick={handleCloseModal} sx={{ position: 'absolute', top: '10px', right: '10px' }}>
            <CloseIcon />
          </IconButton>
          {selectedVehicle && (
            <TyreSection
              templateId={selectedVehicle.templateId}
              title={selectedVehicle.RZ}
              RZ={selectedVehicle.RZ}
              refreshKey={refreshKey}
              tires={selectedVehicle}
              activeFunctions={activeFunctions}
              locationId={selectedVehicle.locationId}
              templateDetails={templateDetails}
              sensorsData={sensorsData}
              enableLeftClick={true}
              enableRightClick={true}
            />
          )}
        </Box>
      </Modal>
    </Box>
  );
}

export default VehicleViewer;