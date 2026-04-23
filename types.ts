import { Timestamp } from 'firebase/firestore';

/**
 * CORE SYSTEM TYPES
 */
export type ViewType = string;
export type AppEnvironment = 'development' | 'production' | 'staging' | 'uat';
export type UserRole = 'admin' | 'user' | 'Admin' | 'Engineer' | 'Dispatcher' | 'Director';

/** 
 * MOT & VEHICLE HISTORY TYPES 
 * Mapped from UKVD MotHistoryDetails (Normalized to camelCase for TS conventions)
 */
export interface MotAnnotation {
    type: 'FAIL' | 'ADVISORY' | 'MINOR' | 'MAJOR' | 'DANGEROUS' | 'PRS' | 'USER ENTERED';
    text: string;
    isDangerous: boolean;
}

export interface MotExtension {
    hasExtensionPeriod: boolean;
    extensionPeriodReason?: string;
    extensionPeriodAdditionalDays?: number;
    extensionPeriodOriginalDueDate?: string;
}

export interface MotTest {
    testDate: string;
    testPassed: boolean;
    expiryDate?: string | null;
    odometerReading?: string;
    odometerUnit?: string;
    odometerResultType?: string;
    testNumber?: string;
    daysSinceLastTest?: number | null;
    daysSinceLastPass?: number | null;
    daysOutOfMot?: number | null;
    isRetest: boolean;
    extensionInformation?: MotExtension | null;
    annotationList: MotAnnotation[];
}

/**
 * USER, ROLE & PERMISSION TYPES
 */
export interface ManagedDataPermissions {
    isSuperAdmin: boolean;
    canSeeDirectorsDashboard: boolean;
    canManageCustomers?: boolean;
    canManageVehicles?: boolean;
    canManageInspectionDiagrams?: boolean;
    canManageInspectionTemplates?: boolean;
    canManageStaff?: boolean;
    canManageRoles?: boolean;
    canManageEntities?: boolean;
    canManageLifts?: boolean;
    canManageBatteryChargers?: boolean;
    canManageSuppliers?: boolean;
    canManageParts?: boolean;
    canManageServicePackages?: boolean;
    canManageNominalCodes?: boolean;
    canManageTaxCodes?: boolean;
    canManageDiscountCodes?: boolean;
    canManageBackups?: boolean;
    canManageStorageLocations?: boolean;
    canEditSuppliers?: boolean;
    canDeleteSuppliers?: boolean;
    canViewFinancials?: boolean;
    canManageInventory?: boolean;
    canPerformBulkActions?: boolean;
}

export interface User {
    id: string;
    email: string;
    role: UserRole;
    name?: string;
    allowedViews?: ViewType[];
    engineerId?: string;
    preferredEntityId?: string;
    status?: 'pending' | 'active' | 'disabled';
}

export interface Role {
    id: string;
    name?: string;
    baseRole?: 'Admin' | 'Dispatcher' | 'Engineer' | 'Sales' | 'Garage Concierge';
    defaultAllowedViews?: ViewType[];
    managedDataPermissions?: ManagedDataPermissions;
}

/**
 * CUSTOMER & CONTACT TYPES
 */
export interface Customer {
    id: string;
    forename: string;
    surname: string;
    title?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    address?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postcode?: string;
    notes?: string;
    category?: 'Retail' | 'Trade';
    isBusinessCustomer?: boolean;
    isCashCustomer?: boolean;
    marketingConsent?: boolean;
    serviceReminderConsent?: boolean;
    communicationPreference?: 'Email' | 'SMS' | 'WhatsApp' | 'None';
    autoSendReminders?: boolean;
    searchField?: string;
    createdDate?: string;
}

/**
 * VEHICLE & INSPECTION TYPES
 */
export interface PreviousRegistration {
    registration: string;
    changedAt: string; 
    changedByUserId: string;
}

