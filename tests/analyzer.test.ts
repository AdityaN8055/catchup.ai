import { describe, expect, it } from 'vitest';
import { analyze, parseDue } from '../src/analyzer';
import { parseContent } from '../src/parsers';
import { buildSampleFiles, SAMPLE_USER } from '../src/sample';

const base = new Date(2026, 9, 7, 9, 0); // Wednesday 7 Oct 2026, 09:00

describe('parseDue', () => {
  it('understands relative days and times', () => {
    const d = parseDue('send it by tomorrow 10am', base)!;
    expect(d.date.getDate()).toBe(8);
    expect(d.date.getHours()).toBe(10);
    expect(d.hasTime).toBe(true);
  });

  it('understands EOD and weekdays', () => {
    expect(parseDue('needs sign-off by EOD', base)!.date.getHours()).toBe(18);
    expect(parseDue('banners need approval by Friday', base)!.date.getDate()).toBe(9);
  });

  it('understands month names', () => {
    const d = parseDue('expires on 15 October', base)!;
    expect(d.date.getMonth()).toBe(9);
    expect(d.date.getDate()).toBe(15);
  });

  it('ignores text without dates', () => {
    expect(parseDue('sounds good to me', base)).toBeNull();
  });
});

describe('analyze', () => {
  const now = new Date();
  const convs = buildSampleFiles(now).flatMap((f) => parseContent(f.content, f.name));
  const report = analyze(convs, { myNames: [SAMPLE_USER], since: null, now });

  it('finds requests aimed at the user and ranks them first', () => {
    const top = report.findings[0];
    expect(top.forMe).toBe(true);
    expect(['urgent', 'high']).toContain(top.priority);
  });

  it('flags unanswered mentions', () => {
    const missed = report.findings.filter((f) => f.missed);
    expect(missed.some((f) => /analytics dashboard/.test(f.message.text))).toBe(true);
    // Mom's dinner question was answered, so it must not be "missed".
    expect(missed.some((f) => /dinner on Sunday/.test(f.message.text))).toBe(false);
  });

  it('records decisions and builds per-chat summaries', () => {
    expect(report.stats.decisions).toBeGreaterThan(0);
    expect(report.conversations).toHaveLength(3);
    report.conversations.forEach((c) => {
      expect(c.overview.length).toBeGreaterThan(10);
      expect(c.keyPoints.length).toBeGreaterThan(0);
    });
  });

  it('respects the "since" window', () => {
    const narrow = analyze(convs, { myNames: [SAMPLE_USER], since: new Date(now.getTime() - 3 * 36e5), now });
    expect(narrow.stats.messages).toBeLessThan(report.stats.messages);
  });
});
