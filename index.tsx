import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { DataContextProvider } from './core/state/DataContext';
import { AppContextProvider } from './core/state/AppContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <DataContextProvider>
      <AppContextProvider>
        <App />
      </AppContextProvider>
    </DataContextProvider>
  </React.StrictMode>
);