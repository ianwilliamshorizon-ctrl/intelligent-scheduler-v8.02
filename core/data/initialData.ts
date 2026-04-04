
import {
    BusinessEntity, Customer, Vehicle, Job, JobSegment, Lift, Engineer, Invoice,
    Supplier, Estimate, TaxRate, ServicePackage, Part, SaleVehicle, SaleOverheadPackage,
    StorageBooking, RentalVehicle, RentalBooking, StorageLocation, BatteryCharger, EstimateLineItem,
    User, NominalCode, NominalCodeRule, PurchaseOrder, Purchase, AbsenceRequest, Prospect, Inquiry,
    Reminder, AuditLogEntry, Role, InspectionDiagram, InspectionTemplate, DiscountCode, FinancialBaseline
} from '../../types';
import { getRelativeDate, formatDate, splitJobIntoSegments } from '../utils/dateUtils';
import { generateCustomerId } from '../utils/customerUtils';
import { calculateJobStatus } from '../utils/jobUtils';

// --- Global Data Helpers ---
export const initialChecklistData = [
    {
        id: 'sec_engine',
        title: 'Engine Compartment',
        items: [
            { id: 'itm_oil_leak', label: 'Check for oil leaks', status: 'na', comment: '' },
            { id: 'itm_coolant_level', label: 'Check coolant level/condition', status: 'na', comment: '' },
            { id: 'itm_drive_belts', label: 'Check auxiliary drive belts', status: 'na', comment: '' }
        ]
    },
    {
        id: 'sec_undercarriage',
        title: 'Undercarriage',
        items: [
            { id: 'itm_exhaust', label: 'Check exhaust system condition', status: 'na', comment: '' },
            { id: 'itm_suspension', label: 'Check suspension components', status: 'na', comment: '' },
            { id: 'itm_steering', label: 'Check steering rack and gaiters', status: 'na', comment: '' }
        ]
    }
];

// --- Roles ---
export const getInitialRoles = (): Role[] => ([
    { id: 'role_admin', name: 'Admin', defaultAllowedViews: ['dashboard', 'directors-dashboard', 'dispatch', 'workflow', 'concierge', 'inquiries', 'communications', 'estimates', 'invoices', 'purchaseOrders', 'jobs', 'sales', 'storage', 'rentals', 'absence'] },
    { id: 'role_dispatcher', name: 'Dispatcher', defaultAllowedViews: ['dashboard', 'directors-dashboard', 'dispatch', 'workflow', 'concierge', 'inquiries', 'communications', 'estimates', 'invoices', 'purchaseOrders', 'jobs', 'sales', 'storage', 'rentals', 'absence'] },
    { id: 'role_engineer', name: 'Engineer', defaultAllowedViews: ['dashboard', 'directors-dashboard', 'concierge', 'workflow', 'absence', 'inquiries'] },
    { id: 'role_sales', name: 'Sales', defaultAllowedViews: ['dashboard', 'directors-dashboard', 'sales', 'estimates', 'absence', 'inquiries'] },
    { id: 'role_concierge', name: 'Garage Concierge', defaultAllowedViews: ['dashboard', 'directors-dashboard', 'concierge', 'inquiries', 'invoices', 'absence'] },
    { id: 'role_director', name: 'Director', defaultAllowedViews: ['dashboard', 'directors-dashboard', 'dispatch', 'workflow', 'concierge', 'inquiries', 'communications', 'estimates', 'invoices', 'purchaseOrders', 'jobs', 'sales', 'storage', 'rentals', 'absence'] },
]);

