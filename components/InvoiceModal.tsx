import React, { useState, useMemo } from 'react';
import { Invoice, Customer, Vehicle, BusinessEntity, Job, TaxRate, ServicePackage, InspectionTemplate, InspectionDiagram } from '../types';
import { X, Printer, CheckCircle, Mail, Edit, Sparkles, Loader2, User, UserPlus, UserCheck, AlertTriangle, Plus } from 'lucide-react';
import { usePrint } from '../core/hooks/usePrint';
import PrintableInvoice from './PrintableInvoice';
import EmailInvoiceModal from './EmailInvoiceModal';
import CustomerFormModal from './CustomerFormModal';
import SearchableSelect from './SearchableSelect';
import { sendOutboundEmail } from '../core/services/emailService';
import { generateFinalInvoiceNotes } from '../core/services/geminiService';

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice;
    customer?: Customer | null;
    vehicle?: Vehicle | null;
    entity?: BusinessEntity | null;
    job?: Job | null;
    taxRates: TaxRate[];
    servicePackages: ServicePackage[];
    inspectionTemplates: InspectionTemplate[];
    inspectionDiagrams: InspectionDiagram[];
    customers?: Customer[];
    vehicles?: Vehicle[];
    onUpdateInvoice: (invoice: Invoice) => void;
    onAssignCustomer?: (invoiceId: string, customerId: string) => Promise<void>;
    onSaveCustomer?: (customer: Customer) => Promise<any>;
    onInvoiceAction?: (jobId: string) => void;
    onEdit?: (invoice: Invoice) => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ 
    isOpen, onClose, invoice, customer, vehicle, entity, job, 
    taxRates, servicePackages, inspectionTemplates, inspectionDiagrams, 
    customers = [], vehicles = [], onUpdateInvoice, onAssignCustomer, onSaveCustomer,
    onInvoiceAction, onEdit 
}) => {
    const print = usePrint();
    const [isEmailing, setIsEmailing] = useState(false);
    const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
    const [invoiceNotes, setInvoiceNotes] = useState('');
    const [isChangingCustomer, setIsChangingCustomer] = useState(false);
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);

    const vehicleOwner = useMemo(() => {
        if (!vehicle?.customerId || !customers) return null;
        return customers.find(c => c.id === vehicle.customerId) || null;
    }, [vehicle?.customerId, customers]);

    const customerOptions = useMemo(() => (customers || []).map(c => ({
        label: c.companyName ? `${c.companyName} (${c.forename || ''} ${c.surname || ''})`.trim() : `${c.forename || ''} ${c.surname || ''}`.trim() || 'Unnamed Customer',
        value: c.id,
        description: [c.phone || c.mobile, c.email].filter(Boolean).join(' | ') || 'No contact info',
        searchField: `${c.companyName || ''} ${c.forename || ''} ${c.surname || ''} ${c.phone || ''} ${c.email || ''} ${c.postcode || ''}`.toLowerCase()
    })), [customers]);

    const handleAssignCustomer = async (newCustomerId: string) => {
        if (!newCustomerId || !invoice) return;
        if (onAssignCustomer) {
            await onAssignCustomer(invoice.id, newCustomerId);
        } else {
            onUpdateInvoice({ ...invoice, customerId: newCustomerId });
        }
        setIsChangingCustomer(false);
    };

    const [printOptions, setPrintOptions] = useState(() => {
        if (invoice.printOptions) return invoice.printOptions;
        const isTrimming = entity?.id === 'ent_trimming' || entity?.name?.toLowerCase().includes('trimming');
        return {
            showInvoice: true,
            showTechNotes: !isTrimming,
            showInspections: !isTrimming,
            showMedia: !isTrimming
        };
    });

    const handlePrintOptionChange = (key: keyof typeof printOptions, value: boolean) => {
        const newOptions = { ...printOptions, [key]: value };
        setPrintOptions(newOptions);
        onUpdateInvoice({ ...invoice, printOptions: newOptions });
    };

    // Calculate Grand Total including VAT (Mirroring PrintableInvoice logic)
    const grandTotal = useMemo(() => {
        if (!invoice) return 0;
        if (invoice.totalAmount) return invoice.totalAmount;

        const safeTaxRates = Array.isArray(taxRates) ? taxRates : [];
        const standardTaxRateId = safeTaxRates.find(t => t.code === 'T1')?.id;
        const t99RateId = safeTaxRates.find(t => t.code === 'T99')?.id;
        const taxRatesMap = new Map(safeTaxRates.map(t => [t.id, t]));

        let total = 0;
        const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];

        lineItems.forEach(item => {
            if (item.isPackageComponent) return;

            const net = (item.quantity || 0) * (item.unitPrice || 0);
            total += net;

            if (item.taxCodeId === t99RateId) {
                total += (item.preCalculatedVat || 0) * (item.quantity || 1);
            } else {
                const taxCodeId = item.taxCodeId || standardTaxRateId;
                const taxRate = taxCodeId ? taxRatesMap.get(taxCodeId) : null;
                if (taxRate && taxRate.rate > 0) {
                    total += net * (taxRate.rate / 100);
                }
            }
        });

        return total;
    }, [invoice, taxRates]);

    const handlePrint = () => {
        if (job && onInvoiceAction) {
            onInvoiceAction(job.id);
        }
        print(<PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates, inspectionDiagrams, printOptions: { ...printOptions, invoiceNotes } }} />);
    };

    const handleEmailSuccess = async (recipients: string, subject: string, body: string) => {
        try {
            await sendOutboundEmail({
                to: recipients,
                fromName: entity?.name || 'Brookspeed',
                fromEmail: entity?.email || 'info@brookspeed.com',
                subject: subject,
                body: body
            });
            if (invoice) {
                onUpdateInvoice({ ...invoice, status: invoice.status === 'Draft' ? 'Sent' : invoice.status });
            }
            setIsEmailing(false);
        } catch (error: any) {
            alert(`Failed to send email: ${error.message}`);
        }
    };

    const handleGenerateNotes = async () => {
        setIsGeneratingNotes(true);
        try {
            // Gather context
            const techNotes = job?.notes || '';
            const comments = (job?.technicianObservations || []).join('. ');
            const items = invoice?.lineItems || [];
            
            const generated = await generateFinalInvoiceNotes(items, techNotes, comments);
            setInvoiceNotes(generated);
        } catch (error) {
            alert("Failed to generate AI notes. Please try again.");
            console.error(error);
        } finally {
            setIsGeneratingNotes(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[70] flex justify-center items-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col">
                    <header className="flex-shrink-0 flex flex-col p-4 border-b bg-gray-50 rounded-t-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-indigo-700">Invoice #{invoice.id}</h2>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setIsEmailing(true)}
                                    className="flex items-center py-2 px-4 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-sm transition-colors"
                                >
                                    <Mail size={16} className="mr-2"/> 
                                    <span>Email</span>
                                </button>
                                <button 
                                    onClick={handlePrint} 
                                    className="flex items-center py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
                                >
                                    <Printer size={16} className="mr-2"/> 
                                    <span>Print Document</span>
                                </button>


                                {onEdit && (
                                    <button 
                                        onClick={() => { onEdit(invoice); onClose(); }} 
                                        className="flex items-center py-2 px-4 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 shadow-sm transition-colors"
                                    >
                                        <Edit size={16} className="mr-2"/> 
                                        <span>Edit Invoice</span>
                                    </button>
                                )}
                                
                                <div className="w-px h-8 bg-gray-300 mx-1"></div>
                                <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={28} className="text-gray-400 hover:text-gray-800" /></button>
                            </div>
                        </div>

                        {/* Customer Status & Assignment Banner */}
                        {!customer ? (
                            <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-amber-900 shadow-2xs">
                                <div className="flex items-center gap-2.5">
                                    <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                                    <div>
                                        <span className="font-bold text-sm block">No Customer Linked to this Invoice.</span>
                                        <span className="text-xs text-amber-700 block">
                                            {vehicle ? `Vehicle: ${vehicle.registration} (${vehicle.make} ${vehicle.model || ''})` : 'Link a customer to enable email dispatch, accounts, and contact records.'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {vehicleOwner && (
                                        <button
                                            type="button"
                                            onClick={() => handleAssignCustomer(vehicleOwner.id)}
                                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                                        >
                                            <UserCheck size={14} /> Link Vehicle Owner ({vehicleOwner.companyName || `${vehicleOwner.forename || ''} ${vehicleOwner.surname || ''}`.trim()})
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setIsChangingCustomer(prev => !prev)}
                                        className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                                    >
                                        <UserPlus size={14} /> Select Existing Customer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingCustomer(true)}
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                                    >
                                        <Plus size={14} /> Add New Customer
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="mb-3 bg-indigo-50/70 border border-indigo-100 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-slate-700">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <User size={15} className="text-indigo-600 shrink-0" />
                                    <span className="text-indigo-900 font-bold uppercase tracking-wider text-[10px]">Customer:</span>
                                    <span className="font-bold text-slate-900 text-sm">
                                        {customer.companyName || `${customer.forename || ''} ${customer.surname || ''}`.trim() || 'Customer Record'}
                                    </span>
                                    {customer.phone && <span className="text-slate-500 font-medium">({customer.phone})</span>}
                                    {customer.email && <span className="text-slate-500">| {customer.email}</span>}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsChangingCustomer(prev => !prev)}
                                    className="text-indigo-600 hover:text-indigo-800 font-bold text-xs hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <UserPlus size={13} /> Change Customer
                                </button>
                            </div>
                        )}

                        {isChangingCustomer && (
                            <div className="mb-3 bg-white border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center gap-3 shadow-2xs">
                                <span className="text-xs font-bold text-indigo-900 whitespace-nowrap">Assign Customer:</span>
                                <div className="min-w-[280px] flex-grow max-w-md">
                                    <SearchableSelect
                                        options={customerOptions}
                                        initialValue={customer?.id}
                                        onSelect={(opt) => {
                                            const id = opt?.value || opt?.id;
                                            if (id) {
                                                handleAssignCustomer(id);
                                            }
                                        }}
                                        placeholder="Search customers by name, phone, email..."
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsChangingCustomer(false);
                                        setIsAddingCustomer(true);
                                    }}
                                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-1 shadow-2xs cursor-pointer"
                                >
                                    <Plus size={14} /> Create New Customer
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsChangingCustomer(false)}
                                    className="px-3 py-1.5 bg-gray-100 border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {/* Print Options Selection */}
                        <div className="flex flex-col gap-3 px-4 py-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                            <div className="flex items-center gap-6">
                                <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mr-2">Print Sections:</span>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" checked={printOptions.showInvoice} onChange={(e) => handlePrintOptionChange('showInvoice', e.target.checked)} className="h-4 w-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500" />
                                    <span className="text-xs font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">Invoice</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" checked={printOptions.showTechNotes} onChange={(e) => handlePrintOptionChange('showTechNotes', e.target.checked)} className="h-4 w-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500" />
                                    <span className="text-xs font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">Tech Notes</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" checked={printOptions.showInspections} onChange={(e) => handlePrintOptionChange('showInspections', e.target.checked)} className="h-4 w-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500" />
                                    <span className="text-xs font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">Inspections</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" checked={printOptions.showMedia} onChange={(e) => handlePrintOptionChange('showMedia', e.target.checked)} className="h-4 w-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500" />
                                    <span className="text-xs font-bold text-gray-700 group-hover:text-indigo-600 transition-colors">Media Shots</span>
                                </label>
                            </div>
                            <div className="flex flex-col gap-1 relative">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Final Invoice Notes (Optional):</label>
                                    <button 
                                        type="button"
                                        onClick={handleGenerateNotes}
                                        disabled={isGeneratingNotes}
                                        className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50 font-bold"
                                        title="Use AI to generate a summary thank-you note from the job's context"
                                    >
                                        {isGeneratingNotes ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                        {isGeneratingNotes ? 'Generating...' : 'AI Generate'}
                                    </button>
                                </div>
                                <textarea 
                                    value={invoiceNotes} 
                                    onChange={(e) => setInvoiceNotes(e.target.value)}
                                    placeholder="Add a final note to print on the invoice..."
                                    className="w-full text-sm border-indigo-200 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                                    rows={2}
                                />
                            </div>
                        </div>
                    </header>
                    <main className="flex-grow overflow-y-auto bg-gray-100 p-8">
                        <div className="scale-90 origin-top shadow-xl">
                            <PrintableInvoice {...{ invoice, customer, vehicle, entity, job, taxRates, servicePackages, inspectionTemplates, inspectionDiagrams, printOptions: { ...printOptions, invoiceNotes } }} />
                        </div>
                    </main>
                </div>


            </div>
            {isEmailing && (
                <EmailInvoiceModal 
                    isOpen={isEmailing} 
                    onClose={() => setIsEmailing(false)} 
                    onSend={handleEmailSuccess} 
                    invoice={invoice} 
                    customer={customer} 
                    vehicle={vehicle}
                    totalAmount={grandTotal}
                />
            )}

            {isAddingCustomer && (
                <CustomerFormModal
                    isOpen={isAddingCustomer}
                    onClose={() => setIsAddingCustomer(false)}
                    onSave={async (newCust) => {
                        if (onSaveCustomer) {
                            await onSaveCustomer(newCust);
                        }
                        await handleAssignCustomer(newCust.id);
                        setIsAddingCustomer(false);
                    }}
                    customer={{
                        serviceReminderConsent: true
                    }}
                    existingCustomers={customers || []}
                    vehicles={vehicles || []}
                    jobs={job ? [job] : []}
                    estimates={[]}
                    invoices={[invoice]}
                />
            )}
        </>
    );
};

export default InvoiceModal;
