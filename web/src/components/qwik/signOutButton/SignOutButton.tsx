import { component$, useStore, $ } from '@builder.io/qwik';
import { getClientFromEnv } from '../../../services/supabase';

export const SignOutButton = component$(() => {
  const state = useStore({ loading: false, status: '' });

  const signOut = $(async () => {
    const { client, error } = getClientFromEnv();
    if (!client) {
      state.status = error || 'Supabase is not configured.';
      return;
    }
    state.loading = true;
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) {
      state.status = signOutError.message || 'Sign out failed.';
      state.loading = false;
      console.error('[signout] sign-out error', signOutError);
      return;
    }
    state.status = 'Signed out. Redirecting…';
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.assign('/signin');
      }
    }, 150);
  });

  return (
    <div class="main-actions">
      <button class="ghost" type="button" onClick$={signOut} disabled={state.loading}>
        {state.loading ? 'Signing out…' : 'Sign out'}
      </button>
      {state.status && (
        <p class="status" data-tone={state.status.startsWith('Signed out') ? 'success' : 'error'}>
          {state.status}
        </p>
      )}
    </div>
  );
});
