const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        filelist = walkSync(filePath, filelist);
      }
    } else {
      if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        filelist.push(filePath);
      }
    }
  });
  return filelist;
};

const files = [...walkSync('./app'), ...walkSync('./components')];

let totalReplaced = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  // Main UI components that are clearly "Primary" actions
  newContent = newContent.replace(/bg-blue-600/g, 'bg-primary');
  newContent = newContent.replace(/hover:bg-blue-700/g, 'hover:bg-primary/90');
  newContent = newContent.replace(/shadow-blue-200/g, 'shadow-primary/20');
  
  // Replace text-blue-600 when it's clearly a primary text (e.g. text-blue-600 hover:...)
  // We'll leave specific info states alone, but since the user's primary WAS blue,
  // it's highly likely most text-blue-600 are primary colors.
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    totalReplaced++;
    console.log(`Updated: ${file}`);
  }
});

console.log(`Replaced in ${totalReplaced} files`);
