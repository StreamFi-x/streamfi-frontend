/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('c:/Users/HP/Documents/streamfi-frontend-1/app/api');
let count = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/instanceof Response/g, 'instanceof NextResponse');
  
  if (content !== newContent) {
    // ensure NextResponse is imported
    if (!newContent.includes('NextResponse')) {
      newContent = `import { NextResponse } from "next/server";\n` + newContent;
    }
    fs.writeFileSync(file, newContent);
    count++;
  }
});
console.log(`Updated ${count} files.`);
