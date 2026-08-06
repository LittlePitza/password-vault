import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Onboarding } from './Onboarding';
import '@/src/ui/theme.css';

const container = document.getElementById('root');
if (!container) throw new Error('Falta #root en el HTML del onboarding');

createRoot(container).render(
  <StrictMode>
    <Onboarding />
  </StrictMode>,
);
