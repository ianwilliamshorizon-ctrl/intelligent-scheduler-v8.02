import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/printable.css';
import { DataContextProvider } from './core/state/DataContext';
import { AppProvider } from './core/state/AppContext';
import { initializeGenerativeAI } from './core/services/geminiService';

// Initialize the Gemini Service
// Note: Since you use Firebase Functions, this helper mainly 
// satisfies the app's internal requirement for an "init" call.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (apiKey) {
    initializeGenerativeAI(apiKey);
} else {
    // We log a warning but don't crash, as the Firebase Function 
    // likely has its own API key stored in the cloud.
    console.warn("Gemini API key not found in environment. Falling back to Cloud configuration.");
    initializeGenerativeAI();
}

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount the app.");
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