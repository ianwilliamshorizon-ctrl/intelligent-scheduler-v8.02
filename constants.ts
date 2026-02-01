
export const START_HOUR = 8;
export const START_MINUTE = 30;
export const END_HOUR = 18;
export const END_MINUTE = 0;
export const SEGMENT_DURATION_MINUTES = 30;
export const CAPACITY_THRESHOLD_WARNING = 0.8; // 80%

export const TIME_SEGMENTS: string[] = [];
const tempDate = new Date(2000, 0, 1, START_HOUR, START_MINUTE);
while (tempDate.getHours() < END_HOUR || (tempDate.getHours() === END_HOUR && tempDate.getMinutes() < END_MINUTE)) {
    const hours = tempDate.getHours();
    const minutes = tempDate.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    TIME_SEGMENTS.push(`${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`);
    tempDate.setMinutes(minutes + SEGMENT_DURATION_MINUTES);
}

export const GRID_COLUMNS = TIME_SEGMENTS.length;

// Half day Saturday (4 hours = 8 segments of 30 mins)
export const SATURDAY_SEGMENT_LIMIT = 8; 

// UK Bank Holidays (Hardcoded for stability)
export const BANK_HOLIDAYS = [
    '2024-01-01', // New Year’s Day
    '2024-03-29', // Good Friday
    '2024-04-01', // Easter Monday
    '2024-05-06', // Early May bank holiday
    '2024-05-27', // Spring bank holiday
    '2024-08-26', // Summer bank holiday
    '2024-12-25', // Christmas Day
    '2024-12-26', // Boxing Day
    '2025-01-01', // New Year’s Day
    '2025-04-18', // Good Friday
    '2025-04-21', // Easter Monday
    '2025-05-05', // Early May bank holiday
    '2025-05-26', // Spring bank holiday
    '2025-08-25', // Summer bank holiday
    '2025-12-25', // Christmas Day
    '2025-12-26', // Boxing Day
];
