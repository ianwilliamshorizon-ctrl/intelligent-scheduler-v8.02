import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

const versionStr = pkg.version || '8.02.001';
const parts = versionStr.split('.');

if (parts.length >= 3) {
    const major = parts[0];
    const minor = parts[1];
    const patchNum = parseInt(parts[2], 10) + 1;
    const newPatch = String(patchNum).padStart(3, '0');
    pkg.version = `${major}.${minor}.${newPatch}`;
} else {
    pkg.version = '8.02.001';
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Also keep index.html title in sync
const indexPath = path.resolve(__dirname, '../index.html');
if (fs.existsSync(indexPath)) {
    let indexHtml = fs.readFileSync(indexPath, 'utf-8');
    indexHtml = indexHtml.replace(/<title>BROOKSPEED Dispatch v[^<]*<\/title>/, `<title>BROOKSPEED Dispatch v${pkg.version}</title>`);
    fs.writeFileSync(indexPath, indexHtml);
}

console.log(`[Version Bump] Updated package.json and index.html version to: v${pkg.version}`);

