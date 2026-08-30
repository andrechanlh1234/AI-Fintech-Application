// Plain-language Privacy Policy and Terms of Use reflecting what Cukai
// actually does today (see backend/main.py, backend/db.py). This is a
// good-faith starting draft, not a substitute for a lawyer's review —
// have one check this before real users (beyond you) rely on the app,
// especially for PDPA (Malaysia's data protection law) compliance.
const LAST_UPDATED = '20 August 2026';

const h = { fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, marginTop: 20, marginBottom: 6 } as const;
const p = { fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6, marginBottom: 8 } as const;
const li = { fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6, marginBottom: 4 } as const;

function Privacy() {
  return (
    <>
      <p style={p}>
        Cukai is early-stage software. This policy describes what actually happens with your
        data today — it will be updated as the product changes.
      </p>

      <div style={h}>What we collect</div>
      <p style={p}>If you create an account: your email address and a password (we never store the password itself — only a one-way hash of it).</p>
      <p style={p}>
        Whatever you enter into the app: net worth, budgets, transactions, subscriptions, and
        your tax-relief profile (marital status, dependants, reliefs you're claiming, and
        similar). None of this is invented or filled in for you — it's only what you type or
        what a scanned receipt actually reads.
      </p>
      <p style={p}>
        Receipt photos, if you use the scan feature: the photo is sent to our server, read once
        to extract the merchant/amount/date/category, and then discarded — we don't keep a copy
        of the image.
      </p>

      <div style={h}>What we don't do</div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li style={li}>We don't sell or share your data with third parties, advertisers, or data brokers.</li>
        <li style={li}>We don't currently run any analytics or tracking in the app.</li>
        <li style={li}>We don't connect to your real bank accounts — "linked accounts" in this app are illustrative only right now.</li>
      </ul>

      <div style={h}>Where your data lives</div>
      <p style={p}>
        If you're signed in, your data is stored in our database so it's there when you come
        back or switch devices. If you use the app without an account ("Skip for now"), your
        data stays only in this browser's local storage and never reaches our servers at all.
      </p>

      <div style={h}>Your rights</div>
      <p style={p}>
        You can request a copy of your data or ask us to delete your account and everything in
        it at any time — there's no self-serve delete button yet, so reach out to us directly to
        do this. Under Malaysia's Personal Data Protection Act (PDPA), you also have the right to
        correct inaccurate data we hold about you.
      </p>

      <div style={h}>Security</div>
      <p style={p}>
        Passwords are hashed (never stored in plain text). Sessions use signed tokens that
        expire. Like any early-stage service, treat this as reasonable-effort security, not a
        guarantee — don't store anything here you wouldn't want exposed if something went wrong.
      </p>

      <p style={{ ...p, marginTop: 20, color: 'var(--color-text-muted)' }}>Last updated {LAST_UPDATED}.</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <p style={p}>
        By using Cukai, you agree to these terms. This is early-stage software provided as-is —
        please read the disclaimers below carefully.
      </p>

      <div style={h}>This is not tax or financial advice</div>
      <p style={p}>
        Cukai estimates Malaysian (LHDN) tax reliefs and savings based on a general relief-cap
        table and the information you provide. These figures are estimates, not a substitute for
        professional advice, and are not guaranteed to be accurate or current. Always verify
        anything you plan to rely on for an actual tax filing with LHDN/HASiL directly or a
        licensed tax professional.
      </p>

      <div style={h}>Your responsibility</div>
      <p style={p}>
        You're responsible for the accuracy of what you enter, and for how you use any figures
        or suggestions this app produces. Cukai is a tool to help you organise and estimate — it
        doesn't file anything on your behalf and doesn't verify your entries against any
        official source.
      </p>

      <div style={h}>No warranty</div>
      <p style={p}>
        The service is provided "as is," without warranty of any kind. We don't guarantee it
        will be uninterrupted, error-free, or fit for any particular purpose. As early-stage
        software, features, calculations, and availability may change without notice.
      </p>

      <div style={h}>Limitation of liability</div>
      <p style={p}>
        To the fullest extent permitted by law, we aren't liable for any loss or damage arising
        from your use of the app, including any financial or tax decisions made based on figures
        it shows you.
      </p>

      <div style={h}>Acceptable use</div>
      <p style={p}>
        Don't use Cukai for anything illegal, don't attempt to breach its security, and don't
        use it to store data belonging to someone who hasn't agreed to these terms.
      </p>

      <div style={h}>Account &amp; termination</div>
      <p style={p}>
        You can stop using the app or ask us to delete your account at any time. We may suspend
        or terminate access if these terms are violated.
      </p>

      <div style={h}>Governing law</div>
      <p style={p}>These terms are governed by the laws of Malaysia.</p>

      <p style={{ ...p, marginTop: 20, color: 'var(--color-text-muted)' }}>Last updated {LAST_UPDATED}.</p>
    </>
  );
}

export function LegalDoc({ doc }: { doc: 'privacy' | 'terms' }) {
  return (
    <div style={{ padding: '20px 20px 28px', boxSizing: 'border-box' }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 19, marginBottom: 4 }}>
        {doc === 'privacy' ? 'Privacy Policy' : 'Terms of Use'}
      </div>
      {doc === 'privacy' ? <Privacy /> : <Terms />}
    </div>
  );
}