// --- Users ---
export const getInitialUsers = (): User[] => ([
    { id: 'user_admin', name: 'Admin User', email: 'admin@example.com', role: 'Admin' },
    { id: 'user_sales', name: 'Sales User', email: 'sales@example.com', role: 'Sales' },
    { id: 'user_concierge', name: 'Concierge User', email: 'concierge@example.com', role: 'Director' },
    { id: 'user_phil_f', name: 'Phil F', email: 'phil.f@example.com', role: 'Dispatcher' },
    { id: 'user_tim', name: 'Tim', email: 'tim@example.com', role: 'Dispatcher' },
    { id: 'user_phil', name: 'Phil', email: 'phil@example.com', role: 'Dispatcher' },
    { id: 'user_lewis', name: 'Lewis', email: 'lewis@example.com', role: 'Engineer', engineerId: 'eng_lewis' },
    { id: 'user_emma', name: 'Emma', email: 'emma@example.com', role: 'Engineer', engineerId: 'eng_emma' },
    { id: 'user_gary', name: 'Gary', email: 'gary@example.com', role: 'Engineer', engineerId: 'eng_gary' },
    { id: 'user_olly', name: 'Olly', email: 'olly@example.com', role: 'Engineer', engineerId: 'eng_olly' },
    { id: 'user_mike_audi', name: 'Mike', email: 'mike@example.com', role: 'Engineer', engineerId: 'eng_mike_audi' },
    { id: 'user_dan', name: 'Dan', email: 'dan@example.com', role: 'Engineer', engineerId: 'eng_dan' },
    { id: 'user_sam', name: 'Sam', email: 'sam@example.com', role: 'Engineer', engineerId: 'eng_sam' },
    { id: 'user_vincent', name: 'Vincent', email: 'vincent@example.com', role: 'Engineer', engineerId: 'eng_vincent' },
] as User[]).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

// --- Business Entities ---
export const getInitialBusinessEntities = (): BusinessEntity[] => ([
    {
        id: 'ent_porsche', name: 'Brookspeed Porsche & Performance', shortCode: 'BPP', laborRate: 125, laborCostRate: 45,
        addressLine1: '14-15 Test Lane', city: 'Southampton', postcode: 'SO16 9JX', vatNumber: 'GB 123 4567 89', type: 'Workshop',
        logoUrl: '/logo.png'
    },
    { 
        id: 'ent_audi', name: 'Brookspeed Audi & VW', shortCode: 'BAV', laborRate: 110, laborCostRate: 40, type: 'Workshop'
    },
    { 
        id: 'ent_trimming', name: 'Brookspeed Trimming', shortCode: 'BTR', laborRate: 95, laborCostRate: 35, type: 'Workshop'
    },
    { 
        id: 'ent_sales', name: 'Brookspeed Sales', shortCode: 'BSA', type: 'Sales'
    },
    { id: 'ent_storage', name: 'Brookspeed Secure Storage', shortCode: 'BSS', type: 'Storage' },
    { id: 'ent_rentals', name: 'Brookspeed Rentals', shortCode: 'BRE', type: 'Rentals' }
]);

// --- Tax Rates ---
export const getInitialTaxRates = (): TaxRate[] => ([
    { id: 'tax_1', code: 'T0', name: 'VAT Exempt', rate: 0 },
    { id: 'tax_2', code: 'T1', name: 'Standard VAT', rate: 20 },
]);

