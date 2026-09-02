import { DocumentBlockConfig, DocumentTemplateConfig, DocumentBlockType } from '../../types';

export interface BlockDefinition {
    type: DocumentBlockType;
    label: string;
    description: string;
    icon: string;
    applicableTo: ('job_card' | 'invoice' | 'estimate')[];
    defaultTitle: string;
    supportedSettings: {
        canChangeTitle?: boolean;
        hasLogoControls?: boolean;
        hasPriceToggle?: boolean;
        hasPartNumbersToggle?: boolean;
        hasTechNotesToggle?: boolean;
        hasSignatureControls?: boolean;
        hasBankToggle?: boolean;
        hasVatToggle?: boolean;
        hasColumnsControl?: boolean;
        hasCustomNarrative?: boolean;
        hasStyleControl?: boolean;
    };
}

export const BLOCK_DEFINITIONS: Record<DocumentBlockType, BlockDefinition> = {
    header_logo: {
        type: 'header_logo',
        label: 'Header & Company Logo',
        description: 'Company logo, registered name, address, contact numbers, and VAT/Company registration details.',
        icon: 'Building2',
        applicableTo: ['job_card', 'invoice', 'estimate'],
        defaultTitle: 'Company Header',
        supportedSettings: {
            hasLogoControls: true,
            hasStyleControl: true,
        }
    },
    document_meta: {
        type: 'document_meta',
        label: 'Document Details & Reference',
        description: 'Document number (Job # / Invoice #), issue date, due date, PO reference, account code, and technician.',
        icon: 'FileText',
        applicableTo: ['job_card', 'invoice', 'estimate'],
        defaultTitle: 'Document Reference',
        supportedSettings: {
            hasStyleControl: true,
        }
    },
    customer_details: {
        type: 'customer_details',
        label: 'Customer & Billing Info',
        description: 'Customer full name, billing address, telephone, email address, and account reference.',
        icon: 'User',
        applicableTo: ['job_card', 'invoice', 'estimate'],
        defaultTitle: 'Customer Details',
        supportedSettings: {
            canChangeTitle: true,
            hasStyleControl: true,
        }
    },
    vehicle_details: {
        type: 'vehicle_details',
        label: 'Vehicle Information',
        description: 'Registration plate, make, model, year, VIN/Chassis, recorded mileage, key number, and fuel level.',
        icon: 'Car',
        applicableTo: ['job_card', 'invoice', 'estimate'],
        defaultTitle: 'Vehicle Details',
        supportedSettings: {
            canChangeTitle: true,
            hasStyleControl: true,
        }
    },
    narrative_description: {
        type: 'narrative_description',
        label: 'Work Narrative & Customer Instructions',
        description: 'Customer reported faults, instructions, initial diagnostic findings, and workshop job narrative.',
        icon: 'AlignLeft',
        applicableTo: ['job_card', 'invoice', 'estimate'],
        defaultTitle: 'Work Requested / Narrative',
        supportedSettings: {
            canChangeTitle: true,
            hasCustomNarrative: true,
            hasStyleControl: true,
        }
    },
    tasks_packages: {
        type: 'tasks_packages',
        label: 'Work Packages & Labour Tasks',
        description: 'Booked service packages, scheduled labour operations, estimated/actual hours, and assigned technicians.',
        icon: 'Wrench',
        applicableTo: ['job_card', 'invoice', 'estimate'],
        defaultTitle: 'Scheduled Tasks & Operations',
        supportedSettings: {
            canChangeTitle: true,
            hasPriceToggle: true,
            hasTechNotesToggle: true,
            hasStyleControl: true,
        }
    },
    parts_items: {
        type: 'parts_items',
        label: 'Parts Used & Consumables',
        description: 'Itemized parts table: part numbers, descriptions, quantity, unit net prices, VAT rates, and extended totals.',
        icon: 'Package',
        applicableTo: ['job_card', 'invoice', 'estimate'],
        defaultTitle: 'Parts & Materials',
        supportedSettings: {
            canChangeTitle: true,
            hasPriceToggle: true,
            hasPartNumbersToggle: true,
            hasStyleControl: true,
        }
    },
    labour_summary: {
        type: 'labour_summary',
        label: 'Labour Time Tracking & Sign-off',
        description: 'Summary of workshop labour hours, technician punch time, and engineer sign-off stamps.',
        icon: 'Clock',
        applicableTo: ['job_card'],
        defaultTitle: 'Labour & Time Allocation',
        supportedSettings: {
            canChangeTitle: true,
            hasPriceToggle: true,
            hasStyleControl: true,
        }
    },
    inspection_summary: {
        type: 'inspection_summary',
        label: 'Vehicle Inspection & Checklist',
        description: 'Safety check summary, tyre tread depths, brake measurements, fluid checks, and vehicle damage diagram.',
        icon: 'CheckSquare',
        applicableTo: ['job_card', 'invoice'],
        defaultTitle: 'Vehicle Safety & Inspection',
        supportedSettings: {
            canChangeTitle: true,
            hasStyleControl: true,
        }
    },
    financial_totals: {
        type: 'financial_totals',
        label: 'Financial Summary & Totals',
        description: 'Subtotal (Parts + Labour), VAT breakdown per tax rate, grand total, deposits applied, and balance due.',
        icon: 'Calculator',
        applicableTo: ['invoice', 'estimate', 'job_card'],
        defaultTitle: 'Financial Summary',
        supportedSettings: {
            canChangeTitle: true,
            hasVatToggle: true,
            hasStyleControl: true,
        }
    },
    bank_details: {
        type: 'bank_details',
        label: 'Bank & Remittance Details',
        description: 'Bank name, sort code, account number, payment reference, and accepted payment methods.',
        icon: 'CreditCard',
        applicableTo: ['invoice', 'estimate'],
        defaultTitle: 'Bank Remittance Details',
        supportedSettings: {
            canChangeTitle: true,
            hasBankToggle: true,
            hasStyleControl: true,
        }
    },
    terms_signoff: {
        type: 'terms_signoff',
        label: 'Authorisation & Signatures',
        description: 'Legal authorization disclaimer, customer collection signature box, technician completion signature, and date.',
        icon: 'PenTool',
        applicableTo: ['job_card', 'invoice', 'estimate'],
        defaultTitle: 'Authorisation & Handover',
        supportedSettings: {
            canChangeTitle: true,
            hasSignatureControls: true,
            hasStyleControl: true,
        }
    },
    footer_legal: {
        type: 'footer_legal',
        label: 'Legal Footer & Notes',
        description: 'Registered company number, VAT registration, registered office, copyright, and invoice legal footer notes.',
        icon: 'Shield',
        applicableTo: ['job_card', 'invoice', 'estimate'],
        defaultTitle: 'Legal Footer',
        supportedSettings: {
            canChangeTitle: true,
            hasStyleControl: true,
        }
    }
};

