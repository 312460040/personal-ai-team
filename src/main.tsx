import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {installManagerPlanningOverlay} from './services/managerPlanningOverlay';
import './services/apiRouting';
import App from './App.tsx';
import './index.css';

installManagerPlanningOverlay();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
