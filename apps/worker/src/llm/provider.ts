/**
 * Provider-neutral LLM interface (DECISIONS.md D3).
 * The agent loop only sees these types, so swapping vendors means writing one adapter, not touching the loop.
 */

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema of the input object (from packages/contracts via z.toJSONSchema). */
  inputSchema: Record<string, unknown>;
}

export type LlmBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown };

export interface ToolResult {
  toolCallId: string;
  /** JSON text given back to the model. */
  content: string;
  isError: boolean;
}

export type LlmMessage =
  | { role: 'user'; text?: string; toolResults?: ToolResult[] }
  | {
      role: 'assistant';
      blocks: LlmBlock[];
      /** Provider-native content, replayed verbatim (some providers require e.g. thinking blocks back unchanged). */
      raw: unknown;
    };

export type StopReason = 'tool_use' | 'end' | 'max_tokens' | 'refusal' | 'other';

export interface LlmTurn {
  stopReason: StopReason;
  blocks: LlmBlock[];
  raw: unknown;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  tools: ToolSpec[];
}

export interface LlmProvider {
  readonly name: string;
  complete(req: LlmRequest): Promise<LlmTurn>;
}
