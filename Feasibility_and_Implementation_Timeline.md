# [App Name] — Feasibility Assessment & Implementation Timeline
*Draft v0.1 — based on Business_Proposal_Draft.docx (github.com/andrechanlh1234/AI-Fintech-Application)*

## Purpose

Before writing any code: confirm the MVP features are technically buildable at a cost a bootstrapped/early-stage team can carry, pick a hosting stack, then sequence the work — design first, code second.

---

## 1. Feature Feasibility — Phase 1 MVP

| Feature | Feasibility | Complexity | Main cost driver |
|---|---|---|---|
| AI receipt capture (photo → OCR → structured fields) | High | Medium | OCR/LLM API calls per scan |
| Manual entry / edit | High | Low | None — standard CRUD |
| Basic dashboard (spend by category, trends) | High | Low | None — standard charting |
| Local-first storage | High | Low | None — on-device DB (SQLite/WatermelonDB) |
| Manual bank/e-wallet statement upload (PDF/CSV) | High | Medium | Parser needs to handle layout variance per bank — ongoing maintenance, not one-time |
| Gmail invoice detection (Phase 2, but worth flagging now) | Medium | Medium-High | Google API verification process + OAuth consent screen review can take 1-4 weeks — start this early, it's a scheduling risk, not a technical one |
| Tax-relief mapping to LHDN categories | High | Low-Medium | Rules are static (yearly table), the AI's job is just categorization — cheap and reliable if you don't let it invent the relief figures itself |
| Anomaly/exception detection | Medium | Medium | Needs a few months of user data before it's actually useful — treat as a Phase 2/3 feature, not Day 1 |

**Bottom line:** nothing in the Phase 1 list is a technical risk. The two things worth derisking early are (1) statement-format variability across Malaysian banks — pull 5-6 real sample statements now and test your OCR parser against them before committing to a timeline, and (2) Gmail API access approval, which has a review queue outside your control.

---

## 2. Hosting & Infrastructure Recommendation

**Recommendation: Supabase (backend + Postgres + auth + storage) + Vercel (web) + Expo/EAS (mobile builds).**

| Option | Verdict | Why |
|---|---|---|
| **Supabase** | ✅ Recommended | Postgres under the hood (portable, no vendor lock-in), free tier covers early testing, ~$25-40/mo once you're past prototype. Built-in auth, row-level security (useful for "private per user" data), and object storage for receipt images in one place. |
| Firebase | Considered, not chosen | Faster to start, but costs scale linearly and get expensive fast at real usage (roughly 3-5x Supabase at the same load per current benchmarks) — not worth the migration pain later. |
| Railway | Considered, not chosen | Great for running custom backend services, but you'd be assembling DB + auth + storage yourself. Only reach for this if you outgrow Supabase's managed layer. |
| Self-hosted GPU (for OCR/LLM) | Not for MVP | Model weights being free doesn't mean hosting is free — you'd be paying for GPU infra instead of per-page API fees. Only makes sense once volume is high enough to justify it (see Section 3). |

**Data residency / compliance note:** Malaysia's PDPA does **not** require data to stay physically in-country — cross-border transfer is fine as long as the destination has comparable protection or you get explicit consent, which is standard practice for cloud SaaS. The heavier regime (BNM's RMiT) applies to licensed financial institutions handling payment rails — since this app only reads/categorizes data the user uploads (no fund movement, no bank linking yet), it likely sits under PDPA alone rather than BNM licensing. **Flag this for an actual legal review before launch** — it changes if you ever add live bank linking or move money.

---

## 3. Core Tech Stack Recommendation

