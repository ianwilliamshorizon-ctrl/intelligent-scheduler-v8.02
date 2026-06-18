const fs = require('fs');

function updatePurchaseOrdersView() {
    const file = 'components/PurchaseOrdersView.tsx';
    let code = fs.readFileSync(file, 'utf8');

    // 1. Add isWithinDateRange import
    code = code.replace(
        /import \{ formatDate \} from '\.\.\/core\/utils\/dateUtils';/,
        "import { formatDate, isWithinDateRange } from '../core/utils/dateUtils';"
    );

    // 2. Replace logic
    const oldFilterLogic = `const matchesDate = (!startDate || po.orderDate >= startDate) && (!endDate || po.orderDate <= endDate);
            if (!matchesDate) return false;`;

    const newFilterLogic = `if (!isWithinDateRange(po.orderDate, startDate, endDate)) return false;`;
            
    code = code.replace(oldFilterLogic, newFilterLogic);
    
    // 3. Add Clear button
    const oldInputs = `<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-lg bg-white" />
                        <span className="text-gray-500 font-medium">to</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-lg bg-white" />`;
    const newInputs = `<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-lg bg-white" />
                        <span className="text-gray-500 font-medium">to</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-lg bg-white" />
                        <button onClick={() => { setStartDate(''); setEndDate(''); }} className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 font-semibold">Clear</button>`;

    code = code.replace(oldInputs, newInputs);

    fs.writeFileSync(file, code);
}

updatePurchaseOrdersView();
