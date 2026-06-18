const fs = require('fs');

function updateJobsView() {
    const file = 'modules/workshop/JobsView.tsx';
    let code = fs.readFileSync(file, 'utf8');

    // 1. Add isWithinDateRange import
    code = code.replace(
        /import \{ getRelativeDate, formatDate, dateStringToDate, addDays, formatReadableDate \} from '\.\.\/\.\.\/core\/utils\/dateUtils';/,
        "import { getRelativeDate, formatDate, dateStringToDate, addDays, formatReadableDate, isWithinDateRange } from '../../core/utils/dateUtils';"
    );

    // 2. Remove dateFilterOptions and type DateFilterOption
    code = code.replace(/const dateFilterOptions = \{[\s\S]*?type DateFilterOption = keyof typeof dateFilterOptions;/g, "");

    // 3. Replace state
    code = code.replace(
        /const \[dateFilter, setDateFilter\] = useState<DateFilterOption>\('30days'\);/, 
        "const [startDate, setStartDate] = useState(() => getRelativeDate(-30));\n    const [endDate, setEndDate] = useState(() => getRelativeDate(0));"
    );

    // 4. Update filtering logic inside useMemo
    const oldFilterLogic = `let dateCutoff: string | null = null;
        const isToday = dateFilter === 'today';
        const todayDate = isToday ? getRelativeDate(0) : null;

        if (dateFilter === '30days') {
            dateCutoff = getRelativeDate(-30);
        } else if (dateFilter === '90days') {
            dateCutoff = getRelativeDate(-90);
        }

        const initialFilter = safeJobs.filter(job => {
            if (selectedEntityId !== 'all' && job.entityId !== selectedEntityId) {
                return false;
            }
            
            if (isToday) {
                if (job.scheduledDate !== todayDate) return false;
            } else if (dateCutoff && job.createdAt < dateCutoff) {
                return false;
            }`;

    const newFilterLogic = `const initialFilter = safeJobs.filter(job => {
            if (selectedEntityId !== 'all' && job.entityId !== selectedEntityId) {
                return false;
            }
            
            const dateToUse = job.scheduledDate || job.createdAt;
            if (!isWithinDateRange(dateToUse, startDate, endDate)) {
                return false;
            }`;
            
    code = code.replace(oldFilterLogic, newFilterLogic);

    // 5. Update UI text references to dateFilterOptions
    code = code.replace(/\{dateFilterOptions\[dateFilter\]\}/g, '{`${startDate || "Any"} to ${endDate || "Any"}`}');

    // 6. Update UI buttons to date inputs
    const oldUIButtons = `<div className="flex items-center gap-1 p-1 bg-gray-200 rounded-lg">
                            {Object.keys(dateFilterOptions).map((key) => (
                                <button 
                                    key={key}
                                    onClick={() => setDateFilter(key as DateFilterOption)}
                                    className={\`py-1 px-3 rounded-md font-semibold text-xs transition \${dateFilter === key ? 'bg-white shadow' : 'text-gray-600 hover:bg-gray-300'}\`}>
                                    {dateFilterOptions[key as DateFilterOption]}
                                </button>
                            ))}
                        </div>`;
    const newUIButtons = `<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-1 border rounded-md text-xs font-semibold bg-white text-gray-700 w-32" />
                             <span className="text-gray-500 text-xs">to</span>
                             <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-1 border rounded-md text-xs font-semibold bg-white text-gray-700 w-32" />
                             <button onClick={() => { setStartDate(''); setEndDate(''); }} className="ml-2 text-xs text-indigo-600 hover:text-indigo-800">Clear</button>`;
    
    code = code.replace(oldUIButtons, newUIButtons);

    // 7. Update dependencies in useEffect / useMemo
    code = code.replace(/dateFilter/g, "startDate, endDate");

    fs.writeFileSync(file, code);
}

updateJobsView();
