import { useStore } from '../../store/useStore';
import { getRiskColor, getCategoryColor } from '../../utils/formatters';

export default function PredictionPanel() {
  const predictCoords = useStore((s) => s.predictCoords);
  const prediction = useStore((s) => s.prediction);
  const predictLoading = useStore((s) => s.predictLoading);
  const predictError = useStore((s) => s.predictError);
  const clearPrediction = useStore((s) => s.clearPrediction);

  if (!predictCoords && !predictLoading && !prediction) {
    return null;
  }

  return (
    <div
      className="absolute bottom-14 left-3 z-20 max-w-sm w-full sm:w-[370px] rounded-2xl overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-3"
      style={{
        background: 'linear-gradient(155deg, #FFFFFF 0%, #FFFDF8 45%, #FEF9E7 100%)',
        border: '1.5px solid rgba(245, 197, 24, 0.42)',
        boxShadow:
          '0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 16px 32px -4px rgba(26, 26, 23, 0.16), 0 24px 44px -8px rgba(245, 197, 24, 0.24), inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1.5px 2px 0 rgba(245, 197, 24, 0.16)',
      }}
    >
      {/* 3D Elevated Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-white/90 via-[#FEFDF7] to-[#FEF9E7]/90 border-b border-[#F5C518]/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F5C518] shadow-[0_0_8px_rgba(245,197,24,0.7)] animate-pulse"></span>
          <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A17]">
            ML Location Prediction
          </span>
        </div>
        <button
          onClick={clearPrediction}
          className="text-[#747468] hover:text-[#1A1A17] p-1.5 rounded-lg hover:bg-[#F5C518]/20 transition-all hover:scale-105 active:scale-95"
          title="Close prediction"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-3.5">
        {/* Loading State */}
        {predictLoading && (
          <div className="py-7 text-center space-y-2.5">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-[#F5C518]/30 border-t-[#F5C518]" />
            <p className="text-xs font-semibold text-[#1A1A17]">
              Gathering GIS features & running XGBoost for {predictCoords?.lat?.toFixed(3)}, {predictCoords?.lng?.toFixed(3)}…
            </p>
            <p className="text-[11px] text-[#747468]">
              Evaluating OSM industrial tags, Sentinel land cover, & 14-feature classification
            </p>
          </div>
        )}

        {/* Error State */}
        {predictError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1 shadow-[0_2px_6px_rgba(239,68,68,0.08)]">
            <div className="font-bold flex items-center gap-1.5 text-red-900">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Prediction Notice
            </div>
            <div>{predictError}</div>
          </div>
        )}

        {/* Success / Result State */}
        {!predictLoading && prediction && (
          <>
            {/* Top result card (3D raised surface) */}
            <div
              className="flex items-start justify-between gap-2.5 p-3 rounded-xl bg-white border border-[#F5C518]/30 transition-transform duration-200"
              style={{
                boxShadow: '0 2px 8px -1px rgba(0, 0, 0, 0.06), 0 1px 3px 0 rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
              }}
            >
              <div className="space-y-1">
                <div className="text-[13px] font-bold text-[#1A1A17] flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                    style={{
                      backgroundColor: getCategoryColor(prediction.predicted_class || prediction.display_class),
                    }}
                  />
                  <span>
                    {prediction.predicted_class || prediction.display_class}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-[#484841]">
                  Confidence: <span className="font-bold text-[#1A1A17]">{Math.round((prediction.confidence || 0) * 100)}%</span>
                  {prediction.has_hotspot === false && (
                    <span className="ml-1 text-[10px] text-[#747468]">(Contextual ML Simulation)</span>
                  )}
                </div>
                <div className="font-mono text-[10px] text-[#747468]">
                  Coords: {prediction.location?.latitude?.toFixed(4)}°N, {prediction.location?.longitude?.toFixed(4)}°E
                </div>
              </div>

              <div className="text-right shrink-0">
                <span
                  className="inline-block px-2.5 py-1 text-[10px] font-extrabold rounded-md uppercase tracking-wider text-white shadow-xs"
                  style={{
                    backgroundColor: getRiskColor(prediction.risk_level?.toLowerCase() === 'low' ? 'Low' : prediction.risk_level),
                  }}
                >
                  {prediction.risk_level || 'LOW'}
                </span>
                <div className="font-mono text-xs font-bold text-[#1A1A17] mt-1.5">
                  Risk: {prediction.risk_score != null ? Math.round(prediction.risk_score) : '—'}/100
                </div>
              </div>
            </div>

            {/* Industrial & Copernicus Multi-Source Context */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6A6A60] px-0.5">
                Multi-Source Satellite & GIS Context
              </div>
              <div
                className="p-3 rounded-xl bg-white/90 border border-[#E5E5DF] space-y-2 text-[11px]"
                style={{
                  boxShadow: '0 2px 6px -1px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[#484841] font-medium flex items-center gap-1.5">
                    <span>🏭</span> Industrial Context:
                  </span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide ${
                      prediction.is_industrial
                        ? 'bg-amber-100 text-amber-900 border border-amber-300/80'
                        : 'bg-slate-100 text-[#747468]'
                    }`}
                  >
                    {prediction.is_industrial ? 'Industrial Zone' : 'Non-Industrial'}
                  </span>
                </div>
                {prediction.is_industrial && prediction.nearest_industrial_distance_m != null && (
                  <div className="text-[10px] text-[#6A6A60] pl-5">
                    Nearest infrastructure: <span className="font-mono font-bold text-[#1A1A17]">{Math.round(prediction.nearest_industrial_distance_m)} m</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1.5 border-t border-[#E5E5DF]">
                  <span className="text-[#484841] font-medium flex items-center gap-1.5">
                    <span>🛰️</span> Land Cover:
                  </span>
                  <span className="font-bold text-[#1A1A17] bg-[#FEF9E7] px-2 py-0.5 rounded text-[10px] border border-[#F5C518]/30">
                    {prediction.land_cover_type
                      ? prediction.land_cover_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                      : (prediction.feature_values?.land_cover || 'Regional Land Cover')}
                    {prediction.ndvi_value != null && ` (NDVI: ${Number(prediction.ndvi_value).toFixed(2)})`}
                  </span>
                </div>
              </div>
            </div>

            {/* Context & Proximity Tags (3D raised mini-cards) */}
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6A6A60] px-0.5 mb-1.5">
                Model Features & Proximities
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div
                  className="p-2 rounded-lg bg-white/95 border border-[#E5E5DF] flex justify-between items-center"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
                >
                  <span className="text-[#747468] font-medium">Industrial:</span>
                  <span className="font-mono font-bold text-[#1A1A17]">{prediction.feature_values?.industrial_proximity_km?.toFixed(1) ?? '—'} km</span>
                </div>
                <div
                  className="p-2 rounded-lg bg-white/95 border border-[#E5E5DF] flex justify-between items-center"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
                >
                  <span className="text-[#747468] font-medium">Refinery:</span>
                  <span className="font-mono font-bold text-[#1A1A17]">{prediction.feature_values?.refinery_proximity_km?.toFixed(1) ?? '—'} km</span>
                </div>
                <div
                  className="p-2 rounded-lg bg-white/95 border border-[#E5E5DF] flex justify-between items-center"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
                >
                  <span className="text-[#747468] font-medium">Forest:</span>
                  <span className="font-mono font-bold text-[#1A1A17]">{prediction.feature_values?.forest_proximity_km?.toFixed(1) ?? '—'} km</span>
                </div>
                <div
                  className="p-2 rounded-lg bg-white/95 border border-[#E5E5DF] flex justify-between items-center"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
                >
                  <span className="text-[#747468] font-medium">Cropland:</span>
                  <span className="font-mono font-bold text-[#1A1A17]">{prediction.feature_values?.cropland_proximity_km?.toFixed(1) ?? '—'} km</span>
                </div>
                <div
                  className="p-2 rounded-lg bg-white/95 border border-[#E5E5DF] flex justify-between items-center"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
                >
                  <span className="text-[#747468] font-medium">Pop. 5km:</span>
                  <span className="font-mono font-bold text-[#1A1A17]">{prediction.feature_values?.population_5km?.toLocaleString() ?? '—'}</span>
                </div>
                <div
                  className="p-2 rounded-lg bg-white/95 border border-[#E5E5DF] flex justify-between items-center"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
                >
                  <span className="text-[#747468] font-medium">Class:</span>
                  <span className="font-bold text-amber-700 truncate max-w-[85px]">{prediction.feature_values?.land_cover ?? '—'}</span>
                </div>
              </div>
            </div>

            {/* AI Explanation (Gemini) - Warm Raised Card */}
            <div
              className="p-3 rounded-xl bg-gradient-to-br from-white via-[#FEFDF7] to-[#FEF9E7] border border-[#F5C518]/35 text-[11px] text-[#484841] leading-relaxed"
              style={{
                boxShadow: '0 2px 8px -1px rgba(245, 197, 24, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
              }}
            >
              <div className="flex items-center gap-1.5 font-bold text-[#1A1A17] mb-1">
                <span className="w-2 h-2 rounded-full bg-[#F5C518] shadow-[0_0_6px_rgba(245,197,24,0.6)]"></span>
                <span>AI Operational Analysis</span>
              </div>
              <div className="text-[11px] text-[#33332D]">
                {prediction.explanation || prediction.message || "Contextual assessment completed using satellite observations and geospatial models."}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
