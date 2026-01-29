
import { PurchaseOrder } from '../../types';

export const getPoStatusColor = (status: PurchaseOrder['status'], type: 'bg' | 'text') => {
    const colors = {
        'Draft': { bg: 'bg-gray-200', text: 'text-gray-800' },
        'Ordered': { bg: 'bg-blue-200', text: 'text-blue-800' },
        'Partially Received': { bg: 'bg-amber-200', text: 'text-amber-800' },
        'Received': { bg: 'bg-green-200', text: 'text-green-800' },
        'Cancelled': { bg: 'bg-red-200', text: 'text-red-800' },
    };
    return colors[status]?.[type] || colors['Draft'][type];
};
