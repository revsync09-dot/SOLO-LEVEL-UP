const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/services/cardGenerator.js');
let content = fs.readFileSync(filePath, 'utf8');
let braceCount = 0;
let lineNum = 0;
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  lineNum = i + 1;
  const line = lines[i];
  for (const char of line) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
  }
  if (i > 1900) { 
    console.log(`Line ${lineNum}: ${line.slice(0, 80)} | Braces: ${braceCount}`);
  }
}

console.log(`\nFinal brace count: ${braceCount}`);
console.log(`Total lines: ${lines.length}`);