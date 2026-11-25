import { describe, expect, it } from 'vitest';
import { detectCrisis } from './crisis.js';

describe('S1/S2 crisis detection', () => {
  it.each([
    ['I want to kill myself', 'suicide'],
    ['i dont want to live anymore', 'suicide'],
    ['I don’t want to wake up tomorrow', 'suicide'], // curly apostrophe
    ['thinking about SUICIDE', 'suicide'],
    ['honestly everyone is better off dead without me', 'suicide'],
    ['I keep thinking about ending it all', 'suicide'],
    ['saya rasa nak bunuh diri', 'suicide'],
    ['I have been cutting myself again', 'self_harm'],
    ['self-harm thoughts', 'self_harm'],
    ['I might overdose tonight', 'self_harm'],
    ['I want to hurt my roommate', 'harm_others'],
    ["I'm not safe right now", 'immediate_danger'],
    ['someone is following me on campus', 'immediate_danger'],
    ['我真的不想活了', 'suicide'],
    ['有时候想 死', 'suicide'], // spacing inside a Chinese phrase
    ['我又开始自残了', 'self_harm'],
    ['我吞了一整瓶药', 'self_harm'],
    ['有人在跟踪我', 'immediate_danger'],
    ['ｋｉｌｌ ｍｙｓｅｌｆ', 'suicide'], // full-width letters
    ['kill​myself', 'suicide'], // zero-width space hidden inside
  ])('flags %j as %s', (text, category) => {
    const r = detectCrisis({ text });
    expect(r.level).toBe('crisis');
    expect(r.categories).toContain(category);
  });

  it.each([
    'this deadline is killing me',
    'I killed it in my presentation today',
    'exams are stressful and I slept badly',
    '最近考试压力很大，睡不好',
    'my phone died during the lecture',
  ])('does not flag everyday speech: %j', (text) => {
    expect(detectCrisis({ text }).level).toBe('none');
  });

  it('accepts the documented colloquial false positive 想死你了', () => {
    expect(detectCrisis({ text: '好久不见，想死你了' }).level).toBe('crisis');
  });

  it('treats the lowest mood alone as concern, not crisis', () => {
    expect(detectCrisis({ latestMood: 1 })).toEqual({ level: 'concern', categories: [] });
    expect(detectCrisis({ latestMood: 1, text: 'tired after exams' }).level).toBe('concern');
  });

  it('lets a crisis phrase win over the mood rating', () => {
    expect(detectCrisis({ latestMood: 5, text: 'I want to die' }).level).toBe('crisis');
  });

  it('returns none for empty input', () => {
    expect(detectCrisis({})).toEqual({ level: 'none', categories: [] });
    expect(detectCrisis({ text: '   ' }).level).toBe('none');
  });

  it('is deterministic: the same input twice gives the same result', () => {
    const input = { text: 'I want to die, and someone is following me', latestMood: 2 };
    expect(detectCrisis(input)).toEqual(detectCrisis(input));
    expect(detectCrisis(input).categories).toEqual(['immediate_danger', 'suicide']);
  });

  it('never returns the user’s words', () => {
    const r = detectCrisis({ text: 'I want to kill myself because of Ahmad' });
    expect(JSON.stringify(r)).not.toMatch(/ahmad|kill/i);
  });
});
