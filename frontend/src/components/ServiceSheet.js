import React, { useState, useEffect } from 'react';
import {
  Container, TextField, Box, Grid, Card, CardContent, Typography, InputAdornment, IconButton, List, ListItem, ListItemText, Button, Modal, Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { useLocation } from 'react-router-dom';
import queryString from 'query-string';
import axios from 'axios';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import csLocale from 'date-fns/locale/cs';
import ServiceTasksSection from './ServiceTasksSection';
import TyreSection from './TyreSection';
import SensorDetailModal from './SensorDetailModal';
import '../css/App.css';


function ServiceSheet() {
  const [selectedVehicleRZ, setSelectedVehicleRZ] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState(null);
  const [serviceTasks, setServiceTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [templateId, setTemplateId] = useState(22);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tires, setTires] = useState({
    LP1: false, PP1: false, LP2: false, PP2: false,
    LZ1: false, PZ1: false, LZ2: false, PZ2: false,
    LZ3: false, PZ3: false, LZ4: false, PZ4: false, R1: false,
    L1: false, P1: false, L2: false, P2: false,
    L3: false, P3: false, L4: false, P4: false,
    L5: false, P5: false, L6: false, P6: false, R2: false,
  });
  const [activeFunctions, setActiveFunctions] = useState({
    tpms: false,
    gps: false,
    measurement: false,
    newSL: false,
    repair: false,
  });
  const [deviceID, setDeviceID] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [locationID, setLocationID] = useState('');
  const [showNewSLModal, setShowNewSLModal] = useState(false);
  const [serviceSheetId, setServiceSheetId] = useState(null);
  const [templateDetails, setTemplateDetails] = useState([]);
  const [sensorsData, setSensorsData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSensorData, setSelectedSensorData] = useState(null);

  const [newVehicleRegistration, setNewVehicleRegistration] = useState('');
  const [newServiceDate, setNewServiceDate] = useState(new Date());
  const [newServiceTime, setNewServiceTime] = useState(new Date());
  const [newWorkerId, setNewWorkerId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [workerSearchTerm, setWorkerSearchTerm] = useState('');
  const [workerSearchResults, setWorkerSearchResults] = useState([]);
  const [showWorkerSuggestions, setShowWorkerSuggestions] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const parsedQuery = queryString.parse(location.search);
    if (parsedQuery.deviceId) {
      setDeviceID(parsedQuery.deviceId);
      fetchDeviceData(parsedQuery.deviceId);
    }
  }, [location.search]);

  const fetchDeviceData = async (deviceID) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/get_location_id`, {
        params: { deviceID }
      });
      if (response.data.locationID) {
        setLocationID(response.data.locationID);
        setDeviceName(response.data.deviceName || 'N/A');
      } else {
        console.error('Location ID not found for the given device ID');
      }
    } catch (error) {
      console.error('Error fetching location ID:', error);
    }
  };

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/search-vehicles`, {
        params: { term: searchTerm }
      });
      setSearchResults(response.data.map(vehicle => ({
        vehicle_registration: vehicle.RZ,
      })));
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error searching for vehicles:', error);
    }
  };

  const handleActiveVehiclesClick = async () => {
    if (!deviceID) {
      alert('Device ID je povinné pro vyhledávání aktivních vozidel.');
      return;
    }
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/active_vehicles`, {
        params: { deviceID }
      });
      setSearchResults(response.data);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching active vehicles:', error);
    }
  };

  const handleSuggestionSelect = async (vehicle) => {
    setSelectedVehicleRZ(vehicle.vehicle_registration || '');
    setSearchTerm(vehicle.vehicle_registration || '');
    setShowSuggestions(false);

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/search-vehicles`, {
        params: { term: vehicle.vehicle_registration }
      });
      const vehicleData = response.data.find(v => v.RZ === vehicle.vehicle_registration);
      if (vehicleData) {
        setVehicleInfo(vehicleData);
        const templateId = vehicleData.templateId || 22;
        setTemplateId(templateId);
        setNewVehicleRegistration(vehicleData.RZ);

        setActiveFunctions({
          tpms: vehicleData.TPMS === 1,
          gps: vehicleData.GPS === 1,
          measurement: vehicleData.Measurement === 1,
          newSL: false,
          repair: false,
        });

        setTemplateDetails(vehicleData.templateDetails);
      }

      fetchServiceTasks();
      setRefreshKey(prevKey => prevKey + 1);
    } catch (error) {
      console.error('Error fetching vehicle info:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (isModalOpen) return;

      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/sensorsRZ/${selectedVehicleRZ}`);
        setSensorsData(response.data);
      } catch (error) {
        console.error('Error fetching sensor data:', error);
      }
    };

    const intervalId = setInterval(fetchData, 3000);

    return () => clearInterval(intervalId);
  }, [selectedVehicleRZ, isModalOpen]);

  const fetchServiceTasks = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/service_tasks`, {
        params: { tpms: activeFunctions.tpms, measurement: activeFunctions.measurement, repair: activeFunctions.repair }
      });
      const tasksWithNotes = response.data.map(task => ({
        ...task,
        note: task.note || '', // Initialize note as an empty string if it is not provided
        noteActive: false // Initialize noteActive as false
      }));
      setServiceTasks(tasksWithNotes);
    } catch (error) {
      console.error('Error fetching service tasks:', error);
    }
  };

  useEffect(() => {
    fetchServiceTasks();
  }, [activeFunctions]);

  const updateTaskCount = (id, newCount) => {
    setServiceTasks(tasks =>
      tasks.map(task =>
        task.id === id ? { ...task, count: newCount } : task
      )
    );
  };

  const updateNote = (id, newNote) => {
    setServiceTasks(tasks =>
      tasks.map(task =>
        task.id === id ? { ...task, note: newNote } : task
      )
    );
  };

  const toggleNoteActive = (id) => {
    setServiceTasks(tasks =>
      tasks.map(task =>
        task.id === id ? { ...task, noteActive: !task.noteActive } : task
      )
    );
  };

  const toggleTire = (tireLabel) => {
    setTires(prev => {
      const newTireStates = { ...prev, [tireLabel]: !prev[tireLabel] };

      const updatedTasks = serviceTasks.map(task => {
        if (tireLabel.includes('LP') || tireLabel.includes('PP')) {
          if (task.id === 1 || task.id === 2) {
            return { ...task, count: task.count + (newTireStates[tireLabel] ? 1 : -1) };
          }
        }
        return task;
      });

      setServiceTasks(updatedTasks);
      return newTireStates;
    });
  };

  const toggleFunction = (functionKey) => {
    setActiveFunctions(prevState => ({
      ...prevState,
      [functionKey]: !prevState[functionKey],
    }));
  };

  const handleNewSLOpen = () => {
    setShowNewSLModal(true);
  };

  const handleNewSLClose = () => {
    setShowNewSLModal(false);
  };

  const handleAddNewServiceSheet = async () => {
    try {
      const payload = {
        vehicle_registration: newVehicleRegistration,
        service_date: newServiceDate.toISOString().split('T')[0], // Formát YYYY-MM-DD
        service_time: newServiceTime.toTimeString().split(' ')[0], // Formát HH:MM:SS
        deviceID,
        worker_id: parseInt(newWorkerId, 10), // Konvertujeme na číslo
        notes: newNotes,
      };

      const response = await axios.post(`${process.env.REACT_APP_API_URL}/add_service_sheet`, payload);

      if (response.status === 200) {
        alert('Servisní list byl úspěšně přidán.');
        setServiceSheetId(response.data.serviceSheetId); // Uložení ID nového servisního listu
        setShowNewSLModal(false);
        setRefreshKey(prevKey => prevKey + 1);
      } else {
        alert('Nepodařilo se přidat servisní list.');
      }
    } catch (error) {
      console.error('Error adding new service sheet:', error);
      alert('Chyba při přidávání nového servisního listu.');
    }
  };

  const handleSaveTasks = async () => {
    try {
      const payload = {
        serviceSheetId,
        tasks: serviceTasks.map(task => ({
          id: task.id,
          count: task.count,
          note: task.note,
          noteActive: task.noteActive
        }))
      };

      const response = await axios.post(`${process.env.REACT_APP_API_URL}/add_service_tasks`, payload);

      if (response.status === 200) {
        alert('Úkoly byly úspěšně uloženy.');
        setRefreshKey(prevKey => prevKey + 1);
      } else {
        alert('Nepodařilo se uložit úkoly.');
      }
    } catch (error) {
      console.error('Error saving tasks:', error);
      alert('Chyba při ukládání úkolů.');
    }
  };

  // Funkce pro obnovení informací o senzorech
  const refreshSensorData = () => {
    setRefreshKey(prevKey => prevKey + 1);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      refreshSensorData();
    }, 60000); // Obnovení každých 60 sekund

    return () => clearInterval(interval); // Vyčištění intervalu při unmountu
  }, []);

  const handleWorkerSearch = async (event) => {
    const term = event.target.value;
    setWorkerSearchTerm(term);
    if (term.length > 2) { // Vyhledávat pokud jsou zadané alespoň 3 znaky
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/search-workers`, {
          params: { term }
        });
        setWorkerSearchResults(response.data);
        setShowWorkerSuggestions(true);
      } catch (error) {
        console.error('Error searching for workers:', error);
      }
    } else {
      setShowWorkerSuggestions(false);
      setWorkerSearchResults([]);
    }
  };

  const handleWorkerSelect = (worker) => {
    setNewWorkerId(worker.id);
    setWorkerSearchTerm(worker.name);
    setShowWorkerSuggestions(false);
  };

  return (
    <Container className="service-sheet-container" maxWidth={false} sx={{ height: '100vh', display: 'flex', flexDirection: 'column', width: '100%' }}>
      <Box className="service-sheet-header" my={4}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card className="service-sheet-card">
              <CardContent>
                <Typography variant="h6">Ovládání TyreSection</Typography>
                <Typography variant="body2">Servisní místo: XYZ</Typography>
                <Typography variant="body2">Číslo servisního listu: 123456</Typography>
                <Typography variant="body2">Datum a čas započetí: 20.06.2024 10:00</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      <Box className="service-sheet-search" my={4}>
        <form onSubmit={handleSearchSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card className="service-sheet-search-card">
                <CardContent>
                  <TextField
                    fullWidth
                    label="Vyhledat SPZ"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      handleSearchSubmit(e);
                    }}
                    variant="outlined"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={handleSearchSubmit} edge="end">
                            <SearchIcon />
                          </IconButton>
                          <Tooltip title="Vyhledat aktivní vozidla">
                            <IconButton onClick={handleActiveVehiclesClick} edge="end">
                              <DirectionsCarIcon />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      )
                    }}
                  />
                  {showSuggestions && (
                    <List className="service-sheet-suggestions">
                      {searchResults.map(vehicle => (
                        <ListItem button key={vehicle.vehicle_registration} onClick={() => handleSuggestionSelect(vehicle)}>
                          <ListItemText primary={vehicle.vehicle_registration} />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card className="service-sheet-location-card">
                <CardContent>
                  <TextField
                    fullWidth
                    label="Servisní místo"
                    value={deviceName}
                    onChange={(e) => setDeviceID(e.target.value)}
                    variant="outlined"
                    InputProps={{
                      readOnly: true,
                    }}
                  />
                  <Typography variant="body2"><strong>Location ID:</strong> {locationID}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </form>
      </Box>

      {vehicleInfo && (
        <Box className="service-sheet-vehicle-info" my={4}>
          <Card>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6">Informace o vozidle</Typography>
                  <Typography variant="body1"><strong>SPZ:</strong> {vehicleInfo.RZ}</Typography>
                  <Typography variant="body1"><strong>Společnost:</strong> {vehicleInfo.companyName ? vehicleInfo.companyName : 'Není k dispozici'}</Typography>
                  <Typography variant="body1"><strong>Tachometr:</strong> {vehicleInfo.tachographKm ? `${vehicleInfo.tachographKm} km` : 'Není k dispozici'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body1"><strong>Typ vozidla:</strong> {vehicleInfo.vehicleType}</Typography>
                  <Typography variant="body1"><strong>Číslo šablony:</strong> {vehicleInfo.templateId}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      <Grid container spacing={2} sx={{ flexGrow: 1, width: '100%' }}>
        <Grid item xs={12} md={6}>
          <Box className="service-sheet-tasks" p={2} sx={{ height: '100%', width: '100%' }}>
            <ServiceTasksSection
              serviceTasks={serviceTasks}
              updateTaskCount={updateTaskCount}
              updateNote={updateNote}
              toggleNoteActive={toggleNoteActive}
              activeFunctions={activeFunctions}
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box className="service-sheet-tyres" p={2} sx={{ height: '100%', width: '100%' }}>
            <TyreSection
              templateId={templateId}
              title={selectedVehicleRZ}
              RZ={selectedVehicleRZ}
              refreshKey={refreshKey}
              tires={tires}
              toggleTire={toggleTire}
              activeFunctions={activeFunctions}
              locationId={locationID}
              refreshInterval={3000}
              templateDetails={templateDetails}
              sensorsData={sensorsData}
              enableLeftClick={true}
              enableRightClick={true}
              openModal={(sensorData) => {
                setSelectedSensorData(sensorData);
                setIsModalOpen(true);
              }}
            />
          </Box>
        </Grid>
      </Grid>

      <Modal className="service-sheet-modal" open={showNewSLModal} onClose={handleNewSLClose}>
        <Box className="service-sheet-modal-content" sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, bgcolor: 'background.paper', p: 4 }}>
          <Typography variant="h6">Nový servisní list</Typography>
          <LocalizationProvider dateAdapter={AdapterDateFns} locale={csLocale}>
            <TextField
              fullWidth
              label="SPZ vozidla"
              value={newVehicleRegistration}
              onChange={(e) => setNewVehicleRegistration(e.target.value)}
              variant="outlined"
              margin="normal"
              disabled
            />
            <DatePicker
              label="Datum servisu"
              value={newServiceDate}
              onChange={(date) => setNewServiceDate(date)}
              renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
            />
            <TimePicker
              label="Čas servisu"
              value={newServiceTime}
              onChange={(time) => setNewServiceTime(time)}
              renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
            />
            <TextField
              fullWidth
              label="Vyhledat pracovníka"
              value={workerSearchTerm}
              onChange={handleWorkerSearch}
              variant="outlined"
              margin="normal"
            />
            {showWorkerSuggestions && (
              <List className="service-sheet-worker-suggestions">
                {workerSearchResults.map(worker => (
                  <ListItem button key={worker.id} onClick={() => handleWorkerSelect(worker)}>
                    <ListItemText primary={worker.name} />
                  </ListItem>
                ))}
              </List>
            )}
            <TextField
              fullWidth
              label="Poznámky"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              variant="outlined"
              margin="normal"
              multiline
              rows={4}
            />
          </LocalizationProvider>
          <Box mt={2} display="flex" justifyContent="space-between">
            <Button variant="contained" color="primary" onClick={handleAddNewServiceSheet}>
              Přidat
            </Button>
            <Button variant="outlined" color="secondary" onClick={handleNewSLClose}>
              Zavřít
            </Button>
          </Box>
        </Box>
      </Modal>

      <SensorDetailModal
        className="service-sheet-sensor-detail-modal"
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sensorData={selectedSensorData}
      />
    </Container>
  );
}

export default ServiceSheet;
