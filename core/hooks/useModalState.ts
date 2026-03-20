import React, { useState } from 'react';
import * as T from '../../types';

export interface ModalState {
    isEditJobModalOpen: boolean;
    selectedJobId: string | null;
    // Added missing jobModal state
    jobModal: { isOpen: boolean; job: T.Job | Partial<T.Job> | null }; 
    isSmartCreateOpen: boolean;
    smartCreateMode: 'job' | 'estimate';
    smartCreateDefaultDate: Date | null;
    poModal: { isOpen: boolean; po: T.PurchaseOrder | null };
    batchPoModalOpen: boolean;
    viewPoModal: { isOpen: boolean; po: T.PurchaseOrder | null };
    invoiceFormModal: { isOpen: boolean; invoice?: T.Invoice | Partial<T.Invoice> | null, job?: T.Job | null };
    viewInvoiceModal: { isOpen: boolean; invoice: T.Invoice | null };
    salesInvoiceModal: { isOpen: boolean; invoice: T.Invoice | null };
    rentalBookingModal: { isOpen: boolean; booking: T.RentalBooking | Partial<T.RentalBooking> | null };
    rentalConditionModal: { isOpen: boolean; booking: T.RentalBooking | null; mode: 'checkIn' | 'checkOut' };
    rentalAgreementModal: { isOpen: boolean; booking: T.RentalBooking | null };
    rentalReturnReportModal: { isOpen: boolean; booking: T.RentalBooking | null };
    sorContractModal: { isOpen: boolean; saleVehicle: T.SaleVehicle | null };
    ownerStatementModal: { isOpen: boolean; saleVehicle: T.SaleVehicle | null };
    internalStatementModal: { isOpen: boolean; saleVehicle: T.SaleVehicle | null };
    salesReportModal: boolean;
    addSaleVehicleModalOpen: boolean;
    manageSaleVehicleModal: { isOpen: boolean; saleVehicle: T.SaleVehicle | null };
    prospectModal: { isOpen: boolean; prospect: T.Prospect | null };
    estimateFormModal: { isOpen: boolean; estimate: T.Estimate | Partial<T.Estimate> | null };
    estimateViewModal: { isOpen: boolean; estimate: T.Estimate | null };
    scheduleJobFromEstimateModal: { isOpen: boolean; estimate: T.Estimate | null, inquiryId?: string };
    scheduleEmailModal: { isOpen: boolean; data: any | null }; 
    inquiryModal: { isOpen: boolean; inquiry: T.Inquiry | Partial<T.Inquiry> | null };
    isAssistantOpen: boolean;
    assistantContextJobId: string | null;
    checkInJob: T.Job | null;
    checkOutJob: T.Job | null;
    exportModal: { isOpen: boolean; type: 'invoices' | 'purchaseOrders' | 'jobs' | 'estimates'; items: any[] };
    customerModal: { isOpen: boolean; customerId: string | null };
    vehicleModal: { isOpen: boolean; vehicleId: string | null };
    vehicleHistoryReportModal: { isOpen: boolean; vehicleId: string | null };
}

