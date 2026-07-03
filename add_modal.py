with open('components/InquiriesView.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if "const [hoveredInquiryId, setHoveredInquiryId] = useState<string | null>(null);" in line:
        new_lines.append(line)
        new_lines.append("    const [inquiryToClose, setInquiryToClose] = useState<Inquiry | null>(null);\n")
    else:
        new_lines.append(line)

lines = new_lines
new_lines = []

in_handle_update = False
skip_next = 0

for i, line in enumerate(lines):
    if skip_next > 0:
        skip_next -= 1
        continue

    if "const handleUpdateStatus = async (inquiry: Inquiry, newStatus: Inquiry['status']) => {" in line:
        new_lines.append("    const handleUpdateStatus = async (inquiry: Inquiry, newStatus: Inquiry['status'], providedReason?: string) => {\n")
        new_lines.append("        let closedReason = providedReason || inquiry.closedReason;\n")
        new_lines.append("        if (newStatus === 'Closed' && inquiry.status !== 'Closed' && !providedReason) {\n")
        new_lines.append("            setInquiryToClose(inquiry);\n")
        new_lines.append("            return;\n")
        new_lines.append("        }\n\n")
        
        # We need to skip the window.prompt lines we added previously
        # The lines to skip are:
        # let closedReason = inquiry.closedReason;
        # if (newStatus === 'Closed' && inquiry.status !== 'Closed') {
        #     const reason = window.prompt("Reason for closing this inquiry?\n(e.g. Lost to Competitor, Too Expensive, Ghosted, Project Cancelled)");
        #     if (reason === null) return; // User cancelled
        #     closedReason = reason;
        # }
        
        # We will manually handle this by checking next lines
        in_handle_update = True
    elif in_handle_update and "let closedReason = inquiry.closedReason;" in line:
        # skip this and next 5 lines
        skip_next = 5
        in_handle_update = False
    elif "return (" in line and "export default function" not in line and "const InquiriesView" not in line:
        # Wait, there's only one main return in InquiriesView. We can just inject the modal right before the final </div>
        # Let's do that differently.
        new_lines.append(line)
    else:
        new_lines.append(line)

lines = new_lines
new_lines = []

# Inject Modal at the very end
for i, line in enumerate(lines):
    if line.strip() == "</div>" and lines[i+1].strip() == ");" and "};" in lines[i+2]:
        # Inject modal before the last closing div
        modal_code = '''
            {inquiryToClose && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-200">
                        <h2 className="text-lg font-bold text-gray-800 mb-2">Close Inquiry</h2>
                        <p className="text-sm text-gray-600 mb-4">Please select a reason for closing this inquiry.</p>
                        
                        <div className="mb-6">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reason for Closing</label>
                            <select 
                                id="closeReasonSelect"
                                className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="Lost to Competitor">Lost to Competitor</option>
                                <option value="Too Expensive">Too Expensive</option>
                                <option value="No Response / Ghosted">No Response / Ghosted</option>
                                <option value="Project Cancelled / Changed Mind">Project Cancelled / Changed Mind</option>
                                <option value="Duplicate Inquiry">Duplicate Inquiry</option>
                                <option value="Spam / Invalid">Spam / Invalid</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        
                        <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => setInquiryToClose(null)}
                                className="px-4 py-2 border rounded font-medium text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    const select = document.getElementById('closeReasonSelect') as HTMLSelectElement;
                                    handleUpdateStatus(inquiryToClose, 'Closed', select.value);
                                    setInquiryToClose(null);
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded font-medium shadow-sm hover:bg-red-700"
                            >
                                Close Inquiry
                            </button>
                        </div>
                    </div>
                </div>
            )}
'''
        new_lines.append(modal_code)
        new_lines.append(line)
    else:
        new_lines.append(line)

with open('components/InquiriesView.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
