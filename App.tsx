import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as T from './types';
import { useData } from './core/state/DataContext';
import { useApp } from './core/state/AppContext';
import { createBackup, downloadBackup } from './core/utils/backupUtils';
import { setItem } from './core/db';
import { getCustomerDisplayName } from './core/utils/customerUtils';
import { formatDate } from './core/utils/dateUtils';
import { useWorkshopActions } from './core/hooks/useWorkshopActions';
import { useModalState } from './core/hooks/useModalState';

// Layout
import MainLayout from './components/MainLayout';
import AppModals from './components/AppModals';

// Views
import DashboardView from './components/DashboardView';
import DispatchView from './modules/workshop/DispatchView';
import WorkflowView from './components/WorkflowView';
import JobsView from './modules/workshop/JobsView';
import EstimatesView from './modules/workshop/EstimatesView';
import InvoicesView from './modules/workshop/InvoicesView';
import PurchaseOrdersView from './modules/workshop/PurchaseOrdersView';
import SalesView from './components/SalesView';
import StorageView from './components/StorageView';
import RentalsView from './components/RentalsView';
import ConciergeView from './components/ConciergeView';
import CommunicationsView from './components/CommunicationsView';
import AbsenceView from './components/AbsenceView';
import InquiriesView from './components/InquiriesView';

// Modals managed here (others moved to AppModals)
import ManagementModal from './components/ManagementModal';
import LoginView from './components/LoginView';

