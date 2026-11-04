import { getItem, setItem } from '../db';

export interface BookingScriptAddon {
    id: string;
    name: string;
    description: string;
    standalonePrice: number;
    bundledPrice: number;
    laborHours: number;
    isLabor: boolean;
    reason: string;
    script: string;
    minAgeYears?: number;
}

export interface BookingAssistantConfig {
    scripts: {
        step1GreetingNew: string;
        step1GreetingExisting: string;
        step1ActionNotes: string;
        step2Presentation: string;
        step4Closing: string;
    };
    bundles: BookingScriptAddon[];
    emailConfirmation: {
        subjectTemplate: string;
        bodyTemplate: string;
        autoSendDefault: boolean;
    };
}

export const DEFAULT_BOOKING_ASSISTANT_CONFIG: BookingAssistantConfig = {
    scripts: {
        step1GreetingNew: "Good morning, thank you for calling {companyName}. My name is {staffName}. I would be delighted to help book your vehicle today. May I start with your vehicle registration plate, please?",
        step1GreetingExisting: "Thank you, I can see your {vehicleMake} {vehicleModel} on file registered to {customerName} at {customerAddress}. Is that still all correct?",
        step1ActionNotes: "1. Enter Reg to auto-search DMS.\n2. If existing: confirm address, mobile, and GDPR.\n3. If new: system verifies with DVLA and captures contact preferences.",
        step2Presentation: "To ensure your {vehicleMake} receives the right care, our baseline service is our {tierName} from {tierPrice}. Depending on its mileage of {mileage} miles, we also offer our comprehensive Silver Interim and Gold Major services which include full suspension, brake teardowns, and filter renewals.",
        step4Closing: "Thank you so much. I have reserved {bookingDate} for your {vehicleMake}'s {tierName}{bundleList}. We'll send a full booking confirmation to your {communicationPreference}. Can we arrange a courtesy vehicle or lift into town for you?"
    },
    bundles: [
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
            minAgeYears: 2
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
            minAgeYears: 3
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
            minAgeYears: 2
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
            minAgeYears: 4
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
            minAgeYears: 1
        }
    ],
    emailConfirmation: {
        subjectTemplate: "Estimate & Booking Confirmation: {vehicleReg} on {bookingDate} - {companyName}",
        bodyTemplate: 
`Dear {customerName},

Thank you for choosing {companyName}. We are pleased to confirm your vehicle booking and estimate details:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VEHICLE & BOOKING SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Vehicle:      {vehicleMake} {vehicleModel} ({vehicleReg})
Booking Date: {bookingDate}
Scheduled:    {tierName}
{bundleSummary}
Total Estimate: {totalGross} (inc. VAT)
Workshop Bay: {workshopName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOGISTICS & IMPORTANT NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{bookingNotes}
Please drop your vehicle off with our service reception between 8:00 AM and 9:00 AM on the morning of your booking.

If you have requested a courtesy vehicle or need to adjust your booking date, please reply to this email or call our service desk directly on {companyPhone}.

We look forward to welcoming you and your vehicle.

Kind regards,
Service Reception Team
{companyName}
Tel: {companyPhone}
Email: {companyEmail}`,
        autoSendDefault: true
    }
};

const STORAGE_KEY = 'booking_assistant_config';

export const getBookingAssistantConfig = async (): Promise<BookingAssistantConfig> => {
    try {
        const stored = await getItem<BookingAssistantConfig>(STORAGE_KEY);
        if (!stored) return DEFAULT_BOOKING_ASSISTANT_CONFIG;

        return {
            scripts: {
                ...DEFAULT_BOOKING_ASSISTANT_CONFIG.scripts,
                ...(stored.scripts || {})
            },
            bundles: Array.isArray(stored.bundles) && stored.bundles.length > 0 
                ? stored.bundles 
                : DEFAULT_BOOKING_ASSISTANT_CONFIG.bundles,
            emailConfirmation: {
                ...DEFAULT_BOOKING_ASSISTANT_CONFIG.emailConfirmation,
                ...(stored.emailConfirmation || {})
            }
        };
    } catch (err) {
        console.error('Failed to load booking assistant config from storage:', err);
        return DEFAULT_BOOKING_ASSISTANT_CONFIG;
    }
};

export const saveBookingAssistantConfig = async (config: BookingAssistantConfig): Promise<void> => {
    await setItem(STORAGE_KEY, config);
};

export const interpolateScript = (template: string, vars: Record<string, string | number>): string => {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        result = result.replace(regex, String(value ?? ''));
    }
    return result;
};