export interface ModalSetters {
    setIsEditJobModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedJobId: React.Dispatch<React.SetStateAction<string | null>>;
    // Added missing setter type
    setJobModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; job: T.Job | Partial<T.Job> | null }>>;
    setIsSmartCreateOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setSmartCreateMode: React.Dispatch<React.SetStateAction<'job' | 'estimate'>>;
    setSmartCreateDefaultDate: React.Dispatch<React.SetStateAction<Date | null>>;
    setPoModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; po: T.PurchaseOrder | null }>>;
    setBatchPoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setViewPoModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; po: T.PurchaseOrder | null }>>;
    setInvoiceFormModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; invoice?: T.Invoice | Partial<T.Invoice> | null, job?: T.Job | null }>>;
    setViewInvoiceModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; invoice: T.Invoice | null }>>;
    setSalesInvoiceModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; invoice: T.Invoice | null }>>;
    setRentalBookingModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; booking: T.RentalBooking | Partial<T.RentalBooking> | null }>>;
    setRentalConditionModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; booking: T.RentalBooking | null; mode: 'checkIn' | 'checkOut' }>>;
    setRentalAgreementModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; booking: T.RentalBooking | null }>>;
    setRentalReturnReportModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; booking: T.RentalBooking | null }>>;
    setSorContractModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>>;
    setOwnerStatementModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>>;
    setInternalStatementModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>>;
    setSalesReportModal: React.Dispatch<React.SetStateAction<boolean>>;
    setAddSaleVehicleModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setManageSaleVehicleModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>>;
    setProspectModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; prospect: T.Prospect | null }>>;
    setEstimateFormModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; estimate: T.Estimate | Partial<T.Estimate> | null }>>;
    setEstimateViewModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; estimate: T.Estimate | null }>>;
    setScheduleJobFromEstimateModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; estimate: T.Estimate | null, inquiryId?: string }>>;
    setScheduleEmailModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; data: any | null }>>;
    setInquiryModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; inquiry: T.Inquiry | Partial<T.Inquiry> | null }>>;
    setIsAssistantOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setAssistantContextJobId: React.Dispatch<React.SetStateAction<string | null>>;
    setCheckInJob: React.Dispatch<React.SetStateAction<T.Job | null>>;
    setCheckOutJob: React.Dispatch<React.SetStateAction<T.Job | null>>;
    setExportModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; type: 'invoices' | 'purchaseOrders' | 'jobs' | 'estimates'; items: any[] }>>;
    setCustomerModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; customerId: string | null }>>;
    setVehicleModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; vehicleId: string | null }>>;
    setVehicleHistoryReportModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; vehicleId: string | null }>>;
}

