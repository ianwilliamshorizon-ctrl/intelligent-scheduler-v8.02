import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as T from './types';
import { useApp } from './core/state/AppContext';
import { getDocument, saveDocument } from './core/db';
import { getCustomerDisplayName } from './core/utils/customerUtils';
import { formatDate } from './core/utils/dateUtils';
import { DataProvider } from './core/state/DataContext';

import LoginView from './components/LoginView';
import EstimateViewModal from './components/EstimateViewModal';
import PrintableInvoice from './components/PrintableInvoice';

// Trigger background prefetch for the authenticated app
const AuthenticatedAppPromise = import('./AuthenticatedApp');
const AuthenticatedApp = lazy(() => AuthenticatedAppPromise);

const App = () => {
    const { 
        users, isAuthenticated, login, appEnvironment, businessEntities
    } = useApp();

    const [customerActionState, setCustomerActionState] = useState<'pending' | 'approved' | 'declined'>('pending');
    const [customerViewData, setCustomerViewData] = useState<{
        estimate: T.Estimate | null;
        invoice: T.Invoice | null;
        job: T.Job | null;
        customer: T.Customer | null;
        vehicle: T.Vehicle | null;
        entity: T.BusinessEntity | null;
        taxRates: T.TaxRate[];
        servicePackages: T.ServicePackage[];
        parts: T.Part[];
        inspectionTemplates: T.InspectionTemplate[];
        inspectionDiagrams: T.InspectionDiagram[];
        loading: boolean;
        error: string | null;
    }>(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const urlEstimateId = searchParams.get('estimateId');
        const urlInvoiceId = searchParams.get('invoiceId');
        const isCustomerView = searchParams.get('view') === 'customer' && urlEstimateId;
        const isInvoiceView = searchParams.get('view') === 'invoice' && urlInvoiceId;
        return {
            estimate: null,
            invoice: null,
            job: null,
            customer: null,
            vehicle: null,
            entity: null,
            taxRates: [],
            servicePackages: [],
            parts: [],
            inspectionTemplates: [],
            inspectionDiagrams: [],
            loading: !!(isCustomerView || isInvoiceView),
            error: null
        };
    });

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const urlEstimateId = searchParams.get('estimateId');
        const urlInvoiceId = searchParams.get('invoiceId');
        const isCustomerView = searchParams.get('view') === 'customer' && urlEstimateId;
        const isInvoiceView = searchParams.get('view') === 'invoice' && urlInvoiceId;
        
        if (!isCustomerView && !isInvoiceView) return;

        const loadCustomerData = async () => {
            try {
                if (isCustomerView && urlEstimateId) {
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
                    
                    const partsModule = await import('./core/data/initialData');
                    const [taxRatesData, spData, partsData] = await Promise.all([
                        partsModule.getInitialTaxRates(),
                        partsModule.getInitialServicePackages(),
                        partsModule.getInitialParts()
                    ]);

                    setCustomerViewData(prev => ({
                        ...prev,
                        estimate: estimateDoc,
                        customer: customerDoc,
                        vehicle: vehicleDoc,
                        entity: entityDoc,
                        taxRates: taxRatesData,
                        servicePackages: spData,
                        parts: partsData,
                        loading: false,
                        error: null
                    }));
                } else if (isInvoiceView && urlInvoiceId) {
                    const invoiceDoc = await getDocument<T.Invoice>('brooks_invoices', urlInvoiceId);
                    if (!invoiceDoc) {
                        setCustomerViewData(prev => ({ ...prev, loading: false, error: 'Invoice not found' }));
                        return;
                    }

                    const [customerDoc, vehicleDoc, jobDoc] = await Promise.all([
                        invoiceDoc.customerId ? getDocument<T.Customer>('brooks_customers', invoiceDoc.customerId) : null,
                        invoiceDoc.vehicleId ? getDocument<T.Vehicle>('brooks_vehicles', invoiceDoc.vehicleId) : null,
                        invoiceDoc.jobId ? getDocument<T.Job>('brooks_jobs', invoiceDoc.jobId) : null,
                    ]);

                    let entityDoc = businessEntities.find(e => e.id === invoiceDoc.entityId) || null;
                    if (!entityDoc && invoiceDoc.entityId) {
                        entityDoc = await getDocument<T.BusinessEntity>('brooks_business_entities', invoiceDoc.entityId);
                    }
                    if (!entityDoc && jobDoc?.entityId) {
                        entityDoc = await getDocument<T.BusinessEntity>('brooks_business_entities', jobDoc.entityId);
                    }
                    
                    const partsModule = await import('./core/data/initialData');
                    const [taxRatesData, spData, templatesData, diagramsData] = await Promise.all([
                        partsModule.getInitialTaxRates(),
                        partsModule.getInitialServicePackages(),
                        partsModule.getInitialInspectionTemplates(),
                        partsModule.getInitialInspectionDiagrams()
                    ]);

                    setCustomerViewData(prev => ({
                        ...prev,
                        invoice: invoiceDoc,
                        job: jobDoc,
                        customer: customerDoc,
                        vehicle: vehicleDoc,
                        entity: entityDoc,
                        taxRates: taxRatesData,
                        servicePackages: spData,
                        inspectionTemplates: templatesData,
                        inspectionDiagrams: diagramsData,
                        loading: false,
                        error: null
                    }));
                }
            } catch (err: any) {
                console.error("Error loading customer view data:", err);
                setCustomerViewData(prev => ({ ...prev, loading: false, error: err.message || 'Failed to load data' }));
            }
        };

        loadCustomerData();
    }, [businessEntities]);

    async function handleCustomerApproveEstimate(estimate: T.Estimate, selectedOptionalItemIds: string[], dateRange: any, notes: string) {
        if (estimate.jobId) { 
            // If it already has a job, we shouldn't be here in this basic flow, but just in case:
            toast.error("This estimate is already linked to a job. Please contact support.");
            return;
        }
        const customer = customerViewData.customer;
        
        const explicitItemIds = new Set((estimate.lineItems || []).filter(li => !li.isOptional || selectedOptionalItemIds.includes(li.id)).map(i => i.id));
        const allIncludedIds = new Set(explicitItemIds);
        
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
        
        try {
            let inquiryToSave: T.Inquiry | null = null;
            if (estimate.linkedInquiryId) {
                const existingInquiry = await getDocument<T.Inquiry>('brooks_inquiries', estimate.linkedInquiryId);
                if (existingInquiry) {
                    inquiryToSave = {
                        ...existingInquiry,
                        status: 'Our Action',
                        hasNewReply: true,
                        actionNotes: inquiryMessage,
                        logs: [
                            ...(existingInquiry.logs || []),
                            {
                                id: crypto.randomUUID(),
                                timestamp: new Date().toISOString(),
                                userId: 'system',
                                actionType: 'Portal Approval',
                                notes: inquiryMessage
                            }
                        ]
                    };
                }
            }

            if (!inquiryToSave) {
                inquiryToSave = { 
                    id: crypto.randomUUID(), 
                    entityId: estimate.entityId, 
                    createdAt: new Date().toISOString(), 
                    fromName: customer ? getCustomerDisplayName(customer) : "Customer", 
                    fromContact: customer?.email || customer?.mobile || "Client Portal", 
                    message: inquiryMessage, 
                    takenByUserId: 'system', 
                    status: 'Our Action', 
                    linkedCustomerId: estimate.customerId, 
                    linkedVehicleId: estimate.vehicleId, 
                    linkedEstimateId: estimate.id, 
                    actionNotes: inquiryMessage,
                    hasNewReply: true
                };
            }
            
            await saveDocument(`brooks_inquiries`, inquiryToSave);

            const updatedEstimate: T.Estimate = { 
                ...estimate, 
                status: 'Approved', 
                lineItems: approvedLineItems, 
                hasNewReply: true,
                ...(dateRange?.start && dateRange.start !== 'next-available' ? { requestedDate: dateRange.start } : {})
            };
            await saveDocument(`brooks_estimates`, updatedEstimate);
            setCustomerViewData(prev => prev.estimate ? { ...prev, estimate: updatedEstimate } : prev);
            
            toast.success(successMessage);
        } catch (e) {
            console.error(e);
            toast.error("Failed to approve estimate.");
        }
    }

    async function handleCustomerDeclineEstimate(estimate: T.Estimate, reason?: string) {
        const updatedEstimate: T.Estimate = { ...estimate, status: 'Rejected' };
        const customer = customerViewData.customer;
        
        try {
            await saveDocument(`brooks_estimates`, updatedEstimate);
            
            const inquiryMessage = `ONLINE DECLINE: Estimate #${estimate.estimateNumber}\n\n` + 
                                   `Reason for declining: ${reason || 'None provided'}`;
            
            let inquiryToSave: T.Inquiry | null = null;
            if (estimate.linkedInquiryId) {
                const existingInquiry = await getDocument<T.Inquiry>('brooks_inquiries', estimate.linkedInquiryId);
                if (existingInquiry) {
                    inquiryToSave = {
                        ...existingInquiry,
                        hasNewReply: true,
                        actionNotes: inquiryMessage,
                        logs: [
                            ...(existingInquiry.logs || []),
                            {
                                id: crypto.randomUUID(),
                                timestamp: new Date().toISOString(),
                                userId: 'system',
                                actionType: 'Portal Decline',
                                notes: inquiryMessage
                            }
                        ]
                    };
                }
            }

            if (!inquiryToSave) {
                inquiryToSave = { 
                    id: crypto.randomUUID(), 
                    entityId: estimate.entityId, 
                    createdAt: new Date().toISOString(), 
                    fromName: customer ? getCustomerDisplayName(customer) : "Customer", 
                    fromContact: customer?.email || customer?.mobile || "Client Portal", 
                    message: inquiryMessage, 
                    takenByUserId: 'system', 
                    status: 'Our Action', 
                    linkedCustomerId: estimate.customerId, 
                    linkedVehicleId: estimate.vehicleId, 
                    linkedEstimateId: estimate.id, 
                    actionNotes: inquiryMessage,
                    hasNewReply: true
                };
            }
            
            await saveDocument(`brooks_inquiries`, inquiryToSave);

            setCustomerViewData(prev => prev.estimate ? { ...prev, estimate: updatedEstimate } : prev);
            toast.success("We have received your decision. Thank you.");
        } catch (e) {
            console.error(e);
            toast.error("Failed to decline estimate.");
        }
    }

    if (customerViewData.loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-600 font-medium">Loading Document...</p>
                </div>
            </div>
        );
    }

    if (customerViewData.error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-md max-w-md w-full text-center">
                    <div className="text-red-500 mb-4 flex justify-center">
                        <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Document Unavailable</h2>
                    <p className="text-gray-600 mb-6">{customerViewData.error}</p>
                    <button 
                        onClick={() => window.location.href = window.location.origin}
                        className="w-full py-3 bg-gray-600 text-white font-bold rounded-xl hover:bg-gray-700 transition"
                    >
                        Go to Homepage
                    </button>
                </div>
            </div>
        );
    }

    if (customerViewData.estimate) {
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
                    taxRates={customerViewData.taxRates}
                    servicePackages={customerViewData.servicePackages}
                    entityDetails={customerViewData.entity || undefined}
                    onApprove={() => {}} 
                    onCustomerApprove={async (est, items, dates, notes) => {
                        await handleCustomerApproveEstimate(est, items, dates, notes);
                        setCustomerActionState('approved');
                    }}
                    onDecline={async (est, reason) => {
                        await handleCustomerDeclineEstimate(est, reason);
                        setCustomerActionState('declined');
                    }}
                    onEmailSuccess={() => {}}
                    viewMode="customer"
                    parts={customerViewData.parts}
                    users={users}
                    currentUser={dummyCustomerUser}
                />
                <ToastContainer aria-label="Notifications" />
            </div>
        );
    }

    if (customerViewData.invoice) {
        return (
            <div className="min-h-screen bg-gray-100 p-8 overflow-y-auto flex justify-center items-start">
                <div className="bg-white shadow-2xl rounded-xl w-full max-w-5xl">
                    <PrintableInvoice
                        invoice={customerViewData.invoice}
                        customer={customerViewData.customer || undefined}
                        vehicle={customerViewData.vehicle || undefined}
                        entity={customerViewData.entity || undefined}
                        job={customerViewData.job || undefined}
                        taxRates={customerViewData.taxRates}
                        servicePackages={customerViewData.servicePackages}
                        inspectionTemplates={customerViewData.inspectionTemplates || []}
                        inspectionDiagrams={customerViewData.inspectionDiagrams || []}
                        printOptions={customerViewData.invoice.printOptions}
                    />
                </div>
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

    return (
        <DataProvider>
            <Suspense fallback={
                <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-slate-600 dark:text-slate-400 font-medium animate-pulse text-sm">Loading Application...</p>
                    </div>
                </div>
            }>
                <AuthenticatedApp />
            </Suspense>
        </DataProvider>
    );
};

export default App;