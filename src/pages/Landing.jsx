import { useState, useEffect, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

const GlobeCanvas = lazy(() => import('../components/landing/GlobeCanvas'));

// Categories and evidence factors aligned 100% with Main Website (mockData.js & Investigator.jsx)
const CLASSIFICATION_DATA = {
  'Industrial Persistent Source': {
    confidence: '94%',
    riskTier: 'Moderate',
    riskScore: 68,
    color: '#D97706',
    evidence: [
      { name: 'Industrial Proximity', val: 'Within 200m of refinery complex', pct: 96, hot: true },
      { name: 'Temporal Persistence', val: 'Active for 72+ hours continuously', pct: 92, hot: true },
      { name: 'Land Cover Match', val: 'Confirmed industrial land use (OSM)', pct: 90, cool: true },
      { name: 'FRP Signature', val: '64.2 MW · steady-state thermal profile', pct: 78 },
    ],
  },
  'Industrial Accidental Fire': {
    confidence: '91%',
    riskTier: 'Critical',
    riskScore: 87,
    color: '#DC2626',
    evidence: [
      { name: 'Thermal Severity Spike', val: 'Escalating +34% over 6h pass', pct: 95, hot: true },
      { name: 'Petrochem Proximity', val: 'Adjacent to bulk fuel storage tank farm', pct: 93, hot: true },
      { name: 'Population Exposure', val: 'Dense settlement within 1.8 km', pct: 86, hot: true },
      { name: 'Land Cover Match', val: 'Built-up / heavy industrial complex', pct: 88, cool: true },
    ],
  },
  'Wildfire': {
    confidence: '89%',
    riskTier: 'Critical',
    riskScore: 84,
    color: '#991B1B',
    evidence: [
      { name: 'Vegetation Density', val: 'Dense forest canopy / scrubland', pct: 92, hot: true },
      { name: 'Spread Velocity', val: '1.4 km/h along wind vector', pct: 85, hot: true },
      { name: 'Industrial Buffer', val: '> 8.5 km to nearest industrial plant', pct: 91, cool: true },
      { name: 'FRP Signature', val: '142.0 MW · rapid spatial expansion', pct: 94 },
    ],
  },
  'Agricultural Burning': {
    confidence: '92%',
    riskTier: 'Low',
    riskScore: 28,
    color: '#6B7C3A',
    evidence: [
      { name: 'Land Cover Match', val: 'Agricultural cropland (Copernicus)', pct: 95, hot: true },
      { name: 'Seasonal Window', val: 'Matches post-harvest residue window', pct: 90, hot: true },
      { name: 'Short Persistence', val: '< 6 hours temporal lifetime', pct: 88, cool: true },
      { name: 'FRP Pattern', val: '18.5 MW · localized field boundary', pct: 72 },
    ],
  },
  'Gas Flare': {
    confidence: '96%',
    riskTier: 'Low',
    riskScore: 24,
    color: '#7C3AED',
    evidence: [
      { name: 'Flare Stack Registry', val: 'Exact match with OSM flare stack coordinate', pct: 98, hot: true },
      { name: 'Diurnal Recurrence', val: 'Continuous day/night thermal load', pct: 95, hot: true },
      { name: 'Point Source Extent', val: 'Sub-pixel localized (<30m)', pct: 94, cool: true },
      { name: 'FRP Stability', val: '14.8 MW · stable baseline variance', pct: 84 },
    ],
  },
  'Unknown': {
    confidence: '64%',
    riskTier: 'Moderate',
    riskScore: 52,
    color: '#9CA3AF',
    evidence: [
      { name: 'Cadastral Verification', val: 'No registered facility on record', pct: 78, hot: true },
      { name: 'Temporal Pattern', val: 'Newly detected anomaly, <6 hours', pct: 74, hot: true },
      { name: 'Multi-Sensor Check', val: 'Awaiting next Sentinel-2 MSI pass', pct: 68, cool: true },
      { name: 'FRP Profile', val: '32.1 MW · fluctuating signature', pct: 65 },
    ],
  },
};

// Response views matching Main Website's data model & operational workflow
const RESPONSE_VIEWS = [
  {
    id: 'analyst',
    tab: 'ANALYST VIEW',
    title: 'Incident Dossier — Classified & Verified',
    desc: 'Evidence panel: registered refinery buffer 200m, temporal persistence 72h, FRP 88.4 MW. Counter-evidence and multi-spectral curves disclosed for operator audit.',
    metric: '91%',
    metricLabel: 'CLASSIFICATION CONFIDENCE',
    step: 1, // VERIFIED
  },
  {
    id: 'command',
    tab: 'COMMAND TRIAGE',
    title: 'Priority Dispatch — State Emergency Ops',
    desc: 'Assets at risk: 82K population buffer, petrochemical tank farm, power corridor. Recommended access via NH-55. Agency: State Disaster Management Authority.',
    metric: '87',
    metricLabel: 'RISK SCORE · CRITICAL',
    step: 2, // DISPATCHED
  },
  {
    id: 'responder',
    tab: 'FIELD RESPONSE',
    title: 'En Route — Safe Approach via NH-55',
    desc: 'Responder terminal: downwind plume safety buffer 1.8 km, nearest industrial water intake at plant Gate 2, ECMWF wind vector NE at 14 km/h.',
    metric: '12 min',
    metricLabel: 'ESTIMATED TIME TO SCENE',
    step: 3, // EN ROUTE
  },
];

const TIMELINE_STATES = ['DETECTED', 'VERIFIED', 'DISPATCHED', 'EN ROUTE', 'CONTAINED'];

// Dynamic color scale for progress bars based on % value / severity
// Calibrated with site's existing accent + critical/red colors
// 0–20%:   light yellow / pale gold (#E2B340 - contrast-compliant against white & light track)
// 21–40%:  yellow / gold (#F5C518 - site default accent)
// 41–60%:  amber / orange (#D97706 - medium tier)
// 61–80%:  deep orange (#EA580C - high tier)
// 81–100%: red-orange (#DC2626 - matches "Critical (87/100)" red badge)
const getProgressBarColor = (pct) => {
  const val = Number(pct);
  if (val > 80) return '#DC2626'; // 81–100%: red-orange (matches existing "Critical" red badge)
  if (val > 60) return '#EA580C'; // 61–80%: deep orange
  if (val > 40) return '#D97706'; // 41–60%: amber / orange
  if (val > 20) return '#F5C518'; // 21–40%: yellow / gold (current default color)
  return '#E2B340';               // 0–20%: light yellow / pale gold (legible on track & white)
};

export default function Landing() {
  const reducedMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [selectedClass, setSelectedClass] = useState('Industrial Accidental Fire');
  const [activeResponseIdx, setActiveResponseIdx] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const currentClassData = CLASSIFICATION_DATA[selectedClass] || CLASSIFICATION_DATA['Industrial Accidental Fire'];
  const currentResponse = RESPONSE_VIEWS[activeResponseIdx];

  const revealProps = (delay = 0) => ({
    initial: reducedMotion ? false : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-40px' },
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
  });

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)] font-sans overflow-x-hidden antialiased selection:bg-[var(--color-accent)] selection:text-[var(--color-text-primary)]">
      {/* Top Navigation Bar — aligned with Main Website's TopBar styling */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-sm border-b border-[var(--color-border)] py-3 shadow-xs'
            : 'bg-white/80 backdrop-blur-xs border-b border-[var(--color-border-subtle)] py-4'
        }`}
      >
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 md:px-8 flex items-center justify-between">
          {/* Brand mark with Main Website's yellow/amber box and bolt icon */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-accent)] flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <span className="text-scale-base font-bold tracking-tight text-[var(--color-text-primary)]">
              THERMOS
            </span>
          </Link>

          {/* Section Jump Links */}
          <div className="hidden lg:flex items-center gap-8 text-scale-sm text-[var(--color-text-secondary)] font-medium">
            <a href="#detect" className="hover:text-[var(--color-text-primary)] transition-colors">
              Detection
            </a>
            <a href="#classify" className="hover:text-[var(--color-text-primary)] transition-colors">
              Classification
            </a>
            <a href="#context" className="hover:text-[var(--color-text-primary)] transition-colors">
              Geospatial Context
            </a>
            <a href="#risk" className="hover:text-[var(--color-text-primary)] transition-colors">
              Risk Engine
            </a>
            <a href="#platform" className="hover:text-[var(--color-text-primary)] transition-colors">
              Platform Modules
            </a>
          </div>

          {/* Right Actions: Live Feed status + CTA */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 pl-3 border-l border-[var(--color-border)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-status-live)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-status-live)]"></span>
              </span>
              <span className="text-scale-xs text-[var(--color-text-secondary)] font-data hidden sm:inline tabular-nums">
                LIVE · NASA FIRMS v2
              </span>
            </div>

            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-scale-sm font-semibold text-[var(--color-text-primary)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] shadow-xs hover:shadow-sm active:scale-95 transition-all group"
            >
              <span>Open Dashboard</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION — White Theme with 3D Standalone Hotspot Globe */}
      <header className="relative min-h-[92vh] flex flex-col justify-center pt-28 pb-16 px-4 sm:px-6 md:px-8 overflow-hidden bg-gradient-to-b from-white via-[var(--color-surface)] to-[var(--color-surface-muted)]">
        {/* Technical Box Grid (Blueprint Graph Paper Pattern from Image 2) */}
        <div
          className="absolute inset-0 pointer-events-none select-none opacity-45"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(200, 208, 220, 0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(200, 208, 220, 0.45) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Plus / Crosshair Precision Grid Markers (Image 3) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40 select-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="cross-grid" width="96" height="96" patternUnits="userSpaceOnUse">
              <path d="M 48 43 L 48 53 M 43 48 L 53 48" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cross-grid)" />
        </svg>

        {/* Vertical Scanning Beam Moving Across X-Axis (Image 1) */}
        <div
          className="absolute top-0 bottom-0 w-[1.5px] pointer-events-none select-none z-10 opacity-70"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(59, 130, 246, 0.4) 20%, rgba(245, 197, 24, 0.8) 50%, rgba(59, 130, 246, 0.4) 80%, transparent)',
            boxShadow: '0 0 10px rgba(245, 197, 24, 0.45)',
            animation: reducedMotion ? 'none' : 'scan 11s linear infinite',
          }}
        />

        {/* Hero Content: 2-Column Responsive Layout */}
        <div className="relative z-10 max-w-[1240px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column (Hero Content) */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* Operational Tag */}
            <div className="inline-flex items-center gap-2 self-start rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent-subtle)] px-3 py-1 mb-6 text-scale-xs font-semibold text-[var(--color-text-primary)] shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
              <span className="font-data uppercase tracking-wider">NASA FIRMS v2 · REAL-TIME SATELLITE DISASTER INTELLIGENCE</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-[clamp(40px,5.8vw,76px)] font-extrabold tracking-[-0.035em] leading-[1.04] text-[var(--color-text-primary)]">
              From signal
              <br />
              <span className="text-[var(--color-text-tertiary)]">to decisive action.</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-[clamp(16px,1.5vw,19px)] text-[var(--color-text-secondary)] leading-[1.6] max-w-[560px]">
              <strong className="text-[var(--color-text-primary)] font-semibold">Thermal Event Recognition and Monitoring Operational System (THERMOS)</strong>
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-[var(--radius-md)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] font-semibold text-scale-sm shadow-xs hover:shadow-sm active:scale-95 transition-all group"
              >
                <span>Launch Command Centre</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>

              <Link
                to="/priority"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white hover:bg-[var(--color-surface)] text-[var(--color-text-primary)] text-scale-sm font-semibold shadow-xs transition-colors"
              >
                View Priority Queue
              </Link>
            </div>

            {/* Real Operational Telemetry Strip */}
            <div className="mt-12 pt-6 border-t border-[var(--color-border)] grid grid-cols-2 sm:grid-cols-3 gap-6">
              <div>
                <div className="font-mono text-scale-xs font-semibold tracking-wider uppercase text-[var(--color-text-tertiary)]">
                  INGESTION FEED
                </div>
                <div className="font-mono text-scale-sm font-bold text-[var(--color-text-primary)] mt-1 font-data">
                  NASA FIRMS v2 (NRT)
                </div>
              </div>
              <div>
                <div className="font-mono text-scale-xs font-semibold tracking-wider uppercase text-[var(--color-text-tertiary)]">
                  GROUND RESOLUTION
                </div>
                <div className="font-mono text-scale-sm font-bold text-[var(--color-text-primary)] mt-1 font-data">
                  VIIRS · 375 m I-Band
                </div>
              </div>
              <div>
                <div className="font-mono text-scale-xs font-semibold tracking-wider uppercase text-[var(--color-text-tertiary)]">
                  SENSORS ACTIVE
                </div>
                <div className="font-mono text-scale-sm font-bold text-[var(--color-text-primary)] mt-1 font-data flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-status-live)]" />
                  <span>5 Multi-Orbit Satellites</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Vector Globe (Legible on White Theme with Standalone Glowing Markers) */}
          <div className="lg:col-span-5 relative w-full aspect-square max-w-[420px] sm:max-w-[480px] lg:max-w-[540px] mx-auto mt-4 lg:mt-0 flex items-center justify-center">
            {/* Soft Ambient Warm Glow matching yellow/amber accent */}
            <div
              className="absolute inset-0 -z-10 pointer-events-none flex items-center justify-center"
              aria-hidden="true"
            >
              <div
                className="w-[85%] h-[85%] rounded-full blur-[70px] opacity-60"
                style={{
                  background: 'radial-gradient(circle, rgba(245, 197, 24, 0.20) 0%, rgba(220, 226, 235, 0.40) 50%, transparent 75%)',
                }}
              />
            </div>

            {/* Masked Globe Canvas */}
            <div
              className="w-full h-full relative aspect-square flex items-center justify-center"
              style={{
                maskImage: 'radial-gradient(circle at 50% 50%, black 65%, rgba(0, 0, 0, 0.6) 82%, transparent 92%)',
                WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 65%, rgba(0, 0, 0, 0.6) 82%, transparent 92%)',
              }}
            >
              <Suspense
                fallback={
                  <div className="w-full h-full flex flex-col items-center justify-center text-[var(--color-text-tertiary)] font-mono text-scale-xs">
                    <span className="w-3 h-3 rounded-full bg-[var(--color-accent)] pulse-ring mb-3" />
                    Initializing 3D Telemetry…
                  </div>
                }
              >
                <GlobeCanvas />
              </Suspense>
            </div>

            {/* Pinned Telemetry Callout Card — White Theme matching Main Website cards */}
            <div className="absolute right-1 sm:right-2 bottom-2 sm:bottom-4 z-20 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-md border border-[var(--color-border)] rounded-[var(--radius-xl)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)] min-w-[240px] sm:min-w-[270px]">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-risk-critical)] animate-pulse" />
                    <span className="font-mono text-scale-xs font-bold tracking-wider uppercase text-[var(--color-risk-critical)]">
                      CRITICAL ANOMALY
                    </span>
                  </div>
                  <span className="font-mono text-scale-xs font-bold text-[var(--color-text-primary)] bg-[var(--color-accent-subtle)] px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-accent)]/40 font-data">
                    Score 87
                  </span>
                </div>
                <div className="text-scale-sm font-bold text-[var(--color-text-primary)] mt-2">
                  THR-2400 · Industrial Accidental Fire
                </div>
                <div className="font-mono text-scale-xs text-[var(--color-text-secondary)] mt-2 font-data flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2">
                  <span>FRP 88.4 MW</span>
                  <span className="text-[var(--color-text-primary)] font-semibold">22.47°N · 70.06°E</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 01 / DETECT SECTION */}
      <section id="detect" className="py-24 px-4 sm:px-6 md:px-8 border-t border-[var(--color-border)] bg-white">
        <div className="max-w-[1240px] mx-auto">
          <motion.div className="max-w-[680px] mb-16" {...revealProps(0)}>
            <div className="flex items-center gap-2 font-mono text-scale-xs font-semibold tracking-wider uppercase text-[var(--color-text-tertiary)] mb-3">
              <span className="text-[var(--color-text-primary)] font-bold">01 /</span> MULTI-SENSOR INGESTION
            </div>
            <h2 className="text-scale-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
              Continuous orbital surveillance.
              <br />
              Zero detection gaps.
            </h2>
            <p className="mt-4 text-scale-base text-[var(--color-text-secondary)] leading-relaxed">
              NASA and Copernicus satellites sweep India on every orbit. THERMOS streams directly from the NASA FIRMS v2 API — converting raw infrared pixels into persistent, tracked thermal events in under 60 seconds.
            </p>
          </motion.div>

          {/* Stat Cards Row */}
          <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6" {...revealProps(0.1)}>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-8 flex flex-col justify-between shadow-xs">
              <div>
                <span className="text-scale-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] font-mono">
                  Ground Spatial Precision
                </span>
                <div className="font-data text-[clamp(44px,4.5vw,56px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mt-3">
                  375<span className="text-scale-lg text-[var(--color-text-tertiary)] font-medium ml-1">m</span>
                </div>
              </div>
              <p className="mt-6 text-scale-sm text-[var(--color-text-secondary)] leading-normal">
                <strong className="text-[var(--color-text-primary)] font-semibold">VIIRS 375m I-Band</strong> sensor resolution isolates thermal emissions down to specific refinery units and individual facility stacks.
              </p>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-8 flex flex-col justify-between shadow-xs">
              <div>
                <span className="text-scale-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] font-mono">
                  Multi-Orbit Constellation
                </span>
                <div className="font-data text-[clamp(44px,4.5vw,56px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mt-3">
                  5<span className="text-scale-lg text-[var(--color-text-tertiary)] font-medium ml-1">Sensors</span>
                </div>
              </div>
              <p className="mt-6 text-scale-sm text-[var(--color-text-secondary)] leading-normal">
                Combined feeds from <strong className="text-[var(--color-text-primary)] font-semibold">SNPP VIIRS, NOAA-20, Aqua/Terra MODIS</strong>, and calibrated Sentinel-2 MSI optical validation.
              </p>
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xl)] p-8 flex flex-col justify-between shadow-xs">
              <div>
                <span className="text-scale-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] font-mono">
                  Pipeline Ingestion Latency
                </span>
                <div className="font-data text-[clamp(44px,4.5vw,56px)] font-bold tracking-tight text-emerald-700 leading-none mt-3">
                  &lt;60<span className="text-scale-lg text-[var(--color-text-tertiary)] font-medium ml-1">sec</span>
                </div>
              </div>
              <p className="mt-6 text-scale-sm text-[var(--color-text-secondary)] leading-normal">
                Near-real-time streaming from <strong className="text-[var(--color-text-primary)] font-semibold">NASA FIRMS v2</strong> ensures alerts reach command consoles before ground reports are filed.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 02 / CLASSIFY SECTION — Matching Main Website Taxonomy & Categories */}
      <section id="classify" className="py-24 px-4 sm:px-6 md:px-8 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-[1240px] mx-auto">
          <motion.div className="max-w-[680px] mb-16" {...revealProps(0)}>
            <div className="flex items-center gap-2 font-mono text-scale-xs font-semibold tracking-wider uppercase text-[var(--color-text-tertiary)] mb-3">
              <span className="text-[var(--color-text-primary)] font-bold">02 /</span> ML CLASSIFICATION ENGINE
            </div>
            <h2 className="text-scale-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
              A heat pixel is not an answer.
            </h2>
            <p className="mt-4 text-scale-base text-[var(--color-text-secondary)] leading-relaxed">
              A thermal signature could be an ordinary gas flare, an escalating petrochemical fire, agricultural burning, or a fast-moving wildfire. THERMOS fuses multi-spectral FRP, OpenStreetMap industrial vectors, and historical persistence to classify each event with auditable evidence.
            </p>
          </motion.div>

          {/* Classification Board */}
          <motion.div className="border border-[var(--color-border)] rounded-[var(--radius-xl)] bg-white p-6 sm:p-12 shadow-xs" {...revealProps(0.1)}>
            {/* Interactive Taxonomy Category Chips */}
            <div className="flex flex-wrap gap-2 justify-center mb-10">
              {Object.keys(CLASSIFICATION_DATA).map((cat) => {
                const isSelected = selectedClass === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedClass(cat)}
                    className={`text-scale-xs font-semibold px-4 py-2 rounded-full border transition-all ${
                      isSelected
                        ? 'border-[var(--color-accent)] text-[var(--color-text-primary)] bg-[var(--color-accent-subtle)] shadow-xs'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Model Confidence & Risk Tier Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] mb-8">
              <div className="flex items-center gap-3">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: currentClassData.color }}
                />
                <div>
                  <div className="text-scale-base font-bold text-[var(--color-text-primary)]">
                    {selectedClass}
                  </div>
                  <div className="text-scale-xs text-[var(--color-text-secondary)] font-mono">
                    Model: XGBoost Classifier v3.2 · Inference 14.2ms
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-scale-xs text-[var(--color-text-tertiary)] uppercase font-mono">Confidence</div>
                  <div className="font-data text-scale-lg font-bold text-[var(--color-text-primary)] tabular-nums">
                    {currentClassData.confidence}
                  </div>
                </div>
                <div className="w-px h-8 bg-[var(--color-border)]" />
                <div>
                  <div className="text-scale-xs text-[var(--color-text-tertiary)] uppercase font-mono">Risk Tier</div>
                  <span
                    className="inline-block px-2.5 py-0.5 text-scale-xs font-bold rounded text-white font-data"
                    style={{ backgroundColor: currentClassData.color }}
                  >
                    {currentClassData.riskTier} ({currentClassData.riskScore}/100)
                  </span>
                </div>
              </div>
            </div>

            {/* Evidence Breakdown Bars */}
            <div className="w-full max-w-[720px] mx-auto flex flex-col gap-4">
              <div className="text-scale-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] font-mono mb-1">
                Auditable Feature Evidence
              </div>
              {currentClassData.evidence.map((ev, idx) => (
                <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border-subtle)]">
                  <div className="flex justify-between text-scale-sm">
                    <span className="text-[var(--color-text-primary)] font-medium">{ev.name}</span>
                    <span className="font-mono text-scale-xs text-[var(--color-text-secondary)] font-data">{ev.val}</span>
                  </div>
                  <div className="h-2 w-full bg-[var(--color-border)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: getProgressBarColor(ev.pct) }}
                      initial={{ width: 0 }}
                      animate={{ width: `${ev.pct}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: idx * 0.06 }}
                    />
                  </div>
                </div>
              ))}
              <div className="mt-3 text-center font-mono text-scale-xs text-[var(--color-text-tertiary)]">
                Algorithmic Decision Auditing · Verified against Copernicus Global Land Cover & OSM Registries
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 03 / CONTEXT SECTION — Real GIS Spatial Buffer Intelligence */}
      <section id="context" className="py-24 px-4 sm:px-6 md:px-8 border-t border-[var(--color-border)] bg-white">
        <div className="max-w-[1240px] mx-auto">
          <motion.div className="max-w-[680px] mb-16" {...revealProps(0)}>
            <div className="flex items-center gap-2 font-mono text-scale-xs font-semibold tracking-wider uppercase text-[var(--color-text-tertiary)] mb-3">
              <span className="text-[var(--color-text-primary)] font-bold">03 /</span> GEOSPATIAL CONTEXT
            </div>
            <h2 className="text-scale-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
              Know what surrounds the anomaly.
            </h2>
            <p className="mt-4 text-scale-base text-[var(--color-text-secondary)] leading-relaxed">
              NASA delivers the latitude and longitude. THERMOS computes the operational radius — identifying downwind population settlements, critical petrochemical infrastructure, pipeline rights-of-way, and accessible emergency response corridors.
            </p>
          </motion.div>

          {/* Context Display Card */}
          <motion.div className="border border-[var(--color-border)] rounded-[var(--radius-xl)] overflow-hidden bg-white shadow-xs" {...revealProps(0.1)}>
            {/* GIS Simulation Board */}
            <div className="relative h-[340px] bg-[var(--color-surface)] border-b border-[var(--color-border)] overflow-hidden">
              {/* Grid Lines */}
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />

              {/* Node 1: Target Incident */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <span className="w-4 h-4 rounded-full bg-[var(--color-risk-critical)] shadow-[0_0_12px_rgba(220,38,38,0.5)] pulse-ring" />
                <span className="font-mono text-scale-xs font-bold text-[var(--color-risk-critical)] mt-2 bg-white px-2.5 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] shadow-xs">
                  INCIDENT · THR-2400 (JAMNAGAR)
                </span>
              </div>

              {/* Node 2: Industrial Facility Buffer */}
              <div className="absolute left-[24%] top-[28%] flex flex-col items-center">
                <span className="w-3 h-3 rounded-full bg-blue-600 shadow-xs" />
                <span className="font-mono text-[11px] font-semibold text-blue-900 mt-1.5 bg-blue-50 px-2 py-0.5 rounded-[var(--radius-sm)] border border-blue-200">
                  REFINERY COMPLEX · 200m
                </span>
              </div>

              {/* Node 3: Settlement Population Exposure */}
              <div className="absolute left-[76%] top-[32%] flex flex-col items-center">
                <span className="w-3 h-3 rounded-full bg-[var(--color-text-secondary)] shadow-xs" />
                <span className="font-mono text-[11px] font-semibold text-[var(--color-text-primary)] mt-1.5 bg-white px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                  RESIDENTIAL SETTLEMENT · 1.8 KM
                </span>
              </div>

              {/* Node 4: Transit Route */}
              <div className="absolute left-[70%] top-[74%] flex flex-col items-center">
                <span className="w-3 h-3 rounded-full bg-emerald-600 shadow-xs" />
                <span className="font-mono text-[11px] font-semibold text-emerald-900 mt-1.5 bg-emerald-50 px-2 py-0.5 rounded-[var(--radius-sm)] border border-emerald-200">
                  ACCESS CORRIDOR · NH-55 (OPEN)
                </span>
              </div>
            </div>

            {/* Context Telemetry Metrics Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border)] bg-white">
              <div className="p-6">
                <div className="font-mono text-scale-xs tracking-wider uppercase text-[var(--color-text-tertiary)] mb-1">
                  POPULATION EXPOSURE
                </div>
                <div className="text-scale-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  <span className="font-data">82,000</span>
                  <span className="text-scale-xs font-mono px-2 py-0.5 rounded-[var(--radius-sm)] bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                    HIGH EXPOSURE
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="font-mono text-scale-xs tracking-wider uppercase text-[var(--color-text-tertiary)] mb-1">
                  CRITICAL INFRASTRUCTURE
                </div>
                <div className="text-scale-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  <span>Power corridor</span>
                  <span className="text-scale-xs font-mono px-2 py-0.5 rounded-[var(--radius-sm)] bg-red-50 text-red-800 border border-red-200 font-semibold">
                    AT RISK
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="font-mono text-scale-xs tracking-wider uppercase text-[var(--color-text-tertiary)] mb-1">
                  ACCESS CORRIDORS
                </div>
                <div className="text-scale-base font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                  <span>NH-55 Highway</span>
                  <span className="text-scale-xs font-mono px-2 py-0.5 rounded-[var(--radius-sm)] bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                    CLEAR
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="font-mono text-scale-xs tracking-wider uppercase text-[var(--color-text-tertiary)] mb-1">
                  LAND COVER VALIDATION
                </div>
                <div className="text-scale-base font-bold text-[var(--color-text-primary)]">
                  Industrial Zone (Copernicus)
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 04 / ASSESS (5-FACTOR RISK ENGINE) SECTION */}
      <section id="risk" className="py-24 px-4 sm:px-6 md:px-8 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-[1240px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Score Callout */}
          <motion.div className="lg:col-span-5" {...revealProps(0)}>
            <div className="flex items-center gap-2 font-mono text-scale-xs font-semibold tracking-wider uppercase text-[var(--color-text-tertiary)] mb-3">
              <span className="text-[var(--color-text-primary)] font-bold">04 /</span> OPERATIONAL RISK ENGINE
            </div>
            <div className="font-data text-[clamp(90px,13vw,160px)] font-extrabold tracking-[-0.05em] leading-none text-[var(--color-risk-critical)]">
              87
            </div>
            <div className="font-mono text-scale-sm tracking-wider uppercase text-[var(--color-text-secondary)] font-bold mt-2">
              RISK SCORE / 100 · CRITICAL TIER
            </div>
            <p className="mt-4 text-scale-sm text-[var(--color-text-secondary)] leading-relaxed">
              Risk score reflects operational resource allocation priority — ensuring critical emergencies are immediately escalated above minor stationary sources.
            </p>
          </motion.div>

          {/* Right: 5-Factor Weights */}
          <motion.div className="lg:col-span-7 flex flex-col gap-4 bg-white border border-[var(--color-border)] rounded-[var(--radius-xl)] p-6 sm:p-8 shadow-xs" {...revealProps(0.1)}>
            <h3 className="text-scale-base font-bold text-[var(--color-text-primary)]">
              Standard 5-Factor Risk Weighting Model
            </h3>
            {[
              { label: 'Thermal Severity (FRP & Brightness Temp)', val: 30, pct: '30%' },
              { label: 'Temporal Persistence (Hours & Passes)', val: 25, pct: '25%' },
              { label: 'Population Exposure (Settlement Proximity)', val: 20, pct: '20%' },
              { label: 'Critical Infrastructure Proximity (Refinery/Grid)', val: 15, pct: '15%' },
              { label: 'Intensity Growth Trend (Escalation Rate)', val: 10, pct: '10%' },
            ].map((factor, idx) => {
              const barFillPct = Math.round(factor.val * 3.33);
              return (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-scale-sm">
                    <span className="text-[var(--color-text-primary)] font-medium">{factor.label}</span>
                    <span className="font-mono text-scale-xs text-[var(--color-text-secondary)] font-data font-bold">{factor.pct}</span>
                  </div>
                  <div className="h-2 bg-[var(--color-surface-muted)] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: getProgressBarColor(barFillPct) }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${barFillPct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: idx * 0.08, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="mt-2 pt-3 border-t border-[var(--color-border-subtle)] text-scale-xs text-[var(--color-text-tertiary)] italic">
              All alerts in this environment are simulated based on live satellite ingestion schema.
            </div>
          </motion.div>
        </div>
      </section>

      {/* 05 / RESPOND SECTION — Single Source of Truth Lifecycle */}
      <section id="respond" className="py-24 px-4 sm:px-6 md:px-8 border-t border-[var(--color-border)] bg-white">
        <div className="max-w-[1240px] mx-auto">
          <motion.div className="max-w-[680px] mb-16" {...revealProps(0)}>
            <div className="flex items-center gap-2 font-mono text-scale-xs font-semibold tracking-wider uppercase text-[var(--color-text-tertiary)] mb-3">
              <span className="text-[var(--color-text-primary)] font-bold">05 /</span> UNIFIED INCIDENT LIFECYCLE
            </div>
            <h2 className="text-scale-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
              One event. One shared source of truth.
            </h2>
            <p className="mt-4 text-scale-base text-[var(--color-text-secondary)] leading-relaxed">
              From analyst console to emergency commander to field responders on the ground — every stakeholder views the exact same synchronized incident telemetry.
            </p>
          </motion.div>

          {/* Response Lifecycle Card */}
          <motion.div className="border border-[var(--color-border)] rounded-[var(--radius-xl)] bg-white overflow-hidden shadow-xs" {...revealProps(0.1)}>
            {/* View Tabs */}
            <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              {RESPONSE_VIEWS.map((rv, idx) => (
                <button
                  key={rv.id}
                  onClick={() => setActiveResponseIdx(idx)}
                  className={`flex-1 py-4 px-3 font-mono text-scale-xs font-bold tracking-wider text-center border-b-2 transition-all ${
                    activeResponseIdx === idx
                      ? 'text-[var(--color-text-primary)] border-[var(--color-accent)] bg-white shadow-xs'
                      : 'text-[var(--color-text-tertiary)] border-transparent hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {rv.tab}
                </button>
              ))}
            </div>

            {/* View Content */}
            <div className="p-6 sm:p-12 flex flex-col sm:flex-row sm:items-center justify-between gap-8">
              <div className="max-w-[560px]">
                <div className="font-mono text-scale-xs font-bold text-[var(--color-text-tertiary)]">
                  INCIDENT · THR-2400 · JAMNAGAR INDUSTRIAL ZONE
                </div>
                <div className="text-scale-xl font-bold text-[var(--color-text-primary)] mt-1 tracking-tight">
                  {currentResponse.title}
                </div>
                <p className="mt-3 text-scale-base text-[var(--color-text-secondary)] leading-relaxed">
                  {currentResponse.desc}
                </p>
              </div>

              <div className="sm:text-right shrink-0">
                <div className="font-data text-[clamp(44px,5vw,56px)] font-bold text-[var(--color-text-primary)] leading-none">
                  {currentResponse.metric}
                </div>
                <div className="font-mono text-scale-xs font-bold tracking-wider text-[var(--color-text-tertiary)] uppercase mt-2">
                  {currentResponse.metricLabel}
                </div>
              </div>
            </div>

            {/* Lifecycle Stepper Timeline */}
            <div className="flex border-t border-[var(--color-border)] bg-[var(--color-surface)]">
              {TIMELINE_STATES.map((st, i) => {
                const isActive = i === currentResponse.step;
                const isDone = i < currentResponse.step;
                return (
                  <div
                    key={st}
                    className={`flex-1 py-3 text-center font-mono text-[11px] tracking-wider relative border-t-2 transition-colors ${
                      isActive
                        ? 'text-[var(--color-text-primary)] border-[var(--color-accent)] font-bold bg-white'
                        : isDone
                        ? 'text-emerald-700 border-emerald-600 font-semibold'
                        : 'text-[var(--color-text-muted)] border-transparent'
                    }`}
                  >
                    {st}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* PLATFORM MODULES SECTION — Representing All 6 Real Modules on Main Website */}
      <section id="platform" className="py-24 px-4 sm:px-6 md:px-8 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-[1240px] mx-auto">
          <motion.div className="max-w-[680px] mb-16" {...revealProps(0)}>
            <div className="flex items-center gap-2 font-mono text-scale-xs font-semibold tracking-wider uppercase text-[var(--color-text-tertiary)] mb-3">
              <span className="text-[var(--color-text-primary)] font-bold">CORE PLATFORM</span> MODULES
            </div>
            <h2 className="text-scale-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
              Six synchronized experiences.
              <br />
              One operational platform.
            </h2>
          </motion.div>

          {/* Module Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                num: '01',
                title: 'Live Command Map',
                path: '/dashboard',
                action: 'Explore Map',
                desc: 'Full-screen MapLibre GIS viewer with real-time hotspot clusters, satellite layer toggles, and instant priority event sidebar.',
              },
              {
                num: '02',
                title: 'Priority Triage Queue',
                path: '/priority',
                action: 'Open Queue',
                desc: 'Ranked queue sorted by operational risk tier (Critical, High, Moderate, Low), with confidence sliders and category filters.',
              },
              {
                num: '03',
                title: 'Threat Intelligence',
                path: '/intelligence',
                action: 'Inspect Intel',
                desc: 'Multi-satellite constellation telemetry (SNPP, NOAA-20, MODIS, Sentinel-2), industrial corridor correlation, and buffer analysis.',
              },
              {
                num: '04',
                title: 'AI Incident Investigator',
                path: '/investigator',
                action: 'Run Diagnostics',
                desc: 'Algorithmic decision tree auditing, multi-band spectral curves (VIIRS 3.74µm I-Band), and longitudinal persistence history.',
              },
              {
                num: '05',
                title: 'Analytics & Trends',
                path: '/analytics',
                action: 'View Charts',
                desc: '30-day thermal anomaly distributions, category breakdowns, persistent source tracking, and regional risk cluster rankings.',
              },
              {
                num: '06',
                title: 'System Telemetry',
                path: '/system',
                action: 'Check Health',
                desc: 'Real-time microservice fleet health, 99.98% pipeline uptime telemetry, feed ingestion latency, and manual resync controls.',
              },
            ].map((p, idx) => (
              <motion.div key={p.num} {...revealProps(idx * 0.06)}>
                <Link
                  to={p.path}
                  className="bg-white border border-[var(--color-border)] rounded-[var(--radius-xl)] p-7 flex flex-col justify-between hover:border-[var(--color-border-strong)] hover:shadow-md transition-all group h-full"
                >
                  <div>
                    <div className="font-mono text-scale-xs font-semibold text-[var(--color-text-tertiary)] tracking-wider">
                      {p.num}
                    </div>
                    <h3 className="text-scale-lg font-bold text-[var(--color-text-primary)] mt-3 tracking-tight">
                      {p.title}
                    </h3>
                    <p className="mt-3 text-scale-sm text-[var(--color-text-secondary)] leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-scale-xs font-semibold text-[var(--color-text-primary)] mt-6 group-hover:text-amber-600 transition-colors">
                    <span>{p.action}</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Ingestion & Stack Architecture Strip */}
          <motion.div className="mt-16 border border-[var(--color-border)] rounded-[var(--radius-xl)] p-8 bg-white shadow-xs text-center" {...revealProps(0.1)}>
            <div className="text-scale-xs font-mono font-semibold tracking-wider text-[var(--color-text-tertiary)] uppercase mb-4">
              INTEGRATED ARCHITECTURAL PIPELINE
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-scale-sm font-mono text-[var(--color-text-secondary)] font-semibold">
              <span className="text-[var(--color-text-primary)] font-bold">NASA FIRMS v2 (375m)</span>
              <span className="text-[var(--color-text-muted)]">→</span>
              <span>Copernicus Sentinel-2 MSI</span>
              <span className="text-[var(--color-text-muted)]">→</span>
              <span className="text-[var(--color-text-primary)] font-bold">OSM Vector Overpass</span>
              <span className="text-[var(--color-text-muted)]">→</span>
              <span>XGBoost Classifier v3.2</span>
              <span className="text-[var(--color-text-muted)]">→</span>
              <span className="text-[var(--color-text-primary)] font-bold">DBSCAN Clustering</span>
              <span className="text-[var(--color-text-muted)]">→</span>
              <span>GeoJSON Dispatch API</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-24 px-4 sm:px-6 md:px-8 border-t border-[var(--color-border)] bg-white text-center">
        <motion.div className="max-w-[760px] mx-auto" {...revealProps(0)}>
          <h2 className="text-scale-3xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
            Explore live thermal disaster intelligence.
          </h2>
          <p className="mt-4 text-scale-base text-[var(--color-text-secondary)] leading-relaxed">
            The platform is running with active mock and simulated feeds matching NASA FIRMS v2 VIIRS 375m satellite telemetry.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] font-semibold text-scale-sm shadow-xs hover:shadow-sm active:scale-95 transition-all group"
            >
              <span>Launch THERMOS Platform</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* FOOTER — Aligned with Main Website theme and legal attribution */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 md:px-8 py-16 grid grid-cols-1 md:grid-cols-5 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[var(--radius-md)] bg-[var(--color-accent)] flex items-center justify-center shadow-xs">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A1A17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <span className="font-bold text-scale-base tracking-tight text-[var(--color-text-primary)]">
                THERMOS
              </span>
            </div>
            <p className="text-scale-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed max-w-[340px]">
              Thermal Anomaly Detection, Classification & Response Platform. Built for SIH 2026 (Problem Statement SIH26162 / NTRO).
            </p>
            <div className="flex items-center gap-2 mt-5 font-mono text-scale-xs text-[var(--color-text-tertiary)]">
              <span className="w-2 h-2 rounded-full bg-[var(--color-status-live)]" />
              <span>OPERATIONAL PROTOTYPE · DEMO ENVIRONMENT</span>
            </div>
          </div>

          <div>
            <div className="font-mono text-scale-xs font-semibold tracking-wider text-[var(--color-text-tertiary)] uppercase mb-4">
              ANALYSIS
            </div>
            <div className="flex flex-col gap-2.5 text-scale-sm text-[var(--color-text-secondary)]">
              <Link to="/dashboard" className="hover:text-[var(--color-text-primary)] transition-colors">Command Map</Link>
              <Link to="/priority" className="hover:text-[var(--color-text-primary)] transition-colors">Priority Queue</Link>
              <Link to="/analytics" className="hover:text-[var(--color-text-primary)] transition-colors">Analytics Trends</Link>
            </div>
          </div>

          <div>
            <div className="font-mono text-scale-xs font-semibold tracking-wider text-[var(--color-text-tertiary)] uppercase mb-4">
              DIAGNOSTICS
            </div>
            <div className="flex flex-col gap-2.5 text-scale-sm text-[var(--color-text-secondary)]">
              <Link to="/intelligence" className="hover:text-[var(--color-text-primary)] transition-colors">Constellation Intel</Link>
              <Link to="/investigator" className="hover:text-[var(--color-text-primary)] transition-colors">AI Investigator</Link>
              <Link to="/system" className="hover:text-[var(--color-text-primary)] transition-colors">System Telemetry</Link>
            </div>
          </div>

          <div>
            <div className="font-mono text-scale-xs font-semibold tracking-wider text-[var(--color-text-tertiary)] uppercase mb-4">
              DATA SOURCES
            </div>
            <div className="flex flex-col gap-2.5 text-scale-sm text-[var(--color-text-secondary)]">
              <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-text-primary)] transition-colors">
                NASA FIRMS v2 ↗
              </a>
              <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-text-primary)] transition-colors">
                OpenStreetMap ↗
              </a>
              <a href="https://worldcover2021.esa.int/" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-text-primary)] transition-colors">
                ESA WorldCover ↗
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] py-6 px-4 sm:px-6 md:px-8 max-w-[1240px] mx-auto flex flex-wrap justify-between items-center gap-4 text-scale-xs text-[var(--color-text-tertiary)] font-mono">
          <div>
            © 2026 THERMOS — Operational thermal disaster intelligence. Smart India Hackathon 2026 (SIH26162).
          </div>
          <div>
            <span className="cursor-help" title="Thermal anomaly detection is not confirmed ground-truth fire. Risk score reflects operational prioritization, not fire-ignition probability.">
              Operational Disclaimer ℹ
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
