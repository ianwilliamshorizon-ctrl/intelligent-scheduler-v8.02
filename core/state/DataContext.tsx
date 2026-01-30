import React, { createContext, useContext, useState, useEffect } from 'react';
import { subscribeToCollection } from '../../core/db/index';

// --- Interface Definitions ---
// This section resolves the "Property does not exist on type DataContextType" errors.
export interface DataContextType {
  customers: any[];
  vehicles: any[];
  jobs: any[];
  lifts: any[];
  engineers: any[];
  users: any[];
  businessEntities: any[];
  taxRates: any[];
  suppliers: any[];
  parts: any[];
  servicePackages: any[];
  nominalCodes: any[];
  nominalCodeRules: any[];
  purchaseOrders: any[];
  saleVehicles: any[];
  storageBookings: any[];
  rentalVehicles: any[];
  batteryChargers: any[];
  invoices: any[];
  estimates: any[];
  roles: any[];
  inspectionDiagrams: any[]; // Resolved the specific error in ManagementVehiclesTab
  loading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Main Provider Component
export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [lifts, setLifts] = useState<any[]>([]);
  const [engineers, setEngineers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [businessEntities, setBusinessEntities] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [servicePackages, setServicePackages] = useState<any[]>([]);
  const [nominalCodes, setNominalCodes] = useState<any[]>([]);
  const [nominalCodeRules, setNominalCodeRules] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [saleVehicles, setSaleVehicles] = useState<any[]>([]);
  const [storageBookings, setStorageBookings] = useState<any[]>([]);
  const [rentalVehicles, setRentalVehicles] = useState<any[]>([]);
  const [batteryChargers, setBatteryChargers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [inspectionDiagrams, setInspectionDiagrams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🛠️ DataContext: Initializing Real-time Subscriptions...");

    // Subscribing to all collections defined in core/db/index
    const unsubscribers = [
      subscribeToCollection('brooks_customers', setCustomers),
      subscribeToCollection('brooks_vehicles', setVehicles),
      subscribeToCollection('brooks_jobs', setJobs),
      subscribeToCollection('brooks_lifts', setLifts),
      subscribeToCollection('brooks_engineers', setEngineers),
      subscribeToCollection('brooks_users', setUsers),
      subscribeToCollection('brooks_businessEntities', setBusinessEntities),
      subscribeToCollection('brooks_taxRates', setTaxRates),
      subscribeToCollection('brooks_suppliers', setSuppliers),
      subscribeToCollection('brooks_parts', setParts),
      subscribeToCollection('brooks_servicePackages', setServicePackages),
      subscribeToCollection('brooks_nominalCodes', setNominalCodes),
      subscribeToCollection('brooks_nominalCodeRules', setNominalCodeRules),
      subscribeToCollection('brooks_purchaseOrders', setPurchaseOrders),
      subscribeToCollection('brooks_saleVehicles', setSaleVehicles),
      subscribeToCollection('brooks_storageBookings', setStorageBookings),
      subscribeToCollection('brooks_rentalVehicles', setRentalVehicles),
      subscribeToCollection('brooks_batteryChargers', setBatteryChargers),
      subscribeToCollection('brooks_invoices', setInvoices),
      subscribeToCollection('brooks_estimates', setEstimates),
      subscribeToCollection('brooks_roles', setRoles),
      subscribeToCollection('brooks_inspectionDiagrams', setInspectionDiagrams),
    ];

    setLoading(false);

    // Clean up subscriptions on unmount
    return () => {
      console.log("🧹 DataContext: Cleaning up subscriptions.");
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  const value = {
    customers,
    vehicles,
    jobs,
    lifts,
    engineers,
    users,
    businessEntities,
    taxRates,
    suppliers,
    parts,
    servicePackages,
    nominalCodes,
    nominalCodeRules,
    purchaseOrders,
    saleVehicles,
    storageBookings,
    rentalVehicles,
    batteryChargers,
    invoices,
    estimates,
    roles,
    inspectionDiagrams,
    loading
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

// --- Exports ---

// Adding this named export to satisfy the SyntaxError in modules requesting DataContextProvider
export const DataContextProvider = DataProvider;

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};