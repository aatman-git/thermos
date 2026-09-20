import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { CATEGORY_COLORS } from '../data/mockData';
import {
  getCategoryColor, getRiskColor, getCategoryShort,
  buildReasonString, formatDuration,
} from '../utils/formatters';

const CATEGORIES = Object.keys(CATEGORY_COLORS);
const RISK_TIERS = ['Critical', 'High', 'Moderate', 'Low'];

export default function PriorityQueue() {
  const getFilteredEvents = useStore((s) => s.getFilteredEvents);
  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);
  const resetFilters = useStore((s) => s.resetFilters);
  const selectEvent = useStore((s) => s.selectEvent);
  const selectedEventId = useStore((s) => s.selectedEventId);

  const [confidenceLocal, setConfidenceLocal] = useState(filters.confidenceMin);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const events = getFilteredEvents();

  const grouped = useMemo(() => {
    const sorted = [...events].sort((a, b) => b.properties.risk_score - a.properties.risk_score);
    return {
      Critical: sorted.filter((e) => e.properties.risk_tier === 'Critical'),
      High: sorted.filter((e) => e.properties.risk_tier === 'High'),
      Moderate: sorted.filter((e) => e.properties.risk_tier === 'Moderate'),
      Low: sorted.filter((e) => e.properties.risk_tier === 'Low'),
    };
  }, [events]);

  const toggleCategory = (cat) => {
    const current = filters.categories;
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    setFilter('categories', next);
  };

  const toggleRisk = (tier) => {
    const current = filters.riskTiers;
    const next = current.includes(tier)
      ? current.filter((t) => t !== tier)
      : [...current, tier];
    setFilter('riskTiers', next);
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-[var(--color-surface)] overflow-hidden">
      {/* Mobile filter toggle bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-[var(--color-border)] shrink-0">
        <button
          onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
          className="flex items-center gap-2 px-3 py-1.5 text-scale-sm font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          {mobileFilterOpen ? 'Hide Filters' : 'Filter Events'}
          {(filters.categories.length > 0 || filters.riskTiers.length > 0 || filters.confidenceMin > 0) && (
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
          )}
        </button>
        <span className="font-data text-scale-xs text-[var(--color-text-secondary)]">
          <strong className="text-[var(--color-text-primary)]">{events.length}</strong> events logged
        </span>
      </div>

      {/* Filter sidebar */}
      <aside
        className={`
          w-full md:w-[280px] shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-white p-6 flex flex-col gap-6
          ${mobileFilterOpen ? 'block max-h-[60vh] border-b md:border-b-0' : 'hidden md:flex'}
        `}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-scale-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Triage Filters
          </h2>
          <button
            onClick={resetFilters}
            className="text-scale-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Reset All
          </button>
        </div>

        {/* Confidence threshold */}
        <div>
          <label className="mb-2 block text-scale-sm text-[var(--color-text-secondary)]">
            Min Confidence: <span className="font-data font-bold text-[var(--color-text-primary)] tabular-nums">{confidenceLocal}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={confidenceLocal}
            onChange={(e) => setConfidenceLocal(Number(e.target.value))}
            onMouseUp={() => setFilter('confidenceMin', confidenceLocal)}
            onTouchEnd={() => setFilter('confidenceMin', confidenceLocal)}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-border)] accent-[var(--color-accent)]"
          />
        </div>

        {/* Date range */}
        <div>
          <h3 className="mb-2 text-scale-sm font-medium text-[var(--color-text-secondary)]">Time Range</h3>
          <div className="flex flex-wrap gap-2">
            {['24H', '7D', '30D'].map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setFilter('dateRange', range)}
                className={`rounded-[var(--radius-md)] px-3 py-1.5 text-scale-xs font-semibold transition-colors ${
                  filters.dateRange === range
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs'
                    : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Classification checkboxes */}
        <div>
          <h3 className="mb-2.5 text-scale-sm font-medium text-[var(--color-text-secondary)]">Classification</h3>
          <div className="space-y-2">
            {CATEGORIES.map((cat) => (
              <label key={cat} className="group flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={filters.categories.length === 0 || filters.categories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  className="sr-only"
                />
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    filters.categories.length === 0 || filters.categories.includes(cat)
                      ? 'border-transparent'
                      : 'border-[var(--color-border)]'
                  }`}
                  style={{
                    backgroundColor:
                      filters.categories.length === 0 || filters.categories.includes(cat)
                        ? getCategoryColor(cat)
                        : 'transparent',
                  }}
                >
                  {(filters.categories.length === 0 || filters.categories.includes(cat)) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span className="text-scale-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-text-primary)]">
                  {getCategoryShort(cat)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Risk tier checkboxes */}
        <div>
          <h3 className="mb-2.5 text-scale-sm font-medium text-[var(--color-text-secondary)]">Risk Tier</h3>
          <div className="space-y-2">
            {RISK_TIERS.map((tier) => (
              <label key={tier} className="group flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={filters.riskTiers.length === 0 || filters.riskTiers.includes(tier)}
                  onChange={() => toggleRisk(tier)}
                  className="sr-only"
                />
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    filters.riskTiers.length === 0 || filters.riskTiers.includes(tier)
                      ? 'border-transparent'
                      : 'border-[var(--color-border)]'
                  }`}
                  style={{
                    backgroundColor:
                      filters.riskTiers.length === 0 || filters.riskTiers.includes(tier)
                        ? getRiskColor(tier)
                        : 'transparent',
                  }}
                >
                  {(filters.riskTiers.length === 0 || filters.riskTiers.includes(tier)) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span className="text-scale-sm text-[var(--color-text-primary)]">{tier}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Result count */}
        <div className="mt-auto border-t border-[var(--color-border-subtle)] pt-4">
          <span className="text-scale-xs text-[var(--color-text-tertiary)]">
            Showing <span className="font-data font-bold text-[var(--color-text-primary)] tabular-nums">{events.length}</span> active incidents
          </span>
        </div>
      </aside>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {events.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6 max-w-5xl">
            {RISK_TIERS.map((tier) => {
              const tierEvents = grouped[tier];
              if (!tierEvents || tierEvents.length === 0) return null;
              return (
                <section key={tier} className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: getRiskColor(tier) }}
                    />
                    <h2 className="text-scale-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      {tier} Risk Level
                    </h2>
                    <span className="font-data text-scale-xs px-2 py-0.5 rounded-full bg-white border border-[var(--color-border)] text-[var(--color-text-tertiary)] tabular-nums">
                      {tierEvents.length}
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {tierEvents.map((event) => (
                      <EventCard
                        key={event.properties.id}
                        event={event}
                        isSelected={selectedEventId === event.properties.id}
                        onSelect={() => selectEvent(event.properties.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event, isSelected, onSelect }) {
  const p = event.properties;

  return (
    <button
      onClick={onSelect}
      className={`
        w-full rounded-[var(--radius-lg)] border p-4 text-left transition-all
        ${isSelected
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] shadow-xs'
          : 'border-[var(--color-border)] bg-white hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]'
        }
      `}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="font-data text-scale-base font-bold text-[var(--color-text-primary)]">{p.id}</span>
          <span
            className="rounded-full px-2 py-0.5 text-scale-xs font-semibold text-white"
            style={{ backgroundColor: getCategoryColor(p.category) }}
          >
            {getCategoryShort(p.category)}
          </span>
        </div>
        <span className="font-data text-scale-xs text-[var(--color-text-secondary)]">{p.region}</span>
      </div>

      <div className="mb-2 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface)] border border-[var(--color-border-subtle)]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${p.risk_score}%`, backgroundColor: getRiskColor(p.risk_tier) }}
          />
        </div>
        <span className="font-data text-scale-sm font-bold tabular-nums" style={{ color: getRiskColor(p.risk_tier) }}>
          {p.risk_score}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-scale-xs text-[var(--color-text-secondary)]">
        <span className="line-clamp-1">
          {buildReasonString(p.evidence)}
        </span>
        <span className="shrink-0 font-data font-semibold text-[var(--color-text-primary)] tabular-nums">
          {p.persistence_hours > 48
            ? `${formatDuration(p.persistence_hours)} persistent`
            : `${p.frp} MW FRP`
          }
        </span>
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-64 text-center p-6">
      <div>
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <p className="text-scale-base text-[var(--color-text-primary)] font-semibold mb-1">No events match filters</p>
        <p className="text-scale-sm text-[var(--color-text-tertiary)]">Try adjusting your confidence threshold or classification filters.</p>
      </div>
    </div>
  );
}

