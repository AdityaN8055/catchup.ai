import { preferMonthFirst } from './parsers';

/**
 * Demo exports in the exact formats WhatsApp and Telegram produce, with
 * timestamps generated relative to "now" so the demo report always feels current.
 */
export const SAMPLE_USER = 'Sam Rivera';

const pad = (n: number) => String(n).padStart(2, '0');

function hoursAgo(now: Date, h: number): Date {
  return new Date(now.getTime() - h * 36e5);
}

// WhatsApp writes dates in the phone's locale order, so mirror the browser's.
function waStamp(d: Date): string {
  const [x, y] = preferMonthFirst() ? [d.getMonth() + 1, d.getDate()] : [d.getDate(), d.getMonth() + 1];
  return `${pad(x)}/${pad(y)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tgStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

const monthName = (d: Date) => d.toLocaleString('en-US', { month: 'long' });

function whatsapp(now: Date, rows: [number, string, string][]): string {
  const header = `${waStamp(hoursAgo(now, rows[0][0] + 1))} - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.`;
  return [header, ...rows.map(([h, who, text]) => `${waStamp(hoursAgo(now, h))} - ${who}: ${text}`)].join('\n');
}

export interface SampleFile {
  name: string;
  content: string;
}

export function buildSampleFiles(now = new Date()): SampleFile[] {
  const insuranceDay = new Date(now.getTime() + 5 * 864e5);

  const launch = whatsapp(now, [
    [30, 'Priya Shah', 'Morning team! Quick status thread for the Atlas launch 🚀'],
    [29.8, 'Marcus Lee', 'Landing page copy is done, waiting on design for the hero section'],
    [29.5, 'Elena Costa', 'Hero mockups will be in Figma by this afternoon'],
    [29, 'Priya Shah', '@Sam can you send the investor pitch deck to me by tomorrow 10am? Need to review it before the board call'],
    [28, 'Marcus Lee', 'Decision from the call with Dana: we are going with the Thursday launch, not Wednesday. Agreed by everyone.'],
    [27, 'Elena Costa', 'Has anyone heard back from the printing vendor? The banners need approval by Friday'],
    [26, 'Sam Rivera', "I'll check with the vendor tomorrow morning"],
    [25, 'Marcus Lee', 'The pricing page still says $49, should be $39 after the change. Who can fix it?'],
    [24, 'Priya Shah', 'Reminder: the board call is on Friday at 3pm. Please everyone have your updates ready'],
    [20, 'Elena Costa', 'Figma link is up, comments welcome on the hero section'],
    [6, 'Marcus Lee', '@Sam Rivera did you get a chance to look at the analytics dashboard? Numbers look off for the launch campaign'],
    [5, 'Priya Shah', 'URGENT: legal flagged the privacy policy, we need the updated version signed off by EOD today'],
    [4.5, 'Elena Costa', 'I can take the privacy policy edits if someone sends me the latest doc'],
    [4, 'Priya Shah', 'Thanks Elena! Sam, you have the latest version right? Please share it with Elena asap'],
    [2, 'Marcus Lee', 'Lunch order going in at 12:30, anyone want anything?'],
    [1, 'Elena Costa', 'Banners approved ✅ the printing vendor confirmed delivery on Monday']
  ]);

  const mom = whatsapp(now, [
    [50, 'Mom', 'Hi sweetie, are you still coming for dinner on Sunday?'],
    [49, 'Sam Rivera', "Yes! I'll bring dessert"],
    [10, 'Mom', "Don't forget Grandpa's birthday is on Saturday, can you call him in the morning?"],
    [9, 'Mom', 'Also your dentist appointment got moved to next Tuesday at 4:30pm, they called the house'],
    [3, 'Mom', `Did you renew your car insurance? The letter says it expires on ${insuranceDay.getDate()} ${monthName(insuranceDay)}`],
    [2.9, 'Mom', '<Media omitted>']
  ]);

  const tgRows: [number, string, string | (string | { type: string; text: string })[]][] = [
    [40, 'Jonas', 'Rent transfer is due by Friday, please send your share (€620) to the shared account'],
    [38, 'Aiko', 'Done ✅'],
    [36, 'Dev', 'Sent mine too'],
    [30, 'Jonas', [{ type: 'mention', text: '@sam_rivera' }, ' still waiting on yours 🙏']],
    [22, 'Aiko', 'Heads up: the landlord is coming to inspect the boiler tomorrow between 9 and 11. Someone needs to be home'],
    [21, 'Dev', "I have class, can't do it"],
    [20, 'Aiko', ['Can anyone be home? ', { type: 'mention', text: '@sam_rivera' }, ' you work from home on Wednesdays right?']],
    [12, 'Jonas', 'We agreed: the cleaning rota starts Monday, Sam has the kitchen this week'],
    [2, 'Dev', 'Who finished the oat milk 😤'],
    [1, 'Aiko', 'Heads up, wifi will be down tonight from 11pm for the router swap']
  ];
  const flat = {
    name: 'Flat 4B · Housemates',
    type: 'private_group',
    id: 4815162342,
    messages: tgRows.map(([h, from, text], i) => ({ id: i + 1, type: 'message', date: tgStamp(hoursAgo(now, h)), from, text }))
  };

  return [
    { name: 'WhatsApp Chat with Atlas Launch Squad.txt', content: launch },
    { name: 'WhatsApp Chat with Mom.txt', content: mom },
    { name: 'result.json', content: JSON.stringify(flat, null, 2) }
  ];
}
