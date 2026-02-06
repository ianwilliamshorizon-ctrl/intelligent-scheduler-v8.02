import React, { useState } from 'react';
import * as T from '../../types';

export interface ModalState {
    isSmartCreateOpen: boolean;
    smartCreateMode: 'job' | 'estimate';
    smartCreateDefaultDate: string | null;
    selectedJobId: string | null;
    isEditJobModalOpen: boolean;
    checkInJob: T.Job | null;
    checkOutJob: T.Job | null;
    poModal: { isOpen: boolean; po: T.PurchaseOrder | null };
    batchPoModalOpen: boolean;
    viewPoModal: { isOpen: boolean; po: T.PurchaseOrder | null };
    invoiceFormModal: { isOpen: boolean; invoice: T.Invoice | null };
    viewInvoiceModal: { isOpen: boolean; invoice: T.Invoice | null };
    salesInvoiceModal: { isOpen: boolean; invoice: T.Invoice | null };
    exportModal: { isOpen: boolean; type: 'invoices' | 'purchases'; items: any[] };
    rentalBookingModal: { isOpen: boolean; booking: Partial<T.RentalBooking> | null };
    rentalConditionModal: { isOpen: boolean; booking: T.RentalBooking | null; mode: 'checkOut' | 'checkIn' };
    rentalAgreementModal: { isOpen: boolean; booking: T.RentalBooking | null };
    rentalReturnReportModal: { isOpen: boolean; booking: T.RentalBooking | null };
    sorContractModal: { isOpen: boolean; saleVehicle: T.SaleVehicle | null };
    ownerStatementModal: { isOpen: boolean; saleVehicle: T.SaleVehicle | null };
    internalStatementModal: { isOpen: boolean; saleVehicle: T.SaleVehicle | null };
    salesReportModal: boolean;
    addSaleVehicleModalOpen: boolean;
    manageSaleVehicleModal: { isOpen: boolean; saleVehicle: T.SaleVehicle | null };
    prospectModal: { isOpen: boolean; prospect: T.Prospect | null };
    estimateFormModal: { isOpen: boolean; estimate: Partial<T.Estimate> | null };
    estimateViewModal: { isOpen: boolean; estimate: T.Estimate | null };
    scheduleJobFromEstimateModal: { isOpen: boolean; estimate: T.Estimate | null; inquiryId?: string };
    scheduleEmailModal: { isOpen: boolean; data: any };
    inquiryModal: { isOpen: boolean; inquiry: Partial<T.Inquiry> | null };
    isAssistantOpen: boolean;
    assistantContextJobId: string | null;
    customerModal: { isOpen: boolean; customerId: string | null };
    vehicleModal: { isOpen: boolean; vehicleId: string | null };
    vehicleHistoryModal: { isOpen: boolean; vehicleId: string | null };
    isNominalExportOpen: boolean;
    isCheckInModalOpen: boolean;
    isCheckOutModalOpen: boolean;
}

