/** The DeepSeek adapter against a fake Chat Completions API (no network, no key). */
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createRun } from '../src/agent/service';
import { TOOL_SPECS } from '../src/agent/tools';
import { campusDate } from '../src/catalog/time';
import { DeepSeekApiError, DeepSeekProvider } from '../src/llm/deepseek';
import { providerFromEnv } from '../src/llm/index';
import { freshKey } from './client';

function fakeApi(respond: (body: any, n: number) => object, status = 200) {
  const calls: { url: string; headers: Headers; body: any }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const body = await req.json();
    calls.push({ url: req.url, headers: req.headers, body });
    if (status !== 200) return new Response('{"error":{"message":"nope"}}', { status });
    return Response.json({ id: `c${calls.length}`, object: 'chat.completion', usage: { prompt_tokens: 50, completion_tokens: 10 }, ...respond(body, calls.length) });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const toolTurn = (name: string, args: object | string, n: number) => ({
  choices: [
    {
      finish_reason: 'tool_calls',
      message: {
        role: 'assistant',
        content: '',
        reasoning_content: `thinking ${n}`,
        tool_calls: [{ id: `call_${n}`, type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } }],
      },
    },
  ],
});

const lastToolContent = (body: any) => JSON.parse(body.messages.filter((m: any) => m.role === 'tool').at(-1).content);

describe('DeepSeek adapter', () => {
  it('sends an OpenAI-style request with bearer auth and clean tool schemas', async () => {
    const { calls, fetchImpl } = fakeApi((_b, n) => toolTurn('search_counsellors', { language: 'zh' }, n));
    const turn = await new DeepSeekProvider('test-key', 'deepseek-flash', fetchImpl).complete({
      system: 'sys',
      messages: [{ role: 'user', text: 'hi' }],
      tools: TOOL_SPECS,
    });
    const { url, headers, body } = calls[0]!;
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(headers.get('authorization')).toBe('Bearer test-key');
    expect(body.model).toBe('deepseek-flash');
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ]);
    expect(body.tools[0]).toMatchObject({ type: 'function', function: { name: 'search_counsellors' } });
    expect(JSON.stringify(body.tools)).not.toContain('$schema');
    expect(turn).toMatchObject({ stopReason: 'tool_use', blocks: [{ type: 'tool_call', id: 'call_1', name: 'search_counsellors', input: { language: 'zh' } }] });
  });

  it('drives a full run, replaying reasoning_content verbatim and wiring tool results by id', async () => {
    let slotId = '';
    const { calls, fetchImpl } = fakeApi((body, n) => {
      if (n === 1) return toolTurn('list_open_slots', { counsellorId: 'c-zhou', from: campusDate(new Date()), to: campusDate(new Date(), 14) }, n);
      if (n === 2) {
        slotId = lastToolContent(body)[0].id;
        return toolTurn('hold_slot', { slotId }, n);
      }
      return toolTurn(
        'submit_proposal',
        { summary: 's', counsellorId: 'c-zhou', slotId, mode: 'chat', matchReasons: ['r'], disclosure: [{ itemId: 'd1', choice: 'generalise', counsellorText: 'Exam stress', userLabel: 'exams', reason: 'r' }] },
        n,
      );
    });
    const { run } = await createRun({
      db: env.DB,
      provider: new DeepSeekProvider('k', 'deepseek-flash', fetchImpl),
      ownerHash: 'owner_ds',
      idempotencyKey: freshKey(),
      request: { locale: 'zh', role: 'student', checkins: [], message: '考试压力' },
      now: new Date(),
    });
    expect(run.status).toBe('proposed');
    const third = calls[2]!.body.messages;
    expect(third.filter((m: any) => m.role === 'assistant').map((m: any) => m.reasoning_content)).toEqual(['thinking 1', 'thinking 2']);
    expect(third.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'call_2' });
  });

  it('invalid JSON arguments become a rejected tool call the model can correct, not a crash', async () => {
    let slotId = '';
    const { fetchImpl } = fakeApi((body, n) => {
      if (n === 1) return toolTurn('list_open_slots', '{"counsellorId": "c-zhou", "from":', n);
      if (n === 2) {
        expect(lastToolContent(body).error).toBeTruthy();
        return toolTurn('list_open_slots', { counsellorId: 'c-zhou', from: campusDate(new Date()), to: campusDate(new Date(), 14) }, n);
      }
      if (n === 3) {
        slotId = lastToolContent(body)[0].id;
        return toolTurn('hold_slot', { slotId }, n);
      }
      return toolTurn('submit_proposal', { summary: 's', counsellorId: 'c-zhou', slotId, mode: 'chat', matchReasons: ['r'], disclosure: [] }, n);
    });
    const { run } = await createRun({
      db: env.DB,
      provider: new DeepSeekProvider('k', 'deepseek-flash', fetchImpl),
      ownerHash: 'owner_ds2',
      idempotencyKey: freshKey(),
      request: { locale: 'en', role: 'student', checkins: [] },
      now: new Date(),
    });
    expect(run.status).toBe('proposed');
  });

  it('maps stop reasons and surfaces HTTP errors without leaking the key', async () => {
    const length = fakeApi(() => ({ choices: [{ finish_reason: 'length', message: { role: 'assistant', content: 'x' } }] }));
    expect((await new DeepSeekProvider('k', 'm', length.fetchImpl).complete({ system: 's', messages: [], tools: [] })).stopReason).toBe('max_tokens');
    const filtered = fakeApi(() => ({ choices: [{ finish_reason: 'content_filter', message: { role: 'assistant', content: '' } }] }));
    expect((await new DeepSeekProvider('k', 'm', filtered.fetchImpl).complete({ system: 's', messages: [], tools: [] })).stopReason).toBe('refusal');

    const broke = fakeApi(() => ({}), 402);
    const err = await new DeepSeekProvider('secret-key', 'm', broke.fetchImpl).complete({ system: 's', messages: [], tools: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(DeepSeekApiError);
    expect(err.status).toBe(402);
    expect(String(err.message)).not.toContain('secret-key');
  });

  it('is configured only with LLM_PROVIDER=deepseek and a key', () => {
    const base = { DB: env.DB, DEMO_COUNSELLOR_PASSCODE: 'p' };
    expect(providerFromEnv({ ...base, LLM_PROVIDER: 'deepseek' })).toBeNull();
    expect(providerFromEnv({ ...base, LLM_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'k' })?.name).toBe('deepseek');
  });
});
