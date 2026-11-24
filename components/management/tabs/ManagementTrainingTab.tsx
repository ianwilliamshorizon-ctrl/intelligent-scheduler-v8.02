import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, AlertTriangle, Clock, Download, Search } from 'lucide-react';
import { useApp } from '../../../core/state/AppContext';
import { useData } from '../../../core/state/DataContext';
import {
    TRAINING_MODULES,
    getRequiredModulesForUser,
    getModuleStatusForUser,
    getUserCpdSummary
} from '../../../core/data/trainingModules';
import { exportToCsv } from '../../../core/utils/backupUtils';

interface ManagementTrainingTabProps {
    searchTerm?: string;
    onShowStatus?: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const ManagementTrainingTab: React.FC<ManagementTrainingTabProps> = ({ searchTerm = '', onShowStatus }) => {
    const { users } = useApp();
    const { trainingRecords } = useData();
    const [localFilter, setLocalFilter] = useState('');

    const activeUsers = useMemo(() => {
        const term = (searchTerm || localFilter).trim().toLowerCase();
        return (users || [])
            .filter(u => u.status !== 'disabled')
            .filter(u => !term || (u.name || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term) || (u.role || '').toLowerCase().includes(term))
            .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    }, [users, searchTerm, localFilter]);

    const teamStats = useMemo(() => {
        let totalRequired = 0;
        let totalCurrent = 0;
        let usersWithRefreshers = 0;
        let totalMinutes = 0;

        for (const u of activeUsers) {
            const summary = getUserCpdSummary(u, trainingRecords);
            totalRequired += summary.requiredCount;
            totalCurrent += summary.completedCurrentCount;
            totalMinutes += summary.totalCpdMinutes;
            if (summary.refresherDueCount > 0) usersWithRefreshers++;
        }

        const compliancePct = totalRequired > 0 ? Math.round((totalCurrent / totalRequired) * 100) : 100;
        return { compliancePct, usersWithRefreshers, totalHours: (totalMinutes / 60).toFixed(1) };
    }, [activeUsers, trainingRecords]);

    const handleExportCsv = () => {
        const rows: Record<string, any>[] = [];
        for (const u of activeUsers) {
            const requiredIds = new Set(getRequiredModulesForUser(u).map(m => m.id));
            for (const mod of TRAINING_MODULES) {
                const isReq = requiredIds.has(mod.id);
                const { status, record } = getModuleStatusForUser(mod, trainingRecords, u.id);
                rows.push({
                    User: u.name || u.email,
                    Email: u.email,
                    Role: u.role,
                    Module: mod.title,
                    ModuleVersion: mod.version,
                    RequiredForRole: isReq ? 'Yes' : 'No',
                    Status: !isReq && status === 'not_started' ? 'N/A' : status,
                    ScorePercent: record?.score ?? '',
                    CpdMinutes: record?.cpdMinutes ?? 0,
                    CompletedAt: record?.completedAt || ''
                });
            }
        }
        exportToCsv(`Brookspeed_Staff_CPD_Matrix_${new Date().toISOString().split('T')[0]}.csv`, rows);
        onShowStatus?.('Exported Staff CPD Matrix CSV.', 'success');
    };

    return (
        <div className="space-y-4">
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-emerald-700 uppercase">Team CPD Compliance</div>
                        <div className="text-2xl font-black text-emerald-900">{teamStats.compliancePct}%</div>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-indigo-700 uppercase">Total CPD Logged</div>
                        <div className="text-2xl font-black text-indigo-900">{teamStats.totalHours} hrs</div>
                    </div>
                    <Clock className="w-8 h-8 text-indigo-600" />
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-amber-700 uppercase">Refreshers Due</div>
                        <div className="text-2xl font-black text-amber-900">{teamStats.usersWithRefreshers} staff</div>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-amber-600" />
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={localFilter}
                        onChange={e => setLocalFilter(e.target.value)}
                        placeholder="Filter staff by name or role..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                </div>
                <button
                    type="button"
                    onClick={handleExportCsv}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-sm cursor-pointer"
                >
                    <Download className="w-4 h-4" /> Export CPD Audit CSV
                </button>
            </div>

            {/* Compliance Matrix */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-600">
                            <th className="p-3 sticky left-0 bg-gray-50 z-10 min-w-[180px]">Staff Member</th>
                            <th className="p-3 text-center">CPD</th>
                            {TRAINING_MODULES.map(mod => (
                                <th key={mod.id} className="p-2.5 text-center min-w-[105px]">
                                    <div className="font-bold text-gray-800 leading-tight">{mod.title.split('&')[0]}</div>
                                    <div className="text-[9px] text-gray-400 font-normal">v{mod.version}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {activeUsers.map(user => {
                            const summary = getUserCpdSummary(user, trainingRecords);
                            const requiredIds = new Set(getRequiredModulesForUser(user).map(m => m.id));

                            return (
                                <tr key={user.id} className="hover:bg-gray-50/70">
                                    <td className="p-3 sticky left-0 bg-white z-10 border-r border-gray-100">
                                        <div className="font-bold text-gray-900">{user.name || user.email}</div>
                                        <div className="text-[10px] text-gray-500">{user.role}</div>
                                    </td>
                                    <td className="p-3 text-center whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] ${
                                            summary.percentComplete === 100
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-indigo-100 text-indigo-800'
                                        }`}>
                                            <Award className="w-3 h-3" />
                                            {summary.completedCurrentCount}/{summary.requiredCount}
                                        </span>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{summary.totalCpdMinutes}m</div>
                                    </td>
                                    {TRAINING_MODULES.map(mod => {
                                        const isReq = requiredIds.has(mod.id);
                                        const { status, record } = getModuleStatusForUser(mod, trainingRecords, user.id);

                                        if (status === 'current' && record) {
                                            return (
                                                <td key={mod.id} className="p-2 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]" title={`Completed ${record.completedAt}`}>
                                                        v{record.completedVersion} ({record.score}%)
                                                    </span>
                                                </td>
                                            );
                                        }
                                        if (status === 'refresher_due' && record) {
                                            return (
                                                <td key={mod.id} className="p-2 text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px]" title={`Completed v${record.completedVersion}, latest v${mod.version}`}>
                                                        Refresher
                                                    </span>
                                                </td>
                                            );
                                        }
                                        if (!isReq) {
                                            return (
                                                <td key={mod.id} className="p-2 text-center text-gray-300">—</td>
                                            );
                                        }
                                        return (
                                            <td key={mod.id} className="p-2 text-center">
                                                <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-500 font-medium text-[10px]">
                                                    Pending
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
