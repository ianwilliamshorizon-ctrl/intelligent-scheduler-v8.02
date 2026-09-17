import React, { useState, useMemo } from 'react';
import { Vehicle, Customer, Reminder, RollingCommsConfig, RollingCommsFrequency } from '../types';
import FormModal from './FormModal';
import {
    getRollingCommsConfig,
    saveRollingCommsConfig,
    scanVehiclesForRollingComms,
    computeNextRunDate
} from '../core/services/rollingCommsService';
import { Play, Check, Clock, Calendar, ShieldCheck, FileText, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { getCustomerDisplayName } from '../core/utils/customerUtils';

interface RollingCommsModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicles: Vehicle[];
    customers: Customer[];
    existingReminders: Reminder[];
    onGenerated: (newReminders: Reminder[]) => void;
}

const RollingCommsModal: React.FC<RollingCommsModalProps> = ({
    isOpen,
    onClose,
    vehicles,
    customers,
    existingReminders,
    onGenerated
}) => {
    const [config, setConfig] = useState<RollingCommsConfig>(() => getRollingCommsConfig());
    const [isRunning, setIsRunning] = useState(false);
    const [lastScanCount, setLastScanCount] = useState<number | null>(null);

    // Live preview of eligible vehicles based on current settings
    const { eligibleVehicles, newReminders } = useMemo(() => {
        return scanVehiclesForRollingComms(vehicles, customers, existingReminders, config);
    }, [vehicles, customers, existingReminders, config]);

    const handleSaveConfig = () => {
        const nextRun = computeNextRunDate(config.frequency);
        const updated = { ...config, nextRunDate: nextRun };
        saveRollingCommsConfig(updated);
        setConfig(updated);
        onClose();
    };

    const handleRunNow = () => {
        setIsRunning(true);
        setTimeout(() => {
            const scan = scanVehiclesForRollingComms(vehicles, customers, existingReminders, config);
            const nowIso = new Date().toISOString();
            const nextRun = computeNextRunDate(config.frequency);
            const updatedConfig: RollingCommsConfig = {
                ...config,
                lastRunDate: nowIso,
                nextRunDate: nextRun
            };
            saveRollingCommsConfig(updatedConfig);
            setConfig(updatedConfig);
            setLastScanCount(scan.newReminders.length);
            setIsRunning(false);

            if (scan.newReminders.length > 0) {
                onGenerated(scan.newReminders);
            }
        }, 600);
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            title="Rolling Comms Programme (MOT & Tax)"
            saveText="Save Settings"
            saveIcon={Check}
            onSave={handleSaveConfig}
            maxWidth="max-w-3xl"
        >
            <div className="space-y-6 text-gray-800">
                {/* Intro banner */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex items-start gap-3">
                    <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs mt-0.5">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-blue-950 text-sm">Automated Rolling Programme</h4>
                        <p className="text-xs text-blue-800 mt-0.5 leading-relaxed">
                            A continuous communications cycle that automatically monitors upcoming MOT expirations and Road Tax renewal dates on your configured lead time and frequency.
                        </p>
                    </div>
                </div>

                {/* Main Settings Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Status & Frequency */}
                    <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b">
                            <label className="font-bold text-sm text-gray-900">Programme Status</label>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.enabled}
                                    onChange={e => setConfig(p => ({ ...p, enabled: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {/* Frequency */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                Execution Frequency
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['Daily', 'Weekly', 'Monthly'] as RollingCommsFrequency[]).map(freq => (
                                    <button
                                        key={freq}
                                        type="button"
                                        onClick={() => setConfig(p => ({ ...p, frequency: freq }))}
                                        className={`py-2 px-3 rounded-lg text-xs font-bold transition border ${
                                            config.frequency === freq
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                                        }`}
                                    >
                                        {freq}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Configurable Lead Time */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                Notification Lead Time (Days)
                            </label>
                            <p className="text-[11px] text-gray-500 mb-2">
                                How far ahead of expiry to trigger reminders (matches the 60-day Hub window)
                            </p>
                            <div className="flex items-center gap-2">
                                {[7, 14, 30, 60, 90].map(days => (
                                    <button
                                        key={days}
                                        type="button"
                                        onClick={() => setConfig(p => ({ ...p, leadTimeDays: days }))}
                                        className={`py-1.5 px-2.5 rounded-lg text-xs font-bold border transition ${
                                            config.leadTimeDays === days
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        {days}d
                                    </button>
                                ))}
                                <input
                                    type="number"
                                    min={1}
                                    max={180}
                                    value={config.leadTimeDays}
                                    onChange={e => setConfig(p => ({ ...p, leadTimeDays: parseInt(e.target.value) || 30 }))}
                                    className="w-16 p-1.5 border rounded text-xs font-bold text-center"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Scope & Delivery */}
                    <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs space-y-4">
                        <label className="block font-bold text-sm text-gray-900 pb-2 border-b">
                            Included Reminder Channels & Types
                        </label>

                        {/* Types */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-gray-800">
                                <input
                                    type="checkbox"
                                    checked={config.includeMot}
                                    onChange={e => setConfig(p => ({ ...p, includeMot: e.target.checked }))}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>MOT Expiry Reminders</span>
                            </label>

                            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-gray-800">
                                <input
                                    type="checkbox"
                                    checked={config.includeTax}
                                    onChange={e => setConfig(p => ({ ...p, includeTax: e.target.checked }))}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>Road Tax Renewal Reminders</span>
                            </label>

                            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-gray-800">
                                <input
                                    type="checkbox"
                                    checked={!!config.includeService}
                                    onChange={e => setConfig(p => ({ ...p, includeService: e.target.checked }))}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>Annual Service Reminders</span>
                            </label>
                        </div>

                        {/* Preferred Channel */}
                        <div className="pt-2 border-t">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                Communication Channel
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['Email', 'SMS', 'Both'] as const).map(chan => (
                                    <button
                                        key={chan}
                                        type="button"
                                        onClick={() => setConfig(p => ({ ...p, channelPreference: chan }))}
                                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition ${
                                            config.channelPreference === chan
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                                        }`}
                                    >
                                        {chan}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Next Scheduled Run Info */}
                        <div className="p-2.5 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
                            <div className="flex justify-between">
                                <span>Last run:</span>
                                <span className="font-semibold text-gray-900">{config.lastRunDate ? new Date(config.lastRunDate).toLocaleString() : 'Never'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Next scheduled run:</span>
                                <span className="font-semibold text-blue-700">{config.nextRunDate || 'Upon saving'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Instant Evaluation & Fleet Preview */}
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
                    <div className="p-3 bg-gray-100 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Layers size={16} className="text-blue-600" />
                            <span className="text-xs font-black uppercase tracking-wider text-gray-800">
                                Live Fleet Preview ({eligibleVehicles.length} vehicles in {config.leadTimeDays}-day window)
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleRunNow}
                            disabled={isRunning}
                            className="py-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                            <Play size={13} className={isRunning ? 'animate-spin' : ''} />
                            {isRunning ? 'Running Programme...' : 'Run Programme Now'}
                        </button>
                    </div>

                    {lastScanCount !== null && (
                        <div className="p-3 bg-green-50 border-b border-green-200 text-xs font-bold text-green-800 flex items-center gap-2">
                            <Check size={16} />
                            Programme executed: {lastScanCount} new reminder(s) generated into Pending Reminders.
                        </div>
                    )}

                    <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                        {eligibleVehicles.length === 0 ? (
                            <div className="p-6 text-center text-xs text-gray-500">
                                No vehicles currently due for MOT or Tax within the next {config.leadTimeDays} days.
                            </div>
                        ) : (
                            eligibleVehicles.map(({ vehicle, customer, motDue, motDaysRemaining, taxDue, taxDaysRemaining }) => (
                                <div key={vehicle.id} className="p-3 hover:bg-gray-50 flex items-center justify-between text-xs gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <span className="font-mono font-black bg-yellow-400 text-black px-2 py-0.5 rounded border border-yellow-500 uppercase tracking-wide text-[11px]">
                                            {vehicle.registration}
                                        </span>
                                        <div>
                                            <p className="font-bold text-gray-900">{vehicle.make} {vehicle.model}</p>
                                            <p className="text-[11px] text-gray-500">{getCustomerDisplayName(customer)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 text-right">
                                        {motDue && (
                                            <div className="bg-blue-50 border border-blue-200 px-2 py-1 rounded text-blue-900">
                                                <span className="font-bold">MOT: </span>
                                                <span>{motDue} ({motDaysRemaining}d)</span>
                                            </div>
                                        )}
                                        {taxDue && (
                                            <div className="bg-amber-50 border border-amber-200 px-2 py-1 rounded text-amber-900">
                                                <span className="font-bold">Tax: </span>
                                                <span>{taxDue} ({taxDaysRemaining}d)</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </FormModal>
    );
};

export default RollingCommsModal;
