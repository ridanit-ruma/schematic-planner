import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import '@xyflow/react/dist/style.css';
import './styles/index.css';

import { App } from './App';
import { applyStoredTheme } from './components/ui/theme';

// Applied before the first paint so the page never flashes the wrong theme.
applyStoredTheme();

const container = document.getElementById('root');
if (container === null) throw new Error('missing #root');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
