import { useState } from 'react';

const SERVICES = [
  { name: 'NASA FIRMS VIIRS NRT Ingestion', type: 'Data Ingestion', status: 'Operational', latency: '42ms', uptime: '99.98%', lastSync: '12s ago' },
  { name: 'Copernicus Sentinel-2 API Hub', type: 'Optical Corroboration', status: 'Operational', latency: '88ms', uptime: '99.95%', lastSync: '45s ago' },
  { name: 'OSM Overpass Industrial Vector Sync', type: 'GIS Infrastructure', status: 'Operational', latency: '115ms', uptime: '99.99%', lastSync: '2m ago' },
  { name: 'XGBoost Thermal Classifier (v3.2)', type: 'ML Inference', status: 'Operational', latency: '14ms', uptime: '100%', lastSync: 'Instant' },
  { name: 'Spatial Clustering Engine (DBSCAN)', type: 'Vector Processing', status: 'Operational', latency: '28ms', uptime: '99.97%', lastSync: 'Instant' },
  { name: 'Meteorological Wind Vector Feed (ECMWF)', type: 'Weather Model', status: 'Operational', latency: '64ms', uptime: '99.91%', lastSync: '5m ago' },
];

export default function SystemHealth() {
  const [syncing, setSyncing] = useState(false);
  const [lastManualSync, setLastManualSync] = useState(null);

  const handleManualSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastManualSync(new Date().toLocaleTimeString('en-IN'));
    }, 1500);
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-scale-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
            System Operations & Pipeline Telemetry
          </h1>
          <p className="mt-1 text-scale-base text-[var(--color-text-secondary)]">
            Real-time health monitoring of satellite feeds, GIS pipelines, and ML inference microservices
          </p>
        </div>

        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 text-scale-sm font-semibold bg-[var(--color-accent)] text-[var(--color-text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 shadow-xs self-start sm:self-auto"
        >
          <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {syncing ? 'Syncing Feeds…' : 'Trigger Full Resync'}
        </button>
      </div>

      {/* Aggregate Health Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-xl)] p-5 shadow-[0_1px_2px_rgba(17,24,39,0.02)]">
          <span className="mb-1 block text-scale-xs text-[var(--color-text-tertiary)]">Global Pipeline Uptime</span>
          <div className="flex items-baseline gap-2">
            <span className="font-data text-scale-xl font-bold text-emerald-700 tabular-nums">99.98%</span>
            <span className="text-scale-xs text-emerald-600 font-semibold">Nominal</span>
          </div>
        </div>

        <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-xl)] p-5 shadow-[0_1px_2px_rgba(17,24,39,0.02)]">
          <span className="mb-1 block text-scale-xs text-[var(--color-text-tertiary)]">Avg Inference Latency</span>
          <div className="flex items-baseline gap-2">
            <span className="font-data text-scale-xl font-bold text-[var(--color-text-primary)] tabular-nums">14.2 ms</span>
            <span className="text-scale-xs text-[var(--color-text-secondary)] font-data tabular-nums">P99: 22ms</span>
          </div>
        </div>

        <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-xl)] p-5 shadow-[0_1px_2px_rgba(17,24,39,0.02)]">
          <span className="mb-1 block text-scale-xs text-[var(--color-text-tertiary)]">Satellite Hotspots Ingested (24h)</span>
          <div className="flex items-baseline gap-2">
            <span className="font-data text-scale-xl font-bold text-[var(--color-text-primary)] tabular-nums">2,840</span>
            <span className="text-scale-xs text-emerald-700 font-semibold font-data tabular-nums">+12% vs avg</span>
          </div>
        </div>

        <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-xl)] p-5 shadow-[0_1px_2px_rgba(17,24,39,0.02)]">
          <span className="mb-1 block text-scale-xs text-[var(--color-text-tertiary)]">Active Cluster Nodes</span>
          <div className="flex items-baseline gap-2">
            <span className="font-data text-scale-xl font-bold text-[var(--color-text-primary)] tabular-nums">6 / 6</span>
            <span className="text-scale-xs text-emerald-700 font-semibold">All Healthy</span>
          </div>
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 shadow-[0_1px_2px_rgba(17,24,39,0.02)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-scale-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Microservice Fleet Status
          </h2>
          {lastManualSync && (
            <span className="text-scale-xs text-emerald-700 font-data tabular-nums">Manual sync completed at {lastManualSync}</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] text-scale-xs text-[var(--color-text-tertiary)] uppercase tracking-wider">
                <th className="pb-3 pr-4 font-semibold">Microservice Name</th>
                <th className="pb-3 pr-4 font-semibold">Subsystem</th>
                <th className="pb-3 pr-4 font-semibold">Status</th>
                <th className="pb-3 pr-4 font-semibold">Avg Latency</th>
                <th className="pb-3 pr-4 font-semibold">Uptime (30d)</th>
                <th className="pb-3 font-semibold">Last Sync Heartbeat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)] text-scale-sm">
              {SERVICES.map((s, i) => (
                <tr key={i} className="hover:bg-[var(--color-surface)] transition-colors">
                  <td className="py-3.5 pr-4 font-semibold text-[var(--color-text-primary)]">{s.name}</td>
                  <td className="py-3.5 pr-4 text-[var(--color-text-secondary)]">{s.type}</td>
                  <td className="py-3.5 pr-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-scale-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 font-data text-[var(--color-text-secondary)] tabular-nums">{s.latency}</td>
                  <td className="py-3.5 pr-4 font-data font-semibold text-[var(--color-text-primary)] tabular-nums">{s.uptime}</td>
                  <td className="py-3.5 font-data text-[var(--color-text-tertiary)]">{s.lastSync}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model & Architecture Specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 shadow-[0_1px_2px_rgba(17,24,39,0.02)]">
          <h2 className="mb-3 text-scale-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            AI Classification Stack
          </h2>
          <div className="space-y-3 text-scale-sm text-[var(--color-text-secondary)]">
            <div className="p-4 bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <span className="font-semibold text-[var(--color-text-primary)] block mb-1">Primary Classifier:</span>
              Gradient Boosted Decision Tree (XGBoost) trained on 140,000 historical NASA FIRMS points cross-validated with Indian ISRO/Bhuvan wildfire logs.
            </div>
            <div className="p-4 bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <span className="font-semibold text-[var(--color-text-primary)] block mb-1">Optical Verification:</span>
              Vision Transformer (ViT-Small) evaluating Sentinel-2 Top-of-Atmosphere (TOA) reflectance for plume validation.
            </div>
          </div>
        </div>

        <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 shadow-[0_1px_2px_rgba(17,24,39,0.02)]">
          <h2 className="mb-3 text-scale-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Data Source Licensing & Attribution
          </h2>
          <div className="space-y-3 text-scale-sm text-[var(--color-text-secondary)]">
            <div className="p-4 bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <span className="font-semibold text-[var(--color-text-primary)] block mb-1">NASA LANCE / FIRMS:</span>
              Near Real-Time (NRT) VIIRS 375m Active Fire products (VNP14IMGTDL_NRT and VJ114IMGTDL_NRT). Open Data.
            </div>
            <div className="p-4 bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <span className="font-semibold text-[var(--color-text-primary)] block mb-1">OpenStreetMap Contributors:</span>
              Industrial landuse, refinery polygons, and steel manufacturing infrastructure bounds (ODbL).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