// --- Customers ---
export const getInitialCustomers = (): Customer[] => {
    const customers: Customer[] = [
        { id: 'OCON0001', forename: 'Liam', surname: "O'Connell", phone: '07700900101', email: 'liam.oc@example.com', addressLine1: '12 Porsche Drive', city: 'Southampton', postcode: 'SO15 1XX' },
        { id: 'ROSS0001', forename: 'Sophia', surname: 'Rossi', phone: '07700900102', mobile: '07700900102', email: 'sophia.r@example.com', addressLine1: '8 Audi Avenue', city: 'Winchester', postcode: 'SO23 8YY' },
        { id: 'CART0001', forename: 'Ben', surname: 'Carter', phone: '07700900103', email: 'ben.carter@example.com', addressLine1: '21 Transporter Terrace', city: 'Eastleigh', postcode: 'SO50 5ZZ', companyName: 'Carter Couriers' },
        { id: 'DUBO0001', forename: 'Chloe', surname: 'Dubois', phone: '07700900104', email: 'chloe.d@example.com', addressLine1: '5 Cayman Court', city: 'Lyndhurst', postcode: 'SO43 7AA' },
        { id: 'THOR0001', forename: 'Marcus', surname: 'Thorne', phone: '07700900105', email: 'marcus.thorne@example.com', addressLine1: '1 Mclaren Mews', city: 'Salisbury', postcode: 'SP1 2BB' },
        { id: 'RACI0001', companyName: 'The Racing Team', forename: 'Frank', surname: 'Williams', phone: '01234 567890', email: 'race@team.com', addressLine1: 'The Paddock, Thruxton', city: 'Andover', postcode: 'SP11 8PW' },
        { id: 'CHEN0001', forename: 'Isabelle', surname: 'Chen', phone: '07700900107', email: 'isabelle.c@example.com', addressLine1: '32 Civic Street', city: 'Basingstoke', postcode: 'RG21 3CC' },
        { id: 'VINT0001', companyName: 'Vintage Classics Ltd', forename: 'Eleanor', surname: 'Vance', phone: '01962 112233', email: 'enquiries@vintageclassics.com', addressLine1: 'The Old Hangar', city: 'Goodwood', postcode: 'PO18 0PH' },
        { id: 'WRIG0001', forename: 'Ethan', surname: 'Wright', phone: '07700900109', email: 'ethan.w@example.com', addressLine1: '9 Custom Close', city: 'Portsmouth', postcode: 'PO1 3DD', companyName: 'Wright Electricals' },
        { id: 'PETR0001', forename: 'Olivia', surname: 'Petrova', phone: '07700900110', email: 'olivia.p@example.com', addressLine1: '18 Competition Crescent', city: 'Bournemouth', postcode: 'BH1 1EE' },
    ];
    const cashCustomerId = generateCustomerId('Cash', customers);
    customers.push({ id: cashCustomerId, forename: 'Cash', surname: 'Sale', phone: 'N/A' });
    return customers;
};

// --- Vehicles ---
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

// --- Lifts & Engineers ---
export const getInitialLifts = (): Lift[] => ([
    { id: 'lift_p1', entityId: 'ent_porsche', name: 'Porsche Lift 1' },
    { id: 'lift_p2', entityId: 'ent_porsche', name: 'Porsche Lift 2' },
    { id: 'lift_p3', entityId: 'ent_porsche', name: 'Porsche Lift 3' },
    { id: 'lift_p4', entityId: 'ent_porsche', name: 'Porsche Lift 4' },
    { id: 'lift_p5', entityId: 'ent_porsche', name: 'Porsche Lift 5' },
    { id: 'lift_p6', entityId: 'ent_porsche', name: 'Porsche Lift 6' },
    { id: 'lift_mot_p', entityId: 'ent_porsche', name: 'Porsche MOT Bay' },
    { id: 'lift_a1', entityId: 'ent_audi', name: 'Audi Lift 1' },
    { id: 'lift_a2', entityId: 'ent_audi', name: 'Audi Lift 2' },
    { id: 'lift_a3', entityId: 'ent_audi', name: 'Audi Lift 3' },
    { id: 'lift_mot_a', entityId: 'ent_audi', name: 'Audi MOT Bay' },
    { id: 'lift_t1', entityId: 'ent_trimming', name: 'Trimming Area 1' },
    { id: 'lift_t2', entityId: 'ent_trimming', name: 'Trimming Area 2' },
]);

export const getInitialEngineers = (): Engineer[] => ([
    { id: 'eng_lewis', entityId: 'ent_porsche', name: 'Lewis' },
    { id: 'eng_emma', entityId: 'ent_porsche', name: 'Emma' },
    { id: 'eng_gary', entityId: 'ent_porsche', name: 'Gary' },
    { id: 'eng_olly', entityId: 'ent_porsche', name: 'Olly' },
    { id: 'eng_mike_audi', entityId: 'ent_audi', name: 'Mike' },
    { id: 'eng_dan', entityId: 'ent_audi', name: 'Dan' },
    { id: 'eng_sam', entityId: 'ent_audi', name: 'Sam' },
    { id: 'eng_vincent', entityId: 'ent_trimming', name: 'Vincent' },
]);

