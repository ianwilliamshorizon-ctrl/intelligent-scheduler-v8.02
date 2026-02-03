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
import { saveImage } from '../../utils/imageStore';
import { getWhere, getByIds, getAll } from '../db/index'; 

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

    // Dynamic Hot Data Path
    const [jobs, setJobs] = useState<T.Job[]>([]);
    const [purchases, setPurchases] = useState<T.Purchase[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<T.PurchaseOrder[]>([]);
    const [vehicles, setVehicles] = useState<T.Vehicle[]>([]);
    const [customers, setCustomers] = useState<T.Customer[]>([]);
    const [parts, setParts] = useState<T.Part[]>([]); 
    const [suppliers, setSuppliers] = useState<T.Supplier[]>([]); // Moved to Hot Path

    // Persistent Collections
    const [estimates, setEstimates] = usePersistentState<T.Estimate[]>('brooks_estimates', getInitialEstimates);
    const [invoices, setInvoices] = usePersistentState<T.Invoice[]>('brooks_invoices', getInitialInvoices);
    const [servicePackages, setServicePackages] = usePersistentState<T.ServicePackage[]>('brooks_servicePackages', getInitialServicePackages);
    const [engineers, setEngineers] = usePersistentState<T.Engineer[]>('brooks_engineers', getInitialEngineers);
    const [lifts, setLifts] = usePersistentState<T.Lift[]>('brooks_lifts', getInitialLifts);
    const [rentalVehicles, setRentalVehicles] = usePersistentState<T.RentalVehicle[]>('brooks_rentalVehicles', getInitialRentalVehicles);
    const [rentalBookings, setRentalBookings] = usePersistentState<T.RentalBooking[]>('brooks_rentalBookings', getInitialRentalBookings);
    const [saleVehicles, setSaleVehicles] = usePersistentState<T.SaleVehicle[]>('brooks_saleVehicles', getInitialSaleVehicles);
    const [saleOverheadPackages, setSaleOverheadPackages] = usePersistentState<T.SaleOverheadPackage[]>('brooks_saleOverheadPackages', getInitialSaleOverheadPackages);
    const [prospects, setProspects] = usePersistentState<T.Prospect[]>('brooks_prospects', getInitialProspects);
    const [storageBookings, setStorageBookings] = usePersistentState<T.StorageBooking[]>('brooks_storageBookings', getInitialStorageBookings);
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

    const refreshActiveData = async (isBackground: boolean = false) => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        if (!isBackground) setIsLoading(true);
        
        try {
            const activeStatuses = ['Unallocated', 'Inquiry', 'Draft', 'Estimate', 'Authorized', 'In Progress', 'Pending Parts', 'Scheduled'];
            
            // 1. Fetch In-Flight Documents
            const [activeJobs, activePurchases, activePOs] = await Promise.all([
                getWhere<T.Job>('brooks_jobs', 'status', 'in', activeStatuses),
                getWhere<T.Purchase>('brooks_purchases', 'paymentStatus', 'in', ['Unpaid', 'Partially Paid']),
                getWhere<T.PurchaseOrder>('brooks_purchaseOrders', 'status', 'in', ['Draft', 'Ordered', 'Partially Received', 'Received'])
            ]);

            // 2. Identify Dependencies (Parts & Suppliers)
            const activePartIds = new Set<string>();
            const activeSupplierIds = new Set<string>();

            // Suppliers from POs and Purchases
            activePOs.forEach(po => po.supplierId && activeSupplierIds.add(po.supplierId));
            activePurchases.forEach(p => p.supplierId && activeSupplierIds.add(p.supplierId));

            // Parts from POs
            activePOs.forEach(po => po.lineItems?.forEach(li => li.id && activePartIds.add(li.id)));
            
            // Parts from Active Jobs (via Estimates)
            const activeEstimateIds = activeJobs.map(j => j.estimateId).filter(Boolean);
            const resolvedEstimates = await getByIds<T.Estimate>('brooks_estimates', activeEstimateIds as string[]);
            resolvedEstimates.forEach(est => est.lineItems?.forEach(li => li.partId && activePartIds.add(li.partId)));

            const customerIds = [...new Set(activeJobs.map(j => j.customerId).filter(Boolean))];
            const vehicleIds = [...new Set(activeJobs.map(j => j.vehicleId).filter(Boolean))];

            // 3. Resolve everything in parallel
            const [activeCustomers, activeVehicles, resolvedParts, resolvedSuppliers] = await Promise.all([
                getByIds<T.Customer>('brooks_customers', customerIds),
                getByIds<T.Vehicle>('brooks_vehicles', vehicleIds),
                getByIds<T.Part>('brooks_parts', Array.from(activePartIds)),
                // If background sync, only get suppliers used in active docs. 
                // If initial load, get them all so the "New PO" list works.
                isBackground 
                    ? getByIds<T.Supplier>('brooks_suppliers', Array.from(activeSupplierIds))
                    : getAll<T.Supplier>('brooks_suppliers')
            ]);

            setJobs(activeJobs);
            setPurchases(activePurchases);
            setPurchaseOrders(activePOs);
            setCustomers(activeCustomers);
            setVehicles(activeVehicles);
            setParts(resolvedParts);
            setSuppliers(resolvedSuppliers);
            
        } catch (error) {
            console.error("Data Sync Error:", error);
        } finally {
            if (!isBackground) setIsLoading(false);
            isRefreshingRef.current = false;
        }
    };

    useEffect(() => {
        refreshActiveData();
    }, []);

    useEffect(() => {
        const pollInterval = setInterval(() => {
            refreshActiveData(true);
        }, 5000); 
        return () => clearInterval(pollInterval);
    }, []);

    useEffect(() => {
        const migrate = async () => {
            if (vehicles.length === 0) return;
            let vChanged = false;
            const updatedVehicles = JSON.parse(JSON.stringify(vehicles));
            for (const vehicle of updatedVehicles) {
                if (vehicle.images && Array.isArray(vehicle.images)) {
                    for (const image of vehicle.images) {
                        if ((image as any).dataUrl) {
                            vChanged = true;
                            await saveImage(image.id, (image as any).dataUrl);
                            delete (image as any).dataUrl;
                        }
                    }
                }
            }
            if (vChanged) setVehicles(updatedVehicles);
        };
        migrate();
    }, [vehicles.length]);

    const sortedLifts = useMemo(() => {
        return [...lifts].sort((a, b) => 
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
    }, [lifts]);

    const value = useMemo(() => ({
        jobs, setJobs, vehicles, setVehicles, customers, setCustomers,
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
    }), [jobs, vehicles, customers, estimates, invoices, purchaseOrders, purchases, parts, servicePackages, suppliers, engineers, sortedLifts, rentalVehicles, rentalBookings, saleVehicles, saleOverheadPackages, prospects, storageBookings, storageLocations, batteryChargers, nominalCodes, nominalCodeRules, absenceRequests, inquiries, reminders, auditLog, businessEntities, taxRates, roles, inspectionDiagrams, isLoading]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = (): DataContextType => {
    const context = useContext(DataContext);
    if (!context) throw new Error('useData must be used within a DataContextProvider');
    return context;
};