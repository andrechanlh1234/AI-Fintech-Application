import type { CSSProperties, ReactNode } from 'react';

/**
 * The single outer wrapper every top-level tab screen (Home, Finance, Tax)
 * renders through, so switching tabs never nudges the header or the content
 * edges.
 *
 * Before this, each screen set its own root padding and they disagreed —
 * Home and Tax used `... 16px 24px` *and* a `.screen-in` entrance, Finance
 * used `... 16px 0` with *no* entrance. So the content edges sat at a
 * different offset and some tabs visibly hopped on entry while others
 * didn't. All of that spacing now lives here, and the only tab-change
 * motion is the one horizontal slide `PageTransition` already does for
 * every tab — identical whichever tab you land on.
 */
export function PageShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        padding: 'calc(env(safe-area-inset-top) + 16px) 16px 24px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
