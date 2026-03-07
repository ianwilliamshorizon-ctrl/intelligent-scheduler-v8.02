import React from 'react';
import * as T from '../types';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { formatDate } from '../core/utils/dateUtils';
import { ModalState, ModalSetters } from '../core/hooks/useModalState';

// Modal Components
import EditJobModal from './EditJobModal';
import ConfirmationModal from './ConfirmationModal';
import PurchaseOrderFormModal from './PurchaseOrderFormModal';
import BatchAddPurchasesModal from './BatchAddPurchasesModal';
import { PurchaseOrderViewModal } from './PurchaseOrderViewModal';
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

// HELPER FUNCTIONS MOVED HERE
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


// Define the shape of the actions object passed from App.tsx
interface AppModalActions {
    handleSaveItem: (setter: React.Dispatch<React.SetStateAction<any[]>>, item: any, collectionOverride?: string) => Promise<void>;
    setCustomers: React.Dispatch<React.SetStateAction<T.Customer[]>>;
    setVehicles: React.Dispatch<React.SetStateAction<T.Vehicle[]>>;
    handleSavePurchaseOrder: (po: T.PurchaseOrder) => Promise<void>;
    handleSaveEstimate: (estimate: T.Estimate) => Promise<void>;
    handleApproveEstimate: (estimate: T.Estimate, selectedOptionalItemIds: string[], notes?: string, scheduledDate?: string) => Promise<void>;
    handleCustomerApproveEstimate: (estimate: T.Estimate, selectedOptionalItemIds: string[], dateRange: any, notes: string) => void;
    handleCustomerDeclineEstimate: (estimate: T.Estimate) => void;
    updateLinkedInquiryStatus: (estimateId: string, newStatus: T.Inquiry['status'], extraUpdates?: Partial<T.Inquiry>) => Promise<void>;
    handleMarkJobAsAwaitingCollection: (jobId: string) => void;
    handleDeleteJob: (jobId: string) => Promise<void>;
    handleRefreshPurchaseOrder: (poId: string) => Promise<T.PurchaseOrder | void>;
}

interface AppModalsProps {
    modals: ModalState;
    setters: ModalSetters;
    actions: AppModalActions;
    commonProps: any;
}

