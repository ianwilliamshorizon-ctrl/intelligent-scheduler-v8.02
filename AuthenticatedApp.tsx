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
import VersionChecker from './components/VersionChecker';
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

const AuthenticatedApp = () => {
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


        const handleSaveItem = workshopActions.handleSaveItem;
    const handleDeleteItem = <Type extends { id: string }>(setter: React.Dispatch<React.SetStateAction<Type[]>>, id: string) => {
        if(confirm('Are you sure you want to delete this item?')) {
            setter(prev => prev.filter(i => i.id !== id));
        }
    };

    

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
        // We open the specific customer detail view without closing the management modal
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
                return <JobsView onEditJob={commonProps.onEditJob} onCheckIn={(id) => setters.setCheckInJob((jobs || []).find(j => j.id === id) || null)} onOpenPurchaseOrder={(po) => setters.setPoModal({isOpen: true, po})} onSmartCreateClick={() => { setters.setSmartCreateMode('job'); setters.setIsSmartCreateOpen(true); }} onOpenInquiry={(inq) => setters.setInquiryModal({isOpen: true, inquiry: inq})} />;
            case 'estimates':
                return <EstimatesView onOpenEstimateModal={(est) => setters.setEstimateFormModal({isOpen: true, estimate: est})} onViewEstimate={(est) => setters.setEstimateViewModal({isOpen: true, estimate: est})} onSmartCreateClick={() => { setters.setSmartCreateMode('estimate'); setters.setIsSmartCreateOpen(true); }} onScheduleEstimate={(est, inquiryId) => setters.setScheduleJobFromEstimateModal({isOpen: true, estimate: est, inquiryId})} onCreateInquiry={(est) => {
                    const existingInquiry = (inquiries || []).find(inq => inq.linkedEstimateId === est.id && !['Closed', 'Rejected'].includes(inq.status || ''));
                    if (existingInquiry) {
                        setters.setInquiryModal({ isOpen: true, inquiry: existingInquiry });
                    } else {
                        setters.setInquiryModal({isOpen: true, inquiry: { entityId: est.entityId, linkedEstimateId: est.id, linkedCustomerId: est.customerId, linkedVehicleId: est.vehicleId, message: `Question regarding Estimate #${est.estimateNumber}` }});
                    }
                }} />;
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
                return <ConciergeView onEditJob={commonProps.onEditJob} onCheckIn={(id) => setters.setCheckInJob((jobs || []).find(j => j.id === id) || null)} onOpenPurchaseOrder={(po) => setters.setPoModal({isOpen: true, po})} onOpenAssistant={commonProps.onOpenAssistant} onGenerateInvoice={handleGenerateInvoice} onCollect={(id) => setters.setCheckOutJob((jobs || []).find(j => j.id === id) || null)} onQcApprove={commonProps.onQcApprove} onStartWork={commonProps.onStartWork} onEngineerComplete={commonProps.onEngineerComplete} onPause={(id, segId) => workshopActions.handleUpdateSegmentStatus(id, segId, 'Paused')} onRestart={commonProps.onRestart} onEditEstimate={(est) => setters.setEstimateFormModal({isOpen: true, estimate: est})} onOpenInquiry={(inq) => setters.setInquiryModal({isOpen: true, inquiry: inq})} />;
            case 'communications':
                return <CommunicationsView />;
            case 'aged-debtors':
            case 'financials':
                return <FinancialReporting />;
            case 'inquiries':
                return <InquiriesView 
                    onOpenInquiryModal={(inq) => setters.setInquiryModal({isOpen: true, inquiry: inq})} 
                    onConvert={(inq) => setters.setLinkEstimateModal({isOpen: true, inquiry: inq})} 
                    onViewEstimate={(est) => setters.setEstimateViewModal({isOpen: true, estimate: est})} 
                    onScheduleEstimate={(est, inquiryId) => setters.setScheduleJobFromEstimateModal({isOpen: true, estimate: est, inquiryId})} 
                    onOpenPurchaseOrder={(po) => setters.setPoModal({isOpen: true, po})} 
                    onEditEstimate={(est) => setters.setEstimateFormModal({isOpen: true, estimate: est})} 
                    onMergeEstimate={workshopActions.handleMergeEstimateToJob} 
                    onViewCustomer={(customerId) => setters.setCustomerModal({isOpen: true, customerId})}
                    onViewVehicle={(vehicleId) => setters.setVehicleModal({isOpen: true, vehicleId})}
                />;
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
                        onViewJob={(id) => { setters.setSelectedJobId(id); setters.setIsEditJobModalOpen(true); }}
                        onViewEstimate={(est) => { setters.setEstimateViewModal({isOpen: true, estimate: est}); }}
                        onViewCustomer={handleViewCustomerFromManagement}
                        onViewVehicle={(id) => { setters.setVehicleModal({ isOpen: true, vehicleId: id }); }}
                        onViewInvoice={(inv) => { setters.setViewInvoiceModal({ isOpen: true, invoice: inv }); }}
                        onOpenPurchaseOrder={(po) => { setters.setViewPoModal({ isOpen: true, po }); }}
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

export default AuthenticatedApp;