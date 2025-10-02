// src/services/geocode.js
const MAPBOX = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export async function geocodeOne(query, { country = 'cz', language = 'cs', bbox } = {}) {
  const token = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
  if (!token) throw new Error('Chybí REACT_APP_MAPBOX_ACCESS_TOKEN');

  const q = encodeURIComponent(query);
  const url = new URL(`${MAPBOX}/${q}.json`);
  url.searchParams.set('limit', '1');
  url.searchParams.set('access_token', token);
  if (country) url.searchParams.set('country', country);
  if (language) url.searchParams.set('language', language);
  if (bbox) url.searchParams.set('bbox', bbox); // "west,south,east,north" (volitelné)

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  const f = data.features?.[0];
  if (!f?.center) return null;

  return {
    lng: f.center[0],
    lat: f.center[1],
    label: f.place_name,
  };
}
