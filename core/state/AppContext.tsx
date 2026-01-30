import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { authService } from '../services/authService';

/**
 * Define the shape of our Global State
 */
interface AppContextType {
  user: User | null;
  currentUser: any;
  loading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  users: any[];
  currentView: string;
  setCurrentView: (view: string) => void;
  selectedEntityId: string;
  setSelectedEntityId: (id: string) => void;
  filteredBusinessEntities: any[];
  // Dynamic Seed Data for Dispatch/Workflow
  jobs: any[];
  vehicles: any[];
  technicians: any[];
  appEnvironment: string;
  backupSchedule: any;
  setBackupSchedule: (schedule: any) => void;
  confirmation: any;
  setConfirmation: (conf: any) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- MOCK SEED DATA ---
const MOCK_USERS = [
  { 
    id: 'admin-1', 
    name: 'Admin User', 
    email: 'admin@brookspeed.com', 
    role: 'Administrator', 
    password: '123',
    allowedViews: ['dashboard', 'dispatch', 'workflow', 'jobs', 'estimates', 'invoices', 'purchaseOrders', 'sales', 'storage', 'rentals', 'communications', 'inquiries', 'absence']
  }
];

const MOCK_ENTITIES = [
  { id: 'brookspeed-main', name: 'Brookspeed Main' },
  { id: 'brookspeed-storage', name: 'Brookspeed Storage' }
];

const MOCK_TECHNICIANS = [
  { id: 'tech-1', name: 'Dave Smith', specialty: 'Engine', status: 'available' },
  { id: 'tech-2', name: 'Sarah Jones', specialty: 'Diagnostics', status: 'busy' }
];

const MOCK_JOBS = [
  { 
    id: 'job-101', 
    customerName: 'John Doe', 
    vehicleId: 'veh-1', 
    status: 'In Progress', 
    description: 'Annual Service & Brake Check',
    techId: 'tech-1',
    priority: 'high',
    startTime: new Date().toISOString()
  },
  { 
    id: 'job-102', 
    customerName: 'Jane Wilson', 
    vehicleId: 'veh-2', 
    status: 'Pending', 
    description: 'Suspension Noise Investigation',
    techId: 'tech-2',
    priority: 'medium'
  }
];

const MOCK_VEHICLES = [
  { id: 'veh-1', make: 'Porsche', model: '911 GT3', plate: 'BS66 PWR' },
  { id: 'veh-2', make: 'Ferrari', model: '488 Pista', plate: 'F1 FAST' }
];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedEntityId, setSelectedEntityId] = useState('brookspeed-main');
  const [appEnvironment] = useState('Development (Bypass)');
  
  const [jobs] = useState(MOCK_JOBS);
  const [vehicles] = useState(MOCK_VEHICLES);
  const [technicians] = useState(MOCK_TECHNICIANS);

  const [backupSchedule, setBackupSchedule] = useState({ enabled: true, times: ['12:00', '18:00'] });
  const [confirmation, setConfirmation] = useState({ isOpen: false, title: '', message: '', type: 'success' });

  const login = async (email: string, pass: string) => {
    const mockMatch = MOCK_USERS.find(u => u.email === email || u.id === email);
    if (mockMatch && pass === '123') {
      setCurrentUser(mockMatch);
      setUser({ uid: mockMatch.id, email: mockMatch.email } as User);
      return;
    }
  };

  const logout = async () => {
    setUser(null);
    setCurrentUser(null);
  };

  const value = {
    user,
    currentUser,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
    users: MOCK_USERS,
    currentView,
    setCurrentView,
    selectedEntityId,
    setSelectedEntityId,
    filteredBusinessEntities: MOCK_ENTITIES,
    jobs,
    vehicles,
    technicians,
    appEnvironment,
    backupSchedule,
    setBackupSchedule,
    confirmation,
    setConfirmation
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Explicitly export as AppContextProvider to fix the SyntaxError
export const AppContextProvider = AppProvider;

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;