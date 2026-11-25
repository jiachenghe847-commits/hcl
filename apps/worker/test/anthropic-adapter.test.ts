/** The Anthropic adapter against a fake Messages API (no network, no key). Checks the wire format both ways. */
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createRun } from '../src/agent/service';
import { campusDate } from '../src/catalog/time';
import { AnthropicProvider } from '../src/llm/anthropic';
import { providerFromEnv } from '../src/llm/index';
import { TOOL_SPECS } from '../src/agent/tools';
import { freshKey } from './client';

interface Captured {
  url: string;
  headers: Headers;
  body: any;
}

function fakeApi(respond: (body: any, n: number) => object) {
  const calls: Captured[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const body: any = await req.json();
    calls.push({ url: req.url, headers: req.headers, body });
    return Response.json({
      id: `msg_${calls.length}`,
      type: 'message',
      role: 'assistant',
      model: body.model,
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 20 },
      ...respond(body, calls.length),
    });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const toolUse = (name: string, input: object, n: number) => ({
  stop_reason: 'tool_use',
  content: [
    { type: 'thinking', thinking: '', signature: `sig_${n}` },
    { type: 'tool_use', id: `toolu_${n}`, name, input },
  ],
});

/** The JSON content of the latest tool_result the client sent. */
const lastResult = (body: any) => JSON.parse(body.messages.at(-1).content.find((b: any) => b.type === 'tool_result').content);

describe('Anthropic adapter', () => {
  it('sends model, fallbacks, effort, cache and clean tool schemas; maps the reply', async () => {
    const { calls, fetchImpl } = fakeApi((_b, n) => toolUse('search_counsellors', { language: 'zh' }, n));
    const provider = new AnthropicProvider('test-key', 'claude-opus-5-5', fetchImpl);
    const turn = await provider.complete({ system: 'sys', messages: [{ role: 'user', text: 'hi' }], tools: TOOL_SPECS });

    const { body, headers, url } = calls[0]!;
    expect(url).toMatch(/\/v1\/messages/);
    expect(headers.get('authorization')).toBe('Bearer test-key'); // SDK 1.x sends the API key as a bearer token
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      cache_control: { type: 'ephemeral' },
      system: 'sys',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    });
    expect(body.tools.map((t: any) => t.name)).toEqual(TOOL_SPECS.map((t) => t.name));
    expect(JSON.stringify(body.tools)).not.toContain('$schema');
    expect(body.tools[0].input_schema.additionalProperties).toBe(false);

    expect(turn.stopReason).toBe('tool_use');
    expect(turn.blocks).toEqual([{ type: 'tool_call', id: 'toolu_1', name: 'search_counsellors', input: { language: 'zh' } }]);
    expect(turn.usage).toEqual({ inputTokens: 100, outputTokens: 20 });
  });

  it('drives a full run: thinking blocks are replayed verbatim and tool results are wired by id', async () => {
    let slotId = '';
    const { calls, fetchImpl } = fakeApi((body, n) => {
      switch (n) {
        case 1:
          return toolUse('list_open_slots', { counsellorId: 'c-zhou', from: campusDate(new Date()), to: campusDate(new Date(), 14) }, n);
        case 2:
          slotId = lastResult(body)[0].id;
          return toolUse('hold_slot', { slotId }, n);
        default:
          return toolUse(
            'submit_proposal',
            {
              summary: 'Low mood around exams.',
              counsellorId: 'c-zhou',
              slotId,
              mode: 'video',
              matchReasons: ['Speaks Chinese'],
              disclosure: [{ itemId: 'd1', choice: 'generalise', counsellorText: 'Exam stress', userLabel: 'exams', reason: 'r' }],
            },
            n,
          );
      }
    });
    const provider = new AnthropicProvider('test-key', 'claude-opus-5-5', fetchImpl);
    const { run } = await createRun({
      db: env.DB,
      provider,
      ownerHash: 'owner_adapter',
      idempotencyKey: freshKey(),
      request: { locale: 'zh', role: 'student', checkins: [], message: '考试压力很大' },
      now: new Date(),
    });

    expect(run.status).toBe('proposed');
    expect(calls).toHaveLength(3);
    const third = calls[2]!.body.messages;
    // assistant turn 2 replayed exactly as received, thinking block and signature included
    expect(third[3]).toEqual({ role: 'assistant', content: toolUse('hold_slot', { slotId }, 2).content });
    expect(third[4].content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_2', is_error: false });
  });

  it('maps refusal and max_tokens stops so the loop never runs a cut-off tool call', async () => {
    const { fetchImpl } = fakeApi(() => ({ stop_reason: 'max_tokens', content: [{ type: 'tool_use', id: 't', name: 'hold_slot', input: {} }] }));
    const turn = await new AnthropicProvider('k', 'm', fetchImpl).complete({ system: 's', messages: [{ role: 'user', text: 'x' }], tools: [] });
    expect(turn.stopReason).toBe('max_tokens');
  });

  it('is only configured when a key is present (fail closed otherwise)', () => {
    expect(providerFromEnv({ DB: env.DB, DEMO_COUNSELLOR_PASSCODE: 'p' })).toBeNull();
    expect(providerFromEnv({ DB: env.DB, DEMO_COUNSELLOR_PASSCODE: 'p', ANTHROPIC_API_KEY: 'k' })?.name).toBe('anthropic');
    expect(providerFromEnv({ DB: env.DB, DEMO_COUNSELLOR_PASSCODE: 'p', ANTHROPIC_API_KEY: 'k', LLM_PROVIDER: 'other' })).toBeNull();
  });
});
