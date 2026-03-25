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
    companyName?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    address?: string;
    addressLine1?: string;
    city?: string;
    postcode?: string;
    notes?: string;
    autoSendReminders?: boolean;
    searchField?: string;
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
    dataUrl: string;
}

export interface VehicleDamagePoint {
    id: string;
    x: number;
    y: number;
    notes: string;
}

export interface VehicleImage {
    id: string;
    uploadedAt: string; 
    isPrimaryDiagram?: boolean;
    dataUrl?: string;
}

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
}
export type VehicleStatus = 'On Site' | 'Off-Site (Partner)' | 'Awaiting Arrival' | 'Awaiting Collection' | 'Collected' | 'Cancelled';

export interface Vehicle {
    id: string;
    registration: string;
    make: string;
    model: string;
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
    value: number;
    expiryDate?: string;
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
}

export interface Invoice {
    id: string;
    vehicleId: string;
    customerId: string;
    issueDate: string; 
    dueDate: string; 
    status: 'Draft' | 'Sent' | 'Part Paid' | 'Paid' | 'Overdue';
    lineItems: any[];
    payments: Payment[];
    notes?: string;
    entityId?: string;
    jobId?: string;
    createdByUserId?: string;
    saleVehicleId?: string;
}

export interface Payment {
    amount: number;
    date: string; 
    method: 'Card' | 'Bank Transfer' | 'Cash' | 'Other';
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
export interface BusinessEntity {
    id: string;
    name?: string;
    shortCode?: string;
    laborRate?: number;
    laborCostRate?: number;
    addressLine1?: string;
    city?: string;
    postcode?: string;
    vatNumber?: string;
    logoUrl?: string;
    type?: 'Workshop' | 'Sales' | 'Storage' | 'Rentals';
    dailyCapacityHours?: number;
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
    // Update this from any[] to a specific structure
    costItems?: {
        description: string;
        quantity: number;
        unitPrice: number;
        unitCost: number;
        isStock?: boolean;
        isLabor?: boolean;
        partNumber?: string;
    }[]; 
    applicableMake?: string;
    applicableModel?: string;
    applicableEngineSize?: number;
    taxCodeId?: string;
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
}
export interface AbsenceRequest {
    id: string;
    userId: string;
    startDate: string;
    endDate: string;
    type: 'Holiday' | 'Sick' | 'Other';
    status: 'Pending' | 'Approved' | 'Rejected';
  }
  export interface SaleVehicle {
    id: string;
    make: string;
    model: string;
    registration?: string;
    vin?: string;
    price: number;
    status: 'Available' | 'Reserved' | 'Sold' | 'Internal';
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
    createdAt?: string;
    assignedUserId?: string;
}

export interface SaleOverheadPackage {
    id: string;
    name: string;
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

export interface RentalVehicle {
    id: string;
    entityId: string;
    make?: string;
    model?: string;
    registration?: string;
}

export interface StorageBooking {
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
    name: string;
}

export interface BatteryCharger {
    id: string;
    name: string;
}
