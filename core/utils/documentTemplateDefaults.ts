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

export const getContainerStyleClasses = (
    style: string = 'standard',
    color: string = 'default',
    entityAccent: string = 'indigo'
): ContainerStyleResult => {
    // Map color to palette
    const colorKey = (!color || color === 'default') ? (entityAccent || 'indigo') : color;
    
    // Color map definitions
    const colorMaps: Record<string, {
        border: string;
        bgTint: string;
        headerBg: string;
        headerText: string;
        titleText: string;
        borderAccent: string;
        badge: string;
    }> = {
        indigo: {
            border: 'border-indigo-200',
            bgTint: 'bg-indigo-50/70',
            headerBg: 'bg-indigo-700',
            headerText: 'text-white',
            titleText: 'text-indigo-900',
            borderAccent: 'border-l-indigo-600',
            badge: 'bg-indigo-100 text-indigo-800'
        },
        blue: {
            border: 'border-blue-200',
            bgTint: 'bg-blue-50/70',
            headerBg: 'bg-blue-700',
            headerText: 'text-white',
            titleText: 'text-blue-900',
            borderAccent: 'border-l-blue-600',
            badge: 'bg-blue-100 text-blue-800'
        },
        sky: {
            border: 'border-sky-200',
            bgTint: 'bg-sky-50/70',
            headerBg: 'bg-sky-600',
            headerText: 'text-white',
            titleText: 'text-sky-900',
            borderAccent: 'border-l-sky-500',
            badge: 'bg-sky-100 text-sky-800'
        },
        slate: {
            border: 'border-slate-300',
            bgTint: 'bg-slate-50/80',
            headerBg: 'bg-slate-700',
            headerText: 'text-white',
            titleText: 'text-slate-900',
            borderAccent: 'border-l-slate-600',
            badge: 'bg-slate-100 text-slate-800'
        },
        dark: {
            border: 'border-slate-800',
            bgTint: 'bg-slate-900 text-white',
            headerBg: 'bg-black',
            headerText: 'text-white',
            titleText: 'text-white',
            borderAccent: 'border-l-black',
            badge: 'bg-slate-800 text-slate-200'
        },
        emerald: {
            border: 'border-emerald-200',
            bgTint: 'bg-emerald-50/70',
            headerBg: 'bg-emerald-700',
            headerText: 'text-white',
            titleText: 'text-emerald-900',
            borderAccent: 'border-l-emerald-600',
            badge: 'bg-emerald-100 text-emerald-800'
        },
        amber: {
            border: 'border-amber-200',
            bgTint: 'bg-amber-50/70',
            headerBg: 'bg-amber-600',
            headerText: 'text-white',
            titleText: 'text-amber-950',
            borderAccent: 'border-l-amber-500',
            badge: 'bg-amber-100 text-amber-900'
        },
        rose: {
            border: 'border-rose-200',
            bgTint: 'bg-rose-50/70',
            headerBg: 'bg-rose-700',
            headerText: 'text-white',
            titleText: 'text-rose-950',
            borderAccent: 'border-l-rose-600',
            badge: 'bg-rose-100 text-rose-800'
        },
        purple: {
            border: 'border-purple-200',
            bgTint: 'bg-purple-50/70',
            headerBg: 'bg-purple-700',
            headerText: 'text-white',
            titleText: 'text-purple-900',
            borderAccent: 'border-l-purple-600',
            badge: 'bg-purple-100 text-purple-800'
        },
    };

    const c = colorMaps[colorKey] || colorMaps['indigo'];

    switch (style) {
        case 'boxed':
            return {
                wrapperClass: `border ${c.border} rounded-lg bg-white overflow-hidden shadow-2xs`,
                headerClass: `px-3.5 py-2 border-b ${c.border} bg-slate-50/60 flex items-center justify-between`,
                titleClass: `text-[10px] font-bold uppercase tracking-wider ${c.titleText}`,
                bodyClass: `p-3.5 space-y-2`,
                accentClass: c.border
            };
        case 'highlight':
            return {
                wrapperClass: `border ${c.border} ${c.bgTint} rounded-lg overflow-hidden shadow-2xs`,
                headerClass: `px-3.5 py-2 border-b ${c.border} bg-white/50 flex items-center justify-between`,
                titleClass: `text-[10px] font-extrabold uppercase tracking-wider ${c.titleText}`,
                bodyClass: `p-3.5 space-y-2`,
                accentClass: c.border
            };
        case 'card':
            return {
                wrapperClass: `border border-slate-200 border-l-4 ${c.borderAccent} rounded-lg bg-white overflow-hidden shadow-xs`,
                headerClass: `px-3.5 py-2 border-b border-slate-100 bg-white flex items-center justify-between`,
                titleClass: `text-[10px] font-bold uppercase tracking-wider ${c.titleText}`,
                bodyClass: `p-3.5 space-y-2`,
                accentClass: c.borderAccent
            };
        case 'banner':
            return {
                wrapperClass: `border ${c.border} rounded-lg overflow-hidden shadow-xs`,
                headerClass: `${c.headerBg} ${c.headerText} px-3.5 py-2 flex items-center justify-between`,
                titleClass: `text-[11px] font-black uppercase tracking-wider ${c.headerText}`,
                bodyClass: `p-3.5 bg-white space-y-2`,
                accentClass: c.headerBg
            };
        case 'minimal':
            return {
                wrapperClass: `border-b ${c.border} py-2 bg-transparent space-y-1.5`,
                headerClass: `pb-1 flex items-center justify-between`,
                titleClass: `text-[10px] font-bold uppercase tracking-wider ${c.titleText}`,
                bodyClass: `space-y-1`,
                accentClass: c.border
            };
        case 'standard':
        default:
            return {
                wrapperClass: `border border-slate-200 rounded-lg p-3.5 bg-slate-50/60 space-y-2`,
                headerClass: `border-b border-slate-200 pb-1.5 flex items-center justify-between`,
                titleClass: `text-[10px] font-bold uppercase tracking-wider text-slate-600`,
                bodyClass: `space-y-1.5`,
                accentClass: `border-slate-200`
            };
    }
};
