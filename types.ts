export type ViewType = 'dashboard' | 'dispatch' | 'workflow' | 'concierge' | 'inquiries' | 'communications' | 'estimates' | 'invoices' | 'purchaseOrders' | 'jobs' | 'sales' | 'storage' | 'rentals' | 'absence';
export type UserRole = 'Admin' | 'Dispatcher' | 'Engineer' | 'Sales' | 'Garage Concierge';
export type AppEnvironment = 'Production' | 'UAT' | 'Development';

export interface User {
    id: string;
    name: string;
    role: UserRole;
    password?: string;
    engineerId?: string; 
    holidayApproverId?: string;
    holidayEntitlement?: number;
    email?: string;
    allowedViews?: ViewType[];
}

export interface Role {
    id: string;
    name: string;
    baseRole: UserRole;
    defaultAllowedViews: ViewType[];
}

export interface WorkingHoursConfig {
    startHour: number;
    endHour: number;
    isOpenSaturday: boolean;
    saturdayStartHour?: number;
    saturdayEndHour?: number;
    isOpenSunday: boolean;
    region: 'england-and-wales' | 'scotland' | 'northern-ireland';
}

export interface BusinessEntity {
    id: string;
    name: string;
    type: 'Workshop' | 'Sales' | 'Storage' | 'Rentals';
    color: string;
    shortCode?: string;
    laborRate?: number;
    laborCostRate?: number;
    dailyCapacityHours?: number;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    postcode?: string;
    vatNumber?: string;
    companyNumber?: string;
    bankAccountName?: string;
    bankSortCode?: string;
    bankAccountNumber?: string;
    invoiceFooterText?: string;
    logoImageId?: string;
    workingHours?: WorkingHoursConfig;
    motReminderEmailTemplate?: string;
    motReminderSmsTemplate?: string;
    serviceReminderEmailTemplate?: string;
    serviceReminderSmsTemplate?: string;
    winterCheckReminderEmailTemplate?: string;
    winterCheckReminderSmsTemplate?: string;
    marketingReminderEmailTemplate?: string;
    marketingReminderSmsTemplate?: string;
    courtesyCarTermsAndConditions?: string;
    rentalTermsAndConditions?: string;
    sorTermsAndConditions?: string;
    storageTermsAndConditions?: string;
    storageCapacity?: number;
    defaultWeeklyStorageRate?: number;
}

export interface Customer {
    id: string;
    forename: string;
    surname: string;
    title?: string;
    companyName?: string;
    isBusinessCustomer?: boolean;
    phone?: string;
    mobile?: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postcode?: string;
    createdDate: string;
    category?: 'Retail' | 'Trade';
    isCashCustomer?: boolean;
    marketingConsent: boolean;
    serviceReminderConsent: boolean;
    communicationPreference?: 'Email' | 'SMS' | 'WhatsApp' | 'None';
}

export interface PreviousRegistration {
    registration: string;
    changedAt: string;
    changedByUserId: string;
}

export interface VehicleImage {
    id: string;
    isPrimaryDiagram?: boolean;
    dataUrl?: string; 
}

export interface Vehicle {
    id: string;
    customerId: string;
    registration: string;
    make: string;
    model: string;
    type: string; // Used for Trim/Generation (e.g. 991 or GT3 RS)
    vin?: string;
    engineNumber?: string;
    colour?: string;
    fuelType?: string;
    transmissionType?: string;
    cc?: number;
    manufactureDate?: string;
    nextMotDate?: string;
    nextServiceDate?: string;
    winterCheckDate?: string;
    fleetNumber?: string;
    covid19MotExemption?: boolean;
    previousRegistrations?: PreviousRegistration[];
    images?: VehicleImage[];
}

export type VehicleStatus = 'On Site' | 'Off-Site (Partner)' | 'Awaiting Arrival' | 'Awaiting Collection' | 'Collected';

export interface CheckInPhoto {
    id: string;
    notes?: string;
}

export interface VehicleDamagePoint {
    id: string;
    x: number;
    y: number;
    notes: string;
}

export type ChecklistItemStatus = 'ok' | 'attention' | 'urgent' | 'na';