export const getDefaultJobCardBlocks = (): DocumentBlockConfig[] => [
    {
        id: 'block_header',
        type: 'header_logo',
        title: 'Company Header',
        visible: true,
        order: 1,
        settings: { logoPosition: 'right', logoHeight: 65, style: 'standard' }
    },
    {
        id: 'block_meta',
        type: 'document_meta',
        title: 'Job Card Details',
        visible: true,
        order: 2,
        settings: { style: 'highlight' }
    },
    {
        id: 'block_customer_vehicle',
        type: 'customer_details',
        title: 'Customer Details',
        visible: true,
        order: 3,
        settings: { columns: 2, style: 'boxed' }
    },
    {
        id: 'block_vehicle',
        type: 'vehicle_details',
        title: 'Vehicle Information',
        visible: true,
        order: 4,
        settings: { style: 'boxed' }
    },
    {
        id: 'block_narrative',
        type: 'narrative_description',
        title: 'Customer Instructions & Reported Faults',
        visible: true,
        order: 5,
        settings: { style: 'standard' }
    },
    {
        id: 'block_tasks',
        type: 'tasks_packages',
        title: 'Workshop Operations & Tasks',
        visible: true,
        order: 6,
        settings: { showPrices: false, showTechNotes: true, style: 'standard' }
    },
    {
        id: 'block_parts',
        type: 'parts_items',
        title: 'Required Parts & Materials',
        visible: true,
        order: 7,
        settings: { showPrices: false, showPartNumbers: true, style: 'standard' }
    },
    {
        id: 'block_labour',
        type: 'labour_summary',
        title: 'Technician Time Log & Notes',
        visible: true,
        order: 8,
        settings: { showPrices: false, style: 'boxed' }
    },
    {
        id: 'block_inspection',
        type: 'inspection_summary',
        title: 'Vehicle Inspection Checklist',
        visible: true,
        order: 9,
        settings: { showVehicleDiagram: true, style: 'standard' }
    },
    {
        id: 'block_signoff',
        type: 'terms_signoff',
        title: 'Workshop Sign-Off & Customer Handover',
        visible: true,
        order: 10,
        settings: { showCustomerSignature: true, showTechnicianSignature: true, style: 'boxed' }
    },
    {
        id: 'block_footer',
        type: 'footer_legal',
        title: 'Company Footer',
        visible: true,
        order: 11,
        settings: { style: 'minimal' }
    }
];

