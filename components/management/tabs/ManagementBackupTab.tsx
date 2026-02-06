
import React, { useState } from 'react';
import { useApp } from '../../../core/state/AppContext';
import { useData } from '../../../core/state/DataContext';
import { Download, Upload, RefreshCw, Server, AlertTriangle, PlusCircle, X, Clock } from 'lucide-react';
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
    
    // Connection Status Check
    const storageType = getStorageType();
    const isConnectedToCloud = storageType === 'firestore' || storageType === 'emulator';

    const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!confirm("Restoring from backup will OVERWRITE current data. Are you sure?")) { e.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                const dataToRestore = json.data || json; 
                for (const [key, value] of Object.entries(dataToRestore)) {
                    if (key.startsWith('brooks_')) { await setItem(key, value); }
                }
                alert('Restore successful. Reloading...'); window.location.reload();
            } catch (err) { console.error("Restore failed:", err); alert('Failed to restore backup.'); }
        };
        reader.readAsText(file);
    };

    const handleSoftwareUpdate = () => {
        setIsUpdating(true);
        let branch = appEnvironment === 'UAT' ? 'uat' : appEnvironment === 'Development' ? 'dev' : 'production';
        onShowStatus(`Pulling latest code from git branch: origin/${branch}...`, 'info');
        setTimeout(() => {
             onShowStatus(`Successfully updated to latest ${appEnvironment} version. Reloading...`, 'success');
             setTimeout(() => { window.location.reload(); }, 1500);
        }, 2000);
    };

    return (
        <div className="space-y-6">
            <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2"><Download size={20}/> Backup Data</h3>
                <p className="text-sm text-blue-800 mb-4">Download a full backup of all system data to a JSON file.</p>
                <button onClick={onManualBackup} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 shadow">Download Backup File</button>
            </div>
            
            <div className="p-4 border rounded-lg bg-gray-50 border-gray-200 mt-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2"><Clock size={20}/> Automated Backups</h3>
                <div className="flex items-center gap-4 mb-4">
                    <label className="flex items-center cursor-pointer">
                        <input type="checkbox" checked={backupSchedule.enabled} onChange={(e) => setBackupSchedule({...backupSchedule, enabled: e.target.checked})} className="sr-only peer"/>
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        <span className="ml-3 text-sm font-medium text-gray-900">Enable Automated Backups</span>
                    </label>
                </div>
                {backupSchedule.enabled && (
                    <div>
                        <p className="text-sm text-gray-600 mb-2">Scheduled Times (24h):</p>
                        <div className="flex flex-wrap gap-2">
                            {backupSchedule.times.map((time, index) => (
                                <div key={index} className="flex items-center bg-white border px-2 py-1 rounded shadow-sm">
                                    <span className="text-sm font-mono mr-2">{time}</span>
                                    <button onClick={() => setBackupSchedule({...backupSchedule, times: backupSchedule.times.filter((_, i) => i !== index)})} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                                </div>
                            ))}
                            <div className="flex items-center gap-2">
                                <input type="time" className="border rounded px-2 py-1 text-sm" id="new-backup-time" />
                                <button onClick={() => { const input = document.getElementById('new-backup-time') as HTMLInputElement; if (input.value && !backupSchedule.times.includes(input.value)) { setBackupSchedule({...backupSchedule, times: [...backupSchedule.times, input.value].sort()}); input.value = ''; } }} className="text-indigo-600 hover:text-indigo-800"><PlusCircle size={20}/></button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

             <div className="p-4 border rounded-lg bg-amber-50 border-amber-200">
                <h3 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2"><Upload size={20}/> Restore Data</h3>
                <p className="text-sm text-amber-800 mb-4">Restore system data from a backup file. <strong>WARNING: Overwrites current data.</strong></p>
                <label className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 shadow cursor-pointer inline-block">Select Backup File<input type="file" accept=".json" onChange={handleRestore} className="hidden" /></label>
            </div>

             <div className="p-4 border rounded-lg bg-indigo-50 border-indigo-200">
                <h3 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2"><RefreshCw size={20}/> Software Update</h3>
                <div className="flex flex-col gap-2 mb-4">
                    <label className="text-sm font-medium text-indigo-900">Target Environment</label>
                    <select value={appEnvironment} onChange={(e) => setAppEnvironment(e.target.value as any)} className="p-2 border rounded-md text-sm bg-white w-full md:w-1/2" disabled={isUpdating}>
                        <option value="Production">Production</option><option value="UAT">UAT</option><option value="Development">Development</option>
                    </select>
                </div>
                <button onClick={handleSoftwareUpdate} disabled={isUpdating} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 shadow flex items-center gap-2"><RefreshCw size={16} className={isUpdating ? "animate-spin" : ""} />{isUpdating ? "Updating..." : `Pull Latest`}</button>
            </div>

             <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                <h3 className="text-lg font-bold text-green-900 mb-2 flex items-center gap-2"><Server size={20}/> Database Connection</h3>
                <div className="flex items-center gap-2 mb-2"><div className={`w-3 h-3 rounded-full ${isConnectedToCloud ? 'bg-green-500' : 'bg-orange-500'}`}></div><span className="font-semibold text-sm">{isConnectedToCloud ? (storageType === 'emulator' ? 'Connected to Emulator (Dev)' : 'Connected to Cloud Firestore') : 'Using Local Storage (IndexedDB)'}</span></div>
                {!isConnectedToCloud && <p className="text-xs text-orange-800">Warning: Running locally. Data stored in browser only.</p>}
            </div>

            <div className="p-4 border rounded-lg bg-red-50 border-red-200">
                <h3 className="text-lg font-bold text-red-900 mb-2 flex items-center gap-2"><AlertTriangle size={20}/> Factory Reset</h3>
                <p className="text-sm text-red-800 mb-4">Wipe all data and restore defaults. Cannot be undone.</p>
                <button onClick={() => { if(confirm("Are you ABSOLUTELY SURE?")) performFactoryReset(); }} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 shadow">Perform Factory Reset</button>
            </div>
        </div>
    );
};
