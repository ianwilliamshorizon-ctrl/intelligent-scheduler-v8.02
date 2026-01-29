import { Job, JobSegment } from '../types';

/** Formats a Date object to YYYY-MM-DD string using UTC values to avoid timezone issues */
export const formatDate = (date: Date): string => {
    // Use getUTC... methods to prevent the user's local timezone from causing off-by-one day errors.
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/** Converts date string (YYYY-MM-DD) to Date object, using UTC */
export const dateStringToDate = (dateString: string): Date => {
    const parts = dateString.split('-').map(Number);
    // Use UTC date setting to avoid local timezone offset issues
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
};

/** Gets a relative date (today, tomorrow, etc.) as a YYYY-MM-DD string in UTC */
export const getRelativeDate = (offsetDays: number): string => {
    const today = new Date();
    // Create a new Date object for midnight UTC of today's date to remove local timezone influence.
    const utcDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    utcDate.setUTCDate(utcDate.getUTCDate() + offsetDays);
    return formatDate(utcDate);
};

/** Formats a date string (YYYY-MM-DD) into a more readable format */
export const formatReadableDate = (dateString: string): string => {
    const date = dateStringToDate(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC' // Keep consistent with dateStringToDate to avoid off-by-one day errors
    });
};

/** Adds a number of days to a Date object, returns a new Date object */
export const addDays = (date: Date, days: number): Date => {
    const newDate = new Date(date.valueOf());
    newDate.setUTCDate(newDate.getUTCDate() + days);
    return newDate;
};

/** Calculates the number of full days between two Date objects */
export const daysBetween = (startDate: Date, endDate: Date): number => {
    const oneDay = 1000 * 60 * 60 * 24;
    // Use Math.floor to only count full days
    return Math.floor((endDate.getTime() - startDate.getTime()) / oneDay);
};

/** Gets the next working day (Mon-Sat) as a YYYY-MM-DD string, skipping Sunday */
export const getNextWorkingDay = (dateString: string): string => {
    const date = dateStringToDate(dateString);
    date.setUTCDate(date.getUTCDate() + 1); // Move to next day

    if (date.getUTCDay() === 0) { // If it's Sunday
        date.setUTCDate(date.getUTCDate() + 1); // Move to Monday
    }
    return formatDate(date);
};


/** Splits a job into daily 8-hour segments */
export const splitJobIntoSegments = (job: Pick<Job, 'estimatedHours' | 'scheduledDate'>): JobSegment[] => {
    const { estimatedHours, scheduledDate } = job;
    const segments: JobSegment[] = [];
    let remainingHours = estimatedHours;
    let currentDate = scheduledDate ? dateStringToDate(scheduledDate) : dateStringToDate(getRelativeDate(0));
    
    while (remainingHours > 0) {
        const duration = Math.min(remainingHours, 8); // Max 8 hours per segment
        
        // Skip Sundays
        if (currentDate.getUTCDay() === 0) {
             currentDate.setUTCDate(currentDate.getUTCDate() + 1);
             continue;
        }

        segments.push({
            segmentId: crypto.randomUUID(), 
            duration: duration, 
            date: formatDate(currentDate),
            scheduledStartSegment: null,
            allocatedLift: null,
            status: 'Unallocated',
        });
        
        remainingHours -= duration;
        currentDate.setUTCDate(currentDate.getUTCDate() + 1); 
    }
    
    return segments;
};

/** Calculates the number of working days (Mon-Fri, excluding holidays) between two dates, inclusive. */
export const calculateWorkingDays = (startDateStr: string, endDateStr: string, holidays: Set<string>): number => {
    if (!startDateStr || !endDateStr) return 0;
    
    const startDate = dateStringToDate(startDateStr);
    const endDate = dateStringToDate(endDateStr);

    if (startDate > endDate) return 0;

    let count = 0;
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getUTCDay();
        const dateStr = formatDate(currentDate);

        // Check if it's a weekday and not a bank holiday
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidays.has(dateStr)) {
            count++;
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return count;
};

/** Finds the end date after a specific number of working days from a start date. */
export const findEndDateAfterWorkingDays = (startDateStr: string, workingDaysToTake: number, holidays: Set<string>): string => {
    if (!startDateStr || workingDaysToTake <= 0) return startDateStr;

    const isWorkingDay = (date: Date): boolean => {
        const dayOfWeek = date.getUTCDay();
        const dateStr = formatDate(date);
        return dayOfWeek >= 1 && dayOfWeek <= 5 && !holidays.has(dateStr);
    };

    let daysLeft = Math.ceil(workingDaysToTake);
    let currentDate = dateStringToDate(startDateStr);
    
    // Find the first working day to start counting from.
    while(!isWorkingDay(currentDate)) {
        currentDate = addDays(currentDate, 1);
    }
    
    // The first day counts.
    daysLeft--;
    
    while (daysLeft > 0) {
        currentDate = addDays(currentDate, 1);
        if (isWorkingDay(currentDate)) {
            daysLeft--;
        }
    }
    
    return formatDate(currentDate);
};

export const getStartOfWeek = (date: Date): Date => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setUTCDate(diff));
};