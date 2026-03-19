import { Timestamp } from 'firebase/firestore';

export type ViewType = string;
export type AppEnvironment = 'development' | 'production' | 'staging';

export interface User {
    id: string;
    email: string;
    role: 'admin' | 'user' | 'Admin' | 'Engineer' | 'Dispatcher' | 'Director';
    name?: string;
    allowedViews?: ViewType[];
    engineerId?: string;
    preferredEntityId?: string;
    status?: 'pending' | 'active' | 'disabled';
}

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

export interface PreviousRegistration {
    registration: string;
    changedAt: string; // ISO 8601 date string
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

export interface TyreData {
    outer?: number;
    middle?: number;
    inner?: number;
    pressure?: number;
    indicator: ChecklistItemStatus;
    comments?: string;
}

export type TyreCheckData = {
    [key in TyreLocation]?: TyreData;
};

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
    nextMotDate?: string; // YYYY-MM-DD
    motExpiryDate?: string; // YYYY-MM-DD
    nextServiceDate?: string; // YYYY-MM-DD
    winterCheckDate?: string; // YYYY-MM-DD
    fleetNumber?: string;
    manufactureDate?: string; // YYYY-MM-DD
    covid19MotExemption?: boolean;
    customerId: string;
    notes?: string;
    images?: VehicleImage[];
    previousRegistrations?: PreviousRegistration[];
    inspectionDiagramId?: string;
    searchField?: string;
}

export interface VehicleImage {
    id: string;
    uploadedAt: string; // ISO 8601 date string
    isPrimaryDiagram?: boolean;
    dataUrl?: string;
}

export interface JobSegment {
    id: string;
    description: string;
    status: string;
    engineerId?: string;
    date?: string;
    segmentId?: string;
    allocatedLift?: string;
    scheduledStartSegment?: number;
    duration?: number;
    engineerCompletedAt?: string;
}

export interface Job {
    id: string;
    entityId?: string;
    vehicleId: string;
    customerId?: string;
    description: string;
    status: 'Booked In' | 'In Progress' | 'Awaiting Parts' | 'Complete' | 'Invoiced' | 'Closed' | 'Allocated' | 'Unallocated' | 'Pending QC' | 'Archived' | 'Cancelled' | 'Paused';
    createdAt?: string; // YYYY-MM-DD
    completedAt?: string; // YYYY-MM-DD
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
}

export interface Estimate {
    id: string;
    estimateNumber?: string;
    vehicleId: string;
    customerId: string;
    issueDate: string; // YYYY-MM-DD
    expiryDate: string; // YYYY-MM-DD
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
    issueDate: string; // YYYY-MM-DD
    dueDate: string; // YYYY-MM-DD
    status: 'Draft' | 'Sent' | 'Part Paid' | 'Paid' | 'Overdue';
    lineItems: any[];
    payments: Payment[];
    notes?: string;
    entityId?: string;
}

export interface EstimateLineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    isPackageComponent?: boolean;
    servicePackageId?: string;
    isOptional?: boolean;
    unitCost?: number;
    servicePackageName?: string;
    partNumber?: string;
    isLabor?: boolean;
    taxCodeId?: string;
    media?: CheckInPhoto[];
    partId?: string;
    fromStock?: boolean;
    purchaseOrderLineItemId?: string;
    supplierId?: string;
    preCalculatedVat?: number;
}

export interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    isPackageComponent?: boolean;
    servicePackageId?: string;
    isOptional?: boolean;
    unitCost?: number;
    servicePackageName?: string;
}

export interface Payment {
    amount: number;
    date: string; // YYYY-MM-DD
    method: 'Card' | 'Bank Transfer' | 'Cash' | 'Other';
}

export interface AuditLog {
    id: string;
    timestamp: Timestamp;
    userId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    entity: string; // e.g., 'Vehicle', 'Customer'
    entityId: string;
    details: string;
}

export interface InspectionDiagram {
    id: string;
    make: string;
    model: string;
    imageId: string;
}

export interface PurchaseOrderLineItem {
    id: string;
    partNumber: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxCodeId?: string;
    supplierId?: string;
    receivedQuantity?: number;
    returnStatus?: 'None' | 'Pending';
    jobLineItemId?: string;
}

export type PurchaseOrderStatus = 'Draft' | 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled' | 'Awaiting Supplier Action' | 'Finalized';

export interface PurchaseOrder { 
    id: string; 
    status?: PurchaseOrderStatus; 
    supplierId?: string;
    entityId?: string;
    vehicleRegistrationRef?: string;
    orderDate?: string; // YYYY-MM-DD
    notes?: string;
    lineItems?: PurchaseOrderLineItem[];
    supplierReference?: string;
    secondarySupplierReference?: string;
    jobId?: string;
    type?: 'Standard' | 'Credit';
    history?: { userId: string; timestamp: string; status: string; }[];
    pdfUrl?: string;
    pdfGeneratedAt?: string;
}

export interface Purchase { 
    id: string; 
}

export interface Engineer { 
    id: string; 
    name: string; 
    entityId?: string;
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

export interface ServicePackage {
    id: string;
    entityId?: string;
    name?: string;
    description?: string;
    totalPrice?: number;
    totalPriceNet?: number;
    costItems?: any[]; 
    applicableMake?: string;
    applicableModel?: string;
    applicableEngineSize?: number;
    taxCodeId?: string;
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

export interface Lift { 
    id: string; 
    entityId?: string;
}

export interface RentalVehicle { 
    id: string; 
    entityId?: string;
}

export interface RentalBooking { 
    id: string; 
}

export interface SaleVehicle { 
    id: string; 
    entityId?: string;
}

export interface SaleOverheadPackage { 
    id: string; 
    name?: string;
}

export interface Prospect { 
    id: string; 
}

export interface StorageBooking { 
    id: string; 
    vehicleId: string;
    customerId: string;
    entityId?: string;
}

export interface StorageLocation { 
    id: string; 
    name?: string;
}

export interface BatteryCharger { 
    id: string; 
    name?: string;
}

export interface NominalCode { 
    id: string; 
    code?: string;
}

export interface NominalCodeRule { 
    id: string; 
    priority?: number;
}

export interface AbsenceRequest { 
    id: string; 
}

export interface Inquiry {
    id: string;
    entityId?: string;
    createdAt: string;
    fromName: string;
    fromContact: string;
    message: string;
    takenByUserId: string;
    status: 'New' | 'In Progress' | 'Quoted' | 'Closed' | 'Approved' | 'Rejected';
    linkedCustomerId?: string;
    linkedVehicleId?: string;
    linkedEstimateId?: string;
    actionNotes?: string;
}

export interface Reminder { 
    id: string; 
}

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
}

export interface TaxRate {
    id: string;
    code?: string;
    rate?: number;
    name?: string;
}

export interface Role {
    id: string;
    name?: string;
    defaultAllowedViews?: ViewType[];
}

export interface InspectionTemplate {
    id: string;
    name: string;
    sections: ChecklistSection[];
    isDefault?: boolean;
}

export interface DiscountCode {
    id: string;
}

export interface AuditLogEntry {
    id: string;
}

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

export type TyreLocation = 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight' | 'spare';

export interface BackupSchedule {
    enabled: boolean;
    times: string[];
}
export interface MotTest {
    testDate?: string;
    testPassed?: boolean;
    odometerReading?: string;
    odometerUnit?: string;
    expiryDate?: string;
    testNumber?: string;
    annotationList?: {
        type: 'FAIL' | 'ADVISORY' | 'MINOR';
        text: string;
    }[];
}