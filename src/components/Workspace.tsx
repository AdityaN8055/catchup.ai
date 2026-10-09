import { useMemo, useRef, useState, type DragEvent } from 'react';
import { CalendarClock, FileText, Inbox, Loader2, Sparkles, Trash2, Upload, User, Wand2 } from 'lucide-react';
import { ACCEPTED_EXTENSIONS, parseFile, type Conversation } from '../parsers';
import { PlatformMark } from './PlatformMark';

export type WindowMode = 'all' | '24h' | '3d' | '7d' | 'custom';

export interface Calibration {
  myNames: string[];
  windowMode: WindowMode;
  customSince: string;
}

const GUIDES = {
  whatsapp: {
    label: 'WhatsApp',
    steps: [
      'Open the chat (individual or group) on your phone.',
      'Tap ⋮ (Android) or the chat name (iPhone) → More → Export chat.',
      'Choose “Without media” — it’s smaller and faster.',
      'Save the .txt or .zip to your device and select it here.'
    ]
  },
  telegram: {
    label: 'Telegram',
    steps: [
      'Open Telegram Desktop and the chat you want to catch up on.',
      'Click ⋮ → Export chat history.',
      'Untick photos/videos and set Format to “Machine-readable JSON”.',
      'Select the exported result.json here.'
    ]
  }
} as const;

interface Props {
  conversations: Conversation[];
  onAdd: (convs: Conversation[]) => void;
  onRemove: (id: string) => void;
  onSample: () => void;
  calibration: Calibration;
  onCalibrate: (c: Calibration) => void;
  onGenerate: () => void;
}

