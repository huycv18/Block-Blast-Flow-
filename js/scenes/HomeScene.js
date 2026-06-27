// ============================================================
// HomeScene — Main menu / home screen (Royal Match style)
// ============================================================

const _AVATARS  = ['🐱','🐶','🦊','🐼','🐸','🦁','🐯','🐺','🐨','🐰'];
const _AVBG     = [0xE74C3C,0xE67E22,0xF39C12,0x27AE60,0x16A085,0x2980B9,0x8E44AD,0xE91E63,0x546E7A,0x6D4C41];
const _FRAMES   = [
    { color: null,     label: '✕' },
    { color: 0xF1C40F, label: '' },
    { color: 0x9B59B6, label: '' },
    { color: 0x3498DB, label: '' },
    { color: 0xE74C3C, label: '' },
];

window.HomeScene = class HomeScene extends Phaser.Scene {
    constructor() { super('HomeScene'); }

    create() {
        const W = CONFIG.GAME_WIDTH, H = CONFIG.GAME_HEIGHT, cx = W / 2;

        this.cameras.main.fadeIn(400, 0, 0, 0);
        window.SoundMgr?.startMusic();

        this._readProfile();

        // ── Background ───────────────────────────────────────────
        const bg = this.add.graphics();
        bg.fillStyle(0x0A0A1E, 1); bg.fillRect(0, 0, W, H);
        bg.fillStyle(0x180F40, 0.55); bg.fillCircle(cx, H * 0.35, 300);
        bg.fillStyle(0x131320, 1);
        bg.fillRoundedRect(0, H * 0.52, W, H * 0.48, { tl: 32, tr: 32, bl: 0, br: 0 });

        this._spawnDecoBlocks(W, H);
        this._buildHeader(W, cx);

        // ── Logo ─────────────────────────────────────────────────
        const logoY = H * 0.26;
        const logo  = this.add.text(cx, logoY + 16, 'BLOCK BLAST\nFLOW!', {
            fontFamily: 'Outfit', fontSize: '50px', fontStyle: 'bold',
            color: '#FFFFFF', stroke: '#3D2FA8', strokeThickness: 10,
            shadow: { offsetX: 0, offsetY: 2, color: '#7B6CF6', blur: 28, fill: true },
            align: 'center', resolution: 2,
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: logo, alpha: 1, y: logoY, duration: 700, delay: 100, ease: 'Back.easeOut' });
        this.time.delayedCall(800, () => {
            this.tweens.add({ targets: logo, y: logoY - 8, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });

        // ── Level card ───────────────────────────────────────────
        const savedLevel = Math.min(
            parseInt(localStorage.getItem('bbf_currentLevel') || '0'), LEVELS.length - 1
        );
        this._savedLevel = savedLevel;
        const levelData  = LEVELS[savedLevel] || LEVELS[0];
        const DIFF_COL   = { Tutorial: 0x27AE60, Easy: 0x2980B9, Normal: 0xF39C12, Hard: 0xC0392B };
        const DIFF_HEX   = { Tutorial: '#2ECC71', Easy: '#3498DB', Normal: '#F1C40F', Hard: '#E74C3C' };
        const dColor = DIFF_COL[levelData.difficulty] || 0x555577;
        const dHex   = DIFF_HEX[levelData.difficulty] || '#AAAACC';

        const cardY = H * 0.572, cardW = 300, cardH = 92, cL = cx - cardW / 2;
        const card  = this.add.graphics().setAlpha(0);
        card.fillStyle(0x1C1C30, 1); card.fillRoundedRect(cL, cardY - cardH / 2, cardW, cardH, 14);
        card.lineStyle(2, dColor, 0.7); card.strokeRoundedRect(cL, cardY - cardH / 2, cardW, cardH, 14);
        card.fillStyle(dColor, 1); card.fillRoundedRect(cL, cardY - cardH / 2, 6, cardH, { tl: 14, tr: 0, bl: 14, br: 0 });

        const lvlTxt  = this.add.text(cx + 3, cardY - 20, `Level ${levelData.id}`, {
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
        const playY = H * 0.73, playW = 280, playH = 70;
        const playC = this.add.container(cx, playY).setAlpha(0);
        const playBg = this.add.graphics();
        playBg.fillStyle(0x5A4DE0, 1); playBg.fillRoundedRect(-playW/2, -playH/2, playW, playH, 20);
        playBg.fillStyle(0x7B6CF6, 1); playBg.fillRoundedRect(-playW/2, -playH/2, playW, playH/2, { tl:20, tr:20, bl:0, br:0 });
        playBg.fillStyle(0xFFFFFF, 0.14); playBg.fillRoundedRect(-playW/2+10, -playH/2+6, playW-20, 14, 7);
        const playTxt = this.add.text(0, 0, '▶   PLAY', {
            fontFamily: 'Outfit', fontSize: '28px', fontStyle: 'bold', color: '#FFFFFF',
            shadow: { offsetX: 0, offsetY: 3, color: '#2A1A90', blur: 6, fill: true }, resolution: 2,
        }).setOrigin(0.5);
        playC.add([playBg, playTxt]);
        this.tweens.add({ targets: playC, alpha: 1, duration: 500, delay: 500, ease: 'Quad.easeOut' });
        this.time.delayedCall(1100, () => {
            this.tweens.add({ targets: playC, scaleX: 1.025, scaleY: 1.025, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
        const playZone = this.add.zone(cx, playY, playW, playH).setInteractive({ useHandCursor: true });
        playZone.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            this.tweens.killTweensOf(playC);
            this.tweens.add({
                targets: playC, scaleX: 0.93, scaleY: 0.93, duration: 80, ease: 'Quad.easeOut',
                onComplete: () => {
                    this.cameras.main.fadeOut(350, 0, 0, 0);
                    this.cameras.main.once('camerafadeoutcomplete', () =>
                        this.scene.start('GameScene', { levelIndex: savedLevel })
                    );
                },
            });
        });

        // ── Footer ───────────────────────────────────────────────
        const footer = this.add.text(cx, H * 0.85, `${LEVELS.length} levels to conquer`, {
            fontFamily: 'Outfit', fontSize: '12px', color: '#333355', resolution: 2,
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: footer, alpha: 0.7, duration: 500, delay: 700 });

        // Profile modal (built last → renders on top)
        this._buildProfileModal(W, H, cx);
    }

    // ──────────────────────────────────────────────────────────
    _readProfile() {
        const safe = (key, def, isInt) => {
            try {
                const v = localStorage.getItem(key);
                if (v === null) return def;
                return isInt ? (isNaN(parseInt(v)) ? def : parseInt(v)) : v;
            } catch { return def; }
        };
        this._pName   = safe('bbf_name',   'Player', false);
        this._pAvatar = safe('bbf_avatar', 0,        true);
        this._pFrame  = safe('bbf_frame',  0,        true);
        this._hearts  = safe('bbf_hearts', 5,        true);
        this._coins   = safe('bbf_coins',  0,        true);
    }

    // ──────────────────────────────────────────────────────────
    _buildHeader(W, cx) {
        const pillY = 28, pillW = 82, pillH = 30, pillR = 15;

        // ── Profile avatar button (top-left) ─────────────────
        const r = 24, bx = 42, by = 44;
        const profGfx = this.add.graphics().setDepth(10).setAlpha(0);
        this._profGfx = profGfx;
        const profEmoji = this.add.text(bx, by, _AVATARS[this._pAvatar], {
            fontSize: '26px', resolution: 2,
        }).setOrigin(0.5).setDepth(11).setAlpha(0);
        this._profEmoji = profEmoji;
        this._drawHeaderAvatar();

        const profZone = this.add.zone(bx, by, 56, 56).setInteractive({ useHandCursor: true }).setDepth(12);
        profZone.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            this._openProfileModal();
        });
        this.tweens.add({ targets: [profGfx, profEmoji], alpha: 1, duration: 400, delay: 200 });

        // ── Heart pill ────────────────────────────────────────
        const hpX = W - pillW * 2 - 14;
        const hPill = this.add.graphics().setDepth(10).setAlpha(0);
        hPill.fillStyle(0x1A0808, 1); hPill.fillRoundedRect(hpX, pillY, pillW, pillH, pillR);
        hPill.lineStyle(1, 0xCC2222, 0.55); hPill.strokeRoundedRect(hpX, pillY, pillW, pillH, pillR);
        const hIcon = this.add.image(hpX + 16, pillY + 15, 'heart_icon').setDepth(11).setAlpha(0);
        this._heartsText = this.add.text(hpX + 30, pillY + 15, `${this._hearts}`, {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: '#FF6B8A', resolution: 2,
        }).setOrigin(0, 0.5).setDepth(11).setAlpha(0);
        this.tweens.add({ targets: [hPill, hIcon, this._heartsText], alpha: 1, duration: 400, delay: 200 });

        // ── Coin pill ─────────────────────────────────────────
        const cpX = W - pillW - 8;
        const cPill = this.add.graphics().setDepth(10).setAlpha(0);
        cPill.fillStyle(0x1A150A, 1); cPill.fillRoundedRect(cpX, pillY, pillW, pillH, pillR);
        cPill.lineStyle(1, 0xAA8800, 0.55); cPill.strokeRoundedRect(cpX, pillY, pillW, pillH, pillR);
        const cIcon = this.add.image(cpX + 16, pillY + 15, 'coin_icon').setDepth(11).setAlpha(0);
        this._coinsText = this.add.text(cpX + 30, pillY + 15, `${this._coins}`, {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: '#F1C40F', resolution: 2,
        }).setOrigin(0, 0.5).setDepth(11).setAlpha(0);
        this.tweens.add({ targets: [cPill, cIcon, this._coinsText], alpha: 1, duration: 400, delay: 200 });
    }

    _drawHeaderAvatar() {
        const r = 24, bx = 42, by = 44;
        this._profGfx.clear();
        const fc = _FRAMES[this._pFrame].color;
        if (fc) { this._profGfx.fillStyle(fc, 1); this._profGfx.fillCircle(bx, by, r + 4); }
        this._profGfx.fillStyle(_AVBG[this._pAvatar], 1); this._profGfx.fillCircle(bx, by, r);
        this._profGfx.lineStyle(1.5, 0xFFFFFF, 0.3); this._profGfx.strokeCircle(bx, by, r);
        this._profEmoji?.setText(_AVATARS[this._pAvatar]);
    }

    // ──────────────────────────────────────────────────────────
    _buildProfileModal(W, H, cx) {
        const mW = 320, mH = 500, mX = cx - mW / 2, mY = H / 2 - mH / 2 - 10;

        const c = this.add.container(0, 0).setDepth(50).setVisible(false);
        this._profileContainer = c;

        // Dim
        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.72); dim.fillRect(0, 0, W, H);
        c.add(dim);

        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A2E, 1); panel.fillRoundedRect(mX, mY, mW, mH, 20);
        panel.fillStyle(0x7B6CF6, 1); panel.fillRoundedRect(mX, mY, mW, 52, { tl:20, tr:20, bl:0, br:0 });
        panel.lineStyle(1.5, 0x4A3CC8, 0.6); panel.strokeRoundedRect(mX, mY, mW, mH, 20);
        c.add(panel);

        // Title
        c.add(this.add.text(cx, mY + 26, 'MY PROFILE', {
            fontFamily: 'Outfit', fontSize: '17px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5));

        // Close ✕
        const closeX = mX + mW - 26, closeY = mY + 26;
        const closeTxt  = this.add.text(closeX, closeY, '✕', { fontSize: '18px', color: '#FFFFFF', resolution: 2 }).setOrigin(0.5);
        const closeZone = this.add.zone(closeX, closeY, 44, 44).setInteractive({ useHandCursor: true });
        c.add([closeTxt, closeZone]);
        closeZone.on('pointerdown', () => this._closeProfileModal());

        // ── Big avatar circle ────────────────────────────────
        const avCY = mY + 118, avR = 40;
        const bigGfx = this.add.graphics();
        c.add(bigGfx);
        const bigEmoji = this.add.text(cx, avCY, _AVATARS[this._pAvatar], {
            fontSize: '42px', resolution: 2,
        }).setOrigin(0.5);
        c.add(bigEmoji);

        const redrawBigAv = () => {
            bigGfx.clear();
            const fc = _FRAMES[this._pFrame].color;
            if (fc) { bigGfx.fillStyle(fc, 1); bigGfx.fillCircle(cx, avCY, avR + 5); }
            bigGfx.fillStyle(_AVBG[this._pAvatar], 1); bigGfx.fillCircle(cx, avCY, avR);
            bigGfx.lineStyle(2, 0xFFFFFF, 0.2); bigGfx.strokeCircle(cx, avCY, avR);
            bigEmoji.setText(_AVATARS[this._pAvatar]);
        };
        redrawBigAv();
        this._redrawBigAv = redrawBigAv;

        // ── Name row ─────────────────────────────────────────
        const nameY = mY + 180;
        const nameTxt = this.add.text(cx, nameY, this._pName, {
            fontFamily: 'Outfit', fontSize: '19px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5);
        const penTxt = this.add.text(0, nameY, '✏', { fontSize: '15px', color: '#9999BB', resolution: 2 }).setOrigin(0, 0.5);
        c.add([nameTxt, penTxt]);

        const syncPen = () => penTxt.setX(cx + nameTxt.width / 2 + 8);
        syncPen();

        const nameZone = this.add.zone(cx, nameY, 240, 38).setInteractive({ useHandCursor: true });
        c.add(nameZone);
        nameZone.on('pointerdown', () => {
            const n = window.prompt('Your name:', this._pName);
            if (n && n.trim()) {
                this._pName = n.trim().slice(0, 16);
                try { localStorage.setItem('bbf_name', this._pName); } catch {}
                nameTxt.setText(this._pName);
                syncPen();
            }
        });

        // ── Avatar grid label ─────────────────────────────────
        c.add(this.add.text(mX + 16, mY + 206, 'Avatar', {
            fontFamily: 'Outfit', fontSize: '11px', color: '#7777AA', resolution: 2,
        }));

        // ── Avatar grid (5 × 2) ───────────────────────────────
        const cols = 5, cellSz = 54;
        const gridX = cx - (cols * cellSz) / 2;
        const gridY = mY + 222;
        this._avSelGfx = [];

        for (let i = 0; i < _AVATARS.length; i++) {
            const col = i % cols, row = Math.floor(i / cols);
            const ax  = gridX + col * cellSz + cellSz / 2;
            const ay  = gridY + row * cellSz + cellSz / 2;
            const avR = 20;

            const selG = this.add.graphics(); c.add(selG); this._avSelGfx.push(selG);
            const avG  = this.add.graphics();
            avG.fillStyle(_AVBG[i], 1); avG.fillCircle(ax, ay, avR); c.add(avG);
            const avT  = this.add.text(ax, ay, _AVATARS[i], { fontSize: '21px', resolution: 2 }).setOrigin(0.5); c.add(avT);

            const z = this.add.zone(ax, ay, cellSz - 4, cellSz - 4).setInteractive({ useHandCursor: true }); c.add(z);
            z.on('pointerdown', () => {
                this._pAvatar = i;
                try { localStorage.setItem('bbf_avatar', i); } catch {}
                redrawBigAv(); this._refreshModal(); this._drawHeaderAvatar();
                window.SoundMgr?.buttonClick();
            });
        }

        // ── Frame row label ───────────────────────────────────
        const frLabelY = mY + 340;
        c.add(this.add.text(mX + 16, frLabelY, 'Frame', {
            fontFamily: 'Outfit', fontSize: '11px', color: '#7777AA', resolution: 2,
        }));

        // ── Frame row ─────────────────────────────────────────
        const frY = frLabelY + 30, frR = 17;
        const frCellW = mW / _FRAMES.length;
        this._frSelGfx = [];

        for (let i = 0; i < _FRAMES.length; i++) {
            const fx  = mX + frCellW * i + frCellW / 2;
            const fc  = _FRAMES[i].color;
            const selG = this.add.graphics(); c.add(selG); this._frSelGfx.push(selG);

            const frG = this.add.graphics();
            if (fc) {
                frG.fillStyle(fc, 1); frG.fillCircle(fx, frY, frR);
            } else {
                frG.lineStyle(2, 0x555577, 1); frG.strokeCircle(fx, frY, frR);
                frG.fillStyle(0x252540, 1); frG.fillCircle(fx, frY, frR - 1.5);
            }
            c.add(frG);

            if (!fc) {
                c.add(this.add.text(fx, frY, '✕', { fontSize: '14px', color: '#555577', resolution: 2 }).setOrigin(0.5));
            }

            const fz = this.add.zone(fx, frY, frCellW - 4, 44).setInteractive({ useHandCursor: true }); c.add(fz);
            fz.on('pointerdown', () => {
                this._pFrame = i;
                try { localStorage.setItem('bbf_frame', i); } catch {}
                redrawBigAv(); this._refreshModal(); this._drawHeaderAvatar();
                window.SoundMgr?.buttonClick();
            });
        }

        this._refreshModal = () => {
            this._avSelGfx.forEach((g, i) => {
                g.clear();
                if (i !== this._pAvatar) return;
                const col = i % cols, row = Math.floor(i / cols);
                const ax  = gridX + col * cellSz + cellSz / 2;
                const ay  = gridY + row * cellSz + cellSz / 2;
                g.lineStyle(3, 0xFFFFFF, 0.9); g.strokeCircle(ax, ay, 23);
            });
            this._frSelGfx.forEach((g, i) => {
                g.clear();
                if (i !== this._pFrame) return;
                const fx = mX + frCellW * i + frCellW / 2;
                g.lineStyle(3, 0xFFFFFF, 0.9); g.strokeCircle(fx, frY, frR + 4);
            });
        };
        this._refreshModal();

        // Tap dim to close
        const dimZone = this.add.zone(cx, H / 2, W, H).setInteractive(); c.add(dimZone);
        dimZone.on('pointerdown', () => this._closeProfileModal());
        dimZone.setDepth(-1);
    }

    _openProfileModal() {
        const c = this._profileContainer;
        this._redrawBigAv?.();
        this._refreshModal?.();
        c.setVisible(true).setAlpha(0).setY(24);
        this.tweens.add({ targets: c, alpha: 1, y: 0, duration: 280, ease: 'Back.easeOut' });
    }

    _closeProfileModal() {
        const c = this._profileContainer;
        this.tweens.add({
            targets: c, alpha: 0, y: 18, duration: 180, ease: 'Quad.easeIn',
            onComplete: () => c.setVisible(false).setY(0),
        });
    }

    shutdown() {
        window.SoundMgr?.stopMusic();
    }

    // ──────────────────────────────────────────────────────────
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
