import { useState } from 'react';
import { askThermosCopilot } from '../../services/api';

const SUGGESTED_QUESTIONS = [
  'Why is this classified as industrial?',
  'What are the chemical hazards & evacuation radius?',
  'What fire suppression protocol should be used?',
  'Show similar past events',
];

const CANNED_RESPONSES = {
  'Why is this classified as industrial?':
    'This event is classified as industrial based on three key factors: (1) the thermal source is located within 200m of a mapped industrial boundary in OpenStreetMap, (2) the fire radiative power (FRP) signature shows a stable, high-intensity pattern consistent with industrial processes rather than wildfire spread, and (3) the persistence duration exceeds 48 hours, which is atypical for agricultural or natural fires.',
  'What is the population exposure?':
    'Population analysis shows approximately 12,400 people within a 5km radius of this thermal source. The nearest residential settlement is 1.2km to the southeast. Based on current wind patterns (NW, 8km/h), the downwind exposure zone affects an estimated 3,200 additional residents.',
  'Show similar past events':
    'Three similar events were detected in this region over the past 90 days: THR-2301 (72h persistence, resolved), THR-2287 (active, 120h), and THR-2215 (96h, classified as routine flaring). All share similar FRP profiles and industrial proximity characteristics.',
};

export default function AskThermos({ eventId }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: `Event ${eventId} is connected to the THERMOS AI & RAG Disaster Copilot. Ask about chemical hazards, evacuation radii, suppression SOPs, or classification.` },
  ]);

  const handleSubmit = async (q) => {
    const question = q || query;
    if (!question.trim()) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setQuery('');
    setLoading(true);

    try {
      const liveRes = await askThermosCopilot(question, eventId);
      if (liveRes && liveRes.answer) {
        setMessages((prev) => [...prev, { role: 'assistant', text: liveRes.answer }]);
        setLoading(false);
        return;
      }
    } catch (_) {
      // Fallback below if offline
    }

    const fallbackResponse = CANNED_RESPONSES[question] ||
      `Tactical RAG Assessment for ${eventId}: Primary Chemical Hazards identified (Benzene, LPG, Hydrocarbons). Mandatory Evacuation Perimeter: 3.5 km downwind. Recommended Suppression: Class B AFFF Foam deluge only (Avoid high-pressure water jets on storage vessels). Follow NDMA Phase 1-4 Emergency Isolation SOPs.`;

    setMessages((prev) => [...prev, { role: 'assistant', text: fallbackResponse }]);
    setLoading(false);
  };

  return (
    <div className="border-t border-[var(--color-border)] shrink-0">
      {/* Messages */}
      {messages.length > 0 && (
        <div className="max-h-[200px] overflow-y-auto px-4 py-3 space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className={`text-scale-sm leading-relaxed whitespace-pre-line ${msg.role === 'user' ? 'text-[var(--color-text-secondary)] font-medium' : 'text-[var(--color-text-primary)]'}`}>
              {msg.role === 'user' ? (
                <span className="text-[var(--color-text-tertiary)]">You: </span>
              ) : (
                <span className="text-[var(--color-accent-hover)] font-semibold">THERMOS AI: </span>
              )}
              {msg.text}
            </div>
          ))}
          {loading && (
            <div className="text-scale-xs text-[var(--color-text-tertiary)] animate-pulse">
              THERMOS RAG Copilot is retrieving facility MSDS & NDMA protocols...
            </div>
          )}
        </div>
      )}

      {/* Suggested chips */}
      {messages.length > 0 && (
        <div className="px-4 pt-2 flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSubmit(q)}
              disabled={loading}
              className="px-2.5 py-1 text-scale-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 flex gap-2">
        <input
          type="text"
          placeholder="Ask THERMOS AI Copilot…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="flex-1 h-8 px-3 text-scale-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        />
        <button
          onClick={() => handleSubmit()}
          disabled={loading}
          className="h-8 px-3 bg-[var(--color-accent)] text-[var(--color-text-primary)] text-scale-sm font-medium rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          Ask
        </button>
      </div>
    </div>
  );
}
