import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import * as T from '../../types';
import { usePersistentState } from './usePersistentState';
import {
    getInitialEngineers, getInitialSuppliers, getInitialServicePackages, getInitialTaxRates,
    getInitialBusinessEntities, getInitialLifts, getInitialSaleVehicles,
    getInitialSaleOverheadPackages, getInitialStorageBookings, getInitialRentalVehicles,
    getInitialRentalBookings, getInitialStorageLocations, getInitialBatteryChargers,
    getInitialNominalCodes, getInitialNominalCodeRules, getInitialPurchases,
    getInitialAbsenceRequests, getInitialUsers, getInitialProspects, getInitialInquiries,
    getInitialReminders, getInitialAuditLog, getInitialRoles, getInitialInspectionDiagrams,
    getInitialParts, getInitialJobs, getInitialCustomers, getInitialVehicles,
    getInitialEstimates, getInitialInvoices
} from '../data/initialData';
import { getAll, getById } from '../db/index'; 

interface DataContextType {
    // Workflow Data (Live on Grid)
    jobs: T.Job[]; setJobs: React.Dispatch<React.SetStateAction<T.Job[]>>;
    
    // Large Volume Data (Now handled on-demand to keep UI flying)
    vehicles: T.Vehicle[]; setVehicles: React.Dispatch<React.SetStateAction<T.Vehicle[]>>;
    customers: T.Customer[]; setCustomers: React.Dispatch<React.SetStateAction<T.Customer[]>>;
    parts: T.Part[]; setParts: React.Dispatch<React.SetStateAction<T.Part[]>>;
    
    // Support Data
    estimates: T.Estimate[]; setEstimates: React.Dispatch<React.SetStateAction<T.Estimate[]>>;
    invoices: T.Invoice[]; setInvoices: React.Dispatch<React.SetStateAction<T.Invoice[]>>;
    purchaseOrders: T.PurchaseOrder[]; setPurchaseOrders: React.Dispatch<React.SetStateAction<T.PurchaseOrder[]>>;
    purchases: T.Purchase[]; setPurchases: React.Dispatch<React.SetStateAction<T.Purchase[]>>;
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
    
