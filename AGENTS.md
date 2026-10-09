# AGENTS.md

CatchUp AI is a **local-only** static React app: it parses WhatsApp/Telegram chat exports in the browser and produces a structured "what did I miss" report. There is intentionally **no backend, no database, no network calls with conversation data**. Do not add server functions, analytics, remote AI APIs, or font/CDN requests — that would break the core privacy promise (and the CSP in `netlify.toml` would block them anyway).

## Layout

- `src/parsers.ts` — file → `Conversation[]`. WhatsApp (Android/iOS, d/m order detection via evidence → chronology → locale), Telegram JSON, generic text/JSON/CSV, zip via `fflate` (only `.txt/.json` entries decompressed).
- `src/analyzer.ts` — pure, deterministic analysis: regex signal detection (requests, questions, urgency, decisions, commitments), `parseDue` date/deadline resolution relative to the message timestamp, scoring → priority, missed-reply detection, extractive per-chat summaries, report headline/briefing.
- `src/report.ts` — Markdown/JSON export, download helper.
- `src/sample.ts` — demo exports generated relative to "now" in real export formats (WhatsApp dates follow the browser locale order).
- `src/storage.ts` — the *only* persistence: prefs + opaque IDs in `localStorage` under the `catchup:` prefix. Never persist message text.
- `src/components/` — `Consent` (permission gate), `Workspace` (import + "which one is you" + time window), `ReportView` (sections 01–05), `FindingCard`, `OnDeviceSummary` (optional Chrome built-in Summarizer API, feature-detected), `PrivacyShield` (live cross-origin request counter), `Modal`, `PlatformMark`.
- `public/sw.js` — same-origin app-shell cache for offline use.
- `tests/` — Vitest unit tests for parsers/analyzer and a UI flow test.

## Conventions

- Analyzer stays pure and synchronous: `analyze(conversations, { myNames, since, now })`. Pass `now` explicitly so tests are deterministic.
- Scoring thresholds: ≥65 urgent, ≥45 high, ≥25 medium. Tune weights in `analyzeConversation` and re-check the sample report.
- Be honest in UI copy: the engine is pattern-based; only the optional browser-provided model is "AI", and it is on-device.
- Styling: single `src/styles.css` with CSS variables for dark/light themes; Instrument Serif (display), IBM Plex Sans (body), IBM Plex Mono (metadata). Print styles produce a clean PDF.
- `npm run build` is `vite build` only; use `npm run typecheck` for TypeScript checks.
