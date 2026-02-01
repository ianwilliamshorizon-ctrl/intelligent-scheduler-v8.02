import {
  BusinessEntity, Customer, Vehicle, Job, JobSegment, Lift, Engineer, Invoice,
  Supplier, Estimate, TaxRate, ServicePackage, Part, SaleVehicle, SaleOverheadPackage,
  StorageBooking, RentalVehicle, RentalBooking, StorageLocation, BatteryCharger, EstimateLineItem,
  User, NominalCode, NominalCodeRule, PurchaseOrder, Purchase, AbsenceRequest
} from '../types';
import { getRelativeDate, formatDate, splitJobIntoSegments } from '../utils/dateUtils';
import { generateCustomerId } from '../utils/customerUtils';
import { generateJobId, generateEstimateNumber, generateInvoiceId } from '../utils/numberGenerators';
// FIX: import calculateJobStatus
import { calculateJobStatus } from '../utils/jobUtils';

// --- Data Generation ---

// FIX: Explicitly cast the array of user objects to `User[]` to prevent TypeScript from widening the `role` property's type to a generic `string`, which caused a type mismatch with the expected `UserRole` union type.
export const getInitialUsers = (): User[] => ([
    { id: 'user_admin', name: 'Admin User', role: 'Admin', holidayApproverId: 'user_admin', holidayEntitlement: 26 },
    { id: 'user_sales', name: 'Sales User', role: 'Sales', holidayApproverId: 'user_admin', holidayEntitlement: 26 },
    // Dispatchers
    { id: 'user_phil_f', name: 'Phil F', role: 'Dispatcher', holidayApproverId: 'user_admin', holidayEntitlement: 26 },
    { id: 'user_tim', name: 'Tim', role: 'Dispatcher', holidayApproverId: 'user_admin', holidayEntitlement: 26 },
    { id: 'user_phil', name: 'Phil', role: 'Dispatcher', holidayApproverId: 'user_admin', holidayEntitlement: 26 },
    // Porsche Engineers
    { id: 'user_lewis', name: 'Lewis', role: 'Engineer', engineerId: 'eng_lewis', holidayApproverId: 'user_phil_f', holidayEntitlement: 26 },
    { id: 'user_emma', name: 'Emma', role: 'Engineer', engineerId: 'eng_emma', holidayApproverId: 'user_phil_f', holidayEntitlement: 26 },
    { id: 'user_gary', name: 'Gary', role: 'Engineer', engineerId: 'eng_gary', holidayApproverId: 'user_phil_f', holidayEntitlement: 26 },
    { id: 'user_olly', name: 'Olly', role: 'Engineer', engineerId: 'eng_olly', holidayApproverId: 'user_phil_f', holidayEntitlement: 26 },
    // Audi Engineers
    { id: 'user_mike_audi', name: 'Mike', role: 'Engineer', engineerId: 'eng_mike_audi', holidayApproverId: 'user_phil', holidayEntitlement: 26 },
    { id: 'user_dan', name: 'Dan', role: 'Engineer', engineerId: 'eng_dan', holidayApproverId: 'user_phil', holidayEntitlement: 26 },
    { id: 'user_sam', name: 'Sam', role: 'Engineer', engineerId: 'eng_sam', holidayApproverId: 'user_phil', holidayEntitlement: 26 },
    // Trimming Engineer
    { id: 'user_vincent', name: 'Vincent', role: 'Engineer', engineerId: 'eng_vincent', holidayApproverId: 'user_tim', holidayEntitlement: 26 },
] as User[]).sort((a, b) => a.name.localeCompare(b.name));