const AppModals: React.FC<AppModalsProps> = ({ modals, setters, actions, commonProps }) => {
    const { 
        jobs, vehicles, customers, estimates, invoices, purchaseOrders, 
        parts, servicePackages, suppliers, businessEntities, taxRates, 
        nominalCodes, nominalCodeRules, rentalBookings, rentalVehicles, 
        saleVehicles, prospects, absenceRequests, setPurchaseOrders, setJobs, 
        setEstimates, setInvoices, setStorageBookings, setRentalBookings, 
        setSaleVehicles, setProspects, setInquiries, setParts,
        saleOverheadPackages, inquiries, batteryChargers, lifts,discountCodes,
        forceRefresh
    } = useData();
    
    const { currentUser, selectedEntityId, confirmation, setConfirmation, users } = useApp();

    // Helper for saving
    const handleSaveItem = actions.handleSaveItem;

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

            {modals.isEditJobModalOpen && modals.selectedJobId && (
                <EditJobModal
                    isOpen={true}
                    onClose={() => setters.setIsEditJobModalOpen(false)}
                    selectedJobId={modals.selectedJobId}
                    purchaseOrders={purchaseOrders}
                    onOpenPurchaseOrder={(po) => setters.setPoModal({isOpen: true, po})}
                    rentalBookings={rentalBookings}
                    onOpenRentalBooking={(b) => setters.setRentalBookingModal({isOpen: true, booking: b})}
                    onOpenConditionReport={(b, mode) => setters.setRentalConditionModal({isOpen: true, booking: b, mode})}
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
                />
            )}

            {modals.isSmartCreateOpen && (
                <SmartCreateJobModal
                    isOpen={true}
                    onClose={() => setters.setIsSmartCreateOpen(false)}
                    creationMode={modals.smartCreateMode}
                    onJobCreate={(jobData) => { handleSaveItem(setJobs, { ...jobData, createdByUserId: currentUser.id }, 'brooks_jobs'); setters.setIsSmartCreateOpen(false); }}
                    onVehicleAndJobCreate={(c, v, j) => { handleSaveItem(actions.setCustomers, c, 'brooks_customers'); handleSaveItem(actions.setVehicles, v, 'brooks_vehicles'); handleSaveItem(setJobs, { ...j, createdByUserId: currentUser.id }, 'brooks_jobs'); setters.setIsSmartCreateOpen(false); }}
                    onEstimateCreate={(estData) => { handleSaveItem(setEstimates, estData, 'brooks_estimates'); setters.setIsSmartCreateOpen(false); }}
                    onVehicleAndEstimateCreate={(c, v, e) => { handleSaveItem(actions.setCustomers, c, 'brooks_customers'); handleSaveItem(actions.setVehicles, v, 'brooks_vehicles'); handleSaveItem(setEstimates, e, 'brooks_estimates'); setters.setIsSmartCreateOpen(false); }}
                    vehicles={vehicles}
                    customers={customers}
                    servicePackages={servicePackages}
                    defaultDate={formatDate(modals.smartCreateDefaultDate)}
                    initialPrompt={null}
                />
            )}

            {modals.poModal.isOpen && (
                <PurchaseOrderFormModal
                    isOpen={true}
                    onClose={() => setters.setPoModal({isOpen: false, po: null})}
                    onSave={(po) => actions.handleSavePurchaseOrder({ ...po, createdByUserId: po.createdByUserId || currentUser.id })}
                    onSavePart={(part) => handleSaveItem(setParts, part, 'brooks_parts')}
                    purchaseOrder={modals.poModal.po}
                    suppliers={suppliers}
                    taxRates={taxRates}
                    businessEntities={businessEntities}
                    allPurchaseOrders={purchaseOrders}
                    selectedEntityId={selectedEntityId}
                    parts={parts}
                    setParts={setParts}
                    jobs={jobs}
                    vehicles={vehicles}
                    customers={customers}
                    setJobs={setJobs}
                    onViewPurchaseOrder={(po) => { setters.setPoModal({isOpen: false, po: null}); setters.setViewPoModal({isOpen: true, po: po }); }}
                    generatePurchaseOrderId={generatePurchaseOrderId}
                    forceRefresh={forceRefresh}
                />
            )}

            {modals.batchPoModalOpen && (
                <BatchAddPurchasesModal 
                    isOpen={modals.batchPoModalOpen}
                    onClose={() => setters.setBatchPoModalOpen(false)}
                    onSave={(poData) => { 
                        const entity = businessEntities.find(e => e.id === poData.entityId);
                        const entityShortCode = entity?.shortCode || 'UNK';
                        const newId = generatePurchaseOrderId(purchaseOrders, entityShortCode);
                        const newPo: T.PurchaseOrder = { id: newId, ...poData, createdByUserId: currentUser.id } as T.PurchaseOrder;
                        actions.handleSavePurchaseOrder(newPo);
                    }}
                    jobs={jobs}
                    vehicles={vehicles}
                    suppliers={suppliers}
                    taxRates={taxRates}
                    selectedEntityId={selectedEntityId}
                    businessEntities={businessEntities}
                    parts={parts}
                />
            )}

            {modals.viewPoModal.isOpen && modals.viewPoModal.po && (
                <PurchaseOrderViewModal
                    isOpen={modals.viewPoModal.isOpen}
                    onClose={() => setters.setViewPoModal({isOpen: false, po: null})}
                    purchaseOrder={modals.viewPoModal.po}
                    onUpdatePO={(updatedPO) => actions.handleSavePurchaseOrder(updatedPO)}
                />
            )}

            {modals.invoiceFormModal.isOpen && (
                 <InvoiceFormModal
                    key={modals.invoiceFormModal.invoice?.id || modals.invoiceFormModal.job?.id || 'new'}
                    isOpen={modals.invoiceFormModal.isOpen}
                    onClose={() => setters.setInvoiceFormModal({ isOpen: false, invoice: null, job: null })}
                    onSave={(inv) => {
                        const finalInvoice = { ...inv, createdByUserId: inv.createdByUserId || currentUser.id };
                        handleSaveItem(setInvoices, finalInvoice, 'brooks_invoices');
                        if (finalInvoice.jobId) {
                            const job = jobs.find(j => j.id === finalInvoice.jobId);
                            if (job) {
                                const updatedJob = { ...job, invoiceId: finalInvoice.id, status: 'Invoiced' as const };
                                handleSaveItem(setJobs, updatedJob, 'brooks_jobs');
                            }
                        }
                        setters.setInvoiceFormModal({ isOpen: false, invoice: null, job: null });
                        setters.setViewInvoiceModal({ isOpen: true, invoice: finalInvoice });
                    }}
                    invoice={modals.invoiceFormModal.invoice}
                    job={modals.invoiceFormModal.job || null}
                    customers={customers}
                    onSaveCustomer={(c) => handleSaveItem(actions.setCustomers, c, 'brooks_customers')}
                    vehicles={vehicles}
                    onSaveVehicle={(v) => handleSaveItem(actions.setVehicles, v, 'brooks_vehicles')}
                    businessEntities={businessEntities}
                    taxRates={taxRates}
                    servicePackages={servicePackages}
                    parts={parts}
                    invoices={invoices}
                    discountCodes={discountCodes}
                />
            )}

            {modals.viewInvoiceModal.isOpen && modals.viewInvoiceModal.invoice && (
                <InvoiceModal
                    isOpen={modals.viewInvoiceModal.isOpen}
                    onClose={() => setters.setViewInvoiceModal({isOpen: false, invoice: null})}
                    invoice={modals.viewInvoiceModal.invoice}
                    customer={customers.find(c => c.id === modals.viewInvoiceModal.invoice!.customerId)}
                    vehicle={vehicles.find(v => v.id === modals.viewInvoiceModal.invoice!.vehicleId)}
                    entity={businessEntities.find(e => e.id === modals.viewInvoiceModal.invoice!.entityId)}
                    job={jobs.find(j => j.id === modals.viewInvoiceModal.invoice!.jobId)}
                    taxRates={taxRates}
                    servicePackages={servicePackages}
                    onUpdateInvoice={(inv) => handleSaveItem(setInvoices, inv, 'brooks_invoices')}
                    onInvoiceAction={(id) => actions.handleMarkJobAsAwaitingCollection(id)}
                />
            )}

            {modals.salesInvoiceModal.isOpen && modals.salesInvoiceModal.invoice && (
                <SalesInvoiceModal 
                    isOpen={modals.salesInvoiceModal.isOpen}
                    onClose={() => setters.setSalesInvoiceModal({isOpen: false, invoice: null})}
                    saleVehicle={saleVehicles.find(sv => sv.id === modals.salesInvoiceModal.invoice!.saleVehicleId)!}
                    invoice={modals.salesInvoiceModal.invoice}
                    vehicle={vehicles.find(v => v.id === modals.salesInvoiceModal.invoice!.vehicleId)}
                    buyer={customers.find(c => c.id === modals.salesInvoiceModal.invoice!.customerId)}
                    entity={businessEntities.find(e => e.id === modals.salesInvoiceModal.invoice!.entityId)}
                    taxRates={taxRates}
                    onUpdateInvoice={(inv) => handleSaveItem(setInvoices, inv, 'brooks_invoices')}
                />
            )}

            {modals.rentalBookingModal.isOpen && (
                <RentalBookingModal 
                    isOpen={modals.rentalBookingModal.isOpen}
                    onClose={() => setters.setRentalBookingModal({isOpen: false, booking: null})}
                    onSave={(b) => handleSaveItem(setRentalBookings, b, 'brooks_rentalBookings')}
                    booking={modals.rentalBookingModal.booking}
                    vehicles={vehicles}
                    rentalVehicles={rentalVehicles}
                    customers={customers}
                    jobs={jobs}
                    rentalEntities={businessEntities.filter(e => e.type === 'Rentals')}
                />
            )}

            {modals.rentalConditionModal.isOpen && modals.rentalConditionModal.booking && (
                <RentalCheckInCheckOutModal 
                    isOpen={modals.rentalConditionModal.isOpen}
                    onClose={() => setters.setRentalConditionModal({isOpen: false, booking: null, mode: 'checkOut'})}
                    onSave={(b) => handleSaveItem(setRentalBookings, b, 'brooks_rentalBookings')}
                    booking={modals.rentalConditionModal.booking}
                    mode={modals.rentalConditionModal.mode}
                    rentalVehicle={rentalVehicles.find(rv => rv.id === modals.rentalConditionModal.booking!.rentalVehicleId)!}
                    vehicle={vehicles.find(v => v.id === modals.rentalConditionModal.booking!.rentalVehicleId)!}
                />
            )}

            {modals.rentalAgreementModal.isOpen && modals.rentalAgreementModal.booking && (
                <RentalAgreementModal 
                    isOpen={modals.rentalAgreementModal.isOpen}
                    onClose={() => setters.setRentalAgreementModal({isOpen: false, booking: null})}
                    booking={modals.rentalAgreementModal.booking}
                    rentalVehicle={rentalVehicles.find(rv => rv.id === modals.rentalAgreementModal.booking!.rentalVehicleId)}
                    vehicle={vehicles.find(v => v.id === modals.rentalAgreementModal.booking!.rentalVehicleId)}
                    customer={customers.find(c => c.id === modals.rentalAgreementModal.booking!.customerId)}
                    entity={businessEntities.find(e => e.id === modals.rentalAgreementModal.booking!.entityId)}
                />
            )}

            {modals.rentalReturnReportModal.isOpen && modals.rentalReturnReportModal.booking && (
                <RentalCheckInReportModal 
                    isOpen={modals.rentalReturnReportModal.isOpen}
                    onClose={() => setters.setRentalReturnReportModal({isOpen: false, booking: null})}
                    booking={modals.rentalReturnReportModal.booking}
                    rentalVehicle={rentalVehicles.find(rv => rv.id === modals.rentalReturnReportModal.booking!.rentalVehicleId)}
                    vehicle={vehicles.find(v => v.id === modals.rentalReturnReportModal.booking!.rentalVehicleId)}
                    customer={customers.find(c => c.id === modals.rentalReturnReportModal.booking!.customerId)}
                    entity={businessEntities.find(e => e.id === modals.rentalReturnReportModal.booking!.entityId)}
                />
            )}

            {modals.sorContractModal.isOpen && modals.sorContractModal.saleVehicle && (
                <SORContractModal 
                    isOpen={modals.sorContractModal.isOpen}
                    onClose={() => setters.setSorContractModal({isOpen: false, saleVehicle: null})}
                    saleVehicle={modals.sorContractModal.saleVehicle}
                    vehicle={vehicles.find(v => v.id === modals.sorContractModal.saleVehicle!.vehicleId)}
                    owner={customers.find(c => c.id === vehicles.find(v => v.id === modals.sorContractModal.saleVehicle!.vehicleId)?.customerId)}
                    entity={businessEntities.find(e => e.id === modals.sorContractModal.saleVehicle!.entityId)}
                />
            )}

            {modals.ownerStatementModal.isOpen && modals.ownerStatementModal.saleVehicle && (
                <OwnerStatementModal 
                    isOpen={modals.ownerStatementModal.isOpen}
                    onClose={() => setters.setOwnerStatementModal({isOpen: false, saleVehicle: null})}
                    saleVehicle={modals.ownerStatementModal.saleVehicle}
                    vehicle={vehicles.find(v => v.id === modals.ownerStatementModal.saleVehicle!.vehicleId)}
                    owner={customers.find(c => c.id === vehicles.find(v => v.id === modals.ownerStatementModal.saleVehicle!.vehicleId)?.customerId)}
                    entity={businessEntities.find(e => e.id === modals.ownerStatementModal.saleVehicle!.entityId)}
                />
            )}

            {modals.internalStatementModal.isOpen && modals.internalStatementModal.saleVehicle && (
                <InternalSaleStatementModal 
                    isOpen={modals.internalStatementModal.isOpen}
                    onClose={() => setters.setInternalStatementModal({isOpen: false, saleVehicle: null})}
                    saleVehicle={modals.internalStatementModal.saleVehicle}
                    vehicle={vehicles.find(v => v.id === modals.internalStatementModal.saleVehicle!.vehicleId)}
                    entity={businessEntities.find(e => e.id === modals.internalStatementModal.saleVehicle!.entityId)}
                />
            )}

            {modals.salesReportModal && (
                <SalesSummaryReportModal 
                    isOpen={modals.salesReportModal}
                    onClose={() => setters.setSalesReportModal(false)}
                    saleVehicles={saleVehicles}
                    vehicles={vehicles}
                    entity={businessEntities.find(e => e.id === selectedEntityId)}
                />
            )}

            {modals.addSaleVehicleModalOpen && (
                <AddSaleVehicleModal 
                    isOpen={modals.addSaleVehicleModalOpen}
                    onClose={() => setters.setAddSaleVehicleModalOpen(false)}
                    onSave={(sv) => handleSaveItem(setSaleVehicles, sv, 'brooks_saleVehicles')}
                    entityId={selectedEntityId}
                    vehicles={vehicles}
                    customers={customers}
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
                    onSave={(sv) => handleSaveItem(setSaleVehicles, sv, 'brooks_saleVehicles')}
                    saleVehicle={modals.manageSaleVehicleModal.saleVehicle}
                    
                    allJobs={jobs}
                    allEstimates={estimates}
                    allCustomers={customers}
                    allVehicles={vehicles}
                    allServicePackages={servicePackages}
                    allSaleOverheadPackages={saleOverheadPackages}
                    allInvoices={invoices}
                    allBatteryChargers={batteryChargers}
                    taxRates={taxRates}
                    businessEntities={businessEntities}
                    prospects={prospects}
                    
                    onSaleFinalized={(sv, inv) => {
                        handleSaveItem(setSaleVehicles, sv, 'brooks_saleVehicles');
                        handleSaveItem(setInvoices, inv, 'brooks_invoices');
                        setters.setManageSaleVehicleModal({isOpen: false, saleVehicle: null});
                        setters.setViewInvoiceModal({isOpen: true, invoice: inv});
                    }}
                    onViewStatement={(sv) => setters.setOwnerStatementModal({isOpen: true, saleVehicle: sv})}
                    onViewSORContract={(sv) => setters.setSorContractModal({isOpen: true, saleVehicle: sv})}
                    onViewInternalStatement={(sv) => setters.setInternalStatementModal({isOpen: true, saleVehicle: sv})}
                    onViewInvoice={(sv) => {
                        const inv = invoices.find(i => i.id === sv.invoiceId);
                        if(inv) setters.setSalesInvoiceModal({isOpen: true, invoice: inv});
                    }}
                    onUpdateProspect={(p) => handleSaveItem(setProspects, p, 'brooks_prospects')}
                />
            )}

            {modals.prospectModal.isOpen && (
                <ProspectFormModal 
                    isOpen={modals.prospectModal.isOpen}
                    onClose={() => setters.setProspectModal({isOpen: false, prospect: null})}
                    onSave={(p) => handleSaveItem(setProspects, p, 'brooks_prospects')}
                    prospect={modals.prospectModal.prospect}
                    entityId={selectedEntityId}
                    saleVehicles={saleVehicles}
                    vehicles={vehicles}
                    customers={customers}
                    onSaveCustomer={(c) => handleSaveItem(actions.setCustomers, c, 'brooks_customers')}
                />
            )}

            {modals.estimateFormModal.isOpen && (
                <EstimateFormModal 
                    isOpen={modals.estimateFormModal.isOpen}
                    onClose={() => setters.setEstimateFormModal({isOpen: false, estimate: null})}
                    onSave={actions.handleSaveEstimate}
                    estimate={modals.estimateFormModal.estimate}
                    customers={customers}
                    onSaveCustomer={(c) => handleSaveItem(actions.setCustomers, c, 'brooks_customers')}
                    vehicles={vehicles}
                    onSaveVehicle={(v) => handleSaveItem(actions.setVehicles, v, 'brooks_vehicles')}
                    businessEntities={businessEntities}
                    taxRates={taxRates}
                    servicePackages={servicePackages}
                    parts={parts}
                    estimates={estimates}
                    currentUser={currentUser}
                    selectedEntityId={selectedEntityId}
                    onSavePart={(part) => handleSaveItem(setParts, part, 'brooks_parts')}
                    suppliers={suppliers}
                />
            )}

            {modals.estimateViewModal.isOpen && modals.estimateViewModal.estimate && (
                <EstimateViewModal 
                    isOpen={true}
                    onClose={() => setters.setEstimateViewModal({isOpen: false, estimate: null})}
                    estimate={modals.estimateViewModal.estimate}
                    customer={customers.find(c => c.id === modals.estimateViewModal.estimate!.customerId)}
                    vehicle={vehicles.find(v => v.id === modals.estimateViewModal.estimate!.vehicleId)}
                    taxRates={taxRates}
                    servicePackages={servicePackages}
                    entityDetails={businessEntities.find(e => e.id === modals.estimateViewModal.estimate!.entityId)}
                    onApprove={actions.handleApproveEstimate}
                    onCustomerApprove={actions.handleCustomerApproveEstimate}
                    onDecline={actions.handleCustomerDeclineEstimate}
                    onEmailSuccess={(est) => {
                        handleSaveItem(setEstimates, est, 'brooks_estimates');
                        actions.updateLinkedInquiryStatus(est.id, 'Sent');
                    }}
                    viewMode="internal"
                    parts={parts}
                    users={users}
                    currentUser={currentUser}
                    onCreateInquiry={(est) => setters.setInquiryModal({isOpen: true, inquiry: { linkedEstimateId: est.id, linkedCustomerId: est.customerId, linkedVehicleId: est.vehicleId, message: `Question regarding Estimate #${est.estimateNumber}` }})}
                    onScheduleEstimate={(est, inquiryId) => setters.setScheduleJobFromEstimateModal({isOpen: true, estimate: est, inquiryId})}
                />
            )}

            {modals.scheduleJobFromEstimateModal.isOpen && modals.scheduleJobFromEstimateModal.estimate && (
                <ScheduleJobFromEstimateModal 
                    isOpen={true}
                    onClose={() => setters.setScheduleJobFromEstimateModal({isOpen: false, estimate: null})}
                    onConfirm={(job, est, options, extraJobs) => {
                        const originalEstimate = modals.scheduleJobFromEstimateModal.estimate;
                        
                        const targetInquiryId = modals.scheduleJobFromEstimateModal.inquiryId || inquiries.find(i => i.linkedEstimateId === originalEstimate?.id)?.id;
                        const inquiry = targetInquiryId ? inquiries.find(i => i.id === targetInquiryId) : null;
                        
                        let newPurchaseOrderIds: string[] = [];
                        
                        if (originalEstimate && originalEstimate.jobId) {
                            const originJob = jobs.find(j => j.id === originalEstimate.jobId);
                            if (originJob) {
                                const updateNote = `
[System]: Supplementary Estimate #${originalEstimate.estimateNumber} was converted to a separate Job #${job.id} scheduled for ${job.scheduledDate}.`;
                                const updatedOriginJob = {
                                    ...originJob,
                                    notes: (originJob.notes || '') + updateNote
                                };
                                handleSaveItem(setJobs, updatedOriginJob, 'brooks_jobs');
                                
                                const linkedPOIds = inquiry?.linkedPurchaseOrderIds || [];
                                const posToMove = linkedPOIds
                                    .map(id => purchaseOrders.find(po => po.id === id))
                                    .filter((po): po is T.PurchaseOrder => !!po);

                                posToMove.forEach(po => {
                                    const updatedPO = { ...po, jobId: job.id };
                                    handleSaveItem(setPurchaseOrders, updatedPO, 'brooks_purchaseOrders');
                                    newPurchaseOrderIds.push(po.id);
                                });
                            }
                        } else {
                            const linkedPOIds = inquiry?.linkedPurchaseOrderIds || [];
                            const existingDraftPOs = linkedPOIds
                                .map(id => purchaseOrders.find(po => po.id === id))
                                .filter(po => po && po.status === 'Draft');

                            if (existingDraftPOs.length > 0) {
                                existingDraftPOs.forEach(po => {
                                    if (po) {
                                        const updatedPO = { ...po, jobId: job.id };
                                        handleSaveItem(setPurchaseOrders, updatedPO, 'brooks_purchaseOrders');
                                        newPurchaseOrderIds.push(po.id);
                                    }
                                });
                            } else {
                                const partItems = (est.lineItems || []).filter(li => !li.isLabor && li.partId && !li.isOptional);
                                
                                if (partItems.length > 0) {
                                     const partsBySupplier: Record<string, T.EstimateLineItem[]> = {};
                                     partItems.forEach(item => {
                                         const partDef = parts.find(p => p.id === item.partId);
                                         const supplierId = partDef?.defaultSupplierId || 'no_supplier';
                                         if (!partsBySupplier[supplierId]) partsBySupplier[supplierId] = [];
                                         partsBySupplier[supplierId].push(item);
                                     });
                                     
                                     const entity = businessEntities.find(e => e.id === job.entityId);
                                     const entityShortCode = entity?.shortCode || 'UNK';
                                     
                                     let tempAllPOs = [...purchaseOrders]; 
                                     
                                     const newPOs: T.PurchaseOrder[] = [];
                    
                                     Object.entries(partsBySupplier).forEach(([supplierId, items]) => {
                                         const newPOId = generatePurchaseOrderId(tempAllPOs, entityShortCode);
                                         const vehicle = vehicles.find(v => v.id === job.vehicleId);
                                         const newPO: T.PurchaseOrder = {
                                             id: newPOId, entityId: job.entityId, supplierId: supplierId === 'no_supplier' ? null : supplierId,
                                             vehicleRegistrationRef: vehicle?.registration || 'N/A', orderDate: formatDate(new Date()), status: 'Draft', jobId: job.id, createdByUserId: currentUser.id,
                                             lineItems: items.map(item => ({ id: crypto.randomUUID(), partNumber: item.partNumber, description: item.description, quantity: item.quantity, receivedQuantity: 0, unitPrice: item.unitCost || 0, taxCodeId: item.taxCodeId }))
                                         };
                                         newPOs.push(newPO); 
                                         newPurchaseOrderIds.push(newPOId); 
                                         tempAllPOs.push(newPO);
                                     });
                                     
                                     newPOs.forEach(po => handleSaveItem(setPurchaseOrders, po, 'brooks_purchaseOrders'));
                                }
                            }
                        }

                        const jobToSave: T.Job = {
                            ...job,
                            partsStatus: newPurchaseOrderIds.length > 0 ? 'Awaiting Order' : 'Not Required',
                            purchaseOrderIds: newPurchaseOrderIds.length > 0 ? newPurchaseOrderIds : undefined,
                            createdByUserId: currentUser.id
                        };

                        handleSaveItem(setJobs, jobToSave, 'brooks_jobs');
                        
                        // Handle any extra jobs (like separate MOT booking)
                        if (extraJobs && extraJobs.length > 0) {
                            extraJobs.forEach(extraJob => {
                                handleSaveItem(setJobs, { ...extraJob, createdByUserId: currentUser.id }, 'brooks_jobs');
                            });
                        }
                        
                        handleSaveItem(setEstimates, est, 'brooks_estimates');
                        
                        if (inquiry) {
                             const allLinkedIds = [...new Set([...(inquiry.linkedPurchaseOrderIds || []), ...newPurchaseOrderIds])];
                             
                             const hasParts = allLinkedIds.length > 0;

                             if (!hasParts) {
                                 const closedInquiry: T.Inquiry = { ...inquiry, status: 'Closed', actionNotes: (inquiry.actionNotes || '') + `
[System]: Job Scheduled (No Parts Required). Inquiry Closed.` };
                                 handleSaveItem(setInquiries, closedInquiry, 'brooks_inquiries');
                             } else {
                                 const updatedInquiry: T.Inquiry = { ...inquiry, status: 'In Progress', linkedPurchaseOrderIds: allLinkedIds, actionNotes: (inquiry.actionNotes || '') + `
[System]: Job Scheduled. Parts status updated.` };
                                 handleSaveItem(setInquiries, updatedInquiry, 'brooks_inquiries');
                             }
                        }

                        setters.setScheduleJobFromEstimateModal({isOpen: false, estimate: null});
                        
                        const extraJobMsg = extraJobs && extraJobs.length > 0 ? ` plus ${extraJobs.length} linked job(s)` : '';
                        setConfirmation({
                            isOpen: true, 
                            title: 'Job Scheduled', 
                            message: `Job #${jobToSave.id} has been scheduled for ${jobToSave.scheduledDate}${extraJobMsg}.`, 
                            type: 'success'
                        });
                    }}
                    estimate={modals.scheduleJobFromEstimateModal.estimate}
                    customer={customers.find(c => c.id === modals.scheduleJobFromEstimateModal.estimate!.customerId)}
                    vehicle={vehicles.find(v => v.id === modals.scheduleJobFromEstimateModal.estimate!.vehicleId)}
                    jobs={jobs}
                    vehicles={vehicles}
                    maxDailyCapacityHours={businessEntities.find(e => e.id === modals.scheduleJobFromEstimateModal.estimate!.entityId)?.dailyCapacityHours || 40}
                    businessEntities={businessEntities}
                    customers={customers}
                    absenceRequests={absenceRequests}
                    onEditJob={(id) => { setters.setSelectedJobId(id); setters.setIsEditJobModalOpen(true); }}
                />
            )}

            {modals.scheduleEmailModal.isOpen && (
                <ScheduleConfirmationEmailModal 
                    isOpen={modals.scheduleEmailModal.isOpen}
                    onClose={() => setters.setScheduleEmailModal({isOpen: false, data: null})}
                    onSend={() => {
                        setters.setScheduleEmailModal({isOpen: false, data: null});
                        setConfirmation({isOpen: true, title: 'Email Sent', message: 'Booking confirmation email sent.', type: 'success'});
                    }}
                    data={modals.scheduleEmailModal.data}
                />
            )}

            {modals.inquiryModal.isOpen && (
                <InquiryFormModal 
                    isOpen={modals.inquiryModal.isOpen}
                    onClose={() => setters.setInquiryModal({isOpen: false, inquiry: null})}
                    onSave={(inq) => handleSaveItem(setInquiries, inq, 'brooks_inquiries')}
                    inquiry={modals.inquiryModal.inquiry}
                    users={users}
                    customers={customers}
                    vehicles={vehicles}
                    estimates={estimates}
                    onViewEstimate={(est) => setters.setEstimateViewModal({isOpen: true, estimate: est})}
                    onScheduleEstimate={(est, inquiryId) => setters.setScheduleJobFromEstimateModal({isOpen: true, estimate: est, inquiryId})}
                    onOpenPurchaseOrder={(po) => setters.setViewPoModal({isOpen: true, po: po})}
                    onEditEstimate={(est) => setters.setEstimateFormModal({isOpen: true, estimate: est})}
                />
            )}

            {modals.isAssistantOpen && (
                <LiveAssistant 
                    isOpen={modals.isAssistantOpen}
                    onClose={() => setters.setIsAssistantOpen(false)}
                    jobId={modals.assistantContextJobId}
                    onAddNote={() => {}}
                    onReviewPackage={() => {}}
                />
            )}

            {modals.checkInJob && (
                <CheckInModal 
                    isOpen={!!modals.checkInJob}
                    onClose={() => setters.setCheckInJob(null)}
                    onSave={(updatedJob) => handleSaveItem(setJobs, updatedJob, 'brooks_jobs')}
                    job={modals.checkInJob}
                />
            )}

            {modals.checkOutJob && (
                <CheckOutModal 
                    isOpen={!!modals.checkOutJob}
                    onClose={() => setters.setCheckOutJob(null)}
                    onSave={(updatedJob) => handleSaveItem(setJobs, updatedJob, 'brooks_jobs')}
                    job={modals.checkOutJob}
                    invoice={invoices.find(i => i.jobId === modals.checkOutJob!.id) || null}
                    vehicle={vehicles.find(v => v.id === modals.checkOutJob!.vehicleId) || null}
                    customer={customers.find(c => c.id === modals.checkOutJob!.customerId) || null}
                    onUpdateInvoice={(inv) => handleSaveItem(setInvoices, inv, 'brooks_invoices')}
                />
            )}

            {modals.exportModal.isOpen && (
                <NominalCodeExportModal 
                    isOpen={modals.exportModal.isOpen}
                    onClose={() => setters.setExportModal({isOpen: false, type: 'invoices', items: []})}
                    type={'purchases'}
                    items={modals.exportModal.items}
                    nominalCodes={nominalCodes}
                    nominalCodeRules={nominalCodeRules}
                    customers={customers}
                    vehicles={vehicles}
                    taxRates={taxRates}
                />
            )}

            {modals.customerModal?.isOpen && modals.customerModal?.customerId && (
                <CustomerFormModal
                    isOpen={modals.customerModal.isOpen}
                    onClose={() => setters.setCustomerModal({ isOpen: false, customerId: null })}
                    onSave={(c) => handleSaveItem(actions.setCustomers, c, 'brooks_customers')}
                    customer={customers.find(c => c.id === modals.customerModal.customerId) || null}
                    existingCustomers={customers}
                    jobs={jobs}
                    vehicles={vehicles}
                    estimates={estimates}
                    invoices={invoices}
                    onViewVehicle={(vehicleId) => setters.setVehicleModal({ isOpen: true, vehicleId })}
                />
            )}

            {modals.vehicleModal?.isOpen && modals.vehicleModal?.vehicleId && (
                <VehicleFormModal
                    isOpen={modals.vehicleModal.isOpen}
                    onClose={() => setters.setVehicleModal({ isOpen: false, vehicleId: null })}
                    onSave={(v) => handleSaveItem(actions.setVehicles, v, 'brooks_vehicles')}
                    vehicle={vehicles.find(v => v.id === modals.vehicleModal.vehicleId) || null}
                    customers={customers}
                    jobs={jobs}
                    estimates={estimates}
                    invoices={invoices}
                    onViewJob={(jobId) => { setters.setVehicleModal({ isOpen: false, vehicleId: null }); setters.setSelectedJobId(jobId); setters.setIsEditJobModalOpen(true); }}
                    onViewEstimate={(est) => { setters.setVehicleModal({ isOpen: false, vehicleId: null }); setters.setEstimateViewModal({ isOpen: true, estimate: est }); }}
                    onViewInvoice={(inv) => { setters.setVehicleModal({ isOpen: false, vehicleId: null }); setters.setViewInvoiceModal({ isOpen: true, invoice: inv }); }}
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

export default AppModals;
