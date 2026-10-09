import type { Conversation, Message, Platform } from './parsers';

export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type FindingKind = 'task' | 'deadline' | 'question' | 'mention' | 'decision' | 'commitment' | 'event' | 'important';

export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];

export interface Due {
  date: Date;
  hasTime: boolean;
  phrase: string;
}

export interface Finding {
  id: string;
  conversationId: string;
  conversationName: string;
  platform: Platform;
  message: Message;
  kinds: FindingKind[];
  primary: FindingKind;
  title: string;
  priority: Priority;
  score: number;
  due: Due | null;
  forMe: boolean;
  missed: boolean;
  overdue: boolean;
  reasons: string[];
}

export interface KeyPoint {
  message: Message;
  tag: string | null;
}

export interface ConversationSummary {
  conversation: Conversation;
  isGroup: boolean;
  analyzedCount: number;
  start: Date | null;
  end: Date | null;
  topSenders: { name: string; count: number }[];
  topics: string[];
  overview: string;
  keyPoints: KeyPoint[];
  findings: Finding[];
  counts: { tasks: number; deadlines: number; decisions: number; missed: number; urgent: number };
  topScore: number;
}

export interface AnalyzeOptions {
  /** Names/handles the user appears as in their chats. */
  myNames: string[];
  /** Only analyze messages after this moment ("unread since"). */
  since: Date | null;
  /** Reference "now" for overdue / due-soon calculations. */
  now: Date;
}

export interface Report {
  generatedAt: Date;
  options: AnalyzeOptions;
  conversations: ConversationSummary[];
  findings: Finding[];
  headline: string;
  briefing: string[];
  stats: {
    chats: number;
    messages: number;
    urgent: number;
    tasksForMe: number;
    deadlines: number;
    overdue: number;
    missed: number;
    decisions: number;
  };
  identityKnown: boolean;
}

/* ------------------------------------------------------------------ */
/* Signal patterns                                                     */
/* ------------------------------------------------------------------ */

const URGENT = /\b(urgent(ly)?|asap|a\.s\.a\.p|immediately|right away|right now|critical|emergency|blocker|blocking|top priority|time[- ]sensitive|overdue|last chance|final reminder)\b|!!|🚨|⚠️/i;
const REQUEST =
  /\b(can|could|would|will) (you|u|someone|anyone|somebody)\b|\bplease\b|\bpls\b|\bplz\b|\bkindly\b|\bneed (you|someone|somebody|u) to\b|\bmake sure\b|\bdon'?t forget\b|\bremember to\b|\baction items?\b|\bto-?do\b|\byou (need|have|should|must|gotta)\b|\bassign(ed)? to\b|\bfollow[- ]?up\b|\bwho can\b|\bsomeone needs to\b|\bmind (sending|checking|taking|sharing)\b|\bwaiting (on|for) (you|yours)\b|\bstill waiting\b/i;
const IMPERATIVE =
  /^(?:(?:hey|hi|ok|okay)\b[^a-z]*)?(?:@\S+[,:]?\s+)?(?:please\s+)?(send|review|submit|call|book|finish|update|check|share|confirm|pay|sign|prepare|schedule|fix|upload|bring|email|reply|respond|approve|complete|order|buy|pick up|drop off|fill|forward|ping|text|join|read|draft|print|renew|cancel|register|transfer|grab|ask|tell|let me know)\b/i;
