const fs = require('fs');

function updateInvoicesView() {
    const file = 'modules/workshop/InvoicesView.tsx';
    let code = fs.readFileSync(file, 'utf8');

    // 1. Add isWithinDateRange import
    code = code.replace(
        /import \{ formatDate, getRelativeDate \} from '\.\.\/\.\.\/core\/utils\/dateUtils';/,
        "import { formatDate, getRelativeDate, isWithinDateRange } from '../../core/utils/dateUtils';"
    );

    // 2. Remove dateFilterOptions
    code = code.replace(/const dateFilterOptions = \{[\s\S]*?type DateFilterOption = keyof typeof dateFilterOptions;/g, "");

    // 3. Replace state
    code = code.replace(
        /const \[dateFilter, setDateFilter\] = useState<DateFilterOption>\('this_month'\);/, 
        "const [startDate, setStartDate] = useState(() => { const today = new Date(); return formatDate(new Date(today.getFullYear(), today.getMonth(), 1)); });\n    const [endDate, setEndDate] = useState(() => { const today = new Date(); return formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)); });"
    );

    // 4. Update filtering logic inside useMemo
    const oldFilterLogic = `let startDate: string | null = null;
        let endDate: string | null = null;
        const today = new Date();

        switch (dateFilter) {
            case 'today':
                startDate = getRelativeDate(0);
                endDate = getRelativeDate(0);
                break;
            case 'this_month':
                startDate = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
                endDate = formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
                break;
            case 'last_month':
                startDate = formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
                endDate = formatDate(new Date(today.getFullYear(), today.getMonth(), 0));
                break;
        }

        return invoices.filter(invoice => {
            if (selectedEntityId !== 'all' && invoice.entityId !== selectedEntityId) {
                return false;
            }

            const customer = customerMap.get(invoice.customerId);
            const vehicle = invoice.vehicleId ? vehicleMap.get(invoice.vehicleId) : null;
            const lowerFilter = filter.toLowerCase();

            const matchesDate = (!startDate || invoice.issueDate >= startDate) && (!endDate || invoice.issueDate <= endDate);
            if (!matchesDate) return false;`;

    const newFilterLogic = `return invoices.filter(invoice => {
            if (selectedEntityId !== 'all' && invoice.entityId !== selectedEntityId) {
                return false;
            }

            const customer = customerMap.get(invoice.customerId);
            const vehicle = invoice.vehicleId ? vehicleMap.get(invoice.vehicleId) : null;
            const lowerFilter = filter.toLowerCase();

            if (!isWithinDateRange(invoice.issueDate, startDate, endDate)) {
                return false;
            }`;
            
    code = code.replace(oldFilterLogic, newFilterLogic);

    // 5. Update header text
    code = code.replace(/{dateFilterOptions\[dateFilter\]}/g, '{`${startDate || "Any"} to ${endDate || "Any"}`}');

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

    // 7. Update dependencies
    code = code.replace(/dateFilter\]\);/, "startDate, endDate]);");

    fs.writeFileSync(file, code);
}

updateInvoicesView();
