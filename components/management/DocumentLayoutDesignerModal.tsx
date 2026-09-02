import React, { useState, useEffect, useMemo } from 'react';
import { BusinessEntity, DocumentBlockConfig, DocumentTemplateConfig, DocumentBlockType } from '../../types';
import { 
    X, 
    Save, 
    ArrowUp, 
    ArrowDown, 
    Eye, 
    EyeOff, 
    Sliders, 
    RotateCcw, 
    Check, 
    Building2, 
    FileText, 
    User, 
    Car, 
    AlignLeft, 
    Wrench, 
    Package, 
    Clock, 
    CheckSquare, 
    Calculator, 
    CreditCard, 
    PenTool, 
    Shield, 
    Sparkles, 
    Printer, 
    ZoomIn, 
    ZoomOut, 
    Layers,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { toast } from 'react-toastify';
import { BLOCK_DEFINITIONS, getDefaultJobCardBlocks, getDefaultInvoiceBlocks, PRESET_TEMPLATES, getContainerStyleClasses } from '../../core/utils/documentTemplateDefaults';
import { getFile } from '../../utils/imageStore';

const CONTAINER_COLORS = [
    { key: 'default', label: 'Theme', bg: 'bg-indigo-600' },
    { key: 'slate', label: 'Slate', bg: 'bg-slate-600' },
    { key: 'blue', label: 'Blue', bg: 'bg-blue-600' },
    { key: 'indigo', label: 'Indigo', bg: 'bg-indigo-600' },
    { key: 'sky', label: 'Sky', bg: 'bg-sky-500' },
    { key: 'emerald', label: 'Emerald', bg: 'bg-emerald-600' },
    { key: 'amber', label: 'Amber', bg: 'bg-amber-500' },
    { key: 'rose', label: 'Rose', bg: 'bg-rose-600' },
    { key: 'purple', label: 'Purple', bg: 'bg-purple-600' },
    { key: 'dark', label: 'Dark', bg: 'bg-slate-900' },
];

const TEXT_COLORS_LIST = [
    { key: 'default', label: 'Auto', bg: 'bg-slate-900' },
    { key: 'dark', label: 'Dark', bg: 'bg-black' },
    { key: 'white', label: 'White', bg: 'bg-white border border-slate-300' },
    { key: 'slate', label: 'Slate', bg: 'bg-slate-600' },
    { key: 'indigo', label: 'Indigo', bg: 'bg-indigo-700' },
    { key: 'blue', label: 'Blue', bg: 'bg-blue-700' },
    { key: 'emerald', label: 'Emerald', bg: 'bg-emerald-700' },
    { key: 'amber', label: 'Amber', bg: 'bg-amber-700' },
    { key: 'rose', label: 'Rose', bg: 'bg-rose-700' },
    { key: 'purple', label: 'Purple', bg: 'bg-purple-700' },
];

interface DocumentLayoutDesignerModalProps {
    isOpen: boolean;
    onClose: () => void;
    entity: BusinessEntity;
    initialDocType?: 'job_card' | 'invoice';
    onSaveEntity: (updatedEntity: BusinessEntity) => Promise<void>;
}

const getIconComponent = (iconName: string) => {
    switch (iconName) {
        case 'Building2': return <Building2 size={16} />;
        case 'FileText': return <FileText size={16} />;
        case 'User': return <User size={16} />;
        case 'Car': return <Car size={16} />;
        case 'AlignLeft': return <AlignLeft size={16} />;
        case 'Wrench': return <Wrench size={16} />;
        case 'Package': return <Package size={16} />;
        case 'Clock': return <Clock size={16} />;
        case 'CheckSquare': return <CheckSquare size={16} />;
        case 'Calculator': return <Calculator size={16} />;
        case 'CreditCard': return <CreditCard size={16} />;
        case 'PenTool': return <PenTool size={16} />;
        case 'Shield': return <Shield size={16} />;
        default: return <FileText size={16} />;
    }
};

export const DocumentLayoutDesignerModal: React.FC<DocumentLayoutDesignerModalProps> = ({
    isOpen,
    onClose,
    entity,
    initialDocType = 'job_card',
    onSaveEntity
}) => {
    const [docType, setDocType] = useState<'job_card' | 'invoice'>(initialDocType);
    const [blocks, setBlocks] = useState<DocumentBlockConfig[]>([]);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [zoomLevel, setZoomLevel] = useState<number>(100);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [accentColor, setAccentColor] = useState<string>(entity?.color || 'indigo');

    // Load logo
    useEffect(() => {
        if (entity?.logoImageId) {
            getFile(entity.logoImageId).then(url => {
                if (url) setLogoUrl(url);
            });
        }
    }, [entity?.logoImageId]);

    // Initialize blocks when docType changes or entity loads
    useEffect(() => {
        if (docType === 'job_card') {
            const existing = entity?.jobCardLayout?.blocks;
            if (existing && existing.length > 0) {
                setBlocks([...existing].sort((a, b) => a.order - b.order));
            } else {
                setBlocks(getDefaultJobCardBlocks());
            }
        } else {
            const existing = entity?.invoiceLayout?.blocks;
            if (existing && existing.length > 0) {
                setBlocks([...existing].sort((a, b) => a.order - b.order));
            } else {
                setBlocks(getDefaultInvoiceBlocks());
            }
        }
        setSelectedBlockId(null);
    }, [docType, entity]);

    if (!isOpen) return null;

    // Block Reordering
    const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= blocks.length) return;

        const newBlocks = [...blocks];
        const [moved] = newBlocks.splice(index, 1);
        newBlocks.splice(targetIndex, 0, moved);

        // Reassign 1-based order
        const reordered = newBlocks.map((b, idx) => ({ ...b, order: idx + 1 }));
        setBlocks(reordered);
    };

    // Toggle Block Visibility
    const handleToggleVisibility = (id: string) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, visible: !b.visible } : b));
    };

    // Update Settings for a specific block
    const handleUpdateBlockSetting = (id: string, settingKey: string, value: any) => {
        setBlocks(prev => prev.map(b => {
            if (b.id !== id) return b;
            return {
                ...b,
                settings: {
                    ...(b.settings || {}),
                    [settingKey]: value
                }
            };
        }));
    };

    // Update Block Title
    const handleUpdateBlockTitle = (id: string, title: string) => {
        setBlocks(prev => prev.map(b => b.id === id ? { ...b, title } : b));
    };

    // Apply a Preset
    const handleApplyPreset = (presetKey: string) => {
        const preset = PRESET_TEMPLATES[presetKey];
        if (!preset) return;
        setBlocks(preset.blocks);
        toast.info(`Applied preset: ${preset.name}`);
    };

    // Apply Global Theme across all blocks
    const handleApplyGlobalTheme = (themeColor: string, containerStyle?: string) => {
        setAccentColor(themeColor);
        setBlocks(prev => prev.map(b => ({
            ...b,
            settings: {
                ...(b.settings || {}),
                containerColor: themeColor as any,
                ...(containerStyle ? { style: containerStyle as any } : {})
            }
        })));
        toast.success(`Applied ${themeColor.toUpperCase()} theme across all blocks!`);
    };

    // Apply current block's style to all blocks
    const handleApplyStyleToAll = (style: string) => {
        setBlocks(prev => prev.map(b => ({
            ...b,
            settings: {
                ...(b.settings || {}),
                style: style as any
            }
        })));
        toast.success(`Applied '${style}' container style to all blocks!`);
    };

    // Apply current block's color to all blocks
    const handleApplyColorToAll = (color: string) => {
        setAccentColor(color);
        setBlocks(prev => prev.map(b => ({
            ...b,
            settings: {
                ...(b.settings || {}),
                containerColor: color as any
            }
        })));
        toast.success(`Applied '${color}' color accent to all blocks!`);
    };

    // Apply current block's text color to all blocks
    const handleApplyTextColorToAll = (textColor: string) => {
        setBlocks(prev => prev.map(b => ({
            ...b,
            settings: {
                ...(b.settings || {}),
                textColor: textColor as any
            }
        })));
        toast.success(`Applied '${textColor}' text color to all blocks!`);
    };

    // Reset to defaults
    const handleResetDefaults = () => {
        if (!confirm(`Reset ${docType === 'job_card' ? 'Job Card' : 'Invoice'} layout to system defaults?`)) return;
        if (docType === 'job_card') {
            setBlocks(getDefaultJobCardBlocks());
        } else {
            setBlocks(getDefaultInvoiceBlocks());
        }
        toast.success('Layout reset to default template.');
    };

    // Save and lock
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const templateConfig: DocumentTemplateConfig = {
                documentType: docType,
                blocks: blocks.map((b, idx) => ({ ...b, order: idx + 1 })),
                accentColor: accentColor,
                updatedAt: new Date().toISOString()
            };

            const updatedEntity: BusinessEntity = {
                ...entity,
                ...(docType === 'job_card' ? { jobCardLayout: templateConfig } : { invoiceLayout: templateConfig })
            };

            await onSaveEntity(updatedEntity);
            toast.success(`${docType === 'job_card' ? 'Job Card' : 'Invoice'} layout saved successfully!`);
            onClose();
        } catch (err) {
            console.error('Failed to save document layout:', err);
            toast.error('Failed to save document layout.');
        } finally {
            setIsSaving(false);
        }
    };

    // Selected block definition helper
    const selectedBlock = blocks.find(b => b.id === selectedBlockId);
    const selectedDef = selectedBlock ? BLOCK_DEFINITIONS[selectedBlock.type] : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-6 overflow-hidden">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col w-full h-[95vh] max-w-[1600px] overflow-hidden animate-fade-in">
                
                {/* Header Bar */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600/40 border border-indigo-400/40 rounded-xl text-indigo-300">
                            <Layers size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white">
                                    Document Layout Designer
                                </h2>
                                <span className="text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-0.5 rounded-full">
                                    {entity.name || 'Business Entity'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-300">
                                Drag, reorder, and configure modular blocks with real-time A4 print preview
                            </p>
                        </div>
                    </div>

                    {/* Mode Switcher Pills */}
                    <div className="flex items-center gap-2 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
                        <button
                            type="button"
                            onClick={() => setDocType('job_card')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${docType === 'job_card' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Wrench size={14} /> Job Card Layout
                        </button>
                        <button
                            type="button"
                            onClick={() => setDocType('invoice')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${docType === 'invoice' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                        >
                            <FileText size={14} /> Invoice Layout
                        </button>
                    </div>

                    {/* Top Right Action Controls */}
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleResetDefaults}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700 transition cursor-pointer"
                            title="Reset layout to system defaults"
                        >
                            <RotateCcw size={13} /> Reset
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-lg transition cursor-pointer disabled:opacity-50"
                        >
                            <Save size={15} /> {isSaving ? 'Locking Layout...' : 'Save & Lock Layout'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Close designer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Sub-Header: Presets & Controls */}
                <div className="bg-slate-50 px-6 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                            <Sparkles size={14} className="text-amber-500" /> Complete Theme:
                        </span>
                        {[
                            { id: 'indigo', label: 'Royal Indigo', style: 'boxed', dot: 'bg-indigo-500' },
                            { id: 'blue', label: 'Executive Blue', style: 'banner', dot: 'bg-blue-500' },
                            { id: 'rose', label: 'Brookspeed Red', style: 'card', dot: 'bg-rose-500' },
                            { id: 'emerald', label: 'Emerald Pro', style: 'highlight', dot: 'bg-emerald-500' },
                            { id: 'slate', label: 'Slate Minimal', style: 'minimal', dot: 'bg-slate-500' },
                            { id: 'dark', label: 'Midnight Dark', style: 'banner', dot: 'bg-slate-900' },
                        ].map((theme) => {
                            const isCurrent = accentColor === theme.id;
                            return (
                                <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => handleApplyGlobalTheme(theme.id, theme.style)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                                        isCurrent 
                                            ? 'bg-slate-900 text-white ring-2 ring-indigo-400 shadow-sm' 
                                            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                                    }`}
                                >
                                    <span className={`w-2.5 h-2.5 rounded-full ${theme.dot}`} />
                                    {theme.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Canvas Zoom Controls */}
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-medium">Canvas Zoom:</span>
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                            <button
                                type="button"
                                onClick={() => setZoomLevel(prev => Math.max(70, prev - 10))}
                                className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                                title="Zoom Out"
                            >
                                <ZoomOut size={13} />
                            </button>
                            <span className="text-[11px] font-bold text-slate-700 px-1.5">{zoomLevel}%</span>
                            <button
                                type="button"
                                onClick={() => setZoomLevel(prev => Math.min(130, prev + 10))}
                                className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                                title="Zoom In"
                            >
                                <ZoomIn size={13} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main 2-Column Work Area */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                    
                    {/* Left Panel (5 cols): Block Ordering & Configuration Palette */}
                    <div className="lg:col-span-5 border-r border-slate-200 flex flex-col bg-slate-50/50 overflow-hidden h-full">
                        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                                    Structure & Sequence ({blocks.length} Blocks)
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    Reorder with arrows or click to configure properties
                                </p>
                            </div>
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                                {blocks.filter(b => b.visible).length} Visible
                            </span>
                        </div>

                        {/* Scrollable Block List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                            {blocks.map((block, idx) => {
                                const def = BLOCK_DEFINITIONS[block.type] || {
                                    type: block.type,
                                    label: block.type,
                                    icon: 'FileText',
                                    description: '',
                                    applicableTo: ['job_card', 'invoice'] as ('job_card' | 'invoice')[],
                                    defaultTitle: block.type,
                                    supportedSettings: {
                                        canChangeTitle: true,
                                        hasStyleControl: true
                                    }
                                };
                                const isSelected = selectedBlockId === block.id;

                                return (
                                    <div
                                        key={block.id}
                                        className={`rounded-xl border transition-all ${
                                            !block.visible 
                                                ? 'bg-slate-100/70 border-slate-200 opacity-60' 
                                                : isSelected 
                                                    ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-200 shadow-sm' 
                                                    : 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
                                        }`}
                                    >
                                        <div className="p-3 flex items-center justify-between gap-3">
                                            {/* Order Number & Icon */}
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0">
                                                    {idx + 1}
                                                </div>
                                                <div className={`p-1.5 rounded-lg shrink-0 ${block.visible ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                                    {getIconComponent(def.icon)}
                                                </div>
                                                <div 
                                                    onClick={() => setSelectedBlockId(isSelected ? null : block.id)}
                                                    className="min-w-0 flex-1 cursor-pointer"
                                                >
                                                    <div className="text-xs font-bold text-slate-800 truncate">
                                                        {block.title || def.label}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 truncate">
                                                        {def.label}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Reorder and Visibility Controls */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleMoveBlock(idx, 'up')}
                                                    disabled={idx === 0}
                                                    className="p-1 hover:bg-slate-100 rounded text-slate-600 disabled:opacity-30 cursor-pointer"
                                                    title="Move Up"
                                                >
                                                    <ArrowUp size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleMoveBlock(idx, 'down')}
                                                    disabled={idx === blocks.length - 1}
                                                    className="p-1 hover:bg-slate-100 rounded text-slate-600 disabled:opacity-30 cursor-pointer"
                                                    title="Move Down"
                                                >
                                                    <ArrowDown size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleVisibility(block.id)}
                                                    className={`p-1 rounded transition cursor-pointer ${block.visible ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-400 hover:bg-slate-200'}`}
                                                    title={block.visible ? 'Hide Block' : 'Show Block'}
                                                >
                                                    {block.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedBlockId(isSelected ? null : block.id)}
                                                    className={`p-1 rounded transition cursor-pointer ${isSelected ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-100'}`}
                                                    title="Configure block settings"
                                                >
                                                    <Sliders size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Block Settings Accordion Drawer (Expanded when selected) */}
                                        {isSelected && (
                                            <div className="px-4 pb-4 pt-2 border-t border-indigo-100 bg-white/90 rounded-b-xl space-y-3 text-xs animate-fade-in">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                        Block Header Title
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={block.title || ''}
                                                        onChange={(e) => handleUpdateBlockTitle(block.id, e.target.value)}
                                                        className="w-full p-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                                                        placeholder={def.defaultTitle}
                                                    />
                                                </div>

                                                {/* Header Logo Controls */}
                                                {block.type === 'header_logo' && (
                                                    <div className="space-y-2.5 pt-1">
                                                        <div>
                                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                                Logo Alignment
                                                            </label>
                                                            <div className="grid grid-cols-3 gap-1.5">
                                                                {['left', 'center', 'right'].map((pos) => (
                                                                    <button
                                                                        key={pos}
                                                                        type="button"
                                                                        onClick={() => handleUpdateBlockSetting(block.id, 'logoPosition', pos)}
                                                                        className={`py-1 text-xs font-bold uppercase rounded border transition cursor-pointer ${
                                                                            (block.settings?.logoPosition || 'right') === pos
                                                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                                                        }`}
                                                                    >
                                                                        {pos}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-1">
                                                                <span>Logo Height</span>
                                                                <span>{block.settings?.logoHeight || 65}px</span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="40"
                                                                max="120"
                                                                step="5"
                                                                value={block.settings?.logoHeight || 65}
                                                                onChange={(e) => handleUpdateBlockSetting(block.id, 'logoHeight', parseInt(e.target.value))}
                                                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Price Toggles (e.g. for Tasks or Parts) */}
                                                {def.supportedSettings.hasPriceToggle && (
                                                    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                                                        <div>
                                                            <div className="font-bold text-slate-800 text-[11px]">Show Prices on Document</div>
                                                            <div className="text-[10px] text-slate-500">Uncheck to hide pricing for workshop mechanics</div>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={block.settings?.showPrices !== false}
                                                            onChange={(e) => handleUpdateBlockSetting(block.id, 'showPrices', e.target.checked)}
                                                            className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                                                        />
                                                    </div>
                                                )}

                                                {/* Part Numbers Toggle */}
                                                {def.supportedSettings.hasPartNumbersToggle && (
                                                    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                                                        <div className="font-bold text-slate-800 text-[11px]">Show Part Numbers / SKUs</div>
                                                        <input
                                                            type="checkbox"
                                                            checked={block.settings?.showPartNumbers !== false}
                                                            onChange={(e) => handleUpdateBlockSetting(block.id, 'showPartNumbers', e.target.checked)}
                                                            className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                                                        />
                                                    </div>
                                                )}

                                                {/* Narrative Text Customizer */}
                                                {def.supportedSettings.hasCustomNarrative && (
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                            Default Narrative / Scope of Work Text
                                                        </label>
                                                        <textarea
                                                            rows={3}
                                                            value={block.settings?.customNarrativeText || ''}
                                                            onChange={(e) => handleUpdateBlockSetting(block.id, 'customNarrativeText', e.target.value)}
                                                            className="w-full p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                                                            placeholder="e.g. Customer booked in for Major 24k Service inspection..."
                                                        />
                                                    </div>
                                                )}

                                                {/* Terms of Business & Authorisation Customizer */}
                                                {def.supportedSettings.hasCustomTerms && (
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <label className="block text-[11px] font-bold text-slate-700">
                                                                Terms of Business / Authorisation Text
                                                            </label>
                                                            {entity.termsAndConditions && !block.settings?.customTermsText && (
                                                                <span className="text-[10px] text-indigo-600 font-medium">Using Entity Terms</span>
                                                            )}
                                                        </div>
                                                        <textarea
                                                            rows={3}
                                                            value={block.settings?.customTermsText ?? (entity.termsAndConditions || entity.storageTermsAndConditions || '')}
                                                            onChange={(e) => handleUpdateBlockSetting(block.id, 'customTermsText', e.target.value)}
                                                            className="w-full p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                                                            placeholder="I hereby authorize the repair work and acknowledge receipt of vehicle..."
                                                        />
                                                    </div>
                                                )}

                                                {/* Bank Details Customizer */}
                                                {def.supportedSettings.hasBankControls && (
                                                    <div className="space-y-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                                                        <div className="text-[11px] font-bold text-slate-800">Bank Remittance Information</div>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <div>
                                                                <label className="block text-[10px] text-slate-500 font-medium">Bank Name</label>
                                                                <input
                                                                    type="text"
                                                                    value={block.settings?.customBankName ?? (entity.bankAccountName || '')}
                                                                    onChange={(e) => handleUpdateBlockSetting(block.id, 'customBankName', e.target.value)}
                                                                    className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white"
                                                                    placeholder="e.g. Barclays Bank"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] text-slate-500 font-medium">Sort Code</label>
                                                                <input
                                                                    type="text"
                                                                    value={block.settings?.customSortCode ?? (entity.bankSortCode || '')}
                                                                    onChange={(e) => handleUpdateBlockSetting(block.id, 'customSortCode', e.target.value)}
                                                                    className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-mono"
                                                                    placeholder="20-45-78"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] text-slate-500 font-medium">Account No.</label>
                                                                <input
                                                                    type="text"
                                                                    value={block.settings?.customAccountNumber ?? (entity.bankAccountNumber || '')}
                                                                    onChange={(e) => handleUpdateBlockSetting(block.id, 'customAccountNumber', e.target.value)}
                                                                    className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white font-mono"
                                                                    placeholder="83920194"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-slate-500 font-medium">Payment Note / Reference Prompt</label>
                                                            <input
                                                                type="text"
                                                                value={block.settings?.customBankNarrative || ''}
                                                                onChange={(e) => handleUpdateBlockSetting(block.id, 'customBankNarrative', e.target.value)}
                                                                className="w-full p-1.5 border border-slate-300 rounded text-xs bg-white"
                                                                placeholder="e.g. Please quote invoice number on BACS transfers."
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Legal Footer Customizer */}
                                                {def.supportedSettings.hasCustomFooter && (
                                                    <div className="space-y-2">
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <label className="block text-[11px] font-bold text-slate-700">
                                                                    Footer Legal / Thank You Text
                                                                </label>
                                                                {entity.invoiceFooterText && !block.settings?.customFooterText && (
                                                                    <span className="text-[10px] text-indigo-600 font-medium">Using Entity Footer</span>
                                                                )}
                                                            </div>
                                                            <textarea
                                                                rows={2}
                                                                value={block.settings?.customFooterText ?? (entity.invoiceFooterText || '')}
                                                                onChange={(e) => handleUpdateBlockSetting(block.id, 'customFooterText', e.target.value)}
                                                                className="w-full p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                                                                placeholder="Registered in England & Wales. Thank you for your business."
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Signature Boxes */}
                                                {def.supportedSettings.hasSignatureControls && (
                                                    <div className="space-y-1.5 pt-1">
                                                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                                                            <div className="font-bold text-slate-800 text-[11px]">Customer Signature Box</div>
                                                            <input
                                                                type="checkbox"
                                                                checked={block.settings?.showCustomerSignature !== false}
                                                                onChange={(e) => handleUpdateBlockSetting(block.id, 'showCustomerSignature', e.target.checked)}
                                                                className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                                                            <div className="font-bold text-slate-800 text-[11px]">Technician Sign-Off Box</div>
                                                            <input
                                                                type="checkbox"
                                                                checked={block.settings?.showTechnicianSignature !== false}
                                                                onChange={(e) => handleUpdateBlockSetting(block.id, 'showTechnicianSignature', e.target.checked)}
                                                                className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Style Mode */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <label className="block text-[11px] font-bold text-slate-700">
                                                            Container Card Style
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApplyStyleToAll(block.settings?.style || 'standard')}
                                                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                                            title="Apply this container style to all blocks in the document"
                                                        >
                                                            Apply to All Blocks
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-1.5">
                                                        {[
                                                            { id: 'standard', label: 'Standard', desc: 'Clean default' },
                                                            { id: 'boxed', label: 'Boxed', desc: 'Outlined border' },
                                                            { id: 'highlight', label: 'Tinted', desc: 'Pastel highlight' },
                                                            { id: 'card', label: 'Accent Bar', desc: 'Left accent stripe' },
                                                            { id: 'banner', label: 'Banner', desc: 'Solid title bar' },
                                                            { id: 'minimal', label: 'Minimal', desc: 'Flush divider' }
                                                        ].map((st) => (
                                                            <button
                                                                key={st.id}
                                                                type="button"
                                                                onClick={() => handleUpdateBlockSetting(block.id, 'style', st.id)}
                                                                className={`p-1.5 text-left rounded-lg border transition cursor-pointer ${
                                                                    (block.settings?.style || 'standard') === st.id
                                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <div className="text-[10px] font-bold uppercase tracking-wider">{st.label}</div>
                                                                <div className={`text-[9px] ${ (block.settings?.style || 'standard') === st.id ? 'text-indigo-100' : 'text-slate-400' }`}>{st.desc}</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Container Color Setting */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <label className="block text-[11px] font-bold text-slate-700">
                                                                Container Color
                                                            </label>
                                                            <span className="text-[10px] font-bold text-slate-500 capitalize">
                                                                ({block.settings?.containerColor || 'Theme Default'})
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApplyColorToAll(block.settings?.containerColor || 'default')}
                                                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                                            title="Apply this color to all blocks in the document"
                                                        >
                                                            Apply to All Blocks
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-5 gap-1.5">
                                                        {CONTAINER_COLORS.map((c) => {
                                                            const isSelected = (block.settings?.containerColor || 'default') === c.key;
                                                            return (
                                                                <button
                                                                    key={c.key}
                                                                    type="button"
                                                                    onClick={() => handleUpdateBlockSetting(block.id, 'containerColor', c.key)}
                                                                    className={`flex items-center gap-1.5 p-1 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                                                                        isSelected 
                                                                            ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-indigo-400 shadow-xs' 
                                                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                                    }`}
                                                                >
                                                                    <span className={`w-3 h-3 rounded-full shrink-0 ${c.bg}`} />
                                                                    <span className="truncate">{c.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Text & Content Color Setting */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <label className="block text-[11px] font-bold text-slate-700">
                                                                Box Text Color
                                                            </label>
                                                            <span className="text-[10px] font-bold text-slate-500 capitalize">
                                                                ({block.settings?.textColor || 'Auto'})
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApplyTextColorToAll(block.settings?.textColor || 'default')}
                                                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                                            title="Apply this text color to all blocks in the document"
                                                        >
                                                            Apply to All Blocks
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-5 gap-1.5">
                                                        {TEXT_COLORS_LIST.map((tc) => {
                                                            const isSelected = (block.settings?.textColor || 'default') === tc.key;
                                                            return (
                                                                <button
                                                                    key={tc.key}
                                                                    type="button"
                                                                    onClick={() => handleUpdateBlockSetting(block.id, 'textColor', tc.key)}
                                                                    className={`flex items-center gap-1.5 p-1 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                                                                        isSelected 
                                                                            ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-indigo-400 shadow-xs' 
                                                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                                                    }`}
                                                                >
                                                                    <span className={`w-3 h-3 rounded-full shrink-0 ${tc.bg}`} />
                                                                    <span className="truncate">{tc.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Panel (7 cols): Live WYSIWYG A4 Document Sheet Canvas */}
                    <div className="lg:col-span-7 bg-slate-200/90 p-4 sm:p-8 flex flex-col items-center justify-start overflow-y-auto">
                        
                        {/* A4 Sheet Container */}
                        <div 
                            style={{ 
                                transform: `scale(${zoomLevel / 100})`, 
                                transformOrigin: 'top center',
                                width: '210mm',
                                minHeight: '297mm'
                            }}
                            className="bg-white rounded shadow-2xl p-8 sm:p-10 space-y-4 text-slate-900 border border-slate-300 font-sans transition-all shrink-0"
                        >
                            {/* Render Visible Blocks dynamically in sequence */}
                            {blocks.filter(b => b.visible).map((block) => {
                                const cs = getContainerStyleClasses(
                                    block.settings?.style, 
                                    block.settings?.containerColor, 
                                    accentColor,
                                    block.settings?.textColor
                                );

                                return (
                                    <div key={block.id} className="transition-all">
                                        {/* Block 1: Header Logo */}
                                        {block.type === 'header_logo' && (
                                            <div className={`flex items-start justify-between pb-4 border-b border-slate-200 gap-4 ${
                                                block.settings?.logoPosition === 'center' ? 'flex-col items-center text-center' :
                                                block.settings?.logoPosition === 'left' ? 'flex-row-reverse' : 'flex-row'
                                            }`}>
                                                <div className="space-y-1">
                                                    <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                                                        {entity.name || 'BROOKSPEED AUTOMOTIVE'}
                                                    </h1>
                                                    <div className="text-xs text-slate-600 space-y-0.5">
                                                        <div>{entity.addressLine1 || 'Unit 4, Speedwell Industrial Estate'}{entity.addressLine2 ? `, ${entity.addressLine2}` : ''}</div>
                                                        <div>{entity.city || 'Eastleigh'}, {entity.postcode || 'SO53 4NF'}</div>
                                                        <div>
                                                            Tel: <span className="font-semibold">{entity.phone || '02380 641672'}</span> | Email: <span className="font-semibold">{entity.email || 'service@brookspeed.com'}</span>
                                                            {entity.vatNumber && <span> | VAT: <span className="font-semibold">{entity.vatNumber}</span></span>}
                                                            {entity.companyNumber && <span> | Reg: <span className="font-semibold">{entity.companyNumber}</span></span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                {logoUrl ? (
                                                    <img 
                                                        src={logoUrl} 
                                                        alt="Logo" 
                                                        style={{ height: `${block.settings?.logoHeight || 65}px` }} 
                                                        className="object-contain" 
                                                    />
                                                ) : (
                                                    <div 
                                                        style={{ height: `${block.settings?.logoHeight || 65}px`, width: '120px' }}
                                                        className="bg-slate-100 border border-dashed border-slate-300 rounded flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase"
                                                    >
                                                        Logo Area
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Block 2: Document Meta Details */}
                                        {block.type === 'document_meta' && (
                                            <div 
                                                className={`${cs.wrapperClass} flex flex-wrap items-center justify-between gap-3`}
                                                style={cs.wrapperStyle}
                                            >
                                                <div>
                                                    <span 
                                                        className="text-[10px] font-black uppercase tracking-wider block"
                                                        style={cs.titleStyle}
                                                    >
                                                        {docType === 'job_card' ? 'JOB CARD NUMBER' : 'INVOICE NUMBER'}
                                                    </span>
                                                    <span 
                                                        className="text-lg font-black tracking-tight font-mono"
                                                        style={cs.textStyle}
                                                    >
                                                        {docType === 'job_card' ? 'JOB-2026-0842' : 'INV-2026-1194'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-6 text-xs" style={cs.textStyle}>
                                                    <div>
                                                        <span className="text-[10px] block uppercase font-semibold" style={cs.subtextStyle}>Date</span>
                                                        <span className="font-bold" style={cs.textStyle}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] block uppercase font-semibold" style={cs.subtextStyle}>Account</span>
                                                        <span className="font-bold font-mono" style={cs.textStyle}>ACC-BRK-092</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] block uppercase font-semibold" style={cs.subtextStyle}>Technician</span>
                                                        <span className="font-bold" style={cs.textStyle}>Ian Williams</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Block 3: Customer Details */}
                                        {block.type === 'customer_details' && (
                                            <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                                <div className={cs.headerClass} style={cs.headerStyle}>
                                                    <h4 className={cs.titleClass} style={cs.titleStyle}>
                                                        {block.title || 'Customer Details'}
                                                    </h4>
                                                </div>
                                                <div className={cs.bodyClass}>
                                                    <div className="text-xs space-y-0.5" style={cs.textStyle}>
                                                        <div className="font-bold text-sm">Dr. Anthony Harrington</div>
                                                        <div>42 Manor House Gardens, Sunningdale</div>
                                                        <div>Ascot, Berkshire, <span className="font-semibold uppercase">SL5 9PQ</span></div>
                                                        <div style={cs.subtextStyle}>Phone: <span className="font-semibold">07891 234567</span> | Email: <span className="font-semibold">anthony.h@example.com</span></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Block 4: Vehicle Details */}
                                        {block.type === 'vehicle_details' && (
                                            <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                                <div className={cs.headerClass} style={cs.headerStyle}>
                                                    <h4 className={cs.titleClass} style={cs.titleStyle}>
                                                        {block.title || 'Vehicle Details'}
                                                    </h4>
                                                    <span className="inline-block bg-yellow-400 text-black font-mono font-black text-xs px-2.5 py-0.5 rounded border border-yellow-500 shadow-2xs tracking-wider uppercase">
                                                        GU24 9NY
                                                    </span>
                                                </div>
                                                <div className={cs.bodyClass}>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs" style={cs.textStyle}>
                                                        <div><span className="block text-[10px]" style={cs.subtextStyle}>Make & Model:</span><strong>Porsche 911 (992) GT3 RS</strong></div>
                                                        <div><span className="block text-[10px]" style={cs.subtextStyle}>Year / Color:</span><strong>2023 / Guards Red</strong></div>
                                                        <div><span className="block text-[10px]" style={cs.subtextStyle}>Recorded Mileage:</span><strong>14,820 miles</strong></div>
                                                        <div><span className="block text-[10px]" style={cs.subtextStyle}>Key Tag / Slot:</span><strong>Key #12 (Slot 4)</strong></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Block 5: Narrative Description */}
                                        {block.type === 'narrative_description' && (
                                            <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                                <div className={cs.headerClass} style={cs.headerStyle}>
                                                    <h4 className={cs.titleClass} style={cs.titleStyle}>
                                                        {block.title || 'Work Requested & Customer Narrative'}
                                                    </h4>
                                                </div>
                                                <div className={cs.bodyClass}>
                                                    <p className="text-xs leading-relaxed italic" style={cs.textStyle}>
                                                        "{block.settings?.customNarrativeText || "Customer booked in for Major 24k Service inspection, brake fluid flush, and investigating a slight squeal from front left ceramic brake discs when cold. Check tyre wear and track day alignment."}"
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Block 6: Tasks & Packages */}
                                        {block.type === 'tasks_packages' && (
                                            <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                                <div className={cs.headerClass} style={cs.headerStyle}>
                                                    <div className={cs.titleClass} style={cs.titleStyle}>
                                                        {block.title || 'Workshop Operations & Labour Tasks'}
                                                    </div>
                                                </div>
                                                <div className="p-0 overflow-x-auto">
                                                    <table className="w-full text-xs text-left" style={cs.textStyle}>
                                                        <thead className="bg-slate-50/60 border-b text-[10px] uppercase" style={cs.subtextStyle}>
                                                            <tr>
                                                                <th className="p-2">Description</th>
                                                                <th className="p-2 text-center">Hours</th>
                                                                {block.settings?.showPrices !== false && <th className="p-2 text-right">Net Price</th>}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100/60">
                                                            <tr>
                                                                <td className="p-2 font-medium">Major 24,000 Mile Service Package (Engine Oil, Filters, Spark Plugs)</td>
                                                                <td className="p-2 text-center font-mono">3.50 hrs</td>
                                                                {block.settings?.showPrices !== false && <td className="p-2 text-right font-semibold">£385.00</td>}
                                                            </tr>
                                                            <tr>
                                                                <td className="p-2 font-medium">Brake Fluid System Flush & Bleed (Racing DOT 4)</td>
                                                                <td className="p-2 text-center font-mono">1.00 hr</td>
                                                                {block.settings?.showPrices !== false && <td className="p-2 text-right font-semibold">£110.00</td>}
                                                            </tr>
                                                            <tr>
                                                                <td className="p-2 font-medium">Investigate Brake Squeal & Clean Calipers</td>
                                                                <td className="p-2 text-center font-mono">0.50 hr</td>
                                                                {block.settings?.showPrices !== false && <td className="p-2 text-right font-semibold">£55.00</td>}
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Block 7: Parts Items */}
                                        {block.type === 'parts_items' && (
                                            <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                                <div className={cs.headerClass} style={cs.headerStyle}>
                                                    <div className={cs.titleClass} style={cs.titleStyle}>
                                                        {block.title || 'Parts & Materials'}
                                                    </div>
                                                </div>
                                                <div className="p-0 overflow-x-auto">
                                                    <table className="w-full text-xs text-left" style={cs.textStyle}>
                                                        <thead className="bg-slate-50/60 border-b text-[10px] uppercase" style={cs.subtextStyle}>
                                                            <tr>
                                                                {block.settings?.showPartNumbers !== false && <th className="p-2">Part No.</th>}
                                                                <th className="p-2">Description</th>
                                                                <th className="p-2 text-center">Qty</th>
                                                                {block.settings?.showPrices !== false && <th className="p-2 text-right">Unit Net</th>}
                                                                {block.settings?.showPrices !== false && <th className="p-2 text-right">Total Net</th>}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100/60">
                                                            <tr>
                                                                {block.settings?.showPartNumbers !== false && <td className="p-2 font-mono text-[10px]" style={cs.subtextStyle}>0PB-115-561</td>}
                                                                <td className="p-2 font-medium">Genuine Porsche Oil Filter Element</td>
                                                                <td className="p-2 text-center">1</td>
                                                                {block.settings?.showPrices !== false && <td className="p-2 text-right font-mono">£34.50</td>}
                                                                {block.settings?.showPrices !== false && <td className="p-2 text-right font-semibold font-mono">£34.50</td>}
                                                            </tr>
                                                            <tr>
                                                                {block.settings?.showPartNumbers !== false && <td className="p-2 font-mono text-[10px]" style={cs.subtextStyle}>MOB-1-0W40</td>}
                                                                <td className="p-2 font-medium">Mobil 1 ESP X3 0W-40 Synthetic (Litres)</td>
                                                                <td className="p-2 text-center">8</td>
                                                                {block.settings?.showPrices !== false && <td className="p-2 text-right font-mono">£16.50</td>}
                                                                {block.settings?.showPrices !== false && <td className="p-2 text-right font-semibold font-mono">£132.00</td>}
                                                            </tr>
                                                            <tr>
                                                                {block.settings?.showPartNumbers !== false && <td className="p-2 font-mono text-[10px]" style={cs.subtextStyle}>MOTUL-RBF660</td>}
                                                                <td className="p-2 font-medium">Motul RBF660 Factory Line High Temp Brake Fluid (500ml)</td>
                                                                <td className="p-2 text-center">2</td>
                                                                {block.settings?.showPrices !== false && <td className="p-2 text-right font-mono">£19.00</td>}
                                                                {block.settings?.showPrices !== false && <td className="p-2 text-right font-semibold font-mono">£38.00</td>}
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Block 8: Labour Summary (Job Card specific) */}
                                        {block.type === 'labour_summary' && (
                                            <div className={`${cs.wrapperClass} flex items-center justify-between`} style={cs.wrapperStyle}>
                                                <div className="p-3.5" style={cs.textStyle}>
                                                    <span className="font-bold">Technician Time Allocation</span>
                                                    <div className="text-[11px]" style={cs.subtextStyle}>Allocated: 5.00 hrs | Booked Time: 4.75 hrs</div>
                                                </div>
                                                <div className="p-3.5 flex items-center gap-4 text-xs font-mono font-bold" style={cs.textStyle}>
                                                    <span className="bg-white/80 px-2 py-1 rounded border border-slate-200">Start: 08:30</span>
                                                    <span className="bg-white/80 px-2 py-1 rounded border border-slate-200">Finish: 13:15</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Block 9: Financial Totals */}
                                        {block.type === 'financial_totals' && (
                                            <div className="flex justify-end pt-2">
                                                <div className={`w-72 ${cs.wrapperClass} p-3.5 space-y-1.5 text-xs`} style={cs.wrapperStyle}>
                                                    <div className="flex justify-between" style={cs.subtextStyle}>
                                                        <span>Labour Subtotal:</span>
                                                        <span className="font-mono font-semibold" style={cs.textStyle}>£550.00</span>
                                                    </div>
                                                    <div className="flex justify-between" style={cs.subtextStyle}>
                                                        <span>Parts & Materials:</span>
                                                        <span className="font-mono font-semibold" style={cs.textStyle}>£204.50</span>
                                                    </div>
                                                    <div className="flex justify-between" style={cs.subtextStyle}>
                                                        <span>Net Amount:</span>
                                                        <span className="font-mono font-bold" style={cs.textStyle}>£754.50</span>
                                                    </div>
                                                    <div className="flex justify-between" style={cs.subtextStyle}>
                                                        <span>VAT (20.0%):</span>
                                                        <span className="font-mono font-semibold" style={cs.textStyle}>£150.90</span>
                                                    </div>
                                                    <div className="flex justify-between text-base font-black border-t border-slate-300 pt-1.5" style={cs.textStyle}>
                                                        <span>TOTAL DUE:</span>
                                                        <span className="font-mono" style={{ color: cs.titleStyle?.color || '#4f46e5' }}>£905.40</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Block 10: Bank Details */}
                                        {block.type === 'bank_details' && (
                                            <div className={`${cs.wrapperClass} p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs`} style={cs.wrapperStyle}>
                                                <div>
                                                    <h4 className={cs.titleClass} style={cs.titleStyle}>
                                                        {block.title || 'Bank Remittance Details'}
                                                    </h4>
                                                    <div className="text-[11px] pt-0.5" style={cs.subtextStyle}>
                                                        {block.settings?.customBankNarrative || 'Please quote invoice reference on electronic transfers.'}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs font-mono" style={cs.textStyle}>
                                                    <div><span className="text-[10px] block" style={cs.subtextStyle}>Bank</span><strong>{block.settings?.customBankName || entity.bankAccountName || 'Barclays Bank UK'}</strong></div>
                                                    <div><span className="text-[10px] block" style={cs.subtextStyle}>Sort Code</span><strong>{block.settings?.customSortCode || entity.bankSortCode || '20-45-78'}</strong></div>
                                                    <div><span className="text-[10px] block" style={cs.subtextStyle}>Account No.</span><strong>{block.settings?.customAccountNumber || entity.bankAccountNumber || '83920194'}</strong></div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Block 11: Authorisation & Signatures */}
                                        {block.type === 'terms_signoff' && (
                                            <div className={cs.wrapperClass} style={cs.wrapperStyle}>
                                                <div className={cs.headerClass} style={cs.headerStyle}>
                                                    <h4 className={cs.titleClass} style={cs.titleStyle}>
                                                        {block.title || 'Terms & Authorisation'}
                                                    </h4>
                                                </div>
                                                <div className={cs.bodyClass}>
                                                    <div className="text-[10px] leading-tight" style={cs.subtextStyle}>
                                                        {block.settings?.customTermsText || entity.termsAndConditions || entity.storageTermsAndConditions || "I hereby authorize the repair work and acknowledge receipt of vehicle in satisfactory condition. All parts replaced remain the property of the workshop until invoice is paid in full."}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4 pt-1">
                                                        {block.settings?.showCustomerSignature !== false && (
                                                            <div className="border-t border-slate-400 pt-1 flex justify-between text-[10px]" style={cs.subtextStyle}>
                                                                <span>Customer Signature</span>
                                                                <span>Date: ____________</span>
                                                            </div>
                                                        )}
                                                        {block.settings?.showTechnicianSignature !== false && (
                                                            <div className="border-t border-slate-400 pt-1 flex justify-between text-[10px]" style={cs.subtextStyle}>
                                                                <span>Technician Signature</span>
                                                                <span>Date: ____________</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Block 12: Legal Footer */}
                                        {block.type === 'footer_legal' && (
                                            <div className="pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400 space-y-0.5">
                                                <div>
                                                    {entity.name || 'Brookspeed Automotive Ltd'}
                                                    {entity.companyNumber && <span> | Company Reg No: {entity.companyNumber}</span>}
                                                    {entity.vatNumber && <span> | VAT Reg: {entity.vatNumber}</span>}
                                                </div>
                                                <div>{block.settings?.customFooterText || entity.invoiceFooterText || 'Registered in England & Wales. Thank you for your business.'}</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DocumentLayoutDesignerModal;
