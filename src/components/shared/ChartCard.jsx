export default function ChartCard({ title, subtitle, badge, children, span, noData = false }) {
  return (
    <div
      className={`
        bg-white border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 shadow-[0_1px_2px_rgba(17,24,39,0.02)] flex flex-col justify-between
        ${span === 'full' ? 'xl:col-span-2' : ''}
      `}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-scale-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-scale-xs text-[var(--color-text-tertiary)]">
              {subtitle}
            </p>
          )}
        </div>
        {badge && (
          <span className="font-data text-scale-xs px-2 py-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)]">
            {badge}
          </span>
        )}
      </div>

      <div className="flex-1 w-full min-h-0">
        {noData ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-[var(--color-text-tertiary)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-60">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <span className="text-scale-sm font-medium">No Data Available</span>
            <span className="text-scale-xs mt-0.5 opacity-80">Telemetry values currently not recorded for this window.</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

