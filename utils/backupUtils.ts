
import { formatDate } from '../core/utils/dateUtils';
import { clearStore } from '../core/db';

export const createBackup = (dataToBackup: any) => {
    const fullBackup = {
        backupSchemaVersion: '1.1', // New in-memory schema version
        backupDate: new Date().toISOString(),
        data: dataToBackup
    };

    return fullBackup;
};

export const downloadBackup = (backupData: any) => {
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brookspeed_backup_${formatDate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const exportToCsv = (filename: string, rows: object[], headers?: string[]) => {
    if (!rows || !rows.length) {
        alert("No data to export.");
        return;
    }
    const separator = ',';
    const keys = headers || Object.keys(rows[0]);
    const csvContent =
        keys.join(separator) +
        '\n' +
        rows.map(row => {
            return keys.map(k => {
                let cell = (row as any)[k] === null || (row as any)[k] === undefined ? '' : (row as any)[k];
                cell = cell instanceof Date
                    ? cell.toLocaleString()
                    : typeof cell === 'object'
                    ? JSON.stringify(cell).replace(/"/g, '""')
                    : String(cell);
                if (cell.search(/("|,|\n)/g) >= 0) {
                    cell = `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            }).join(separator);
        }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

export const performFactoryReset = async () => {
    try {
        await clearStore();
        // Clear local storage keys associated with the app to ensure full reset
        // Note: This relies on the usePersistentState keys starting with 'brooks_'
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('brooks_')) {
                localStorage.removeItem(key);
            }
        });
        window.location.reload();
    } catch (error) {
        console.error("Factory Reset Failed:", error);
        alert("Factory reset failed. Please check console.");
    }
};
