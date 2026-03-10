const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/services/cardGenerator.js');
let content = fs.readFileSync(filePath, 'utf8');


content = content.replace(/\\n/g, '\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed cardGenerator.js - converted literal \\n to actual newlines');