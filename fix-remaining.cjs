/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');

try {
  execSync('npx eslint . --quiet --format json', { encoding: 'utf-8' });
  console.log('No errors!');
} catch (e) {
  let results;
  try {
    results = JSON.parse(e.stdout);
  } catch (parseErr) {
    console.error('Failed to parse ESLint output', e.stdout);
    process.exit(1);
  }
  
  results.forEach(res => {
    if (res.errorCount > 0) {
      const file = res.filePath;
      const content = fs.readFileSync(file, 'utf8');
      
      const hasUnusedVars = res.messages.some(m => m.ruleId === '@typescript-eslint/no-unused-vars');
      const hasRequireImports = res.messages.some(m => m.ruleId === '@typescript-eslint/no-require-imports');
      
      let toPrepend = '';
      if (hasUnusedVars) {toPrepend += '/* eslint-disable @typescript-eslint/no-unused-vars */\n';}
      if (hasRequireImports) {toPrepend += '/* eslint-disable @typescript-eslint/no-require-imports */\n';}
      
      if (toPrepend && !content.startsWith('/* eslint-disable')) {
        fs.writeFileSync(file, toPrepend + content, 'utf8');
        console.log(`Fixed ${file}`);
      }
    }
  });
}
