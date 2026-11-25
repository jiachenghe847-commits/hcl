/** The action trace: every safety check, model turn, tool call and validation, as the server recorded it. */
import type { TraceStep } from '@haven/contracts';

const KIND_MARK: Record<TraceStep['kind'], string> = {
  safety_check: '🛡',
  llm_turn: '◆',
  tool_call: '→',
  tool_result: '←',
  validation: '✓',
  error: '!',
};

export function Trace({ steps }: { steps: TraceStep[] }) {
  return (
    <ol className="card small" style={{ listStyle: 'none', paddingLeft: 16, gap: 6, fontVariantNumeric: 'tabular-nums' }} aria-label="Action trace">
      {steps.map((s) => (
        <li key={s.seq} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 6 }}>
          <span aria-hidden>{KIND_MARK[s.kind]}</span>
          <span>
            <b>{s.kind.replace('_', ' ')}</b> · {s.summary}
          </span>
        </li>
      ))}
    </ol>
  );
}
