const path = require('node:path');

const esbuild = require('esbuild');

const projectRoot = path.resolve(__dirname, '..');

esbuild.build({
    entryPoints: [path.join(projectRoot, 'renderer.js')],
    outfile: path.join(projectRoot, '.generated', 'renderer.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome128'],
    sourcemap: true,
    legalComments: 'none',
    logLevel: 'info'
}).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
