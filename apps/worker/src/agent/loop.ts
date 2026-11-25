/**
 * The agent loop: model ↔ tools until submit_proposal succeeds, or the limits are hit (CONTRACTS.md §5).
 * Limits: 8 tool calls and a 30 s wall clock. Every step is written to the trace.
 * Any failure leaves no hold behind (the caller releases holds on a non-proposal result).
 */
import type { AgentRunRequest } from '@haven/contracts';
import type { LlmMessage, LlmProvider, ToolResult } from '../llm/provider.js';
import { buildProposal, type BuiltProposal } from './proposal.js';
import { firstUserMessage, SYSTEM_PROMPT } from './prompt.js';
import type { RunRow, Trace } from './runs.js';
import { runTool, TOOL_SPECS, ToolInputError } from './tools.js';

export const MAX_TOOL_CALLS = 8;
export const MAX_WALL_MS = 30_000;

export type LoopResult = { ok: true; built: BuiltProposal } | { ok: false; reason: string };

/** Trace-safe summary of a tool input: ids and filters only, never user-written text. */
function describeCall(name: string, input: unknown): unknown {
  if (name !== 'submit_proposal' || typeof input !== 'object' || input === null) return input;
  const p = input as { slotId?: unknown; counsellorId?: unknown; mode?: unknown; disclosure?: { itemId?: unknown; choice?: unknown }[] };
  return {
    slotId: p.slotId,
    counsellorId: p.counsellorId,
    mode: p.mode,
    disclosure: Array.isArray(p.disclosure) ? p.disclosure.map((d) => ({ itemId: d.itemId, choice: d.choice })) : undefined,
  };
}

export async function runLoop(deps: {
  db: D1Database;
  provider: LlmProvider;
  run: RunRow;
  request: AgentRunRequest;
  redactedMessage: string | undefined;
  trace: Trace;
  clock?: () => Date;
}): Promise<LoopResult> {
  const clock = deps.clock ?? (() => new Date());
  const started = clock().getTime();
  const messages: LlmMessage[] = [{ role: 'user', text: firstUserMessage(deps.request, deps.redactedMessage, clock()) }];
  let toolCalls = 0;

  while (true) {
    if (clock().getTime() - started > MAX_WALL_MS) return { ok: false, reason: 'time limit reached' };

    const turn = await deps.provider.complete({ system: SYSTEM_PROMPT, messages, tools: TOOL_SPECS });
    messages.push({ role: 'assistant', blocks: turn.blocks, raw: turn.raw });
    const calls = turn.blocks.filter((b) => b.type === 'tool_call');
    await deps.trace.add('llm_turn', `Model turn: ${calls.length} tool call(s), stop=${turn.stopReason}`, turn.usage ?? null);

    if (turn.stopReason === 'refusal') return { ok: false, reason: 'model declined' };
    if (calls.length === 0) return { ok: false, reason: `model stopped without a proposal (${turn.stopReason})` };

    const results: ToolResult[] = [];
    for (const call of calls) {
      if (++toolCalls > MAX_TOOL_CALLS) return { ok: false, reason: 'tool call limit reached' };
      await deps.trace.add('tool_call', `Call ${call.name}`, describeCall(call.name, call.input));
      try {
        if (call.name === 'submit_proposal') {
          const built = await buildProposal(deps.db, deps.run, call.input, clock());
          if (built.downgraded.length > 0) {
            await deps.trace.add('validation', `Withheld ${built.downgraded.length} item(s) containing identifiers`, built.downgraded);
          }
          await deps.trace.add('tool_result', 'Proposal accepted', { slotId: built.stored.slot.id, items: built.stored.disclosure.length });
          return { ok: true, built };
        }
        const output = await runTool(deps.db, deps.run, call.name, call.input, clock());
        await deps.trace.add('tool_result', `${call.name} ok`, output);
        results.push({ toolCallId: call.id, content: JSON.stringify(output), isError: false });
      } catch (err) {
        if (!(err instanceof ToolInputError)) throw err;
        await deps.trace.add('tool_result', `${call.name} rejected: ${err.message}`);
        results.push({ toolCallId: call.id, content: JSON.stringify({ error: err.message }), isError: true });
      }
    }
    messages.push({ role: 'user', toolResults: results });
  }
}
