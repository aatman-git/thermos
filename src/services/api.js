import { mockGeoJSON } from '../data/mockData';

const API_BASE_URL = (import.meta.env.VITE_THERMOS_API_URL || 'http://localhost:8000').replace(/\/$/, '');

/**
 * Fetch thermal hotspot observations from backend NASA FIRMS endpoint /api/fires
 */
export async function fetchFires(params = {}) {
  const query = new URLSearchParams();
  if (params.bbox) query.set('bbox', params.bbox);
  if (params.day_range) query.set('day_range', String(params.day_range));
  if (params.source) query.set('source', params.source);
  if (params.limit) query.set('limit', String(params.limit));

  const url = `${API_BASE_URL}/api/fires${query.toString() ? `?${query.toString()}` : ''}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      // Fallback to legacy endpoint if /api/fires returns 404
      if (response.status === 404) {
        return fetchAnomalies();
      }
      throw new Error(`Fires request failed (${response.status})`);
    }
    return await response.json();
  } catch (err) {
    console.warn('Backend fetch failed, using fallback:', err);
    // Offline / fallback mode
    return mockGeoJSON;
  }
}

export async function fetchAnomalies() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/anomalies`);
    if (!response.ok) throw new Error(`Anomalies request failed (${response.status})`);
    return await response.json();
  } catch (err) {
    console.warn('Anomalies fetch failed, using mock data:', err);
    return mockGeoJSON;
  }
}

export async function fetchStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stats`);
    if (!response.ok) throw new Error(`Stats request failed (${response.status})`);
    return await response.json();
  } catch (err) {
    console.warn('Stats fetch failed, returning default:', err);
    return { total: 0, by_class: {}, by_risk: {}, high_risk: 0, critical: 0, avg_frp: 0 };
  }
}

/**
 * Predict classification, risk, and explainability for any coordinate location
 */
export async function predictLocation({ latitude, longitude, brightness_k, frp_mw, confidence, daynight }) {
  const body = {
    latitude: Number(latitude),
    longitude: Number(longitude),
    ...(brightness_k != null ? { brightness_k: Number(brightness_k) } : {}),
    ...(frp_mw != null ? { frp_mw: Number(frp_mw) } : {}),
    ...(confidence != null ? { confidence } : {}),
    ...(daynight != null ? { daynight } : {}),
  };

  const response = await fetch(`${API_BASE_URL}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || errData.message || `Prediction request failed (${response.status})`);
  }

  return response.json();
}

/**
 * Strictly validate and parse coordinates as numbers and normalize properties
 */
export function normalizeAnomaly(feature) {
  const properties = feature.properties || {};

  // Extract coordinates and guarantee numbers
  let rawLng = feature.geometry?.coordinates?.[0];
  let rawLat = feature.geometry?.coordinates?.[1];

  if (rawLng == null || isNaN(Number(rawLng))) rawLng = properties.longitude ?? properties.lng ?? 0;
  if (rawLat == null || isNaN(Number(rawLat))) rawLat = properties.latitude ?? properties.lat ?? 0;

  const lng = Number(rawLng);
  const lat = Number(rawLat);

  const classification = properties.category || (typeof properties.classification === 'string' ? properties.classification : properties.classification?.category) || 'Unknown';
  const rawRiskLevel = properties.risk_level || (properties.risk_score >= 80 ? 'CRITICAL' : properties.risk_score >= 60 ? 'HIGH' : properties.risk_score >= 35 ? 'MODERATE' : 'LOW');
  const riskTier = properties.risk_tier || (rawRiskLevel.charAt(0).toUpperCase() + rawRiskLevel.slice(1).toLowerCase());
  const riskScore = properties.risk_score != null ? Math.round(Number(properties.risk_score)) : Math.round(Number(properties.confidence || 50));

  const firstDetected = properties.first_detected || (properties.acq_date
    ? `${properties.acq_date}T${String(properties.acq_time || '0000').padStart(4, '0').slice(0, 2)}:${String(properties.acq_time || '0000').slice(-2)}:00Z`
    : new Date().toISOString());

  const fid = feature.id || properties.id || properties.anomaly_id || `HOTSPOT-${Math.round(lat * 100)}-${Math.round(lng * 100)}`;

  return {
    type: 'Feature',
    id: fid,
    geometry: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    properties: {
      ...properties,
      id: fid,
      anomaly_id: fid,
      category: classification,
      classification,
      risk_tier: riskTier,
      risk_level: rawRiskLevel.toUpperCase(),
      risk_score: riskScore,
      region: properties.region || properties.facility_name || `${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E`,
      lat,
      lng,
      latitude: lat,
      longitude: lng,
      persistence_hours: Number(properties.persistence_hours || properties.persistence_hours_7d || 6),
      first_detected: firstDetected,
      frp: Number(properties.frp || properties.frp_mw || 15),
      brightness_temp: Number(properties.brightness_temp || properties.brightness_k || properties.brightness || 330),
      confidence: Number(properties.confidence || 75),
      evidence: properties.evidence || [],
    },
  };
}

/**
 * Fetch live events from /api/fires, fall back gracefully to mockGeoJSON
 */
export async function fetchLiveEvents() {
  const data = await fetchFires();
  const rawFeatures = data.features || (Array.isArray(data.fires) ? data.fires.map((f) => ({
    type: 'Feature',
    id: f.id,
    geometry: { type: 'Point', coordinates: [Number(f.longitude), Number(f.latitude)] },
    properties: f,
  })) : []);

  if (!rawFeatures || rawFeatures.length === 0) {
    return mockGeoJSON;
  }

  return {
    type: 'FeatureCollection',
    features: rawFeatures.map(normalizeAnomaly),
  };
}

export { API_BASE_URL };
