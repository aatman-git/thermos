export function SkeletonCard({ height = '140px', className = '' }) {
  return (
    <div
      className={`skeleton border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] p-4 ${className}`}
      style={{ minHeight: height }}
    >
      <div className="h-4 bg-black/5 rounded w-1/3 mb-3" />
      <div className="h-3 bg-black/5 rounded w-2/3 mb-2" />
      <div className="h-3 bg-black/5 rounded w-1/2" />
    </div>
  );
}

export function SkeletonChart({ height = '220px', className = '' }) {
  return (
    <div
      className={`skeleton border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] p-4 flex flex-col justify-between ${className}`}
      style={{ height }}
    >
      <div className="flex justify-between items-center">
        <div className="h-4 bg-black/5 rounded w-1/4" />
        <div className="h-3 bg-black/5 rounded w-16" />
      </div>
      <div className="space-y-2 my-auto">
        <div className="h-2 bg-black/5 rounded w-full" />
        <div className="h-2 bg-black/5 rounded w-5/6" />
        <div className="h-2 bg-black/5 rounded w-4/6" />
      </div>
      <div className="h-3 bg-black/5 rounded w-1/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, className = '' }) {
  return (
    <div className={`skeleton border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] p-4 space-y-3 ${className}`}>
      <div className="h-4 bg-black/5 rounded w-1/4 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex justify-between items-center py-2 border-b border-black/5">
          <div className="h-3 bg-black/5 rounded w-1/4" />
          <div className="h-3 bg-black/5 rounded w-1/6" />
          <div className="h-3 bg-black/5 rounded w-1/6" />
          <div className="h-3 bg-black/5 rounded w-1/12" />
        </div>
      ))}
    </div>
  );
}
