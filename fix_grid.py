with open('components/InquiryFormModal.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    line_num = i + 1
    # Right now, line 759 is                     </div>\n (closes bg-white)
    # Line 760 is                         <div className="space-y-4">\n (starts logs block)
    # Line 880 is                         </div>\n (which closes the first space-y-4)
    # So the logs block is INSIDE the first column!
    # I will move the </div> from line 880 to line 760 (pushing line 760 down).
    
    if line_num == 760:
        new_lines.append('                    </div>\n')
        new_lines.append(line)
    elif line_num == 880:
        pass # Skip the </div> since we moved it up
    else:
        new_lines.append(line)

with open('components/InquiryFormModal.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
