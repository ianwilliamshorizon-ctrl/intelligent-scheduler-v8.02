with open('AuthenticatedApp.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove customerViewData state (from line 95 to 111 approximately, wait I already deleted it?)
# I'll just find the lines to remove using python

start_idx1 = -1
end_idx1 = -1

for i, line in enumerate(lines):
    if '// Check if we are in customer view mode for a specific estimate' in line:
        start_idx1 = i
    if 'function handleCustomerDeclineEstimate(estimate: T.Estimate, reason?: string) {' in line:
        start_idx2 = i

    if start_idx1 != -1 and line.strip() == '}':
        # we found the end of the if (isCustomerView) { block
        pass
        
    if 'handleCustomerApproveEstimate, handleCustomerDeclineEstimate,' in line:
        lines[i] = line.replace('handleCustomerApproveEstimate, handleCustomerDeclineEstimate,', '')


# Since I know the exact lines from the view_file:
# 267:     // Check if we are in customer view mode for a specific estimate
# 380:     }
# 390:     function handleCustomerDeclineEstimate(estimate: T.Estimate, reason?: string) {
# 429:     }

new_lines = []
skip = False
for i, line in enumerate(lines):
    line_num = i + 1
    if 267 <= line_num <= 380:
        continue
    if 390 <= line_num <= 429:
        continue
    
    # Also clean up modalActions
    if 'handleCustomerApproveEstimate, handleCustomerDeclineEstimate,' in line:
        line = line.replace('handleCustomerApproveEstimate, handleCustomerDeclineEstimate,', '')
        
    new_lines.append(line)

with open('AuthenticatedApp.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

