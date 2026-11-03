import React, { useState, useRef, useMemo, useTransition } from 'react';
import { 
    X, 
    UploadCloud, 
    FileSpreadsheet, 
    Download, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle, 
    Info, 
    Wrench, 
    Package, 
    Clock, 
    PoundSterling, 
    ChevronDown, 
    ChevronUp, 
    RefreshCw, 
    Building2,
    Check,
    HelpCircle
} from 'lucide-react';
import { ServicePackage, BusinessEntity, TaxRate, Part } from '../../types';
import { 
    parseRawSheetToRows, 
    parseServicePackagesFromRows, 
    ImportParseSummary, 
    ParsedServicePackageResult,
    downloadServicePackageCsvTemplate,
    downloadServicePackageExcelTemplate
} from '../../utils/servicePackageImportUtils';
import { formatCurrency } from '../../utils/formatUtils';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../core/config/firebaseConfig';

interface ImportServicePackagesModalProps {
    isOpen: boolean;
    onClose: () => void;
    businessEntities: BusinessEntity[];
    taxRates: TaxRate[];
    parts: Part[];
    existingPackages: ServicePackage[];
    defaultEntityId?: string;
    onImportSuccess: (importedPackages: ServicePackage[], summaryMessage: string) => void;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

type DuplicateMode = 'update' | 'skip' | 'duplicate';

export const ImportServicePackagesModal: React.FC<ImportServicePackagesModalProps> = ({
    isOpen,
    onClose,
    businessEntities,
    taxRates,
    parts,
    existingPackages,
    defaultEntityId,
    onImportSuccess,
    onShowStatus
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fallbackEntityId, setFallbackEntityId] = useState<string>(
        defaultEntityId || (businessEntities[0]?.id || '')
    );
    const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('update');
    const [isParsing, setIsParsing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [parseSummary, setParseSummary] = useState<ImportParseSummary | null>(null);
    const [expandedPackageIds, setExpandedPackageIds] = useState<Set<string>>(new Set());
    const [isDragging, setIsDragging] = useState(false);
    const [, startTransition] = useTransition();

    if (!isOpen) return null;

    const handleFileProcess = async (file: File) => {
        setSelectedFile(file);
        setIsParsing(true);
        setParseSummary(null);
        try {
            const rawRows = await parseRawSheetToRows(file);
            if (!rawRows || rawRows.length === 0) {
                onShowStatus('The selected file contains no readable rows.', 'error');
                setIsParsing(false);
                return;
            }

            const summary = parseServicePackagesFromRows(
                rawRows,
                businessEntities,
                taxRates,
                parts,
                fallbackEntityId
            );

            setParseSummary(summary);
            // Auto expand the first 2 packages so user sees structure
            if (summary.results.length > 0) {
                setExpandedPackageIds(new Set(summary.results.slice(0, 2).map(r => r.pkg.id)));
            }
        } catch (err: any) {
            console.error('File parsing error:', err);
            onShowStatus(`Failed to read file: ${err.message || 'Unknown error'}`, 'error');
        } finally {
            setIsParsing(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileProcess(file);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileProcess(file);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleFallbackEntityChange = (newEntityId: string) => {
        setFallbackEntityId(newEntityId);
        // Re-run parse if file already uploaded
        if (selectedFile) {
            startTransition(() => {
                handleFileProcess(selectedFile);
            });
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedPackageIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleExpandAll = () => {
        if (!parseSummary) return;
        if (expandedPackageIds.size === parseSummary.results.length) {
            setExpandedPackageIds(new Set());
        } else {
            setExpandedPackageIds(new Set(parseSummary.results.map(r => r.pkg.id)));
        }
    };

    const validPackages = useMemo(() => {
        if (!parseSummary) return [];
        return parseSummary.results.filter(r => r.validation.isValid);
    }, [parseSummary]);

    const handleCommitImport = async () => {
        if (!parseSummary || validPackages.length === 0) {
            onShowStatus('No valid service packages available to import.', 'error');
            return;
        }

        setIsSaving(true);
        onShowStatus(`Importing ${validPackages.length} service packages...`, 'info');

        try {
            const existingMap = new Map<string, ServicePackage>();
            existingPackages.forEach(p => {
                existingMap.set(p.name.trim().toLowerCase(), p);
            });

            const finalPackagesToSave: ServicePackage[] = [];
            let updatedCount = 0;
            let createdCount = 0;
            let skippedCount = 0;

            for (const item of validPackages) {
                const pkg = item.pkg;
                const matchKey = pkg.name.trim().toLowerCase();
                const existing = existingMap.get(matchKey);

                if (existing) {
                    if (duplicateMode === 'skip') {
                        skippedCount++;
                        continue;
                    } else if (duplicateMode === 'update') {
                        // Keep original ID to overwrite in Firestore
                        finalPackagesToSave.push({
                            ...pkg,
                            id: existing.id
                        });
                        updatedCount++;
                    } else {
                        // Create unique duplicate
                        finalPackagesToSave.push({
                            ...pkg,
                            id: `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                            name: `${pkg.name} (Imported)`
                        });
                        createdCount++;
                    }
                } else {
                    finalPackagesToSave.push(pkg);
                    createdCount++;
                }
            }

            if (finalPackagesToSave.length === 0) {
                onShowStatus(`All ${skippedCount} packages already exist and were skipped.`, 'info');
                setIsSaving(false);
                return;
            }

            // Write to Firestore in batches
            if (db) {
                const batchSize = 350;
                for (let i = 0; i < finalPackagesToSave.length; i += batchSize) {
                    const chunk = finalPackagesToSave.slice(i, i + batchSize);
                    const batch = writeBatch(db);
                    chunk.forEach(p => {
                        const cleanPkg = JSON.parse(JSON.stringify(p, (k, v) => v === undefined ? null : v));
                        const docRef = doc(collection(db, 'brooks_servicePackages'), p.id);
                        batch.set(docRef, cleanPkg, { merge: true });
                    });
                    await batch.commit();
                }
            }

            const successMsg = `Successfully imported ${finalPackagesToSave.length} packages (${createdCount} new, ${updatedCount} updated${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}).`;
            onShowStatus(successMsg, 'success');
            onImportSuccess(finalPackagesToSave, successMsg);
            onClose();
        } catch (err: any) {
            console.error('Import failed:', err);
            onShowStatus(`Import failed: ${err.message || 'Database error'}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600/30 rounded-xl border border-indigo-400/30 text-indigo-300">
                            <FileSpreadsheet size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                Import Service Packages
                                <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full border border-indigo-400/20 font-medium">
                                    CSV & Excel
                                </span>
                            </h2>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Batch load service packages with Labour hours, Quants, and Business Entities. Missing part numbers are supported.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content Container */}
                <div className="p-6 overflow-y-auto space-y-6 flex-grow">
                    {/* Template & Rules Guide Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1 max-w-2xl">
                            <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                                <Info size={16} className="text-indigo-600" />
                                <span>Import Requirements & Quality Guidelines</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                                <div className="flex items-center gap-1.5">
                                    <Check size={14} className="text-emerald-600 shrink-0" />
                                    <span><strong>Labour:</strong> Every package must have labour hours.</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Check size={14} className="text-emerald-600 shrink-0" />
                                    <span><strong>Quants:</strong> Quantities required for all items.</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Check size={14} className="text-emerald-600 shrink-0" />
                                    <span><strong>Business Entity:</strong> Match by name, code, or fallback.</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Check size={14} className="text-emerald-600 shrink-0" />
                                    <span><strong>Part Numbers:</strong> Optional (blank is fully allowed).</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => downloadServicePackageCsvTemplate(businessEntities)}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-2xs transition-all active:scale-95"
                                title="Download ready-to-fill CSV template"
                            >
                                <Download size={14} className="text-indigo-600" />
                                CSV Template
                            </button>
                            <button
                                type="button"
                                onClick={() => downloadServicePackageExcelTemplate(businessEntities)}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-2xs transition-all active:scale-95"
                                title="Download ready-to-fill Excel (.xlsx) template"
                            >
                                <Download size={14} className="text-emerald-600" />
                                Excel Template (.xlsx)
                            </button>
                        </div>
                    </div>

                    {/* Upload Dropzone & Configuration Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Dropzone (2 cols) */}
                        <div 
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                            className={`md:col-span-2 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${
                                isDragging 
                                    ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]' 
                                    : selectedFile 
                                        ? 'border-emerald-300 bg-emerald-50/20 hover:bg-emerald-50/40' 
                                        : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50'
                            }`}
                        >
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept=".csv, .xlsx, .xls"
                                onChange={handleFileChange}
                                className="hidden" 
                            />
                            {isParsing ? (
                                <div className="flex flex-col items-center gap-2">
                                    <RefreshCw size={28} className="animate-spin text-indigo-600" />
                                    <span className="text-sm font-semibold text-slate-700">Analysing spreadsheet structure...</span>
                                </div>
                            ) : selectedFile ? (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-full">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{selectedFile.name}</p>
                                        <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB — Click to choose a different file</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                                        <UploadCloud size={28} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700">
                                            Drop your CSV or Excel file here, or <span className="text-indigo-600 underline">browse</span>
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">Supports .csv, .xlsx, and .xls spreadsheets</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Import Settings Panel (1 col) */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                                    <Building2 size={13} className="text-indigo-600" /> Default Business Entity
                                </label>
                                <select
                                    value={fallbackEntityId}
                                    onChange={(e) => handleFallbackEntityChange(e.target.value)}
                                    className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    {businessEntities.map(e => (
                                        <option key={e.id} value={e.id}>
                                            {e.name} {e.shortCode ? `(${e.shortCode})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Used if a spreadsheet row leaves the entity blank or cannot be matched.
                                </p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                                    Duplicate Packages Handling
                                </label>
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="duplicateMode"
                                            value="update"
                                            checked={duplicateMode === 'update'}
                                            onChange={() => setDuplicateMode('update')}
                                            className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>Update existing packages</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="duplicateMode"
                                            value="duplicate"
                                            checked={duplicateMode === 'duplicate'}
                                            onChange={() => setDuplicateMode('duplicate')}
                                            className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>Import as new copy</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="duplicateMode"
                                            value="skip"
                                            checked={duplicateMode === 'skip'}
                                            onChange={() => setDuplicateMode('skip')}
                                            className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>Skip existing packages</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preview Section */}
                    {parseSummary && (
                        <div className="space-y-4 pt-2">
                            {/* Summary Metric Badges */}
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-3 rounded-xl border border-slate-200">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700 px-2 py-1 bg-white rounded-md border border-slate-200 shadow-2xs">
                                        Total Packages: {parseSummary.results.length}
                                    </span>
                                    <span className="text-xs font-bold text-emerald-700 px-2 py-1 bg-emerald-50 rounded-md border border-emerald-200 flex items-center gap-1">
                                        <CheckCircle2 size={13} /> {parseSummary.validCount} Valid & Ready
                                    </span>
                                    {parseSummary.warningCount > 0 && (
                                        <span className="text-xs font-bold text-amber-700 px-2 py-1 bg-amber-50 rounded-md border border-amber-200 flex items-center gap-1">
                                            <AlertTriangle size={13} /> {parseSummary.warningCount} Warnings
                                        </span>
                                    )}
                                    {parseSummary.errorCount > 0 && (
                                        <span className="text-xs font-bold text-red-700 px-2 py-1 bg-red-50 rounded-md border border-red-200 flex items-center gap-1">
                                            <XCircle size={13} /> {parseSummary.errorCount} Errors (Incomplete)
                                        </span>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={toggleExpandAll}
                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                    {expandedPackageIds.size === parseSummary.results.length ? 'Collapse All' : 'Expand All'}
                                </button>
                            </div>

                            {/* Packages Preview List */}
                            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                                {parseSummary.results.map((result, idx) => {
                                    const { pkg, entityName, totalLabourHours, labourItemCount, partItemCount, partsWithoutPartNumberCount, validation } = result;
                                    const isExpanded = expandedPackageIds.has(pkg.id);

                                    return (
                                        <div
                                            key={pkg.id || idx}
                                            className={`border rounded-xl transition-all overflow-hidden ${
                                                !validation.isValid
                                                    ? 'border-red-200 bg-red-50/20'
                                                    : validation.hasWarnings
                                                        ? 'border-amber-200 bg-amber-50/10'
                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            {/* Package Header Row */}
                                            <div
                                                onClick={() => toggleExpand(pkg.id)}
                                                className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                                            >
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                                                        !validation.isValid
                                                            ? 'bg-red-100 text-red-700'
                                                            : validation.hasWarnings
                                                                ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                        {!validation.isValid ? (
                                                            <XCircle size={16} />
                                                        ) : validation.hasWarnings ? (
                                                            <AlertTriangle size={16} />
                                                        ) : (
                                                            <CheckCircle2 size={16} />
                                                        )}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h4 className="font-bold text-sm text-slate-900 truncate">
                                                                {pkg.name}
                                                            </h4>
                                                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                                                                {entityName}
                                                            </span>
                                                            {(pkg.applicableMake || pkg.applicableModel) && (
                                                                <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                                                                    {[pkg.applicableMake, pkg.applicableModel, pkg.applicableVariant].filter(Boolean).join(' ')}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {pkg.description && (
                                                            <p className="text-xs text-slate-500 truncate mt-0.5">
                                                                {pkg.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pl-9 md:pl-0">
                                                    {/* Badges */}
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md" title="Labour Hours">
                                                            <Clock size={12} className="text-indigo-600" />
                                                            {totalLabourHours}h Labour
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md" title="Parts Included">
                                                            <Package size={12} className="text-amber-600" />
                                                            {partItemCount} Parts
                                                            {partsWithoutPartNumberCount > 0 && (
                                                                <span className="text-[9px] text-slate-400 font-normal">({partsWithoutPartNumberCount} no P/N)</span>
                                                            )}
                                                        </span>
                                                    </div>

                                                    {/* Price */}
                                                    <div className="text-right">
                                                        <div className="text-sm font-black text-slate-900">
                                                            {formatCurrency(pkg.totalPrice || 0)}
                                                            <span className="text-[10px] font-normal text-slate-500 ml-1">Gross</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-400">
                                                            Cost: {formatCurrency(pkg.totalCost || 0)}
                                                        </div>
                                                    </div>

                                                    <button type="button" className="text-slate-400 hover:text-slate-600">
                                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Validation Alert Banners if any */}
                                            {validation.errors.length > 0 && (
                                                <div className="px-4 py-2 bg-red-100/60 border-t border-red-200 text-xs text-red-800 space-y-0.5">
                                                    {validation.errors.map((err, eIdx) => (
                                                        <div key={eIdx} className="flex items-center gap-1.5 font-medium">
                                                            <XCircle size={13} className="shrink-0 text-red-600" />
                                                            <span>{err}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {validation.warnings.length > 0 && (
                                                <div className="px-4 py-2 bg-amber-100/60 border-t border-amber-200 text-xs text-amber-800 space-y-0.5">
                                                    {validation.warnings.map((warn, wIdx) => (
                                                        <div key={wIdx} className="flex items-center gap-1.5 font-medium">
                                                            <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                                                            <span>{warn}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Expandable Line Items Table */}
                                            {isExpanded && (
                                                <div className="border-t border-slate-200 bg-slate-50/70 p-3">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="text-slate-500 font-semibold uppercase text-[10px] border-b border-slate-200 text-left">
                                                                <th className="pb-1.5">Type</th>
                                                                <th className="pb-1.5">Description</th>
                                                                <th className="pb-1.5">Part No.</th>
                                                                <th className="pb-1.5 text-right">Quantity</th>
                                                                <th className="pb-1.5 text-right">Unit Price</th>
                                                                <th className="pb-1.5 text-right">Unit Cost</th>
                                                                <th className="pb-1.5 text-right">Line Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200/60">
                                                            {(pkg.costItems || []).map((item, itemIdx) => (
                                                                <tr key={item.id || itemIdx} className="hover:bg-slate-100/50">
                                                                    <td className="py-1.5">
                                                                        {item.isLabor ? (
                                                                            <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">
                                                                                <Wrench size={10} /> Labour
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">
                                                                                <Package size={10} /> Part
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-1.5 font-medium text-slate-800">
                                                                        {item.description}
                                                                    </td>
                                                                    <td className="py-1.5 text-slate-500 font-mono text-[11px]">
                                                                        {item.partNumber ? (
                                                                            item.partNumber
                                                                        ) : (
                                                                            <span className="text-slate-400 italic font-sans text-[10px]">None</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-1.5 text-right font-bold text-slate-900">
                                                                        {item.quantity} {item.isLabor ? 'hrs' : ''}
                                                                    </td>
                                                                    <td className="py-1.5 text-right text-slate-700">
                                                                        {formatCurrency(item.unitPrice || 0)}
                                                                    </td>
                                                                    <td className="py-1.5 text-right text-slate-500">
                                                                        {formatCurrency(item.unitCost || 0)}
                                                                    </td>
                                                                    <td className="py-1.5 text-right font-semibold text-slate-900">
                                                                        {formatCurrency((item.unitPrice || 0) * (item.quantity || 1))}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <div className="text-xs text-slate-500">
                        {parseSummary ? (
                            <span>
                                Ready to import <strong className="text-slate-900">{validPackages.length}</strong> of {parseSummary.results.length} packages.
                            </span>
                        ) : (
                            <span>Select a CSV or Excel file to preview package data before saving.</span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="flex-1 sm:flex-initial px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleCommitImport}
                            disabled={isSaving || !parseSummary || validPackages.length === 0}
                            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 ${
                                !parseSummary || validPackages.length === 0
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                            }`}
                        >
                            {isSaving ? (
                                <>
                                    <RefreshCw size={15} className="animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <UploadCloud size={15} />
                                    Import {validPackages.length > 0 ? `${validPackages.length} Packages` : 'Packages'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
