/** A scripted LlmProvider for tests: each turn is computed from the request so far (e.g. reading earlier tool results). */
import type { LlmBlock, LlmMessage, LlmProvider, LlmRequest, LlmTurn } from '../src/llm/provider';

export type Step = (req: LlmRequest) => LlmTurn;

export class ScriptedProvider implements LlmProvider {
  readonly name = 'scripted';
  readonly requests: LlmRequest[] = [];
  private i = 0;
  constructor(private readonly steps: Step[]) {}

  async complete(req: LlmRequest): Promise<LlmTurn> {
    this.requests.push(structuredClone(req));
    const step = this.steps[this.i++];
    if (!step) throw new Error('script exhausted');
    return step(req);
  }
}

let callSeq = 0;
export const call = (name: string, input: unknown): LlmTurn => {
  const blocks: LlmBlock[] = [{ type: 'tool_call', id: `call_${++callSeq}`, name, input }];
  return { stopReason: 'tool_use', blocks, raw: blocks };
};
export const say = (text: string): LlmTurn => ({ stopReason: 'end', blocks: [{ type: 'text', text }], raw: [] });

/** The parsed JSON of the most recent tool result in the conversation. */
export function lastToolResult(req: LlmRequest): any {
  const last = [...req.messages].reverse().find((m): m is Extract<LlmMessage, { role: 'user' }> => m.role === 'user' && !!m.toolResults);
  const r = last?.toolResults?.at(-1);
  return r ? JSON.parse(r.content) : undefined;
}

export const throwingProvider: LlmProvider = {
  name: 'must-not-be-called',
  complete: async () => {
    throw new Error('LLM must not be called');
  },
};
