import { create } from 'zustand';
import { mockGeoJSON } from '../data/mockData';
import { fetchLiveEvents, predictLocation as apiPredictLocation } from '../services/api';

const PRESET_TIME_WINDOWS = {
  '24H': [0, 1],
  '7D': [0, 1],
  '30D': [0, 1],
};

const DATE_RANGE_DAYS = {
  '24H': 1,
  '7D': 7,
  '30D': 30,
};

/**
 * Central store — single source of truth for selected event,
 * active filters, map display state, and location predictions.
 */
export const useStore = create((set, get) => ({
  // All events (GeoJSON)
  events: mockGeoJSON,
  dataSource: 'demo',
  loading: false,
  apiError: null,
  hydrateEvents: async () => {
    set({ loading: true, apiError: null });
    try {
      const events = await fetchLiveEvents();
      set({ events, dataSource: 'live', loading: false });
    } catch (error) {
      set({ apiError: error.message, loading: false });
    }
  },

  // Selected event (clicked from map/list/anywhere)
  selectedEventId: null,
  selectEvent: (id) => set({ selectedEventId: id, drawerOpen: id !== null }),
  clearSelection: () => set({ selectedEventId: null, drawerOpen: false }),

  // Drawer state
  drawerOpen: false,
  setDrawerOpen: (open) => set({ drawerOpen: open, selectedEventId: open ? get().selectedEventId : null }),

  // Derived: get selected event feature
  getSelectedEvent: () => {
    const { events, selectedEventId } = get();
    if (!selectedEventId) return null;
    return events.features.find((f) => f.properties?.id === selectedEventId || f.id === selectedEventId) || null;
  },

  // Location-based ML prediction feature
  predictCoords: null, // { lat, lng }
  prediction: null,
  predictLoading: false,
  predictError: null,
  setPredictCoords: (coords) => set({ predictCoords: coords }),
  clearPrediction: () => set({ predictCoords: null, prediction: null, predictError: null }),
  predictLocation: async (lat, lng) => {
    set({ predictCoords: { lat, lng }, predictLoading: true, predictError: null });
    try {
      const res = await apiPredictLocation({ latitude: lat, longitude: lng });
      set({ prediction: res, predictLoading: false });
      return res;
    } catch (err) {
      set({ predictError: err.message, predictLoading: false });
      return null;
    }
  },

  // Filters
  filters: {
    confidenceMin: 0,
    dateRange: '30D',
    categories: [],
    riskTiers: [],
    searchQuery: '',
    bbox: null,
  },
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () =>
    set({
      filters: {
        confidenceMin: 0,
        dateRange: '30D',
        categories: [],
        riskTiers: [],
        searchQuery: '',
        bbox: null,
      },
    }),

  // Time range for bottom strip and map window
  timeRange: '30D',
  setTimeRange: (range) => {
    set((state) => ({
      timeRange: range,
      timeSliderValue: PRESET_TIME_WINDOWS[range] || [0, 1],
      filters: {
        ...state.filters,
        dateRange: range,
      },
    }));
  },

  // Time slider value (0–1 normalized range)
  timeSliderValue: [0, 1],
  setTimeSliderValue: (val) => set({ timeSliderValue: val }),

  mapMode: 'events',
  setMapMode: (mode) => set({ mapMode: mode }),

  showIndustrialOverlay: true,
  toggleIndustrialOverlay: () => set((state) => ({ showIndustrialOverlay: !state.showIndustrialOverlay })),

  // Computed: filtered events
  getFilteredEvents: () => {
    const { events, filters, timeSliderValue } = get();
    if (!events || !Array.isArray(events.features)) return [];

    const [startNorm, endNorm] = timeSliderValue || [0, 1];
    const totalDays = DATE_RANGE_DAYS[filters.dateRange] || 30;
    const minAgeDays = Math.max(0, (1 - endNorm) * totalDays);
    const maxAgeDays = Math.max(0, (1 - startNorm) * totalDays);
    const now = Date.now();

    return events.features.filter((f) => {
      const p = f.properties || {};
      const d = p.first_detected ? new Date(p.first_detected) : (p.acq_date ? new Date(p.acq_date) : null);
      const ageDays = d && !isNaN(d.getTime()) ? Math.max(0, (now - d.getTime()) / 86400000) : 0;

      // Only apply time window filter if not full range [0, 1]
      if (startNorm > 0.05 || endNorm < 0.95) {
        if (ageDays < minAgeDays || ageDays > maxAgeDays) return false;
      }

      if (filters.confidenceMin > 0 && (p.confidence || 0) < filters.confidenceMin) return false;
      const classStr = typeof p.classification === 'string' ? p.classification : p.classification?.category;
      if (filters.categories.length > 0 && !filters.categories.includes(p.category) && !filters.categories.includes(classStr)) return false;
      if (filters.riskTiers.length > 0 && !filters.riskTiers.includes(p.risk_tier)) return false;
      if (filters.bbox) {
        const { minLng, maxLng, minLat, maxLat } = filters.bbox;
        const lng = Number(p.lng ?? f.geometry?.coordinates?.[0] ?? 0);
        const lat = Number(p.lat ?? f.geometry?.coordinates?.[1] ?? 0);
        if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return false;
      }
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const classSearch = typeof p.classification === 'string' ? p.classification : (p.classification?.category || '');
        const searchable = `${p.id || ''} ${p.region || ''} ${p.category || ''} ${classSearch} ${p.land_cover || ''}`.toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  },

  // Filtered GeoJSON (for map source)
  getFilteredGeoJSON: () => ({
    type: 'FeatureCollection',
    features: get().getFilteredEvents(),
  }),
}));
