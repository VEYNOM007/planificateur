import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { requestPersistentStorage } from './platform/storage';
import './styles/tokens.css';
import './styles/global.css';

void requestPersistentStorage();

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Conteneur #root introuvable dans index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
