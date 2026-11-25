/** App shell: phone frame, top bar (back / brand / SOS), the current screen, tab bar, and the desktop test panel. */
import { useEffect } from 'react';
import { TaskPanel } from '../features/study/TaskPanel';
import { DraftProvider } from './draft';
import { FeedbackProvider } from './feedback';
import { Icon } from './icons';
import type { StringKey } from './i18n';
import { NavProvider, type Route, useNav } from './nav';
import { SCREENS, TABS } from './screens';
import { type AppState, StoreProvider, useStore } from './store';

const TAB_LABEL: Record<(typeof TABS)[number], StringKey> = { home: 'tabHome', mood: 'tabMood', book: 'tabBook', me: 'tabMe' };

function startRoute(s: AppState): Route {
  if (!s.onboarded) return { name: 'welcome', params: {} };
  if (s.lockOn && s.pin) return { name: 'lock', params: {} };
  return { name: 'home', params: {} };
}

function Shell() {
  const { t, state } = useStore();
  const nav = useNav();
  const def = SCREENS[nav.current.name] ?? SCREENS.home!;
  const isTab = !!def.tab;
  const title = typeof def.title === 'function' ? def.title(nav.current.params) : def.title ? t(def.title) : '';

  useEffect(() => {
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  }, [state.lang]);

  return (
    <div className="app">
      {!def.bare && (
        <header className="topbar">
          {isTab ? (
            <>
              <div className="brand">
                <Icon.logo />
                <span className="title">{t('brand')}</span>
              </div>
              <div className="spacer" />
            </>
          ) : (
            <>
              <button className="iconbtn" aria-label={t('back')} onClick={nav.back}>
                <Icon.back />
              </button>
              <div className="title">{title}</div>
            </>
          )}
          {!def.noSos && (
            <button className="sosbtn" aria-label={`SOS: ${t('getHelp')}`} onClick={() => nav.go('sos')}>
              <Icon.sos />
              SOS
            </button>
          )}
        </header>
      )}
      <main className="host">
        <section key={nav.key} className={`screen ${nav.transition}`}>
          {def.render(nav.current.params)}
        </section>
      </main>
      {isTab && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map((k) => {
            const TabIcon = Icon[k];
            return (
              <button key={k} className="tab" aria-current={k === nav.current.name ? 'page' : undefined} onClick={() => nav.go(k, {}, { root: true })}>
                <TabIcon />
                <span>{t(TAB_LABEL[k])}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function Root() {
  const { state } = useStore();
  return (
    <NavProvider initial={startRoute(state)}>
      <DraftProvider>
        <div className="stage">
          <div className="phone">
            <FeedbackProvider>
              <Shell />
            </FeedbackProvider>
          </div>
          <FeedbackProvider>
            <TaskPanel />
          </FeedbackProvider>
        </div>
      </DraftProvider>
    </NavProvider>
  );
}

export function App({ initial }: { initial?: AppState }) {
  return (
    <StoreProvider {...(initial ? { initial } : {})}>
      <Root />
    </StoreProvider>
  );
}
