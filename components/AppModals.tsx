import React from 'react';
import * as T from '../types';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { formatDate } from '../core/utils/dateUtils';
import { generatePurchaseOrderId } from '../core/utils/numberGenerators';
import { ModalState, ModalSetters } from '../core/hooks/useModalState';

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

interface AppModalsProps {
    modals: ModalState;
    setters: ModalSetters;
    actions: any; 
}

const AppModals: React.FC<AppModalsProps> = ({ modals, setters, actions }) => {
    const { 
        jobs, vehicles, customers, estimates, invoices, purchaseOrders, 
        parts, servicePackages, suppliers, businessEntities, taxRates, 
        rentalBookings, rentalVehicles, 
        saleVehicles, prospects, setPurchaseOrders, setJobs, 
        setEstimates, setInvoices, setRentalBookings, 
        setSaleVehicles, setProspects, setInquiries, setParts,
        saleOverheadPackages, inquiries, batteryChargers
    } = useData();
    
    const { currentUser, selectedEntityId, confirmation, setConfirmation, users } = useApp();

    const handleSaveItem = actions.handleSaveItem;

    return (
        <>
            <ConfirmationModal 
                isOpen={confirmation?.isOpen || false} 
                title={confirmation?.title || ''} 
                message={confirmation?.message || ''} 
                onClose={() => setConfirmation({ ...confirmation, isOpen: false })} 
                onConfirm={confirmation?.onConfirm || (() => {})}
                confirmText={confirmation?.confirmText}
                cancelText={confirmation?.cancelText}
                type={confirmation?.type}
            />

            {modals.isEditJobModalOpen && modals.selectedJobId && (
                <EditJobModal
                    isOpen={modals.isEditJobModalOpen}
                    onClose={() => setters.setIsEditJobModalOpen(false)}
                    selectedJobId={modals.selectedJobId}
                    onOpenPurchaseOrder={(po) => setters.setViewPoModal({isOpen: true, po})}
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
                />
            )}

            {modals.isSmartCreateOpen && (
                <SmartCreateJobModal
                    isOpen={modals.isSmartCreateOpen}
                    onClose={() => setters.setIsSmartCreateOpen(false)}
                    creationMode={modals.smartCreateMode}
                    onJobCreate={(jobData) => { handleSaveItem(setJobs, { ...jobData, createdByUserId: currentUser.id }, 'brooks_jobs'); setters.setIsSmartCreateOpen(false); }}
                    onVehicleAndJobCreate={(c, v, j) => { handleSaveItem(actions.setCustomers, c, 'brooks_customers'); handleSaveItem(actions.setVehicles, v, 'brooks_vehicles'); handleSaveItem(setJobs, { ...j, createdByUserId: currentUser.id }, 'brooks_jobs'); setters.setIsSmartCreateOpen(false); }}
                    onEstimateCreate={(estData) => { handleSaveItem(setEstimates, estData, 'brooks_estimates'); setters.setIsSmartCreateOpen(false); }}
                    onVehicleAndEstimateCreate={(c, v, e) => { handleSaveItem(actions.setCustomers, c, 'brooks_customers'); handleSaveItem(actions.setVehicles, v, 'brooks_vehicles'); handleSaveItem(setEstimates, e, 'brooks_estimates'); setters.setIsSmartCreateOpen(false); }}
                    vehicles={vehicles}
                    customers={customers}
                    servicePackages={servicePackages}
                    defaultDate={modals.smartCreateDefaultDate}
                    initialPrompt={null}
                />
            )}

            {modals.poModal?.isOpen && (
                <PurchaseOrderFormModal
                    isOpen={modals.poModal.isOpen}
                    onClose={() => setters.setPoModal({isOpen: false, po: null})}
                    onSave={(po) => actions.handleSavePurchaseOrder({ ...po, createdByUserId: po.createdByUserId || currentUser.id })}
                    purchaseOrder={modals.poModal.po}
                    suppliers={suppliers}
                    taxRates={taxRates}
                    businessEntities={businessEntities}
                    allPurchaseOrders={purchaseOrders}
                    selectedEntityId={selectedEntityId}
                    parts={parts}
                    setParts={setParts}
                    onViewPurchaseOrder={(po) => { setters.setPoModal({isOpen: false, po: null}); setters.setViewPoModal({isOpen: true, po}); }}
                />
            )}

            {modals.batchPoModalOpen && (
                <BatchAddPurchasesModal 
                    isOpen={modals.batchPoModalOpen}
                    onClose={() => setters.setBatchPoModalOpen(false)}
                    onSave={(poData) => { 
                        const newId = `BPP944${Date.now()}`; 
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

            {modals.viewPoModal?.isOpen && modals.viewPoModal.po && (
                <PurchaseOrderViewModal
                    isOpen={modals.viewPoModal.isOpen}
                    onClose={() => setters.setViewPoModal({isOpen: false, po: null})}
                    purchaseOrder={modals.viewPoModal.po}
                    supplier={suppliers.find(s => s.id === modals.viewPoModal.po!.supplierId)}
                    entity={businessEntities.find(e => e.id === modals.viewPoModal.po!.entityId)}
                    taxRates={taxRates}
                    onSetStatusToOrdered={(po) => actions.handleSavePurchaseOrder(po)}
                    onOpenForEditing={(po) => { setters.setViewPoModal({isOpen: false, po: null}); setters.setPoModal({isOpen: true, po}); }}
                />
            )}

            {modals.invoiceFormModal?.isOpen && (
                <InvoiceFormModal 
                    isOpen={modals.invoiceFormModal.isOpen}
                    onClose={() => setters.setInvoiceFormModal({isOpen: false, invoice: null})}
                    onSave={(inv) => {
                        const finalInvoice = { ...inv, createdByUserId: inv.createdByUserId || currentUser.id };
                        handleSaveItem(setInvoices, finalInvoice, 'brooks_invoices');
                        if (finalInvoice.jobId) {
                            setJobs(prev => prev.map(j => j.id === finalInvoice.jobId ? { ...j, invoiceId: finalInvoice.id, status: 'Invoiced' } : j));
                        }
                        setters.setInvoiceFormModal({isOpen: false, invoice: null});
                        setters.setViewInvoiceModal({isOpen: true, invoice: finalInvoice});
                    }}
                    invoice={modals.invoiceFormModal.invoice}
                    customers={customers}
                    onSaveCustomer={(c) => handleSaveItem(actions.setCustomers, c, 'brooks_customers')}
                    vehicles={vehicles}
                    onSaveVehicle={(v) => handleSaveItem(actions.setVehicles, v, 'brooks_vehicles')}
                    businessEntities={businessEntities}
                    taxRates={taxRates}
                    servicePackages={servicePackages}
                    parts={parts}
                    invoices={invoices}
                />
            )}

            {modals.viewInvoiceModal?.isOpen && modals.viewInvoiceModal.invoice && (
                <InvoiceModal
                    isOpen={modals.viewInvoiceModal.isOpen}
                    onClose={() => setters.setViewInvoiceModal({isOpen: false, invoice: null})}
                    invoice={modals.viewInvoiceModal.invoice}
                    customer={customers.find(c => c.id === modals.viewInvoiceModal.invoice!.customerId)}
                    vehicle={vehicles.find(v => v.id === modals.viewInvoiceModal.invoice!.vehicleId)}
                    entity={businessEntities.find(e => e.id === modals.viewInvoiceModal.invoice!.entityId)}
                    job={jobs.find(j => j.id === modals.viewInvoiceModal.invoice!.jobId)}
                    taxRates={taxRates}
                    onUpdateInvoice={(inv) => handleSaveItem(setInvoices, inv, 'brooks_invoices')}
                    onInvoiceAction={(id) => actions.handleMarkJobAsAwaitingCollection(id)}
                />
            )}

            {modals.salesInvoiceModal?.isOpen && modals.salesInvoiceModal.invoice && (
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

            {modals.rentalBookingModal?.isOpen && (
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

            {modals.rentalConditionModal?.isOpen && modals.rentalConditionModal.booking && (
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

            {modals.rentalAgreementModal?.isOpen && modals.rentalAgreementModal.booking && (
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

            {modals.rentalReturnReportModal?.isOpen && modals.rentalReturnReportModal.booking && (
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

            {modals.sorContractModal?.isOpen && modals.sorContractModal.saleVehicle && (
                <SORContractModal 
                    isOpen={modals.sorContractModal.isOpen}
                    onClose={() => setters.setSorContractModal({isOpen: false, saleVehicle: null})}
                    saleVehicle={modals.sorContractModal.saleVehicle}
                    vehicle={vehicles.find(v => v.id === modals.sorContractModal.saleVehicle!.vehicleId)}
                    owner={customers.find(c => c.id === vehicles.find(v => v.id === modals.sorContractModal.saleVehicle!.vehicleId)?.customerId)}
                    entity={businessEntities.find(e => e.id === modals.sorContractModal.saleVehicle!.entityId)}
                />
            )}

            {modals.ownerStatementModal?.isOpen && modals.ownerStatementModal.saleVehicle && (
                <OwnerStatementModal 
                    isOpen={modals.ownerStatementModal.isOpen}
                    onClose={() => setters.setOwnerStatementModal({isOpen: false, saleVehicle: null})}
                    saleVehicle={modals.ownerStatementModal.saleVehicle}
                    vehicle={vehicles.find(v => v.id === modals.ownerStatementModal.saleVehicle!.vehicleId)}
                    owner={customers.find(c => c.id === vehicles.find(v => v.id === modals.ownerStatementModal.saleVehicle!.vehicleId)?.customerId)}
                    entity={businessEntities.find(e => e.id === modals.ownerStatementModal.saleVehicle!.entityId)}
                />
            )}

            {modals.internalStatementModal?.isOpen && modals.internalStatementModal.saleVehicle && (
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

            {modals.manageSaleVehicleModal?.isOpen && modals.manageSaleVehicleModal.saleVehicle && (
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

            {modals.prospectModal?.isOpen && (
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

            {modals.estimateFormModal?.isOpen && (
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
                />
            )}

            {modals.estimateViewModal?.isOpen && modals.estimateViewModal.estimate && (
                <EstimateViewModal 
                    isOpen={modals.estimateViewModal.isOpen}
                    onClose={() => setters.setEstimateViewModal({isOpen: false, estimate: null})}
                    estimate={modals.estimateViewModal.estimate}
                    customer={customers.find(c => c.id === modals.estimateViewModal.estimate!.customerId)}
                    vehicle={vehicles.find(v => v.id === modals.estimateViewModal.estimate!.vehicleId)}
                    taxRates={taxRates}
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
                />
            )}

            {modals.scheduleJobFromEstimateModal?.isOpen && modals.scheduleJobFromEstimateModal.estimate && (
                <ScheduleJobFromEstimateModal 
                    isOpen={modals.scheduleJobFromEstimateModal.isOpen}
                    onClose={() => setters.setScheduleJobFromEstimateModal({isOpen: false, estimate: null})}
                    onConfirm={(job, est, options) => {
                        const targetInquiryId = modals.scheduleJobFromEstimateModal.inquiryId || inquiries.find(i => i.linkedEstimateId === est.id)?.id;
                        const inquiry = targetInquiryId ? inquiries.find(i => i.id === targetInquiryId) : null;
                        
                        const linkedPOIds = inquiry?.linkedPurchaseOrderIds || [];
                        const existingDraftPOs = linkedPOIds
                            .map(id => purchaseOrders.find(po => po.id === id))
                            .filter(po => po && po.status === 'Draft');

                        let newPurchaseOrderIds: string[] = [];
                        let newPOs: T.PurchaseOrder[] = [];

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

                        const jobToSave: T.Job = {
                            ...job,
                            partsStatus: newPurchaseOrderIds.length > 0 ? 'Awaiting Order' : 'Not Required',
                            purchaseOrderIds: newPurchaseOrderIds.length > 0 ? newPurchaseOrderIds : undefined,
                            createdByUserId: currentUser.id
                        };

                        handleSaveItem(setJobs, jobToSave, 'brooks_jobs');
                        handleSaveItem(setEstimates, est, 'brooks_estimates');
                        
                        if (inquiry) {
                             const allLinkedIds = [...new Set([...(inquiry.linkedPurchaseOrderIds || []), ...newPurchaseOrderIds])];
                             const hasParts = allLinkedIds.length > 0;

                             if (!hasParts) {
                                 const closedInquiry: T.Inquiry = { ...inquiry, status: 'Closed', actionNotes: (inquiry.actionNotes || '') + '\n[System]: Job Scheduled (No Parts Required). Inquiry Closed.' };
                                 handleSaveItem(setInquiries, closedInquiry, 'brooks_inquiries');
                             } else {
                                 const updatedInquiry: T.Inquiry = { ...inquiry, status: 'In Progress', linkedPurchaseOrderIds: allLinkedIds, actionNotes: (inquiry.actionNotes || '') + `\n[System]: Job Scheduled. Parts status updated.` };
                                 handleSaveItem(setInquiries, updatedInquiry, 'brooks_inquiries');
                             }
                        }

                        setters.setScheduleJobFromEstimateModal({isOpen: false, estimate: null});
                        setters.setScheduleEmailModal({
                            isOpen: true,
                            data: {
                                job: jobToSave,
                                customer: customers.find(c => c.id === jobToSave.customerId),
                                vehicle: vehicles.find(v => v.id === jobToSave.vehicleId),
                                isAlternative: options.isAlternative,
                            }
                        });
                    }}
                />
            )}

            {/* Added logic to render the ScheduleConfirmationEmailModal which prevents line 648 crash */}
            {modals.scheduleEmailModal?.isOpen && modals.scheduleEmailModal.data && (
                <ScheduleConfirmationEmailModal
                    isOpen={modals.scheduleEmailModal.isOpen}
                    onClose={() => setters.setScheduleEmailModal({ isOpen: false, data: null })}
                    job={modals.scheduleEmailModal.data.job}
                    customer={modals.scheduleEmailModal.data.customer}
                    vehicle={modals.scheduleEmailModal.data.vehicle}
                    isAlternative={modals.scheduleEmailModal.data.isAlternative}
                />
            )}
        </>
    );
};

export default AppModals;