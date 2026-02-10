// Helper to read VITE env vars (standard for Vite apps)
const getEnv = (key: string) => {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        return import.meta.env[key];
    }
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
         // @ts-ignore
         return process.env[key];
    }
    return '';
}
  
export const isDev = () => {
    return false;
};
  
// Determine the active environment
// Priority: 1. LocalStorage (User Selection) 2. Env Var (Build) 3. Automatic Detection
const getActiveEnvironment = (): 'Production' | 'UAT' | 'Development' => {
    try {
        const stored = window.localStorage.getItem('brooks_environment');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.warn("Error reading environment from storage", e);
    }
    
    const envVar = getEnv('VITE_APP_ENV');
    if (envVar === 'UAT') return 'UAT';
    if (envVar === 'Production') return 'Production';
    if (envVar === 'Development') return 'Development';

    return isDev() ? 'Development' : 'Production';
};
  
export const currentEnvironment = getActiveEnvironment();
  
// Helper to select the correct key based on environment
// Looks for specific suffix (_UAT, _DEV) first, then falls back to standard keys
const getEnvKey = (baseKey: string) => {
    let key = '';
    if (currentEnvironment === 'UAT') {
        key = getEnv(`${baseKey}_UAT`);
    } else if (currentEnvironment === 'Development') {
        key = getEnv(`${baseKey}_DEV`);
    } else {
        key = getEnv(`${baseKey}_PROD`);
    }
    
    // Fallback: If the environment-specific key is missing, use the base key
    return key || getEnv(baseKey);
};
  
export const firebaseConfig = {
    apiKey: getEnvKey('VITE_FIREBASE_API_KEY'),
    authDomain: getEnvKey('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnvKey('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnvKey('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnvKey('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnvKey('VITE_FIREBASE_APP_ID')
};
  
// --- SETTINGS ---
// The collection prefix is always 'brooks'.
export const COLLECTION_NAME = 'brooks';

// Determine the Database ID based on environment
// Dev uses 'isdevdb', UAT/Prod uses '(default)'
export const FIREBASE_DATABASE_ID = currentEnvironment === 'Development' ? 'isdevdb' : '(default)';
  
export const getInitialAppEnvironment = (): 'Production' | 'UAT' | 'Development' => {
    return currentEnvironment;
};