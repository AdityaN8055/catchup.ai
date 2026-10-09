import { describe, expect, it } from 'vitest';
import { parseContent, parseWhatsApp, parseTelegramJson, whatsAppNameFromFile } from '../src/parsers';

describe('WhatsApp parser', () => {
  it('parses Android exports with multi-line messages and skips system notices', () => {
    const text = [
      '13/03/2024, 09:15 - Messages and calls are end-to-end encrypted.',
      '13/03/2024, 09:16 - Maya: Morning!',
      '13/03/2024, 09:17 - Alex: Two things:',
      'first the deck',
      '14/03/2024, 18:02 - Maya: <Media omitted>'
    ].join('\n');
    const c = parseWhatsApp(text, 'Team');
    expect(c.messages).toHaveLength(3);
    expect(c.messages[1].text).toBe('Two things:\nfirst the deck');
    expect(c.messages[0].timestamp?.getMonth()).toBe(2);
    expect(c.messages[2].isMedia).toBe(true);
    expect(c.participants).toEqual(['Maya', 'Alex']);
  });

  it('parses iOS bracketed exports with AM/PM', () => {
    const c = parseWhatsApp('[3/14/24, 9:05:10 PM] Sam: Hello there', 'x');
    expect(c.messages[0].sender).toBe('Sam');
    expect(c.messages[0].timestamp?.getHours()).toBe(21);
    expect(c.messages[0].timestamp?.getDate()).toBe(14);
  });

  it('derives chat names from export file names', () => {
    expect(whatsAppNameFromFile('WhatsApp Chat with Mom.txt')).toBe('Mom');
  });
});

describe('Telegram parser', () => {
  it('reads single-chat JSON with rich text entities', () => {
    const [c] = parseTelegramJson(
      {
        name: 'Flat',
        messages: [
          { id: 1, type: 'service', date: '2024-03-12T09:00:00', actor: 'Jonas' },
          { id: 2, type: 'message', date: '2024-03-12T09:15:32', from: 'Aiko', text: [{ type: 'mention', text: '@sam' }, ' hi'] }
        ]
      },
      'result.json'
    );
    expect(c.name).toBe('Flat');
    expect(c.messages).toHaveLength(1);
    expect(c.messages[0].text).toBe('@sam hi');
  });

  it('routes JSON content automatically', () => {
    const convs = parseContent(JSON.stringify({ chats: { list: [{ name: 'A', messages: [{ type: 'message', from: 'x', text: 'yo' }] }] } }), 'result.json');
    expect(convs[0].platform).toBe('telegram');
  });
});
