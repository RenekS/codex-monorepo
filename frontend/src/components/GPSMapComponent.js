// GPSMapComponent.js
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import IconButton from '@mui/material/IconButton';
import MyLocationIcon from '@mui/icons-material/MyLocation';

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const GPSMapComponent = ({ RZ, startTime, endTime, routeGeometries, currentPosition }) => {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [autoCenter, setAutoCenter] = useState(true);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('map').setView([50.0755, 14.4378], 13); // Výchozí pozice (např. Praha)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
    }
  }, []);

  // Zobrazení aktuální pozice
  useEffect(() => {
    if (!mapRef.current) return;

    // Odstraníme starý marker, pokud existuje
    if (markerRef.current) {
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }

    if (currentPosition) {
      const { latitude, longitude, timestamp } = currentPosition;
      markerRef.current = L.marker([latitude, longitude]).addTo(mapRef.current);
      markerRef.current.bindPopup(
        `Aktuální poloha vozidla<br>Timestamp: ${new Date(timestamp).toLocaleString()}`
      );
      // Pokud je autoCenter zapnutý, nastavíme aktuální pozici, jinak pouze aktualizujeme marker
      if (autoCenter) {
        const currentZoom = mapRef.current.getZoom();
        mapRef.current.setView([latitude, longitude], currentZoom);
      }
    }
  }, [currentPosition, autoCenter]);

  // Zobrazení tras (pokud existují)
  useEffect(() => {
    if (mapRef.current && routeGeometries && routeGeometries.length > 0) {
      // Odstraníme starou trasu, pokud existuje
      if (mapRef.current.routeLayer) {
        mapRef.current.removeLayer(mapRef.current.routeLayer);
      }

      const combinedGeoJson = {
        type: 'FeatureCollection',
        features: routeGeometries.map(geometry => ({
          type: 'Feature',
          properties: {},
          geometry: geometry,
        })),
      };

      mapRef.current.routeLayer = L.geoJSON(combinedGeoJson, {
        style: {
          color: 'blue',
          weight: 4,
          opacity: 0.6,
        },
      }).addTo(mapRef.current);

      // Přizpůsobíme mapu, aby zobrazila celou trasu
      mapRef.current.fitBounds(mapRef.current.routeLayer.getBounds());
    }
  }, [routeGeometries]);

  return (
    <div style={{ position: 'relative' }}>
      <div id="map" style={{ height: '500px', width: '100%' }}></div>
      <IconButton
        onClick={() => setAutoCenter(!autoCenter)}
        style={{ 
          position: 'absolute', 
          top: '10px', 
          right: '10px', 
          background: 'white',
          zIndex: 1000
        }}
        aria-label="toggle auto-center"
      >
        <MyLocationIcon color={autoCenter ? 'primary' : 'disabled'} />
      </IconButton>
    </div>
  );
};

export default GPSMapComponent;
