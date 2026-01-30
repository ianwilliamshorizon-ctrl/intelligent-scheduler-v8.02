import React, { useState } from 'react';
import * as T from './types';
import { useData } from './core/state/DataContext';
import { useApp } from './core/state/AppContext';
import { useWorkshopActions } from './core/hooks/useWorkshopActions';
import { useModalState } from './core/hooks/useModalState';
import { Building2 } from 'lucide-react';

import MainLayout from './components/MainLayout';
import AppModals from './components/AppModals';
import ManagementModal from './components/ManagementModal';
import LoginView from './components/LoginView';

import DashboardView from './components/DashboardView';
import DispatchView from './modules/workshop/DispatchView';
import WorkflowView from './components/WorkflowView';
import JobsView from './modules/workshop/JobsView';
import EstimatesView from './components/EstimatesView';
import InvoicesView from './components/InvoicesView';
import PurchaseOrdersView from './components/PurchaseOrdersView';
import SalesView from './components/SalesView';
import StorageView from './components/StorageView';
import RentalsView from './components/RentalsView';
import CommunicationsView from './components/CommunicationsView';
import AbsenceView from './components/AbsenceView';
import InquiriesView from './components/InquiriesView';
import ConciergeView from './components/ConciergeView';

const App = () => {
    const context = useApp();
    const data = useData() as any; 

    if (!context || !data) return null;

    const { 
        currentView, currentUser, selectedEntityId, 
        isAuthenticated, login, users = [], appEnvironment 
    } = context;

    const { 
        businessEntities = [], jobs = [], vehicles = [], customers = [],
        invoices = [], estimates = [], purchaseOrders = [], suppliers = [],
        taxRates = [], absenceRequests = []
    } = data;

    const [modalsState, setters] = useModalState();
    const [isManagementOpen, setIsManagementOpen] = useState(false);
    const workshopActions = useWorkshopActions();

    const currentEntity = businessEntities.find((e: any) => e.id === selectedEntityId);
    const isWorkshopView = currentEntity?.name.toLowerCase().includes('porsche') || 
                           currentEntity?.name.toLowerCase().includes('audi') || 
                           currentEntity?.name.toLowerCase().includes('trimming');

    if (!isAuthenticated) {
        return (
            <LoginView 
                users={users} 
                onLogin={async (u, p) => {
                    try {
                        await login(u, p);
                        return true; // Explicitly returning boolean to satisfy LoginViewProps
                    } catch (e) {
                        console.error("Login failed", e);
                        return false;
                    }
                }} 
                environment={appEnvironment as any} 
            />
        );
    }

    const commonProps = {
        onStartWork: (id: string, sId: string) => workshopActions.handleUpdateSegmentStatus(id, sId, 'In Progress'),
        onPause: (id: string, sId: string) => workshopActions.handleUpdateSegmentStatus(id, sId, 'Paused'),
        onRestartWork: (id: string, sId: string) => workshopActions.handleUpdateSegmentStatus(id, sId, 'In Progress'),
        onRestart: (id: string, sId: string) => workshopActions.handleUpdateSegmentStatus(id, sId, 'In Progress'),
        onEngineerComplete: (job: T.Job, sId: string) => workshopActions.handleUpdateSegmentStatus(job.id, sId, 'Engineer Complete'),
        onQcApprove: workshopActions.handleQcApprove,
        onOpenAssistant: (id: string) => { setters.setAssistantContextJobId(id); setters.setIsAssistantOpen(true); },
        onEditJob: (id: string) => { setters.setSelectedJobId(id); setters.setIsEditJobModalOpen(true); },
    };

    const renderView = () => {
        if (!isWorkshopView && currentView === 'dashboard') {
            return (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-white">
                    <Building2 size={64} className="mb-4 opacity-10" />
                    <p className="text-lg font-medium text-slate-500">Non-Workshop Entity Selected</p>
                    <p className="text-sm italic">Please select a mechanical workshop to view the dashboard.</p>
                </div>
            );
        }

        switch (currentView) {
            case 'dashboard': return <DashboardView {...commonProps} onCheckIn={() => {}} onOpenInquiry={() => {}} />;
            case 'dispatch': return <DispatchView {...commonProps} setDefaultDateForModal={setters.setSmartCreateDefaultDate} setIsSmartCreateOpen={setters.setIsSmartCreateOpen} setSmartCreateMode={setters.setSmartCreateMode} setSelectedJobId={setters.setSelectedJobId} setIsEditModalOpen={setters.setIsEditJobModalOpen} onOpenPurchaseOrder={(po) => setters.setViewPoModal({isOpen: true, po})} onReassignEngineer={workshopActions.handleReassignEngineer} onCheckIn={() => {}} onUnscheduleSegment={workshopActions.handleUnscheduleSegment} />;
            case 'workflow': return <WorkflowView jobs={jobs} vehicles={vehicles} customers={customers} engineers={data.engineers} currentUser={currentUser} onGenerateInvoice={() => {}} onOpenPurchaseOrder={(po) => setters.setViewPoModal({isOpen: true, po})} {...commonProps} />;
            case 'jobs': return <JobsView onEditJob={(id) => { setters.setSelectedJobId(id); setters.setIsEditJobModalOpen(true); }} onSmartCreateClick={() => { setters.setSmartCreateMode('job'); setters.setIsSmartCreateOpen(true); }} />;
            case 'estimates': return <EstimatesView onOpenEstimateModal={(est) => setters.setEstimateFormModal({isOpen: true, estimate: est})} onViewEstimate={(est) => setters.setEstimateViewModal({isOpen: true, estimate: est})} onSmartCreateClick={() => { setters.setSmartCreateMode('estimate'); setters.setIsSmartCreateOpen(true); }} />;
            case 'invoices': return <InvoicesView invoices={invoices} customers={customers} vehicles={vehicles} taxRates={taxRates} onViewInvoice={(inv) => setters.setViewInvoiceModal({isOpen: true, invoice: inv})} onEditInvoice={(inv) => setters.setInvoiceFormModal({isOpen: true, invoice: inv})} onOpenExportModal={() => {}} onCreateAdhocInvoice={() => setters.setInvoiceFormModal({isOpen: true, invoice: { createdByUserId: currentUser?.id || 'system' } as any})} />;
            case 'purchaseOrders': return <PurchaseOrdersView purchaseOrders={purchaseOrders} suppliers={suppliers} onOpenPurchaseOrderModal={(po) => setters.setPoModal({isOpen: true, po})} onViewPurchaseOrder={(po) => setters.setViewPoModal({isOpen: true, po})} onDeletePurchaseOrder={(id) => {}} onExport={() => {}} onOpenBatchAddModal={() => setters.setBatchPoModalOpen(true)} />;
            case 'sales': return <SalesView entity={currentEntity!} onManageSaleVehicle={() => {}} onAddSaleVehicle={() => {}} onGenerateReport={() => {}} onAddProspect={() => {}} onEditProspect={() => {}} onViewCustomer={() => {}} />;
            case 'storage': return <StorageView entity={currentEntity!} onSaveBooking={() => {}} onBookOutVehicle={() => {}} onViewInvoice={() => {}} onAddCustomerAndVehicle={() => {}} onSaveInvoice={() => {}} setConfirmation={() => {}} setViewedInvoice={() => {}} />;
            case 'rentals': return <RentalsView entity={currentEntity!} onOpenRentalBooking={() => {}} />;
            case 'concierge': return <ConciergeView onCheckIn={() => {}} onOpenPurchaseOrder={() => {}} onGenerateInvoice={() => {}} onCollect={() => {}} {...commonProps} />;
            case 'absence': return <AbsenceView currentUser={currentUser} users={users} absenceRequests={absenceRequests} setAbsenceRequests={() => {}} />;
            case 'inquiries': return <InquiriesView onOpenInquiryModal={(inq) => setters.setInquiryModal({isOpen: true, inquiry: inq})} onConvert={() => {}} onViewEstimate={(est) => setters.setEstimateViewModal({isOpen: true, estimate: est})} onScheduleEstimate={() => {}} onOpenPurchaseOrder={() => {}} onEditEstimate={() => {}} />;
            default: return <DashboardView {...commonProps} onCheckIn={() => {}} onOpenInquiry={() => {}} />;
        }
    };

    return (
        <MainLayout {...({ onOpenManagement: () => setIsManagementOpen(true) } as any)}>
            {renderView()}
            <AppModals 
                modals={modalsState} 
                setters={setters} 
                actions={{
                    handleSaveItem: workshopActions.handleSaveItem,
                    setCustomers: data.setCustomers,
                    setVehicles: data.setVehicles,
                    handleSavePurchaseOrder: workshopActions.handleSavePurchaseOrder,
                    handleSaveEstimate: workshopActions.handleSaveEstimate,
                    handleApproveEstimate: workshopActions.handleApproveEstimate,
                    updateLinkedInquiryStatus: workshopActions.updateLinkedInquiryStatus
                }} 
            />
            <ManagementModal 
                isOpen={isManagementOpen} 
                onClose={() => setIsManagementOpen(false)} 
                initialView={null}
                selectedEntityId={selectedEntityId}
                onViewJob={(id) => { setters.setSelectedJobId(id); setters.setIsEditJobModalOpen(true); }}
                onViewEstimate={(est: any) => setters.setEstimateViewModal({isOpen: true, estimate: est})}
                backupSchedule={context.backupSchedule}
                setBackupSchedule={context.setBackupSchedule}
                onManualBackup={() => {}}
            />
        </MainLayout>
    );
};

export default App;