/**
 * DeepSeek adapter for the provider-neutral LLM interface (DECISIONS.md D3, D11).
 * API: OpenAI-style Chat Completions at https://api.deepseek.com/chat/completions (docs read 2026-11-26).
 *
 * - Default model `deepseek-flash`, overridable with LLM_MODEL. Thinking mode is the API default.
 * - With tools in thinking mode, DeepSeek requires each assistant message, including `reasoning_content`, to be sent
 *   back unchanged on later requests, or it answers 400. We keep the whole assistant message as `raw` and replay it.
 * - Tool-call arguments arrive as a JSON string the model may get wrong. A parse failure becomes
 *   `{ __invalid_json__ }`, which the contract schemas then reject; the error goes back to the model like any bad input.
 * - Plain fetch, no SDK: the API is small and one request shape is all we use.
 */
import type { LlmBlock, LlmMessage, LlmProvider, LlmRequest, LlmTurn, StopReason } from './provider.js';

export const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-flash';

interface DsToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}
interface DsAssistantMessage {
  role: 'assistant';
  content: string | null;
  reasoning_content?: string | null;
  tool_calls?: DsToolCall[];
}
interface DsResponse {
  choices: { message: DsAssistantMessage; finish_reason: string }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

const STOP: Partial<Record<string, StopReason>> = {
  tool_calls: 'tool_use',
  stop: 'end',
  length: 'max_tokens',
  content_filter: 'refusal',
};

export class DeepSeekApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function toMessages(system: string, messages: LlmMessage[]): unknown[] {
  const out: unknown[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'assistant') {
      out.push(m.raw); // verbatim, reasoning_content included
      continue;
    }
    for (const r of m.toolResults ?? []) out.push({ role: 'tool', tool_call_id: r.toolCallId, content: r.content });
    if (m.text) out.push({ role: 'user', content: m.text });
  }
  return out;
}

function parseArgs(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return { __invalid_json__: true };
  }
}

export class DeepSeekProvider implements LlmProvider {
  readonly name = 'deepseek';

  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEEPSEEK_DEFAULT_MODEL,
    /** Tests pass a fake fetch. */
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {}

  async complete(req: LlmRequest): Promise<LlmTurn> {
    const res = await this.fetchImpl(DEEPSEEK_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 8192,
        messages: toMessages(req.system, req.messages),
        tools: req.tools.map((t) => {
          const { $schema: _ignored, ...parameters } = t.inputSchema;
          return { type: 'function', function: { name: t.name, description: t.description, parameters } };
        }),
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      // Never include the request or key in the error; the status code is enough for the trace.
      throw new DeepSeekApiError(res.status, `DeepSeek API returned ${res.status}`);
    }
    const data = (await res.json()) as DsResponse;
    const choice = data.choices[0];
    if (!choice) throw new DeepSeekApiError(502, 'DeepSeek API returned no choices');

    const msg = choice.message;
    const blocks: LlmBlock[] = [];
    if (msg.content) blocks.push({ type: 'text', text: msg.content });
    for (const c of msg.tool_calls ?? []) blocks.push({ type: 'tool_call', id: c.id, name: c.function.name, input: parseArgs(c.function.arguments) });
    return {
      stopReason: STOP[choice.finish_reason] ?? 'other',
      blocks,
      raw: msg,
      ...(data.usage ? { usage: { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens } } : {}),
    };
  }
}
