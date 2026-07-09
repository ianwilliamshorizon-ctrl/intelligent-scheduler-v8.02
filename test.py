import re

with open('components/InquiryFormModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Rename tabs in the button text
content = content.replace('>Estimates, Notes & Logs<', '>Estimates<')
content = content.replace('>Communication & Reply<', '>Communication, Notes & Logs<')

# Now let's extract the components of the JSX to rearrange them.
# The ctiveTab === 'estimates' block:
# It looks like:
# {activeTab === 'estimates' && (
#     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
#         <div className="space-y-4">
#             {linkedEstimate ? ( ... ) : ( ... )}
#             {/* Attachments Section */}
#         </div>
#         <div className="space-y-4">
#             <div>
#                 <label className="block text-sm font-medium text-gray-700 mb-1">CRM Logs & Notes</label>
#                 ...
#             </div>
#             <div>
#                 <label className="block text-sm font-medium text-gray-700 mb-1">Action Notes</label>
#                 ...
#             </div>
#         </div>
#     </div>
# )}

# The ctiveTab === 'communication' block:
# {activeTab === 'communication' && (
#     <div className="grid grid-cols-1 gap-6">
#         <div className="space-y-4">
#             <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm space-y-4">
#                 <h4 className="text-sm font-bold text-gray-800 border-b pb-2">Reply to Inquiry</h4>
#                 ...
#             </div>
#         </div>
#     </div>
# )}

# I can just find <div>\n                        <label className="block text-sm font-medium text-gray-700 mb-1">CRM Logs & Notes</label>
# and move it to the communication tab.

# Let's do string surgery.
estimates_start = content.find("{activeTab === 'estimates' && (")
estimates_end = content.find("{activeTab === 'communication' && (")

communication_start = estimates_end
# The end of communication is the end of the tabs container, which is followed by the Save/Close buttons
communication_end = content.find("</div>\n\n            <div className=\"flex justify-between items-center p-4 border-t bg-gray-50 rounded-b-xl\">")

def extract_block(text, start_pattern):
    idx = text.find(start_pattern)
    if idx == -1: return None
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
    return None

logs_marker = '<div>\\n                        <label className="block text-sm font-medium text-gray-700 mb-1">CRM Logs & Notes</label>'
# But wait, it might be indented.
logs_marker_loose = '<label className="block text-sm font-medium text-gray-700 mb-1">CRM Logs & Notes</label>'
logs_idx = content.find(logs_marker_loose)

# Find the parent div of the logs marker
# Let's just find the <div className="space-y-4"> in the estimates block that contains it.
est_block = content[estimates_start:estimates_end]
comm_block = content[communication_start:communication_end]

# It's actually easier to just manually construct the JSX.
# Instead of complex parsing, I will just capture the blocks.
logs_part = extract_block(est_block[est_block.find('<label className="block text-sm font-medium text-gray-700 mb-1">CRM Logs & Notes</label>')-50:], '<div')
# Let's get the whole right column of estimates which is exactly:
# <div className="space-y-4">
#    <div> ... CRM Logs ... </div>
#    <div> ... Action Notes ... </div>
# </div>

# The estimates block has two <div className="space-y-4">
parts = est_block.split('<div className="space-y-4">')
# parts[0] = {activeTab === 'estimates' && ( <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
# parts[1] = left column
# parts[2] = right column

left_col = parts[1].rsplit('</div>', 1)[0]  
right_col = parts[2].rsplit('</div>', 1)[0] # Wait, this is getting messy. Let's just use regex or manual replace.

# Actually, right_col starts with <div>\n                        <label className="block text-sm font-medium text-gray-700 mb-1">CRM Logs & Notes</label>
# Let's just grab everything from that <div> up to the end of the </div> for Action Notes.
# Since we know the exact structure:
marker1 = '<div>\\n                              <label className="block text-sm font-medium text-gray-700 mb-1">CRM Logs & Notes</label>'
# Let's just use regex to find the blocks.

