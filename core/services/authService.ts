import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut,
    updateProfile,
    User
} from "firebase/auth";
import { isDev } from "../config/firebaseConfig";

const auth = getAuth();

// This is a mock user for local development
const devUser = {
    uid: 'dev-user-uid',
    email: 'dev@brooks-speed.com',
    displayName: 'Dev User',
};

export const onAuthChange = (callback: (user: User | null) => void) => {
    if (isDev) {
        // In development, we'll just return the mock user immediately.
        // This simulates a logged-in state without needing real credentials.
        console.log("Running in dev mode, simulating user login.");
        callback(devUser as User);
        return () => {}; // Return an empty unsubscribe function
    }

    // In production, we use the real Firebase auth state
    const unsubscribe = onAuthStateChanged(auth, callback);
    return unsubscribe;
};

export const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
};

export const signup = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
};

export const logout = () => {
    return signOut(auth);
};

export const updateUserProfile = (user, profile) => {
    return updateProfile(user, profile);
};