// --- Jobs & Finance ---
export const getInitialJobs = (): Job[] => {
    const jobs: Job[] = [
        { id: 'BPP99200001', entityId: 'ent_porsche', vehicleId: 'veh_1', customerId: 'OCON0001', description: 'Major Service & MOT', estimatedHours: 12, scheduledDate: getRelativeDate(0), status: 'Unallocated', createdAt: getRelativeDate(-2), segments: [], keyNumber: '1', mileage: 54321, technicianObservations: ['Slight oil leak from sump plug.'], estimateId: 'BPP99100001', vehicleStatus: 'On Site', partsStatus: 'Fully Received', purchaseOrderIds: ['BPP94400001'], inspectionChecklist: [], tyreCheck: undefined, damagePoints: [], createdByUserId: 'user_admin' },
        { id: 'BPP99200002', entityId: 'ent_porsche', vehicleId: 'veh_4', customerId: 'DUBO0001', description: 'Brake pad replacement', estimatedHours: 4, scheduledDate: getRelativeDate(0), status: 'Unallocated', createdAt: getRelativeDate(-1), segments: [], keyNumber: '2', estimateId: 'BPP99100002', vehicleStatus: 'On Site', partsStatus: 'Awaiting Order', purchaseOrderIds: ['BPP94400002'], inspectionChecklist: [], tyreCheck: undefined, damagePoints: [], createdByUserId: 'user_admin' },
        { id: 'BAV99200001', entityId: 'ent_audi', vehicleId: 'veh_2', customerId: 'ROSS0001', description: 'Annual Service', estimatedHours: 8, scheduledDate: getRelativeDate(0), status: 'Unallocated', createdAt: getRelativeDate(0), segments: [], vehicleStatus: 'On Site', partsStatus: 'Ordered', inspectionChecklist: [], tyreCheck: undefined, damagePoints: [], createdByUserId: 'user_admin' },
        { id: 'BPP99200003', entityId: 'ent_porsche', vehicleId: 'veh_5', customerId: 'THOR0001', description: 'Clutch Replacement', estimatedHours: 16, scheduledDate: getRelativeDate(1), status: 'Unallocated', createdAt: getRelativeDate(0), segments: [], keyNumber: '3', vehicleStatus: 'Awaiting Arrival', partsStatus: 'Not Required', inspectionChecklist: [], tyreCheck: undefined, damagePoints: [], createdByUserId: 'user_admin' },
        { id: 'BTR99200001', entityId: 'ent_trimming', vehicleId: 'veh_8', customerId: 'VINT0001', description: 'Full re-trim in Connolly leather', estimatedHours: 40, scheduledDate: getRelativeDate(1), status: 'Unallocated', createdAt: getRelativeDate(-5), segments: [], vehicleStatus: 'Awaiting Arrival', partsStatus: 'Fully Received', inspectionChecklist: [], tyreCheck: undefined, damagePoints: [], createdByUserId: 'user_admin' },
        { id: 'BPP99200004', entityId: 'ent_porsche', vehicleId: 'veh_6', customerId: 'RACI0001', description: 'Track day prep & alignment', estimatedHours: 8, scheduledDate: undefined, status: 'Unallocated', createdAt: getRelativeDate(-3), segments: [], vehicleStatus: 'Awaiting Arrival', partsStatus: 'Not Required', inspectionChecklist: [], tyreCheck: undefined, damagePoints: [], createdByUserId: 'user_admin' },
    ];
    return jobs.map(job => ({ ...job, segments: splitJobIntoSegments(job), status: calculateJobStatus(splitJobIntoSegments(job)) }));
};

export const getInitialInvoices = (): Invoice[] => ([
    { id: 'BPP91100001', entityId: 'ent_porsche', customerId: 'OCON0001', issueDate: getRelativeDate(-5), dueDate: getRelativeDate(25), status: 'Sent', lineItems: [], vehicleId: 'veh_1', payments: [] }
]);

