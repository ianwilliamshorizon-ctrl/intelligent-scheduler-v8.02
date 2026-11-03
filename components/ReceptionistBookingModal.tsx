import React, { useState, useMemo, useEffect } from 'react';
import {
    X, Check, Car, User, Phone, Mail, MapPin, Calendar, Clock,
    Sparkles, ShieldCheck, ChevronRight, ChevronLeft, Plus, Copy,
    CheckCircle2, AlertTriangle, ArrowRight, DollarSign, Wrench,
    Volume2, CheckSquare, Square, Layers, Info, Headphones, UserPlus, Search
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { Customer, Vehicle, ServicePackage, Job, Estimate, EstimateLineItem, TaxRate } from '../types';
import { formatDate, getTodayISOString, getFutureDateISOString } from '../core/utils/dateUtils';
import { formatCurrency, formatTitleCase } from '../utils/formatUtils';
import { generateEstimateNumber, generateJobId } from '../core/utils/numberGenerators';
import { generateCustomerId, getCustomerDisplayName } from '../core/utils/customerUtils';
import { lookupVehicleByVRM } from '../services/vehicleLookupService';
import { lookupAddressByPostcode, AddressDetails } from '../services/postcodeLookupService';

export interface ReceptionistBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: 'receptionist' | 'online';
    onJobCreate?: (jobData: Job, estimateData?: Estimate) => void;
    onVehicleAndJobCreate?: (customer: Customer, vehicle: Vehicle, jobData: Job, estimateData?: Estimate) => void;
    onEstimateCreate?: (estimateData: Estimate) => void;
    onVehicleAndEstimateCreate?: (customer: Customer, vehicle: Vehicle, estimateData: Estimate) => void;
}

interface BundleAddon {
    id: string;
    name: string;
    description: string;
    standalonePrice: number;
    bundledPrice: number;
    laborHours: number;
    isLabor: boolean;
    reason: string;
    script: string;
    recommendedIf?: (age: number, mileage: number, fuelType?: string) => boolean;
}

const BUNDLE_ADDONS: BundleAddon[] = [
    {
        id: 'brake-fluid',
        name: 'Brake Fluid System Flush',
        description: 'Complete high-temp DOT4 fluid pressure flush & bleed',
        standalonePrice: 95.00,
        bundledPrice: 75.00,
        laborHours: 0.8,
        isLabor: true,
        reason: 'Wheels & undertrays are already removed during service, saving 20% in labor time.',
        script: 'We normally charge £95 for a standalone Brake Fluid Change, but if we do it today alongside your service, we can bundle it together for just £75 because the wheels are already off.',
        recommendedIf: (age) => age >= 2,
    },
    {
        id: 'mot-test',
        name: 'Official DVSA MOT Test (Class 4)',
        description: 'Official annual safety, roadworthiness & emissions inspection',
        standalonePrice: 54.85,
        bundledPrice: 45.00,
        laborHours: 1.0,
        isLabor: true,
        reason: 'Combining MOT with servicing minimizes vehicle downtime and diagnostic prep.',
        script: 'Would you like us to carry out the MOT at the same time? We can bundle the MOT inspection alongside your service today for only £45.',
        recommendedIf: (age) => age >= 3,
    },
    {
        id: 'air-con-regas',
        name: 'Air Con Anti-Bacterial Sanitisation & Regas',
        description: 'Deep cabin evaporator sanitise, gas top-up & refrigerant pressure test',
        standalonePrice: 99.00,
        bundledPrice: 79.00,
        laborHours: 0.6,
        isLabor: true,
        reason: 'Protects compressor health and eliminates cabin odours while pollen filter is changed.',
        script: 'We also recommend our Air Conditioning deep cleanse and regas. It is normally £99, but we can do it alongside your cabin filter service for just £79.',
        recommendedIf: (age) => age >= 2,
    },
    {
        id: 'coolant-flush',
        name: 'Engine Coolant & Antifreeze Flush',
        description: 'Full cooling system drain, reverse flush & long-life OAT coolant renewal',
        standalonePrice: 89.00,
        bundledPrice: 69.00,
        laborHours: 0.8,
        isLabor: true,
        reason: 'Engine is already up to operating temp on the ramp; saves setup time.',
        script: 'Coolant corrosion inhibitors break down every 3 to 4 years. We can flush and renew your long-life antifreeze today for just £69 instead of £89.',
        recommendedIf: (age) => age >= 4,
    },
    {
        id: 'wiper-blades',
        name: 'Bosch Aerotwin Wiper Blades (Front Pair)',
        description: 'Premium OEM silicone wipers fitted and washer jets recalibrated',
        standalonePrice: 45.00,
        bundledPrice: 35.00,
        laborHours: 0.1,
        isLabor: false,
        reason: 'Fitted free of labor charges when combined with scheduled service.',
        script: 'We can fit a brand-new set of Bosch Aerotwin front wiper blades today for just £35 all-in with zero fitting charge.',
        recommendedIf: (age) => age >= 1,
    }
];

