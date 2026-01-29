import { Reminder, Customer, Vehicle, BusinessEntity } from '../types';

const getCustomerDisplayName = (customer?: Customer): string => {
    if (!customer) return 'valued customer';
    return customer.forename || 'valued customer';
};

export const generateReminderMessage = (
    reminder: Reminder,
    customer: Customer,
    vehicle: Vehicle | null,
    method: 'Email' | 'SMS',
    entity?: BusinessEntity | null
): { recipient: string; subject: string; body: string } => {
    
    const customerName = getCustomerDisplayName(customer);
    const vehicleDesc = vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.registration})` : '';

    let templateKey: keyof BusinessEntity | undefined;
    let fallbackBody = '';
    let fallbackSubject = `A Reminder from ${entity?.name || 'Brookspeed'}`;

    switch (reminder.type) {
        case 'MOT':
            templateKey = method === 'Email' ? 'motReminderEmailTemplate' : 'motReminderSmsTemplate';
            fallbackBody = `Hi [CustomerName], this is a reminder from ${entity?.name || 'Brookspeed'}. Your [Registration] MOT is due on [DueDate]. Please call us to book. Thanks.`;
            fallbackSubject = `Your MOT Reminder for ${vehicle?.registration}`;
            break;
        case 'Service':
            templateKey = method === 'Email' ? 'serviceReminderEmailTemplate' : 'serviceReminderSmsTemplate';
            fallbackBody = `Hi [CustomerName], a reminder from ${entity?.name || 'Brookspeed'} regarding your [Registration]. Our records show its service is due on [DueDate]. Please call us to book. Thanks.`;
            fallbackSubject = `Your Service Reminder for ${vehicle?.registration}`;
            break;
        case 'Winter Check':
            templateKey = method === 'Email' ? 'winterCheckReminderEmailTemplate' : 'winterCheckReminderSmsTemplate';
            fallbackBody = `Hi [CustomerName], a winter safety reminder from ${entity?.name || 'Brookspeed'} for your [Registration]. We recommend a winter check by ${reminder.dueDate}. Call us to book. Thanks.`;
            fallbackSubject = `Your Winter Check Reminder for ${vehicle?.registration}`;
            break;
        case 'Marketing':
            templateKey = method === 'Email' ? 'marketingReminderEmailTemplate' : 'marketingReminderSmsTemplate';
            fallbackBody = `Hi [CustomerName], you're invited to our [EventName] event on [DueDate]. We look forward to seeing you at ${entity?.name || 'Brookspeed'}!`;
            fallbackSubject = `An Invitation from ${entity?.name || 'Brookspeed'}: ${reminder.eventName}`;
            break;
    }

    const recipient = method === 'Email' ? customer.email || '' : customer.mobile || customer.phone || '';
    
    const customTemplate = templateKey && entity ? entity[templateKey] as string : undefined;
    
    const finalBody = (customTemplate && customTemplate.trim() !== '') ? customTemplate : fallbackBody;
    const finalSubject = method === 'Email' ? fallbackSubject : '';

    const body = finalBody
        .replace(/\[CustomerName\]/g, customerName)
        .replace(/\[VehicleDescription\]/g, vehicleDesc)
        .replace(/\[DueDate\]/g, reminder.dueDate)
        .replace(/\[Registration\]/g, vehicle?.registration || '')
        .replace(/\[Make\]/g, vehicle?.make || '')
        .replace(/\[Model\]/g, vehicle?.model || '')
        .replace(/\[EventName\]/g, reminder.eventName || 'our upcoming event');

    return { recipient, subject: finalSubject, body };
};
