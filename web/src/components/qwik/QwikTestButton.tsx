import { component$, useSignal } from '@builder.io/qwik';

export const QwikTestButton = component$(() => {
  const clicks = useSignal(0);

  return (
    <button
      type="button"
      class="qwik-button"
      onClick$={() => (clicks.value += 1)}
    >
      {clicks.value === 0
        ? 'Click to wake Qwik'
        : `Qwik clicked ${clicks.value} time${clicks.value === 1 ? '' : 's'}`}
    </button>
  );
});
