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

// Shop catalog — IAP-styled items are mocked (no real billing SDK): tapping "buy"
// grants the reward immediately. Booster Pack items are a Coin sink only — there is
// no persistent Booster inventory yet, so they don't add usable Boosters in-game.
const _SHOP_TABS = {
    noAds: [
        { id: 'noads', name: 'Xoá Quảng Cáo', desc: 'Chơi không gián đoạn, mãi mãi', price: '$2.99', isIAP: true, flag: 'bbf_noAds' },
    ],
    bundle: [
        { id: 'starter', name: 'Gói Khởi Đầu', desc: '500 Coin + Xoá Quảng Cáo', price: '$4.99', isIAP: true, coin: 500, flag: 'bbf_noAds' },
        { id: 'value', name: 'Gói Giá Trị', desc: '1500 Coin', price: '$9.99', isIAP: true, coin: 1500, tag: 'BEST VALUE' },
    ],
    booster: [
        { id: 'magnet3', name: '🧲 Magnet x3', desc: 'Hút Block bị chặn ra khỏi Board', cost: 150 },
        { id: 'shuffle3', name: '🔀 Shuffle x3', desc: 'Xếp lại Car đang hoạt động', cost: 150 },
        { id: 'paint3', name: '🎨 Paint Gun x3', desc: 'Phá toàn bộ Block cùng màu', cost: 150 },
    ],
    gold: [
        { id: 'small', name: 'Túi Coin Nhỏ', coin: 100, price: '$0.99', isIAP: true },
        { id: 'medium', name: 'Túi Coin Vừa', coin: 550, price: '$4.99', isIAP: true, tag: 'POPULAR' },
        { id: 'large', name: 'Túi Coin Lớn', coin: 1200, price: '$9.99', isIAP: true, tag: 'BEST VALUE' },
        { id: 'mega', name: 'Rương Coin', coin: 2600, price: '$19.99', isIAP: true },
    ],
};

// Mock leaderboard bots — ranked by furthest level reached, real player inserted by rank.
const _LB_BOTS = [
    { name: 'Minh Anh', avatar: 2, level: 92 },
    { name: 'Gia Hân', avatar: 5, level: 81 },
    { name: 'Khánh Linh', avatar: 7, level: 76 },
    { name: 'Đức Huy', avatar: 1, level: 64 },
    { name: 'Bảo Châu', avatar: 4, level: 58 },
    { name: 'Tuấn Kiệt', avatar: 0, level: 49 },
    { name: 'Thuỳ Trang', avatar: 6, level: 41 },
    { name: 'Hoàng Long', avatar: 3, level: 33 },
    { name: 'Ngọc Mai', avatar: 8, level: 24 },
    { name: 'Quang Vinh', avatar: 9, level: 12 },
];

