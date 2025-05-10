const { build } = require('esbuild');
const outfile = 'build/server.js';

build({
    entryPoints: ['cmd/server.js'],
    bundle: true,
    platform: 'node',
    target: ['node18'],
    outfile,
    resolveExtensions: ['.js'],
    logLevel: 'info',
    sourcemap: false,
    minify: true, // Optional: good first step before obfuscation
}).catch(() => process.exit(1));