export interface CheckInPhoto {
    id: string;
    dataUrl?: string;
    notes?: string;
    type?: 'photo' | 'video';
    status?: ChecklistItemStatus;
}

export interface VehicleDamagePoint {
    id: string;
    x: number;
    y: number;
    notes?: string;
}

export interface VehicleImage {
    id: string;
    uploadedAt: string; 
    isPrimaryDiagram?: boolean;
    dataUrl?: string;
}

export type DamagePoint = VehicleDamagePoint;

export interface InspectionDiagram {
    id: string;
    make: string;
    model: string;
    imageId: string;
}

export interface TyreData {
    outer?: number;
    middle?: number;
    inner?: number;
    pressure?: number;
    indicator: ChecklistItemStatus;
    comments?: string;
}

export type TyreLocation = 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight' | 'spare';

export type TyreCheckData = {
    [key in TyreLocation]?: TyreData;
};
export interface Job {
    id: string;
    entityId?: string;
    vehicleId: string;
    customerId?: string;
    description: string;
    // Added 'Cancelled' to this union to allow the comparison in your Modal
    status: 'Booked In' | 'In Progress' | 'Awaiting Parts' | 'Complete' | 'Invoiced' | 'Closed' | 'Allocated' | 'Unallocated' | 'Pending QC' | 'Archived' | 'Cancelled' | 'Paused';
    createdAt?: string; 
    completedAt?: string; 
    scheduledDate?: string;
    notes?: string;
    segments?: JobSegment[];
    vehicleStatus?: string;
    invoiceId?: string;
    estimatedHours?: number;
    partsStatus?: string;
    purchaseOrderIds?: string[];
    technicianObservations?: string[];
    estimateId?: string;
    inspectionTemplateId?: string;
    keyNumber?: string;
    damagePoints?: VehicleDamagePoint[];
    tyreCheck?: TyreCheckData;
    inspectionChecklist?: ChecklistSection[];
    mileage?: number;
    createdByUserId?: string;
    lineItems?: EstimateLineItem[];
    associatedJobId?: string;
    isStandalone?: boolean;
    vehicleRegistration?: string;
    jobType?: 'MOT' | 'Standard';
    collectedBy?: string;
    storageLocationId?: string;
    depositAmount?: number;
    depositMethod?: string;
    checkInPhotos?: CheckInPhoto[];
}
export type VehicleStatus = 'On Site' | 'Off-Site (Partner)' | 'Awaiting Arrival' | 'Awaiting Collection' | 'Collected' | 'Cancelled';

export interface Vehicle {
    id: string;
    registration: string;
    make: string;
    model: string;
    type?: string;
    year?: number;
    vin?: string;
    colour?: string;
    fuelType?: string;
    engineNumber?: string;
    cc?: number;
    transmissionType?: 'Manual' | 'Automatic' | 'Other';
    nextMotDate?: string; 
    motExpiryDate?: string; 
    nextServiceDate?: string; 
    winterCheckDate?: string; 
    fleetNumber?: string;
    manufactureDate?: string; 
    covid19MotExemption?: boolean;
    customerId: string;
    customer?: Customer; 
    notes?: string;
    images?: VehicleImage[];
    previousRegistrations?: PreviousRegistration[];
    inspectionDiagramId?: string;
    searchField?: string;
    
    // RELATIONAL DATA FOR SIDEBAR/TABS
    motHistory?: MotTest[];
    jobs?: Job[];
    estimates?: Estimate[];
    invoices?: Invoice[];
}

/**
 * WORKSHOP & JOB TYPES
 */
export interface JobSegment {
    id: string;
    description: string;
    status: 'Unallocated' | 'Allocated' | 'In Progress' | 'Engineer Complete' | 'QC Complete' | 'Paused' | 'Cancelled';
    engineerId?: string;
    date?: string;
    segmentId?: string;
    allocatedLift?: string;
    scheduledStartSegment?: number;
    duration?: number;
    engineerCompletedAt?: string;
}

