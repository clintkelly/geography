import { Component, type ErrorInfo, type ReactNode } from 'react';

/** If a screen crashes, say so plainly instead of showing a blank page. Saves aren't touched. */
export class ErrorScreen extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="screen">
        <section className="panel">
          <h1>Something went wrong</h1>
          <p>The game hit a bug, but your saved progress is safe.</p>
          <p className="muted">{error.message}</p>
          <button type="button" className="primary" onClick={() => location.reload()}>Reload the game</button>
        </section>
      </main>
    );
  }
}
