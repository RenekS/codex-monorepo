import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';
import _ from 'lodash';

// Nastavení výchozí ikony pro Leaflet.js
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const GPSDataMap = ({ RZ, refreshKey }) => {
  const [gpsData, setGpsData] = useState(null);
  const prevDataRef = useRef();

  const fetchGpsData = useCallback(_.debounce(async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/gps-data-by-rz/${RZ}`);
      const newData = response.data;

      // Porovnejte nová data s předchozími daty a aktualizujte stav pouze pokud se změnila
      if (JSON.stringify(newData) !== JSON.stringify(prevDataRef.current)) {
        console.log('Fetched GPS data:', newData);
        setGpsData(newData);
        prevDataRef.current = newData;
      }
    } catch (error) {
      console.error('Error fetching GPS data:', error);
    }
  }, 500), [RZ]); // Debounce s 500ms zpožděním

  useEffect(() => {
    if (RZ) {
      fetchGpsData();
    }
  }, [RZ, fetchGpsData, refreshKey]); // Přidáno fetchGpsData do závislostí useEffect

  if (!gpsData) {
    return <div>Loading...</div>;
  }

  if (gpsData.length === 0) {
    return <div>No data available</div>;
  }

  const { latitude, longitude, timestamp } = gpsData[0]; // Předpokládáme, že máme alespoň jeden záznam
  console.log('Using latitude:', latitude, 'longitude:', longitude, 'timestamp:', timestamp);

  return (
    <MapContainer center={[latitude, longitude]} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
      />
      <Marker position={[latitude, longitude]}>
        <Popup>
          Aktuální poloha zařízení<br/>
          Timestamp: {new Date(timestamp).toLocaleString()}
        </Popup>
      </Marker>
    </MapContainer>
  );
};

export default GPSDataMap;
