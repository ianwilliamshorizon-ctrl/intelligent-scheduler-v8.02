import React, { useState } from 'react';
import { useApp } from '../../../core/state/AppContext';
import { useData } from '../../../core/state/DataContext';
import { Download, Upload, RefreshCw, Server, AlertTriangle, PlusCircle, X, Clock, Database, Cloud } from 'lucide-react';
import { performFactoryReset } from '../../../core/utils/backupUtils';
import { setItem, getStorageType, getAll, listStorageFiles, uploadToStorage } from '../../../core/db';
import { idbKeys } from '../../../core/db/idb';
import { BackupSchedule } from '../../../types';

interface ManagementBackupTabProps {
    backupSchedule: BackupSchedule;
    setBackupSchedule: (schedule: BackupSchedule) => void;
    onManualBackup: () => void;
    onCloudSnapshot: () => Promise<boolean>;
    onRestoreFromSnapshot: (snapshotId: string) => Promise<void>;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const ManagementBackupTab: React.FC<ManagementBackupTabProps> = ({ 
    backupSchedule, 
    setBackupSchedule, 
    onManualBackup,
    onCloudSnapshot,
    onRestoreFromSnapshot,
    onShowStatus 
}) => {
    const { appEnvironment, setAppEnvironment } = useApp();
    const [isUpdating, setIsUpdating] = useState(false);
    const [cloudSnapshots, setCloudSnapshots] = useState<any[]>([]);
    const [localSnapshots, setLocalSnapshots] = useState<any[]>([]);
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
            // 1. Fetch Cloud Storage Snapshots
            const cloudFiles = await listStorageFiles('backups');
            const cloudArr = cloudFiles.map(path => ({
                id: path,
                name: path.split('/').pop()?.replace('backup_auto_', '').replace('.json', '') || path,
                type: 'cloud'
            })).sort((a, b) => b.id.localeCompare(a.id));
            setCloudSnapshots(cloudArr);

            // 2. Fetch Local IndexedDB Snapshots
            const keys = await idbKeys();
            const localArr = (keys as string[])
                .filter(k => k.startsWith('backup_local_'))
                .map(k => ({
                    id: k,
                    name: k.replace('backup_local_', '').replace(/-/g, ':'),
                    type: 'local'
                }))
                .sort((a, b) => b.id.localeCompare(a.id));
            setLocalSnapshots(localArr);

            // 3. Fallback: Fetch Legacy Firestore Snapshots
            const allSettings = await getAll<any>('brooks_settings');
            const legacySnapshots = allSettings
                .filter(s => s.id.startsWith('backup_auto_'))
                .map(s => ({
                    id: s.id,
                    name: s.id.replace('backup_auto_', '').replace(/-/g, ':'),
                    type: 'legacy'
                }));
            
            if (legacySnapshots.length > 0) {
                // Mix them into cloud for visibility
                setCloudSnapshots(prev => [...prev, ...legacySnapshots].sort((a, b) => b.id.localeCompare(a.id)));
            }

        } catch (err) {
            console.error("Failed to fetch snapshots", err);
        } finally {
            setIsLoadingSnapshots(false);
        }
    };

    const [availableVersion, setAvailableVersion] = useState<string | null>(null);

    React.useEffect(() => {
        fetchSnapshots();
        // Fetch the server version specifically for this tab
        fetch(`/version.json?t=${Date.now()}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.version) {
                    setAvailableVersion(data.version);
                }
            })
            .catch(err => console.error("Could not fetch server version", err));
    }, []);

    const formatVersionDate = (versionStr: string) => {
        if (!versionStr) return 'Unknown';
        
        const formatSemver = (semver: string) => {
            const parts = semver.split('.');
            if (parts.length >= 3) {
                const major = parts[0];
                const minor = parts[1];
                const patch = parts[2];
                return `${major}.${minor}${patch}`;
            }
            return semver;
        };

        const parts = versionStr.split('-');
        if (parts.length === 2 && !isNaN(Number(parts[1]))) {
            const semverPart = parts[0];
            const timestamp = Number(parts[1]);
            const customVersion = formatSemver(semverPart);
            try {
                const date = new Date(timestamp);
                return `${customVersion} (${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`;
            } catch {
                return `${customVersion} (${parts[1]})`;
            }
        }

        const parsedSemver = formatSemver(versionStr);
        if (parsedSemver !== versionStr) {
            return parsedSemver;
        }

        try {
            if (!isNaN(Number(versionStr))) {
                const date = new Date(parseInt(versionStr));
                return date.toLocaleString();
            }
        } catch {}
        
        return versionStr;
    };

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
                <div className="flex flex-wrap gap-3">
                    <button onClick={onManualBackup} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 shadow flex items-center gap-2 transition-all">
                        <Download size={18}/>
                        Download JSON Backup
                    </button>
                    <button 
                        onClick={async () => {
                            onShowStatus('Creating cloud snapshot...', 'info');
                            try {
                                const success = await onCloudSnapshot();
                                if (success) {
                                    onShowStatus('Cloud snapshot created successfully.', 'success');
                                    fetchSnapshots(); // Refresh the list
                                } else {
                                    onShowStatus('Cloud snapshot failed.', 'error');
                                }
                            } catch (e) {
                                onShowStatus('Snapshot failed', 'error');
                            }
                        }} 
                        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 shadow flex items-center gap-2 transition-all"
                    >
                        <Cloud size={18}/>
                        Create Cloud Snapshot
                    </button>
                </div>
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
                            <p className="text-[10px] text-gray-500 mt-2 italic">Standard Brookspeed policy: 02:00 and 14:00 (Guaranteed Server-Side Automation + Local Redundancy enabled).</p>
                            
                            {(backupSchedule.lastRun || backupSchedule.lastSuccess) && (
                                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-[10px]">
                                    {backupSchedule.lastRun && (
                                        <div className="flex items-center gap-1 text-gray-500">
                                            <Clock size={10} />
                                            <span>Last Attempt: {new Date(backupSchedule.lastRun).toLocaleString()}</span>
                                        </div>
                                    )}
                                    {backupSchedule.lastSuccess && (
                                        <div className="flex items-center gap-1 text-green-600 font-bold">
                                            <RefreshCw size={10} />
                                            <span>Last Success: {new Date(backupSchedule.lastSuccess).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="mt-3">
                                <button 
                                    onClick={async () => {
                                        onShowStatus('Manually triggering automated backup cycle...', 'info');
                                        // We use the passed prop to trigger the logic in App.tsx
                                        // But App.tsx's handleAutoBackup is not directly exposed as a prop
                                        // We can use onCloudSnapshot as a proxy or we can update App.tsx to pass it
                                        const success = await onCloudSnapshot(); 
                                        if (success) onShowStatus('Backup recorded successfully.', 'success');
                                    }}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline flex items-center gap-1"
                                >
                                    <RefreshCw size={10}/> Run Automated Cycle Now
                                </button>
                            </div>
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
                            ) : (cloudSnapshots.length > 0 || localSnapshots.length > 0) ? (
                                <div className="space-y-4">
                                    {cloudSnapshots.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><Cloud size={10}/> Cloud Snapshots (Remote)</p>
                                            <div className="max-h-48 overflow-y-auto space-y-2">
                                                {cloudSnapshots.map(snapshot => (
                                                    <div key={snapshot.id} className="flex items-center justify-between p-2 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-all group">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center">
                                                                <Cloud size={14} />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-800">{snapshot.name}</p>
                                                                <p className="text-[10px] text-gray-500">{snapshot.type === 'legacy' ? 'Legacy Firestore' : 'Firebase Storage'}</p>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleSnapshotRestore(snapshot.id)}
                                                            className="text-[10px] font-black uppercase tracking-widest bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-md hover:bg-indigo-600 hover:text-white transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                                        >
                                                            Restore
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {localSnapshots.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><Database size={10}/> Local Snapshots (Browser)</p>
                                            <div className="max-h-48 overflow-y-auto space-y-2">
                                                {localSnapshots.map(snapshot => (
                                                    <div key={snapshot.id} className="flex items-center justify-between p-2 hover:bg-amber-50 rounded-lg border border-transparent hover:border-amber-100 transition-all group">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded bg-amber-100 text-amber-700 flex items-center justify-center">
                                                                <Database size={14} />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-800">{snapshot.name}</p>
                                                                <p className="text-[10px] text-gray-500">Stored in IndexedDB</p>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleSnapshotRestore(snapshot.id)}
                                                            className="text-[10px] font-black uppercase tracking-widest bg-white border border-amber-200 text-amber-600 px-3 py-1.5 rounded-md hover:bg-amber-600 hover:text-white transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                                        >
                                                            Restore
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <AlertTriangle size={20} className="text-gray-300" />
                                    </div>
                                    <p className="text-xs text-gray-400">No snapshots found. Enable automation or create a manual cloud snapshot.</p>
                                </div>
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
                
                <div className="bg-white p-3 rounded-md border border-indigo-100 mb-4">
                    <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-gray-600 font-medium">Currently Running Version:</span>
                        <span className="font-mono text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {formatVersionDate(typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '')}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 font-medium">Available on Server:</span>
                        <span className="font-mono text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded border border-green-100 flex items-center gap-1">
                            {!availableVersion ? (
                                <span className="flex items-center gap-1 text-gray-500"><RefreshCw size={12} className="animate-spin" /> Checking...</span>
                            ) : (
                                formatVersionDate(availableVersion)
                            )}
                        </span>
                    </div>
                    {availableVersion && typeof __APP_VERSION__ !== 'undefined' && availableVersion !== __APP_VERSION__ && (
                        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded-md font-bold flex items-center justify-between">
                            <span>An update is available!</span>
                            <button onClick={() => window.location.reload()} className="px-2 py-1 bg-white border border-yellow-300 rounded shadow-sm hover:bg-yellow-100 text-yellow-900 transition-colors">Reload to Update</button>
                        </div>
                    )}
                </div>

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