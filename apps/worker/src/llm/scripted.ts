/**
 * Scripted provider: a deterministic, rule-based stand-in for an LLM.
 * It is for local development and demos without an API key, and is enabled only with LLM_PROVIDER=scripted.
 * The UI labels it as a demo.
 *
 * It drives the SAME tools through the SAME loop and server checks as a real model:
 * search → list slots → hold → submit_proposal. It recovers from a failed hold by trying the next slot.
 * Its language understanding is keyword matching, so its disclosure plan is crude.
 * It exists so screens, tests and the SUS study can run without the real API. It is not a quality benchmark.
 */
import type { FocusArea } from '@haven/contracts';
import type { LlmBlock, LlmMessage, LlmProvider, LlmRequest, LlmTurn } from './provider.js';

const FOCUS_RULES: [FocusArea, RegExp][] = [
  ['academic_stress', /exam|assignment|study|grade|deadline|fyp|考试|作业|学业|论文|成绩/i],
  ['loneliness', /lonely|alone|no friends|孤独|寂寞|一个人/i],
  ['homesickness', /homesick|miss home|family back|想家/i],
  ['relationships', /roommate|housemate|friend|partner|boyfriend|girlfriend|family|室友|朋友|男朋友|女朋友|家人|关系/i],
  ['financial_stress', /money|rent|fees|loan|debt|钱|房租|学费|经济/i],
  ['sleep', /sleep|insomnia|tired|睡|失眠/i],
  ['burnout', /burn ?out|exhausted|teaching load|倦怠|累垮/i],
  ['anxiety', /anxious|anxiety|panic|worried|焦虑|紧张|恐慌/i],
];

const FOCUS_TEXT: Record<FocusArea, string> = {
  academic_stress: 'Stress related to studies and exams',
  anxiety: 'Feeling anxious',
  low_mood: 'Low mood recently',
  loneliness: 'Feeling lonely',
  homesickness: 'Homesickness',
  relationships: 'Ongoing difficulty in a close relationship',
  financial_stress: 'Financial pressure',
  sleep: 'Trouble sleeping',
  work_stress: 'Work-related stress',
  burnout: 'Signs of burnout',
};

const TAG_FOCUS: Record<string, FocusArea> = {
  tExams: 'academic_stress', tAssign: 'academic_stress', tMoney: 'financial_stress', tSleep: 'sleep',
  tLonely: 'loneliness', tHome: 'homesickness', tFamily: 'relationships', tTeach: 'burnout',
  tResearch: 'work_stress', tDeadline: 'work_stress', tBalance: 'burnout', tPromo: 'work_stress',
};

interface Facts {
  today: string;
  locale: 'en' | 'zh';
  languages: string[];
  modes: string[];
  message: string;
  tags: string[];
  lowDays: number;
  days: number;
}

/** Reads the facts back out of the loop's first user message (agent/prompt.ts firstUserMessage). */
function readFacts(first: string): Facts {
  const line = (re: RegExp) => first.match(re)?.[1]?.trim() ?? '';
  const list = (s: string) => (s && s !== 'any' ? s.split(',').map((x) => x.trim()) : []);
  const checkins = [...first.matchAll(/mood (\d), energy \d(?:, themes: ([^\n]+))?/g)];
  return {
    today: line(/Today \(campus time\): (\S+)/),
    locale: line(/language: (\w+)/) === 'zh' ? 'zh' : 'en',
    languages: list(line(/Preferences: languages ([^;]+);/)),
    modes: list(line(/; modes ([^;]+);/)),
    message: first.match(/<user_message>\n([\s\S]*)\n<\/user_message>/)?.[1] ?? '',
    tags: checkins.flatMap((m) => (m[2] ? m[2].split(', ') : [])),
    lowDays: checkins.filter((m) => Number(m[1]) <= 2).length,
    days: checkins.length,
  };
}

