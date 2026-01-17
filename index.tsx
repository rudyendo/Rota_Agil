
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Correção para evitar tela branca: define o objeto process caso o bundler não o faça
if (typeof window !== 'undefined' && !(window as any).process) {
  (window as any).process = { env: {} };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
