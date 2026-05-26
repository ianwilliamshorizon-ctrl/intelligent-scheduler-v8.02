import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// 1. Environment Detection (Minimal for logging)
export const isDev = () => {
    // @ts-ignore
    return !!(import.meta.env && import.meta.env.DEV);
};

export const currentEnvironment: 'Production' | 'Development' = isDev() ? 'Development' : 'Production';

// 2. Config Object (Directly driven by standard Vite .env variables)
export const firebaseConfig = {
    // @ts-ignore
    apiKey: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY) || "AIzaSyMockKeyForTestingPurposesOnly_",
    // @ts-ignore
    authDomain: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || "mock-auth-domain.firebaseapp.com",
    // @ts-ignore
    projectId: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_PROJECT_ID) || "mock-project-id",
    // @ts-ignore
    storageBucket: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || "mock-project-id.appspot.com",
    // @ts-ignore
    messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || "1234567890",
    // @ts-ignore
    appId: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_APP_ID) || "1:1234567890:web:123456"
};

export const COLLECTION_NAME = 'brooks';

// 3. DATABASE ID (Driven by .env)
// @ts-ignore
export const FIREBASE_DATABASE_ID = import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)';

// 4. INITIALIZE FIREBASE
const app = initializeApp(firebaseConfig);

// Initialize Firestore based on Database ID
export const db = FIREBASE_DATABASE_ID === '(default)' 
    ? getFirestore(app) 
    : getFirestore(app, FIREBASE_DATABASE_ID);

export const auth = getAuth(app);
export const storage = getStorage(app);

console.log(`🚀 [SYSTEM] FIREBASE INITIALIZED FOR PROJECT: ${firebaseConfig.projectId}`);
console.log(`🎯 TARGET DATABASE: ${FIREBASE_DATABASE_ID}`);