export const getInitialBusinessEntities = (): BusinessEntity[] => ([
    {
        id: 'ent_porsche', name: 'Brookspeed Porsche & Performance', type: 'Workshop', color: 'blue', shortCode: 'BPP', laborRate: 125, laborCostRate: 45, dailyCapacityHours: 40,
        addressLine1: '14-15 Test Lane', city: 'Southampton', postcode: 'SO16 9JX', vatNumber: 'GB 123 4567 89', companyNumber: '12345678',
        bankAccountName: 'Brookspeed Ltd', bankSortCode: '20-00-00', bankAccountNumber: '12345678', invoiceFooterText: 'Thank you for your business. Please pay within 30 days.',
        motReminderEmailTemplate: `Dear [CustomerName],\n\nThis is a friendly reminder from Brookspeed that your [VehicleDescription] is due for its annual MOT test on [DueDate].\n\nPlease contact us on 023 8064 1672 to book an appointment.\n\nKind regards,\nThe Brookspeed Team`,
        motReminderSmsTemplate: `Hi [CustomerName], a reminder from Brookspeed. Your [Registration] MOT is due on [DueDate]. Call 023 8064 1672 to book. Thanks.`,
        serviceReminderEmailTemplate: `Dear [CustomerName],\n\nAccording to our records, your [VehicleDescription] is due for its service on [DueDate].\n\nMaintaining your service schedule is vital for your vehicle's health and resale value.\n\nPlease call us on 023 8064 1672 to book your appointment.\n\nKind regards,\nThe Brookspeed Team`,
        serviceReminderSmsTemplate: `Hi [CustomerName], a reminder from Brookspeed. Your [Registration] service is due on [DueDate]. Call 023 8064 1672 to book. Thanks.`,
        winterCheckReminderEmailTemplate: `Dear [CustomerName],\n\nAs the colder months approach, we recommend a Winter Check for your [VehicleDescription] to ensure it's ready for the season. Please call us on 023 8064 1672 to book.\n\nKind regards,\nThe Brookspeed Team`,
        winterCheckReminderSmsTemplate: `Hi [CustomerName], beat the cold with a Winter Check for your [Registration]. Call Brookspeed on 023 8064 1672 to book. Thanks.`,
    },
    { 
        id: 'ent_audi', name: 'Brookspeed Audi & VW', type: 'Workshop', color: 'gray', shortCode: 'BAV', laborRate: 110, laborCostRate: 40, dailyCapacityHours: 24,
        motReminderEmailTemplate: `Dear [CustomerName],\n\nThis is a reminder that the MOT for your [VehicleDescription] is due on [DueDate]. Please contact Brookspeed Audi & VW to book your appointment.\n\nRegards,\nThe Service Team`,
        motReminderSmsTemplate: `Hi [CustomerName], your [Registration] MOT is due on [DueDate]. Call Brookspeed Audi & VW to book. Thanks.`,
        serviceReminderEmailTemplate: `Dear [CustomerName],\n\nYour [VehicleDescription] is due for its service on [DueDate]. To maintain your vehicle's warranty and performance, please book your appointment with Brookspeed Audi & VW.\n\nRegards,\nThe Service Team`,
        serviceReminderSmsTemplate: `Hi [CustomerName], your [Registration] service is due on [DueDate]. Call Brookspeed Audi & VW to book. Thanks.`,
        winterCheckReminderEmailTemplate: `Dear [CustomerName],\n\nPrepare for winter. A Winter Check for your [VehicleDescription] is recommended. Contact Brookspeed Audi & VW to book.\n\nRegards,\nThe Service Team`,
        winterCheckReminderSmsTemplate: `Hi [CustomerName], get your [Registration] winter-ready. Book a Winter Check with Brookspeed Audi & VW. Thanks.`,
    },
    { 
        id: 'ent_trimming', name: 'Brookspeed Trimming', type: 'Workshop', color: 'yellow', shortCode: 'BTR', laborRate: 95, laborCostRate: 35, dailyCapacityHours: 16,
        motReminderEmailTemplate: `Dear [CustomerName],\n\nThis is a reminder that the MOT for your [VehicleDescription] is due on [DueDate]. Please contact Brookspeed Trimming to book your appointment.\n\nRegards,\nThe Service Team`,
        motReminderSmsTemplate: `Hi [CustomerName], your [Registration] MOT is due on [DueDate]. Call Brookspeed Trimming to book. Thanks.`,
        serviceReminderEmailTemplate: `Dear [CustomerName],\n\nYour [VehicleDescription] is due for its service on [DueDate]. Please book your appointment with Brookspeed Trimming.\n\nRegards,\nThe Service Team`,
        serviceReminderSmsTemplate: `Hi [CustomerName], your [Registration] service is due on [DueDate]. Call Brookspeed Trimming to book. Thanks.`,
        winterCheckReminderEmailTemplate: `Dear [CustomerName],\n\nPrepare for winter. A Winter Check for your [VehicleDescription] is recommended. Contact Brookspeed Trimming to book.\n\nRegards,\nThe Service Team`,
        winterCheckReminderSmsTemplate: `Hi [CustomerName], get your [Registration] winter-ready. Book a Winter Check with Brookspeed Trimming. Thanks.`,
    },
    { 
        id: 'ent_sales', name: 'Brookspeed Sales', type: 'Sales', color: 'green', shortCode: 'BSA',
        sorTermsAndConditions: `1. The vehicle remains the property of the owner until the full sale price is received from the buyer.\n2. Brookspeed agrees to market the vehicle at the agreed list price.\n3. Any preparation costs incurred by Brookspeed must be settled by the owner from the sale proceeds.\n4. While in our care, the vehicle is covered by our comprehensive motor trade insurance policy. The owner may wish to declare the vehicle as SORN with the DVLA and suspend their personal insurance policy. Please confirm with your insurer.`
    },
    { id: 'ent_storage', name: 'Brookspeed Secure Storage', type: 'Storage', color: 'purple', shortCode: 'BSS', storageCapacity: 50, defaultWeeklyStorageRate: 75 },
    { id: 'ent_rentals', name: 'Brookspeed Rentals', type: 'Rentals', color: 'pink', shortCode: 'BRE' }
]);

