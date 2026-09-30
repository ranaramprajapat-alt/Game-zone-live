import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

declare global {
  interface Window {
    __setAppHeightVar?: () => void;
  }
}

const setAppHeightVar = () => {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
};

if (typeof window !== 'undefined') {
  if (window.__setAppHeightVar) {
    window.removeEventListener('resize', window.__setAppHeightVar);
    window.visualViewport?.removeEventListener('resize', window.__setAppHeightVar);
    window.visualViewport?.removeEventListener('scroll', window.__setAppHeightVar);
  }
  window.__setAppHeightVar = setAppHeightVar;

  setAppHeightVar();
  window.addEventListener('resize', setAppHeightVar);
  window.visualViewport?.addEventListener('resize', setAppHeightVar);
  window.visualViewport?.addEventListener('scroll', setAppHeightVar);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
