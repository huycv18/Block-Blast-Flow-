// ============================================================
// HomeScene — Main menu / home screen (Royal Match style)
// ============================================================

window.HomeScene = class HomeScene extends Phaser.Scene {
    constructor() { super('HomeScene'); }

    create() {
        const W = CONFIG.GAME_WIDTH, H = CONFIG.GAME_HEIGHT, cx = W / 2;

        this.cameras.main.fadeIn(400, 0, 0, 0);

        // ── Background ───────────────────────────────────────────
        const bg = this.add.graphics();
        // Top deep navy
        bg.fillStyle(0x0A0A1E, 1);
        bg.fillRect(0, 0, W, H);
        // Subtle mid glow
        bg.fillStyle(0x180F40, 0.55);
        bg.fillCircle(cx, H * 0.35, 300);
        // Lower panel (lighter card area)
        bg.fillStyle(0x131320, 1);
        bg.fillRoundedRect(0, H * 0.52, W, H * 0.48, { tl: 32, tr: 32, bl: 0, br: 0 });

        // Floating deco blocks (lowest layer)
        this._spawnDecoBlocks(W, H);

        // ── Header ───────────────────────────────────────────────
        const settingsBtn = this.add.image(36, 44, 'settings_icon')
            .setInteractive({ useHandCursor: true }).setDepth(10).setAlpha(0);
        settingsBtn.on('pointerdown', () => window.SoundMgr?.buttonClick());
        this.tweens.add({ targets: settingsBtn, alpha: 1, duration: 400, delay: 200 });

        const coins = parseInt(localStorage.getItem('bbf_coins') || '0');
        const coinPill = this.add.graphics().setDepth(10).setAlpha(0);
        coinPill.fillStyle(0x1A150A, 1);
        coinPill.fillRoundedRect(W - 104, 28, 84, 30, 15);
        coinPill.lineStyle(1, 0xAA8800, 0.5);
        coinPill.strokeRoundedRect(W - 104, 28, 84, 30, 15);
        this.add.image(W - 88, 43, 'coin_icon').setDepth(11).setAlpha(0);
        this.add.text(W - 72, 43, `${coins}`, {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: '#F1C40F', resolution: 2,
        }).setOrigin(0, 0.5).setDepth(11).setAlpha(0);
        this.tweens.add({ targets: [coinPill, ...this.children.list.slice(-2)], alpha: 1, duration: 400, delay: 200 });

        // ── Logo ─────────────────────────────────────────────────
        const logoY = H * 0.26;
        const logo = this.add.text(cx, logoY + 16, 'BLOCK BLAST\nFLOW!', {
            fontFamily: 'Outfit', fontSize: '50px', fontStyle: 'bold',
            color: '#FFFFFF',
            stroke: '#3D2FA8', strokeThickness: 10,
            shadow: { offsetX: 0, offsetY: 2, color: '#7B6CF6', blur: 28, fill: true },
            align: 'center', resolution: 2,
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({ targets: logo, alpha: 1, y: logoY, duration: 700, delay: 100, ease: 'Back.easeOut' });
        // Gentle bob after entrance
        this.time.delayedCall(800, () => {
            this.tweens.add({
                targets: logo, y: logoY - 8,
                duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        });

        // ── Level card ───────────────────────────────────────────
        const savedLevel = Math.min(
            parseInt(localStorage.getItem('bbf_currentLevel') || '0'),
            LEVELS.length - 1
        );
        const levelData = LEVELS[savedLevel] || LEVELS[0];

        const DIFF_COL = { Tutorial: 0x27AE60, Easy: 0x2980B9, Normal: 0xF39C12, Hard: 0xC0392B };
        const DIFF_HEX = { Tutorial: '#2ECC71', Easy: '#3498DB', Normal: '#F1C40F', Hard: '#E74C3C' };
        const dColor = DIFF_COL[levelData.difficulty] || 0x555577;
        const dHex   = DIFF_HEX[levelData.difficulty] || '#AAAACC';

        const cardY = H * 0.572;
        const cardW = 300, cardH = 92;
        const cL = cx - cardW / 2;

        const card = this.add.graphics().setAlpha(0);
        card.fillStyle(0x1C1C30, 1);
        card.fillRoundedRect(cL, cardY - cardH / 2, cardW, cardH, 14);
        card.lineStyle(2, dColor, 0.7);
        card.strokeRoundedRect(cL, cardY - cardH / 2, cardW, cardH, 14);
        card.fillStyle(dColor, 1);
        card.fillRoundedRect(cL, cardY - cardH / 2, 6, cardH, { tl: 14, tr: 0, bl: 14, br: 0 });

        const lvlTxt = this.add.text(cx + 3, cardY - 20, `Level ${levelData.id}`, {
            fontFamily: 'Outfit', fontSize: '22px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5).setAlpha(0);

        const diffTxt = this.add.text(cx + 3, cardY + 6, levelData.difficulty, {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: dHex, resolution: 2,
        }).setOrigin(0.5).setAlpha(0);

        const starTxt = this.add.text(cx + 3, cardY + 30, '☆  ☆  ☆', {
            fontFamily: 'Outfit', fontSize: '17px', color: '#2A2A48', resolution: 2,
        }).setOrigin(0.5).setAlpha(0);

        [card, lvlTxt, diffTxt, starTxt].forEach((o, i) =>
            this.tweens.add({ targets: o, alpha: 1, duration: 380, delay: 280 + i * 70, ease: 'Quad.easeOut' })
        );

        // ── PLAY button ──────────────────────────────────────────
        const playY = H * 0.73;
        const playW = 280, playH = 70;
        const pL = cx - playW / 2;

        const playBg = this.add.graphics().setAlpha(0);
        playBg.fillStyle(0x5A4DE0, 1);
        playBg.fillRoundedRect(pL, playY - playH / 2, playW, playH, 20);
        playBg.fillStyle(0x7B6CF6, 1);
        playBg.fillRoundedRect(pL, playY - playH / 2, playW, playH / 2, { tl: 20, tr: 20, bl: 0, br: 0 });
        // Shine
        playBg.fillStyle(0xFFFFFF, 0.14);
        playBg.fillRoundedRect(pL + 10, playY - playH / 2 + 6, playW - 20, 14, 7);

        const playTxt = this.add.text(cx, playY, '▶   PLAY', {
            fontFamily: 'Outfit', fontSize: '28px', fontStyle: 'bold', color: '#FFFFFF',
            shadow: { offsetX: 0, offsetY: 3, color: '#2A1A90', blur: 6, fill: true },
            resolution: 2,
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({ targets: [playBg, playTxt], alpha: 1, duration: 500, delay: 500, ease: 'Quad.easeOut' });

        // Pulse tween (starts after entrance)
        this.time.delayedCall(1100, () => {
            this.tweens.add({
                targets: [playBg, playTxt],
                scaleX: 1.025, scaleY: 1.025,
                duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        });

        const playZone = this.add.zone(cx, playY, playW, playH).setInteractive({ useHandCursor: true });
        playZone.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            this.tweens.killTweensOf([playBg, playTxt]);
            this.tweens.add({
                targets: [playBg, playTxt], scaleX: 0.93, scaleY: 0.93,
                duration: 80, ease: 'Quad.easeOut',
                onComplete: () => {
                    this.cameras.main.fadeOut(350, 0, 0, 0);
                    this.cameras.main.once('camerafadeoutcomplete', () => {
                        this.scene.start('GameScene', { levelIndex: savedLevel });
                    });
                },
            });
        });

        // ── Level count footer ───────────────────────────────────
        this.add.text(cx, H * 0.85, `${LEVELS.length} levels to conquer`, {
            fontFamily: 'Outfit', fontSize: '12px', color: '#333355', resolution: 2,
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: this.children.list[this.children.list.length - 1], alpha: 0.7, duration: 500, delay: 700 });
    }

    _spawnDecoBlocks(W, H) {
        const colors = Object.values(COLORS).map(c => c.hex);
        for (let i = 0; i < 20; i++) {
            const color = colors[i % colors.length];
            const size  = Phaser.Math.Between(20, 46);
            const x     = Phaser.Math.Between(10, W - 10);
            const y     = Phaser.Math.Between(0, H * 0.52);
            const alpha = Phaser.Math.FloatBetween(0.05, 0.16);
            const rot   = Phaser.Math.FloatBetween(-0.7, 0.7);

            const g = this.add.graphics();
            g.fillStyle(color, 1);
            g.fillRoundedRect(-size / 2, -size / 2, size, size, 6);
            g.setPosition(x, y).setRotation(rot).setAlpha(0);

            this.tweens.add({ targets: g, alpha, duration: 900, delay: i * 50, ease: 'Quad.easeOut' });
            this.tweens.add({
                targets: g,
                y: y + Phaser.Math.Between(-60, 60),
                rotation: rot + Phaser.Math.FloatBetween(-0.35, 0.35),
                duration: Phaser.Math.Between(4000, 8000),
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                delay: Phaser.Math.Between(0, 3000),
            });
        }
    }
};