export const getInitialTaxRates = (): TaxRate[] => ([
    { id: 'tax_1', code: 'T0', name: 'VAT Exempt', rate: 0 },
    { id: 'tax_2', code: 'T1', name: 'Standard VAT', rate: 20 },
]);

export const getInitialCustomers = (): Customer[] => {
    const customers: Customer[] = [
        { id: 'OCON0001', forename: 'Liam', surname: "O'Connell", phone: '07700900101', email: 'liam.oc@example.com', addressLine1: '12 Porsche Drive', city: 'Southampton', postcode: 'SO15 1XX', createdDate: getRelativeDate(-120), marketingConsent: true, serviceReminderConsent: true, communicationPreference: 'Email' },
        { id: 'ROSS0001', forename: 'Sophia', surname: 'Rossi', phone: '07700900102', mobile: '07700900102', email: 'sophia.r@example.com', addressLine1: '8 Audi Avenue', city: 'Winchester', postcode: 'SO23 8YY', createdDate: getRelativeDate(-110), marketingConsent: false, serviceReminderConsent: true, communicationPreference: 'SMS' },
        { id: 'CART0001', forename: 'Ben', surname: 'Carter', phone: '07700900103', email: 'ben.carter@example.com', addressLine1: '21 Transporter Terrace', city: 'Eastleigh', postcode: 'SO50 5ZZ', createdDate: getRelativeDate(-100), isBusinessCustomer: true, companyName: 'Carter Couriers', serviceReminderConsent: true, marketingConsent: false },
        { id: 'DUBO0001', forename: 'Chloe', surname: 'Dubois', phone: '07700900104', email: 'chloe.d@example.com', addressLine1: '5 Cayman Court', city: 'Lyndhurst', postcode: 'SO43 7AA', createdDate: getRelativeDate(-90), marketingConsent: true, serviceReminderConsent: true },
        { id: 'THOR0001', forename: 'Marcus', surname: 'Thorne', phone: '07700900105', email: 'marcus.thorne@example.com', addressLine1: '1 Mclaren Mews', city: 'Salisbury', postcode: 'SP1 2BB', createdDate: getRelativeDate(-80), marketingConsent: true, serviceReminderConsent: true },
        { id: 'RACI0001', isBusinessCustomer: true, companyName: 'The Racing Team', title: 'Mr', forename: 'Frank', surname: 'Williams', phone: '01234 567890', email: 'race@team.com', addressLine1: 'The Paddock, Thruxton', city: 'Andover', postcode: 'SP11 8PW', createdDate: getRelativeDate(-70), marketingConsent: false, category: 'Trade', serviceReminderConsent: false },
        { id: 'CHEN0001', forename: 'Isabelle', surname: 'Chen', phone: '07700900107', email: 'isabelle.c@example.com', addressLine1: '32 Civic Street', city: 'Basingstoke', postcode: 'RG21 3CC', createdDate: getRelativeDate(-60), marketingConsent: false, serviceReminderConsent: true, communicationPreference: 'Email' },
        { id: 'VINT0001', isBusinessCustomer: true, companyName: 'Vintage Classics Ltd', title: 'Ms', forename: 'Eleanor', surname: 'Vance', phone: '01962 112233', email: 'enquiries@vintageclassics.com', addressLine1: 'The Old Hangar', city: 'Goodwood', postcode: 'PO18 0PH', createdDate: getRelativeDate(-50), marketingConsent: true, category: 'Trade', serviceReminderConsent: false },
        { id: 'WRIG0001', forename: 'Ethan', surname: 'Wright', phone: '07700900109', email: 'ethan.w@example.com', addressLine1: '9 Custom Close', city: 'Portsmouth', postcode: 'PO1 3DD', createdDate: getRelativeDate(-40), isBusinessCustomer: true, companyName: 'Wright Electricals', marketingConsent: false, serviceReminderConsent: false },
        { id: 'PETR0001', forename: 'Olivia', surname: 'Petrova', phone: '07700900110', email: 'olivia.p@example.com', addressLine1: '18 Competition Crescent', city: 'Bournemouth', postcode: 'BH1 1EE', createdDate: getRelativeDate(-30), marketingConsent: true, serviceReminderConsent: true },
    ];
    // Add cash customer
    const cashCustomerId = generateCustomerId('Cash', customers);
    customers.push({ id: cashCustomerId, forename: 'Cash', surname: 'Sale', phone: 'N/A', createdDate: getRelativeDate(-100), isCashCustomer: true, marketingConsent: false, serviceReminderConsent: false });
    return customers;
};
export const getInitialVehicles = (): Vehicle[] => ([
    { id: 'veh_1', customerId: 'OCON0001', registration: 'GT3 RS', make: 'Porsche', model: '911 GT3 RS', nextMotDate: getRelativeDate(28), nextServiceDate: getRelativeDate(50) },
    { id: 'veh_2', customerId: 'ROSS0001', registration: 'RS6 V10', make: 'Audi', model: 'RS6 Avant', nextMotDate: getRelativeDate(15), winterCheckDate: getRelativeDate(25) },
    { id: 'veh_3', customerId: 'CART0001', registration: 'T6 BEN', make: 'Volkswagen', model: 'Transporter', nextMotDate: getRelativeDate(90), nextServiceDate: getRelativeDate(90) },
    { id: 'veh_4', customerId: 'DUBO0001', registration: 'GT4 CJD', make: 'Porsche', model: 'Cayman GT4', nextMotDate: getRelativeDate(180) },
    { id: 'veh_5', customerId: 'THOR0001', registration: 'M720 S', make: 'McLaren', model: '720S', nextServiceDate: getRelativeDate(45) },
    { id: 'veh_6', customerId: 'RACI0001', registration: 'CUP 1', make: 'Porsche', model: '911 Cup Car', vin: 'WP0ZZZ99ZHS7XXXXX' },
    { id: 'veh_7', customerId: 'CHEN0001', registration: 'R56 HGF', make: 'Honda', model: 'Civic', nextMotDate: getRelativeDate(10) },
    { id: 'veh_8', customerId: 'VINT0001', registration: 'E TYPE', make: 'Jaguar', model: 'E-Type Series 1', vin: 'J61XXXXXX' },
    { id: 'veh_9', customerId: 'WRIG0001', registration: 'WR16 HTE', make: 'Ford', model: 'Transit Custom', nextMotDate: getRelativeDate(120), nextServiceDate: getRelativeDate(150) },
    { id: 'veh_10', customerId: 'PETR0001', registration: 'M4 OLP', make: 'BMW', model: 'M4 Competition', nextServiceDate: getRelativeDate(200) },
]);

