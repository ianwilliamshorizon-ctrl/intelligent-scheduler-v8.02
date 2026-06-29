import re

with open('components/InquiryFormModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Helper to extract a div block based on a starting string
def extract_block(text, start_str):
    idx = text.find(start_str)
    if idx == -1:
        raise Exception(f"Could not find {start_str[:30]}")
    
    # find the matching closing div
    open_divs = 0
    i = idx
    while i < len(text):
        if text[i:i+4] == '<div':
            open_divs += 1
            i += 4
        elif text[i:i+5] == '</div':
            open_divs -= 1
            if open_divs == 0:
                return text[idx:i+6]
            i += 5
        else:
            i += 1
            
    raise Exception("Unmatched div")

marker_col1 = '{/* Column 1 - Core Message & Links */}\n                <div className="space-y-4">'
marker_col2 = '{/* Column 2 - Status & Reply */}\n                <div className="space-y-4">'
marker_status = '<div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">\n                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Status & Ownership</h4>'
marker_reply = '<div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">\n                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Reply to Inquiry</h4>'
marker_col3 = '{/* Column 3 - Remainder (Logs, Estimate, Attachments) */}\n                <div className="space-y-4">'
marker_logs = '<div>\n                        <label className="block text-sm font-medium text-gray-700 mb-1">CRM Logs & Notes</label>'
marker_attach = '{/* Attachments Section */}'

# Extract Col 1 inner
col1_block = extract_block(content[content.find(marker_col1):], '<div className="space-y-4">')
col1_inner = col1_block[col1_block.find('>')+1:-6].strip()

# Extract Col 2 inner
col2_block = extract_block(content[content.find(marker_col2):], '<div className="space-y-4">')
col2_inner = col2_block[col2_block.find('>')+1:-6].strip()

status_block = extract_block(col2_inner, marker_status)
reply_block = extract_block(col2_inner, marker_reply)

# Extract Col 3 inner
col3_block = extract_block(content[content.find(marker_col3):], '<div className="space-y-4">')
col3_inner = col3_block[col3_block.find('>')+1:-6].strip()

# Split Col 3 into Estimates, Logs, Attachments
estimates_part = col3_inner[:col3_inner.find(marker_logs)].strip()
logs_block = extract_block(col3_inner[col3_inner.find(marker_logs):], '<div>')
# Attachments is everything after logs
attach_part = col3_inner[col3_inner.find(marker_attach):].strip()

# Create the new layout
tabs_nav = """<div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        type="button"
                        onClick={() => setActiveTab('details')}
                        className={`${activeTab === 'details' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2`}
                    >
                        Initial Email & Details
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('communication')}
                        className={`${activeTab === 'communication' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2`}
                    >
                        Communication & Reply
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('estimates')}
                        className={`${activeTab === 'estimates' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2`}
                    >
                        Estimates & Logs
                    </button>
                </nav>
            </div>"""

new_grid = f"""{tabs_nav}
            <div className="min-h-[500px]">
                {{activeTab === 'details' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            {col1_inner}
                        </div>
                        <div className="space-y-4">
                            {status_block}
                        </div>
                    </div>
                )}}

                {{activeTab === 'communication' && (
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-4">
                            {reply_block}
                        </div>
                    </div>
                )}}

                {{activeTab === 'estimates' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            {estimates_part}
                            {attach_part}
                        </div>
                        <div className="space-y-4">
                            {logs_block}
                        </div>
                    </div>
                )}}
            </div>"""

# Replace the old grid
old_grid_start = '<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">'
old_grid_block = extract_block(content[content.find(old_grid_start):], '<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">')

new_content = content.replace(old_grid_block, new_grid)

# Add activeTab state
state_search = 'const [isSendingReply, setIsSendingReply] = useState(false);'
state_replace = "const [isSendingReply, setIsSendingReply] = useState(false);\n    const [activeTab, setActiveTab] = useState<'details' | 'communication' | 'estimates'>('details');"
new_content = new_content.replace(state_search, state_replace)

# Modify useEffect logic
effect_search = """        setIsAnalyzing(false);
        setAiError('');
        setSuggestedCustomer(null);
        setSuggestedVehicle(null);
    }, [isOpen, inquiry, selectedEntityId]);"""
effect_replace = """        setIsAnalyzing(false);
        setAiError('');
        setSuggestedCustomer(null);
        setSuggestedVehicle(null);

        if (inquiry && inquiry.logs && inquiry.logs.some(l => l.actionType === 'Email Sent')) {
            setActiveTab('estimates');
        } else {
            setActiveTab('details');
        }
    }, [isOpen, inquiry, selectedEntityId]);"""
new_content = new_content.replace(effect_search, effect_replace)

# Modify tab switch on reply sent
reply_search = """                                                setReplyText('');
                                                setReplyAttachments([]);
                                                
                                                if (formData.fromName && formData.message) {"""
reply_replace = """                                                setReplyText('');
                                                setReplyAttachments([]);
                                                setActiveTab('estimates');
                                                
                                                if (formData.fromName && formData.message) {"""
new_content = new_content.replace(reply_search, reply_replace)

# Modify row sizes
message_search = 'rows={12}'
message_replace = 'rows={18}'
new_content = new_content.replace(message_search, message_replace, 1)

reply_textarea_search = 'rows={8}'
reply_textarea_replace = 'rows={18}'
new_content = new_content.replace(reply_textarea_search, reply_textarea_replace, 1)


with open('components/InquiryFormModal.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done")
