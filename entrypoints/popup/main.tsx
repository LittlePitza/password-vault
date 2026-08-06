import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@/src/ui/theme.css';

const container = document.getElementById('root');
if (!container) throw new Error('Falta #root en el HTML del popup');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
