/**
 * Anthropic adapter for the provider-neutral LLM interface (DECISIONS.md D3).
 *
 * Request settings:
 * - Model from LLM_MODEL, default claude-opus-5-5.
 * - Adaptive thinking is always on for this model; depth is set by effort, sent explicitly as 'medium'.
 * - Server-side refusal fallbacks are on: the API retries a declined turn on a fallback model inside the same call.
 * - Top-level cache_control caches the growing conversation prefix across loop turns.
 * - The assistant's content is replayed verbatim (`raw`), so thinking blocks come back unchanged as the API requires.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { LlmBlock, LlmMessage, LlmProvider, LlmRequest, LlmTurn, StopReason } from './provider.js';

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type ContentBlock = Anthropic.Beta.Messages.BetaContentBlock;

const STOP: Partial<Record<string, StopReason>> = {
  tool_use: 'tool_use',
  end_turn: 'end',
  max_tokens: 'max_tokens',
  refusal: 'refusal',
};

function toParam(m: LlmMessage): MessageParam {
  if (m.role === 'assistant') return { role: 'assistant', content: m.raw as ContentBlock[] };
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  for (const r of m.toolResults ?? []) {
    content.push({ type: 'tool_result', tool_use_id: r.toolCallId, content: r.content, is_error: r.isError });
  }
  if (m.text) content.push({ type: 'text', text: m.text });
  return { role: 'user', content };
}

/** zod's JSON Schema carries a "$schema" key the API does not need. */
function inputSchema(schema: Record<string, unknown>): Anthropic.Beta.Messages.BetaTool.InputSchema {
  const { $schema: _ignored, ...rest } = schema;
  return rest as Anthropic.Beta.Messages.BetaTool.InputSchema;
}

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
    /** Tests pass a fake fetch; production uses the runtime's fetch. */
    fetchImpl?: typeof fetch,
  ) {
    this.client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1, ...(fetchImpl ? { fetch: fetchImpl } : {}) });
  }

  async complete(req: LlmRequest): Promise<LlmTurn> {
    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      cache_control: { type: 'ephemeral' },
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: req.system,
      tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: inputSchema(t.inputSchema) })),
      messages: req.messages.map(toParam),
    });

    const blocks: LlmBlock[] = [];
    for (const b of response.content) {
      if (b.type === 'text') blocks.push({ type: 'text', text: b.text });
      else if (b.type === 'tool_use') blocks.push({ type: 'tool_call', id: b.id, name: b.name, input: b.input });
    }
    return {
      stopReason: STOP[response.stop_reason ?? ''] ?? 'other',
      blocks,
      raw: response.content,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }
}
