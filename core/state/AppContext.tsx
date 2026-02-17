import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import * as T from '../../types';
import { getAll, saveDocument } from '../../core/db';
import { initialData } from '../data/initialData';
import { COLLECTION_NAME, currentEnvironment } from '../../core/config/firebaseConfig'; 
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    sendPasswordResetEmail,
    createUserWithEmailAndPassword
} from 'firebase/auth';

interface AppState {
    currentUser: T.User | null;
    users: T.User[];
    setUsers: React.Dispatch<React.SetStateAction<T.User[]>>;
    roles: T.Role[];
    jobs: T.Job[];
    customers: T.Customer[];
    vehicles: T.Vehicle[];
    isAuthenticated: boolean;
    currentView: string;
    setCurrentView: (view: string) => void;
    login: (email: string, pin: string) => Promise<boolean>;
    logout: () => void;
    resetPassword: (email: string) => Promise<void>;
    adminResetPassword: (email: string) => Promise<void>;
    registerAuthorizedUser: (email: string, pass: string) => Promise<void>;
    selectedEntityId: string;
    setSelectedEntityId: (id: string) => void;
    confirmation: any;
    setConfirmation: (state: any) => void;
    backupSchedule: T.BackupSchedule;
    setBackupSchedule: (schedule: T.BackupSchedule) => void;
    appEnvironment: T.AppEnvironment;
    filteredBusinessEntities: T.BusinessEntity[];
    allWorkshops: T.BusinessEntity[];
    refreshData: () => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
    const auth = getAuth();
    
