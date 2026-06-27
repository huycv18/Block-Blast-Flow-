// ============================================================
// UIScene — HUD overlay (runs parallel to GameScene)
// ============================================================

window.UIScene = class UIScene extends Phaser.Scene {
    constructor() {
        super('UIScene');
    }

    create(data) {
        this.gameScene = data?.gameScene || this.scene.get('GameScene');
        this._wasTargeting = false;
        this._activeBoosterKey = null;

        this.createHeader();
        this.createBoosterButtons();
        this.createConveyorBar();
        this.createModals();
        this.createSettingsModal();
        this.createLevelSelectModal();
        this.setupEventListeners();
    }

    // ─── Helpers ────────────────────────────────────────────────

    // Press feedback: alpha flash for all targets; also scale for Image objects.
    _addBtnPress(zone, targets) {
        const arr = Array.isArray(targets) ? targets : [targets];
        zone.on('pointerdown', () => {
            arr.forEach(t => {
                t.__pa = t.alpha;
                t.setAlpha(Math.max(0.08, t.alpha * 0.55));
                if (t.type === 'Image') {
                    t.__ps = { x: t.scaleX, y: t.scaleY };
                    t.setScale(t.scaleX * 0.88, t.scaleY * 0.88);
                }
            });
        });
        const restore = () => {
            arr.forEach(t => {
                if (t.__pa !== undefined) { t.setAlpha(t.__pa); delete t.__pa; }
                if (t.__ps) { t.setScale(t.__ps.x, t.__ps.y); delete t.__ps; }
            });
        };
        zone.on('pointerup', restore);
        zone.on('pointerout', restore);
    }

    // Slide up + fade in.
    _openModal(container) {
        container.setVisible(true).setAlpha(0).setY(28);
        this.tweens.add({ targets: container, alpha: 1, y: 0, duration: 300, ease: 'Back.easeOut' });
    }

    // Fade + slide down, then hide. Calls onDone when complete.
    _closeModal(container, onDone) {
        this.tweens.add({
            targets: container, alpha: 0, y: 18, duration: 180, ease: 'Quad.easeIn',
            onComplete: () => {
                container.setVisible(false).setY(0);
                if (onDone) onDone();
            },
        });
    }

    // ─── Header ─────────────────────────────────────────────────

    createHeader() {
        const W = CONFIG.GAME_WIDTH;
        const H = CONFIG.HEADER_HEIGHT;

        // Background
        const bg = this.add.graphics();
        bg.fillStyle(0x16162A, 1);
        bg.fillRect(0, 0, W, H);
        bg.lineStyle(1, 0x44445A, 0.6);
        bg.lineBetween(0, H, W, H);

        // Settings button
        const settingsBtn = this.add.image(28, H / 2, 'settings_icon')
            .setInteractive({ useHandCursor: true }).setDepth(101);
        settingsBtn.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            this.openSettingsModal();
        });
        this._addBtnPress(settingsBtn, settingsBtn);

        // Level select button
        const lvlX = 66;
        const lvlBtnBg = this.add.graphics().setDepth(100);
        lvlBtnBg.fillStyle(THEME.BOOSTER_BG, 1);
        lvlBtnBg.fillRoundedRect(lvlX - 15, H / 2 - 13, 30, 26, 7);
        const lvlIcon = this.add.text(lvlX, H / 2, '📋', {
            fontSize: '15px', resolution: 2,
        }).setOrigin(0.5).setDepth(101);
        const lvlZone = this.add.zone(lvlX, H / 2, 30, 26)
            .setInteractive({ useHandCursor: true }).setDepth(102);
        lvlZone.on('pointerdown', () => { window.SoundMgr?.buttonClick(); this.openLevelSelect(); });
        this._addBtnPress(lvlZone, [lvlBtnBg, lvlIcon]);

        // Mute button
        const muteX = 106;
        const muteBtnBg = this.add.graphics().setDepth(100);
        muteBtnBg.fillStyle(THEME.BOOSTER_BG, 1);
        muteBtnBg.fillRoundedRect(muteX - 15, H / 2 - 13, 30, 26, 7);
        this.muteBtnIcon = this.add.text(muteX, H / 2, window.SoundMgr?.muted ? '🔇' : '🔊', {
            fontSize: '14px', resolution: 2,
        }).setOrigin(0.5).setDepth(101);
        const muteZone = this.add.zone(muteX, H / 2, 30, 26)
            .setInteractive({ useHandCursor: true }).setDepth(102);
        muteZone.on('pointerdown', () => {
            const muted = window.SoundMgr?.toggleMute();
            if (this.muteBtnIcon) this.muteBtnIcon.setText(muted ? '🔇' : '🔊');
            if (!muted) window.SoundMgr?.buttonClick();
        });
        this._addBtnPress(muteZone, [muteBtnBg, this.muteBtnIcon]);

        // Level info (center)
        const levelData = LEVELS[this.gameScene.currentLevel];
        const difficulty = levelData?.difficulty || 'Tutorial';
        const diffHex = { Tutorial: '#2ECC71', Easy: '#3498DB', Normal: '#F1C40F', Hard: '#E74C3C' }[difficulty] || '#AAAACC';

        this.add.text(W / 2, H / 2 - 9, difficulty.toUpperCase(), {
            fontFamily: 'Outfit', fontSize: '9px', fontStyle: 'bold',
            color: diffHex, resolution: 2,
        }).setOrigin(0.5).setDepth(101);

        const levelBadge = this.add.graphics().setDepth(100);
        levelBadge.fillStyle(THEME.BOOSTER_BG, 1);
        levelBadge.fillRoundedRect(W / 2 - 40, H / 2 + 1, 80, 22, 11);

        this.add.text(W / 2, H / 2 + 12, `Level ${levelData?.id || 1}`, {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5).setDepth(101);

        // Coin display (right)
        const coinPill = this.add.graphics().setDepth(100);
        coinPill.fillStyle(0x221E14, 1);
        coinPill.fillRoundedRect(W - 104, H / 2 - 13, 76, 26, 13);
        coinPill.lineStyle(1, 0xAA8800, 0.5);
        coinPill.strokeRoundedRect(W - 104, H / 2 - 13, 76, 26, 13);

        this.add.image(W - 89, H / 2, 'coin_icon').setDepth(101);
        this.add.text(W - 73, H / 2, '1200', {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold',
            color: '#F1C40F', resolution: 2,
        }).setOrigin(0, 0.5).setDepth(101);

        const plusBg = this.add.graphics().setDepth(100);
        plusBg.fillStyle(THEME.SUCCESS_GREEN, 1);
        plusBg.fillCircle(W - 16, H / 2, 10);
        this.add.text(W - 16, H / 2, '+', {
            fontFamily: 'Outfit', fontSize: '16px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5).setDepth(101);
    }

    // ─── Boosters ───────────────────────────────────────────────

    createBoosterButtons() {
        const y = CONFIG.BOOSTER_AREA_Y + CONFIG.BOOSTER_BTN_SIZE / 2;
        const spacing = 70;
        const startX = CONFIG.GAME_WIDTH / 2 - spacing;
        const size = CONFIG.BOOSTER_BTN_SIZE;

        this.boosterBtns = {};

        const defs = [
            { key: 'magnet',   icon: '🧲', x: startX },
            { key: 'shuffle',  icon: '🔀', x: startX + spacing },
            { key: 'paintGun', icon: '🎨', x: startX + spacing * 2 },
        ];

        for (const b of defs) {
            const bg = this.add.image(b.x, y, 'booster_bg').setDepth(100);
            bg.setInteractive({ useHandCursor: true });

            const icon = this.add.text(b.x, y - 3, b.icon, {
                fontSize: '22px', resolution: 2,
            }).setOrigin(0.5).setDepth(101);

            const count = this.gameScene.boosterManager?.getCount(b.key) || 0;
            const badge = this.add.text(b.x + size / 2 - 6, y + size / 2 - 8, `${count}`, {
                fontFamily: 'Outfit', fontSize: '11px', fontStyle: 'bold',
                color: '#FFFFFF',
                backgroundColor: count > 0 ? '#E74C3C' : '#555566',
                padding: { x: 3, y: 1 }, resolution: 2,
            }).setOrigin(0.5).setDepth(102);

            const baseAlpha = count > 0 ? 1 : 0.4;
            if (count === 0) { bg.setAlpha(0.4); icon.setAlpha(0.4); }

            bg.on('pointerdown', () => this.onBoosterTap(b.key));
            this._addBtnPress(bg, [bg, icon]);

            this.boosterBtns[b.key] = { bg, badge, icon, _baseAlpha: baseAlpha };
        }
    }

    onBoosterTap(key) {
        const gs = this.gameScene;
        if (!gs || gs.gameState.isInputLocked()) return;
        window.SoundMgr?.boosterActivate();
        if (key === 'magnet') gs.boosterManager.activateMagnet(gs.board);
        else if (key === 'shuffle') gs.boosterManager.activateShuffle(gs.board, gs.carManager);
        else if (key === 'paintGun') gs.boosterManager.activatePaintGun(gs.board);
    }

    // Called from update() to sync booster visual states with targeting mode.
    _updateBoosterStates() {
        const gs = this.gameScene;
        if (!gs?.boosterManager || !this.boosterBtns) return;
        const isTargeting = gs.boosterManager.isTargeting?.() ?? false;
        const activeKey = isTargeting ? (gs.boosterManager.getActiveBooster?.() ?? null) : null;

        if (isTargeting === this._wasTargeting && activeKey === this._activeBoosterKey) return;
        this._wasTargeting = isTargeting;
        this._activeBoosterKey = activeKey;

        for (const [key, btn] of Object.entries(this.boosterBtns)) {
            this.tweens.killTweensOf(btn.bg);
            if (!isTargeting) {
                btn.bg.clearTint();
                btn.bg.setAlpha(btn._baseAlpha ?? 1);
                btn.icon?.setAlpha(btn._baseAlpha ?? 1);
            } else if (key === activeKey) {
                btn.bg.setTint(0xFFCC66);
                btn.bg.setAlpha(1);
                btn.icon?.setAlpha(1);
                this.tweens.add({
                    targets: btn.bg, alpha: { from: 0.75, to: 1 },
                    duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            } else {
                btn.bg.clearTint();
                btn.bg.setAlpha(0.28);
                btn.icon?.setAlpha(0.28);
            }
        }
    }

    // ─── Conveyor Bar ───────────────────────────────────────────

    createConveyorBar() {
        const barX = 55;
        const barY = CONFIG.CONVEYOR_CENTER_Y + CONFIG.CONVEYOR_HEIGHT / 2 + 8;
        const barW = CONFIG.GAME_WIDTH - 110;
        const barH = 8;

        const bgG = this.add.graphics().setDepth(100);
        bgG.fillStyle(0x0F0F1A, 1);
        bgG.fillRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, 5);
        bgG.fillStyle(0x1E1E2E, 1);
        bgG.fillRoundedRect(barX, barY, barW, barH, 4);
        this.convBarBg = bgG;

        this.convBarFill = this.add.graphics().setDepth(101);

        this._barX = barX;
        this._barY = barY;
        this._barW = barW;
        this._barH = barH;
    }

    updateConveyorBar() {
        if (!this.gameScene?.conveyor) return;
        const pct = this.gameScene.conveyor.getLoadPercent();
        const fillW = Math.max(0, this._barW * Math.min(pct, 1));
        let color = THEME.SUCCESS_GREEN;
        if (pct >= CONFIG.CONV_DANGER) color = THEME.DANGER_RED;
        else if (pct >= CONFIG.CONV_WARNING) color = THEME.WARNING_ORANGE;
        this.convBarFill.clear();
        if (fillW > 0) {
            this.convBarFill.fillStyle(color, 1);
            this.convBarFill.fillRoundedRect(this._barX, this._barY, fillW, this._barH, 4);
        }
    }

    // ─── Modals (Win / Lose) ────────────────────────────────────

    createModals() {
        this.winModal  = this._buildWinModal();
        this.winModal.container.setVisible(false);

        this.loseModal = this._buildLoseModal();
        this.loseModal.container.setVisible(false);

        // Cleanup banner
        this.cleanupText = this.add.text(
            CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT / 2 - 50,
            '⚡ Clearing!', {
                fontFamily: 'Outfit', fontSize: '28px', fontStyle: 'bold',
                color: '#F1C40F', stroke: '#2D2D3D', strokeThickness: 4, resolution: 2,
            }
        ).setOrigin(0.5).setDepth(200).setVisible(false);
    }

    _buildWinModal() {
        const cx = CONFIG.GAME_WIDTH / 2;
        const cy = CONFIG.GAME_HEIGHT / 2;
        const pw = 340, ph = 280;
        const pLeft = cx - pw / 2, pTop = cy - ph / 2;

        const container = this.add.container(0, 0).setDepth(500);

        // Dim overlay
        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.72);
        dim.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
        container.add(dim);

        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1C1A2E, 1);
        panel.fillRoundedRect(pLeft, pTop, pw, ph, 20);
        panel.lineStyle(2, 0x7B6CF6, 0.9);
        panel.strokeRoundedRect(pLeft, pTop, pw, ph, 20);
        // Accent stripe on top
        panel.fillStyle(0x7B6CF6, 1);
        panel.fillRoundedRect(pLeft, pTop, pw, 5, { tl: 20, tr: 20, bl: 0, br: 0 });
        container.add(panel);

        // Pre-built stars (shown + animated when win triggers)
        this._winStars = [];
        const starOffsets = [-56, 0, 56];
        for (let i = 0; i < 3; i++) {
            const star = this.add.text(cx + starOffsets[i], pTop + 66, '⭐', {
                fontSize: '32px', resolution: 2,
            }).setOrigin(0.5).setAlpha(0).setScale(0.2);
            container.add(star);
            this._winStars.push(star);
        }

        // Title
        container.add(this.add.text(cx, pTop + 118, 'Level Complete!', {
            fontFamily: 'Outfit', fontSize: '26px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5));

        // Subtitle
        container.add(this.add.text(cx, pTop + 153, 'Tuyệt vời! Bạn đã hoàn thành màn chơi.', {
            fontFamily: 'Outfit', fontSize: '12px', color: '#8888AA', resolution: 2,
        }).setOrigin(0.5));

        // Next Level button (accent purple)
        const btnY = pTop + ph - 56;
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x6C5CE7, 1);
        btnBg.fillRoundedRect(cx - 115, btnY - 22, 230, 44, 12);
        container.add(btnBg);

        const btnText = this.add.text(cx, btnY, '▶   Next Level', {
            fontFamily: 'Outfit', fontSize: '16px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5);
        container.add(btnText);

        const btnZone = this.add.zone(cx, btnY, 230, 44).setInteractive({ useHandCursor: true });
        btnZone.on('pointerdown', () => { window.SoundMgr?.buttonClick(); this.gameScene.nextLevel(); });
        this._addBtnPress(btnZone, [btnBg, btnText]);
        container.add(btnZone);

        return { container };
    }

    _buildLoseModal() {
        const cx = CONFIG.GAME_WIDTH / 2;
        const cy = CONFIG.GAME_HEIGHT / 2;
        const pw = 320, ph = 248;
        const pLeft = cx - pw / 2, pTop = cy - ph / 2;

        const container = this.add.container(0, 0).setDepth(500);

        // Dim overlay (darker for lose mood)
        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.8);
        dim.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
        container.add(dim);

        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A1216, 1);
        panel.fillRoundedRect(pLeft, pTop, pw, ph, 20);
        panel.lineStyle(2, 0xC0392B, 0.7);
        panel.strokeRoundedRect(pLeft, pTop, pw, ph, 20);
        panel.fillStyle(0xC0392B, 1);
        panel.fillRoundedRect(pLeft, pTop, pw, 5, { tl: 20, tr: 20, bl: 0, br: 0 });
        container.add(panel);

        // Icon + title
        container.add(this.add.text(cx, pTop + 56, '😔', {
            fontSize: '32px', resolution: 2,
        }).setOrigin(0.5));
        container.add(this.add.text(cx, pTop + 100, 'Game Over', {
            fontFamily: 'Outfit', fontSize: '24px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5));
        container.add(this.add.text(cx, pTop + 130, 'Hãy thử lại để giải màn này!', {
            fontFamily: 'Outfit', fontSize: '12px', color: '#886688', resolution: 2,
        }).setOrigin(0.5));

        // Revive button (primary — purple)
        const reviveY = pTop + ph - 86;
        const reviveBg = this.add.graphics();
        reviveBg.fillStyle(0x8E44AD, 1);
        reviveBg.fillRoundedRect(cx - 105, reviveY - 21, 210, 42, 11);
        container.add(reviveBg);
        const reviveText = this.add.text(cx, reviveY, '💖   Hồi sinh', {
            fontFamily: 'Outfit', fontSize: '15px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5);
        container.add(reviveText);
        const reviveZone = this.add.zone(cx, reviveY, 210, 42).setInteractive({ useHandCursor: true });
        reviveZone.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            this.gameScene.revive();
            this.loseModal.container.setVisible(false);
        });
        this._addBtnPress(reviveZone, [reviveBg, reviveText]);
        container.add(reviveZone);

        // Retry button (secondary — outlined)
        const retryY = pTop + ph - 36;
        const retryBg = this.add.graphics();
        retryBg.lineStyle(2, 0x555566, 1);
        retryBg.strokeRoundedRect(cx - 90, retryY - 18, 180, 36, 10);
        container.add(retryBg);
        const retryText = this.add.text(cx, retryY, '🔄   Thử lại', {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold',
            color: '#9999BB', resolution: 2,
        }).setOrigin(0.5);
        container.add(retryText);
        const retryZone = this.add.zone(cx, retryY, 180, 36).setInteractive({ useHandCursor: true });
        retryZone.on('pointerdown', () => { window.SoundMgr?.buttonClick(); this.gameScene.retryLevel(); });
        this._addBtnPress(retryZone, [retryText]);
        container.add(retryZone);

        return { container };
    }

    _showWinModal() {
        // Reset stars
        this._winStars.forEach(s => { s.setAlpha(0); s.setScale(0.2); });
        this._openModal(this.winModal.container);
        // Stagger star pop-in after modal lands
        this._winStars.forEach((s, i) => {
            this.time.delayedCall(320 + i * 160, () => {
                this.tweens.add({
                    targets: s, alpha: 1, scaleX: 1, scaleY: 1,
                    duration: 300, ease: 'Back.easeOut',
                });
                window.SoundMgr?.buttonClick?.();
            });
        });
    }

    // ─── Settings Modal ─────────────────────────────────────────

    openSettingsModal() {
        if (!this.settingsModal) return;
        this._openModal(this.settingsModal.container);
    }

    createSettingsModal() {
        const cx = CONFIG.GAME_WIDTH / 2;
        const cy = CONFIG.GAME_HEIGHT / 2;
        const pw = 280, ph = 190;
        const pLeft = cx - pw / 2, pTop = cy - ph / 2;

        const container = this.add.container(0, 0).setDepth(600).setVisible(false);

        // Dim
        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.65);
        dim.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
        container.add(dim);

        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1E1E2E, 1);
        panel.fillRoundedRect(pLeft, pTop, pw, ph, 16);
        panel.lineStyle(2, THEME.UI_PANEL_BORDER, 1);
        panel.strokeRoundedRect(pLeft, pTop, pw, ph, 16);
        container.add(panel);

        // Title
        container.add(this.add.text(cx, pTop + 30, '⚙️  Tùy chọn', {
            fontFamily: 'Outfit', fontSize: '18px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5));

        // Divider
        const divider = this.add.graphics();
        divider.lineStyle(1, THEME.UI_PANEL_BORDER, 0.5);
        divider.lineBetween(pLeft + 20, pTop + 54, pLeft + pw - 20, pTop + 54);
        container.add(divider);

        // Close button
        const clX = pLeft + pw - 22, clY = pTop + 22;
        const closeBg = this.add.graphics();
        closeBg.fillStyle(0x3A3A4E, 1);
        closeBg.fillCircle(clX, clY, 13);
        const closeText = this.add.text(clX, clY, '✕', {
            fontFamily: 'Outfit', fontSize: '13px', color: '#CCCCDD', resolution: 2,
        }).setOrigin(0.5);
        const closeZone = this.add.zone(clX, clY, 28, 28).setInteractive({ useHandCursor: true });
        closeZone.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            this._closeModal(container);
        });
        this._addBtnPress(closeZone, [closeBg, closeText]);
        container.add(closeBg);
        container.add(closeText);
        container.add(closeZone);

        // Restart button
        const btnY = pTop + 118;
        const restartBg = this.add.graphics();
        restartBg.fillStyle(0xE67E22, 1);
        restartBg.fillRoundedRect(cx - 100, btnY - 22, 200, 44, 12);
        const restartText = this.add.text(cx, btnY, '🔄  Chơi lại màn này', {
            fontFamily: 'Outfit', fontSize: '14px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5);
        const restartZone = this.add.zone(cx, btnY, 200, 44).setInteractive({ useHandCursor: true });
        restartZone.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            this._closeModal(container, () => this.gameScene.retryLevel());
        });
        this._addBtnPress(restartZone, [restartBg, restartText]);
        container.add(restartBg);
        container.add(restartText);
        container.add(restartZone);

        this.settingsModal = { container };
    }

    // ─── Level Select ────────────────────────────────────────────

    openLevelSelect() {
        if (!this.levelSelectModal) return;
        const currentLevel = this.gameScene?.currentLevel || 0;
        this.levelSelectModal.setPage(Math.floor(currentLevel / 6));
        this._openModal(this.levelSelectModal.container);
    }

    createLevelSelectModal() {
        const LEVELS_PER_PAGE = 6;
        let currentPage = 0;
        let cardItems = [];

        const cx = CONFIG.GAME_WIDTH / 2;
        const cy = CONFIG.GAME_HEIGHT / 2;
        const pw = 340, ph = 460;
        const pLeft = cx - pw / 2, pTop = cy - ph / 2;

        const container = this.add.container(0, 0).setDepth(600).setVisible(false);

        // Dim overlay
        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.75);
        dim.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
        container.add(dim);

        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1E1E2E, 1);
        panel.fillRoundedRect(pLeft, pTop, pw, ph, 18);
        panel.lineStyle(2, THEME.UI_PANEL_BORDER, 1);
        panel.strokeRoundedRect(pLeft, pTop, pw, ph, 18);
        container.add(panel);

        // Title
        container.add(this.add.text(cx, pTop + 28, '🗺  Chọn Level', {
            fontFamily: 'Outfit', fontSize: '19px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5));

        // Close button
        const clX = pLeft + pw - 24, clY = pTop + 24;
        const closeBg2 = this.add.graphics();
        closeBg2.fillStyle(0x3A3A4E, 1);
        closeBg2.fillCircle(clX, clY, 13);
        const closeText2 = this.add.text(clX, clY, '✕', {
            fontFamily: 'Outfit', fontSize: '14px', color: '#CCCCDD', resolution: 2,
        }).setOrigin(0.5);
        const closeZone2 = this.add.zone(clX, clY, 28, 28).setInteractive({ useHandCursor: true });
        closeZone2.on('pointerdown', () => this._closeModal(container));
        this._addBtnPress(closeZone2, [closeBg2, closeText2]);
        container.add(closeBg2);
        container.add(closeText2);
        container.add(closeZone2);

        // Pagination
        const pageY = pTop + ph - 30;
        const pageText = this.add.text(cx, pageY, '', {
            fontFamily: 'Outfit', fontSize: '12px', color: '#666677', resolution: 2,
        }).setOrigin(0.5);
        container.add(pageText);

        const prevText = this.add.text(pLeft + 44, pageY, '◀ Prev', {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: '#7B6CF6', resolution: 2,
        }).setOrigin(0.5);
        const prevZone = this.add.zone(pLeft + 44, pageY, 68, 30).setInteractive({ useHandCursor: true });
        prevZone.on('pointerdown', () => { if (currentPage > 0) { currentPage--; buildPage(currentPage); } });
        this._addBtnPress(prevZone, prevText);
        container.add(prevText);
        container.add(prevZone);

        const nextText = this.add.text(pLeft + pw - 44, pageY, 'Next ▶', {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: '#7B6CF6', resolution: 2,
        }).setOrigin(0.5);
        const nextZone = this.add.zone(pLeft + pw - 44, pageY, 68, 30).setInteractive({ useHandCursor: true });
        nextZone.on('pointerdown', () => {
            const total = Math.ceil((window.LEVELS || []).length / LEVELS_PER_PAGE);
            if (currentPage < total - 1) { currentPage++; buildPage(currentPage); }
        });
        this._addBtnPress(nextZone, nextText);
        container.add(nextText);
        container.add(nextZone);

        // Card layout
        const cardAreaTop  = pTop + 55;
        const cardAreaLeft = pLeft + 15;
        const cardW = (pw - 30 - 10) / 2;
        const cardH = 82;
        const DIFF_BG  = { Tutorial: 0x1A7A4A, Easy: 0x1A487A, Normal: 0x7A6A1A, Hard: 0x7A1A1A };
        const DIFF_HEX = { Tutorial: '#2ECC71', Easy: '#3498DB', Normal: '#F1C40F', Hard: '#E74C3C' };

        const buildPage = (page) => {
            cardItems.forEach(item => container.remove(item, true));
            cardItems = [];

            const levels = window.LEVELS || [];
            const total = Math.ceil(levels.length / LEVELS_PER_PAGE);
            pageText.setText(total > 1 ? `${page + 1} / ${total}` : '');
            prevText.setAlpha(page > 0 ? 1 : 0.3);
            nextText.setAlpha(page < total - 1 ? 1 : 0.3);

            const startIdx = page * LEVELS_PER_PAGE;
            const endIdx   = Math.min(startIdx + LEVELS_PER_PAGE, levels.length);

            for (let i = startIdx; i < endIdx; i++) {
                const level = levels[i];
                const local = i - startIdx;
                const col   = local % 2;
                const row   = Math.floor(local / 2);
                const x = cardAreaLeft + col * (cardW + 10);
                const y = cardAreaTop  + row * (cardH + 10);
                const isCurrent = i === (this.gameScene?.currentLevel || 0);
                const diffBgColor  = DIFF_BG[level.difficulty]  || 0x2A2A3A;
                const diffHexColor = DIFF_HEX[level.difficulty] || '#AAAACC';

                // Card background
                const cardBg = this.add.graphics();
                cardBg.fillStyle(isCurrent ? 0x2C2A48 : 0x22222E, 1);
                cardBg.fillRoundedRect(x, y, cardW, cardH, 10);
                if (isCurrent) {
                    cardBg.lineStyle(2, 0x7B6CF6, 1);
                    cardBg.strokeRoundedRect(x, y, cardW, cardH, 10);
                }
                // Difficulty colour stripe (left edge, 5px wide)
                cardBg.fillStyle(diffBgColor, 1);
                cardBg.fillRoundedRect(x, y, 5, cardH, { tl: 10, tr: 0, bl: 10, br: 0 });
                container.add(cardBg);
                cardItems.push(cardBg);

                // If current, pulse the card border
                if (isCurrent) {
                    this.tweens.add({
                        targets: cardBg, alpha: { from: 0.65, to: 1 },
                        duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    });
                }

                const numTxt = this.add.text(x + cardW / 2 + 3, y + 26, `Level ${level.id}`, {
                    fontFamily: 'Outfit', fontSize: '15px', fontStyle: 'bold',
                    color: isCurrent ? '#C8C0FF' : '#FFFFFF', resolution: 2,
                }).setOrigin(0.5);
                container.add(numTxt);
                cardItems.push(numTxt);

                const dTxt = this.add.text(x + cardW / 2 + 3, y + 50, level.difficulty, {
                    fontFamily: 'Outfit', fontSize: '11px', fontStyle: 'bold',
                    color: diffHexColor, resolution: 2,
                }).setOrigin(0.5);
                container.add(dTxt);
                cardItems.push(dTxt);

                // Star indicators (current = 1 star lit, else empty)
                const starStr   = isCurrent ? '★☆☆' : '☆☆☆';
                const starColor = isCurrent ? '#F1C40F' : '#33334A';
                const starTxt = this.add.text(x + cardW / 2 + 3, y + cardH - 14, starStr, {
                    fontFamily: 'Outfit', fontSize: '13px', color: starColor, resolution: 2,
                }).setOrigin(0.5);
                container.add(starTxt);
                cardItems.push(starTxt);

                const zone = this.add.zone(x + cardW / 2, y + cardH / 2, cardW, cardH)
                    .setInteractive({ useHandCursor: true });
                const idx = i;
                zone.on('pointerdown', () => {
                    this._closeModal(container, () => this.gameScene.selectLevel(idx));
                });
                this._addBtnPress(zone, cardBg);
                container.add(zone);
                cardItems.push(zone);
            }
        };

        buildPage(0);

        this.levelSelectModal = {
            container,
            setPage:  (page) => { currentPage = page; buildPage(page); },
            rebuild:  () => buildPage(currentPage),
        };
    }

    // ─── Event Listeners ────────────────────────────────────────

    setupEventListeners() {
        const gs = this.gameScene;
        if (!gs) return;

        gs.events.on('stateChange', (newState) => {
            if (newState === 'WIN') {
                this.cleanupText.setVisible(false);
                this.tweens.killTweensOf(this.cleanupText);
                this._showWinModal();
            } else if (newState === 'LOSE') {
                this._openModal(this.loseModal.container);
            } else if (newState === 'CLEANUP') {
                this.cleanupText.setVisible(true);
                this.tweens.add({
                    targets: this.cleanupText,
                    scale: { from: 0.8, to: 1.1 },
                    alpha: { from: 0.7, to: 1 },
                    duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            }
        });

        gs.events.on('boosterUsed', (type, remaining) => {
            const btn = this.boosterBtns[type];
            if (!btn) return;
            btn.badge.setText(`${remaining}`);
            btn.badge.setStyle({ backgroundColor: remaining > 0 ? '#E74C3C' : '#555566' });
            const base = remaining > 0 ? 1 : 0.4;
            btn._baseAlpha = base;
            btn.bg.setAlpha(base);
            btn.icon?.setAlpha(base);
        });
    }

    update() {
        this.updateConveyorBar();
        this._updateBoosterStates();
        const pct = this.gameScene?.conveyor?.getLoadPercent() ?? 0;
        if (pct >= CONFIG.CONV_DANGER) window.SoundMgr?.conveyorWarn();
    }
};
