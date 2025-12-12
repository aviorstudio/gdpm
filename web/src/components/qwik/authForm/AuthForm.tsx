import { component$, useStore, useVisibleTask$, $ } from '@builder.io/qwik';
import {
  loadExistingSession,
  runSignIn,
  runSignUp,
  type Tone,
} from './authFormUtil';

export const AuthForm = component$(() => {
  const state = useStore({
    mode: 'signin' as 'signin' | 'signup',
    identifier: '',
    username: '',
    email: '',
    password: '',
    status: '',
    tone: 'muted' as Tone,
    loading: false,
  });

  useVisibleTask$(
    async () => {
      const session = await loadExistingSession((text, tone) => {
        state.status = text;
        state.tone = tone;
      });
      if (session?.user?.email) {
        console.info('[auth] existing session found for', session.user.email);
        state.status = `Signed in as ${session.user.email}`;
        state.tone = 'success';
      } else {
        console.info('[auth] no active session on load');
      }
    },
    { eagerness: 'load' }
  );

  const handleSubmit = $(async (event?: Event) => {
    event?.preventDefault();
    if (!state.password) {
      state.status = 'Password is required.';
      state.tone = 'error';
      return;
    }

    state.loading = true;
    state.status = '';
    console.info('[auth] submitting', state.mode);

    if (state.mode === 'signin') {
      try {
        if (!state.identifier) {
          state.status = 'Email or username is required.';
          state.tone = 'error';
          state.loading = false;
          return;
        }
        const result = await runSignIn(state.identifier, state.password, (text, tone) => {
          state.status = text;
          state.tone = tone;
        });
        const redirect = result.redirect || '/';
        state.status = redirect === '/onboard' ? 'Signed in. Finish setup to continue.' : 'Signed in. Redirecting…';
        state.tone = 'success';
        console.info('[auth] sign-in success; redirecting', redirect);
        setTimeout(() => window.location.assign(redirect), 200);
      } catch (err: any) {
        state.status = err?.message || 'Sign in failed.';
        state.tone = 'error';
        console.error('[auth] sign-in error', err);
      } finally {
        state.loading = false;
      }
    } else {
      if (!state.username) {
        state.status = 'Username is required.';
        state.tone = 'error';
        state.loading = false;
        return;
      }
      if (!state.email) {
        state.status = 'Email is required.';
        state.tone = 'error';
        state.loading = false;
        return;
      }
      try {
        const result = await runSignUp(state.email, state.username, state.password, (text, tone) => {
          state.status = text;
          state.tone = tone;
        });
        if (result.redirect) {
          state.status = 'Account created. Redirecting…';
          state.tone = 'success';
          console.info('[auth] sign-up success with session; redirecting home');
          setTimeout(() => window.location.assign(result.redirect || '/'), 200);
          return;
        }
        state.status = 'Account created. Check email to confirm, then finish setup.';
        state.tone = 'success';
        console.info('[auth] sign-up success; awaiting email confirmation');
      } catch (err: any) {
        state.status = err?.message || 'Account creation failed.';
        state.tone = 'error';
        console.error('[auth] sign-up error', err);
      } finally {
        state.loading = false;
      }
    }
  });

  return (
    <form
      class="card auth"
      data-auth-form
      data-mode={state.mode}
      onSubmit$={handleSubmit}
      preventdefault:submit
    >
      <div class="toggle">
        <button
          type="button"
          class={{ pill: true, active: state.mode === 'signin' }}
          data-mode="signin"
          onClick$={() => {
            state.mode = 'signin';
            state.status = '';
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          class={{ pill: true, active: state.mode === 'signup' }}
          data-mode="signup"
          onClick$={() => {
            state.mode = 'signup';
            state.status = '';
          }}
        >
          Create account
        </button>
      </div>

      {state.mode === 'signin' && (
        <label class="field">
          <span>Email or username</span>
          <input
            name="identifier"
            autocomplete="username"
            value={state.identifier}
            onInput$={(event) => (state.identifier = (event.target as HTMLInputElement).value)}
          />
        </label>
      )}

      {state.mode === 'signup' && (
        <>
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

          <label class="field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              autocomplete="email"
              value={state.email}
              onInput$={(event) => (state.email = (event.target as HTMLInputElement).value)}
            />
          </label>
        </>
      )}

      <label class="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          minlength={6}
          autocomplete="current-password"
          value={state.password}
          onInput$={(event) => (state.password = (event.target as HTMLInputElement).value)}
        />
      </label>

      <button class="cta" type="button" data-submit disabled={state.loading} onClick$={handleSubmit}>
        {state.loading ? 'Working…' : state.mode === 'signin' ? 'Sign in' : 'Create account'}
      </button>
      <p class="status" data-tone={state.tone}>
        {state.status}
      </p>
    </form>
  );
});
