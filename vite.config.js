import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    server: {
        host: true,
        port: 3000,
        open: true
    },
    build: {
        outDir: 'dist',
        assetsInlineLimit: 0
    }
});