export interface Lift { 
    id: string; 
    name: string;
    color?: string;
    entityId: string;
    type?: 'Standard' | 'MOT';
}

export interface Purchase {
    id: string;
    entityId: string;
    name: string;
    purchasePrice: number;
    markupPercent?: number;
    jobId?: string | null;
    invoiceId?: string | null;
    supplierId: string;
    supplierReference?: string;
    purchaseDate: string;
    taxCodeId?: string;
    nominalCodeId?: string;
}

export interface DiscountCode {
    id: string;
    code: string;
    discountType: 'percentage' | 'fixed';
    type?: 'Percentage' | 'Fixed';
    value: number;
    expiryDate?: string;
    isActive: boolean;
    description: string;
    applicability: 'All' | 'Labor' | 'Parts' | 'Packages';
}

/**
 * FINANCIAL & ACCOUNTING TYPES
 */
export interface NominalCode { 
    id: string; 
    code: string;
    name: string;
    secondaryCode?: string; // NEW: Added to support display in management tab
    description?: string;
}

export type NominalCodeItemType = 'Labor' | 'Part' | 'MOT' | 'Purchase' | 'CourtesyCar' | 'Storage';

export interface NominalCodeRule { 
    id: string; 
    priority: number;
    entityId: string; // 'all' or entity ID
    itemType: NominalCodeItemType;
    keywords: string; // Comma separated
    excludeKeywords: string; // Comma separated
    supplierKeywords?: string; // NEW: Comma separated for supplier matching
    nominalCodeId: string;
}

export interface TaxRate {
    id: string;
    code?: string;
    rate?: number;
    name?: string;
}

/**
 * ESTIMATE & INVOICE TYPES
 */
export interface EstimateLineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
    taxCodeId?: string; // Required by your error logs
    servicePackageName?: string;
    // --- ADD/VERIFY THESE OPTIONAL PROPERTIES ---
    partId?: string;
    partNumber?: string;
    isStock?: boolean;
    fromStock?: boolean;           // Added for JobEstimateTab
    isPackage?: boolean;
    isPackageComponent?: boolean;
    servicePackageId?: string;
    isOptional?: boolean;
    isLabor?: boolean;             // Added to fix "isLabor does not exist"
    
    // Purchase Order & Supplier fields
    supplierId?: string;           // Added for supplier selection
    purchaseOrderLineItemId?: string; // Added for PO tracking
    
    // Other functional fields
    media?: any[];                 // Added for media attachments
    preCalculatedVat?: number;     // Added for tax calculations
    
    type?: 'labor' | 'part' | 'package';
    receivedQuantity?: number;
    optionGroupId?: string;        // For grouping mutual options (e.g. Option 1 vs Option 2)
    optionLabel?: string;          // e.g. "Option 1", "Option 2"
}

export interface Estimate {
    id: string;
    estimateNumber?: string;
    vehicleId: string;
    customerId: string;
    issueDate: string; 
    expiryDate: string; 
    status: 'Draft' | 'Sent' | 'Approved' | 'Rejected' | 'Converted to Job' | 'Closed';
    lineItems: EstimateLineItem[];
    notes?: string;
    jobId?: string;
    entityId?: string;
    createdByUserId?: string;
    media?: any[];
}

export interface Invoice {
    id: string;
    vehicleId: string;
    customerId: string;
    issueDate: string; 
    dueDate: string; 
    status: 'Draft' | 'Sent' | 'Part Paid' | 'Paid' | 'Overdue' | 'Archived' | 'Archived Not Paid';
    lineItems: any[];
    payments: Payment[];
    totalNet?: number;
    totalVat?: number;
    totalAmount?: number;
    notes?: string;
    financeNotes?: string;
    entityId?: string;
    jobId?: string;
    createdByUserId?: string;
    saleVehicleId?: string;
    storageBookingId?: string;
}

