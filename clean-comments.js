const fs = require('fs');
const path = require('path');

function removeComments(content) {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  let inRegex = false;

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];

   
    if ((char === '"' || char === "'" || char === '`') && (i === 0 || content[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
        result += char;
      } else if (char === stringChar) {
        inString = false;
        result += char;
      } else {
        result += char;
      }
      i++;
      continue;
    }

    if (inString) {
      result += char;
      i++;
      continue;
    }

    
    if (char === '/' && nextChar === '/' && !inRegex) {
    
      while (i < content.length && content[i] !== '\n') {
        i++;
      }
      
      if (i < content.length && content[i] === '\n') {
        result += '\n';
        i++;
      }
      continue;
    }

 
    if (char === '/' && nextChar === '*' && !inRegex) {
      
      i += 2;
      while (i < content.length - 1) {
        if (content[i] === '*' && content[i + 1] === '/') {
          i += 2;
          break;
        }
        if (content[i] === '\n') {
          result += '\n';
        }
        i++;
      }
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

function cleanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const cleaned = removeComments(content);
    
  
    const finalContent = cleaned.replace(/\n\n\n+/g, '\n\n');
    
    fs.writeFileSync(filePath, finalContent, 'utf8');
    return true;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  let totalCleaned = 0;

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      totalCleaned += processDirectory(fullPath);
    } else if (file.endsWith('.js')) {
      if (cleanFile(fullPath)) {
        console.log(`✓ Cleaned: ${fullPath}`);
        totalCleaned++;
      }
    }
  }

  return totalCleaned;
}

const srcPath = path.join(__dirname, 'src');
const total = processDirectory(srcPath);
console.log(`\n✅ Total files cleaned: ${total}`);
