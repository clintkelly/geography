import { useEffect, useRef } from 'react';

/** A key hint on a button. Hidden from screen readers so it doesn't change the button's name. */
export const Key = ({ k }: { k: string | number }) => <kbd aria-hidden="true">{k}</kbd>;

type Bindings = Record<string, () => void>;

/**
 * Binds keys for the current screen. Keys are lowercase, and Space counts as Enter.
 * Held keys are ignored, so holding one down can't skip through feedback or
 * submit an answer. A focused button keeps Enter and Space, so Tab works normally.
 */
export function useKeys(bindings: Bindings) {
  const latest = useRef(bindings);
  latest.current = bindings;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest?.('input, textarea, select')) return;
      const confirm = e.key === 'Enter' || e.key === ' ';
      if (confirm && target.closest?.('button, summary, a')) return;
      const action = latest.current[confirm ? 'enter' : e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