| Layer | Recommendation | Reasoning |
|---|---|---|
| Mobile + Web | **React Native (via Expo) for mobile, shared logic with a Next.js or React web app** | You said "both" platforms — React Native shares a language (JS/TS) and much of the business logic with a web frontend, so one team can cover both without duplicating work. (Flutter has a slight edge on visual polish, but costs you a second skill set your team likely doesn't have yet — not worth it for an MVP.) |
| Backend/DB | Supabase (Postgres) | See above. |
| OCR pipeline | Tiered: Tesseract/PaddleOCR (free, clean receipts) → Mistral OCR API (~$2-4 per 1,000 pages) as fallback for messy/angled photos | Matches what the proposal already recommended — don't pay API fees for every scan when free OCR handles most of them. |
| LLM (structuring + chat assistant) | Commercial API (Claude or GPT) for MVP speed, swap to self-hosted open-weight model later once usage patterns justify the infra cost | Building your own inference infra before you know your volume is premature optimization. |
| Gmail integration | Google Workspace API, read-only scope | Start the OAuth consent screen verification process in parallel with build — it's the longest lead time item in Phase 1/2. |

---

## 4. Implementation Timeline

This follows the sequence you outlined: **feasibility → look & feel (design) → code.**

### Phase 0 — Feasibility & Validation (Weeks 1-3) — *we're here*
- [x] Business proposal reviewed, MVP feature list feasibility-checked (this doc)
- [ ] Pull 5-6 real bank/e-wallet statement exports (Maybank, CIMB, Public Bank, TNG eWallet, GrabPay) and test-parse them — confirms the statement-upload approach actually works before you build around it
- [ ] Start Google OAuth consent screen verification (Gmail read-only scope) — do this now, it runs in the background for weeks
- [ ] 5-10 short user interviews (the proposal already flags this) — validates personas before design locks in screens
- [ ] Confirm PDPA/BNM legal read on data handling — 1 conversation with a lawyer, cheap insurance

### Phase 1 — Look & Feel (Weeks 3-6)
- [ ] Design system + core screens in Figma or via Claude design tooling: landing, onboarding, home dashboard, capture/review queue, tax dashboard
- [ ] Clickable prototype for the 5-10 user interviews / partner demo
- [ ] Finalize the 10-page IA from the proposal (Section 7) — lock ordering and scope before wireframes get too detailed

### Phase 2 — MVP Build (Weeks 6-14)
- [ ] Backend scaffold on Supabase (auth, DB schema per the record structure in Section 8/9 of the proposal, storage buckets)
- [ ] Mobile app shell (Expo) + web app shell, shared design system components
- [ ] Receipt capture → OCR → confirmation flow (the core loop)
- [ ] Manual statement upload + parser (using Week 1-3 validation results)
- [ ] Basic dashboard + local storage
- [ ] Internal alpha testing

### Phase 3 — Tax Features & Cloud Sync (Weeks 14-20)
- [ ] Gmail invoice detection (assuming API approval has come through)
- [ ] LHDN relief-category mapping using curated rules table
- [ ] Encrypted cloud sync for premium tier
- [ ] Budgets & alerts

### Phase 4 — Polish & Launch Prep (Weeks 20-24)
- [ ] Anomaly detection, recurring payment tracking
- [ ] Year-end tax pack export
- [ ] Security review, PDPA consent flow legal sign-off
- [ ] Target launch window: ahead of LHDN tax season (Mar-Apr), per the proposal's go-to-market plan

*Timeline assumes a small team (2-4 people) working focused, not full-time headcount of 10. Compress or stretch based on who's actually building.*

---

## 5. Open Decisions Before Moving to Design

1. **Team/resourcing** — proposal's Section 15 is still blank. Who's actually building this determines whether the timeline above is realistic.
2. **Funding ask** — affects whether you're bootstrapping (favors the lean Supabase stack above) or can staff up faster.
3. **Confirm React Native vs. Flutter** — recommendation above assumes JS-fluent team; flag if that's wrong.

## Next Step

Ready to move into Phase 1 (look & feel) — that can start now in parallel with the Phase 0 validation items above, since design doesn't block on the statement-parsing tests. Say the word and I'll set up the design pass.
