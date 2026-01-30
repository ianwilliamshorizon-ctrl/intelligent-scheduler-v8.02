
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Using Vite's import.meta.env syntax exclusively to avoid "process is not defined"
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Grab the Database ID from .env.local (the VITE_ version)
// If it's not set, it will default to 'isdevdb'
const dbId = import.meta.env.VITE_FIREBASE_DATABASE_ID || 'isdevdb';

// Initialize and Export Firestore
export const db = getFirestore(app, dbId);

export default app;