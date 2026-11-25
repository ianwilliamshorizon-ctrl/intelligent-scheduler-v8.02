import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as T from './types';
import { useData } from './core/state/DataContext';
import { useApp } from './core/state/AppContext';
import { createBackup, downloadBackup } from './core/utils/backupUtils';
import { setItem, getItem, uploadToStorage, downloadFromStorage, getDocument } from './core/db';
import { idbSet, idbGet } from './core/db/idb';
import { getCustomerDisplayName } from './core/utils/customerUtils';
import { formatDate, dateStringToDate } from './core/utils/dateUtils';
import { calculateJobPartsStatus } from './core/utils/jobUtils';
import useModalState from './core/hooks/useModalState';
import { useWorkshopActions } from './core/hooks/useWorkshopActions';
import { getEstimateDriftSummary, recordEstimateSentVersion, createEstimateOverrideRecord, formatEstimateChangeNotice, EstimateDriftSummary } from './core/utils/estimateVersioning';
import { sendOutboundEmail } from './core/services/emailService';
import { CheckCircle2, XCircle, AlertTriangle, Send, ShieldCheck } from 'lucide-react';

// Layout & Core Components
import MainLayout from './components/MainLayout';
import AppModals from './components/AppModals';
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
const MobileAppShell = lazy(() => import('./components/mobile/MobileAppShell'));

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
    const [isMobileMode, setIsMobileMode] = useState<boolean>(() => {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('mode') === 'mobile' || searchParams.get('source') === 'pwa') return true;
        const stored = sessionStorage.getItem('brookspeed_mobile_mode');
        if (stored !== null) return stored === 'true';
        return window.innerWidth < 768;
    });

    const handleToggleMobileMode = (val?: boolean) => {
        setIsMobileMode(prev => {
            const next = val !== undefined ? val : !prev;
            sessionStorage.setItem('brookspeed_mobile_mode', String(next));
            return next;
        });
    };

    const [invoiceDriftModal, setInvoiceDriftModal] = useState<{
        job: T.Job;
        estimate: T.Estimate;
        drift: EstimateDriftSummary;
        emailBody: string;
        overrideReason: string;
        isBusy: boolean;
    } | null>(null);

    const proceedToInvoiceForm = (job: T.Job, linkedEstimate?: T.Estimate) => {
        const jobPurchaseOrders = (purchaseOrders || []).filter(po => po.jobId === job.id || (job.purchaseOrderIds || []).includes(po.id));
        const currentPartsStatus = calculateJobPartsStatus(linkedEstimate || null, jobPurchaseOrders);

        const isReconciled = currentPartsStatus === 'Fully Received' || currentPartsStatus === 'Not Required';
        if (!isReconciled && currentPartsStatus !== 'No Parts Required') {
            toast.info(`Preparing invoice for Job #${job.id} (Parts status: ${currentPartsStatus}).`);
        }

        setters.setInvoiceFormModal({ isOpen: true, job });
    };

    const handleGenerateInvoice = (jobId: string) => {
        const job = (jobs || []).find(j => j.id === jobId);
        if (!job) return;

        const linkedEstimate = (estimates || []).find(e => e.id === job.estimateId || e.jobId === job.id);
        if (linkedEstimate) {
            const drift = getEstimateDriftSummary(linkedEstimate, taxRates || []);
            if (drift.hasDrift) {
                setInvoiceDriftModal({
                    job,
                    estimate: linkedEstimate,
                    drift,
                    emailBody: formatEstimateChangeNotice(linkedEstimate, drift),
                    overrideReason: '',
                    isBusy: false,
                });
                return;
            }
        }

        proceedToInvoiceForm(job, linkedEstimate);
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
            // Restore from Local IndexedDB, or fallback to legacy Firestore settings
            snapshot = (await idbGet(snapshotId)) || (await getItem(snapshotId));
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
                    onCreateInvoice={(job) => handleGenerateInvoice(job.id)}
                />;
            case 'workflow':
                const workflowJobs = (jobs || []).filter(j => selectedEntityId === 'all' || j.entityId === selectedEntityId);
                return <WorkflowView jobs={workflowJobs} vehicles={vehicles || []} customers={customers || []} engineers={engineers || []} currentUser={currentUser} onQcApprove={commonProps.onQcApprove} onGenerateInvoice={handleGenerateInvoice} onEditJob={commonProps.onEditJob} onStartWork={commonProps.onStartWork} onEngineerComplete={commonProps.onEngineerComplete} onPause={(id, segId) => workshopActions.handleUpdateSegmentStatus(id, segId, 'Paused')} onRestart={commonProps.onRestart} onOpenAssistant={commonProps.onOpenAssistant} onOpenPurchaseOrder={(po) => setters.setPoModal({isOpen: true, po})} />;
            case 'jobs':
                return <JobsView onEditJob={commonProps.onEditJob} onCheckIn={(id) => setters.setCheckInJob((jobs || []).find(j => j.id === id) || null)} onOpenPurchaseOrder={(po) => setters.setPoModal({isOpen: true, po})} onSmartCreateClick={() => { setters.setSmartCreateMode('job'); setters.setIsSmartCreateOpen(true); }} onOpenInquiry={(inq) => setters.setInquiryModal({isOpen: true, inquiry: inq})} onCreateInvoice={(job) => handleGenerateInvoice(job.id)} />;
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
                return <InvoicesView 
                    onViewInvoice={(inv) => {
                        if (inv.saleVehicleId) {
                            setters.setSalesInvoiceModal({ isOpen: true, invoice: inv });
                        } else {
                            setters.setViewInvoiceModal({ isOpen: true, invoice: inv });
                        }
                    }} 
                    onEditInvoice={(inv) => setters.setInvoiceFormModal({isOpen: true, invoice: inv, job: (jobs || []).find(j => j.id === inv.jobId) || null})} 
                    onOpenExportModal={(type, items) => setters.setExportModal({isOpen: true, type: type as any, items})} 
                    onCreateAdhocInvoice={() => setters.setInvoiceFormModal({isOpen: true, job: null, invoice: null })} 
                    onViewAgedDebtors={() => setCurrentView('aged-debtors')} 
                    onCheckOut={(inv) => {
                        const linkedJob = (jobs || []).find(j => j.id === inv.jobId || j.invoiceId === inv.id);
                        const targetJob: T.Job = linkedJob ? { ...linkedJob, invoiceId: inv.id } : {
                            id: inv.jobId || `INV-${inv.id}`,
                            invoiceId: inv.id,
                            vehicleId: inv.vehicleId,
                            customerId: inv.customerId,
                            description: `Invoice #${inv.id}`,
                            status: 'Invoiced',
                            entityId: inv.entityId
                        };
                        setters.setCheckOutJob(targetJob);
                    }}
                />;
            case 'purchaseOrders':
                return <PurchaseOrdersView onOpenPurchaseOrderModal={(po) => setters.setPoModal({isOpen: true, po})} onViewPurchaseOrder={(po) => setters.setViewPoModal({isOpen: true, po})} onExport={(data, type) => setters.setExportModal({isOpen: true, type: type as any, items: data})} onOpenBatchAddModal={() => setters.setBatchPoModalOpen(true)} onOpenBatchUpdateRefModal={() => setters.setBatchUpdatePoRefModalOpen(true)} />;
            case 'sales':
                return <SalesView entity={businessEntities.find(e => e.id === selectedEntityId) || businessEntities[0]} onManageSaleVehicle={(sv) => setters.setManageSaleVehicleModal({isOpen: true, saleVehicle: sv})} onAddSaleVehicle={() => setters.setAddSaleVehicleModalOpen(true)} onGenerateReport={() => setters.setSalesReportModal(true)} onAddProspect={() => setters.setProspectModal({isOpen: true, prospect: null})} onEditProspect={(p) => setters.setProspectModal({isOpen: true, prospect: p})} onViewCustomer={(id) => setters.setCustomerModal({isOpen: true, customerId: id})} onPrintProspects={() => setters.setProspectsReportModal(true)} />;
            case 'storage':
                return <StorageView entity={businessEntities.find(e => e.id === selectedEntityId)!} onSaveBooking={(b) => handleSaveItem(setStorageBookings, b as any, 'brooks_storageBookings')} onBookOutVehicle={(id) => { const b = (storageBookings || []).find(sb => sb.id === id); if(b) setters.setCheckOutJob({id: `temp_job_${id}`, vehicleId: b.vehicleId, customerId: b.customerId } as any) }} onViewInvoice={(inv) => setters.setViewInvoiceModal({isOpen: true, invoice: (invoices || []).find(i => i.id === inv) || null})} onAddCustomerAndVehicle={(c, v) => { handleSaveItem(setCustomers, c, 'brooks_customers'); handleSaveItem(setVehicles, v, 'brooks_vehicles'); }} onSaveInvoice={(inv) => handleSaveItem(setInvoices, inv as any, 'brooks_invoices')} setConfirmation={setConfirmation} setViewedInvoice={(inv) => setters.setViewInvoiceModal({isOpen: true, invoice: inv})} />;
            case 'rentals':
                return <RentalsView entity={businessEntities.find(e => e.id === selectedEntityId)!} onOpenRentalBooking={(b) => setters.setRentalBookingModal({isOpen: true, booking: b})} />;
            case 'concierge':
                return <ConciergeView 
                    onEditJob={commonProps.onEditJob} 
                    onCheckIn={(id) => setters.setCheckInJob((jobs || []).find(j => j.id === id) || null)} 
                    onOpenPurchaseOrder={(po) => setters.setPoModal({isOpen: true, po})} 
                    onOpenAssistant={commonProps.onOpenAssistant} 
                    onGenerateInvoice={handleGenerateInvoice} 
                    onCollect={(id) => setters.setCheckOutJob((jobs || []).find(j => j.id === id) || null)} 
                    onQcApprove={commonProps.onQcApprove} 
                    onStartWork={commonProps.onStartWork} 
                    onEngineerComplete={commonProps.onEngineerComplete} 
                    onPause={(id, segId) => workshopActions.handleUpdateSegmentStatus(id, segId, 'Paused')} 
                    onRestart={commonProps.onRestart} 
                    onEditEstimate={(est) => setters.setEstimateFormModal({isOpen: true, estimate: est})} 
                    onOpenInquiry={(inq) => setters.setInquiryModal({isOpen: true, inquiry: inq})} 
                    onRaiseEstimateForFinding={(finding, job) => {
                        setters.setEstimateFormModal({
                            isOpen: true,
                            estimate: {
                                jobId: job.id,
                                customerId: job.customerId,
                                vehicleId: job.vehicleId,
                                entityId: job.entityId,
                                status: 'Draft',
                                description: `Lift Finding: ${finding.category} - ${finding.itemLabel}`,
                                notes: `Urgent recommendation identified during vehicle lift inspection: ${finding.notes || ''}`,
                                lineItems: [
                                    {
                                        id: `item_${Date.now()}`,
                                        description: `${finding.category}: ${finding.itemLabel} - ${finding.notes || ''}`,
                                        quantity: finding.suggestedLabourHours || 1,
                                        unitPrice: 85,
                                        isLabor: true,
                                        partNumber: 'LABOUR'
                                    },
                                    ...(finding.suggestedParts ? [{
                                        id: `part_${Date.now()}`,
                                        description: finding.suggestedParts,
                                        quantity: 1,
                                        unitPrice: 0,
                                        isLabor: false,
                                        partNumber: 'PARTS'
                                    }] : [])
                                ]
                            }
                        });
                    }}
                    onRaiseEstimateFromAllFindings={(findings, job) => {
                        const lineItems: any[] = [];
                        findings.forEach((f, idx) => {
                            lineItems.push({
                                id: `item_labour_${Date.now()}_${idx}`,
                                description: `${f.category}: ${f.itemLabel} - ${f.notes || ''}`,
                                quantity: f.suggestedLabourHours || 1,
                                unitPrice: 85,
                                isLabor: true,
                                partNumber: 'LABOUR'
                            });
                            if (f.suggestedParts) {
                                lineItems.push({
                                    id: `item_part_${Date.now()}_${idx}`,
                                    description: `${f.category} Parts: ${f.suggestedParts}`,
                                    quantity: 1,
                                    unitPrice: 0,
                                    isLabor: false,
                                    partNumber: 'PARTS'
                                });
                            }
                        });

                        const summary = findings.map(f => `${f.category} (${f.severity === 'urgent' ? '🔴' : '🟡'})`).join(', ');

                        setters.setEstimateFormModal({
                            isOpen: true,
                            estimate: {
                                jobId: job.id,
                                customerId: job.customerId,
                                vehicleId: job.vehicleId,
                                entityId: job.entityId,
                                status: 'Draft',
                                description: `Lift Inspection Findings: ${summary}`,
                                notes: `Urgent safety & maintenance items identified during vehicle lift inspection:\n${findings.map(f => `• [${f.severity.toUpperCase()}] ${f.category} - ${f.itemLabel}: ${f.notes || ''}`).join('\n')}`,
                                lineItems
                            }
                        });
                    }}
                />;
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

    if (isMobileMode) {
        return (
            <Router>
                <div className="h-full w-full flex flex-col min-h-0 overflow-hidden bg-slate-950">
                    <Suspense fallback={
                        <div className="h-full w-full bg-slate-950 flex items-center justify-center text-white font-bold p-4">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-slate-400 text-xs font-semibold animate-pulse">Loading Mobile Stream...</p>
                            </div>
                        </div>
                    }>
                        <MobileAppShell
                            currentUser={currentUser}
                            jobs={jobs || []}
                            vehicles={vehicles || []}
                            customers={customers || []}
                            engineers={engineers || []}
                            invoices={invoices || []}
                            estimates={estimates || []}
                            inquiries={inquiries || []}
                            businessEntities={businessEntities || []}
                            selectedEntityId={selectedEntityId}
                            onSelectEntity={setSelectedEntityId}
                            inspectionTemplates={data.inspectionTemplates || []}
                            inspectionDiagrams={data.inspectionDiagrams || []}
                            onSaveJob={async (job) => {
                                await handleSaveItem(setJobs, job, 'brooks_jobs');
                            }}
                            onSwitchToDesktop={() => handleToggleMobileMode(false)}
                            onOpenInquiry={(inq) => setters.setInquiryModal({isOpen: true, inquiry: inq})}
                        />
                    </Suspense>
                    <AppModals modals={modalsState} setters={setters} actions={modalActions} commonProps={commonProps} />
                    <ToastContainer aria-label="Notifications" />
                </div>
            </Router>
        );
    }

    return (
        <Router>
            <MainLayout 
                onOpenManagement={() => setIsManagementOpen(true)} 
                onOpenHelpCentre={() => setIsHelpCentreOpen(true)} 
                onSearchResult={handleSearchResult}
                onOpenAssistant={() => { setters.setAssistantContextJobId(null); setters.setIsAssistantOpen(true); }}
                onOpenBookingAssistant={() => setters.setIsBookingAssistantOpen(true)}
                onToggleMobileMode={() => handleToggleMobileMode(true)}
            >
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
                {invoiceDriftModal && (() => {
                    const { job, estimate, drift, emailBody, overrideReason, isBusy } = invoiceDriftModal;
                    const customer = (customers || []).find(c => c.id === estimate.customerId || c.id === job.customerId);
                    const vehicle = (vehicles || []).find(v => v.id === estimate.vehicleId || v.id === job.vehicleId);
                    const entity = (businessEntities || []).find(e => e.id === estimate.entityId || e.id === job.entityId);
                    const deltaSign = drift.unexplainedDelta >= 0 ? '+' : '';

                    const handleSendChangeNoticeAndInvoice = async () => {
                        if (!customer?.email) {
                            toast.error('Customer has no email address on file. Use Verbal Authorization or update the customer record first.');
                            return;
                        }
                        setInvoiceDriftModal(prev => prev ? { ...prev, isBusy: true } : null);
                        try {
                            await sendOutboundEmail({
                                to: customer.email,
                                fromName: entity?.name || 'Brookspeed',
                                fromEmail: entity?.email || 'workshop@brookspeed.com',
                                subject: `Updated Estimate Notice #${estimate.estimateNumber} (${vehicle?.registration || 'Vehicle'})`,
                                body: emailBody,
                            });
                            const updatedEstimate = recordEstimateSentVersion(estimate, currentUser?.id, taxRates || []);
                            await data.saveRecord('estimates', updatedEstimate);
                            toast.success(`Change notice sent to ${customer.email}. Estimate bumped to v${updatedEstimate.version}.`);
                            setInvoiceDriftModal(null);
                            proceedToInvoiceForm(job, updatedEstimate);
                        } catch (err: any) {
                            toast.error(`Failed to send change notice: ${err?.message || 'Unknown error'}`);
                            setInvoiceDriftModal(prev => prev ? { ...prev, isBusy: false } : null);
                        }
                    };

                    const handleRecordVerbalOverrideAndInvoice = async (source: 'verbal_approval' | 'manual_override') => {
                        setInvoiceDriftModal(prev => prev ? { ...prev, isBusy: true } : null);
                        try {
                            const reason = overrideReason.trim() || (
                                source === 'verbal_approval'
                                    ? 'Client approved additional work verbally / at desk prior to invoicing'
                                    : 'Staff bypassed estimate drift warning at invoice creation'
                            );
                            const overrideRec = createEstimateOverrideRecord(
                                currentUser?.id || 'system',
                                source,
                                reason,
                                drift.unexplainedDelta
                            );
                            const updatedEstimate: T.Estimate = {
                                ...estimate,
                                authorizedOverrides: [...(estimate.authorizedOverrides || []), overrideRec],
                                hasUnnotifiedChanges: false,
                            };
                            await data.saveRecord('estimates', updatedEstimate);
                            if (source === 'manual_override') {
                                toast.warning('Invoiced with audit-logged staff override.');
                            } else {
                                toast.success('Client authorization recorded on estimate.');
                            }
                            setInvoiceDriftModal(null);
                            proceedToInvoiceForm(job, updatedEstimate);
                        } catch (err: any) {
                            toast.error(`Failed to save authorization: ${err?.message || 'Unknown error'}`);
                            setInvoiceDriftModal(prev => prev ? { ...prev, isBusy: false } : null);
                        }
                    };

                    return (
                        <div className="fixed inset-0 bg-gray-900/70 z-[90] flex justify-center items-center p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-amber-200">
                                <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5 text-amber-900">
                                        <AlertTriangle className="text-amber-600 shrink-0" size={22} />
                                        <div>
                                            <h3 className="font-bold text-base">Estimate Changed Since Last Sent (v{drift.currentVersion})</h3>
                                            <p className="text-xs text-amber-800">
                                                Estimate #{estimate.estimateNumber} • {vehicle?.registration || ''} • {customer ? `${customer.forename} ${customer.surname}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => !isBusy && setInvoiceDriftModal(null)}
                                        className="text-gray-500 hover:text-gray-800 text-sm font-semibold px-2 py-1"
                                        disabled={isBusy}
                                    >
                                        Cancel
                                    </button>
                                </div>

                                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-sm">
                                    <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg border text-center">
                                        <div>
                                            <div className="text-[11px] uppercase text-gray-500 font-semibold">Authorized Total</div>
                                            <div className="text-base font-bold text-gray-800">£{drift.authorizedTotalGross.toFixed(2)}</div>
                                            <div className="text-[11px] text-gray-500">
                                                Sent v{drift.currentVersion} (£{(drift.latestSent?.totalGross || 0).toFixed(2)})
                                                {drift.authorizedOverridesTotal !== 0 && ` + Overrides (£${drift.authorizedOverridesTotal.toFixed(2)})`}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] uppercase text-gray-500 font-semibold">Current Job / Est.</div>
                                            <div className="text-base font-bold text-indigo-700">£{drift.currentTotalGross.toFixed(2)}</div>
                                            <div className="text-[11px] text-gray-500">inc. VAT</div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] uppercase text-gray-500 font-semibold">Unnotified Drift</div>
                                            <div className={`text-base font-bold ${drift.unexplainedDelta > 0 ? 'text-red-600' : 'text-amber-700'}`}>
                                                {deltaSign}£{drift.unexplainedDelta.toFixed(2)}
                                            </div>
                                            <div className="text-[11px] text-gray-500">vs authorized</div>
                                        </div>
                                    </div>

                                    {(drift.diff.added.length > 0 || drift.diff.removed.length > 0 || drift.diff.modified.length > 0) && (
                                        <div className="border rounded-lg p-3 bg-white space-y-1.5 text-xs">
                                            <div className="font-semibold text-gray-700">Detected Line Changes:</div>
                                            {drift.diff.added.map((l, idx) => (
                                                <div key={`add-${idx}`} className="text-green-700">+ Added: {l.description} ({l.quantity} × £{Number(l.unitPrice || 0).toFixed(2)} net)</div>
                                            ))}
                                            {drift.diff.modified.map((m, idx) => (
                                                <div key={`mod-${idx}`} className="text-amber-800">~ Changed: {m.item.description} (Qty {m.prevQuantity}→{m.item.quantity}, Unit £{m.prevUnitPrice.toFixed(2)}→£{Number(m.item.unitPrice || 0).toFixed(2)})</div>
                                            ))}
                                            {drift.diff.removed.map((l, idx) => (
                                                <div key={`rem-${idx}`} className="text-red-700">- Removed: {l.description}</div>
                                            ))}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Client Change Notice Email Preview ({customer?.email || 'No email on file'}):
                                        </label>
                                        <textarea
                                            value={emailBody}
                                            onChange={e => setInvoiceDriftModal(prev => prev ? { ...prev, emailBody: e.target.value } : null)}
                                            rows={5}
                                            className="w-full p-2.5 border rounded-lg text-xs font-mono bg-gray-50 focus:bg-white"
                                            disabled={isBusy}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Check-In / Verbal Approval Note (optional, required for audit clarity if not emailing):
                                        </label>
                                        <input
                                            type="text"
                                            value={overrideReason}
                                            onChange={e => setInvoiceDriftModal(prev => prev ? { ...prev, overrideReason: e.target.value } : null)}
                                            placeholder="e.g. Client requested brake fluid flush at drop-off / approved by phone"
                                            className="w-full p-2 border rounded-lg text-xs"
                                            disabled={isBusy}
                                        />
                                    </div>
                                </div>

                                <div className="p-4 bg-gray-50 border-t flex flex-wrap justify-between items-center gap-2">
                                    <button
                                        onClick={() => handleRecordVerbalOverrideAndInvoice('manual_override')}
                                        disabled={isBusy}
                                        className="px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                                    >
                                        Override & Invoice Anyway
                                    </button>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => handleRecordVerbalOverrideAndInvoice('verbal_approval')}
                                            disabled={isBusy}
                                            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            <ShieldCheck size={15} /> Record Verbal / Check-In Approval
                                        </button>
                                        <button
                                            onClick={handleSendChangeNoticeAndInvoice}
                                            disabled={isBusy || !customer?.email}
                                            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            <Send size={15} /> {isBusy ? 'Sending...' : `Send Change Notice & Bump to v${drift.currentVersion + 1}`}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
                 <HelpCentre open={isHelpCentreOpen} onClose={() => setIsHelpCentreOpen(false)} />
                <ToastContainer aria-label="Notifications" />
            </MainLayout>
        </Router>
    );
};

export default AuthenticatedApp;