export const getDefaultInvoiceBlocks = (): DocumentBlockConfig[] => [
    {
        id: 'inv_header',
        type: 'header_logo',
        title: 'Company Header',
        visible: true,
        order: 1,
        settings: { logoPosition: 'right', logoHeight: 70, style: 'standard' }
    },
    {
        id: 'inv_meta',
        type: 'document_meta',
        title: 'Invoice Details',
        visible: true,
        order: 2,
        settings: { style: 'highlight' }
    },
    {
        id: 'inv_customer',
        type: 'customer_details',
        title: 'Billed To',
        visible: true,
        order: 3,
        settings: { columns: 2, style: 'boxed' }
    },
    {
        id: 'inv_vehicle',
        type: 'vehicle_details',
        title: 'Vehicle Reference',
        visible: true,
        order: 4,
        settings: { style: 'boxed' }
    },
    {
        id: 'inv_narrative',
        type: 'narrative_description',
        title: 'Summary of Work Carried Out',
        visible: true,
        order: 5,
        settings: { style: 'standard' }
    },
    {
        id: 'inv_tasks',
        type: 'tasks_packages',
        title: 'Labour & Services Completed',
        visible: true,
        order: 6,
        settings: { showPrices: true, showTechNotes: false, style: 'standard' }
    },
    {
        id: 'inv_parts',
        type: 'parts_items',
        title: 'Parts & Consumables',
        visible: true,
        order: 7,
        settings: { showPrices: true, showPartNumbers: true, style: 'standard' }
    },
    {
        id: 'inv_totals',
        type: 'financial_totals',
        title: 'Payment & VAT Summary',
        visible: true,
        order: 8,
        settings: { showVatBreakdown: true, style: 'highlight' }
    },
    {
        id: 'inv_bank',
        type: 'bank_details',
        title: 'Payment Methods & Bank Details',
        visible: true,
        order: 9,
        settings: { showBankDetails: true, style: 'boxed' }
    },
    {
        id: 'inv_signoff',
        type: 'terms_signoff',
        title: 'Terms of Business',
        visible: true,
        order: 10,
        settings: { showCustomerSignature: false, showTechnicianSignature: false, style: 'minimal' }
    },
    {
        id: 'inv_footer',
        type: 'footer_legal',
        title: 'Legal & Company Registration',
        visible: true,
        order: 11,
        settings: { style: 'minimal' }
    }
];

export const PRESET_TEMPLATES: Record<string, { name: string; documentType: 'job_card' | 'invoice'; description: string; blocks: DocumentBlockConfig[] }> = {
    'workshop_standard_job': {
        name: 'Modern Workshop Job Card (Recommended)',
        documentType: 'job_card',
        description: 'Clean layout with customer instructions, tasks, parts, time logs, and quality sign-off.',
        blocks: getDefaultJobCardBlocks()
    },
    'technician_focused_job': {
        name: 'Technician Work Order (Checklists & Inspections)',
        documentType: 'job_card',
        description: 'Emphasizes vehicle inspection diagrams, safety checklist items, and technician punch sign-offs without financial prices.',
        blocks: getDefaultJobCardBlocks().map(b => {
            if (b.type === 'inspection_summary') return { ...b, order: 4 };
            if (b.type === 'narrative_description') return { ...b, order: 5 };
            return b;
        }).sort((a, b) => a.order - b.order)
    },
    'invoice_standard': {
        name: 'Modern Itemized Invoice (Recommended)',
        documentType: 'invoice',
        description: 'Professional invoice layout with separate labour and parts sections, VAT breakdown table, and bank transfer details.',
        blocks: getDefaultInvoiceBlocks()
    },
    'invoice_executive': {
        name: 'Executive Clean Invoice',
        documentType: 'invoice',
        description: 'High-contrast header, prominent vehicle badge, streamlined totals summary, and clean bank remittance block.',
        blocks: getDefaultInvoiceBlocks().map(b => {
            if (b.type === 'header_logo') return { ...b, settings: { ...b.settings, logoPosition: 'left', logoHeight: 80 } };
            return b;
        })
    }
};