export const getInitialEstimates = (): Estimate[] => ([
    { id: 'est_1', entityId: 'ent_porsche', estimateNumber: 'BPP99100001', customerId: 'OCON0001', vehicleId: 'veh_1', issueDate: getRelativeDate(-2), expiryDate: getRelativeDate(28), status: 'Approved', lineItems: [{id:'li_1', description: 'Major Service Labor', quantity: 8, unitPrice: 125, unitCost: 45, isLabor: true}], jobId: 'BPP99200001', createdByUserId: 'user_admin' },
    { id: 'est_2', entityId: 'ent_porsche', estimateNumber: 'BPP99100002', customerId: 'DUBO0001', vehicleId: 'veh_4', issueDate: getRelativeDate(-1), expiryDate: getRelativeDate(29), status: 'Sent', lineItems: [{id:'li_2', description: 'Brake Labor', quantity: 4, unitPrice: 125, unitCost: 45, isLabor: true}], createdByUserId: 'user_phil_f' },
]);

export const getInitialSuppliers = (): Supplier[] => ([
    { id: 'sup_1', name: 'Euro Car Parts', contactName: 'John Doe', addressLine1: 'Unit 1', city: 'Southampton', postcode: 'SO15 0AD' },
    { id: 'sup_2', name: 'GSF Car Parts', contactName: 'Jane Smith', addressLine1: '12 Trade Park', city: 'Eastleigh', postcode: 'SO50 5TF' },
    { id: 'sup_3', name: 'Porsche Centre Southampton', contactName: 'Service Dept', addressLine1: 'Porsche Street', city: 'Hedge End', postcode: 'SO30 2UH' },
    { id: 'sup_4', name: 'Audi Southampton', contactName: 'Parts Dept', addressLine1: 'Audi Way', city: 'Southampton', postcode: 'SO14 1AU' },
]);

export const getInitialServicePackages = (): ServicePackage[] => ([
    { 
        id: 'pkg_1', 
        entityId: 'ent_porsche', 
        name: 'Porsche 911 (991/997) Minor Service', 
        totalPrice: 495, 
        applicableMake: 'Porsche',
        applicableModel: '911',
        costItems: [
            { id: 'li_pkg1_1', description: 'Labor', isLabor: true, quantity: 4, unitPrice: 0, unitCost: 45, taxCodeId: 'tax_2' }, 
            { id: 'li_pkg1_2', description:'Oil Filter', isLabor: false, quantity: 1, unitPrice: 0, unitCost: 25, taxCodeId: 'tax_2'}
        ]
    },
    { 
        id: 'pkg_2', 
        entityId: 'ent_porsche', 
        name: 'MOT Test (Class 4)', 
        totalPrice: 54.85, 
        taxCodeId: 'tax_1', 
        // No make/model implies applicable to all
        costItems: [{ id: 'li_mot_1', description: 'MOT Labor', isLabor: true, quantity: 1, unitPrice: 0, unitCost: 20, taxCodeId: 'tax_1' }]
    },
    { 
        id: 'pkg_3', 
        entityId: 'ent_porsche', 
        name: 'Porsche 911 Major Service', 
        totalPrice: 995, 
        applicableMake: 'Porsche',
        applicableModel: '911',
        costItems: [
            { id: 'li_maj_1', description: 'Major Service Labor', isLabor: true, quantity: 8, unitPrice: 0, unitCost: 45, taxCodeId: 'tax_2' }, 
            { id: 'li_maj_2', partId: 'part_1', partNumber: '99610722553', description: 'Oil Filter 996/997', isLabor: false, fromStock: false, quantity: 1, unitPrice: 0, unitCost: 22.50, taxCodeId: 'tax_2'},
            { id: 'li_maj_3', partId: 'part_2', partNumber: '0W40MOB1', description: 'Mobil 1 0W-40 Oil (1L)', isLabor: false, fromStock: true, quantity: 8, unitPrice: 0, unitCost: 9.50, taxCodeId: 'tax_2'},
            { id: 'li_maj_4', partId: 'part_3', partNumber: '99611013170', description: 'Air Filter 996/997', isLabor: false, fromStock: false, quantity: 1, unitPrice: 0, unitCost: 45.00, taxCodeId: 'tax_2'},
            { id: 'li_maj_5', partId: 'part_4', partNumber: '99657221901', description: 'Pollen/Cabin Filter', isLabor: false, fromStock: false, quantity: 1, unitPrice: 0, unitCost: 30.00, taxCodeId: 'tax_2'},
            { id: 'li_maj_6', partId: 'part_5', partNumber: '99917022490', description: 'Spark Plugs (Bosch)', isLabor: false, fromStock: false, quantity: 6, unitPrice: 0, unitCost: 15.00, taxCodeId: 'tax_2'},
        ]
    },
    { 
        id: 'pkg_4', 
        entityId: 'ent_porsche', 
        name: 'Brake Fluid Change', 
        totalPrice: 150, 
        applicableMake: 'Porsche',
        // Generic to Porsche
        costItems: [
            { id: 'li_bf_1', description: 'Brake Fluid Change Labor', isLabor: true, quantity: 1, unitPrice: 0, unitCost: 45, taxCodeId: 'tax_2' },
            { id: 'li_bf_2', partId: 'part_7', partNumber: 'BFDOT4', description: 'Brake Fluid DOT4 (1L)', isLabor: false, quantity: 1, unitPrice: 0, unitCost: 10, taxCodeId: 'tax_2' },
        ]
    },
    { 
        id: 'pkg_5', 
        entityId: 'ent_porsche', 
        name: 'GT3 RS Track Setup', 
        totalPrice: 450, 
        applicableMake: 'Porsche',
        applicableModel: '911',
        costItems: [
             { id: 'li_track_1', description: 'Corner Weight & Geometry Setup', isLabor: true, quantity: 4, unitPrice: 0, unitCost: 45, taxCodeId: 'tax_2' }
        ]
    },
]);

