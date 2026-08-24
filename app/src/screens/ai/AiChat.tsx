import { useStore, useActions } from '../../store/StoreProvider';
import { AI_CHAT_HISTORY } from '../../lib/seedData';

const AI_SUGGESTIONS = [
  'How much Lifestyle relief do I have left?',
  'Am I on track with my budget this month?',
  "What's my net worth trend look like?",
];

// Gemini replies routinely emphasise figures with **bold** markdown; this
// bubble is plain text otherwise, so render just that one construct rather
// than pulling in a full markdown renderer for a single formatting need.
function renderChatText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

export function AiChat() {
  const { state } = useStore();
  const actions = useActions();

  const isChat = state.aiView === 'chat';
  const isHistory = state.aiView === 'history';
  const hasNoMessages = state.aiMessages.length === 0;

  const send = () => actions.submitAiText(state.aiInput);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }} className="screen-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19 }}>AI Assistant</div>
        <button
          type="button"
          onClick={actions.toggleAiView}
          className="pressable"
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-neutral-400)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          {isChat && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          )}
          {isHistory && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
          )}
        </button>
      </div>

      {isHistory && (
        <div style={{ flex: 1 }}>
          <button
            type="button"
            onClick={actions.startNewAiChat}
            className="pressable"
            style={{
              all: 'unset',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              background: 'var(--color-accent-100)',
              color: 'var(--color-accent-800)',
              borderRadius: 'var(--radius-md)',
              padding: '11px 14px',
              fontWeight: 700,
              fontSize: 12.5,
              marginBottom: 16,
              boxSizing: 'border-box',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            New conversation
          </button>
          <div style={{ font: '600 10.5px var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>
            Past conversations
          </div>
          <div style={{ borderTop: '1px solid var(--color-divider)' }} />
          {AI_CHAT_HISTORY.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => actions.openAiHistoryChat(c.messages)}
              className="pressable"
              style={{
                all: 'unset',
                display: 'block',
                width: '100%',
                cursor: 'pointer',
                padding: '13px 0',
                borderBottom: '1px solid var(--color-neutral-300)',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 3 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{c.title}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>{c.date}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.preview}
              </div>
            </button>
          ))}
        </div>
      )}

      {isChat && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 14 }}>
            {hasNoMessages && (
              <div style={{ textAlign: 'center', padding: '26px 6px' }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg,#4d7cf7,#9868d9,#e26b95)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Ask me anything</div>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', maxWidth: '28ch', margin: '0 auto 18px', lineHeight: 1.5 }}>
                  I can see your accounts, budgets, receipts and tax profile.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {AI_SUGGESTIONS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => actions.submitAiText(label)}
                      className="pressable"
                      style={{
                        all: 'unset',
                        padding: '11px 14px',
                        background: 'var(--color-surface)',
                        border: '1.5px solid var(--color-neutral-300)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxSizing: 'border-box',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {state.aiMessages.map((m, i) => {
              const isUser = m.from === 'user';
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '10px 14px',
                      borderRadius: 16,
                      fontSize: 13,
                      lineHeight: 1.5,
                      background: isUser ? 'var(--color-accent)' : 'var(--color-neutral-200)',
                      color: isUser ? '#fff' : 'var(--color-text)',
                    }}
                  >
                    {renderChatText(m.text)}
                  </div>
                </div>
              );
            })}
            {state.aiTyping && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: 16, background: 'var(--color-neutral-200)', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  ···
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid var(--color-divider)', paddingTop: 12, flexShrink: 0 }}>
            <input
              type="text"
              className="input"
              value={state.aiInput}
              onChange={(e) => actions.setAiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask about your spending, tax, budget…"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={send}
              className="pressable"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--color-accent)',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
