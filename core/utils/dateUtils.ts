import { Job, JobSegment } from '../../types';

/** Formats a Date object to YYYY-MM-DD string using UTC values to avoid timezone issues */
export const formatDate = (date: Date): string => {
    if (!date) return '';
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/** * Converts date string (YYYY-MM-DD) to Date object, using UTC.
 * FIXED: Added safety check to prevent "split of undefined" crash.
 */
export const dateStringToDate = (dateString: string): Date => {
    if (!dateString || typeof dateString !== 'string') {
        // Return a default date (today) to prevent the app from crashing
        console.warn('dateStringToDate received invalid string:', dateString);
        const now = new Date();
        return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    }
    const parts = dateString.split('-').map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
};

/** Gets a relative date (today, tomorrow, etc.) as a YYYY-MM-DD string in UTC */
export const getRelativeDate = (offsetDays: number): string => {
    const today = new Date();
    const utcDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    utcDate.setUTCDate(utcDate.getUTCDate() + offsetDays);
    return formatDate(utcDate);
};

/** Get today's date as YYYY-MM-DD string using local time */
export const getTodayISOString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/** Get a future date as YYYY-MM-DD string using local time */
export const getFutureDateISOString = (daysToAdd: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysToAdd);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/** * Formats a date string (YYYY-MM-DD) into a more readable format.
 * FIXED: Added safety check to prevent crash on undefined.
 */
export const formatReadableDate = (dateString: string): string => {
    if (!dateString) return 'TBD';
    try {
        const date = dateStringToDate(dateString);
        return date.toLocaleDateString('en-GB', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC' 
        });
    } catch (e) {
        return 'Invalid Date';
    }
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
    return Math.floor((endDate.getTime() - startDate.getTime()) / oneDay);
};

/** Gets the next working day (Mon-Sat) as a YYYY-MM-DD string, skipping Sunday */
export const getNextWorkingDay = (dateString: string): string => {
    const date = dateStringToDate(dateString);
    date.setUTCDate(date.getUTCDate() + 1); 

    if (date.getUTCDay() === 0) { 
        date.setUTCDate(date.getUTCDate() + 1); 
    }
    return formatDate(date);
};

/** Gets the next valid working date, skipping Sundays and specified Bank Holidays. */
export const getNextValidWorkingDate = (startDateStr: string, bankHolidays: string[]): string => {
    let date = dateStringToDate(startDateStr);
    date.setUTCDate(date.getUTCDate() + 1);
    
    while (true) {
        const dateStr = formatDate(date);
        const dayOfWeek = date.getUTCDay(); 
        const isHoliday = (bankHolidays || []).includes(dateStr);
        
        if (dayOfWeek !== 0 && !isHoliday) {
            return dateStr;
        }
        date.setUTCDate(date.getUTCDate() + 1);
        if (date.getUTCDate() > 365) break; // Safety break
    }
    return formatDate(date);
};

/** Splits a job into daily 8-hour segments - Fixed with engineerId */
export const splitJobIntoSegments = (job: Pick<Job, 'estimatedHours' | 'scheduledDate'>): JobSegment[] => {
    const { estimatedHours, scheduledDate } = job;
    const segments: JobSegment[] = [];
    let remainingHours = estimatedHours;
    let currentDate = scheduledDate ? dateStringToDate(scheduledDate) : dateStringToDate(getRelativeDate(0));
    
    while (remainingHours > 0) {
        const duration = Math.min(remainingHours, 8); 
        
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
            engineerId: null,
            status: 'Unallocated',
        });
        
        remainingHours -= duration;
        currentDate.setUTCDate(currentDate.getUTCDate() + 1); 
    }
    
    return segments;
};

/** Calculates the number of working days between two dates. */
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
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && !(holidays?.has(dateStr))) {
            count++;
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return count;
};

/** Finds the end date after working days. */
export const findEndDateAfterWorkingDays = (startDateStr: string, workingDaysToTake: number, holidays: Set<string>): string => {
    if (!startDateStr || workingDaysToTake <= 0) return startDateStr;
    const isWorkingDay = (date: Date): boolean => {
        const dayOfWeek = date.getUTCDay();
        const dateStr = formatDate(date);
        return dayOfWeek >= 1 && dayOfWeek <= 5 && !(holidays?.has(dateStr));
    };
    let daysLeft = Math.ceil(workingDaysToTake);
    let currentDate = dateStringToDate(startDateStr);
    while(!isWorkingDay(currentDate)) {
        currentDate = addDays(currentDate, 1);
    }
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
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); 
    return new Date(d.setUTCDate(diff));
};

/** New helper to calculate staff-adjusted capacity */
export const getNetCapacityForDate = (date: string, baseCapacity: number, absencesByDate: Map<string, number>): number => {
    const absenceReduction = absencesByDate.get(date) || 0;
    return Math.max(0, baseCapacity - absenceReduction);
};

/** Updated findNextAvailableDate with absence support and segments protection */
export const findNextAvailableDate = (
    startDate: string, 
    jobHours: number, 
    jobs: Job[], 
    maxCapacity: number,
    absencesByDate?: Map<string, number>
): string => {
    let currentDate = dateStringToDate(startDate);
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);

    for (let i = 0; i < 365; i++) {
        if (currentDate.getUTCDay() === 0) {
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            continue;
        }

        const dateString = formatDate(currentDate);
        const actualCapacity = absencesByDate 
            ? getNetCapacityForDate(dateString, maxCapacity, absencesByDate)
            : maxCapacity;

        const dailyHours = (jobs || [])
            .flatMap(job => (Array.isArray(job.segments) ? job.segments : [])) // Protected from undefined segments
            .filter(segment => segment.date === dateString && segment.status !== 'Cancelled')
            .reduce((sum, segment) => sum + (Number(segment.duration) || 0), 0);

        if (dailyHours + jobHours <= actualCapacity) {
            return dateString;
        }

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return formatDate(currentDate);
};