import React, { createContext, useContext, useMemo, useCallback, useRef } from 'react';
import { saveDocument } from '../db';
import * as T from '../../types';
import { usePersistentState, UsePersistentStateTuple } from './usePersistentState';
import {
    getInitialJobs, getInitialVehicles, getInitialCustomers, getInitialEngineers,
    getInitialEstimates, getInitialInvoices, getInitialPurchaseOrders,
    getInitialSuppliers, getInitialParts, getInitialServicePackages, getInitialTaxRates,
    getInitialBusinessEntities, getInitialLifts, getInitialSaleVehicles,
    getInitialSaleOverheadPackages, getInitialStorageBookings, getInitialRentalVehicles,
    getInitialRentalBookings, getInitialStorageLocations, getInitialBatteryChargers,
    getInitialNominalCodes, getInitialNominalCodeRules, getInitialPurchases,
    getInitialAbsenceRequests, getInitialProspects, getInitialInquiries,
    getInitialReminders, getInitialAuditLog, getInitialRoles, getInitialInspectionDiagrams,
    getInitialInspectionTemplates, getInitialDiscountCodes
} from '../data/initialData';

// Defines the shape of the context, including all data collections and setters.
interface DataContextType {
    jobs: T.Job[]; setJobs: React.Dispatch<React.SetStateAction<T.Job[]>>;
    vehicles: T.Vehicle[]; setVehicles: React.Dispatch<React.SetStateAction<T.Vehicle[]>>;
    customers: T.Customer[]; setCustomers: React.Dispatch<React.SetStateAction<T.Customer[]>>;
    estimates: T.Estimate[]; setEstimates: React.Dispatch<React.SetStateAction<T.Estimate[]>>;
    invoices: T.Invoice[]; setInvoices: React.Dispatch<React.SetStateAction<T.Invoice[]>>;
    purchaseOrders: T.PurchaseOrder[]; setPurchaseOrders: React.Dispatch<React.SetStateAction<T.PurchaseOrder[]>>;
    purchases: T.Purchase[]; setPurchases: React.Dispatch<React.SetStateAction<T.Purchase[]>>;
    parts: T.Part[]; setParts: React.Dispatch<React.SetStateAction<T.Part[]>>;
    servicePackages: T.ServicePackage[]; setServicePackages: React.Dispatch<React.SetStateAction<T.ServicePackage[]>>;
    suppliers: T.Supplier[]; setSuppliers: React.Dispatch<React.SetStateAction<T.Supplier[]>>;
    engineers: T.Engineer[]; setEngineers: React.Dispatch<React.SetStateAction<T.Engineer[]>>;
    lifts: T.Lift[]; setLifts: React.Dispatch<React.SetStateAction<T.Lift[]>>;
    rentalVehicles: T.RentalVehicle[]; setRentalVehicles: React.Dispatch<React.SetStateAction<T.RentalVehicle[]>>;
    rentalBookings: T.RentalBooking[]; setRentalBookings: React.Dispatch<React.SetStateAction<T.RentalBooking[]>>;
    saleVehicles: T.SaleVehicle[]; setSaleVehicles: React.Dispatch<React.SetStateAction<T.SaleVehicle[]>>;
    saleOverheadPackages: T.SaleOverheadPackage[]; setSaleOverheadPackages: React.Dispatch<React.SetStateAction<T.SaleOverheadPackage[]>>;
    prospects: T.Prospect[]; setProspects: React.Dispatch<React.SetStateAction<T.Prospect[]>>;
    storageBookings: T.StorageBooking[]; setStorageBookings: React.Dispatch<React.SetStateAction<T.StorageBooking[]>>;
    storageLocations: T.StorageLocation[]; setStorageLocations: React.Dispatch<React.SetStateAction<T.StorageLocation[]>>;
    batteryChargers: T.BatteryCharger[]; setBatteryChargers: React.Dispatch<React.SetStateAction<T.BatteryCharger[]>>;
    nominalCodes: T.NominalCode[]; setNominalCodes: React.Dispatch<React.SetStateAction<T.NominalCode[]>>;
    nominalCodeRules: T.NominalCodeRule[]; setNominalCodeRules: React.Dispatch<React.SetStateAction<T.NominalCodeRule[]>>;
    absenceRequests: T.AbsenceRequest[]; setAbsenceRequests: React.Dispatch<React.SetStateAction<T.AbsenceRequest[]>>;
    inquiries: T.Inquiry[]; setInquiries: React.Dispatch<React.SetStateAction<T.Inquiry[]>>;
    reminders: T.Reminder[]; setReminders: React.Dispatch<React.SetStateAction<T.Reminder[]>>;
    auditLog: T.AuditLogEntry[]; setAuditLog: React.Dispatch<React.SetStateAction<T.AuditLogEntry[]>>;
    businessEntities: T.BusinessEntity[]; setBusinessEntities: React.Dispatch<React.SetStateAction<T.BusinessEntity[]>>;
    taxRates: T.TaxRate[]; setTaxRates: React.Dispatch<React.SetStateAction<T.TaxRate[]>>;
    roles: T.Role[]; setRoles: React.Dispatch<React.SetStateAction<T.Role[]>>;
    inspectionDiagrams: T.InspectionDiagram[]; setInspectionDiagrams: React.Dispatch<React.SetStateAction<T.InspectionDiagram[]>>;
    inspectionTemplates: T.InspectionTemplate[]; setInspectionTemplates: React.Dispatch<React.SetStateAction<T.InspectionTemplate[]>>;
    discountCodes: T.DiscountCode[]; setDiscountCodes: React.Dispatch<React.SetStateAction<T.DiscountCode[]>>;
    forceRefresh: (collectionKey: keyof any) => Promise<void>;
    isDataLoaded: boolean; // Flag to indicate if all data has been loaded.
    saveRecord: <T extends { id: string }>(collectionKey: string, record: T) => Promise<T>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    const stateHooks = {
        brooks_jobs: usePersistentState<T.Job[]>('brooks_jobs', getInitialJobs),
        brooks_vehicles: usePersistentState<T.Vehicle[]>('brooks_vehicles', getInitialVehicles),
        brooks_customers: usePersistentState<T.Customer[]>('brooks_customers', getInitialCustomers),
        brooks_estimates: usePersistentState<T.Estimate[]>('brooks_estimates', getInitialEstimates),
        brooks_invoices: usePersistentState<T.Invoice[]>('brooks_invoices', getInitialInvoices),
        brooks_purchaseOrders: usePersistentState<T.PurchaseOrder[]>('brooks_purchaseOrders', getInitialPurchaseOrders),
        brooks_purchases: usePersistentState<T.Purchase[]>('brooks_purchases', getInitialPurchases),
        brooks_parts: usePersistentState<T.Part[]>('brooks_parts', getInitialParts),
        brooks_servicePackages: usePersistentState<T.ServicePackage[]>('brooks_servicePackages', getInitialServicePackages),
        brooks_suppliers: usePersistentState<T.Supplier[]>('brooks_suppliers', getInitialSuppliers),
        brooks_engineers: usePersistentState<T.Engineer[]>('brooks_engineers', getInitialEngineers),
        brooks_lifts: usePersistentState<T.Lift[]>('brooks_lifts', getInitialLifts),
        brooks_rentalVehicles: usePersistentState<T.RentalVehicle[]>('brooks_rentalVehicles', getInitialRentalVehicles),
        brooks_rentalBookings: usePersistentState<T.RentalBooking[]>('brooks_rentalBookings', getInitialRentalBookings),
        brooks_saleVehicles: usePersistentState<T.SaleVehicle[]>('brooks_saleVehicles', getInitialSaleVehicles),
        brooks_saleOverheadPackages: usePersistentState<T.SaleOverheadPackage[]>('brooks_saleOverheadPackages', getInitialSaleOverheadPackages),
        brooks_prospects: usePersistentState<T.Prospect[]>('brooks_prospects', getInitialProspects),
        brooks_storageBookings: usePersistentState<T.StorageBooking[]>('brooks_storageBookings', getInitialStorageBookings),
        brooks_storageLocations: usePersistentState<T.StorageLocation[]>('brooks_storageLocations', getInitialStorageLocations),
        brooks_batteryChargers: usePersistentState<T.BatteryCharger[]>('brooks_batteryChargers', getInitialBatteryChargers),
        brooks_nominalCodes: usePersistentState<T.NominalCode[]>('brooks_nominalCodes', getInitialNominalCodes),
        brooks_nominalCodeRules: usePersistentState<T.NominalCodeRule[]>('brooks_nominalCodeRules', getInitialNominalCodeRules),
        brooks_absenceRequests: usePersistentState<T.AbsenceRequest[]>('brooks_absenceRequests', getInitialAbsenceRequests),
        brooks_inquiries: usePersistentState<T.Inquiry[]>('brooks_inquiries', getInitialInquiries),
        brooks_reminders: usePersistentState<T.Reminder[]>('brooks_reminders', getInitialReminders),
        brooks_auditLog: usePersistentState<T.AuditLogEntry[]>('brooks_auditLog', getInitialAuditLog),
        brooks_businessEntities: usePersistentState<T.BusinessEntity[]>('brooks_businessEntities', getInitialBusinessEntities),
        brooks_taxRates: usePersistentState<T.TaxRate[]>('brooks_taxRates', getInitialTaxRates),
        brooks_roles: usePersistentState<T.Role[]>('brooks_roles', getInitialRoles),
        brooks_inspectionDiagrams: usePersistentState<T.InspectionDiagram[]>('brooks_inspectionDiagrams', getInitialInspectionDiagrams),
        brooks_inspectionTemplates: usePersistentState<T.InspectionTemplate[]>('brooks_inspectionTemplates', getInitialInspectionTemplates),
        brooks_discountCodes: usePersistentState<T.DiscountCode[]>('brooks_discountCodes', getInitialDiscountCodes),
    };
    
