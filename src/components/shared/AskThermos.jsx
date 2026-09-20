import { useState } from 'react';

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

export default function AskThermos({ eventId }) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: `Event ${eventId} is available for analysis. Ask a question about classification, exposure, or pattern history.` },
  ]);

  const handleSubmit = (q) => {
    const question = q || query;
    if (!question.trim()) return;

    const response = CANNED_RESPONSES[question] ||
      `Analysis for event ${eventId}: Based on available thermal data and land-cover analysis, this query requires additional context from the full THERMOS intelligence pipeline. In production, this would query the classification model and return a structured response.`;

    setMessages((prev) => [...prev, { role: 'user', text: question }, { role: 'assistant', text: response }]);
    setQuery('');
  };

  return (
    <div className="border-t border-[var(--color-border)] shrink-0">
      {/* Messages */}
      {messages.length > 0 && (
        <div className="max-h-[180px] overflow-y-auto px-4 py-3 space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className={`text-scale-sm leading-relaxed ${msg.role === 'user' ? 'text-[var(--color-text-secondary)] font-medium' : 'text-[var(--color-text-primary)]'}`}>
              {msg.role === 'user' ? (
                <span className="text-[var(--color-text-tertiary)]">You: </span>
              ) : (
                <span className="text-[var(--color-accent-hover)]">THERMOS: </span>
              )}
              {msg.text}
            </div>
          ))}
        </div>
      )}

      {/* Suggested chips */}
      {messages.length > 0 && (
        <div className="px-4 pt-2 flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSubmit(q)}
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
          placeholder="Ask THERMOS…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="flex-1 h-8 px-3 text-scale-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        />
        <button
          onClick={() => handleSubmit()}
          className="h-8 px-3 bg-[var(--color-accent)] text-[var(--color-text-primary)] text-scale-sm font-medium rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          Ask
        </button>
      </div>
    </div>
  );
}
