import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

function initGoogleAnalytics() {
  const measurementId = import.meta.env.VITE_GA_ID || 'G-Z3L1ZHWP09';
  if (!measurementId || typeof window === 'undefined') return;

  if (document.querySelector('script[data-ga-loader="true"]')) return;

  const gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  gaScript.setAttribute('data-ga-loader', 'true');
  document.head.appendChild(gaScript);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);
}

initGoogleAnalytics();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
