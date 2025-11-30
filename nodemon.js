import nodemon from 'nodemon';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const nodemonConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'nodemon.json'), 'utf8'));
const { watch, ignore, ext } = nodemonConfig;
const minifyConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'minify.config.json'), 'utf8'));

nodemon({
  ...nodemonConfig,
  script: 'index.js'
});

function minifyFile(file) {
  const extname = path.extname(file);
  const base = file.substring(0, file.length - extname.length);

  if (extname === '.css' && !file.endsWith('.min.css')) {
    const out = `${base}.min.css`;
    console.log(`cleancss args: -o ${out} ${file}`);
    execSync(`npx cleancss -o "${out}" "${file}"`);
    console.log('minified:', out);
  }

  if (
    extname === '.js' &&
    !file.endsWith('.min.js') &&
    file.includes(`${path.sep}public${path.sep}js${path.sep}`)
  ) {
    const { compress, mangle } = minifyConfig.js;

    let terserArgs = '';
    if (compress) terserArgs += ' -c';
    if (mangle) terserArgs += ' -m';

    const out = `${base}.min.js`;
    console.log('terser args:', terserArgs);
    execSync(`npx terser "${file}" ${terserArgs} -o "${out}"`);
    console.log('minified:', out);
  }
}

nodemon.on('restart', files => {
  console.log('Changed files:', files);
  console.log('Watch:', watch);
  console.log('Ignore:', ignore);
  console.log('Extensions:', ext);

  for (const file of files) {
    try {
      minifyFile(file);
    } catch (err) {
      console.error('minify error for', file, ':', err);
    }
  }
});
