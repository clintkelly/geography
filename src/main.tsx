import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { ErrorScreen } from './ui/ErrorScreen';
import { watchErrors } from './ui/errorLog';
import './ui/styles.css';

watchErrors();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ErrorScreen>
      <App />
    </ErrorScreen>
  </StrictMode>,
);