export interface ModalSetters {
    setIsSmartCreateOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setSmartCreateMode: React.Dispatch<React.SetStateAction<'job' | 'estimate'>>;
    setSmartCreateDefaultDate: React.Dispatch<React.SetStateAction<string | null>>;
    setSelectedJobId: React.Dispatch<React.SetStateAction<string | null>>;
    setIsEditJobModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setCheckInJob: React.Dispatch<React.SetStateAction<T.Job | null>>;
    setCheckOutJob: React.Dispatch<React.SetStateAction<T.Job | null>>;
    setPoModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; po: T.PurchaseOrder | null }>>;
    setBatchPoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setViewPoModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; po: T.PurchaseOrder | null }>>;
    setInvoiceFormModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; invoice: T.Invoice | null }>>;
    setViewInvoiceModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; invoice: T.Invoice | null }>>;
    setSalesInvoiceModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; invoice: T.Invoice | null }>>;
    setExportModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; type: 'invoices' | 'purchases'; items: any[] }>>;
    setRentalBookingModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; booking: Partial<T.RentalBooking> | null }>>;
    setRentalConditionModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; booking: T.RentalBooking | null; mode: 'checkOut' | 'checkIn' }>>;
    setRentalAgreementModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; booking: T.RentalBooking | null }>>;
    setRentalReturnReportModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; booking: T.RentalBooking | null }>>;
    setSorContractModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>>;
    setOwnerStatementModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>>;
    setInternalStatementModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>>;
    setSalesReportModal: React.Dispatch<React.SetStateAction<boolean>>;
    setAddSaleVehicleModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setManageSaleVehicleModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>>;
    setProspectModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; prospect: T.Prospect | null }>>;
    setEstimateFormModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; estimate: Partial<T.Estimate> | null }>>;
    setEstimateViewModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; estimate: T.Estimate | null }>>;
    setScheduleJobFromEstimateModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; estimate: T.Estimate | null; inquiryId?: string }>>;
    setScheduleEmailModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; data: any }>>;
    setInquiryModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; inquiry: Partial<T.Inquiry> | null }>>;
    setIsAssistantOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setAssistantContextJobId: React.Dispatch<React.SetStateAction<string | null>>;
    setCustomerModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; customerId: string | null }>>;
    setVehicleModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; vehicleId: string | null }>>;
    setVehicleHistoryModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; vehicleId: string | null }>>;
    setIsNominalExportOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsCheckInModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsCheckOutModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useModalState = (): [ModalState, ModalSetters] => {
    const [isSmartCreateOpen, setIsSmartCreateOpen] = useState(false);
    const [smartCreateMode, setSmartCreateMode] = useState<'job' | 'estimate'>('job');
    const [smartCreateDefaultDate, setSmartCreateDefaultDate] = useState<string | null>(null);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [isEditJobModalOpen, setIsEditJobModalOpen] = useState(false);
    const [checkInJob, setCheckInJob] = useState<T.Job | null>(null);
    const [checkOutJob, setCheckOutJob] = useState<T.Job | null>(null);
    const [poModal, setPoModal] = useState<{ isOpen: boolean; po: T.PurchaseOrder | null }>({ isOpen: false, po: null });
    const [batchPoModalOpen, setBatchPoModalOpen] = useState(false);
    const [viewPoModal, setViewPoModal] = useState<{ isOpen: boolean; po: T.PurchaseOrder | null }>({ isOpen: false, po: null });
    const [invoiceFormModal, setInvoiceFormModal] = useState<{ isOpen: boolean; invoice: T.Invoice | null }>({ isOpen: false, invoice: null });
    const [viewInvoiceModal, setViewInvoiceModal] = useState<{ isOpen: boolean; invoice: T.Invoice | null }>({ isOpen: false, invoice: null });
    const [salesInvoiceModal, setSalesInvoiceModal] = useState<{ isOpen: boolean; invoice: T.Invoice | null }>({ isOpen: false, invoice: null });
    const [exportModal, setExportModal] = useState<{ isOpen: boolean; type: 'invoices' | 'purchases'; items: any[] }>({ isOpen: false, type: 'invoices', items: [] });
    const [rentalBookingModal, setRentalBookingModal] = useState<{ isOpen: boolean; booking: Partial<T.RentalBooking> | null }>({ isOpen: false, booking: null });
    const [rentalConditionModal, setRentalConditionModal] = useState<{ isOpen: boolean; booking: T.RentalBooking | null; mode: 'checkOut' | 'checkIn' }>({ isOpen: false, booking: null, mode: 'checkOut' });
    const [rentalAgreementModal, setRentalAgreementModal] = useState<{ isOpen: boolean; booking: T.RentalBooking | null }>({ isOpen: false, booking: null });
    const [rentalReturnReportModal, setRentalReturnReportModal] = useState<{ isOpen: boolean; booking: T.RentalBooking | null }>({ isOpen: false, booking: null });
    const [sorContractModal, setSorContractModal] = useState<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>({ isOpen: false, saleVehicle: null });
    const [ownerStatementModal, setOwnerStatementModal] = useState<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>({ isOpen: false, saleVehicle: null });
    const [internalStatementModal, setInternalStatementModal] = useState<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>({ isOpen: false, saleVehicle: null });
    const [salesReportModal, setSalesReportModal] = useState(false);
    const [addSaleVehicleModalOpen, setAddSaleVehicleModalOpen] = useState(false);
    const [manageSaleVehicleModal, setManageSaleVehicleModal] = useState<{ isOpen: boolean; saleVehicle: T.SaleVehicle | null }>({ isOpen: false, saleVehicle: null });
    const [prospectModal, setProspectModal] = useState<{ isOpen: boolean; prospect: T.Prospect | null }>({ isOpen: false, prospect: null });
    const [estimateFormModal, setEstimateFormModal] = useState<{ isOpen: boolean; estimate: Partial<T.Estimate> | null }>({ isOpen: false, estimate: null });
    const [estimateViewModal, setEstimateViewModal] = useState<{ isOpen: boolean; estimate: T.Estimate | null }>({ isOpen: false, estimate: null });
    const [scheduleJobFromEstimateModal, setScheduleJobFromEstimateModal] = useState<{ isOpen: boolean; estimate: T.Estimate | null; inquiryId?: string }>({ isOpen: false, estimate: null });
    const [scheduleEmailModal, setScheduleEmailModal] = useState<{ isOpen: boolean; data: any }>({ isOpen: false, data: null });
    const [inquiryModal, setInquiryModal] = useState<{ isOpen: boolean; inquiry: Partial<T.Inquiry> | null }>({ isOpen: false, inquiry: null });
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [assistantContextJobId, setAssistantContextJobId] = useState<string | null>(null);
    const [customerModal, setCustomerModal] = useState<{ isOpen: boolean; customerId: string | null }>({ isOpen: false, customerId: null });
    const [vehicleModal, setVehicleModal] = useState<{ isOpen: boolean; vehicleId: string | null }>({ isOpen: false, vehicleId: null });
    const [vehicleHistoryModal, setVehicleHistoryModal] = useState<{ isOpen: boolean; vehicleId: string | null }>({ isOpen: false, vehicleId: null });

    // NEW STATES
    const [isNominalExportOpen, setIsNominalExportOpen] = useState(false);
    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
    const [isCheckOutModalOpen, setIsCheckOutModalOpen] = useState(false);

    const state: ModalState = {
        isSmartCreateOpen, smartCreateMode, smartCreateDefaultDate,
        selectedJobId, isEditJobModalOpen, checkInJob, checkOutJob,
        poModal, batchPoModalOpen, viewPoModal,
        invoiceFormModal, viewInvoiceModal, salesInvoiceModal, exportModal,
        rentalBookingModal, rentalConditionModal, rentalAgreementModal, rentalReturnReportModal,
        sorContractModal, ownerStatementModal, internalStatementModal, salesReportModal,
        addSaleVehicleModalOpen, manageSaleVehicleModal,
        prospectModal, estimateFormModal, estimateViewModal, scheduleJobFromEstimateModal,
        scheduleEmailModal, inquiryModal, isAssistantOpen, assistantContextJobId,
        customerModal, vehicleModal, vehicleHistoryModal,
        isNominalExportOpen, isCheckInModalOpen, isCheckOutModalOpen
    };

    const setters: ModalSetters = {
        setIsSmartCreateOpen, setSmartCreateMode, setSmartCreateDefaultDate,
        setSelectedJobId, setIsEditJobModalOpen, setCheckInJob, setCheckOutJob,
        setPoModal, setBatchPoModalOpen, setViewPoModal,
        setInvoiceFormModal, setViewInvoiceModal, setSalesInvoiceModal, setExportModal,
        setRentalBookingModal, setRentalConditionModal, setRentalAgreementModal, setRentalReturnReportModal,
        setSorContractModal, setOwnerStatementModal, setInternalStatementModal, setSalesReportModal,
        setAddSaleVehicleModalOpen, setManageSaleVehicleModal,
        setProspectModal, setEstimateFormModal, setEstimateViewModal, setScheduleJobFromEstimateModal,
        setScheduleEmailModal, setInquiryModal, setIsAssistantOpen, setAssistantContextJobId,
        setCustomerModal, setVehicleModal, setVehicleHistoryModal,
        setIsNominalExportOpen, setIsCheckInModalOpen, setIsCheckOutModalOpen
    };

    return [state, setters];
};