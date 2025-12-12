import { component$, useSignal, $ } from '@builder.io/qwik';
import { getClientFromEnv } from '../../../services/supabase';

export const DebugNow = component$(() => {
  const status = useSignal('Idle');

  const runNow = $(async () => {
    const { client, error } = getClientFromEnv();
    if (!client) {
      status.value = error || 'Supabase not configured';
      return;
    }
    status.value = 'Running NOW()…';
    const { data, error: queryError } = await client
      .from('profiles')
      .select('count')
      .limit(1);

    if (queryError) {
      status.value = `Error: ${queryError.message}`;
      console.error('[debug-now] error', queryError);
      return;
    }

    status.value = `Connected. Rows in profiles: ${data?.[0]?.count ?? 'unknown'}`;
  });

  return (
    <div class="card auth" style={{ marginTop: '12px' }}>
      <div class="field">
        <span>Connection check</span>
        <button type="button" class="cta" onClick$={runNow}>
          Now
        </button>
        <p class="status">{status.value}</p>
      </div>
    </div>
  );
});