export interface ChecklistItem {
    id: string;
    label: string;
    status: ChecklistItemStatus;
    comment?: string;
}

export interface ChecklistSection {
    id: string;
    title: string;
    items: ChecklistItem[];
    comments?: string;
}

export type TyreLocation = 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight' | 'spare';

export interface TyreData {
    outer?: number;
    middle?: number;
    inner?: number;
    pressure?: number;
    indicator: ChecklistItemStatus;
    comments?: string;
}

export type TyreCheckData = Record<TyreLocation, TyreData>;

export interface JobSegment {
    segmentId: string;
    date: string | null;
    duration: number; 
    status: 'Unallocated' | 'Allocated' | 'In Progress' | 'Paused' | 'Engineer Complete' | 'QC Complete' | 'Cancelled';
    allocatedLift: string | null;
    scheduledStartSegment: number | null;
    engineerId: string | null;
    qcCompletedAt?: string;
    qcCompletedByUserId?: string;
    engineerCompletedAt?: string;
}

export interface Job {
    id: string;
    entityId: string;
    vehicleId: string;
    customerId: string;
    description: string;
    estimatedHours: number;
    scheduledDate: string | null;
    status: 'Unallocated' | 'Allocated' | 'In Progress' | 'Pending QC' | 'Complete' | 'Invoiced' | 'Cancelled' | 'Closed';
    createdAt: string;
    createdByUserId?: string;
    segments: JobSegment[];
    keyNumber?: number;
    mileage?: number;
    technicianObservations?: string[];
    estimateId?: string;
    invoiceId?: string;
    vehicleStatus?: VehicleStatus;
    partsStatus?: 'Awaiting Order' | 'Ordered' | 'Partially Received' | 'Fully Received' | 'Not Required';
    purchaseOrderIds?: string[];
    notes?: string;
    checkInPhotos?: CheckInPhoto[];
    technicianImages?: CheckInPhoto[];
    inspectionChecklist?: ChecklistSection[];
    tyreCheck?: TyreCheckData;
    damagePoints?: VehicleDamagePoint[];
    collectedBy?: string;
    tyreDepths?: { osf?: number; nsf?: number; osr?: number; nsr?: number };
}

export interface EstimateLineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    unitCost?: number;
    isLabor: boolean;
    partId?: string;
    partNumber?: string;
    taxCodeId?: string;
    servicePackageId?: string;
    servicePackageName?: string;
    isPackageComponent?: boolean;
    fromStock?: boolean;
    isOptional?: boolean;
    media?: CheckInPhoto[];
    isCourtesyCar?: boolean;
    isStorageCharge?: boolean;
}

export interface Estimate {
    id: string;
    estimateNumber: string;
    entityId: string;
    customerId: string;
    vehicleId: string;
    issueDate: string;
    expiryDate: string;
    status: 'Draft' | 'Sent' | 'Approved' | 'Declined' | 'Converted to Job' | 'Closed';
    lineItems: EstimateLineItem[];
    notes?: string;
    jobId?: string;
    createdByUserId?: string;
    media?: CheckInPhoto[];
}

export interface Invoice {
    id: string;
    entityId: string;
    customerId: string;
    vehicleId?: string;
    jobId?: string;
    saleVehicleId?: string;
    storageBookingId?: string;
    issueDate: string;
    dueDate: string;
    status: 'Draft' | 'Sent' | 'Part Paid' | 'Paid' | 'Overdue';
    lineItems: EstimateLineItem[];
    notes?: string;
    createdByUserId?: string;
}

export interface PurchaseOrderLineItem {
    id: string;
    partNumber?: string;
    description: string;
    quantity: number;
    receivedQuantity?: number;
    unitPrice: number; 
    taxCodeId?: string;
}

export interface Part {
    id: string;
    partNumber: string;
    description: string;
    salePrice: number;
    costPrice: number;
    stockQuantity: number;
    isStockItem: boolean;
    defaultSupplierId?: string;
    alternateSupplierIds?: string[];
    taxCodeId?: string;
}