window.HomeScene = class HomeScene extends Phaser.Scene {
    constructor() { super('HomeScene'); }

    create() {
        const W = CONFIG.GAME_WIDTH, H = CONFIG.GAME_HEIGHT, cx = W / 2;
        this.cameras.main.fadeIn(400, 0, 0, 0);
        window.SoundMgr?.startMusic('home');
        this._readProfile();

        // ── Background (tinted by current Region) ─────────────────
        const regionDef = REGIONS[this._region - 1] || REGIONS[0];
        this._bg = this.add.graphics();
        this._drawHomeBackground(W, H, regionDef);

        this._spawnDecoBlocks(W, H);
        this._buildHeader(W, cx);
        this._buildRegionTrail(W, cx);

        // ── Logo ─────────────────────────────────────────────────
        const logoY = 178;
        const logo  = this.add.text(cx, logoY + 16, 'BLOCK BLAST\nFLOW!', {
            fontFamily: 'Outfit', fontSize: '42px', fontStyle: 'bold',
            color: '#FFFFFF', stroke: '#3D2FA8', strokeThickness: 9,
            shadow: { offsetX: 0, offsetY: 2, color: '#7B6CF6', blur: 24, fill: true },
            align: 'center', resolution: 2,
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: logo, alpha: 1, y: logoY, duration: 700, delay: 100, ease: 'Back.easeOut' });
        this.time.delayedCall(800, () => {
            this.tweens.add({ targets: logo, y: logoY - 8, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });

        // ── Toy car (idle bounce) + Customize pencil ──────────────
        this._buildHomeCar(cx, 312);

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

        const cardY = 482, cardW = 300, cardH = 92, cL = cx - cardW / 2;
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

        // ── PLAY (main) + UNLOCK (secondary) row ──────────────────
        const ctaY = 608, playW = 196, unlockW = 92, ctaH = 64, ctaGap = 10;
        const playX = cx - unlockW / 2 - ctaGap / 2;
        const unlockX = playX + playW / 2 + ctaGap / 2 + unlockW / 2;

        const playC = this.add.container(playX, ctaY).setAlpha(0);
        const playBg = this.add.graphics();
        playBg.fillStyle(0x5A4DE0, 1); playBg.fillRoundedRect(-playW/2, -ctaH/2, playW, ctaH, 18);
        playBg.fillStyle(0x7B6CF6, 1); playBg.fillRoundedRect(-playW/2, -ctaH/2, playW, ctaH/2, { tl:18, tr:18, bl:0, br:0 });
        playBg.fillStyle(0xFFFFFF, 0.14); playBg.fillRoundedRect(-playW/2+10, -ctaH/2+6, playW-20, 12, 6);
        const playTxt = this.add.text(0, 0, '▶  PLAY', {
            fontFamily: 'Outfit', fontSize: '24px', fontStyle: 'bold', color: '#FFFFFF',
            shadow: { offsetX: 0, offsetY: 3, color: '#2A1A90', blur: 6, fill: true }, resolution: 2,
        }).setOrigin(0.5);
        playC.add([playBg, playTxt]);
        this.tweens.add({ targets: playC, alpha: 1, duration: 500, delay: 500, ease: 'Quad.easeOut' });
        this.time.delayedCall(1100, () => {
            this.tweens.add({ targets: playC, scaleX: 1.025, scaleY: 1.025, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
        const playZone = this.add.zone(playX, ctaY, playW, ctaH).setInteractive({ useHandCursor: true });
        playZone.on('pointerdown', () => {
            if (this._hearts <= 0) { window.SoundMgr?.buttonClick(); this._openOverLivesModal(); return; }
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

        // UNLOCK button — secondary, opens the Region progress popup
        const unlockC = this.add.container(unlockX, ctaY).setAlpha(0);
        const unlockBg = this.add.graphics();
        unlockBg.fillStyle(0x2A2A42, 1); unlockBg.fillRoundedRect(-unlockW/2, -ctaH/2, unlockW, ctaH, 18);
        unlockBg.lineStyle(2, 0xF1C40F, 0.8); unlockBg.strokeRoundedRect(-unlockW/2, -ctaH/2, unlockW, ctaH, 18);
        const unlockTxt = this.add.text(0, -8, '🔓', { fontSize: '18px', resolution: 2 }).setOrigin(0.5);
        const unlockLbl = this.add.text(0, 14, 'UNLOCK', {
            fontFamily: 'Outfit', fontSize: '10px', fontStyle: 'bold', color: '#F1C40F', resolution: 2,
        }).setOrigin(0.5);
        unlockC.add([unlockBg, unlockTxt, unlockLbl]);
        this.tweens.add({ targets: unlockC, alpha: 1, duration: 500, delay: 560, ease: 'Quad.easeOut' });
        const unlockZone = this.add.zone(unlockX, ctaY, unlockW, ctaH).setInteractive({ useHandCursor: true });
        this._addPress(unlockZone, [unlockBg, unlockTxt, unlockLbl]);
        unlockZone.on('pointerdown', () => { window.SoundMgr?.buttonClick(); this._openRegionModal(); });

        // ── Bottom tab bar: Shop / Main Screen / Leaderboard ──────
        this._buildBottomTabs(W, H, cx);

        // Modals — built LAST so they render on top of everything
        this._buildProfileModal(W, H, cx);
        this._buildHomeSettingsModal(W, H, cx);
        this._buildRegionModal(W, H, cx);
        this._buildCustomizeModal(W, H, cx);
        this._buildOverLivesModal(W, H, cx);
        this._buildShopModal(W, H, cx);
        this._buildBuySuccessModal(W, H, cx);
        this._buildLeaderboardModal(W, H, cx);

        if (this._hearts <= 0) {
            this.time.delayedCall(600, () => this._openOverLivesModal());
        }
    }

    _drawHomeBackground(W, H, regionDef) {
        const bg = this._bg;
        bg.clear();
        bg.fillStyle(0x0A0A1E, 1); bg.fillRect(0, 0, W, H);
        bg.fillStyle(regionDef.bgColor, 0.55); bg.fillCircle(W / 2, H * 0.3, 300);
        bg.fillStyle(0x131320, 1);
        bg.fillRoundedRect(0, H * 0.52, W, H * 0.48, { tl: 32, tr: 32, bl: 0, br: 0 });
    }

    // ──────────────────────────────────────────────────────────
    _readProfile() {
        const si = (key, def) => { try { const v = parseInt(localStorage.getItem(key)); return isNaN(v) ? def : v; } catch { return def; } };
        const ss = (key, def) => { try { return localStorage.getItem(key) || def; } catch { return def; } };
        const sj = (key, def) => { try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' ? v : def; } catch { return def; } };
        this._pName   = ss('bbf_name',   'Player');
        this._pAvatar = si('bbf_avatar', 0);
        this._pFrame  = si('bbf_frame',  0);
        this._hearts  = window.PlayerHearts ? window.PlayerHearts.tickRegen() : si('bbf_hearts', 5);
        this._coins   = si('bbf_coins',  0);
        this._stars   = si('bbf_stars',  0);
        this._region  = Math.max(1, Math.min(REGIONS.length, si('bbf_unlockedRegion', 1)));

        this._equippedParts = sj('bbf_carParts', { ...CAR_PARTS_DEFAULT });
        this._ownedParts = sj('bbf_ownedParts', {
            bodyColor: [CAR_PARTS_DEFAULT.bodyColor],
            wheel: [CAR_PARTS_DEFAULT.wheel],
            door: [CAR_PARTS_DEFAULT.door],
            decal: [CAR_PARTS_DEFAULT.decal],
        });
        let ownedCars;
        try { ownedCars = JSON.parse(localStorage.getItem('bbf_ownedCars')); } catch { ownedCars = null; }
        this._ownedCars = Array.isArray(ownedCars) ? ownedCars : ['classic'];
        this._activeCar = ss('bbf_activeCar', 'classic');
    }

    _saveCoins() { try { localStorage.setItem('bbf_coins', this._coins); } catch {} }
    _saveStars() { try { localStorage.setItem('bbf_stars', this._stars); } catch {} }
    _saveRegion() { try { localStorage.setItem('bbf_unlockedRegion', this._region); } catch {} }
    _saveEquippedParts() { try { localStorage.setItem('bbf_carParts', JSON.stringify(this._equippedParts)); } catch {} }
    _saveOwnedParts() { try { localStorage.setItem('bbf_ownedParts', JSON.stringify(this._ownedParts)); } catch {} }
    _saveOwnedCars() { try { localStorage.setItem('bbf_ownedCars', JSON.stringify(this._ownedCars)); } catch {} }
    _saveActiveCar() { try { localStorage.setItem('bbf_activeCar', this._activeCar); } catch {} }

    /** Generic press-feedback helper (alpha flash + scale), mirrors UIScene._addBtnPress. */
    _addPress(zone, targets) {
        const arr = Array.isArray(targets) ? targets : [targets];
        zone.on('pointerdown', () => {
            arr.forEach(t => {
                t.__pa = t.alpha;
                t.setAlpha(Math.max(0.08, t.alpha * 0.55));
            });
        });
        const restore = () => arr.forEach(t => { if (t.__pa !== undefined) { t.setAlpha(t.__pa); delete t.__pa; } });
        zone.on('pointerup', restore);
        zone.on('pointerout', restore);
    }

    /** Procedural toy-car drawing — shared by the Home idle car and Customize preview. */
    _drawToyCar(g, parts, cx, cy, scale = 1) {
        g.clear();
        const colorData = COLORS[parts.bodyColor] || COLORS.red;
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

        if (parts.door === 'racing') {
            g.lineStyle(3 * scale, 0xFFFFFF, 0.85);
            g.lineBetween(cx - w / 2 + 6 * scale, cy + 4 * scale, cx + w / 2 - 6 * scale, cy + 4 * scale);
        } else if (parts.door === 'armor') {
            g.lineStyle(2 * scale, 0xAAAAAA, 0.9);
            g.strokeRoundedRect(cx - w / 2 + 4 * scale, cy - 1 * scale, w - 8 * scale, h * 0.42, 4 * scale);
        }

        const wheelR = (parts.wheel === 'offroad' ? 7.5 : parts.wheel === 'sport' ? 6 : 5) * scale;
        const wx = w / 2 - 10 * scale, wy = h / 2 - 2 * scale;
        for (const [dx, dy] of [[-wx, wy], [wx, wy]]) {
            g.fillStyle(0x1A1A1A, 1);
            g.fillCircle(cx + dx, cy + dy, wheelR);
            g.fillStyle(parts.wheel === 'sport' ? 0xE74C3C : 0x666666, 1);
            g.fillCircle(cx + dx, cy + dy, wheelR * 0.4);
        }

        g.fillStyle(0xFFFFFF, 0.18);
        g.fillRoundedRect(cx - w / 2 + 6 * scale, cy - h / 2 + 3 * scale, w * 0.3, 4 * scale, 2 * scale);
    }

    /** Draws the car body via _drawToyCar and syncs an emoji decal Text on top of it. */
    _renderCarVisual(g, decalText, parts, cx, cy, scale = 1) {
        this._drawToyCar(g, parts, cx, cy, scale);
        const decalDef = CAR_PARTS.decal.find(d => d.id === parts.decal);
        if (decalDef && decalDef.emoji) {
            decalText.setText(decalDef.emoji).setFontSize(Math.round(15 * scale))
                .setPosition(cx, cy - 2 * scale).setVisible(true);
        } else {
            decalText.setVisible(false);
        }
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
        const spX   = cpX - GAP - pW;                     // star pill left edge
        const hpX   = spX - GAP - pW;                     // heart pill left edge
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

        // Countdown to next regenerated Heart (hidden while full)
        this._heartTimerText = this.add.text(hpX + pW / 2, pillTop + pH + 11, '', {
            fontFamily: 'Outfit', fontSize: '9px', fontStyle: 'bold', color: '#FF8FA3', resolution: 2,
        }).setOrigin(0.5);
        hud.add(this._heartTimerText);
        this._startHeartTimerLoop();

        // ── Star pill ─────────────────────────────────────────
        const sGfx = this.add.graphics();
        sGfx.fillStyle(0x1A1808, 1); sGfx.fillRoundedRect(spX, pillTop, pW, pH, pR);
        sGfx.lineStyle(1.5, 0xAA9900, 0.6); sGfx.strokeRoundedRect(spX, pillTop, pW, pH, pR);
        hud.add(sGfx);
        hud.add(this.add.text(spX + 15, HY, '⭐', { fontSize: '15px', resolution: 2 }).setOrigin(0.5));
        this._starsText = this.add.text(spX + 29, HY, `${this._stars}`, {
            fontFamily: 'Outfit', fontSize: '14px', fontStyle: 'bold', color: '#F1C40F', resolution: 2,
        }).setOrigin(0, 0.5);
        hud.add(this._starsText);

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

    /** Row of small region nodes under the header — current/locked state at a glance. */
    _buildRegionTrail(W, cx) {
        const y = 96, n = REGIONS.length, gap = 46;
        const totalW = (n - 1) * gap;
        const startX = cx - totalW / 2;
        this._trailY = y; this._trailStartX = startX; this._trailGap = gap;

        const trail = this.add.container(0, 0).setDepth(8).setAlpha(0);

        const line = this.add.graphics();
        line.lineStyle(2, 0x333355, 0.6);
        line.lineBetween(startX, y, startX + totalW, y);
        trail.add(line);

        this._trailNodeGfx = [];
        this._trailNodeTxt = [];

        for (let i = 0; i < n; i++) {
            const nx = startX + i * gap;

            const g = this.add.graphics();
            trail.add(g);
            this._trailNodeGfx.push(g);

            const t = this.add.text(nx, y, '', { fontSize: '11px', fontStyle: 'bold', resolution: 2 }).setOrigin(0.5);
            trail.add(t);
            this._trailNodeTxt.push(t);

            const z = this.add.zone(nx, y, gap - 4, 28).setInteractive({ useHandCursor: true });
            trail.add(z);
            z.on('pointerdown', () => { window.SoundMgr?.buttonClick(); this._openRegionModal(); });
        }

        this._refreshRegionTrail();
        this.tweens.add({ targets: trail, alpha: 1, duration: 400, delay: 250 });
    }

    _refreshRegionTrail() {
        const y = this._trailY, startX = this._trailStartX, gap = this._trailGap;
        REGIONS.forEach((region, i) => {
            const nx = startX + i * gap;
            const unlocked = region.id <= this._region;
            const isCurrent = region.id === this._region;
            const r = isCurrent ? 12 : 9;

            const g = this._trailNodeGfx[i];
            g.clear();
            g.fillStyle(unlocked ? region.bgColor : 0x22222E, 1);
            g.fillCircle(nx, y, r);
            g.lineStyle(2, unlocked ? 0xF1C40F : 0x44445A, isCurrent ? 1 : 0.7);
            g.strokeCircle(nx, y, r);

            this._trailNodeTxt[i]
                .setText(unlocked ? `${region.id}` : '🔒')
                .setFontSize(unlocked ? 11 : 9)
                .setColor(unlocked ? '#FFFFFF' : '#888899')
                .setPosition(nx, y);
        });
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
    /** Idle toy car centered on Home, with a pencil badge that opens Customize. */
    _buildHomeCar(cx, cy) {
        const carG = this.add.graphics().setDepth(9);
        const decalText = this.add.text(0, 0, '', { fontSize: '15px', resolution: 2 }).setOrigin(0.5).setDepth(10).setVisible(false);
        this._homeCarGfx = carG;
        this._homeCarDecal = decalText;
        this._homeCarCx = cx;
        this._homeCarCy = cy;

        const carParts = this._equippedCarParts();
        this._renderCarVisual(carG, decalText, carParts, cx, cy, 1.15);

        const carHolder = this.add.container(0, 0).setAlpha(0);
        carHolder.add([carG, decalText]);
        this.tweens.add({ targets: carHolder, alpha: 1, duration: 500, delay: 320, ease: 'Quad.easeOut' });

        // Idle bounce — animate a y-offset wrapper since Graphics draws at absolute coords
        const bounce = { dy: 0 };
        this.tweens.add({
            targets: bounce, dy: -8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            onUpdate: () => {
                carG.setY(bounce.dy);
                decalText.setY(bounce.dy);
            },
        });

        // Pencil badge — opens Customize Car screen
        const pbX = cx + 56, pbY = cy + 28;
        const pbBg = this.add.graphics().setDepth(11);
        pbBg.fillStyle(0x7B6CF6, 1); pbBg.fillCircle(pbX, pbY, 16);
        pbBg.lineStyle(2, 0xFFFFFF, 0.8); pbBg.strokeCircle(pbX, pbY, 16);
        const pbIcon = this.add.text(pbX, pbY, '✏️', { fontSize: '15px', resolution: 2 }).setOrigin(0.5).setDepth(12);
        const pbZone = this.add.zone(pbX, pbY, 38, 38).setInteractive({ useHandCursor: true }).setDepth(13);
        this._addPress(pbZone, [pbBg, pbIcon]);
        pbZone.on('pointerdown', () => { window.SoundMgr?.buttonClick(); this._openCustomizeModal(); });

        [pbBg, pbIcon].forEach(o => o.setAlpha(0));
        this.tweens.add({ targets: [pbBg, pbIcon], alpha: 1, duration: 400, delay: 500 });
    }

    _equippedCarParts() {
        return { ...CAR_PARTS_DEFAULT, ...this._equippedParts };
    }

    /** Bottom nav: Shop / Main Screen (current) / Leaderboard. Shop+Leaderboard land in a later pass. */
    _buildBottomTabs(W, H, cx) {
        const barH = 58, barY = H - barH;
        const bar = this.add.graphics().setDepth(40);
        bar.fillStyle(0x14141F, 1); bar.fillRect(0, barY, W, barH);
        bar.lineStyle(1, 0x2A2A40, 1); bar.lineBetween(0, barY, W, barY);

        const tabs = [
            { key: 'shop', icon: '🛒', label: 'Shop' },
            { key: 'home', icon: '🏠', label: 'Trang chủ' },
            { key: 'leaderboard', icon: '🏆', label: 'Xếp hạng' },
        ];
        const tabW = W / tabs.length;

        tabs.forEach((tab, i) => {
            const tx = tabW * i + tabW / 2;
            const ty = barY + barH / 2;
            const isActive = tab.key === 'home';

            const icon = this.add.text(tx, ty - 9, tab.icon, { fontSize: '17px', resolution: 2 })
                .setOrigin(0.5).setDepth(41).setAlpha(isActive ? 1 : 0.5);
            const label = this.add.text(tx, ty + 13, tab.label, {
                fontFamily: 'Outfit', fontSize: '10px', fontStyle: isActive ? 'bold' : 'normal',
                color: isActive ? '#7B6CF6' : '#666680', resolution: 2,
            }).setOrigin(0.5).setDepth(41);

            const zone = this.add.zone(tx, ty, tabW, barH).setInteractive({ useHandCursor: true }).setDepth(42);
            this._addPress(zone, [icon, label]);
            zone.on('pointerdown', () => {
                window.SoundMgr?.buttonClick();
                if (tab.key === 'home') return;
                if (tab.key === 'shop') { this._openShopModal(); return; }
                if (tab.key === 'leaderboard') { this._openLeaderboardModal(); return; }
                this._showToast(`${tab.label} sắp ra mắt!`);
            });
        });
    }

    _showToast(message) {
        const W = CONFIG.GAME_WIDTH, H = CONFIG.GAME_HEIGHT;
        const txt = this.add.text(W / 2, H - 90, message, {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: '#FFFFFF',
            backgroundColor: '#2A2A42', padding: { x: 14, y: 8 }, resolution: 2,
        }).setOrigin(0.5).setDepth(900).setAlpha(0);
        this.tweens.add({
            targets: txt, alpha: 1, y: H - 100, duration: 220, ease: 'Quad.easeOut',
            onComplete: () => {
                this.time.delayedCall(1300, () => {
                    this.tweens.add({ targets: txt, alpha: 0, duration: 250, onComplete: () => txt.destroy() });
                });
            },
        });
    }

    /** Ticks every second: applies Heart regen as it happens and refreshes the header countdown. */
    _startHeartTimerLoop() {
        const tick = () => {
            if (!window.PlayerHearts) return;
            const hearts = window.PlayerHearts.tickRegen();
            if (hearts !== this._hearts) {
                this._hearts = hearts;
                this._heartsText?.setText(`${this._hearts}`);
            }

            if (this._hearts >= window.PlayerHearts.MAX) {
                this._heartTimerText?.setText('');
                return;
            }

            const ms = window.PlayerHearts.msUntilNext();
            const totalSec = Math.max(0, Math.ceil(ms / 1000));
            const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
            const ss = String(totalSec % 60).padStart(2, '0');
            this._heartTimerText?.setText(`+1  ${mm}:${ss}`);
        };
        tick();
        this.time.addEvent({ delay: 1000, loop: true, callback: tick });
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

    // ──────────────────────────────────────────────────────────
    // Unlock Progress Popup — Region ladder, spend Star to unlock
    // ──────────────────────────────────────────────────────────
    _buildRegionModal(W, H, cx) {
        const mW = 320, rowH = 64, headerH = 90, footH = 14;
        const mH = headerH + REGIONS.length * rowH + footH;
        const mX = cx - mW / 2;
        const mY = Math.round(H / 2 - mH / 2);
        this._regionPanelX = mX;
        this._regionPanelW = mW;

        const c = this.add.container(0, 0).setDepth(70).setVisible(false);
        this._regionContainer = c;

        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.72); dim.fillRect(0, 0, W, H);
        const dimZone = this.add.zone(cx, H / 2, W, H).setInteractive();
        dimZone.on('pointerdown', () => this._closeRegionModal());
        c.add(dim); c.add(dimZone);

        const blocker = this.add.zone(cx, mY + mH / 2, mW, mH).setInteractive();
        c.add(blocker);

        const panel = this.add.graphics();
        panel.fillStyle(0x16162A, 1); panel.fillRoundedRect(mX, mY, mW, mH, 20);
        panel.fillStyle(0xF1C40F, 1); panel.fillRoundedRect(mX, mY, mW, 52, { tl: 20, tr: 20, bl: 0, br: 0 });
        panel.lineStyle(1.5, 0xB7950B, 0.6); panel.strokeRoundedRect(mX, mY, mW, mH, 20);
        c.add(panel);

        c.add(this.add.text(cx, mY + 26, '🗺  TIẾN ĐỘ VÙNG ĐẤT', {
            fontFamily: 'Outfit', fontSize: '15px', fontStyle: 'bold', color: '#1A1408', resolution: 2,
        }).setOrigin(0.5));

        const closeX = mX + mW - 28, closeY = mY + 26;
        c.add(this.add.text(closeX, closeY, '✕', {
            fontFamily: 'Outfit', fontSize: '18px', color: '#1A1408', resolution: 2,
        }).setOrigin(0.5));
        const closeZone = this.add.zone(closeX, closeY, 44, 44).setInteractive({ useHandCursor: true });
        c.add(closeZone);
        closeZone.on('pointerdown', () => this._closeRegionModal());

        this._regionStarText = this.add.text(cx, mY + 70, '', {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: '#F1C40F', resolution: 2,
        }).setOrigin(0.5);
        c.add(this._regionStarText);

        this._regionRows = [];
        REGIONS.forEach((region, i) => {
            const ry = mY + headerH + i * rowH;
            const isLast = i === REGIONS.length - 1;

            const rowBg = this.add.graphics();
            c.add(rowBg);

            const badge = this.add.graphics();
            c.add(badge);
            const badgeTxt = this.add.text(mX + 38, ry + rowH / 2, '', {
                fontSize: isLast ? '18px' : '15px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
            }).setOrigin(0.5);
            c.add(badgeTxt);

            const nameTxt = this.add.text(mX + 70, ry + rowH / 2 - 13, region.name, {
                fontFamily: 'Outfit', fontSize: isLast ? '15px' : '13px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
            }).setOrigin(0, 0.5);
            c.add(nameTxt);

            const descTxt = this.add.text(mX + 70, ry + rowH / 2 + 6, region.desc, {
                fontFamily: 'Outfit', fontSize: '10px', color: '#9999BB', resolution: 2,
                wordWrap: { width: 140 },
            }).setOrigin(0, 0.5);
            c.add(descTxt);

            const statusTxt = this.add.text(mX + mW - 16, ry + rowH / 2 - 13, '', {
                fontFamily: 'Outfit', fontSize: '11px', fontStyle: 'bold', resolution: 2,
            }).setOrigin(1, 0.5);
            c.add(statusTxt);

            const btnBg = this.add.graphics();
            c.add(btnBg);
            const btnTxt = this.add.text(mX + mW - 60, ry + rowH / 2 + 11, 'UNLOCK', {
                fontFamily: 'Outfit', fontSize: '10px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
            }).setOrigin(0.5);
            c.add(btnTxt);

            const btnZone = this.add.zone(mX + mW - 60, ry + rowH / 2 + 11, 80, 24).setInteractive({ useHandCursor: true });
            c.add(btnZone);
            btnZone.on('pointerdown', () => this._tryUnlockRegion(region));

            if (i < REGIONS.length - 1) {
                const div = this.add.graphics();
                div.lineStyle(1, 0x2A2A40, 0.6); div.lineBetween(mX + 16, ry + rowH, mX + mW - 16, ry + rowH);
                c.add(div);
            }

            this._regionRows.push({ region, rowBg, badge, badgeTxt, nameTxt, statusTxt, btnBg, btnTxt, btnZone, ry, rowH });
        });

        this._refreshRegionModal();
    }

    _refreshRegionModal() {
        if (this._regionStarText) this._regionStarText.setText(`⭐ Bạn đang có ${this._stars} Star`);

        for (const row of this._regionRows) {
            const { region, rowBg, badge, badgeTxt, statusTxt, btnBg, btnTxt, btnZone, ry, rowH } = row;
            const unlocked = region.id <= this._region;
            const isNext = region.id === this._region + 1;
            const canAfford = isNext && this._stars >= region.cost;

            rowBg.clear();
            if (region.id === this._region) {
                rowBg.fillStyle(0xF1C40F, 0.08);
                rowBg.fillRect(this._regionPanelX, ry, this._regionPanelW, rowH);
            }

            badge.clear();
            badge.fillStyle(unlocked ? region.bgColor : 0x22222E, 1);
            badge.fillCircle(badgeTxt.x, badgeTxt.y, 18);
            badge.lineStyle(2, unlocked ? 0xF1C40F : 0x44445A, 1);
            badge.strokeCircle(badgeTxt.x, badgeTxt.y, 18);
            badgeTxt.setText(unlocked ? `${region.id}` : '🔒');

            btnBg.clear();
            if (unlocked) {
                statusTxt.setText('✅ Đã unlock').setColor('#2ECC71');
                btnTxt.setVisible(false); btnZone.disableInteractive();
            } else if (canAfford) {
                statusTxt.setText(`Cần ${region.cost} ⭐`).setColor('#F1C40F');
                btnBg.fillStyle(0x27AE60, 1); btnBg.fillRoundedRect(btnZone.x - 40, btnZone.y - 12, 80, 24, 10);
                btnTxt.setVisible(true).setText('UNLOCK').setFontSize(10); btnZone.setInteractive({ useHandCursor: true });
            } else if (isNext) {
                statusTxt.setText(`Cần ${region.cost} ⭐`).setColor('#E74C3C');
                btnBg.fillStyle(0x3A3A4E, 1); btnBg.fillRoundedRect(btnZone.x - 40, btnZone.y - 12, 80, 24, 10);
                btnTxt.setVisible(true).setText(`THIẾU ${region.cost - this._stars}`).setFontSize(8);
                btnZone.disableInteractive();
            } else {
                statusTxt.setText('🔒 Khoá').setColor('#666680');
                btnTxt.setVisible(false); btnZone.disableInteractive();
            }
        }
    }

    _tryUnlockRegion(region) {
        const isNext = region.id === this._region + 1;
        if (!isNext || this._stars < region.cost) return;

        this._stars -= region.cost;
        this._region = region.id;
        this._saveStars(); this._saveRegion();

        let rewardMsg = '';
        if (region.reward) {
            if (region.reward.coin) { this._coins += region.reward.coin; this._saveCoins(); rewardMsg += `+${region.reward.coin} Coin `; }
            if (region.reward.booster) rewardMsg += '+1 Booster ngẫu nhiên ';
            if (region.reward.cosmetic) rewardMsg += '+Phụ kiện xe ';
            if (region.reward.boosterPack) rewardMsg += '+Booster Pack ';
        }

        window.SoundMgr?.boosterActivate();
        this._starsText?.setText(`${this._stars}`);
        this._coinsText?.setText(`${this._coins}`);
        this._drawHomeBackground(CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT, REGIONS[this._region - 1]);
        this._refreshRegionTrail();
        this._refreshRegionModal();
        this._showToast(`Mở khoá ${region.name}! ${rewardMsg.trim()}`);
    }

    _openRegionModal() {
        this._refreshRegionModal();
        const c = this._regionContainer;
        c.setVisible(true).setAlpha(0).setY(22);
        this.tweens.add({ targets: c, alpha: 1, y: 0, duration: 300, ease: 'Back.easeOut' });
    }

    _closeRegionModal() {
        const c = this._regionContainer;
        this.tweens.add({
            targets: c, alpha: 0, y: 16, duration: 180, ease: 'Quad.easeIn',
            onComplete: () => c.setVisible(false).setY(0),
        });
    }

    // ──────────────────────────────────────────────────────────
    // Customize Car Screen
    // ──────────────────────────────────────────────────────────
    _buildCustomizeModal(W, H, cx) {
        const mW = 360, mH = 560;
        const mX = cx - mW / 2, mY = Math.round(H / 2 - mH / 2);
        this._cmX = mX; this._cmY = mY; this._cmW = mW; this._cmH = mH;

        const c = this.add.container(0, 0).setDepth(80).setVisible(false);
        this._customizeContainer = c;

        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.75); dim.fillRect(0, 0, W, H);
        const dimZone = this.add.zone(cx, H / 2, W, H).setInteractive();
        dimZone.on('pointerdown', () => this._closeCustomizeModal());
        c.add(dim); c.add(dimZone);

        const blocker = this.add.zone(cx, mY + mH / 2, mW, mH).setInteractive();
        c.add(blocker);

        const panel = this.add.graphics();
        panel.fillStyle(0x16162A, 1); panel.fillRoundedRect(mX, mY, mW, mH, 20);
        panel.fillStyle(0x2A2A42, 1); panel.fillRoundedRect(mX, mY, mW, 168, { tl: 20, tr: 20, bl: 0, br: 0 });
        panel.lineStyle(1.5, 0x4A3CC8, 0.5); panel.strokeRoundedRect(mX, mY, mW, mH, 20);
        c.add(panel);

        c.add(this.add.text(cx, mY + 18, '🚗  TÙY CHỈNH XE', {
            fontFamily: 'Outfit', fontSize: '15px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5));

        const closeX = mX + mW - 26, closeY = mY + 18;
        c.add(this.add.text(closeX, closeY, '✕', { fontFamily: 'Outfit', fontSize: '17px', color: '#CCCCEE', resolution: 2 }).setOrigin(0.5));
        const closeZone = this.add.zone(closeX, closeY, 40, 40).setInteractive({ useHandCursor: true });
        c.add(closeZone);
        closeZone.on('pointerdown', () => this._closeCustomizeModal());

        // ── Rotating preview ───────────────────────────────────
        const pvCx = cx, pvCy = mY + 110;
        const pvWrap = this.add.container(pvCx, pvCy);
        const pvGfx = this.add.graphics();
        const pvDecal = this.add.text(0, 0, '', { fontSize: '20px', resolution: 2 }).setOrigin(0.5).setVisible(false);
        pvWrap.add([pvGfx, pvDecal]);
        c.add(pvWrap);
        this._cmPreviewGfx = pvGfx;
        this._cmPreviewDecal = pvDecal;
        this._cmPreviewWrap = pvWrap;
        this.tweens.add({
            targets: pvWrap, rotation: { from: -0.12, to: 0.12 },
            duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        // ── Tabs ─────────────────────────────────────────────────
        const tabDefs = [
            { key: 'bodyColor', label: 'Màu' },
            { key: 'wheel', label: 'Bánh xe' },
            { key: 'door', label: 'Cửa' },
            { key: 'decal', label: 'Decal' },
            { key: 'buyCar', label: 'Mua xe' },
        ];
        const tabY = mY + 188, tabW = mW / tabDefs.length;
        this._cmTabs = [];
        tabDefs.forEach((tab, i) => {
            const tx = mX + tabW * i + tabW / 2;
            const underline = this.add.graphics(); c.add(underline);
            const label = this.add.text(tx, tabY, tab.label, {
                fontFamily: 'Outfit', fontSize: '12px', fontStyle: 'bold', color: '#8888AA', resolution: 2,
            }).setOrigin(0.5); c.add(label);
            const zone = this.add.zone(tx, tabY, tabW, 32).setInteractive({ useHandCursor: true }); c.add(zone);
            zone.on('pointerdown', () => { window.SoundMgr?.buttonClick(); this._setCustomizeTab(tab.key); });
            this._cmTabs.push({ key: tab.key, x: tx, underline, label });
        });

        const divider = this.add.graphics();
        divider.lineStyle(1, 0x2A2A40, 0.8); divider.lineBetween(mX + 14, tabY + 18, mX + mW - 14, tabY + 18);
        c.add(divider);

        // ── Scrollable content area ──────────────────────────────
        const contentTop = tabY + 26, contentBottom = mY + mH - 56;
        this._cmContentTop = contentTop;
        this._cmContentH = contentBottom - contentTop;
        const content = this.add.container(0, 0);
        c.add(content);
        this._cmContent = content;

        const contentMaskShape = this.make.graphics({ x: 0, y: 0, add: false });
        contentMaskShape.fillRect(mX, contentTop, mW, this._cmContentH);
        content.setMask(contentMaskShape.createGeometryMask());
        this._cmContentMaskShape = contentMaskShape;

        // ── Footer confirm button ─────────────────────────────────
        const footY = mY + mH - 30;
        const footBg = this.add.graphics(); c.add(footBg);
        const footTxt = this.add.text(cx, footY, '', {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5); c.add(footTxt);
        const footZone = this.add.zone(cx, footY, mW - 32, 40).setInteractive({ useHandCursor: true }); c.add(footZone);
        footZone.on('pointerdown', () => this._confirmCustomizeChoice());
        this._cmFootBg = footBg; this._cmFootTxt = footTxt; this._cmFootZone = footZone;

        this._customizeActiveGroup = 'bodyColor';
        this._customizePendingValue = this._equippedParts.bodyColor;
    }

    _setCustomizeTab(key) {
        this._customizeActiveGroup = key;
        this._customizePendingValue = key === 'buyCar' ? null : (this._equippedParts[key] || CAR_PARTS_DEFAULT[key]);
        this._cmTabs.forEach(t => {
            const active = t.key === key;
            t.underline.clear();
            if (active) { t.underline.fillStyle(0x7B6CF6, 1); t.underline.fillRoundedRect(t.x - 26, this._cmTabs[0].label.y + 14, 52, 3, 2); }
            t.label.setColor(active ? '#FFFFFF' : '#8888AA');
        });
        this._renderCustomizePreview();
        this._renderCustomizeContent();
        this._renderCustomizeFooter();
    }

    _renderCustomizePreview() {
        const previewParts = { ...this._equippedParts };
        if (this._customizeActiveGroup !== 'buyCar') previewParts[this._customizeActiveGroup] = this._customizePendingValue;
        this._renderCarVisual(this._cmPreviewGfx, this._cmPreviewDecal, previewParts, 0, 0, 1.7);
    }

    _renderCustomizeContent() {
        const content = this._cmContent;
        content.removeAll(true);
        const mX = this._cmX, mW = this._cmW, top = this._cmContentTop;
        const group = this._customizeActiveGroup;

        if (group === 'buyCar') {
            CAR_CATALOG.forEach((car, i) => {
                const ry = top + i * 58 + 30;
                const owned = this._ownedCars.includes(car.id);
                const active = this._activeCar === car.id;

                const rowBg = this.add.graphics();
                rowBg.fillStyle(active ? 0x2A2A50 : 0x20202E, 1);
                rowBg.fillRoundedRect(mX + 14, ry - 26, mW - 28, 52, 12);
                content.add(rowBg);

                const iconG = this.add.graphics();
                this._drawToyCar(iconG, { ...CAR_PARTS_DEFAULT, bodyColor: car.bodyColor }, mX + 44, ry, 0.55);
                content.add(iconG);

                content.add(this.add.text(mX + 80, ry - 10, car.name, {
                    fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
                }).setOrigin(0, 0.5));
                content.add(this.add.text(mX + 80, ry + 10, owned ? (active ? 'Đang dùng' : 'Đã sở hữu') : `💰 ${car.cost}`, {
                    fontFamily: 'Outfit', fontSize: '11px', color: owned ? '#2ECC71' : '#F1C40F', resolution: 2,
                }).setOrigin(0, 0.5));

                const btnBg = this.add.graphics();
                const btnLabel = active ? 'ĐANG DÙNG' : (owned ? 'DÙNG' : 'MUA');
                btnBg.fillStyle(active ? 0x3A3A4E : 0x27AE60, 1);
                btnBg.fillRoundedRect(mX + mW - 86, ry - 14, 72, 28, 10);
                content.add(btnBg);
                content.add(this.add.text(mX + mW - 50, ry, btnLabel, {
                    fontFamily: 'Outfit', fontSize: '10px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
                }).setOrigin(0.5));

                if (!active) {
                    const z = this.add.zone(mX + mW - 50, ry, 72, 28).setInteractive({ useHandCursor: true });
                    content.add(z);
                    z.on('pointerdown', () => this._buyOrSelectCar(car));
                }
            });
            return;
        }

        const options = CAR_PARTS[group];
        const cols = 4, cellW = (mW - 28) / cols, cellH = 76;
        options.forEach((opt, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            const ox = mX + 14 + cellW * col + cellW / 2;
            const oy = top + 14 + row * cellH + cellH / 2;
            const owned = this._ownedParts[group]?.includes(opt.id);
            const selected = opt.id === this._customizePendingValue;

            const cellBg = this.add.graphics();
            cellBg.fillStyle(selected ? 0x3A2F66 : 0x20202E, 1);
            cellBg.fillRoundedRect(ox - cellW / 2 + 4, oy - cellH / 2 + 4, cellW - 8, cellH - 8, 10);
            if (selected) { cellBg.lineStyle(2, 0x7B6CF6, 1); cellBg.strokeRoundedRect(ox - cellW / 2 + 4, oy - cellH / 2 + 4, cellW - 8, cellH - 8, 10); }
            content.add(cellBg);

            if (group === 'bodyColor') {
                const swatchG = this.add.graphics();
                const colorData = COLORS[opt.id] || COLORS.red;
                swatchG.fillStyle(colorData.hex, 1); swatchG.fillCircle(ox, oy - 12, 16);
                swatchG.lineStyle(2, 0xFFFFFF, 0.4); swatchG.strokeCircle(ox, oy - 12, 16);
                content.add(swatchG);
            } else if (group === 'decal') {
                content.add(this.add.text(ox, oy - 12, opt.emoji || '🚫', { fontSize: '18px', resolution: 2 }).setOrigin(0.5));
            } else {
                content.add(this.add.text(ox, oy - 12, group === 'wheel' ? '⚙️' : '🚪', { fontSize: '18px', resolution: 2 }).setOrigin(0.5));
            }

            content.add(this.add.text(ox, oy + 12, opt.label, {
                fontFamily: 'Outfit', fontSize: '9px', color: '#AAAACC', resolution: 2,
            }).setOrigin(0.5));

            if (!owned) {
                content.add(this.add.text(ox, oy + 25, `💰${opt.cost}`, {
                    fontFamily: 'Outfit', fontSize: '8px', fontStyle: 'bold', color: '#F1C40F', resolution: 2,
                }).setOrigin(0.5));
            }

            const z = this.add.zone(ox, oy, cellW - 8, cellH - 8).setInteractive({ useHandCursor: true });
            content.add(z);
            z.on('pointerdown', () => {
                window.SoundMgr?.buttonClick();
                this._customizePendingValue = opt.id;
                this._renderCustomizePreview();
                this._renderCustomizeContent();
                this._renderCustomizeFooter();
            });
        });
    }

    _renderCustomizeFooter() {
        const group = this._customizeActiveGroup;
        if (group === 'buyCar') { this._cmFootBg.clear(); this._cmFootTxt.setText(''); this._cmFootZone.disableInteractive(); return; }

        const opt = CAR_PARTS[group].find(o => o.id === this._customizePendingValue);
        const owned = this._ownedParts[group]?.includes(this._customizePendingValue);
        const alreadyEquipped = this._equippedParts[group] === this._customizePendingValue;

        this._cmFootBg.clear();
        const w = this._cmW - 32, h = 40, x = CONFIG.GAME_WIDTH / 2, y = this._cmY + this._cmH - 30;

        if (alreadyEquipped) {
            this._cmFootBg.fillStyle(0x2A2A42, 1); this._cmFootBg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
            this._cmFootTxt.setText('✓  ĐÃ TRANG BỊ');
            this._cmFootZone.disableInteractive();
        } else if (owned) {
            this._cmFootBg.fillStyle(0x6C5CE7, 1); this._cmFootBg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
            this._cmFootTxt.setText('TRANG BỊ');
            this._cmFootZone.setInteractive({ useHandCursor: true });
        } else {
            const canAfford = this._coins >= (opt?.cost || 0);
            this._cmFootBg.fillStyle(canAfford ? 0x27AE60 : 0x3A3A4E, 1);
            this._cmFootBg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
            this._cmFootTxt.setText(canAfford ? `MUA & TRANG BỊ — 💰${opt.cost}` : `THIẾU 💰${opt.cost - this._coins}`);
            if (canAfford) this._cmFootZone.setInteractive({ useHandCursor: true });
            else this._cmFootZone.disableInteractive();
        }
    }

    _confirmCustomizeChoice() {
        const group = this._customizeActiveGroup;
        if (group === 'buyCar') return;

        const value = this._customizePendingValue;
        if (this._equippedParts[group] === value) return;

        const owned = this._ownedParts[group]?.includes(value);
        if (!owned) {
            const opt = CAR_PARTS[group].find(o => o.id === value);
            if (!opt || this._coins < opt.cost) return;
            this._coins -= opt.cost;
            this._saveCoins();
            this._ownedParts[group] = [...(this._ownedParts[group] || []), value];
            this._saveOwnedParts();
        }

        this._equippedParts[group] = value;
        this._saveEquippedParts();

        window.SoundMgr?.buttonClick();
        this._coinsText?.setText(`${this._coins}`);
        this._renderCarVisual(this._homeCarGfx, this._homeCarDecal, this._equippedCarParts(), this._homeCarCx, this._homeCarCy, 1.15);
        this._renderCustomizeContent();
        this._renderCustomizeFooter();
        this._showToast('Đã trang bị!');
    }

    _buyOrSelectCar(car) {
        const owned = this._ownedCars.includes(car.id);
        if (!owned) {
            if (this._coins < car.cost) { this._showToast('Không đủ Coin!'); return; }
            this._coins -= car.cost;
            this._saveCoins();
            this._ownedCars = [...this._ownedCars, car.id];
            this._saveOwnedCars();
        }

        this._activeCar = car.id;
        this._saveActiveCar();
        this._equippedParts.bodyColor = car.bodyColor;
        this._saveEquippedParts();

        window.SoundMgr?.buttonClick();
        this._coinsText?.setText(`${this._coins}`);
        this._renderCarVisual(this._homeCarGfx, this._homeCarDecal, this._equippedCarParts(), this._homeCarCx, this._homeCarCy, 1.15);
        this._renderCustomizePreview();
        this._renderCustomizeContent();
        this._showToast(owned ? `Đang dùng ${car.name}` : `Đã mua ${car.name}!`);
    }

    _openCustomizeModal() {
        const c = this._customizeContainer;
        this._setCustomizeTab('bodyColor');
        c.setVisible(true).setAlpha(0).setY(22);
        this.tweens.add({ targets: c, alpha: 1, y: 0, duration: 300, ease: 'Back.easeOut' });
    }

    _closeCustomizeModal() {
        const c = this._customizeContainer;
        this.tweens.add({
            targets: c, alpha: 0, y: 16, duration: 180, ease: 'Quad.easeIn',
            onComplete: () => c.setVisible(false).setY(0),
        });
    }

    // ──────────────────────────────────────────────────────────
    // Over Lives — shown when Heart = 0
    // ──────────────────────────────────────────────────────────
    _buildOverLivesModal(W, H, cx) {
        const mW = 300, mH = 320;
        const mX = cx - mW / 2, mY = Math.round(H / 2 - mH / 2);

        const c = this.add.container(0, 0).setDepth(90).setVisible(false);
        this._overLivesContainer = c;

        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.8); dim.fillRect(0, 0, W, H);
        c.add(dim);

        const blocker = this.add.zone(cx, mY + mH / 2, mW, mH).setInteractive(); c.add(blocker);

        const panel = this.add.graphics();
        panel.fillStyle(0x1A0E12, 1); panel.fillRoundedRect(mX, mY, mW, mH, 20);
        panel.fillStyle(0xC0392B, 1); panel.fillRoundedRect(mX, mY, mW, 6, { tl: 20, tr: 20, bl: 0, br: 0 });
        panel.lineStyle(2, 0xC0392B, 0.6); panel.strokeRoundedRect(mX, mY, mW, mH, 20);
        c.add(panel);

        c.add(this.add.text(cx, mY + 40, '💔', { fontSize: '34px', resolution: 2 }).setOrigin(0.5));
        c.add(this.add.text(cx, mY + 78, 'Hết Heart rồi!', {
            fontFamily: 'Outfit', fontSize: '18px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5));

        this._overLivesCountdown = this.add.text(cx, mY + 102, '', {
            fontFamily: 'Outfit', fontSize: '12px', color: '#FF8FA3', resolution: 2,
        }).setOrigin(0.5);
        c.add(this._overLivesCountdown);

        const makeOption = (y, label, sub, bgColor, onTap) => {
            const bg = this.add.graphics();
            bg.fillStyle(bgColor, 1); bg.fillRoundedRect(mX + 20, y - 24, mW - 40, 48, 14);
            c.add(bg);
            const lbl = this.add.text(mX + 36, y - 7, label, {
                fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
            }).setOrigin(0, 0.5);
            c.add(lbl);
            const subTxt = this.add.text(mX + 36, y + 11, sub, {
                fontFamily: 'Outfit', fontSize: '10px', color: '#DDDDEE', resolution: 2,
            }).setOrigin(0, 0.5);
            c.add(subTxt);
            const zone = this.add.zone(cx, y, mW - 40, 48).setInteractive({ useHandCursor: true });
            c.add(zone);
            this._addPress(zone, [bg, lbl, subTxt]);
            zone.on('pointerdown', onTap);
            return { bg, lbl, subTxt, zone };
        };

        makeOption(mY + 144, '📺  Xem quảng cáo', '+1 Heart miễn phí', 0x27AE60, () => {
            window.PlayerHearts?.add(1);
            window.SoundMgr?.buttonClick();
            this._syncHeartsUI();
            this._showToast('+1 Heart!');
            this._closeOverLivesModal();
        });

        const refillOpt = makeOption(mY + 200, '💰  Đổi Coin', '50 Coin → +1 Heart', 0x2980B9, () => {
            if (this._coins < 50) { this._showToast('Không đủ Coin!'); return; }
            this._coins -= 50; this._saveCoins();
            window.PlayerHearts?.add(1);
            window.SoundMgr?.buttonClick();
            this._coinsText?.setText(`${this._coins}`);
            this._syncHeartsUI();
            this._showToast('+1 Heart!');
            this._closeOverLivesModal();
        });
        this._overLivesRefillOpt = refillOpt;

        const fullOpt = makeOption(mY + 256, '💎  Làm đầy Heart', '150 Coin → Full 5 Heart', 0x8E44AD, () => {
            if (this._coins < 150) { this._showToast('Không đủ Coin!'); return; }
            this._coins -= 150; this._saveCoins();
            window.PlayerHearts?.refillFull();
            window.SoundMgr?.buttonClick();
            this._coinsText?.setText(`${this._coins}`);
            this._syncHeartsUI();
            this._showToast('Heart đã đầy!');
            this._closeOverLivesModal();
        });
        this._overLivesFullOpt = fullOpt;

        const closeX = mX + mW - 24, closeY = mY + 22;
        c.add(this.add.text(closeX, closeY, '✕', { fontFamily: 'Outfit', fontSize: '16px', color: '#CCCCEE', resolution: 2 }).setOrigin(0.5));
        const closeZone = this.add.zone(closeX, closeY, 40, 40).setInteractive({ useHandCursor: true });
        c.add(closeZone);
        closeZone.on('pointerdown', () => this._closeOverLivesModal());
    }

    /** Re-reads Heart balance into all on-screen displays (pill, countdown, gate state). */
    _syncHeartsUI() {
        this._hearts = window.PlayerHearts ? window.PlayerHearts.get() : this._hearts;
        this._heartsText?.setText(`${this._hearts}`);
    }

    _openOverLivesModal() {
        if (!this._overLivesContainer) return;
        const ms = window.PlayerHearts?.msUntilNext() ?? 0;
        const totalSec = Math.max(0, Math.ceil(ms / 1000));
        const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const ss = String(totalSec % 60).padStart(2, '0');
        this._overLivesCountdown?.setText(`Heart kế tiếp sau ${mm}:${ss}`);

        const c = this._overLivesContainer;
        c.setVisible(true).setAlpha(0).setY(22);
        this.tweens.add({ targets: c, alpha: 1, y: 0, duration: 300, ease: 'Back.easeOut' });
    }

    _closeOverLivesModal() {
        const c = this._overLivesContainer;
        this.tweens.add({
            targets: c, alpha: 0, y: 16, duration: 180, ease: 'Quad.easeIn',
            onComplete: () => c.setVisible(false).setY(0),
        });
    }

    // ──────────────────────────────────────────────────────────
    // Shop Screen
    // ──────────────────────────────────────────────────────────
    _buildShopModal(W, H, cx) {
        const mW = 360, mH = 520;
        const mX = cx - mW / 2, mY = Math.round(H / 2 - mH / 2);
        this._shopX = mX; this._shopY = mY; this._shopW = mW; this._shopH = mH;

        const c = this.add.container(0, 0).setDepth(85).setVisible(false);
        this._shopContainer = c;

        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.75); dim.fillRect(0, 0, W, H);
        const dimZone = this.add.zone(cx, H / 2, W, H).setInteractive();
        dimZone.on('pointerdown', () => this._closeShopModal());
        c.add(dim); c.add(dimZone);

        const blocker = this.add.zone(cx, mY + mH / 2, mW, mH).setInteractive(); c.add(blocker);

        const panel = this.add.graphics();
        panel.fillStyle(0x16162A, 1); panel.fillRoundedRect(mX, mY, mW, mH, 20);
        panel.fillStyle(0x27AE60, 1); panel.fillRoundedRect(mX, mY, mW, 50, { tl: 20, tr: 20, bl: 0, br: 0 });
        panel.lineStyle(1.5, 0x1E8449, 0.6); panel.strokeRoundedRect(mX, mY, mW, mH, 20);
        c.add(panel);

        c.add(this.add.text(cx, mY + 25, '🛒  SHOP', {
            fontFamily: 'Outfit', fontSize: '16px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5));

        const closeX = mX + mW - 26, closeY = mY + 25;
        c.add(this.add.text(closeX, closeY, '✕', { fontFamily: 'Outfit', fontSize: '17px', color: '#FFFFFF', resolution: 2 }).setOrigin(0.5));
        const closeZone = this.add.zone(closeX, closeY, 40, 40).setInteractive({ useHandCursor: true });
        c.add(closeZone);
        closeZone.on('pointerdown', () => this._closeShopModal());

        const tabDefs = [
            { key: 'noAds', label: 'No-Ads' },
            { key: 'bundle', label: 'Bundle' },
            { key: 'booster', label: 'Booster' },
            { key: 'gold', label: 'Gold' },
        ];
        const tabY = mY + 72, tabW = mW / tabDefs.length;
        this._shopTabs = [];
        tabDefs.forEach((tab, i) => {
            const tx = mX + tabW * i + tabW / 2;
            const underline = this.add.graphics(); c.add(underline);
            const label = this.add.text(tx, tabY, tab.label, {
                fontFamily: 'Outfit', fontSize: '12px', fontStyle: 'bold', color: '#8888AA', resolution: 2,
            }).setOrigin(0.5); c.add(label);
            const zone = this.add.zone(tx, tabY, tabW, 32).setInteractive({ useHandCursor: true }); c.add(zone);
            zone.on('pointerdown', () => { window.SoundMgr?.buttonClick(); this._setShopTab(tab.key); });
            this._shopTabs.push({ key: tab.key, x: tx, underline, label });
        });

        const divider = this.add.graphics();
        divider.lineStyle(1, 0x2A2A40, 0.8); divider.lineBetween(mX + 14, tabY + 18, mX + mW - 14, tabY + 18);
        c.add(divider);

        this._shopContentTop = tabY + 26;
        this._shopContentH = (mY + mH - 16) - this._shopContentTop;
        const content = this.add.container(0, 0);
        c.add(content);
        this._shopContent = content;

        const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
        maskShape.fillRect(mX, this._shopContentTop, mW, this._shopContentH);
        content.setMask(maskShape.createGeometryMask());
        this._shopContentMaskShape = maskShape;

        this._shopActiveTab = 'noAds';
    }

    _setShopTab(key) {
        this._shopActiveTab = key;
        this._shopTabs.forEach(t => {
            const active = t.key === key;
            t.underline.clear();
            if (active) { t.underline.fillStyle(0x27AE60, 1); t.underline.fillRoundedRect(t.x - 26, t.label.y + 14, 52, 3, 2); }
            t.label.setColor(active ? '#FFFFFF' : '#8888AA');
        });
        this._renderShopContent();
    }

    _isShopItemOwned(item) {
        if (item.flag) { try { return localStorage.getItem(item.flag) === '1'; } catch { return false; } }
        return false;
    }

    _renderShopContent() {
        const content = this._shopContent;
        content.removeAll(true);
        const mX = this._shopX, mW = this._shopW, top = this._shopContentTop;
        const items = _SHOP_TABS[this._shopActiveTab] || [];

        items.forEach((item, i) => {
            const ry = top + i * 76 + 38;
            const owned = this._isShopItemOwned(item);

            const rowBg = this.add.graphics();
            rowBg.fillStyle(0x20202E, 1);
            rowBg.fillRoundedRect(mX + 14, ry - 32, mW - 28, 64, 14);
            if (item.tag) { rowBg.lineStyle(1.5, 0xF1C40F, 0.8); rowBg.strokeRoundedRect(mX + 14, ry - 32, mW - 28, 64, 14); }
            content.add(rowBg);

            if (item.tag) {
                content.add(this.add.text(mX + mW - 24, ry - 32, item.tag, {
                    fontFamily: 'Outfit', fontSize: '8px', fontStyle: 'bold', color: '#1A1408',
                    backgroundColor: '#F1C40F', padding: { x: 5, y: 2 }, resolution: 2,
                }).setOrigin(1, 0.5));
            }

            content.add(this.add.text(mX + 30, ry - 14, item.name, {
                fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
            }).setOrigin(0, 0.5));

            const descParts = [];
            if (item.desc) descParts.push(item.desc);
            if (item.coin) descParts.push(`+${item.coin} Coin`);
            content.add(this.add.text(mX + 30, ry + 8, descParts.join(' · '), {
                fontFamily: 'Outfit', fontSize: '10px', color: '#9999BB', resolution: 2,
                wordWrap: { width: mW - 130 },
            }).setOrigin(0, 0.5));

            const btnBg = this.add.graphics();
            const priceLabel = owned ? 'ĐÃ MUA' : (item.isIAP ? item.price : `💰${item.cost}`);
            btnBg.fillStyle(owned ? 0x3A3A4E : 0x27AE60, 1);
            btnBg.fillRoundedRect(mX + mW - 96, ry - 16, 80, 32, 10);
            content.add(btnBg);
            content.add(this.add.text(mX + mW - 56, ry, priceLabel, {
                fontFamily: 'Outfit', fontSize: '11px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
            }).setOrigin(0.5));

            if (!owned) {
                const z = this.add.zone(mX + mW - 56, ry, 80, 32).setInteractive({ useHandCursor: true });
                content.add(z);
                z.on('pointerdown', () => this._buyShopItem(item));
            }
        });
    }

    _buyShopItem(item) {
        if (item.isIAP) {
            // Mocked IAP — no real billing SDK; grant the reward immediately.
            window.SoundMgr?.boosterActivate();
            if (item.coin) { this._coins += item.coin; this._saveCoins(); this._coinsText?.setText(`${this._coins}`); }
            if (item.flag) { try { localStorage.setItem(item.flag, '1'); } catch {} }
            this._renderShopContent();
            const lines = [];
            if (item.coin) lines.push(`+${item.coin} Coin`);
            if (item.flag) lines.push('Xoá Quảng Cáo');
            this._showBuySuccess(item.name, lines);
            return;
        }

        // Coin-priced Booster Pack — deducts Coin only; no persistent Booster
        // inventory exists yet, so this does not grant usable in-game Boosters.
        if (this._coins < item.cost) { this._showToast('Không đủ Coin!'); return; }
        this._coins -= item.cost;
        this._saveCoins();
        window.SoundMgr?.boosterActivate();
        this._coinsText?.setText(`${this._coins}`);
        this._renderShopContent();
        this._showBuySuccess(item.name, [item.desc]);
    }

    _openShopModal() {
        this._setShopTab(this._shopActiveTab || 'noAds');
        const c = this._shopContainer;
        c.setVisible(true).setAlpha(0).setY(22);
        this.tweens.add({ targets: c, alpha: 1, y: 0, duration: 300, ease: 'Back.easeOut' });
    }

    _closeShopModal() {
        const c = this._shopContainer;
        this.tweens.add({
            targets: c, alpha: 0, y: 16, duration: 180, ease: 'Quad.easeIn',
            onComplete: () => c.setVisible(false).setY(0),
        });
    }

    // ──────────────────────────────────────────────────────────
    // Buy Success popup
    // ──────────────────────────────────────────────────────────
    _buildBuySuccessModal(W, H, cx) {
        const mW = 280, mH = 240;
        const mY = Math.round(H / 2 - mH / 2);

        const c = this.add.container(0, 0).setDepth(95).setVisible(false);
        this._buySuccessContainer = c;

        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.78); dim.fillRect(0, 0, W, H);
        const dimZone = this.add.zone(cx, H / 2, W, H).setInteractive();
        dimZone.on('pointerdown', () => this._closeBuySuccessModal());
        c.add(dim); c.add(dimZone);

        const panel = this.add.graphics();
        panel.fillStyle(0x16162A, 1); panel.fillRoundedRect(cx - mW / 2, mY, mW, mH, 20);
        panel.lineStyle(2, 0xF1C40F, 0.7); panel.strokeRoundedRect(cx - mW / 2, mY, mW, mH, 20);
        c.add(panel);

        this._buySuccessBox = this.add.text(cx, mY + 50, '🎁', { fontSize: '38px', resolution: 2 }).setOrigin(0.5);
        c.add(this._buySuccessBox);

        c.add(this.add.text(cx, mY + 92, 'Mua thành công!', {
            fontFamily: 'Outfit', fontSize: '16px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5));

        this._buySuccessName = this.add.text(cx, mY + 114, '', {
            fontFamily: 'Outfit', fontSize: '12px', color: '#9999BB', resolution: 2,
        }).setOrigin(0.5);
        c.add(this._buySuccessName);

        this._buySuccessLines = this.add.text(cx, mY + 150, '', {
            fontFamily: 'Outfit', fontSize: '12px', fontStyle: 'bold', color: '#2ECC71', resolution: 2,
            align: 'center', lineSpacing: 4,
        }).setOrigin(0.5);
        c.add(this._buySuccessLines);

        const btnY = mY + mH - 32;
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x6C5CE7, 1); btnBg.fillRoundedRect(cx - 70, btnY - 18, 140, 36, 12);
        c.add(btnBg);
        const btnTxt = this.add.text(cx, btnY, 'TUYỆT VỜI', {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5);
        c.add(btnTxt);
        const btnZone = this.add.zone(cx, btnY, 140, 36).setInteractive({ useHandCursor: true });
        c.add(btnZone);
        this._addPress(btnZone, [btnBg, btnTxt]);
        btnZone.on('pointerdown', () => this._closeBuySuccessModal());
    }

    _showBuySuccess(itemName, rewardLines) {
        this._buySuccessName?.setText(itemName);
        this._buySuccessLines?.setText((rewardLines.filter(Boolean)).join('\n'));

        const c = this._buySuccessContainer;
        c.setVisible(true).setAlpha(0).setY(18);
        this.tweens.add({ targets: c, alpha: 1, y: 0, duration: 280, ease: 'Back.easeOut' });

        this._buySuccessBox?.setScale(0.4);
        this.tweens.add({ targets: this._buySuccessBox, scale: 1, duration: 420, ease: 'Back.easeOut', delay: 80 });
    }

    _closeBuySuccessModal() {
        window.SoundMgr?.buttonClick();
        const c = this._buySuccessContainer;
        this.tweens.add({
            targets: c, alpha: 0, y: 14, duration: 160, ease: 'Quad.easeIn',
            onComplete: () => c.setVisible(false).setY(0),
        });
    }

    // ──────────────────────────────────────────────────────────
    // Leaderboard
    // ──────────────────────────────────────────────────────────
    _buildLeaderboardModal(W, H, cx) {
        const mW = 340, mH = 560;
        const mX = cx - mW / 2, mY = Math.round(H / 2 - mH / 2);

        const c = this.add.container(0, 0).setDepth(85).setVisible(false);
        this._lbContainer = c;

        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.75); dim.fillRect(0, 0, W, H);
        const dimZone = this.add.zone(cx, H / 2, W, H).setInteractive();
        dimZone.on('pointerdown', () => this._closeLeaderboardModal());
        c.add(dim); c.add(dimZone);

        const blocker = this.add.zone(cx, mY + mH / 2, mW, mH).setInteractive(); c.add(blocker);

        const panel = this.add.graphics();
        panel.fillStyle(0x16162A, 1); panel.fillRoundedRect(mX, mY, mW, mH, 20);
        panel.fillStyle(0xF1C40F, 1); panel.fillRoundedRect(mX, mY, mW, 50, { tl: 20, tr: 20, bl: 0, br: 0 });
        panel.lineStyle(1.5, 0xB7950B, 0.6); panel.strokeRoundedRect(mX, mY, mW, mH, 20);
        c.add(panel);

        c.add(this.add.text(cx, mY + 25, '🏆  XẾP HẠNG', {
            fontFamily: 'Outfit', fontSize: '16px', fontStyle: 'bold', color: '#1A1408', resolution: 2,
        }).setOrigin(0.5));

        const closeX = mX + mW - 26, closeY = mY + 25;
        c.add(this.add.text(closeX, closeY, '✕', { fontFamily: 'Outfit', fontSize: '17px', color: '#1A1408', resolution: 2 }).setOrigin(0.5));
        const closeZone = this.add.zone(closeX, closeY, 40, 40).setInteractive({ useHandCursor: true });
        c.add(closeZone);
        closeZone.on('pointerdown', () => this._closeLeaderboardModal());

        const contentTop = mY + 62, contentH = mY + mH - 16 - contentTop;
        const content = this.add.container(0, 0);
        c.add(content);
        this._lbContent = content;
        this._lbX = mX; this._lbW = mW; this._lbContentTop = contentTop; this._lbContentH = contentH;

        const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
        maskShape.fillRect(mX, contentTop, mW, contentH);
        content.setMask(maskShape.createGeometryMask());
        this._lbMaskShape = maskShape;
    }

    _getLeaderboardRows() {
        const playerLevel = (LEVELS[this._savedLevel]?.id) || (this._savedLevel + 1);
        const rows = _LB_BOTS.map(b => ({ ...b, isPlayer: false }));
        rows.push({ name: this._pName, avatar: this._pAvatar, level: playerLevel, isPlayer: true });
        rows.sort((a, b) => b.level - a.level);
        return rows;
    }

    _renderLeaderboardContent() {
        const content = this._lbContent;
        content.removeAll(true);
        const mX = this._lbX, mW = this._lbW, top = this._lbContentTop;
        const rows = this._getLeaderboardRows();

        rows.forEach((row, i) => {
            const rank = i + 1;
            const ry = top + i * 54 + 28;
            const isTop3 = rank <= 3;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

            const rowBg = this.add.graphics();
            rowBg.fillStyle(row.isPlayer ? 0x3A2F66 : 0x20202E, 1);
            rowBg.fillRoundedRect(mX + 14, ry - 24, mW - 28, 48, 12);
            if (row.isPlayer) { rowBg.lineStyle(1.5, 0x7B6CF6, 1); rowBg.strokeRoundedRect(mX + 14, ry - 24, mW - 28, 48, 12); }
            content.add(rowBg);

            content.add(this.add.text(mX + 32, ry, medal || `${rank}`, {
                fontFamily: 'Outfit', fontSize: isTop3 ? '18px' : '13px', fontStyle: 'bold',
                color: isTop3 ? '#FFFFFF' : '#8888AA', resolution: 2,
            }).setOrigin(0.5));

            const avG = this.add.graphics();
            avG.fillStyle(_AVBG[row.avatar % _AVBG.length], 1); avG.fillCircle(mX + 64, ry, 16);
            content.add(avG);
            content.add(this.add.text(mX + 64, ry, _AVATARS[row.avatar % _AVATARS.length], { fontSize: '15px', resolution: 2 }).setOrigin(0.5));

            content.add(this.add.text(mX + 90, ry, row.name, {
                fontFamily: 'Outfit', fontSize: '12px', fontStyle: 'bold',
                color: row.isPlayer ? '#FFFFFF' : '#DDDDEE', resolution: 2,
            }).setOrigin(0, 0.5));

            content.add(this.add.text(mX + mW - 26, ry, `Lv.${row.level}`, {
                fontFamily: 'Outfit', fontSize: '12px', fontStyle: 'bold', color: '#F1C40F', resolution: 2,
            }).setOrigin(1, 0.5));

            const z = this.add.zone(mX + mW / 2, ry, mW - 28, 48).setInteractive({ useHandCursor: true });
            content.add(z);
            z.on('pointerdown', () => this._showToast(`${row.name} — Level ${row.level}`));
        });
    }

    _openLeaderboardModal() {
        this._renderLeaderboardContent();
        const c = this._lbContainer;
        c.setVisible(true).setAlpha(0).setY(22);
        this.tweens.add({ targets: c, alpha: 1, y: 0, duration: 300, ease: 'Back.easeOut' });
    }

    _closeLeaderboardModal() {
        const c = this._lbContainer;
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
