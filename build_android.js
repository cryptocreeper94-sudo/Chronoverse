const fs = require('fs-extra');
const path = require('path');

async function buildAndroidWebDir() {
  const distDir = path.join(__dirname, 'dist_android');
  
  console.log('Cleaning dist_android directory...');
  await fs.remove(distDir);
  await fs.ensureDir(distDir);

  console.log('Copying assets to dist_android...');
  const filesToCopy = [
    'index.html',
    'family',
    'src',
    'assets'
  ];

  for (const item of filesToCopy) {
    const srcPath = path.join(__dirname, item);
    const destPath = path.join(distDir, item);
    if (await fs.pathExists(srcPath)) {
      await fs.copy(srcPath, destPath);
      console.log(`Copied ${item}`);
    }
  }
  console.log('Web directory ready for Capacitor!');
}

buildAndroidWebDir().catch(console.error);
