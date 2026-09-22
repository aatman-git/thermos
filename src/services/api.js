const API_BASE_URL = (import.meta.env.VITE_THERMOS_API_URL || 'https://thermos-backend-gz3d.onrender.com').replace(/\/$/, '');

export async function fetchAnomalies() {
  const response = await fetch(`${API_BASE_URL}/api/anomalies`);
  if (!response.ok) throw new Error(`Anomalies request failed (${response.status})`);
  return response.json();
}

export async function fetchStats() {
  const response = await fetch(`${API_BASE_URL}/api/stats`);
  if (!response.ok) throw new Error(`Stats request failed (${response.status})`);
  return response.json();
}

export function normalizeAnomaly(feature) {
  const properties = feature.properties || {};
  const [lng, lat] = feature.geometry?.coordinates || [0, 0];
  const classification = properties.classification || 'Unknown';
  const riskLevel = (properties.risk_level || 'MODERATE').toUpperCase();
  const riskTier = riskLevel.charAt(0) + riskLevel.slice(1).toLowerCase();
  const firstDetected = properties.acq_date
    ? `${properties.acq_date}T${String(properties.acq_time || '0000').padStart(4, '0').slice(0, 2)}:${String(properties.acq_time || '0000').slice(-2)}:00Z`
    : new Date().toISOString();

  return {
    ...feature,
    id: feature.id || properties.anomaly_id,
    properties: {
      ...properties,
      id: feature.id || properties.anomaly_id,
      category: classification,
      risk_tier: riskTier,
      risk_score: properties.risk_score != null ? Math.round(properties.risk_score) : Math.round((properties.confidence || 0) * 100),
      region: properties.facility_name || `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
      lat,
      lng,
      persistence_hours: properties.persistence_hours_7d || 0,
      first_detected: firstDetected,
      evidence: [],
    },
  };
}

export async function fetchLiveEvents() {
  const data = await fetchAnomalies();
  return {
    type: 'FeatureCollection',
    features: (data.features || []).map(normalizeAnomaly),
  };
}

export { API_BASE_URL };
