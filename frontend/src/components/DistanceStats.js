import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TextField, Button, Box } from '@mui/material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const DistanceStats = ({ RZ }) => {
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [distance, setDistance] = useState(null);
  const [vehicleData, setVehicleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVehicleData = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/vehicle-data/${RZ}`);
        setVehicleData(response.data);
        setLoading(false);
      } catch (err) {
        setError(err);
        setLoading(false);
      }
    };

    fetchVehicleData();
  }, [RZ]);

  const chunkArray = (array, chunkSize) => {
    const result = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      result.push(array.slice(i, i + chunkSize));
    }
    return result;
  };

  const fetchDistanceData = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/gps-data-by-timestamp`, {
        params: {
          startTime: startTime.getTime(),
          endTime: endTime.getTime(),
          rz: RZ,
        },
      });
      const gpsData = response.data;

      const coordinates = gpsData.map(data => ({ longitude: data.longitude, latitude: data.latitude }));
      const timestamps = gpsData.map(data => data.timestamp);

      const coordinateChunks = chunkArray(coordinates, 90);
      const timestampChunks = chunkArray(timestamps, 90);

      const requests = coordinateChunks.map((chunk, index) => {
        const coords = chunk.map(coord => `${coord.longitude},${coord.latitude}`).join(';');
        const times = timestampChunks[index].join(';');

        return axios.get(`https://api.mapbox.com/matching/v5/mapbox/driving/${coords}`, {
          params: {
            access_token: process.env.REACT_APP_MAPBOX_ACCESS_TOKEN,
            timestamps: times,
            geometries: 'geojson',
            overview: 'full',
          },
        });
      });

      const responses = await Promise.all(requests);
      const totalDistance = responses.reduce((acc, response) => {
        const routeDistance = response.data.matchings.reduce((sum, match) => sum + match.distance, 0);
        return acc + routeDistance;
      }, 0);

      setDistance(totalDistance);
    } catch (error) {
      console.error('Error fetching distance data:', error.message);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error loading data: {error.message}</div>;
  }

  if (!vehicleData) {
    return <div>No data available</div>;
  }

  const getAxleTypeText = (axleType) => {
    switch (axleType) {
      case 'R':
        return 'Řízená';
      case 'N':
        return 'Neřízená';
      default:
        return 'Neznámý typ';
    }
  };

  const getDriveTypeText = (driveType) => {
    switch (driveType) {
      case 'N':
        return 'Nehnaná';
      case 'H':
        return 'Hnaná';
      default:
        return 'Neznámý pohon';
    }
  };

  const getMountTypeText = (mountType) => {
    switch (mountType) {
      case '1':
        return 'Jednomontáž';
      case '2':
        return 'Dvojmontáž';
      default:
        return 'Neznámý typ montáže';
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div style={{ width: '100%', padding: '20px' }}>
        <h2>Informace o vozidle</h2>
        <table className="table table-bordered table-striped">
          <thead>
            <tr>
              <th>Parametr</th>
              <th>Hodnota</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>SPZ</td>
              <td>{vehicleData.RZ}</td>
            </tr>
            <tr>
              <td>Č. šablony</td>
              <td>{vehicleData.templateId}</td>
            </tr>
            <tr>
              <td>Tahač</td>
              <td>{vehicleData.tractor}</td>
            </tr>
            <tr>
              <td>Typ vozidla</td>
              <td>{vehicleData.vehicleType}</td>
            </tr>
            <tr>
              <td>IČ společnosti</td>
              <td>{vehicleData.companyId}</td>
            </tr>
          </tbody>
        </table>

        <h3>Pneumatiky</h3>
        <table className="table table-bordered table-striped">
          <thead>
            <tr>
              <th>Pozice</th>
              <th>Rozměr</th>
              <th>Název pneu</th>
              <th>Hloubka dez. 1</th>
              <th>Hloubka dez. 2</th>
              <th>Hloubka dez. 3</th>
              <th>Předepsaný tlak</th>
              <th>Max hl. dez.</th>
              <th>Datum měření</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(vehicleData.positions).map(([position, data]) => (
              <tr key={position}>
                <td>{position}</td>
                <td></td>
                <td></td>
                <td>{data.treadDepth1}</td>
                <td>{data.treadDepth2}</td>
                <td>{data.treadDepth3}</td>
                <td>{data.idealPressure}</td>
                <td>{data.maxDepth}</td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Nápravy</h3>
        <table className="table table-bordered table-striped">
          <thead>
            <tr>
              <th>Č. nápravy</th>
              <th>Typ nápravy</th>
              <th>Typ pohonu</th>
              <th>Typ montáže</th>
              <th>Tlak na nápr.</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(vehicleData.axles).map(([axleId, data]) => (
              <tr key={axleId}>
                <td>{data.axlePosition}</td>
                <td>{getAxleTypeText(data.axleType)}</td>
                <td>{getDriveTypeText(data.driveType)}</td>
                <td>{getMountTypeText(data.mountType)}</td>
                <td>{data.GAWR}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Měření vzdálenosti</h2>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <DateTimePicker
            label="Počáteční čas"
            value={startTime}
            onChange={(newValue) => setStartTime(newValue)}
            renderInput={(params) => <TextField {...params} />}
          />
          <DateTimePicker
            label="Konečný čas"
            value={endTime}
            onChange={(newValue) => setEndTime(newValue)}
            renderInput={(params) => <TextField {...params} />}
          />
          <Button variant="contained" onClick={fetchDistanceData}>Vypočítej vzdálenost</Button>
          {distance !== null && <Box mt={2}>Ujetá vzdálenost: {distance} metrů</Box>}
        </Box>
      </div>
    </LocalizationProvider>
  );
};

export default DistanceStats;
