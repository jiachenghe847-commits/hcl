/** Desktop side panel for usability testing: the task list and a reset button (hidden on phones). */
import { useNav } from '../../app/nav';
import { useStore } from '../../app/store';
import { useResetPrototype } from '../me/Me';
import { TEST_TASKS } from './tasks';

export function TaskPanel() {
  const { t } = useStore();
  const reset = useResetPrototype();
  const nav = useNav();
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
      <button className="btn ghost" style={{ marginBottom: 10 }} onClick={() => nav.go('counsellorView')}>
        {t('counsellorViewT')}
      </button>
      <button className="btn quiet" onClick={reset}>
        {t('resetDemo')}
      </button>
    </aside>
  );
}
