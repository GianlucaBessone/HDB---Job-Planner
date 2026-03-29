const fs = require('fs');
const path = require('path');

const directories = ['app', 'components'];
const classMappings = {
    'bg-white': 'dark:bg-slate-800',
    'bg-slate-50': 'dark:bg-slate-900/50',
    'bg-slate-100': 'dark:bg-slate-800/50',
    'bg-slate-200': 'dark:bg-slate-700',
    'hover:bg-slate-50': 'dark:hover:bg-slate-800/80',
    'hover:bg-slate-100': 'dark:hover:bg-slate-700',
    'hover:bg-white': 'dark:hover:bg-slate-800',
    'text-slate-900': 'dark:text-slate-50',
    'text-slate-800': 'dark:text-slate-100',
    'text-slate-700': 'dark:text-slate-200',
    'text-slate-600': 'dark:text-slate-300',
    'text-slate-500': 'dark:text-slate-400',
    'text-slate-400': 'dark:text-slate-500',
    'hover:text-slate-900': 'dark:hover:text-slate-100',
    'hover:text-slate-800': 'dark:hover:text-slate-200',
    'hover:text-slate-700': 'dark:hover:text-slate-300',
    'border-slate-100': 'dark:border-slate-800',
    'border-slate-200': 'dark:border-slate-700',
    'border-slate-300': 'dark:border-slate-600',
    'hover:border-slate-200': 'dark:hover:border-slate-700',
    'hover:border-slate-300': 'dark:hover:border-slate-600',
    'ring-slate-100': 'dark:ring-slate-800',
    'shadow-slate-200/50': 'dark:shadow-none',
    'bg-white/80': 'dark:bg-slate-800/80',
    'bg-white/90': 'dark:bg-slate-800/90'
};

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.match(/\.(tsx|jsx|ts|js)$/)) {
            processFile(fullPath);
        }
    }
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    for (const [light, dark] of Object.entries(classMappings)) {
        // Find the specific light class avoiding partial matches (like border-slate-100 finding border-slate-1)
        // Also avoid replacing if the dark class is already right next to it
        // We do a simple string replace for occurrences. We can use a regex that matches light with word boundaries,
        // and doesn't match if dark is nearby.
        
        // We construct a regex to match the light class exact word
        // Need to escape forward slashes if they are in class names 
        const escapedLight = light.replace(/\//g, '\\/');
        const regex = new RegExp(`(?<=[\\'\\"\\\`\\s])${escapedLight}(?=[\\'\\"\\\`\\s])`, 'g');
        content = content.replace(regex, (match) => {
            return `${match} ${dark}`;
        });
    }

    // After applying all, some might have redundant "dark:" if the script was run before or if manual dark was present
    // Simple dedup regex for exact same sequence "dark:bg-slate-800 dark:bg-slate-800" -> "dark:bg-slate-800"
    for (const dark of Object.values(classMappings)) {
        const escapedDark = dark.replace(/\//g, '\\/');
        const dupRegex = new RegExp(`(${escapedDark}\\s*){2,}`, 'g');
        content = content.replace(dupRegex, `${dark} `);
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${filePath}`);
    }
}

for (const dir of directories) {
    if (fs.existsSync(dir)) {
        processDirectory(dir);
    }
}
