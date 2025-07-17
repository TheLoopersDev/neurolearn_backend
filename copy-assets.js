const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'mails');
const destDir = path.join(__dirname, 'dist', 'src', 'mails');

fs.mkdirSync(destDir, { recursive: true });

fs.readdirSync(srcDir).forEach((file) => {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
});

console.log('Copied mails to dist');
