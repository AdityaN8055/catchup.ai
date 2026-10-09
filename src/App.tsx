import { useCallback, useEffect, useMemo, useState } from 'react';
import { HelpCircle, Lock, Moon, ShieldOff, Sun } from 'lucide-react';
import { analyze, type Report } from './analyzer';
import { parseContent, type Conversation } from './parsers';
import { buildSampleFiles, SAMPLE_USER } from './sample';
import { KEYS, load, save, wipeAll } from './storage';
import { Consent } from './components/Consent';
import { Modal } from './components/Modal';
import { externalRequests, PrivacyShield } from './components/PrivacyShield';
import { ReportView } from './components/ReportView';
import { Workspace, type Calibration } from './components/Workspace';

type Theme = 'dark' | 'light';

function sinceFrom(c: Calibration, now: Date): Date | null {
  const hours = { all: 0, '24h': 24, '3d': 72, '7d': 168, custom: 0 }[c.windowMode];
  if (hours) return new Date(now.getTime() - hours * 36e5);
  if (c.windowMode === 'custom' && c.customSince) {
    const d = new Date(c.customSince);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => load<Theme>(KEYS.theme, 'dark'));
  const [consented, setConsented] = useState<boolean>(() => !!load<string | null>(KEYS.consent, null));
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [calibration, setCalibration] = useState<Calibration>(() => ({ myNames: load<string[]>(KEYS.names, []), windowMode: 'all', customSince: '' }));
  const [report, setReport] = useState<Report | null>(null);
  const [done, setDone] = useState<Set<string>>(() => new Set(load<string[]>(KEYS.done, [])));
  const [dialog, setDialog] = useState<'privacy' | 'help' | 'revoke' | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    save(KEYS.theme, theme);
  }, [theme]);

  useEffect(() => save(KEYS.names, calibration.myNames), [calibration.myNames]);

  const grant = () => {
    save(KEYS.consent, new Date().toISOString());
    setConsented(true);
  };

  const revoke = () => {
    setConversations([]);
    setReport(null);
    setDone(new Set());
    setCalibration({ myNames: [], windowMode: 'all', customSince: '' });
    wipeAll();
    setConsented(false);
    setDialog(null);
  };

  const addConversations = (incoming: Conversation[]) =>
    setConversations((prev) => {
      const ids = new Set(prev.map((c) => c.id));
      return [...prev, ...incoming.filter((c) => !ids.has(c.id))];
    });

  const loadSample = () => {
    const convs = buildSampleFiles().flatMap((f) => parseContent(f.content, f.name));
    setConversations(convs);
    setCalibration((c) => ({ ...c, myNames: c.myNames.includes(SAMPLE_USER) ? c.myNames : [...c.myNames, SAMPLE_USER] }));
  };

  const generate = () => {
    const now = new Date();
    setReport(analyze(conversations, { myNames: calibration.myNames, since: sinceFrom(calibration, now), now }));
    window.scrollTo({ top: 0 });
  };

  const toggleDone = useCallback((id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save(KEYS.done, [...next].slice(-2000));
      return next;
    });
  }, []);

  const external = useMemo(() => (dialog === 'privacy' ? externalRequests() : []), [dialog]);

  return (
    <div className="app">
      <div className="grain" aria-hidden="true" />
      <header className="topbar no-print">
        <a className="brand" href="/" onClick={(e) => { e.preventDefault(); setReport(null); }}>
          <span className="brand-mark" aria-hidden="true">
            <Lock size={14} strokeWidth={2.5} />
          </span>
          CatchUp<span className="brand-ai">AI</span>
        </a>
        <div className="topbar-right">
          <PrivacyShield onClick={() => setDialog('privacy')} />
          <button className="icon-btn" onClick={() => setDialog('help')} aria-label="Help">
            <HelpCircle size={18} />
          </button>
          <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {consented && (
            <button className="btn ghost small danger" onClick={() => setDialog('revoke')}>
              <ShieldOff size={15} /> <span className="hide-sm">Revoke & wipe</span>
            </button>
          )}
        </div>
      </header>

      {!consented ? (
        <Consent onGrant={grant} onPrivacy={() => setDialog('privacy')} />
      ) : report ? (
        <ReportView report={report} done={done} onToggle={toggleDone} onBack={() => setReport(null)} />
      ) : (
        <Workspace
          conversations={conversations}
          onAdd={addConversations}
          onRemove={(id) => setConversations((prev) => prev.filter((c) => c.id !== id))}
          onSample={loadSample}
          calibration={calibration}
          onCalibrate={setCalibration}
          onGenerate={generate}
        />
      )}

      {dialog === 'privacy' && (
        <Modal title="How your data is handled" onClose={() => setDialog(null)}>
          <ul className="policy">
            <li>
              <strong>No uploads.</strong> Export files are read by your browser with the File API. Their contents are never sent anywhere.
            </li>
            <li>
              <strong>No storage of conversations.</strong> Chat text is held in this tab’s memory only. Close or refresh the tab and it is gone.
            </li>
            <li>
              <strong>Enforced, not just promised.</strong> The site ships a Content-Security-Policy that only allows the page to contact its
              own origin, so scripts on this page cannot transmit your chats to any other server.
            </li>
            <li>
              <strong>Works offline.</strong> After the first visit the app is cached on your device. Turn on airplane mode and it still works.
            </li>
            <li>
              <strong>What is saved locally:</strong> your theme, your consent timestamp, the names you picked as “you”, and opaque IDs of items you
              ticked off. “Revoke & wipe” deletes all of it.
            </li>
            <li>
              <strong>No accounts, analytics, trackers or cloud AI.</strong> Summaries are generated by on-device pattern analysis. If your browser
              offers a built-in on-device model (Chrome), you can optionally use it — it also runs locally.
            </li>
          </ul>
          <p className={`net-audit ${external.length ? 'warn' : ''}`}>
            Live network audit: this page has made <strong>{external.length}</strong> request{external.length === 1 ? '' : 's'} to other origins
            since it opened.
          </p>
          {external.length > 0 && (
            <ul className="mono small">
              {external.map((u) => (
                <li key={u}>{new URL(u).origin}</li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {dialog === 'help' && (
        <Modal title="Getting the best briefing" onClose={() => setDialog(null)}>
          <ol className="policy">
            <li>Export the chats you’ve fallen behind on (WhatsApp: Export chat → Without media; Telegram Desktop: Export chat history → JSON).</li>
            <li>Import as many as you like — CatchUp merges them into one report.</li>
            <li>Pick which participant is you. This powers mention, unanswered-question and “your promise” detection.</li>
            <li>Choose a time window, like “Last 24 h”, to focus on what you actually missed.</li>
            <li>Tick off items as you handle them. Export as Markdown or JSON, or print to PDF.</li>
          </ol>
          <p className="muted small">
            Detection is pattern-based: it understands phrases like “by EOD”, “tomorrow 10am”, “@you can you…”, “we decided…”, and urgency
            words like “ASAP”. It can miss nuance or flag false positives, so verify important items in the original chat.
          </p>
        </Modal>
      )}

      {dialog === 'revoke' && (
        <Modal title="Revoke access and wipe" onClose={() => setDialog(null)}>
          <p>This immediately clears every loaded chat and report from memory, deletes all CatchUp preferences from this device, and returns to the permission screen.</p>
          <div className="row end">
            <button className="btn ghost" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button className="btn primary danger-fill" onClick={revoke}>
              <ShieldOff size={16} /> Revoke & wipe now
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