    isLoading: boolean;
    refreshActiveData: (isBackground?: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const isRefreshingRef = useRef(false);

    // --- DATA STATES ---
    // We keep these in state but we no longer "Bulk Load" them from the DB on start.
    // They will be populated by specific search actions or when a Job is loaded.
    const [customers, setCustomers] = useState<T.Customer[]>([]);
    const [vehicles, setVehicles] = useState<T.Vehicle[]>([]);
    const [parts, setParts] = useState<T.Part[]>([]);

    const [jobs, setJobs] = useState<T.Job[]>([]);
    const [purchases, setPurchases] = useState<T.Purchase[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<T.PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<T.Supplier[]>([]);
    const [engineers, setEngineers] = useState<T.Engineer[]>([]);
    const [lifts, setLifts] = useState<T.Lift[]>([]);
    const [estimates, setEstimates] = useState<T.Estimate[]>([]);
    const [invoices, setInvoices] = useState<T.Invoice[]>([]);
    const [servicePackages, setServicePackages] = useState<T.ServicePackage[]>([]);
    const [rentalVehicles, setRentalVehicles] = useState<T.RentalVehicle[]>([]);
    const [rentalBookings, setRentalBookings] = useState<T.RentalBooking[]>([]);
    const [saleVehicles, setSaleVehicles] = useState<T.SaleVehicle[]>([]);
    const [saleOverheadPackages, setSaleOverheadPackages] = useState<T.SaleOverheadPackage[]>([]);
    const [prospects, setProspects] = useState<T.Prospect[]>([]);
    const [storageBookings, setStorageBookings] = useState<T.StorageBooking[]>([]);
    const [storageLocations, setStorageLocations] = useState<T.StorageLocation[]>([]);
    const [batteryChargers, setBatteryChargers] = useState<T.BatteryCharger[]>([]);
    const [nominalCodes, setNominalCodes] = useState<T.NominalCode[]>([]);
    const [nominalCodeRules, setNominalCodeRules] = useState<T.NominalCodeRule[]>([]);
    const [absenceRequests, setAbsenceRequests] = useState<T.AbsenceRequest[]>([]);
    const [inquiries, setInquiries] = useState<T.Inquiry[]>([]);
    const [reminders, setReminders] = useState<T.Reminder[]>([]);
    const [auditLog, setAuditLog] = useState<T.AuditLogEntry[]>([]);
    const [businessEntities, setBusinessEntities] = useState<T.BusinessEntity[]>([]);
    const [taxRates, setTaxRates] = useState<T.TaxRate[]>([]);
    const [roles, setRoles] = useState<T.Role[]>([]);
    const [inspectionDiagrams, setInspectionDiagrams] = useState<T.InspectionDiagram[]>([]);

    const refreshActiveData = async (isBackground: boolean = false) => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        if (!isBackground) setIsLoading(true);
        
        try {
            // NOTICE: We have removed Customers, Vehicles, and Parts from this bulk call.
            // This ensures the application loads instantly even with thousands of records.
            const allResults = await Promise.all([
                getAll<T.Job>('brooks_jobs'),
                getAll<T.Purchase>('brooks_purchases'),
                getAll<T.PurchaseOrder>('brooks_purchaseOrders'),
                getAll<T.Supplier>('brooks_suppliers'),
                getAll<T.Engineer>('brooks_engineers'),
                getAll<T.Lift>('brooks_lifts'),
                getAll<T.Estimate>('brooks_estimates'),
                getAll<T.Invoice>('brooks_invoices'),
                getAll<T.ServicePackage>('brooks_servicePackages'),
                getAll<T.Prospect>('brooks_prospects'),
                getAll<T.TaxRate>('brooks_taxRates'),
                getAll<T.Role>('brooks_roles'),
                getAll<T.BusinessEntity>('brooks_businessEntities'),
                getAll<T.NominalCode>('brooks_nominalCodes'),
                getAll<T.AbsenceRequest>('brooks_absenceRequests'),
                getAll<T.Inquiry>('brooks_inquiries'),
                getAll<T.Reminder>('brooks_reminders')
            ]);

            // FILTER: Only load Jobs that are not "Closed". 
            // This keeps the workshop grid fast and clear.
            const activeJobs = allResults[0].filter(job => job.status !== 'Closed');
            setJobs(activeJobs);

            setPurchases(allResults[1]);
            setPurchaseOrders(allResults[2]);
            setSuppliers(allResults[3]);
            setEngineers(allResults[4]);
            setLifts(allResults[5]);
            setEstimates(allResults[6]);
            setInvoices(allResults[7]);
            setServicePackages(allResults[8]);
            setProspects(allResults[9]);
            setTaxRates(allResults[10]);
            setRoles(allResults[11]);
            setBusinessEntities(allResults[12]);
            setNominalCodes(allResults[13]);
            setAbsenceRequests(allResults[14]);
            setInquiries(allResults[15]);
            setReminders(allResults[16]);

        } catch (error) {
            console.error("Data Refresh Error:", error);
        } finally {
            if (!isBackground) setIsLoading(false);
            isRefreshingRef.current = false;
        }
    };

    useEffect(() => {
        refreshActiveData();
        const interval = setInterval(() => refreshActiveData(true), 5000);
        return () => clearInterval(interval);
    }, []);

    // Stabilize the grid sequence
    const sortedJobs = useMemo(() => {
        return [...jobs].sort((a, b) => {
            const posA = a.position ?? 9999;
            const posB = b.position ?? 9999;
            if (posA !== posB) return posA - posB;
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
    }, [jobs]);

    const sortedLifts = useMemo(() => {
        return [...lifts].sort((a, b) => 
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
    }, [lifts]);

    const value = useMemo(() => ({
        jobs: sortedJobs, setJobs, 
        vehicles, setVehicles, 
        customers, setCustomers,
        parts, setParts,
        estimates, setEstimates, invoices, setInvoices, purchaseOrders, setPurchaseOrders,
        purchases, setPurchases, servicePackages, setServicePackages,
        suppliers, setSuppliers, engineers, setEngineers, lifts: sortedLifts, setLifts,
        rentalVehicles, setRentalVehicles, rentalBookings, setRentalBookings,
        saleVehicles, setSaleVehicles, saleOverheadPackages, setSaleOverheadPackages,
        prospects, setProspects, storageBookings, setStorageBookings,
        storageLocations, setStorageLocations, batteryChargers, setBatteryChargers,
        nominalCodes, setNominalCodes, nominalCodeRules, setNominalCodeRules,
        absenceRequests, setAbsenceRequests, inquiries, setInquiries,
        reminders, setReminders, auditLog, setAuditLog, businessEntities, setBusinessEntities,
        taxRates, setTaxRates, roles, setRoles, inspectionDiagrams, setInspectionDiagrams,
        isLoading, refreshActiveData
    }), [
        sortedJobs, vehicles, customers, parts, estimates, invoices, purchaseOrders, purchases, 
        servicePackages, suppliers, engineers, sortedLifts, rentalVehicles, 
        rentalBookings, saleVehicles, saleOverheadPackages, prospects, storageBookings, 
        storageLocations, batteryChargers, nominalCodes, nominalCodeRules, 
        absenceRequests, inquiries, reminders, auditLog, businessEntities, 
        taxRates, roles, inspectionDiagrams, isLoading
    ]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = (): DataContextType => {
    const context = useContext(DataContext);
    if (!context) throw new Error('useData must be used within a DataContextProvider');
    return context;
};