    const stateHooksRef = useRef(stateHooks);
    stateHooksRef.current = stateHooks;

    const forceRefresh = useCallback(async (collectionKey: keyof typeof stateHooks) => {
        const hook = stateHooksRef.current[collectionKey] as UsePersistentStateTuple<any[]> | undefined;
        if (hook && typeof hook[2] === 'function') {
            await hook[2]();
        }
    }, []);

    const saveRecord = useCallback(async <T extends { id: string }>(collectionKey: string, record: T): Promise<T> => {
        const hookKey = `brooks_${collectionKey}` as keyof typeof stateHooks;
        const hook = stateHooksRef.current[hookKey];

        if (!hook) {
            throw new Error(`Invalid collection key for saveRecord: ${collectionKey}`);
        }

        const [, setState] = hook as unknown as UsePersistentStateTuple<T[]>;

        // 1. Update local state
        setState(currentItems => {
            const existingIndex = currentItems.findIndex(item => item.id === record.id);
            if (existingIndex > -1) {
                const newItems = [...currentItems];
                newItems[existingIndex] = record;
                return newItems;
            } else {
                return [...currentItems, record];
            }
        });

        // 2. Persist to Firestore
        try {
            const col = collectionKey.startsWith('brooks_') ? collectionKey : `brooks_${collectionKey}`;
            await saveDocument(col, record);
        } catch (error) {
            console.error(`[saveRecord Error] Failed to persist to ${collectionKey}:`, error);
            throw error;
        }
        
        return record;
    }, []);

    const loadingFlags = Object.values(stateHooks).map(([, , , isLoading]) => isLoading);
    const isDataLoaded = useMemo(() => {
        return loadingFlags.every(flag => !flag);
    }, [loadingFlags]);

    const states = Object.values(stateHooks).map(([state]) => state);
    const value = useMemo(() => {
        const contextValue: Partial<DataContextType> = { forceRefresh, isDataLoaded, saveRecord };
        for (const key in stateHooks) {
            const [state, setState] = stateHooks[key as keyof typeof stateHooks];
            const plainKey = key.replace('brooks_','') as keyof Omit<DataContextType, 'forceRefresh' | 'isDataLoaded' | 'saveRecord'>;
            contextValue[plainKey] = state as any;
            (contextValue as any)[`set${plainKey.charAt(0).toUpperCase() + plainKey.slice(1)}`] = setState;
        }
        return contextValue as DataContextType;
    }, [forceRefresh, isDataLoaded, saveRecord, ...states]);

    return (
        <DataContext.Provider value={value}>
            {isDataLoaded ? children : <div>Loading...</div>}
        </DataContext.Provider>
    );
};

export const DataContextProvider = DataProvider;

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataContextProvider');
    }
    return context;
};

export default DataProvider;
