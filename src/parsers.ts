import { strFromU8, unzipSync } from 'fflate';

export type Platform = 'whatsapp' | 'telegram' | 'generic';

export interface Message {
  id: string;
  conversationId: string;
  sender: string;
  text: string;
  timestamp: Date | null;
  index: number;
  isMedia: boolean;
}

export interface Conversation {
  id: string;
  name: string;
  platform: Platform;
  source: string;
  messages: Message[];
  participants: string[];
}

export const MAX_TEXT_BYTES = 15 * 1024 * 1024;
export const MAX_ZIP_BYTES = 150 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['.txt', '.json', '.zip', '.csv', '.md'];

/** Small, fast, non-cryptographic hash used for stable local IDs. */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const INVISIBLE = /[‎‏‪-‮﻿]/g;
const ODD_SPACES = /[   ]/g;
const MEDIA = /<media omitted>|\b(image|video|audio|sticker|gif|document|contact card) omitted\b|<attached: [^>]+>|^\[(photo|video|voice message|sticker|file|animation)\]$/i;

function clean(line: string): string {
  return line.replace(INVISIBLE, '').replace(ODD_SPACES, ' ');
}

function finalize(
  name: string,
  platform: Platform,
  source: string,
  raw: { sender: string; text: string; timestamp: Date | null }[]
): Conversation {
  const id = `${platform}-${hashString(name + source + (raw[0]?.text ?? '') + raw.length)}`;
  const messages: Message[] = raw
    .filter((m) => m.text.trim().length > 0)
    .map((m, index) => ({
      id: `${id}-${index}-${hashString(m.sender + m.text)}`,
      conversationId: id,
      sender: m.sender.trim() || 'Unknown',
      text: m.text.trim(),
      timestamp: m.timestamp && !Number.isNaN(m.timestamp.getTime()) ? m.timestamp : null,
      index,
      isMedia: MEDIA.test(m.text.trim())
    }));
  const participants = [...new Set(messages.map((m) => m.sender))];
  return { id, name, platform, source, messages, participants };
}

/* ------------------------------------------------------------------ */
/* WhatsApp                                                            */
/* ------------------------------------------------------------------ */

// Matches Android "12/03/2024, 09:15 - Name: text" and iOS "[12/03/24, 9:15:32 PM] Name: text".
const WA_LINE =
  /^\[?(\d{1,4})[./-](\d{1,2})[./-](\d{1,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\]?\s*(?:[-–]\s+)?(.*)$/;
const WA_SENDER = /^([^:]{1,60}?):\s?([\s\S]*)$/;

export function looksLikeWhatsApp(text: string): boolean {
  const lines = text.split(/\r?\n/).slice(0, 40).map(clean).filter(Boolean);
  if (!lines.length) return false;
  const hits = lines.filter((l) => WA_LINE.test(l)).length;
  return hits >= Math.max(1, Math.floor(lines.length * 0.3));
}

export function preferMonthFirst(): boolean {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return /^en-(US|PH)|^es-US/.test(locale);
  } catch {
    return false;
  }
}

export function parseWhatsApp(text: string, name: string, source = name): Conversation {
  type Entry = { parts: string[]; sender: string; body: string };
  const entries: Entry[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = clean(rawLine);
    const m = WA_LINE.exec(line);
    if (m) {
      const rest = m[8] ?? '';
      const s = WA_SENDER.exec(rest);
      // Lines without "Sender:" are system notices (encryption banner, joins, etc.)
      if (!s) {
        entries.push({ parts: [], sender: '', body: '' });
        continue;
      }
      entries.push({ parts: m.slice(1, 8) as string[], sender: s[1], body: s[2] });
    } else if (entries.length && entries[entries.length - 1].sender) {
      entries[entries.length - 1].body += `\n${line}`;
    }
  }

  // Decide day/month order from evidence in the file, falling back to locale.
  let order: 'dmy' | 'mdy' | 'ymd' = preferMonthFirst() ? 'mdy' : 'dmy';
  const dated = entries.filter((e) => e.sender);
  if (dated.some((e) => e.parts[0]?.length === 4)) order = 'ymd';
  else if (dated.some((e) => Number(e.parts[0]) > 12)) order = 'dmy';
  else if (dated.some((e) => Number(e.parts[1]) > 12)) order = 'mdy';
  else if (dated.length > 1) {
    // Still ambiguous: prefer the order that keeps messages chronological.
    const disorder = (dayFirst: boolean) => {
      let bad = 0;
      let prev = -Infinity;
      for (const e of dated) {
        const [a, b, c] = e.parts.map(Number);
        const t = new Date(c < 100 ? c + 2000 : c, (dayFirst ? b : a) - 1, dayFirst ? a : b).getTime();
        if (t < prev) bad++;
        prev = t;
      }
      return bad;
    };
    const dmy = disorder(true);
    const mdy = disorder(false);
    if (dmy !== mdy) order = dmy < mdy ? 'dmy' : 'mdy';
  }

  const raw = dated.map((e) => {
    const [a, b, c, hh, mm, ss, ampm] = e.parts;
    let day: number, month: number, year: number;
    if (order === 'ymd') [year, month, day] = [Number(a), Number(b), Number(c)];
    else if (order === 'mdy') [month, day, year] = [Number(a), Number(b), Number(c)];
    else [day, month, year] = [Number(a), Number(b), Number(c)];
    if (year < 100) year += 2000;
    let hour = Number(hh);
    if (ampm) {
      const pm = /p/i.test(ampm);
      if (pm && hour < 12) hour += 12;
      if (!pm && hour === 12) hour = 0;
    }
    const timestamp = new Date(year, month - 1, day, hour, Number(mm), Number(ss ?? 0));
    return { sender: e.sender, text: e.body, timestamp };
  });
  return finalize(name, 'whatsapp', source, raw);
}

export function whatsAppNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.(txt|zip)$/i, '');
  const m = /whatsapp chat (?:with|-|–)\s*(.+)$/i.exec(base);
  if (m) return m[1].trim();
  if (/^_?chat$/i.test(base)) return 'WhatsApp chat';
  return base;
}

