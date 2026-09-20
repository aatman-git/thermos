import { useState, useEffect, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

const GlobeCanvas = lazy(() => import('../components/landing/GlobeCanvas'));

const CLASSIFICATION_DATA = {
  'INDUSTRIAL FIRE': {
    confidence: '91%',
    evidence: [
      { name: 'Industrial proximity', val: '0.12 km · registered refinery', pct: 94, hot: true },
      { name: 'Thermal persistence', val: '48 / 60 passes', pct: 80, hot: true },
      { name: 'Land-cover match', val: 'Built-up / industrial', pct: 88, cool: true },
      { name: 'FRP signature', val: '88.4 MW · steady-state', pct: 72 },
    ],
  },
  'WILDFIRE': {
    confidence: '84%',
    evidence: [
      { name: 'Vegetation density', val: 'Dense canopy / scrubland', pct: 89, hot: true },
      { name: 'Spread velocity', val: '1.4 km/h downwind', pct: 82, hot: true },
      { name: 'Industrial distance', val: '> 8.5 km to nearest plant', pct: 91, cool: true },
      { name: 'FRP signature', val: '142.1 MW · rapidly expanding', pct: 95 },
    ],
  },
  'GAS FLARE': {
    confidence: '96%',
    evidence: [
      { name: 'Stack coordinate match', val: '0.02 km · registered flare stack', pct: 98, hot: true },
      { name: 'Diurnal recurrence', val: '100% night/day balance', pct: 94, hot: true },
      { name: 'Footprint size', val: 'Point source (<30m)', pct: 92, cool: true },
      { name: 'FRP stability', val: '18.2 MW · constant variance', pct: 86 },
    ],
  },
  'POWER PLANT': {
    confidence: '88%',
    evidence: [
      { name: 'Grid facility registry', val: 'Thermal power plant unit 4', pct: 92, hot: true },
      { name: 'Water body proximity', val: 'Cooling reservoir 0.3 km', pct: 85, hot: true },
      { name: 'Land-cover match', val: 'Heavy industrial zone', pct: 90, cool: true },
      { name: 'Base thermal load', val: '64.0 MW · continuous', pct: 78 },
    ],
  },
  'CROP BURNING': {
    confidence: '92%',
    evidence: [
      { name: 'Agricultural buffer', val: 'Paddy / crop residue zone', pct: 95, hot: true },
      { name: 'Seasonality index', val: 'Post-harvest peak window', pct: 91, hot: true },
      { name: 'Short persistence', val: '< 6 hours temporal lifetime', pct: 86, cool: true },
      { name: 'FRP cluster', val: '24.5 MW · diffused spread', pct: 70 },
    ],
  },
  'MINING': {
    confidence: '85%',
    evidence: [
      { name: 'Open-cast mine boundary', val: '0.4 km to pit edge', pct: 88, hot: true },
      { name: 'Heavy vehicle presence', val: 'Access road haulage corridor', pct: 79, hot: true },
      { name: 'Coal seam risk', val: 'Spontaneous combustion zone', pct: 84, cool: true },
      { name: 'FRP signature', val: '38.0 MW · localized smolder', pct: 75 },
    ],
  },
  'UNREGISTERED': {
    confidence: '79%',
    evidence: [
      { name: 'Cadastral anomaly', val: 'No formal industrial record', pct: 92, hot: true },
      { name: 'Persistence history', val: '32 recurring passes', pct: 84, hot: true },
      { name: 'Settlement buffer', val: '1.8 km to residential area', pct: 76, cool: true },
      { name: 'FRP signature', val: '52.3 MW · intermittent flare', pct: 80 },
    ],
  },
};

const RESPONSE_VIEWS = [
  {
    id: 'analyst',
    tab: 'ANALYST VIEW',
    title: 'Industrial Fire — Classified',
    desc: 'Evidence panel: facility proximity HIGH, persistence HIGH, FRP 42.8 MW. Counter-evidence disclosed for analyst review.',
    metric: '91%',
    metricLabel: 'CLASSIFICATION CONFIDENCE',
    step: 1, // VERIFIED
  },
  {
    id: 'command',
    tab: 'COMMAND VIEW',
    title: 'Dispatch NDRF Team 3/4',
    desc: 'Assets at risk: 82K population, power corridor, NH-55. Downwind corridor 2.1 km. Authority: Odisha Disaster Management.',
    metric: '87',
    metricLabel: 'RISK SCORE · CRITICAL',
    step: 2, // DISPATCHED
  },
  {
    id: 'responder',
    tab: 'FIELD RESPONSE',
    title: 'En Route — ETA 14 min',
    desc: 'Field terminal: safest approach via NH-55, water point at plant gate, wind NE 16 km/h. Acknowledge → Arrived → Contained.',
    metric: '14',
    metricLabel: 'MINUTES TO SCENE',
    step: 3, // EN ROUTE
  },
];

const TIMELINE_STATES = ['DETECTED', 'VERIFIED', 'DISPATCHED', 'EN ROUTE', 'CONTAINED'];

export default function Landing() {
  const reducedMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [selectedClass, setSelectedClass] = useState('INDUSTRIAL FIRE');
  const [activeResponseIdx, setActiveResponseIdx] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const currentClassData = CLASSIFICATION_DATA[selectedClass] || CLASSIFICATION_DATA['INDUSTRIAL FIRE'];
  const currentResponse = RESPONSE_VIEWS[activeResponseIdx];

  // Subtle scroll reveal props matching FireSense cubic-bezier ease
  const revealProps = (delay = 0) => ({
    initial: reducedMotion ? false : { opacity: 0, y: 32 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-40px' },
    transition: { duration: 0.75, delay, ease: [0.22, 0.61, 0.36, 1] },
  });

  return (
    <div className="min-h-screen bg-[#0a0c10] text-[#f5f6f7] selection:bg-[#ff5a1f] selection:text-white font-sans overflow-x-hidden antialiased">
      {/* Top Glassmorphic Navigation Bar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#0a0c10]/85 backdrop-blur-md border-b border-white/10 py-3.5'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-6 sm:px-8 flex items-center justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5a1f] shadow-[0_0_12px_#ff5a1f] shrink-0" />
            <span className="font-bold text-[18px] tracking-tight text-[#f5f6f7] group-hover:text-white transition-colors">
              THERMOS
            </span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-9 text-[14px] text-[#8b929e] font-medium">
            <a href="#detect" className="hover:text-[#f5f6f7] transition-colors">
              Intelligence
            </a>
            <a href="#classify" className="hover:text-[#f5f6f7] transition-colors">
              Classification
            </a>
            <a href="#respond" className="hover:text-[#f5f6f7] transition-colors">
              Response
            </a>
            <a href="#platform" className="hover:text-[#f5f6f7] transition-colors">
              Platform
            </a>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-[#8b929e] uppercase">
              <span className="w-2 h-2 rounded-full bg-[#ff5a1f] pulse-ring shrink-0" />
              <span className="hidden sm:inline">NRT · FIRMS LIVE FEED</span>
            </div>

            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-[13.5px] font-semibold text-white border border-white/15 bg-white/5 hover:border-white/35 hover:bg-white/10 active:scale-95 transition-all group"
            >
              <span>Launch Dashboard</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <header className="relative min-h-screen flex flex-col justify-center pt-28 pb-16 px-6 sm:px-8 overflow-hidden bg-[#0a0c10]">
        {/* Subtle Background Radial Atmosphere */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-radial from-[#ff5a1f]/10 via-[#7ec8f2]/5 to-transparent blur-3xl opacity-50" />

          {/* Vertical Scan Beam */}
          <div
            className="absolute top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#7ec8f2]/30 to-transparent"
            style={{ animation: reducedMotion ? 'none' : 'scan 11s linear infinite' }}
          />

          {/* Terrain Contours Vector */}
          <svg
            className="absolute inset-0 w-full h-full opacity-20"
            viewBox="0 0 1200 460"
            preserveAspectRatio="xMidYMid slice"
          >
            <path
              d="M-20,340 C160,300 300,360 460,330 C640,296 760,352 940,316 C1060,292 1150,320 1220,300"
              fill="none"
              stroke="#5a606c"
              strokeWidth="1"
              strokeOpacity="0.3"
            />
            <path
              d="M-20,380 C180,340 320,400 500,368 C680,336 800,390 980,352 C1090,330 1160,352 1220,336"
              fill="none"
              stroke="#ff5a1f"
              strokeWidth="1"
              strokeOpacity="0.35"
            />
            <path
              d="M-20,420 C200,384 340,440 540,404 C720,372 840,428 1020,392 C1120,372 1170,392 1220,380"
              fill="none"
              stroke="#5a606c"
              strokeWidth="1"
              strokeOpacity="0.25"
            />
          </svg>
        </div>

        {/* Hero Content: 2-Column Responsive Layout */}
        <div className="relative z-10 max-w-[1200px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column (Hero Text & Actions) */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* Eyebrow Kicker */}
            <div className="flex items-center gap-3 font-mono text-[11px] font-semibold tracking-[0.16em] uppercase text-[#8b929e] mb-6">
              <span className="text-[#ff5a1f]">THERMOS</span>
              <span className="w-8 h-[1px] bg-white/20" />
              <span>SATELLITE DISASTER INTELLIGENCE</span>
            </div>

            {/* Headline */}
            <h1 className="text-[clamp(44px,6.8vw,88px)] font-extrabold tracking-[-0.035em] leading-[0.98] text-[#f5f6f7]">
              From signal
              <br />
              <span className="text-[#5a606c]">to action.</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-[clamp(16px,1.6vw,19px)] text-[#8b929e] leading-[1.6] max-w-[520px]">
              THERMOS turns raw satellite heat detections into classified, prioritized incidents — so responders act on what matters, minutes faster.
            </p>

            {/* Actions */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-[#ff5a1f] hover:bg-[#ff6d38] text-white font-semibold text-[15px] shadow-[0_12px_40px_-8px_rgba(255,90,31,0.45)] hover:-translate-y-0.5 transition-all group"
              >
                <span>Explore THERMOS</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>

              <a
                href="#detect"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/15 text-[#8b929e] hover:text-white hover:border-white/35 text-[15px] font-semibold transition-all"
              >
                How it works
              </a>
            </div>

            {/* Live Meta Telemetry Strip */}
            <div className="mt-14 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-6">
              <div>
                <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-[#5a606c]">
                  LOCATION
                </div>
                <div className="font-mono text-[13px] font-semibold text-[#f5f6f7] mt-1 font-data">
                  30.7046° N · 76.7104° E
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-[#5a606c]">
                  SENSOR RESOLUTION
                </div>
                <div className="font-mono text-[13px] font-semibold text-[#f5f6f7] mt-1 font-data">
                  VIIRS · 375 m
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-[#5a606c]">
                  LAST PASS OBSERVED
                </div>
                <div className="font-mono text-[13px] font-semibold text-[#f5f6f7] mt-1 font-data">
                  14:32 UTC (Active)
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Vector Wireframe Globe matching user design */}
          <div className="lg:col-span-5 relative w-full aspect-square max-w-[400px] sm:max-w-[460px] lg:max-w-[520px] xl:max-w-[560px] mx-auto mt-6 lg:mt-0 flex items-center justify-center">
            {/* Soft Ambient Outer Glow (Brand Orange/Ice Blue Backlight) */}
            <div
              className="absolute inset-0 -z-10 pointer-events-none flex items-center justify-center"
              aria-hidden="true"
            >
              <div
                className="w-[85%] h-[85%] rounded-full blur-[80px] opacity-40"
                style={{
                  background: 'radial-gradient(circle, rgba(255, 90, 31, 0.16) 0%, rgba(126, 200, 242, 0.10) 40%, transparent 70%)',
                }}
              />
            </div>

            {/* Masked Globe Canvas (360° Radial Fade Completing at 84% — Zero Edge Cut-off) */}
            <div
              className="w-full h-full relative aspect-square flex items-center justify-center"
              style={{
                maskImage: 'radial-gradient(circle at 50% 50%, black 54%, rgba(0, 0, 0, 0.6) 70%, transparent 84%)',
                WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 54%, rgba(0, 0, 0, 0.6) 70%, transparent 84%)',
              }}
            >
              <Suspense
                fallback={
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#8b929e] font-mono text-xs">
                    <span className="w-3 h-3 rounded-full bg-[#ff5a1f] pulse-ring mb-3" />
                    Initializing 3D Telemetry...
                  </div>
                }
              >
                <GlobeCanvas />
              </Suspense>
            </div>

            {/* Pinned Telemetry Callout Card (Bottom-Right matching reference screenshot) */}
            <div className="absolute right-1 sm:right-3 bottom-3 sm:bottom-6 z-20 pointer-events-none">
              <div className="bg-[#0a0c10]/95 backdrop-blur-xl border border-white/12 rounded-2xl p-3.5 sm:p-4 shadow-[0_20px_48px_rgba(0,0,0,0.7)] min-w-[220px] sm:min-w-[255px]">
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#ff5a1f] animate-pulse" />
                    <span className="font-mono text-[9.5px] sm:text-[10px] font-bold tracking-[0.16em] uppercase text-[#ff5a1f]">
                      VIIRS · THERMAL ANOMALY
                    </span>
                  </div>
                  <span className="font-mono text-[9.5px] sm:text-[10px] font-bold text-[#ff5a1f] bg-[#ff5a1f]/12 px-2 py-0.5 rounded-full border border-[#ff5a1f]/25">
                    91%
                  </span>
                </div>
                <div className="text-[14px] sm:text-[15px] font-bold text-white mt-2">
                  Industrial Fire — 91%
                </div>
                <div className="font-mono text-[10.5px] sm:text-[11.5px] text-[#8b929e] mt-2 font-data flex items-center justify-between border-t border-white/5 pt-2">
                  <span>FRP 42.8 MW</span>
                  <span className="text-[#f5f6f7]">30.70°N · 76.71°E</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 01 / DETECT SECTION */}
      <section id="detect" className="py-28 px-6 sm:px-8 border-t border-white/10 bg-[#0e1117]">
        <div className="max-w-[1200px] mx-auto">
          <motion.div className="max-w-[640px] mb-16" {...revealProps(0)}>
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.16em] uppercase text-[#8b929e] mb-4">
              <span className="text-[#ff5a1f]">01 /</span> DETECT
            </div>
            <h2 className="text-[clamp(32px,4.5vw,56px)] font-bold tracking-[-0.03em] leading-[1.05] text-[#f5f6f7]">
              Every incident begins
              <br />
              as a signal.
            </h2>
            <p className="mt-5 text-[17px] text-[#8b929e] leading-[1.6]">
              NASA satellites scan India every passing orbit. THERMOS ingests each thermal detection the moment it hits the feed — raw heat becomes a tracked event.
            </p>
          </motion.div>

          {/* Stat Row */}
          <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden shadow-2xl" {...revealProps(0.1)}>
            <div className="bg-[#0a0c10] p-9 sm:p-11 flex flex-col justify-between">
              <div className="font-data text-[clamp(44px,5vw,64px)] font-bold tracking-tight text-[#ff5a1f] leading-none">
                375<span className="text-[18px] text-[#8b929e] font-medium ml-2">m</span>
              </div>
              <div className="mt-5 text-[14.5px] text-[#8b929e] leading-[1.5]">
                <strong className="text-white font-semibold">VIIRS</strong> resolution — every hotspot located down to a city block.
              </div>
            </div>

            <div className="bg-[#0a0c10] p-9 sm:p-11 flex flex-col justify-between">
              <div className="font-data text-[clamp(44px,5vw,64px)] font-bold tracking-tight text-[#7ec8f2] leading-none">
                24<span className="text-[18px] text-[#8b929e] font-medium ml-2">h</span>
              </div>
              <div className="mt-5 text-[14.5px] text-[#8b929e] leading-[1.5]">
                Continuous surveillance coverage from the <strong className="text-white font-semibold">FIRMS</strong> feed, refreshed with every satellite pass.
              </div>
            </div>

            <div className="bg-[#0a0c10] p-9 sm:p-11 flex flex-col justify-between">
              <div className="font-data text-[clamp(44px,5vw,64px)] font-bold tracking-tight text-[#f5f6f7] leading-none">
                60<span className="text-[18px] text-[#8b929e] font-medium ml-2">d</span>
              </div>
              <div className="mt-5 text-[14.5px] text-[#8b929e] leading-[1.5]">
                Day persistence baseline per cell to distinguish stationary industrial flares from transient emergencies.
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Panoramic Editorial Media: Earth at Night (NASA VIIRS DNB) */}
      <motion.div className="relative overflow-hidden border-t border-b border-white/10 bg-[#0e1117] group select-none" {...revealProps(0.05)}>
        <img
          src="/media/earth_at_night.jpg"
          alt="Earth at night from orbit: city lights tracing coastlines and river valleys across continents, captured by the VIIRS sensor"
          className="w-full h-[clamp(280px,46vh,540px)] object-cover filter saturate-85 group-hover:scale-[1.03] transition-transform duration-1000"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute left-6 sm:left-8 bottom-6 font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.14em] text-[#f5f6f7]/90 bg-[#0a0c10]/80 backdrop-blur-md px-4 py-2 rounded-lg border border-white/15 shadow-2xl">
          EARTH AT NIGHT · VIIRS DNB · NASA EARTH OBSERVATORY · PUBLIC DOMAIN
        </div>
      </motion.div>

      {/* 02 / CLASSIFY SECTION */}
      <section id="classify" className="py-28 px-6 sm:px-8 border-t border-white/10 bg-[#0a0c10]">
        <div className="max-w-[1200px] mx-auto">
          <motion.div className="max-w-[640px] mb-16" {...revealProps(0)}>
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.16em] uppercase text-[#8b929e] mb-4">
              <span className="text-[#ff5a1f]">02 /</span> CLASSIFY
            </div>
            <h2 className="text-[clamp(32px,4.5vw,56px)] font-bold tracking-[-0.03em] leading-[1.05] text-[#f5f6f7]">
              A signal isn't an answer.
            </h2>
            <p className="mt-5 text-[17px] text-[#8b929e] leading-[1.6]">
              A thermal pixel could be a refinery flare, a stubble fire, or a spreading wildfire. THERMOS fuses facility data, land-cover and 60-day temporal behaviour to say which — with evidence.
            </p>
          </motion.div>

          {/* Classification Board */}
          <motion.div className="border border-white/10 rounded-2xl bg-[#0e1117] p-8 sm:p-14 flex flex-col items-center shadow-2xl" {...revealProps(0.1)}>
            {/* Pipeline Stages */}
            <div className="font-mono text-[clamp(16px,2.5vw,26px)] font-semibold tracking-[0.24em] text-[#5a606c] text-center">
              THERMAL ANOMALY
            </div>
            <div
              className="text-[#5a606c] text-[22px] my-4"
              style={{ animation: reducedMotion ? 'none' : 'cbdown 2.4s ease-out infinite' }}
            >
              ↓
            </div>
            <div className="font-mono text-[clamp(16px,2.5vw,26px)] font-semibold tracking-[0.24em] text-[#7ec8f2] text-center">
              CLASSIFYING · CONTEXT · PERSISTENCE
            </div>
            <div
              className="text-[#5a606c] text-[22px] my-4"
              style={{ animation: reducedMotion ? 'none' : 'cbdown 2.4s ease-out infinite 0.5s' }}
            >
              ↓
            </div>
            <div className="font-mono text-[clamp(16px,2.5vw,26px)] font-semibold tracking-[0.24em] text-[#ff5a1f] text-center">
              {selectedClass} · {currentClassData.confidence} CONFIDENCE
            </div>

            {/* Interactive Taxonomy Chips */}
            <div className="flex flex-wrap gap-2.5 justify-center mt-10 max-w-[800px]">
              {Object.keys(CLASSIFICATION_DATA).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedClass(cat)}
                  className={`font-mono text-[11.5px] tracking-[0.1em] px-4 py-2 rounded-full border transition-all ${
                    selectedClass === cat
                      ? 'border-[#ff5a1f] text-[#ff5a1f] bg-[#ff5a1f]/15 shadow-sm'
                      : 'border-white/10 text-[#8b929e] hover:border-[#ff5a1f]/60 hover:text-white bg-transparent'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Evidence Bars */}
            <div className="mt-12 w-full max-w-[640px] flex flex-col gap-4">
              {currentClassData.evidence.map((ev, idx) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-white font-semibold">{ev.name}</span>
                    <span className="font-mono text-[#8b929e] font-data">{ev.val}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        ev.hot
                          ? 'bg-[#ff5a1f]'
                          : ev.cool
                          ? 'bg-[#7ec8f2]'
                          : 'bg-[#ff5a1f]/80'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${ev.pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: idx * 0.08 }}
                    />
                  </div>
                </div>
              ))}
              <div className="mt-4 text-center font-mono text-[11px] text-[#5a606c] tracking-[0.08em] uppercase">
                MODEL SCORE · EVIDENCE DISCLOSED FOR OPERATIONAL REVIEW
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 03 / CONTEXT SECTION */}
      <section id="context" className="py-28 px-6 sm:px-8 border-t border-white/10 bg-[#0e1117]">
        <div className="max-w-[1200px] mx-auto">
          <motion.div className="max-w-[640px] mb-16" {...revealProps(0)}>
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.16em] uppercase text-[#8b929e] mb-4">
              <span className="text-[#ff5a1f]">03 /</span> CONTEXT
            </div>
            <h2 className="text-[clamp(32px,4.5vw,56px)] font-bold tracking-[-0.03em] leading-[1.05] text-[#f5f6f7]">
              Know what surrounds
              <br />
              the fire.
            </h2>
            <p className="mt-5 text-[17px] text-[#8b929e] leading-[1.6]">
              NASA gives you the signal. THERMOS gives you the surroundings — population, infrastructure, access routes and land-cover, computed for every incident.
            </p>
          </motion.div>

          {/* Context Panel */}
          <motion.div className="border border-white/10 rounded-2xl overflow-hidden bg-[#0a0c10] shadow-2xl" {...revealProps(0.1)}>
            {/* Simulated Radar Map Grid */}
            <div className="relative h-[380px] bg-[#0a0c10] overflow-hidden">
              {/* Grid lines */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                }}
              />

              {/* Scanning sweep beam */}
              <div
                className="absolute top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#ff5a1f]/40 to-transparent"
                style={{ animation: reducedMotion ? 'none' : 'scan 9s linear infinite' }}
              />

              {/* Radar Nodes */}
              {/* 1. Incident */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <span className="w-3.5 h-3.5 rounded-full bg-[#ff5a1f] shadow-[0_0_20px_#ff5a1f] pulse-ring" />
                <span className="font-mono text-[10.5px] font-bold tracking-[0.16em] text-[#ff5a1f] mt-2 bg-[#0a0c10]/80 px-2 py-0.5 rounded border border-[#ff5a1f]/30">
                  INCIDENT · TARGET
                </span>
              </div>

              {/* 2. Facility */}
              <div className="absolute left-[24%] top-[32%] flex flex-col items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7ec8f2] shadow-[0_0_10px_#7ec8f2]" />
                <span className="font-mono text-[9.5px] font-medium tracking-[0.14em] text-[#7ec8f2] mt-1.5 bg-[#0a0c10]/80 px-2 py-0.5 rounded border border-[#7ec8f2]/30">
                  INDUSTRIAL FACILITY · 0.9 KM
                </span>
              </div>

              {/* 3. Settlement */}
              <div className="absolute left-[74%] top-[30%] flex flex-col items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8b929e]" />
                <span className="font-mono text-[9.5px] font-medium tracking-[0.14em] text-[#8b929e] mt-1.5 bg-[#0a0c10]/80 px-2 py-0.5 rounded border border-white/10">
                  SETTLEMENT · 2.4 KM
                </span>
              </div>

              {/* 4. Access Route */}
              <div className="absolute left-[70%] top-[72%] flex flex-col items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8b929e]" />
                <span className="font-mono text-[9.5px] font-medium tracking-[0.14em] text-[#8b929e] mt-1.5 bg-[#0a0c10]/80 px-2 py-0.5 rounded border border-white/10">
                  ACCESS ROUTE · NH-55
                </span>
              </div>
            </div>

            {/* Context Legend Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border-t border-white/10">
              <div className="bg-[#0e1117] p-6 sm:p-7">
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#5a606c] mb-2">
                  POPULATION EXPOSURE
                </div>
                <div className="text-[16px] font-semibold text-white flex items-center gap-2">
                  <span className="font-data">82,000</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#ff5a1f]/15 text-[#ff5a1f]">
                    HIGH
                  </span>
                </div>
              </div>

              <div className="bg-[#0e1117] p-6 sm:p-7">
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#5a606c] mb-2">
                  INFRASTRUCTURE
                </div>
                <div className="text-[16px] font-semibold text-white flex items-center gap-2">
                  <span>Power corridor</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#ff5a1f]/15 text-[#ff5a1f]">
                    AT RISK
                  </span>
                </div>
              </div>

              <div className="bg-[#0e1117] p-6 sm:p-7">
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#5a606c] mb-2">
                  ACCESS ROUTES
                </div>
                <div className="text-[16px] font-semibold text-white flex items-center gap-2">
                  <span>NH-55 open</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#7ec8f2]/15 text-[#7ec8f2]">
                    CLEAR
                  </span>
                </div>
              </div>

              <div className="bg-[#0e1117] p-6 sm:p-7">
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#5a606c] mb-2">
                  LAND COVER
                </div>
                <div className="text-[16px] font-semibold text-white">
                  Built-up / industrial
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 04 / ASSESS (RISK) SECTION */}
      <section id="risk" className="py-28 px-6 sm:px-8 border-t border-white/10 bg-[#0a0c10]">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Big Hero Number */}
          <motion.div {...revealProps(0)}>
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.16em] uppercase text-[#8b929e] mb-4">
              <span className="text-[#ff5a1f]">04 /</span> ASSESS
            </div>
            <div className="font-data text-[clamp(110px,16vw,200px)] font-bold tracking-[-0.05em] leading-none text-[#ff5a1f]">
              87
            </div>
            <div className="font-mono text-[13.5px] tracking-[0.24em] uppercase text-[#8b929e] mt-4">
              RISK SCORE / 100 · CRITICAL
            </div>
          </motion.div>

          {/* 5-Factor Risk Breakdown Bars */}
          <motion.div className="flex flex-col gap-6" {...revealProps(0.1)}>
            {[
              { label: 'Thermal Severity', val: 30, pct: '30%' },
              { label: 'Temporal Persistence', val: 25, pct: '25%' },
              { label: 'Population Exposure', val: 20, pct: '20%' },
              { label: 'Infrastructure Proximity', val: 15, pct: '15%' },
              { label: 'Intensity Trend / Growth', val: 10, pct: '10%' },
            ].map((factor, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                <div className="flex justify-between text-[14px]">
                  <span className="text-white font-medium">{factor.label}</span>
                  <span className="font-mono text-[#8b929e] font-data">{factor.pct}</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[#ff5a1f] rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${factor.val * 3.3}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: idx * 0.1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[13px] text-[#5a606c] italic mt-2">
              Decision-support priority — so the most dangerous fire is never buried in an unranked list.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 05 / RESPOND SECTION */}
      <section id="respond" className="py-28 px-6 sm:px-8 border-t border-white/10 bg-[#0e1117]">
        <div className="max-w-[1200px] mx-auto">
          <motion.div className="max-w-[640px] mb-16" {...revealProps(0)}>
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.16em] uppercase text-[#8b929e] mb-4">
              <span className="text-[#ff5a1f]">05 /</span> RESPOND
            </div>
            <h2 className="text-[clamp(32px,4.5vw,56px)] font-bold tracking-[-0.03em] leading-[1.05] text-[#f5f6f7]">
              One incident.
              <br />
              One source of truth.
            </h2>
            <p className="mt-5 text-[17px] text-[#8b929e] leading-[1.6]">
              The same event moves through every pair of hands — analyst, commander, responder — without a single detail lost in translation.
            </p>
          </motion.div>

          {/* Response Stage */}
          <motion.div className="border border-white/10 rounded-2xl bg-[#0a0c10] overflow-hidden shadow-2xl" {...revealProps(0.1)}>
            {/* View Switcher Tabs */}
            <div className="flex border-b border-white/10">
              {RESPONSE_VIEWS.map((rv, idx) => (
                <button
                  key={rv.id}
                  onClick={() => setActiveResponseIdx(idx)}
                  className={`flex-1 py-5 px-4 font-mono text-[11.5px] tracking-[0.2em] text-center border-b-2 transition-all ${
                    activeResponseIdx === idx
                      ? 'text-white border-[#ff5a1f] bg-white/[0.02]'
                      : 'text-[#5a606c] border-transparent hover:text-[#8b929e]'
                  }`}
                >
                  {rv.tab}
                </button>
              ))}
            </div>

            {/* View Content Body */}
            <div className="p-8 sm:p-14 min-h-[200px] flex flex-col sm:flex-row sm:items-center justify-between gap-8">
              <div className="max-w-[500px]">
                <div className="font-mono text-[12.5px] text-[#5a606c]">
                  INC-2847 · ANGUL, ODISHA
                </div>
                <div className="text-[clamp(24px,3vw,36px)] font-bold tracking-[-0.02em] text-white mt-1">
                  {currentResponse.title}
                </div>
                <div className="mt-3 text-[15px] text-[#8b929e] leading-[1.6]">
                  {currentResponse.desc}
                </div>
              </div>

              <div className="sm:text-right shrink-0">
                <div className="font-data text-[54px] font-bold text-[#ff5a1f] leading-none">
                  {currentResponse.metric}
                </div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-[#5a606c] mt-2">
                  {currentResponse.metricLabel}
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="flex border-t border-white/10">
              {TIMELINE_STATES.map((st, i) => {
                const isActive = i === currentResponse.step;
                const isDone = i < currentResponse.step;
                return (
                  <div
                    key={st}
                    className={`flex-1 py-4 text-center font-mono text-[10px] tracking-[0.16em] relative border-t-2 transition-colors ${
                      isActive
                        ? 'text-[#ff5a1f] border-[#ff5a1f] bg-[#ff5a1f]/5'
                        : isDone
                        ? 'text-[#8b929e] border-transparent'
                        : 'text-[#5a606c] border-transparent'
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

      {/* PLATFORM & PIPELINE SECTION */}
      <section id="platform" className="py-28 px-6 sm:px-8 border-t border-white/10 bg-[#0a0c10]">
        <div className="max-w-[1200px] mx-auto">
          <motion.div className="max-w-[640px] mb-16" {...revealProps(0)}>
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.16em] uppercase text-[#8b929e] mb-4">
              <span className="text-[#ff5a1f]">PLATFORM</span>
            </div>
            <h2 className="text-[clamp(32px,4.5vw,56px)] font-bold tracking-[-0.03em] leading-[1.05] text-[#f5f6f7]">
              Four experiences.
              <br />
              One mission.
            </h2>
          </motion.div>

          {/* Portal Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                num: '01',
                title: 'Intelligence',
                action: 'Understand.',
                actionColor: 'text-[#7ec8f2]',
                desc: 'Investigate thermal detections with full evidence dossiers — facility context, persistence history and land-cover, on a live GIS map.',
                to: '/intelligence',
              },
              {
                num: '02',
                title: 'Command',
                action: 'Coordinate.',
                actionColor: 'text-[#ff5a1f]',
                desc: 'Prioritize incidents by risk score, dispatch the right agency, and track every case from alert to resolution in real time.',
                to: '/dashboard',
              },
              {
                num: '03',
                title: 'Analytics',
                action: 'Forecast.',
                actionColor: 'text-[#ff5a1f]',
                desc: 'Longitudinal anomaly trends, category distributions, temporal recurrences, and geospatial cluster analysis across regions.',
                to: '/analytics',
              },
              {
                num: '04',
                title: 'Priority Queue',
                action: 'Triage.',
                actionColor: 'text-[#7ec8f2]',
                desc: 'Ranked list of all ongoing thermal anomalies sorted by operational risk, agency status, and time-to-breach alerts.',
                to: '/priority',
              },
            ].map((p, idx) => (
              <motion.div key={p.num} {...revealProps(idx * 0.08)}>
                <Link
                  to={p.to}
                  className="border border-white/10 rounded-2xl p-8 bg-[#0e1117] hover:border-white/30 hover:-translate-y-1 transition-all flex flex-col justify-between group min-h-[300px] h-full"
                >
                  <div>
                    <div className="font-mono text-[10.5px] tracking-[0.22em] text-[#5a606c]">{p.num}</div>
                    <h3 className="text-[24px] font-bold text-white mt-8 tracking-tight">{p.title}</h3>
                    <div className={`text-[16px] font-semibold mt-1 ${p.actionColor}`}>{p.action}</div>
                    <p className="text-[13.5px] text-[#8b929e] leading-[1.6] mt-3">{p.desc}</p>
                  </div>
                  <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-white mt-6 group-hover:text-[#ff5a1f] transition-colors">
                    <span>EXPLORE</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* End-to-End Pipeline */}
          <motion.div className="mt-24 border border-white/10 rounded-2xl p-8 sm:p-12 bg-[#0e1117]" {...revealProps(0.1)}>
            <div className="flex items-center justify-center gap-2 font-mono text-[11px] font-semibold tracking-[0.16em] uppercase text-[#8b929e] mb-8 text-center">
              <span className="text-[#ff5a1f]">BUILT ON</span> REAL SIGNALS
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[12px] tracking-[0.12em] text-[#8b929e]">
              <span className="text-[#ff5a1f] font-semibold">NASA FIRMS</span>
              <span className="text-[#5a606c]">→</span>
              <span>THERMAL DETECTION</span>
              <span className="text-[#5a606c]">→</span>
              <span className="text-[#ff5a1f] font-semibold">CLASSIFICATION</span>
              <span className="text-[#5a606c]">→</span>
              <span>GEOSPATIAL CONTEXT</span>
              <span className="text-[#5a606c]">→</span>
              <span className="text-[#ff5a1f] font-semibold">RISK ENGINE</span>
              <span className="text-[#5a606c]">→</span>
              <span>RESPONSE DISPATCH</span>
            </div>

            <div className="mt-8 text-center font-mono text-[11.5px] text-[#5a606c] tracking-[0.06em]">
              <span>VIIRS 375m</span> · OSM Overpass · ESA WorldCover · Leaflet / MapLibre GIS · REST API · GeoJSON
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="py-32 px-6 sm:px-8 border-t border-white/10 bg-[#0a0c10] text-center">
        <motion.div className="max-w-[800px] mx-auto" {...revealProps(0)}>
          <h2 className="text-[clamp(36px,5.5vw,72px)] font-extrabold tracking-[-0.035em] leading-[1.05] text-white">
            See what matters.
            <br />
            <span className="text-[#5a606c]">Before it becomes an emergency.</span>
          </h2>
          <p className="mt-6 text-[18px] text-[#8b929e]">
            The live platform is running right now with near-real-time satellite ingestion.
          </p>
          <div className="mt-10 flex justify-center">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2.5 px-9 py-4 rounded-full bg-[#ff5a1f] hover:bg-[#ff6d38] text-white font-semibold text-[16px] shadow-[0_12px_40px_-8px_rgba(255,90,31,0.45)] hover:-translate-y-0.5 transition-all group"
            >
              <span>Open THERMOS Platform</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#0e1117]">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-8 py-20 grid grid-cols-1 md:grid-cols-5 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5a1f] shadow-[0_0_12px_#ff5a1f]" />
              <span className="font-bold text-[18px] tracking-tight text-white">THERMOS</span>
            </div>
            <p className="text-[14px] text-[#8b929e] mt-4 leading-[1.6] max-w-[320px]">
              Satellite thermal intelligence for faster disaster response. From signal to action.
            </p>
            <div className="flex items-center gap-2 mt-6 font-mono text-[11px] tracking-[0.16em] text-[#8b929e]">
              <span className="w-2 h-2 rounded-full bg-[#ff5a1f] pulse-ring" />
              <span>OPERATIONS PLATFORM · SIH26162 · NTRO</span>
            </div>
          </div>

          <div>
            <div className="font-mono text-[10.5px] tracking-[0.2em] text-[#5a606c] uppercase mb-5">
              INTELLIGENCE
            </div>
            <div className="flex flex-col gap-2.5 text-[14px] text-[#8b929e]">
              <Link to="/intelligence" className="hover:text-white transition-colors">Incident Analysis</Link>
              <Link to="/priority" className="hover:text-white transition-colors">Detection Feed</Link>
              <Link to="/analytics" className="hover:text-white transition-colors">Cluster Trends</Link>
            </div>
          </div>

          <div>
            <div className="font-mono text-[10.5px] tracking-[0.2em] text-[#5a606c] uppercase mb-5">
              RESPONSE
            </div>
            <div className="flex flex-col gap-2.5 text-[14px] text-[#8b929e]">
              <Link to="/dashboard" className="hover:text-white transition-colors">Government Command</Link>
              <Link to="/investigator" className="hover:text-white transition-colors">Incident Investigator</Link>
              <Link to="/system" className="hover:text-white transition-colors">System Telemetry</Link>
            </div>
          </div>

          <div>
            <div className="font-mono text-[10.5px] tracking-[0.2em] text-[#5a606c] uppercase mb-5">
              RESOURCES
            </div>
            <div className="flex flex-col gap-2.5 text-[14px] text-[#8b929e]">
              <a
                href="https://firms.modaps.eosdis.nasa.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                NASA FIRMS ↗
              </a>
              <a
                href="https://www.openstreetmap.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                OpenStreetMap ↗
              </a>
              <Link to="/system" className="hover:text-white transition-colors">
                Live Health
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 py-7 px-6 sm:px-8 max-w-[1200px] mx-auto flex flex-wrap justify-between items-center gap-4 text-[12px] text-[#5a606c] font-mono">
          <div>
            © 2026 THERMOS — From space to action. Built for SIH26162 (NTRO) · Demo environment
          </div>
          <div>
            <Link to="/dashboard" className="text-[#8b929e] hover:text-white transition-colors">
              Open Platform →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