export interface Payment {
    amount: number;
    date: string; 
    method: 'Card' | 'Bank Transfer' | 'Cash' | 'BACS' | 'Other';
    notes?: string;
}

/**
 * PURCHASE & INVENTORY TYPES
 */
export interface PurchaseOrderLineItem {
    id: string;
    partId?: string;
    partNumber: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxCodeId?: string;
    supplierId?: string;
    receivedQuantity?: number;
    returnStatus?: 'None' | 'Pending';
    jobLineItemId?: string;
    purchaseOrderId?: string;
}

export type PurchaseOrderStatus = 'Draft' | 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled' | 'Awaiting Supplier Action' | 'Finalized';

export interface PurchaseOrder { 
    id: string; 
    status?: PurchaseOrderStatus; 
    supplierId?: string;
    entityId?: string;
    vehicleRegistrationRef?: string;
    orderDate?: string; 
    notes?: string;
    lineItems?: PurchaseOrderLineItem[];
    supplierReference?: string;
    secondarySupplierReference?: string;
    jobId?: string;
    type?: 'Standard' | 'Credit';
    history?: { userId: string; timestamp: string; status: string; }[];
    pdfUrl?: string;
    pdfGeneratedAt?: string;
    createdByUserId?: string;
}

export interface ChargingEvent {
    id: string;
    chargerId: string;
    startDate: string;
    endDate: string | null;
}

export interface Part { 
    id: string; 
    searchField?: string; 
    partNumber: string; 
    description: string;
    stockQuantity: number;
    costPrice: number;
    salePrice: number;
    taxCodeId?: string;
    defaultSupplierId?: string;
    isStockItem: boolean;
    alternateSupplierIds?: string[];
}

export interface Supplier { 
    id: string; 
    name?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    postcode?: string;
    shortCode?: string;
    contactName?: string;
}

/**
 * BUSINESS & ENTITY TYPES
 */
export interface WorkingHoursConfig {
    startHour: number;
    endHour: number;
    isOpenSaturday: boolean;
    saturdayStartHour?: number;
    saturdayEndHour?: number;
    isOpenSunday: boolean;
    region: 'england-and-wales' | 'scotland' | 'northern-ireland';
}

export interface DocumentLayoutSettings {
    logoPosition?: 'left' | 'right' | 'center' | 'none';
    brandingPosition?: 'left' | 'right' | 'center' | 'none';
    detailsPosition?: 'left' | 'right' | 'center' | 'none';
    vehiclePosition?: 'left' | 'right' | 'center' | 'none';
    customerPosition?: 'left' | 'right' | 'center' | 'none';
    estimateNumberPosition?: 'left' | 'right'; // Legacy alias for detailsPosition
    logoHeight?: number;
    primaryColor?: string;
    accentColor?: string;
    showBankDetails?: boolean;
    showVatBreakdown?: boolean;
    headerStyle?: 'minimal' | 'bold' | 'classic';
    fontSize?: 'small' | 'medium' | 'large';
}

export interface BusinessEntity {
    id: string;
    name?: string;
    email?: string;
    shortCode?: string;
    laborRate?: number;
    laborCostRate?: number;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    postcode?: string;
    vatNumber?: string;
    companyNumber?: string;
    logoUrl?: string;
    type?: 'Workshop' | 'Sales' | 'Storage' | 'Rentals';
    dailyCapacityHours?: number;
    bankAccountName?: string;
    bankSortCode?: string;
    bankAccountNumber?: string;
    invoiceFooterText?: string;
    logoImageId?: string;
    defaultWeeklyStorageRate?: number;
    color?: string;
    
    // Reminder Templates
    motReminderEmailTemplate?: string;
    motReminderSmsTemplate?: string;
    serviceReminderEmailTemplate?: string;
    serviceReminderSmsTemplate?: string;
    winterCheckReminderEmailTemplate?: string;
    winterCheckReminderSmsTemplate?: string;
    
