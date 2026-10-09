# CatchUp AI — Know what matters

CatchUp turns long WhatsApp and Telegram conversations into a clear, structured briefing — concise per-chat summaries, action items ranked by urgency and relevance, a deadline timeline, decisions, and the mentions and questions you never replied to. **Everything is processed inside your browser. Conversations are never uploaded, never stored, and the site's security policy blocks the page from contacting any other server.**

## What it does

- **Explicit permission first.** A consent screen explains exactly what happens to your data; nothing can be imported until you grant access. "Revoke & wipe" clears every chat, report and preference instantly.
- **Imports real exports.** WhatsApp `.txt` and `.zip` exports (Android and iOS formats, day/month order auto-detected), Telegram Desktop `result.json` (single chat or full export), plus generic text, JSON arrays and CSV. Zip media is never decompressed.
- **Knows who you are.** Pick your name from the participants (plus nicknames or @handles) to detect mentions, requests aimed at you, your own promises, and unanswered messages.
- **"What did I miss?" window.** Analyse everything, or only the last 24 h / 3 days / 7 days / since a specific time.
- **Structured report.**
  1. *Needs you* — tasks, questions and commitments grouped by Urgent / High / Medium / Low
  2. *Deadlines & dates* — a timeline with overdue items highlighted
  3. *Missed mentions & unanswered* — things aimed at you with no reply since
  4. *Decisions made*
  5. *Conversation summaries* — overview, topics and key messages for every chat
- **Understands time phrases** like "by EOD", "tomorrow 10am", "next Tuesday at 4:30pm", "15 October", "in 2 days", "end of week".
- **Filter, search and tick off** items (completion state is stored as opaque IDs only). Export to Markdown or JSON, copy, or print to PDF.
- **Optional on-device AI.** In browsers that ship a built-in local model (Chrome's Summarizer API), each chat can be rewritten as an AI summary — still fully on-device. Otherwise the app uses its own pattern-based engine.
- **Visible privacy proof.** A live "external requests" counter in the header audits the page's network activity. Installable as a PWA and works offline (try airplane mode).

## Privacy model

| What | Where it lives |
|---|---|
| Chat text, parsed messages, reports | Tab memory only — gone on close/refresh |
| Theme, consent timestamp, names you picked as "you", IDs of ticked items | `localStorage` — removed by "Revoke & wipe" |
| Fonts | Bundled with the app (no font CDN) |
| Network | `Content-Security-Policy: connect-src 'self'` (see `netlify.toml`) — no backend, analytics or cloud AI |

Findings are pattern-based suggestions; always verify high-stakes items against the original chat.

## Tech

React 18 + TypeScript + Vite, `fflate` for in-browser unzip, `lucide-react` icons, self-hosted Fontsource fonts, Vitest + Testing Library. Deployed as a static site on Netlify.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev        # start Vite
npm test           # unit + UI tests
npm run typecheck  # TypeScript project check
npm run build      # production build into dist/
```

Click **Try sample chats** on the import screen for a full demo with a WhatsApp group, a WhatsApp DM and a Telegram group.

## Exporting your chats

- **WhatsApp:** open the chat → ⋮ / chat name → More → *Export chat* → *Without media*.
- **Telegram:** Telegram Desktop → chat → ⋮ → *Export chat history* → untick media, Format: *Machine-readable JSON*.

## Ideas for later

- Bundled open-weight model via WebGPU for richer abstractive summaries in all browsers
- Telegram HTML export support
- Language packs for non-English date/urgency phrases
