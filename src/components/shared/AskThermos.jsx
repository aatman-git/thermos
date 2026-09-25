import { useState, useRef, useEffect } from 'react';
import { askEventQuestion } from '../../services/api';

const SUGGESTED_QUESTIONS = [
  'Why is this classified as industrial?',
  'What is the population exposure?',
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

export default function AskThermos({ eventId, eventContext }) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: `Event ${eventId || 'hotspot'} is available for analysis. Ask a question about classification, exposure, or pattern history.`,
    },
  ]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (q) => {
    // 1. Read exact text: either passed directly from a chip or read from the input state
    const rawText = typeof q === 'string' ? q : query;
    const text = (rawText || '').trim();

    // 2. Exact console.log required by user to verify input capture
    console.log('[AskThermos] Submitting question:', text);

    if (!text || isLoading) return;

    // Immediately post user's message and clear input
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setQuery('');
    setIsLoading(true);

    try {
      // 3. Dispatch to backend API (POST /api/events/{id}/ask or /api/investigator/ask)
      const data = await askEventQuestion({
        eventId: eventId || 'HOTSPOT',
        question: text,
        context: eventContext || {},
      });

      if (data && data.answer) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: data.answer, provider: data.provider },
        ]);
        return;
      }
    } catch (err) {
      console.warn('[AskThermos] Backend query error:', err);
    } finally {
      setIsLoading(false);
    }

    // 4. Guaranteed offline fallback: preserves pre-set suggested responses and smart context
    const fallbackAnswer =
      CANNED_RESPONSES[text] ||
      (eventContext?.region
        ? `Analysis for event ${eventId}: Detected in ${eventContext.region} with risk score ${eventContext.risk_score || 70} (${eventContext.risk_tier || 'MODERATE'}). Classified as ${eventContext.category || 'Thermal Hotspot'} with ${eventContext.confidence || 85}% confidence.`
        : `Analysis for event ${eventId}: Based on thermal characteristics and land-cover analysis, this signature aligns with active monitored hotspot indicators.`);

    setMessages((prev) => [...prev, { role: 'assistant', text: fallbackAnswer }]);
  };

  return (
    <div className="border-t border-[var(--color-border)] shrink-0 bg-white">
      {/* Messages */}
      {messages.length > 0 && (
        <div className="max-h-[190px] overflow-y-auto px-4 py-3 space-y-2.5">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`text-scale-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'text-[var(--color-text-secondary)] font-medium'
                  : 'text-[var(--color-text-primary)]'
              }`}
            >
              {msg.role === 'user' ? (
                <span className="text-[var(--color-text-tertiary)] font-semibold">You: </span>
              ) : (
                <span className="text-[var(--color-accent-hover)] font-semibold">THERMOS: </span>
              )}
              {msg.text}
            </div>
          ))}
          {isLoading && (
            <div className="text-scale-sm leading-relaxed text-[var(--color-text-secondary)] italic flex items-center gap-1.5">
              <span className="text-[var(--color-accent-hover)] font-semibold not-italic">THERMOS: </span>
              <span className="inline-block animate-pulse">Analyzing satellite data & evidence…</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Suggested chips */}
      <div className="px-4 pt-1 pb-2 flex flex-wrap gap-1.5 border-t border-[var(--color-border-subtle)]">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={isLoading}
            onClick={() => handleSubmit(q)}
            className="px-2.5 py-1 text-scale-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Form Input + Ask Button */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="px-4 py-3 flex gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
      >
        <input
          type="text"
          placeholder="Ask THERMOS anything about this fire event…"
          value={query}
          disabled={isLoading}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className="flex-1 h-8 px-3 text-scale-sm bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="h-8 px-3.5 bg-[var(--color-accent)] text-[var(--color-text-primary)] text-scale-sm font-semibold rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs shrink-0"
        >
          {isLoading ? 'Thinking…' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
