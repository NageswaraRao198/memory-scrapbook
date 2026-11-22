import { describe, expect, it } from 'vitest';
import { dayKey, endOfDayIso, fromLocalInput, monthRangeIso, startOfDayIso, toLocalInput, wordCount } from './dates';
import { entryTitle, excerpt } from './text';

describe('date helpers', () => {
  it('builds local day keys and day boundaries', () => {
    const local = new Date(2025, 2, 9, 23, 30);
    expect(dayKey(local)).toBe('2025-03-09');
    expect(new Date(startOfDayIso('2025-03-09')).getHours()).toBe(0);
    const end = new Date(endOfDayIso('2025-03-09'));
    expect(end.getHours()).toBe(23);
    expect(dayKey(end)).toBe('2025-03-09');
  });

  it('round-trips datetime-local values', () => {
    const iso = new Date(2025, 5, 1, 7, 5).toISOString();
    expect(toLocalInput(iso)).toBe('2025-06-01T07:05');
    expect(fromLocalInput('2025-06-01T07:05')).toBe(iso);
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('nonsense')).toBeNull();
  });

  it('covers a whole month', () => {
    const { from, to } = monthRangeIso(2024, 1);
    expect(dayKey(from)).toBe('2024-02-01');
    expect(dayKey(to)).toBe('2024-02-29');
  });

  it('counts words', () => {
    expect(wordCount('  one  two\nthree ')).toBe(3);
    expect(wordCount('   ')).toBe(0);
  });
});

describe('text helpers', () => {
  it('strips Markdown and truncates', () => {
    expect(excerpt('## Title\n\nSome **bold** and [a link](http://x.test)', 100)).toBe('Title Some bold and a link');
    expect(excerpt('a'.repeat(50), 10)).toBe(`${'a'.repeat(10)}...`);
  });

  it('falls back to a snippet when there is no title', () => {
    expect(entryTitle({ title: null, body: 'Hello there' })).toBe('Hello there');
    expect(entryTitle({ title: ' ', body: '' })).toBe('Untitled page');
    expect(entryTitle({ title: 'Named', body: 'x' })).toBe('Named');
  });
});
