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

        // Logo — fade + slide up
        const logo = this.add.text(cx, cy - 90, 'BLOCK BLAST\nFLOW!', {
            fontFamily: 'Outfit', fontSize: '50px', fontStyle: 'bold',
            color: '#FFFFFF',
            stroke: '#4B3CCF', strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 0, color: '#7B6CF6', blur: 32, fill: true },
            align: 'center', resolution: 2,
        }).setOrigin(0.5).setAlpha(0).setY(cy - 70);

        this.tweens.add({ targets: logo, alpha: 1, y: cy - 90, duration: 700, ease: 'Quad.easeOut' });

        // Sub-label
        const sub = this.add.text(cx, cy + 28, 'A satisfying puzzle experience', {
            fontFamily: 'Outfit', fontSize: '14px', color: '#6666AA', resolution: 2,
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 400, ease: 'Quad.easeOut' });

        // Progress bar
        const barW = 220, barH = 7, barX = cx - barW / 2, barY = cy + 130;
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
