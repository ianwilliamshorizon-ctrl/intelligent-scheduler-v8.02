const fs = require('fs');

function updateEstimatesView() {
    const file = 'components/EstimatesView.tsx';
    let code = fs.readFileSync(file, 'utf8');

    // 1. Add isWithinDateRange import
    code = code.replace(
        /import \{ getRelativeDate \} from '\.\.\/core\/utils\/dateUtils';/,
        "import { getRelativeDate, formatDate, isWithinDateRange } from '../core/utils/dateUtils';"
    );

    // 2. Replace state to add startDate and endDate
    code = code.replace(
        /const \[statusFilter, setStatusFilter\] = useState<Estimate\['status'\]\[\]>\(\[\]\);/, 
        "const [statusFilter, setStatusFilter] = useState<Estimate['status'][]>([]);\n    const [startDate, setStartDate] = useState(() => getRelativeDate(-30));\n    const [endDate, setEndDate] = useState(() => getRelativeDate(0));"
    );

    // 3. Update filtering logic inside useMemo
    const oldFilterLogic = `const thirtyDaysAgo = getRelativeDate(-30);
        const selectedEntity = businessEntities.find(e => e.id === selectedEntityId);

        return estimates.filter(estimate => {
            if (!estimate) return false;

            const vehicle = vehicleMap.get(estimate.vehicleId);
            const customer = customerMap.get(estimate.customerId);

            if (!vehicle || !customer) {
                return false;
            }

            if (selectedEntityId !== 'all' && selectedEntity?.shortCode) {
                if (!estimate.estimateNumber?.startsWith(selectedEntity.shortCode)) return false;
            } else if (selectedEntityId !== 'all') {
                if (estimate.entityId !== selectedEntityId) return false;
            }
            if (estimate.issueDate < thirtyDaysAgo) return false;`;

    const newFilterLogic = `const selectedEntity = businessEntities.find(e => e.id === selectedEntityId);

        return estimates.filter(estimate => {
            if (!estimate) return false;

            const vehicle = vehicleMap.get(estimate.vehicleId);
            const customer = customerMap.get(estimate.customerId);

            if (!vehicle || !customer) {
                return false;
            }

            if (selectedEntityId !== 'all' && selectedEntity?.shortCode) {
                if (!estimate.estimateNumber?.startsWith(selectedEntity.shortCode)) return false;
            } else if (selectedEntityId !== 'all') {
                if (estimate.entityId !== selectedEntityId) return false;
            }
            
            if (!isWithinDateRange(estimate.issueDate, startDate, endDate)) {
                return false;
            }`;
            
    code = code.replace(oldFilterLogic, newFilterLogic);

    // Update dependencies
    code = code.replace(/businessEntities\]\);/, "businessEntities, startDate, endDate]);");

    // 4. Update UI Header Text
    code = code.replace(/<h2 className="text-2xl font-bold text-gray-800">Estimates \(Last 30 Days\)<\/h2>/, 
    '<h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">Estimates <span className="text-gray-500 font-medium text-lg">({startDate || "Any"} to {endDate || "Any"})</span></h2>');

    code = code.replace(/title="Estimates Report \(Last 30 Days\)"/, 
    'title={`Estimates Report (${startDate || "Any"} to ${endDate || "Any"})`}');

    // 5. Add Date picker UI
    const oldSearchBar = `<div className="relative w-full max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Search by number, customer, or vehicle..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full p-2 pl-9 border rounded-lg" />
                </div>`;
    const newSearchBar = `<div className="flex gap-4 items-center">
                    <div className="relative flex-grow">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Search by number, customer, or vehicle..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full p-2 pl-9 border rounded-lg" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">Date Range:</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-md text-xs font-semibold bg-white text-gray-700 w-32" />
                        <span className="text-gray-500 text-xs">to</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-md text-xs font-semibold bg-white text-gray-700 w-32" />
                        <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-xs text-indigo-600 hover:text-indigo-800">Clear</button>
                    </div>
                </div>`;
    
    code = code.replace(oldSearchBar, newSearchBar);

    fs.writeFileSync(file, code);
}

updateEstimatesView();
