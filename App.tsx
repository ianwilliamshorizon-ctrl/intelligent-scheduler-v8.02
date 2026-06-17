import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as T from './types';
import { useData } from './core/state/DataContext';
import { useApp } from './core/state/AppContext';
import { createBackup, downloadBackup } from './core/utils/backupUtils';
import { setItem, uploadToStorage, downloadFromStorage, getDocument } from './core/db';
import { idbSet, idbGet } from './core/db/idb';
import { getCustomerDisplayName } from './core/utils/customerUtils';
import { formatDate, dateStringToDate } from './core/utils/dateUtils';
import { calculateJobPartsStatus } from './core/utils/jobUtils';
import useModalState from './core/hooks/useModalState';
import { useWorkshopActions } from './core/hooks/useWorkshopActions';
import { CheckCircle2, XCircle } from 'lucide-react';

// Layout & Core Components
import MainLayout from './components/MainLayout';
import AppModals from './components/AppModals';
import LoginView from './components/LoginView';
import VersionChecker from './components/VersionChecker';
import EstimateViewModal from './components/EstimateViewModal';
import CoBrowsingController from './components/CoBrowsingController';

// Lazy Loaded Views
const DashboardView = lazy(() => import('./components/DashboardView'));
const DirectorsDashboard = lazy(() => import('./components/DirectorsDashboard'));
const DispatchView = lazy(() => import('./modules/workshop/DispatchView'));
const WorkflowView = lazy(() => import('./components/WorkflowView'));
const JobsView = lazy(() => import('./modules/workshop/JobsView'));
const EstimatesView = lazy(() => import('./modules/workshop/EstimatesView'));
const InvoicesView = lazy(() => import('./modules/workshop/InvoicesView'));
const PurchaseOrdersView = lazy(() => import('./modules/workshop/PurchaseOrdersView'));
const SalesView = lazy(() => import('./components/SalesView'));
const StorageView = lazy(() => import('./components/StorageView'));
const RentalsView = lazy(() => import('./components/RentalsView'));
const ConciergeView = lazy(() => import('./components/ConciergeView'));
const CommunicationsView = lazy(() => import('./components/CommunicationsView'));
const AbsenceView = lazy(() => import('./components/AbsenceView'));
const InquiriesView = lazy(() => import('./components/InquiriesView'));
const FinancialReporting = lazy(() => import('./components/FinancialReporting'));
const ManagementModal = lazy(() => import('./components/ManagementModal'));
const HelpCentre = lazy(() => import('./components/HelpCentre'));

// --- INACTIVITY HOOK ---
const useInactivityLogout = (logoutFn: () => void, isAuthenticated: boolean, timeoutMs: number = 30 * 60 * 1000) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const resetTimer = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (isAuthenticated) {
            timeoutRef.current = setTimeout(() => {
                logoutFn();
            }, timeoutMs);
        }
    }, [isAuthenticated, logoutFn, timeoutMs]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const events: (keyof WindowEventMap)[] = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => window.addEventListener(event, resetTimer, { passive: true }));
        resetTimer();
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            events.forEach(event => window.removeEventListener(event, resetTimer));
        };
    }, [isAuthenticated, resetTimer]);
};

