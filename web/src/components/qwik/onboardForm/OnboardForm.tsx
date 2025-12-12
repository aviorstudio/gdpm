import { component$, useStore, useVisibleTask$, $ } from '@builder.io/qwik';
import {
  getClientOrStatus,
  profileExists,
  upsertUserProfile,
  type Tone,
} from './onboardFormUtil';

export const OnboardForm = component$(() => {
  const state = useStore({
    username: '',
    email: '',
    userId: '',
    status: 'Finish setting up your profile.',
    tone: 'muted' as Tone,
    loading: false,
  });

  useVisibleTask$(
    async () => {
      const client = getClientOrStatus((message, tone) => {
        state.status = message;
        state.tone = tone;
      });
      if (!client) return;
      console.info('[onboard] checking session');
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) {
        state.status = sessionError.message;
        state.tone = 'error';
        console.error('[onboard] session error', sessionError);
        return;
      }
      const session = sessionData.session;
      if (!session) {
        state.status = 'No active session. Sign in first.';
        state.tone = 'error';
        console.warn('[onboard] no session; stay here for now');
        return;
      }
      state.email = session.user.email || '';
      state.userId = session.user.id;

      const exists = await profileExists(client, session.user.id);

      if (exists) {
        state.status = 'Profile already exists. Redirecting…';
        state.tone = 'success';
        console.info('[onboard] profile already present, sending home');
        setTimeout(() => {
          window.location.assign('/');
        }, 300);
        return;
      }

      console.info('[onboard] no profile found; waiting for username input');
      state.status = 'Choose a username to finish.';
      state.tone = 'muted';
    },
    { eagerness: 'load' }
  );

  const saveProfile = $(async (event?: Event) => {
    event?.preventDefault();
    const client = getClientOrStatus((message, tone) => {
      state.status = message;
      state.tone = tone;
    });
    if (!client) return;
    if (!state.userId) {
      state.status = 'No session found. Please sign in.';
      state.tone = 'error';
      return;
    }
    if (!state.username) {
      state.status = 'Username is required.';
      state.tone = 'error';
      return;
    }

    state.loading = true;
    state.status = 'Saving profile…';
    state.tone = 'muted';

    const { error: upsertError } = await upsertUserProfile(client, {
      id: state.userId,
      username: state.username,
      email: state.email,
    });

    if (upsertError) {
      state.status = upsertError.message || 'Could not save profile.';
      state.tone = 'error';
      state.loading = false;
      console.error('[onboard] upsert error', upsertError);
      return;
    }

    state.status = 'Profile saved. Redirecting…';
    state.tone = 'success';
    console.info('[onboard] profile created for', state.email);
    setTimeout(() => {
      window.location.assign('/');
    }, 350);
  });

  return (
    <form class="card auth" onSubmit$={saveProfile} preventdefault:submit>
      <div class="toggle">
        <button type="button" class="pill active" disabled>
          Finish profile
        </button>
      </div>

      <p class="status" data-tone="muted">
        Signed in as {state.email || '…'}
      </p>

      <label class="field">
        <span>Username</span>
        <input
          name="username"
          autocomplete="username"
          minlength={3}
          maxlength={32}
          value={state.username}
          onInput$={(event) => (state.username = (event.target as HTMLInputElement).value)}
        />
      </label>

      <button class="cta" type="button" onClick$={saveProfile} disabled={state.loading}>
        {state.loading ? 'Saving…' : 'Complete setup'}
      </button>
      <p class="status" data-tone={state.tone}>
        {state.status}
      </p>
    </form>
  );
});
