import { useEffect, useMemo, useState } from 'react';
import { useMap } from './MapCore';
import { useStore } from '../../store/useStore';

const HEATMAP_MODES = [
  { label: 'Events', value: 'events' },
  { label: 'Thermal', value: 'thermal' },
  { label: 'Persistence', value: 'persistence' },
  { label: 'Risk', value: 'risk' },
];

const KNOWN_PLACES = {
  jamnagar: [70.0577, 22.4707],
  vizag: [83.2185, 17.6868],
  visakhapatnam: [83.2185, 17.6868],
  dahej: [72.5842, 21.7125],
  bokaro: [86.1511, 23.6693],
  paradip: [86.6085, 20.3164],
  haldia: [88.0583, 22.0257],
  mathura: [77.6737, 27.4924],
  mangalore: [74.8560, 12.9141],
  kochi: [76.2673, 9.9312],
  bathinda: [74.9455, 30.2110],
  bina: [78.9345, 24.1785],
  similipal: [86.3417, 21.9056],
  punjab: [75.8421, 30.2458],
  sangrur: [75.8421, 30.2458],
  delhi: [77.2090, 28.6139],
  mumbai: [72.8777, 19.0760],
  kolkata: [88.3639, 22.5726],
  chennai: [80.2707, 13.0827],
  bengaluru: [77.5946, 12.9716],
  hyderabad: [78.4867, 17.3850],
};

export default function MapControls() {
  const { map, flyTo, changeBasemap, basemap, viewCoords } = useMap() || {};
  const setMapMode = useStore((s) => s.setMapMode);
  const mapMode = useStore((s) => s.mapMode);
  const showIndustrialOverlay = useStore((s) => s.showIndustrialOverlay);
  const toggleIndustrialOverlay = useStore((s) => s.toggleIndustrialOverlay);
  const setFilter = useStore((s) => s.setFilter);
  const predictLocation = useStore((s) => s.predictLocation);
  const eventsCount = useStore((s) => s.events?.features?.length ?? 0);

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

    // Check if input is lat, lng
    const coordMatch = searchValue.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      flyTo([lng, lat], 12);
      predictLocation(lat, lng);
      return;
    }

    // Check known cities/places
    const key = searchValue.toLowerCase().trim();
    if (KNOWN_PLACES[key]) {
      const [lng, lat] = KNOWN_PLACES[key];
      flyTo([lng, lat], 11);
      predictLocation(lat, lng);
      return;
    }

    // Default fallback: parse words or notify
    setFilter('searchQuery', searchValue);
  };

  const mapModeButtons = useMemo(() => HEATMAP_MODES, []);

  const BASEMAP_OPTIONS = [
    { id: 'nasa_firms', label: 'NASA GIBS' },
    { id: 'nasa_night', label: 'NASA Night' },
    { id: 'dark', label: 'Dark Matter' },
    { id: 'satellite', label: 'Satellite' },
  ];

  return (
    <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
      {/* NASA FIRMS Live Map Header Badge & Coords */}
      <div className="flex items-center gap-2 bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-red-500/30 shadow-xl max-w-fit">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
          </span>
          <span className="text-[11px] font-bold tracking-wide text-red-400 uppercase">NASA FIRMS</span>
        </div>
        <span className="text-slate-600 text-xs">•</span>
        <span className="text-[11px] font-medium text-slate-300">24hrs Active Fires</span>
        <span className="text-slate-600 text-xs">•</span>
        <div className="font-mono text-[10px] text-amber-400/90 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700/60">
          @{viewCoords?.lat ?? 0.0}, {viewCoords?.lng ?? 0.0}, {viewCoords?.zoom ?? 3.0}z
        </div>
        {eventsCount > 0 && (
          <span className="bg-red-950/80 text-red-300 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-red-500/30">
            {eventsCount} live
          </span>
        )}
      </div>

      {/* Search & Location Predict Bar */}
      <div className="flex gap-1.5 items-center">
        <form onSubmit={handleSearch} className="flex gap-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Search place or lat, lng to predict…"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="h-8 w-60 pl-8 pr-2.5 text-xs bg-slate-900/90 text-white placeholder-slate-400 backdrop-blur-md border border-slate-700 rounded-lg focus:outline-none focus:border-red-500 shadow-lg"
            />
            <svg className="absolute left-2.5 top-2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <button
            type="submit"
            title="Predict & Locate"
            className="h-8 px-2.5 flex items-center justify-center bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow-lg transition-colors"
          >
            Predict
          </button>
        </form>

        {/* View Preset Buttons */}
        <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden bg-slate-900/90 backdrop-blur-md shadow-md">
          <button
            onClick={() => flyTo && flyTo([0.0, 0.0], 3.0)}
            title="NASA FIRMS Global View (@0, 0, 3z)"
            className="px-2 h-8 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border-r border-slate-700"
          >
            FIRMS Global
          </button>
          <button
            onClick={() => flyTo && flyTo([78.9629, 22.5937], 4.5)}
            title="Regional View (India)"
            className="px-2 h-8 text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            India View
          </button>
        </div>
      </div>

      {/* Map Basemap & Layer Controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Basemap Pill Switcher */}
        <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden bg-slate-900/90 backdrop-blur-md shadow-md">
          {BASEMAP_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => changeBasemap && changeBasemap(opt.id)}
              className={`px-2 h-7 text-[11px] font-medium transition-colors ${
                basemap === opt.id
                  ? 'bg-red-600 text-white font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setDrawing((prev) => !prev)}
          className={`h-7 px-2 text-[11px] font-medium border rounded-lg shadow-md transition-colors ${
            drawing
              ? 'bg-red-600 border-red-500 text-white'
              : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800'
          }`}
        >
          {drawing ? 'Click map for BBox…' : 'BBox'}
        </button>

        <button
          onClick={toggleIndustrialOverlay}
          className={`h-7 px-2 text-[11px] font-medium border rounded-lg shadow-md transition-colors ${
            showIndustrialOverlay
              ? 'bg-amber-600/30 border-amber-500 text-amber-300'
              : 'bg-slate-900/90 border-slate-700 text-slate-400 hover:bg-slate-800'
          }`}
        >
          {showIndustrialOverlay ? 'Industrial On' : 'Industrial Off'}
        </button>
      </div>

      {/* Layer Modes (Events / Thermal / Persistence / Risk) */}
      <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden bg-slate-900/90 backdrop-blur-md shadow-md self-start">
        {mapModeButtons.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setMapMode(mode.value)}
            className={`px-2.5 h-7 text-xs font-semibold transition-colors ${
              mapMode === mode.value
                ? 'bg-red-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}

