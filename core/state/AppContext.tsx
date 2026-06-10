import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import * as T from '../../types';
import { getAll, saveDocument, getItem, setItem } from '../../core/db';
import { initialData } from '../data/initialData';
import { COLLECTION_NAME, currentEnvironment } from '../../core/config/firebaseConfig'; 
import { SPEECH_SETTINGS_KEY } from '../../core/utils/speechUtils';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    sendPasswordResetEmail,
    createUserWithEmailAndPassword,
    setPersistence,           // Added for session control
    browserSessionPersistence // Added for session control
} from 'firebase/auth';
import { toast } from 'react-toastify';

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
    setAppEnvironment: (env: T.AppEnvironment) => void;
    businessEntities: T.BusinessEntity[];
    filteredBusinessEntities: T.BusinessEntity[];
    allWorkshops: T.BusinessEntity[];
    refreshData: () => Promise<void>;
    isSidebarOpen: boolean;
    setSidebarOpen: (isOpen: boolean) => void;
    onSwitchEntity: () => void;
    onLogout: () => void;
    preferredVoiceName: string | null;
    setPreferredVoiceName: (name: string | null) => void;
}

export const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
    const auth = getAuth();
    
    // Core Status States
    const [isAppReady, setIsAppReady] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentView, setCurrentView] = useState('dashboard');
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [appEnvironment, setAppEnvironment] = useState<T.AppEnvironment>(currentEnvironment.toLowerCase() as T.AppEnvironment);
    
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
    const [preferredVoiceName, setPreferredVoiceNameState] = useState<string | null>(localStorage.getItem(SPEECH_SETTINGS_KEY));
    
    const syncStarted = useRef(false);
    
    const allWorkshops = useMemo(() => businessEntities.filter(e => e.type === "Workshop"), [businessEntities]);
    const filteredBusinessEntities = useMemo(() => {
        if (!selectedEntityId || selectedEntityId === '' || selectedEntityId === 'all') return allWorkshops;
        return allWorkshops.filter(e => e.id === selectedEntityId);
    }, [allWorkshops, selectedEntityId]);
    
    /**
     * ENFORCE SESSION PERSISTENCE
     * This forces Firebase to clear the login when the tab/browser is closed.
     */
    useEffect(() => {
        setPersistence(auth, browserSessionPersistence)
            .catch((err) => console.error("Auth Persistence Error:", err));
    }, [auth]);
    
    /**
     * SYNC DATA FROM FIRESTORE
     */
    const refreshData = async () => {
        if (syncStarted.current && users.length > 0) return;
        
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
            if (dbEntities?.length) {
                setBusinessEntities(dbEntities);
                const storedEntityId = localStorage.getItem('selectedEntityId');
                if (storedEntityId && dbEntities.some(e => e.id === storedEntityId)) {
                    setSelectedEntityId(storedEntityId);
                } else if (dbEntities.length > 0) {
                    setSelectedEntityId(dbEntities[0].id);
                }
            }
            if (dbCustomers?.length) setCustomers(dbCustomers);
            if (dbVehicles?.length) setVehicles(dbVehicles);
            if (dbJobs?.length) setJobs(dbJobs);
            
            // Sync Backup Schedule
            try {
                const schedule = await getItem<T.BackupSchedule>('backup_schedule');
                if (schedule) {
                    console.log("💾 AppContext: Backup schedule loaded:", schedule);
                    setBackupSchedule({ 
                        enabled: schedule.enabled ?? false, 
                        times: schedule.times || [],
                        lastRun: schedule.lastRun,
                        lastSuccess: schedule.lastSuccess
                    });
                }
            } catch (err) {
                console.warn("⚠️ AppContext: Could not load backup schedule (permissions?)", err);
            }

            console.log("✅ AppContext: Sync Complete.");
            syncStarted.current = true; // Set to true ONLY on success
        } catch (e) {
            console.error("❌ AppContext: Sync Failed.", e);
            syncStarted.current = false; // Allow retry
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
                // When authenticated, ensure we sync data
                refreshData(); 
                
                const profile = users.find(u => u.email?.toLowerCase() === fbUser.email?.toLowerCase());
                if (profile) {
                    setCurrentUser(profile);
                    setIsAuthenticated(true);
                    if (profile.preferredEntityId && businessEntities.some(e => e.id === profile.preferredEntityId)) {
                        setSelectedEntityId(profile.preferredEntityId);
                        localStorage.setItem('selectedEntityId', profile.preferredEntityId);
                    }
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
    }, [users, auth, businessEntities]);
    
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
            toast.success(`Check your inbox at ${email} for instructions to reset your password.`);
        } catch (error: any) {
            let msg = "Could not send reset email.";
            if (error.code === 'auth/user-not-found') msg = "No account found with that email.";
            toast.error(msg);
            throw error;
        }
    };
    
    /**
     * ADMIN PASSWORD RESET (For Management Console)
     */
    const adminResetPassword = async (email: string): Promise<void> => {
        try {
            await sendPasswordResetEmail(auth, email.trim());
        } catch (error: any) {
            console.error("Admin Reset Error:", error);
            throw error;
        }
    };
    
    /**
     * REGISTER AUTHORIZED USER (The "Bridge" for new staff)
     */
    const registerAuthorizedUser = async (email: string, pass: string): Promise<void> => {
        const isAuthorized = users.some(u => u.email?.toLowerCase() === email.toLowerCase());
        
        if (!isAuthorized) {
            throw new Error("NOT_AUTHORIZED_BY_ADMIN");
        }
        
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
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
        localStorage.removeItem('selectedEntityId');
    };

    const handleSetSelectedEntityId = (id: string) => {
        setSelectedEntityId(id);
        localStorage.setItem('selectedEntityId', id);
    };

    const handleSetBackupSchedule = async (schedule: T.BackupSchedule) => {
        setBackupSchedule(schedule);
        try {
            const payload = {
                ...schedule,
                updatedAt: new Date().toISOString()
            };
            await setItem('backup_schedule', payload);
            console.log("✅ AppContext: Backup schedule saved successfully.");
        } catch (err) {
            console.error("❌ AppContext: Failed to save backup schedule", err);
        }
    };

    const setPreferredVoiceName = (name: string | null) => {
        setPreferredVoiceNameState(name);
        if (name) {
            localStorage.setItem(SPEECH_SETTINGS_KEY, name);
        } else {
            localStorage.removeItem(SPEECH_SETTINGS_KEY);
        }
    };
    
    const onSwitchEntity = () => {
    
    }
    
    const onLogout = () => {
    
    }
    
    return (
        <AppContext.Provider value={{
            currentUser, users, setUsers, roles, jobs, customers, vehicles,
            isAuthenticated, currentView, setCurrentView,
            login, logout, resetPassword, adminResetPassword, registerAuthorizedUser,
            selectedEntityId, setSelectedEntityId: handleSetSelectedEntityId, confirmation, 
            setConfirmation, backupSchedule, setBackupSchedule: handleSetBackupSchedule, appEnvironment, setAppEnvironment,
            businessEntities, filteredBusinessEntities, allWorkshops, refreshData,
            isSidebarOpen, setSidebarOpen, onSwitchEntity, onLogout,
            preferredVoiceName, setPreferredVoiceName
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
    if (context === undefined) {
        // Return a safe mock state for use outside providers (e.g., during printing)
        return {
            currentUser: null,
            users: [],
            setUsers: () => {},
            roles: [],
            jobs: [],
            customers: [],
            vehicles: [],
            isAuthenticated: false,
            currentView: 'dashboard',
            setCurrentView: () => {},
            login: async () => false,
            logout: () => {},
            resetPassword: async () => {},
            adminResetPassword: async () => {},
            registerAuthorizedUser: async () => {},
            selectedEntityId: '',
            setSelectedEntityId: () => {},
            confirmation: { isOpen: false, title: '', message: '', type: 'info' },
            setConfirmation: () => {},
            backupSchedule: { enabled: false, times: [] },
            setBackupSchedule: () => {},
            appEnvironment: 'production',
            setAppEnvironment: () => {},
            businessEntities: [],
            filteredBusinessEntities: [],
            allWorkshops: [],
            refreshData: async () => {},
            isSidebarOpen: false,
            setSidebarOpen: () => {},
            onSwitchEntity: () => {},
            onLogout: () => {},
            preferredVoiceName: null,
            setPreferredVoiceName: () => {}
        } as AppState;
    }
    return context;
};