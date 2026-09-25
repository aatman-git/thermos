import { useEffect, useMemo } from 'react';
import { useMap } from './MapCore';
import { filterEvents, useStore } from '../../store/useStore';

const SOURCE_ID = 'thermal-heatmap';
const LAYER_ID = 'thermal-heat';

const HEATMAP_STYLES = {
  events: {
    colorRamp: ['#F5C518', '#F59E0B', '#DC2626', '#7F1D1D'],
    opacity: 0.48,
  },
  thermal: {
    colorRamp: ['#F5C518', '#F59E0B', '#DC2626', '#7C2D12'],
    opacity: 0.55,
  },
  persistence: {
    colorRamp: ['#A7F3D0', '#6EE7B7', '#10B981', '#065F46'],
    opacity: 0.52,
  },
  risk: {
    colorRamp: ['#FDE68A', '#F59E0B', '#EF4444', '#7F1D1D'],
    opacity: 0.58,
  },
};

export default function HeatmapLayer() {
  const { map, mapReady } = useMap();
  const mapMode = useStore((s) => s.mapMode);
  const events = useStore((s) => s.events);
  const filters = useStore((s) => s.filters);
  const timeSliderValue = useStore((s) => s.timeSliderValue);

  const heatData = useMemo(() => ({
    type: 'FeatureCollection',
    features: filterEvents(events, filters, timeSliderValue).map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        weight: Math.min(1, (feature.properties.risk_score || 0) / 100),
      },
    })),
  }), [events, filters, timeSliderValue]);

  useEffect(() => {
    if (!map || !mapReady) return;

    const addLayer = () => {
      try {
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: heatData,
          });
        } else {
          map.getSource(SOURCE_ID).setData(heatData);
        }

        if (map.getLayer(LAYER_ID)) return;

        const style = HEATMAP_STYLES[mapMode] || HEATMAP_STYLES.events;
        map.addLayer({
          id: LAYER_ID,
          type: 'heatmap',
          source: SOURCE_ID,
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'risk_score'], 0, 0, 100, 1],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 10, 20],
            'heatmap-intensity': 1,
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.2, style.colorRamp[0],
              0.45, style.colorRamp[1],
              0.7, style.colorRamp[2],
              1, style.colorRamp[3],
            ],
            'heatmap-opacity': style.opacity,
          },
        });
      } catch (error) {
        if (error?.message !== 'Style is not done loading.') {
          console.warn('HeatmapLayer: addLayer error', error);
        }
      }
    };

    addLayer();
    const retryTimers = [50, 250, 750, 1500, 3000, 6000].map((delay) => setTimeout(addLayer, delay));
    const onStyleLoad = () => addLayer();
    map.on('style.load', onStyleLoad);

    return () => {
      retryTimers.forEach(clearTimeout);
      map.off('style.load', onStyleLoad);
      if (map.getLayer(LAYER_ID)) {
        map.removeLayer(LAYER_ID);
      }
      if (map.getSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
    };
  }, [map, mapReady, heatData, mapMode]);

  return null;
}
