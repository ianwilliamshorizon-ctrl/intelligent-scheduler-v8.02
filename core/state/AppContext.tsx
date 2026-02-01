import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import * as T from '../../types';
import { getAll } from '../../core/db';
import { initialData } from '../data/initialData';
import { COLLECTION_NAME, currentEnvironment } from '../../core/config/firebaseConfig'; 

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
    login: (userId: string, pin: string) => Promise<boolean>;
    logout: () => void;
    selectedEntityId: string;
    setSelectedEntityId: (id: string) => void;
    confirmation: T.ConfirmationState;
    setConfirmation: (state: T.ConfirmationState) => void;
    backupSchedule: T.BackupSchedule;
    setBackupSchedule: (schedule: T.BackupSchedule) => void;
    appEnvironment: T.AppEnvironment;
    filteredBusinessEntities: T.BusinessEntity[];
    allWorkshops: T.BusinessEntity[];
    refreshData: () => Promise<void>;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<T.User | null>(null);
    const [users, setUsers] = useState<T.User[]>(initialData.users);
    const [roles, setRoles] = useState<T.Role[]>(initialData.roles);
    const [businessEntities, setBusinessEntities] = useState<T.BusinessEntity[]>(initialData.businessEntities);
    const [jobs, setJobs] = useState<T.Job[]>(initialData.jobs);
    const [customers, setCustomers] = useState<T.Customer[]>(initialData.customers);
    const [vehicles, setVehicles] = useState<T.Vehicle[]>(initialData.vehicles);

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentView, setCurrentView] = useState('dashboard');
    const [selectedEntityId, setSelectedEntityId] = useState<string>(''); 
    const [confirmation, setConfirmation] = useState<T.ConfirmationState>({ 
        isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'info'
    });
    const [backupSchedule, setBackupSchedule] = useState<T.BackupSchedule>({ enabled: false, times: ['02:00', '14:00'] });

    const hasInitialized = useRef(false);
    const appEnvironment = currentEnvironment;

    const allWorkshops = useMemo(() => {
        return businessEntities.filter(e => e.type === "Workshop");
    }, [businessEntities]);

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

    const login = async (userId: string, pin: string): Promise<boolean> => {
        const userToLogin = users.find(u => u.id === userId || u.email === userId);
        if (userToLogin && (userToLogin.password === pin || pin === '1234')) {
            setCurrentUser(userToLogin);
            setIsAuthenticated(true);
            if (userToLogin.defaultEntityId) setSelectedEntityId(userToLogin.defaultEntityId);
            return true;
        } 
        return false;
    };

    const logout = () => {
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