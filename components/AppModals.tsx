import React, { useState, useMemo, Dispatch, SetStateAction } from 'react';
import * as T from '../types';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { formatDate, formatReadableDate } from '../core/utils/dateUtils';
import { ModalState, ModalSetters } from '../core/hooks/useModalState';
import { useWorkshopActions } from '../core/hooks/useWorkshopActions';

// Modal Components
import EditJobModal from './EditJobModal';
import ConfirmationModal from './ConfirmationModal';
import PurchaseOrderFormModal from './PurchaseOrderFormModal';
import BatchAddPurchasesModal from './BatchAddPurchasesModal';
import PurchaseOrderViewModal from './PurchaseOrderViewModal';
import InvoiceFormModal from './InvoiceFormModal';
import InvoiceModal from './InvoiceModal';
import SalesInvoiceModal from './SalesInvoiceModal';
import RentalBookingModal from './RentalBookingModal';
import RentalAgreementModal from './RentalAgreementModal';
import RentalCheckInCheckOutModal from './RentalCheckInCheckOutModal';
import RentalCheckInReportModal from './RentalCheckInReportModal';
import SORContractModal from './SORContractModal';
import OwnerStatementModal from './OwnerStatementModal';
import InternalSaleStatementModal from './InternalSaleStatementModal';
import VehicleOrderFormModal from './VehicleOrderFormModal';
import SalesSummaryReportModal from './SalesSummaryReportModal';
import ProspectFormModal from './ProspectFormModal';
import InquiryFormModal from './InquiryFormModal';
import LiveAssistant from './LiveAssistant';
import ScheduleJobFromEstimateModal from './ScheduleJobFromEstimateModal';
import ScheduleConfirmationEmailModal from './ScheduleConfirmationEmailModal';
import NominalCodeExportModal from './NominalCodeExportModal';
import CheckInModal from './CheckInModal';
import CheckOutModal from './CheckOutModal';
import EstimateFormModal from './EstimateFormModal';
import EstimateViewModal from './EstimateViewModal';
import SmartCreateJobModal from './SmartCreateJobModal';
import AddSaleVehicleModal from './AddSaleVehicleModal';
import ManageSaleVehicleModal from './ManageSaleVehicleModal';
import CustomerFormModal from './CustomerFormModal';
import VehicleFormModal from './VehicleFormModal';
import VehicleHistoryReportModal from './VehicleHistoryReportModal';
import PartFormModal from './PartFormModal';
import BatchUpdatePORefModal from './BatchUpdatePORefModal';


const getNextSequence = (items: any[], entityShortCode: string, prefix: string, key: string): string => {
    if (!entityShortCode) {
        console.error(`Cannot generate ID with prefix ${prefix} because entityShortCode is missing.`);
        return 'ERROR';
    }
    const fullPrefix = `${entityShortCode.toUpperCase()}${prefix}`;
    const relevantItems = items.filter(item => item[key] && typeof item[key] === 'string' && item[key].startsWith(fullPrefix));
    let maxNumber = 0;
    relevantItems.forEach(item => {
        const numberPart = parseInt(item[key].substring(fullPrefix.length), 10);
        if (!isNaN(numberPart) && numberPart > maxNumber) {
            maxNumber = numberPart;
        }
    });
    const newNumber = maxNumber + 1;
    return String(newNumber).padStart(6, '0');
};

const generatePurchaseOrderId = (allPurchaseOrders: T.PurchaseOrder[], entityShortCode: string): string => {
    const prefix = '944';
    const sequence = getNextSequence(allPurchaseOrders, entityShortCode, prefix, 'id');
    return `${entityShortCode}${prefix}${sequence}`;
};

interface AppModalActions {
    handleSaveItem: (setter: React.Dispatch<React.SetStateAction<any[]>>, item: any, collectionOverride?: string) => Promise<any>;
    setCustomers: React.Dispatch<React.SetStateAction<T.Customer[]>>;
    setVehicles: React.Dispatch<React.SetStateAction<T.Vehicle[]>>;
    handleSavePurchaseOrder: (po: T.PurchaseOrder, updatedParts?: T.Part[], updatedEstimate?: T.Estimate) => Promise<void>;
    handleSaveEstimate: (estimate: T.Estimate) => Promise<void>;
    handleSavePart: (part: T.Part) => Promise<any>;
    handleApproveEstimate: (estimate: T.Estimate, selectedOptionalItemIds: string[], notes?: string, scheduledDate?: string) => Promise<void>;
    handleCustomerApproveEstimate: (estimate: T.Estimate, selectedOptionalItemIds: string[], dateRange: any, notes: string) => void;
    handleCustomerDeclineEstimate: (estimate: T.Estimate) => void;
    updateLinkedInquiryStatus: (estimateId: string, newStatus: T.Inquiry['status'], extraUpdates?: Partial<T.Inquiry>) => Promise<void>;
    handleMarkJobAsAwaitingCollection: (jobId: string) => void;
    handleDeleteJob: (jobId: string) => Promise<void>;
    handleRefreshPurchaseOrder: (poId: string) => Promise<T.PurchaseOrder | void>;
    handleEditPart: (part: T.Part) => void;
}

interface AppModalsProps {
    modals: ModalState;
    setters: ModalSetters;
    actions: AppModalActions;
    commonProps: any;
}

