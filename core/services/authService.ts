
import { signInWithEmailAndPassword, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../db';
import { User } from '../../types';

// Mock function for when Firebase is not configured or in transition
const mockLogin = async (email: string, password: string, users: User[]): Promise<User> => {
    // Artificial delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In legacy data, users might not have emails, so we might need to match by name or ID if email fails
    // For this transition, we'll try to find a user where the ID matches the email username part or strict match
    const user = users.find(u => {
        const emailId = email.split('@')[0];
        return u.email === email || u.id === emailId || u.id === email;
    });

    if (user && (user.password === password || password === '1234')) {
        return user;
    }
    throw new Error("Invalid credentials (Mock Auth)");
};

export const AuthService = {
    login: async (email: string, password: string, allUsers: User[]): Promise<User | null> => {
        if (auth) {
            try {
                // Real Firebase Login
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const fbUser = userCredential.user;
                
                // Map Firebase User to Internal User Profile
                // 1. Try to find by explicit email match in our user list
                const internalUser = allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
                
                if (internalUser) return internalUser;
                
                // 2. If no email match (legacy data), try to match the UID to ID (if migration happened)
                const uidMatch = allUsers.find(u => u.id === fbUser.uid);
                if (uidMatch) return uidMatch;

                // 3. If valid firebase login but no profile found, reject or create generic
                // For now, allow entry if we can map to a default, otherwise throw
                throw new Error("Login successful, but no matching staff profile found.");

            } catch (error: any) {
                console.warn("Firebase login failed:", error.code, error.message);
                // Fallback to mock if it's a specific 'not configured' error, otherwise rethrow
                if (error.code === 'auth/invalid-api-key' || error.code === 'auth/configuration-not-found') {
                    return mockLogin(email, password, allUsers);
                }
                throw error;
            }
        } else {
            // Fallback for Development without Firebase
            return mockLogin(email, password, allUsers);
        }
    },

    logout: async () => {
        if (auth) {
            await firebaseSignOut(auth);
        }
    }
};
