const fs = require('fs');

const path = 'c:/Users/IanW.CIUSLPTP260/Documents/intelligent-scheduler-v8.02/components/InquiryFormModal.tsx';
let content = fs.readFileSync(path, 'utf8');

const returnRegex = /return \([\s\S]*?    \);\n};\n\nexport default InquiryFormModal;/;

const newReturn = `return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            onSave={handleSave}
            title={inquiry?.id ? 'Edit Inquiry / Message' : 'Log New Inquiry / Message'}
            maxWidth="max-w-7xl"
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Core Details & Links */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From (Name)*</label>
                            <input name="fromName" value={formData.fromName || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contact (Phone/Email)</label>
                            <input name="fromContact" value={formData.fromContact || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Message*</label>
                        <div className="relative">
                            <textarea name="message" value={formData.message || ''} onChange={handleChange} rows={12} className="w-full p-2 border rounded pr-12 text-sm" required />
                            <button 
                                type="button" 
                                onClick={handleAnalyze} 
                                disabled={isAnalyzing || !formData.message}
                                className="absolute top-2 right-2 p-2 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Analyze message with AI"
                            >
                                {isAnalyzing ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16} />}
                            </button>
                        </div>
                    </div>
                    
                    { (suggestedCustomer || suggestedVehicle || aiError) && (
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2 animate-fade-in">
                            <h4 className="font-semibold text-indigo-800 text-sm">AI Suggestions</h4>
                            {aiError && <p className="text-red-600 text-xs">{aiError}</p>}
                            
                            {suggestedCustomer && !formData.linkedCustomerId && (
                            <div className="flex justify-between items-center text-sm p-2 bg-white rounded-md border">
                                <div className="flex items-center gap-2">
                                    <UserIcon size={14} className="text-blue-500" />
                                    <p>Found Customer: <span className="font-semibold">{getCustomerDisplayName(suggestedCustomer)}</span></p>
                                </div>
                                <button type="button" onClick={() => handleLinkCustomer(suggestedCustomer)} className="flex items-center gap-1 text-xs py-1 px-2 bg-green-100 text-green-700 font-semibold rounded hover:bg-green-200">
                                <LinkIcon size={12}/> Link
                                </button>
                            </div>
                            )}
                            
                            {suggestedVehicle && !formData.linkedVehicleId && (
                            <div className="flex justify-between items-center text-sm p-2 bg-white rounded-md border">
                                <div className="flex items-center gap-2">
                                    <Car size={14} className="text-green-500" />
                                    <p>Found Vehicle: <span className="font-semibold">{suggestedVehicle.registration}</span> ({suggestedVehicle.make} {suggestedVehicle.model})</p>
                                </div>
                                <button type="button" onClick={() => handleLinkVehicle(suggestedVehicle)} className="flex items-center gap-1 text-xs py-1 px-2 bg-green-100 text-green-700 font-semibold rounded hover:bg-green-200">
                                <LinkIcon size={12}/> Link
                                </button>
                            </div>
                            )}
                        </div>
                    )}

                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Links & Assignments</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Customer Connection</label>
                                {linkedCustomer ? (
                                    <div className="p-2 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center text-sm shadow-xs">
                                        <div className="flex items-center gap-2 text-green-800">
                                            <UserCheck size={16} className="text-green-700 shrink-0"/>
                                            <p className="font-semibold truncate max-w-[200px]" title={getCustomerDisplayName(linkedCustomer)}>{getCustomerDisplayName(linkedCustomer)}</p>
                                        </div>
                                        <button type="button" onClick={handleUnlinkCustomer} title="Unlink Customer" className="text-gray-400 hover:text-red-500 transition">
                                            <XCircle size={16}/>
                                        </button>
                                    </div>
                                ) : (
                                    <SearchableSelect
                                        options={customers.map(c => ({ id: c.id, label: getCustomerDisplayName(c), value: c.id }))}
                                        defaultValue={formData.linkedCustomerId || null}
                                        onSelect={(value) => setFormData(p => ({ ...p, linkedCustomerId: value }))}
                                        placeholder="Link to an existing customer..."
                                    />
                                )}
                            </div>
                            
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Vehicle Connection</label>
                                {linkedVehicle ? (
                                     <div className="p-2 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center text-sm shadow-xs">
                                        <div className="flex items-center gap-2 text-green-800">
                                            <Car size={16} className="text-green-700 shrink-0"/>
                                            <p className="font-semibold truncate max-w-[200px]" title={\`\${linkedVehicle.registration} - \${linkedVehicle.make} \${linkedVehicle.model}\`}>{linkedVehicle.registration}</p>
                                        </div>
                                        <button type="button" onClick={handleUnlinkVehicle} title="Unlink Vehicle" className="text-gray-400 hover:text-red-500 transition">
                                            <XCircle size={16}/>
                                        </button>
                                    </div>
                                ) : (
                                    <SearchableSelect
                                        options={vehicles.map(v => ({ id: v.id, label: \`\${v.registration} - \${v.make} \${v.model}\`, value: v.id }))}
                                        defaultValue={formData.linkedVehicleId || null}
                                        onSelect={(value) => setFormData(p => ({ ...p, linkedVehicleId: value }))}
                                        placeholder="Link to an existing vehicle..."
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {linkedEstimate && (
                        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm">
                            <div className="flex flex-col gap-3">
                                <div>
                                    <p className="font-bold text-indigo-800 flex items-center gap-2 text-sm"><FileText size={16}/> Linked Estimate</p>
                                    <p className="text-xs text-indigo-600 font-medium mt-0.5">#{linkedEstimate.estimateNumber} - {linkedEstimate.status}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {onViewEstimate && (
                                        <button 
                                            onClick={() => {
                                                onViewEstimate(linkedEstimate);
                                                onClose(); 
                                            }}
                                            className="px-3 py-1.5 bg-white text-indigo-700 border border-indigo-200 font-bold rounded-lg hover:bg-indigo-50 text-xs shadow-sm transition"
                                        >
                                            Review Estimate
                                        </button>
                                    )}
                                    {onEditEstimate && linkedEstimate.status === 'Draft' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onEditEstimate(linkedEstimate);
                                                onClose();
                                            }}
                                            className="flex items-center gap-1.5 text-xs py-1.5 px-3 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600 shadow-sm transition"
                                        >
                                            <Edit size={14}/> Edit Estimate
                                        </button>
                                    )}
                                    {linkedEstimate.status === 'Approved' && !linkedEstimate.jobId && onScheduleEstimate && (
                                         <button 
                                            onClick={() => {
                                                onScheduleEstimate(linkedEstimate, formData.id);
                                                onClose();
                                            }}
                                            className="px-3 py-1.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-sm flex items-center gap-1 text-xs transition"
                                        >
                                            <CalendarCheck size={14}/> Schedule Job
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {formData.media && formData.media.length > 0 && (
                        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
                            <label className="block text-sm font-bold text-gray-800 border-b pb-2 mb-3">Attachments ({formData.media.length})</label>
                            <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-1">
                                {formData.media.map((item: any) => {
                                    const isPhoto = item.type === 'Photo';
                                    return (
                                        <div key={item.id} className="flex items-center justify-between p-2 border rounded-lg bg-gray-50 text-xs">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {isPhoto ? <Camera size={16} className="text-indigo-500 shrink-0" /> : <FileText size={16} className="text-gray-500 shrink-0" />}
                                                <span className="truncate font-medium text-gray-700 text-[11px]" title={item.name}>{item.name}</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={async () => {
                                                    const { getImage } = await import('../utils/imageStore');
                                                    const dataUrl = await getImage(item.id);
                                                    if (dataUrl) {
                                                        const link = document.createElement('a');
                                                        link.href = dataUrl;
                                                        link.download = item.name;
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                    } else {
                                                        alert('Could not retrieve file.');
                                                    }
                                                }} 
                                                className="text-[10px] bg-white px-2 py-1 rounded shadow-sm border font-bold hover:bg-gray-100 transition shrink-0"
                                            >
                                                Download
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Column 2: Status & Reply */}
                <div className="space-y-4">
                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Status & Ownership</h4>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                                <select name="status" value={formData.status || 'New'} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-gray-50">
                                    <option value="New">New</option>
                                    <option value="Immediate Quote">Immediate Quote</option>
                                    <option value="Escalated/Urgent">Escalated/Urgent</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Quoted or Responded">Quoted or Responded</option>
                                    <option>Rejected</option>
                                    <option>Closed</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Follow Up Date</label>
                                <input type="date" name="followUpDate" value={formData.followUpDate || ''} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Taken By</label>
                                <SearchableSelect
                                    options={users.map(u => ({ id: u.id, label: u.name, value: u.id }))}
                                    defaultValue={formData.takenByUserId || null}
                                    onSelect={(value) => setFormData(p => ({ ...p, takenByUserId: value }))}
                                    placeholder="Assign to staff member..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">
                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Reply to Inquiry</h4>
                        <div>
                            <textarea 
                                value={replyText} 
                                onChange={e => setReplyText(e.target.value)} 
                                rows={14} 
                                className="w-full p-2 border rounded text-sm mb-2" 
                                placeholder="Type your reply or use AI to draft one..."
                            />
                            <div className="flex justify-between items-center mt-1">
                                <button 
                                    type="button" 
                                    onClick={async () => {
                                        if (!formData.message) return;
                                        setIsDraftingReply(true);
                                        try {
                                            const draft = await generateEmailReply(formData.message, 'Brookspeed');
                                            setReplyText(draft);
                                        } catch (e) {
                                            console.error(e);
                                            alert('Failed to draft reply using AI.');
                                        } finally {
                                            setIsDraftingReply(false);
                                        }
                                    }}
                                    disabled={isDraftingReply || !formData.message}
                                    className="flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-3 py-1.5 rounded hover:bg-purple-100 border border-purple-200 transition disabled:opacity-50"
                                >
                                    {isDraftingReply ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Draft with AI
                                </button>

                                <button 
                                    type="button" 
                                    onClick={async () => {
                                        if (!replyText || !formData.fromContact || !formData.fromContact.includes('@')) {
                                            alert('Please enter a valid email reply and ensure the customer has an email address.');
                                            return;
                                        }
                                        setIsSendingReply(true);
                                        try {
                                            const success = await sendOutboundEmail({
                                                to: formData.fromContact,
                                                fromName: 'Brookspeed',
                                                fromEmail: 'info@brookspeed.com',
                                                subject: \`Re: Your Inquiry\`,
                                                body: replyText
                                            });
                                            if (success) {
                                                const newLog = {
                                                    id: crypto.randomUUID(),
                                                    timestamp: new Date().toISOString(),
                                                    userId: currentUser.id,
                                                    actionType: 'Email Sent',
                                                    notes: \`To: \${formData.fromContact}\\n\\n\${replyText}\`
                                                };
                                                const updatedLogs = [...(formData.logs || []), newLog];
                                                setFormData(p => ({ ...p, logs: updatedLogs }));
                                                setReplyText('');
                                                
                                                if (formData.fromName && formData.message) {
                                                    const inquiryToSave = {
                                                        id: formData.id || crypto.randomUUID(),
                                                        createdAt: formData.createdAt || new Date().toISOString(),
                                                        takenByUserId: formData.takenByUserId || currentUser.id,
                                                        ...formData,
                                                        logs: updatedLogs
                                                    };
                                                    onSave(inquiryToSave, false);
                                                }
                                                alert('Email sent successfully!');
                                            } else {
                                                alert('Failed to send email.');
                                            }
                                        } catch (e) {
                                            console.error(e);
                                            alert('Failed to send email.');
                                        } finally {
                                            setIsSendingReply(false);
                                        }
                                    }}
                                    disabled={isSendingReply || !replyText}
                                    className="flex items-center gap-1 text-xs font-bold text-white bg-indigo-600 px-4 py-1.5 rounded shadow hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                    {isSendingReply ? <Loader2 size={14} className="animate-spin" /> : 'Send Reply'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 3: CRM Logs */}
                <div className="space-y-4 h-full flex flex-col">
                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4 h-full flex flex-col flex-grow">
                        <h4 className="text-sm font-bold text-gray-800 border-b pb-2 shrink-0">CRM Logs & Notes</h4>
                        <div className="border rounded bg-gray-50 p-2 space-y-2 flex-grow overflow-y-auto min-h-[400px]">
                            {(!formData.logs || formData.logs.length === 0) && !formData.actionNotes && (
                                <p className="text-xs text-gray-500 italic">No logs recorded yet.</p>
                            )}
                            {formData.actionNotes && (
                                <div className="text-xs bg-white p-2 border rounded shadow-sm">
                                    <p className="font-semibold text-gray-600 mb-1">Legacy Notes</p>
                                    <p className="text-gray-800 whitespace-pre-wrap">{formData.actionNotes}</p>
                                </div>
                            )}
                            {(formData.logs || []).map(log => (
                                <div key={log.id} className="text-xs bg-white p-2 border rounded shadow-sm">
                                    <div className="flex justify-between text-gray-500 mb-1">
                                        <span className="font-semibold">{log.userId === 'System' ? 'System' : users.find(u => u.id === log.userId)?.name || 'User'}</span>
                                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                                    </div>
                                    {log.actionType && <span className="inline-block bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 rounded mb-1">{log.actionType}</span>}
                                    <p className="text-gray-800 whitespace-pre-wrap">{log.notes}</p>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 shrink-0 mt-3">
                            <input 
                                type="text" 
                                placeholder="Type a note and press enter..." 
                                className="flex-1 p-2 border rounded text-sm"
                                id="newLogInput"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const val = e.currentTarget.value.trim();
                                        if (val) {
                                            const newLog = {
                                                id: crypto.randomUUID(),
                                                timestamp: new Date().toISOString(),
                                                userId: currentUser.id,
                                                notes: val
                                            };
                                            const updatedLogs = [...(formData.logs || []), newLog];
                                            setFormData(p => ({ ...p, logs: updatedLogs }));
                                            
                                            if (formData.fromName && formData.message) {
                                                const inquiryToSave = {
                                                    id: formData.id || crypto.randomUUID(),
                                                    createdAt: formData.createdAt || new Date().toISOString(),
                                                    takenByUserId: formData.takenByUserId || currentUser.id,
                                                    ...formData,
                                                    logs: updatedLogs
                                                };
                                                onSave(inquiryToSave as Inquiry, false);
                                            }

                                            e.currentTarget.value = '';
                                        }
                                    }
                                }}
                            />
                            <button 
                                type="button"
                                className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 shrink-0"
                                onClick={() => {
                                    const input = document.getElementById('newLogInput');
                                    const val = input?.value.trim();
                                    if (val) {
                                        const newLog = {
                                            id: crypto.randomUUID(),
                                            timestamp: new Date().toISOString(),
                                            userId: currentUser.id,
                                            notes: val
                                        };
                                        const updatedLogs = [...(formData.logs || []), newLog];
                                        setFormData(p => ({ ...p, logs: updatedLogs }));

                                        if (formData.fromName && formData.message) {
                                            const inquiryToSave = {
                                                id: formData.id || crypto.randomUUID(),
                                                createdAt: formData.createdAt || new Date().toISOString(),
                                                takenByUserId: formData.takenByUserId || currentUser.id,
                                                ...formData,
                                                logs: updatedLogs
                                            };
                                            onSave(inquiryToSave as Inquiry, false);
                                        }

                                        input.value = '';
                                    }
                                }}
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </FormModal>
    );
};

export default InquiryFormModal;`;

content = content.replace(returnRegex, newReturn);
fs.writeFileSync(path, content);
