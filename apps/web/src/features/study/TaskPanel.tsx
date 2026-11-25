/** Desktop side panel for usability testing: the task list and a reset button (hidden on phones). */
import { useStore } from '../../app/store';
import { useResetPrototype } from '../me/Me';
import { TEST_TASKS } from './tasks';

export function TaskPanel() {
  const { t } = useStore();
  const reset = useResetPrototype();
  return (
    <aside className="panel">
      <h1>{t('panelTitle')}</h1>
      <p>{t('panelLead')}</p>
      <ol className="tasks">
        {TEST_TASKS.map((k) => (
          <li key={k}>
            <span>{t(k)}</span>
          </li>
        ))}
      </ol>
      <button className="btn ghost" onClick={reset}>
        {t('resetDemo')}
      </button>
    </aside>
  );
}