const COMMIT = /\b(i'?ll|i will|i'?m going to|i can take|will do|on it|leave it with me|let me (handle|check|take|look))\b/i;
const DECISION =
  /\b(decided|decision|we'?ll go with|going with|let'?s go with|agreed|confirmed|approved|finali[sz]ed|settled on|it'?s official|we chose|consensus)\b/i;
const QUESTION_START = /^(who|what|when|where|why|how|which|can|could|would|will|should|shall|do|does|did|is|are|was|were|have|has|any|anyone|u|you)\b/i;
const IMPORTANT =
  /\b(important|fyi|heads up|heads-up|note that|announcement|reminder|moved to|rescheduled|cancell?ed|postponed|new (date|time|address|link)|got moved|expires?|expiring)\b/i;
const MONEY = /[$€£₹¥]\s?\d|\b\d+(?:[.,]\d+)?\s?(usd|eur|gbp|inr|dollars|euros|bucks|pounds)\b/i;
const EVENT =
  /\b(meeting|call|appointment|interview|demo|standup|stand-up|sync|webinar|party|dinner|lunch|flight|train|exam|class|session|presentation|inspection|birthday|wedding|delivery|deadline)\b/i;
const DEADLINE_CUE = /\b(by|due|deadline|before|until|till|no later than|eod|eow|cut-?off|expires?|latest)\b/i;
const GROUP_MENTION = /@(all|everyone|channel|here)\b|\b(everyone|all of you|everybody|each of you|you all|y'?all|you guys)\b/i;
const ACK = /^(ok(ay)?|k|thanks?|thank you|thx|ty|lol|haha+|👍|🙏|❤️|yes|yep|yeah|sure|cool|nice|great|noted)[.! ]*$/i;

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6
};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

/* ------------------------------------------------------------------ */
/* Deadline / date extraction                                          */
/* ------------------------------------------------------------------ */

function atDay(base: Date, addDays: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + addDays);
  d.setHours(23, 59, 0, 0);
  return d;
}

function extractTime(text: string): { h: number; m: number; phrase: string } | null {
  if (/\bnoon\b|\bmidday\b/i.test(text)) return { h: 12, m: 0, phrase: 'noon' };
  if (/\bmidnight\b/i.test(text)) return { h: 23, m: 59, phrase: 'midnight' };
  const ampm = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i.exec(text);
  if (ampm) {
    let h = Number(ampm[1]);
    if (h > 12) return null;
    const pm = /p/i.test(ampm[3]);
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return { h, m: Number(ampm[2] ?? 0), phrase: ampm[0] };
  }
  const h24 = /\b(?:at|by|before|from|@)\s*(\d{1,2})[:.](\d{2})\b/i.exec(text);
  if (h24 && Number(h24[1]) < 24) return { h: Number(h24[1]), m: Number(h24[2]), phrase: h24[0] };
  return null;
}

/**
 * Finds the first date/deadline expression in `text`, resolved relative to
 * `base` (normally the time the message was sent).
 */
