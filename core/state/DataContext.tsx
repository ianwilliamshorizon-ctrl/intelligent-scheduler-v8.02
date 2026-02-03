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
import { getAll } from '../db/index'; 

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
    isLoading: boolean;
    refreshActiveData: (isBackground?: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const isRefreshingRef = useRef(false);

    // Shield for Production Latency
    const pendingLocks = useRef<Map<string, number>>(new Map());

    // --- DATA STATES ---
    const [customers, setCustomers] = usePersistentState<T.Customer[]>('brooks_customers', getInitialCustomers);
    const [vehicles, setVehicles] = usePersistentState<T.Vehicle[]>('brooks_vehicles', getInitialVehicles);
    const [parts, setParts] = usePersistentState<T.Part[]>('brooks_parts', getInitialParts);

    const [jobs, setJobsRaw] = useState<T.Job[]>([]);
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

    /**
     * PRODUCTION-READY SETTER
     */
    const setJobs: React.Dispatch<React.SetStateAction<T.Job[]>> = (action) => {
        setJobsRaw(prev => {
            const next = typeof action === 'function' ? action(prev) : action;
            const now = Date.now();
            next.forEach(job => {
                const prevJob = prev.find(p => p.id === job.id);
                if (!prevJob || JSON.stringify(prevJob) !== JSON.stringify(job)) {
                    // 5 second lock for production network lag
                    pendingLocks.current.set(job.id, now + 5000);
                }
            });
            return next;
        });
    };

    const refreshActiveData = async (isBackground: boolean = false) => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        if (!isBackground) setIsLoading(true);
        
        try {
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

            const [allJobs] = allResults;

            // --- PROTECTIVE MERGE WITH DEBUG LOGGING ---
            setJobsRaw(currentLocal => {
                const now = Date.now();
                return allJobs.map(dbJob => {
                    const lockExpiry = pendingLocks.current.get(dbJob.id);
                    const localJob = currentLocal.find(l => l.id === dbJob.id);

                    if (lockExpiry && now < lockExpiry && localJob) {
                        // DETECT REVERSION ATTEMPTS
                        if (dbJob.status !== localJob.status) {
                            console.warn(`[DATA SHIELD] Blocked DB attempt to revert Job #${dbJob.id} from "${localJob.status}" back to "${dbJob.status}".`);
                        }
                        
                        // MERGE: Keep DB updates for non-grid fields, but force Grid Position
                        return {
                            ...dbJob,
                            status: localJob.status,
                            position: localJob.position,
                            segments: localJob.segments
                        };
                    }
                    
                    if (lockExpiry && now >= lockExpiry) pendingLocks.current.delete(dbJob.id);
                    return dbJob;
                });
            });

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
        jobs: sortedJobs, setJobs, vehicles, setVehicles, customers, setCustomers,
        estimates, setEstimates, invoices, setInvoices, purchaseOrders, setPurchaseOrders,
        purchases, setPurchases, parts, setParts, servicePackages, setServicePackages,
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
        sortedJobs, vehicles, customers, estimates, invoices, purchaseOrders, purchases, 
        parts, servicePackages, suppliers, engineers, sortedLifts, rentalVehicles, 
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