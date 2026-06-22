import React, { useState, useMemo } from 'react';
import * as T from '../types';
import { X, FileText, PlusCircle, Sparkles } from 'lucide-react';
import { getCustomerDisplayName } from '../core/utils/customerUtils';
import SearchableSelect from './SearchableSelect';

interface LinkEstimateModalProps {
    isOpen: boolean;
    onClose: () => void;
    inquiry: T.Inquiry;
    estimates: T.Estimate[];
    customers: T.Customer[];
    vehicles: T.Vehicle[];
    onLinkExisting: (estimateId: string) => Promise<void>;
    onCreateNew: () => void;
    onSmartCreate: (prompt: string) => void;
}

const LinkEstimateModal: React.FC<LinkEstimateModalProps> = ({
    isOpen,
    onClose,
    inquiry,
    estimates,
    customers,
    vehicles,
    onLinkExisting,
    onCreateNew,
    onSmartCreate
}) => {
    const [selectedEstimateId, setSelectedEstimateId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter estimates to only show "inflight" ones
    const activeEstimates = useMemo(() => {
        return estimates
            .filter(e => ['Draft', 'Pending Approval', 'Approved', 'Scheduled'].includes(e.status))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [estimates]);

    const estimateOptions = useMemo(() => {
        return activeEstimates.map(est => {
            const customer = customers.find(c => c.id === est.customerId);
            const vehicle = vehicles.find(v => v.id === est.vehicleId);
            const customerName = customer ? getCustomerDisplayName(customer) : 'Unknown Customer';
            const vehicleReg = vehicle ? vehicle.registration : 'Unknown Vehicle';
            
            return {
                value: est.id,
                label: `Est #${est.estimateNumber} - ${customerName} - ${vehicleReg} (${est.status})`
            };
        });
    }, [activeEstimates, customers, vehicles]);

    if (!isOpen) return null;

    const handleLink = async () => {
        if (!selectedEstimateId) return;
        setIsSubmitting(true);
        try {
            await onLinkExisting(selectedEstimateId);
            onClose();
        } catch (error) {
            console.error("Failed to link estimate:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 sm:p-6" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2" id="modal-title">
                        <FileText className="text-indigo-600" />
                        Link Estimate
                    </h2>
                    <button 
                        onClick={onClose} 
                        className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-1 rounded-full transition-colors"
                        aria-label="Close modal"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 flex-grow overflow-visible">
                    <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                        <p className="text-sm text-indigo-900 font-medium mb-1">
                            Link inquiry to an existing estimate, or create a new one.
                        </p>
                        <p className="text-xs text-indigo-700">
                            Inquiry Message: {inquiry.message?.substring(0, 100)}{inquiry.message && inquiry.message.length > 100 ? '...' : ''}
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Option 1: Link Existing Estimate
                            </label>
                            <div className="flex gap-2 items-start">
                                <div className="flex-grow">
                                    <SearchableSelect
                                        options={estimateOptions}
                                        initialValue={selectedEstimateId}
                                        onSelect={(val) => setSelectedEstimateId(val)}
                                        placeholder="Search by name, reg, or est #"
                                        className="w-full"
                                    />
                                </div>
                                <button
                                    onClick={handleLink}
                                    disabled={!selectedEstimateId || isSubmitting}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                                >
                                    {isSubmitting ? 'Linking...' : 'Link Selected'}
                                </button>
                            </div>
                        </div>

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-2 bg-white text-sm text-gray-500 font-medium">OR</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Option 2: Create New Estimate
                            </label>
                            <button
                                onClick={() => {
                                    onClose();
                                    onCreateNew();
                                }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-indigo-300 text-indigo-700 bg-indigo-50 rounded-lg font-medium hover:bg-indigo-100 transition-colors"
                            >
                                <PlusCircle size={20} />
                                Generate New Estimate Manually
                            </button>
                        </div>

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-2 bg-white text-sm text-gray-500 font-medium">OR</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-purple-700 mb-2 flex items-center gap-1">
                                <Sparkles size={14} /> Option 3: Smart Create (AI)
                            </label>
                            <button
                                onClick={() => {
                                    onClose();
                                    const fullPrompt = [
                                        `Customer Name: ${inquiry.fromName || 'Unknown'}`,
                                        inquiry.fromEmail ? `Email: ${inquiry.fromEmail}` : null,
                                        inquiry.fromPhone ? `Phone: ${inquiry.fromPhone}` : null,
                                        `Request Details: ${inquiry.message || ''}`
                                    ].filter(Boolean).join('\n');
                                    onSmartCreate(fullPrompt);
                                }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-transparent shadow-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-all"
                            >
                                <Sparkles size={20} />
                                Parse Inquiry with AI
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LinkEstimateModal;