const useModalState = (): [ModalState, ModalSetters] => {
    const [isEditJobModalOpen, setIsEditJobModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    // Added missing state hook
    const [jobModal, setJobModal] = useState<{ isOpen: boolean; job: T.Job | Partial<T.Job> | null }>({ isOpen: false, job: null });
    const [isSmartCreateOpen, setIsSmartCreateOpen] = useState(false);
    const [smartCreateMode, setSmartCreateMode] = useState<'job' | 'estimate'>('job');
    const [smartCreateDefaultDate, setSmartCreateDefaultDate] = useState<Date | null>(null);
    const [poModal, setPoModal] = useState<{ isOpen: boolean; po: T.PurchaseOrder | null }>({ isOpen: false, po: null });
    const [batchPoModalOpen, setBatchPoModalOpen] = useState(false);
    const [viewPoModal, setViewPoModal] = useState<{ isOpen: boolean; po: T.PurchaseOrder | null }>({ isOpen: false, po: null });
    const [invoiceFormModal, setInvoiceFormModal] = useState<{ isOpen: boolean; invoice?: T.Invoice | Partial<T.Invoice> | null, job?: T.Job | null }>({ isOpen: false, invoice: null, job: null });
    const [viewInvoiceModal, setViewInvoiceModal] = useState<{ isOpen: boolean; invoice: T.Invoice | null }>({ isOpen: false, invoice: null });
    const [salesInvoiceModal, setSalesInvoiceModal] = useState<{ isOpen: boolean; invoice: T.Invoice | null }>({ isOpen: false, invoice: null });
    const [rentalBookingModal, setRentalBookingModal] = useState<{ isOpen: boolean; booking: T.RentalBooking | Partial<T.RentalBooking> | null }>({ isOpen: false, booking: null });
    const [rentalConditionModal, setRentalConditionModal] = useState<{ isOpen: boolean; booking: T.RentalBooking | null; mode: 'checkIn' | 'checkOut' }>({ isOpen: false, booking: null, mode: 'checkOut' });
    const [rentalAgreementModal, setRentalAgreementModal] = useState<{ isOpen: boolean; booking: T.RentalBooking | null }>({ isOpen: false, booking: null });
    const [rentalReturnReportModal, setRentalReturnReportModal] = useState<{ isOpen: boolean; booking: T.RentalBooking | null }>({ isOpen: false, booking: null });
    const [sorContractModal, setSorContractModal] = useState<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>({ isOpen: false, saleVehicle: null });
    const [ownerStatementModal, setOwnerStatementModal] = useState<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>({ isOpen: false, saleVehicle: null });
    const [internalStatementModal, setInternalStatementModal] = useState<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>({ isOpen: false, saleVehicle: null });
    const [salesReportModal, setSalesReportModal] = useState(false);
    const [addSaleVehicleModalOpen, setAddSaleVehicleModalOpen] = useState(false);
    const [manageSaleVehicleModal, setManageSaleVehicleModal] = useState<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>({ isOpen: false, saleVehicle: null });
    const [prospectModal, setProspectModal] = useState<{ isOpen: boolean; prospect: T.Prospect | null }>({ isOpen: false, prospect: null });
    const [estimateFormModal, setEstimateFormModal] = useState<{ isOpen: boolean; estimate: T.Estimate | Partial<T.Estimate> | null }>({ isOpen: false, estimate: null });
    const [estimateViewModal, setEstimateViewModal] = useState<{ isOpen: boolean; estimate: T.Estimate | null }>({ isOpen: false, estimate: null });
    const [scheduleJobFromEstimateModal, setScheduleJobFromEstimateModal] = useState<{ isOpen: boolean; estimate: T.Estimate | null, inquiryId?: string }>({ isOpen: false, estimate: null });
    const [scheduleEmailModal, setScheduleEmailModal] = useState<{ isOpen: boolean; data: any | null }>({ isOpen: false, data: null });
    const [inquiryModal, setInquiryModal] = useState<{ isOpen: boolean; inquiry: T.Inquiry | Partial<T.Inquiry> | null }>({ isOpen: false, inquiry: null });
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [assistantContextJobId, setAssistantContextJobId] = useState<string | null>(null);
    const [checkInJob, setCheckInJob] = useState<T.Job | null>(null);
    const [checkOutJob, setCheckOutJob] = useState<T.Job | null>(null);
    const [exportModal, setExportModal] = useState<{ isOpen: boolean; type: 'invoices' | 'purchaseOrders' | 'jobs' | 'estimates'; items: any[] }>({ isOpen: false, type: 'invoices', items: [] });
    const [customerModal, setCustomerModal] = useState<{ isOpen: boolean; customerId: string | null }>({ isOpen: false, customerId: null });
    const [vehicleModal, setVehicleModal] = useState<{ isOpen: boolean; vehicleId: string | null }>({ isOpen: false, vehicleId: null });
    const [vehicleHistoryReportModal, setVehicleHistoryReportModal] = useState<{ isOpen: boolean; vehicleId: string | null }>({ isOpen: false, vehicleId: null });

    const state = { 
        isEditJobModalOpen, selectedJobId, jobModal, isSmartCreateOpen, smartCreateMode, smartCreateDefaultDate,
        poModal, batchPoModalOpen, viewPoModal, invoiceFormModal, viewInvoiceModal, salesInvoiceModal,
        rentalBookingModal, rentalConditionModal, rentalAgreementModal, rentalReturnReportModal,
        sorContractModal, ownerStatementModal, internalStatementModal, salesReportModal, addSaleVehicleModalOpen,
        manageSaleVehicleModal, prospectModal, estimateFormModal, estimateViewModal, scheduleJobFromEstimateModal,
        scheduleEmailModal, inquiryModal, isAssistantOpen, assistantContextJobId, checkInJob, checkOutJob,
        exportModal, customerModal, vehicleModal, vehicleHistoryReportModal
    };

    const setters = { 
        setIsEditJobModalOpen, setSelectedJobId, setJobModal, setIsSmartCreateOpen, setSmartCreateMode, setSmartCreateDefaultDate, 
        setPoModal, setBatchPoModalOpen, setViewPoModal, setInvoiceFormModal, setViewInvoiceModal,
        setSalesInvoiceModal, setRentalBookingModal, setRentalConditionModal, setRentalAgreementModal,
        setRentalReturnReportModal, setSorContractModal, setOwnerStatementModal, setInternalStatementModal,
        setSalesReportModal, setAddSaleVehicleModalOpen, setManageSaleVehicleModal, setProspectModal,
        setEstimateFormModal, setEstimateViewModal, setScheduleJobFromEstimateModal, setScheduleEmailModal,
        setInquiryModal, setIsAssistantOpen, setAssistantContextJobId, setCheckInJob, setCheckOutJob, 
        setExportModal, setCustomerModal, setVehicleModal, setVehicleHistoryReportModal
    };

    return [state, setters];
};

export default useModalState;