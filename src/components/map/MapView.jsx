import { useStore } from '../../store/useStore';
import MapCore from './MapCore';
import HotspotLayer from './HotspotLayer';
import IndustrialBoundaryLayer from './IndustrialBoundaryLayer';
import HeatmapLayer from './HeatmapLayer';
import MapControls from './MapControls';
import TimeSlider from './TimeSlider';
import PredictionPanel from './PredictionPanel';

export default function MapView() {
  const mapMode = useStore((s) => s.mapMode);
  const showIndustrialOverlay = useStore((s) => s.showIndustrialOverlay);

  return (
    <div className="relative w-full h-full min-h-[420px]">
      <MapCore>
        {mapMode === 'events' ? <HotspotLayer /> : <HeatmapLayer />}
        {showIndustrialOverlay && <IndustrialBoundaryLayer />}
        <MapControls />
      </MapCore>
      <PredictionPanel />
      <TimeSlider />
    </div>
  );
}
