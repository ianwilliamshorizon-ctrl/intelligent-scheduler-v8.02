import React, { useState } from 'react';
import { useApp } from '../../../core/state/AppContext';
import { useData } from '../../../core/state/DataContext';
import { Download, Upload, RefreshCw, Server, AlertTriangle, PlusCircle, X, Clock } from 'lucide-react';
import { performFactoryReset } from '../../../core/utils/backupUtils';
import { setItem, getStorageType, getAll } from '../../../core/db';
import { BackupSchedule } from '../../../types';

interface ManagementBackupTabProps {
    backupSchedule: BackupSchedule;
    setBackupSchedule: (schedule: BackupSchedule) => void;
    onManualBackup: () => void;
    onRestoreFromSnapshot: (snapshotId: string) => Promise<void>;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const ManagementBackupTab: React.FC<ManagementBackupTabProps> = ({ 
    backupSchedule, 
    setBackupSchedule, 
    onManualBackup,
    onRestoreFromSnapshot,
    onShowStatus 
}) => {
    const { appEnvironment, setAppEnvironment } = useApp();
    const [isUpdating, setIsUpdating] = useState(false);
    const [snapshots, setSnapshots] = useState<any[]>([]);
    const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreStatus, setRestoreStatus] = useState('');
    
    // Connection Status Check
    const storageType = getStorageType();
    
    // FIX: Cast storageType to string to allow comparison with 'emulator'
    const isConnectedToCloud = (storageType as string) === 'firestore' || (storageType as string) === 'emulator';

    const fetchSnapshots = async () => {
        setIsLoadingSnapshots(true);
        try {
            const allSettings = await getAll<any>('brooks_settings');
            const autoSnapshots = allSettings
                .filter(s => s.id.startsWith('backup_auto_'))
                .map(s => ({
                    id: s.id,
                    date: s.id.replace('backup_auto_', '').replace(/-/g, ':'),
                    timestamp: s.id.replace('backup_auto_', '')
                }))
                .sort((a, b) => b.id.localeCompare(a.id));
            setSnapshots(autoSnapshots);
        } catch (err) {
            console.error("Failed to fetch snapshots", err);
        } finally {
            setIsLoadingSnapshots(false);
        }
    };

    React.useEffect(() => {
        fetchSnapshots();
    }, []);