function mainFocus(f: Facts): FocusArea {
  for (const [area, re] of FOCUS_RULES) if (re.test(f.message)) return area;
  const counts = new Map<FocusArea, number>();
  for (const tag of f.tags) {
    const a = TAG_FOCUS[tag];
    if (a) counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'low_mood';
}

const zh = (f: Facts, en: string, cn: string) => (f.locale === 'zh' ? cn : en);

interface Item {
  itemId: string;
  choice: 'share' | 'generalise' | 'withhold';
  counsellorText: string | null;
  userLabel: string;
  reason: string;
}

function disclosure(f: Facts, focus: FocusArea): Item[] {
  const sentences = f.message
    .split(/(?<=[.!?。！？])\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  const items = sentences.map((s, i): Item => {
    const label = s.length > 60 ? `${s.slice(0, 57)}…` : s;
    const itemId = `d${i + 1}`;
    // counsellorText is always a fixed theme phrase, never the user's words, so a generalised item cannot leak details.
    const area = FOCUS_RULES.find(([, re]) => re.test(s))?.[0];
    if (!area && /\[(phone|email|id|link|name)\]/.test(s)) {
      return { itemId, choice: 'withhold', counsellorText: null, userLabel: label, reason: zh(f, 'Contains identifying details.', '包含可识别身份的信息。') };
    }
    if (area === 'financial_stress') {
      return { itemId, choice: 'withhold', counsellorText: null, userLabel: label, reason: zh(f, 'Not needed for a first session; you can raise it yourself.', '首次咨询不需要，你可以当面再说。') };
    }
    if (area) {
      return { itemId, choice: 'generalise', counsellorText: FOCUS_TEXT[area], userLabel: label, reason: zh(f, 'Shared as a general theme, without details.', '只共享大致主题，不含细节。') };
    }
    return { itemId, choice: 'withhold', counsellorText: null, userLabel: label, reason: zh(f, 'Not needed to prepare the session.', '准备咨询时不需要这部分。') };
  });
  if (!items.some((i) => i.choice !== 'withhold')) {
    items.unshift({
      itemId: 'd0',
      choice: 'share',
      counsellorText: FOCUS_TEXT[focus],
      userLabel: zh(f, 'Your recent check-ins', '你最近的心情记录'),
      reason: zh(f, 'Helps the counsellor prepare.', '帮助咨询师做准备。'),
    });
  }
  return items.slice(0, 8);
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export class ScriptedProvider implements LlmProvider {
  readonly name = 'scripted';
  private seq = 0;

  private call(name: string, input: unknown): LlmTurn {
    const blocks: LlmBlock[] = [{ type: 'tool_call', id: `scripted_${++this.seq}`, name, input }];
    return { stopReason: 'tool_use', blocks, raw: blocks };
  }
  private end(text: string): LlmTurn {
    const blocks: LlmBlock[] = [{ type: 'text', text }];
    return { stopReason: 'end', blocks, raw: blocks };
  }

  async complete(req: LlmRequest): Promise<LlmTurn> {
    const first = req.messages[0];
    const f = readFacts(first?.role === 'user' ? (first.text ?? '') : '');
    const focus = mainFocus(f);
    const history = req.messages.flatMap((m: LlmMessage) => (m.role === 'assistant' ? m.blocks.filter((b) => b.type === 'tool_call') : []));
    const results = req.messages.flatMap((m: LlmMessage) => (m.role === 'user' ? (m.toolResults ?? []) : []));
    const last = history.at(-1);
    const lastResult = results.at(-1);
    const parsed = lastResult ? (JSON.parse(lastResult.content) as unknown) : undefined;

    if (!last) {
      return this.call('search_counsellors', {
        ...(f.languages[0] ? { language: f.languages[0] } : f.locale === 'zh' ? { language: 'zh' } : {}),
        ...(f.modes[0] ? { mode: f.modes[0] } : {}),
        focusArea: focus,
      });
    }
    const searchIdx = history.findIndex((h) => h.name === 'search_counsellors');
    const counsellors = (searchIdx >= 0 ? JSON.parse(results[searchIdx]!.content) : []) as { id: string; modes: string[] }[];
    const triedLists = history.filter((h) => h.name === 'list_open_slots').length;

    if (last.name === 'search_counsellors') {
      if (!Array.isArray(parsed) || parsed.length === 0) return this.end('No counsellor matched the preferences.');
      return this.call('list_open_slots', { counsellorId: (parsed[0] as { id: string }).id, from: f.today, to: addDays(f.today, 14) });
    }
    if (last.name === 'list_open_slots') {
      const slots = Array.isArray(parsed) ? (parsed as { id: string }[]) : [];
      if (slots.length === 0) {
        const next = counsellors[triedLists];
        if (!next) return this.end('No open times found.');
        return this.call('list_open_slots', { counsellorId: next.id, from: f.today, to: addDays(f.today, 14) });
      }
      return this.call('hold_slot', { slotId: slots[0]!.id });
    }
    if (last.name === 'hold_slot') {
      const listIdx = history.map((h) => h.name).lastIndexOf('list_open_slots');
      const slots = JSON.parse(results[listIdx]!.content) as { id: string; counsellorId: string }[];
      if (lastResult?.isError) {
        const tried = history.filter((h, i) => i > listIdx && h.name === 'hold_slot').length;
        const next = slots[tried];
        return next ? this.call('hold_slot', { slotId: next.id }) : this.end('Every time was taken.');
      }
      const held = (parsed as { slotId: string }).slotId;
      const slot = slots.find((s) => s.id === held)!;
      const c = counsellors.find((x) => x.id === slot.counsellorId);
      const mode = (f.modes.find((m) => c?.modes.includes(m)) ?? c?.modes[0] ?? 'video') as string;
      return this.call('submit_proposal', {
        summary: zh(
          f,
          `${f.lowDays} of your last ${f.days} check-ins were low. Here is the soonest suitable time.`,
          `你最近 ${f.days} 次记录中有 ${f.lowDays} 次情绪偏低。这是最早的合适时间。`,
        ),
        counsellorId: slot.counsellorId,
        slotId: held,
        mode,
        matchReasons: [zh(f, 'Fits your language and session preferences', '符合你的语言和见面方式偏好'), zh(f, 'Earliest open time', '最早的空闲时间')],
        disclosure: disclosure(f, focus),
      });
    }
    // A rejected submission: give up cleanly rather than loop.
    return this.end('Could not complete a proposal.');
  }
}
