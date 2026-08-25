import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/printable.css';
import { AppProvider } from './core/state/AppContext';
import { initializeGenerativeAI } from './core/services/geminiService';
import { cloudSpeechSynthesis, CloudSpeechSynthesisUtterance } from './core/utils/cloudSpeech';

// Auto-recover from dynamic chunk import failures caused by new deployment releases
window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    const hasReloaded = sessionStorage.getItem('vite_preload_error_reloaded');
    if (!hasReloaded) {
        sessionStorage.setItem('vite_preload_error_reloaded', 'true');
        window.location.reload();
    }
});

window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || event.reason?.toString() || '';
    if (reason.includes('Failed to fetch dynamically imported module') || reason.includes('Importing a module script failed')) {
        const hasReloaded = sessionStorage.getItem('vite_preload_error_reloaded');
        if (!hasReloaded) {
            sessionStorage.setItem('vite_preload_error_reloaded', 'true');
            window.location.reload();
        }
    }
});

// Clear reload flag upon successful application load
sessionStorage.removeItem('vite_preload_error_reloaded');

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
        <AppProvider>
            <App />
        </AppProvider>
    </React.StrictMode>
);