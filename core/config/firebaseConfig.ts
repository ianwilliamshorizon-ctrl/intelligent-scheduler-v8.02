import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// 1. Environment Helper
const getEnv = (key: string) => {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) return import.meta.env[key];
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) return process.env[key];
    return '';
}

export const isDev = () => {
    // @ts-ignore
    return !!(import.meta.env && import.meta.env.DEV);
};

// 2. Simplified Environment Detection
// We strictly use Vite's internal mode. 
// Development if running 'npm run dev', Production if 'npm run build'
export const currentEnvironment: 'Production' | 'Development' = isDev() ? 'Development' : 'Production';

// 3. Key Selection
// Tries suffixed keys first (e.g. VITE_KEY_DEV), then falls back to standard key
const getEnvKey = (baseKey: string) => {
    const suffix = currentEnvironment === 'Development' ? '_DEV' : '_PROD';
    return getEnv(`${baseKey}${suffix}`) || getEnv(baseKey) || '';
};

// 4. Config Object
export const firebaseConfig = {
    apiKey: getEnvKey('VITE_FIREBASE_API_KEY'),
    authDomain: getEnvKey('VITE_FIREBASE_AUTH_DOMAIN'),
    // Now dynamic based on your .env files
    projectId: getEnvKey('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnvKey('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnvKey('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnvKey('VITE_FIREBASE_APP_ID')
};

export const COLLECTION_NAME = 'brooks';

// 5. DATABASE ID
// Stripped UAT check to resolve the TS2367 error
export const FIREBASE_DATABASE_ID = currentEnvironment === 'Development' 
    ? 'isdevdb' 
    : '(default)'; 

// 6. INITIALIZE FIREBASE
const app = initializeApp(firebaseConfig);

/**
 * THE COMPATIBILITY FIX
 */
export const db = FIREBASE_DATABASE_ID === '(default)' 
    ? getFirestore(app) 
    : getFirestore(app, FIREBASE_DATABASE_ID);

export const auth = getAuth(app);
export const storage = getStorage(app);

if (currentEnvironment === 'Production') {
    console.log("🚀 [SYSTEM] BROOKSPEED PRODUCTION INITIALIZED");
} else {
    console.log("🛠️ [SYSTEM] BROOKSPEED DEVELOPMENT INITIALIZED");
    console.log("🎯 TARGET DATABASE:", FIREBASE_DATABASE_ID);
}