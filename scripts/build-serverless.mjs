import { mkdir, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('dist', { recursive: true, force: true });
await mkdir('tgcloud/lib', { recursive: true });
await mkdir('dist/auth/start', { recursive: true });
await mkdir('dist/miniapp', { recursive: true });

await build({
  entryPoints: ['src/serverless/app.ts'],
  outfile: 'tgcloud/lib/app.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: ['sdk', 'sdk/*'],
  minify: true,
  legalComments: 'none',
});

await build({
  entryPoints: ['src/serverless/schema.ts'],
  outfile: 'tgcloud/schema.js',
  bundle: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
});

const pageBuild = await build({
  entryPoints: ['src/miniapp/pages.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  write: false,
});
const pageModule = await import(
  `data:text/javascript;base64,${Buffer.from(pageBuild.outputFiles[0].contents).toString('base64')}`,
);
const miniappHtml = pageModule.pages.miniapp;
const authHtml = pageModule.pages.oauth;

await writeFile('dist/index.html', miniappHtml);
await writeFile('dist/miniapp/index.html', miniappHtml);
await writeFile('dist/auth/start/index.html', authHtml);
