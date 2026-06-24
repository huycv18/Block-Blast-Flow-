import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

function copyStaticGameAssets() {
    const root = resolve('.');
    const outDir = resolve(root, 'dist');
    const phaserSource = resolve(root, 'node_modules/phaser/dist/phaser.min.js');
    const phaserTarget = resolve(outDir, 'node_modules/phaser/dist/phaser.min.js');

    return {
        name: 'copy-static-game-assets',
        async closeBundle() {
            await cp(resolve(root, 'js'), resolve(outDir, 'js'), { recursive: true });
            await mkdir(dirname(phaserTarget), { recursive: true });
            await cp(phaserSource, phaserTarget);
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
