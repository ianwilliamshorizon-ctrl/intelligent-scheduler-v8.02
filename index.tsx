import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/printable.css';
import { DataContextProvider } from './core/state/DataContext';
import { AppProvider } from './core/state/AppContext';
import { initializeGenerativeAI } from './core/services/geminiService';
import { cloudSpeechSynthesis, CloudSpeechSynthesisUtterance } from './core/utils/cloudSpeech';

// Initialize the Gemini Service via Firebase Functions (Proxy)
initializeGenerativeAI();

// Override the native Web Speech API with our Cloud TTS implementation
Object.defineProperty(window, 'speechSynthesis', {
    value: cloudSpeechSynthesis,
    writable: false,
    configurable: true
});
(window as any).SpeechSynthesisUtterance = CloudSpeechSynthesisUtterance;

setTimeout(() => {
    if (typeof window.speechSynthesis.onvoiceschanged === 'function') {
        window.speechSynthesis.onvoiceschanged(new Event('voiceschanged'));
    }
}, 500);


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