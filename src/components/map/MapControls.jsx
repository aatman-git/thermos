import { useEffect, useMemo, useState } from 'react';
import { useMap } from './MapCore';
import { useStore } from '../../store/useStore';

const HEATMAP_MODES = [
  { label: 'Events', value: 'events' },
  { label: 'Thermal', value: 'thermal' },
  { label: 'Persistence', value: 'persistence' },
  { label: 'Risk', value: 'risk' },
];

export default function MapControls() {
  const { map, flyTo, toggleBasemap, basemap } = useMap() || {};
  const setMapMode = useStore((s) => s.setMapMode);
  const mapMode = useStore((s) => s.mapMode);
  const showIndustrialOverlay = useStore((s) => s.showIndustrialOverlay);
  const toggleIndustrialOverlay = useStore((s) => s.toggleIndustrialOverlay);
  const setFilter = useStore((s) => s.setFilter);

  const [searchValue, setSearchValue] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [bboxAnchor, setBboxAnchor] = useState(null);

  useEffect(() => {
    if (!map || !drawing) return;

    const onClick = (e) => {
      const coords = e.lngLat.toArray();
      if (!bboxAnchor) {
        setBboxAnchor(coords);
        return;
      }

      const [lng1, lat1] = bboxAnchor;
      const [lng2, lat2] = coords;
      const bbox = {
        minLng: Math.min(lng1, lng2),
        maxLng: Math.max(lng1, lng2),
        minLat: Math.min(lat1, lat2),
        maxLat: Math.max(lat1, lat2),
      };

      setFilter('bbox', bbox);
      setDrawing(false);
      setBboxAnchor(null);
    };

    map.on('click', onClick);
    return () => map.off('click', onClick);
  }, [map, drawing, bboxAnchor, setFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchValue.trim() || !flyTo) return;

    const coordMatch = searchValue.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      flyTo([lng, lat], 12);
      return;
    }

    const cities = {
      jamnagar: [70.0577, 22.4707],
      vizag: [83.2185, 17.6868],
      bokaro: [86.1511, 23.6693],
      paradip: [86.6085, 20.3164],
      haldia: [88.0583, 22.0257],
      mathura: [77.6737, 27.4924],
      mangalore: [74.8560, 12.9141],
      kochi: [76.2673, 9.9312],
      bathinda: [74.9455, 30.2110],
      bina: [78.9345, 24.1785],
    };

    const key = searchValue.toLowerCase().trim();
    if (cities[key]) {
      flyTo(cities[key], 11);
    }
  };

  const mapModeButtons = useMemo(() => HEATMAP_MODES, []);

  return (
    <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
      <form onSubmit={handleSearch} className="flex gap-1">
        <input
          type="text"
          placeholder="Search place or lat, lng…"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="h-8 w-48 px-2.5 text-sm bg-white/95 backdrop-blur border border-[var(--color-border)] rounded-[var(--radius-md)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] shadow-sm"
        />
        <button
          type="submit"
          className="h-8 w-8 flex items-center justify-center bg-white/95 backdrop-blur border border-[var(--color-border)] rounded-[var(--radius-md)] hover:bg-[var(--color-accent-subtle)] shadow-sm transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={toggleBasemap}
          className="h-8 px-2.5 text-scale-sm font-medium bg-white/95 backdrop-blur border border-[var(--color-border)] rounded-[var(--radius-md)] hover:bg-[var(--color-accent-subtle)] shadow-sm transition-colors self-start"
        >
          {basemap === 'light' ? 'Satellite' : 'Light'}
        </button>

        <button
          onClick={() => setDrawing((prev) => !prev)}
          className={`h-8 px-2.5 text-scale-sm font-medium border rounded-[var(--radius-md)] shadow-sm transition-colors self-start ${
            drawing ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-text-primary)]' : 'bg-white/95 border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-accent-subtle)]'
          }`}
        >
          {drawing ? 'Select region…' : 'BBox'}
        </button>

        <button
          onClick={toggleIndustrialOverlay}
          className={`h-8 px-2.5 text-scale-sm font-medium border rounded-[var(--radius-md)] shadow-sm transition-colors self-start ${
            showIndustrialOverlay ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)] text-[var(--color-text-primary)]' : 'bg-white/95 border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-accent-subtle)]'
          }`}
        >
          {showIndustrialOverlay ? 'Industrial On' : 'Industrial Off'}
        </button>
      </div>

      <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden bg-white/95 backdrop-blur shadow-sm">
        {mapModeButtons.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setMapMode(mode.value)}
            className={`px-2.5 h-7 text-scale-xs font-medium transition-colors ${
              mapMode === mode.value
                ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
