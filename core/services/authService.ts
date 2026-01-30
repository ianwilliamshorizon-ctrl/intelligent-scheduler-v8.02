import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    User
  } from "firebase/auth";
  import { auth } from "../config/firebaseConfig";
  
  const authServiceInstance = {
    /**
     * Logs in a user. Uses the 'auth' instance which is now 
     * pulling from either _DEV or _PROD keys.
     */
    login: async (email: string, password: string): Promise<User> => {
      const cleanEmail = (email || "").trim();
      
      if (import.meta.env.DEV) {
        console.log(`🔑 Login Attempt: [${cleanEmail}]`);
      }
  
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error("Please enter a valid email address.");
      }
  
      try {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        return userCredential.user;
      } catch (error: any) {
        console.error("Firebase Auth Error:", error.code, error.message);
        throw error;
      }
    },
  
    logout: async (): Promise<void> => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Logout Error:", error);
        throw error;
      }
    },
  
    subscribeToAuthChanges: (callback: (user: User | null) => void) => {
      return onAuthStateChanged(auth, callback);
    },
  
    getCurrentUser: (): User | null => {
      return auth.currentUser;
    }
  };
  
  // Exporting both to prevent "Export not found" errors in legacy components
  export const authService = authServiceInstance;
  export const AuthService = authServiceInstance;
  
  export default authServiceInstance;