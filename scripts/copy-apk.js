// scripts/copy-apk.js — copies built APK to ./output/ with a clean name
const fs   = require('fs');
const path = require('path');

const mode = process.argv[2] || 'debug';
const dir  = path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', mode);
const out  = path.join(__dirname, '..', 'output');
fs.mkdirSync(out, { recursive: true });

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.apk'));
if (!files.length) { console.error('No APK found in', dir); process.exit(1); }

const src  = path.join(dir, files[0]);
const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dest = path.join(out, `farmers-connect-${mode}-${ts}.apk`);
fs.copyFileSync(src, dest);

const size = (fs.statSync(dest).size / 1024 / 1024).toFixed(1);
console.log(`\n✅  APK ready: ${dest}`);
console.log(`   Size: ${size} MB`);
console.log('\n📱  Install:\n   adb install "' + dest + '"\n   or copy to your phone and open it.\n');
