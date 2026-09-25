const API_BASE_URL = (import.meta.env.VITE_THERMOS_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const FALLBACK_CLOUD_URL = 'https://thermos-backend-gz3d.onrender.com';

async function fetchWithFallback(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, options);
    if (res.ok) return await res.json();
  } catch (_) {
    // Try cloud backend fallback if localhost is not running
  }
  const cloudRes = await fetch(`${FALLBACK_CLOUD_URL}${path}`, options);
  if (!cloudRes.ok) throw new Error(`Request failed (${cloudRes.status})`);
  return cloudRes.json();
}

export async function fetchAnomalies() {
  return fetchWithFallback('/api/anomalies');
}

export async function fetchStats() {
  return fetchWithFallback('/api/stats');
}

export async function askThermosCopilot(query, anomalyId = null, eventProps = null) {
  const lat = eventProps?.lat ?? eventProps?.latitude ?? null;
  const lng = eventProps?.lng ?? eventProps?.longitude ?? null;
  const facilityId = eventProps?.facility_id ?? null;
  try {
    const data = await fetchWithFallback('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, facility_id: facilityId, latitude: lat, longitude: lng }),
    });
    return data;
  } catch (_) {
    try {
      const ragData = await fetchWithFallback('/api/rag/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, anomaly_id: anomalyId, facility_id: facilityId }),
      });
      return ragData;
    } catch (err) {
      return null;
    }
  }
}

export async function analyzeHotspotAI(payload) {
  return fetchWithFallback('/api/ai/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
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