/* ------------------------------------------------------------------ */
/* Telegram (Desktop "Export chat history" → JSON)                     */
/* ------------------------------------------------------------------ */

type TgPart = string | { type?: string; text?: unknown };
interface TgMessage {
  type?: string;
  date?: string;
  date_unixtime?: string;
  from?: string | null;
  actor?: string;
  text?: string | TgPart[];
  media_type?: string;
  photo?: string;
  file?: string;
  sticker_emoji?: string;
}
interface TgChat {
  name?: string;
  type?: string;
  messages?: TgMessage[];
}

export function telegramText(t: unknown): string {
  if (typeof t === 'string') return t;
  if (Array.isArray(t)) {
    return t
      .map((p: TgPart) => (typeof p === 'string' ? p : p && typeof p === 'object' && 'text' in p ? String(p.text ?? '') : ''))
      .join('');
  }
  return '';
}

function parseTelegramChat(chat: TgChat, source: string): Conversation {
  const raw = (chat.messages ?? [])
    .filter((m) => m && m.type !== 'service')
    .map((m) => {
      let text = telegramText(m.text);
      if (!text.trim()) {
        if (m.photo) text = '[photo]';
        else if (m.sticker_emoji) text = m.sticker_emoji;
        else if (m.media_type) text = `[${m.media_type.replace(/_/g, ' ')}]`;
        else if (m.file) text = '[file]';
      }
      const timestamp = m.date_unixtime
        ? new Date(Number(m.date_unixtime) * 1000)
        : m.date
          ? new Date(m.date)
          : null;
      return { sender: m.from ?? m.actor ?? 'Unknown', text, timestamp };
    });
  return finalize(chat.name?.trim() || 'Telegram chat', 'telegram', source, raw);
}