export const getInitialParts = (): Part[] => ([
    { id: 'part_1', partNumber: '99610722553', description: 'Oil Filter 996/997', salePrice: 35, costPrice: 22.50, defaultSupplierId: 'sup_3', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 0, isStockItem: true },
    { id: 'part_2', partNumber: '0W40MOB1', description: 'Mobil 1 0W-40 Oil (1L)', salePrice: 15, costPrice: 9.50, defaultSupplierId: 'sup_1', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 50, isStockItem: true },
    { id: 'part_3', partNumber: '99611013170', description: 'Air Filter 996/997', salePrice: 65, costPrice: 45.00, defaultSupplierId: 'sup_3', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 5, isStockItem: true },
    { id: 'part_4', partNumber: '99657221901', description: 'Pollen/Cabin Filter', salePrice: 45, costPrice: 30.00, defaultSupplierId: 'sup_1', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 8, isStockItem: true },
    { id: 'part_5', partNumber: '99917022490', description: 'Spark Plugs (Bosch)', salePrice: 25, costPrice: 15.00, defaultSupplierId: 'sup_1', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 3, isStockItem: true },
    { id: 'part_6', partNumber: '99661298400', description: 'Brake Pad Wear Sensor', salePrice: 25, costPrice: 15.00, defaultSupplierId: 'sup_1', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 0, isStockItem: false },
    { id: 'part_7', partNumber: 'BFDOT4', description: 'Brake Fluid DOT4 (1L)', salePrice: 18, costPrice: 10, defaultSupplierId: 'sup_1', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 20, isStockItem: true },
    { id: 'part_8', partNumber: '99735193905', description: 'Front Brake Pads', salePrice: 145, costPrice: 95.00, defaultSupplierId: 'sup_1', alternateSupplierIds: [], taxCodeId: 'tax_2', stockQuantity: 4, isStockItem: true },
]);
  
export const getInitialSaleVehicles = (): SaleVehicle[] => {
    return [
        { 
            id: 'sale_1', entityId: 'ent_sales', make: 'Porsche', model: '911 GT3', price: 185000, status: 'Available'
        },
        { 
            id: 'sale_2', entityId: 'ent_sales', make: 'Porsche', model: 'Cayman GT4', price: 85000, status: 'Reserved'
        }
    ];
};

export const getInitialSaleOverheadPackages = (): SaleOverheadPackage[] => ([
    { id: 'sop_1', name: 'Standard Valet & Photos' },
    { id: 'sop_2', name: 'Premium Detail & Marketing' },
]);

