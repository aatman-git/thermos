import { mockGeoJSON } from '../data/mockData';

const configuredApiUrl = import.meta.env.VITE_THERMOS_API_URL?.trim();
const isLoopbackApiUrl = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i.test(configuredApiUrl || '');
const usableApiUrl = import.meta.env.DEV || !isLoopbackApiUrl ? configuredApiUrl : '';
const defaultApiUrl = import.meta.env.DEV ? 'http://localhost:8000' : '';
const API_BASE_URL = (usableApiUrl || defaultApiUrl).replace(/\/$/, '');

// In production, if no explicit API URL is configured, use same-origin (relative) URLs
// This allows the frontend to call backend APIs deployed on the same domain (e.g., Vercel Functions)
const isProduction = !import.meta.env.DEV;
const effectiveApiBase = API_BASE_URL || (isProduction ? '' : 'http://localhost:8000');

function demoFallbackGeoJSON() {
  return {
    ...mockGeoJSON,
    metadata: {
      ...(mockGeoJSON.metadata || {}),
      source: 'demo',
    },
  };
}

/**
 * Fetch thermal hotspot observations from backend NASA FIRMS endpoint /api/fires
 */
export async function fetchFires(params = {}) {
  const query = new URLSearchParams();
  if (params.bbox) query.set('bbox', params.bbox);
  if (params.day_range) query.set('day_range', String(params.day_range));
  if (params.source) query.set('source', params.source);
  if (params.limit) query.set('limit', String(params.limit));

  const url = `${effectiveApiBase}/api/fires${query.toString() ? `?${query.toString()}` : ''}`;
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
    return demoFallbackGeoJSON();
  }
}

export async function fetchAnomalies() {
  try {
    const response = await fetch(`${effectiveApiBase}/api/anomalies`);
    if (!response.ok) throw new Error(`Anomalies request failed (${response.status})`);
    return await response.json();
  } catch (err) {
    console.warn('Anomalies fetch failed, using mock data:', err);
    return demoFallbackGeoJSON();
  }
}

export async function fetchStats() {
  try {
    const response = await fetch(`${effectiveApiBase}/api/stats`);
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

  // Send X-User-Role header so backend get_current_user has a role context.
  // In dev, use Admin to bypass auth. In production, use a default role to ensure
  // the backend doesn't reject the request due to missing auth context.
  const headers = { 'Content-Type': 'application/json' };
  headers['X-User-Role'] = import.meta.env.DEV ? 'Admin' : 'Analyst';

  const url = `${effectiveApiBase}/api/predict`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    let errData;
    try {
      errData = JSON.parse(errText);
    } catch {
      errData = { message: errText };
    }
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
  console.debug('[fetchLiveEvents] Raw API response:', { 
    status: data.status, 
    data_mode: data.data_mode, 
    count: data.count,
    hasFeatures: !!data.features,
    featuresLength: data.features?.length,
    hasFires: !!data.fires,
    firesLength: data.fires?.length
  });
  
  const rawFeatures = data.features || (Array.isArray(data.fires) ? data.fires.map((f) => ({
    type: 'Feature',
    id: f.id,
    geometry: { type: 'Point', coordinates: [Number(f.longitude), Number(f.latitude)] },
    properties: f,
  })) : []);

  if (!rawFeatures || rawFeatures.length === 0) {
    console.warn('[fetchLiveEvents] No features found, returning demo fallback');
    return demoFallbackGeoJSON();
  }

  // Backend returns data_mode at top level: 'live' or 'demo'
  const source = data.data_mode === 'live' ? 'live' : 'demo';
  console.info('[fetchLiveEvents] Resolved data source:', source, '| Loaded features count:', rawFeatures.length);
  
  return {
    type: 'FeatureCollection',
    metadata: {
      source,
    },
    features: rawFeatures.map(normalizeAnomaly),
  };
}

/**
 * Ask a custom question or submit an inquiry to the AI Investigator / Chatbot
 * Calls POST /api/events/{id}/ask with fallback to POST /api/investigator/ask
 */
export async function askEventQuestion({ eventId, question, context = {} }) {
  const payload = {
    event_id: eventId,
    question: (question || '').trim(),
    context,
  };

  const primaryUrl = `${effectiveApiBase}/api/events/${encodeURIComponent(eventId)}/ask`;
  const fallbackUrl = `${effectiveApiBase}/api/investigator/ask`;

  // Try primary /api/events/{id}/ask
  try {
    const res = await fetch(primaryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': import.meta.env.DEV ? 'Admin' : 'Analyst',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('[askEventQuestion] Primary endpoint error:', err);
  }

  // Try fallback /api/investigator/ask
  try {
    const fbRes = await fetch(fallbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': import.meta.env.DEV ? 'Admin' : 'Analyst',
      },
      body: JSON.stringify(payload),
    });

    if (fbRes.ok) {
      return await fbRes.json();
    }
  } catch (err) {
    console.debug('[askEventQuestion] Fallback endpoint error:', err);
  }

  return null;
}

export { API_BASE_URL };
