import { motion, useReducedMotion } from 'framer-motion';

export default function EvidenceCard({ evidence }) {
  const reduceMotion = useReducedMotion();
  const { factor, weight, note } = evidence;
  const pct = Math.round(weight * 100);

  return (
    <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-scale-sm font-semibold text-[var(--color-text-primary)]">{factor}</span>
        <span className="font-data text-scale-xs font-semibold text-[var(--color-text-secondary)] tabular-nums">{pct}%</span>
      </div>
      <p className="text-scale-xs text-[var(--color-text-secondary)] leading-relaxed mb-2.5">{note}</p>
      <div className="w-full h-1.5 bg-[var(--color-border-subtle)] rounded-full overflow-hidden">
        <motion.div
          initial={reduceMotion ? { width: `${pct}%` } : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="h-full bg-[var(--color-accent)] rounded-full"
        />
      </div>
    </div>
  );
}