export function parseTelegramJson(data: unknown, source: string): Conversation[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as { messages?: unknown; chats?: { list?: TgChat[] } };
  if (Array.isArray(obj.messages)) return [parseTelegramChat(obj as TgChat, source)];
  if (obj.chats && Array.isArray(obj.chats.list)) {
    return obj.chats.list.filter((c) => Array.isArray(c.messages) && c.messages.length).map((c) => parseTelegramChat(c, source));
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* Generic text, JSON arrays and CSV                                   */
/* ------------------------------------------------------------------ */

const GENERIC_LINE = /^\s*(?:\[([^\]]{1,40})\]\s*)?(?:([^:\[\]\n]{1,40}):\s+)?(.+)$/;

function parseLooseTime(value: string | undefined, base: Date): Date | null {
  if (!value) return null;
  const t = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i.exec(value.trim());
  if (t) {
    let h = Number(t[1]);
    if (t[3]) {
      if (/pm/i.test(t[3]) && h < 12) h += 12;
      if (/am/i.test(t[3]) && h === 12) h = 0;
    }
    const d = new Date(base);
    d.setHours(h, Number(t[2]), 0, 0);
    return d;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseGenericText(text: string, name: string, source = name, base = new Date()): Conversation {
  const raw: { sender: string; text: string; timestamp: Date | null }[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = clean(rawLine);
    if (!line.trim()) continue;
    const m = GENERIC_LINE.exec(line);
    if (!m) continue;
    const [, time, sender, body] = m;
    if (!sender && !time && raw.length) {
      raw[raw.length - 1].text += `\n${line.trim()}`;
      continue;
    }
    raw.push({ sender: sender ?? 'Unknown', text: body, timestamp: parseLooseTime(time, base) });
  }
  return finalize(name, 'generic', source, raw);
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of Object.keys(obj)) if (keys.includes(k.toLowerCase())) return obj[k];
  return undefined;
}

const SENDER_KEYS = ['sender', 'from', 'author', 'name', 'user', 'speaker'];
const TEXT_KEYS = ['text', 'message', 'content', 'body', 'msg'];
const TIME_KEYS = ['timestamp', 'date', 'time', 'datetime', 'sent_at', 'created_at'];

function fromRecords(records: Record<string, unknown>[], name: string, source: string): Conversation {
  const raw = records.map((r) => {
    const ts = pick(r, TIME_KEYS);
    const timestamp = typeof ts === 'number' ? new Date(ts < 1e12 ? ts * 1000 : ts) : typeof ts === 'string' ? parseLooseTime(ts, new Date()) : null;
    return { sender: String(pick(r, SENDER_KEYS) ?? 'Unknown'), text: telegramText(pick(r, TEXT_KEYS)), timestamp };
  });
  return finalize(name, 'generic', source, raw);
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

function baseName(fileName: string) {
  return fileName.replace(/\.[a-z0-9]+$/i, '');
}

export function parseContent(text: string, fileName: string): Conversation[] {
  const lower = fileName.toLowerCase();
  const trimmed = text.trim();
  if (lower.endsWith('.json') || /^[[{]/.test(trimmed)) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error(`${fileName} is not valid JSON.`);
    }
    if (Array.isArray(data)) {
      const records = data.filter((d): d is Record<string, unknown> => !!d && typeof d === 'object');
      return [fromRecords(records, baseName(fileName), fileName)];
    }
    const tg = parseTelegramJson(data, fileName);
    if (tg.length) return tg;
    throw new Error(`${fileName} doesn't look like a Telegram export (expected a "messages" list).`);
  }
  if (lower.endsWith('.csv')) {
    const [header, ...rows] = parseCsv(text);
    if (!header) return [];
    const records = rows.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
    return [fromRecords(records, baseName(fileName), fileName)];
  }
  if (looksLikeWhatsApp(text)) return [parseWhatsApp(text, whatsAppNameFromFile(fileName), fileName)];
  return [parseGenericText(text, baseName(fileName), fileName)];
}

export function parseZip(bytes: Uint8Array, fileName: string): Conversation[] {
  // Only text entries are decompressed; photos and media in the archive are never touched.
  const entries = unzipSync(bytes, { filter: (f) => /\.(txt|json)$/i.test(f.name) && !f.name.startsWith('__MACOSX') });
  const out: Conversation[] = [];
  for (const [entryName, data] of Object.entries(entries)) {
    const text = strFromU8(data);
    const display = /(^|\/)_?chat\.txt$/i.test(entryName) ? `${baseName(fileName)}.txt` : entryName.split('/').pop() ?? entryName;
    out.push(...parseContent(text, display).map((c) => ({ ...c, source: fileName })));
  }
  if (!out.length) throw new Error(`No chat text was found inside ${fileName}.`);
  return out;
}

export async function parseFile(file: File): Promise<Conversation[]> {
  const lower = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    throw new Error(`${file.name}: unsupported file type. Use .txt, .zip, .json or .csv exports.`);
  }
  if (lower.endsWith('.zip')) {
    if (file.size > MAX_ZIP_BYTES) throw new Error(`${file.name} is larger than 150 MB. Export "without media" instead.`);
    return parseZip(new Uint8Array(await file.arrayBuffer()), file.name);
  }
  if (file.size > MAX_TEXT_BYTES) throw new Error(`${file.name} is larger than 15 MB.`);
  return parseContent(await file.text(), file.name);
}
