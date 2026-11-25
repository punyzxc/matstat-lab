import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SceneHost } from './app/scene-host';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SceneHost />
  </StrictMode>,
);
