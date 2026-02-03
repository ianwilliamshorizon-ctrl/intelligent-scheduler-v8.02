import React, { useState } from 'react';
import { useApp } from '../../../core/state/AppContext';
import { Download, Upload, RefreshCw, AlertTriangle, PlusCircle, X, Clock, Database, Cloud, ShieldAlert } from 'lucide-react';
import { performFactoryReset } from '../../../core/utils/backupUtils';
import { setItem, getStorageType } from '../../../core/db';
import { BackupSchedule } from '../../../types';

interface ManagementBackupTabProps {
    backupSchedule: BackupSchedule;
    setBackupSchedule: (schedule: BackupSchedule) => void;
    onManualBackup: () => void;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const ManagementBackupTab: React.FC<ManagementBackupTabProps> = ({ 
    backupSchedule, 
    setBackupSchedule, 
    onManualBackup,
    onShowStatus 
}) => {
    const { appEnvironment, setAppEnvironment } = useApp();
    const [isUpdating, setIsUpdating] = useState(false);
    
    // Connection Status Check - Cast to string to avoid "no overlap" TS error
    const storageType = getStorageType() as string;
    const isConnectedToCloud = storageType === 'firestore' || storageType === 'emulator';

    const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const confirmed = window.confirm("Restoring from backup will OVERWRITE all current data. This action cannot be undone. Are you sure?");
        if (!confirmed) { 
            e.target.value = ''; 
            return; 
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                const dataToRestore = json.data || json; 
                
                onShowStatus("Initiating restore process...", "info");
                
                for (const [key, value] of Object.entries(dataToRestore)) {
                    if (key.startsWith('brooks_')) { 
                        await setItem(key, value); 
                    }
                }
                
                onShowStatus("Restore successful! Restarting system...", "success");
                setTimeout(() => window.location.reload(), 1500);
            } catch (err) { 
                console.error("Restore failed:", err); 
                onShowStatus("Failed to restore backup. File may be corrupted.", "error");
            }
        };
        reader.readAsText(file);
    };

    const handleSoftwareUpdate = () => {
        setIsUpdating(true);
        const branch = appEnvironment === 'UAT' ? 'uat' : appEnvironment === 'Development' ? 'dev' : 'production';
        
        onShowStatus(`Pulling updates from [origin/${branch}]...`, 'info');
        
        // Simulating git pull/hot reload
        setTimeout(() => {
             onShowStatus(`Successfully updated to latest ${appEnvironment} build.`, 'success');
             setTimeout(() => { window.location.reload(); }, 1200);
        }, 2000);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
            
            {/* 1. Database & Connection Status */}
            <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isConnectedToCloud ? 'bg-green-50' : 'bg-orange-50'}`}>
                        {isConnectedToCloud ? <Cloud className="text-green-600" /> : <Database className="text-orange-600" />}
                    </div>
                    <div>
                        <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Database Connection</h3>
                        <p className={`text-sm font-bold uppercase ${isConnectedToCloud ? 'text-green-600' : 'text-orange-600'}`}>
                            {isConnectedToCloud ? (storageType === 'emulator' ? 'EMULATOR (DEV MODE)' : 'LIVE CLOUD FIRESTORE') : 'LOCAL BROWSER STORAGE'}
                        </p>
                    </div>
                </div>
                {!isConnectedToCloud && (
                    <div className="flex items-center gap-2 bg-orange-100 px-4 py-2 rounded-lg text-orange-800 text-xs font-bold">
                        <AlertTriangle size={14} /> WARNING: DATA IS NOT SYNCING TO CLOUD
                    </div>
                )}
            </div>

            {/* 2. Manual Backup */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Download size={20}/></div>
                    <h3 className="font-black text-gray-900 uppercase text-sm tracking-tight">Manual Backup</h3>
                </div>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">Generate a point-in-time snapshot of the entire database. Use this before major configuration changes.</p>
                <button 
                    onClick={onManualBackup} 
                    className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
                >
                    Download JSON Backup
                </button>
            </div>

            {/* 3. Restore Data */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Upload size={20}/></div>
                    <h3 className="font-black text-gray-900 uppercase text-sm tracking-tight">Restore System</h3>
                </div>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">Overwrite current data with a previously saved backup file. This will trigger an immediate system reload.</p>
                <label className="block w-full text-center bg-amber-600 text-white font-bold py-3 rounded-xl hover:bg-amber-700 transition-all cursor-pointer shadow-lg shadow-amber-100">
                    Select Backup File
                    <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
                </label>
            </div>

            {/* 4. Automated Schedules */}
            <div className="md:col-span-1 bg-white border border-gray-200 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-50 rounded-lg text-gray-600"><Clock size={20}/></div>
                        <h3 className="font-black text-gray-900 uppercase text-sm tracking-tight">Auto-Backup</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={backupSchedule.enabled} 
                            onChange={(e) => setBackupSchedule({...backupSchedule, enabled: e.target.checked})} 
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>

                {backupSchedule.enabled ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {backupSchedule.times.map((time, index) => (
                                <div key={index} className="flex items-center bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg group">
                                    <span className="text-xs font-black text-gray-700 mr-3">{time}</span>
                                    <button 
                                        onClick={() => setBackupSchedule({...backupSchedule, times: backupSchedule.times.filter((_, i) => i !== index)})} 
                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <X size={14}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <input type="time" className="flex-1 bg-gray-50 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" id="new-backup-time" />
                            <button 
                                onClick={() => { 
                                    const input = document.getElementById('new-backup-time') as HTMLInputElement; 
                                    if (input.value && !backupSchedule.times.includes(input.value)) { 
                                        setBackupSchedule({...backupSchedule, times: [...backupSchedule.times, input.value].sort()}); 
                                        input.value = ''; 
                                    } 
                                }} 
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            >
                                <PlusCircle size={24}/>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="py-8 text-center border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 text-xs font-bold uppercase tracking-widest">
                        Automated backups disabled
                    </div>
                )}
            </div>

            {/* 5. Software Updates */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><RefreshCw size={20}/></div>
                    <h3 className="font-black text-gray-900 uppercase text-sm tracking-tight">Software Updates</h3>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Target Branch</label>
                        <select 
                            value={appEnvironment} 
                            onChange={(e) => setAppEnvironment(e.target.value as any)} 
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                            disabled={isUpdating}
                        >
                            <option value="Production">Production (Stable)</option>
                            <option value="UAT">UAT (Pre-release)</option>
                            <option value="Development">Development (Edge)</option>
                        </select>
                    </div>
                    
                    <button 
                        onClick={handleSoftwareUpdate} 
                        disabled={isUpdating} 
                        className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={isUpdating ? "animate-spin" : ""} />
                        {isUpdating ? "Fetching Updates..." : `Check for Updates`}
                    </button>
                </div>
            </div>

            {/* 6. Critical: Factory Reset */}
            <div className="md:col-span-2 bg-red-50 border border-red-100 rounded-2xl p-6 mt-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white rounded-xl text-red-600 shadow-sm"><ShieldAlert size={24}/></div>
                        <div>
                            <h3 className="font-black text-red-900 uppercase text-sm tracking-tight">Danger Zone: Factory Reset</h3>
                            <p className="text-sm text-red-700/70 max-w-xl mt-1 font-medium">
                                This will purge all local and cloud data associated with this business entity. 
                                Users, Lifts, Parts, and Invoices will be permanently deleted.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => { if(window.confirm("ARE YOU ABSOLUTELY SURE? This will delete EVERYTHING.")) performFactoryReset(); }} 
                        className="bg-red-600 text-white font-black px-8 py-3 rounded-xl hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-200 whitespace-nowrap"
                    >
                        Wipe All Data
                    </button>
                </div>
            </div>

        </div>
    );
};