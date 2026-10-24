const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
esbuild.buildSync({entryPoints:[path.join(root,'portal-src.js')],bundle:true,minify:true,outfile:path.join(root,'js/portal-bundle.js')});
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output);
for (const entry of fs.readdirSync(root,{withFileTypes:true})) {
  const directory = ['css','js','images','webfonts'].includes(entry.name);
  const file = entry.isFile() && (entry.name.endsWith('.html') || /^(favicon.*\.(png|ico)|apple-touch-icon.png|android-chrome-.*\.png|robots.txt|sitemap.xml|site.webmanifest)$/.test(entry.name));
  if (directory || file) fs.cpSync(path.join(root,entry.name),path.join(output,entry.name),{recursive:true});
}
console.log('Built public website assets. Server code and private settings excluded.');
