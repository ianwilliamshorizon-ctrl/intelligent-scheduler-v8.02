
import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import * as T from '../../types';
import { usePersistentState } from './usePersistentState';
import { getInitialUsers } from '../data/initialData';
import { useData } from './DataContext';
import { getInitialAppEnvironment } from '../config/firebaseConfig';
import { AuthService } from '../services/authService';
import { auth } from '../db';
import { onAuthStateChanged } from 'firebase/auth';

export interface ConfirmationState {
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'success' | 'warning';
}

interface AppContextType {
    currentView: T.ViewType;
    setCurrentView: React.Dispatch<React.SetStateAction<T.ViewType>>;
    selectedEntityId: string;
    setSelectedEntityId: React.Dispatch<React.SetStateAction<string>>;
    currentUser: T.User;
    setCurrentUser: React.Dispatch<React.SetStateAction<T.User>>;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    users: T.User[];
    setUsers: React.Dispatch<React.SetStateAction<T.User[]>>;
    filteredBusinessEntities: T.BusinessEntity[];
    isCheckInOpen: boolean;
    setIsCheckInOpen: React.Dispatch<React.SetStateAction<boolean>>;
    checkingInJobId: string | null;
    setCheckingInJobId: React.Dispatch<React.SetStateAction<string | null>>;
    isDebugMode: boolean;
    setIsDebugMode: React.Dispatch<React.SetStateAction<boolean>>;
    confirmation: ConfirmationState;
    setConfirmation: React.Dispatch<React.SetStateAction<ConfirmationState>>;
    backupSchedule: T.BackupSchedule;
    setBackupSchedule: React.Dispatch<React.SetStateAction<T.BackupSchedule>>;
    appEnvironment: T.AppEnvironment;
    setAppEnvironment: React.Dispatch<React.SetStateAction<T.AppEnvironment>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentView, setCurrentView] = useState<T.ViewType>('dashboard');
    const [selectedEntityId, setSelectedEntityId] = useState<string>('ent_porsche');
    
    // We still load users from persistent state to get roles/permissions
    const [users, setUsers] = usePersistentState<T.User[]>('brooks_users', getInitialUsers);
    
    // Auth State
    // Initialize with a safe default, will be overwritten by auth check
    const [currentUser, setCurrentUser] = useState<T.User>(users[0] || getInitialUsers()[0]);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const { businessEntities } = useData();
    
    // State for CheckIn Modal
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [checkingInJobId, setCheckingInJobId] = useState<string | null>(null);
    
    const [isDebugMode, setIsDebugMode] = useState(false);
    const [confirmation, setConfirmation] = useState<ConfirmationState>({ isOpen: false, title: '', message: '' });

    const [backupSchedule, setBackupSchedule] = usePersistentState<T.BackupSchedule>('brooks_backup_schedule', () => ({
        enabled: true,
        times: ['12:00', '18:00'],
    }));

    const [appEnvironment, setAppEnvironment] = usePersistentState<T.AppEnvironment>('brooks_environment', getInitialAppEnvironment);

    const filteredBusinessEntities = useMemo(() => {
        return businessEntities.filter(e => e.type === 'Workshop');
    }, [businessEntities]);

    // Ensure selectedEntityId is valid
    React.useEffect(() => {
        if (filteredBusinessEntities.length > 0 && selectedEntityId !== 'all' && !filteredBusinessEntities.some(e => e.id === selectedEntityId)) {
            setSelectedEntityId(filteredBusinessEntities[0].id);
        }
    }, [filteredBusinessEntities, selectedEntityId]);

    // --- Firebase Auth Listener ---
    useEffect(() => {
        if (auth) {
            const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
                if (firebaseUser) {
                    // User is signed in. Find matching profile.
                    // Priority: Email match -> fallback to ID match if email is missing in legacy data
                    const internalUser = users.find(u => 
                        (u.email && u.email.toLowerCase() === firebaseUser.email?.toLowerCase()) || 
                        u.id === firebaseUser.uid
                    );

                    if (internalUser) {
                        setCurrentUser(internalUser);
                        setIsAuthenticated(true);
                    } else {
                        console.warn("Firebase user authenticated but no matching internal profile found:", firebaseUser.email);
                        // Optional: Create a temporary guest user or deny access
                        setIsAuthenticated(false);
                    }
                } else {
                    // User is signed out
                    setIsAuthenticated(false);
                }
            });
            return () => unsubscribe();
        }
    }, [users]);

    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            const user = await AuthService.login(email, password, users);
            if (user) {
                setCurrentUser(user);
                setIsAuthenticated(true);
                setCurrentView('dashboard');
                return true;
            }
            return false;
        } catch (error) {
            console.error("Login error:", error);
            return false;
        }
    };

    const logout = () => {
        AuthService.logout();
        setIsAuthenticated(false);
    };

    const value = {
        currentView, setCurrentView,
        selectedEntityId, setSelectedEntityId,
        currentUser, setCurrentUser,
        isAuthenticated,
        login,
        logout,
        users, setUsers,
        filteredBusinessEntities,
        isCheckInOpen, setIsCheckInOpen,
        checkingInJobId, setCheckingInJobId,
        isDebugMode, setIsDebugMode,
        confirmation, setConfirmation,
        backupSchedule, setBackupSchedule,
        appEnvironment, setAppEnvironment,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppContextProvider');
    }
    return context;
};
