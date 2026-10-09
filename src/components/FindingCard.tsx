import { useState } from 'react';
import { AtSign, Check, ChevronDown, Clock, Gavel, Handshake, HelpCircle, ListTodo, Megaphone, CalendarDays } from 'lucide-react';
import { formatDue, relativeDue, type Finding, type FindingKind } from '../analyzer';
import { stamp } from '../report';
import { PlatformMark } from './PlatformMark';

const KIND_META: Record<FindingKind, { label: string; Icon: typeof Check }> = {
  task: { label: 'Task', Icon: ListTodo },
  deadline: { label: 'Deadline', Icon: Clock },
  question: { label: 'Question', Icon: HelpCircle },
  mention: { label: 'Mention', Icon: AtSign },
  decision: { label: 'Decision', Icon: Gavel },
  commitment: { label: 'Your promise', Icon: Handshake },
  event: { label: 'Event', Icon: CalendarDays },
  important: { label: 'Update', Icon: Megaphone }
};

interface Props {
  finding: Finding;
  now: Date;
  done: boolean;
  onToggle: (id: string) => void;
  showChat?: boolean;
}

export function FindingCard({ finding: f, now, done, onToggle, showChat = true }: Props) {
  const [open, setOpen] = useState(false);
  const trimmed = f.title.endsWith('…');

  return (
    <li className={`finding p-${f.priority} ${done ? 'is-done' : ''}`}>
      <button className="tick" onClick={() => onToggle(f.id)} aria-pressed={done} aria-label={done ? 'Mark as open' : 'Mark as done'}>
        {done && <Check size={14} strokeWidth={3} />}
      </button>
      <div className="finding-main">
        <div className="finding-tags">
          <span className={`prio prio-${f.priority}`}>{f.priority}</span>
          {f.kinds.slice(0, 3).map((k) => {
            const { label, Icon } = KIND_META[k];
            return (
              <span key={k} className="kind">
                <Icon size={12} /> {label}
              </span>
            );
          })}
          {f.overdue && <span className="flag flag-overdue">Overdue</span>}
          {f.missed && <span className="flag flag-missed">No reply from you</span>}
        </div>
        <p className="finding-title">{f.title}</p>
        <div className="finding-meta">
          {showChat && (
            <span className="meta-chat">
              <PlatformMark platform={f.platform} /> {f.conversationName}
            </span>
          )}
          <span>{f.message.sender}</span>
          <span className="mono">{stamp(f.message.timestamp)}</span>
          {f.due && (
            <span className={`due ${f.overdue ? 'is-overdue' : ''}`}>
              <Clock size={12} /> {formatDue(f.due, now)} · {relativeDue(f.due, now)}
            </span>
          )}
        </div>
        <button className="why" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          Why it’s here <ChevronDown size={13} className={open ? 'rot' : ''} />
        </button>
        {open && (
          <div className="evidence">
            <p className="reasons">{f.reasons.join(' · ') || 'Matched an attention pattern'} · relevance {f.score}/100</p>
            {trimmed && <blockquote>{f.message.text}</blockquote>}
          </div>
        )}
      </div>
    </li>
  );
}
