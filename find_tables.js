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

const suspiciousFiles = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('<table')) {
    if (!content.includes('overflow-x-auto') && !content.includes('overflow-auto')) {
      suspiciousFiles.push(file);
    }
  }
});

console.log('Files with tables but no overflow-x-auto:');
suspiciousFiles.forEach(f => console.log(f));
