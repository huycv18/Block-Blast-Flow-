// ============================================================
// LoadingScene — Splash screen shown once after textures are ready
// ============================================================

window.LoadingScene = class LoadingScene extends Phaser.Scene {
    constructor() { super('LoadingScene'); }

    create() {
        const W = CONFIG.GAME_WIDTH, H = CONFIG.GAME_HEIGHT, cx = W / 2, cy = H / 2;

        // Background
        const bg = this.add.graphics();
        bg.fillStyle(0x09091A, 1);
        bg.fillRect(0, 0, W, H);
        bg.fillStyle(0x160E3A, 0.6);
        bg.fillCircle(cx, cy - 40, 320);

        // Floating decorative blocks
        this._spawnFloatingBlocks(W, H);

        // Soft light sweep behind the logo
        const sweep = this.add.graphics().setAlpha(0);
        sweep.fillStyle(0xFFFFFF, 0.06);
        sweep.fillEllipse(cx, cy - 95, 260, 90);
        this.tweens.add({ targets: sweep, alpha: 1, duration: 900, delay: 100, ease: 'Quad.easeOut' });
        this.tweens.add({
            targets: sweep, scaleX: 1.08, scaleY: 1.12,
            duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // Logo — fade + slide up
        const logo = this.add.text(cx, cy - 95, 'BLOCK BLAST\nFLOW!', {
            fontFamily: 'Outfit', fontSize: '50px', fontStyle: 'bold',
            color: '#FFFFFF',
            stroke: '#4B3CCF', strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 0, color: '#7B6CF6', blur: 32, fill: true },
            align: 'center', resolution: 2,
        }).setOrigin(0.5).setAlpha(0).setY(cy - 75).setScale(0.85);

        this.tweens.add({
            targets: logo, alpha: 1, y: cy - 95, scale: 1,
            duration: 700, ease: 'Back.easeOut',
        });

        // Hero toy car — same procedural style as the Home screen car
        const car = this.add.graphics().setAlpha(0).setScale(0.7);
        const carCy = cy + 6;
        this._drawHeroCar(car, cx, carCy, 1.3);
        this.tweens.add({
            targets: car, alpha: 1, scale: 1,
            duration: 600, delay: 250, ease: 'Back.easeOut',
        });
        this.tweens.add({
            targets: car, y: '+=6',
            duration: 1400, delay: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // Sparkles popping around the car once it lands
        this.time.delayedCall(800, () => this._spawnSparkles(cx, carCy));

        // Sub-label
        const sub = this.add.text(cx, cy + 70, 'A satisfying puzzle experience', {
            fontFamily: 'Outfit', fontSize: '14px', color: '#6666AA', resolution: 2,
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 500, ease: 'Quad.easeOut' });

        // Version tag
        this.add.text(W - 14, H - 12, 'v1.0', {
            fontFamily: 'Outfit', fontSize: '11px', color: '#33335A', resolution: 2,
        }).setOrigin(1, 1).setAlpha(0.7);

        // Progress bar
        const barW = 220, barH = 7, barX = cx - barW / 2, barY = cy + 160;
        const barBg = this.add.graphics();
        barBg.fillStyle(0x1E1E33, 1);
        barBg.fillRoundedRect(barX, barY, barW, barH, 4);
        barBg.setAlpha(0);
        this.tweens.add({ targets: barBg, alpha: 1, delay: 300, duration: 300 });

        const barFill = this.add.graphics();
        barFill.setAlpha(0);
        this.tweens.add({ targets: barFill, alpha: 1, delay: 300, duration: 300 });

        const loadTxt = this.add.text(cx, barY + 22, 'Loading…', {
            fontFamily: 'Outfit', fontSize: '12px', color: '#444466', resolution: 2,
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: loadTxt, alpha: 1, delay: 400, duration: 300 });

        // Drive progress value over ~1.8 s, then fade out
        const TOTAL_MS = 1800;
        const start = this.time.now;
        this._tick = () => {
            const t = Math.min(1, (this.time.now - start) / TOTAL_MS);
            const eased = 1 - Math.pow(1 - t, 2.2);
            barFill.clear();
            barFill.fillStyle(0x7B6CF6, 1);
            const fw = barW * eased;
            if (fw > 0) barFill.fillRoundedRect(barX, barY, fw, barH, 4);
        };

        this.time.delayedCall(TOTAL_MS + 500, () => {
            this.cameras.main.fadeOut(450, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('HomeScene'));
        });
    }

    /** Lightweight standalone copy of HomeScene._drawToyCar — Loading runs before HomeScene exists. */
    _drawHeroCar(g, cx, cy, scale = 1) {
        const colorData = COLORS.blue || Object.values(COLORS)[0];
        const w = 86 * scale, h = 50 * scale;

        g.fillStyle(0x000000, 0.25);
        g.fillEllipse(cx, cy + h / 2 + 6 * scale, w * 0.9, 10 * scale);

        g.fillStyle(colorData.hex, 1);
        g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10 * scale);

        g.fillStyle(colorData.dark, 1);
        g.fillRoundedRect(cx - w / 2 + 5 * scale, cy - h / 2, w - 10 * scale, h * 0.35,
            { tl: 8 * scale, tr: 8 * scale, bl: 0, br: 0 });

        g.fillStyle(colorData.light, 0.3);
        g.fillRect(cx - w / 2 + 8 * scale, cy - h * 0.06, w - 16 * scale, h * 0.42);

        const wheelR = 6 * scale;
        const wx = w / 2 - 10 * scale, wy = h / 2 - 2 * scale;
        for (const [dx, dy] of [[-wx, wy], [wx, wy]]) {
            g.fillStyle(0x1A1A1A, 1);
            g.fillCircle(cx + dx, cy + dy, wheelR);
            g.fillStyle(0x666666, 1);
            g.fillCircle(cx + dx, cy + dy, wheelR * 0.4);
        }

        g.fillStyle(0xFFFFFF, 0.18);
        g.fillRoundedRect(cx - w / 2 + 6 * scale, cy - h / 2 + 3 * scale, w * 0.3, 4 * scale, 2 * scale);
    }

    _spawnSparkles(cx, cy) {
        for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2;
            const dist = 70;
            const sx = cx + Math.cos(ang) * dist * 0.6;
            const sy = cy + Math.sin(ang) * dist * 0.35 - 10;
            const s = this.add.text(sx, sy, '✨', { fontSize: '16px' }).setOrigin(0.5).setAlpha(0).setScale(0.4);
            this.tweens.add({
                targets: s, alpha: 1, scale: 1,
                x: sx + Math.cos(ang) * 18, y: sy + Math.sin(ang) * 18,
                duration: 450, delay: i * 70, ease: 'Quad.easeOut',
                onComplete: () => this.tweens.add({
                    targets: s, alpha: 0, duration: 350,
                    onComplete: () => s.destroy(),
                }),
            });
        }
    }

    _spawnFloatingBlocks(W, H) {
        const colors = Object.values(COLORS).map(c => c.hex);
        for (let i = 0; i < 18; i++) {
            const color = colors[i % colors.length];
            const size  = Phaser.Math.Between(18, 40);
            const x     = Phaser.Math.Between(10, W - 10);
            const y     = Phaser.Math.Between(0, H);
            const alpha = Phaser.Math.FloatBetween(0.06, 0.18);
            const rot   = Phaser.Math.FloatBetween(-0.6, 0.6);

            const g = this.add.graphics();
            g.fillStyle(color, 1);
            g.fillRoundedRect(-size / 2, -size / 2, size, size, 5);
            g.setPosition(x, y).setRotation(rot).setAlpha(0);

            this.tweens.add({ targets: g, alpha, duration: 800, delay: i * 60, ease: 'Quad.easeOut' });
            this.tweens.add({
                targets: g,
                y: y + Phaser.Math.Between(-70, 70),
                rotation: rot + Phaser.Math.FloatBetween(-0.4, 0.4),
                duration: Phaser.Math.Between(3500, 7000),
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                delay: Phaser.Math.Between(0, 2500),
            });
        }
    }

    update() {
        if (this._tick) this._tick();
    }
};
