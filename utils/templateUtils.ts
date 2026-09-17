import { Reminder, Customer, Vehicle, BusinessEntity } from '../types';

const getCustomerDisplayName = (customer?: Customer): string => {
    if (!customer) return 'valued customer';
    return customer.forename || 'valued customer';
};

export const generateReminderMessage = (
    reminder: Reminder,
    customer: Customer,
    vehicle: Vehicle | null,
    method: 'Email' | 'SMS' | 'WhatsApp',
    entity?: BusinessEntity | null
): { recipient: string; subject: string; body: string } => {
    
    const customerName = getCustomerDisplayName(customer);
    const vehicleDesc = vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.registration})` : '';

    let templateKey: keyof BusinessEntity | undefined;
    let fallbackBody = '';
    let fallbackSubject = `A Reminder from ${entity?.name || 'Brookspeed'}`;

    if (method === 'WhatsApp') {
        switch (reminder.type) {
            case 'MOT':
                fallbackBody = `🔔 *${entity?.name || 'Brookspeed'} Notifications Hub*\n\nHi [CustomerName],\nThis is an MOT reminder for your *[Make] [Model]* ([Registration]).\n\n📅 *MOT Expiry:* [DueDate]\n📍 *Action Required:* MOT test required before expiry date.\n\n👉 Reply to this message with your preferred booking date or call us to reserve your slot.\n\nThanks,\n*${entity?.name || 'Brookspeed'} Team*`;
                break;
            case 'Tax':
                fallbackBody = `🔔 *${entity?.name || 'Brookspeed'} Notifications Hub*\n\nHi [CustomerName],\nThis is a Road Tax renewal reminder for your *[Make] [Model]* ([Registration]).\n\n📅 *Tax Due Date:* [DueDate]\n📍 *Action Required:* Renew vehicle tax or declare SORN.\n\n👉 *Renew directly online with Gov.uk:*\nhttps://www.gov.uk/vehicle-tax\n\nThanks,\n*${entity?.name || 'Brookspeed'} Team*`;
                break;
            case 'Service':
                fallbackBody = `🔔 *${entity?.name || 'Brookspeed'} Service Reminder*\n\nHi [CustomerName],\nYour *[Make] [Model]* ([Registration]) is due for service on [DueDate].\n\n👉 Reply to schedule your service with our specialist team.\n\nThanks,\n*${entity?.name || 'Brookspeed'}*`;
                break;
            default:
                fallbackBody = `🔔 *${entity?.name || 'Brookspeed'} Reminder*\n\nHi [CustomerName],\nReminder for [Registration]: [DueDate].\n\nThanks,\n*${entity?.name || 'Brookspeed'}*`;
        }
        fallbackSubject = `${reminder.type} Reminder for ${vehicle?.registration}`;
    } else {
        switch (reminder.type) {
            case 'MOT':
                templateKey = method === 'Email' ? 'motReminderEmailTemplate' : 'motReminderSmsTemplate';
                fallbackBody = `Hi [CustomerName], this is a reminder from ${entity?.name || 'Brookspeed'}. Your [Registration] MOT is due on [DueDate]. Please call us to book. Thanks.`;
                fallbackSubject = `Your MOT Reminder for ${vehicle?.registration}`;
                break;
            case 'Tax':
                templateKey = method === 'Email' ? 'taxReminderEmailTemplate' : 'taxReminderSmsTemplate';
                fallbackBody = `Hi [CustomerName], a reminder from ${entity?.name || 'Brookspeed'} that the road tax for [Registration] is due on [DueDate]. You can renew or SORN your vehicle directly online at https://www.gov.uk/vehicle-tax. Thanks.`;
                fallbackSubject = `Road Tax Renewal Reminder for ${vehicle?.registration}`;
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
