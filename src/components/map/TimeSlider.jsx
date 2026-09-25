import { useState, useRef, useCallback, useEffect } from 'react';
import { TIME_PRESETS, useStore } from '../../store/useStore';
import { clamp } from '../../utils/formatters';

const PRESETS = Object.entries(TIME_PRESETS).map(([label, value]) => ({ label, value }));

export default function TimeSlider() {
  const timeSliderValue = useStore((s) => s.timeSliderValue);
  const setTimeSliderValue = useStore((s) => s.setTimeSliderValue);
  const timeRange = useStore((s) => s.timeRange);
  const setTimeRange = useStore((s) => s.setTimeRange);

  const [range, setRange] = useState(timeSliderValue);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const trackRef = useRef(null);
  const animRef = useRef(null);
  const draggingRef = useRef(null);

  useEffect(() => {
    setRange(timeSliderValue);
  }, [timeSliderValue]);

  useEffect(() => {
    setTimeSliderValue(range);
  }, [range, setTimeSliderValue]);

  useEffect(() => {
    if (!playing) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;

      setRange((prev) => {
        const width = prev[1] - prev[0];
        const step = dt * 0.04 * speed;
        let newStart = prev[0] + step;
        let newEnd = prev[1] + step;

        if (newEnd > 1) {
          newStart = 0;
          newEnd = width;
        }

        if (newStart >= 1) {
          newStart = 0;
          newEnd = width;
        }

        return [newStart, newEnd];
      });

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [playing, speed]);

  const getPositionFromEvent = useCallback((e) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  }, []);

  const handlePointerDown = useCallback((handle) => (e) => {
    e.preventDefault();
    draggingRef.current = handle;

    const onMove = (ev) => {
      if (!draggingRef.current) return;
      const pos = getPositionFromEvent(ev);

      setRange((prev) => {
        if (draggingRef.current === 'start') {
          return [Math.min(pos, prev[1] - 0.01), prev[1]];
        }
        return [prev[0], Math.max(pos, prev[0] + 0.01)];
      });
    };

    const onUp = () => {
      draggingRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  }, [getPositionFromEvent]);

  const formatLabel = (val) => {
    const days = Math.round(val * 30);
    if (days === 0) return '30d ago';
    if (days >= 30) return 'Now';
    return `${30 - days}d ago`;
  };

  const handlePreset = (preset) => {
    setRange(preset.value);
    setPlaying(false);
    const presetName = preset.label;
    const currentRange = PRESETS.find((item) => item.label === presetName);
    if (currentRange) {
      setTimeRange(presetName);
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-[var(--color-border)] px-4 py-2.5 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-colors shrink-0"
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#1A1A17">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#1A1A17">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        <button
          onClick={() => setSpeed((s) => (s === 1 ? 2 : 1))}
          className="font-data text-scale-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors shrink-0 w-6"
        >
          {speed}x
        </button>

        <span className="font-data text-scale-xs text-[var(--color-text-tertiary)] shrink-0 w-14 text-right">
          {formatLabel(range[0])}
        </span>

        <div
          ref={trackRef}
          className="flex-1 h-6 flex items-center relative cursor-pointer"
        >
          <div className="absolute inset-x-0 h-1 bg-[var(--color-border)] rounded-full" />
          <div
            className="absolute h-1 bg-[var(--color-accent)] rounded-full"
            style={{
              left: `${range[0] * 100}%`,
              width: `${(range[1] - range[0]) * 100}%`,
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-[var(--color-accent)] rounded-full cursor-grab active:cursor-grabbing hover:scale-125 transition-transform z-10"
            style={{ left: `${range[0] * 100}%` }}
            onMouseDown={handlePointerDown('start')}
            onTouchStart={handlePointerDown('start')}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--color-accent)] border-2 border-[var(--color-accent-hover)] rounded-full cursor-grab active:cursor-grabbing hover:scale-125 transition-transform z-10"
            style={{ left: `${range[1] * 100}%` }}
            onMouseDown={handlePointerDown('end')}
            onTouchStart={handlePointerDown('end')}
          />
        </div>

        <span className="font-data text-scale-xs text-[var(--color-text-tertiary)] shrink-0 w-8">
          {formatLabel(range[1])}
        </span>

        <div className="flex gap-0.5 bg-[var(--color-surface)] p-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] shrink-0">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              className={`px-2 py-0.5 text-scale-xs font-medium rounded-[var(--radius-sm)] transition-colors ${
                timeRange === preset.label
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
