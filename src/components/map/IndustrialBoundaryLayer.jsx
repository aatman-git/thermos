import { useEffect, useMemo } from 'react';
import { useMap } from './MapCore';

const INDUSTRIAL_POLYGONS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Jamnagar Refinery Cluster' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [69.9, 22.1],
          [70.5, 22.1],
          [70.5, 22.8],
          [69.9, 22.8],
          [69.9, 22.1],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Vizag Industrial Belt' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [83.0, 17.5],
          [83.6, 17.5],
          [83.6, 18.1],
          [83.0, 18.1],
          [83.0, 17.5],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Bokaro Steel Complex' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [85.9, 23.5],
          [86.5, 23.5],
          [86.5, 24.0],
          [85.9, 24.0],
          [85.9, 23.5],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Paradip Port Industrial Zone' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [86.4, 19.9],
          [86.9, 19.9],
          [86.9, 20.8],
          [86.4, 20.8],
          [86.4, 19.9],
        ]],
      },
    },
  ],
};

const SOURCE_ID = 'industrial-boundaries';
const LAYER_ID = 'industrial-boundaries-fill';

export default function IndustrialBoundaryLayer() {
  const ctx = useMap();
  const { map, mapReady } = ctx || { map: null, mapReady: false };
  const data = useMemo(() => INDUSTRIAL_POLYGONS, []);

  useEffect(() => {
    if (!map || !mapReady) return;

    const addLayers = () => {
      try {
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data,
          });
        }

        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: 'fill',
            source: SOURCE_ID,
            paint: {
              'fill-color': '#F5C518',
              'fill-opacity': 0.08,
              'fill-outline-color': '#E8E6E0',
            },
          });
        }
      } catch (error) {
        if (error?.message !== 'Style is not done loading.') {
          console.warn('IndustrialBoundaryLayer: error adding layer', error);
        }
      }
    };

    addLayers();
    const retryTimers = [50, 250, 750, 1500, 3000, 6000].map((delay) => setTimeout(addLayers, delay));
    const onStyleLoad = () => addLayers();
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
  }, [map, mapReady, data]);

  if (!map || !mapReady) return null;

  return null;
}