// FIX: Removed T. namespace
export const getInitialLifts = (): Lift[] => ([
    { id: 'lift_p1', entityId: 'ent_porsche', name: 'Lift 1', type: 'General', color: 'blue' },
    { id: 'lift_p2', entityId: 'ent_porsche', name: 'Lift 2', type: 'General', color: 'blue' },
    { id: 'lift_p3', entityId: 'ent_porsche', name: 'Lift 3', type: 'General', color: 'blue' },
    { id: 'lift_p4', entityId: 'ent_porsche', name: 'Lift 4', type: 'General', color: 'blue' },
    { id: 'lift_p5', entityId: 'ent_porsche', name: 'Lift 5', type: 'General', color: 'blue' },
    { id: 'lift_p6', entityId: 'ent_porsche', name: 'Lift 6', type: 'General', color: 'blue' },
    { id: 'lift_mot_p', entityId: 'ent_porsche', name: 'Lift 7 / MOT', type: 'MOT', color: 'orange' },
    { id: 'lift_a1', entityId: 'ent_audi', name: 'Lift A1', type: 'General', color: 'gray' },
    { id: 'lift_a2', entityId: 'ent_audi', name: 'Lift A2', type: 'General', color: 'gray' },
    { id: 'lift_a3', entityId: 'ent_audi', name: 'Lift A3', type: 'General', color: 'gray' },
    { id: 'lift_mot_a', entityId: 'ent_audi', name: 'MOT Bay A', type: 'MOT', color: 'orange' },
    { id: 'lift_t1', entityId: 'ent_trimming', name: 'Trimming Bay 1', type: 'Trimming', color: 'yellow' },
    { id: 'lift_t2', entityId: 'ent_trimming', name: 'Trimming Bay 2', type: 'Trimming', color: 'yellow' },
]);

