/** Realistic mock thermal event data — Indian industrial locations */

const REGIONS = [
  { name: 'Jamnagar, Gujarat', lat: 22.4707, lng: 70.0577 },
  { name: 'Vizag, Andhra Pradesh', lat: 17.6868, lng: 83.2185 },
  { name: 'Bokaro, Jharkhand', lat: 23.6693, lng: 86.1511 },
  { name: 'Paradip, Odisha', lat: 20.3164, lng: 86.6085 },
  { name: 'Haldia, West Bengal', lat: 22.0257, lng: 88.0583 },
  { name: 'Bina, Madhya Pradesh', lat: 24.1785, lng: 78.9345 },
  { name: 'Mathura, Uttar Pradesh', lat: 27.4924, lng: 77.6737 },
  { name: 'Mangalore, Karnataka', lat: 12.9141, lng: 74.8560 },
  { name: 'Kochi, Kerala', lat: 9.9312, lng: 76.2673 },
  { name: 'Bathinda, Punjab', lat: 30.2110, lng: 74.9455 },
];

const CATEGORIES = [
  'Industrial Persistent Source',
  'Industrial Accidental Fire',
  'Wildfire',
  'Agricultural Burning',
  'Gas Flare',
  'Unknown',
];

const RISK_TIERS = ['Critical', 'High', 'Moderate', 'Low'];

const LAND_COVERS = [
  'Industrial Zone',
  'Refinery Complex',
  'Steel Plant',
  'Port Area',
  'Agricultural Land',
  'Forest/Scrub',
  'Petrochemical Complex',
  'Power Plant',
  'Urban Fringe',
];

const EVIDENCE_FACTORS = [
  { factor: 'Persistence', notes: ['Active for 72+ hours continuously', 'Persistent over 120 hours', 'Intermittent over 48 hours', 'Newly detected, <6 hours'] },
  { factor: 'Industrial Proximity', notes: ['Within 200m of refinery boundary', 'Inside steel plant complex', 'Adjacent to petrochemical storage', 'No industrial infrastructure within 2km'] },
  { factor: 'Thermal Trend', notes: ['Escalating +18% over 24h', 'Stable high-intensity signature', 'Declining from peak', 'Fluctuating irregularly'] },
  { factor: 'Land Cover', notes: ['Confirmed industrial land use (OSM)', 'Mixed industrial-residential zone', 'Agricultural cropland', 'Forest/grassland cover'] },
  { factor: 'FRP Pattern', notes: ['Consistent with gas flare profile', 'Spike pattern suggests accidental ignition', 'Low-FRP spread pattern — wildfire', 'Seasonal burn pattern matches agriculture'] },
  { factor: 'Population Exposure', notes: ['Dense settlement within 1km', 'Moderate population within 5km', 'Sparse rural population', 'No population within 10km'] },
];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEvidence(category) {
  const count = 3 + Math.floor(Math.random() * 3);
  const shuffled = [...EVIDENCE_FACTORS].sort(() => Math.random() - 0.5).slice(0, count);
  let weights = shuffled.map(() => Math.random());
  const total = weights.reduce((a, b) => a + b, 0);
  weights = weights.map((w) => Math.round((w / total) * 100) / 100);

  return shuffled.map((ef, i) => ({
    factor: ef.factor,
    weight: weights[i],
    note: randomChoice(ef.notes),
  }));
}

