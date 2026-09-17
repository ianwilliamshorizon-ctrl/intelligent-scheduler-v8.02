import { Customer, Vehicle, BusinessEntity, Inquiry } from '../../types';
import { saveDocument } from '../db';

/**
 * Logs an outbound communication (Email, SMS, WhatsApp) as a formal correspondence
 * record in `brooks_inquiries` linked to the client's account and vehicle,
 * matching the inquiry card system.
 */
export const logOutboundCorrespondence = async (
    customer: Customer,
    vehicle: Vehicle | null,
    subject: string,
    message: string,
    method: 'Email' | 'SMS' | 'WhatsApp',
    entity?: BusinessEntity | null,
    recipientContact?: string
): Promise<Inquiry> => {
    const inquiryId = crypto.randomUUID();
    const contactTarget = recipientContact || (method === 'Email' ? customer.email : (customer.mobile || customer.phone)) || 'Customer';

    const inquiryDoc: Inquiry = {
        id: inquiryId,
        inquiryNumber: `COM-${Date.now().toString().slice(-6)}`,
        entityId: entity?.id || (vehicle as any)?.entityId,
        createdAt: new Date().toISOString(),
        fromName: entity?.name || 'Brookspeed',
        fromContact: 'info@brookspeed.com',
        fromEmail: 'info@brookspeed.com',
        fromPhone: entity?.phone || '02380 641672',
        subject: subject || `Outbound ${method} - ${vehicle?.registration || 'Reminder'}`,
        message: message,
        takenByUserId: 'system',
        status: 'Closed', // Finished outbound correspondence logged to record
        linkedCustomerId: customer.id,
        linkedVehicleId: vehicle?.id,
        vehicleRegistration: vehicle?.registration,
        vehicleMake: vehicle?.make,
        vehicleModel: vehicle?.model,
        vehicleYear: vehicle?.year ? String(vehicle.year) : undefined,
        vehicleMotExpiry: vehicle?.nextMotDate,
        actionNotes: `Outbound ${method} correspondence sent to ${contactTarget}.`,
        hasNewReply: false,
        logs: [
            {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                userId: 'system',
                actionType: `Outbound ${method} Sent`,
                notes: `Outbound ${method} message sent to ${contactTarget} regarding ${vehicle?.registration || 'vehicle'}.`
            }
        ]
    };

    try {
        await saveDocument('brooks_inquiries', inquiryDoc);
    } catch (err) {
        console.error('Failed to log outbound correspondence inquiry:', err);
    }

    return inquiryDoc;
};
