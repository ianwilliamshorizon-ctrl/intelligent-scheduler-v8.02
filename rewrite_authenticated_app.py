import re

with open('AuthenticatedApp.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Rename App to AuthenticatedApp
content = content.replace('const App = () => {', 'const AuthenticatedApp = () => {')
content = content.replace('export default App;', 'export default AuthenticatedApp;')

# 2. Remove LoginView and CustomerView imports
content = re.sub(r'import LoginView from \'./components/LoginView\';\n', '', content)
content = re.sub(r'import EstimateViewModal from \'./components/EstimateViewModal\';\n', '', content)

# 3. Remove customerViewData useState block
content = re.sub(r'const \[customerViewData, setCustomerViewData\] = useState[\s\S]*?\}\);\n\n', '', content)

# 4. Remove useEffect for loadCustomerData
content = re.sub(r'useEffect\(\(\) => \{\n        const searchParams = new URLSearchParams[\s\S]*?\}\, \[businessEntities\]\);\n\n', '', content)

# 5. Remove handleCustomerApproveEstimate and handleCustomerDeclineEstimate
content = re.sub(r'function handleCustomerApproveEstimate\([\s\S]*?setConfirmation\(\{ isOpen: true, title: \'Request Received\', message: successMessage, type: \'success\' \}\);\n    \}\n', '', content)
content = re.sub(r'function handleCustomerDeclineEstimate\([\s\S]*?workshopActions\.updateLinkedInquiryStatus\(estimate\.id, \'Rejected\'\);\n    \}\n', '', content)

# 6. Remove the render returns for customer view
content = re.sub(r'if \(customerViewData\.loading\) \{\n        return \([\s\S]*?\);\n    \}\n\n', '', content)
content = re.sub(r'if \(customerViewData\.error\) \{\n        return \([\s\S]*?\);\n    \}\n\n', '', content)
content = re.sub(r'if \(customerViewData\.estimate\) \{\n        const dummyCustomerUser[\s\S]*?\);\n    \}\n\n', '', content)

# 7. Remove the isAuthenticated render return
content = re.sub(r'if \(\!isAuthenticated\) \{\n        return \([\s\S]*?\);\n    \}\n\n', '', content)

with open('AuthenticatedApp.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
