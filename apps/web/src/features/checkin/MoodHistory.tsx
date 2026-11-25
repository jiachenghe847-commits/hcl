/** Mood tab: 7-day chart (mood line over energy bars), top themes, and history. Data is local only. */
import { Face, Icon } from '../../app/icons';
import { DAY_NAMES, type StringKey } from '../../app/i18n';
import { useStore } from '../../app/store';
import { formatDay } from '../../app/format';
import { lastSevenDays, topThemes } from './logic';

const W = 320;
const H = 150;
const PAD_L = 22;
const PAD_B = 22;
const PAD_T = 8;
const x = (i: number) => PAD_L + i * ((W - PAD_L - 12) / 6);
const y = (v: number) => PAD_T + (5 - v) * ((H - PAD_T - PAD_B) / 4);

export function MoodHistory() {
  const { t, state } = useStore();
  const days = lastSevenDays(state.checkins);
  const path = days
    .map((p, i) => (p.entry ? `${x(i).toFixed(1)} ${y(p.entry.mood).toFixed(1)}` : null))
    .filter(Boolean)
    .map((pt, i) => `${i ? 'L' : 'M'}${pt}`)
    .join('');
  const themes = topThemes(state.checkins);
  const list = [...state.checkins].reverse().slice(0, 7);
  const sample = state.checkins.some((c) => c.sample);

  return (
    <>
      <h2>{t('moodTitle')}</h2>
      <div className="card chart">
        <div className="row">
          <h3>{t('last7')}</h3>
          <div className="spacer" />
          {sample && <span className="sample">{t('sampleData')}</span>}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('last7')}>
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={W - 6} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={2} y={y(v) + 4} fontSize={10} fill="var(--muted)">
                {v}
              </text>
            </g>
          ))}
          {days.map((p, i) =>
            p.entry ? <rect key={`e${i}`} x={x(i) - 7} y={y(p.entry.energy)} width={14} height={H - PAD_B - y(p.entry.energy)} rx={3} fill="var(--accent-soft)" /> : null,
          )}
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />
          {days.map((p, i) =>
            p.entry ? <circle key={`m${i}`} cx={x(i)} cy={y(p.entry.mood)} r={i === 6 ? 6 : 4.5} fill={`var(--m${p.entry.mood})`} stroke="var(--card)" strokeWidth={2} /> : null,
          )}
          {days.map((p, i) => (
            <text key={p.d} x={x(i)} y={H - 6} fontSize={11} textAnchor="middle" fill="var(--muted)" fontWeight={i === 6 ? 700 : 400}>
              {DAY_NAMES[state.lang][new Date(`${p.d}T12:00:00`).getDay()]}
            </text>
          ))}
        </svg>
        <div className="legend">
          <span>
            <i style={{ background: 'var(--accent)' }} />
            {t('moodLine')} (1–5)
          </span>
          <span>
            <i style={{ background: 'var(--accent-soft)' }} />
            {t('energyBar')} (1–5)
          </span>
        </div>
      </div>
      <div className="card">
        <h3>{t('themes')}</h3>
        {themes.length ? (
          <div className="chips">
            {themes.map(([k, n]) => (
              <span key={k} className="pill">
                {t(k as StringKey)} · {n}
              </span>
            ))}
          </div>
        ) : (
          <p className="small">{t('noThemes')}</p>
        )}
      </div>
      <div className="card">
        <h3>{t('history')}</h3>
        {list.length ? (
          list.map((c) => (
            <div className="row" key={c.d}>
              <Face level={c.mood} size={32} />
              <div style={{ flex: 1 }}>
                <b>{formatDay(c.d, state.lang)}</b>
                <div className="small">
                  {t(`mood${c.mood}` as StringKey)} · {t('energyBar')} {c.energy}/5
                  {c.tags.length ? ` · ${c.tags.map((k) => t(k as StringKey)).join(', ')}` : ''}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="small">—</p>
        )}
        <p className="note">
          <Icon.lock />
          {t('storedHere')}
        </p>
      </div>
    </>
  );
}
