import { TrainingRecord, User, UserRole, ViewType } from '../../types';

export type TrainingModuleId =
    | 'first-time-user'
    | 'inquiries'
    | 'fcs'
    | 'estimates'
    | 'workflow'
    | 'inventory'
    | 'invoicing'
    | 'directors'
    | 'mobile';

export interface ShowMeMockElement {
    id: string;
    label: string;
    value?: string;
    tone?: 'default' | 'indigo' | 'emerald' | 'amber' | 'rose';
}

export interface ShowMeStep {
    id: string;
    title: string;
    caption: string;
    actionType: 'click' | 'type' | 'drag' | 'verify';
    targetId: string;
    targetLabel: string;
    cursorPos: { x: number; y: number }; // percentage 0-100 within mock stage
    screenTitle: string;
    elements: ShowMeMockElement[];
    toastText?: string;
}

export interface TrainingQuestion {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

export interface TrainingModule {
    id: TrainingModuleId;
    title: string;
    version: string;
    cpdMinutes: number;
    passThreshold: number; // percentage 0-100
    requiredRoles: UserRole[];
    requiredViews?: ViewType[];
    summary: string;
    showMeSteps: ShowMeStep[];
    quiz: TrainingQuestion[];
}

export const TRAINING_MODULES: TrainingModule[] = [
    {
        id: 'first-time-user',
        title: 'First-Time User & Core Navigation',
        version: '1.0',
        cpdMinutes: 15,
        passThreshold: 66,
        requiredRoles: ['Admin', 'Dispatcher', 'Director', 'user', 'Engineer', 'Garage Concierge', 'Sales'],
        summary: 'Entity switching, global search, mobile vs desktop modes, and Help & CPD tools.',
        showMeSteps: [
            {
                id: 'ftu-1',
                title: 'Select Business Entity',
                caption: 'Always confirm the active branch/entity pill in the header before creating jobs or estimates.',
                actionType: 'click',
                targetId: 'entity-pill',
                targetLabel: 'Entity Switcher',
                cursorPos: { x: 24, y: 20 },
                screenTitle: 'Top Navigation Bar',
                elements: [
                    { id: 'entity-pill', label: 'Active Entity', value: 'Brookspeed Porsche & Performance', tone: 'indigo' },
                    { id: 'global-search', label: 'Global Search', value: 'Search VRM, Customer, Job #', tone: 'default' },
                    { id: 'help-btn', label: 'Help & CPD', value: 'CPD Progress Pill', tone: 'emerald' }
                ],
                toastText: 'Filtered workspace to Brookspeed Porsche & Performance'
            },
            {
                id: 'ftu-2',
                title: 'Use Global Quick Search',
                caption: 'Type any VRM, customer surname, or job number to jump straight to the record without switching views.',
                actionType: 'type',
                targetId: 'global-search',
                targetLabel: 'Global Search',
                cursorPos: { x: 54, y: 20 },
                screenTitle: 'Global Search Results',
                elements: [
                    { id: 'entity-pill', label: 'Active Entity', value: 'Brookspeed Porsche & Performance', tone: 'default' },
                    { id: 'global-search', label: 'Searching...', value: 'PO21 ABC → 911 Carrera S', tone: 'indigo' },
                    { id: 'help-btn', label: 'Result', value: '1 Vehicle • 2 Jobs • 1 Estimate', tone: 'emerald' }
                ]
            },
            {
                id: 'ftu-3',
                title: 'Open Help & CPD Studio',
                caption: 'Access Visual Studio, SOP guides, animated Show Me replays, and your CPD checks anytime from the header.',
                actionType: 'click',
                targetId: 'help-btn',
                targetLabel: 'Help & CPD Button',
                cursorPos: { x: 82, y: 20 },
                screenTitle: 'Help & CPD Studio',
                elements: [
                    { id: 'entity-pill', label: 'Visual Studio', value: 'Interactive Schematics', tone: 'default' },
                    { id: 'global-search', label: 'Show Me', value: 'Animated Feature Replay', tone: 'amber' },
                    { id: 'help-btn', label: 'My CPD', value: 'Track Role Certification', tone: 'emerald' }
                ],
                toastText: 'Opened Help & CPD Studio'
            }
        ],
        quiz: [
            {
                id: 'ftu-q1',
                question: 'Before raising a new estimate or booking a job, what should you check in the top bar?',
                options: [
                    'That the correct Business Entity is selected',
                    'That all other browser tabs are closed',
                    'That the factory reset button is disabled'
                ],
                correctIndex: 0,
                explanation: 'Estimates, jobs, invoices, and service packages are scoped to the active Business Entity.'
            },
            {
                id: 'ftu-q2',
                question: 'What is the fastest way to locate a customer or vehicle across the system?',
                options: [
                    'Export a CSV and search in Excel',
                    'Use the Global Search bar in the header',
                    'Open every calendar day one by one'
                ],
                correctIndex: 1,
                explanation: 'Global Search indexes vehicles (VRM), customers, jobs, and estimates immediately.'
            },
            {
                id: 'ftu-q3',
                question: 'When a workflow module version is updated, what happens to your CPD status?',
                options: [
                    'Your account is locked permanently',
                    'That module is flagged "Refresher Due" so you can review the change',
                    'All historical invoices are deleted'
                ],
                correctIndex: 1,
                explanation: 'Versioned CPD modules flag only the updated module as Refresher Due so staff stay aligned on new rules.'
            }
        ]
    },
    {
        id: 'inquiries',
        title: 'Inquiries & Booking Triage',
        version: '1.0',
        cpdMinutes: 15,
        passThreshold: 66,
        requiredRoles: ['Admin', 'Dispatcher', 'Director', 'user', 'Sales'],
        requiredViews: ['inquiries'],
        summary: 'Capture inbound leads, merge duplicates, and convert inquiries cleanly into estimates or bookings.',
        showMeSteps: [
            {
                id: 'inq-1',
                title: 'Triage Inbox Card',
                caption: 'Open an incoming inquiry card to inspect vehicle registration, contact details, and requested work.',
                actionType: 'click',
                targetId: 'inq-card',
                targetLabel: 'Inbound Inquiry Card',
                cursorPos: { x: 25, y: 45 },
                screenTitle: 'Inquiries Kanban — Inbox',
                elements: [
                    { id: 'inq-card', label: 'INQ-402 • PO21 ABC', value: 'Major Service + Brake Fluid', tone: 'indigo' },
                    { id: 'inq-dup', label: 'Duplicate Check', value: 'Matched existing customer', tone: 'emerald' },
                    { id: 'inq-convert', label: 'Action', value: 'Smart Create Estimate', tone: 'default' }
                ]
            },
            {
                id: 'inq-2',
                title: 'Link Existing Customer & Vehicle',
                caption: 'Avoid duplicate profiles by linking to the matched customer/vehicle record before creating an estimate.',
                actionType: 'verify',
                targetId: 'inq-dup',
                targetLabel: 'Customer Match',
                cursorPos: { x: 52, y: 45 },
                screenTitle: 'Customer & Vehicle Linker',
                elements: [
                    { id: 'inq-card', label: 'Customer', value: 'Matched by email & VRM', tone: 'emerald' },
                    { id: 'inq-dup', label: 'Vehicle', value: 'Porsche 911 (PO21 ABC)', tone: 'indigo' },
                    { id: 'inq-convert', label: 'Next Step', value: 'Ready for Estimate', tone: 'default' }
                ]
            },
            {
                id: 'inq-3',
                title: 'Convert to Estimate or Job',
                caption: 'Click Smart Create Estimate so the inquiry status automatically moves to Quoted or Responded.',
                actionType: 'click',
                targetId: 'inq-convert',
                targetLabel: 'Smart Create Estimate',
                cursorPos: { x: 80, y: 45 },
                screenTitle: 'Conversion Complete',
                elements: [
                    { id: 'inq-card', label: 'Inquiry Status', value: 'Quoted or Responded', tone: 'emerald' },
                    { id: 'inq-dup', label: 'Linked Estimate', value: 'EST-1084 Created', tone: 'indigo' },
                    { id: 'inq-convert', label: 'Audit Trail', value: 'Linked to Inquiry #402', tone: 'default' }
                ],
                toastText: 'Estimate EST-1084 created and linked to Inquiry'
            }
        ],
        quiz: [
            {
                id: 'inq-q1',
                question: 'If two inquiry cards arrive for the same customer within a few days, what should you do?',
                options: [
                    'Keep both open and create two separate jobs',
                    'Use Merge Duplicate Inquiry Cards to consolidate them',
                    'Delete the customer record'
                ],
                correctIndex: 1,
                explanation: 'Merging duplicate inquiry cards preserves all notes and prevents double-booking.'
            },
            {
                id: 'inq-q2',
                question: 'What happens when you convert an inquiry via Smart Create Estimate?',
                options: [
                    'The inquiry is deleted',
                    'It links the customer, vehicle, and estimate and updates the inquiry status',
                    'It immediately charges the customer card'
                ],
                correctIndex: 1,
                explanation: 'Converting links the inquiry to the new estimate/customer so the pipeline stays traceable.'
            },
            {
                id: 'inq-q3',
                question: 'Why should you link an existing customer/vehicle instead of creating a new one?',
                options: [
                    'To preserve full service history and avoid duplicate records',
                    'Because the system only allows 10 customers',
                    'It skips VAT calculation'
                ],
                correctIndex: 0,
                explanation: 'Linking keeps MOT dates, estimates, and invoice history unified under one profile.'
            }
        ]
    },
    {
        id: 'fcs',
        title: 'FCS Dispatch & Ramp Scheduling',
        version: '1.0',
        cpdMinutes: 20,
        passThreshold: 66,
        requiredRoles: ['Admin', 'Dispatcher'],
        requiredViews: ['dispatch'],
        summary: 'Allocate jobs to technicians and lifts, manage parts readiness, and monitor workshop capacity.',
        showMeSteps: [
            {
                id: 'fcs-1',
                title: 'Check Parts Readiness First',
                caption: 'Verify the job parts badge (Fully Received / Not Required) before dragging onto a live ramp.',
                actionType: 'verify',
                targetId: 'fcs-unalloc',
                targetLabel: 'Unallocated Job Card',
                cursorPos: { x: 22, y: 48 },
                screenTitle: 'Dispatch Board — Unallocated Queue',
                elements: [
                    { id: 'fcs-unalloc', label: 'JOB-882 • PO21 ABC', value: 'Parts: Fully Received (3h)', tone: 'emerald' },
                    { id: 'fcs-bay', label: 'Ramp 2 (10:00)', value: 'Available • 4.0h free', tone: 'default' },
                    { id: 'fcs-cap', label: 'Daily Capacity', value: '74% Utilised', tone: 'indigo' }
                ]
            },
            {
                id: 'fcs-2',
                title: 'Drag Job to Technician & Lift',
                caption: 'Drag the job card onto an open lift/technician slot; multi-hour segments split automatically.',
                actionType: 'drag',
                targetId: 'fcs-bay',
                targetLabel: 'Ramp 2 Slot',
                cursorPos: { x: 55, y: 48 },
                screenTitle: 'Dispatch Board — Ramp Allocation',
                elements: [
                    { id: 'fcs-unalloc', label: 'JOB-882', value: 'Assigned to Tech: Alex', tone: 'indigo' },
                    { id: 'fcs-bay', label: 'Ramp 2 (10:00 - 13:00)', value: 'Allocated (3.0h)', tone: 'emerald' },
                    { id: 'fcs-cap', label: 'Daily Capacity', value: '82% Utilised', tone: 'indigo' }
                ],
                toastText: 'Job #882 allocated to Ramp 2'
            },
            {
                id: 'fcs-3',
                title: 'Watch Capacity Guardrails',
                caption: 'Monitor the capacity bar so bookings do not exceed available technician hours for the day.',
                actionType: 'verify',
                targetId: 'fcs-cap',
                targetLabel: 'Capacity Indicator',
                cursorPos: { x: 82, y: 48 },
                screenTitle: 'Workshop Capacity Summary',
                elements: [
                    { id: 'fcs-unalloc', label: 'Status', value: 'Allocated', tone: 'emerald' },
                    { id: 'fcs-bay', label: 'Parts Status', value: 'Ready for Technician', tone: 'emerald' },
                    { id: 'fcs-cap', label: 'Remaining Hours', value: '6.5h Buffer Left', tone: 'amber' }
                ]
            }
        ],
        quiz: [
            {
                id: 'fcs-q1',
                question: 'What should you verify before allocating a parts-heavy job to a ramp?',
                options: [
                    'That parts status is Fully Received or Not Required',
                    'That the invoice is already paid',
                    'That the customer has left the country'
                ],
                correctIndex: 0,
                explanation: 'Allocating jobs before parts arrive stalls lifts and reduces workshop efficiency.'
            },
            {
                id: 'fcs-q2',
                question: 'How does the dispatch board handle a 6-hour job?',
                options: [
                    'It rejects anything over 2 hours',
                    'It splits the job into schedulable segments across available capacity',
                    'It deletes the extra 4 hours'
                ],
                correctIndex: 1,
                explanation: 'Jobs split into segments so work can span breaks or multiple days cleanly.'
            },
            {
                id: 'fcs-q3',
                question: 'Why does the dispatch board display daily capacity warnings?',
                options: [
                    'To alert dispatchers before overbooking technician hours',
                    'To turn off email notifications',
                    'To archive old vehicles'
                ],
                correctIndex: 0,
                explanation: 'Capacity alerts prevent over-promising completion times when bays/techs are full.'
            }
        ]
    },
    {
        id: 'estimates',
        title: 'Version-Secured Estimates & Drift Guardrail',
        version: '1.1',
        cpdMinutes: 20,
        passThreshold: 66,
        requiredRoles: ['Admin', 'Dispatcher', 'Director', 'user', 'Sales'],
        requiredViews: ['estimates', 'jobs'],
        summary: 'Send v1 estimates, record Check-In/verbal overrides, and resolve pre-invoice drift safely.',
        showMeSteps: [
            {
                id: 'est-1',
                title: 'Email Estimate to Lock v1',
                caption: 'Sending an estimate records an immutable v1 snapshot (totals + line items) in sentHistory.',
                actionType: 'click',
                targetId: 'est-send',
                targetLabel: 'Send Email',
                cursorPos: { x: 25, y: 45 },
                screenTitle: 'Estimate View — Send to Client',
                elements: [
                    { id: 'est-send', label: 'Action', value: 'Email Estimate to Client', tone: 'indigo' },
                    { id: 'est-ver', label: 'Version Status', value: 'v1 • Sent & Secured (£420.00)', tone: 'emerald' },
                    { id: 'est-drift', label: 'Pre-Invoice Check', value: 'No Drift Detected', tone: 'default' }
                ],
                toastText: 'Estimate v1 snapshot locked'
            },
            {
                id: 'est-2',
                title: 'Add Extra Work (Drift Detected)',
                caption: 'If extra work is added later without notifying the client, the editor flags the exact £ drift vs v1.',
                actionType: 'type',
                targetId: 'est-drift',
                targetLabel: 'Drift Banner',
                cursorPos: { x: 54, y: 45 },
                screenTitle: 'Job Estimate Tab — Unnotified Change',
                elements: [
                    { id: 'est-send', label: 'Sent v1', value: '£420.00 inc VAT', tone: 'default' },
                    { id: 'est-ver', label: 'Current Total', value: '£509.00 inc VAT', tone: 'amber' },
                    { id: 'est-drift', label: 'Alert', value: 'Drift +£89.00 vs v1 (Sent)', tone: 'rose' }
                ]
            },
            {
                id: 'est-3',
                title: 'Resolve Before Invoicing',
                caption: 'Either email a Change Notice (bumping to v2) OR record Check-In / Verbal Approval before invoicing.',
                actionType: 'click',
                targetId: 'est-ver',
                targetLabel: 'Send Change Notice / Record Approval',
                cursorPos: { x: 80, y: 45 },
                screenTitle: 'Pre-Invoice Drift Guardrail',
                elements: [
                    { id: 'est-send', label: 'Option 1', value: 'Send Change Notice -> v2', tone: 'indigo' },
                    { id: 'est-ver', label: 'Option 2', value: 'Record Check-In / Verbal Approval', tone: 'emerald' },
                    { id: 'est-drift', label: 'Result', value: 'Client Advised • Safe to Invoice', tone: 'emerald' }
                ],
                toastText: 'Change Notice sent — Estimate bumped to v2'
            }
        ],
        quiz: [
            {
                id: 'est-q1',
                question: 'What happens automatically when you email an estimate to a customer?',
                options: [
                    'An immutable version snapshot (v1, v2, etc.) is saved so future changes are tracked',
                    'The estimate is permanently deleted after 24 hours',
                    'The job is marked Paid'
                ],
                correctIndex: 0,
                explanation: 'Emailing locks a version snapshot in sentHistory so any later additions trigger drift protection.'
            },
            {
                id: 'est-q2',
                question: 'A customer requests a Brake Fluid Change when dropping off their keys. How should you record it?',
                options: [
                    'Add it silently to the invoice at the end of the day',
                    'Select the Service Package in the Check-In modal so it updates the job/estimate and logs a Check-In override',
                    'Create a duplicate customer profile'
                ],
                correctIndex: 1,
                explanation: 'Adding it at Check-In records a check_in override and updates the estimate so invoicing sees zero unexplained drift.'
            },
            {
                id: 'est-q3',
                question: 'If unexplained drift exists when clicking Generate Invoice, what does the system do?',
                options: [
                    'Opens the Pre-Invoice Drift Guardrail so you can send a Change Notice or record Verbal Approval',
                    'Silently drops the extra lines',
                    'Crashes the browser'
                ],
                correctIndex: 0,
                explanation: 'The guardrail protects against billing a customer a different amount from their sent estimate without informing them.'
            }
        ]
    },
    {
        id: 'workflow',
        title: 'Check-In, Workshop Workflow & QC',
        version: '1.1',
        cpdMinutes: 20,
        passThreshold: 66,
        requiredRoles: ['Admin', 'Dispatcher', 'Director', 'user', 'Engineer', 'Garage Concierge'],
        requiredViews: ['workflow', 'concierge', 'jobs'],
        summary: 'Check-In photos, adding Job Card checks & service packages at drop-off, eVHC findings, and QC sign-off.',
        showMeSteps: [
            {
                id: 'wf-1',
                title: 'Check-In & Add Job Card Check',
                caption: 'Record key number, mileage, photos, and any drop-off concern (e.g. "Noise from suspension").',
                actionType: 'type',
                targetId: 'wf-check',
                targetLabel: 'Add Check to Job Card',
                cursorPos: { x: 24, y: 46 },
                screenTitle: 'Vehicle Check-In Modal',
                elements: [
                    { id: 'wf-check', label: 'Job Card Check', value: 'Noise from suspension', tone: 'amber' },
                    { id: 'wf-pkg', label: 'Service Package', value: 'Add Service Package...', tone: 'default' },
                    { id: 'wf-qc', label: 'Vehicle Status', value: 'Booked In -> On Site', tone: 'indigo' }
                ]
            },
            {
                id: 'wf-2',
                title: 'Pull Down Service Package at Check-In',
                caption: 'Click Add Service Package to reuse the vehicle-matched package selector (e.g. Brake Fluid Change).',
                actionType: 'click',
                targetId: 'wf-pkg',
                targetLabel: 'Add Service Package',
                cursorPos: { x: 52, y: 46 },
                screenTitle: 'Service Package Selection',
                elements: [
                    { id: 'wf-check', label: 'Job Card Check', value: 'Check: Noise from suspension', tone: 'emerald' },
                    { id: 'wf-pkg', label: 'Selected Package', value: 'Brake Fluid Change (£89.00)', tone: 'indigo' },
                    { id: 'wf-qc', label: 'Estimate Override', value: 'Check-In Authorized', tone: 'emerald' }
                ],
                toastText: 'Added Brake Fluid Change & check to Job Card'
            },
            {
                id: 'wf-3',
                title: 'Complete Work & Pending QC',
                caption: 'Technicians log eVHC findings and complete tasks; job moves to Pending QC before Check-Out.',
                actionType: 'verify',
                targetId: 'wf-qc',
                targetLabel: 'QC Sign-Off',
                cursorPos: { x: 80, y: 46 },
                screenTitle: 'Workshop Workflow Board',
                elements: [
                    { id: 'wf-check', label: 'Technician Notes', value: 'Suspension bush inspected', tone: 'emerald' },
                    { id: 'wf-pkg', label: 'Package Work', value: 'Brake Fluid Changed', tone: 'emerald' },
                    { id: 'wf-qc', label: 'Stage', value: 'Pending QC -> Complete', tone: 'indigo' }
                ]
            }
        ],
        quiz: [
            {
                id: 'wf-q1',
                question: 'Where should a customer drop-off concern like "Noise from suspension" be entered?',
                options: [
                    'In the Add Check / Concern to Job Card field inside Check-In',
                    'In the staff holiday calendar',
                    'In the supplier address field'
                ],
                correctIndex: 0,
                explanation: 'Entering it in Check-In adds it to job notes, technician observations, and the Job Card operations list.'
            },
            {
                id: 'wf-q2',
                question: 'How do you add a standard package like Brake Fluid Change during Check-In?',
                options: [
                    'Click Add Service Package in Check-In to open the vehicle-matched package selector',
                    'Re-type every part manually in an email',
                    'Wait until after the customer has paid'
                ],
                correctIndex: 0,
                explanation: 'Check-In reuses ServicePackageSelectionModal so packages match the vehicle and log a check-in override.'
            },
            {
                id: 'wf-q3',
                question: 'What stage follows technician completion before releasing the vehicle?',
                options: [
                    'Pending QC (Quality Control)',
                    'Archived',
                    'Inbox'
                ],
                correctIndex: 0,
                explanation: 'Pending QC ensures a final quality & safety check before Check-Out and invoicing.'
            }
        ]
    },
    {
        id: 'inventory',
        title: 'Parts, Purchase Orders & Suppliers',
        version: '1.0',
        cpdMinutes: 15,
        passThreshold: 66,
        requiredRoles: ['Admin', 'Dispatcher', 'Director', 'user'],
        requiredViews: ['purchaseOrders', 'parts'],
        summary: 'Raise POs from estimates, track supplier deliveries, and update job parts status automatically.',
        showMeSteps: [
            {
                id: 'inv-1',
                title: 'Raise PO from Estimate',
                caption: 'Generate Purchase Orders directly from job/estimate parts lines to avoid manual re-entry.',
                actionType: 'click',
                targetId: 'inv-po',
                targetLabel: 'Raise Purchase Order',
                cursorPos: { x: 25, y: 45 },
                screenTitle: 'Job Estimate Tab — Parts',
                elements: [
                    { id: 'inv-po', label: 'Action', value: 'Raise PO (2 Parts)', tone: 'indigo' },
                    { id: 'inv-sup', label: 'Supplier', value: 'Porsche Centre Bournemouth', tone: 'default' },
                    { id: 'inv-stat', label: 'Parts Status', value: 'Awaiting Order -> Ordered', tone: 'amber' }
                ],
                toastText: 'PO-2041 created'
            },
            {
                id: 'inv-2',
                title: 'Send & Track Delivery',
                caption: 'Email the PO to the supplier and record expected delivery date so FCS dispatch knows when parts arrive.',
                actionType: 'click',
                targetId: 'inv-sup',
                targetLabel: 'Supplier Delivery',
                cursorPos: { x: 55, y: 45 },
                screenTitle: 'Purchase Orders View',
                elements: [
                    { id: 'inv-po', label: 'PO-2041', value: 'Sent to Supplier', tone: 'indigo' },
                    { id: 'inv-sup', label: 'Expected', value: 'Tomorrow 09:00', tone: 'amber' },
                    { id: 'inv-stat', label: 'Job Parts Status', value: 'On Order', tone: 'default' }
                ]
            },
            {
                id: 'inv-3',
                title: 'Mark Parts Received',
                caption: 'Marking a PO Received updates the linked job to Fully Received so it turns green on Dispatch.',
                actionType: 'click',
                targetId: 'inv-stat',
                targetLabel: 'Mark Received',
                cursorPos: { x: 80, y: 45 },
                screenTitle: 'Goods In — Received',
                elements: [
                    { id: 'inv-po', label: 'PO-2041', value: 'Received', tone: 'emerald' },
                    { id: 'inv-sup', label: 'Stock / Job', value: 'Linked to JOB-882', tone: 'default' },
                    { id: 'inv-stat', label: 'Job Parts Status', value: 'Fully Received', tone: 'emerald' }
                ],
                toastText: 'Job #882 marked Fully Received'
            }
        ],
        quiz: [
            {
                id: 'inv-q1',
                question: 'What updates a job’s parts readiness badge to Fully Received?',
                options: [
                    'Marking all linked Purchase Orders as Received',
                    'Changing the vehicle colour',
                    'Printing the estimate'
                ],
                correctIndex: 0,
                explanation: 'Job parts status is calculated automatically from linked Purchase Orders.'
            },
            {
                id: 'inv-q2',
                question: 'Why should POs be raised from the job/estimate rather than ad-hoc?',
                options: [
                    'It links cost, supplier, and expected delivery date directly to the job',
                    'It hides VAT from the invoice',
                    'It skips supplier selection'
                ],
                correctIndex: 0,
                explanation: 'Linking POs to jobs ensures accurate profit margins and parts-arrival tracking.'
            }
        ]
    },
    {
        id: 'invoicing',
        title: 'Invoicing, Payments & Accounting',
        version: '1.0',
        cpdMinutes: 15,
        passThreshold: 66,
        requiredRoles: ['Admin', 'Dispatcher', 'Director', 'user'],
        requiredViews: ['invoices'],
        summary: 'Convert completed jobs to invoices, verify drift guardrails, record payments, and export nominal codes.',
        showMeSteps: [
            {
                id: 'invc-1',
                title: 'Generate Invoice from Completed Job',
                caption: 'Click Generate Invoice on a completed job; the system checks parts reconciliation and estimate drift.',
                actionType: 'click',
                targetId: 'invc-gen',
                targetLabel: 'Generate Invoice',
                cursorPos: { x: 25, y: 45 },
                screenTitle: 'Jobs View — Complete',
                elements: [
                    { id: 'invc-gen', label: 'Action', value: 'Generate Invoice', tone: 'indigo' },
                    { id: 'invc-pay', label: 'Drift Check', value: 'Authorized (£509.00)', tone: 'emerald' },
                    { id: 'invc-nom', label: 'Nominal Codes', value: 'Auto-Mapped (T1 20% VAT)', tone: 'default' }
                ]
            },
            {
                id: 'invc-2',
                title: 'Record Payment & Send Receipt',
                caption: 'Log card, BACS, or cash payments and email the PDF invoice directly to the customer.',
                actionType: 'click',
                targetId: 'invc-pay',
                targetLabel: 'Record Payment',
                cursorPos: { x: 55, y: 45 },
                screenTitle: 'Invoice Modal — Payment',
                elements: [
                    { id: 'invc-gen', label: 'INV-3091', value: 'Issued', tone: 'default' },
                    { id: 'invc-pay', label: 'Payment', value: 'Paid in Full (Card)', tone: 'emerald' },
                    { id: 'invc-nom', label: 'Job Status', value: 'Invoiced / Closed', tone: 'emerald' }
                ],
                toastText: 'Payment recorded on INV-3091'
            },
            {
                id: 'invc-3',
                title: 'Export Nominal Codes',
                caption: 'Use Financial Reporting / Nominal Code Export to reconcile invoices and purchases for accounting.',
                actionType: 'verify',
                targetId: 'invc-nom',
                targetLabel: 'Export Nominal CSV',
                cursorPos: { x: 80, y: 45 },
                screenTitle: 'Accounts Export',
                elements: [
                    { id: 'invc-gen', label: 'Period', value: 'Current Month', tone: 'default' },
                    { id: 'invc-pay', label: 'Reconciled', value: '100% Matched', tone: 'emerald' },
                    { id: 'invc-nom', label: 'Export', value: 'Nominal CSV Ready', tone: 'indigo' }
                ]
            }
        ],
        quiz: [
            {
                id: 'invc-q1',
                question: 'What does the system check right before opening the Invoice Form?',
                options: [
                    'Parts status and whether the estimate has unnotified drift vs the last sent version',
                    'Only the vehicle paint colour',
                    'Whether the customer has a birthday today'
                ],
                correctIndex: 0,
                explanation: 'Both parts reconciliation and estimate drift are checked before creating an invoice.'
            },
            {
                id: 'invc-q2',
                question: 'How should partial or full customer payments be tracked?',
                options: [
                    'Using the Payments section on the Invoice so balance due updates automatically',
                    'By deleting line items from the invoice',
                    'By changing the invoice date'
                ],
                correctIndex: 0,
                explanation: 'Recording payments preserves the full invoice value while tracking remaining balance.'
            }
        ]
    },
    {
        id: 'directors',
        title: 'Directors Dashboard, Imports & Governance',
        version: '1.0',
        cpdMinutes: 20,
        passThreshold: 66,
        requiredRoles: ['Admin'],
        requiredViews: ['directors'],
        summary: 'Monitor KPIs, run duplicate-safe CSV imports, and audit staff CPD compliance.',
        showMeSteps: [
            {
                id: 'dir-1',
                title: 'Review Revenue & GP KPIs',
                caption: 'Track live labour utilisation, gross profit, and entity performance on the Directors Dashboard.',
                actionType: 'verify',
                targetId: 'dir-kpi',
                targetLabel: 'KPI Overview',
                cursorPos: { x: 25, y: 45 },
                screenTitle: 'Directors Dashboard',
                elements: [
                    { id: 'dir-kpi', label: 'Monthly GP', value: '64.2% (On Target)', tone: 'emerald' },
                    { id: 'dir-imp', label: 'CSV Imports', value: 'Duplicate Guard Active', tone: 'indigo' },
                    { id: 'dir-cpd', label: 'Staff CPD', value: 'Compliance Matrix', tone: 'amber' }
                ]
            },
            {
                id: 'dir-2',
                title: 'Duplicate-Safe CSV Imports',
                caption: 'Customers, Vehicles, Jobs, and Invoices CSV imports automatically skip existing or intra-file duplicates.',
                actionType: 'click',
                targetId: 'dir-imp',
                targetLabel: 'Import CSV',
                cursorPos: { x: 54, y: 45 },
                screenTitle: 'Management — Data Import',
                elements: [
                    { id: 'dir-kpi', label: 'Matched Existing', value: 'Skipped Safely', tone: 'emerald' },
                    { id: 'dir-imp', label: 'New Records', value: 'Imported & Refreshed', tone: 'indigo' },
                    { id: 'dir-cpd', label: 'Data Integrity', value: 'Zero Duplicates Created', tone: 'emerald' }
                ]
            },
            {
                id: 'dir-3',
                title: 'Audit Staff Training & CPD',
                caption: 'Open Management -> Staff Training & CPD to see completion rates, refreshers due, and export CPD logs.',
                actionType: 'click',
                targetId: 'dir-cpd',
                targetLabel: 'Staff CPD Matrix',
                cursorPos: { x: 80, y: 45 },
                screenTitle: 'Management — Staff Training & CPD',
                elements: [
                    { id: 'dir-kpi', label: 'Team Compliance', value: '92% Current', tone: 'emerald' },
                    { id: 'dir-imp', label: 'Refreshers Due', value: '1 Staff Member', tone: 'amber' },
                    { id: 'dir-cpd', label: 'Export', value: 'Download CPD Audit CSV', tone: 'indigo' }
                ]
            }
        ],
        quiz: [
            {
                id: 'dir-q1',
                question: 'What happens if you import a CSV containing customers or vehicles that already exist in the system?',
                options: [
                    'Existing and intra-file duplicates are detected and skipped automatically',
                    'They overwrite all invoices',
                    'They are imported twice'
                ],
                correctIndex: 0,
                explanation: 'All four importers (Customers, Vehicles, Jobs, Invoices) check against existing DB records and earlier CSV rows.'
            },
            {
                id: 'dir-q2',
                question: 'Where can Directors/Managers audit which staff have completed their required CPD modules?',
                options: [
                    'Management -> Staff Training & CPD',
                    'Check-Out Modal',
                    'Vehicle Diagram Editor'
                ],
                correctIndex: 0,
                explanation: 'The Staff Training & CPD tab shows the live User × Module matrix and exports CPD logs.'
            }
        ]
    },
    {
        id: 'mobile',
        title: 'Mobile Companion & Technician App',
        version: '1.0',
        cpdMinutes: 15,
        passThreshold: 66,
        requiredRoles: ['Admin', 'Engineer', 'Garage Concierge'],
        summary: 'Use the mobile shell on ramp tablets/phones for job cards, check-in media, and eVHC checklists.',
        showMeSteps: [
            {
                id: 'mob-1',
                title: 'Switch to Mobile / Tablet View',
                caption: 'Scan the QR code or tap Mobile Mode to open the touch-friendly technician shell.',
                actionType: 'click',
                targetId: 'mob-shell',
                targetLabel: 'Mobile Mode',
                cursorPos: { x: 25, y: 45 },
                screenTitle: 'Mobile Companion Shell',
                elements: [
                    { id: 'mob-shell', label: 'Active View', value: 'My Allocated Jobs', tone: 'indigo' },
                    { id: 'mob-evhc', label: 'eVHC', value: 'Traffic-Light Checks', tone: 'amber' },
                    { id: 'mob-photo', label: 'Media', value: 'Camera Upload', tone: 'default' }
                ]
            },
            {
                id: 'mob-2',
                title: 'Capture Check-In / eVHC Photos',
                caption: 'Snap photos or short videos directly from the tablet camera; they sync to the job card.',
                actionType: 'click',
                targetId: 'mob-photo',
                targetLabel: 'Camera Capture',
                cursorPos: { x: 55, y: 45 },
                screenTitle: 'Condition & Inspection Media',
                elements: [
                    { id: 'mob-shell', label: 'Job #882', value: 'PO21 ABC', tone: 'default' },
                    { id: 'mob-evhc', label: 'Tyres / Brakes', value: 'Amber — 3mm Remaining', tone: 'amber' },
                    { id: 'mob-photo', label: 'Photo Saved', value: 'Synced to Job Card', tone: 'emerald' }
                ],
                toastText: 'Inspection photo synced'
            },
            {
                id: 'mob-3',
                title: 'Submit for QC Review',
                caption: 'Mark technician work complete to notify the workshop controller for Pending QC.',
                actionType: 'click',
                targetId: 'mob-evhc',
                targetLabel: 'Complete Job',
                cursorPos: { x: 80, y: 45 },
                screenTitle: 'Job Ready for QC',
                elements: [
                    { id: 'mob-shell', label: 'Status', value: 'Pending QC', tone: 'emerald' },
                    { id: 'mob-evhc', label: 'Checklist', value: '100% Signed Off', tone: 'emerald' },
                    { id: 'mob-photo', label: 'Front Desk', value: 'Notified Automatically', tone: 'indigo' }
                ]
            }
        ],
        quiz: [
            {
                id: 'mob-q1',
                question: 'Where do photos taken in the Mobile Companion / Check-In appear?',
                options: [
                    'Attached directly to the job card and customer inspection record',
                    'Only on the device camera roll',
                    'They are deleted on logout'
                ],
                correctIndex: 0,
                explanation: 'Check-In and eVHC media sync directly with the job record.'
            },
            {
                id: 'mob-q2',
                question: 'What happens when a technician marks a mobile job complete?',
                options: [
                    'It moves to Pending QC for final inspection before release',
                    'It sends an invoice automatically without review',
                    'It deletes the customer'
                ],
                correctIndex: 0,
                explanation: 'Completed tech jobs move to Pending QC so reception/controllers can verify everything.'
            }
        ]
    }
];

export const getRequiredModulesForUser = (user?: User | null): TrainingModule[] => {
    if (!user) return [];
    if (user.role === 'Admin') return TRAINING_MODULES;

    return TRAINING_MODULES.filter(mod => {
        const roleMatch = mod.requiredRoles.includes(user.role);
        const viewMatch =
            !mod.requiredViews ||
            !user.allowedViews ||
            user.allowedViews.length === 0 ||
            mod.requiredViews.some(v => user.allowedViews!.includes(v));
        return roleMatch && viewMatch;
    });
};

export type ModuleTrainingStatus = 'current' | 'refresher_due' | 'not_started';

export const getModuleStatusForUser = (
    mod: TrainingModule,
    records: TrainingRecord[] = [],
    userId: string
): { status: ModuleTrainingStatus; record?: TrainingRecord } => {
    const rec = records.find(r => r.userId === userId && r.moduleId === mod.id && r.passed);
    if (!rec) return { status: 'not_started' };
    if (rec.completedVersion !== mod.version) {
        return { status: 'refresher_due', record: rec };
    }
    return { status: 'current', record: rec };
};

export const getUserCpdSummary = (user?: User | null, records: TrainingRecord[] = []) => {
    const required = getRequiredModulesForUser(user);
    if (!user || required.length === 0) {
        return {
            requiredCount: 0,
            completedCurrentCount: 0,
            refresherDueCount: 0,
            notStartedCount: 0,
            totalCpdMinutes: 0,
            percentComplete: 100,
            nextModuleId: 'first-time-user' as TrainingModuleId,
        };
    }

    let completedCurrentCount = 0;
    let refresherDueCount = 0;
    let notStartedCount = 0;
    let totalCpdMinutes = 0;
    let nextModuleId: TrainingModuleId = required[0].id;
    let foundNext = false;

    for (const mod of required) {
        const { status, record } = getModuleStatusForUser(mod, records, user.id);
        if (status === 'current') {
            completedCurrentCount++;
            totalCpdMinutes += record?.cpdMinutes || mod.cpdMinutes;
        } else if (status === 'refresher_due') {
            refresherDueCount++;
            totalCpdMinutes += record?.cpdMinutes || 0;
            if (!foundNext) {
                nextModuleId = mod.id;
                foundNext = true;
            }
        } else {
            notStartedCount++;
            if (!foundNext) {
                nextModuleId = mod.id;
                foundNext = true;
            }
        }
    }

    const percentComplete = Math.round((completedCurrentCount / required.length) * 100);

    return {
        requiredCount: required.length,
        completedCurrentCount,
        refresherDueCount,
        notStartedCount,
        totalCpdMinutes,
        percentComplete,
        nextModuleId,
    };
};
