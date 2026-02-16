import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import * as T from '../../types';
import { getAll } from '../../core/db';
import { initialData } from '../data/initialData';
import { COLLECTION_NAME, currentEnvironment } from '../../core/config/firebaseConfig'; 
// NEW: Import Firebase Auth
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// Define local interfaces for the missing type exports to fix TS errors
interface ConfirmationState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
    type: 'info' | 'success' | 'warning' | 'danger';
}

interface AppState {
    currentUser: T.User | null;
    users: T.User[];
    roles: T.Role[];
    jobs: T.Job[];
    customers: T.Customer[];
    vehicles: T.Vehicle[];
    isAuthenticated: boolean;
    currentView: string;
    setCurrentView: (view: string) => void;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    selectedEntityId: string;
    setSelectedEntityId: (id: string) => void;
    confirmation: ConfirmationState;
    setConfirmation: (state: ConfirmationState) => void;
    backupSchedule: T.BackupSchedule;
    setBackupSchedule: (schedule: T.BackupSchedule) => void;
    appEnvironment: T.AppEnvironment;
    filteredBusinessEntities: T.BusinessEntity[];
    allWorkshops: T.BusinessEntity[];
    refreshData: () => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
    const auth = getAuth(); // Initialize Firebase Auth
    const [currentUser, setCurrentUser] = useState<T.User | null>(null);
    const [users, setUsers] = useState<T.User[]>([]); // Start empty to prevent seeding
    const [roles, setRoles] = useState<T.Role[]>(initialData.roles);
    const [businessEntities, setBusinessEntities] = useState<T.BusinessEntity[]>(initialData.businessEntities);
    const [jobs, setJobs] = useState<T.Job[]>(initialData.jobs);
    const [customers, setCustomers] = useState<T.Customer[]>(initialData.customers);
    const [vehicles, setVehicles] = useState<T.Vehicle[]>(initialData.vehicles);

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentView, setCurrentView] = useState('dashboard');
    const [selectedEntityId, setSelectedEntityId] = useState<string>(''); 
    const [confirmation, setConfirmation] = useState<ConfirmationState>({ 
        isOpen: false, title: '', message: '', type: 'info'
    });
    const [backupSchedule, setBackupSchedule] = useState<T.BackupSchedule>({ enabled: false, times: ['02:00', '14:00'] });

    const hasInitialized = useRef(false);
    const appEnvironment = currentEnvironment;

    const allWorkshops = useMemo(() => {
        return businessEntities.filter(e => e.type === "Workshop");
    }, [businessEntities]);

    // Track Firebase Auth State
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // Link Firebase User to Firestore Profile
                const profile = users.find(u => u.email === user.email);
                if (profile) {
                    setCurrentUser(profile);
                    setIsAuthenticated(true);
                }
            } else {
                setIsAuthenticated(false);
                setCurrentUser(null);
            }
        });
        return () => unsubscribe();
    }, [users, auth]);

    useEffect(() => {
        if (allWorkshops.length > 0 && !selectedEntityId) {
            setSelectedEntityId(allWorkshops[0].id);
        }
    }, [allWorkshops, selectedEntityId]);

    const filteredBusinessEntities = useMemo(() => {
        if (!selectedEntityId || selectedEntityId === '' || selectedEntityId === 'all') return allWorkshops;
        return allWorkshops.filter(e => e.id === selectedEntityId);
    }, [allWorkshops, selectedEntityId]);

    const refreshData = async () => {
        const getPath = (s: string) => `${COLLECTION_NAME}_${s}`;
        
        try {
            const [dbJobs, dbUsers, dbRoles, dbEntities, dbCustomers, dbVehicles] = await Promise.all([
                getAll<T.Job>(getPath('jobs')),
                getAll<T.User>(getPath('users')),
                getAll<T.Role>(getPath('roles')),
                getAll<T.BusinessEntity>(getPath('business_entities')),
                getAll<T.Customer>(getPath('customers')),
                getAll<T.Vehicle>(getPath('vehicles'))
            ]);

            if (dbJobs.length > 0) setJobs(dbJobs);
            if (dbUsers.length > 0) setUsers(dbUsers);
            if (dbRoles.length > 0) setRoles(dbRoles);
            if (dbEntities.length > 0) setBusinessEntities(dbEntities);
            if (dbCustomers.length > 0) setCustomers(dbCustomers);
            if (dbVehicles.length > 0) setVehicles(dbVehicles);
        } catch (e) {
            console.error("Sync Error:", e);
        }
    };

    useEffect(() => {
        if (hasInitialized.current) return;
        refreshData();
        hasInitialized.current = true;
    }, []);

    const login = async (email: string, pin: string): Promise<boolean> => {
        try {
            // AUTH FIX: Sign in through Firebase service
            const userCredential = await signInWithEmailAndPassword(auth, email, pin);
            const fbUser = userCredential.user;

            const userProfile = users.find(u => u.email === fbUser.email);
            
            if (userProfile) {
                setCurrentUser(userProfile);
                setIsAuthenticated(true);
                if (userProfile.defaultEntityId) {
                    setSelectedEntityId(userProfile.defaultEntityId);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error("Login failed:", error);
            return false;
        }
    };

    const logout = async () => {
        await signOut(auth);
        setCurrentUser(null);
        setIsAuthenticated(false);
        setSelectedEntityId('');
    };
    
    return (
        <AppContext.Provider value={{
            currentUser, users, roles, jobs, customers, vehicles,
            isAuthenticated, currentView, setCurrentView,
            login, logout, selectedEntityId, setSelectedEntityId, confirmation, 
            setConfirmation, backupSchedule, setBackupSchedule, appEnvironment,
            filteredBusinessEntities, allWorkshops, refreshData
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) throw new Error('useApp must be used within an AppProvider');
    return context;
};