export function parseDue(text: string, base: Date): Due | null {
  const t = text.toLowerCase();
  let day: Date | null = null;
  let phrase = '';
  let defaultHour: number | null = null;
  let m: RegExpExecArray | null;

  if ((m = /\b(eod|end of (?:the )?day|cob|close of business)\b/.exec(t))) {
    day = atDay(base, 0);
    defaultHour = 18;
    phrase = m[0];
  } else if ((m = /\btonight\b/.exec(t))) {
    day = atDay(base, 0);
    defaultHour = 21;
    phrase = m[0];
  } else if ((m = /\b(today|this (?:morning|afternoon|evening))\b/.exec(t))) {
    day = atDay(base, 0);
    phrase = m[0];
  } else if ((m = /\b(tomorrow|tmrw|tmr|tomorow)\b/.exec(t))) {
    day = atDay(base, 1);
    phrase = m[0];
  } else if ((m = /\b(day after tomorrow)\b/.exec(t))) {
    day = atDay(base, 2);
    phrase = m[0];
  } else if ((m = /\bin (\d{1,2}|a|an|one|two|three|a couple of) (hours?|days?|weeks?)\b/.exec(t))) {
    const words: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, 'a couple of': 2 };
    const n = words[m[1]] ?? Number(m[1]);
    const d = new Date(base);
    if (m[2].startsWith('hour')) {
      d.setHours(d.getHours() + n);
      return { date: d, hasTime: true, phrase: m[0] };
    }
    day = atDay(base, m[2].startsWith('week') ? n * 7 : n);
    phrase = m[0];
  } else if ((m = /\b(eow|end of (?:the )?week)\b/.exec(t))) {
    const diff = (5 - base.getDay() + 7) % 7;
    day = atDay(base, diff);
    defaultHour = 18;
    phrase = m[0];
  } else if ((m = /\b(eom|end of (?:the )?month)\b/.exec(t))) {
    day = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59);
    phrase = m[0];
  } else if (
    (m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+${MONTH_RE}\\b`).exec(t)) ||
    (m = new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`).exec(t))
  ) {
    const numFirst = /^\d/.test(m[1]);
    const dayNum = Number(numFirst ? m[1] : m[2]);
    const month = MONTHS.indexOf((numFirst ? m[2] : m[1]).slice(0, 3));
    if (dayNum >= 1 && dayNum <= 31 && month >= 0) {
      const d = new Date(base.getFullYear(), month, dayNum, 23, 59);
      if (d.getTime() < base.getTime() - 60 * 864e5) d.setFullYear(d.getFullYear() + 1);
      day = d;
      phrase = m[0];
    }
  } else if ((m = /\b(?:by|on|due|before|until|till|deadline)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/.exec(t))) {
    const dayNum = Number(m[1]);
    const d = new Date(base.getFullYear(), base.getMonth(), dayNum, 23, 59);
    if (d.getTime() < base.getTime() - 864e5) d.setMonth(d.getMonth() + 1);
    day = d;
    phrase = m[0];
  } else if ((m = /\b(?:(next|this|by|on|before|until|till|coming)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|weds?|thu(?:rs?)?|fri)\b/.exec(t))) {
    const target = WEEKDAYS[m[2]];
    let diff = (target - base.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    if (m[1] === 'next' && diff < 3) diff += 7;
    day = atDay(base, diff);
    phrase = m[0];
  } else if ((m = /\bnext week\b/.exec(t))) {
    const diff = ((1 - base.getDay() + 7) % 7) || 7;
    day = atDay(base, diff);
    phrase = m[0];
  }

  const time = extractTime(t);
  if (!day && time && (DEADLINE_CUE.test(t) || /\b(at|@)\s*\d/.test(t))) {
    const d = new Date(base);
    d.setHours(time.h, time.m, 0, 0);
    if (d.getTime() < base.getTime()) d.setDate(d.getDate() + 1);
    return { date: d, hasTime: true, phrase: time.phrase };
  }
  if (!day) return null;
  if (time) {
    day.setHours(time.h, time.m, 0, 0);
    return { date: day, hasTime: true, phrase: `${phrase} ${time.phrase}` };
  }
  if (defaultHour !== null) {
    day.setHours(defaultHour, 0, 0, 0);
    return { date: day, hasTime: true, phrase };
  }
  return { date: day, hasTime: false, phrase };
}

/* ------------------------------------------------------------------ */
/* Identity helpers                                                    */
/* ------------------------------------------------------------------ */

