import React, { useState, useEffect } from 'react';
import { Mail, Shield, Save, Eye, EyeOff, Info, AlertCircle } from 'lucide-react';
import { getItem, setItem } from '../../../core/db';

interface MailConfig {
    fromName: string;
    fromEmail: string;
    microsoftClientId: string;
    microsoftClientSecret: string;
    microsoftTenantId: string;
    microsoftEmailSender: string;
}

interface ManagementMailSettingsTabProps {
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const ManagementMailSettingsTab: React.FC<ManagementMailSettingsTabProps> = ({ onShowStatus }) => {
    const [mailConfig, setMailConfig] = useState<MailConfig>({
        fromName: 'Brookspeed',
        fromEmail: 'info@brookspeed.com',
        microsoftClientId: '',
        microsoftClientSecret: '',
        microsoftTenantId: '',
        microsoftEmailSender: 'info@brookspeed.com',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [showSecret, setShowSecret] = useState(false);

    useEffect(() => {
        const fetchMailConfig = async () => {
            try {
                const config = await getItem<MailConfig>('mail_config');
                if (config) {
                    setMailConfig(prev => ({
                        ...prev,
                        ...config
                    }));
                }
            } catch (err) {
                console.error("Failed to load mail configuration:", err);
            }
        };
        fetchMailConfig();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setMailConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await setItem('mail_config', mailConfig);
            onShowStatus('Mail configuration saved successfully.', 'success');
        } catch (error) {
            onShowStatus('Failed to save mail configuration.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-end border-b pb-4">
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Mail Settings</h2>
                    <p className="text-sm text-gray-500 font-medium">Configure outbound mail address and MS Graph credentials</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
                {/* Outbound Email Settings Card */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                        <Mail size={18} className="text-indigo-600" />
                        <h3 className="font-black text-gray-800 uppercase text-xs tracking-tight">Outbound Sender Identity</h3>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Outbound Sender Name</label>
                            <input 
                                type="text"
                                name="fromName"
                                value={mailConfig.fromName}
                                onChange={handleChange}
                                placeholder="e.g. Brookspeed"
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Outbound Sender Email</label>
                            <input 
                                type="email"
                                name="fromEmail"
                                value={mailConfig.fromEmail}
                                onChange={handleChange}
                                placeholder="e.g. info@brookspeed.com"
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                required
                            />
                            <p className="mt-1 text-[10px] text-gray-400">Used as the reply-to address and sender default</p>
                        </div>
                    </div>
                </div>

                {/* MS Graph Integration Settings Card */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                            <Shield size={18} className="text-indigo-600" />
                            <h3 className="font-black text-gray-800 uppercase text-xs tracking-tight">Microsoft 365 / MS Graph API (Azure Entra ID)</h3>
                        </div>
                        <span className="bg-amber-100 text-amber-800 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-amber-200">OAuth Credentials</span>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl flex gap-3 text-xs text-indigo-700 font-medium">
                            <Info size={16} className="text-indigo-500 shrink-0" />
                            <div>
                                <p className="leading-relaxed">
                                    Outbound mail delivery and inbound email parsing are processed securely on the server via Cloud Functions.
                                </p>
                                <p className="leading-relaxed mt-1">
                                    Registering these details here documents the target mailbox parameters. In production, ensure these credentials match your environment variables (`MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`, `MICROSOFT_EMAIL_SENDER`).
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Microsoft Tenant ID</label>
                            <input 
                                type="text"
                                name="microsoftTenantId"
                                value={mailConfig.microsoftTenantId}
                                onChange={handleChange}
                                placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Microsoft Client ID (Application ID)</label>
                                <input 
                                    type="text"
                                    name="microsoftClientId"
                                    value={mailConfig.microsoftClientId}
                                    onChange={handleChange}
                                    placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Microsoft Email Sender Account (Shared Mailbox)</label>
                                <input 
                                    type="email"
                                    name="microsoftEmailSender"
                                    value={mailConfig.microsoftEmailSender}
                                    onChange={handleChange}
                                    placeholder="e.g. info@brookspeed.com"
                                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Microsoft Client Secret</label>
                            <div className="relative">
                                <input 
                                    type={showSecret ? "text" : "password"}
                                    name="microsoftClientSecret"
                                    value={mailConfig.microsoftClientSecret}
                                    onChange={handleChange}
                                    placeholder="••••••••••••••••••••••••••••••••"
                                    className="w-full p-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowSecret(!showSecret)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                                >
                                    {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button 
                        type="submit"
                        disabled={isSaving}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-100"
                    >
                        <Save size={18} />
                        {isSaving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </form>
        </div>
    );
};