// FIX: Removed T. namespace
export const getInitialEngineers = (): Engineer[] => ([
    { id: 'eng_lewis', entityId: 'ent_porsche', name: 'Lewis', specialization: 'Porsche Specialist' },
    { id: 'eng_emma', entityId: 'ent_porsche', name: 'Emma', specialization: 'Porsche Specialist' },
    { id: 'eng_gary', entityId: 'ent_porsche', name: 'Gary', specialization: 'General Technician' },
    { id: 'eng_olly', entityId: 'ent_porsche', name: 'Olly', specialization: 'General Technician' },
    { id: 'eng_mike_audi', entityId: 'ent_audi', name: 'Mike', specialization: 'VW Group Specialist' },
    { id: 'eng_dan', entityId: 'ent_audi', name: 'Dan', specialization: 'VW Group Specialist' },
    { id: 'eng_sam', entityId: 'ent_audi', name: 'Sam', specialization: 'General Technician' },
    { id: 'eng_vincent', entityId: 'ent_trimming', name: 'Vincent', specialization: 'Master Trimmer' },
]);

// FIX: Removed T. namespace
export const getInitialJobs = (): Job[] => {
    // FIX: Removed T. namespace
    const jobs: Job[] = [
        { id: 'BPP99200001', entityId: 'ent_porsche', vehicleId: 'veh_1', customerId: 'OCON0001', description: 'Major Service & MOT', estimatedHours: 12, scheduledDate: getRelativeDate(0), status: 'Unallocated', createdAt: getRelativeDate(-2), segments: [], keyNumber: 1, mileage: 54321, technicianObservations: ['Slight oil leak from sump plug.'], estimateId: 'BPP99100001', vehicleStatus: 'On Site', partsStatus: 'Fully Received', purchaseOrderIds: ['BPP94400001'], inspectionChecklist: [], tyreCheck: undefined, damagePoints: [] },
        { id: 'BPP99200002', entityId: 'ent_porsche', vehicleId: 'veh_4', customerId: 'DUBO0001', description: 'Brake pad replacement', estimatedHours: 4, scheduledDate: getRelativeDate(0), status: 'Unallocated', createdAt: getRelativeDate(-1), segments: [], keyNumber: 2, estimateId: 'BPP99100002', vehicleStatus: 'On Site', partsStatus: 'Awaiting Order', purchaseOrderIds: ['BPP94400002'], inspectionChecklist: [], tyreCheck: undefined, damagePoints: [] },
        { id: 'BAV99200001', entityId: 'ent_audi', vehicleId: 'veh_2', customerId: 'ROSS0001', description: 'Annual Service', estimatedHours: 8, scheduledDate: getRelativeDate(0), status: 'Unallocated', createdAt: getRelativeDate(0), segments: [], vehicleStatus: 'On Site', partsStatus: 'Ordered', inspectionChecklist: [], tyreCheck: undefined, damagePoints: [] },
        { id: 'BPP99200003', entityId: 'ent_porsche', vehicleId: 'veh_5', customerId: 'THOR0001', description: 'Clutch Replacement', estimatedHours: 16, scheduledDate: getRelativeDate(1), status: 'Unallocated', createdAt: getRelativeDate(0), segments: [], keyNumber: 3, vehicleStatus: 'Awaiting Arrival', partsStatus: 'Not Required', inspectionChecklist: [], tyreCheck: undefined, damagePoints: [] },
        { id: 'BTR99200001', entityId: 'ent_trimming', vehicleId: 'veh_8', customerId: 'VINT0001', description: 'Full re-trim in Connolly leather', estimatedHours: 40, scheduledDate: getRelativeDate(1), status: 'Unallocated', createdAt: getRelativeDate(-5), segments: [], vehicleStatus: 'Awaiting Arrival', partsStatus: 'Fully Received', inspectionChecklist: [], tyreCheck: undefined, damagePoints: [] },
        { id: 'BPP99200004', entityId: 'ent_porsche', vehicleId: 'veh_6', customerId: 'RACI0001', description: 'Track day prep & alignment', estimatedHours: 8, scheduledDate: null, status: 'Unallocated', createdAt: getRelativeDate(-3), segments: [], vehicleStatus: 'Awaiting Arrival', partsStatus: 'Not Required', inspectionChecklist: [], tyreCheck: undefined, damagePoints: [] },
    ];
    const jobsWithSegments = jobs.map(job => ({ ...job, segments: splitJobIntoSegments(job), status: calculateJobStatus(splitJobIntoSegments(job)) }));
    return jobsWithSegments;
};