export interface PurchaseOrder {
    id: string;
    entityId: string;
    supplierId: string | null;
    vehicleRegistrationRef: string;
    supplierReference?: string;
    secondarySupplierReference?: string;
    orderDate: string;
    status: 'Draft' | 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled';
    jobId?: string | null;
    lineItems: PurchaseOrderLineItem[];
    notes?: string;
    createdByUserId?: string;
    partUpdates?: Part[];
}

export interface Purchase {
    id: string;
    entityId: string;
    name: string;
    purchasePrice: number;
    markupPercent?: number;
    jobId: string | null;
    invoiceId: string | null;
    supplierId: string | null;
    supplierReference?: string;
    purchaseDate: string;
    taxCodeId?: string;
}

export interface Supplier {
    id: string;
    name: string;
    contactName?: string;
    phone?: string;
    email?: string;
    addressLine1?: string;
    city?: string;
    postcode?: string;
}

export interface TaxRate {
    id: string;
    code: string;
    name: string;
    rate: number;
}

export interface ServicePackage {
    id: string;
    entityId: string;
    name: string;
    description?: string;
    totalPrice: number;
    costItems: EstimateLineItem[]; // Set as non-optional to match initialData
    taxCodeId?: string;
    applicableMake?: string;
    applicableModel?: string;
    applicableVarient?: string; // Unified with your hierarchy (Make -> Model -> Type)
}

export interface Lift {
    id: string;
    entityId: string;
    name: string;
    type: 'General' | 'MOT' | 'Trimming';
    color?: string;
}

export interface Engineer {
    id: string;
    entityId: string;
    name: string;
    specialization: string;
}

export interface RentalVehicle {
    id: string; 
    entityId?: string;
    status: 'Available' | 'Booked' | 'Rented' | 'Maintenance';
    dailyRate: number;
    weeklyRate: number;
    type: 'Courtesy Car' | 'Rental';
    damageCheckImageId?: string;
    damageMarkerColors: { checkOut: string; checkIn: string };
    defaultRentalDays?: number;
}

export interface DamagePoint {
    id: string;
    x: number;
    y: number;
    notes?: string;
}

export interface RentalDriverDetails {
    licenseNumber?: string;
}

export interface RentalCheckDetails {
    mileage: number;
    fuelLevel: number;
    conditionNotes?: string;
    timestamp: string;
    damagePoints: DamagePoint[];
}

export interface RentalBooking {
    id: string;
    entityId: string;
    rentalVehicleId: string;
    customerId: string;
    jobId?: string; 
    startDate: string;
    endDate: string;
    bookingType: 'Courtesy Car' | 'Rental';
    status: 'Active' | 'Completed' | 'Cancelled';
    checkOutDetails?: RentalCheckDetails;
    checkInDetails?: RentalCheckDetails;
    additionalCharges?: { id: string; description: string; amount: number }[];
    totalCost: number;
}

export interface SaleVersion {
    versionId: string;
    createdAt: string;
    listPrice: number;
    sorReturnPrice?: number;
}

export interface SalePrepCost {
    id: string;
    type: 'Invoice' | 'OneOff';
    sourceId?: string;
    description: string;
    cost: number;
}

export interface SaleUpsell {
    id: string;
    description: string;
    costPrice: number;
    salePrice: number;
}

export interface SaleOverhead {
    id: string;
    description: string;
    cost: number;
    sourcePackageId?: string;
}

export interface SaleNonRecoverableCost {
    id: string;
    description: string;
    cost: number;
}

export interface SaleVehicle {
    id: string;
    entityId: string;
    vehicleId: string;
    status: 'For Sale' | 'Sold' | 'Withdrawn';
    saleType: 'Sale or Return' | 'Stock';
    purchasePrice?: number; 
    versions?: SaleVersion[];
    activeVersionId: string;
    prepCosts: SalePrepCost[];
    overheads: SaleOverhead[];
    upsells: SaleUpsell[];
    nonRecoverableCosts: SaleNonRecoverableCost[];
    finalSalePrice?: number;
    soldDate?: string;
    buyerCustomerId?: string;
    invoiceId?: string | null;
    depositAmount?: number;
    depositDate?: string | null;
    keyNumber?: number;
    chargingHistory?: ChargingEvent[];
}