export const ReceptionistBookingModal: React.FC<ReceptionistBookingModalProps> = ({
    isOpen,
    onClose,
    initialMode = 'receptionist',
    onJobCreate,
    onVehicleAndJobCreate,
    onEstimateCreate,
    onVehicleAndEstimateCreate
}) => {
    const { customers, vehicles, servicePackages, jobs, estimates, businessEntities, taxRates } = useData();
    const { selectedEntityId, currentUser } = useApp();

    const selectedEntity = useMemo(() =>
        businessEntities.find(e => e.id === selectedEntityId) || businessEntities[0] || { id: 'default', name: 'Brookspeed', shortCode: 'BRK', laborRate: 95 },
        [businessEntities, selectedEntityId]
    );

    const standardTaxRate = useMemo(() =>
        taxRates.find(t => t.code === 'T1')?.rate ?? 20,
        [taxRates]
    );

    // Navigation & Mode
    const [mode, setMode] = useState<'receptionist' | 'online'>((initialMode as 'receptionist' | 'online') || 'receptionist');
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

    // Step 1: Customer & Vehicle State
    const [clientType, setClientType] = useState<'existing' | 'new'>('existing');
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

    // New Client fields
    const [newForename, setNewForename] = useState('');
    const [newSurname, setNewSurname] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPostcode, setNewPostcode] = useState('');
    const [newAddressLine1, setNewAddressLine1] = useState('');
    const [newCity, setNewCity] = useState('');
    const [addressOptions, setAddressOptions] = useState<AddressDetails[]>([]);
    const [isPostcodeLoading, setIsPostcodeLoading] = useState(false);

    // Vehicle fields (New or Lookup)
    const [vrmInput, setVrmInput] = useState('');
    const [isVrmLoading, setIsVrmLoading] = useState(false);
    const [vrmLookupError, setVrmLookupError] = useState('');
    const [vehicleDetails, setVehicleDetails] = useState<Partial<Vehicle>>({});
    const [currentMileage, setCurrentMileage] = useState<number>(36000);

    // Step 2: Service Matching State
    const [selectedTier, setSelectedTier] = useState<'bronze' | 'silver' | 'gold'>('bronze');

    // Step 3: Bundle & Upsell State
    const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

    // Step 4: Booking Details State
    const [bookingDate, setBookingDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return formatDate(d);
    });
    const [bookingNotes, setBookingNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [copiedScript, setCopiedScript] = useState<string | null>(null);

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setMode((initialMode as 'receptionist' | 'online') || 'receptionist');
            setCurrentStep(1);
            setClientType('existing');
            setCustomerSearch('');
            setSelectedCustomer(null);
            setSelectedVehicle(null);
            setVrmInput('');
            setVehicleDetails({});
            setSelectedTier('bronze');
            setSelectedAddonIds([]);
            setVrmLookupError('');
        }
    }, [isOpen, initialMode]);

    // Computed customer search matches
    const customerSearchResults = useMemo(() => {
        if (!customerSearch.trim() || customerSearch.length < 2) return [];
        const term = customerSearch.toLowerCase();
        return customers.filter(c => {
            const name = `${c.forename || ''} ${c.surname || ''}`.toLowerCase();
            const phone = (c.phone || '').toLowerCase();
            const email = (c.email || '').toLowerCase();
            return name.includes(term) || phone.includes(term) || email.includes(term);
        }).slice(0, 6);
    }, [customerSearch, customers]);

    // Computed vehicles for selected customer
    const customerVehicles = useMemo(() => {
        if (!selectedCustomer) return [];
        return vehicles.filter(v => v.customerId === selectedCustomer.id);
    }, [selectedCustomer, vehicles]);

    // Active vehicle representation
    const activeVehicle = useMemo(() => {
        if (clientType === 'existing' && selectedVehicle) {
            return selectedVehicle;
        }
        return {
            ...vehicleDetails,
            registration: vrmInput.toUpperCase().replace(/\s/g, ''),
            mileage: currentMileage
        } as Partial<Vehicle>;
    }, [clientType, selectedVehicle, vehicleDetails, vrmInput, currentMileage]);

    // Vehicle age calculation
    const vehicleAge = useMemo(() => {
        const year = activeVehicle?.year || (activeVehicle?.manufactureDate ? new Date(activeVehicle.manufactureDate).getFullYear() : null);
        if (!year) return 3; // sensible default
        const currentYear = new Date().getFullYear();
        return Math.max(0, currentYear - year);
    }, [activeVehicle]);

    // Handle VRM Lookup
    const handleVrmLookup = async (vrmToLookup?: string) => {
        const vrm = (vrmToLookup || vrmInput).trim().toUpperCase().replace(/\s/g, '');
        if (!vrm) return;
        setIsVrmLoading(true);
        setVrmLookupError('');

        try {
            const lookup = await lookupVehicleByVRM(vrm);
            setVehicleDetails(lookup);
            setVrmInput(vrm);
            toast.success(`Vehicle identified: ${lookup.make} ${lookup.model} (${lookup.year || 'N/A'})`);
        } catch (err: any) {
            console.error('VRM Lookup failed:', err);
            setVrmLookupError('Vehicle lookup failed or registration not found. You can enter details manually.');
        } finally {
            setIsVrmLoading(false);
        }
    };

    // Handle Postcode Lookup
    const handlePostcodeLookup = async () => {
        const pc = newPostcode.trim();
        if (!pc) return;
        setIsPostcodeLoading(true);
        try {
            const results = await lookupAddressByPostcode(pc);
            setAddressOptions(results);
            if (results.length === 1) {
                setNewAddressLine1(results[0].street || results[0].summaryAddress);
                setNewCity(results[0].postTown || '');
            } else if (results.length > 1) {
                toast.info(`Found ${results.length} addresses. Please select from the dropdown.`);
            }
        } catch (err: any) {
            console.error('Postcode lookup failed:', err);
            toast.error('Postcode lookup failed. Please enter the address manually.');
        } finally {
            setIsPostcodeLoading(false);
        }
    };

    // Copy to clipboard helper for receptionist scripts
    const handleCopyScript = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedScript(id);
        toast.success('Script copied to clipboard!');
        setTimeout(() => setCopiedScript(null), 2500);
    };

    // Service Tiers Definition with Baseline Matching
    const serviceTiers = useMemo(() => {
        const make = activeVehicle?.make || '';
        const model = activeVehicle?.model || '';
        const cc = activeVehicle?.cc || 2000;

        // Pricing multipliers based on engine cc / premium make
        const isPremium = /porsche|ferrari|mclaren|lamborghini|aston|bentley/i.test(make);
        const engineFactor = cc > 3000 ? 1.35 : cc > 2000 ? 1.15 : 1.0;
        const brandFactor = isPremium ? 1.4 : 1.0;

        const bronzeGross = Math.round(189 * engineFactor * brandFactor);
        const silverGross = Math.round(299 * engineFactor * brandFactor);
        const goldGross = Math.round(469 * engineFactor * brandFactor);

        return {
            bronze: {
                id: 'bronze',
                name: 'Bronze (Minor Service)',
                subtitle: 'Essential Care & Lubrication',
                priceGross: bronzeGross,
                hours: 1.5,
                tag: 'Baseline Entry-Level',
                tagColor: 'bg-amber-100 text-amber-900 border-amber-300',
                highlights: [
                    'Engine oil & premium OEM filter replacement',
                    'Essential fluid level top-ups (brake, coolant, washer)',
                    'Comprehensive 35-point safety check',
                    'Tyre pressure & tread depth inspection',
                    'Reset service interval indicator'
                ]
            },
            silver: {
                id: 'silver',
                name: 'Silver (Interim Service)',
                subtitle: 'Bronze + Electrical, Brakes & Pollen Filter',
                priceGross: silverGross,
                hours: 2.5,
                tag: 'Recommended (Most Popular)',
                tagColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
                highlights: [
                    'All Bronze Minor Service items included',
                    'Wheels-off brake pad, disc & caliper inspection',
                    'Steering & suspension linkage condition check',
                    'Cabin pollen/microfilter replacement',
                    'Battery test & alternator charging rate check',
                    'Exhaust system & underbody structural inspection'
                ]
            },
            gold: {
                id: 'gold',
                name: 'Gold (Major Service)',
                subtitle: 'Silver + Air Filter, Spark Plugs & Deep Inspection',
                priceGross: goldGross,
                hours: 4.0,
                tag: 'Ultimate Protection',
                tagColor: 'bg-yellow-100 text-yellow-900 border-yellow-400',
                highlights: [
                    'All Bronze & Silver Service items included',
                    'Engine air filter element replacement',
                    activeVehicle?.fuelType?.toLowerCase().includes('diesel')
                        ? 'Fuel filter renewal (diesel engines)'
                        : 'High-performance spark plugs replacement',
                    'Brake fluid boiling point & moisture test',
                    'Coolant hydrometer freeze-point inspection',
                    'Auxiliary drive belt tension & wear check',
                    'Diagnostic fault code memory scan & health report'
                ]
            }
        };
    }, [activeVehicle]);

    // Active selected tier object
    const currentTierData = serviceTiers[selectedTier];

    // Selected Add-ons
    const activeAddons = useMemo(() =>
        BUNDLE_ADDONS.filter(addon => selectedAddonIds.includes(addon.id)),
        [selectedAddonIds]
    );

    // Pricing calculation
    const pricingSummary = useMemo(() => {
        const tierGross = currentTierData.priceGross;
        const addonsGross = activeAddons.reduce((sum, a) => sum + a.bundledPrice, 0);
        const totalGross = tierGross + addonsGross;

        // Calculate standalone price to show total customer savings
        const standaloneAddons = activeAddons.reduce((sum, a) => sum + a.standalonePrice, 0);
        const totalSavings = standaloneAddons - addonsGross;

        const vatFactor = 1 + (standardTaxRate / 100);
        const totalNet = totalGross / vatFactor;
        const totalVat = totalGross - totalNet;

        const totalHours = currentTierData.hours + activeAddons.reduce((sum, a) => sum + a.laborHours, 0);

        return {
            tierGross,
            addonsGross,
            totalGross,
            totalNet,
            totalVat,
            totalSavings,
            totalHours
        };
    }, [currentTierData, activeAddons, standardTaxRate]);

    // Upsell triggers recommendations
    const recommendedTier = useMemo(() => {
        if (vehicleAge >= 4 || currentMileage >= 40000) return 'gold';
        if (vehicleAge >= 2 || currentMileage >= 20000) return 'silver';
        return 'bronze';
    }, [vehicleAge, currentMileage]);

    const toggleAddon = (id: string) => {
        setSelectedAddonIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    // Step 4: Submission Handlers
    const handleConfirmBooking = async (createMode: 'job' | 'estimate') => {
        if (!selectedCustomer && clientType === 'existing') {
            toast.error('Please select an existing customer or switch to New Client.');
            return;
        }

        if (clientType === 'new' && (!newForename.trim() || !newSurname.trim())) {
            toast.error('Please provide customer name.');
            return;
        }

        const vrm = (activeVehicle.registration || vrmInput).toUpperCase().replace(/\s/g, '');
        if (!vrm) {
            toast.error('Please enter a valid vehicle registration.');
            return;
        }

        setIsSaving(true);
        try {
            const entityShortCode = selectedEntity.shortCode || 'BRK';

            // Resolve or create Customer
            let finalCustomer: Customer;
            let isNewCustomer = false;

            if (clientType === 'existing' && selectedCustomer) {
                finalCustomer = selectedCustomer;
            } else {
                isNewCustomer = true;
                const newCustId = generateCustomerId(newSurname.trim(), customers);
                finalCustomer = {
                    id: newCustId,
                    forename: formatTitleCase(newForename.trim()),
                    surname: formatTitleCase(newSurname.trim()),
                    phone: newPhone.trim(),
                    email: newEmail.trim(),
                    address: newAddressLine1.trim(),
                    city: formatTitleCase(newCity.trim()),
                    postcode: newPostcode.toUpperCase().trim(),
                    createdDate: getTodayISOString(),
                    searchField: `${newForename} ${newSurname} ${newPhone} ${newEmail}`.toLowerCase()
                };
            }

            // Resolve or create Vehicle
            let finalVehicle: Vehicle;
            let isNewVehicle = false;

            if (clientType === 'existing' && selectedVehicle) {
                finalVehicle = {
                    ...selectedVehicle,
                    mileage: currentMileage || selectedVehicle.mileage
                };
            } else {
                isNewVehicle = true;
                finalVehicle = {
                    id: `VEH-${vrm}-${Date.now().toString().slice(-4)}`,
                    registration: vrm,
                    customerId: finalCustomer.id,
                    make: formatTitleCase(activeVehicle.make || 'Unknown Make'),
                    model: formatTitleCase(activeVehicle.model || 'Unknown Model'),
                    year: activeVehicle.year || new Date().getFullYear(),
                    cc: activeVehicle.cc,
                    fuelType: activeVehicle.fuelType || 'Petrol',
                    colour: activeVehicle.colour || 'Silver',
                    vin: activeVehicle.vin || '',
                    mileage: currentMileage,
                    nextMotDate: activeVehicle.nextMotDate || '',
                    searchField: `${vrm} ${activeVehicle.make || ''} ${activeVehicle.model || ''}`.toLowerCase()
                };
            }

            // Build Line Items
            const lineItems: EstimateLineItem[] = [];

            // 1. Baseline Service Tier Line Item
            lineItems.push({
                id: crypto.randomUUID(),
                description: `${currentTierData.name} - ${finalVehicle.make} ${finalVehicle.model}`,
                quantity: currentTierData.hours,
                unitPrice: Math.round((currentTierData.priceGross / (1 + (standardTaxRate / 100)) / currentTierData.hours) * 100) / 100,
                isLabor: true,
                isPackage: true,
                servicePackageName: currentTierData.name
            });

            // 2. Bundled Addons
            activeAddons.forEach(addon => {
                const netAddonPrice = Math.round((addon.bundledPrice / (1 + (standardTaxRate / 100))) * 100) / 100;
                lineItems.push({
                    id: crypto.randomUUID(),
                    description: `[Done Together Bundle] ${addon.name}`,
                    quantity: 1,
                    unitPrice: netAddonPrice,
                    isLabor: addon.isLabor,
                    isOptional: false,
                    notes: `Discounted bundle price (£${addon.bundledPrice.toFixed(2)} vs £${addon.standalonePrice.toFixed(2)} standalone)`
                } as any);
            });

            // Create Estimate
            const newEstimateNumber = generateEstimateNumber(estimates, entityShortCode);
            const newEstimate: Estimate = {
                id: `EST-${newEstimateNumber}`,
                estimateNumber: newEstimateNumber,
                vehicleId: finalVehicle.id,
                customerId: finalCustomer.id,
                entityId: selectedEntity.id,
                issueDate: getTodayISOString(),
                expiryDate: getFutureDateISOString(30),
                status: createMode === 'job' ? 'Converted to Job' : 'Draft',
                lineItems,
                description: `${currentTierData.name} + ${activeAddons.length} Bundle Items`,
                notes: bookingNotes ? `${bookingNotes}\n\n[Booking Assistant: Created via ${mode === 'receptionist' ? 'Receptionist' : 'Customer'} flow]` : `[Booking Assistant: Created via ${mode === 'receptionist' ? 'Receptionist' : 'Customer'} flow]`,
                createdByUserId: currentUser.id
            };

            // If Job Mode, Create Job
            if (createMode === 'job') {
                const newJobId = generateJobId(jobs, entityShortCode);
                const newJob: Job = {
                    id: newJobId,
                    entityId: selectedEntity.id,
                    vehicleId: finalVehicle.id,
                    customerId: finalCustomer.id,
                    description: `${currentTierData.name} (${finalVehicle.make} ${finalVehicle.model} - ${finalVehicle.registration})`,
                    estimatedHours: pricingSummary.totalHours,
                    scheduledDate: bookingDate,
                    status: 'Booked In',
                    createdAt: getTodayISOString(),
                    createdByUserId: currentUser.id,
                    estimateId: newEstimate.id,
                    notes: bookingNotes,
                    mileage: currentMileage,
                    segments: []
                };

                if (isNewVehicle && onVehicleAndJobCreate) {
                    onVehicleAndJobCreate(finalCustomer, finalVehicle, newJob, newEstimate);
                } else if (onJobCreate) {
                    onJobCreate(newJob, newEstimate);
                }
                toast.success(`Booking confirmed for ${bookingDate}! Job ${newJobId} created.`);
            } else {
                if (isNewVehicle && onVehicleAndEstimateCreate) {
                    onVehicleAndEstimateCreate(finalCustomer, finalVehicle, newEstimate);
                } else if (onEstimateCreate) {
                    onEstimateCreate(newEstimate);
                }
                toast.success(`Formal Estimate ${newEstimate.id} created successfully.`);
            }

            onClose();
        } catch (err: any) {
            console.error('Failed to create booking/estimate:', err);
            toast.error('An error occurred while creating the record.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border border-gray-200">

                {/* MODAL HEADER WITH DUAL MODE SWITCH */}
                <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-indigo-900 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600/40 rounded-xl border border-indigo-400/30 text-indigo-300">
                            <Headphones size={24} className="text-indigo-200" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold tracking-tight text-white">Intelligent Booking Assistant</h2>
                                <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${mode === 'receptionist' ? 'bg-amber-400 text-amber-950' : 'bg-emerald-400 text-emerald-950'
                                    }`}>
                                    {mode === 'receptionist' ? 'Receptionist Mode' : 'Customer Mode'}
                                </span>
                            </div>
                            <p className="text-xs text-indigo-200">
                                {mode === 'receptionist'
                                    ? 'Internal call scripting, live VRM lookup, and "Done Together" upselling guidance'
                                    : 'Frictionless, customer-facing package selection and booking portal'}
                            </p>
                        </div>
                    </div>

                    {/* Mode Toggle Switch */}
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700 flex items-center shadow-inner">
                            <button
                                onClick={() => setMode('receptionist')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${mode === 'receptionist'
                                    ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                                    : 'text-slate-300 hover:text-white'
                                    }`}
                            >
                                <Headphones size={14} />
                                Receptionist Mode
                            </button>
                            <button
                                onClick={() => setMode('online')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${mode === 'online'
                                    ? 'bg-emerald-500 text-white shadow-md font-black'
                                    : 'text-slate-300 hover:text-white'
                                    }`}
                            >
                                <User size={14} />
                                Online Customer Mode
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </header>

                {/* WORKFLOW STEPPER BAR */}
                <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs font-medium text-slate-600 flex-shrink-0">
                    <div className="flex items-center gap-1 sm:gap-2">
                        {[
                            { num: 1, title: '1. Client & Vehicle' },
                            { num: 2, title: '2. Service Matching' },
                            { num: 3, title: '3. Upsell & Bundles' },
                            { num: 4, title: '4. Date & Confirm' }
                        ].map((s, idx) => (
                            <React.Fragment key={s.num}>
                                <button
                                    onClick={() => setCurrentStep(s.num as any)}
                                    className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${currentStep === s.num
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : currentStep > s.num
                                            ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                                            : 'text-slate-500 hover:bg-slate-200'
                                        }`}
                                >
                                    {currentStep > s.num ? <Check size={13} className="text-indigo-600" /> : null}
                                    {s.title}
                                </button>
                                {idx < 3 && <ChevronRight size={14} className="text-slate-400" />}
                            </React.Fragment>
                        ))}
                    </div>

                    {activeVehicle?.registration && (
                        <div className="hidden sm:flex items-center gap-2 bg-yellow-300/30 text-yellow-900 border border-yellow-400/40 px-2.5 py-1 rounded-md font-mono text-xs font-bold">
                            <Car size={14} />
                            <span>{activeVehicle.registration}</span>
                            {activeVehicle.make && <span>• {activeVehicle.make} {activeVehicle.model}</span>}
                        </div>
                    )}
                </div>

                {/* MAIN CONTENT BODY */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">

                    {/* ======================================================== */}
                    {/* STEP 1: CLIENT IDENTIFICATION & VEHICLE VERIFICATION     */}
                    {/* ======================================================== */}
                    {currentStep === 1 && (
                        <div className="space-y-6 max-w-4xl mx-auto">

                            {/* RECEPTIONIST SCRIPT / GUIDANCE HEADER */}
                            {mode === 'receptionist' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* What to Say */}
                                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-sm relative">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                                                <Volume2 size={16} className="text-amber-700" />
                                                [What to Say to Customer]
                                            </span>
                                            <button
                                                onClick={() => handleCopyScript(`"Good morning, thank you for calling ${selectedEntity.name}. My name is ${currentUser.name}. I'd be delighted to assist you with your vehicle booking today. May I start with your full name or vehicle registration, please?"`, 'step1-script')}
                                                className="text-amber-800 hover:text-amber-950 p-1 text-xs flex items-center gap-1 hover:bg-amber-200 rounded transition"
                                                title="Copy script"
                                            >
                                                {copiedScript === 'step1-script' ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                                                <span className="text-[10px] font-bold">Copy</span>
                                            </button>
                                        </div>
                                        <p className="text-sm italic text-amber-950 leading-relaxed font-serif">
                                            &ldquo;Good morning, thank you for calling {selectedEntity.name}. My name is {currentUser.name}. I&apos;d be delighted to assist you with your vehicle booking today. May I start with your full name or vehicle registration, please?&rdquo;
                                        </p>
                                    </div>

                                    {/* Behind the Scenes Action */}
                                    <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 shadow-sm">
                                        <span className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5 mb-2">
                                            <Wrench size={16} className="text-blue-700" />
                                            [Behind the Scenes - Action Required]
                                        </span>
                                        <ul className="text-xs text-blue-950 space-y-1.5 list-disc pl-4">
                                            <li>Check if customer or vehicle exists in the database below.</li>
                                            <li><strong>Existing:</strong> Confirm vehicle details & address on file.</li>
                                            <li><strong>New:</strong> Input Registration for instant UK DVLA lookup and ask for current approximate mileage.</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Client Type Selector */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                        <User size={18} className="text-indigo-600" />
                                        Step 1: Client Verification
                                    </h3>
                                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                        <button
                                            type="button"
                                            onClick={() => setClientType('existing')}
                                            className={`px-3 py-1 rounded text-xs font-bold transition ${clientType === 'existing' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            Existing Client
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setClientType('new')}
                                            className={`px-3 py-1 rounded text-xs font-bold transition ${clientType === 'new' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            + New Client
                                        </button>
                                    </div>
                                </div>

                                {clientType === 'existing' ? (
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Search customer by name, phone number, or email..."
                                                value={customerSearch}
                                                onChange={(e) => setCustomerSearch(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>

                                        {customerSearchResults.length > 0 && (
                                            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                                                {customerSearchResults.map(cust => (
                                                    <div
                                                        key={cust.id}
                                                        onClick={() => {
                                                            setSelectedCustomer(cust);
                                                            setCustomerSearch(getCustomerDisplayName(cust));
                                                            // Auto-select first vehicle if exists
                                                            const v = vehicles.find(veh => veh.customerId === cust.id);
                                                            if (v) {
                                                                setSelectedVehicle(v);
                                                                setVrmInput(v.registration);
                                                                if (v.mileage) setCurrentMileage(v.mileage);
                                                            }
                                                        }}
                                                        className={`p-3 cursor-pointer hover:bg-indigo-50/60 flex items-center justify-between transition ${selectedCustomer?.id === cust.id ? 'bg-indigo-50 font-semibold' : ''}`}
                                                    >
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800">{getCustomerDisplayName(cust)}</div>
                                                            <div className="text-xs text-slate-500">{cust.phone || 'No phone'} • {cust.email || 'No email'} • {cust.postcode || 'No postcode'}</div>
                                                        </div>
                                                        {selectedCustomer?.id === cust.id && <CheckCircle2 size={18} className="text-indigo-600" />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {selectedCustomer && (
                                            <div className="bg-indigo-50/60 border border-indigo-200 rounded-lg p-3.5 text-xs text-indigo-950 flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <span className="font-bold text-sm block text-indigo-900">{getCustomerDisplayName(selectedCustomer)}</span>
                                                    <span>{selectedCustomer.address}, {selectedCustomer.postcode}</span>
                                                    <span className="mx-2">•</span>
                                                    <span>{selectedCustomer.phone}</span>
                                                </div>
                                                <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded font-bold text-[11px]">
                                                    Verified Record
                                                </span>
                                            </div>
                                        )}

                                        {/* Existing Customer Vehicles */}
                                        {selectedCustomer && (
                                            <div className="pt-2">
                                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                                    Select Customer Vehicle On File:
                                                </label>
                                                {customerVehicles.length > 0 ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {customerVehicles.map(v => (
                                                            <div
                                                                key={v.id}
                                                                onClick={() => {
                                                                    setSelectedVehicle(v);
                                                                    setVrmInput(v.registration);
                                                                    if (v.mileage) setCurrentMileage(v.mileage);
                                                                }}
                                                                className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition ${selectedVehicle?.id === v.id
                                                                    ? 'border-indigo-600 bg-indigo-50/80 shadow-xs'
                                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                                                    }`}
                                                            >
                                                                <div>
                                                                    <div className="font-mono font-black text-sm text-slate-900">{v.registration}</div>
                                                                    <div className="text-xs text-slate-600">{v.make} {v.model} ({v.year || 'N/A'})</div>
                                                                </div>
                                                                {selectedVehicle?.id === v.id && <CheckCircle2 size={18} className="text-indigo-600" />}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded border border-slate-200">
                                                        No vehicle currently linked to this customer. Please enter registration below.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* NEW CLIENT FORM */
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">First Name *</label>
                                            <input
                                                type="text"
                                                value={newForename}
                                                onChange={e => setNewForename(e.target.value)}
                                                placeholder="e.g. James"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Surname *</label>
                                            <input
                                                type="text"
                                                value={newSurname}
                                                onChange={e => setNewSurname(e.target.value)}
                                                placeholder="e.g. Wilson"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Phone</label>
                                            <input
                                                type="tel"
                                                value={newPhone}
                                                onChange={e => setNewPhone(e.target.value)}
                                                placeholder="e.g. 07700 900123"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                                            <input
                                                type="email"
                                                value={newEmail}
                                                onChange={e => setNewEmail(e.target.value)}
                                                placeholder="e.g. james.wilson@example.com"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Postcode & Address Lookup</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newPostcode}
                                                    onChange={e => setNewPostcode(e.target.value)}
                                                    placeholder="e.g. SO14 0AE"
                                                    className="w-36 uppercase font-mono px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handlePostcodeLookup}
                                                    disabled={isPostcodeLoading || !newPostcode.trim()}
                                                    className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 disabled:opacity-50"
                                                >
                                                    {isPostcodeLoading ? 'Looking up...' : 'Find Address'}
                                                </button>
                                            </div>

                                            {addressOptions.length > 0 && (
                                                <select
                                                    className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                                    onChange={(e) => {
                                                        const idx = parseInt(e.target.value, 10);
                                                        if (!isNaN(idx) && addressOptions[idx]) {
                                                            const addr = addressOptions[idx];
                                                            setNewAddressLine1(addr.street || addr.summaryAddress);
                                                            setNewCity(addr.postTown || '');
                                                        }
                                                    }}
                                                >
                                                    <option value="">Select address from {addressOptions.length} results...</option>
                                                    {addressOptions.map((opt, i) => (
                                                        <option key={i} value={i}>{opt.summaryAddress}</option>
                                                    ))}
                                                </select>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                                <input
                                                    type="text"
                                                    value={newAddressLine1}
                                                    onChange={e => setNewAddressLine1(e.target.value)}
                                                    placeholder="Street Address"
                                                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                                                />
                                                <input
                                                    type="text"
                                                    value={newCity}
                                                    onChange={e => setNewCity(e.target.value)}
                                                    placeholder="Town / City"
                                                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* VEHICLE IDENTIFICATION & UK DVLA LOOKUP CARD */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <Car size={18} className="text-amber-500" />
                                        Vehicle Registration & DVLA Lookup
                                    </span>
                                    {activeVehicle.year && (
                                        <span className="text-xs bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-mono font-bold">
                                            Age: {vehicleAge} {vehicleAge === 1 ? 'Year' : 'Years'} Old
                                        </span>
                                    )}
                                </h3>

                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="REG NUMBER (VRN)"
                                            value={vrmInput}
                                            onChange={e => setVrmInput(e.target.value.toUpperCase())}
                                            onKeyDown={e => { if (e.key === 'Enter') handleVrmLookup(); }}
                                            className="px-3 py-2 bg-yellow-300/40 text-slate-900 border-2 border-yellow-400 font-mono font-black text-sm uppercase rounded-lg w-44 tracking-widest outline-none focus:ring-2 focus:ring-yellow-500"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleVrmLookup()}
                                        disabled={isVrmLoading || !vrmInput.trim()}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        <Sparkles size={14} />
                                        {isVrmLoading ? 'Looking up DVLA...' : 'Lookup Vehicle'}
                                    </button>

                                    <div className="flex items-center gap-2 ml-auto">
                                        <label className="text-xs font-bold text-slate-700">Current Mileage:</label>
                                        <input
                                            type="number"
                                            value={currentMileage}
                                            onChange={e => setCurrentMileage(parseInt(e.target.value, 10) || 0)}
                                            className="w-28 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-right"
                                        />
                                        <span className="text-xs text-slate-500 font-bold">miles</span>
                                    </div>
                                </div>

                                {vrmLookupError && (
                                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                                        {vrmLookupError}
                                    </p>
                                )}

                                {/* Live Vehicle Profile Preview */}
                                {(activeVehicle.make || activeVehicle.model) && (
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                        <div>
                                            <span className="text-slate-400 block text-[10px] font-bold uppercase">Make & Model</span>
                                            <span className="font-bold text-slate-900 text-sm">{activeVehicle.make} {activeVehicle.model}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px] font-bold uppercase">Year / Engine</span>
                                            <span className="font-semibold text-slate-800">{activeVehicle.year || 'N/A'} • {activeVehicle.cc ? `${(activeVehicle.cc / 1000).toFixed(1)}L (${activeVehicle.cc}cc)` : 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px] font-bold uppercase">Fuel Type</span>
                                            <span className="font-semibold text-slate-800">{activeVehicle.fuelType || 'Petrol'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px] font-bold uppercase">MOT Status</span>
                                            <span className="font-semibold text-slate-800">{activeVehicle.nextMotDate ? `Due ${activeVehicle.nextMotDate}` : 'Valid'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* NEXT STEP BUTTON */}
                            <div className="flex justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(2)}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center gap-2"
                                >
                                    Proceed to Service Matching
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}


                    {/* ======================================================== */}
                    {/* STEP 2: VEHICLE-SPECIFIC SERVICE MATCHING                */}
                    {/* ======================================================== */}
                    {currentStep === 2 && (
                        <div className="space-y-6 max-w-5xl mx-auto">

                            {/* RECEPTIONIST SCRIPT FOR PRESENTING TIERS */}
                            {mode === 'receptionist' && (
                                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                                            <Volume2 size={16} className="text-amber-700" />
                                            [What to Say: Baseline Presentation Strategy]
                                        </span>
                                        <button
                                            onClick={() => handleCopyScript(`"To ensure your ${activeVehicle.make || 'vehicle'} receives the right care, our baseline service is our Bronze Minor Service from ${formatCurrency(serviceTiers.bronze.priceGross)}. Depending on its mileage of ${currentMileage.toLocaleString()} miles, we also offer our comprehensive Silver Interim and Gold Major services which include full suspension, brake teardowns, and spark plug renewals."`, 'step2-script')}
                                            className="text-amber-800 hover:text-amber-950 p-1 text-xs flex items-center gap-1 hover:bg-amber-200 rounded transition"
                                        >
                                            {copiedScript === 'step2-script' ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                                            <span className="text-[10px] font-bold">Copy Script</span>
                                        </button>
                                    </div>
                                    <p className="text-sm italic text-amber-950 font-serif leading-relaxed">
                                        &ldquo;To ensure your {activeVehicle.make || 'vehicle'} receives the right care, our baseline service is our <strong>Bronze Minor Service from {formatCurrency(serviceTiers.bronze.priceGross)}</strong>. Depending on its mileage of {currentMileage.toLocaleString()} miles, we also offer our comprehensive <strong>Silver Interim</strong> and <strong>Gold Major</strong> services which include full suspension, brake teardowns, and filter renewals.&rdquo;
                                    </p>
                                </div>
                            )}

                            {/* TIER CARDS: BRONZE -> SILVER -> GOLD */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                        <Layers size={20} className="text-indigo-600" />
                                        Vehicle-Specific Service Packages
                                    </h3>
                                    <span className="text-xs text-slate-500">
                                        Matched for: <strong>{activeVehicle.make || 'Vehicle'} {activeVehicle.model || ''}</strong>
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* BRONZE */}
                                    <div
                                        onClick={() => setSelectedTier('bronze')}
                                        className={`rounded-2xl p-5 border-2 cursor-pointer transition-all flex flex-col justify-between ${selectedTier === 'bronze'
                                            ? 'border-amber-500 bg-amber-50/40 shadow-lg ring-2 ring-amber-400/20'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${serviceTiers.bronze.tagColor}`}>
                                                    {serviceTiers.bronze.tag}
                                                </span>
                                                <span className="text-xs text-slate-400 font-semibold">{serviceTiers.bronze.hours} hrs</span>
                                            </div>
                                            <h4 className="font-black text-lg text-slate-900">{serviceTiers.bronze.name}</h4>
                                            <p className="text-xs text-slate-500 mb-4">{serviceTiers.bronze.subtitle}</p>

                                            <div className="text-2xl font-black text-slate-900 mb-4 font-mono">
                                                {formatCurrency(serviceTiers.bronze.priceGross)}
                                                <span className="text-xs font-normal text-slate-500 ml-1">inc VAT</span>
                                            </div>

                                            <div className="space-y-2 text-xs text-slate-700">
                                                {serviceTiers.bronze.highlights.map((h, i) => (
                                                    <div key={i} className="flex items-start gap-2">
                                                        <Check size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                                        <span>{h}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            className={`mt-6 w-full py-2 rounded-xl text-xs font-black transition ${selectedTier === 'bronze'
                                                ? 'bg-amber-500 text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            {selectedTier === 'bronze' ? 'Selected Package' : 'Select Bronze'}
                                        </button>
                                    </div>

                                    {/* SILVER */}
                                    <div
                                        onClick={() => setSelectedTier('silver')}
                                        className={`rounded-2xl p-5 border-2 cursor-pointer transition-all flex flex-col justify-between relative ${selectedTier === 'silver'
                                            ? 'border-indigo-600 bg-indigo-50/40 shadow-lg ring-2 ring-indigo-500/20'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                    >
                                        {recommendedTier === 'silver' && (
                                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black uppercase px-3 py-0.5 rounded-full shadow-sm">
                                                Recommended for Mileage
                                            </span>
                                        )}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${serviceTiers.silver.tagColor}`}>
                                                    {serviceTiers.silver.tag}
                                                </span>
                                                <span className="text-xs text-slate-400 font-semibold">{serviceTiers.silver.hours} hrs</span>
                                            </div>
                                            <h4 className="font-black text-lg text-slate-900">{serviceTiers.silver.name}</h4>
                                            <p className="text-xs text-slate-500 mb-4">{serviceTiers.silver.subtitle}</p>

                                            <div className="text-2xl font-black text-indigo-900 mb-4 font-mono">
                                                {formatCurrency(serviceTiers.silver.priceGross)}
                                                <span className="text-xs font-normal text-slate-500 ml-1">inc VAT</span>
                                            </div>

                                            <div className="space-y-2 text-xs text-slate-700">
                                                {serviceTiers.silver.highlights.map((h, i) => (
                                                    <div key={i} className="flex items-start gap-2">
                                                        <Check size={14} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                                                        <span>{h}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            className={`mt-6 w-full py-2 rounded-xl text-xs font-black transition ${selectedTier === 'silver'
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            {selectedTier === 'silver' ? 'Selected Package' : 'Select Silver'}
                                        </button>
                                    </div>

                                    {/* GOLD */}
                                    <div
                                        onClick={() => setSelectedTier('gold')}
                                        className={`rounded-2xl p-5 border-2 cursor-pointer transition-all flex flex-col justify-between relative ${selectedTier === 'gold'
                                            ? 'border-yellow-500 bg-yellow-50/40 shadow-lg ring-2 ring-yellow-400/20'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                    >
                                        {recommendedTier === 'gold' && (
                                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[10px] font-black uppercase px-3 py-0.5 rounded-full shadow-sm">
                                                Due by Age/Mileage
                                            </span>
                                        )}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${serviceTiers.gold.tagColor}`}>
                                                    {serviceTiers.gold.tag}
                                                </span>
                                                <span className="text-xs text-slate-400 font-semibold">{serviceTiers.gold.hours} hrs</span>
                                            </div>
                                            <h4 className="font-black text-lg text-slate-900">{serviceTiers.gold.name}</h4>
                                            <p className="text-xs text-slate-500 mb-4">{serviceTiers.gold.subtitle}</p>

                                            <div className="text-2xl font-black text-slate-900 mb-4 font-mono">
                                                {formatCurrency(serviceTiers.gold.priceGross)}
                                                <span className="text-xs font-normal text-slate-500 ml-1">inc VAT</span>
                                            </div>

                                            <div className="space-y-2 text-xs text-slate-700">
                                                {serviceTiers.gold.highlights.map((h, i) => (
                                                    <div key={i} className="flex items-start gap-2">
                                                        <Check size={14} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                                                        <span>{h}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            className={`mt-6 w-full py-2 rounded-xl text-xs font-black transition ${selectedTier === 'gold'
                                                ? 'bg-amber-500 text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            {selectedTier === 'gold' ? 'Selected Package' : 'Select Gold'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* NAVIGATION BUTTONS */}
                            <div className="flex justify-between pt-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(1)}
                                    className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-sm transition flex items-center gap-1.5"
                                >
                                    <ChevronLeft size={16} />
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(3)}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center gap-2"
                                >
                                    Proceed to Upsells & Bundles
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}


                    {/* ======================================================== */}
                    {/* STEP 3: UPSELL & BUNDLE LOGIC (EXPANDED GUIDANCE)        */}
                    {/* ======================================================== */}
                    {currentStep === 3 && (
                        <div className="space-y-6 max-w-5xl mx-auto">

                            {/* EXPLICIT [RECEPTIONIST UPSELL GUIDANCE] BLOCK */}
                            {mode === 'receptionist' && (
                                <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 border border-indigo-700/50 shadow-xl space-y-4">
                                    <div className="flex items-center justify-between border-b border-indigo-800/80 pb-3">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="text-amber-400" size={20} />
                                            <h3 className="font-black text-amber-300 text-base uppercase tracking-wider">
                                                [RECEPTIONIST UPSELL GUIDANCE]
                                            </h3>
                                        </div>
                                        <span className="text-[11px] font-mono text-indigo-300">
                                            Internal Strategy • Maximise Order Value
                                        </span>
                                    </div>

                                    {/* 1. Age & Mileage Triggers */}
                                    <div className="bg-indigo-900/40 border border-indigo-700/50 rounded-xl p-3.5 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                                                <Clock size={15} />
                                                1. Age & Mileage Trigger
                                            </span>
                                            <button
                                                onClick={() => handleCopyScript(`"Based on your vehicle being ${vehicleAge} years old with ${currentMileage.toLocaleString()} miles, it is critically due for a ${recommendedTier.toUpperCase()} service interval because spark plugs, microfilters, and air elements reach strict manufacturer lifespan thresholds."`, 'trigger-script')}
                                                className="text-indigo-200 hover:text-white p-1 text-xs flex items-center gap-1 hover:bg-indigo-800 rounded transition"
                                            >
                                                {copiedScript === 'trigger-script' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                                <span className="text-[10px] font-bold">Copy Script</span>
                                            </button>
                                        </div>
                                        <p className="text-xs text-indigo-100 italic font-serif">
                                            &ldquo;Based on this vehicle being <strong>{vehicleAge} years old / {currentMileage.toLocaleString()} miles</strong>, it is due for a <strong>{recommendedTier.toUpperCase()}</strong> service because spark plugs and cabin microfilters are critically required at this interval to safeguard fuel efficiency.&rdquo;
                                        </p>
                                    </div>

                                    {/* 2. Done Together Bundle Efficiencies */}
                                    <div className="bg-indigo-900/40 border border-indigo-700/50 rounded-xl p-3.5 space-y-2">
                                        <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                                            <Wrench size={15} />
                                            2. The &ldquo;Done Together&rdquo; Bundle Discount Rationale
                                        </span>
                                        <p className="text-xs text-indigo-100 leading-relaxed">
                                            Highlight bundle labor efficiencies: When a car is already elevated on a two-post lift with undertrays and wheels off for brake inspection, bleeding the brake fluid or conducting an MOT takes half the logistical setup time. Offer the discounted rate (£75 vs £95) as an exclusive reward for booking together today.
                                        </p>
                                    </div>

                                    {/* 3. Preventative Maintenance Wear-and-Tear Checks */}
                                    <div className="bg-indigo-900/40 border border-indigo-700/50 rounded-xl p-3.5 space-y-2">
                                        <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                                            <AlertTriangle size={15} />
                                            3. Preventative Maintenance Recommendations
                                        </span>
                                        <ul className="text-xs text-indigo-200 space-y-1 list-disc pl-4">
                                            {vehicleAge >= 5 && (
                                                <li><strong className="text-white">Timing / Auxiliary Belts:</strong> Vehicle is {vehicleAge} years old; remind client of rubber degradation and catastrophic valve clash risk.</li>
                                            )}
                                            <li><strong className="text-white">Brake Fluid Moisture:</strong> Fluid is hygroscopic; absorbs 2-3% water every 24 months, which drops the boiling point and lengthens stopping distances.</li>
                                            <li><strong className="text-white">Coolant Additives:</strong> Organic acid technology (OAT) corrosion inhibitors exhaust over 4 years; recommend flush to preserve radiator and water pump seals.</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* BUNDLE ADD-ON CHECKLIST */}
                            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                            <Sparkles size={20} className="text-amber-500" />
                                            &ldquo;Done Together&rdquo; Service Bundles
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Save time and money by combining essential maintenance while the vehicle is already on the ramp.
                                        </p>
                                    </div>
                                    {pricingSummary.totalSavings > 0 && (
                                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 rounded-full text-xs font-black">
                                            Customer Saves £{pricingSummary.totalSavings.toFixed(2)}
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {BUNDLE_ADDONS.map(addon => {
                                        const isSelected = selectedAddonIds.includes(addon.id);
                                        const isRecommended = addon.recommendedIf ? addon.recommendedIf(vehicleAge, currentMileage, activeVehicle.fuelType) : false;

                                        return (
                                            <div
                                                key={addon.id}
                                                onClick={() => toggleAddon(addon.id)}
                                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${isSelected
                                                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`mt-0.5 p-1 rounded-md ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-slate-900 text-sm">{addon.name}</h4>
                                                            {isRecommended && (
                                                                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                    Recommended
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-600 mb-1">{addon.description}</p>

                                                        {mode === 'receptionist' && (
                                                            <div className="mt-2 bg-amber-50 text-amber-950 p-2 rounded-lg text-[11px] font-serif italic border border-amber-200">
                                                                <span className="font-sans font-bold not-italic text-amber-900 block text-[10px] uppercase">Pitch Script:</span>
                                                                &ldquo;{addon.script}&rdquo;
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex md:flex-col items-end justify-between w-full md:w-auto flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                                                    <div className="text-right">
                                                        <span className="text-xs line-through text-slate-400 block font-mono">
                                                            £{addon.standalonePrice.toFixed(2)}
                                                        </span>
                                                        <span className="text-base font-black text-indigo-900 font-mono">
                                                            £{addon.bundledPrice.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mt-1">
                                                        Save £{(addon.standalonePrice - addon.bundledPrice).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* NAVIGATION BUTTONS */}
                            <div className="flex justify-between pt-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(2)}
                                    className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-sm transition flex items-center gap-1.5"
                                >
                                    <ChevronLeft size={16} />
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(4)}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center gap-2"
                                >
                                    Proceed to Confirmation
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}


                    {/* ======================================================== */}
                    {/* STEP 4: DATE SELECTION & BOOKING CONFIRMATION            */}
                    {/* ======================================================== */}
                    {currentStep === 4 && (
                        <div className="space-y-6 max-w-4xl mx-auto">

                            {/* RECEPTIONIST CLOSING SCRIPT */}
                            {mode === 'receptionist' && (
                                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                                            <Volume2 size={16} className="text-amber-700" />
                                            [What to Say: Closing the Booking]
                                        </span>
                                        <button
                                            onClick={() => handleCopyScript(`"Thank you so much. I have reserved ${bookingDate} for your ${activeVehicle.make || 'vehicle'}'s ${currentTierData.name}${activeAddons.length > 0 ? ` with the bundled ${activeAddons.map(a => a.name).join(', ')}` : ''}. We'll send a full booking confirmation to your email. Can we arrange a courtesy vehicle or lift into town for you?"`, 'step4-script')}
                                            className="text-amber-800 hover:text-amber-950 p-1 text-xs flex items-center gap-1 hover:bg-amber-200 rounded transition"
                                        >
                                            {copiedScript === 'step4-script' ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                                            <span className="text-[10px] font-bold">Copy Closing Script</span>
                                        </button>
                                    </div>
                                    <p className="text-sm italic text-amber-950 font-serif leading-relaxed">
                                        &ldquo;Thank you so much. I have reserved <strong>{bookingDate}</strong> for your {activeVehicle.make || 'vehicle'}&apos;s <strong>{currentTierData.name}</strong>{activeAddons.length > 0 ? ` with the bundled ${activeAddons.map(a => a.name).join(', ')}` : ''}. We&apos;ll send a full booking confirmation to your contact details. Can we arrange a courtesy vehicle or lift into town for you?&rdquo;
                                    </p>
                                </div>
                            )}

                            {/* BOOKING SUMMARY REVIEW */}
                            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <ShieldCheck size={18} className="text-emerald-600" />
                                    Booking & Estimate Summary
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                    <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                                        <span className="text-slate-400 font-bold uppercase text-[10px]">Client Details</span>
                                        <div className="font-bold text-slate-900 text-sm">
                                            {selectedCustomer ? getCustomerDisplayName(selectedCustomer) : `${newForename} ${newSurname}`}
                                        </div>
                                        <div className="text-slate-600">{selectedCustomer?.phone || newPhone || 'No phone'}</div>
                                        <div className="text-slate-600">{selectedCustomer?.email || newEmail || 'No email'}</div>
                                        <div className="text-slate-600">{selectedCustomer?.postcode || newPostcode || 'No postcode'}</div>
                                    </div>

                                    <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                                        <span className="text-slate-400 font-bold uppercase text-[10px]">Vehicle Details</span>
                                        <div className="font-bold text-slate-900 text-sm font-mono">
                                            {activeVehicle.registration || vrmInput}
                                        </div>
                                        <div className="text-slate-600">{activeVehicle.make} {activeVehicle.model} ({activeVehicle.year || 'N/A'})</div>
                                        <div className="text-slate-600">Recorded Mileage: <strong>{currentMileage.toLocaleString()} miles</strong></div>
                                        <div className="text-slate-600">Workshop: <strong>{selectedEntity.name}</strong></div>
                                    </div>
                                </div>

                                {/* Order Lines Table */}
                                <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                            <tr>
                                                <th className="py-2.5 px-3 text-left">Package / Service Item</th>
                                                <th className="py-2.5 px-3 text-center">Type</th>
                                                <th className="py-2.5 px-3 text-right">Price (inc VAT)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            <tr>
                                                <td className="py-2.5 px-3 font-bold text-slate-800">
                                                    {currentTierData.name}
                                                </td>
                                                <td className="py-2.5 px-3 text-center text-slate-500">Scheduled Service</td>
                                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                                    {formatCurrency(currentTierData.priceGross)}
                                                </td>
                                            </tr>
                                            {activeAddons.map(a => (
                                                <tr key={a.id} className="bg-indigo-50/30">
                                                    <td className="py-2.5 px-3 text-indigo-950 font-medium">
                                                        [Bundle] {a.name}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center text-indigo-700 font-bold text-[10px]">
                                                        Done Together
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-900">
                                                        {formatCurrency(a.bundledPrice)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                                            <tr>
                                                <td colSpan={2} className="py-2 px-3 text-right text-slate-500">Net Labour & Parts:</td>
                                                <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrency(pricingSummary.totalNet)}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan={2} className="py-2 px-3 text-right text-slate-500">VAT (20%):</td>
                                                <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrency(pricingSummary.totalVat)}</td>
                                            </tr>
                                            <tr className="text-sm bg-indigo-50 text-indigo-950">
                                                <td colSpan={2} className="py-2.5 px-3 text-right font-black">Total Amount Payable:</td>
                                                <td className="py-2.5 px-3 text-right font-mono font-black text-base text-indigo-900">
                                                    {formatCurrency(pricingSummary.totalGross)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Booking Scheduling Date & Notes */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                            <Calendar size={14} className="text-indigo-600" />
                                            Scheduled Booking Date *
                                        </label>
                                        <input
                                            type="date"
                                            value={bookingDate}
                                            onChange={e => setBookingDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Logistics & Customer Special Notes
                                        </label>
                                        <input
                                            type="text"
                                            value={bookingNotes}
                                            onChange={e => setBookingNotes(e.target.value)}
                                            placeholder="e.g. Needs car by 4pm; customer will wait in lounge"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ACTION BUTTONS */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(3)}
                                    className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-sm transition flex items-center gap-1.5"
                                >
                                    <ChevronLeft size={16} />
                                    Back to Bundles
                                </button>

                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={() => handleConfirmBooking('estimate')}
                                        className="px-5 py-2.5 border border-indigo-600 text-indigo-700 hover:bg-indigo-50 rounded-xl font-bold text-sm transition disabled:opacity-50"
                                    >
                                        Save as Formal Estimate
                                    </button>

                                    <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={() => handleConfirmBooking('job')}
                                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <CheckCircle2 size={18} />
                                        {isSaving ? 'Confirming Booking...' : 'Confirm & Create Booking (Job)'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReceptionistBookingModal;