// FIX: Removed T. namespace
export const getInitialInvoices = (): Invoice[] => ([
    { id: 'BPP91100001', entityId: 'ent_porsche', jobId: 'BPP99200001', customerId: 'OCON0001', issueDate: getRelativeDate(-5), dueDate: getRelativeDate(25), status: 'Sent', lineItems: [], vehicleId: 'veh_1' }
]);

// FIX: Removed T. namespace
export const getInitialEstimates = (): Estimate[] => ([
    { id: 'est_1', entityId: 'ent_porsche', estimateNumber: 'BPP99100001', customerId: 'OCON0001', vehicleId: 'veh_1', issueDate: getRelativeDate(-2), expiryDate: getRelativeDate(28), status: 'Approved', lineItems: [{id:'li_1', description: 'Major Service Labor', quantity: 8, unitPrice: 125, isLabor: true}], jobId: 'BPP99200001', createdByUserId: 'user_admin' },
    { id: 'est_2', entityId: 'ent_porsche', estimateNumber: 'BPP99100002', customerId: 'DUBO0001', vehicleId: 'veh_4', issueDate: getRelativeDate(-1), expiryDate: getRelativeDate(29), status: 'Sent', lineItems: [{id:'li_2', description: 'Brake Labor', quantity: 4, unitPrice: 125, isLabor: true}], createdByUserId: 'user_phil_f' },
]);

// FIX: Removed T. namespace
export const getInitialSuppliers = (): Supplier[] => ([
    { id: 'sup_1', name: 'Euro Car Parts', contactName: 'John Doe', phone: '02380 111222', email: 'sales@ecp.com', addressLine1: 'Unit 1, Industrial Estate', city: 'Southampton', postcode: 'SO15 0AD' },
    { id: 'sup_2', name: 'GSF Car Parts', contactName: 'Jane Smith', phone: '02380 333444', email: 'contact@gsf.com', addressLine1: '12 Trade Park', city: 'Eastleigh', postcode: 'SO50 5TF' },
    { id: 'sup_3', name: 'Porsche Centre Southampton', contactName: 'Service Dept', phone: '02380 222333', email: 'service@porsche-southampton.co.uk', addressLine1: 'Porsche Street', city: 'Hedge End', postcode: 'SO30 2UH' },
    { id: 'sup_4', name: 'Audi Southampton', contactName: 'Parts Dept', phone: '02380 444555', email: 'parts@audi-southampton.co.uk', addressLine1: 'Audi Way', city: 'Southampton', postcode: 'SO14 1AU' },
]);