    // Core Status States
    const [isAppReady, setIsAppReady] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentView, setCurrentView] = useState('dashboard');
    
    // Data States
    const [currentUser, setCurrentUser] = useState<T.User | null>(null);
    const [users, setUsers] = useState<T.User[]>([]); 
    const [roles, setRoles] = useState<T.Role[]>(initialData.roles || []);
    const [businessEntities, setBusinessEntities] = useState<T.BusinessEntity[]>(initialData.businessEntities || []);
    const [jobs, setJobs] = useState<T.Job[]>(initialData.jobs || []);
    const [customers, setCustomers] = useState<T.Customer[]>(initialData.customers || []);
    const [vehicles, setVehicles] = useState<T.Vehicle[]>(initialData.vehicles || []);

    const [selectedEntityId, setSelectedEntityId] = useState<string>(''); 
    const [confirmation, setConfirmation] = useState({ isOpen: false, title: '', message: '', type: 'info' });
    const [backupSchedule, setBackupSchedule] = useState<T.BackupSchedule>({ enabled: false, times: ['02:00', '14:00'] });

    const syncStarted = useRef(false);

    const allWorkshops = useMemo(() => businessEntities.filter(e => e.type === "Workshop"), [businessEntities]);
    const filteredBusinessEntities = useMemo(() => {
        if (!selectedEntityId || selectedEntityId === '' || selectedEntityId === 'all') return allWorkshops;
        return allWorkshops.filter(e => e.id === selectedEntityId);
    }, [allWorkshops, selectedEntityId]);

    /**
     * SYNC DATA FROM FIRESTORE
     */
    const refreshData = async () => {
        if (syncStarted.current && users.length > 0) return;
        syncStarted.current = true;

        const getPath = (s: string) => `${COLLECTION_NAME}_${s}`;
        
        try {
            console.log("📡 AppContext: Syncing production data...");
            const [dbJobs, dbUsers, dbRoles, dbEntities, dbCustomers, dbVehicles] = await Promise.all([
                getAll<T.Job>(getPath('jobs')),
                getAll<T.User>(getPath('users')),
                getAll<T.Role>(getPath('roles')),
                getAll<T.BusinessEntity>(getPath('business_entities')),
                getAll<T.Customer>(getPath('customers')),
                getAll<T.Vehicle>(getPath('vehicles'))
            ]);

            if (dbUsers?.length) setUsers(dbUsers);
            if (dbRoles?.length) setRoles(dbRoles);
            if (dbEntities?.length) setBusinessEntities(dbEntities);
            if (dbCustomers?.length) setCustomers(dbCustomers);
            if (dbVehicles?.length) setVehicles(dbVehicles);
            if (dbJobs?.length) setJobs(dbJobs);
            
            console.log("✅ AppContext: Sync Complete.");
        } catch (e) {
            console.error("❌ AppContext: Sync Failed.", e);
        } finally {
            setIsAppReady(true);
        }
    };

    /**
     * AUTHENTICATION MONITOR
     */
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
            if (fbUser) {
                const profile = users.find(u => u.email?.toLowerCase() === fbUser.email?.toLowerCase());
                if (profile) {
                    setCurrentUser(profile);
                    setIsAuthenticated(true);
                } else {
                    setIsAuthenticated(false);
                }
            } else {
                setIsAuthenticated(false);
                setCurrentUser(null);
            }
            setIsAppReady(true);
        });
        return () => unsubscribe();
    }, [users, auth]);

    useEffect(() => {
        refreshData();
    }, []);

    /**
     * LOGIN ACTION
     */
    const login = async (email: string, pin: string): Promise<boolean> => {
        try {
            const result = await signInWithEmailAndPassword(auth, email.trim(), pin);
            await refreshData(); 
            return !!result.user;
        } catch (error: any) {
            console.error("Login Failure:", error.code);
            throw error;
        }
    };

    /**
     * RESET PASSWORD (User-facing)
     */
    const resetPassword = async (email: string): Promise<void> => {
        try {
            await sendPasswordResetEmail(auth, email.trim());
            setConfirmation({
                isOpen: true,
                title: 'Reset Link Sent',
                message: `Check your inbox at ${email} for instructions to reset your password.`,
                type: 'success'
            });
        } catch (error: any) {
            let msg = "Could not send reset email.";
            if (error.code === 'auth/user-not-found') msg = "No account found with that email.";
            setConfirmation({ isOpen: true, title: 'Reset Failed', message: msg, type: 'error' });
            throw error;
        }
    };

    /**
     * ADMIN PASSWORD RESET (For Management Console)
     */
    const adminResetPassword = async (email: string): Promise<void> => {
        try {
            await sendPasswordResetEmail(auth, email.trim());
            setConfirmation({
                isOpen: true,
                title: 'Admin Reset Initiated',
                message: `A password reset link has been successfully sent to ${email}.`,
                type: 'success'
            });
        } catch (error: any) {
            console.error("Admin Reset Error:", error);
            setConfirmation({
                isOpen: true,
                title: 'Reset Failed',
                message: "This user may not have a registered identity yet.",
                type: 'error'
            });
        }
    };

    /**
     * REGISTER AUTHORIZED USER (The "Bridge" for new staff)
     */
    const registerAuthorizedUser = async (email: string, pass: string): Promise<void> => {
        // 1. Check if the admin has added them to the Staff list first
        const isAuthorized = users.some(u => u.email?.toLowerCase() === email.toLowerCase());
        
        if (!isAuthorized) {
            throw new Error("NOT_AUTHORIZED_BY_ADMIN");
        }

        try {
            await createUserWithEmailAndPassword(auth, email, pass);
            setConfirmation({
                isOpen: true,
                title: 'Account Activated',
                message: 'Your system access has been established successfully.',
                type: 'success'
            });
        } catch (error: any) {
            console.error("Registration Error:", error);
            throw error;
        }
    };

    /**
     * LOGOUT ACTION
     */
    const logout = async () => {
        await signOut(auth);
        setCurrentUser(null);
        setIsAuthenticated(false);
        setCurrentView('dashboard');
    };
    
    return (
        <AppContext.Provider value={{
            currentUser, users, setUsers, roles, jobs, customers, vehicles,
            isAuthenticated, currentView, setCurrentView,
            login, logout, resetPassword, adminResetPassword, registerAuthorizedUser,
            selectedEntityId, setSelectedEntityId, confirmation, 
            setConfirmation, backupSchedule, setBackupSchedule, appEnvironment: currentEnvironment,
            filteredBusinessEntities, allWorkshops, refreshData
        }}>
            {!isAppReady ? (
                <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', flexDirection: 'column' }}>
                    <div style={{ fontWeight: 'bold', letterSpacing: '2px' }}>BROOKSPEED</div>
                    <div style={{ color: '#444', fontSize: '0.75rem', marginTop: '10px' }}>Verifying Identity...</div>
                </div>
            ) : children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) throw new Error('useApp must be used within an AppProvider');
    return context;
};