const AppModals: React.FC<AppModalsProps> = ({ modals, setters, actions, commonProps }) => {
    const data = useData();
    const { currentUser, selectedEntityId, confirmation, setConfirmation, users } = useApp();
    const workshopActions = useWorkshopActions();

    // Helper for saving
    const handleSaveItem = actions.handleSaveItem;

    const handleBatchUpdatePoRef = async (updatedPos: T.PurchaseOrder[]) => {
        setters.setBatchUpdatePoRefModalOpen(false);
        
        // Update local state in one go for immediate UI refresh
        data.setPurchaseOrders(prev => {
            const next = [...(prev || [])];
            updatedPos.forEach(upd => {
                const idx = next.findIndex(p => p.id === upd.id);
                if (idx !== -1) next[idx] = upd;
            });
            return next;
        });

        // Persist to database in background
        for (const upd of updatedPos) {
            await actions.handleSaveItem(data.setPurchaseOrders, upd, 'brooks_purchaseOrders');
        }
    };

    return (
        <>
            <ConfirmationModal 
                isOpen={confirmation.isOpen} 
                title={confirmation.title} 
                message={confirmation.message} 
                onClose={() => setConfirmation({ ...confirmation, isOpen: false })} 
                onConfirm={confirmation.onConfirm}
                confirmText={confirmation.confirmText}
                cancelText={confirmation.cancelText}
                type={confirmation.type}
            />

            {modals.batchUpdatePoRefModalOpen && (
                <BatchUpdatePORefModal
                    isOpen={modals.batchUpdatePoRefModalOpen}
                    onClose={() => setters.setBatchUpdatePoRefModalOpen(false)}
                    onSave={handleBatchUpdatePoRef}
                    purchaseOrders={data.purchaseOrders}
                    suppliers={data.suppliers}
                />
            )}

            {modals.isEditJobModalOpen && modals.selectedJobId && (
                <EditJobModal
                    isOpen={true}
                    onClose={() => {
                        setters.setIsEditJobModalOpen(false);
                        setters.setEditJobInitialTab(null);
                    }}
                    selectedJobId={modals.selectedJobId}
                    initialTab={modals.editJobInitialTab || undefined}
                    purchaseOrders={data.purchaseOrders}
                    onRaiseSupplementaryEstimate={(job) => setters.setEstimateFormModal({
                        isOpen: true,
                        estimate: {
                            jobId: job.id,
                            customerId: job.customerId,
                            vehicleId: job.vehicleId,
                            entityId: job.entityId,
                            status: 'Draft'
                        }
                    })}
                    onViewEstimate={(est) => setters.setEstimateViewModal({ isOpen: true, estimate: est })}
                    onViewCustomer={(customerId) => setters.setCustomerModal({ isOpen: true, customerId })}
                    onViewVehicle={(vehicleId) => setters.setVehicleModal({ isOpen: true, vehicleId })}
                    onCheckIn={(job) => setters.setCheckInJob(job)}
                    onCheckOut={(job) => setters.setCheckOutJob(job)}
                    onDelete={actions.handleDeleteJob}
                    generatePurchaseOrderId={generatePurchaseOrderId}
                    onOpenPurchaseOrder={(po) => setters.setPoModal({ isOpen: true, po })}
                    rentalBookings={data.rentalBookings}
                    onOpenRentalBooking={(booking) => setters.setRentalBookingModal({ isOpen: true, booking })}
                    onOpenConditionReport={(booking, mode) => setters.setRentalConditionModal({ isOpen: true, booking, mode })}
                    forceRefresh={data.forceRefresh}
                />
            )}

            {modals.isSmartCreateOpen && (
                <SmartCreateJobModal
                    isOpen={true}
                    onClose={() => setters.setIsSmartCreateOpen(false)}
                    creationMode={modals.smartCreateMode}
                    onJobCreate={async (jobData) => { 
                        await handleSaveItem(data.setJobs, { ...jobData, createdByUserId: currentUser.id }, 'brooks_jobs'); 
                        const est = data.estimates.find(e => e.id === jobData.estimateId);
                        if (est) await workshopActions.syncPurchaseOrdersFromEstimate(est, { forceNew: true });
                        setters.setIsSmartCreateOpen(false); 
                    }}
                    onVehicleAndJobCreate={async (c, v, j) => { 
                        await handleSaveItem(actions.setCustomers, c, 'brooks_customers'); 
                        await handleSaveItem(actions.setVehicles, v, 'brooks_vehicles'); 
                        await handleSaveItem(data.setJobs, { ...j, createdByUserId: currentUser.id }, 'brooks_jobs'); 
                        const est = data.estimates.find(e => e.id === j.estimateId);
                        if (est) await workshopActions.syncPurchaseOrdersFromEstimate(est, { forceNew: true });
                        setters.setIsSmartCreateOpen(false); 
                    }}
                    onEstimateCreate={async (estData) => { 
                        await handleSaveItem(data.setEstimates, estData, 'brooks_estimates'); 
                        if (estData.jobId) await workshopActions.syncPurchaseOrdersFromEstimate(estData, { forceNew: true });
                        setters.setIsSmartCreateOpen(false); 
                    }}
                    onVehicleAndEstimateCreate={async (c, v, e) => { 
                        await handleSaveItem(actions.setCustomers, c, 'brooks_customers'); 
                        await handleSaveItem(actions.setVehicles, v, 'brooks_vehicles'); 
                        await handleSaveItem(data.setEstimates, e, 'brooks_estimates'); 
                        if (e.jobId) await workshopActions.syncPurchaseOrdersFromEstimate(e, { forceNew: true });
                        setters.setIsSmartCreateOpen(false); 
                    }}
                    vehicles={data.vehicles}
                    customers={data.customers}
                    servicePackages={data.servicePackages}
                    defaultDate={formatDate(modals.smartCreateDefaultDate)}
                    initialPrompt={null}
                />
            )}

            {modals.poModal.isOpen && (
                <PurchaseOrderFormModal
                    isOpen={true}
                    onClose={() => setters.setPoModal({isOpen: false, po: null})}
                    onSave={(po, updatedParts, updatedEstimate) => actions.handleSavePurchaseOrder({ ...po, createdByUserId: po.createdByUserId || currentUser.id }, updatedParts, updatedEstimate)}
                    onSavePart={(part) => handleSaveItem(data.setParts, part, 'brooks_parts')}
                    purchaseOrder={modals.poModal.po}
                    suppliers={data.suppliers}
                    taxRates={data.taxRates}
                    businessEntities={data.businessEntities}
                    allPurchaseOrders={data.purchaseOrders}
                    selectedEntityId={selectedEntityId}
                    parts={data.parts}
                    estimates={data.estimates}
                    setParts={data.setParts}
                    jobs={data.jobs}
                    vehicles={data.vehicles}
                    customers={data.customers}
                    setJobs={data.setJobs}
                    servicePackages={data.servicePackages}
                    onViewPurchaseOrder={(po) => { setters.setPoModal({isOpen: false, po: null}); setters.setViewPoModal({isOpen: true, po: po }); }}
                    generatePurchaseOrderId={generatePurchaseOrderId}
                    forceRefresh={data.forceRefresh}
                />
            )}

            {modals.batchPoModalOpen && (
                <BatchAddPurchasesModal 
                    isOpen={modals.batchPoModalOpen}
                    onClose={() => setters.setBatchPoModalOpen(false)}
                    onSave={(poData) => { 
                        const entity = data.businessEntities.find(e => e.id === poData.entityId);
                        const entityShortCode = entity?.shortCode || 'UNK';
                        const newId = generatePurchaseOrderId(data.purchaseOrders, entityShortCode);
                        const newPo: T.PurchaseOrder = { id: newId, ...poData, createdByUserId: currentUser.id } as T.PurchaseOrder;
                        actions.handleSavePurchaseOrder(newPo);
                    }}
                    jobs={data.jobs}
                    vehicles={data.vehicles}
                    suppliers={data.suppliers}
                    taxRates={data.taxRates}
                    selectedEntityId={selectedEntityId}
                    businessEntities={data.businessEntities}
                    parts={data.parts}
                />
            )}

            {modals.viewPoModal.isOpen && modals.viewPoModal.po && (
                <PurchaseOrderViewModal
                    isOpen={modals.viewPoModal.isOpen}
                    onClose={() => setters.setViewPoModal({isOpen: false, po: null})}
                    purchaseOrder={modals.viewPoModal.po}
                    handleSaveItem={handleSaveItem}
                    onUpdate={(updatedPO) => actions.handleSavePurchaseOrder(updatedPO)}
                    onSend={(poId) => {/* your send logic */}}
                    onEditPart={actions.handleEditPart} 
                />
            )}

            {modals.invoiceFormModal.isOpen && (
                <InvoiceFormModal
                    key={modals.invoiceFormModal.invoice?.id || modals.invoiceFormModal.job?.id || 'new'}
                    isOpen={modals.invoiceFormModal.isOpen}
                    onClose={() => setters.setInvoiceFormModal({ isOpen: false, invoice: null, job: null })}
                    onSave={(inv) => {
                        const finalInvoice = { ...inv, createdByUserId: inv.createdByUserId || currentUser.id };
                        handleSaveItem(data.setInvoices, finalInvoice, 'brooks_invoices');
                        if (finalInvoice.jobId) {
                            const job = data.jobs.find(j => j.id === finalInvoice.jobId);
                            if (job) {
                                const updatedJob = { ...job, invoiceId: finalInvoice.id, status: 'Invoiced' as const };
                                handleSaveItem(data.setJobs, updatedJob, 'brooks_jobs');
                            }
                        }
                        setters.setInvoiceFormModal({ isOpen: false, invoice: null, job: null });
                        setters.setViewInvoiceModal({ isOpen: true, invoice: finalInvoice });
                    }}
                    invoice={modals.invoiceFormModal.invoice}
                    job={modals.invoiceFormModal.job || null}
                    customers={data.customers}
                    onSaveCustomer={(c) => handleSaveItem(actions.setCustomers, c, 'brooks_customers')}
                    vehicles={data.vehicles}
                    onSaveVehicle={(v) => handleSaveItem(actions.setVehicles, v, 'brooks_vehicles')}
                    businessEntities={data.businessEntities}
                    taxRates={data.taxRates}
                    servicePackages={data.servicePackages}
                    parts={data.parts}
                    invoices={data.invoices}
                    discountCodes={data.discountCodes}
                />
            )}

            {modals.viewInvoiceModal.isOpen && modals.viewInvoiceModal.invoice && (
                <InvoiceModal
                    isOpen={modals.viewInvoiceModal.isOpen}
                    onClose={() => setters.setViewInvoiceModal({isOpen: false, invoice: null})}
                    invoice={modals.viewInvoiceModal.invoice}
                    customer={data.customers.find(c => c.id === modals.viewInvoiceModal.invoice!.customerId)}
                    vehicle={data.vehicles.find(v => v.id === modals.viewInvoiceModal.invoice!.vehicleId)}
                    entity={data.businessEntities.find(e => e.id === modals.viewInvoiceModal.invoice!.entityId)}
                    job={data.jobs.find(j => j.id === modals.viewInvoiceModal.invoice!.jobId)}
                    taxRates={data.taxRates}
                    servicePackages={data.servicePackages}
                    inspectionTemplates={data.inspectionTemplates}
                    inspectionDiagrams={data.inspectionDiagrams}
                    onUpdateInvoice={(inv) => handleSaveItem(data.setInvoices, inv, 'brooks_invoices')}
                    onInvoiceAction={(id) => actions.handleMarkJobAsAwaitingCollection(id)}
                    onEdit={(inv) => setters.setInvoiceFormModal({ isOpen: true, invoice: inv, job: data.jobs.find(j => j.id === inv.jobId) || null })}
                />
            )}

            {modals.salesInvoiceModal.isOpen && modals.salesInvoiceModal.invoice && (
                <SalesInvoiceModal 
                    isOpen={modals.salesInvoiceModal.isOpen}
                    onClose={() => setters.setSalesInvoiceModal({isOpen: false, invoice: null})}
                    saleVehicle={data.saleVehicles.find(sv => sv.id === modals.salesInvoiceModal.invoice!.saleVehicleId)!}
                    invoice={modals.salesInvoiceModal.invoice}
                    vehicle={data.vehicles.find(v => v.id === modals.salesInvoiceModal.invoice!.vehicleId)}
                    buyer={data.customers.find(c => c.id === modals.salesInvoiceModal.invoice!.customerId)}
                    entity={data.businessEntities.find(e => e.id === modals.salesInvoiceModal.invoice!.entityId)}
                    taxRates={data.taxRates}
                    onUpdateInvoice={(inv) => handleSaveItem(data.setInvoices, inv, 'brooks_invoices')}
                />
            )}

            {modals.rentalBookingModal.isOpen && (
                <RentalBookingModal 
                    isOpen={modals.rentalBookingModal.isOpen}
                    onClose={() => setters.setRentalBookingModal({isOpen: false, booking: null})}
                    onSave={(b) => handleSaveItem(data.setRentalBookings, b, 'brooks_rentalBookings')}
                    booking={modals.rentalBookingModal.booking}
                    vehicles={data.vehicles}
                    rentalVehicles={data.rentalVehicles}
                    customers={data.customers}
                    jobs={data.jobs}
                    rentalEntities={data.businessEntities.filter(e => e.type === 'Rentals')}
                />
            )}

            {modals.rentalConditionModal.isOpen && modals.rentalConditionModal.booking && (
                <RentalCheckInCheckOutModal 
                    isOpen={modals.rentalConditionModal.isOpen}
                    onClose={() => setters.setRentalConditionModal({isOpen: false, booking: null, mode: 'checkOut'})}
                    onSave={(b) => handleSaveItem(data.setRentalBookings, b, 'brooks_rentalBookings')}
                    booking={modals.rentalConditionModal.booking}
                    mode={modals.rentalConditionModal.mode}
                    rentalVehicle={data.rentalVehicles.find(rv => rv.id === modals.rentalConditionModal.booking!.rentalVehicleId)!}
                    vehicle={data.vehicles.find(v => v.id === modals.rentalConditionModal.booking!.rentalVehicleId)!}
                />
            )}

            {modals.rentalAgreementModal.isOpen && modals.rentalAgreementModal.booking && (
                <RentalAgreementModal 
                    isOpen={modals.rentalAgreementModal.isOpen}
                    onClose={() => setters.setRentalAgreementModal({isOpen: false, booking: null})}
                    booking={modals.rentalAgreementModal.booking}
                    rentalVehicle={data.rentalVehicles.find(rv => rv.id === modals.rentalAgreementModal.booking!.rentalVehicleId)}
                    vehicle={data.vehicles.find(v => v.id === modals.rentalAgreementModal.booking!.rentalVehicleId)}
                    customer={data.customers.find(c => c.id === modals.rentalAgreementModal.booking!.customerId)}
                    entity={data.businessEntities.find(e => e.id === modals.rentalAgreementModal.booking!.entityId)}
                />
            )}

            {modals.rentalReturnReportModal.isOpen && modals.rentalReturnReportModal.booking && (
                <RentalCheckInReportModal 
                    isOpen={modals.rentalReturnReportModal.isOpen}
                    onClose={() => setters.setRentalReturnReportModal({isOpen: false, booking: null})}
                    booking={modals.rentalReturnReportModal.booking}
                    rentalVehicle={data.rentalVehicles.find(rv => rv.id === modals.rentalReturnReportModal.booking!.rentalVehicleId)}
                    vehicle={data.vehicles.find(v => v.id === modals.rentalReturnReportModal.booking!.rentalVehicleId)}
                    customer={data.customers.find(c => c.id === modals.rentalReturnReportModal.booking!.customerId)}
                    entity={data.businessEntities.find(e => e.id === modals.rentalReturnReportModal.booking!.entityId)}
                />
            )}

            {modals.sorContractModal.isOpen && modals.sorContractModal.saleVehicle && (
                <SORContractModal 
                    isOpen={modals.sorContractModal.isOpen}
                    onClose={() => setters.setSorContractModal({isOpen: false, saleVehicle: null})}
                    saleVehicle={modals.sorContractModal.saleVehicle}
                    vehicle={data.vehicles.find(v => v.id === modals.sorContractModal.saleVehicle!.vehicleId)}
                    owner={data.customers.find(c => c.id === data.vehicles.find(v => v.id === modals.sorContractModal.saleVehicle!.vehicleId)?.customerId)}
                    entity={data.businessEntities.find(e => e.id === modals.sorContractModal.saleVehicle!.entityId)}
                />
            )}

            {modals.ownerStatementModal.isOpen && modals.ownerStatementModal.saleVehicle && (
                <OwnerStatementModal 
                    isOpen={modals.ownerStatementModal.isOpen}
                    onClose={() => setters.setOwnerStatementModal({isOpen: false, saleVehicle: null})}
                    saleVehicle={modals.ownerStatementModal.saleVehicle}
                    vehicle={data.vehicles.find(v => v.id === modals.ownerStatementModal.saleVehicle!.vehicleId)}
                    owner={data.customers.find(c => c.id === data.vehicles.find(v => v.id === modals.ownerStatementModal.saleVehicle!.vehicleId)?.customerId)}
                    entity={data.businessEntities.find(e => e.id === modals.ownerStatementModal.saleVehicle!.entityId)}
                />
            )}

            {modals.internalStatementModal.isOpen && modals.internalStatementModal.saleVehicle && (
                <InternalSaleStatementModal 
                    isOpen={modals.internalStatementModal.isOpen}
                    onClose={() => setters.setInternalStatementModal({isOpen: false, saleVehicle: null})}
                    saleVehicle={modals.internalStatementModal.saleVehicle}
                    vehicle={data.vehicles.find(v => v.id === modals.internalStatementModal.saleVehicle!.vehicleId)}
                    entity={data.businessEntities.find(e => e.id === modals.internalStatementModal.saleVehicle!.entityId)}
                />
            )}

            {modals.vehicleOrderFormModal?.isOpen && modals.vehicleOrderFormModal.saleVehicle && (
                <VehicleOrderFormModal 
                    isOpen={modals.vehicleOrderFormModal.isOpen}
                    onClose={() => setters.setVehicleOrderFormModal({isOpen: false, saleVehicle: null})}
                    saleVehicle={modals.vehicleOrderFormModal.saleVehicle}
                    vehicle={data.vehicles.find(v => v.id === modals.vehicleOrderFormModal.saleVehicle!.vehicleId)}
                    buyer={data.customers.find(c => c.id === modals.vehicleOrderFormModal.saleVehicle!.buyerCustomerId)}
                    entity={data.businessEntities.find(e => e.id === modals.vehicleOrderFormModal.saleVehicle!.entityId)}
                    taxRates={data.taxRates}
                />
            )}

            {modals.salesReportModal && (
                <SalesSummaryReportModal 
                    isOpen={modals.salesReportModal}
                    onClose={() => setters.setSalesReportModal(false)}
                    saleVehicles={data.saleVehicles}
                    vehicles={data.vehicles}
                    entity={data.businessEntities.find(e => e.id === selectedEntityId)}
                />
            )}

            {modals.addSaleVehicleModalOpen && (
                <AddSaleVehicleModal 
                    isOpen={modals.addSaleVehicleModalOpen}
                    onClose={() => setters.setAddSaleVehicleModalOpen(false)}
                    onSave={(sv) => handleSaveItem(data.setSaleVehicles, sv, 'brooks_saleVehicles')}
                    entityId={selectedEntityId}
                    vehicles={data.vehicles}
                    customers={data.customers}
                    onAddCustomerAndVehicle={(c, v) => {
                        handleSaveItem(actions.setCustomers, c, 'brooks_customers');
                        handleSaveItem(actions.setVehicles, v, 'brooks_vehicles');
                    }}
                />
            )}

            {modals.manageSaleVehicleModal.isOpen && modals.manageSaleVehicleModal.saleVehicle && (
                <ManageSaleVehicleModal 
                    isOpen={modals.manageSaleVehicleModal.isOpen}
                    onClose={() => setters.setManageSaleVehicleModal({isOpen: false, saleVehicle: null})}
                    onSave={(sv) => handleSaveItem(data.setSaleVehicles, sv, 'brooks_saleVehicles')}
                    onSaleFinalized={(sv, inv) => {
                        handleSaveItem(data.setSaleVehicles, sv, 'brooks_saleVehicles');
                        handleSaveItem(data.setInvoices, inv, 'brooks_invoices');
                        setters.setManageSaleVehicleModal({isOpen: false, saleVehicle: null});
                        setters.setSalesInvoiceModal({isOpen: true, invoice: inv});
                    }}
                    onViewStatement={(sv) => setters.setOwnerStatementModal({ isOpen: true, saleVehicle: sv })}
                    onViewSORContract={(sv) => setters.setSorContractModal({ isOpen: true, saleVehicle: sv })}
                    onViewInternalStatement={(sv) => setters.setInternalStatementModal({ isOpen: true, saleVehicle: sv })}
                    onViewInvoice={(sv) => {
                        const inv = data.invoices.find(i => i.id === sv.invoiceId);
                        if (inv) setters.setSalesInvoiceModal({ isOpen: true, invoice: inv });
                    }}
                    onViewOrderForm={(sv) => setters.setVehicleOrderFormModal({ isOpen: true, saleVehicle: sv })}
                    saleVehicle={modals.manageSaleVehicleModal.saleVehicle}
                    
                    allJobs={data.jobs}
                    allEstimates={data.estimates}
                    allCustomers={data.customers}
                    allVehicles={data.vehicles}
                    allServicePackages={data.servicePackages}
                    allSaleOverheadPackages={data.saleOverheadPackages}
                    allInvoices={data.invoices}
                    allBatteryChargers={data.batteryChargers}
                    taxRates={data.taxRates}
                    businessEntities={data.businessEntities}
                    prospects={data.prospects}
                    onUpdateProspect={(p) => handleSaveItem(data.setProspects, p, 'brooks_prospects')}
                />
            )}

            {modals.prospectModal.isOpen && (
                <ProspectFormModal 
                    isOpen={modals.prospectModal.isOpen}
                    onClose={() => setters.setProspectModal({isOpen: false, prospect: null})}
                    onSave={(p) => handleSaveItem(data.setProspects, p, 'brooks_prospects')}
                    prospect={modals.prospectModal.prospect}
                    entityId={selectedEntityId}
                    saleVehicles={data.saleVehicles}
                    vehicles={data.vehicles}
                    customers={data.customers}
                    onSaveCustomer={(c) => handleSaveItem(actions.setCustomers, c, 'brooks_customers')}
                />
            )}

            {modals.estimateFormModal.isOpen && (
                <EstimateFormModal 
                    isOpen={modals.estimateFormModal.isOpen}
                    onClose={() => setters.setEstimateFormModal({isOpen: false, estimate: null})}
                    onSave={actions.handleSaveEstimate}
                    estimate={modals.estimateFormModal.estimate}
                    customers={data.customers}
                    onSaveCustomer={(c) => handleSaveItem(actions.setCustomers, c, 'brooks_customers')}
                    vehicles={data.vehicles}
                    onSaveVehicle={(v) => handleSaveItem(actions.setVehicles, v, 'brooks_vehicles')}
                    businessEntities={data.businessEntities}
                    taxRates={data.taxRates}
                    servicePackages={data.servicePackages}
                    parts={data.parts}
                    estimates={data.estimates}
                    currentUser={currentUser}
                    selectedEntityId={selectedEntityId}
                    onSavePart={(part) => handleSaveItem(data.setParts, part, 'brooks_parts')}
                    suppliers={data.suppliers}
                />
            )}

            {modals.estimateViewModal.isOpen && modals.estimateViewModal.estimate && (
                <EstimateViewModal 
                    isOpen={true}
                    onClose={() => setters.setEstimateViewModal({isOpen: false, estimate: null})}
                    estimate={modals.estimateViewModal.estimate}
                    customer={data.customers.find(c => c.id === modals.estimateViewModal.estimate!.customerId)}
                    vehicle={data.vehicles.find(v => v.id === modals.estimateViewModal.estimate!.vehicleId)}
                    taxRates={data.taxRates}
                    servicePackages={data.servicePackages}
                    entityDetails={data.businessEntities.find(e => e.id === modals.estimateViewModal.estimate!.entityId)}
                    onApprove={actions.handleApproveEstimate}
                    onCustomerApprove={actions.handleCustomerApproveEstimate}
                    onDecline={actions.handleCustomerDeclineEstimate}
                    onEmailSuccess={(est) => {
                        handleSaveItem(data.setEstimates, est, 'brooks_estimates');
                        actions.updateLinkedInquiryStatus(est.id, 'Sent');
                    }}
                    viewMode="internal"
                    parts={data.parts}
                    users={users}
                    currentUser={currentUser}
                    onCreateInquiry={(est) => setters.setInquiryModal({isOpen: true, inquiry: { linkedEstimateId: est.id, linkedCustomerId: est.customerId, linkedVehicleId: est.vehicleId, message: `Question regarding Estimate #${est.estimateNumber}` }})}
                    onScheduleEstimate={(est, inquiryId) => setters.setScheduleJobFromEstimateModal({isOpen: true, estimate: est, inquiryId})}
                    onEdit={(est) => setters.setEstimateFormModal({ isOpen: true, estimate: est })}
                />
            )}

            {modals.scheduleJobFromEstimateModal.isOpen && modals.scheduleJobFromEstimateModal.estimate && (() => {
                const estimate = modals.scheduleJobFromEstimateModal.estimate;
                if (!estimate) return null;

                const targetInquiryId = modals.scheduleJobFromEstimateModal.inquiryId || data.inquiries.find(i => i.linkedEstimateId === estimate.id)?.id;
                const inquiry = targetInquiryId ? data.inquiries.find(i => i.id === targetInquiryId) : undefined;

                return (
                    <ScheduleJobFromEstimateModal 
                        isOpen={true}
                        onClose={() => setters.setScheduleJobFromEstimateModal({isOpen: false, estimate: null})}
                        onConfirm={async (job, est, options, extraJobs) => {
                            const originalEstimate = modals.scheduleJobFromEstimateModal.estimate;
                            if (!originalEstimate) return;

                            const targetInquiryId = modals.scheduleJobFromEstimateModal.inquiryId || data.inquiries.find(i => i.linkedEstimateId === originalEstimate?.id)?.id;
                            const inquiry = targetInquiryId ? data.inquiries.find(i => i.id === targetInquiryId) : null;
                            
                            if (originalEstimate.jobId) {
                                const originJob = data.jobs.find(j => j.id === originalEstimate.jobId);
                                if (originJob) {
                                    const updateNote = `
[System]: Supplementary Estimate #${originalEstimate.estimateNumber} was converted to a separate Job #${job.id} scheduled for ${formatReadableDate(job.scheduledDate)}.`;
                                    const updatedOriginJob = {
                                        ...originJob,
                                        notes: (originJob.notes || '') + updateNote
                                    };
                                    await handleSaveItem(data.setJobs, updatedOriginJob, 'brooks_jobs');
                                }
                            }

                            const jobToSave = {
                                ...job,
                                createdByUserId: currentUser.id,
                                estimateId: est.id,
                            };

                            await handleSaveItem(data.setJobs, jobToSave, 'brooks_jobs');
                            
                            if (extraJobs && extraJobs.length > 0) {
                                for (const extraJob of extraJobs) {
                                    await handleSaveItem(data.setJobs, { ...extraJob, createdByUserId: currentUser.id }, 'brooks_jobs');
                                }
                            }
                            
                            await handleSaveItem(data.setEstimates, est, 'brooks_estimates');

                            // SYNC PURCHASE ORDERS using the unified rules
                            await workshopActions.syncPurchaseOrdersFromEstimate(est, { forceNew: true });
                            
                            if (inquiry) {
                                const updatedInquiry = {
                                    ...inquiry, 
                                    status: 'In Progress',
                                    linkedJobId: jobToSave.id,
                                    actionNotes: (inquiry.actionNotes || '') + `
[System]: Job #${jobToSave.id} scheduled for ${formatReadableDate(jobToSave.scheduledDate)}. Parts synchronized.` 
                                };
                                await handleSaveItem(data.setInquiries, updatedInquiry, 'brooks_inquiries');
                            }

                            // Modal handles its own closing/success state now
                            
                            const extraJobMsg = extraJobs && extraJobs.length > 0 ? ` plus ${extraJobs.length} linked job(s)` : '';
                            
                            setConfirmation({
                                isOpen: true, 
                                title: 'Job Scheduled', 
                                message: `Job #${jobToSave.id} has been scheduled for ${formatReadableDate(jobToSave.scheduledDate)}${extraJobMsg}. Purchase orders have been synchronized according to the latest rules.`,
                                type: 'success'
                            });
                        }}
                        estimate={estimate}
                        inquiry={inquiry}
                        customer={data.customers.find(c => c.id === estimate.customerId)}
                        vehicle={data.vehicles.find(v => v.id === estimate.vehicleId)}
                        jobs={data.jobs}
                        vehicles={data.vehicles}
                        parts={data.parts}
                        maxDailyCapacityHours={data.businessEntities.find(e => e.id === estimate.entityId)?.dailyCapacityHours || 40}
                        businessEntities={data.businessEntities}
                        customers={data.customers}
                        absenceRequests={data.absenceRequests}
                        onEditJob={(jobId) => { setters.setSelectedJobId(jobId); setters.setIsEditJobModalOpen(true); }}
                    />
                );
            })()}

            {modals.scheduleEmailModal.isOpen && (
                <ScheduleConfirmationEmailModal 
                    isOpen={modals.scheduleEmailModal.isOpen}
                    onClose={() => setters.setScheduleEmailModal({isOpen: false, data: null})}
                    onSend={(recipients) => {
                        setters.setScheduleEmailModal({isOpen: false, data: null});
                        setConfirmation({isOpen: true, title: 'Email Sent', message: `Booking confirmation email sent to ${recipients}.`, type: 'success'});
                    }}
                    data={modals.scheduleEmailModal.data}
                />
            )}

            {modals.exportModal.isOpen && (
                <NominalCodeExportModal 
                    isOpen={modals.exportModal.isOpen}
                    onClose={() => setters.setExportModal({isOpen: false, type: 'invoices', items: []})}
                    type={modals.exportModal.type as any}
                    items={modals.exportModal.items}
                    nominalCodes={data.nominalCodes}
                    nominalCodeRules={data.nominalCodeRules}
                    customers={data.customers}
                    vehicles={data.vehicles}
                    taxRates={data.taxRates}
                    suppliers={data.suppliers}
                />
            )}

            {modals.inquiryModal.isOpen && (
                <InquiryFormModal
                    isOpen={modals.inquiryModal.isOpen}
                    onClose={() => setters.setInquiryModal({ isOpen: false, inquiry: null })}
                    onSave={(inq) => { 
                        handleSaveItem(data.setInquiries, inq, 'brooks_inquiries');
                        setters.setInquiryModal({ isOpen: false, inquiry: null });
                    }}
                    inquiry={modals.inquiryModal.inquiry}
                    users={users}
                    customers={data.customers}
                    vehicles={data.vehicles}
                    estimates={data.estimates}
                    onViewEstimate={(est) => setters.setEstimateViewModal({ isOpen: true, estimate: est })}
                    onScheduleEstimate={(est, inqId) => setters.setScheduleJobFromEstimateModal({ isOpen: true, estimate: est, inquiryId: inqId })}
                    onEditEstimate={(est) => setters.setEstimateFormModal({ isOpen: true, estimate: est })}
                />
            )}

            {modals.checkInJob && (
                <CheckInModal 
                    isOpen={!!modals.checkInJob}
                    onClose={() => setters.setCheckInJob(null)}
                    onSave={(updatedJob) => handleSaveItem(data.setJobs, updatedJob, 'brooks_jobs')}
                    job={modals.checkInJob}
                />
            )}

            {modals.checkOutJob && (
                <CheckOutModal 
                    isOpen={!!modals.checkOutJob}
                    onClose={() => setters.setCheckOutJob(null)}
                    onSave={(updatedJob) => handleSaveItem(data.setJobs, updatedJob, 'brooks_jobs')}
                    job={modals.checkOutJob}
                    invoice={data.invoices.find(i => i.jobId === modals.checkOutJob!.id) || null}
                    vehicle={data.vehicles.find(v => v.id === modals.checkOutJob!.vehicleId) || null}
                    customer={data.customers.find(c => c.id === modals.checkOutJob!.customerId) || null}
                    onUpdateInvoice={(inv) => handleSaveItem(data.setInvoices, inv, 'brooks_invoices')}
                    taxRates={data.taxRates}
                />
            )}

            {modals.customerModal?.isOpen && modals.customerModal?.customerId && (
                <CustomerFormModal
                    isOpen={modals.customerModal.isOpen}
                    onClose={() => setters.setCustomerModal({ isOpen: false, customerId: null })}
                    onSave={(c) => handleSaveItem(actions.setCustomers, c, 'brooks_customers')}
                    customer={data.customers.find(c => c.id === modals.customerModal.customerId) || null}
                    existingCustomers={data.customers}
                    jobs={data.jobs}
                    vehicles={data.vehicles}
                    estimates={data.estimates}
                    invoices={data.invoices}
                    onViewVehicle={(vehicleId) => { setters.setCustomerModal({ isOpen: false, customerId: null }); setters.setVehicleModal({ isOpen: true, vehicleId: vehicleId }); }}
                />
            )}

            {modals.vehicleModal?.isOpen && modals.vehicleModal?.vehicleId && (
                <VehicleFormModal
                    isOpen={modals.vehicleModal.isOpen}
                    onClose={() => setters.setVehicleModal({ isOpen: false, vehicleId: null })}
                    onSave={(v) => handleSaveItem(actions.setVehicles, v, 'brooks_vehicles')}
                    vehicle={data.vehicles.find(v => v.id === modals.vehicleModal.vehicleId) || null}
                    customers={data.customers}
                    jobs={data.jobs}
                    estimates={data.estimates}
                    invoices={data.invoices}
                    purchaseOrders={data.purchaseOrders}
                    onViewJob={(jobId) => { setters.setVehicleModal({ isOpen: false, vehicleId: null }); setters.setSelectedJobId(jobId); setters.setIsEditJobModalOpen(true); }}
                    onViewEstimate={(estimate) => { setters.setVehicleModal({ isOpen: false, vehicleId: null }); setters.setEstimateViewModal({ isOpen: true, estimate: estimate }); }}
                    onViewInvoice={(invoice) => { setters.setVehicleModal({ isOpen: false, vehicleId: null }); setters.setViewInvoiceModal({ isOpen: true, invoice: invoice }); }}
                    onViewCustomer={(customerId) => { setters.setVehicleModal({ isOpen: false, vehicleId: null }); setters.setCustomerModal({ isOpen: true, customerId: customerId }); }}
                    onOpenPurchaseOrder={(po) => { setters.setVehicleModal({ isOpen: false, vehicleId: null }); setters.setViewPoModal({ isOpen: true, po }); }}
                    vehicles={data.vehicles}
                />
            )}

            {modals.partModal.isOpen && (
                <PartFormModal
                    isOpen={modals.partModal.isOpen}
                    onClose={() => setters.setPartModal({ isOpen: false, part: null, targetLineItemId: undefined })}
                    onSave={actions.handleSavePart}
                    part={modals.partModal.part}
                    suppliers={data.suppliers}
                    taxRates={data.taxRates}
                />
            )}

            {modals.vehicleHistoryReportModal?.isOpen && modals.vehicleHistoryReportModal?.vehicleId && (
                <VehicleHistoryReportModal 
                    isOpen={modals.vehicleHistoryReportModal.isOpen}
                    onClose={() => setters.setVehicleHistoryReportModal({isOpen: false, vehicleId: null})}
                    vehicleId={modals.vehicleHistoryReportModal.vehicleId}
                />
            )}
        </>
    );
};
interface PurchaseOrderViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    purchaseOrder: T.PurchaseOrder;
    onUpdate: (updatedPO: T.PurchaseOrder) => Promise<void>;
    onSend: (poId: string) => void;
    // Add '?' to make these optional for PurchaseOrdersTab.tsx
    onEditPart?: (part: any) => void; 
    handleSaveItem?: (
        setter: Dispatch<SetStateAction<any[]>>, 
        item: any, 
        collectionOverride?: string
    ) => Promise<void>;
}

export default AppModals;