// FIX: Removed T. namespace and added missing unitPrice property
export const getInitialServicePackages = (): ServicePackage[] => ([
    { id: 'pkg_1', entityId: 'ent_porsche', name: 'Porsche Minor Service', totalPrice: 495, costItems: [{ id: 'c1', description: 'Labor', isLabor: true, quantity: 4, unitPrice: 0, unitCost: 45 }, {id:'c2', description:'Oil Filter', isLabor: false, quantity: 1, unitPrice: 0, unitCost: 25}]},
    { id: 'pkg_2', entityId: 'ent_porsche', name: 'MOT Test', totalPrice: 54.85, costItems: [{ id: 'c3', description: 'MOT Labor', isLabor: true, quantity: 1, unitPrice: 0, unitCost: 20 }]},
    { 
        id: 'pkg_3', 
        entityId: 'ent_porsche', 
        name: 'Porsche Major Service', 
        totalPrice: 995, 
        costItems: [
            { id: 'c4', description: 'Major Service Labor', isLabor: true, quantity: 8, unitPrice: 0, unitCost: 45 }, 
            {id:'c5', partId: 'part_1', partNumber: '99610722553', description: 'Oil Filter 996/997', isLabor: false, quantity: 1, unitPrice: 0, unitCost: 22.50},
            {id:'c6', partId: 'part_2', partNumber: '0W40MOB1', description: 'Mobil 1 0W-40 Oil (1L)', isLabor: false, quantity: 8, unitPrice: 0, unitCost: 9.50},
            {id:'c7', partId: 'part_3', partNumber: '99611013170', description: 'Air Filter 996/997', isLabor: false, quantity: 1, unitPrice: 0, unitCost: 45.00},
            {id:'c8', partId: 'part_4', partNumber: '99657221901', description: 'Pollen/Cabin Filter', isLabor: false, quantity: 1, unitPrice: 0, unitCost: 30.00},
            {id:'c9', partId: 'part_5', partNumber: '99917022490', description: 'Spark Plugs (Bosch)', isLabor: false, quantity: 6, unitPrice: 0, unitCost: 15.00},
        ]
    },
    { 
        id: 'pkg_4', 
        entityId: 'ent_porsche', 
        name: 'Brake Fluid Change', 
        totalPrice: 150, 
        costItems: [
            { id: 'c10', description: 'Brake Fluid Change Labor', isLabor: true, quantity: 1, unitPrice: 0, unitCost: 45 },
            { id: 'c11', partId: 'part_7', partNumber: 'BFDOT4', description: 'Brake Fluid DOT4 (1L)', isLabor: false, quantity: 1, unitPrice: 0, unitCost: 10 },
        ]
    },
]);

export const getInitialParts = (): Part[] => ([
    { id: 'part_1', partNumber: '99610722553', description: 'Oil Filter 996/997', salePrice: 35, costPrice: 22.50, defaultSupplierId: 'sup_3', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 10, isStockItem: true },
    { id: 'part_2', partNumber: '0W40MOB1', description: 'Mobil 1 0W-40 Oil (1L)', salePrice: 15, costPrice: 9.50, defaultSupplierId: 'sup_1', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 50, isStockItem: true },
    { id: 'part_3', partNumber: '99611013170', description: 'Air Filter 996/997', salePrice: 65, costPrice: 45.00, defaultSupplierId: 'sup_3', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 5, isStockItem: true },
    { id: 'part_4', partNumber: '99657221901', description: 'Pollen/Cabin Filter', salePrice: 45, costPrice: 30.00, defaultSupplierId: 'sup_1', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 8, isStockItem: true },
    { id: 'part_5', partNumber: '99917022490', description: 'Spark Plugs (Bosch)', salePrice: 25, costPrice: 15.00, defaultSupplierId: 'sup_1', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 3, isStockItem: true },
    { id: 'part_6', partNumber: '99661298400', description: 'Brake Pad Wear Sensor', salePrice: 25, costPrice: 15.00, defaultSupplierId: 'sup_1', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 0, isStockItem: false },
    { id: 'part_7', partNumber: 'BFDOT4', description: 'Brake Fluid DOT4 (1L)', salePrice: 18, costPrice: 10, defaultSupplierId: 'sup_1', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 20, isStockItem: true },
]);