export interface SaleOverheadPackage {
    id: string;
    name: string;
    cost: number;
}

export interface Prospect {
    id: string;
    entityId: string;
    name: string;
    phone: string;
    email?: string;
    status: 'Active' | 'Contacted' | 'Converted' | 'Archived';
    desiredVehicle: string;
    notes?: string;
    linkedSaleVehicleId?: string | null;
    customerId?: string | null; 
    createdAt: string;
}

export interface StorageLocation {
    id: string;
    name: string;
    capacity: number;
}

export interface StorageBooking {
    id: string;
    entityId: string;
    vehicleId: string;
    customerId: string;
    locationId: string;
    slotIdentifier: string;
    startDate: string;
    endDate: string | null;
    weeklyRate: number;
    lastBilledDate?: string;
    invoiceIds?: string[];
    notes?: string;
    keyNumber?: number;
    chargingHistory?: ChargingEvent[];
}

export interface BatteryCharger {
    id: string;
    name: string;
    entityId: string;
    locationDescription?: string;
}

export interface ChargingEvent {
    id: string;
    chargerId: string;
    startDate: string;
    endDate: string | null;
}

export interface NominalCode {
    id: string;
    code: string;
    name: string;
    secondaryCode?: string;
}

export type NominalCodeItemType = 'Labor' | 'Part' | 'MOT' | 'Purchase' | 'CourtesyCar' | 'Storage';

export interface NominalCodeRule {
    id: string;
    priority: number;
    entityId: string; 
    itemType: NominalCodeItemType;
    keywords: string; 
    excludeKeywords: string; 
    nominalCodeId: string;
}

export type AbsenceType = 'Holiday' | 'Sickness' | 'Appointment' | 'Unpaid Leave' | 'Race Support' | 'Training';
export type AbsenceRequestStatus = 'Pending' | 'Approved' | 'Rejected';

export interface AbsenceRequest {
    id: string;
    userId: string;
    approverId: string;
    type: AbsenceType;
    status: AbsenceRequestStatus;
    startDate: string;
    endDate: string;
    isHalfDayStart: boolean;
    isHalfDayEnd: boolean;
    daysTaken: number;
    notes?: string;
    requestedAt: string;
    actionedAt?: string;
    rejectionReason?: string;
}

export interface Inquiry {
    id: string;
    entityId: string;
    createdAt: string;
    fromName: string;
    fromContact?: string;
    message: string;
    takenByUserId: string;
    status: 'Open' | 'In Progress' | 'Sent' | 'Approved' | 'Rejected' | 'Closed';
    actionNotes?: string;
    assignedToUserId?: string | null;
    linkedCustomerId?: string | null;
    linkedVehicleId?: string | null;
    linkedEstimateId?: string | null;
    linkedJobId?: string | null;
    linkedPurchaseOrderIds?: string[];
}

export type ReminderType = 'MOT' | 'Service' | 'Winter Check' | 'Marketing';
export type ReminderStatus = 'Pending' | 'Sent' | 'Dismissed';

export interface Reminder {
    id: string;
    customerId: string;
    vehicleId?: string; 
    type: ReminderType;
    dueDate: string;
    status: ReminderStatus;
    createdAt: string;
    actionedAt?: string;
    eventName?: string; 
}

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'APPROVE' | 'DECLINE';

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    userId: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    details: string;
}

export interface InspectionDiagram {
    id: string;
    make: string;
    model: string;
    imageId: string;
}

export interface InspectionItemTemplate {
    id: string;
    label: string;
}

export interface InspectionSectionTemplate {
    id: string;
    title: string;
    items: InspectionItemTemplate[];
}

export interface InspectionTemplate {
    id: string;
    name: string;
    description?: string;
    isDefault: boolean;
    sections: InspectionSectionTemplate[];
}

export interface DraggedSegmentData {
    parentJobId: string;
    segmentId: string;
    duration: number;
}

export interface BackupSchedule {
    enabled: boolean;
    times: string[]; 
}

export interface UnbillableTimeEvent {
    id: string;
}

export interface EngineerChangeEvent {
    id: string;
}