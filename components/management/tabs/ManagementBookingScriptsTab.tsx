import React, { useState, useEffect } from 'react';
import { 
    Headphones, Save, RotateCcw, Volume2, Sparkles, Mail, Plus, Trash2, 
    Check, Info, HelpCircle, Layers, DollarSign, ShieldAlert, FileText, CheckCircle2 
} from 'lucide-react';
import { 
    BookingAssistantConfig, 
    DEFAULT_BOOKING_ASSISTANT_CONFIG, 
    getBookingAssistantConfig, 
    saveBookingAssistantConfig, 
    interpolateScript,
    BookingScriptAddon 
} from '../../../core/services/bookingAssistantConfigService';
import { formatCurrency } from '../../../core/utils/formatUtils';

interface ManagementBookingScriptsTabProps {
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const ManagementBookingScriptsTab: React.FC<ManagementBookingScriptsTabProps> = ({ onShowStatus }) => {
    const [config, setConfig] = useState<BookingAssistantConfig>(DEFAULT_BOOKING_ASSISTANT_CONFIG);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeSection, setActiveSection] = useState<'scripts' | 'bundles' | 'email'>('scripts');

    // Load initial config from database
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const data = await getBookingAssistantConfig();
                setConfig(data);
            } catch (err) {
                console.error('Failed to load booking scripts configuration:', err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const handleScriptChange = (field: keyof BookingAssistantConfig['scripts'], value: string) => {
        setConfig(prev => ({
            ...prev,
            scripts: {
                ...prev.scripts,
                [field]: value
            }
        }));
    };

    const handleEmailChange = (field: keyof BookingAssistantConfig['emailConfirmation'], value: any) => {
        setConfig(prev => ({
            ...prev,
            emailConfirmation: {
                ...prev.emailConfirmation,
                [field]: value
            }
        }));
    };

    const handleBundleChange = (index: number, field: keyof BookingScriptAddon, value: any) => {
        setConfig(prev => {
            const next = [...prev.bundles];
            next[index] = { ...next[index], [field]: value };
            return { ...prev, bundles: next };
        });
    };

    const handleAddBundle = () => {
        const newAddon: BookingScriptAddon = {
            id: `addon-${Date.now()}`,
            name: 'New Upsell Service',
            description: 'Description of service',
            standalonePrice: 95.00,
            bundledPrice: 75.00,
            laborHours: 0.5,
            isLabor: true,
            reason: 'Combined with scheduled service, saves labor setup time.',
            script: 'We normally charge £95 standalone, but if we do it today with your service, we can bundle it for £75.',
            minAgeYears: 2
        };
        setConfig(prev => ({
            ...prev,
            bundles: [...prev.bundles, newAddon]
        }));
    };

    const handleRemoveBundle = (index: number) => {
        setConfig(prev => ({
            ...prev,
            bundles: prev.bundles.filter((_, i) => i !== index)
        }));
    };

    const handleResetDefaults = () => {
        if (window.confirm('Are you sure you want to restore the default booking scripts, bundle offers, and email templates? Any unsaved edits will be lost.')) {
            setConfig(DEFAULT_BOOKING_ASSISTANT_CONFIG);
            onShowStatus('Reset to system defaults. Click "Save Configuration" to apply permanently.', 'info');
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveBookingAssistantConfig(config);
            onShowStatus('Booking reception words and email templates saved successfully to Managed Data!', 'success');
        } catch (err: any) {
            console.error('Failed to save config:', err);
            onShowStatus(`Failed to save: ${err.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12 text-slate-500 text-sm">
                Loading Booking Scripts configuration...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Save / Reset actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl">
                        <Headphones size={26} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Booking Reception Scripts & Phrasing</h2>
                        <p className="text-xs text-slate-500">
                            Configure internal staff call scripts, Done Together bundle upsells, and customer email confirmations
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                        <RotateCcw size={15} />
                        Reset Defaults
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save size={16} />
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>

            {/* Navigation Sub-Tabs */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-fit">
                <button
                    type="button"
                    onClick={() => setActiveSection('scripts')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                        activeSection === 'scripts' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Volume2 size={16} />
                    Call Scripts (Steps 1, 2 & 4)
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection('bundles')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                        activeSection === 'bundles' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Sparkles size={16} />
                    Upsell Bundles & Pitches ({config.bundles.length})
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection('email')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                        activeSection === 'email' ? 'bg-white text-indigo-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Mail size={16} />
                    Customer Confirmation Email
                </button>
            </div>

            {/* SECTION 1: CALL SCRIPTS */}
            {activeSection === 'scripts' && (
                <div className="space-y-6">
                    <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs text-amber-950 flex items-start gap-2.5">
                        <Info size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
                        <div>
                            <strong>Dynamic Placeholders:</strong> You can include placeholders in curly brackets:
                            <code className="bg-amber-100 px-1 py-0.5 rounded mx-1 font-mono">{'{companyName}'}</code>
                            <code className="bg-amber-100 px-1 py-0.5 rounded mx-1 font-mono">{'{staffName}'}</code>
                            <code className="bg-amber-100 px-1 py-0.5 rounded mx-1 font-mono">{'{vehicleMake}'}</code>
                            <code className="bg-amber-100 px-1 py-0.5 rounded mx-1 font-mono">{'{vehicleModel}'}</code>
                            <code className="bg-amber-100 px-1 py-0.5 rounded mx-1 font-mono">{'{customerName}'}</code>
                            <code className="bg-amber-100 px-1 py-0.5 rounded mx-1 font-mono">{'{bookingDate}'}</code>
                        </div>
                    </div>

                    {/* Step 1: Greeting & Vehicle Verification */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">1</span>
                            Step 1: Client Greeting & Registration Request
                        </h3>

                        <div className="space-y-4 text-sm">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    New Caller / Unknown Customer Greeting Script:
                                </label>
                                <textarea
                                    rows={2}
                                    value={config.scripts.step1GreetingNew}
                                    onChange={e => handleScriptChange('step1GreetingNew', e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-serif italic outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Existing Client Verification Script (When Vehicle/Client Matched in DMS):
                                </label>
                                <textarea
                                    rows={2}
                                    value={config.scripts.step1GreetingExisting}
                                    onChange={e => handleScriptChange('step1GreetingExisting', e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-xl text-sm font-serif italic outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    [Behind the Scenes] Operational Checklist for Receptionist:
                                </label>
                                <textarea
                                    rows={2}
                                    value={config.scripts.step1ActionNotes}
                                    onChange={e => handleScriptChange('step1ActionNotes', e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Service Presentation Strategy */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">2</span>
                            Step 2: Service Tier Presentation Strategy
                        </h3>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Spoken Script for Presenting Baseline Bronze & Upselling to Silver/Gold:
                            </label>
                            <textarea
                                rows={3}
                                value={config.scripts.step2Presentation}
                                onChange={e => handleScriptChange('step2Presentation', e.target.value)}
                                className="w-full p-3 border border-slate-300 rounded-xl text-sm font-serif italic outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Step 4: Closing Script */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">4</span>
                            Step 4: Booking Confirmation & Courtesy Vehicle Offer
                        </h3>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Final Closing Script & Courtesy Transport Offer:
                            </label>
                            <textarea
                                rows={3}
                                value={config.scripts.step4Closing}
                                onChange={e => handleScriptChange('step4Closing', e.target.value)}
                                className="w-full p-3 border border-slate-300 rounded-xl text-sm font-serif italic outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 2: BUNDLES & UPSELL OFFERS */}
            {activeSection === 'bundles' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-slate-900 text-base">Done Together Upsell Bundle Offers</h3>
                            <p className="text-xs text-slate-500">Configure bundle discounts, reasons, and spoken pitches shown in Step 3</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleAddBundle}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        >
                            <Plus size={16} />
                            Add Upsell Offer
                        </button>
                    </div>

                    <div className="space-y-4">
                        {config.bundles.map((bundle, index) => (
                            <div key={bundle.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                    <div className="flex items-center gap-2.5">
                                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center text-xs font-bold">
                                            {index + 1}
                                        </span>
                                        <input 
                                            type="text" 
                                            value={bundle.name}
                                            onChange={e => handleBundleChange(index, 'name', e.target.value)}
                                            className="font-bold text-slate-900 text-base border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none px-1"
                                            placeholder="Bundle Offer Name"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleRemoveBundle(index)}
                                        className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition"
                                        title="Remove Offer"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                                    <div className="sm:col-span-2">
                                        <label className="block font-bold text-slate-700 mb-1">Description</label>
                                        <input
                                            type="text"
                                            value={bundle.description}
                                            onChange={e => handleBundleChange(index, 'description', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Standalone Price (£)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={bundle.standalonePrice}
                                            onChange={e => handleBundleChange(index, 'standalonePrice', parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Bundled Discount Price (£)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={bundle.bundledPrice}
                                            onChange={e => handleBundleChange(index, 'bundledPrice', parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-indigo-700"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Why Done Together (Internal Context)</label>
                                        <textarea
                                            rows={2}
                                            value={bundle.reason}
                                            onChange={e => handleBundleChange(index, 'reason', e.target.value)}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Spoken Reception Pitch Script</label>
                                        <textarea
                                            rows={2}
                                            value={bundle.script}
                                            onChange={e => handleBundleChange(index, 'script', e.target.value)}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl font-serif italic"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SECTION 3: CUSTOMER CONFIRMATION EMAIL */}
            {activeSection === 'email' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                                <Mail size={18} className="text-indigo-600" />
                                Customer Booking & Estimate Confirmation Email
                            </h3>
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={config.emailConfirmation.autoSendDefault}
                                    onChange={e => handleEmailChange('autoSendDefault', e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 rounded"
                                />
                                Auto-check &ldquo;Send Confirmation Email&rdquo; when client has email
                            </label>
                        </div>

                        <div className="space-y-4 text-sm">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Subject Line Template:
                                </label>
                                <input
                                    type="text"
                                    value={config.emailConfirmation.subjectTemplate}
                                    onChange={e => handleEmailChange('subjectTemplate', e.target.value)}
                                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Email Body Message Template:
                                </label>
                                <textarea
                                    rows={14}
                                    value={config.emailConfirmation.bodyTemplate}
                                    onChange={e => handleEmailChange('bodyTemplate', e.target.value)}
                                    className="w-full p-3.5 border border-slate-300 rounded-xl font-mono text-xs leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
