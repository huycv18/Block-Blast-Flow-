import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

function copyStaticGameAssets() {
    const root = resolve('.');
    const outDir = resolve(root, 'dist');

    return {
        name: 'copy-static-game-assets',
        async closeBundle() {
            await cp(resolve(root, 'js'),   resolve(outDir, 'js'),   { recursive: true });
            await cp(resolve(root, 'css'),  resolve(outDir, 'css'),  { recursive: true });
            await cp(resolve(root, 'libs'), resolve(outDir, 'libs'), { recursive: true });
        },
    };
}

export default {
    base: './',
    plugins: [copyStaticGameAssets()],
    server: {
        host: true,
        port: 3000,
        open: true
    },
    build: {
        outDir: 'dist',
        assetsInlineLimit: 0
    }
};
