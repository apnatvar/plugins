import '../../assets/tailwind.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const root = document.querySelector<HTMLDivElement>('#root');

if (!root) {
  throw new Error('Side panel root was not found.');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
