with open('components/InquiryFormModal.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Extract the logs block (lines 905 to 1024)
logs_block = lines[904:1024]

# 2. Modify tabs button text
for i in range(len(lines)):
    if "Estimates, Notes & Logs" in lines[i]:
        lines[i] = lines[i].replace("Estimates, Notes & Logs", "Estimates")
    if "Communication & Reply" in lines[i]:
        lines[i] = lines[i].replace("Communication & Reply", "Communication, Notes & Logs")

# 3. Modify Grid for Estimates tab (line 765)
# Need to find the exact line because indices might shift if I start deleting/inserting.
# Wait, let's just do it in one pass by creating a new list of lines.

new_lines = []
for i, line in enumerate(lines):
    line_num = i + 1
    
    if line_num == 597:
        # Change Communication grid to 2 cols
        new_lines.append('                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">\n')
    elif line_num == 760:
        # Before closing the grid for communication, insert the logs block
        new_lines.extend(logs_block)
        new_lines.append(line)
    elif line_num == 765:
        # Change Estimates grid to 1 col (Wait, maybe Estimates + Attachments should stay 2 cols? Let's keep it 1 col or 2 cols? 
        # Actually, let's just remove lg:grid-cols-2 since it's just one column now)
        new_lines.append('                    <div className="grid grid-cols-1 gap-6">\n')
    elif 905 <= line_num <= 1024:
        # Skip the logs block from its original position
        continue
    else:
        new_lines.append(line)

with open('components/InquiryFormModal.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
