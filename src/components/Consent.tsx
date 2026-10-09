import { useState } from 'react';
import { Cpu, EyeOff, KeyRound, Lock, ShieldCheck, Sparkles } from 'lucide-react';

const PROMISES = [
  {
    icon: Cpu,
    title: 'Processed on this device',
    body: 'Parsing, summaries and prioritisation run as JavaScript inside this browser tab. There is no server and no cloud AI behind CatchUp.'
  },
  {
    icon: EyeOff,
    title: 'Never stored, never uploaded',
    body: 'Chat text lives in memory only and vanishes when you close the tab. The site’s security policy blocks the page from contacting any other server.'
  },
  {
    icon: KeyRound,
    title: 'You choose exactly what to share',
    body: 'CatchUp can’t reach into WhatsApp or Telegram. It only sees the export files you pick, and you can revoke access and wipe everything at any time.'
  }
];

const CONSENTS = [
  'I choose which WhatsApp and Telegram exports CatchUp may read on this device.',
  'I understand my conversations are analysed locally and are never uploaded or saved.',
  'I have the right to review these conversations.'
];

export function Consent({ onGrant, onPrivacy }: { onGrant: () => void; onPrivacy: () => void }) {
  const [checked, setChecked] = useState<boolean[]>(CONSENTS.map(() => false));
  const ready = checked.every(Boolean);

  return (
    <main className="landing">
      <section className="hero rise">
        <p className="eyebrow">
          <Sparkles size={14} /> The unread problem, solved privately
        </p>
        <h1>
          Four hundred unread messages.
          <br />
          <em>One page that tells you what matters.</em>
        </h1>
        <p className="lede">
          CatchUp turns long WhatsApp and Telegram threads into a structured briefing: concise summaries, action items ranked
          by urgency, deadlines, decisions, and the mentions you missed — all without your conversations ever leaving your
          device.
        </p>

        <div className="specimen" aria-hidden="true">
          <div className="specimen-row urgent">
            <span className="dot" />
            <span className="specimen-text">“@Sam can you send the pitch deck by tomorrow 10am?”</span>
            <span className="chip">Due 10:00</span>
          </div>
          <div className="specimen-row high">
            <span className="dot" />
            <span className="specimen-text">“Did you renew your car insurance?”</span>
            <span className="chip">No reply</span>
          </div>
          <div className="specimen-row medium">
            <span className="dot" />
            <span className="specimen-text">“Decision: we’re going with the Thursday launch.”</span>
            <span className="chip">Decision</span>
          </div>
        </div>
      </section>

      <section className="consent-card rise" style={{ animationDelay: '120ms' }} aria-labelledby="consent-title">
        <div className="consent-seal">
          <Lock size={20} />
        </div>
        <h2 id="consent-title">Before we start: your permission</h2>
        <ul className="promises">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Icon size={18} />
              <div>
                <strong>{title}</strong>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <fieldset className="consents">
          <legend>Grant access</legend>
          {CONSENTS.map((label, i) => (
            <label key={label} className="check">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
              />
              <span className="box" aria-hidden="true" />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <button className="btn primary wide" disabled={!ready} onClick={onGrant}>
          <ShieldCheck size={18} /> Allow on-device access
        </button>
        <button className="link-btn" onClick={onPrivacy}>
          Read exactly how your data is handled
        </button>
      </section>
    </main>
  );
}