export function Workspace({ conversations, onAdd, onRemove, onSample, calibration, onCalibrate, onGenerate }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [guide, setGuide] = useState<keyof typeof GUIDES>('whatsapp');
  const [alias, setAlias] = useState('');

  const handleFiles = async (files: FileList | File[]) => {
    const list = [...files];
    if (!list.length) return;
    setBusy(true);
    const errs: string[] = [];
    const parsed: Conversation[] = [];
    for (const f of list) {
      try {
        const convs = await parseFile(f);
        const usable = convs.filter((c) => c.messages.length);
        if (!usable.length) errs.push(`${f.name}: no messages were recognised.`);
        parsed.push(...usable);
      } catch (e) {
        errs.push(e instanceof Error ? e.message : `${f.name}: could not be read.`);
      }
    }
    setErrors(errs);
    if (parsed.length) onAdd(parsed);
    setBusy(false);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
  };

  const participants = useMemo(() => {
    const counts = new Map<string, number>();
    conversations.forEach((c) => c.messages.forEach((m) => counts.set(m.sender, (counts.get(m.sender) ?? 0) + 1)));
    // Shared participants across chats are most likely the user, so rank them first.
    const chatsPer = new Map<string, number>();
    conversations.forEach((c) => c.participants.forEach((p) => chatsPer.set(p, (chatsPer.get(p) ?? 0) + 1)));
    return [...counts.keys()]
      .filter((p) => p !== 'Unknown')
      .sort((a, b) => (chatsPer.get(b) ?? 0) - (chatsPer.get(a) ?? 0) || (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  }, [conversations]);

  const toggleName = (name: string) => {
    const has = calibration.myNames.includes(name);
    onCalibrate({ ...calibration, myNames: has ? calibration.myNames.filter((n) => n !== name) : [...calibration.myNames, name] });
  };

  const addAlias = () => {
    const a = alias.trim().replace(/^@/, '');
    if (a && !calibration.myNames.includes(a)) onCalibrate({ ...calibration, myNames: [...calibration.myNames, a] });
    setAlias('');
  };

  const totalMessages = conversations.reduce((s, c) => s + c.messages.length, 0);
  const extras = calibration.myNames.filter((n) => !participants.includes(n));

  return (
    <main className="workspace">
      <header className="ws-head rise">
        <p className="eyebrow">Step 1 of 2 · Import</p>
        <h1>
          Bring in the chats <em>you want to catch up on.</em>
        </h1>
        <p className="lede">Files are opened by your browser and read into memory. Nothing is uploaded — try it in airplane mode.</p>
      </header>

      <div className="ws-grid">
        <section className="panel rise" style={{ animationDelay: '60ms' }}>
          <div
            className={`dropzone ${dragging ? 'is-drag' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {busy ? <Loader2 className="spin" size={28} /> : <Upload size={28} />}
            <p>
              <strong>Drop WhatsApp or Telegram exports</strong>
              <br />
              <span className="muted">.txt · .zip · Telegram result.json · .csv</span>
            </p>
            <div className="row">
              <button className="btn primary" onClick={() => inputRef.current?.click()} disabled={busy}>
                <FileText size={16} /> Choose files
              </button>
              <button className="btn ghost" onClick={onSample} disabled={busy}>
                <Sparkles size={16} /> Try sample chats
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              accept={ACCEPTED_EXTENSIONS.join(',')}
              onChange={(e) => {
                if (e.target.files) void handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {errors.length > 0 && (
            <ul className="errors" role="alert">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <div className="guide">
            <div className="tabs" role="tablist">
              {(Object.keys(GUIDES) as (keyof typeof GUIDES)[]).map((k) => (
                <button key={k} role="tab" aria-selected={guide === k} className={guide === k ? 'is-active' : ''} onClick={() => setGuide(k)}>
                  <PlatformMark platform={k} /> How to export from {GUIDES[k].label}
                </button>
              ))}
            </div>
            <ol>
              {GUIDES[guide].steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>

          <h3 className="sub">
            Loaded chats <span className="muted">· {conversations.length} chats, {totalMessages} messages</span>
          </h3>
          {conversations.length === 0 ? (
            <div className="empty">
              <Inbox size={22} />
              <p>No chats yet. Import an export above, or load the sample chats to see a full report.</p>
            </div>
          ) : (
            <ul className="chat-list">
              {conversations.map((c) => (
                <li key={c.id}>
                  <PlatformMark platform={c.platform} />
                  <div>
                    <strong>{c.name}</strong>
                    <span className="muted">
                      {c.messages.length} messages · {c.participants.length} people
                    </span>
                  </div>
                  <button className="icon-btn" onClick={() => onRemove(c.id)} aria-label={`Remove ${c.name}`}>
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel calibrate rise" style={{ animationDelay: '120ms' }}>
          <p className="eyebrow">Step 2 of 2 · Calibrate</p>
          <h3 className="sub">
            <User size={16} /> Which one is you?
          </h3>
          <p className="muted small">
            Lets CatchUp spot mentions of you, requests aimed at you, and messages you never replied to.
          </p>
          {participants.length === 0 ? (
            <p className="muted small">Participants appear here once chats are loaded.</p>
          ) : (
            <div className="chips">
              {participants.map((p) => (
                <button key={p} className={`pick ${calibration.myNames.includes(p) ? 'is-on' : ''}`} onClick={() => toggleName(p)} aria-pressed={calibration.myNames.includes(p)}>
                  {p}
                </button>
              ))}
              {extras.map((p) => (
                <button key={p} className="pick is-on" onClick={() => toggleName(p)} aria-pressed>
                  @{p}
                </button>
              ))}
            </div>
          )}
          <div className="alias-row">
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAlias()}
              placeholder="Add a nickname or @handle"
              aria-label="Add a nickname or handle"
            />
            <button className="btn ghost" onClick={addAlias} disabled={!alias.trim()}>
              Add
            </button>
          </div>

          <h3 className="sub">
            <CalendarClock size={16} /> What did you miss?
          </h3>
          <div className="segmented" role="radiogroup" aria-label="Time window">
            {(
              [
                ['all', 'Everything'],
                ['24h', 'Last 24 h'],
                ['3d', '3 days'],
                ['7d', '7 days'],
                ['custom', 'Since…']
              ] as [WindowMode, string][]
            ).map(([k, label]) => (
              <button key={k} role="radio" aria-checked={calibration.windowMode === k} className={calibration.windowMode === k ? 'is-active' : ''} onClick={() => onCalibrate({ ...calibration, windowMode: k })}>
                {label}
              </button>
            ))}
          </div>
          {calibration.windowMode === 'custom' && (
            <input
              type="datetime-local"
              className="since"
              value={calibration.customSince}
              onChange={(e) => onCalibrate({ ...calibration, customSince: e.target.value })}
              aria-label="Messages since"
            />
          )}

          <button className="btn primary wide big" onClick={onGenerate} disabled={!conversations.length}>
            <Wand2 size={18} /> Generate my briefing
          </button>
          {!calibration.myNames.length && conversations.length > 0 && (
            <p className="hint">Tip: pick your name first for missed-mention detection.</p>
          )}
        </section>
      </div>
    </main>
  );
}
