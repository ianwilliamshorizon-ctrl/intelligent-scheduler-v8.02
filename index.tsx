import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { DataContextProvider } from './core/state/DataContext';
import { AppProvider } from './core/state/AppContext';
import { initializeGenerativeAI } from './core/services/geminiService';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
if (apiKey) {
    initializeGenerativeAI(apiKey);
} else {
    console.error("Gemini API key not found. Live Assistant will be disabled.");
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <DataContextProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </DataContextProvider>
  </React.StrictMode>
);