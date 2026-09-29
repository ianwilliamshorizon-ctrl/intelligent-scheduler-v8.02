import React, { useState, useEffect } from 'react';
import {
  Calendar,
  FileText,
  Wrench,
  PackageCheck,
  DollarSign,
  Bot,
  Smartphone,
  CheckCircle2,
  Search,
  X,
  BookOpen,
  Sparkles,
  Zap,
  Info,
  ZoomIn,
  Layers,
  Clock,
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface HelpCentreProps {
  open: boolean;
  onClose: () => void;
}

type HelpTab = 'fcs' | 'estimates' | 'workflow' | 'inventory' | 'invoicing' | 'directors' | 'mobile';
type ViewMode = 'visual' | 'sop';

interface HelpSection {
  id: HelpTab;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  icon: React.ElementType;
  description: string;
  steps: { title: string; desc: string }[];
  proTip: string;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'fcs',
    title: 'FCS Dynamic Dispatch & Scheduling Matrix',
    subtitle: 'Auto-Allocation, Capacity Leveling & Multi-Bay Gantt Planner',
    badge: 'FCS OPTIMIZED',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: Calendar,
    description:
      'High-performance auto-scheduling engine with technician skill-matrix matching, bank holiday awareness, slot leveling, and live drag-and-drop workshop bay planning.',
    steps: [
      {
        title: '1. Access Dispatch & Calendar Matrix',
        desc: 'Open the Dispatch tab to view active workshop bays, engineer shifts, allocated repair hours, and pending jobs in the scheduling queue.'
      },
      {
        title: '2. Run FCS Auto-Scheduler or Manual Drop',
        desc: 'Click "Auto-Schedule with FCS" to automatically balance workloads across technicians by skill qualification, job complexity, and bay availability.'
      },
      {
        title: '3. Technician Transfers & Shift Adjustments',
        desc: 'Use the Technician Transfer modal to quickly reallocate work when a mechanic is absent, or drag job cards across bays with instant conflict detection.'
      },
      {
        title: '4. Print Daily FCS Schedule Sheet',
        desc: 'Press "Print FCS Schedule" to generate a zero-overlap, high-contrast daily job allocation manifest for workshop floor supervisors.'
      }
    ],
    proTip:
      'Tip: The FCS Optimizer dynamically respects UK Bank Holidays and technician leave from the Absence calendar. High-priority warranty repairs automatically lock to designated certified technicians.'
  },
  {
    id: 'estimates',
    title: 'Smart Estimates & Job Lifecycle Automation',
    subtitle: 'Instant Customer Quoting, Parts Markup & 1-Click Job Conversion',
    badge: 'WORKFLOW AUTOMATED',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    icon: FileText,
    description:
      'Build comprehensive customer quotations with live inventory parts lookup, labor hour calculation, custom markups, and one-click conversion directly into active workshop job cards.',
    steps: [
      {
        title: '1. Create or Import Estimate',
        desc: 'Click "Create Estimate" or import directly from an inbound customer enquiry. Enter the vehicle VRM to pull vehicle make, model, and engine specs.'
      },
      {
        title: '2. Add Labor Hours & Live Inventory Parts',
        desc: 'Select standard service labor packages or custom hourly repair lines. Attach OE parts directly from inventory with automated cost markup calculations.'
      },
      {
        title: '3. Transmit Estimate for Customer Sign-Off',
        desc: 'Send a clean digital quote to the client via SMS or email with itemized parts, labor, and statutory UK 20% VAT calculations.'
      },
      {
        title: '4. 1-Click Conversion to Active Job Card',
        desc: 'Once approved, click "Convert to Job" to immediately generate Job Card #JOB-XXXX, reserve allocated parts, and open the calendar dispatch slot.'
      }
    ],
    proTip:
      'Tip: When converting an approved estimate, any parts not currently on hand are automatically queued into the Purchase Order manager with supplier reorder alerts.'
  },
  {
    id: 'workflow',
    title: 'Live Workshop Kanban & Service Stream Concierge',
    subtitle: 'Real-Time Bay Tracking, Quality Control & Vehicle Handover',
    badge: 'REAL-TIME STREAM',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: Wrench,
    description:
      'Visual stage management for every vehicle in the workshop. Track status from Check-In, In Progress, On Hold (Parts), Quality Control Inspection, to Ready for Collection.',
    steps: [
      {
        title: '1. Vehicle Arrival & Check-In',
        desc: 'When the vehicle arrives on site, log mileage, fuel level, key tag number, and initial walkaround damage inspection notes.'
      },
      {
        title: '2. Drag-and-Drop Workflow Progress',
        desc: 'Move job cards across lanes as technicians complete diagnostics, fit replacement parts, and road-test the vehicle.'
      },
      {
        title: '3. Quality Control (QC) Sign-Off',
        desc: 'Run the mandatory multi-point safety checklist before vehicle release, ensuring torque specs, fluid levels, and diagnostic scans pass.'
      },
      {
        title: '4. Automated Customer Collection Alert',
        desc: 'Moving the job card to "Ready for Collection" triggers an automated SMS/email to the customer with invoice summary and collection instructions.'
      }
    ],
    proTip:
      'Tip: Moving a job card to "Awaiting Parts" automatically pauses the technician labor idle timer, preventing workshop efficiency statistics from being skewed by supplier delivery delays.'
  },
  {
    id: 'inventory',
    title: 'Parts, Inventory & Automated Purchase Orders',
    subtitle: 'Live Stock Levels, Reorder Triggers & Supplier PO Dispatch',
    badge: 'STOCK SYNC',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    icon: PackageCheck,
    description:
      'Complete automotive parts catalog with automated stock decrement, minimum reorder thresholds, supplier purchase orders, and seamless line-item billing on job cards.',
    steps: [
      {
        title: '1. Master Parts Catalog & Bin Locations',
        desc: 'Search parts by OE part number, description, or barcode. Assign bin shelf locations for rapid technician retrieval in the stores room.'
      },
      {
        title: '2. Real-Time Stock Allocation to Jobs',
        desc: 'Assigning a part to an active job immediately marks it as reserved in stock, preventing double-allocation across conflicting repair bays.'
      },
      {
        title: '3. Generate Supplier Purchase Orders (PO)',
        desc: 'When stock drops below threshold, 1-click generate a Purchase Order with supplier part numbers, trade discount prices, and delivery dates.'
      },
      {
        title: '4. Goods-In Receiving & Cost Reconciliation',
        desc: 'Receive delivery shipments with one-click PO reconciliation. Item costs and retail prices automatically update across pending job cards.'
      }
    ],
    proTip:
      'Tip: Custom parts markups configured in the inventory matrix feed directly into the Director Dashboard to display real-time gross margin percentages by product category.'
  },
  {
    id: 'invoicing',
    title: 'Invoicing, Financials & VAT Ledger',
    subtitle: 'Split Payments, Deposit Deduction & Statutory HMRC Compliance',
    badge: 'HMRC & VAT READY',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    icon: DollarSign,
    description:
      'Comprehensive financial engine with automated 20% VAT calculations, split payment methods (Card, BACS, Cash, Finance), deposit offset, and professional PDF invoicing.',
    steps: [
      {
        title: '1. Reconcile Completed Job Card',
        desc: 'Review final technician labor hours, fitted parts, sundries, and environmental disposal fees before committing the invoice.'
      },
      {
        title: '2. Apply Customer Deposit & Deductions',
        desc: 'Any upfront booking deposits or warranty credits are automatically deducted from the gross invoice balance.'
      },
      {
        title: '3. Record Multi-Method Payments',
        desc: 'Split invoice totals across multiple payment tender types (e.g., £500 Credit Card, £250 BACS Bank Transfer) with full audit timestamps.'
      },
      {
        title: '4. Generate Statutory PDF Invoice',
        desc: 'Print or email a clean, high-contrast PDF invoice complete with registered VAT number, bank remittance details, and QR payment code.'
      }
    ],
    proTip:
      'Tip: When printing PDF invoices or financial statements, ensure "Background Graphics" is enabled in browser print settings so official invoice borders and payment badges render at full contrast.'
  },
  {
    id: 'directors',
    title: 'Director AI Copilot & Executive Intelligence',
    subtitle: 'Gemini AI Workshop Advisory, Revenue Analytics & Labor Tallies',
    badge: 'GEMINI AI ENGINE',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    icon: Bot,
    description:
      'Executive command suite powered by Google Gemini AI. Analyze workshop efficiency, technician utilization rates, monthly labor tallies, and revenue forecasts with natural language.',
    steps: [
      {
        title: '1. Launch Director Command Suite',
        desc: 'Navigate to the Summary / Directors Dashboard to review high-level workshop KPIs, revenue vs target, and booked vs billed technician hours.'
      },
      {
        title: '2. Query the Gemini AI Copilot',
        desc: 'Type natural language queries like "Which technician had highest billable hours this week?" or "Identify high-margin parts categories".'
      },
      {
        title: '3. Audit Monthly Labor Tallies',
        desc: 'Inspect technician labor efficiency ratios, overtime tallies, and unallocated workshop idle hours to optimize staffing capacity.'
      },
      {
        title: '4. Export Executive Financial Reports',
        desc: 'Generate boardroom-ready PDF and CSV reports for workshop gross profit, parts vs labor revenue splits, and month-on-month growth.'
      }
    ],
    proTip:
      'Tip: Ask the Gemini Copilot: "Generate an executive summary of this week\'s scheduling bottlenecks" to receive instant actionable recommendations for slot rebalancing.'
  },
  {
    id: 'mobile',
    title: 'Technician Mobile Field App & Live Clocking',
    subtitle: 'Live Tablet/Mobile PWA, Time Clocking & Digital Inspections',
    badge: 'MOBILE PWA LIVE',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    icon: Smartphone,
    description:
      'Dedicated technician mobile workspace optimized for tablets and smartphones. Clock in and out of jobs, complete digital tyre and safety checklists, and sign off work with touch signatures.',
    steps: [
      {
        title: '1. Open Mobile Technician Shell',
        desc: 'Access the mobile-optimized interface on any iOS or Android tablet. Technicians view only their designated job cards for the day.'
      },
      {
        title: '2. Live Job Clock-In / Clock-Out',
        desc: 'Tap "Start Job" to initiate the real-time labor stopwatch. Live timer data streams directly back to the dispatcher screen.'
      },
      {
        title: '3. Complete Digital Inspections',
        desc: 'Execute tyre tread depth checks (OSF, NSF, OSR, NSR), brake wear audits, and attach vehicle defect photos directly from tablet camera.'
      },
      {
        title: '4. Digital Touch Signature Sign-Off',
        desc: 'Sign off completed repairs on the clean touch signature pad using solid statutory cursive navy ink for immediate digital verification.'
      }
    ],
    proTip:
      'Tip: The mobile interface includes touch-friendly buttons and high-contrast inputs designed for technicians wearing protective workshop gloves.'
  }
];