    // Document Templates
    estimateTemplateId?: string;
    invoiceTemplateId?: string;
    estimateTemplateName?: string;
    invoiceTemplateName?: string;
    
    // Terms and Conditions
    courtesyCarTermsAndConditions?: string;
    rentalTermsAndConditions?: string;
    sorTermsAndConditions?: string;
    storageTermsAndConditions?: string;
    
    workingHours?: WorkingHoursConfig;
    layoutSettings?: DocumentLayoutSettings;
}

export interface Engineer { 
    id: string; 
    name: string; 
    entityId?: string;
}

export interface ServicePackage {
    id: string;
    entityId?: string;
    name?: string;
    description?: string;
    totalPrice?: number;
    totalPriceNet?: number;
    totalPriceVat?: number;
    totalCost?: number;
    isMixedVat?: boolean;
    costItems?: EstimateLineItem[]; 
    applicableMake?: string;
    applicableModel?: string;
    applicableVariant?: string;
    applicableEngineSize?: number;
    taxCodeId?: string;
    isStorageCharge?: boolean;
    storageBookingId?: string;
}

/**
 * INSPECTION & CHECKLIST TYPES
 */
export type ChecklistItemStatus = 'ok' | 'attention' | 'urgent' | 'na';

export interface ChecklistItem {
    id: string;
    label: string;
    status: ChecklistItemStatus;
    comment: string;
}

export interface ChecklistSection {
    id: string;
    title: string;
    items: ChecklistItem[];
    pageBreakBefore?: boolean;
    comments?: string;
}

export interface InspectionTemplate {
    id: string;
    name: string;
    sections: ChecklistSection[];
    isDefault?: boolean;
}

/**
 * INQUIRY & COMMUNICATIONS
 */
export interface Inquiry {
    id: string;
    entityId?: string;
    createdAt: string;
    fromName: string;
    fromContact: string;
    message: string;
    takenByUserId: string;
    status: 'New' | 'In Progress' | 'Quoted' | 'Closed' | 'Approved' | 'Rejected' | 'Sent';
    linkedCustomerId?: string;
    linkedVehicleId?: string;
    linkedEstimateId?: string;
    actionNotes?: string;
    linkedPurchaseOrderIds?: string[];
    linkedJobId?: string;
}

/**
 * LOGGING & SYSTEM ADMIN
 */
export interface AuditLog {
    id: string;
    timestamp: Timestamp;
    userId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    entity: string; 
    entityId: string;
    details: string;
}

export interface BackupSchedule {
    enabled: boolean;
    times: string[];
}
/**
 * RENTAL & BOOKING TYPES
 */
export interface RentalBooking {
    id: string;
    entityId: string;
    customerId: string;
    rentalVehicleId: string; // Changed from vehicleId to match AppModals
    startDate: string;
    endDate: string;
    status: 'Draft' | 'Confirmed' | 'Active' | 'Completed' | 'Cancelled';
    notes?: string;
    totalPrice?: number;
    createdByUserId?: string;
    checkOutDetails?: {
        mileage: number;
        fuelLevel: number;
        conditionNotes: string;
        timestamp: string;
        damagePoints: VehicleDamagePoint[];
    };
    checkInDetails?: {
        mileage: number;
        fuelLevel: number;
        conditionNotes: string;
        timestamp: string;
        damagePoints: VehicleDamagePoint[];
    };
    additionalCharges?: { id: string; description: string; amount: number; }[];
}

export interface RentalVehicle {
    id: string;
    entityId: string;
    make?: string;
    model?: string;
    registration?: string;
    damageCheckImageId?: string | null;
    damageMarkerColors: {
        checkOut: string;
        checkIn: string;
    };
}

