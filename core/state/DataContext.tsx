import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import * as T from '../../types';
import { usePersistentState } from './usePersistentState';
import * as DB from '../db'; 

import {
    getInitialJobs, getInitialVehicles, getInitialCustomers, getInitialEngineers,
    getInitialEstimates, getInitialInvoices, getInitialPurchaseOrders,
    getInitialSuppliers, getInitialParts, getInitialServicePackages, getInitialTaxRates,
    getInitialBusinessEntities, getInitialLifts, getInitialSaleVehicles,
    getInitialSaleOverheadPackages, getInitialStorageBookings, getInitialRentalVehicles,
    getInitialRentalBookings, getInitialStorageLocations, getInitialBatteryChargers,
    getInitialNominalCodes, getInitialNominalCodeRules, getInitialPurchases,
    getInitialAbsenceRequests, getInitialUsers, getInitialProspects, getInitialInquiries,
    getInitialReminders, getInitialAuditLog, getInitialRoles, getInitialInspectionDiagrams,
    getInitialInspectionTemplates
} from '../data/initialData'; 

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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [jobs, setJobs] = usePersistentState<T.Job[]>('brooks_jobs', getInitialJobs);
    const [vehicles, setVehicles] = usePersistentState<T.Vehicle[]>('brooks_vehicles', getInitialVehicles);
    const [customers, setCustomers] = usePersistentState<T.Customer[]>('brooks_customers', getInitialCustomers);
    const [estimates, setEstimates] = usePersistentState<T.Estimate[]>('brooks_estimates', getInitialEstimates);
    const [invoices, setInvoices] = usePersistentState<T.Invoice[]>('brooks_invoices', getInitialInvoices);
    const [purchaseOrders, setPurchaseOrders] = usePersistentState<T.PurchaseOrder[]>('brooks_purchaseOrders', getInitialPurchaseOrders);
    const [purchases, setPurchases] = usePersistentState<T.Purchase[]>('brooks_purchases', getInitialPurchases);
    const [parts, setParts] = usePersistentState<T.Part[]>('brooks_parts', getInitialParts);
    const [servicePackages, setServicePackages] = usePersistentState<T.ServicePackage[]>('brooks_servicePackages', getInitialServicePackages);
    const [suppliers, setSuppliers] = usePersistentState<T.Supplier[]>('brooks_suppliers', getInitialSuppliers);
    const [engineers, setEngineers] = usePersistentState<T.Engineer[]>('brooks_engineers', getInitialEngineers);
    const [lifts, setLifts] = usePersistentState<T.Lift[]>('brooks_lifts', getInitialLifts);
    const [rentalVehicles, setRentalVehicles] = usePersistentState<T.RentalVehicle[]>('brooks_rentalVehicles', getInitialRentalVehicles);
    const [rentalBookings, setRentalBookings] = usePersistentState<T.RentalBooking[]>('brooks_rentalBookings', getInitialRentalBookings);
    const [saleVehicles, setSaleVehicles] = usePersistentState<T.SaleVehicle[]>('brooks_saleVehicles', getInitialSaleVehicles);
    const [saleOverheadPackages, setSaleOverheadPackages] = usePersistentState<T.SaleOverheadPackage[]>('brooks_saleOverheadPackages', getInitialSaleOverheadPackages);
    const [prospects, setProspects] = usePersistentState<T.Prospect[]>('brooks_prospects', getInitialProspects);
    const [storageBookings, setStorageBookings] = usePersistentState<T.StorageBooking[]>('brooks_storageBooking', getInitialStorageBookings);
    const [storageLocations, setStorageLocations] = usePersistentState<T.StorageLocation[]>('brooks_storageLocations', getInitialStorageLocations);
    const [batteryChargers, setBatteryChargers] = usePersistentState<T.BatteryCharger[]>('brooks_batteryChargers', getInitialBatteryChargers);
    const [nominalCodes, setNominalCodes] = usePersistentState<T.NominalCode[]>('brooks_nominalCodes', getInitialNominalCodes);
    const [nominalCodeRules, setNominalCodeRules] = usePersistentState<T.NominalCodeRule[]>('brooks_nominalCodeRules', getInitialNominalCodeRules);
    const [absenceRequests, setAbsenceRequests] = usePersistentState<T.AbsenceRequest[]>('brooks_absenceRequests', getInitialAbsenceRequests);
    const [inquiries, setInquiries] = usePersistentState<T.Inquiry[]>('brooks_inquiries', getInitialInquiries);
    const [reminders, setReminders] = usePersistentState<T.Reminder[]>('brooks_reminders', getInitialReminders);
    const [auditLog, setAuditLog] = usePersistentState<T.AuditLogEntry[]>('brooks_auditLog', getInitialAuditLog);
    const [businessEntities, setBusinessEntities] = usePersistentState<T.BusinessEntity[]>('brooks_businessEntities', getInitialBusinessEntities);
    const [taxRates, setTaxRates] = usePersistentState<T.TaxRate[]>('brooks_taxRates', getInitialTaxRates);
    const [roles, setRoles] = usePersistentState<T.Role[]>('brooks_roles', getInitialRoles);
    const [inspectionDiagrams, setInspectionDiagrams] = usePersistentState<T.InspectionDiagram[]>('brooks_inspectionDiagrams', getInitialInspectionDiagrams);
    const [inspectionTemplates, setInspectionTemplates] = usePersistentState<T.InspectionTemplate[]>('brooks_inspectionTemplates', getInitialInspectionTemplates);

    const isFirstRun = useRef(true);

    useEffect(() => {
        if (!isFirstRun.current) return;
        isFirstRun.current = false;

        const performCleanInstall = async () => {
            // 1. CHECK BEFORE WRITING:
            // We only want to auto-sync if the database is fundamentally empty.
            // Since we usePersistentState, we can check if our local arrays are empty.
            if (servicePackages.length > 0 || parts.length > 0) {
                console.log("ℹ️ [DB] Data already exists. Skipping Master Sync.");
                return;
            }

            console.warn("🚨 MASTER SYNC: Performing Clean Install...");
            (window as any).isSyncing = true; 

            const syncMap = [
                { col: 'brooks_taxRates', data: getInitialTaxRates() },
                { col: 'brooks_suppliers', data: getInitialSuppliers() },
                { col: 'brooks_businessEntities', data: getInitialBusinessEntities() },
                { col: 'brooks_roles', data: getInitialRoles() },
                { col: 'brooks_customers', data: getInitialCustomers() },
                { col: 'brooks_vehicles', data: getInitialVehicles() },
                { col: 'brooks_parts', data: getInitialParts() },
                { col: 'brooks_servicePackages', data: getInitialServicePackages() },
                { col: 'brooks_engineers', data: getInitialEngineers() },
                { col: 'brooks_inspectionTemplates', data: getInitialInspectionTemplates() }
            ];

            for (const task of syncMap) {
                console.log(`🧹 Syncing ${task.col} (${task.data.length} items)...`);
                for (const item of task.data) {
                    try {
                        await DB.saveDocument(task.col, item as any);
                    } catch (err) {
                        console.error(`❌ Sync error in ${task.col} for ID ${item.id}:`, err);
                    }
                }
            }
            
            (window as any).isSyncing = false; 
            console.log("🏁 CLEAN INSTALL COMPLETE.");
        };

        performCleanInstall();
    }, [servicePackages.length, parts.length]); // Dependencies to ensure we have data info

    const value = useMemo(() => ({
        jobs, setJobs, vehicles, setVehicles, customers, setCustomers,
        estimates, setEstimates, invoices, setInvoices, purchaseOrders, setPurchaseOrders,
        purchases, setPurchases, parts, setParts, servicePackages, setServicePackages,
        suppliers, setSuppliers, engineers, setEngineers, lifts, setLifts,
        rentalVehicles, setRentalVehicles, rentalBookings, setRentalBookings,
        saleVehicles, setSaleVehicles, saleOverheadPackages, setSaleOverheadPackages,
        prospects, setProspects, storageBookings, setStorageBookings,
        storageLocations, setStorageLocations, batteryChargers, setBatteryChargers,
        nominalCodes, setNominalCodes, nominalCodeRules, setNominalCodeRules,
        absenceRequests, setAbsenceRequests, inquiries, setInquiries,
        reminders, setReminders, auditLog, setAuditLog,
        businessEntities, setBusinessEntities, taxRates, setTaxRates,
        roles, setRoles, inspectionDiagrams, setInspectionDiagrams,
        inspectionTemplates, setInspectionTemplates,
    }), [
        jobs, vehicles, customers, estimates, invoices, purchaseOrders, purchases, parts, 
        servicePackages, suppliers, engineers, lifts, rentalVehicles, rentalBookings, 
        saleVehicles, saleOverheadPackages, prospects, storageBookings, storageLocations, 
        batteryChargers, nominalCodes, nominalCodeRules, absenceRequests, inquiries, 
        reminders, auditLog, businessEntities, taxRates, roles, inspectionDiagrams, 
        inspectionTemplates
    ]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) throw new Error('useData must be used within a DataContextProvider');
    return context;
};