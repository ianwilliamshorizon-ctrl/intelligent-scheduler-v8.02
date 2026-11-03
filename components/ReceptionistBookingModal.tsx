import React, { useState, useMemo, useEffect } from 'react';
import { 
    X, Check, Car, User, Phone, Mail, MapPin, Calendar, Clock, 
    Sparkles, ShieldCheck, ChevronRight, ChevronLeft, Plus, Copy, 
    CheckCircle2, AlertTriangle, ArrowRight, DollarSign, Wrench, 
    Volume2, CheckSquare, Square, Layers, Info, Headphones, UserPlus, Search,
    CheckCircle, MessageSquare, Bell, FileText, Gauge, CalendarCheck, AlertCircle, RefreshCw, Eye, Send
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { Customer, Vehicle, ServicePackage, Job, Estimate, EstimateLineItem, TaxRate, JobSegment } from '../types';
import { formatDate, getTodayISOString, getFutureDateISOString, dateStringToDate, addDays, splitJobIntoSegments, findNextAvailableDate, formatReadableDate } from '../core/utils/dateUtils';
import { formatCurrency, formatTitleCase } from '../utils/formatUtils';
import { generateEstimateNumber, generateJobId } from '../core/utils/numberGenerators';
import { generateCustomerId, getCustomerDisplayName } from '../core/utils/customerUtils';
import { lookupVehicleByVRM } from '../services/vehicleLookupService';
import { lookupAddressByPostcode, AddressDetails } from '../services/postcodeLookupService';
import { getScoredServicePackages } from '../utils/servicePackageScoring';
import { CAPACITY_THRESHOLD_WARNING } from '../constants';
import { sendOutboundEmail } from '../core/services/emailService';
import { 
    getBookingAssistantConfig, 
    interpolateScript, 
    BookingAssistantConfig, 
    DEFAULT_BOOKING_ASSISTANT_CONFIG, 
    BookingScriptAddon 
} from '../core/services/bookingAssistantConfigService';

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
    const { customers, vehicles, servicePackages, jobs, estimates, businessEntities, taxRates, absenceRequests } = useData();
    const { selectedEntityId, currentUser } = useApp();

    const selectedEntity = useMemo(() => 
        businessEntities.find(e => e.id === selectedEntityId) || businessEntities[0] || { id: 'default', name: 'Brookspeed', shortCode: 'BRK', laborRate: 95, dailyCapacityHours: 40 },
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
    const [newTitle, setNewTitle] = useState('Mr');
    const [newForename, setNewForename] = useState('');
    const [newSurname, setNewSurname] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newMobile, setNewMobile] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPostcode, setNewPostcode] = useState('');
    const [newAddressLine1, setNewAddressLine1] = useState('');
    const [newCity, setNewCity] = useState('');
    const [addressOptions, setAddressOptions] = useState<AddressDetails[]>([]);
    const [isPostcodeLoading, setIsPostcodeLoading] = useState(false);

    // GDPR & Communication Preferences State
    const [serviceReminderConsent, setServiceReminderConsent] = useState(true);
    const [marketingConsent, setMarketingConsent] = useState(false);
    const [declinedCommunication, setDeclinedCommunication] = useState(false);
    const [communicationPreference, setCommunicationPreference] = useState<'Email' | 'SMS' | 'WhatsApp' | 'Phone' | 'None'>('Email');

    // Vehicle fields (New or Lookup)
    const [vrmInput, setVrmInput] = useState('');
    const [isVrmLoading, setIsVrmLoading] = useState(false);
    const [vrmLookupError, setVrmLookupError] = useState('');
    const [vrmMatchMessage, setVrmMatchMessage] = useState<{ type: 'existing' | 'dvla'; title: string; text: string } | null>(null);
    const [vehicleDetails, setVehicleDetails] = useState<Partial<Vehicle>>({});
    const [currentMileage, setCurrentMileage] = useState<number>(36000);

    // Step 2: Service Matching & DMS Catalogue State
    const [serviceSourceTab, setServiceSourceTab] = useState<'tiered' | 'all-dms'>('tiered');
    const [selectedTier, setSelectedTier] = useState<'bronze' | 'silver' | 'gold' | 'custom'>('bronze');
    const [selectedCustomPackage, setSelectedCustomPackage] = useState<ServicePackage | null>(null);
    const [packageSearchTerm, setPackageSearchTerm] = useState('');
    const [filterCompatibleOnly, setFilterCompatibleOnly] = useState<boolean>(true);

    // Step 3: Bundle & Upsell State
    const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

    // Step 4: Scheduler & Capacity State
    const [bookingDate, setBookingDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return formatDate(d);
    });
    const [calendarDisplayMonth, setCalendarDisplayMonth] = useState<Date>(() => dateStringToDate(getTodayISOString()));
    const [allowOverbooking, setAllowOverbooking] = useState(false);
    const [bookingNotes, setBookingNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [copiedScript, setCopiedScript] = useState<string | null>(null);

    // Managed Data Configuration (Scripts, Bundles, Email Templates)
    const [scriptConfig, setScriptConfig] = useState<BookingAssistantConfig>(DEFAULT_BOOKING_ASSISTANT_CONFIG);
    const [sendEmailConfirmation, setSendEmailConfirmation] = useState<boolean>(true);
    const [customerConfirmationEmail, setCustomerConfirmationEmail] = useState<string>('');
    const [showEmailPreview, setShowEmailPreview] = useState<boolean>(false);
    const [isSendingDirectEmail, setIsSendingDirectEmail] = useState<boolean>(false);

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
            setVrmMatchMessage(null);
            setServiceReminderConsent(true);
            setMarketingConsent(false);
            setDeclinedCommunication(false);
            setCommunicationPreference('Email');
            setShowEmailPreview(false);

            // Fetch live managed data configuration
            getBookingAssistantConfig().then(cfg => {
                setScriptConfig(cfg);
                setSendEmailConfirmation(cfg.emailConfirmation?.autoSendDefault ?? true);
            }).catch(err => {
                console.error('Error fetching booking assistant config:', err);
            });
        }
    }, [isOpen, initialMode]);

    // Synchronize customer email for confirmation sending
    useEffect(() => {
        if (selectedCustomer?.email) {
            setCustomerConfirmationEmail(selectedCustomer.email);
        } else if (newEmail) {
            setCustomerConfirmationEmail(newEmail);
        }
    }, [selectedCustomer, newEmail]);

    // Computed customer search matches
    const customerSearchResults = useMemo(() => {
        if (!customerSearch.trim() || customerSearch.length < 2) return [];
        const term = customerSearch.toLowerCase();
        return customers.filter(c => {
            const name = `${c.forename || ''} ${c.surname || ''}`.toLowerCase();
            const phone = (c.phone || c.mobile || '').toLowerCase();
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
        if (!year) return 3;
        const currentYear = new Date().getFullYear();
        return Math.max(0, currentYear - year);
    }, [activeVehicle]);

    // REVERSE LOOKUP: REGISTRATION -> VEHICLE -> CLIENT DETAILS
    const handleVrmLookup = async (vrmToLookup?: string) => {
        const rawVrm = (vrmToLookup || vrmInput).trim().toUpperCase();
        const vrm = rawVrm.replace(/\s/g, '');
        if (!vrm) {
            toast.error('Please enter a vehicle registration.');
            return;
        }
        setIsVrmLoading(true);
        setVrmLookupError('');
        setVrmMatchMessage(null);

        try {
            // 1. CHECK IF VEHICLE ALREADY EXISTS IN SYSTEM
            const existingVeh = vehicles.find(v => v.registration?.toUpperCase().replace(/\s/g, '') === vrm);

            if (existingVeh) {
                setSelectedVehicle(existingVeh);
                setVehicleDetails(existingVeh);
                setVrmInput(existingVeh.registration);
                if (existingVeh.mileage) setCurrentMileage(existingVeh.mileage);

                // Pull through the linked customer record
                const linkedCustomer = customers.find(c => c.id === existingVeh.customerId);
                if (linkedCustomer) {
                    setSelectedCustomer(linkedCustomer);
                    setClientType('existing');
                    setCustomerSearch(getCustomerDisplayName(linkedCustomer));

                    // Pre-fill existing GDPR preferences
                    setServiceReminderConsent(linkedCustomer.serviceReminderConsent ?? true);
                    setMarketingConsent(linkedCustomer.marketingConsent ?? false);
                    setDeclinedCommunication(linkedCustomer.declinedCommunication ?? false);
                    setCommunicationPreference((linkedCustomer.communicationPreference as any) || 'Email');

                    setVrmMatchMessage({
                        type: 'existing',
                        title: 'Existing Vehicle & Client Record Found',
                        text: `Vehicle ${existingVeh.registration} (${existingVeh.make} ${existingVeh.model}) is registered to ${getCustomerDisplayName(linkedCustomer)}. Client details and contact records have been loaded below.`
                    });
                    toast.success(`Matched record: ${getCustomerDisplayName(linkedCustomer)} (${existingVeh.registration})`);
                    return;
                } else {
                    setVrmMatchMessage({
                        type: 'existing',
                        title: 'Existing Vehicle Found (Unlinked)',
                        text: `Vehicle ${existingVeh.registration} (${existingVeh.make} ${existingVeh.model}) is in your system. Please confirm or select the customer.`
                    });
                    return;
                }
            }

            // 2. VEHICLE NOT IN SYSTEM: PERFORM UK DVLA LOOKUP
            const lookup = await lookupVehicleByVRM(vrm);
            setVehicleDetails(lookup);
            setVrmInput(vrm);
            setClientType('new');
            setSelectedCustomer(null);
            setSelectedVehicle(null);

            setVrmMatchMessage({
                type: 'dvla',
                title: 'New Vehicle (DVLA Lookup Verified)',
                text: `${lookup.make} ${lookup.model} (${lookup.year || 'N/A'}, ${lookup.cc ? `${(lookup.cc / 1000).toFixed(1)}L` : ''} ${lookup.fuelType || 'Petrol'}) is not currently in your system. Please add the client details & GDPR consent below.`
            });
            toast.success(`DVLA Match: ${lookup.make} ${lookup.model} (${lookup.year || 'N/A'})`);

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

    // Handle GDPR checkbox toggles
    const handleConsentToggle = (field: 'serviceReminder' | 'marketing' | 'declined') => {
        if (field === 'declined') {
            const next = !declinedCommunication;
            setDeclinedCommunication(next);
            if (next) {
                setMarketingConsent(false);
                setServiceReminderConsent(false);
            }
        } else if (field === 'marketing') {
            const next = !marketingConsent;
            setMarketingConsent(next);
            if (next) setDeclinedCommunication(false);
        } else if (field === 'serviceReminder') {
            const next = !serviceReminderConsent;
            setServiceReminderConsent(next);
            if (next) setDeclinedCommunication(false);
        }
    };

    // =========================================================================
    // 1. DMS SERVICE PACKAGE MATCHING ENGINE (Strict Vehicle Compatibility)
    // =========================================================================
    const isV8 = useMemo(() => {
        const str = `${activeVehicle?.make || ''} ${activeVehicle?.model || ''}`.toLowerCase();
        const cc = activeVehicle?.cc ? Number(activeVehicle.cc) : 0;
        return /v8|8\s*cyl|4\.4|5\.0/i.test(str) || cc >= 3800;
    }, [activeVehicle]);

    // Strict package compatibility helper: ensures an Audi package is NEVER matched to a Land Rover, Porsche, etc.
    const isPackageCompatible = useMemo(() => {
        const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const vMake = clean(activeVehicle?.make || '');
        const isLandRoverRangeRover = vMake.includes('landrover') || vMake.includes('rangerover');

        const KNOWN_MAKES = [
            'audi', 'porsche', 'bmw', 'mercedes', 'ferrari', 'lamborghini', 
            'mclaren', 'bentley', 'aston', 'landrover', 'rangerover', 'jaguar', 
            'volkswagen', 'vw', 'volvo', 'ford', 'toyota', 'honda', 'nissan', 'peugeot', 'renault'
        ];

        return (pkg: ServicePackage): boolean => {
            if (!vMake) return true;
            const pMake = clean(pkg.applicableMake || '');
            const pName = (pkg.name || '').toLowerCase();

            // 1. If package has applicableMake explicitly set
            if (pMake && pMake !== 'all' && pMake !== 'generic') {
                const makeMatches = vMake.includes(pMake) || pMake.includes(vMake);
                const lrMatches = isLandRoverRangeRover && (pMake.includes('landrover') || pMake.includes('rangerover'));
                if (!makeMatches && !lrMatches) {
                    return false; // Explicitly different manufacturer
                }
            }

            // 2. If package name explicitly mentions another manufacturer
            for (const makeName of KNOWN_MAKES) {
                const isCurrentMake = vMake.includes(makeName) || (isLandRoverRangeRover && (makeName === 'landrover' || makeName === 'rangerover'));
                if (!isCurrentMake && pName.includes(makeName)) {
                    return false; // Package explicitly mentions another car brand
                }
            }

            return true;
        };
    }, [activeVehicle]);
    // =========================================================================
    const scoredPackages = useMemo(() => {
        return getScoredServicePackages(servicePackages || [], activeVehicle);
    }, [servicePackages, activeVehicle]);

    // Service Tiers Definition (Matching Live DMS Packages first, falling back to Intelligent Baseline)
    const serviceTiers = useMemo(() => {
        const make = activeVehicle?.make || '';
        const cc = activeVehicle?.cc || 2000;

        const isPremium = /porsche|ferrari|mclaren|lamborghini|aston|bentley|landrover|rangerover/i.test(make);
        const engineFactor = isV8 ? 1.45 : cc > 3000 ? 1.35 : cc > 2000 ? 1.15 : 1.0;
        const brandFactor = isPremium ? 1.35 : 1.0;

        // Baseline formula defaults calibrated to vehicle size / engine
        const bronzeDefaultGross = Math.round(189 * engineFactor * brandFactor);
        const silverDefaultGross = Math.round(299 * engineFactor * brandFactor);
        const goldDefaultGross = Math.round(469 * engineFactor * brandFactor);

        const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const vMake = clean(make);
        const isLR = vMake.includes('landrover') || vMake.includes('rangerover');

        // Compatible packages only (strictly excludes wrong car makes like Audi for Land Rover)
        const compatiblePackages = (servicePackages || []).filter(isPackageCompatible);

        const findMatchingDmsPackage = (terms: string[]): ServicePackage | null => {
            // 1. First priority: Exact / Make Match in DMS
            const makeSpecific = compatiblePackages.filter(pkg => {
                const pMake = clean(pkg.applicableMake || '');
                const pName = clean(pkg.name || '');
                const matchesLR = isLR && (pMake.includes('landrover') || pMake.includes('rangerover') || pName.includes('landrover') || pName.includes('rangerover'));
                const matchesMake = (pMake && (vMake.includes(pMake) || pMake.includes(vMake))) || (vMake && pName.includes(vMake));
                return matchesLR || matchesMake;
            });

            const specificMatch = makeSpecific.find(pkg => terms.some(t => clean(pkg.name || '').includes(clean(t))));
            if (specificMatch) return specificMatch;

            // 2. Second priority: Truly Generic DMS Package (No make set, or set to 'all'/'generic', and no brand in name)
            const genericPackages = compatiblePackages.filter(pkg => {
                const pMake = clean(pkg.applicableMake || '');
                return !pMake || pMake === 'all' || pMake === 'generic';
            });

            const genericMatch = genericPackages.find(pkg => terms.some(t => clean(pkg.name || '').includes(clean(t))));
            if (genericMatch) return genericMatch;

            // 3. DO NOT return a package for a different make under any circumstances
            return null;
        };

        const dmsMinor = findMatchingDmsPackage(['minor', 'bronze', 'oil service', 'oil & filter', 'interim inspection']);
        const dmsInterim = findMatchingDmsPackage(['interim', 'silver', 'intermediate', 'maintenance', 'scheduled service']);
        const dmsMajor = findMatchingDmsPackage(['major', 'gold', 'full service', 'comprehensive', 'inspection ii']);

        const extractLaborHours = (pkg?: ServicePackage, fallback: number = 2.0) => {
            if (!pkg?.costItems || pkg.costItems.length === 0) return fallback;
            const laborSum = pkg.costItems
                .filter(item => item.isLabor || item.type === 'labor' || item.partNumber === 'LABOUR' || /labour|labor/i.test(item.description || ''))
                .reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
            return laborSum > 0 ? laborSum : fallback;
        };

        const extractHighlights = (pkg?: ServicePackage, fallback: string[] = []): string[] => {
            if (!pkg?.costItems || pkg.costItems.length === 0) {
                if (pkg?.description) return [pkg.description];
                return fallback;
            }
            return pkg.costItems.slice(0, 6).map(item => {
                const qtyStr = item.quantity && item.quantity > 1 ? `${item.quantity}x ` : '';
                return `${qtyStr}${item.description || item.partNumber || 'Service Item'}`;
            });
        };

        const vehicleTitle = `${activeVehicle?.make || 'Vehicle'}${isV8 ? ' V8' : ''}`;

        return {
            bronze: {
                id: 'bronze',
                name: dmsMinor?.name || `${vehicleTitle} Bronze (Minor Service)`,
                subtitle: dmsMinor 
                    ? `DMS Package #${dmsMinor.id} • Verified for ${activeVehicle.make || 'Vehicle'}` 
                    : `Calibrated Baseline for ${vehicleTitle}`,
                priceGross: dmsMinor?.totalPrice || bronzeDefaultGross,
                hours: extractLaborHours(dmsMinor, isV8 ? 2.0 : 1.5),
                tag: dmsMinor ? 'DMS Live Package' : `Calibrated ${isV8 ? 'V8 ' : ''}Baseline`,
                tagColor: dmsMinor ? 'bg-emerald-100 text-emerald-950 border-emerald-400 font-bold' : 'bg-amber-100 text-amber-900 border-amber-300',
                isDmsPackage: Boolean(dmsMinor),
                dmsPackage: dmsMinor || undefined,
                highlights: extractHighlights(dmsMinor, [
                    isV8 ? 'High-capacity synthetic engine oil renewal (8.0L - 9.5L)' : 'Engine oil & premium OEM filter replacement',
                    'Essential fluid level top-ups (brake, coolant, washer)',
                    'Comprehensive 35-point safety inspection',
                    'Tyre pressure & tread depth inspection',
                    'Reset service interval indicator'
                ])
            },
            silver: {
                id: 'silver',
                name: dmsInterim?.name || `${vehicleTitle} Silver (Interim Service)`,
                subtitle: dmsInterim 
                    ? `DMS Package #${dmsInterim.id} • Verified for ${activeVehicle.make || 'Vehicle'}` 
                    : `Calibrated Baseline for ${vehicleTitle}`,
                priceGross: dmsInterim?.totalPrice || silverDefaultGross,
                hours: extractLaborHours(dmsInterim, isV8 ? 3.0 : 2.5),
                tag: dmsInterim ? 'DMS Live Package' : `Calibrated ${isV8 ? 'V8 ' : ''}Baseline`,
                tagColor: dmsInterim ? 'bg-emerald-100 text-emerald-950 border-emerald-400 font-bold' : 'bg-indigo-100 text-indigo-900 border-indigo-300',
                isDmsPackage: Boolean(dmsInterim),
                dmsPackage: dmsInterim || undefined,
                highlights: extractHighlights(dmsInterim, [
                    'All Bronze Minor Service items included',
                    'Wheels-off brake pad, disc & caliper inspection',
                    'Steering & suspension linkage condition check',
                    'Cabin pollen/microfilter replacement',
                    'Battery test & alternator charging rate check',
                    'Exhaust system & underbody structural inspection'
                ])
            },
            gold: {
                id: 'gold',
                name: dmsMajor?.name || `${vehicleTitle} Gold (Major Service)`,
                subtitle: dmsMajor 
                    ? `DMS Package #${dmsMajor.id} • Verified for ${activeVehicle.make || 'Vehicle'}` 
                    : `Calibrated Baseline for ${vehicleTitle}`,
                priceGross: dmsMajor?.totalPrice || goldDefaultGross,
                hours: extractLaborHours(dmsMajor, isV8 ? 5.0 : 4.0),
                tag: dmsMajor ? 'DMS Live Package' : `Calibrated ${isV8 ? 'V8 ' : ''}Baseline`,
                tagColor: dmsMajor ? 'bg-emerald-100 text-emerald-950 border-emerald-400 font-bold' : 'bg-yellow-100 text-yellow-900 border-yellow-400',
                isDmsPackage: Boolean(dmsMajor),
                dmsPackage: dmsMajor || undefined,
                highlights: extractHighlights(dmsMajor, [
                    'All Bronze & Silver Service items included',
                    'Engine air filter element replacement',
                    isV8 ? '8x High-performance spark plugs or diesel filter renewal' : (activeVehicle?.fuelType?.toLowerCase().includes('diesel') ? 'Fuel filter renewal' : 'Spark plugs replacement'),
                    'Brake fluid boiling point & moisture test',
                    'Coolant hydrometer freeze-point inspection',
                    'Auxiliary drive belt tension & wear check',
                    'Diagnostic fault code memory scan & health report'
                ])
            }
        };
    }, [activeVehicle, servicePackages, isPackageCompatible, isV8]);

    // Active selected tier or custom DMS package
    const currentTierData = useMemo(() => {
        if (selectedTier === 'custom' && selectedCustomPackage) {
            const laborHours = (selectedCustomPackage.costItems || [])
                .filter(item => item.isLabor || item.type === 'labor' || /labour|labor/i.test(item.description || ''))
                .reduce((sum, item) => sum + (Number(item.quantity) || 1), 0) || 2.0;

            const highlights = (selectedCustomPackage.costItems || []).map(i => `${i.quantity && i.quantity > 1 ? `${i.quantity}x ` : ''}${i.description}`);

            return {
                id: 'custom',
                name: selectedCustomPackage.name || 'Custom Package',
                subtitle: selectedCustomPackage.description || `DMS Package #${selectedCustomPackage.id}`,
                priceGross: selectedCustomPackage.totalPrice || 250,
                hours: laborHours,
                tag: 'DMS Catalogue Package',
                tagColor: 'bg-emerald-100 text-emerald-950 border-emerald-400 font-bold',
                isDmsPackage: true,
                dmsPackage: selectedCustomPackage,
                highlights: highlights.length > 0 ? highlights : [selectedCustomPackage.description || 'Full Workshop Service Package']
            };
        }
        return serviceTiers[selectedTier as 'bronze' | 'silver' | 'gold'] || serviceTiers.bronze;
    }, [selectedTier, selectedCustomPackage, serviceTiers]);

    const activeAddons = useMemo(() => 
        (scriptConfig.bundles && scriptConfig.bundles.length > 0 ? scriptConfig.bundles : BUNDLE_ADDONS).filter(addon => selectedAddonIds.includes(addon.id)),
        [scriptConfig.bundles, selectedAddonIds]
    );

    // Pricing calculation
    const pricingSummary = useMemo(() => {
        const tierGross = currentTierData.priceGross;
        const addonsGross = activeAddons.reduce((sum, a) => sum + a.bundledPrice, 0);
        const totalGross = tierGross + addonsGross;

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

    // Computed Dynamic Email Confirmation Content
    const generatedEmailContent = useMemo(() => {
        const custName = selectedCustomer 
            ? getCustomerDisplayName(selectedCustomer) 
            : `${newTitle} ${newForename} ${newSurname}`.trim() || 'Valued Customer';

        const bundleSummary = activeAddons.length > 0 
            ? `Done Together Addons:\n` + activeAddons.map(a => ` • ${a.name} (${formatCurrency(a.bundledPrice)} inc VAT)`).join('\n')
            : 'Additional Addons: None';

        const vars: Record<string, string> = {
            customerName: custName,
            companyName: selectedEntity.name,
            companyPhone: (selectedEntity as any).phone || '02380 000000',
            companyEmail: selectedEntity.email || 'info@brookspeed.com',
            vehicleMake: activeVehicle.make || 'Vehicle',
            vehicleModel: activeVehicle.model || '',
            vehicleReg: activeVehicle.registration || vrmInput || 'REG',
            bookingDate: formatReadableDate(bookingDate),
            tierName: currentTierData.name,
            bundleSummary,
            totalGross: formatCurrency(pricingSummary.totalGross),
            totalNet: formatCurrency(pricingSummary.totalNet),
            workshopName: selectedEntity.name,
            bookingNotes: bookingNotes ? `Customer Notes: "${bookingNotes}"\n` : ''
        };

        const subject = interpolateScript(scriptConfig.emailConfirmation?.subjectTemplate || "Booking Confirmation: {vehicleReg} - {companyName}", vars);
        const body = interpolateScript(scriptConfig.emailConfirmation?.bodyTemplate || "Booking confirmed for {bookingDate}.", vars);

        return { subject, body };
    }, [selectedCustomer, newTitle, newForename, newSurname, activeVehicle, vrmInput, bookingDate, currentTierData, activeAddons, pricingSummary, selectedEntity, bookingNotes, scriptConfig]);

    // Computed Spoken Call Scripts from Managed Data
    const step1SpokenScript = useMemo(() => {
        if (selectedCustomer) {
            return interpolateScript(scriptConfig.scripts?.step1GreetingExisting || DEFAULT_BOOKING_ASSISTANT_CONFIG.scripts.step1GreetingExisting, {
                companyName: selectedEntity.name,
                staffName: currentUser.name || 'Reception',
                customerName: getCustomerDisplayName(selectedCustomer),
                vehicleMake: activeVehicle.make || '',
                vehicleModel: activeVehicle.model || '',
                customerAddress: selectedCustomer.address || selectedCustomer.postcode || ''
            });
        }
        return interpolateScript(scriptConfig.scripts?.step1GreetingNew || DEFAULT_BOOKING_ASSISTANT_CONFIG.scripts.step1GreetingNew, {
            companyName: selectedEntity.name,
            staffName: currentUser.name || 'Reception'
        });
    }, [selectedCustomer, scriptConfig, selectedEntity, currentUser, activeVehicle]);

    const step2SpokenScript = useMemo(() => {
        return interpolateScript(scriptConfig.scripts?.step2Presentation || DEFAULT_BOOKING_ASSISTANT_CONFIG.scripts.step2Presentation, {
            companyName: selectedEntity.name,
            vehicleMake: activeVehicle.make || 'vehicle',
            tierName: currentTierData.name,
            tierPrice: formatCurrency(currentTierData.priceGross),
            mileage: currentMileage.toLocaleString()
        });
    }, [scriptConfig, selectedEntity, activeVehicle, currentTierData, currentMileage]);

    const step4SpokenScript = useMemo(() => {
        return interpolateScript(scriptConfig.scripts?.step4Closing || DEFAULT_BOOKING_ASSISTANT_CONFIG.scripts.step4Closing, {
            companyName: selectedEntity.name,
            bookingDate: formatReadableDate(bookingDate),
            vehicleMake: activeVehicle.make || 'vehicle',
            tierName: currentTierData.name,
            bundleList: activeAddons.length > 0 ? ` with the bundled ${activeAddons.map(a => a.name).join(', ')}` : '',
            communicationPreference
        });
    }, [scriptConfig, selectedEntity, bookingDate, activeVehicle, currentTierData, activeAddons, communicationPreference]);

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

    // =========================================================================
    // 2. WORKSHOP SCHEDULER & CAPACITY INTEGRATION
    // =========================================================================
    const absencesByDate = useMemo(() => {
        const map = new Map<string, number>();
        (absenceRequests || []).forEach(req => {
            const reqAsAny = req as any;
            if (reqAsAny.status === 'Approved' || reqAsAny.status === 'Pending') {
                let currentDate = dateStringToDate(reqAsAny.startDate);
                const endDate = dateStringToDate(reqAsAny.endDate);
                while(currentDate <= endDate) {
                    const dateStr = formatDate(currentDate);
                    map.set(dateStr, (map.get(dateStr) || 0) + 8);
                    currentDate = addDays(currentDate, 1);
                }
            }
        });
        return map;
    }, [absenceRequests]);

    const jobsForEntity = useMemo(() => {
        return (jobs || []).filter(j => j.entityId === selectedEntity.id);
    }, [jobs, selectedEntity]);

    const maxDailyCapacity = useMemo(() => {
        return (selectedEntity as any)?.dailyCapacityHours || 40;
    }, [selectedEntity]);

    // Capacity breakdown helper for any date
    const getCapacityForDate = (dateStr: string, addedHours: number = 0) => {
        const absenceHours = absencesByDate.get(dateStr) || 0;
        const effectiveCapacity = Math.max(0, maxDailyCapacity - absenceHours);

        const currentBookedHours = (jobsForEntity.flatMap(j => Array.isArray(j.segments) ? j.segments : []))
            .filter(s => s.date === dateStr && s.status !== 'Cancelled')
            .reduce((sum, s) => sum + (Number(s.duration) || 0), 0);

        const targetDateObj = dateStringToDate(dateStr);
        const dayOfWeek = targetDateObj.getUTCDay();
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;

        const projectedHours = currentBookedHours + addedHours;
        const remainingCapacity = Math.max(0, effectiveCapacity - projectedHours);
        const loadRatio = effectiveCapacity > 0 ? (currentBookedHours + addedHours) / effectiveCapacity : (projectedHours > 0 ? 1.5 : 0);

        let status: 'Normal' | 'High Load' | 'Overloaded' | 'Closed' = 'Normal';
        let badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';

        if (isSunday) {
            status = 'Closed';
            badgeColor = 'bg-slate-100 text-slate-500 border-slate-200';
        } else if (loadRatio > 1.0) {
            status = 'Overloaded';
            badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
        } else if (loadRatio >= CAPACITY_THRESHOLD_WARNING) {
            status = 'High Load';
            badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
        }

        return {
            dateStr,
            currentBookedHours,
            projectedHours,
            effectiveCapacity,
            remainingCapacity,
            absenceHours,
            loadRatio,
            status,
            badgeColor,
            isWeekend: isSunday || isSaturday,
            isClosed: isSunday
        };
    };

    // Selected Date Live Capacity Metrics
    const selectedDateCapacity = useMemo(() => {
        return getCapacityForDate(bookingDate, pricingSummary.totalHours);
    }, [bookingDate, pricingSummary.totalHours, jobsForEntity, maxDailyCapacity, absencesByDate]);

    // Next Available Date Suggestion if current date is full
    const suggestedNextAvailableDate = useMemo(() => {
        if (selectedDateCapacity.status === 'Overloaded' || selectedDateCapacity.isClosed) {
            return findNextAvailableDate(bookingDate, pricingSummary.totalHours, jobsForEntity, maxDailyCapacity, absencesByDate);
        }
        return null;
    }, [selectedDateCapacity, bookingDate, pricingSummary.totalHours, jobsForEntity, maxDailyCapacity, absencesByDate]);

    // Step 4: Submission Handlers
    const handleConfirmBooking = async (createMode: 'job' | 'estimate') => {
        if (!selectedCustomer && clientType === 'existing') {
            toast.error('Please select an existing customer or switch to New Client.');
            return;
        }

        if (clientType === 'new' && (!newForename.trim() || !newSurname.trim())) {
            toast.error('Please provide the client name.');
            return;
        }

        // GDPR Validation Check
        if (clientType === 'new' && !serviceReminderConsent && !marketingConsent && !declinedCommunication) {
            toast.error('Please record the GDPR consent: select Service Reminders, Marketing, or Customer Declined.');
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
                finalCustomer = {
                    ...selectedCustomer,
                    phone: newPhone.trim() || selectedCustomer.phone,
                    mobile: newMobile.trim() || selectedCustomer.mobile,
                    email: newEmail.trim() || selectedCustomer.email,
                    marketingConsent,
                    serviceReminderConsent,
                    declinedCommunication,
                    communicationPreference
                };
            } else {
                isNewCustomer = true;
                const newCustId = generateCustomerId(newSurname.trim(), customers);
                finalCustomer = {
                    id: newCustId,
                    title: newTitle,
                    forename: formatTitleCase(newForename.trim()),
                    surname: formatTitleCase(newSurname.trim()),
                    phone: newPhone.trim() || newMobile.trim(),
                    mobile: newMobile.trim(),
                    email: newEmail.trim(),
                    address: newAddressLine1.trim(),
                    addressLine1: newAddressLine1.trim(),
                    city: formatTitleCase(newCity.trim()),
                    postcode: newPostcode.toUpperCase().trim(),
                    createdDate: getTodayISOString(),
                    marketingConsent,
                    serviceReminderConsent,
                    declinedCommunication,
                    communicationPreference,
                    searchField: `${newForename} ${newSurname} ${newPhone} ${newMobile} ${newEmail} ${newPostcode}`.toLowerCase()
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

            // Capacity & Overbooking check
            if (createMode === 'job') {
                if (selectedDateCapacity.isClosed) {
                    toast.error(`The workshop is closed on ${formatReadableDate(bookingDate)}. Please choose another working day.`);
                    setIsSaving(false);
                    return;
                }
                if (selectedDateCapacity.status === 'Overloaded' && !allowOverbooking) {
                    toast.error(`Workshop is overloaded on ${formatReadableDate(bookingDate)} (+${(selectedDateCapacity.projectedHours - selectedDateCapacity.effectiveCapacity).toFixed(1)}h over limit). Please tick "Authorize Workshop Overtime" or pick an alternative date.`);
                    setIsSaving(false);
                    return;
                }
            }

            // Build Line Items
            const lineItems: EstimateLineItem[] = [];

            // 1. DMS Package Cost Items OR Baseline Service Tier Line Item
            if (currentTierData.dmsPackage?.costItems && currentTierData.dmsPackage.costItems.length > 0) {
                currentTierData.dmsPackage.costItems.forEach(item => {
                    lineItems.push({
                        ...item,
                        id: crypto.randomUUID(),
                        servicePackageName: currentTierData.name
                    });
                });
            } else {
                lineItems.push({
                    id: crypto.randomUUID(),
                    description: `${currentTierData.name} - ${finalVehicle.make} ${finalVehicle.model}`,
                    quantity: currentTierData.hours,
                    unitPrice: Math.round((currentTierData.priceGross / (1 + (standardTaxRate / 100)) / currentTierData.hours) * 100) / 100,
                    isLabor: true,
                    isPackage: true,
                    servicePackageName: currentTierData.name
                });
            }

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

            // If Job Mode, Create Job with Real Scheduler Segments
            if (createMode === 'job') {
                const newJobId = generateJobId(jobs, entityShortCode);
                let finalNotes = bookingNotes;
                if (selectedDateCapacity.status === 'Overloaded' && allowOverbooking) {
                    const overbookTag = `[Overbooked - Workshop Overtime Authorized for ${formatReadableDate(bookingDate)}]`;
                    finalNotes = finalNotes ? `${finalNotes}\n\n${overbookTag}` : overbookTag;
                }

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
                    notes: finalNotes,
                    mileage: currentMileage,
                    segments: []
                };

                // Split into segments so the job immediately populates onto the Booking Calendar and Dispatch views
                newJob.segments = splitJobIntoSegments({
                    description: newJob.description,
                    estimatedHours: newJob.estimatedHours,
                    scheduledDate: newJob.scheduledDate
                });

                if (isNewVehicle && onVehicleAndJobCreate) {
                    onVehicleAndJobCreate(finalCustomer, finalVehicle, newJob, newEstimate);
                } else if (onJobCreate) {
                    onJobCreate(newJob, newEstimate);
                }
                toast.success(`Booking confirmed for ${formatReadableDate(bookingDate)}! Job ${newJobId} created and scheduled.`);
            } else {
                if (isNewVehicle && onVehicleAndEstimateCreate) {
                    onVehicleAndEstimateCreate(finalCustomer, finalVehicle, newEstimate);
                } else if (onEstimateCreate) {
                    onEstimateCreate(newEstimate);
                }
                toast.success(`Formal Estimate ${newEstimate.id} created successfully.`);
            }

            // Send Outbound Confirmation Email if Selected
            if (sendEmailConfirmation && customerConfirmationEmail) {
                try {
                    await sendOutboundEmail({
                        to: customerConfirmationEmail,
                        fromName: selectedEntity.name,
                        fromEmail: selectedEntity.email || 'info@brookspeed.com',
                        subject: generatedEmailContent.subject,
                        body: generatedEmailContent.body
                    });
                    toast.success(`Booking details and estimate sent to ${customerConfirmationEmail}!`);
                } catch (mailErr: any) {
                    console.warn('Failed to send confirmation email:', mailErr);
                    toast.warn(`Booking created, but confirmation email could not be delivered: ${mailErr.message}`);
                }
            }

            onClose();
        } catch (err: any) {
            console.error('Failed to create booking/estimate:', err);
            toast.error('An error occurred while creating the record.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendDirectEmail = async () => {
        if (!customerConfirmationEmail) {
            toast.error('Please enter a customer email address.');
            return;
        }
        setIsSendingDirectEmail(true);
        try {
            await sendOutboundEmail({
                to: customerConfirmationEmail,
                fromName: selectedEntity.name,
                fromEmail: selectedEntity.email || 'info@brookspeed.com',
                subject: generatedEmailContent.subject,
                body: generatedEmailContent.body
            });
            toast.success(`Confirmation email successfully sent to ${customerConfirmationEmail}!`);
        } catch (err: any) {
            console.error('Email send failed:', err);
            toast.error(`Failed to send email: ${err.message}`);
        } finally {
            setIsSendingDirectEmail(false);
        }
    };

    // Calendar Days Generator for Step 4 Interactive Capacity Calendar
    const calendarMonthDays = useMemo(() => {
        const start = new Date(Date.UTC(calendarDisplayMonth.getUTCFullYear(), calendarDisplayMonth.getUTCMonth(), 1));
        const end = new Date(Date.UTC(calendarDisplayMonth.getUTCFullYear(), calendarDisplayMonth.getUTCMonth() + 1, 0));
        const todayStr = formatDate(new Date());

        const days: Array<{ key: string; isPlaceholder: boolean; day?: number; dateStr?: string; isToday?: boolean; isSelected?: boolean; capInfo?: any }> = [];

        // Empty start padding
        for (let i = 0; i < start.getUTCDay(); i++) {
            days.push({ key: `empty-start-${i}`, isPlaceholder: true });
        }

        for (let day = 1; day <= end.getUTCDate(); day++) {
            const d = new Date(Date.UTC(calendarDisplayMonth.getUTCFullYear(), calendarDisplayMonth.getUTCMonth(), day));
            const dateStr = formatDate(d);
            const capInfo = getCapacityForDate(dateStr, dateStr === bookingDate ? pricingSummary.totalHours : 0);
            days.push({
                key: dateStr,
                isPlaceholder: false,
                day,
                dateStr,
                isToday: dateStr === todayStr,
                isSelected: dateStr === bookingDate,
                capInfo
            });
        }

        while (days.length % 7 !== 0) {
            days.push({ key: `empty-end-${days.length}`, isPlaceholder: true });
        }

        return days;
    }, [calendarDisplayMonth, bookingDate, pricingSummary.totalHours, jobsForEntity, maxDailyCapacity, absencesByDate]);

    const handleMonthOffset = (offset: number) => {
        setCalendarDisplayMonth(prev => {
            const next = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), 1));
            next.setUTCMonth(next.getUTCMonth() + offset);
            return next;
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden border border-slate-300 text-slate-800">
                
                {/* LARGER, HIGHER-CONTRAST MODAL HEADER */}
                <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-4 border-b border-indigo-900 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600/40 rounded-2xl border border-indigo-400/30 text-indigo-200">
                            <Headphones size={28} className="text-indigo-200" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-black tracking-tight text-white">Intelligent Booking Assistant</h2>
                                <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                                    mode === 'receptionist' ? 'bg-amber-400 text-amber-950 shadow-sm' : 'bg-emerald-400 text-emerald-950 shadow-sm'
                                }`}>
                                    {mode === 'receptionist' ? 'Receptionist Mode' : 'Customer Mode'}
                                </span>
                            </div>
                            <p className="text-sm text-indigo-200 mt-0.5">
                                {mode === 'receptionist' 
                                    ? 'Internal call scripting, reverse VRM customer lookup, and "Done Together" upselling strategy' 
                                    : 'Frictionless, customer-facing package selection and booking portal'}
                            </p>
                        </div>
                    </div>

                    {/* Mode Toggle Switch */}
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700 flex items-center shadow-inner">
                            <button
                                onClick={() => setMode('receptionist')}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                                    mode === 'receptionist' 
                                        ? 'bg-amber-400 text-slate-950 shadow-md font-black' 
                                        : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                <Headphones size={16} />
                                Receptionist Mode
                            </button>
                            <button
                                onClick={() => setMode('online')}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                                    mode === 'online' 
                                        ? 'bg-emerald-500 text-white shadow-md font-black' 
                                        : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                <User size={16} />
                                Online Customer Mode
                            </button>
                        </div>

                        <button 
                            onClick={onClose}
                            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </header>

                {/* WORKFLOW STEPPER BAR (EXPANDED FONT) */}
                <div className="bg-slate-100 border-b border-slate-200 px-6 sm:px-8 py-3 flex items-center justify-between text-sm font-medium text-slate-600 flex-shrink-0">
                    <div className="flex items-center gap-2 sm:gap-4">
                        {[
                            { num: 1, title: '1. Vehicle & Client Verification' },
                            { num: 2, title: '2. Service Matching' },
                            { num: 3, title: '3. Upsell & Bundles' },
                            { num: 4, title: '4. Date & Confirm' }
                        ].map((s, idx) => (
                            <React.Fragment key={s.num}>
                                <button
                                    onClick={() => setCurrentStep(s.num as any)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                                        currentStep === s.num 
                                            ? 'bg-indigo-600 text-white shadow-sm' 
                                            : currentStep > s.num
                                                ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                                                : 'text-slate-500 hover:bg-slate-200'
                                    }`}
                                >
                                    {currentStep > s.num ? <Check size={16} className="text-indigo-600" /> : null}
                                    {s.title}
                                </button>
                                {idx < 3 && <ChevronRight size={16} className="text-slate-400" />}
                            </React.Fragment>
                        ))}
                    </div>

                    {activeVehicle?.registration && (
                        <div className="hidden sm:flex items-center gap-2.5 bg-yellow-300/40 text-yellow-950 border border-yellow-400 px-3 py-1.5 rounded-lg font-mono text-sm font-black shadow-xs">
                            <Car size={16} />
                            <span>{activeVehicle.registration}</span>
                            {activeVehicle.make && <span>• {activeVehicle.make} {activeVehicle.model}</span>}
                        </div>
                    )}
                </div>

                {/* MAIN CONTENT BODY */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-50/60">

                    {/* ======================================================== */}
                    {/* STEP 1: CLIENT IDENTIFICATION & VEHICLE VERIFICATION     */}
                    {/* ======================================================== */}
                    {currentStep === 1 && (
                        <div className="space-y-6 max-w-5xl mx-auto">
                            
                            {/* RECEPTIONIST SCRIPT / GUIDANCE HEADER (LARGER TYPE) */}
                            {mode === 'receptionist' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* What to Say */}
                                    <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-5 shadow-sm relative">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-2">
                                                <Volume2 size={18} className="text-amber-700" />
                                                [What to Say to Customer]
                                            </span>
                                            <button 
                                                onClick={() => handleCopyScript(step1SpokenScript, 'step1-script')}
                                                className="text-amber-800 hover:text-amber-950 px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-200 rounded-lg transition"
                                                title="Copy script"
                                            >
                                                {copiedScript === 'step1-script' ? <Check size={16} className="text-emerald-700" /> : <Copy size={16} />}
                                                <span>Copy Script</span>
                                            </button>
                                        </div>
                                        <p className="text-base sm:text-lg italic text-amber-950 leading-relaxed font-serif">
                                            &ldquo;{step1SpokenScript}&rdquo;
                                        </p>
                                    </div>

                                    {/* Behind the Scenes Action */}
                                    <div className="bg-blue-50/80 border-2 border-blue-200 rounded-2xl p-5 shadow-sm">
                                        <span className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-2 mb-3">
                                            <Wrench size={18} className="text-blue-700" />
                                            [Behind the Scenes - Action Required]
                                        </span>
                                        <ul className="text-sm text-blue-950 space-y-2 list-disc pl-5">
                                            <li><strong>Enter Reg below:</strong> System immediately scans DMS vehicles. If found, it automatically retrieves the client record.</li>
                                            <li><strong>If existing:</strong> Confirm address, mobile number, and GDPR contact preferences.</li>
                                            <li><strong>If new to system:</strong> Runs DVLA check, creates the client profile, and captures mandatory GDPR consents.</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* PRIMARY VEHICLE REGISTRATION LOOKUP FIRST */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-black text-slate-900 text-base flex items-center gap-2.5">
                                        <Car size={22} className="text-amber-500" />
                                        Vehicle Registration & Automatic Client Lookup
                                    </h3>
                                    {activeVehicle.year && (
                                        <span className="text-sm bg-amber-50 text-amber-900 border border-amber-300 px-3 py-1 rounded-lg font-mono font-bold">
                                            Age: {vehicleAge} {vehicleAge === 1 ? 'Year' : 'Years'} Old
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder="ENTER REG" 
                                            value={vrmInput}
                                            onChange={e => setVrmInput(e.target.value.toUpperCase())}
                                            onKeyDown={e => { if (e.key === 'Enter') handleVrmLookup(); }}
                                            className="px-4 py-3 bg-yellow-300/40 text-slate-950 border-2 border-yellow-400 font-mono font-black text-lg uppercase rounded-xl w-52 tracking-widest outline-none focus:ring-4 focus:ring-yellow-400/40 shadow-xs"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleVrmLookup()}
                                        disabled={isVrmLoading || !vrmInput.trim()}
                                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Search size={18} />
                                        {isVrmLoading ? 'Looking up Vehicle & Client...' : 'Lookup Vehicle'}
                                    </button>

                                    <div className="flex items-center gap-2.5 ml-auto">
                                        <label className="text-sm font-bold text-slate-700">Current Mileage:</label>
                                        <input 
                                            type="number" 
                                            value={currentMileage} 
                                            onChange={e => setCurrentMileage(parseInt(e.target.value, 10) || 0)}
                                            className="w-32 px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold text-right"
                                        />
                                        <span className="text-sm text-slate-500 font-bold">miles</span>
                                    </div>
                                </div>

                                {vrmLookupError && (
                                    <p className="text-sm text-red-700 bg-red-50 p-3 rounded-xl border border-red-200">
                                        {vrmLookupError}
                                    </p>
                                )}

                                {/* REVERSE LOOKUP BANNER */}
                                {vrmMatchMessage && (
                                    <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                                        vrmMatchMessage.type === 'existing' 
                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
                                            : 'bg-indigo-50 border-indigo-300 text-indigo-950'
                                    }`}>
                                        <CheckCircle2 size={22} className={`flex-shrink-0 mt-0.5 ${
                                            vrmMatchMessage.type === 'existing' ? 'text-emerald-600' : 'text-indigo-600'
                                        }`} />
                                        <div>
                                            <h4 className="font-bold text-sm">{vrmMatchMessage.title}</h4>
                                            <p className="text-sm leading-relaxed">{vrmMatchMessage.text}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Live Vehicle Profile Preview */}
                                {(activeVehicle.make || activeVehicle.model) && (
                                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-400 block text-xs font-bold uppercase">Make & Model</span>
                                            <span className="font-bold text-slate-900 text-base">{activeVehicle.make} {activeVehicle.model}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-xs font-bold uppercase">Year / Engine</span>
                                            <span className="font-semibold text-slate-800">{activeVehicle.year || 'N/A'} • {activeVehicle.cc ? `${(activeVehicle.cc / 1000).toFixed(1)}L (${activeVehicle.cc}cc)` : 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-xs font-bold uppercase">Fuel Type</span>
                                            <span className="font-semibold text-slate-800">{activeVehicle.fuelType || 'Petrol'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-xs font-bold uppercase">MOT Status</span>
                                            <span className="font-semibold text-slate-800">{activeVehicle.nextMotDate ? `Due ${activeVehicle.nextMotDate}` : 'Valid'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* CLIENT DETAILS & VERIFICATION / GDPR SECTION */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-black text-slate-900 text-base flex items-center gap-2.5">
                                        <User size={22} className="text-indigo-600" />
                                        Client Record & Verification
                                    </h3>
                                    <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                                        <button
                                            type="button"
                                            onClick={() => setClientType('existing')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${clientType === 'existing' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            Existing Client
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setClientType('new');
                                                setSelectedCustomer(null);
                                            }}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${clientType === 'new' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            + Add New Client
                                        </button>
                                    </div>
                                </div>

                                {clientType === 'existing' ? (
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                            <input 
                                                type="text"
                                                placeholder="Search customer by name, telephone, or email..."
                                                value={customerSearch}
                                                onChange={(e) => setCustomerSearch(e.target.value)}
                                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>

                                        {customerSearchResults.length > 0 && (
                                            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                                                {customerSearchResults.map(cust => (
                                                    <div 
                                                        key={cust.id}
                                                        onClick={() => {
                                                            setSelectedCustomer(cust);
                                                            setCustomerSearch(getCustomerDisplayName(cust));
                                                            setServiceReminderConsent(cust.serviceReminderConsent ?? true);
                                                            setMarketingConsent(cust.marketingConsent ?? false);
                                                            setDeclinedCommunication(cust.declinedCommunication ?? false);
                                                            setCommunicationPreference((cust.communicationPreference as any) || 'Email');

                                                            const v = vehicles.find(veh => veh.customerId === cust.id);
                                                            if (v) {
                                                                setSelectedVehicle(v);
                                                                setVrmInput(v.registration);
                                                                if (v.mileage) setCurrentMileage(v.mileage);
                                                            }
                                                        }}
                                                        className={`p-3.5 cursor-pointer hover:bg-indigo-50/70 flex items-center justify-between transition ${selectedCustomer?.id === cust.id ? 'bg-indigo-50 font-semibold' : ''}`}
                                                    >
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800">{getCustomerDisplayName(cust)}</div>
                                                            <div className="text-xs text-slate-500">{cust.phone || cust.mobile || 'No phone'} • {cust.email || 'No email'} • {cust.postcode || 'No postcode'}</div>
                                                        </div>
                                                        {selectedCustomer?.id === cust.id && <CheckCircle2 size={20} className="text-indigo-600" />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {selectedCustomer && (
                                            <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-xl p-4 text-sm text-emerald-950 flex flex-wrap items-center justify-between gap-4">
                                                <div>
                                                    <span className="font-bold text-base block text-emerald-900">{getCustomerDisplayName(selectedCustomer)}</span>
                                                    <span>{selectedCustomer.address || selectedCustomer.addressLine1 || 'No address'}, {selectedCustomer.postcode}</span>
                                                    <span className="mx-2">•</span>
                                                    <span>Tel: {selectedCustomer.phone || selectedCustomer.mobile || 'N/A'}</span>
                                                    <span className="mx-2">•</span>
                                                    <span>Email: {selectedCustomer.email || 'N/A'}</span>
                                                </div>
                                                <span className="bg-emerald-200 text-emerald-900 px-3 py-1 rounded-lg font-bold text-xs">
                                                    Verified Client on File
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* NEW CLIENT FORM WITH ENLARGED INPUTS */
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="sm:col-span-1">
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Title</label>
                                            <select 
                                                value={newTitle}
                                                onChange={e => setNewTitle(e.target.value)}
                                                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="Mr">Mr</option>
                                                <option value="Mrs">Mrs</option>
                                                <option value="Ms">Ms</option>
                                                <option value="Miss">Miss</option>
                                                <option value="Dr">Dr</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">First Name *</label>
                                            <input 
                                                type="text" 
                                                value={newForename} 
                                                onChange={e => setNewForename(e.target.value)}
                                                placeholder="e.g. John" 
                                                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Surname *</label>
                                            <input 
                                                type="text" 
                                                value={newSurname} 
                                                onChange={e => setNewSurname(e.target.value)}
                                                placeholder="e.g. Smith" 
                                                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Phone *</label>
                                            <input 
                                                type="tel" 
                                                value={newMobile} 
                                                onChange={e => setNewMobile(e.target.value)}
                                                placeholder="e.g. 07700 900123" 
                                                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Landline / Alternative Phone</label>
                                            <input 
                                                type="tel" 
                                                value={newPhone} 
                                                onChange={e => setNewPhone(e.target.value)}
                                                placeholder="e.g. 02380 000000" 
                                                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                                            <input 
                                                type="email" 
                                                value={newEmail} 
                                                onChange={e => setNewEmail(e.target.value)}
                                                placeholder="e.g. john.smith@example.com" 
                                                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>

                                        {/* Postcode and Street Address */}
                                        <div className="sm:col-span-3 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                                                Address & Postcode Lookup
                                            </label>
                                            <div className="flex gap-3">
                                                <input 
                                                    type="text" 
                                                    value={newPostcode} 
                                                    onChange={e => setNewPostcode(e.target.value.toUpperCase())}
                                                    placeholder="POSTCODE" 
                                                    className="w-40 uppercase font-mono px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handlePostcodeLookup}
                                                    disabled={isPostcodeLoading || !newPostcode.trim()}
                                                    className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 disabled:opacity-50"
                                                >
                                                    {isPostcodeLoading ? 'Looking up...' : 'Find Address'}
                                                </button>
                                            </div>

                                            {addressOptions.length > 0 && (
                                                <select
                                                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
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

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <input 
                                                    type="text" 
                                                    value={newAddressLine1} 
                                                    onChange={e => setNewAddressLine1(e.target.value)}
                                                    placeholder="Street Address (Line 1)" 
                                                    className="px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white"
                                                />
                                                <input 
                                                    type="text" 
                                                    value={newCity} 
                                                    onChange={e => setNewCity(e.target.value)}
                                                    placeholder="Town / City" 
                                                    className="px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* GDPR & COMMUNICATION CONSENT BOX (MANDATORY REQUIREMENTS) */}
                                <div className="bg-slate-50 border-2 border-indigo-200/80 rounded-2xl p-5 space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                                        <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                                            <ShieldCheck size={20} className="text-indigo-600" />
                                            <span>GDPR Compliance & Communication Preferences</span>
                                        </div>
                                        {mode === 'receptionist' && (
                                            <span className="text-xs text-indigo-700 italic font-serif">
                                                Script: &ldquo;May I confirm your preferred method for booking confirmations and annual MOT/service reminders?&rdquo;
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                Preferred Channel
                                            </label>
                                            <select
                                                value={communicationPreference}
                                                onChange={e => setCommunicationPreference(e.target.value as any)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white font-semibold"
                                            >
                                                <option value="Email">Email</option>
                                                <option value="SMS">SMS</option>
                                                <option value="WhatsApp">WhatsApp</option>
                                                <option value="Phone">Phone Call</option>
                                                <option value="None">None</option>
                                            </select>
                                        </div>

                                        <div 
                                            onClick={() => handleConsentToggle('serviceReminder')}
                                            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-400 select-none"
                                        >
                                            <input 
                                                type="checkbox" 
                                                checked={serviceReminderConsent} 
                                                onChange={() => {}} 
                                                className="w-4 h-4 text-indigo-600 rounded cursor-pointer" 
                                            />
                                            <div>
                                                <span className="text-xs font-bold text-slate-800 block">Service & MOT Reminders</span>
                                                <span className="text-[10px] text-slate-500">Crucial safety & due-date alerts</span>
                                            </div>
                                        </div>

                                        <div 
                                            onClick={() => handleConsentToggle('marketing')}
                                            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-400 select-none"
                                        >
                                            <input 
                                                type="checkbox" 
                                                checked={marketingConsent} 
                                                onChange={() => {}} 
                                                className="w-4 h-4 text-indigo-600 rounded cursor-pointer" 
                                            />
                                            <div>
                                                <span className="text-xs font-bold text-slate-800 block">Marketing & Seasonal Offers</span>
                                                <span className="text-[10px] text-slate-500">Workshop updates & clinics</span>
                                            </div>
                                        </div>

                                        <div 
                                            onClick={() => handleConsentToggle('declined')}
                                            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-red-400 select-none"
                                        >
                                            <input 
                                                type="checkbox" 
                                                checked={declinedCommunication} 
                                                onChange={() => {}} 
                                                className="w-4 h-4 text-red-600 rounded cursor-pointer" 
                                            />
                                            <div>
                                                <span className="text-xs font-bold text-red-800 block">Declined Contact</span>
                                                <span className="text-[10px] text-red-500">Opt out of all alerts</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* NEXT STEP BUTTON */}
                            <div className="flex justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(2)}
                                    className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-base shadow-lg transition flex items-center gap-3"
                                >
                                    Proceed to Service Matching
                                    <ArrowRight size={20} />
                                </button>
                            </div>
                        </div>
                    )}


                    {/* ======================================================== */}
                    {/* STEP 2: VEHICLE-SPECIFIC SERVICE MATCHING                */}
                    {/* ======================================================== */}
                    {currentStep === 2 && (
                        <div className="space-y-6 max-w-5xl mx-auto">

                            {/* RECEPTIONIST SCRIPT FOR PRESENTING TIERS (LARGER FONT) */}
                            {mode === 'receptionist' && (
                                <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-2">
                                            <Volume2 size={18} className="text-amber-700" />
                                            [What to Say: Baseline Presentation Strategy]
                                        </span>
                                        <button 
                                            onClick={() => handleCopyScript(step2SpokenScript, 'step2-script')}
                                            className="text-amber-800 hover:text-amber-950 px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-200 rounded-lg transition"
                                        >
                                            {copiedScript === 'step2-script' ? <Check size={16} className="text-emerald-700" /> : <Copy size={16} />}
                                            <span>Copy Script</span>
                                        </button>
                                    </div>
                                    <p className="text-base sm:text-lg italic text-amber-950 font-serif leading-relaxed">
                                        &ldquo;{step2SpokenScript}&rdquo;
                                    </p>
                                </div>
                            )}

                            {/* CALIBRATED BASELINE NOTICE IF NO DMS PACKAGE FOUND */}
                            {!serviceTiers.bronze.isDmsPackage && !serviceTiers.silver.isDmsPackage && !serviceTiers.gold.isDmsPackage && (
                                <div className="bg-sky-50 border border-sky-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sky-950">
                                    <div className="flex items-start gap-3">
                                        <Info size={20} className="text-sky-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <span className="font-bold text-sm block">
                                                No Direct DMS Service Package for {activeVehicle.make || 'Vehicle'} {activeVehicle.model || ''}{isV8 ? ' (V8 Engine)' : ''}
                                            </span>
                                            <span className="text-xs text-sky-800">
                                                We have loaded our calibrated {isV8 ? 'high-capacity V8 ' : ''}baseline packages below. You can select one of these or click to browse your complete workshop package catalogue.
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setServiceSourceTab('all-dms')}
                                        className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 shadow-sm"
                                    >
                                        <Search size={14} />
                                        Browse DMS Catalogue
                                    </button>
                                </div>
                            )}

                            {/* SERVICE SOURCE SELECTION TABS: RECOMMENDED TIERS VS LIVE DMS CATALOGUE */}
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                                            <Layers size={22} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 text-xl">Service Packages Selection</h3>
                                            <span className="text-xs text-slate-500">
                                                Matched for: <strong className="text-slate-800">{activeVehicle.make || 'Vehicle'} {activeVehicle.model || ''}</strong>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex bg-slate-200/80 p-1.5 rounded-2xl border border-slate-300 shadow-inner">
                                        <button
                                            type="button"
                                            onClick={() => setServiceSourceTab('tiered')}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                                                serviceSourceTab === 'tiered'
                                                    ? 'bg-white text-indigo-950 shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <Sparkles size={15} />
                                            Recommended Tiers
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setServiceSourceTab('all-dms')}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                                                serviceSourceTab === 'all-dms'
                                                    ? 'bg-white text-indigo-950 shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <Wrench size={15} />
                                            All Workshop Packages ({servicePackages.length})
                                        </button>
                                    </div>
                                </div>

                                {serviceSourceTab === 'tiered' ? (
                                    <div className="space-y-4">
                                        {selectedTier === 'custom' && selectedCustomPackage && (
                                            <div className="bg-indigo-50 border-2 border-indigo-500 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-md">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 bg-indigo-600 text-white rounded-2xl">
                                                        <CheckCircle2 size={24} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-600 text-white">
                                                                Active Selection: DMS Package
                                                            </span>
                                                            <span className="text-xs text-slate-500 font-mono">#{selectedCustomPackage.id}</span>
                                                        </div>
                                                        <h4 className="font-black text-lg text-slate-900 mt-0.5">{selectedCustomPackage.name}</h4>
                                                        <p className="text-xs text-slate-600">{selectedCustomPackage.description || 'Full Workshop Service Package'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <span className="text-2xl font-black text-indigo-950 font-mono block">
                                                            {formatCurrency(selectedCustomPackage.totalPrice || 0)}
                                                        </span>
                                                        <span className="text-xs text-slate-500">inc VAT</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setServiceSourceTab('all-dms')}
                                                        className="px-4 py-2.5 bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 rounded-xl text-xs font-bold transition shadow-xs"
                                                    >
                                                        Change Package
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        {/* BRONZE */}
                                        <div 
                                            onClick={() => {
                                                setSelectedTier('bronze');
                                                setSelectedCustomPackage(null);
                                            }}
                                            className={`rounded-3xl p-6 border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                                selectedTier === 'bronze' 
                                                    ? 'border-amber-500 bg-amber-50/50 shadow-xl ring-4 ring-amber-400/20' 
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-md border ${serviceTiers.bronze.tagColor}`}>
                                                        {serviceTiers.bronze.tag}
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-bold">{serviceTiers.bronze.hours} hrs</span>
                                                </div>
                                                <h4 className="font-black text-xl text-slate-900 mt-2">{serviceTiers.bronze.name}</h4>
                                                <p className="text-xs text-slate-500 mb-5">{serviceTiers.bronze.subtitle}</p>
                                                
                                                <div className="text-3xl font-black text-slate-900 mb-5 font-mono">
                                                    {formatCurrency(serviceTiers.bronze.priceGross)}
                                                    <span className="text-xs font-normal text-slate-500 ml-1.5">inc VAT</span>
                                                </div>

                                                <div className="space-y-2.5 text-sm text-slate-700">
                                                    {serviceTiers.bronze.highlights.map((h, i) => (
                                                        <div key={i} className="flex items-start gap-2.5">
                                                            <Check size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                                            <span>{h}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <button 
                                                type="button"
                                                className={`mt-8 w-full py-3 rounded-xl text-sm font-black transition ${
                                                    selectedTier === 'bronze' 
                                                        ? 'bg-amber-500 text-white shadow-md' 
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                {selectedTier === 'bronze' ? 'Selected Package' : 'Select Bronze'}
                                            </button>
                                        </div>

                                        {/* SILVER */}
                                        <div 
                                            onClick={() => {
                                                setSelectedTier('silver');
                                                setSelectedCustomPackage(null);
                                            }}
                                            className={`rounded-3xl p-6 border-2 cursor-pointer transition-all flex flex-col justify-between relative ${
                                                selectedTier === 'silver' 
                                                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xl ring-4 ring-indigo-500/20' 
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            {recommendedTier === 'silver' && (
                                                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-black uppercase px-4 py-1 rounded-full shadow-md">
                                                    Recommended for Mileage
                                                </span>
                                            )}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-md border ${serviceTiers.silver.tagColor}`}>
                                                        {serviceTiers.silver.tag}
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-bold">{serviceTiers.silver.hours} hrs</span>
                                                </div>
                                                <h4 className="font-black text-xl text-slate-900 mt-2">{serviceTiers.silver.name}</h4>
                                                <p className="text-xs text-slate-500 mb-5">{serviceTiers.silver.subtitle}</p>
                                                
                                                <div className="text-3xl font-black text-indigo-950 mb-5 font-mono">
                                                    {formatCurrency(serviceTiers.silver.priceGross)}
                                                    <span className="text-xs font-normal text-slate-500 ml-1.5">inc VAT</span>
                                                </div>

                                                <div className="space-y-2.5 text-sm text-slate-700">
                                                    {serviceTiers.silver.highlights.map((h, i) => (
                                                        <div key={i} className="flex items-start gap-2.5">
                                                            <Check size={16} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                                                            <span>{h}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <button 
                                                type="button"
                                                className={`mt-8 w-full py-3 rounded-xl text-sm font-black transition ${
                                                    selectedTier === 'silver' 
                                                        ? 'bg-indigo-600 text-white shadow-md' 
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                {selectedTier === 'silver' ? 'Selected Package' : 'Select Silver'}
                                            </button>
                                        </div>

                                        {/* GOLD */}
                                        <div 
                                            onClick={() => {
                                                setSelectedTier('gold');
                                                setSelectedCustomPackage(null);
                                            }}
                                            className={`rounded-3xl p-6 border-2 cursor-pointer transition-all flex flex-col justify-between relative ${
                                                selectedTier === 'gold' 
                                                    ? 'border-yellow-500 bg-yellow-50/50 shadow-xl ring-4 ring-yellow-400/20' 
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            {recommendedTier === 'gold' && (
                                                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-xs font-black uppercase px-4 py-1 rounded-full shadow-md">
                                                    Due by Age/Mileage
                                                </span>
                                            )}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-md border ${serviceTiers.gold.tagColor}`}>
                                                        {serviceTiers.gold.tag}
                                                    </span>
                                                    <span className="text-xs text-slate-500 font-bold">{serviceTiers.gold.hours} hrs</span>
                                                </div>
                                                <h4 className="font-black text-xl text-slate-900 mt-2">{serviceTiers.gold.name}</h4>
                                                <p className="text-xs text-slate-500 mb-5">{serviceTiers.gold.subtitle}</p>
                                                
                                                <div className="text-3xl font-black text-slate-900 mb-5 font-mono">
                                                    {formatCurrency(serviceTiers.gold.priceGross)}
                                                    <span className="text-xs font-normal text-slate-500 ml-1.5">inc VAT</span>
                                                </div>

                                                <div className="space-y-2.5 text-sm text-slate-700">
                                                    {serviceTiers.gold.highlights.map((h, i) => (
                                                        <div key={i} className="flex items-start gap-2.5">
                                                            <Check size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                                                            <span>{h}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <button 
                                                type="button"
                                                className={`mt-8 w-full py-3 rounded-xl text-sm font-black transition ${
                                                    selectedTier === 'gold' 
                                                        ? 'bg-amber-500 text-white shadow-md' 
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                {selectedTier === 'gold' ? 'Selected Package' : 'Select Gold'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                ) : (
                                    /* BROWSE ALL DMS PACKAGES CATALOGUE */
                                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="relative flex-1 min-w-[240px]">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input 
                                                    type="text" 
                                                    placeholder="Search workshop packages by name, make, model..."
                                                    value={packageSearchTerm}
                                                    onChange={e => setPackageSearchTerm(e.target.value)}
                                                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>

                                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none bg-slate-100 hover:bg-slate-200 px-3.5 py-2.5 rounded-xl border border-slate-200 transition">
                                                <input 
                                                    type="checkbox"
                                                    checked={filterCompatibleOnly}
                                                    onChange={e => setFilterCompatibleOnly(e.target.checked)}
                                                    className="w-4 h-4 text-indigo-600 rounded"
                                                />
                                                <span>Filter: {activeVehicle.make || 'Compatible'} Only</span>
                                            </label>

                                            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                                                Showing {scoredPackages.filter(sp => (!filterCompatibleOnly || isPackageCompatible(sp.pkg)) && (!packageSearchTerm || (sp.pkg.name || '').toLowerCase().includes(packageSearchTerm.toLowerCase()))).length} Packages
                                            </span>
                                        </div>

                                        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto border border-slate-200 rounded-2xl">
                                            {scoredPackages
                                                .filter(sp => (!filterCompatibleOnly || isPackageCompatible(sp.pkg)) && (!packageSearchTerm || (sp.pkg.name || '').toLowerCase().includes(packageSearchTerm.toLowerCase())))
                                                .map(({ pkg, score, matchType, color }) => {
                                                    const isSelected = selectedTier === 'custom' && selectedCustomPackage?.id === pkg.id;
                                                    return (
                                                        <div 
                                                            key={pkg.id}
                                                            onClick={() => {
                                                                setSelectedCustomPackage(pkg);
                                                                setSelectedTier('custom');
                                                            }}
                                                            className={`p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-indigo-50/60 transition ${
                                                                isSelected ? 'bg-indigo-50/90 border-l-4 border-indigo-600' : ''
                                                            }`}
                                                        >
                                                            <div className="flex-1 min-w-[200px]">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h4 className="font-bold text-slate-900 text-sm">{pkg.name}</h4>
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${color}`}>
                                                                        {matchType}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-500 line-clamp-1">{pkg.description || 'Full Workshop Service Package'}</p>
                                                                <div className="text-[11px] text-slate-400 mt-1">
                                                                    {pkg.costItems?.length ? `${pkg.costItems.length} cost items included` : 'Package flat rate'} • Bay: {pkg.applicableMake || 'All Makes'}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-4">
                                                                <div className="text-right">
                                                                    <span className="text-lg font-black text-slate-900 font-mono block">
                                                                        {formatCurrency(pkg.totalPrice || 0)}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400">inc VAT</span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                                                                        isSelected ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                                    }`}
                                                                >
                                                                    {isSelected ? 'Selected' : 'Select'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* NAVIGATION BUTTONS */}
                            <div className="flex justify-between pt-4">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(1)}
                                    className="px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-sm transition flex items-center gap-2"
                                >
                                    <ChevronLeft size={18} />
                                    Back to Client
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(3)}
                                    className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-base shadow-lg transition flex items-center gap-2"
                                >
                                    Proceed to Upsells & Bundles
                                    <ArrowRight size={20} />
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
                                <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 border-2 border-indigo-700/60 shadow-2xl space-y-5">
                                    <div className="flex items-center justify-between border-b border-indigo-800 pb-3">
                                        <div className="flex items-center gap-3">
                                            <Sparkles className="text-amber-400" size={24} />
                                            <h3 className="font-black text-amber-300 text-lg uppercase tracking-wider">
                                                [RECEPTIONIST UPSELL GUIDANCE]
                                            </h3>
                                        </div>
                                        <span className="text-xs font-mono text-indigo-300 bg-indigo-900/60 px-3 py-1 rounded-full border border-indigo-700">
                                            Internal Strategy • Maximise Order Value
                                        </span>
                                    </div>

                                    {/* 1. Age & Mileage Triggers */}
                                    <div className="bg-indigo-900/40 border border-indigo-700/50 rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-2">
                                                <Clock size={16} />
                                                1. Age & Mileage Trigger Pitch
                                            </span>
                                            <button 
                                                onClick={() => handleCopyScript(`"Based on your vehicle being ${vehicleAge} years old with ${currentMileage.toLocaleString()} miles, it is critically due for a ${recommendedTier.toUpperCase()} service interval because spark plugs, microfilters, and air elements reach strict manufacturer lifespan thresholds."`, 'trigger-script')}
                                                className="text-indigo-200 hover:text-white px-2 py-1 text-xs font-bold flex items-center gap-1 hover:bg-indigo-800 rounded transition"
                                            >
                                                {copiedScript === 'trigger-script' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                                <span>Copy Script</span>
                                            </button>
                                        </div>
                                        <p className="text-sm sm:text-base text-indigo-100 italic font-serif leading-relaxed">
                                            &ldquo;Based on this vehicle being <strong>{vehicleAge} years old / {currentMileage.toLocaleString()} miles</strong>, it is due for a <strong>{recommendedTier.toUpperCase()}</strong> service because spark plugs and cabin microfilters are critically required at this interval to safeguard fuel efficiency.&rdquo;
                                        </p>
                                    </div>

                                    {/* 2. Done Together Bundle Efficiencies */}
                                    <div className="bg-indigo-900/40 border border-indigo-700/50 rounded-2xl p-4 space-y-2">
                                        <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-2">
                                            <Wrench size={16} />
                                            2. The &ldquo;Done Together&rdquo; Bundle Discount Rationale
                                        </span>
                                        <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed">
                                            Highlight bundle labor efficiencies: When a car is already elevated on a two-post lift with undertrays and wheels off for brake inspection, bleeding the brake fluid or conducting an MOT takes half the logistical setup time. Offer the discounted rate (£75 vs £95) as an exclusive reward for booking together today.
                                        </p>
                                    </div>

                                    {/* 3. Preventative Maintenance Wear-and-Tear Checks */}
                                    <div className="bg-indigo-900/40 border border-indigo-700/50 rounded-2xl p-4 space-y-2">
                                        <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-2">
                                            <AlertTriangle size={16} />
                                            3. Preventative Maintenance Recommendations
                                        </span>
                                        <ul className="text-xs sm:text-sm text-indigo-200 space-y-1.5 list-disc pl-5">
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
                            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-black text-slate-900 text-xl flex items-center gap-2.5">
                                            <Sparkles size={24} className="text-amber-500" />
                                            &ldquo;Done Together&rdquo; Service Bundles
                                        </h3>
                                        <p className="text-sm text-slate-500 mt-0.5">
                                            Save time and money by combining essential maintenance while the vehicle is already elevated on the ramp.
                                        </p>
                                    </div>
                                    {pricingSummary.totalSavings > 0 && (
                                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-4 py-1.5 rounded-full text-sm font-black shadow-xs">
                                            Customer Saves £{pricingSummary.totalSavings.toFixed(2)}
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-3.5">
                                    {(scriptConfig.bundles && scriptConfig.bundles.length > 0 ? scriptConfig.bundles : BUNDLE_ADDONS).map(addon => {
                                        const isSelected = selectedAddonIds.includes(addon.id);
                                        const isRecommended = addon.recommendedIf ? addon.recommendedIf(vehicleAge, currentMileage, activeVehicle.fuelType) : false;

                                        return (
                                            <div 
                                                key={addon.id}
                                                onClick={() => toggleAddon(addon.id)}
                                                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                                                    isSelected 
                                                        ? 'border-indigo-600 bg-indigo-50/60 shadow-sm' 
                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                                }`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className={`mt-0.5 p-1 rounded-md ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                        {isSelected ? <CheckSquare size={24} /> : <Square size={24} />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2.5">
                                                            <h4 className="font-bold text-slate-900 text-base">{addon.name}</h4>
                                                            {isRecommended && (
                                                                <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full">
                                                                    Recommended
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-600 mb-1.5">{addon.description}</p>
                                                        
                                                        {mode === 'receptionist' && (
                                                            <div className="mt-2.5 bg-amber-50 text-amber-950 p-2.5 rounded-xl text-xs sm:text-sm font-serif italic border border-amber-200">
                                                                <span className="font-sans font-bold not-italic text-amber-900 block text-[11px] uppercase">Pitch Script:</span>
                                                                &ldquo;{addon.script}&rdquo;
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex md:flex-col items-end justify-between w-full md:w-auto flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                                                    <div className="text-right">
                                                        <span className="text-sm line-through text-slate-400 block font-mono">
                                                            £{addon.standalonePrice.toFixed(2)}
                                                        </span>
                                                        <span className="text-xl font-black text-indigo-950 font-mono">
                                                            £{addon.bundledPrice.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 mt-1">
                                                        Save £{(addon.standalonePrice - addon.bundledPrice).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* NAVIGATION BUTTONS */}
                            <div className="flex justify-between pt-4">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(2)}
                                    className="px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-sm transition flex items-center gap-2"
                                >
                                    <ChevronLeft size={18} />
                                    Back to Services
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(4)}
                                    className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-base shadow-lg transition flex items-center gap-2"
                                >
                                    Proceed to Confirmation
                                    <ArrowRight size={20} />
                                </button>
                            </div>
                        </div>
                    )}


                    {/* ======================================================== */}
                    {/* STEP 4: DATE SELECTION & BOOKING CONFIRMATION            */}
                    {/* ======================================================== */}
                    {currentStep === 4 && (
                        <div className="space-y-6 max-w-5xl mx-auto">
                            
                            {/* RECEPTIONIST CLOSING SCRIPT (LARGER TYPE) */}
                            {mode === 'receptionist' && (
                                <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-2">
                                            <Volume2 size={18} className="text-amber-700" />
                                            [What to Say: Closing the Booking]
                                        </span>
                                        <button 
                                            onClick={() => handleCopyScript(step4SpokenScript, 'step4-script')}
                                            className="text-amber-800 hover:text-amber-950 px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-200 rounded-lg transition"
                                        >
                                            {copiedScript === 'step4-script' ? <Check size={16} className="text-emerald-700" /> : <Copy size={16} />}
                                            <span>Copy Closing Script</span>
                                        </button>
                                    </div>
                                    <p className="text-base sm:text-lg italic text-amber-950 font-serif leading-relaxed">
                                        &ldquo;{step4SpokenScript}&rdquo;
                                    </p>
                                </div>
                            )}

                            {/* BOOKING SUMMARY REVIEW */}
                            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
                                <h3 className="font-bold text-slate-800 text-base uppercase tracking-wider flex items-center gap-2.5 border-b border-slate-100 pb-3">
                                    <ShieldCheck size={22} className="text-emerald-600" />
                                    Booking & Estimate Summary
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                                    <div className="p-4 bg-slate-50 rounded-2xl space-y-1.5">
                                        <span className="text-slate-400 font-bold uppercase text-xs">Client Details & GDPR</span>
                                        <div className="font-bold text-slate-900 text-base">
                                            {selectedCustomer ? getCustomerDisplayName(selectedCustomer) : `${newTitle} ${newForename} ${newSurname}`}
                                        </div>
                                        <div className="text-slate-600">Tel: {selectedCustomer?.phone || selectedCustomer?.mobile || newMobile || newPhone || 'No phone'}</div>
                                        <div className="text-slate-600">Email: {selectedCustomer?.email || newEmail || 'No email'}</div>
                                        <div className="text-slate-600">Postcode: {selectedCustomer?.postcode || newPostcode || 'No postcode'}</div>
                                        <div className="text-xs text-indigo-700 font-semibold pt-1">
                                            GDPR: Reminders ({serviceReminderConsent ? 'Yes' : 'No'}) • Marketing ({marketingConsent ? 'Yes' : 'No'}) • Channel: {communicationPreference}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 rounded-2xl space-y-1.5">
                                        <span className="text-slate-400 font-bold uppercase text-xs">Vehicle Details</span>
                                        <div className="font-bold text-slate-900 text-base font-mono">
                                            {activeVehicle.registration || vrmInput}
                                        </div>
                                        <div className="text-slate-600">{activeVehicle.make} {activeVehicle.model} ({activeVehicle.year || 'N/A'})</div>
                                        <div className="text-slate-600">Recorded Mileage: <strong>{currentMileage.toLocaleString()} miles</strong></div>
                                        <div className="text-slate-600">Workshop Bay: <strong>{selectedEntity.name}</strong></div>
                                    </div>
                                </div>

                                {/* Order Lines Table */}
                                <div className="border border-slate-200 rounded-2xl overflow-hidden mt-4">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                            <tr>
                                                <th className="py-3 px-4 text-left">Package / Service Item</th>
                                                <th className="py-3 px-4 text-center">Type</th>
                                                <th className="py-3 px-4 text-right">Price (inc VAT)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            <tr>
                                                <td className="py-3 px-4 font-bold text-slate-900">
                                                    {currentTierData.name}
                                                </td>
                                                <td className="py-3 px-4 text-center text-slate-500 font-semibold text-xs">Scheduled Service</td>
                                                <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                                    {formatCurrency(currentTierData.priceGross)}
                                                </td>
                                            </tr>
                                            {activeAddons.map(a => (
                                                <tr key={a.id} className="bg-indigo-50/40">
                                                    <td className="py-3 px-4 text-indigo-950 font-semibold">
                                                        [Done Together Bundle] {a.name}
                                                    </td>
                                                    <td className="py-3 px-4 text-center text-indigo-700 font-bold text-xs">
                                                        Done Together
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-mono font-bold text-indigo-900">
                                                        {formatCurrency(a.bundledPrice)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                                            <tr>
                                                <td colSpan={2} className="py-2.5 px-4 text-right text-slate-500">Net Labour & Parts:</td>
                                                <td className="py-2.5 px-4 text-right font-mono text-slate-700">{formatCurrency(pricingSummary.totalNet)}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan={2} className="py-2.5 px-4 text-right text-slate-500">VAT (20%):</td>
                                                <td className="py-2.5 px-4 text-right font-mono text-slate-700">{formatCurrency(pricingSummary.totalVat)}</td>
                                            </tr>
                                            <tr className="text-base bg-indigo-50 text-indigo-950 font-black">
                                                <td colSpan={2} className="py-3.5 px-4 text-right">Total Amount Payable:</td>
                                                <td className="py-3.5 px-4 text-right font-mono text-lg text-indigo-900">
                                                    {formatCurrency(pricingSummary.totalGross)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* ======================================================== */}
                                {/* WORKSHOP SCHEDULER & FINITE CAPACITY ENGINE INTEGRATION */}
                                {/* ======================================================== */}
                                <div className="mt-6 pt-5 border-t border-slate-200 space-y-5">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                                                <Gauge size={22} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 text-base">Workshop Capacity & Schedule Planning</h4>
                                                <p className="text-xs text-slate-500">
                                                    Live booking against {selectedEntity.name} ({maxDailyCapacity}h standard daily capacity)
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-500">Selected Date:</span>
                                            <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-xl font-bold text-xs text-indigo-950 font-mono">
                                                {formatReadableDate(bookingDate)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* INTERACTIVE WORKSHOP CALENDAR & CAPACITY STATUS */}
                                    <div className="bg-slate-50/80 rounded-3xl p-5 border border-slate-200">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleMonthOffset(-1)}
                                                    className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                                                    title="Previous Month"
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>
                                                <h5 className="font-black text-slate-800 text-sm tracking-wide">
                                                    {calendarDisplayMonth.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
                                                </h5>
                                                <button
                                                    type="button"
                                                    onClick={() => handleMonthOffset(1)}
                                                    className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                                                    title="Next Month"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-3 text-[11px] font-bold">
                                                <span className="flex items-center gap-1 text-emerald-700">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Available
                                                </span>
                                                <span className="flex items-center gap-1 text-amber-700">
                                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> Busy (&gt;80%)
                                                </span>
                                                <span className="flex items-center gap-1 text-rose-700">
                                                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> Full
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const today = new Date();
                                                        setCalendarDisplayMonth(new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)));
                                                        setBookingDate(formatDate(today));
                                                    }}
                                                    className="ml-2 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900 font-semibold"
                                                >
                                                    Today
                                                </button>
                                            </div>
                                        </div>

                                        {/* Day of Week Headers */}
                                        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 mb-2 border-b border-slate-200 pb-1.5">
                                            <div>Sun</div>
                                            <div>Mon</div>
                                            <div>Tue</div>
                                            <div>Wed</div>
                                            <div>Thu</div>
                                            <div>Fri</div>
                                            <div>Sat</div>
                                        </div>

                                        {/* Calendar Month Grid */}
                                        <div className="grid grid-cols-7 gap-1.5">
                                            {calendarMonthDays.map((cell) => {
                                                if (cell.isPlaceholder) {
                                                    return <div key={cell.key} className="h-14"></div>;
                                                }

                                                const cap = cell.capInfo;
                                                const isSelected = cell.isSelected;
                                                const isToday = cell.isToday;

                                                return (
                                                    <button
                                                        key={cell.key}
                                                        type="button"
                                                        onClick={() => {
                                                            if (cell.dateStr && !cap.isClosed) {
                                                                setBookingDate(cell.dateStr);
                                                            }
                                                        }}
                                                        disabled={cap.isClosed}
                                                        className={`h-14 p-1.5 rounded-2xl flex flex-col justify-between text-left transition-all relative ${
                                                            cap.isClosed
                                                                ? 'bg-slate-100/60 text-slate-300 cursor-not-allowed border border-transparent'
                                                                : isSelected
                                                                    ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-500 ring-offset-2'
                                                                    : 'bg-white hover:bg-indigo-50/50 border border-slate-200 text-slate-800'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between w-full">
                                                            <span className={`text-xs font-black ${
                                                                isSelected ? 'text-white' : isToday ? 'text-indigo-600 font-black' : 'text-slate-800'
                                                            }`}>
                                                                {cell.day}
                                                            </span>
                                                            {isToday && (
                                                                <span className={`text-[9px] font-bold px-1 rounded ${
                                                                    isSelected ? 'bg-indigo-800 text-white' : 'bg-indigo-100 text-indigo-700'
                                                                }`}>
                                                                    TODAY
                                                                </span>
                                                            )}
                                                        </div>

                                                        {!cap.isClosed ? (
                                                            <div className="flex items-center justify-between w-full mt-auto">
                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                                                    isSelected 
                                                                        ? 'bg-white/20 text-white' 
                                                                        : cap.badgeColor
                                                                }`}>
                                                                    {cap.status === 'Overloaded' ? 'Full' : cap.status === 'High Load' ? 'Busy' : 'Open'}
                                                                </span>
                                                                <span className={`text-[9px] font-mono font-semibold ${
                                                                    isSelected ? 'text-indigo-200' : 'text-slate-400'
                                                                }`}>
                                                                    {cap.currentBookedHours.toFixed(0)}h/{cap.effectiveCapacity.toFixed(0)}h
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[9px] text-slate-400 font-medium">Closed</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* REAL-TIME WORKSHOP CAPACITY MONITOR & BAR */}
                                    <div className={`p-5 rounded-2xl border transition-all ${
                                        selectedDateCapacity.status === 'Overloaded'
                                            ? 'bg-rose-50/80 border-rose-300'
                                            : selectedDateCapacity.status === 'High Load'
                                                ? 'bg-amber-50/80 border-amber-300'
                                                : 'bg-emerald-50/80 border-emerald-300'
                                    }`}>
                                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-2">
                                                <Gauge size={20} className={
                                                    selectedDateCapacity.status === 'Overloaded'
                                                        ? 'text-rose-600'
                                                        : selectedDateCapacity.status === 'High Load'
                                                            ? 'text-amber-600'
                                                            : 'text-emerald-600'
                                                } />
                                                <span className="font-black text-sm text-slate-900">
                                                    Workshop Loading for {formatReadableDate(bookingDate)}:
                                                </span>
                                                <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full border ${selectedDateCapacity.badgeColor}`}>
                                                    {selectedDateCapacity.status} ({Math.round(selectedDateCapacity.loadRatio * 100)}% Capacity)
                                                </span>
                                            </div>

                                            <div className="text-xs font-mono font-bold text-slate-700">
                                                {selectedDateCapacity.remainingCapacity.toFixed(1)}h remaining wrench time
                                            </div>
                                        </div>

                                        {/* Capacity Progress Bar */}
                                        <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden flex shadow-inner">
                                            {/* Existing Booked Hours */}
                                            <div 
                                                className="bg-indigo-600 h-full transition-all duration-500" 
                                                style={{ width: `${Math.min(100, (selectedDateCapacity.currentBookedHours / selectedDateCapacity.effectiveCapacity) * 100)}%` }}
                                                title={`Existing Bookings: ${selectedDateCapacity.currentBookedHours.toFixed(1)}h`}
                                            ></div>
                                            {/* This Job Duration */}
                                            <div 
                                                className={`${
                                                    selectedDateCapacity.status === 'Overloaded' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                                                } h-full transition-all duration-500`}
                                                style={{ width: `${Math.min(100, (pricingSummary.totalHours / selectedDateCapacity.effectiveCapacity) * 100)}%` }}
                                                title={`This Job: +${pricingSummary.totalHours.toFixed(1)}h`}
                                            ></div>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs text-slate-600">
                                            <span>
                                                Current Booked: <strong>{selectedDateCapacity.currentBookedHours.toFixed(1)}h</strong>
                                                {' • '}This Booking: <strong>+{pricingSummary.totalHours.toFixed(1)}h</strong>
                                            </span>
                                            <span>
                                                Effective Capacity: <strong>{selectedDateCapacity.effectiveCapacity.toFixed(1)}h</strong>
                                                {selectedDateCapacity.absenceHours > 0 && ` (${selectedDateCapacity.absenceHours}h technician absence)`}
                                            </span>
                                        </div>

                                        {/* OVERLOADED WARNING & NEXT AVAILABLE DATE ASSISTANT */}
                                        {selectedDateCapacity.status === 'Overloaded' && (
                                            <div className="mt-4 pt-3 border-t border-rose-200 space-y-3">
                                                <div className="flex items-start gap-2.5 text-rose-900 text-xs font-semibold">
                                                    <AlertTriangle size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <span>This date is fully booked (+{(selectedDateCapacity.projectedHours - selectedDateCapacity.effectiveCapacity).toFixed(1)}h over workshop capacity).</span>
                                                        {suggestedNextAvailableDate && (
                                                            <div className="mt-1 font-normal text-rose-950">
                                                                Recommended slot with guaranteed capacity: <strong>{formatReadableDate(suggestedNextAvailableDate)}</strong>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                                    {suggestedNextAvailableDate && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setBookingDate(suggestedNextAvailableDate)}
                                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                                                        >
                                                            <CalendarCheck size={16} />
                                                            Switch to {formatReadableDate(suggestedNextAvailableDate)}
                                                        </button>
                                                    )}

                                                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-rose-300 select-none">
                                                        <input 
                                                            type="checkbox"
                                                            checked={allowOverbooking}
                                                            onChange={e => setAllowOverbooking(e.target.checked)}
                                                            className="w-4 h-4 text-rose-600 rounded"
                                                        />
                                                        <span className="text-xs font-bold text-rose-950">
                                                            Authorize Workshop Overbooking / Overtime
                                                        </span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Logistics & Customer Notes */}
                                    <div className="pt-2">
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Logistics & Customer Special Notes
                                        </label>
                                        <input 
                                            type="text"
                                            value={bookingNotes}
                                            onChange={e => setBookingNotes(e.target.value)}
                                            placeholder="e.g. Needs car by 4pm; customer waiting in lounge; requires courtesy vehicle"
                                            className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* CUSTOMER CONFIRMATION & ESTIMATE EMAIL DISPATCH */}
                            <div className="bg-indigo-50/70 border-2 border-indigo-200 rounded-3xl p-6 space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-200/80 pb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-indigo-600 text-white rounded-xl">
                                            <Mail size={18} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-base">Email Estimate & Booking Confirmation to Customer</h4>
                                            <p className="text-xs text-slate-500">
                                                Instantly deliver booking date, time, and full itemised estimate breakdown to the customer.
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowEmailPreview(!showEmailPreview)}
                                        className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-indigo-200 shadow-xs transition"
                                    >
                                        <Eye size={14} />
                                        {showEmailPreview ? 'Hide Email Preview' : 'Preview Email'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Recipient Customer Email Address
                                        </label>
                                        <input 
                                            type="email"
                                            value={customerConfirmationEmail}
                                            onChange={e => setCustomerConfirmationEmail(e.target.value)}
                                            placeholder="customer@example.com"
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2 pt-5 sm:pt-0">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input 
                                                type="checkbox"
                                                checked={sendEmailConfirmation}
                                                onChange={e => setSendEmailConfirmation(e.target.checked)}
                                                className="w-4 h-4 text-indigo-600 rounded"
                                            />
                                            <span className="text-xs font-bold text-slate-800">
                                                Auto-send when confirming booking
                                            </span>
                                        </label>

                                        <button
                                            type="button"
                                            onClick={handleSendDirectEmail}
                                            disabled={isSendingDirectEmail || !customerConfirmationEmail}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs"
                                        >
                                            <Send size={13} />
                                            {isSendingDirectEmail ? 'Sending...' : 'Send Email Now'}
                                        </button>
                                    </div>
                                </div>

                                {showEmailPreview && (
                                    <div className="mt-3 p-4 bg-white rounded-2xl border border-indigo-200 text-xs space-y-2">
                                        <div className="font-bold text-slate-800 border-b pb-1">
                                            Subject: <span className="font-mono text-indigo-900">{generatedEmailContent.subject}</span>
                                        </div>
                                        <pre className="font-sans whitespace-pre-wrap text-slate-700 text-xs leading-relaxed max-h-56 overflow-y-auto bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            {generatedEmailContent.body}
                                        </pre>
                                    </div>
                                )}
                            </div>

                            {/* ACTION BUTTONS */}
                            <div className="flex flex-wrap items-center justify-between gap-4 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(3)}
                                    className="px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-sm transition flex items-center gap-2"
                                >
                                    <ChevronLeft size={18} />
                                    Back to Bundles
                                </button>

                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={() => handleConfirmBooking('estimate')}
                                        className="px-6 py-3 border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 rounded-2xl font-bold text-sm transition disabled:opacity-50"
                                    >
                                        Save as Formal Estimate
                                    </button>

                                    <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={() => handleConfirmBooking('job')}
                                        className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-base shadow-xl transition flex items-center gap-2.5 disabled:opacity-50"
                                    >
                                        <CheckCircle2 size={20} />
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
