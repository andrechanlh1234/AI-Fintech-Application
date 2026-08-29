import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useStore, useActions } from '../../store/StoreProvider';
import { AI_CHAT_HISTORY, type AiMessage } from '../../lib/seedData';
import { useKeyboardInset } from '../../lib/useKeyboardInset';
import { prefersReducedMotion } from '../../lib/motion';

// Remembered across mounts so the *first* focus in a session can still open
// with a good guess. iOS keyboard is ~291pt bare / ~336pt with the
// predictive bar; 300 is a safe middle until the real height lands.
let lastKbHeight = 300;

// Commonly-asked questions shown as tappable chips just above the input on
// an empty chat.
const AI_SUGGESTIONS = [
  'How much tax relief can I still claim?',
  'Am I on track with my budget this month?',
  "What's my net worth trend?",
  'Where am I overspending?',
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

function ReplyGlyph({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

// One chat bubble. Drag it toward its own side's edge — an AI bubble to the
// right, your own bubble to the left — past a short threshold to reply to
// it. `touch-action: pan-y` leaves vertical list scrolling to the browser.
function MessageBubble({ m, onReply }: { m: AiMessage; onReply: (q: { from: 'user' | 'ai'; text: string }) => void }) {
  const isUser = m.from === 'user';
  const dir = isUser ? -1 : 1; // user swipes left, AI swipes right
  const THRESH = 46;
  const MAX = 68;
  const start = useRef<{ x: number; y: number } | null>(null);
  const engaged = useRef(false);
  const [offset, setOffset] = useState(0);
  const reduce = prefersReducedMotion();

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, y: e.clientY };
    engaged.current = false;
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!engaged.current) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.3) { start.current = null; return; } // vertical scroll — let it go
      engaged.current = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    }
    const along = dx * dir; // > 0 when dragged toward the reply side
    setOffset(along > 0 ? Math.min(along, MAX) * dir : 0);
  };
  const onUp = () => {
    if (engaged.current && Math.abs(offset) >= THRESH) onReply({ from: m.from, text: m.text });
    start.current = null;
    engaged.current = false;
    setOffset(0);
  };

  const revealed = Math.min(1, Math.abs(offset) / THRESH);
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute', top: 0, bottom: 0, [isUser ? 'right' : 'left']: 4,
          display: 'flex', alignItems: 'center', opacity: revealed, transform: `scale(${0.7 + revealed * 0.3})`,
          pointerEvents: 'none',
        }}
      >
        <ReplyGlyph color="var(--color-text-muted)" />
      </div>
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{
          maxWidth: '80%', padding: '10px 14px', borderRadius: 16, fontSize: 13, lineHeight: 1.5,
          background: isUser ? 'var(--color-accent)' : 'var(--color-neutral-200)',
          color: isUser ? '#fff' : 'var(--color-text)',
          transform: `translateX(${offset}px)`,
          transition: offset === 0 && !reduce ? 'transform .22s cubic-bezier(.22,1,.28,1)' : 'none',
          touchAction: 'pan-y',
        }}
      >
        {m.replyTo && (
          <div
            style={{
              borderLeft: `2px solid ${isUser ? 'rgba(255,255,255,0.5)' : 'var(--color-neutral-400)'}`,
              paddingLeft: 8, marginBottom: 6, fontSize: 11.5, lineHeight: 1.4, opacity: 0.85,
              maxHeight: 32, overflow: 'hidden',
            }}
          >
            {m.replyTo.text}
          </div>
        )}
        {renderChatText(m.text)}
      </div>
    </div>
  );
}