export interface ContainerStyleResult {
    wrapperClass: string;
    headerClass: string;
    titleClass: string;
    bodyClass: string;
    accentClass: string;
}

export interface ColorThemeDefinition {
    id: string;
    label: string;
    primary: string;
    primaryDark: string;
    border: string;
    bgTint: string;
    text: string;
    headerBg: string;
    headerText: string;
    badgeBg: string;
    badgeText: string;
}

export const COLOR_PALETTES: Record<string, ColorThemeDefinition> = {
    indigo: {
        id: 'indigo',
        label: 'Royal Indigo',
        primary: '#4f46e5',
        primaryDark: '#3730a3',
        border: '#c7d2fe',
        bgTint: '#f5f7ff',
        text: '#312e81',
        headerBg: '#4338ca',
        headerText: '#ffffff',
        badgeBg: '#e0e7ff',
        badgeText: '#3730a3'
    },
    blue: {
        id: 'blue',
        label: 'Classic Blue',
        primary: '#2563eb',
        primaryDark: '#1d4ed8',
        border: '#bfdbfe',
        bgTint: '#f0f7ff',
        text: '#1e3a8a',
        headerBg: '#1d4ed8',
        headerText: '#ffffff',
        badgeBg: '#dbeafe',
        badgeText: '#1e40af'
    },
    sky: {
        id: 'sky',
        label: 'Sky Blue',
        primary: '#0284c7',
        primaryDark: '#0369a1',
        border: '#bae6fd',
        bgTint: '#f0f9ff',
        text: '#0c4a6e',
        headerBg: '#0284c7',
        headerText: '#ffffff',
        badgeBg: '#e0f2fe',
        badgeText: '#0369a1'
    },
    slate: {
        id: 'slate',
        label: 'Charcoal Slate',
        primary: '#475569',
        primaryDark: '#334155',
        border: '#cbd5e1',
        bgTint: '#f8fafc',
        text: '#0f172a',
        headerBg: '#334155',
        headerText: '#ffffff',
        badgeBg: '#f1f5f9',
        badgeText: '#334155'
    },
    dark: {
        id: 'dark',
        label: 'Midnight Steel',
        primary: '#0f172a',
        primaryDark: '#020617',
        border: '#334155',
        bgTint: '#0f172a',
        text: '#f8fafc',
        headerBg: '#020617',
        headerText: '#ffffff',
        badgeBg: '#1e293b',
        badgeText: '#f8fafc'
    },
    emerald: {
        id: 'emerald',
        label: 'Emerald Green',
        primary: '#059669',
        primaryDark: '#047857',
        border: '#a7f3d0',
        bgTint: '#f0fdf4',
        text: '#064e3b',
        headerBg: '#047857',
        headerText: '#ffffff',
        badgeBg: '#d1fae5',
        badgeText: '#065f46'
    },
    amber: {
        id: 'amber',
        label: 'Amber Gold',
        primary: '#d97706',
        primaryDark: '#b45309',
        border: '#fde68a',
        bgTint: '#fffbeb',
        text: '#78350f',
        headerBg: '#b45309',
        headerText: '#ffffff',
        badgeBg: '#fef3c7',
        badgeText: '#92400e'
    },
    rose: {
        id: 'rose',
        label: 'Crimson Rose',
        primary: '#e11d48',
        primaryDark: '#be123c',
        border: '#fecdd3',
        bgTint: '#fff1f2',
        text: '#881337',
        headerBg: '#be123c',
        headerText: '#ffffff',
        badgeBg: '#ffe4e6',
        badgeText: '#9f1239'
    },
    purple: {
        id: 'purple',
        label: 'Deep Purple',
        primary: '#7c3aed',
        primaryDark: '#6d28d9',
        border: '#ddd6fe',
        bgTint: '#faf5ff',
        text: '#4c1d95',
        headerBg: '#6d28d9',
        headerText: '#ffffff',
        badgeBg: '#ede9fe',
        badgeText: '#5b21b6'
    },
    teal: {
        id: 'teal',
        label: 'Teal Cyan',
        primary: '#0d9488',
        primaryDark: '#0f766e',
        border: '#99f6e4',
        bgTint: '#f0fdfa',
        text: '#134e4a',
        headerBg: '#0f766e',
        headerText: '#ffffff',
        badgeBg: '#ccfbf1',
        badgeText: '#115e59'
    },
};

