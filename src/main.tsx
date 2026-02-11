import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { initSmuflFonts } from './fonts/initSmuflFonts';
import './styles.css';

initSmuflFonts();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/microrimba">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
