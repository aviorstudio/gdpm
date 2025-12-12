import { component$, useStore, useVisibleTask$, $ } from '@builder.io/qwik';
import {
  getClientOrMessage,
  profileExists,
  type Tone,
} from './sessionHomeUtil';

export const SessionHome = component$(() => {
  const state = useStore({
    email: 'Checking session…',
    message: 'Looking for an active session.',
    tone: 'muted' as Tone,
    hasSession: false,
    loading: false,
  });

  useVisibleTask$(
    async () => {
      const client = getClientOrMessage((email, message, tone) => {
        state.email = email;
        state.message = message;
        state.tone = tone;
      });
      if (!client) return;
      console.info('[session] checking for existing session');
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) {
        console.error('[session] getSession error', sessionError);
        state.email = 'Session error.';
        state.message = sessionError.message;
        state.tone = 'error';
        state.hasSession = false;
        return;
      }
      const session = data?.session;
      if (!session) {
        console.warn('[session] no session found; stay on page for debugging');
        state.email = 'No active session.';
        state.message = 'Sign in to see your account.';
        state.tone = 'muted';
        state.hasSession = false;
        return;
      }

      const exists = await profileExists(client, session.user.id);

      if (!exists) {
        state.email = session.user.email ?? '';
        state.message = 'Redirecting to finish setup…';
        state.tone = 'muted';
        state.hasSession = true;
        console.info('[session] no profile row; redirecting to onboard');
        setTimeout(() => {
          window.location.assign('/onboard');
        }, 200);
        return;
      }

      state.email = session.user.email ?? '';
      state.hasSession = true;
      state.message = '';
      state.tone = 'muted';
      console.info('[session] loaded session for', state.email);
    },
    { eagerness: 'load' }
  );

  const signOut = $(async () => {
    const client = getClientOrMessage((email, message, tone) => {
      state.email = email;
      state.message = message;
      state.tone = tone;
    });
    if (!client) return;
    state.loading = true;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) {
      state.email = signOutError.message;
      state.message = 'Sign out failed.';
      state.tone = 'error';
      state.loading = false;
      console.error('[session] sign-out error', signOutError);
      return;
    }
    console.info('[session] signed out');
    state.email = 'Signed out.';
    state.message = 'Return to /signin to sign in again.';
    state.tone = 'success';
    state.hasSession = false;
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (typeof window !== 'undefined') {
      window.location.assign('/signin');
    }
  });

  return (
    <div class="card main">
      <div class="main-header">
        <p class="eyebrow">Account</p>
        <p class="signed-email">{state.email}</p>
      </div>
      <p class="main-copy">
        Keep your plugins in sync across projects. Use the sign-in page if you need to start a new
        session.
      </p>
      {state.message && (
        <p class="status" data-tone={state.tone}>
          {state.message}
        </p>
      )}
      <div class="main-actions">
        <button class="ghost" type="button" onClick$={signOut} disabled={!state.hasSession || state.loading}>
          {state.loading ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
});
