// ============================================================
// HomeScene — Main menu / home screen (Royal Match style)
// ============================================================

const _AVATARS = ['🐱','🐶','🦊','🐼','🐸','🦁','🐯','🐺','🐨','🐰'];
const _AVBG    = [0xE74C3C,0xE67E22,0xF39C12,0x27AE60,0x16A085,0x2980B9,0x8E44AD,0xE91E63,0x546E7A,0x6D4C41];
const _FRAMES  = [
    { color: null,     label: 'None'   },
    { color: 0xF1C40F, label: 'Gold'   },
    { color: 0x9B59B6, label: 'Purple' },
    { color: 0x3498DB, label: 'Blue'   },
    { color: 0xE74C3C, label: 'Red'    },
];

window.HomeScene = class HomeScene extends Phaser.Scene {
    constructor() { super('HomeScene'); }

    create() {
        const W = CONFIG.GAME_WIDTH, H = CONFIG.GAME_HEIGHT, cx = W / 2;
        this.cameras.main.fadeIn(400, 0, 0, 0);
        window.SoundMgr?.startMusic('home');
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
        const levelData = LEVELS[savedLevel] || LEVELS[0];
        const DIFF_COL  = { Tutorial: 0x27AE60, Easy: 0x2980B9, Normal: 0xF39C12, Hard: 0xC0392B, 'Super Hard': 0x8E44AD };
        const DIFF_HEX  = { Tutorial: '#2ECC71', Easy: '#3498DB', Normal: '#F1C40F', Hard: '#E74C3C', 'Super Hard': '#9B59B6' };
        const dColor = DIFF_COL[levelData.difficulty] || 0x555577;
        const dHex   = DIFF_HEX[levelData.difficulty] || '#AAAACC';

        const cardY = H * 0.572, cardW = 300, cardH = 92, cL = cx - cardW / 2;
        const card = this.add.graphics().setAlpha(0);
        card.fillStyle(0x1C1C30, 1); card.fillRoundedRect(cL, cardY - cardH / 2, cardW, cardH, 14);
        card.lineStyle(2, dColor, 0.7); card.strokeRoundedRect(cL, cardY - cardH / 2, cardW, cardH, 14);
        card.fillStyle(dColor, 1); card.fillRoundedRect(cL, cardY - cardH / 2, 6, cardH, { tl: 14, tr: 0, bl: 14, br: 0 });

        const lvlTxt  = this.add.text(cx + 3, cardY - 20, `Level ${levelData.id}`, {
            fontFamily: 'Outfit', fontSize: '22px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2 }).setOrigin(0.5).setAlpha(0);
        const diffTxt = this.add.text(cx + 3, cardY + 6, levelData.difficulty, {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: dHex, resolution: 2 }).setOrigin(0.5).setAlpha(0);
        const starTxt = this.add.text(cx + 3, cardY + 30, '☆  ☆  ☆', {
            fontFamily: 'Outfit', fontSize: '17px', color: '#2A2A48', resolution: 2 }).setOrigin(0.5).setAlpha(0);
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

        // Modals — built LAST so they render on top of everything
        this._buildProfileModal(W, H, cx);
        this._buildHomeSettingsModal(W, H, cx);
    }

    // ──────────────────────────────────────────────────────────
    _readProfile() {
        const si = (key, def) => { try { const v = parseInt(localStorage.getItem(key)); return isNaN(v) ? def : v; } catch { return def; } };
        const ss = (key, def) => { try { return localStorage.getItem(key) || def; } catch { return def; } };
        this._pName   = ss('bbf_name',   'Player');
        this._pAvatar = si('bbf_avatar', 0);
        this._pFrame  = si('bbf_frame',  0);
        this._hearts  = si('bbf_hearts', 5);
        this._coins   = si('bbf_coins',  0);
    }

    // ──────────────────────────────────────────────────────────
    _buildHeader(W, cx) {
        // Layout constants
        const HY    = 44;               // vertical centre of header row
        const pW    = 74, pH = 28, pR = 14;  // pill size
        const GAP   = 6;                // gap between pills
        const RPAD  = 8;                // right edge padding
        const GEAR_R = 13;              // gear icon radius
        const GEAR_GAP = 10;            // gap between gear and first pill

        // Right-to-left positions — gear is rightmost
        const gearX = W - RPAD - GEAR_R;                  // gear centre x (far right)
        const cpX   = gearX - GEAR_R - GEAR_GAP - pW;     // coin pill left edge
        const hpX   = cpX - GAP - pW;                     // heart pill left edge
        const pillTop = HY - pH / 2;

        // ── Single container for the entire right-side HUD ───
        const hud = this.add.container(0, 0).setDepth(10).setAlpha(0);

        // ── Gear / Settings ───────────────────────────────────
        const gearGfx = this.add.graphics();
        gearGfx.lineStyle(2.5, 0xBBBBDD, 1);
        gearGfx.strokeCircle(gearX, HY, GEAR_R);
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            gearGfx.lineBetween(
                gearX + Math.cos(a) * (GEAR_R - 5), HY + Math.sin(a) * (GEAR_R - 5),
                gearX + Math.cos(a) * (GEAR_R + 2), HY + Math.sin(a) * (GEAR_R + 2)
            );
        }
        gearGfx.fillStyle(0xBBBBDD, 1); gearGfx.fillCircle(gearX, HY, 3.5);
        hud.add(gearGfx);
        const gearZone = this.add.zone(gearX, HY, 34, 34).setInteractive({ useHandCursor: true });
        hud.add(gearZone);
        gearZone.on('pointerdown', () => { window.SoundMgr?.buttonClick(); this._openHomeSettings(); });

        // ── Heart pill ────────────────────────────────────────
        const hGfx = this.add.graphics();
        hGfx.fillStyle(0x1A0808, 1); hGfx.fillRoundedRect(hpX, pillTop, pW, pH, pR);
        hGfx.lineStyle(1.5, 0xCC2222, 0.6); hGfx.strokeRoundedRect(hpX, pillTop, pW, pH, pR);
        hud.add(hGfx);
        hud.add(this.add.image(hpX + 15, HY, 'heart_icon'));
        this._heartsText = this.add.text(hpX + 29, HY, `${this._hearts}`, {
            fontFamily: 'Outfit', fontSize: '14px', fontStyle: 'bold', color: '#FF6B8A', resolution: 2,
        }).setOrigin(0, 0.5);
        hud.add(this._heartsText);

        // ── Coin pill ─────────────────────────────────────────
        const cGfx = this.add.graphics();
        cGfx.fillStyle(0x1A150A, 1); cGfx.fillRoundedRect(cpX, pillTop, pW, pH, pR);
        cGfx.lineStyle(1.5, 0xAA8800, 0.6); cGfx.strokeRoundedRect(cpX, pillTop, pW, pH, pR);
        hud.add(cGfx);
        hud.add(this.add.image(cpX + 15, HY, 'coin_icon'));
        this._coinsText = this.add.text(cpX + 29, HY, `${this._coins}`, {
            fontFamily: 'Outfit', fontSize: '14px', fontStyle: 'bold', color: '#F1C40F', resolution: 2,
        }).setOrigin(0, 0.5);
        hud.add(this._coinsText);

        this.tweens.add({ targets: hud, alpha: 1, duration: 400, delay: 200 });

        // ── Profile avatar button (left — separate, no depth conflict) ──
        const r = 22, bx = 40, by = 44;
        this._profGfx = this.add.graphics().setDepth(10).setAlpha(0);
        this._profEmoji = this.add.text(bx, by, _AVATARS[this._pAvatar], {
            fontSize: '24px', resolution: 2,
        }).setOrigin(0.5).setDepth(11).setAlpha(0);
        this._drawHeaderAvatar();
        this.add.zone(bx, by, 52, 52).setInteractive({ useHandCursor: true }).setDepth(12)
            .on('pointerdown', () => { window.SoundMgr?.buttonClick(); this._openProfileModal(); });
        this.tweens.add({ targets: [this._profGfx, this._profEmoji], alpha: 1, duration: 400, delay: 200 });
    }

    _drawHeaderAvatar() {
        const r = 22, bx = 40, by = 44;
        this._profGfx.clear();
        const fc = _FRAMES[this._pFrame].color;
        if (fc) { this._profGfx.fillStyle(fc, 1); this._profGfx.fillCircle(bx, by, r + 4); }
        this._profGfx.fillStyle(_AVBG[this._pAvatar], 1); this._profGfx.fillCircle(bx, by, r);
        this._profGfx.lineStyle(1.5, 0xFFFFFF, 0.25); this._profGfx.strokeCircle(bx, by, r);
        this._profEmoji?.setText(_AVATARS[this._pAvatar]);
    }

    // ──────────────────────────────────────────────────────────
    _buildProfileModal(W, H, cx) {
        const mW = 320, mH = 490;
        const mX = cx - mW / 2;
        const mY = Math.round(H / 2 - mH / 2) - 10;

        const c = this.add.container(0, 0).setDepth(50).setVisible(false);
        this._profileContainer = c;

        // ── Step 1: dim overlay (index 0 — bottom of stack) ──
        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.72); dim.fillRect(0, 0, W, H);
        c.add(dim);

        // ── Step 2: dimZone (index 1) — closes modal on tap outside panel ──
        const dimZone = this.add.zone(cx, H / 2, W, H).setInteractive();
        dimZone.on('pointerdown', () => this._closeProfileModal());
        c.add(dimZone);

        // ── Step 3: panel blocker (index 2) — swallows taps inside panel ──
        // Prevents taps on empty panel space from bubbling to dimZone
        const blocker = this.add.zone(cx, mY + mH / 2, mW, mH).setInteractive();
        c.add(blocker);

        // ── Step 4: All visible modal content (index 3+) ─────

        // Panel background
        const panel = this.add.graphics();
        panel.fillStyle(0x16162A, 1); panel.fillRoundedRect(mX, mY, mW, mH, 20);
        panel.fillStyle(0x7B6CF6, 1); panel.fillRoundedRect(mX, mY, mW, 52, { tl:20, tr:20, bl:0, br:0 });
        panel.lineStyle(1.5, 0x4A3CC8, 0.5); panel.strokeRoundedRect(mX, mY, mW, mH, 20);
        c.add(panel);

        // Title
        c.add(this.add.text(cx, mY + 26, 'MY PROFILE', {
            fontFamily: 'Outfit', fontSize: '16px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5));

        // Close ✕
        const closeX = mX + mW - 28, closeY = mY + 26;
        c.add(this.add.text(closeX, closeY, '✕', {
            fontFamily: 'Outfit', fontSize: '18px', color: '#CCCCEE', resolution: 2,
        }).setOrigin(0.5));
        const closeZone = this.add.zone(closeX, closeY, 44, 44).setInteractive({ useHandCursor: true });
        c.add(closeZone);
        closeZone.on('pointerdown', () => this._closeProfileModal());

        // ── Big avatar ────────────────────────────────────────
        const avCY = mY + 116, avR = 40;
        const bigGfx = this.add.graphics(); c.add(bigGfx);
        const bigEmoji = this.add.text(cx, avCY, _AVATARS[this._pAvatar], {
            fontSize: '42px', resolution: 2,
        }).setOrigin(0.5); c.add(bigEmoji);

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
        const nameY = mY + 177;
        const nameTxt = this.add.text(cx - 10, nameY, this._pName, {
            fontFamily: 'Outfit', fontSize: '19px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5); c.add(nameTxt);

        const penTxt = this.add.text(0, nameY, '✏', {
            fontSize: '14px', color: '#7777AA', resolution: 2,
        }).setOrigin(0, 0.5); c.add(penTxt);

        const syncPen = () => penTxt.setX(cx - 10 + nameTxt.width / 2 + 6);
        syncPen();

        const nameZone = this.add.zone(cx, nameY, 230, 36).setInteractive({ useHandCursor: true }); c.add(nameZone);
        nameZone.on('pointerdown', () => {
            const n = window.prompt('Tên của bạn:', this._pName);
            if (n && n.trim()) {
                this._pName = n.trim().slice(0, 16);
                try { localStorage.setItem('bbf_name', this._pName); } catch {}
                nameTxt.setText(this._pName); syncPen();
            }
        });

        // ── Avatar grid label ─────────────────────────────────
        c.add(this.add.text(mX + 16, mY + 202, 'Chọn avatar', {
            fontFamily: 'Outfit', fontSize: '11px', color: '#7777AA', resolution: 2,
        }));

        // ── Avatar grid (5 × 2) ───────────────────────────────
        const cols = 5, cellSz = 52;
        const gridTotalW = cols * cellSz;
        const gridX = cx - gridTotalW / 2;
        const gridY = mY + 220;
        this._avSelGfx = [];

        for (let i = 0; i < _AVATARS.length; i++) {
            const col = i % cols, row = Math.floor(i / cols);
            const ax  = gridX + col * cellSz + cellSz / 2;
            const ay  = gridY + row * cellSz + cellSz / 2;
            const avR = 20;

            const selG = this.add.graphics(); c.add(selG);
            this._avSelGfx.push(selG);

            const avG = this.add.graphics();
            avG.fillStyle(_AVBG[i], 1); avG.fillCircle(ax, ay, avR); c.add(avG);

            c.add(this.add.text(ax, ay, _AVATARS[i], { fontSize: '21px', resolution: 2 }).setOrigin(0.5));

            const z = this.add.zone(ax, ay, cellSz - 2, cellSz - 2).setInteractive({ useHandCursor: true }); c.add(z);
            z.on('pointerdown', () => {
                this._pAvatar = i;
                try { localStorage.setItem('bbf_avatar', i); } catch {}
                redrawBigAv(); this._refreshModal(); this._drawHeaderAvatar();
                window.SoundMgr?.buttonClick();
            });
        }

        // ── Frame row label ───────────────────────────────────
        const frLabelY = mY + 336;
        c.add(this.add.text(mX + 16, frLabelY, 'Chọn khung', {
            fontFamily: 'Outfit', fontSize: '11px', color: '#7777AA', resolution: 2,
        }));

        // ── Frame row (5 options) ─────────────────────────────
        const frY    = frLabelY + 34, frR = 18;
        const frCellW = mW / _FRAMES.length;
        this._frSelGfx = [];

        for (let i = 0; i < _FRAMES.length; i++) {
            const fx = mX + frCellW * i + frCellW / 2;
            const fc = _FRAMES[i].color;

            const selG = this.add.graphics(); c.add(selG);
            this._frSelGfx.push(selG);

            const frG = this.add.graphics();
            if (fc) {
                frG.fillStyle(fc, 0.25); frG.fillCircle(fx, frY, frR);
                frG.lineStyle(3, fc, 1); frG.strokeCircle(fx, frY, frR);
            } else {
                frG.lineStyle(2, 0x44445A, 1); frG.strokeCircle(fx, frY, frR);
                frG.fillStyle(0x22223A, 1); frG.fillCircle(fx, frY, frR - 1.5);
                frG.lineStyle(1.5, 0x44445A, 0.5);
                frG.beginPath(); frG.moveTo(fx - 9, frY - 9); frG.lineTo(fx + 9, frY + 9); frG.strokePath();
                frG.beginPath(); frG.moveTo(fx + 9, frY - 9); frG.lineTo(fx - 9, frY + 9); frG.strokePath();
            }
            c.add(frG);

            c.add(this.add.text(fx, frY + frR + 10, _FRAMES[i].label, {
                fontFamily: 'Outfit', fontSize: '10px', color: fc ? '#AAAACC' : '#555577', resolution: 2,
            }).setOrigin(0.5));

            const fz = this.add.zone(fx, frY + 6, frCellW - 2, 56).setInteractive({ useHandCursor: true }); c.add(fz);
            fz.on('pointerdown', () => {
                this._pFrame = i;
                try { localStorage.setItem('bbf_frame', i); } catch {}
                redrawBigAv(); this._refreshModal(); this._drawHeaderAvatar();
                window.SoundMgr?.buttonClick();
            });
        }

        // ── _refreshModal: redraws selection indicators ───────
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
    }

    // ──────────────────────────────────────────────────────────
    _buildHomeSettingsModal(W, H, cx) {
        const pw = 292, ph = 310;
        const pLeft = cx - pw / 2, pTop = H / 2 - ph / 2;

        const c = this.add.container(0, 0).setDepth(60).setVisible(false);
        this._settingsContainer = c;

        // Dim
        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.68); dim.fillRect(0, 0, W, H);
        dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
        dim.on('pointerdown', () => this._closeHomeSettings());
        c.add(dim);

        // Panel blocker
        const blocker = this.add.zone(cx, pTop + ph / 2, pw, ph).setInteractive(); c.add(blocker);

        // Panel bg
        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A2A, 1); panel.fillRoundedRect(pLeft, pTop, pw, ph, 18);
        panel.fillStyle(0x3A2A6A, 1); panel.fillRoundedRect(pLeft, pTop, pw, 50, { tl:18, tr:18, bl:0, br:0 });
        panel.lineStyle(1.5, 0x4A3CC8, 0.5); panel.strokeRoundedRect(pLeft, pTop, pw, ph, 18);
        c.add(panel);

        // Title
        c.add(this.add.text(cx, pTop + 25, '⚙  Cài đặt', {
            fontFamily: 'Outfit', fontSize: '17px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5));

        // Close ✕
        const clX = pLeft + pw - 26, clY = pTop + 25;
        c.add(this.add.text(clX, clY, '✕', { fontFamily: 'Outfit', fontSize: '18px', color: '#CCCCEE', resolution: 2 }).setOrigin(0.5));
        const clZ = this.add.zone(clX, clY, 40, 40).setInteractive({ useHandCursor: true }); c.add(clZ);
        clZ.on('pointerdown', () => this._closeHomeSettings());

        // Divider helper
        const divider = (y) => {
            const d = this.add.graphics();
            d.lineStyle(1, 0x3A3A60, 0.5); d.lineBetween(pLeft + 16, y, pLeft + pw - 16, y); c.add(d);
        };
        divider(pTop + 50);

        // Sound toggle
        const row1Y = pTop + 78;
        c.add(this.add.text(pLeft + 18, row1Y, '🔊  Âm thanh', {
            fontFamily: 'Outfit', fontSize: '14px', fontStyle: 'bold', color: '#DDDDEE', resolution: 2,
        }).setOrigin(0, 0.5));

        const TW = 54, TH = 28, TR = 14;
        const tgX = pLeft + pw - 40;
        const tgOffX = tgX - TW / 2 + TR, tgOnX = tgX + TW / 2 - TR;
        let soundOn = !(window.SoundMgr?.muted ?? false);

        const tgBg = this.add.graphics();
        const redrawToggle = (on) => {
            tgBg.clear(); tgBg.fillStyle(on ? 0x27AE60 : 0x3A3A50, 1);
            tgBg.fillRoundedRect(tgX - TW / 2, row1Y - TH / 2, TW, TH, TR);
        };
        redrawToggle(soundOn); c.add(tgBg);

        const tgKnob = this.add.graphics();
        tgKnob.fillStyle(0xFFFFFF, 1); tgKnob.fillCircle(0, 0, TR - 3);
        tgKnob.setPosition(soundOn ? tgOnX : tgOffX, row1Y); c.add(tgKnob);

        const tgLabel = this.add.text(tgX, row1Y, soundOn ? 'BẬT' : 'TẮT', {
            fontFamily: 'Outfit', fontSize: '9px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5); c.add(tgLabel);

        const tgZone = this.add.zone(tgX, row1Y, TW, TH).setInteractive({ useHandCursor: true }); c.add(tgZone);
        tgZone.on('pointerdown', () => {
            soundOn = !soundOn;
            redrawToggle(soundOn); tgLabel.setText(soundOn ? 'BẬT' : 'TẮT');
            this.tweens.add({ targets: tgKnob, x: soundOn ? tgOnX : tgOffX, duration: 160, ease: 'Quad.easeOut' });
            const muted = window.SoundMgr?.toggleMute();
            if (!muted) window.SoundMgr?.buttonClick();
        });

        divider(pTop + 106);

        // Slider helper
        const TRK_M = 20, TRK_S = pLeft + TRK_M, TRK_E = pLeft + pw - TRK_M;
        const TRK_W = TRK_E - TRK_S, TRK_H = 6, KR = 12;

        const makeSlider = (labelY, trackY, emoji, label, initV, accent, onChange) => {
            c.add(this.add.text(pLeft + 18, labelY, `${emoji}  ${label}`, {
                fontFamily: 'Outfit', fontSize: '13px', color: '#9999BB', resolution: 2,
            }).setOrigin(0, 0.5));
            const pctTxt = this.add.text(TRK_E + 4, labelY, '', {
                fontFamily: 'Outfit', fontSize: '11px', fontStyle: 'bold', color: '#7777AA', resolution: 2,
            }).setOrigin(0, 0.5); c.add(pctTxt);

            const trkBg = this.add.graphics();
            trkBg.fillStyle(0x1E1E2E, 1); trkBg.fillRoundedRect(TRK_S, trackY - TRK_H/2, TRK_W, TRK_H, TRK_H/2); c.add(trkBg);
            const trkFill = this.add.graphics(); c.add(trkFill);
            const knob = this.add.graphics(); c.add(knob);

            let value = initV;
            const redraw = (v) => {
                value = Math.max(0, Math.min(1, v));
                const kx = TRK_S + value * TRK_W;
                trkFill.clear();
                if (value > 0) { trkFill.fillStyle(accent, 1); trkFill.fillRoundedRect(TRK_S, trackY - TRK_H/2, value * TRK_W, TRK_H, TRK_H/2); }
                knob.clear();
                knob.fillStyle(accent, 0.22); knob.fillCircle(kx, trackY, KR + 5);
                knob.fillStyle(0xFFFFFF, 1); knob.fillCircle(kx, trackY, KR);
                knob.lineStyle(2.5, accent, 1); knob.strokeCircle(kx, trackY, KR);
                pctTxt.setText(`${Math.round(value * 100)}%`);
                onChange(value);
            };
            redraw(value);

            const zone = this.add.zone(TRK_S + TRK_W/2, trackY, TRK_W + KR*2, (KR+5)*2+4).setInteractive({ useHandCursor: true }); c.add(zone);
            let dragging = false;
            zone.on('pointerdown', (ptr) => { dragging = true; redraw((ptr.x - TRK_S) / TRK_W); });
            this.input.on('pointermove', (ptr) => { if (dragging) redraw((ptr.x - TRK_S) / TRK_W); });
            this.input.on('pointerup', () => { if (dragging) { dragging = false; window.SoundMgr?.buttonClick(); } });
        };

        makeSlider(pTop + 128, pTop + 150, '🎵', 'Nhạc nền',
            window.SoundMgr?.musicVolume ?? 0.7, 0x7B6CF6,
            (v) => window.SoundMgr?.setMusicVolume(v));

        makeSlider(pTop + 190, pTop + 212, '🎛', 'Hiệu ứng âm',
            window.SoundMgr?.sfxVolume ?? 0.5, 0x27AE60,
            (v) => window.SoundMgr?.setSfxVolume(v));
    }

    _openHomeSettings() {
        const c = this._settingsContainer;
        c.setVisible(true).setAlpha(0).setY(20);
        this.tweens.add({ targets: c, alpha: 1, y: 0, duration: 280, ease: 'Back.easeOut' });
    }

    _closeHomeSettings() {
        const c = this._settingsContainer;
        this.tweens.add({
            targets: c, alpha: 0, y: 16, duration: 180, ease: 'Quad.easeIn',
            onComplete: () => c.setVisible(false).setY(0),
        });
    }

    _openProfileModal() {
        const c = this._profileContainer;
        this._redrawBigAv?.();
        this._refreshModal?.();
        c.setVisible(true).setAlpha(0).setY(22);
        this.tweens.add({ targets: c, alpha: 1, y: 0, duration: 300, ease: 'Back.easeOut' });
    }

    _closeProfileModal() {
        const c = this._profileContainer;
        this.tweens.add({
            targets: c, alpha: 0, y: 16, duration: 180, ease: 'Quad.easeIn',
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
