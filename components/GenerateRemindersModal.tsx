import React, { useState, useEffect, useMemo } from 'react';
import { Vehicle, Customer, Reminder, ReminderType } from '../types';
import FormModal from './FormModal';
import { formatDate, addDays, dateStringToDate } from '../core/utils/dateUtils';
import { Wand2, Loader2, Calendar, CheckCircle } from 'lucide-react';
import { getCustomerDisplayName } from '../core/utils/customerUtils';

interface GenerateRemindersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (newReminders: Reminder[]) => void;
    vehicles: Vehicle[];
    customers: Customer[];
}

const GenerateRemindersModal: React.FC<GenerateRemindersModalProps> = ({ isOpen, onClose, onGenerate, vehicles, customers }) => {
    const [startDate, setStartDate] = useState(formatDate(new Date()));
    const [endDate, setEndDate] = useState(formatDate(addDays(new Date(), 30)));
    const [types, setTypes] = useState<ReminderType[]>(['MOT', 'Service']);
    const [campaignName, setCampaignName] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [previewResults, setPreviewResults] = useState<Reminder[]>([]);
    const [hasScanned, setHasScanned] = useState(false);

    // FIX: Simplified map creation to avoid generic syntax issues in some parsers
    const customerMap = useMemo(() => {
        const map = new Map<string, Customer>();
        customers.forEach(c => map.set(c.id, c));
        return map;
    }, [customers]);

    useEffect(() => {
        if (isOpen) {
            // Auto-generate a default campaign name when opening
            setCampaignName(`Reminders ${formatDate(new Date())}`);
            setStartDate(formatDate(new Date()));
            setEndDate(formatDate(addDays(new Date(), 30)));
            setHasScanned(false);
            setPreviewResults([]);
        }
    }, [isOpen]);

    const handleTypeToggle = (type: ReminderType) => {
        setTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
    };

    const scanForReminders = () => {
        setIsScanning(true);
        const results: Reminder[] = [];
        const start = dateStringToDate(startDate);
        const end = dateStringToDate(endDate);

        vehicles.forEach(vehicle => {
            const customer = customerMap.get(vehicle.customerId);
            // Must have customer consent for reminders
            if (!customer || !customer.serviceReminderConsent) return;

            // Check MOT
            if (types.includes('MOT') && vehicle.nextMotDate) {
                const motDate = dateStringToDate(vehicle.nextMotDate);
                if (motDate >= start && motDate <= end) {
                    results.push({
                        id: crypto.randomUUID(),
                        customerId: customer.id,
                        vehicleId: vehicle.id,
                        type: 'MOT',
                        dueDate: vehicle.nextMotDate,
                        status: 'Pending',
                        createdAt: new Date().toISOString(),
                        eventName: campaignName, // Tag with the campaign name
                    });
                }
            }

            // Check Service
            if (types.includes('Service') && vehicle.nextServiceDate) {
                const svcDate = dateStringToDate(vehicle.nextServiceDate);
                if (svcDate >= start && svcDate <= end) {
                    results.push({
                        id: crypto.randomUUID(),
                        customerId: customer.id,
                        vehicleId: vehicle.id,
                        type: 'Service',
                        dueDate: vehicle.nextServiceDate,
                        status: 'Pending',
                        createdAt: new Date().toISOString(),
                        eventName: campaignName,
                    });
                }
            }
            
            // Check Winter Check
            if (types.includes('Winter Check') && vehicle.winterCheckDate) {
                const wcDate = dateStringToDate(vehicle.winterCheckDate);
                if (wcDate >= start && wcDate <= end) {
                    results.push({
                         id: crypto.randomUUID(),
                        customerId: customer.id,
                        vehicleId: vehicle.id,
                        type: 'Winter Check',
                        dueDate: vehicle.winterCheckDate,
                        status: 'Pending',
                        createdAt: new Date().toISOString(),
                        eventName: campaignName,
                    });
                }
            }
        });

        // Simulate a small delay for UX
        setTimeout(() => {
            setPreviewResults(results);
            setHasScanned(true);
            setIsScanning(false);
        }, 500);
    };

    const handleConfirm = () => {
        if (!campaignName) {
            alert("Please provide a campaign name.");
            return;
        }
        onGenerate(previewResults);
        onClose();
    };

    return (
        <FormModal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Create Reminder Campaign"
            saveText={hasScanned ? `Create Campaign (${previewResults.length} Items)` : "Scan Database"}
            saveIcon={hasScanned ? CheckCircle : Wand2}
            onSave={hasScanned ? handleConfirm : scanForReminders}
        >
            <div className="space-y-6">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    <p>This tool scans your vehicle database for upcoming MOTs and Services based on the dates stored in vehicle records. It creates "Pending" reminders grouped under a Campaign Name for bulk sending.</p>
                </div>

                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                    <input 
                        type="text" 
                        value={campaignName} 
                        onChange={e => setCampaignName(e.target.value)} 
                        className="w-full p-2 border rounded" 
                        placeholder="e.g. July 2024 MOTs"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setHasScanned(false); }} className="w-full p-2 border rounded" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                        <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setHasScanned(false); }} className="w-full p-2 border rounded" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Include Types</label>
                    <div className="flex gap-4">
                        {(['MOT', 'Service', 'Winter Check'] as ReminderType[]).map(type => (
                            <label key={type} className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={types.includes(type)} 
                                    onChange={() => { handleTypeToggle(type); setHasScanned(false); }}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-700">{type}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {isScanning && (
                    <div className="flex items-center justify-center p-8 text-indigo-600">
                        <Loader2 className="animate-spin mr-2" /> Scanning database...
                    </div>
                )}

                {!isScanning && hasScanned && (
                    <div className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-100 p-2 font-semibold text-sm border-b flex justify-between">
                            <span>Preview Results</span>
                            <span>{previewResults.length} found</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                            {previewResults.length === 0 ? (
                                <p className="text-center text-gray-500 py-4 text-sm">No matching reminders found in this period.</p>
                            ) : (
                                previewResults.map(r => {
                                    const v = vehicles.find(veh => veh.id === r.vehicleId);
                                    const c = customerMap.get(r.customerId);
                                    return (
                                        <div key={r.id} className="text-xs flex justify-between p-2 hover:bg-gray-50 rounded border-b border-gray-100 last:border-0">
                                            <span className="font-mono font-bold w-20">{r.type}</span>
                                            <span className="flex-grow">{v?.registration} - {getCustomerDisplayName(c)}</span>
                                            <span className="text-gray-500">{r.dueDate}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </FormModal>
    );
};

export default GenerateRemindersModal;
