export const START_HOUR = 8;
export const START_MINUTE = 30;
export const END_HOUR = 17;
export const END_MINUTE = 30;
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