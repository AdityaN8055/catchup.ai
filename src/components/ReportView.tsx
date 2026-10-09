import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronDown, Copy, Download, FileJson, Printer, Search, X } from 'lucide-react';
import { formatDue, PRIORITIES, type Finding, type Priority, type Report } from '../analyzer';
import { download, stamp, toJson, toMarkdown } from '../report';
import { FindingCard } from './FindingCard';
import { OnDeviceSummary } from './OnDeviceSummary';
import { PlatformMark, platformLabel } from './PlatformMark';

interface Props {
  report: Report;
  done: Set<string>;
  onToggle: (id: string) => void;
  onBack: () => void;
}

const fmtLong = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function Section({ n, id, title, count, note, children }: { n: string; id: string; title: string; count: number; note?: string; children: ReactNode }) {
  return (
    <section className="r-section" id={id} aria-labelledby={`${id}-h`}>
      <header className="r-section-head">
        <span className="r-num">{n}</span>
        <h2 id={`${id}-h`}>{title}</h2>
        <span className="r-count">{count}</span>
      </header>
      {note && <p className="r-note">{note}</p>}
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="r-empty">
      <Check size={16} /> {children}
    </p>
  );
}

export function ReportView({ report, done, onToggle, onBack }: Props) {
  const [prio, setPrio] = useState<Priority | 'all'>('all');
  const [chat, setChat] = useState('all');
  const [query, setQuery] = useState('');
  const [hideDone, setHideDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const now = report.options.now;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return report.findings.filter(
      (f) =>
        (prio === 'all' || f.priority === prio) &&
        (chat === 'all' || f.conversationId === chat) &&
        (!hideDone || !done.has(f.id)) &&
        (!q || f.message.text.toLowerCase().includes(q) || f.message.sender.toLowerCase().includes(q) || f.conversationName.toLowerCase().includes(q))
    );
  }, [report, prio, chat, query, hideDone, done]);

  const needsYou = filtered.filter((f) => (f.forMe || f.priority === 'urgent') && f.primary !== 'decision' && f.primary !== 'important');
  const needsIds = new Set(needsYou.map((f) => f.id));
  const deadlines = filtered.filter((f) => f.due && (f.kinds.includes('deadline') || f.kinds.includes('event'))).sort((a, b) => a.due!.date.getTime() - b.due!.date.getTime());
  const missed = filtered.filter((f) => f.missed);
  const decisions = filtered.filter((f) => f.kinds.includes('decision'));
  const other = filtered.filter((f) => !needsIds.has(f.id) && !f.kinds.includes('decision'));
  const chats = report.conversations.filter((c) => chat === 'all' || c.conversation.id === chat);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(report, done));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; downloads still work */
    }
  };
  const fileStamp = report.generatedAt.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const doneCount = report.findings.filter((f) => done.has(f.id)).length;

  const card = (f: Finding) => <FindingCard key={f.id} finding={f} now={now} done={done.has(f.id)} onToggle={onToggle} />;

  return (
    <main className="report">
      <div className="report-actions no-print">
        <button className="btn ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Edit chats
        </button>
        <div className="row">
          <button className="btn ghost" onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="btn ghost" onClick={() => download(`catchup-briefing-${fileStamp}.md`, toMarkdown(report, done), 'text/markdown')}>
            <Download size={16} /> Markdown
          </button>
          <button className="btn ghost" onClick={() => download(`catchup-briefing-${fileStamp}.json`, toJson(report, done), 'application/json')}>
            <FileJson size={16} /> JSON
          </button>
          <button className="btn ghost" onClick={() => window.print()}>
            <Printer size={16} /> Print / PDF
          </button>
        </div>
      </div>

      <article className="paper">
        <header className="masthead rise">
          <div className="mast-top">
            <span className="mono">CATCHUP · BRIEFING</span>
            <span className="mono">{fmtLong.format(report.generatedAt)}</span>
          </div>
          <h1 className="headline">{report.headline}</h1>
          <ul className="briefing">
            {report.briefing.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <dl className="stats">
            {(
              [
                ['Urgent', report.stats.urgent, 'urgent'],
                ['For you', report.stats.tasksForMe, ''],
                ['Overdue', report.stats.overdue, report.stats.overdue ? 'urgent' : ''],
                ['No reply', report.stats.missed, report.stats.missed ? 'high' : ''],
                ['Dates', report.stats.deadlines, ''],
                ['Decisions', report.stats.decisions, ''],
                ['Messages', report.stats.messages, '']
              ] as [string, number, string][]
            ).map(([label, value, tone]) => (
              <div key={label} className={`stat ${tone}`}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="disclosure">
            Generated on this device from {report.stats.chats} chat export{report.stats.chats === 1 ? '' : 's'}
            {report.options.since ? ` · messages since ${stamp(report.options.since)}` : ''}. Findings come from pattern analysis, not a cloud
            AI — double-check anything high-stakes against the original chat.
            {!report.identityKnown && ' Pick your name in “Edit chats” to detect mentions and unanswered messages.'}
          </p>
        </header>

        <div className="filters no-print" role="search">
          <div className="segmented small" role="radiogroup" aria-label="Priority">
            {(['all', ...PRIORITIES] as const).map((p) => (
              <button key={p} role="radio" aria-checked={prio === p} className={`${prio === p ? 'is-active' : ''} ${p !== 'all' ? `seg-${p}` : ''}`} onClick={() => setPrio(p)}>
                {p === 'all' ? 'All' : p}
              </button>
            ))}
          </div>
          <select value={chat} onChange={(e) => setChat(e.target.value)} aria-label="Filter by chat">
            <option value="all">All chats</option>
            {report.conversations.map((c) => (
              <option key={c.conversation.id} value={c.conversation.id}>
                {c.conversation.name}
              </option>
            ))}
          </select>
          <label className="search">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people, words, chats" aria-label="Search findings" />
            {query && (
              <button className="icon-btn" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </label>
          <label className="toggle">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
            <span>Hide done ({doneCount})</span>
          </label>
        </div>

        <nav className="toc no-print" aria-label="Report sections">
          <a href="#needs">Needs you</a>
          <a href="#dates">Deadlines</a>
          <a href="#missed">Missed</a>
          <a href="#decisions">Decisions</a>
          <a href="#chats">Summaries</a>
        </nav>

        <Section n="01" id="needs" title="Needs you" count={needsYou.length} note="Requests, questions and promises aimed at you, ranked by urgency and relevance.">
          {needsYou.length ? (
            PRIORITIES.map((p) => {
              const items = needsYou.filter((f) => f.priority === p);
              if (!items.length) return null;
              return (
                <div key={p} className="tier">
                  <h3 className={`tier-h prio-${p}`}>
                    {p} <span>{items.length}</span>
                  </h3>
                  <ul className="findings">{items.map(card)}</ul>
                </div>
              );
            })
          ) : (
            <Empty>Nothing is waiting on you{prio !== 'all' || query ? ' with these filters' : ''}.</Empty>
          )}
        </Section>

        <Section n="02" id="dates" title="Deadlines & dates" count={deadlines.length} note="Everything with a date attached, in time order.">
          {deadlines.length ? (
            <ol className="timeline">
              {deadlines.map((f) => (
                <li key={f.id} className={`${f.overdue ? 'is-overdue' : ''} ${done.has(f.id) ? 'is-done' : ''} p-${f.priority}`}>
                  <span className="tl-when mono">{formatDue(f.due!, now)}</span>
                  <span className="tl-dot" />
                  <div className="tl-body">
                    <p>{f.title}</p>
                    <span className="muted small">
                      <PlatformMark platform={f.platform} /> {f.message.sender} · {f.conversationName}
                      {f.overdue && <strong className="flag flag-overdue">Overdue</strong>}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>No upcoming deadlines found.</Empty>
          )}
        </Section>

        <Section n="03" id="missed" title="Missed mentions & unanswered" count={missed.length} note="People mentioned you or asked you something, and you haven’t replied since.">
          {!report.identityKnown ? (
            <p className="r-empty">Tell CatchUp which participant is you to detect missed mentions.</p>
          ) : missed.length ? (
            <ul className="findings">{missed.map(card)}</ul>
          ) : (
            <Empty>You’ve responded to everything aimed at you.</Empty>
          )}
        </Section>

        <Section n="04" id="decisions" title="Decisions made" count={decisions.length}>
          {decisions.length ? (
            <ul className="decisions">
              {decisions.map((f) => (
                <li key={f.id}>
                  <p>“{f.title}”</p>
                  <span className="muted small">
                    <PlatformMark platform={f.platform} /> {f.message.sender} · {f.conversationName} · {stamp(f.message.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No decisions were recorded.</Empty>
          )}
        </Section>

        <Section n="05" id="chats" title="Conversation summaries" count={chats.length} note="Each chat condensed: what it was about, what was raised, and the messages worth reading.">
          <div className="summaries">
            {chats.map((c) => (
              <article key={c.conversation.id} className="summary">
                <header>
                  <PlatformMark platform={c.conversation.platform} />
                  <div>
                    <h3>{c.conversation.name}</h3>
                    <span className="muted small">
                      {platformLabel(c.conversation.platform)} · {c.isGroup ? 'Group' : 'Direct'} · {c.analyzedCount} messages
                      {c.start && c.end ? ` · ${fmtShort.format(c.start)} – ${fmtShort.format(c.end)}` : ''}
                    </span>
                  </div>
                  <div className="mini-counts">
                    {c.counts.urgent > 0 && <span className="prio prio-urgent">{c.counts.urgent} urgent</span>}
                    {c.counts.missed > 0 && <span className="flag flag-missed">{c.counts.missed} no reply</span>}
                  </div>
                </header>
                <p className="overview">{c.overview}</p>
                {c.topics.length > 0 && (
                  <div className="topics">
                    {c.topics.map((t) => (
                      <span key={t}>#{t.replace(/\s+/g, '-')}</span>
                    ))}
                  </div>
                )}
                {c.keyPoints.length > 0 && (
                  <ul className="keypoints">
                    {c.keyPoints.map((k) => (
                      <li key={k.message.id}>
                        {k.tag && <span className="kp-tag">{k.tag}</span>}
                        <span className="kp-who">{k.message.sender.split(/\s+/)[0]}</span>
                        <span className="kp-text">{k.message.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <OnDeviceSummary conversation={c.conversation} since={report.options.since} />
              </article>
            ))}
          </div>
        </Section>

        {other.length > 0 && (
          <section className="r-section other no-print">
            <button className="why big" onClick={() => setShowOther((s) => !s)} aria-expanded={showOther}>
              {showOther ? 'Hide' : 'Show'} {other.length} lower-relevance item{other.length === 1 ? '' : 's'} from your chats
              <ChevronDown size={14} className={showOther ? 'rot' : ''} />
            </button>
            {showOther && <ul className="findings">{other.map(card)}</ul>}
          </section>
        )}

        <footer className="paper-foot mono">Processed locally · nothing uploaded · {stamp(report.generatedAt)}</footer>
      </article>
    </main>
  );
}
