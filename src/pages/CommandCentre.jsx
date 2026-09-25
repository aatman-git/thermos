import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { RISK_COLORS } from '../data/mockData';
import {
  getCategoryColor, getRiskColor, getCategoryShort, buildReasonString,
  formatDuration,
} from '../utils/formatters';
import MapView from '../components/map/MapView';

export default function CommandCentre() {
  const timeRange = useStore((s) => s.timeRange);
  const setTimeRange = useStore((s) => s.setTimeRange);
  const selectEvent = useStore((s) => s.selectEvent);
  const selectedEventId = useStore((s) => s.selectedEventId);
  const getFilteredEvents = useStore((s) => s.getFilteredEvents);
  const dataSource = useStore((s) => s.dataSource);
  const loading = useStore((s) => s.loading);

  console.info('[CommandCentre] Current dataSource state:', dataSource, '| Loading:', loading);

  const [mobileView, setMobileView] = useState('map'); // 'map' | 'priority'

  // Single source of truth: BOTH map and sidebar consume the exact same events
  const events = getFilteredEvents();
  console.info('[CommandCentre] Filtered events count:', events.length, '| Sample event 0:', events[0]?.properties?.id);

  const topEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => (b.properties?.risk_score || 0) - (a.properties?.risk_score || 0))
      .slice(0, 10);
  }, [events]);

  const stats = useMemo(() => {
    return {
      total: events.length,
      critical: events.filter((e) => (e.properties?.risk_tier || '').toLowerCase() === 'critical').length,
      high: events.filter((e) => (e.properties?.risk_tier || '').toLowerCase() === 'high').length,
      persistent: events.filter((e) => (e.properties?.persistence_hours || 0) >= 48).length,
    };
  }, [events]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Mobile view toggle switcher */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-white border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-1 bg-[var(--color-surface)] p-1 rounded-[var(--radius-md)] border border-[var(--color-border)]">
          <button
            onClick={() => setMobileView('map')}
            className={`px-3 py-1 text-scale-xs font-semibold rounded-[var(--radius-sm)] transition-colors ${
              mobileView === 'map'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs'
                : 'text-[var(--color-text-secondary)]'
            }`}
          >
            Live Map
          </button>
          <button
            onClick={() => setMobileView('priority')}
            className={`px-3 py-1 text-scale-xs font-semibold rounded-[var(--radius-sm)] transition-colors ${
              mobileView === 'priority'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs'
                : 'text-[var(--color-text-secondary)]'
            }`}
          >
            Priority Incidents ({topEvents.length})
          </button>
        </div>
        <span className="font-data text-scale-xs text-[var(--color-text-secondary)] tabular-nums">
          {stats.total} Hotspots
        </span>
      </div>

      {/* Main content: map + priority sidebar */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Map area */}
        <div className={`flex-1 min-w-0 h-full relative ${mobileView === 'priority' ? 'hidden md:block' : 'block'}`}>
          <MapView />
        </div>

        {/* Right: Priority Events */}
        <div
          className={`
            w-full md:w-[320px] border-l border-[var(--color-border)] bg-white flex flex-col shrink-0 h-full
            ${mobileView === 'map' ? 'hidden md:flex' : 'flex'}
          `}
        >
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <div>
              <h2 className="text-scale-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Priority Events
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dataSource === 'live' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  {dataSource === 'live' ? 'NASA FIRMS Live' : 'Demo Feed'}
                </span>
              </div>
            </div>
            <span className="font-data text-scale-xs text-[var(--color-text-tertiary)] tabular-nums">
              Top {topEvents.length} of {stats.total}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border-subtle)]">
            {topEvents.length === 0 && (
              <div className="p-6 text-center text-scale-xs text-[var(--color-text-tertiary)]">
                {loading ? 'Fetching thermal events…' : 'No hotspots match current filters.'}
              </div>
            )}
            {topEvents.map((event) => {
              const p = event.properties || {};
              const isSelected = selectedEventId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => selectEvent(p.id)}
                  className={`
                    w-full text-left p-4 transition-colors hover:bg-[var(--color-surface)]
                    ${isSelected ? 'bg-[var(--color-accent-subtle)]' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-data text-scale-sm font-bold text-[var(--color-text-primary)]">
                      {p.id}
                    </span>
                    <span
                      className="px-2 py-0.5 text-scale-xs font-bold rounded text-white font-data tabular-nums"
                      style={{ backgroundColor: getRiskColor(p.risk_tier) }}
                    >
                      {p.risk_score}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: getCategoryColor(p.category) }}
                    />
                    <span className="text-scale-sm font-medium text-[var(--color-text-primary)] truncate">
                      {getCategoryShort(p.category)}
                    </span>
                    <span className="text-[var(--color-text-tertiary)]">·</span>
                    <span className="text-scale-xs text-[var(--color-text-secondary)] truncate">
                      {p.region}
                    </span>
                  </div>
                  <p className="text-scale-xs text-[var(--color-text-secondary)] line-clamp-1">
                    {buildReasonString(p.evidence)}
                    {p.persistence_hours > 48 && ` · ${formatDuration(p.persistence_hours)} persistent`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom strip: stats + time range */}
      <div className="min-h-[48px] py-2 border-t border-[var(--color-border)] bg-white flex flex-wrap items-center justify-between px-4 gap-3 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-4 sm:gap-6 flex-nowrap overflow-x-auto">
          <StatChip label="Total Hotspots" value={stats.total} />
          <StatChip label="Critical" value={stats.critical} color={RISK_COLORS.Critical} />
          <StatChip label="High" value={stats.high} color={RISK_COLORS.High} />
          <StatChip label="Persistent" value={stats.persistent} color="#D97706" />
        </div>

        <div className="flex items-center gap-1 bg-[var(--color-surface)] p-1 rounded-[var(--radius-md)] border border-[var(--color-border)] shrink-0 ml-auto">
          {['24H', '7D', '30D'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`
                px-2.5 py-1 text-scale-xs font-semibold rounded-[var(--radius-sm)] transition-colors
                ${timeRange === range
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }
              `}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-scale-xs text-[var(--color-text-tertiary)]">{label}:</span>
      <span
        className="font-data text-scale-sm font-bold tabular-nums"
        style={{ color: color || 'var(--color-text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}