export function aliasesFor(name: string): string[] {
  const n = name.trim();
  if (!n) return [];
  const first = n.split(/\s+/)[0];
  return [...new Set([n, first, n.replace(/\s+/g, '_'), n.replace(/\s+/g, ''), n.replace(/\s+/g, '.')].filter((a) => a.length >= 2))];
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildIdentity(myNames: string[]) {
  const aliases = [...new Set(myNames.flatMap(aliasesFor).map((a) => a.replace(/^@/, '').toLowerCase()))];
  const fullNames = myNames.map((n) => n.trim().toLowerCase()).filter(Boolean);
  const mention = aliases.length
    ? new RegExp(`(^|[^\\p{L}\\p{N}_])@?(${aliases.map(escapeRe).join('|')})(?![\\p{L}\\p{N}_])`, 'iu')
    : null;
  const isMe = (sender: string) => {
    const s = sender.trim().toLowerCase();
    if (!s) return false;
    if (s === 'you' || s === 'me') return true;
    return fullNames.includes(s) || aliases.includes(s);
  };
  return { known: aliases.length > 0, isMe, mentionsMe: (text: string) => !!mention?.test(text) };
}

/* ------------------------------------------------------------------ */
/* Text utilities                                                      */
/* ------------------------------------------------------------------ */

const STOP = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves
  ok okay yes yeah yep no nope hi hey hello thanks thank thx lol haha just also really get got like know think going one still now need want will can see good great sure well right gonna wanna anyone someone everyone guys today tomorrow tonight yesterday morning please pls via much many way back thing things time day week let make sounds ill dont cant im ive youre thats omitted media message deleted http https www com heads anything something`
    .split(/\s+/)
);

function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}][\p{L}\p{N}'’-]{2,}/gu) ?? []).map((w) => w.replace(/['’]s$/, '').replace(/[’']/g, "'"));
}

export function cleanTitle(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim();
  t = t.replace(/^(hey|hi|hello|yo|ok|okay)\b[,!.\s]*/i, '');
  if (t.length > 160) t = `${t.slice(0, 157).replace(/\s+\S*$/, '')}…`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function formatDue(due: Due, now: Date): string {
  const d = due.date;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(now)) / 864e5);
  const dayLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days === -1 ? 'Yesterday' : fmtDay.format(d);
  return due.hasTime ? `${dayLabel}, ${fmtTime.format(d)}` : dayLabel;
}

export function relativeDue(due: Due, now: Date): string {
  const diff = due.date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const h = Math.round(abs / 36e5);
  const d = Math.round(abs / 864e5);
  const span = abs < 36e5 ? `${Math.max(1, Math.round(abs / 6e4))} min` : h < 36 ? `${h} h` : `${d} days`;
  return diff < 0 ? `${span} overdue` : `in ${span}`;
}

/* ------------------------------------------------------------------ */
/* Analysis                                                            */
/* ------------------------------------------------------------------ */

function priorityFor(score: number): Priority {
  if (score >= 65) return 'urgent';
  if (score >= 45) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

const KIND_ORDER: FindingKind[] = ['deadline', 'task', 'commitment', 'question', 'mention', 'decision', 'event', 'important'];

function analyzeConversation(conv: Conversation, opts: AnalyzeOptions, id: ReturnType<typeof buildIdentity>): ConversationSummary {
  const all = conv.messages;
  const inWindow = all.filter((m) => !opts.since || !m.timestamp || m.timestamp.getTime() >= opts.since.getTime());
  const nonMe = conv.participants.filter((p) => !id.isMe(p));
  const isGroup = nonMe.length > 1;

  // Index of the last message the user sent, used to detect unanswered items.
  const myIndexes = all.filter((m) => id.isMe(m.sender)).map((m) => m.index);
  const repliedAfter = (index: number) => myIndexes.some((i) => i > index);

  const findings: Finding[] = [];
  for (const msg of inWindow) {
    if (msg.isMedia) continue;
    const text = msg.text;
    const fromMe = id.isMe(msg.sender);
    const base = msg.timestamp ?? opts.now;
    const kinds = new Set<FindingKind>();
    const reasons: string[] = [];

    const mentioned = !fromMe && id.mentionsMe(text);
    const groupMention = !fromMe && GROUP_MENTION.test(text);
    const directed = !fromMe && (mentioned || (!isGroup && id.known));
    const mentionsOther = /@[\p{L}\p{N}_]{2,}/u.test(text) && !mentioned && !groupMention;

    const isQuestion = !fromMe && (/\?\s*\S{0,3}$/.test(text) || (QUESTION_START.test(text) && text.includes('?')));
    const isRequest = !fromMe && (REQUEST.test(text) || IMPERATIVE.test(text));
    const isCommit = fromMe && COMMIT.test(text);
    const isDecision = DECISION.test(text);
    const isUrgent = URGENT.test(text);
    const isImportant = IMPORTANT.test(text) || MONEY.test(text);
    const due = ACK.test(text) ? null : parseDue(text, base);
    const isEvent = !!due && EVENT.test(text);

    if (mentioned) {
      kinds.add('mention');
      reasons.push('Mentions you');
    }
    if (isRequest) {
      kinds.add('task');
      reasons.push(directed ? 'Request directed at you' : groupMention ? 'Request to everyone' : 'Open request in chat');
    }
    if (isQuestion && (directed || groupMention || !isGroup || /\b(any(one|body)|who)\b/i.test(text))) {
      kinds.add('question');
      if (!isRequest) reasons.push(directed ? 'Question for you' : 'Open question');
    }
    if (isCommit) {
      kinds.add('commitment');
      reasons.push('You committed to this');
    }
    if (due && (isRequest || isCommit || DEADLINE_CUE.test(text))) {
      kinds.add('deadline');
      reasons.push(`Due ${due.phrase}`);
    } else if (isEvent) {
      kinds.add('event');
      reasons.push(`Scheduled ${due?.phrase ?? ''}`.trim());
    }
    if (isDecision) {
      kinds.add('decision');
      reasons.push('Decision recorded');
    }
    if (isImportant && !kinds.size) {
      kinds.add('important');
      reasons.push(MONEY.test(text) ? 'Mentions money' : 'Notable update');
    }
    if (isUrgent) reasons.unshift('Marked urgent');
    if (!kinds.size && !isUrgent) continue;
    if (!kinds.size) kinds.add('important');

    const forMe = directed || isCommit || ((isRequest || isQuestion) && groupMention) || (isRequest && !isGroup);
    const actionable = kinds.has('task') || kinds.has('question') || kinds.has('mention');
    const missed = id.known && !fromMe && actionable && (directed || groupMention) && !repliedAfter(msg.index);
    const overdue = !!due && due.date.getTime() < opts.now.getTime() && (kinds.has('deadline') || kinds.has('commitment')) && (forMe || isCommit);

    let score = 0;
    if (isUrgent) score += 35;
    if (due && (kinds.has('deadline') || kinds.has('event'))) {
      const hours = (due.date.getTime() - opts.now.getTime()) / 36e5;
      let dueScore = 0;
      if (overdue) dueScore = 30;
      else if (hours >= 0 && hours <= 24) dueScore = 28;
      else if (hours > 24 && hours <= 72) dueScore = 16;
      else if (hours > 72 && hours <= 168) dueScore = 7;
      // Dates in other people's threads matter less than ones aimed at you.
      score += forMe || isUrgent ? dueScore : Math.round(dueScore / 2);
    }
    if (forMe) score += 22;
    if (mentioned) score += 8;
    if (kinds.has('task')) score += 14;
    if (kinds.has('question') && forMe) score += 6;
    if (missed) score += 14;
    if (kinds.has('commitment')) score += 12;
    if (kinds.has('decision')) score += 12;
    if (kinds.has('important')) score += 8;
    if (MONEY.test(text)) score += 4;
    if (mentionsOther && !forMe) score -= 12;
    if (msg.timestamp && opts.now.getTime() - msg.timestamp.getTime() < 864e5) score += 4;
    score = Math.max(1, Math.min(100, score));

    const kindList = KIND_ORDER.filter((k) => kinds.has(k));
    findings.push({
      id: msg.id,
      conversationId: conv.id,
      conversationName: conv.name,
      platform: conv.platform,
      message: msg,
      kinds: kindList,
      primary: kindList[0],
      title: cleanTitle(text),
      priority: priorityFor(score),
      score,
      due,
      forMe,
      missed,
      overdue,
      reasons
    });
  }

  findings.sort((a, b) => b.score - a.score || (b.message.timestamp?.getTime() ?? 0) - (a.message.timestamp?.getTime() ?? 0));

  // ---- Extractive summary ------------------------------------------------
  const nameWords = new Set([...conv.participants, ...opts.myNames].flatMap((p) => words(p.replace(/[_.]/g, ' '))));
  const tf = new Map<string, number>();
  const bigrams = new Map<string, number>();
  for (const m of inWindow) {
    if (m.isMedia) continue;
    const ws = words(m.text.replace(/@[\p{L}\p{N}_.]+/gu, ' ')).filter((w) => !STOP.has(w) && !nameWords.has(w) && !/^\d/.test(w));
    ws.forEach((w, i) => {
      tf.set(w, (tf.get(w) ?? 0) + 1);
      if (i > 0) bigrams.set(`${ws[i - 1]} ${w}`, (bigrams.get(`${ws[i - 1]} ${w}`) ?? 0) + 1);
    });
  }
  const topBigrams = [...bigrams].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w);
  const covered = new Set(topBigrams.flatMap((b) => b.split(' ')));
  const topics = [
    ...topBigrams,
    ...[...tf].filter(([w, c]) => c >= 2 && !covered.has(w)).sort((a, b) => b[1] - a[1]).map(([w]) => w)
  ].slice(0, 5);

  const findingById = new Map(findings.map((f) => [f.message.id, f]));
  const candidates = inWindow
    .filter((m) => !m.isMedia && words(m.text).length >= 4 && !ACK.test(m.text))
    .map((m) => {
      const ws = words(m.text).filter((w) => !STOP.has(w));
      const content = ws.reduce((s, w) => s + Math.log(1 + (tf.get(w) ?? 0)), 0) / Math.sqrt(ws.length + 1);
      const f = findingById.get(m.id);
      return { m, score: content + (f ? f.score / 18 : 0), f };
    })
    .sort((a, b) => b.score - a.score);
  const keyCount = Math.min(6, Math.max(2, Math.ceil(inWindow.length / 7)));
  const chosen: typeof candidates = [];
  for (const c of candidates) {
    if (chosen.length >= keyCount) break;
    const sig = new Set(words(c.m.text));
    const dup = chosen.some((x) => {
      const other = words(x.m.text);
      const overlap = other.filter((w) => sig.has(w)).length;
      return overlap / Math.max(1, Math.min(sig.size, other.length)) > 0.7;
    });
    if (!dup) chosen.push(c);
  }
  const tagLabel: Record<FindingKind, string> = {
    task: 'Task', deadline: 'Deadline', question: 'Question', mention: 'Mention', decision: 'Decision', commitment: 'Your promise', event: 'Event', important: 'Update'
  };
  const keyPoints: KeyPoint[] = chosen
    .sort((a, b) => a.m.index - b.m.index)
    .map((c) => ({ message: c.m, tag: c.f ? tagLabel[c.f.primary] : null }));

  // ---- Stats & overview sentence ----------------------------------------
  const senderCounts = new Map<string, number>();
  inWindow.forEach((m) => senderCounts.set(m.sender, (senderCounts.get(m.sender) ?? 0) + 1));
  const topSenders = [...senderCounts].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  const times = inWindow.map((m) => m.timestamp?.getTime()).filter((t): t is number => typeof t === 'number');
  const start = times.length ? new Date(Math.min(...times)) : null;
  const end = times.length ? new Date(Math.max(...times)) : null;

  const counts = {
    tasks: findings.filter((f) => f.kinds.includes('task') && f.forMe).length,
    deadlines: findings.filter((f) => f.due && (f.kinds.includes('deadline') || f.kinds.includes('event'))).length,
    decisions: findings.filter((f) => f.kinds.includes('decision')).length,
    missed: findings.filter((f) => f.missed).length,
    urgent: findings.filter((f) => f.priority === 'urgent').length
  };

  const others = topSenders.filter((s) => !id.isMe(s.name)).map((s) => s.name.split(/\s+/)[0]);
  const who = others.length === 0 ? 'You' : others.length === 1 ? others[0] : others.length === 2 ? `${others[0]} and ${others[1]}` : `${others.slice(0, 2).join(', ')} and ${others.length - 2} other${others.length - 2 > 1 ? 's' : ''}`;
  const parts: string[] = [];
  parts.push(`${who} ${others.length === 1 && !isGroup ? 'sent' : 'posted'} ${inWindow.length} message${inWindow.length === 1 ? '' : 's'}${topics.length ? `, mostly about ${listify(topics.slice(0, 3))}` : ''}.`);
  const tally: string[] = [];
  if (counts.tasks) tally.push(`${counts.tasks} request${counts.tasks > 1 ? 's' : ''} for you`);
  if (counts.deadlines) tally.push(`${counts.deadlines} date${counts.deadlines > 1 ? 's' : ''} to track`);
  if (counts.decisions) tally.push(`${counts.decisions} decision${counts.decisions > 1 ? 's' : ''}`);
  if (tally.length) parts.push(`There ${/^1 /.test(tally[0]) ? 'is' : 'are'} ${listify(tally)}.`);
  if (counts.missed) parts.push(`${counts.missed} message${counts.missed > 1 ? 's' : ''} aimed at you still ${counts.missed > 1 ? 'have' : 'has'} no reply from you.`);
  if (!tally.length && !counts.missed) parts.push('Nothing here appears to need your action.');

  return {
    conversation: conv,
    isGroup,
    analyzedCount: inWindow.length,
    start,
    end,
    topSenders,
    topics,
    overview: parts.join(' '),
    keyPoints,
    findings,
    counts,
    topScore: findings[0]?.score ?? 0
  };
}

function listify(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function analyze(conversations: Conversation[], opts: AnalyzeOptions): Report {
  const id = buildIdentity(opts.myNames);
  const summaries = conversations.map((c) => analyzeConversation(c, opts, id)).sort((a, b) => b.topScore - a.topScore);
  const findings = summaries.flatMap((s) => s.findings).sort((a, b) => b.score - a.score);

  const stats = {
    chats: summaries.length,
    messages: summaries.reduce((s, c) => s + c.analyzedCount, 0),
    urgent: findings.filter((f) => f.priority === 'urgent').length,
    tasksForMe: findings.filter((f) => f.forMe && (f.kinds.includes('task') || f.kinds.includes('commitment'))).length,
    deadlines: findings.filter((f) => f.due && (f.kinds.includes('deadline') || f.kinds.includes('event'))).length,
    overdue: findings.filter((f) => f.overdue).length,
    missed: findings.filter((f) => f.missed).length,
    decisions: findings.filter((f) => f.kinds.includes('decision')).length
  };

  let headline: string;
  if (!stats.messages) headline = 'No messages in this window.';
  else if (stats.overdue) headline = `${stats.overdue} thing${stats.overdue > 1 ? 's are' : ' is'} already overdue.`;
  else if (stats.urgent) headline = `${stats.urgent} item${stats.urgent > 1 ? 's need' : ' needs'} you now.`;
  else if (stats.tasksForMe) headline = `${stats.tasksForMe} request${stats.tasksForMe > 1 ? 's are' : ' is'} waiting on you.`;
  else headline = 'You’re all caught up.';

  const briefing: string[] = [];
  briefing.push(`${stats.messages} message${stats.messages === 1 ? '' : 's'} across ${stats.chats} chat${stats.chats === 1 ? '' : 's'} reviewed on this device.`);
  const top = findings.filter((f) => f.forMe || f.priority === 'urgent').slice(0, 3);
  top.forEach((f) => {
    const who = f.message.sender.split(/\s+/)[0];
    const when = f.due ? ` — ${f.overdue ? 'overdue since' : 'due'} ${formatDue(f.due, opts.now).replace(/^(Today|Tomorrow|Yesterday)/, (w) => w.toLowerCase())}` : '';
    briefing.push(`${who} in ${f.conversationName}: “${f.title.length > 90 ? `${f.title.slice(0, 88)}…` : f.title}”${when}`);
  });
  if (stats.missed) briefing.push(`${stats.missed} mention${stats.missed > 1 ? 's or questions' : ' or question'} for you went unanswered.`);
  if (stats.decisions) briefing.push(`${stats.decisions} decision${stats.decisions > 1 ? 's were' : ' was'} made while you were away.`);

  return { generatedAt: new Date(), options: opts, conversations: summaries, findings, headline, briefing, stats, identityKnown: id.known };
}