function generateEvent(index) {
  const region = REGIONS[index % REGIONS.length];
  const category = index < 6 ? CATEGORIES[index] : randomChoice(CATEGORIES);

  const riskWeights = {
    'Industrial Accidental Fire': () => randomBetween(70, 98),
    'Wildfire': () => randomBetween(60, 95),
    'Industrial Persistent Source': () => randomBetween(40, 85),
    'Gas Flare': () => randomBetween(20, 50),
    'Agricultural Burning': () => randomBetween(15, 55),
    'Unknown': () => randomBetween(30, 70),
  };

  const riskScore = Math.round(riskWeights[category]());
  const riskTier = riskScore >= 80 ? 'Critical' : riskScore >= 60 ? 'High' : riskScore >= 35 ? 'Moderate' : 'Low';

  const persistenceHours = category === 'Industrial Persistent Source'
    ? Math.round(randomBetween(48, 720))
    : category === 'Gas Flare'
      ? Math.round(randomBetween(100, 2000))
      : Math.round(randomBetween(1, 96));

  const now = Date.now();
  const firstDetected = new Date(now - persistenceHours * 3600000).toISOString();

  const jitterLat = (Math.random() - 0.5) * 0.08;
  const jitterLng = (Math.random() - 0.5) * 0.08;

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [
        Math.round((region.lng + jitterLng) * 10000) / 10000,
        Math.round((region.lat + jitterLat) * 10000) / 10000,
      ],
    },
    properties: {
      id: `THR-${String(2400 + index).padStart(4, '0')}`,
      category,
      confidence: Math.round(randomBetween(55, 99)),
      risk_score: riskScore,
      risk_tier: riskTier,
      frp: Math.round(randomBetween(5, 450) * 10) / 10,
      brightness_temp: Math.round(randomBetween(310, 520) * 10) / 10,
      persistence_hours: persistenceHours,
      observation_count: Math.max(1, Math.round(persistenceHours / randomBetween(3, 12))),
      land_cover: randomChoice(LAND_COVERS),
      lat: Math.round((region.lat + jitterLat) * 10000) / 10000,
      lng: Math.round((region.lng + jitterLng) * 10000) / 10000,
      region: region.name,
      first_detected: firstDetected,
      evidence: generateEvidence(category),
    },
  };
}

// Generate 42 realistic events
const events = Array.from({ length: 42 }, (_, i) => generateEvent(i));

export const mockGeoJSON = {
  type: 'FeatureCollection',
  features: events,
};

/** Sorted events for priority queue */
export const sortedByRisk = [...events]
  .sort((a, b) => b.properties.risk_score - a.properties.risk_score);

/** Events grouped by risk tier */
export const groupedByRisk = RISK_TIERS.reduce((acc, tier) => {
  acc[tier] = sortedByRisk.filter((e) => e.properties.risk_tier === tier);
  return acc;
}, {});

/** Aggregate stats */
export const aggregateStats = {
  total: events.length,
  critical: events.filter((e) => e.properties.risk_tier === 'Critical').length,
  high: events.filter((e) => e.properties.risk_tier === 'High').length,
  moderate: events.filter((e) => e.properties.risk_tier === 'Moderate').length,
  low: events.filter((e) => e.properties.risk_tier === 'Low').length,
  persistent: events.filter((e) => e.properties.persistence_hours > 48).length,
};

/** Category color map */
export const CATEGORY_COLORS = {
  'Industrial Persistent Source': '#D97706',
  'Industrial Accidental Fire': '#DC2626',
  'Wildfire': '#991B1B',
  'Agricultural Burning': '#6B7C3A',
  'Gas Flare': '#7C3AED',
  'Unknown': '#9CA3AF',
};

/** Risk tier color map */
export const RISK_COLORS = {
  'Critical': '#DC2626',
  'High': '#EA580C',
  'Moderate': '#D97706',
  'Medium': '#D97706',
  'Low': '#16A34A',
};

/** Category short labels */
export const CATEGORY_SHORT = {
  'Industrial Persistent Source': 'Ind. Persistent',
  'Industrial Accidental Fire': 'Ind. Accidental',
  'Wildfire': 'Wildfire',
  'Agricultural Burning': 'Agri. Burning',
  'Gas Flare': 'Gas Flare',
  'Unknown': 'Unknown',
};

/** Generate time-series history for an event (for mini chart) */
export function generateEventHistory(event) {
  const hours = Math.min(event.properties.persistence_hours, 168);
  const points = Math.min(Math.max(hours, 6), 48);
  const interval = hours / points;
  const baseTemp = event.properties.brightness_temp;

  return Array.from({ length: points }, (_, i) => ({
    hour: Math.round(i * interval),
    temp: Math.round((baseTemp + (Math.random() - 0.5) * 40) * 10) / 10,
    frp: Math.round((event.properties.frp + (Math.random() - 0.5) * event.properties.frp * 0.3) * 10) / 10,
  }));
}
