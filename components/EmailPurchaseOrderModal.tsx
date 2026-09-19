import React, { useState, useEffect, useMemo } from 'react';
import { X, Send, Mail, Building2, Truck, AlertCircle, CheckCircle2, FileText, Calendar, Hash, Loader2 } from 'lucide-react';
import { PurchaseOrder, Supplier, BusinessEntity } from '../types';
import { useApp } from '../core/state/AppContext';
import { useData } from '../core/state/DataContext';
import { sendOutboundEmail } from '../core/services/emailService';
import { saveDocument } from '../core/db';
import { 
    calculatePurchaseOrderTotals, 
    generatePurchaseOrderEmailHtml, 
    generatePurchaseOrderEmailText 
} from '../core/utils/purchaseOrderEmailUtils';
import { toast } from 'react-toastify';

export interface EmailPurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    purchaseOrder: PurchaseOrder;
    supplier?: Supplier | null;
    businessEntity?: BusinessEntity | null;
    onSuccess?: (updatedPO: PurchaseOrder) => void;
    onSend?: (recipients: string, updatedPO?: PurchaseOrder) => void; // Backward compatibility
}

export const EmailPurchaseOrderModal: React.FC<EmailPurchaseOrderModalProps> = ({ 
    isOpen, 
    onClose, 
    purchaseOrder, 
    supplier: initialSupplier, 
    businessEntity: initialEntity,
    onSuccess,
    onSend 
}) => {
    const { currentUser, businessEntities: appEntities } = useApp();
    const { suppliers, taxRates, setPurchaseOrders, setSuppliers } = useData();

    // Resolve Supplier with robust fallback
    const resolvedSupplier = useMemo(() => {
        const targetId = initialSupplier?.id || purchaseOrder.supplierId;
        if (targetId) {
            const foundById = suppliers.find(s => s.id === targetId);
            if (foundById) return foundById;
        }

        // Check line items if PO doesn't have top-level supplierId
        const lineSupplierId = purchaseOrder.lineItems?.find(li => li.supplierId)?.supplierId;
        if (lineSupplierId) {
            const matchByLine = suppliers.find(s => s.id === lineSupplierId);
            if (matchByLine) return matchByLine;
        }

        // Match by supplier name or shortCode
        const targetName = initialSupplier?.name || purchaseOrder.supplierReference;
        if (targetName) {
            const foundByName = suppliers.find(s => 
                s.name?.toLowerCase().trim() === targetName.toLowerCase().trim() ||
                (s.shortCode && s.shortCode.toLowerCase().trim() === targetName.toLowerCase().trim())
            );
            if (foundByName) return foundByName;
        }

        if (initialSupplier) return initialSupplier;
        return null;
    }, [initialSupplier, purchaseOrder.supplierId, purchaseOrder.lineItems, purchaseOrder.supplierReference, suppliers]);

    // Resolve Business Entity
    const resolvedEntity = useMemo(() => {
        if (initialEntity) return initialEntity;
        if (purchaseOrder.entityId) {
            return appEntities?.find(e => e.id === purchaseOrder.entityId) || appEntities?.[0];
        }
        return appEntities?.[0] || {
            id: 'ent_default',
            name: 'Brookspeed Automotive',
            email: 'info@brookspeed.com',
            addressLine1: '14-15 Test Lane',
            city: 'Southampton',
            postcode: 'SO16 9JX',
            vatNumber: 'GB 123 4567 89',
            type: 'Workshop'
        } as BusinessEntity;
    }, [initialEntity, purchaseOrder.entityId, appEntities]);

    // Form state
    const [recipients, setRecipients] = useState('');
    const [subject, setSubject] = useState('');
    const [customNotes, setCustomNotes] = useState('');
    const [markAsOrdered, setMarkAsOrdered] = useState(purchaseOrder.status === 'Draft');
    const [saveEmailToSupplier, setSaveEmailToSupplier] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [activeTab, setActiveTab] = useState<'preview' | 'items'>('preview');

    // Totals calculation
    const totals = useMemo(() => {
        return calculatePurchaseOrderTotals(purchaseOrder, taxRates);
    }, [purchaseOrder, taxRates]);

    const poNumber = purchaseOrder.poNumber || purchaseOrder.id;

    // Initialize defaults when modal opens - use supplier email by default
    useEffect(() => {
        if (isOpen) {
            const supplierEmail = resolvedSupplier?.email?.trim() || initialSupplier?.email?.trim() || '';
            setRecipients(supplierEmail);
            const defaultSubject = `Purchase Order #${poNumber} - ${resolvedEntity.name} [Ref: ${purchaseOrder.vehicleRegistrationRef || 'Stock'}]`;
            setSubject(defaultSubject);
            setCustomNotes('');
            setMarkAsOrdered(purchaseOrder.status === 'Draft');
            setSaveEmailToSupplier(!supplierEmail);
        }
    }, [isOpen, resolvedSupplier, initialSupplier, resolvedEntity, poNumber, purchaseOrder]);

    // If supplier email loads or updates, populate recipients by default if empty
    useEffect(() => {
        if (isOpen && resolvedSupplier?.email && !recipients) {
            setRecipients(resolvedSupplier.email.trim());
        }
    }, [isOpen, resolvedSupplier?.email, recipients]);

    if (!isOpen) return null;

    const handleSendEmail = async () => {
        const cleanRecipients = recipients.trim();
        if (!cleanRecipients) {
            toast.error('Please enter at least one recipient email address.');
            return;
        }

        setIsSending(true);
        try {
            // Generate HTML & Text payloads
            const htmlContent = generatePurchaseOrderEmailHtml(
                purchaseOrder,
                resolvedSupplier,
                resolvedEntity,
                totals,
                customNotes
            );

            const textContent = generatePurchaseOrderEmailText(
                purchaseOrder,
                resolvedSupplier,
                resolvedEntity,
                totals,
                customNotes
            );

            // Dispatch via Cloud Function
            await sendOutboundEmail({
                to: cleanRecipients,
                fromName: resolvedEntity.name,
                fromEmail: resolvedEntity.email || 'info@brookspeed.com',
                subject: subject || `Purchase Order #${poNumber} from ${resolvedEntity.name}`,
                body: htmlContent || textContent
            });

            // Update Purchase Order audit history & status
            const newStatus = markAsOrdered && purchaseOrder.status === 'Draft' ? 'Ordered' : purchaseOrder.status;
            const historyEntry = {
                userId: currentUser?.id || 'system',
                timestamp: new Date().toISOString(),
                status: `Emailed to supplier (${cleanRecipients})`
            };

            const updatedPO: PurchaseOrder = {
                ...purchaseOrder,
                status: newStatus,
                history: [...(purchaseOrder.history || []), historyEntry]
            };

            // Persist updated PO
            await saveDocument('brooks_purchaseOrders', updatedPO);
            setPurchaseOrders(prev => prev.map(po => po.id === updatedPO.id ? updatedPO : po));

            // Optionally save email to supplier profile if requested
            if (saveEmailToSupplier && resolvedSupplier && cleanRecipients.includes('@')) {
                const primaryEmail = cleanRecipients.split(/[,;]/)[0].trim();
                const updatedSupplier: Supplier = {
                    ...resolvedSupplier,
                    email: primaryEmail
                };
                await saveDocument('brooks_suppliers', updatedSupplier);
                setSuppliers(prev => prev.map(s => s.id === updatedSupplier.id ? updatedSupplier : s));
            }

            toast.success(`Purchase Order #${poNumber} successfully emailed to ${cleanRecipients}`);

            if (onSuccess) {
                onSuccess(updatedPO);
            }
            if (onSend) {
                onSend(cleanRecipients, updatedPO);
            }

            onClose();
        } catch (error: any) {
            console.error('Failed to send purchase order email:', error);
            toast.error(`Failed to send email: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/70 z-[80] flex justify-center items-center p-3 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
                
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-slate-900 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                            <Mail size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black tracking-tight">Email Purchase Order</h2>
                                <span className="bg-blue-500/30 text-blue-200 text-xs font-mono font-bold px-2 py-0.5 rounded border border-blue-400/40">
                                    #{poNumber}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300">
                                Send official order documentation directly to supplier
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        disabled={isSending}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body / Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">

                    {/* Meta Cards: Supplier & Sender */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Supplier Card */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                            <Truck size={18} className="text-blue-600 shrink-0 mt-0.5" />
                            <div className="text-xs min-w-0">
                                <span className="text-slate-500 font-bold uppercase tracking-wider block text-[10px]">Supplier</span>
                                <span className="font-bold text-slate-900 truncate block text-sm">{resolvedSupplier?.name || 'No Supplier Linked'}</span>
                                {resolvedSupplier?.contactName && <span className="text-slate-600 block">Attn: {resolvedSupplier.contactName}</span>}
                                {resolvedSupplier?.phone && <span className="text-slate-500 block">Tel: {resolvedSupplier.phone}</span>}
                            </div>
                        </div>

                        {/* Sender Card */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                            <Building2 size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                            <div className="text-xs min-w-0">
                                <span className="text-slate-500 font-bold uppercase tracking-wider block text-[10px]">Ordering Branch</span>
                                <span className="font-bold text-slate-900 truncate block text-sm">{resolvedEntity.name}</span>
                                <span className="text-slate-600 block">From: {resolvedEntity.email || 'info@brookspeed.com'}</span>
                                <span className="text-slate-500 block">VAT: {resolvedEntity.vatNumber || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Email Inputs */}
                    <div className="space-y-3 bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                        {/* Recipient Input */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                    <span>Recipient Email(s)</span>
                                    <span className="text-red-500">*</span>
                                    {resolvedSupplier?.email ? (
                                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                            Defaulted from {resolvedSupplier.name || 'supplier'}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                            No email in supplier profile
                                        </span>
                                    )}
                                </label>
                                {resolvedSupplier && (
                                    <label className="text-[11px] text-gray-500 flex items-center gap-1.5 cursor-pointer select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={saveEmailToSupplier}
                                            onChange={(e) => setSaveEmailToSupplier(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                                        />
                                        <span>Save to supplier contact card</span>
                                    </label>
                                )}
                            </div>
                            <div className="relative">
                                <input 
                                    type="text"
                                    value={recipients}
                                    onChange={(e) => setRecipients(e.target.value)}
                                    placeholder="e.g. orders@parts-supplier.co.uk, trade@parts-supplier.co.uk"
                                    className="w-full text-xs p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium text-gray-900 transition"
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1 italic">Separate multiple email addresses with commas.</p>
                        </div>

                        {/* Subject Input */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Subject Line</label>
                            <input 
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="w-full text-xs p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-semibold text-gray-900 transition"
                            />
                        </div>

                        {/* Special Instructions / Notes */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Delivery Instructions / Special Notes for Supplier</label>
                            <textarea 
                                rows={2}
                                value={customNotes}
                                onChange={(e) => setCustomNotes(e.target.value)}
                                placeholder="e.g. Urgent requirement for MOT booking tomorrow morning. Please deliver to Workshop Bay 1."
                                className="w-full text-xs p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 transition"
                            />
                        </div>

                        {/* Status Checkbox */}
                        {purchaseOrder.status === 'Draft' && (
                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-gray-800">
                                    <input 
                                        type="checkbox"
                                        checked={markAsOrdered}
                                        onChange={(e) => setMarkAsOrdered(e.target.checked)}
                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500 h-4 w-4"
                                    />
                                    <span>Automatically update PO status from 'Draft' to 'Ordered'</span>
                                </label>
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">Recommended</span>
                            </div>
                        )}
                    </div>

                    {/* Preview / Line items tabs */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                        <div className="flex border-b border-gray-200 bg-gray-50 px-4 py-2 justify-between items-center text-xs">
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('preview')}
                                    className={`px-3 py-1 font-bold rounded-lg transition ${
                                        activeTab === 'preview' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-black'
                                    }`}
                                >
                                    Document Preview
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('items')}
                                    className={`px-3 py-1 font-bold rounded-lg transition ${
                                        activeTab === 'items' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-black'
                                    }`}
                                >
                                    Line Items ({purchaseOrder.lineItems?.length || 0})
                                </button>
                            </div>
                            <div className="font-bold text-slate-800">
                                Grand Total: <span className="text-blue-600 font-mono">£{totals.grandTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        {activeTab === 'preview' ? (
                            <div className="p-4 bg-white max-h-64 overflow-y-auto text-xs space-y-3 font-sans">
                                <div className="border-b border-gray-200 pb-3 flex justify-between items-center">
                                    <div>
                                        <p className="font-extrabold text-sm text-gray-900">{resolvedEntity.name}</p>
                                        <p className="text-gray-500 text-[11px]">{resolvedEntity.addressLine1}, {resolvedEntity.city} {resolvedEntity.postcode}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] text-gray-400 font-bold uppercase">PURCHASE ORDER</p>
                                        <p className="font-black text-sm text-blue-600 font-mono">#{poNumber}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-[11px] py-1">
                                    <div>
                                        <p className="font-bold text-gray-500 uppercase text-[9px]">SUPPLIER</p>
                                        <p className="font-bold text-gray-900">{resolvedSupplier?.name || 'Supplier'}</p>
                                        <p className="text-gray-600">{resolvedSupplier?.addressLine1} {resolvedSupplier?.city}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-gray-500 uppercase text-[9px]">VEHICLE / REF</p>
                                        <p className="font-bold font-mono text-indigo-700">{purchaseOrder.vehicleRegistrationRef || 'Stock'}</p>
                                        {purchaseOrder.supplierReference && (
                                            <p className="text-gray-600">Supp. Ref: {purchaseOrder.supplierReference}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Items table preview */}
                                <table className="w-full text-left border-collapse border border-gray-200 rounded text-[11px]">
                                    <thead>
                                        <tr className="bg-gray-100 text-gray-700">
                                            <th className="p-2 border-b">Part #</th>
                                            <th className="p-2 border-b">Description</th>
                                            <th className="p-2 border-b text-center">Qty</th>
                                            <th className="p-2 border-b text-right">Price</th>
                                            <th className="p-2 border-b text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(purchaseOrder.lineItems || []).map((item, idx) => (
                                            <tr key={item.id || idx} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="p-2 font-mono font-bold text-gray-800">{item.partNumber || '-'}</td>
                                                <td className="p-2 text-gray-700">{item.description}</td>
                                                <td className="p-2 text-center font-bold">{item.quantity}</td>
                                                <td className="p-2 text-right">£{(item.unitPrice || 0).toFixed(2)}</td>
                                                <td className="p-2 text-right font-bold">£{((item.unitPrice || 0) * (item.quantity || 0)).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Totals */}
                                <div className="flex justify-end pt-2">
                                    <div className="w-48 text-[11px] space-y-1">
                                        <div className="flex justify-between text-gray-600">
                                            <span>Net Subtotal:</span>
                                            <span>£{totals.net.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-600">
                                            <span>VAT (20%):</span>
                                            <span>£{totals.vat.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between font-black text-xs text-gray-900 border-t pt-1">
                                            <span>Total Amount:</span>
                                            <span className="text-blue-600 font-mono">£{totals.grandTotal.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-white max-h-64 overflow-y-auto text-xs space-y-2">
                                {(purchaseOrder.lineItems || []).map((item, idx) => (
                                    <div key={item.id || idx} className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                                        <div>
                                            <span className="font-mono font-bold text-blue-700 mr-2">{item.partNumber || `Item #${idx+1}`}</span>
                                            <span className="font-medium text-gray-900">{item.description}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-bold text-gray-700">Qty: {item.quantity}</span>
                                            <span className="font-mono font-bold text-gray-900">£{((item.unitPrice || 0) * (item.quantity || 0)).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                        Sender: <strong className="text-gray-700">{resolvedEntity.name}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            type="button" 
                            onClick={onClose}
                            disabled={isSending}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-bold text-xs transition"
                        >
                            Cancel
                        </button>
                        <button 
                            type="button"
                            onClick={handleSendEmail}
                            disabled={isSending || !recipients.trim()}
                            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition shadow-md disabled:bg-blue-300 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {isSending ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Sending Order...</span>
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    <span>Send Purchase Order</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailPurchaseOrderModal;