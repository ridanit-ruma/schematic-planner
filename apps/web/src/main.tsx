import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import '@xyflow/react/dist/style.css';
import './styles/index.css';

import { App } from './App';
import { initI18n } from './i18n';

// Applied before the first paint so the page never flashes the wrong theme.

const container = document.getElementById('root');
if (container === null) throw new Error('missing #root');

// The language is settled before anything is drawn, so no screen paints in
// English first and then changes under the reader.
void initI18n().then(() => {
  createRoot(container).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
});