export interface StorageBooking {
    id: string;
    entityId: string;
    vehicleId: string;
    customerId: string;
    locationId: string;
    slotIdentifier: string;
    startDate: string;
    endDate?: string | null;
    weeklyRate: number;
    notes?: string;
    keyNumber?: number;
    status?: 'Active' | 'Closed' | 'Cancelled';
    lastBilledDate?: string | null;
    invoiceIds?: string[];
    chargingHistory?: ChargingEvent[];
    media?: SaleMediaItem[];
    checkInPhotos?: CheckInPhoto[];
    checkOutPhotos?: CheckInPhoto[];
    mileage?: number;
}
export interface AbsenceRequest {
    id: string;
    userId: string;
    startDate: string;
    endDate: string;
    type: 'Holiday' | 'Sick' | 'Other';
    status: 'Pending' | 'Approved' | 'Rejected';
}

export interface SaleMediaItem {
    id: string;
    type: 'Photo' | 'Document';
    name: string;
    uploadedAt: string;
}

export interface SaleUpsell {
    id: string;
    description: string;
    costPrice: number;
    salePrice: number;
}

export interface SalePrepCost {
    id: string;
    type: 'Invoice' | 'OneOff';
    description: string;
    cost: number;
    sourceId?: string;
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
    make?: string;
    model?: string;
    registration?: string;
    vin?: string;
    price?: number;
    status: 'Available' | 'Reserved' | 'Sold' | 'Internal' | 'For Sale';
    // Add these missing fields:
    vehicleId?: string; 
    entityId?: string;
    invoiceId?: string;
    stockNumber?: string;
    year?: number;
    mileage?: number;
    description?: string;
    images?: string[];
    createdAt?: string;
    updatedAt?: string;
    saleType?: 'Sale or Return' | 'Stock';
    purchasePrice?: number;
    prepCosts?: any[];
    overheads?: any[];
    upsells?: any[];
    nonRecoverableCosts?: any[];
    depositAmount?: number;
    depositDate?: string | null;
    keyNumber?: number;
    versions?: SaleVersion[];
    activeVersionId?: string;
    media?: SaleMediaItem[];
    finalSalePrice?: number;
    soldDate?: string;
    buyerCustomerId?: string;
    chargingHistory?: ChargingEvent[];
}

export interface SaleVersion {
    versionId: string;
    createdAt: string;
    listPrice: number;
    sorReturnPrice?: number;
}

export interface Prospect {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    source?: string; // e.g., 'Website', 'Walk-in'
    status: 'New' | 'Contacted' | 'Qualified' | 'Lost' | 'Converted';
    notes?: string;
    interestedVehicleId?: string; // Links to SaleVehicle
    linkedSaleVehicleId?: string; // Duplicate/Alternative name? I'll add it for compatibility
    customerId?: string;          // Added for conversion tracking
    createdAt?: string;
    assignedUserId?: string;
}

export interface SaleOverheadPackage {
    id: string;
    name: string;
    cost: number;
}

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    userId: string;
    action: string;
    details: string;
    entityType?: string;
    entityId?: string;
}

export interface Reminder {
    id: string;
    vehicleId: string;
    customerId: string;
    type: 'MOT' | 'Service' | 'Other';
    date: string;
    status: 'Pending' | 'Sent' | 'Failed';
}

export interface StorageBookingSummary {
    id: string;
    entityId: string;
    vehicleId: string;
    customerId: string;
    startDate?: string;
    endDate?: string;
    status?: string;
}

export interface StorageLocation {
    id: string;
    entityId: string;
    name: string;
    capacity: number;
    weeklyRate?: number;
}

export interface BatteryCharger {
    id: string;
    name: string;
    locationDescription?: string;
    entityId?: string;
}

export interface DraggedSegmentData {
    parentJobId: string;
    segmentId: string;
    duration: number;
}

export interface FinancialBaseline {
    id: string;
    entityId: string;
    month: string; // "YYYY-MM"
    salaries: number;
    rentRates: number;
    utilities: number;
    nonBudgetedCosts: number;
    otherOverheads: number;
    // Overrides for months prior to system go-live
    historicalRevenue?: number;
    historicalCostOfSales?: number;
}