const App = () => {
    const { 
        currentView, setCurrentView, currentUser, 
        selectedEntityId, setSelectedEntityId,
        confirmation, setConfirmation,
        users, isAuthenticated, login, logout, 
        backupSchedule, setBackupSchedule, appEnvironment
    } = useApp();

    useInactivityLogout(logout, isAuthenticated, 30 * 60 * 1000);

    const data = useData();
    const { 
        jobs, vehicles, customers, estimates, invoices, purchaseOrders, 
        purchases, parts, servicePackages, suppliers, engineers, lifts,
        rentalVehicles, rentalBookings, saleVehicles, saleOverheadPackages,
        prospects, storageBookings, storageLocations, batteryChargers,
        nominalCodes, nominalCodeRules, absenceRequests, inquiries, 
        reminders, auditLog, businessEntities, taxRates, roles, inspectionDiagrams,
        setJobs, setEstimates, setInvoices, setPurchaseOrders, setRentalBookings,
        setStorageBookings, setProspects, setInquiries, setAbsenceRequests, setParts,
        setCustomers, setVehicles,
        forceRefresh
    } = data;

    const [modalsState, setters] = useModalState();
    const [isManagementOpen, setIsManagementOpen] = useState(false);
    const [isHelpCentreOpen, setIsHelpCentreOpen] = useState(false);
    const [managementInitialView, setManagementInitialView] = useState<{ tab: string; id: string } | null>(null);
    const lastBackupTimeRef = useRef<string | null>(null);
    const [poToViewId, setPoToViewId] = useState<string | null>(null);
    const [customerActionState, setCustomerActionState] = useState<'pending' | 'approved' | 'declined'>('pending');
    const [customerViewData, setCustomerViewData] = useState<{
        estimate: T.Estimate | null;
        customer: T.Customer | null;
        vehicle: T.Vehicle | null;
        entity: T.BusinessEntity | null;
        loading: boolean;
        error: string | null;
    }>(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const urlEstimateId = searchParams.get('estimateId');
        const isCustomerView = searchParams.get('view') === 'customer' && urlEstimateId;
        return {
            estimate: null,
            customer: null,
            vehicle: null,
            entity: null,
            loading: !!isCustomerView,
            error: null
        };
    });

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const urlEstimateId = searchParams.get('estimateId');
        const isCustomerView = searchParams.get('view') === 'customer' && urlEstimateId;
        
        if (!isCustomerView || !urlEstimateId) return;

        const loadCustomerData = async () => {
            try {
                const estimateDoc = await getDocument<T.Estimate>('brooks_estimates', urlEstimateId);
                if (!estimateDoc) {
                    setCustomerViewData(prev => ({ ...prev, loading: false, error: 'Estimate not found' }));
                    return;
                }

                const [customerDoc, vehicleDoc] = await Promise.all([
                    estimateDoc.customerId ? getDocument<T.Customer>('brooks_customers', estimateDoc.customerId) : null,
                    estimateDoc.vehicleId ? getDocument<T.Vehicle>('brooks_vehicles', estimateDoc.vehicleId) : null,
                ]);

                let entityDoc = businessEntities.find(e => e.id === estimateDoc.entityId) || null;
                if (!entityDoc && estimateDoc.entityId) {
                    entityDoc = await getDocument<T.BusinessEntity>('brooks_business_entities', estimateDoc.entityId);
                }

                setCustomerViewData({
                    estimate: estimateDoc,
                    customer: customerDoc,
                    vehicle: vehicleDoc,
                    entity: entityDoc,
                    loading: false,
                    error: null
                });
            } catch (err: any) {
                console.error("Error loading customer view data:", err);
                setCustomerViewData(prev => ({ ...prev, loading: false, error: err.message || 'Failed to load data' }));
            }
        };

        loadCustomerData();
    }, [businessEntities]);



    const handleGenerateInvoice = (jobId: string) => {
        const job = (jobs || []).find(j => j.id === jobId);
        if (!job) return;

        const linkedEstimate = (estimates || []).find(e => e.id === job.estimateId || e.jobId === job.id);
        const jobPurchaseOrders = (purchaseOrders || []).filter(po => po.jobId === job.id || (job.purchaseOrderIds || []).includes(po.id));
        const currentPartsStatus = calculateJobPartsStatus(linkedEstimate || null, jobPurchaseOrders);

        const isReconciled = currentPartsStatus === 'Fully Received' || currentPartsStatus === 'Not Required';
        if (!isReconciled) {
            toast.error(`Cannot generate invoice. All parts for Job #${job.id} must be receipted and reconciled first (Current parts status: ${currentPartsStatus}).`);
            return;
        }

        setters.setInvoiceFormModal({ isOpen: true, job });
    };

    const workshopActions = useWorkshopActions(handleGenerateInvoice);

    useEffect(() => {
        if (isAuthenticated && businessEntities.length > 0) {
            if (!selectedEntityId || selectedEntityId === 'all') {
                if (typeof setSelectedEntityId === 'function') {
                    setSelectedEntityId(businessEntities[0].id);
                }
            }
        }
    }, [isAuthenticated, businessEntities, selectedEntityId, setSelectedEntityId]);

    const getFullStateData = useCallback(() => {
        return {
            jobs, vehicles, customers, estimates, invoices, purchaseOrders, 
            purchases, parts, servicePackages, suppliers, engineers, lifts,
            rentalVehicles, rentalBookings, saleVehicles, saleOverheadPackages,
            prospects, storageBookings, storageLocations, batteryChargers,
            nominalCodes, nominalCodeRules, absenceRequests, inquiries, 
            reminders, auditLog, businessEntities, taxRates, roles, inspectionDiagrams, users
        };
    }, [jobs, vehicles, customers, estimates, invoices, purchaseOrders, purchases, parts, servicePackages, suppliers, engineers, lifts, rentalVehicles, rentalBookings, saleVehicles, saleOverheadPackages, prospects, storageBookings, storageLocations, batteryChargers, nominalCodes, nominalCodeRules, absenceRequests, inquiries, reminders, auditLog, businessEntities, taxRates, roles, inspectionDiagrams, users]);

    const handleManualBackup = useCallback(() => {
        const backupData = createBackup(getFullStateData());
        downloadBackup(backupData);
    }, [getFullStateData]);

    const handleCloudSnapshot = useCallback(async () => {
        const backupData = createBackup(getFullStateData());
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backups/backup_manual_${timestamp}.json`;
        
        try {
            await uploadToStorage(filename, backupData);
            setConfirmation({
                isOpen: true,
                title: 'Cloud Snapshot Created',
                message: 'A manual system snapshot has been successfully uploaded to cloud storage.',
                type: 'success'
            });
            return true;
        } catch (e) {
            console.error("Cloud snapshot failed", e);
            return false;
        }
    }, [getFullStateData, setConfirmation]);

    const handleAutoBackup = useCallback(async () => {
        const backupData = createBackup(getFullStateData());
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backups/backup_auto_${timestamp}.json`;

        try {
            // 1. Remote Retention (Firebase Storage) - No 1MB limit
            await uploadToStorage(filename, backupData);
            
            // 2. Local Retention (IndexedDB) - Much larger than LocalStorage
            await idbSet(`backup_local_${timestamp}`, backupData);
            
            // Keep track of the latest local backup for quick access
            await idbSet('last_auto_backup', backupData);

            // 3. Update Schedule Status
            setBackupSchedule({
                ...backupSchedule,
                lastRun: new Date().toISOString(),
                lastSuccess: new Date().toISOString()
            });

            setConfirmation({
                isOpen: true,
                title: 'Automated Snapshot Created',
                message: 'A dual-retention system backup (Local IndexedDB & Cloud Storage) has been successfully saved. You can restore this from the Management > Backup tab.',
                type: 'success'
            });
        } catch (e) {
            console.error("Auto-backup failed", e);
            setBackupSchedule({
                ...backupSchedule,
                lastRun: new Date().toISOString()
            });
        }
    }, [getFullStateData, setConfirmation]);

    const handleRestoreFromSnapshot = useCallback(async (snapshotId: string) => {
        let snapshot: any = null;
        
        if (snapshotId.startsWith('backups/')) {
            // Restore from Cloud Storage
            snapshot = await downloadFromStorage(snapshotId);
        } else {
            // Restore from Local IndexedDB
            snapshot = await idbGet(snapshotId);
        }

        if (!snapshot) throw new Error("Snapshot not found or could not be downloaded");

        const dataToRestore = snapshot.data || snapshot;
        for (const [key, value] of Object.entries(dataToRestore)) {
            if (key.startsWith('brooks_')) {
                await setItem(key, value);
            }
        }
    }, []);

    useEffect(() => {
        if (!backupSchedule.enabled) return;
        const checkBackupTime = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            if (backupSchedule.times.includes(timeString)) {
                if (lastBackupTimeRef.current !== timeString) {
                    handleAutoBackup();
                    lastBackupTimeRef.current = timeString;
                }
            }
        };
        const interval = setInterval(checkBackupTime, 15000);
        return () => clearInterval(interval);
    }, [backupSchedule, handleAutoBackup]);

    useEffect(() => {
        const handlePrintRequest = (e: Event) => {
            const customEvent = e as CustomEvent<{ vehicleId: string }>;
            if (customEvent.detail?.vehicleId) {
                setters.setVehicleHistoryReportModal({ isOpen: true, vehicleId: customEvent.detail.vehicleId });
            }
        };
        window.addEventListener('open-vehicle-history-report', handlePrintRequest, { passive: true });
        return () => window.removeEventListener('open-vehicle-history-report', handlePrintRequest);
    }, [setters]);

    const handleRefreshPurchaseOrder = async (poId: string) => {
        setPoToViewId(poId);
        await forceRefresh('brooks_purchaseOrders');
    };

    useEffect(() => {
        if (poToViewId && purchaseOrders && purchaseOrders.length > 0) {
            const latestPo = purchaseOrders.find(p => p.id === poToViewId);
            if (latestPo) {
                setters.setPoModal({ isOpen: true, po: latestPo });
                setPoToViewId(null);
            }
        }
    }, [purchaseOrders, poToViewId, setters]);

    // Check if we are in customer view mode for a specific estimate
    const searchParams = new URLSearchParams(window.location.search);
    const urlEstimateId = searchParams.get('estimateId');
    const isCustomerView = searchParams.get('view') === 'customer' && urlEstimateId;

    if (isCustomerView) {
        if (customerViewData.loading) {
            return (
                <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <p className="text-gray-600 text-sm">Loading Estimate...</p>
                    </div>
                </div>
            );
        }

        if (customerViewData.error || !customerViewData.estimate) {
            return (
                <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-xl shadow-lg text-center max-w-md">
                        <h2 className="text-xl font-bold text-red-600 mb-2">Estimate Not Found</h2>
                        <p className="text-gray-600 text-sm mb-4">{customerViewData.error || 'The estimate link you followed is invalid or has expired.'}</p>
                        <button onClick={() => { try { window.close(); } catch(e) {} }} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition">Close Tab</button>
                    </div>
                </div>
            );
        }

        if (customerActionState === 'approved') {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md border border-green-100 flex flex-col items-center">
                        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4 text-green-600">
                            <CheckCircle2 size={36} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Request Received!</h2>
                        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                            Thank you. We have received your approval and preferred dates. A member of our team will review the schedule and confirm your booking shortly.
                        </p>
                        <button 
                            onClick={() => {
                                try { window.close(); } catch (e) {}
                                alert("You can now close this tab safely.");
                            }} 
                            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition shadow-md shadow-indigo-100"
                        >
                            Close Tab
                        </button>
                    </div>
                </div>
            );
        }

        if (customerActionState === 'declined') {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md border border-red-100 flex flex-col items-center">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-500">
                            <XCircle size={36} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Estimate Declined</h2>
                        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                            You have declined this estimate. We have been notified of your response.
                        </p>
                        <button 
                            onClick={() => {
                                try { window.close(); } catch (e) {}
                                alert("You can now close this tab safely.");
                            }} 
                            className="w-full py-3 bg-gray-600 text-white font-bold rounded-xl hover:bg-gray-700 transition"
                        >
                            Close Tab
                        </button>
                    </div>
                </div>
            );
        }

        const dummyCustomerUser = { id: 'customer', name: 'Customer', email: '', role: 'Client' } as unknown as T.User;

        return (
            <div className="min-h-screen bg-gray-100 flex justify-center items-start">
                <EstimateViewModal
                    isOpen={true}
                    onClose={() => {
                        try { window.close(); } catch(e) {}
                        window.location.href = window.location.origin;
                    }}
                    estimate={customerViewData.estimate}
                    customer={customerViewData.customer || undefined}
                    vehicle={customerViewData.vehicle || undefined}
                    taxRates={taxRates}
                    servicePackages={servicePackages}
                    entityDetails={customerViewData.entity || undefined}
                    onApprove={() => {}} 
                    onCustomerApprove={(est, items, dates, notes) => {
                        handleCustomerApproveEstimate(est, items, dates, notes);
                        setCustomerActionState('approved');
                    }}
                    onDecline={(est, reason) => {
                        handleCustomerDeclineEstimate(est, reason);
                        setCustomerActionState('declined');
                    }}
                    onEmailSuccess={() => {}}
                    viewMode="customer"
                    parts={parts}
                    users={users}
                    currentUser={dummyCustomerUser}
                />
                <ToastContainer aria-label="Notifications" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <>
                <LoginView users={users} onLogin={login} environment={appEnvironment} businessEntities={businessEntities} />
                <ToastContainer aria-label="Notifications" />
            </>
        );
    }

    const handleSaveItem = workshopActions.handleSaveItem;
    const handleDeleteItem = <Type extends { id: string }>(setter: React.Dispatch<React.SetStateAction<Type[]>>, id: string) => {
        if(confirm('Are you sure you want to delete this item?')) {
            setter(prev => prev.filter(i => i.id !== id));
        }
    };

    function handleCustomerApproveEstimate(estimate: T.Estimate, selectedOptionalItemIds: string[], dateRange: any, notes: string) {
        if (estimate.jobId) { workshopActions.handleApproveEstimate(estimate, selectedOptionalItemIds, notes); return; }
        const customer = (customers || []).find(c => c.id === estimate.customerId);
        
        // --- IMPROVED LINE ITEM PROCESSING ---
        // Ensure identified optional items are converted to standard items so the scheduler sees them
        const explicitItemIds = new Set((estimate.lineItems || []).filter(li => !li.isOptional || selectedOptionalItemIds.includes(li.id)).map(i => i.id));
        const allIncludedIds = new Set(explicitItemIds);
        
        // Include package components if their header is selected
        (estimate.lineItems || []).forEach(item => {
            if (item.isPackageComponent && item.servicePackageId) {
                const header = (estimate.lineItems || []).find(h => h.servicePackageId === item.servicePackageId && !h.isPackageComponent);
                if (header && explicitItemIds.has(header.id)) allIncludedIds.add(item.id);
            }
        });

        const activeLineItems = (estimate.lineItems || []).filter(li => allIncludedIds.has(li.id));
        const approvedLineItems = activeLineItems.map(li => ({ ...li, isOptional: false }));

        const selectedOptionsList = (estimate.lineItems || []).filter(item => item.isOptional && selectedOptionalItemIds.includes(item.id)).map(item => `- ${item.description} (${(item.unitCost * item.quantity).toFixed(2)})`).join('\n');
        
        let dateRangeStr = '';
        let successMessage = 'Thank you. We have received your approval and preferred dates. A member of our team will review the schedule and confirm your booking shortly.';
        
        if (dateRange?.start === 'next-available') {
            dateRangeStr = 'Next Available Time Slot';
            successMessage = 'Thank you. We have received your approval. A member of our team will schedule the job in the next available time slot and confirm the booking details with you shortly.';
        } else {
            const startStr = dateRange?.start ? formatDate(new Date(dateRange.start)) : 'N/A';
            const endStr = dateRange?.end ? formatDate(new Date(dateRange.end)) : 'N/A';
            dateRangeStr = `${startStr} to ${endStr}`;
        }

        const inquiryMessage = `ONLINE APPROVAL: Estimate #${estimate.estimateNumber}\n\n` + `Preferred Dates: ${dateRangeStr}\n` + `Customer Notes: ${notes || 'None'}\n\n` + (selectedOptionsList ? `Selected Optional Extras:\n${selectedOptionsList}` : `No optional extras selected.`);
        
        const existingInquiry = (inquiries || []).find(i => i.linkedEstimateId === estimate.id);
        if (existingInquiry) {
            const updatedInquiry = { ...existingInquiry, status: 'Approved' as const, message: existingInquiry.message + '\n\n' + inquiryMessage, actionNotes: (existingInquiry.actionNotes || '') + '\n[System]: Customer Approved Online. Action Required.' };
            handleSaveItem(setInquiries, updatedInquiry);
        } else {
            const newInquiry: T.Inquiry = { id: crypto.randomUUID(), entityId: estimate.entityId, createdAt: new Date().toISOString(), fromName: getCustomerDisplayName(customer), fromContact: customer?.email || customer?.mobile || "Client Portal", message: inquiryMessage, takenByUserId: 'system', status: 'Approved', linkedCustomerId: estimate.customerId, linkedVehicleId: estimate.vehicleId, linkedEstimateId: estimate.id, actionNotes: 'Auto-generated from Customer Estimate Approval. Please review dates and convert to Job.' };
            handleSaveItem(setInquiries, newInquiry);
        }

        const updatedEstimate: T.Estimate = { ...estimate, status: 'Approved', lineItems: approvedLineItems };
        handleSaveItem(setEstimates, updatedEstimate);
        setCustomerViewData(prev => prev.estimate ? { ...prev, estimate: updatedEstimate } : prev);
        setConfirmation({ isOpen: true, title: 'Request Received', message: successMessage, type: 'success' });
    }

    function handleCustomerDeclineEstimate(estimate: T.Estimate, reason?: string) {
        const updatedEstimate: T.Estimate = { ...estimate, status: 'Rejected' };
        handleSaveItem(setEstimates, updatedEstimate);
        
        const customer = (customers || []).find(c => c.id === estimate.customerId);
        const inquiryMessage = `ONLINE DECLINE: Estimate #${estimate.estimateNumber}\n\n` + 
                               `Reason for declining: ${reason || 'None provided'}`;
        
        const existingInquiry = (inquiries || []).find(i => i.linkedEstimateId === estimate.id);
        if (existingInquiry) {
            const updatedInquiry = { 
                ...existingInquiry, 
                status: 'Rejected' as const, 
                message: existingInquiry.message + '\n\n' + inquiryMessage,
                actionNotes: (existingInquiry.actionNotes || '') + `\n[System]: Customer Declined Online. Reason: ${reason || 'None provided'}`
            };
            handleSaveItem(setInquiries, updatedInquiry);
        } else {
            const newInquiry: T.Inquiry = { 
                id: crypto.randomUUID(), 
                entityId: estimate.entityId, 
                createdAt: new Date().toISOString(), 
                fromName: getCustomerDisplayName(customer), 
                fromContact: customer?.email || customer?.mobile || "Client Portal", 
                message: inquiryMessage, 
                takenByUserId: 'system', 
                status: 'Rejected', 
                linkedCustomerId: estimate.customerId, 
                linkedVehicleId: estimate.vehicleId, 
                linkedEstimateId: estimate.id, 
                actionNotes: `Customer Declined Online. Reason: ${reason || 'None provided'}`
            };
            handleSaveItem(setInquiries, newInquiry);
        }

        // @ts-ignore
        workshopActions.updateLinkedInquiryStatus(estimate.id, 'Rejected');
        setCustomerViewData(prev => prev.estimate ? { ...prev, estimate: updatedEstimate } : prev);
        setConfirmation({ isOpen: true, title: 'Estimate Declined', message: 'You have declined this estimate. We have been notified.', type: 'warning' });
    }

    const handleMarkJobAsAwaitingCollection = (jobId: string) => {
        const job = (jobs || []).find(j => j.id === jobId);
        if (job) {
            handleSaveItem(setJobs, { ...job, vehicleStatus: 'Awaiting Collection' }, 'brooks_jobs');
        }
    };
    
    const handleSearchResult = (type: 'customer' | 'vehicle', id: string) => {
        if (type === 'customer') { setters.setCustomerModal({ isOpen: true, customerId: id }); } 
        else if (type === 'vehicle') { setters.setVehicleModal({ isOpen: true, vehicleId: id }); }
    };

    // New handler to process navigation within the Management Modal
    const handleViewCustomerFromManagement = (customerId: string) => {
        // We close the management modal and open the specific customer detail view
        setIsManagementOpen(false);
        setters.setCustomerModal({ isOpen: true, customerId: customerId });
    };

    const commonProps = {
        onViewCustomer: (id: string) => setters.setCustomerModal({ isOpen: true, customerId: id }),
        onViewVehicle: (id: string) => setters.setVehicleModal({ isOpen: true, vehicleId: id }),
        onStartWork: (jobId: string, segmentId: string) => workshopActions.handleUpdateSegmentStatus(jobId, segmentId, 'In Progress'),
        onPause: (id: string, segId: string) => workshopActions.handleUpdateSegmentStatus(id, segId, 'Paused'),
        onRestartWork: (jobId: string, segmentId: string) => workshopActions.handleUpdateSegmentStatus(jobId, segmentId, 'In Progress'),
        onRestart: (jobId: string, segmentId: string) => workshopActions.handleUpdateSegmentStatus(jobId, segmentId, 'In Progress'),
        onEngineerComplete: (job: T.Job, segmentId: string) => workshopActions.handleUpdateSegmentStatus(job.id, segmentId, 'Engineer Complete', { engineerCompletedAt: new Date().toISOString() }),
        onSendOffsite: workshopActions.handleSendOffsite,
        onQcApprove: workshopActions.handleQcApprove,
        onOpenAssistant: (id: string) => { setters.setAssistantContextJobId(id); setters.setIsAssistantOpen(true); },
        onEditJob: (id: string, initialTab?: string) => { 
            setters.setSelectedJobId(id); 
            setters.setEditJobInitialTab(initialTab || null);
            setters.setIsEditJobModalOpen(true); 
        },
    };

    const modalActions = {
        handleSaveItem, setCustomers, setVehicles, setParts,
        handleSavePart: (p: T.Part) => handleSaveItem(setParts, p, 'brooks_parts'),
        handleEditPart: (p: T.Part) => handleSaveItem(setParts, p, 'brooks_parts'),
        handleSavePurchaseOrder: workshopActions.handleSavePurchaseOrder,
        handleSaveEstimate: workshopActions.handleSaveEstimate,
        handleApproveEstimate: workshopActions.handleApproveEstimate,
        handleCustomerApproveEstimate, handleCustomerDeclineEstimate,
        updateLinkedInquiryStatus: workshopActions.updateLinkedInquiryStatus,
        handleMarkJobAsAwaitingCollection,
        handleRefreshPurchaseOrder,
        handleDeleteJob: workshopActions.handleDeleteJob
    };

    const renderCurrentView = () => {
        if (!currentUser) return null;

        switch (currentView) {
            case 'dashboard':
                return <DashboardView {...commonProps} onCheckIn={(id) => setters.setCheckInJob((jobs || []).find(j => j.id === id) || null)} onOpenInquiry={(inq) => setters.setInquiryModal({isOpen: true, inquiry: inq})} />;
            case 'directors-dashboard':
                return <DirectorsDashboard />;
            case 'dispatch':
                return <DispatchView 
                    {...commonProps} 
                    setDefaultDateForModal={(date: Date | null) => setters.setSmartCreateDefaultDate(date)} 
                    setIsSmartCreateOpen={setters.setIsSmartCreateOpen} 
                    setSmartCreateMode={setters.setSmartCreateMode} 
                    setSelectedJobId={setters.setSelectedJobId} 
                    setIsEditModalOpen={setters.setIsEditJobModalOpen} 
                    setEditJobInitialTab={setters.setEditJobInitialTab}
                    onOpenPurchaseOrder={(po) => setters.setPoModal({isOpen: true, po})} 
                    onReassignEngineer={workshopActions.handleReassignEngineer} 
                    onCheckIn={(id) => setters.setCheckInJob((jobs || []).find(j => j.id === id) || null)} 
                    onUnscheduleSegment={workshopActions.handleUnscheduleSegment} 
                    onSendOffsite={workshopActions.handleSendOffsite}
                    onPassToSales={workshopActions.handlePassToSales}
                />;
            case 'workflow':
                const workflowJobs = (jobs || []).filter(j => selectedEntityId === 'all' || j.entityId === selectedEntityId);
                return <WorkflowView jobs={workflowJobs} vehicles={vehicles || []} customers={customers || []} engineers={engineers || []} currentUser={currentUser} onQcApprove={commonProps.onQcApprove} onGenerateInvoice={handleGenerateInvoice} onEditJob={commonProps.onEditJob} onStartWork={commonProps.onStartWork} onEngineerComplete={commonProps.onEngineerComplete} onPause={(id, segId) => workshopActions.handleUpdateSegmentStatus(id, segId, 'Paused')} onRestart={commonProps.onRestart} onOpenAssistant={commonProps.onOpenAssistant} onOpenPurchaseOrder={(po) => setters.setPoModal({isOpen: true, po})} />;
            case 'jobs':
                return <JobsView onEditJob={commonProps.onEditJob} onSmartCreateClick={() => { setters.setSmartCreateMode('job'); setters.setIsSmartCreateOpen(true); }} />;
            case 'estimates':
                return <EstimatesView onOpenEstimateModal={(est) => setters.setEstimateFormModal({isOpen: true, estimate: est})} onViewEstimate={(est) => setters.setEstimateViewModal({isOpen: true, estimate: est})} onSmartCreateClick={() => { setters.setSmartCreateMode('estimate'); setters.setIsSmartCreateOpen(true); }} onScheduleEstimate={(est, inquiryId) => setters.setScheduleJobFromEstimateModal({isOpen: true, estimate: est, inquiryId})} />;
            case 'invoices':
                return <InvoicesView onViewInvoice={(inv) => setters.setViewInvoiceModal({isOpen: true, invoice: inv})} onEditInvoice={(inv) => setters.setInvoiceFormModal({isOpen: true, invoice: inv})} onOpenExportModal={(type, items) => setters.setExportModal({isOpen: true, type: type as any, items})} onCreateAdhocInvoice={() => setters.setInvoiceFormModal({isOpen: true, job: null, invoice: null })} onViewAgedDebtors={() => setCurrentView('aged-debtors')} />;
            case 'purchaseOrders':
                return <PurchaseOrdersView onOpenPurchaseOrderModal={(po) => setters.setPoModal({isOpen: true, po})} onViewPurchaseOrder={(po) => setters.setViewPoModal({isOpen: true, po})} onExport={(data, type) => setters.setExportModal({isOpen: true, type: type as any, items: data})} onOpenBatchAddModal={() => setters.setBatchPoModalOpen(true)} onOpenBatchUpdateRefModal={() => setters.setBatchUpdatePoRefModalOpen(true)} />;
            case 'sales':
                return <SalesView entity={businessEntities.find(e => e.id === selectedEntityId) || businessEntities[0]} onManageSaleVehicle={(sv) => setters.setManageSaleVehicleModal({isOpen: true, saleVehicle: sv})} onAddSaleVehicle={() => setters.setAddSaleVehicleModalOpen(true)} onGenerateReport={() => setters.setSalesReportModal(true)} onAddProspect={() => setters.setProspectModal({isOpen: true, prospect: null})} onEditProspect={(p) => setters.setProspectModal({isOpen: true, prospect: p})} onViewCustomer={(id) => setters.setCustomerModal({isOpen: true, customerId: id})} onPrintProspects={() => setters.setProspectsReportModal(true)} />;
            case 'storage':
                return <StorageView entity={businessEntities.find(e => e.id === selectedEntityId)!} onSaveBooking={(b) => handleSaveItem(setStorageBookings, b as any, 'brooks_storageBookings')} onBookOutVehicle={(id) => { const b = (storageBookings || []).find(sb => sb.id === id); if(b) setters.setCheckOutJob({id: `temp_job_${id}`, vehicleId: b.vehicleId, customerId: b.customerId } as any) }} onViewInvoice={(inv) => setters.setViewInvoiceModal({isOpen: true, invoice: (invoices || []).find(i => i.id === inv) || null})} onAddCustomerAndVehicle={(c, v) => { handleSaveItem(setCustomers, c, 'brooks_customers'); handleSaveItem(setVehicles, v, 'brooks_vehicles'); }} onSaveInvoice={(inv) => handleSaveItem(setInvoices, inv as any, 'brooks_invoices')} setConfirmation={setConfirmation} setViewedInvoice={(inv) => setters.setViewInvoiceModal({isOpen: true, invoice: inv})} />;
            case 'rentals':
                return <RentalsView entity={businessEntities.find(e => e.id === selectedEntityId)!} onOpenRentalBooking={(b) => setters.setRentalBookingModal({isOpen: true, booking: b})} />;
            case 'concierge':
                return <ConciergeView onEditJob={commonProps.onEditJob} onCheckIn={(id) => setters.setCheckInJob((jobs || []).find(j => j.id === id) || null)} onOpenPurchaseOrder={(po) => setters.setPoModal({isOpen: true, po})} onOpenAssistant={commonProps.onOpenAssistant} onGenerateInvoice={handleGenerateInvoice} onCollect={(id) => setters.setCheckOutJob((jobs || []).find(j => j.id === id) || null)} onQcApprove={commonProps.onQcApprove} onStartWork={commonProps.onStartWork} onEngineerComplete={commonProps.onEngineerComplete} onPause={(id, segId) => workshopActions.handleUpdateSegmentStatus(id, segId, 'Paused')} onRestart={commonProps.onRestart} />;
            case 'communications':
                return <CommunicationsView />;
            case 'aged-debtors':
            case 'financials':
                return <FinancialReporting />;
            case 'inquiries':
                return <InquiriesView onOpenInquiryModal={(inq) => setters.setInquiryModal({isOpen: true, inquiry: inq})} onConvert={(inq) => {}} onViewEstimate={(est) => setters.setEstimateViewModal({isOpen: true, estimate: est})} onScheduleEstimate={(est, inquiryId) => setters.setScheduleJobFromEstimateModal({isOpen: true, estimate: est, inquiryId})} onOpenPurchaseOrder={(po) => setters.setPoModal({isOpen: true, po})} onEditEstimate={(est) => setters.setEstimateFormModal({isOpen: true, estimate: est})} onMergeEstimate={workshopActions.handleMergeEstimateToJob} />;
            case 'absence':
                return <AbsenceView currentUser={currentUser} users={users} absenceRequests={absenceRequests} setAbsenceRequests={setAbsenceRequests} />;
            default:
                return <DashboardView {...commonProps} onCheckIn={(id) => setters.setCheckInJob((jobs || []).find(j => j.id === id) || null)} onOpenInquiry={(inq) => setters.setInquiryModal({isOpen: true, inquiry: inq})} />;
        }
    };

    return (
        <Router>
            <VersionChecker />
            <MainLayout onOpenManagement={() => setIsManagementOpen(true)} onOpenHelpCentre={() => setIsHelpCentreOpen(true)} onSearchResult={handleSearchResult}>
                <Suspense fallback={
                    <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-slate-600 dark:text-slate-400 font-medium animate-pulse text-sm">Loading module...</p>
                        </div>
                    </div>
                }>
                    {renderCurrentView()}
                </Suspense>
                <AppModals modals={modalsState} setters={setters} actions={modalActions} commonProps={commonProps} />
                <CoBrowsingController modals={modalsState} setters={setters} />
                {isManagementOpen && (
                    <ManagementModal 
                        isOpen={isManagementOpen} 
                        onClose={() => setIsManagementOpen(false)} 
                        initialView={managementInitialView} 
                        selectedEntityId={selectedEntityId} 
                        onViewJob={(id) => { setIsManagementOpen(false); setters.setSelectedJobId(id); setters.setIsEditJobModalOpen(true); }}
                        onViewEstimate={(est) => { setIsManagementOpen(false); setters.setEstimateViewModal({isOpen: true, estimate: est}); }}
                        onViewCustomer={handleViewCustomerFromManagement}
                        onViewVehicle={(id) => { setIsManagementOpen(false); setters.setVehicleModal({ isOpen: true, vehicleId: id }); }}
                        onViewInvoice={(inv) => { setIsManagementOpen(false); setters.setViewInvoiceModal({ isOpen: true, invoice: inv }); }}
                        onOpenPurchaseOrder={(po) => { setIsManagementOpen(false); setters.setViewPoModal({ isOpen: true, po }); }}
                        backupSchedule={backupSchedule}
                        setBackupSchedule={setBackupSchedule}
                        onManualBackup={handleManualBackup}
                        onCloudSnapshot={handleCloudSnapshot}
                        onRestoreFromSnapshot={handleRestoreFromSnapshot}
                    />
                )}
                 <HelpCentre open={isHelpCentreOpen} onClose={() => setIsHelpCentreOpen(false)} />
                <ToastContainer aria-label="Notifications" />
            </MainLayout>
        </Router>
    );
};

export default App;