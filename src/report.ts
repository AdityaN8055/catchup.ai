import { formatDue, relativeDue, type Finding, type Report } from './analyzer';

const fmtStamp = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function stamp(d: Date | null): string {
  return d ? fmtStamp.format(d) : 'no time';
}

function line(f: Finding, report: Report, done: Set<string>): string {
  const box = done.has(f.id) ? '[x]' : '[ ]';
  const due = f.due ? ` — **${formatDue(f.due, report.options.now)}** (${relativeDue(f.due, report.options.now)})` : '';
  const flags = [f.overdue && 'OVERDUE', f.missed && 'NO REPLY'].filter(Boolean).join(', ');
  return `- ${box} ${f.title}${due}${flags ? ` · _${flags}_` : ''}\n  - ${f.message.sender} in ${f.conversationName}, ${stamp(f.message.timestamp)} · ${f.priority}`;
}

export function toMarkdown(report: Report, done: Set<string>): string {
  const { stats, findings } = report;
  const out: string[] = [];
  out.push(`# CatchUp briefing — ${stamp(report.generatedAt)}`);
  out.push('');
  out.push(`> ${report.headline}`);
  out.push('');
  out.push('Processed entirely on this device. Findings are pattern-based suggestions; verify important items against the original chat.');
  out.push('');
  out.push(`| Chats | Messages | Urgent | For you | Deadlines | Overdue | No reply | Decisions |`);
  out.push(`|---|---|---|---|---|---|---|---|`);
  out.push(`| ${stats.chats} | ${stats.messages} | ${stats.urgent} | ${stats.tasksForMe} | ${stats.deadlines} | ${stats.overdue} | ${stats.missed} | ${stats.decisions} |`);
  out.push('');
  out.push('## Briefing');
  report.briefing.forEach((b) => out.push(`- ${b}`));

  const section = (title: string, items: Finding[]) => {
    out.push('', `## ${title}`);
    if (!items.length) out.push('_Nothing found._');
    items.forEach((f) => out.push(line(f, report, done)));
  };

  for (const p of ['urgent', 'high', 'medium'] as const) {
    section(`Action items — ${p}`, findings.filter((f) => f.priority === p && f.forMe && !f.kinds.includes('decision')));
  }
  section(
    'Deadlines & dates',
    findings.filter((f) => f.due).sort((a, b) => a.due!.date.getTime() - b.due!.date.getTime())
  );
  section('Missed mentions & unanswered questions', findings.filter((f) => f.missed));
  section('Decisions', findings.filter((f) => f.kinds.includes('decision')));

  out.push('', '## Conversations');
  for (const c of report.conversations) {
    out.push('', `### ${c.conversation.name} (${c.conversation.platform}, ${c.analyzedCount} messages)`);
    out.push(c.overview);
    if (c.keyPoints.length) {
      out.push('', 'Key points:');
      c.keyPoints.forEach((k) => out.push(`- ${k.tag ? `**${k.tag}:** ` : ''}${k.message.sender}: ${k.message.text.replace(/\s+/g, ' ')}`));
    }
  }
  return out.join('\n');
}

export function toJson(report: Report, done: Set<string>): string {
  return JSON.stringify(
    {
      generatedAt: report.generatedAt.toISOString(),
      processing: 'on-device, pattern-based',
      headline: report.headline,
      briefing: report.briefing,
      stats: report.stats,
      findings: report.findings.map((f) => ({
        chat: f.conversationName,
        platform: f.platform,
        priority: f.priority,
        score: f.score,
        kinds: f.kinds,
        text: f.message.text,
        from: f.message.sender,
        sentAt: f.message.timestamp?.toISOString() ?? null,
        due: f.due ? f.due.date.toISOString() : null,
        forYou: f.forMe,
        unanswered: f.missed,
        overdue: f.overdue,
        done: done.has(f.id),
        reasons: f.reasons
      })),
      conversations: report.conversations.map((c) => ({
        name: c.conversation.name,
        platform: c.conversation.platform,
        messages: c.analyzedCount,
        topics: c.topics,
        overview: c.overview,
        keyPoints: c.keyPoints.map((k) => ({ from: k.message.sender, text: k.message.text, tag: k.tag }))
      }))
    },
    null,
    2
  );
}

export function download(fileName: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
