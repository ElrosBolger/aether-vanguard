import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Signals to Telegram that the app is loaded: removes the native splash screen
// and makes initData, theme, and other WebApp APIs reliably available.
window.Telegram?.WebApp?.ready();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
