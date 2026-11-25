/** Screen-level smoke tests in jsdom with a stubbed API: onboarding, check-in, and SOS without a network. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { freshState } from './store';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('App', () => {
  it('onboarding: welcome → privacy → role → skip PIN → home', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])));
    render(<App />);
    click('Get started');
    click('I understand');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveProperty('disabled', true);
    click(/Student/);
    click('Continue');
    click('Skip for now');
    expect(await screen.findByText('How are you today?')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('haven-app-v2')!).onboarded).toBe(true);
  });

  it('a check-in stays on the device: saved to localStorage, never sent to the server', async () => {
    const fetchMock = vi.fn(async () => Response.json([]));
    vi.stubGlobal('fetch', fetchMock);
    render(<App initial={{ ...freshState(), onboarded: true, role: 'student' }} />);
    click('Start check-in');
    click('Low');
    click('Next');
    click(/Drained/);
    click('Next');
    fireEvent.change(screen.getByLabelText('Private note (optional)'), { target: { value: 'my secret note' } });
    click('Save check-in');
    expect(await screen.findByText('Saved privately')).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem('haven-app-v2')!);
    expect(stored.checkins.at(-1)).toMatchObject({ mood: 2, energy: 1, note: 'my secret note', sample: false });
    for (const call of fetchMock.mock.calls as unknown as [string, RequestInit?][]) {
      expect(String(call[1]?.body ?? '')).not.toContain('secret');
    }
  });

  it('S1: SOS works with the network down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    render(<App initial={{ ...freshState(), onboarded: true, role: 'student' }} />);
    await act(async () => click(/SOS/));
    expect(screen.getByText('In immediate danger?')).toBeTruthy();
    click('Call 999');
    expect(screen.getByText('999')).toBeTruthy();
  });
});
