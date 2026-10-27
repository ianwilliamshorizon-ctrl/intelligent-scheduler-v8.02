import { Job, Lift, Engineer, AbsenceRequest, BusinessEntity } from '../../../types';

export type CapacityTrafficLight = 'plenty_spare' | 'getting_busy' | 'near_full' | 'closed';

export interface DailyCapacitySummary {
    date: string; // YYYY-MM-DD
    dayName: string; // Monday, Tuesday, etc.
    dayShortName: string; // Mon, Tue, etc.
    formattedDate: string; // 27 Oct 2026
    availableHours: number;
    bookedHours: number;
    spareHours: number;
    utilizationPercent: number;
    status: CapacityTrafficLight;
    emptyBaysCount: number;
    totalBaysCount: number;
    activeEngineersCount: number;
    totalEngineersCount: number;
    absentEngineersCount: number;
    holidayEngineersCount?: number;
    trainingEngineersCount?: number;
    sicknessEngineersCount?: number;
    absentEngineersDetails?: { engineerName: string; type: string }[];
    isWeekend: boolean;
    isHoliday: boolean;
    holidayName?: string;
    jobsCount: number;
}

export interface MonthlyCapacityTotals {
    monthDate: string; // YYYY-MM
    monthName: string; // October 2026
    totalAvailableHours: number;
    totalBookedHours: number;
    totalSpareHours: number;
    averageUtilizationPercent: number;
    totalHolidayDays: number;
    totalTrainingDays: number;
    totalSicknessDays: number;
    activeTechsCount: number;
    days: DailyCapacitySummary[];
}

export interface WeeklyCapacityTotals {
    weekStartDate: string;
    weekEndDate: string;
    totalAvailableHours: number;
    totalBookedHours: number;
    totalSpareHours: number;
    averageUtilizationPercent: number;
    averageEmptyBaysPerDay: number;
    days: DailyCapacitySummary[];
}

export interface FreeCapacitySlot {
    id: string;
    date: string;
    dayName: string;
    formattedDate: string;
    startSegmentIndex: number;
    endSegmentIndex: number;
    startTime: string;
    endTime: string;
    durationHours: number;
    liftId: string;
    liftName: string;
    liftType?: string;
    liftColor?: string;
    engineerId?: string;
    engineerName?: string;
}

export type WarningSeverity = 'critical' | 'warning' | 'info';
export type WarningType = 'overbooked' | 'gap_gt_3h' | 'staff_shortage' | 'unassigned_resources';

export interface CapacityWarning {
    id: string;
    type: WarningType;
    severity: WarningSeverity;
    title: string;
    message: string;
    date: string;
    formattedDate: string;
    jobId?: string;
    jobRef?: string;
    jobDescription?: string;
    engineerId?: string;
    engineerName?: string;
    liftId?: string;
    liftName?: string;
    excessHours?: number;
    gapDurationHours?: number;
    suggestedAction?: string;
}

export type CapacityViewTab = 'capacity-weekly' | 'capacity-monthly' | 'daily-breakdown' | 'spare-search' | 'warnings' | 'timeline' | 'week' | 'calendar' | 'fcs-gantt';

export type SlotVisualStatus = 'Booked' | 'Reserved' | 'Available' | 'On-hold' | 'Sick-leave';