const SOP_FILES = [
  '01-user-and-role-management.md',
  '02-customer-and-vehicle-management.md',
  '03-creating-and-managing-estimates.md',
  '04-managing-jobs.md',
  '05-parts-and-inventory-management.md',
  '06-invoicing-and-payments.md',
  '07-data-import-and-export.md'
];

export default function HelpCentre({ open, onClose }: HelpCentreProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('visual');
  const [activeTab, setActiveTab] = useState<HelpTab>('fcs');
  const [searchQuery, setSearchQuery] = useState('');
  const [sops, setSops] = useState<{ title: string; file: string; content: string }[]>([]);
  const [selectedSop, setSelectedSop] = useState<{ title: string; file: string; content: string } | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Load SOP markdown files on mount
  useEffect(() => {
    const fetchSops = async () => {
      try {
        const fetchedSops = await Promise.all(
          SOP_FILES.map(async (file) => {
            const response = await fetch(`/help/${file}`);
            const title = file.replace(/^\d+-/g, '').replace(/\.md$/, '').replace(/-/g, ' ');
            const content = await response.text();
            return { title, file, content };
          })
        );
        setSops(fetchedSops);
        if (fetchedSops.length > 0) {
          setSelectedSop(fetchedSops[0]);
        }
      } catch (err) {
        console.error('Failed to load SOP files', err);
      }
    };

    fetchSops();
  }, []);

  // Filter visual sections
  const filteredSections = HELP_SECTIONS.filter(
    (sec) =>
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.badge.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter SOP files
  const filteredSops = sops.filter(
    (sop) =>
      sop.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sop.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentSection = HELP_SECTIONS.find((sec) => sec.id === activeTab) || HELP_SECTIONS[0];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-fade-in font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-[1550px] w-full max-h-[94vh] flex flex-col overflow-hidden shadow-2xl text-white">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  Visual Features Studio
                </span>
                <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-bold">
                  INTELLIGENT SCHEDULER V8.02 LIVE
                </span>
              </div>
              <h1 className="text-lg font-black tracking-tight text-white mt-0.5">
                Intelligent Scheduler Visual Help, Diagrams & Feature Walkthrough
              </h1>
            </div>
          </div>

          {/* MODE TOGGLE & SEARCH & CLOSE */}
          <div className="flex items-center gap-3">
            {/* View Mode Switcher */}
            <div className="bg-slate-950/80 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
              <button
                onClick={() => setViewMode('visual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'visual'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Visual Studio
              </button>
              <button
                onClick={() => setViewMode('sop')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'sop'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-300" />
                SOP Library ({sops.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative hidden sm:block w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search help features..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-9 pr-7 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white rounded-2xl transition cursor-pointer"
              title="Close Guide"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL CONTENT LAYOUT */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* ===================== VIEW MODE 1: VISUAL FEATURES STUDIO ===================== */}
          {viewMode === 'visual' && (
            <>
              {/* SIDEBAR MODULE SELECTOR */}
              <div className="w-full md:w-84 bg-slate-950/70 border-b md:border-b-0 md:border-r border-slate-800 p-4 overflow-y-auto space-y-2 shrink-0">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
                  <span>Core Modules & Capabilities ({filteredSections.length})</span>
                  <span className="text-amber-400">V8.02</span>
                </div>

                {filteredSections.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeTab === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => setActiveTab(sec.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-900/60 to-slate-900 border-indigo-500 shadow-lg text-white'
                          : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold truncate">{sec.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {sec.subtitle}
                        </p>
                        <span
                          className={`inline-block text-[9px] font-mono font-bold px-2 py-0.5 rounded border mt-1.5 ${sec.badgeColor}`}
                        >
                          {sec.badge}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* MAIN DETAIL PANEL */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-slate-900/90">
                {/* 1. SECTION TITLE & PURPOSE BANNER */}
                <div className="bg-gradient-to-r from-slate-950 via-indigo-950/60 to-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-3 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider ${currentSection.badgeColor}`}
                    >
                      {currentSection.badge}
                    </span>
                    <span className="text-xs font-mono text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 animate-spin-slow" />
                      UK Workshop Standard & FCS Certified
                    </span>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white">
                    {currentSection.title}
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
                    {currentSection.description}
                  </p>
                </div>

                {/* 2. HIGH-FIDELITY ARCHITECTURAL & UI PICTURE / SVG SCHEMATIC */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Visual Architecture & Operating Picture
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400">
                      Interactive SVG Schematic & Flow Diagram
                    </span>
                  </div>

                  <div className="bg-slate-950 border-2 border-slate-800 rounded-3xl p-6 md:p-8 shadow-inner overflow-x-auto">
                    {/* SVG PICTURE 1: FCS DYNAMIC DISPATCH & SCHEDULING MATRIX */}
                    {currentSection.id === 'fcs' && (
                      <svg
                        viewBox="0 0 920 280"
                        className="w-full max-w-4xl mx-auto h-auto rounded-xl drop-shadow-lg"
                      >
                        <rect width="920" height="280" rx="16" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
                        
                        {/* BOX 1: PENDING QUEUE */}
                        <rect x="25" y="35" width="220" height="205" rx="12" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
                        <text x="135" y="65" fill="#60a5fa" fontSize="13" fontWeight="bold" textAnchor="middle">1. PENDING REPAIR QUEUE</text>
                        <rect x="40" y="85" width="190" height="32" rx="6" fill="#0f172a" />
                        <text x="135" y="105" fill="#e2e8f0" fontSize="11" textAnchor="middle">MOT & Major Service (3.5h)</text>
                        <rect x="40" y="125" width="190" height="32" rx="6" fill="#0f172a" />
                        <text x="135" y="145" fill="#e2e8f0" fontSize="11" textAnchor="middle">Brake Disc Replacement (1.5h)</text>
                        <rect x="40" y="165" width="190" height="32" rx="6" fill="#3b82f6" />
                        <text x="135" y="185" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">Engine Diagnostic (1.0h)</text>
                        <text x="135" y="222" fill="#94a3b8" fontSize="10" textAnchor="middle">Priority Scoring & Estimated Hours</text>

                        {/* CONNECTOR 1 */}
                        <path d="M 250 138 L 295 138" stroke="#10b981" strokeWidth="3" strokeDasharray="6,4" />
                        <polygon points="295,138 288,133 288,143" fill="#10b981" />

                        {/* BOX 2: FCS OPTIMIZER ENGINE */}
                        <rect x="300" y="35" width="240" height="205" rx="12" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
                        <text x="420" y="65" fill="#34d399" fontSize="13" fontWeight="bold" textAnchor="middle">2. FCS OPTIMIZER ENGINE</text>
                        <rect x="320" y="85" width="200" height="38" rx="8" fill="#065f46" />
                        <text x="420" y="108" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">ALGORITHM LEVELING</text>
                        
                        <g transform="translate(320, 135)">
                          <rect x="0" y="0" width="60" height="26" rx="6" fill="#064e3b" stroke="#10b981" />
                          <text x="30" y="17" fill="#a7f3d0" fontSize="9" fontWeight="bold" textAnchor="middle">SKILL</text>
                          <rect x="70" y="0" width="60" height="26" rx="6" fill="#064e3b" stroke="#10b981" />
                          <text x="100" y="17" fill="#a7f3d0" fontSize="9" fontWeight="bold" textAnchor="middle">CAPACITY</text>
                          <rect x="140" y="0" width="60" height="26" rx="6" fill="#064e3b" stroke="#10b981" />
                          <text x="170" y="17" fill="#a7f3d0" fontSize="9" fontWeight="bold" textAnchor="middle">HOLIDAY</text>
                        </g>

                        <text x="420" y="190" fill="#a7f3d0" fontSize="11" textAnchor="middle">Auto-Balancing 6 Technicians</text>
                        <text x="420" y="210" fill="#6ee7b7" fontSize="10" fontWeight="bold" textAnchor="middle">8 Workshop Bays Levelled</text>

                        {/* CONNECTOR 2 */}
                        <path d="M 545 138 L 590 138" stroke="#6366f1" strokeWidth="3" strokeDasharray="6,4" />
                        <polygon points="590,138 583,133 583,143" fill="#6366f1" />

                        {/* BOX 3: LIVE GANTT MATRIX */}
                        <rect x="595" y="35" width="300" height="205" rx="12" fill="#1e293b" stroke="#6366f1" strokeWidth="2" />
                        <text x="745" y="65" fill="#818cf8" fontSize="13" fontWeight="bold" textAnchor="middle">3. LIVE WORKSHOP GANTT</text>
                        <rect x="615" y="85" width="260" height="42" rx="8" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
                        <text x="745" y="103" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">Bay 1 • Dave M. (Master Tech)</text>
                        <text x="745" y="119" fill="#34d399" fontSize="10" fontFamily="monospace" textAnchor="middle">Audi RS6 Brake Audit [09:00 - 11:30]</text>
                        
                        <rect x="615" y="135" width="260" height="42" rx="8" fill="#0f172a" stroke="#6366f1" strokeWidth="1.5" />
                        <text x="745" y="153" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">Bay 2 • Chris T. (Senior Tech)</text>
                        <text x="745" y="169" fill="#a5b4fc" fontSize="10" fontFamily="monospace" textAnchor="middle">BMW M3 Major Service [11:30 - 15:00]</text>
                        
                        <text x="745" y="215" fill="#c7d2fe" fontSize="11" fontWeight="bold" textAnchor="middle">✓ Real-Time Drag &amp; Drop • Conflict Free</text>
                      </svg>
                    )}

                    {/* SVG PICTURE 2: SMART ESTIMATES & JOB LIFECYCLE */}
                    {currentSection.id === 'estimates' && (
                      <svg
                        viewBox="0 0 920 280"
                        className="w-full max-w-4xl mx-auto h-auto rounded-xl drop-shadow-lg"
                      >
                        <rect width="920" height="280" rx="16" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
                        
                        {/* BOX 1: ESTIMATE BUILDER */}
                        <rect x="25" y="35" width="230" height="205" rx="12" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
                        <text x="140" y="65" fill="#60a5fa" fontSize="13" fontWeight="bold" textAnchor="middle">1. ESTIMATE BUILDER</text>
                        <rect x="45" y="85" width="190" height="32" rx="6" fill="#0f172a" />
                        <text x="140" y="105" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle">VR19 XYZ • Porsche 911</text>
                        <rect x="45" y="125" width="190" height="30" rx="6" fill="#0f172a" />
                        <text x="140" y="144" fill="#e2e8f0" fontSize="11" textAnchor="middle">Labor: 3.5 hrs @ £95/hr</text>
                        <rect x="45" y="162" width="190" height="30" rx="6" fill="#0f172a" />
                        <text x="140" y="181" fill="#e2e8f0" fontSize="11" textAnchor="middle">Parts: Brembo Discs &amp; Pads</text>
                        <text x="140" y="218" fill="#93c5fd" fontSize="11" fontWeight="bold" textAnchor="middle">Est Total: £682.50 + VAT</text>

                        {/* CONNECTOR 1 */}
                        <path d="M 260 138 L 305 138" stroke="#10b981" strokeWidth="3" strokeDasharray="6,4" />
                        <polygon points="305,138 298,133 298,143" fill="#10b981" />

                        {/* BOX 2: DIGITAL CUSTOMER APPROVAL */}
                        <rect x="310" y="35" width="240" height="205" rx="12" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
                        <text x="430" y="65" fill="#34d399" fontSize="13" fontWeight="bold" textAnchor="middle">2. DIGITAL APPROVAL</text>
                        <rect x="330" y="85" width="200" height="36" rx="8" fill="#065f46" />
                        <text x="430" y="108" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">SMS / EMAIL QUOTE SENT</text>
                        <rect x="330" y="130" width="200" height="42" rx="8" fill="#ffffff" />
                        <text x="430" y="156" fill="#065f46" fontSize="14" fontStyle="italic" fontWeight="bold" fontFamily="cursive" textAnchor="middle">Customer Approved ✓</text>
                        <rect x="330" y="180" width="200" height="28" rx="6" fill="#0f172a" />
                        <text x="430" y="198" fill="#34d399" fontSize="10" fontFamily="monospace" textAnchor="middle">£150.00 Deposit Paid</text>

                        {/* CONNECTOR 2 */}
                        <path d="M 555 138 L 600 138" stroke="#818cf8" strokeWidth="3" strokeDasharray="6,4" />
                        <polygon points="600,138 593,133 593,143" fill="#818cf8" />

                        {/* BOX 3: CONVERT TO ACTIVE JOB */}
                        <rect x="605" y="35" width="290" height="205" rx="12" fill="#1e293b" stroke="#818cf8" strokeWidth="2" />
                        <text x="750" y="65" fill="#a5b4fc" fontSize="13" fontWeight="bold" textAnchor="middle">3. 1-CLICK JOB CONVERSION</text>
                        <rect x="625" y="85" width="250" height="38" rx="8" fill="#312e81" stroke="#818cf8" strokeWidth="1.5" />
                        <text x="750" y="108" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">JOB CARD #JOB-8842</text>
                        <text x="750" y="145" fill="#e2e8f0" fontSize="11" textAnchor="middle">Auto-Allocated to Bay 3</text>
                        <text x="750" y="165" fill="#c7d2fe" fontSize="11" textAnchor="middle">Stock Reserved &amp; Scheduled</text>
                        <rect x="625" y="185" width="250" height="32" rx="6" fill="#0f172a" stroke="#10b981" />
                        <text x="750" y="205" fill="#34d399" fontSize="11" fontWeight="bold" textAnchor="middle">✓ Ready for Workshop Dispatch</text>
                      </svg>
                    )}

                    {/* SVG PICTURE 3: LIVE WORKSHOP KANBAN */}
                    {currentSection.id === 'workflow' && (
                      <svg
                        viewBox="0 0 920 280"
                        className="w-full max-w-4xl mx-auto h-auto rounded-xl drop-shadow-lg"
                      >
                        <rect width="920" height="280" rx="16" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
                        
                        {/* BOX 1: VEHICLE CHECK-IN */}
                        <rect x="25" y="35" width="230" height="205" rx="12" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
                        <text x="140" y="65" fill="#fbbf24" fontSize="13" fontWeight="bold" textAnchor="middle">1. VEHICLE CHECK-IN</text>
                        <rect x="45" y="85" width="190" height="30" rx="6" fill="#0f172a" />
                        <text x="140" y="104" fill="#ffffff" fontSize="11" textAnchor="middle">Mileage: 42,150 mi</text>
                        <rect x="45" y="122" width="190" height="30" rx="6" fill="#0f172a" />
                        <text x="140" y="141" fill="#ffffff" fontSize="11" textAnchor="middle">Key Tag Assigned: #48</text>
                        <rect x="45" y="159" width="190" height="30" rx="6" fill="#78350f" />
                        <text x="140" y="178" fill="#fde68a" fontSize="11" fontWeight="bold" textAnchor="middle">Walkaround Complete</text>
                        <text x="140" y="215" fill="#fde68a" fontSize="10" textAnchor="middle">Checked In by Reception</text>

                        {/* CONNECTOR 1 */}
                        <path d="M 260 138 L 305 138" stroke="#3b82f6" strokeWidth="3" strokeDasharray="6,4" />
                        <polygon points="305,138 298,133 298,143" fill="#3b82f6" />

                        {/* BOX 2: ACTIVE SERVICE BAY */}
                        <rect x="310" y="35" width="240" height="205" rx="12" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
                        <text x="430" y="65" fill="#60a5fa" fontSize="13" fontWeight="bold" textAnchor="middle">2. ACTIVE SERVICE BAY</text>
                        <rect x="330" y="85" width="200" height="36" rx="8" fill="#1e3a8a" />
                        <text x="430" y="108" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">IN PROGRESS (1h 45m)</text>
                        <rect x="330" y="130" width="200" height="32" rx="6" fill="#0f172a" />
                        <text x="430" y="150" fill="#93c5fd" fontSize="11" textAnchor="middle">OE Discs &amp; Pads Fitted</text>
                        <rect x="330" y="170" width="200" height="32" rx="6" fill="#0f172a" />
                        <text x="430" y="190" fill="#a7f3d0" fontSize="11" textAnchor="middle">Brake Fluid Bleed Passed</text>
                        <text x="430" y="222" fill="#94a3b8" fontSize="10" textAnchor="middle">Stopwatch Timer Synchronized</text>

                        {/* CONNECTOR 2 */}
                        <path d="M 555 138 L 600 138" stroke="#10b981" strokeWidth="3" strokeDasharray="6,4" />
                        <polygon points="600,138 593,133 593,143" fill="#10b981" />

                        {/* BOX 3: QC AUDIT & HANDOVER */}
                        <rect x="605" y="35" width="290" height="205" rx="12" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
                        <text x="750" y="65" fill="#34d399" fontSize="13" fontWeight="bold" textAnchor="middle">3. QC AUDIT &amp; HANDOVER</text>
                        <circle cx="750" cy="115" r="32" fill="#064e3b" stroke="#10b981" strokeWidth="2" />
                        <text x="750" y="113" fill="#ffffff" fontSize="13" fontWeight="bold" textAnchor="middle">100%</text>
                        <text x="750" y="126" fill="#6ee7b7" fontSize="8" fontWeight="bold" textAnchor="middle">QC PASS</text>
                        
                        <rect x="635" y="160" width="230" height="30" rx="6" fill="#065f46" />
                        <text x="750" y="179" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">SMS: "Vehicle Ready For Collection"</text>
                        <text x="750" y="215" fill="#a7f3d0" fontSize="11" fontWeight="bold" textAnchor="middle">Keys at Reception • Invoice Ready</text>
                      </svg>
                    )}

                    {/* SVG PICTURE 4: PARTS, INVENTORY & PURCHASE ORDERS */}
                    {currentSection.id === 'inventory' && (
                      <svg
                        viewBox="0 0 920 280"
                        className="w-full max-w-4xl mx-auto h-auto rounded-xl drop-shadow-lg"
                      >
                        <rect width="920" height="280" rx="16" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
                        
                        {/* BOX 1: REAL-TIME INVENTORY */}
                        <rect x="25" y="35" width="230" height="205" rx="12" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
                        <text x="140" y="65" fill="#60a5fa" fontSize="13" fontWeight="bold" textAnchor="middle">1. REAL-TIME INVENTORY</text>
                        <rect x="45" y="85" width="190" height="34" rx="6" fill="#0f172a" />
                        <text x="140" y="101" fill="#ffffff" fontSize="10" fontFamily="monospace" textAnchor="middle">#06E-115-562E • Oil Filter</text>
                        <text x="140" y="114" fill="#34d399" fontSize="9" textAnchor="middle">Stock: 14 on hand (Bin A4)</text>
                        <rect x="45" y="126" width="190" height="34" rx="6" fill="#0f172a" stroke="#ef4444" />
                        <text x="140" y="142" fill="#ffffff" fontSize="10" fontFamily="monospace" textAnchor="middle">#8K0-698-151 • Brake Pads</text>
                        <text x="140" y="155" fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle">LOW STOCK (Qty: 1) Trigger Active</text>
                        <rect x="45" y="170" width="190" height="30" rx="6" fill="#0f172a" />
                        <text x="140" y="189" fill="#93c5fd" fontSize="10" textAnchor="middle">Barcoded Bin Tracking</text>

                        {/* CONNECTOR 1 */}
                        <path d="M 260 138 L 305 138" stroke="#a855f7" strokeWidth="3" strokeDasharray="6,4" />
                        <polygon points="305,138 298,133 298,143" fill="#a855f7" />

                        {/* BOX 2: SUPPLIER PO */}
                        <rect x="310" y="35" width="240" height="205" rx="12" fill="#1e293b" stroke="#a855f7" strokeWidth="2" />
                        <text x="430" y="65" fill="#c084fc" fontSize="13" fontWeight="bold" textAnchor="middle">2. SUPPLIER PO DISPATCH</text>
                        <rect x="330" y="85" width="200" height="36" rx="8" fill="#3b0764" stroke="#a855f7" />
                        <text x="430" y="108" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">PO-2026-904 CREATED</text>
                        <rect x="330" y="130" width="200" height="30" rx="6" fill="#0f172a" />
                        <text x="430" y="149" fill="#e2e8f0" fontSize="11" textAnchor="middle">Supplier: TPS / Euro Car Parts</text>
                        <rect x="330" y="168" width="200" height="30" rx="6" fill="#0f172a" />
                        <text x="430" y="187" fill="#a855f7" fontSize="11" textAnchor="middle">Trade Price: £142.80 + VAT</text>
                        <text x="430" y="222" fill="#cbd5e1" fontSize="10" textAnchor="middle">Expected Delivery: 08:30 Tomorrow</text>

                        {/* CONNECTOR 2 */}
                        <path d="M 555 138 L 600 138" stroke="#10b981" strokeWidth="3" strokeDasharray="6,4" />
                        <polygon points="600,138 593,133 593,143" fill="#10b981" />

                        {/* BOX 3: GOODS-IN & ALLOCATION */}
                        <rect x="605" y="35" width="290" height="205" rx="12" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
                        <text x="750" y="65" fill="#34d399" fontSize="13" fontWeight="bold" textAnchor="middle">3. GOODS-IN &amp; ALLOCATION</text>
                        <rect x="625" y="85" width="250" height="38" rx="8" fill="#065f46" />
                        <text x="750" y="108" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">BARCODE SCAN RECEIVED</text>
                        <rect x="625" y="132" width="250" height="36" rx="6" fill="#0f172a" stroke="#10b981" />
                        <text x="750" y="154" fill="#a7f3d0" fontSize="11" textAnchor="middle">Allocated to Job #JOB-8842</text>
                        <text x="750" y="195" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">✓ Stock Level Incremented</text>
                        <text x="750" y="215" fill="#6ee7b7" fontSize="10" textAnchor="middle">Parts Margins Locked at 38.5%</text>
                      </svg>
                    )}

                    {/* SVG PICTURE 5: INVOICING & VAT LEDGER */}
                    {currentSection.id === 'invoicing' && (
                      <svg
                        viewBox="0 0 920 280"
                        className="w-full max-w-4xl mx-auto h-auto rounded-xl drop-shadow-lg"
                      >
                        <rect width="920" height="280" rx="16" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
                        
                        {/* BOX 1: RECONCILED JOB TOTAL */}
                        <rect x="25" y="35" width="230" height="205" rx="12" fill="#1e293b" stroke="#a855f7" strokeWidth="2" />
                        <text x="140" y="65" fill="#c084fc" fontSize="13" fontWeight="bold" textAnchor="middle">1. COMPLETED WORK TOTAL</text>
                        <rect x="45" y="85" width="190" height="28" rx="6" fill="#0f172a" />
                        <text x="140" y="103" fill="#ffffff" fontSize="10" textAnchor="middle">Labor: 4.5 hrs @ £85/hr (£382.50)</text>
                        <rect x="45" y="119" width="190" height="28" rx="6" fill="#0f172a" />
                        <text x="140" y="137" fill="#ffffff" fontSize="10" textAnchor="middle">OE Parts &amp; Oils (£342.50)</text>
                        <rect x="45" y="153" width="190" height="28" rx="6" fill="#0f172a" />
                        <text x="140" y="171" fill="#ffffff" fontSize="10" textAnchor="middle">Environmental Disposal (£12.00)</text>
                        <rect x="45" y="188" width="190" height="32" rx="6" fill="#3b0764" />
                        <text x="140" y="208" fill="#e9d5ff" fontSize="11" fontWeight="bold" textAnchor="middle">Net Total: £737.00</text>

                        {/* CONNECTOR 1 */}
                        <path d="M 260 138 L 305 138" stroke="#3b82f6" strokeWidth="3" strokeDasharray="6,4" />
                        <polygon points="305,138 298,133 298,143" fill="#3b82f6" />

                        {/* BOX 2: VAT & DEPOSIT CALCULATION */}
                        <rect x="310" y="35" width="240" height="205" rx="12" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
                        <text x="430" y="65" fill="#60a5fa" fontSize="13" fontWeight="bold" textAnchor="middle">2. VAT &amp; DEPOSIT ENGINE</text>
                        <rect x="330" y="85" width="200" height="32" rx="6" fill="#0f172a" />
                        <text x="430" y="105" fill="#e2e8f0" fontSize="11" textAnchor="middle">UK VAT (20%): £147.40</text>
                        <rect x="330" y="125" width="200" height="32" rx="6" fill="#0f172a" />
                        <text x="430" y="145" fill="#e2e8f0" fontSize="11" textAnchor="middle">Gross Total: £884.40</text>
                        <rect x="330" y="165" width="200" height="32" rx="6" fill="#1e3a8a" />
                        <text x="430" y="185" fill="#93c5fd" fontSize="11" fontWeight="bold" textAnchor="middle">Less Deposit: -£250.00</text>
                        <text x="430" y="222" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">Balance Due: £634.40</text>

                        {/* CONNECTOR 2 */}
                        <path d="M 555 138 L 600 138" stroke="#10b981" strokeWidth="3" strokeDasharray="6,4" />
                        <polygon points="600,138 593,133 593,143" fill="#10b981" />

                        {/* BOX 3: STATUTORY PDF INVOICE */}
                        <rect x="605" y="35" width="290" height="205" rx="12" fill="#ffffff" stroke="#6366f1" strokeWidth="2" />
                        <rect x="625" y="48" width="250" height="26" rx="4" fill="#0f172a" />
                        <text x="750" y="65" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">INTELLIGENT SCHEDULER INVOICE</text>
                        <text x="750" y="98" fill="#1e293b" fontSize="11" fontWeight="bold" textAnchor="middle">INV-2026-0842 • VR19 XYZ</text>
                        <rect x="625" y="112" width="250" height="42" rx="6" fill="#f8fafc" stroke="#cbd5e1" />
                        <text x="750" y="130" fill="#0f172a" fontSize="10" textAnchor="middle">PAID IN FULL: £634.40</text>
                        <text x="750" y="144" fill="#059669" fontSize="9" fontWeight="bold" textAnchor="middle">✓ BACS Bank Transfer Settled</text>
                        <rect x="625" y="165" width="250" height="32" rx="6" fill="#eff6ff" stroke="#2563eb" />
                        <text x="750" y="185" fill="#1e40af" fontSize="10" fontWeight="bold" textAnchor="middle">✓ STATUTORY HMRC READY</text>
                        <text x="750" y="220" fill="#64748b" fontSize="9" textAnchor="middle">Solid Ink Output • Zero Overlap Print Engine</text>
                      </svg>
                    )}

                    {/* SVG PICTURE 6: DIRECTOR AI COPILOT */}
                    {currentSection.id === 'directors' && (
                      <svg
                        viewBox="0 0 920 280"
                        className="w-full max-w-4xl mx-auto h-auto rounded-xl drop-shadow-lg"
                      >
                        <rect width="920" height="280" rx="16" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
                        
                        {/* BOX 1: TELEMETRY STREAM */}
                        <rect x="25" y="35" width="230" height="205" rx="12" fill="#1e293b" stroke="#f43f5e" strokeWidth="2" />
                        <text x="140" y="65" fill="#fb7185" fontSize="13" fontWeight="bold" textAnchor="middle">1. WORKSHOP TELEMETRY</text>
                        <rect x="45" y="85" width="190" height="32" rx="6" fill="#0f172a" />
                        <text x="140" y="105" fill="#ffffff" fontSize="11" textAnchor="middle">6 Technicians • 8 Bays</text>
                        <rect x="45" y="125" width="190" height="32" rx="6" fill="#0f172a" />
                        <text x="140" y="145" fill="#ffffff" fontSize="11" textAnchor="middle">Weekly Billed: 184.5 hrs</text>
                        <rect x="45" y="165" width="190" height="32" rx="6" fill="#881337" />
                        <text x="140" y="185" fill="#fecdd3" fontSize="11" fontWeight="bold" textAnchor="middle">Parts Margin: 38.4%</text>
                        <text x="140" y="222" fill="#fda4af" fontSize="10" textAnchor="middle">Live Firestore Data Feeds</text>

                        {/* CONNECTOR 1 */}
                        <path d="M 260 138 L 305 138" stroke="#818cf8" strokeWidth="3" strokeDasharray="6,4" />
                        <polygon points="305,138 298,133 298,143" fill="#818cf8" />

                        {/* BOX 2: GEMINI AI COPILOT */}
                        <rect x="310" y="35" width="240" height="205" rx="12" fill="#1e293b" stroke="#818cf8" strokeWidth="2" />
                        <text x="430" y="65" fill="#a5b4fc" fontSize="13" fontWeight="bold" textAnchor="middle">2. GEMINI AI ADVISORY</text>
                        <rect x="330" y="85" width="200" height="36" rx="8" fill="#312e81" stroke="#818cf8" />
                        <text x="430" y="107" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">AI COPILOT ANALYSIS</text>
                        <rect x="330" y="130" width="200" height="65" rx="6" fill="#0f172a" stroke="#6366f1" />
                        <text x="430" y="150" fill="#a5b4fc" fontSize="10" textAnchor="middle">"Workshop running at 94%</text>
                        <text x="430" y="166" fill="#a5b4fc" fontSize="10" textAnchor="middle">efficiency. Recommend opening</text>
                        <text x="430" y="182" fill="#34d399" fontSize="10" fontWeight="bold" textAnchor="middle">2 extra Saturday MOT slots."</text>
                        <text x="430" y="222" fill="#c7d2fe" fontSize="10" textAnchor="middle">Natural Language BI Queries</text>

                        {/* CONNECTOR 2 */}
                        <path d="M 555 138 L 600 138" stroke="#10b981" strokeWidth="3" strokeDasharray="6,4" />
                        <polygon points="600,138 593,133 593,143" fill="#10b981" />

                        {/* BOX 3: EXECUTIVE BI COMMAND */}
                        <rect x="605" y="35" width="290" height="205" rx="12" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
                        <text x="750" y="65" fill="#34d399" fontSize="13" fontWeight="bold" textAnchor="middle">3. EXECUTIVE BI COMMAND</text>
                        <rect x="625" y="85" width="250" height="42" rx="8" fill="#065f46" />
                        <text x="750" y="103" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">REVENUE MTD: £48,920</text>
                        <text x="750" y="119" fill="#a7f3d0" fontSize="10" textAnchor="middle">+12.4% vs Previous Month</text>
                        <rect x="625" y="135" width="250" height="38" rx="6" fill="#0f172a" />
                        <text x="750" y="158" fill="#38bdf8" fontSize="11" textAnchor="middle">Technician Utilization: 91.2%</text>
                        <rect x="625" y="180" width="250" height="32" rx="6" fill="#064e3b" stroke="#10b981" />
                        <text x="750" y="200" fill="#a7f3d0" fontSize="11" fontWeight="bold" textAnchor="middle">✓ Instant Board Reports Ready</text>
                      </svg>
                    )}

                    {/* SVG PICTURE 7: MOBILE APP SHELL */}
                    {currentSection.id === 'mobile' && (
                      <svg
                        viewBox="0 0 920 280"
                        className="w-full max-w-4xl mx-auto h-auto rounded-xl drop-shadow-lg"
                      >
                        <rect width="920" height="280" rx="16" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
                        
                        {/* BOX 1: MOBILE WORKSPACE */}
                        <rect x="35" y="30" width="310" height="220" rx="20" fill="#1e293b" stroke="#64748b" strokeWidth="3" />
                        <rect x="50" y="45" width="280" height="190" rx="12" fill="#0f172a" />
                        <text x="190" y="75" fill="#2dd4bf" fontSize="13" fontWeight="bold" textAnchor="middle">TECHNICIAN MOBILE PWA</text>
                        <rect x="70" y="95" width="240" height="34" rx="8" fill="#134e4a" stroke="#14b8a6" />
                        <text x="190" y="116" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">CLOCK IN: Job #JOB-8842</text>
                        <rect x="70" y="140" width="240" height="36" rx="8" fill="#1e293b" />
                        <text x="190" y="162" fill="#99f6e4" fontSize="12" fontFamily="monospace" textAnchor="middle">⏱ 01:24:18 Elapsed</text>
                        <text x="190" y="210" fill="#94a3b8" fontSize="10" textAnchor="middle">Touch Friendly • Glove Compatible</text>

                        {/* CONNECTOR 1 */}
                        <path d="M 365 140 L 405 140" stroke="#14b8a6" strokeWidth="3" />
                        <polygon points="405,140 398,135 398,145" fill="#14b8a6" />

                        {/* BOX 2: DIGITAL INSPECTIONS & SIGNATURE */}
                        <rect x="420" y="35" width="465" height="210" rx="12" fill="#1e293b" stroke="#14b8a6" strokeWidth="2" />
                        <text x="652" y="70" fill="#2dd4bf" fontSize="13" fontWeight="bold" textAnchor="middle">DIGITAL INSPECTIONS &amp; TOUCH SIGN-OFF</text>
                        
                        <g transform="translate(445, 90)">
                          <rect x="0" y="0" width="195" height="50" rx="8" fill="#0f172a" />
                          <text x="97" y="22" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">🚗 TYRE &amp; BRAKE AUDIT</text>
                          <text x="97" y="38" fill="#94a3b8" fontSize="10" textAnchor="middle">6mm OSF • 5mm NSF Checked</text>
                          
                          <rect x="215" y="0" width="195" height="50" rx="8" fill="#0f172a" />
                          <text x="312" y="22" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">📸 DEFECT PHOTOS</text>
                          <text x="312" y="38" fill="#94a3b8" fontSize="10" textAnchor="middle">Live Tablet Camera Upload</text>
                        </g>

                        <rect x="445" y="155" width="410" height="55" rx="8" fill="#ffffff" stroke="#0d9488" strokeWidth="1.5" />
                        <text x="650" y="180" fill="#002060" fontSize="16" fontStyle="italic" fontWeight="bold" fontFamily="cursive" textAnchor="middle">Lead Tech - Chris T.</text>
                        <text x="650" y="198" fill="#0f766e" fontSize="9" fontFamily="monospace" textAnchor="middle">✓ VERIFIED TOUCH SIGNATURE • REF: TECH-SIGN-3912</text>
                        <text x="650" y="235" fill="#a7f3d0" fontSize="10" textAnchor="middle">Instant Dispatcher Cloud Sync • Offline Cache Supported</text>
                      </svg>
                    )}
                  </div>
                </div>

                {/* 3. STEP-BY-STEP WORKFLOW GUIDE */}
                <div className="space-y-4">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Step-by-Step Operating Instructions
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentSection.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-2 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                            {idx + 1}
                          </span>
                          <h4 className="text-sm font-bold text-white">{step.title}</h4>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed pl-9">
                          {step.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. COMPLIANCE & OPERATIONAL PRO-TIP BOX */}
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-transparent border border-amber-500/30 rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      Workshop Dispatch &amp; Engineering Pro-Tip
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      {currentSection.proTip}
                    </p>
                  </div>
                </div>

                {/* 5. MODAL FOOTER */}
                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-xs text-slate-400 font-mono">
                    Intelligent Scheduler V8.02 Live • Multi-Bay FCS Dispatch &amp; Workshop ERP Suite
                  </div>
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-indigo-600/30 cursor-pointer font-mono"
                  >
                    Close Visual Guide
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ===================== VIEW MODE 2: SOP LIBRARY ===================== */}
          {viewMode === 'sop' && (
            <>
              {/* SIDEBAR FOR SOP TITLES */}
              <div className="w-full md:w-84 bg-slate-950/70 border-b md:border-b-0 md:border-r border-slate-800 p-4 overflow-y-auto space-y-2 shrink-0">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
                  <span>Standard Operating Procedures ({filteredSops.length})</span>
                  <span className="text-indigo-400">DOCS</span>
                </div>

                {filteredSops.map((sop, index) => {
                  const isSelected = selectedSop?.file === sop.file;
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedSop(sop)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-r from-indigo-900/60 to-slate-900 border-indigo-500 shadow-lg text-white'
                          : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold capitalize block leading-snug">
                          {sop.title}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block mt-1">
                          {sop.file}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* MAIN CONTENT AREA FOR SELECTED SOP */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-900/90 text-slate-200">
                {selectedSop ? (
                  <div className="space-y-6 max-w-4xl">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-bold uppercase">
                          Standard Operating Procedure
                        </span>
                        <h2 className="text-xl font-bold text-white mt-1 capitalize">
                          {selectedSop.title}
                        </h2>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        File: {selectedSop.file}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-3xl p-6 md:p-8 text-slate-300 leading-relaxed space-y-4">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ ...props }) => (
                            <h1 className="text-2xl font-black text-white pb-2 border-b border-slate-800 mb-4 mt-2" {...props} />
                          ),
                          h2: ({ ...props }) => (
                            <h2 className="text-xl font-bold text-amber-400 pb-1 border-b border-slate-800/60 mb-3 mt-6" {...props} />
                          ),
                          h3: ({ ...props }) => (
                            <h3 className="text-base font-bold text-indigo-300 mb-2 mt-4" {...props} />
                          ),
                          p: ({ ...props }) => <p className="mb-3 text-sm text-slate-300 leading-relaxed" {...props} />,
                          ul: ({ ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-sm text-slate-300" {...props} />,
                          ol: ({ ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm text-slate-300" {...props} />,
                          li: ({ ...props }) => <li className="mb-1" {...props} />,
                          code: ({ ...props }) => (
                            <code className="bg-slate-800 text-amber-300 font-mono text-xs px-1.5 py-0.5 rounded border border-slate-700" {...props} />
                          ),
                          table: ({ ...props }) => (
                            <div className="overflow-x-auto my-4">
                              <table className="w-full text-xs text-left border-collapse border border-slate-800 rounded-lg overflow-hidden" {...props} />
                            </div>
                          ),
                          th: ({ ...props }) => (
                            <th className="bg-slate-800 p-2.5 font-bold text-slate-200 border border-slate-700" {...props} />
                          ),
                          td: ({ ...props }) => (
                            <td className="p-2.5 text-slate-300 border border-slate-800 bg-slate-900/50" {...props} />
                          ),
                          img: ({ ...props }) => (
                            <div
                              className="relative inline-block my-4 cursor-zoom-in group"
                              onClick={() => props.src && setZoomedImage(props.src)}
                            >
                              <img
                                {...props}
                                alt={props.alt || 'SOP Diagram'}
                                className="max-w-full rounded-xl border border-slate-800 shadow-lg group-hover:opacity-90 transition"
                              />
                              <div className="absolute top-3 right-3 bg-slate-900/80 p-1.5 rounded-lg text-amber-400 opacity-0 group-hover:opacity-100 transition shadow">
                                <ZoomIn className="w-4 h-4" />
                              </div>
                            </div>
                          )
                        }}
                      >
                        {selectedSop.content}
                      </ReactMarkdown>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                      <button
                        onClick={() => setViewMode('visual')}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer font-mono"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Switch to Visual Studio
                      </button>
                      <button
                        onClick={onClose}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer font-mono"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Select an SOP document from the sidebar to view full procedures.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* IMAGE ZOOM OVERLAY */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomedImage}
              alt="Enlarged SOP illustration"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-slate-700"
            />
          </div>
        </div>
      )}
    </div>
  );
}
