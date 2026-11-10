// Build: esbuild bundles React + the custom WebGL engine into hashed, code-split ESM assets.
// Relative asset URLs + hash routing => works at any base path (kalladhanush.in/deva/), including refresh and deep links.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const serve = process.argv.includes('--serve');
const OUT = 'dist';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.cpSync('public', OUT, { recursive: true });

const options = {
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outdir: path.join(OUT, 'assets'),
  entryNames: serve ? 'app' : 'app-[hash]',
  chunkNames: 'chunk-[hash]',
  format: 'esm',
  splitting: true,
  minify: !serve,
  sourcemap: serve,
  target: ['es2020', 'chrome90', 'safari15', 'firefox90'],
  jsx: 'automatic',
  legalComments: 'none',
  metafile: true,
  define: {
    'process.env.NODE_ENV': serve ? '"development"' : '"production"',
    __GOOGLE_CLIENT_ID__: JSON.stringify(process.env.GOOGLE_CLIENT_ID || ''),
    __ALLOWED_EMAIL__: JSON.stringify(process.env.ALLOWED_EMAIL || ''),
    __SHEET_ID__: JSON.stringify(process.env.SHEET_ID ?? '1edpIh8QLm02xc4EhahJ0YgsuI_R7NjqQBkNyU-BSK7U'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
};

function writeHtml(meta) {
  let js = 'app.js', css = 'app.css';
  if (meta) {
    for (const [file, info] of Object.entries(meta.outputs)) {
      if (info.entryPoint === 'src/main.tsx') {
        js = path.basename(file);
        if (info.cssBundle) css = path.basename(info.cssBundle);
      }
    }
  }
  const tpl = fs.readFileSync('index.html', 'utf8')
    .replace('<!--CSS-->', `<link rel="stylesheet" href="./assets/${css}">`)
    .replace('<!--JS-->', `<script type="module" src="./assets/${js}"></script>`);
  fs.writeFileSync(path.join(OUT, 'index.html'), tpl);
  fs.copyFileSync(path.join(OUT, 'index.html'), path.join(OUT, '404.html'));
}

if (serve) {
  writeHtml(null);
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: OUT, port: 5173 });
  console.log(`dev server: http://localhost:${port}`);
} else {
  const res = await esbuild.build(options);
  writeHtml(res.metafile);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  let total = 0;
  for (const [f, i] of Object.entries(res.metafile.outputs)) { total += i.bytes; console.log(`${f.padEnd(44)} ${(i.bytes / 1024).toFixed(1)} kB`); }
  console.log(`total ${(total / 1024).toFixed(1)} kB`);
}