export const getInitialStorageBookings = (): StorageBooking[] => ([
    { id: 'sb_1', entityId: 'ent_storage', vehicleId: 'veh_3', customerId: 'CART0001', locationId: 'sl_1', slotIdentifier: 'A1', startDate: getRelativeDate(0), weeklyRate: 50 },
]);

export const getInitialRentalVehicles = (): RentalVehicle[] => ([
    { id: 'veh_2', entityId: 'ent_rentals', damageMarkerColors: { checkOut: '#ef4444', checkIn: '#22c55e' } },
]);

export const getInitialRentalBookings = (): RentalBooking[] => ([]);
export const getInitialStorageLocations = (): StorageLocation[] => ([
    { id: 'sl_1', name: 'Main Warehouse' },
]);

export const getInitialBatteryChargers = (): BatteryCharger[] => ([
    { id: 'bc_1', name: 'CTEK-01' },
    { id: 'bc_2', name: 'CTEK-02' },
    { id: 'bc_3', name: 'NOCO-01' },
]);

export const getInitialNominalCodes = (): NominalCode[] => ([
    { id: 'nc_4000', code: '4000', name: 'Parts Revenue' },
    { id: 'nc_4001', code: '4001', name: 'Labor Revenue' },
    { id: 'nc_4002', code: '4002', name: 'MOT Revenue' },
    { id: 'nc_5000', code: '5000', name: 'Parts Purchases' },
]);

export const getInitialNominalCodeRules = (): NominalCodeRule[] => ([
    { id: 'ncr_1', priority: 10, entityId: 'all', itemType: 'Part', keywords: 'brake,pads', excludeKeywords: '', supplierKeywords: '', nominalCodeId: 'nc_4000' },
    { id: 'ncr_2', priority: 10, entityId: 'all', itemType: 'Labor', keywords: 'technician', excludeKeywords: '', supplierKeywords: '', nominalCodeId: 'nc_4001' },
    { id: 'ncr_3', priority: 100, entityId: 'all', itemType: 'MOT', keywords: '*', excludeKeywords: '', supplierKeywords: '', nominalCodeId: 'nc_4002' },
    { id: 'ncr_4', priority: 10, entityId: 'all', itemType: 'Purchase', keywords: 'parts', excludeKeywords: '', supplierKeywords: '', nominalCodeId: 'nc_5000' },
]);

export const getInitialPurchaseOrders = (): PurchaseOrder[] => ([
    { id: 'BPP94400001', entityId: 'ent_porsche', supplierId: 'sup_3', vehicleRegistrationRef: 'GT3 RS', orderDate: getRelativeDate(-3), status: 'Received', jobId: 'BPP99200001', lineItems: [] },
    { id: 'BPP94400002', entityId: 'ent_porsche', supplierId: 'sup_1', vehicleRegistrationRef: 'GT4 CJD', orderDate: getRelativeDate(-2), status: 'Ordered', jobId: 'BPP99200002', lineItems: [] },
]);

export const getInitialPurchases = (): Purchase[] => ([]);
export const getInitialAbsenceRequests = (): AbsenceRequest[] => ([]);
export const getInitialProspects = (): Prospect[] => ([]);
export const getInitialInquiries = (): Inquiry[] => ([]);
export const getInitialReminders = (): Reminder[] => ([]);
export const getInitialAuditLog = (): AuditLogEntry[] => ([]);
export const getInitialInspectionDiagrams = (): InspectionDiagram[] => ([]);