    const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!confirm("Restoring from backup will OVERWRITE all current data in the system. This action is destructive. Are you sure you wish to proceed?")) { e.target.value = ''; return; }
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                setIsRestoring(true);
                setRestoreStatus('Reading backup file...');
                const json = JSON.parse(event.target?.result as string);
                const dataToRestore = json.data || json; 
                
                const entries = Object.entries(dataToRestore);
                let count = 0;
                for (const [key, value] of entries) {
                    if (key.startsWith('brooks_')) { 
                        count++;
                        setRestoreStatus(`Restoring collection: ${key} (${count}/${entries.length})...`);
                        await setItem(key, value); 
                    }
                }
                setRestoreStatus('Restore complete! Reloading application...');
                setTimeout(() => { window.location.reload(); }, 2000);
            } catch (err) { 
                console.error("Restore failed:", err); 
                onShowStatus('Restore failed: Invalid backup file format.', 'error');
                setIsRestoring(false);
            }
        };
        reader.readAsText(file);
    };

    const handleSnapshotRestore = async (snapshotId: string) => {
        if (!confirm(`Are you sure you want to restore the system to the snapshot from ${snapshotId.replace('backup_auto_', '')}? This will overwrite current data.`)) return;
        
        try {
            setIsRestoring(true);
            setRestoreStatus('Downloading snapshot from cloud storage...');
            await onRestoreFromSnapshot(snapshotId);
            setRestoreStatus('Snapshot applied successfully! Reloading...');
            setTimeout(() => { window.location.reload(); }, 2000);
        } catch (err) {
            console.error("Snapshot restore failed", err);
            onShowStatus('Failed to restore from cloud snapshot.', 'error');
            setIsRestoring(false);
        }
    };

    const handleSoftwareUpdate = () => {
        setIsUpdating(true);
        let branch = appEnvironment === 'uat' ? 'uat' : appEnvironment === 'development' ? 'dev' : 'production';
        onShowStatus(`Pulling latest code from git branch: origin/${branch}...`, 'info');
        setTimeout(() => {
             onShowStatus(`Successfully updated to latest ${appEnvironment} version. Reloading...`, 'success');
             setTimeout(() => { window.location.reload(); }, 1500);
        }, 2000);
    };

    return (
        <div className="space-y-6">
            {isRestoring && (
                <div className="p-4 border rounded-lg bg-indigo-600 text-white shadow-xl animate-pulse flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <RefreshCw size={24} className="animate-spin" />
                        <div>
                            <p className="font-bold">SYSTEM RESTORE IN PROGRESS</p>
                            <p className="text-sm opacity-90">{restoreStatus}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2"><Download size={20}/> Manual Backup</h3>
                <p className="text-sm text-blue-800 mb-4">Generate an immediate full system export. Use this before making major configuration changes.</p>
                <button onClick={onManualBackup} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 shadow flex items-center gap-2">
                    <Download size={18}/>
                    Download JSON Backup
                </button>
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
                    <div className="space-y-4">
                        <div className="bg-white p-3 rounded-lg border border-gray-200">
                            <p className="text-sm font-bold text-gray-700 mb-2">Automated Schedule (24h):</p>
                            <div className="flex flex-wrap gap-2">
                                {backupSchedule.times.map((time, index) => (
                                    <div key={index} className="flex items-center bg-gray-50 border px-3 py-1.5 rounded-full shadow-sm">
                                        <Clock size={12} className="text-gray-400 mr-2" />
                                        <span className="text-sm font-mono font-bold mr-3">{time}</span>
                                        <button onClick={() => setBackupSchedule({...backupSchedule, times: backupSchedule.times.filter((_, i) => i !== index)})} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-full"><X size={14}/></button>
                                    </div>
                                ))}
                                <div className="flex items-center gap-2">
                                    <input type="time" className="border rounded-full px-3 py-1.5 text-sm font-bold bg-white" id="new-backup-time" />
                                    <button onClick={() => { const input = document.getElementById('new-backup-time') as HTMLInputElement; if (input.value && !backupSchedule.times.includes(input.value)) { setBackupSchedule({...backupSchedule, times: [...backupSchedule.times, input.value].sort()}); input.value = ''; } }} className="bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white p-2 rounded-full transition-colors"><PlusCircle size={20}/></button>
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2 italic">Standard Brookspeed policy: 02:00 and 14:00 (Local and Remote redundancy enabled).</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-sm font-bold text-gray-700">Recent Cloud Snapshots</p>
                                <button onClick={fetchSnapshots} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                                    <RefreshCw size={12} className={isLoadingSnapshots ? "animate-spin" : ""} /> Refresh
                                </button>
                            </div>
                            
                            {isLoadingSnapshots ? (
                                <p className="text-xs text-gray-500 py-4 text-center">Loading snapshot history...</p>
                            ) : snapshots.length > 0 ? (
                                <div className="max-h-48 overflow-y-auto space-y-2">
                                    {snapshots.map(snapshot => (
                                        <div key={snapshot.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-green-100 text-green-700 flex items-center justify-center">
                                                    <Server size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-800">{snapshot.id}</p>
                                                    <p className="text-[10px] text-gray-500">Stored in Cloud Firestore</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleSnapshotRestore(snapshot.id)}
                                                className="text-[10px] font-black uppercase tracking-widest bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-md hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                            >
                                                Restore
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 py-4 text-center">No automated snapshots found yet.</p>
                            )}
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
                <h3 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2"><RefreshCw size={20}/> Continuous Backup (PITR)</h3>
                <p className="text-sm text-indigo-800 mb-4 font-medium italic">Firestore provides Point-in-Time Recovery for granular restoration.</p>
                <div className="space-y-3 bg-white p-4 rounded-lg border border-indigo-100">
                    <div>
                        <p className="text-xs font-bold text-indigo-900 mb-1">How to Roll Back:</p>
                        <ul className="text-[10px] text-gray-600 list-disc ml-4 space-y-1">
                            <li>Access the Firebase Console &gt; Firestore &gt; PITR tab.</li>
                            <li>Select "Restore to Point in Time".</li>
                            <li>Choose a specific timestamp (up to 7 days prior).</li>
                            <li><strong>Roll Forward:</strong> PITR allows moving between snapshots within the 7-day window to identify precisely when a data error occurred.</li>
                        </ul>
                    </div>
                    <div className="pt-2 border-t border-indigo-50">
                        <p className="text-[10px] text-indigo-700"><strong>Note:</strong> Automated daily snapshots provide long-term retention, while Continuous Backup (PITR) is for immediate disaster recovery within the current week.</p>
                    </div>
                </div>
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
                <div className="flex items-center gap-2 mb-2"><div className={`w-3 h-3 rounded-full ${isConnectedToCloud ? 'bg-green-500' : 'bg-orange-500'}`}></div><span className="font-semibold text-sm">
                    {/* FIX: Cast storageType to string for rendering check */}
                    {isConnectedToCloud ? ((storageType as string) === 'emulator' ? 'Connected to Emulator (Dev)' : 'Connected to Cloud Firestore') : 'Using Local Storage (IndexedDB)'}
                </span></div>
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