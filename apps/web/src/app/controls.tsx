/** Small shared controls: the EN / 中文 switch and the on/off toggle row. */
import { useStore } from './store';

export function LangSwitch() {
  const { state, update } = useStore();
  return (
    <div className="segment" style={{ width: 150 }}>
      {(['en', 'zh'] as const).map((l) => (
        <button key={l} aria-pressed={state.lang === l} onClick={() => update({ lang: l })}>
          {l === 'en' ? 'EN' : '中文'}
        </button>
      ))}
    </div>
  );
}

/** An on/off row with a switch, as in the prototype. */
export function ToggleRow({ id, label, desc, checked, onToggle }: { id: string; label: string; desc?: string; checked: boolean; onToggle: () => void }) {
  return (
    <div className="toggle">
      <div className="txt">
        <b id={`lbl-${id}`}>{label}</b>
        {desc && <div className="small">{desc}</div>}
      </div>
      <button className="switch" role="switch" aria-checked={checked} aria-labelledby={`lbl-${id}`} onClick={onToggle} />
    </div>
  );
}