export const getInitialSaleVehicles = (): SaleVehicle[] => {
    const version1Id = crypto.randomUUID();
    const version2Id = crypto.randomUUID();
    return [
        { 
            id: 'sale_1', entityId: 'ent_sales', vehicleId: 'veh_1', status: 'For Sale', saleType: 'Sale or Return', prepCosts: [], overheads: [], upsells: [], nonRecoverableCosts: [], keyNumber: 4,
            versions: [{ versionId: version1Id, createdAt: new Date().toISOString(), listPrice: 155000, sorReturnPrice: 145000 }], activeVersionId: version1Id 
        },
        { 
            id: 'sale_2', entityId: 'ent_sales', vehicleId: 'veh_5', status: 'For Sale', saleType: 'Stock', purchasePrice: 180000, prepCosts: [], overheads: [], upsells: [], nonRecoverableCosts: [], keyNumber: 5,
            versions: [{ versionId: version2Id, createdAt: new Date().toISOString(), listPrice: 210000 }], activeVersionId: version2Id 
        }
    ];
};
export const getInitialSaleOverheadPackages = (): SaleOverheadPackage[] => ([
    { id: 'sop_1', name: 'Standard Valet & Photos', cost: 150 },
    { id: 'sop_2', name: 'Premium Detail & Marketing', cost: 450 },
]);

export const getInitialStorageBookings = (): StorageBooking[] => ([
    { id: 'sb_1', entityId: 'ent_storage', vehicleId: 'veh_3', customerId: 'CART0001', locationId: 'sl_1', slotIdentifier: 'A-01', startDate: getRelativeDate(-20), endDate: null, weeklyRate: 75, lastBilledDate: getRelativeDate(-2), invoiceIds: ['BSS91100001'] },
]);
export const getInitialRentalVehicles = (): RentalVehicle[] => ([
// FIX: Changed type from 'Rental' to 'Courtesy Car' to match type definition.
    { id: 'veh_2', entityId: 'ent_rentals', status: 'Available', dailyRate: 100, weeklyRate: 500, type: 'Courtesy Car', damageMarkerColors: {checkOut: '#3b82f6', checkIn: '#ef4444'}, defaultRentalDays: 3 },
]);
export const getInitialRentalBookings = (): RentalBooking[] => ([]);
export const getInitialStorageLocations = (): StorageLocation[] => ([
    { id: 'sl_1', name: 'Main Warehouse', capacity: 30 },
]);
export const getInitialBatteryChargers = (): BatteryCharger[] => ([
    { id: 'bc_1', name: 'CTEK-01', entityId: 'ent_storage', locationDescription: 'Main Warehouse Row A' },
    { id: 'bc_2', name: 'CTEK-02', entityId: 'ent_porsche', locationDescription: 'Bay 4' },
    { id: 'bc_3', name: 'NOCO-01', entityId: 'ent_sales', locationDescription: 'Showroom East Wall' },
]);
export const getInitialNominalCodes = (): NominalCode[] => ([
    { id: 'nc_4000', code: '4000', name: 'Sales - Labour' },
    { id: 'nc_4001', code: '4001', name: 'Sales - Parts' },
    { id: 'nc_4002', code: '4002', name: 'Sales - MOT' },
    { id: 'nc_5000', code: '5000', name: 'Purchases - Parts' },
]);
export const getInitialNominalCodeRules = (): NominalCodeRule[] => ([
    { id: 'ncr_1', priority: 10, entityId: 'all', itemType: 'Labor', keywords: '', excludeKeywords: '', nominalCodeId: 'nc_4000' },
    { id: 'ncr_2', priority: 10, entityId: 'all', itemType: 'Part', keywords: '', excludeKeywords: '', nominalCodeId: 'nc_4001' },
    { id: 'ncr_3', priority: 100, entityId: 'all', itemType: 'MOT', keywords: 'mot', excludeKeywords: '', nominalCodeId: 'nc_4002' },
    { id: 'ncr_4', priority: 10, entityId: 'all', itemType: 'Purchase', keywords: '', excludeKeywords: '', nominalCodeId: 'nc_5000' },
]);
export const getInitialPurchaseOrders = (): PurchaseOrder[] => ([
    { id: 'BPP94400001', entityId: 'ent_porsche', supplierId: 'sup_3', vehicleRegistrationRef: 'GT3 RS', orderDate: getRelativeDate(-3), status: 'Received', jobId: 'BPP99200001', lineItems: [] },
    { id: 'BPP94400002', entityId: 'ent_porsche', supplierId: 'sup_1', vehicleRegistrationRef: 'GT4 CJD', orderDate: getRelativeDate(-2), status: 'Ordered', jobId: 'BPP99200002', lineItems: [] },
]);
export const getInitialPurchases = (): Purchase[] => ([]);
export const getInitialAbsenceRequests = (): AbsenceRequest[] => ([]);