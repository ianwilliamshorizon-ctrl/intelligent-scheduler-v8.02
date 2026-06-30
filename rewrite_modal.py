import sys

file_path = 'c:/Users/IanW.CIUSLPTP260/Documents/intelligent-scheduler-v8.02/components/InquiryFormModal.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize line endings for reliable searching and replacement
content = content.replace('\r\n', '\n')

# 1. Add activeTab to state
state_search = '''    const [isSendingReply, setIsSendingReply] = useState(false);'''
state_replace = '''    const [isSendingReply, setIsSendingReply] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'communication' | 'estimates'>('details');'''
content = content.replace(state_search, state_replace)

# 2. Update useEffect default tab
effect_search = '''        setIsAnalyzing(false);
        setAiError('');
        setSuggestedCustomer(null);
        setSuggestedVehicle(null);
    }, [isOpen, inquiry, selectedEntityId]);'''
effect_replace = '''        setIsAnalyzing(false);
        setAiError('');
        setSuggestedCustomer(null);
        setSuggestedVehicle(null);

        if (inquiry && inquiry.logs && inquiry.logs.some(l => l.actionType === 'Email Sent')) {
            setActiveTab('estimates');
        } else {
            setActiveTab('details');
        }
    }, [isOpen, inquiry, selectedEntityId]);'''
content = content.replace(effect_search, effect_replace)

# 3. Update activeTab on reply sent
email_search = '''                                                setReplyText('');
                                                setReplyAttachments([]);
                                                
                                                if (formData.fromName && formData.message) {'''
email_replace = '''                                                setReplyText('');
                                                setReplyAttachments([]);
                                                setActiveTab('estimates');
                                                
                                                if (formData.fromName && formData.message) {'''
content = content.replace(email_search, email_replace)

# 4. Now rewrite the return block
return_start = content.find('    return (\n        <FormModal')
if return_start == -1:
    print('Could not find return block')
    sys.exit(1)

# To reliably extract the sections, let's use the comments that demarcate the columns
col1_start = content.find('                {/* Column 1 - Core Message & Links */}')
col2_start = content.find('                {/* Column 2 - Status & Reply */}')
col3_start = content.find('                {/* Column 3 - Remainder (Logs, Estimate, Attachments) */}')
end_of_return = content.find('            </div>\n        </FormModal>')

col1_content = content[col1_start + len('                {/* Column 1 - Core Message & Links */}'):col2_start].strip()
col2_content = content[col2_start + len('                {/* Column 2 - Status & Reply */}'):col3_start].strip()
col3_content = content[col3_start + len('                {/* Column 3 - Remainder (Logs, Estimate, Attachments) */}'):end_of_return].strip()

# Split col2 into "Status & Ownership" and "Reply to Inquiry"
# Let's find the second div with bg-white p-4 in col2
status_and_ownership = col2_content[:col2_content.find('<div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">', 10)].strip()
reply_to_inquiry = col2_content[col2_content.find('<div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">', 10):].strip()

# Make textareas bigger
col1_content = col1_content.replace('rows={12}', 'rows={18}')
reply_to_inquiry = reply_to_inquiry.replace('rows={8}', 'rows={18}')

new_return_block = f'''    return (
        <FormModal
            isOpen={{isOpen}}
            onClose={{onClose}}
            onSave={{handleSave}}
            title={{formData.inquiryNumber ? `Edit Inquiry / Message [${{formData.inquiryNumber}}]` : inquiry?.id ? 'Edit Inquiry / Message' : 'Log New Inquiry / Message'}}
            maxWidth="max-w-[90vw] lg:max-w-6xl"
        >
            <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        type="button"
                        onClick={{() => setActiveTab('details')}}
                        className={{`${{activeTab === 'details' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2`}}
                    >
                        Initial Email & Details
                    </button>
                    <button
                        type="button"
                        onClick={{() => setActiveTab('communication')}}
                        className={{`${{activeTab === 'communication' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2`}}
                    >
                        Communication & Reply
                    </button>
                    <button
                        type="button"
                        onClick={{() => setActiveTab('estimates')}}
                        className={{`${{activeTab === 'estimates' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition flex items-center gap-2`}}
                    >
                        Estimates & Logs
                    </button>
                </nav>
            </div>

            <div className="min-h-[500px]">
                {{activeTab === 'details' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {col1_content}
                        <div className="space-y-4">
                            {status_and_ownership}
                        </div>
                    </div>
                )}}

                {{activeTab === 'communication' && (
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-4">
                            {reply_to_inquiry}
                        </div>
                    </div>
                )}}

                {{activeTab === 'estimates' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {col3_content}
                    </div>
                )}}
            </div>
        </FormModal>
    );'''

content = content[:return_start] + new_return_block + '\n};\n\nexport default InquiryFormModal;\n'

with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Done")