export const getInitialInspectionTemplates = (): InspectionTemplate[] => {
    const fullTemplate: InspectionTemplate = {
        id: 'tmpl_full',
        name: 'Full Inspection (Standard)',
        isDefault: true,
        sections: initialChecklistData.map(s => ({
            id: s.id,
            title: s.title,
            items: s.items.map(i => ({ id: i.id, label: i.label, status: 'na', comment: '' }))
        }))
    };

    const shortTemplate: InspectionTemplate = {
        id: 'tmpl_short',
        name: 'Short Inspection (Express)',
        isDefault: false,
        sections: [
            {
                id: 'sec_lights_levels',
                title: 'Lights & Levels',
                items: [
                     { id: 'itm_lights', label: 'Check all exterior lights', status: 'na', comment: '' },
                     { id: 'itm_wipers', label: 'Check wipers and washers', status: 'na', comment: '' },
                     { id: 'itm_oil', label: 'Check engine oil level', status: 'na', comment: '' },
                     { id: 'itm_coolant', label: 'Check coolant level', status: 'na', comment: '' },
                     { id: 'itm_brake_fluid', label: 'Check brake fluid level', status: 'na', comment: '' }
                ]
            },
            {
                id: 'sec_tyres_brakes',
                title: 'Tyres & Brakes',
                items: [
                    { id: 'itm_tyre_condition', label: 'Visual check of tyre condition', status: 'na', comment: '' },
                    { id: 'itm_tyre_pressures', label: 'Check/adjust tyre pressures', status: 'na', comment: '' },
                    { id: 'itm_brake_visual', label: 'Visual check of brake pads/discs (wheels on)', status: 'na', comment: '' }
                ]
            },
            {
                 id: 'sec_final',
                 title: 'Final',
                 items: [
                     { id: 'itm_road_test', label: 'Short road test', status: 'na', comment: '' }
                 ]
            }
        ]
    };

    return [fullTemplate, shortTemplate];
};

export const getInitialDiscountCodes = (): DiscountCode[] => ([]);
export const getInitialFinancialBaselines = (): FinancialBaseline[] => ([
    {
        id: 'fb_2024_10',
        entityId: 'ent_1',
        month: '2024-10',
        salaries: 12000,
        rentRates: 2500,
        utilities: 600,
        nonBudgetedCosts: 0,
        otherOverheads: 500,
        historicalRevenue: 45000,
        historicalCostOfSales: 18000
    },
    {
        id: 'fb_2024_11',
        entityId: 'ent_1',
        month: '2024-11',
        salaries: 12000,
        rentRates: 2500,
        utilities: 650,
        nonBudgetedCosts: 450,
        otherOverheads: 500,
        historicalRevenue: 48500,
        historicalCostOfSales: 19500
    },
    {
        id: 'fb_2024_12',
        entityId: 'ent_1',
        month: '2024-12',
        salaries: 12500,
        rentRates: 2500,
        utilities: 700,
        nonBudgetedCosts: 0,
        otherOverheads: 800,
        historicalRevenue: 52000,
        historicalCostOfSales: 21000
    }
]);

// --- Consolidated Export ---
const initialDataValue = {
    roles: getInitialRoles(),
    users: getInitialUsers(),
    businessEntities: getInitialBusinessEntities(),
    taxRates: getInitialTaxRates(),
    customers: getInitialCustomers(),
    vehicles: getInitialVehicles(),
    lifts: getInitialLifts(),
    engineers: getInitialEngineers(),
    parts: getInitialParts(),
    jobs: getInitialJobs(),
    invoices: getInitialInvoices(),
    estimates: getInitialEstimates(),
    suppliers: getInitialSuppliers(),
    servicePackages: getInitialServicePackages(),
    saleVehicles: getInitialSaleVehicles(),
    saleOverheadPackages: getInitialSaleOverheadPackages(),
    storageBookings: getInitialStorageBookings(),
    rentalVehicles: getInitialRentalVehicles(),
    rentalBookings: getInitialRentalBookings(),
    storageLocations: getInitialStorageLocations(),
    batteryChargers: getInitialBatteryChargers(),
    nominalCodes: getInitialNominalCodes(),
    nominalCodeRules: getInitialNominalCodeRules(),
    purchaseOrders: getInitialPurchaseOrders(),
    purchases: getInitialPurchases(),
    absenceRequests: getInitialAbsenceRequests(),
    prospects: getInitialProspects(),
    inquiries: getInitialInquiries(),
    reminders: getInitialReminders(),
    auditLog: getInitialAuditLog(),
    inspectionDiagrams: getInitialInspectionDiagrams(),
    inspectionTemplates: getInitialInspectionTemplates(),
    inspectionChecklists: initialChecklistData,
    discountCodes: getInitialDiscountCodes(),
    financialBaselines: getInitialFinancialBaselines(),
};

export const initialData = initialDataValue;
export default initialDataValue;