const App = () => {
    const { 
        currentView, currentUser, 
        selectedEntityId, setSelectedEntityId, // Ensure your context provides this setter
        confirmation, setConfirmation,
        users, isAuthenticated, login,
        backupSchedule, setBackupSchedule, appEnvironment
    } = useApp();

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
        setCustomers, setVehicles
    } = data;

    // --- Modal State Management ---
    const [modalsState, setters] = useModalState();
    const [isManagementOpen, setIsManagementOpen] = useState(false);
    const [managementInitialView, setManagementInitialView] = useState<{ tab: string; id: string } | null>(null);
    
    // Business Logic Hooks
    const workshopActions = useWorkshopActions();

    // --- Automated Backup Logic ---
    const lastBackupTimeRef = useRef<string | null>(null);

    // --- DATA INITIALIZATION FIX ---
    // This effect ensures that on first load, if no entity is selected, 
    // it automatically picks the first available one so the dashboard isn't blank.
    useEffect(() => {
        if (isAuthenticated && businessEntities.length > 0) {
            if (!selectedEntityId || selectedEntityId === 'all') {
                // If your useApp hook provides a setter, we use it to initialize the app state
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
    }, [
        jobs, vehicles, customers, estimates, invoices, purchaseOrders, 
        purchases, parts, servicePackages, suppliers, engineers, lifts,
        rentalVehicles, rentalBookings, saleVehicles, saleOverheadPackages,
        prospects, storageBookings, storageLocations, batteryChargers,
        nominalCodes, nominalCodeRules, absenceRequests, inquiries, 
        reminders, auditLog, businessEntities, taxRates, roles, inspectionDiagrams, users
    ]);

    const handleManualBackup = useCallback(() => {
        const backupData = createBackup(getFullStateData());
        downloadBackup(backupData);
    }, [getFullStateData]);

    const handleAutoBackup = useCallback(async () => {
        const backupData = createBackup(getFullStateData());
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        try {
            await setItem(`backup_auto_${timestamp}`, backupData);
            console.log(`Auto-backup successful: backup_auto_${timestamp}`);
            setConfirmation({
                isOpen: true,
                title: 'Automated Backup',
                message: 'A scheduled system backup has been successfully saved to the cloud database.',
                type: 'success'
            });
        } catch (e) {
            console.error("Auto-backup failed", e);
        }
    }, [getFullStateData, setConfirmation]);

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
                setters.setVehicleHistoryModal({ isOpen: true, vehicleId: customEvent.detail.vehicleId });
            }
        };

        window.addEventListener('open-vehicle-history-report', handlePrintRequest);
        return () => window.removeEventListener('open-vehicle-history-report', handlePrintRequest);
    }, [setters]);

    if (!isAuthenticated) {
        return <LoginView users={users} onLogin={login} environment={appEnvironment} />;
    }

    const handleSaveItem = workshopActions.handleSaveItem;
    const handleDeleteItem = <Type extends { id: string }>(setter: React.Dispatch<React.SetStateAction<Type[]>>, id: string) => {
        if(confirm('Are you sure you want to delete this item?')) {
            setter(prev => prev.filter(i => i.id !== id));
        }
    };

    const handleCustomerApproveEstimate = (estimate: T.Estimate, selectedOptionalItemIds: string[], dateRange: any, notes: string) => {
        if (estimate.jobId) { workshopActions.handleApproveEstimate(estimate, selectedOptionalItemIds, notes); return; }
        const customer = customers.find(c => c.id === estimate.customerId);
        const selectedOptionsList = (estimate.lineItems || []).filter(item => item.isOptional && selectedOptionalItemIds.includes(item.id)).map(item => `- ${item.description} (${(item.unitPrice * item.quantity).toFixed(2)})`).join('\n');
        const inquiryMessage = `ONLINE APPROVAL: Estimate #${estimate.estimateNumber}\n\n` + `Preferred Dates: ${dateRange?.start ? formatDate(new Date(dateRange.start)) : 'N/A'} to ${dateRange?.end ? formatDate(new Date(dateRange.end)) : 'N/A'}\n` + `Customer Notes: ${notes || 'None'}\n\n` + (selectedOptionsList ? `Selected Optional Extras:\n${selectedOptionsList}` : `No optional extras selected.`);
        const existingInquiry = inquiries.find(i => i.linkedEstimateId === estimate.id);
        if (existingInquiry) {
            const updatedInquiry = { ...existingInquiry, status: 'Approved' as const, message: existingInquiry.message + '\n\n' + inquiryMessage, actionNotes: (existingInquiry.actionNotes || '') + '\n[System]: Customer Approved Online. Action Required.' };
            handleSaveItem(setInquiries, updatedInquiry);
        } else {
            const newInquiry: T.Inquiry = { id: crypto.randomUUID(), entityId: estimate.entityId, createdAt: new Date().toISOString(), fromName: getCustomerDisplayName(customer), fromContact: customer?.email || customer?.mobile || "Client Portal", message: inquiryMessage, takenByUserId: 'system', status: 'Approved', linkedCustomerId: estimate.customerId, linkedVehicleId: estimate.vehicleId, linkedEstimateId: estimate.id, actionNotes: 'Auto-generated from Customer Estimate Approval. Please review dates and convert to Job.' };
            handleSaveItem(setInquiries, newInquiry);
        }
        const updatedEstimate: T.Estimate = { ...estimate, status: 'Approved' };
        handleSaveItem(setEstimates, updatedEstimate);
        setConfirmation({ isOpen: true, title: 'Request Received', message: 'Thank you. We have received your approval and preferred dates. A member of our team will review the schedule and confirm your booking shortly.', type: 'success' });
    };

    const handleCustomerDeclineEstimate = (estimate: T.Estimate) => {
        const updatedEstimate: T.Estimate = { ...estimate, status: 'Declined' };
        handleSaveItem(setEstimates, updatedEstimate);
        workshopActions.updateLinkedInquiryStatus(estimate.id, 'Rejected');
        setConfirmation({ isOpen: true, title: 'Estimate Declined', message: 'You have declined this estimate. We have been notified.', type: 'warning' });
    };

    const handleGenerateInvoice = (jobId: string) => {
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        let aggregatedLineItems: T.EstimateLineItem[] = [];
        const linkedEstimates = estimates.filter(e => 
            (e.jobId === job.id || e.id === job.estimateId) && 
            ['Approved', 'Converted to Job', 'Closed'].includes(e.status)
        );

        linkedEstimates.forEach(est => {
            if (est.lineItems) {
                const items = est.lineItems.map(item => ({ ...item, id: crypto.randomUUID() }));
                aggregatedLineItems = [...aggregatedLineItems, ...items];
            }
        });

        const newInvoice: Partial<T.Invoice> = {
            entityId: job.entityId, 
            customerId: job.customerId, 
            vehicleId: job.vehicleId, 
            jobId: job.id,
            issueDate: formatDate(new Date()), 
            dueDate: formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), 
            status: 'Draft', 
            lineItems: aggregatedLineItems, 
            createdByUserId: currentUser.id
        };
        setters.setInvoiceFormModal({ isOpen: true, invoice: newInvoice as T.Invoice });
    };

    const handleMarkJobAsAwaitingCollection = (jobId: string) => {
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, vehicleStatus: 'Awaiting Collection' } : j));
    };
    
    const handleSearchResult = (type: 'customer' | 'vehicle', id: string) => {
        if (type === 'customer') {
            setters.setCustomerModal({ isOpen: true, customerId: id });
        } else if (type === 'vehicle') {
            setters.setVehicleModal({ isOpen: true, vehicleId: id });
        }
    };

    const commonProps = {
        onStartWork: (jobId: string, segmentId: string) => workshopActions.handleUpdateSegmentStatus(jobId, segmentId, 'In Progress'),
        onPause: (id: string, segId: string) => workshopActions.handleUpdateSegmentStatus(id, segId, 'Paused'),
        onRestartWork: (jobId: string, segmentId: string) => workshopActions.handleUpdateSegmentStatus(jobId, segmentId, 'In Progress'),
        onRestart: (jobId: string, segmentId: string) => workshopActions.handleUpdateSegmentStatus(jobId, segmentId, 'In Progress'),
        onEngineerComplete: (job: T.Job, segmentId: string) => workshopActions.handleUpdateSegmentStatus(job.id, segmentId, 'Engineer Complete', { engineerCompletedAt: new Date().toISOString() }),
        onQcApprove: workshopActions.handleQcApprove,
        onOpenAssistant: (id: string) => { setters.setAssistantContextJobId(id); setters.setIsAssistantOpen(true); },
        onEditJob: (id: string) => { setters.setSelectedJobId(id); setters.setIsEditJobModalOpen(true); },
    };

    const modalActions = {
        handleSaveItem,
        setCustomers,
        setVehicles,
        handleSavePurchaseOrder: workshopActions.handleSavePurchaseOrder,
        handleSaveEstimate: workshopActions.handleSaveEstimate,
        handleApproveEstimate: workshopActions.handleApproveEstimate,
        handleCustomerApproveEstimate,
        handleCustomerDeclineEstimate,
        updateLinkedInquiryStatus: workshopActions.updateLinkedInquiryStatus,
        handleMarkJobAsAwaitingCollection,
        handleDeleteJob: workshopActions.handleDeleteJob
    };

    return (
        <MainLayout onOpenManagement={() => setIsManagementOpen(true)} onSearchResult={handleSearchResult}>
            {currentView === 'dashboard' && <DashboardView {...commonProps} onCheckIn={(id) => setters.setCheckInJob(jobs.find(j => j.id === id) || null)} onOpenInquiry={(inq) => setters.setInquiryModal({isOpen: true, inquiry: inq})} />}
            {currentView === 'dispatch' && <DispatchView {...commonProps} setDefaultDateForModal={setters.setSmartCreateDefaultDate} setIsSmartCreateOpen={setters.setIsSmartCreateOpen} setSmartCreateMode={setters.setSmartCreateMode} setSelectedJobId={setters.setSelectedJobId} setIsEditModalOpen={setters.setIsEditJobModalOpen} onOpenPurchaseOrder={(po) => setters.setViewPoModal({isOpen: true, po})} onReassignEngineer={workshopActions.handleReassignEngineer} onCheckIn={(id) => setters.setCheckInJob(jobs.find(j => j.id === id) || null)} onUnscheduleSegment={workshopActions.handleUnscheduleSegment} />}
            {currentView === 'workflow' && <WorkflowView jobs={jobs} vehicles={vehicles} customers={customers} engineers={engineers} currentUser={currentUser} onQcApprove={commonProps.onQcApprove} onGenerateInvoice={handleGenerateInvoice} onEditJob={commonProps.onEditJob} onStartWork={commonProps.onStartWork} onEngineerComplete={commonProps.onEngineerComplete} onPause={(id, segId) => workshopActions.handleUpdateSegmentStatus(id, segId, 'Paused')} onRestart={commonProps.onRestart} onOpenAssistant={commonProps.onOpenAssistant} onOpenPurchaseOrder={(po) => setters.setViewPoModal({isOpen: true, po})} />}
            {currentView === 'jobs' && <JobsView onEditJob={commonProps.onEditJob} onSmartCreateClick={() => { setters.setSmartCreateMode('job'); setters.setIsSmartCreateOpen(true); }} />}
            {currentView === 'estimates' && <EstimatesView onOpenEstimateModal={(est) => setters.setEstimateFormModal({isOpen: true, estimate: est})} onViewEstimate={(est) => setters.setEstimateViewModal({isOpen: true, estimate: est})} onSmartCreateClick={() => { setters.setSmartCreateMode('estimate'); setters.setIsSmartCreateOpen(true); }} onScheduleEstimate={(est, inquiryId) => setters.setScheduleJobFromEstimateModal({isOpen: true, estimate: est, inquiryId})} />}
            {currentView === 'invoices' && <InvoicesView onViewInvoice={(inv) => setters.setViewInvoiceModal({isOpen: true, invoice: inv})} onEditInvoice={(inv) => setters.setInvoiceFormModal({isOpen: true, invoice: inv})} onOpenExportModal={(type, items) => setters.setExportModal({isOpen: true, type: type as any, items})} onCreateAdhocInvoice={() => setters.setInvoiceFormModal({isOpen: true, invoice: null})} />}
            {currentView === 'purchaseOrders' && <PurchaseOrdersView onOpenPurchaseOrderModal={(po) => setters.setPoModal({isOpen: true, po})} onDeletePurchaseOrder={(id) => handleDeleteItem(setPurchaseOrders, id)} onViewPurchaseOrder={(po) => setters.setViewPoModal({isOpen: true, po})} onExport={(data, filename) => { /* export logic */ }} onOpenBatchAddModal={() => setters.setBatchPoModalOpen(true)} />}
            {currentView === 'sales' && <SalesView entity={businessEntities.find(e => e.id === selectedEntityId) || businessEntities[0]} onManageSaleVehicle={(sv) => setters.setManageSaleVehicleModal({isOpen: true, saleVehicle: sv})} onAddSaleVehicle={() => setters.setAddSaleVehicleModalOpen(true)} onGenerateReport={() => setters.setSalesReportModal(true)} onAddProspect={() => setters.setProspectModal({isOpen: true, prospect: null})} onEditProspect={(p) => setters.setProspectModal({isOpen: true, prospect: p})} onViewCustomer={(id) => setters.setCustomerModal({isOpen: true, customerId: id})} />}
            {currentView === 'storage' && <StorageView entity={businessEntities.find(e => e.id === selectedEntityId)!} onSaveBooking={(b) => handleSaveItem(setStorageBookings, b, 'brooks_storageBookings')} onBookOutVehicle={(id) => { const b = storageBookings.find(sb => sb.id === id); if(b) setters.setCheckOutJob({id: `temp_job_${id}`, vehicleId: b.vehicleId, customerId: b.customerId } as any) }} onViewInvoice={(id) => setters.setViewInvoiceModal({isOpen: true, invoice: invoices.find(i => i.id === id) || null})} onAddCustomerAndVehicle={(c, v) => { handleSaveItem(data.setCustomers, c, 'brooks_customers'); handleSaveItem(data.setVehicles, v, 'brooks_vehicles'); }} onSaveInvoice={(inv) => handleSaveItem(setInvoices, inv, 'brooks_invoices')} setConfirmation={setConfirmation} setViewedInvoice={(inv) => setters.setViewInvoiceModal({isOpen: true, invoice: inv})} />}
            {currentView === 'rentals' && <RentalsView entity={businessEntities.find(e => e.id === selectedEntityId)!} onOpenRentalBooking={(b) => setters.setRentalBookingModal({isOpen: true, booking: b})} />}
            {currentView === 'concierge' && <ConciergeView onEditJob={commonProps.onEditJob} onCheckIn={(id) => setters.setCheckInJob(jobs.find(j => j.id === id) || null)} onOpenPurchaseOrder={(po) => setters.setViewPoModal({isOpen: true, po})} onOpenAssistant={commonProps.onOpenAssistant} onGenerateInvoice={handleGenerateInvoice} onCollect={(id) => setters.setCheckOutJob(jobs.find(j => j.id === id) || null)} onQcApprove={commonProps.onQcApprove} onStartWork={commonProps.onStartWork} onEngineerComplete={commonProps.onEngineerComplete} onPause={(id, segId) => workshopActions.handleUpdateSegmentStatus(id, segId, 'Paused')} onRestart={commonProps.onRestart} />}
            {currentView === 'communications' && <CommunicationsView />}
            {currentView === 'inquiries' && <InquiriesView onOpenInquiryModal={(inq) => setters.setInquiryModal({isOpen: true, inquiry: inq})} onConvert={(inq) => {}} onViewEstimate={(est) => setters.setEstimateViewModal({isOpen: true, estimate: est})} onScheduleEstimate={(est, inquiryId) => setters.setScheduleJobFromEstimateModal({isOpen: true, estimate: est, inquiryId})} onOpenPurchaseOrder={(po) => setters.setViewPoModal({isOpen: true, po})} onEditEstimate={(est) => setters.setEstimateFormModal({isOpen: true, estimate: est})} onMergeEstimate={workshopActions.handleMergeEstimateToJob} />}
            {currentView === 'absence' && <AbsenceView currentUser={currentUser} users={users} absenceRequests={absenceRequests} setAbsenceRequests={setAbsenceRequests} />}

            <AppModals modals={modalsState} setters={setters} actions={modalActions} />

            {isManagementOpen && (
                <ManagementModal 
                    isOpen={isManagementOpen} 
                    onClose={() => setIsManagementOpen(false)} 
                    initialView={managementInitialView} 
                    selectedEntityId={selectedEntityId} 
                    onViewJob={(id) => { setIsManagementOpen(false); setters.setSelectedJobId(id); setters.setIsEditJobModalOpen(true); }}
                    onViewEstimate={(est) => { setIsManagementOpen(false); setters.setEstimateViewModal({isOpen: true, estimate: est}); }}
                    backupSchedule={backupSchedule}
                    setBackupSchedule={setBackupSchedule}
                    onManualBackup={handleManualBackup}
                />
            )}
        </MainLayout>
    );
};

export default App;