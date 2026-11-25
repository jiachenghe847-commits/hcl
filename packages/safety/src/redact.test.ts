import { describe, expect, it } from 'vitest';
import { findIdentifiers, redactIdentifiers } from './redact.js';

describe('S3/S7 identifier redaction', () => {
  it.each([
    ['mail me at li.na99@student.xmu.edu.my', 'mail me at [email]', 'email'],
    ['see https://example.com/my-profile', 'see [link]', 'link'],
    ['my student ID is CST2504000', 'my student ID is [id]', 'id_number'],
    ['IC 040101-14-5678 please', 'IC [id] please', 'id_number'],
    ['call 012-345 6789 tonight', 'call [phone] tonight', 'phone'],
    ['call +60 12-345 6789', 'call [phone]', 'phone'],
    ['我的学号CST2504000', '我的学号[id]', 'id_number'],
  ])('redacts %j', (input, expected, kind) => {
    const r = redactIdentifiers(input);
    expect(r.text).toBe(expected);
    expect(r.found).toEqual([kind]);
  });

  it('leaves dates, times and short numbers alone', () => {
    const text = 'Exam on 2026-12-14 at 09:00, room 3-12, 50 minutes';
    expect(redactIdentifiers(text)).toEqual({ text, found: [] });
  });

  it('redacts do-not-share names: Latin by whole word, case-insensitive; CJK as substring', () => {
    const r = redactIdentifiers('LI NA keeps arguing; I like 李娜 though', { doNotShare: ['Li Na', '李娜'] });
    expect(r.text).toBe('[name] keeps arguing; I like [name] though');
    expect(r.found).toEqual(['name']);
    expect(redactIdentifiers('I like it', { doNotShare: ['Li'] }).text).toBe('I like it');
  });

  it('ignores one-character or blank names', () => {
    expect(redactIdentifiers('a b c', { doNotShare: ['a', ' ', ''] }).text).toBe('a b c');
  });

  it('is idempotent: redacting twice equals redacting once', () => {
    const input = 'Li Na (CST2504000, 012-345 6789, li@x.my) said id is fine';
    const opts = { doNotShare: ['Li Na', 'id', 'name'] };
    const once = redactIdentifiers(input, opts).text;
    expect(redactIdentifiers(once, opts).text).toBe(once);
    expect(once).not.toMatch(/\[\[|\]\]/);
  });

  it('reports every kind found, sorted, for the S7 validator', () => {
    expect(findIdentifiers('x@y.com and 0123456789 and CST2504000')).toEqual(['email', 'id_number', 'phone']);
    expect(findIdentifiers('a general worry about exams')).toEqual([]);
  });
});
