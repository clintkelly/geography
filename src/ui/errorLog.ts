/** Sends errors to the dev server's game-errors.log. Does nothing in a production build. */
export function reportError(error: unknown, where: string, extra?: string) {
  if (!import.meta.env.DEV) return;
  const e = error instanceof Error ? error : new Error(String(error));
  const body = JSON.stringify({ where, message: e.message, stack: e.stack, extra, page: location.hash || location.pathname });
  try {
    void fetch('/__error', { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch {
    // Logging must never cause a second error.
  }
}

export function watchErrors() {
  if (!import.meta.env.DEV) return;
  window.addEventListener('error', (ev) => reportError(ev.error ?? ev.message, 'window'));
  window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason, 'promise'));
}