export function AiChat() {
  const { state } = useStore();
  const actions = useActions();

  const isChat = state.aiView === 'chat';
  const isHistory = state.aiView === 'history';
  const hasNoMessages = state.aiMessages.length === 0;

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<{ from: 'user' | 'ai'; text: string } | null>(null);
  const focusInput = () => inputRef.current?.focus();
  const send = () => {
    actions.submitAiText(state.aiInput, replyTo ?? undefined);
    setReplyTo(null);
  };
  const startReply = (q: { from: 'user' | 'ai'; text: string }) => {
    setReplyTo(q);
    focusInput();
  };

  // How much the keyboard covers. The WebView doesn't resize (Keyboard
  // `resize: 'none'`), so this screen shrinks its own column by this — the
  // input rides just above the keyboard, the chat stays visible above the
  // input, and nothing else in the app moves.
  const kb = useKeyboardInset();
  const [inputFocused, setInputFocused] = useState(false);
  useEffect(() => { if (kb > 0) lastKbHeight = kb; }, [kb]);
  // `keyboardWillShow` lands a frame or two after focus, which makes the
  // input visibly lag the keyboard sliding up. Start the shift on focus
  // with the remembered height so the two move together; the real value
  // (kb) takes over the instant it arrives.
  const kbInset = kb > 0 ? kb : (inputFocused ? lastKbHeight : 0);

  // Pop the keyboard on entering an empty chat, and keep it up through the
  // conversation (refocus once a reply lands). Programmatic focus opening
  // the keyboard is best-effort in an iOS WKWebView -- the tab tap is the
  // user gesture that lets it through most of the time.
  useEffect(() => {
    if (isChat && hasNoMessages) focusInput();
  }, [isChat, hasNoMessages]);
  useEffect(() => {
    if (isChat && !state.aiTyping) focusInput();
  }, [isChat, state.aiTyping]);

  // Keep the conversation pinned to the latest line as messages arrive and
  // as the keyboard opens/closes.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [isChat, kbInset, state.aiMessages.length, state.aiTyping]);

  return (
    <div
      style={{
        // Fill the viewport down to just above the floating tab bar; when
        // the keyboard is up, shrink by its height instead so the input
        // sits just above it (nothing else in the app shifts).
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        minHeight: `calc(100dvh - ${kbInset > 0 ? 16 : 118}px - ${kbInset}px)`,
        // Track the iOS keyboard's own timing/curve so the input rises
        // with it, not a beat behind.
        transition: 'min-height .34s cubic-bezier(0.17, 0.59, 0.4, 1)',
        padding: 'calc(env(safe-area-inset-top) + 16px) 16px 12px',
      }}
      className="screen-in"
    >
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
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div
            ref={scrollRef}
            style={{
              flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 14,
              overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              justifyContent: hasNoMessages ? 'center' : 'flex-start',
            }}
          >
            {hasNoMessages && (
              <div style={{ textAlign: 'center', padding: '0 6px' }}>
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
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, marginBottom: 6 }}>How can I help today?</div>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', maxWidth: '30ch', margin: '0 auto', lineHeight: 1.5 }}>
                  I can see your accounts, budgets, receipts and tax profile.
                </div>
              </div>
            )}
            {state.aiMessages.map((m, i) => (
              <MessageBubble key={i} m={m} onReply={startReply} />
            ))}
            {state.aiTyping && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: 16, background: 'var(--color-neutral-200)', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  ···
                </div>
              </div>
            )}
          </div>
          {hasNoMessages && (
            <div
              style={{
                display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0, paddingBottom: 10,
                WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
              }}
            >
              {AI_SUGGESTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { actions.submitAiText(label); focusInput(); }}
                  className="pressable"
                  style={{
                    all: 'unset',
                    flexShrink: 0,
                    padding: '9px 14px',
                    background: 'var(--color-surface)',
                    border: '1.5px solid var(--color-neutral-300)',
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {replyTo && (
            <div
              className="pop-in"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
                padding: '8px 10px', marginBottom: 8, borderRadius: 8,
                background: 'var(--color-surface)', border: '1px solid var(--color-neutral-300)',
                borderLeft: '3px solid var(--color-accent)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 10px var(--font-body)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-accent-700)', marginBottom: 1 }}>
                  Replying to {replyTo.from === 'user' ? 'you' : 'assistant'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {replyTo.text}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label="Cancel reply"
                className="pressable"
                style={{ all: 'unset', cursor: 'pointer', flexShrink: 0, display: 'flex', padding: 4, color: 'var(--color-text-muted)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid var(--color-divider)', paddingTop: 12, flexShrink: 0 }}>
            <input
              ref={inputRef}
              type="text"
              className="input"
              autoFocus
              value={state.aiInput}
              onChange={(e) => actions.setAiInput(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
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