export interface ContainerStyleResult {
    wrapperClass: string;
    headerClass: string;
    titleClass: string;
    bodyClass: string;
    accentClass: string;
    wrapperStyle: React.CSSProperties;
    headerStyle: React.CSSProperties;
    titleStyle: React.CSSProperties;
    borderStyle?: React.CSSProperties;
}

export const getContainerStyleClasses = (
    style: string = 'standard',
    color: string = 'default',
    entityAccent: string = 'indigo'
): ContainerStyleResult => {
    // Map color to palette
    const cleanColor = (color && color !== 'default') ? color.toLowerCase() : (entityAccent || 'indigo').toLowerCase();
    const c = COLOR_PALETTES[cleanColor] || COLOR_PALETTES['indigo'];

    switch (style) {
        case 'boxed':
            return {
                wrapperClass: 'rounded-lg overflow-hidden shadow-2xs transition-all',
                headerClass: 'px-3.5 py-2 flex items-center justify-between border-b',
                titleClass: 'text-[11px] font-black uppercase tracking-wider',
                bodyClass: 'p-3.5 space-y-2',
                accentClass: '',
                wrapperStyle: {
                    border: `1.5px solid ${c.border}`,
                    backgroundColor: '#ffffff',
                },
                headerStyle: {
                    borderBottom: `1px solid ${c.border}`,
                    backgroundColor: c.bgTint,
                },
                titleStyle: {
                    color: c.text,
                }
            };
        case 'highlight':
            return {
                wrapperClass: 'rounded-lg overflow-hidden shadow-2xs transition-all',
                headerClass: 'px-3.5 py-2 flex items-center justify-between border-b',
                titleClass: 'text-[11px] font-black uppercase tracking-wider',
                bodyClass: 'p-3.5 space-y-2',
                accentClass: '',
                wrapperStyle: {
                    border: `1.5px solid ${c.border}`,
                    backgroundColor: c.bgTint,
                },
                headerStyle: {
                    borderBottom: `1px solid ${c.border}`,
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                },
                titleStyle: {
                    color: c.text,
                }
            };
        case 'card':
            return {
                wrapperClass: 'rounded-lg overflow-hidden shadow-xs transition-all',
                headerClass: 'px-3.5 py-2 flex items-center justify-between border-b',
                titleClass: 'text-[11px] font-black uppercase tracking-wider',
                bodyClass: 'p-3.5 space-y-2',
                accentClass: '',
                wrapperStyle: {
                    border: '1px solid #e2e8f0',
                    borderLeft: `5px solid ${c.primary}`,
                    backgroundColor: '#ffffff',
                },
                headerStyle: {
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: '#ffffff',
                },
                titleStyle: {
                    color: c.primary,
                }
            };
        case 'banner':
            return {
                wrapperClass: 'rounded-lg overflow-hidden shadow-xs transition-all',
                headerClass: 'px-3.5 py-2 flex items-center justify-between',
                titleClass: 'text-[11px] font-black uppercase tracking-wider',
                bodyClass: 'p-3.5 space-y-2',
                accentClass: '',
                wrapperStyle: {
                    border: `1.5px solid ${c.primary}`,
                    backgroundColor: '#ffffff',
                },
                headerStyle: {
                    backgroundColor: c.primary,
                    color: '#ffffff',
                },
                titleStyle: {
                    color: '#ffffff',
                }
            };
        case 'minimal':
            return {
                wrapperClass: 'py-2 bg-transparent space-y-1.5 transition-all',
                headerClass: 'pb-1 flex items-center justify-between border-b',
                titleClass: 'text-[11px] font-black uppercase tracking-wider',
                bodyClass: 'space-y-1 pt-1',
                accentClass: '',
                wrapperStyle: {
                    borderBottom: `2px solid ${c.border}`,
                    backgroundColor: 'transparent',
                },
                headerStyle: {
                    borderBottom: `1px solid ${c.border}`,
                    backgroundColor: 'transparent',
                },
                titleStyle: {
                    color: c.primary,
                }
            };
        case 'standard':
        default:
            return {
                wrapperClass: 'rounded-lg p-3.5 space-y-2 transition-all',
                headerClass: 'pb-1.5 flex items-center justify-between border-b',
                titleClass: 'text-[10px] font-bold uppercase tracking-wider',
                bodyClass: 'space-y-1.5',
                accentClass: '',
                wrapperStyle: {
                    border: `1px solid ${c.border}`,
                    backgroundColor: c.bgTint,
                },
                headerStyle: {
                    borderBottom: `1px solid ${c.border}`,
                },
                titleStyle: {
                    color: c.text,
                }
            };
    }
};
