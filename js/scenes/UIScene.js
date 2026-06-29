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
        this.createConfirmModal();
        this.createPauseModal();
        this.createSettingsModal();
        this.createLevelSelectModal();
        this.createTutorialOverlay();
        this.setupEventListeners();
        this.maybeShowEntryTutorials();
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

        // Pause button (was Settings gear — Settings now lives inside the Pause popup)
        const settingsBtn = this.add.image(28, H / 2, 'settings_icon')
            .setInteractive({ useHandCursor: true }).setDepth(101);
        settingsBtn.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            this.openPauseModal();
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

        // (Mute moved to Settings modal)

        // Level info (center)
        const levelData = LEVELS[this.gameScene.currentLevel];
        const difficulty = levelData?.difficulty || 'Tutorial';
        const diffHex = { Tutorial: '#2ECC71', Easy: '#3498DB', Normal: '#F1C40F', Hard: '#E74C3C', 'Super Hard': '#9B59B6' }[difficulty] || '#AAAACC';

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

        const TUT = {
            magnet:   { key: 'booster_magnet',   text: 'Magnet hút 1 Block bị Layer trên chặn ra khỏi bàn cờ.' },
            shuffle:  { key: 'booster_shuffle',  text: 'Shuffle xếp lại Car đang hoạt động để khớp màu Block có thể rút.' },
            paintGun: { key: 'booster_paintgun', text: 'Paint Gun phá toàn bộ Block cùng màu đang rút được — Cube bay thẳng vào Car.' },
        };
        const tut = TUT[key];
        const btn = this.boosterBtns[key];

        if (tut && btn?.bg) {
            const rect = {
                x: btn.bg.x - btn.bg.displayWidth / 2, y: btn.bg.y - btn.bg.displayHeight / 2,
                w: btn.bg.displayWidth, h: btn.bg.displayHeight,
            };
            const shown = this.showTutorial(tut.key, {
                text: tut.text, rect,
                onDismiss: () => this._activateBooster(key),
            });
            if (shown) return; // activation deferred until the hint is dismissed
        }

        this._activateBooster(key);
    }

    _activateBooster(key) {
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

        // Subtitle (text swapped in _showWinModal depending on whether a Star was awarded)
        const subText = this.add.text(cx, pTop + 150, 'Tuyệt vời! Bạn đã hoàn thành màn chơi.', {
            fontFamily: 'Outfit', fontSize: '12px', color: '#8888AA', resolution: 2,
        }).setOrigin(0.5);
        container.add(subText);

        // Reward row — "+Coin  +Star" pill, filled in by _showWinModal
        const rewardText = this.add.text(cx, pTop + 173, '', {
            fontFamily: 'Outfit', fontSize: '14px', fontStyle: 'bold', color: '#F1C40F', resolution: 2,
        }).setOrigin(0.5).setAlpha(0);
        container.add(rewardText);

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

        return { container, subText, rewardText };
    }

    _buildLoseModal() {
        const cx = CONFIG.GAME_WIDTH / 2;
        const cy = CONFIG.GAME_HEIGHT / 2;
        const pw = 320, ph = 300;
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

        // Icon + title (text content swapped per lose reason in _openLoseModal)
        const titleIcon = this.add.text(cx, pTop + 52, '😔', {
            fontSize: '32px', resolution: 2,
        }).setOrigin(0.5);
        const titleText = this.add.text(cx, pTop + 94, 'Game Over', {
            fontFamily: 'Outfit', fontSize: '24px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5);
        const subText = this.add.text(cx, pTop + 122, 'Hãy thử lại để giải màn này!', {
            fontFamily: 'Outfit', fontSize: '12px', color: '#886688',
            align: 'center', wordWrap: { width: pw - 40 }, resolution: 2,
        }).setOrigin(0.5);
        container.add(titleIcon); container.add(titleText); container.add(subText);

        // Revive button (primary — purple)
        const reviveY = pTop + 168;
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
        const retryY = pTop + 214;
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
        retryZone.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            // The Heart for this loss is already spent (GameStateManager.enterLose).
            // Out of Hearts — send the player Home, where the Over Lives popup gates PLAY.
            if ((window.PlayerHearts?.get() ?? 1) <= 0) {
                this.scene.stop('UIScene');
                this.gameScene.scene.start('HomeScene');
                return;
            }
            this.gameScene.retryLevel();
        });
        this._addBtnPress(retryZone, [retryText]);
        container.add(retryZone);

        // Back to Home (tertiary — plain text link)
        const homeY = pTop + 252;
        const homeText = this.add.text(cx, homeY, '🏠   Về màn hình chính', {
            fontFamily: 'Outfit', fontSize: '12px', fontStyle: 'bold',
            color: '#6666AA', resolution: 2,
        }).setOrigin(0.5);
        container.add(homeText);
        const homeZone = this.add.zone(cx, homeY, 200, 30).setInteractive({ useHandCursor: true });
        homeZone.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            this.scene.stop('UIScene');
            this.gameScene.scene.start('HomeScene');
        });
        this._addBtnPress(homeZone, [homeText]);
        container.add(homeZone);

        // Hold-to-observe hint
        container.add(this.add.text(cx, pTop + ph + 18, '• Nhấn giữ màn hình để quan sát', {
            fontFamily: 'Outfit', fontSize: '11px', color: '#4A4A66', resolution: 2,
        }).setOrigin(0.5));

        return { container, titleIcon, titleText, subText };
    }

    _openLoseModal() {
        const LOSE_COPY = {
            CONVEYOR_FULL: {
                icon: '🚧', title: 'Conveyor đầy!',
                sub: 'Băng chuyền đã đầy và không Cube nào khớp được với Car đang hoạt động.',
            },
            CLEANUP_DEADLOCK: {
                icon: '😔', title: 'Game Over',
                sub: 'Không thể hoàn thành Car còn lại. Hãy thử lại để giải màn này!',
            },
            BOARD_DEADLOCK: {
                icon: '😔', title: 'Game Over',
                sub: 'Không còn Block nào có thể rút được khớp màu. Hãy thử lại nhé!',
            },
        };
        const reason = this.gameScene?.gameState?.loseReason;
        const copy = LOSE_COPY[reason] || LOSE_COPY.CLEANUP_DEADLOCK;
        this.loseModal.titleIcon.setText(copy.icon);
        this.loseModal.titleText.setText(copy.title);
        this.loseModal.subText.setText(copy.sub);

        this._openModal(this.loseModal.container);

        // Hold (> 350ms) hides the overlay so the player can inspect the board.
        // Quick taps (< 350ms) still fire button actions normally.
        let _hideTimer = null;
        const onDown = () => {
            if (!this.loseModal?.container?.visible) return;
            _hideTimer = this.time.delayedCall(350, () => {
                this.loseModal.container.setAlpha(0);
            });
        };
        const onUp = () => {
            if (_hideTimer) { _hideTimer.remove(); _hideTimer = null; }
            if (this.loseModal?.container?.visible) {
                this.loseModal.container.setAlpha(1);
            }
        };
        this.input.on('pointerdown', onDown);
        this.input.on('pointerup', onUp);
    }

    _showWinModal() {
        // Reset stars
        this._winStars.forEach(s => { s.setAlpha(0); s.setScale(0.2); });

        // Star is only granted on a level's FIRST-ever clear; Coin is granted on every win.
        const state = this.gameScene?.gameState;
        const starAwarded = state?.starAwarded !== false;
        const coinAwarded = state?.coinAwarded ?? 0;
        this.winModal.subText.setText(
            starAwarded
                ? 'Tuyệt vời! Bạn đã hoàn thành màn chơi.'
                : 'Tuyệt vời! Bạn đã hoàn thành màn chơi.\n(Màn này đã từng nhận Star trước đó)'
        );
        this.winModal.rewardText.setText(
            starAwarded ? `🪙 +${coinAwarded}    ⭐ +1` : `🪙 +${coinAwarded}`
        ).setAlpha(0).setScale(0.6);

        this._openModal(this.winModal.container);
        this.time.delayedCall(280, () => {
            this.tweens.add({
                targets: this.winModal.rewardText, alpha: 1, scale: 1,
                duration: 350, ease: 'Back.easeOut',
            });
        });
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

    // ─── Confirm Modal (generic Yes/No, used by Pause → Restart/Quit) ────

    createConfirmModal() {
        const cx = CONFIG.GAME_WIDTH / 2;
        const cy = CONFIG.GAME_HEIGHT / 2;
        const pw = 280, ph = 178;
        const pLeft = cx - pw / 2, pTop = cy - ph / 2;

        const container = this.add.container(0, 0).setDepth(700).setVisible(false);

        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.7);
        dim.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
        container.add(dim);

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A2A, 1);
        panel.fillRoundedRect(pLeft, pTop, pw, ph, 16);
        panel.lineStyle(2, THEME.UI_PANEL_BORDER, 1);
        panel.strokeRoundedRect(pLeft, pTop, pw, ph, 16);
        container.add(panel);

        const titleTxt = this.add.text(cx, pTop + 36, '', {
            fontFamily: 'Outfit', fontSize: '16px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5);
        container.add(titleTxt);

        const msgTxt = this.add.text(cx, pTop + 64, '', {
            fontFamily: 'Outfit', fontSize: '12px', color: '#9999BB',
            align: 'center', wordWrap: { width: pw - 40 }, resolution: 2,
        }).setOrigin(0.5);
        container.add(msgTxt);

        const btnY = pTop + ph - 34;

        const cancelBg = this.add.graphics();
        cancelBg.lineStyle(2, 0x555566, 1);
        cancelBg.strokeRoundedRect(cx - 122, btnY - 18, 116, 36, 10);
        const cancelText = this.add.text(cx - 64, btnY, 'Hủy', {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold',
            color: '#9999BB', resolution: 2,
        }).setOrigin(0.5);
        const cancelZone = this.add.zone(cx - 64, btnY, 116, 36).setInteractive({ useHandCursor: true });
        cancelZone.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            this._closeModal(container);
        });
        this._addBtnPress(cancelZone, [cancelText]);
        container.add(cancelBg); container.add(cancelText); container.add(cancelZone);

        const confirmBg = this.add.graphics();
        confirmBg.fillStyle(0xC0392B, 1);
        confirmBg.fillRoundedRect(cx + 6, btnY - 18, 116, 36, 10);
        const confirmText = this.add.text(cx + 64, btnY, 'Xác nhận', {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5);
        const confirmZone = this.add.zone(cx + 64, btnY, 116, 36).setInteractive({ useHandCursor: true });
        confirmZone.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            const cb = this._confirmModalCallback;
            this._confirmModalCallback = null;
            this._closeModal(container, () => { if (cb) cb(); });
        });
        this._addBtnPress(confirmZone, [confirmBg, confirmText]);
        container.add(confirmBg); container.add(confirmText); container.add(confirmZone);

        this.confirmModal = { container, titleTxt, msgTxt };
    }

    /** Show a generic Confirm/Cancel popup. onConfirm runs after the popup closes. */
    openConfirm(title, message, onConfirm) {
        if (!this.confirmModal) return;
        this.confirmModal.titleTxt.setText(title);
        this.confirmModal.msgTxt.setText(message);
        this._confirmModalCallback = onConfirm;
        this._openModal(this.confirmModal.container);
    }

    // ─── Pause Modal ──────────────────────────────────────────────

    openPauseModal() {
        if (!this.pauseModal) return;
        if (!this.gameScene?.pauseGame()) return; // only opens while actually PLAYING
        window.SoundMgr?.buttonClick();
        this.pauseModal.container.setScale(0.85);
        this._openModal(this.pauseModal.container);
        this.tweens.add({
            targets: this.pauseModal.container, scaleX: 1, scaleY: 1,
            duration: 300, ease: 'Back.easeOut',
        });
    }

    closePauseModal(andResume = true) {
        if (!this.pauseModal) return;
        this._closeModal(this.pauseModal.container, () => {
            if (andResume) this.gameScene?.resumeGame();
        });
    }

    createPauseModal() {
        const cx = CONFIG.GAME_WIDTH / 2;
        const cy = CONFIG.GAME_HEIGHT / 2;
        const pw = 280, ph = 320;
        const pLeft = cx - pw / 2, pTop = cy - ph / 2;

        const container = this.add.container(0, 0).setDepth(600).setVisible(false);

        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.7);
        dim.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
        container.add(dim);

        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A2A, 1);
        panel.fillRoundedRect(pLeft, pTop, pw, ph, 18);
        panel.lineStyle(2, THEME.UI_PANEL_BORDER, 1);
        panel.strokeRoundedRect(pLeft, pTop, pw, ph, 18);
        container.add(panel);

        container.add(this.add.text(cx, pTop + 34, '⏸  Tạm dừng', {
            fontFamily: 'Outfit', fontSize: '18px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5));

        // Small settings icon — opens the Settings modal on top, Pause stays underneath
        const setX = pLeft + pw - 26, setY = pTop + 26;
        const setBg = this.add.graphics();
        setBg.fillStyle(0x3A3A4E, 1);
        setBg.fillCircle(setX, setY, 14);
        const setIcon = this.add.image(setX, setY, 'settings_icon').setScale(0.7);
        const setZone = this.add.zone(setX, setY, 30, 30).setInteractive({ useHandCursor: true });
        setZone.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            this.openSettingsModal();
        });
        this._addBtnPress(setZone, [setBg, setIcon]);
        container.add(setBg); container.add(setIcon); container.add(setZone);

        const makeBtn = (y, label, bgColor, isOutline, onTap) => {
            const bg = this.add.graphics();
            if (isOutline) {
                bg.lineStyle(2, bgColor, 1);
                bg.strokeRoundedRect(cx - 110, y - 22, 220, 44, 12);
            } else {
                bg.fillStyle(bgColor, 1);
                bg.fillRoundedRect(cx - 110, y - 22, 220, 44, 12);
            }
            const text = this.add.text(cx, y, label, {
                fontFamily: 'Outfit', fontSize: '15px', fontStyle: 'bold',
                color: isOutline ? '#CCCCDD' : '#FFFFFF', resolution: 2,
            }).setOrigin(0.5);
            const zone = this.add.zone(cx, y, 220, 44).setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => { window.SoundMgr?.buttonClick(); onTap(); });
            this._addBtnPress(zone, [bg, text]);
            container.add(bg); container.add(text); container.add(zone);
        };

        makeBtn(pTop + 110, '▶  Resume', 0x27AE60, false, () => this.closePauseModal(true));

        makeBtn(pTop + 168, '🔄  Restart', 0xE67E22, false, () => {
            this.openConfirm(
                'Chơi lại màn này?',
                'Tiến trình hiện tại sẽ mất.',
                () => { this.closePauseModal(false); this.gameScene.retryLevel(); }
            );
        });

        makeBtn(pTop + 226, '🚪  Quit Level', 0xC0392B, false, () => {
            this.openConfirm(
                'Rời màn chơi?',
                'Bạn sẽ mất 1 Heart và quay về Trang chủ.',
                () => {
                    window.PlayerHearts?.spend(1);
                    this.closePauseModal(false);
                    this.scene.stop('UIScene');
                    this.gameScene.scene.start('HomeScene');
                }
            );
        });

        this.pauseModal = { container };
    }

    // ─── Tutorial Overlay (first-time mechanic hints) ────────────

    createTutorialOverlay() {
        const W = CONFIG.GAME_WIDTH, H = CONFIG.GAME_HEIGHT;
        const container = this.add.container(0, 0).setDepth(800).setVisible(false);

        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.6);
        dim.fillRect(0, 0, W, H);
        dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
        container.add(dim);

        const ring = this.add.graphics();
        container.add(ring);

        const textBox = this.add.text(W / 2, H / 2, '', {
            fontFamily: 'Outfit', fontSize: '14px', fontStyle: 'bold',
            color: '#FFFFFF', align: 'center', wordWrap: { width: W - 80 },
            resolution: 2,
        }).setOrigin(0.5);
        container.add(textBox);

        const okBg = this.add.graphics();
        const okText = this.add.text(0, 0, 'Đã hiểu', {
            fontFamily: 'Outfit', fontSize: '14px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5);
        const okZone = this.add.zone(0, 0, 120, 40).setInteractive({ useHandCursor: true });
        okZone.on('pointerdown', () => this._dismissTutorial());
        this._addBtnPress(okZone, [okBg, okText]);
        container.add(okBg); container.add(okText); container.add(okZone);

        this.tutorialOverlay = { container, ring, textBox, okBg, okText, okZone };
        this._tutorialActive = false;
        this._tutorialQueue = [];
    }

    /**
     * Show a one-time hint overlay for `key` (skipped forever once seen).
     * rect: optional {x,y,w,h} screen area to highlight with a glowing ring.
     * onDismiss: optional callback fired after the player taps OK.
     * Returns true if the overlay was shown (or queued), false if already seen.
     */
    showTutorial(key, { text, rect = null, onDismiss = null } = {}) {
        if (localStorage.getItem(`bbf_tut_${key}`) === '1') return false;

        if (this._tutorialActive) {
            this._tutorialQueue.push({ key, text, rect, onDismiss });
            return true;
        }

        this._tutorialActive = true;
        this.gameScene?.pauseGame();

        const W = CONFIG.GAME_WIDTH, H = CONFIG.GAME_HEIGHT;
        const { ring, textBox, okBg, okText, okZone } = this.tutorialOverlay;

        ring.clear();
        let textY = H / 2;
        if (rect) {
            const r = 14;
            ring.lineStyle(3, 0xF1C40F, 0.95);
            ring.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, r);
            ring.lineStyle(1.5, 0xF1C40F, 0.35);
            ring.strokeRoundedRect(rect.x - 5, rect.y - 5, rect.w + 10, rect.h + 10, r + 4);

            const isTop = (rect.y + rect.h / 2) < H / 2;
            textY = isTop ? Math.min(H - 90, rect.y + rect.h + 56) : Math.max(90, rect.y - 56);
        }

        textBox.setText(text || '').setPosition(W / 2, textY);
        const okY = textY + 40;
        okBg.clear();
        okBg.fillStyle(0x6C5CE7, 1);
        okBg.fillRoundedRect(W / 2 - 60, okY - 20, 120, 40, 12);
        okText.setPosition(W / 2, okY);
        okZone.setPosition(W / 2, okY);

        this._activeTutorialKey = key;
        this._pendingTutorialDismiss = onDismiss;
        this._openModal(this.tutorialOverlay.container);
        return true;
    }

    _dismissTutorial() {
        window.SoundMgr?.buttonClick();
        const key = this._activeTutorialKey;
        const cb = this._pendingTutorialDismiss;
        this._pendingTutorialDismiss = null;

        this._closeModal(this.tutorialOverlay.container, () => {
            this._tutorialActive = false;
            this.gameScene?.resumeGame();
            if (cb) cb();

            if (this._tutorialQueue.length > 0) {
                const next = this._tutorialQueue.shift();
                this.showTutorial(next.key, next);
            }
        });

        if (key) localStorage.setItem(`bbf_tut_${key}`, '1');
    }

    /** First-ever-level hint: explains the core "tap to pull" mechanic before any input. */
    maybeShowEntryTutorials() {
        const boardRect = {
            x: CONFIG.BOARD_OFFSET_X, y: CONFIG.BOARD_OFFSET_Y,
            w: CONFIG.GRID_COLS * CONFIG.CELL_SIZE, h: CONFIG.GRID_ROWS * CONFIG.CELL_SIZE,
        };
        this.showTutorial('tap_block', {
            text: 'Chạm vào một Block để rút nó ra khỏi bàn cờ và phá thành Cube!',
            rect: boardRect,
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
        const pw = 292, ph = 332;
        const pLeft = cx - pw / 2, pTop = cy - ph / 2;

        const container = this.add.container(0, 0).setDepth(650).setVisible(false);

        // Dim
        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.65);
        dim.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
        container.add(dim);

        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1A1A2A, 1);
        panel.fillRoundedRect(pLeft, pTop, pw, ph, 18);
        panel.lineStyle(2, THEME.UI_PANEL_BORDER, 1);
        panel.strokeRoundedRect(pLeft, pTop, pw, ph, 18);
        container.add(panel);

        // Title
        container.add(this.add.text(cx, pTop + 28, '⚙️  Tùy chọn', {
            fontFamily: 'Outfit', fontSize: '18px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5));

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

        // Helper: thin section divider
        const addDivider = (y) => {
            const d = this.add.graphics();
            d.lineStyle(1, THEME.UI_PANEL_BORDER, 0.35);
            d.lineBetween(pLeft + 16, y, pLeft + pw - 16, y);
            container.add(d);
        };
        addDivider(pTop + 50);

        // ── Sound on/off toggle ──────────────────────────────────────
        const row1Y = pTop + 80;
        container.add(this.add.text(pLeft + 20, row1Y, '🔊  Âm thanh', {
            fontFamily: 'Outfit', fontSize: '14px', fontStyle: 'bold',
            color: '#DDDDEE', resolution: 2,
        }).setOrigin(0, 0.5));

        const TW = 54, TH = 30, TR = 15;
        const tgX = pLeft + pw - 42;
        const tgOffX = tgX - TW / 2 + TR, tgOnX = tgX + TW / 2 - TR;
        let soundOn = !(window.SoundMgr?.muted ?? false);

        const tgBg = this.add.graphics();
        const redrawToggle = (on) => {
            tgBg.clear();
            tgBg.fillStyle(on ? 0x27AE60 : 0x3A3A50, 1);
            tgBg.fillRoundedRect(tgX - TW / 2, row1Y - TH / 2, TW, TH, TR);
        };
        redrawToggle(soundOn);
        container.add(tgBg);

        const tgKnob = this.add.graphics();
        tgKnob.fillStyle(0xFFFFFF, 1);
        tgKnob.fillCircle(0, 0, TR - 4);
        tgKnob.setPosition(soundOn ? tgOnX : tgOffX, row1Y);
        container.add(tgKnob);

        const tgLabel = this.add.text(tgX, row1Y, soundOn ? 'BẬT' : 'TẮT', {
            fontFamily: 'Outfit', fontSize: '9px', fontStyle: 'bold',
            color: '#FFFFFF', resolution: 2,
        }).setOrigin(0.5);
        container.add(tgLabel);

        const tgZone = this.add.zone(tgX, row1Y, TW, TH).setInteractive({ useHandCursor: true });
        tgZone.on('pointerdown', () => {
            soundOn = !soundOn;
            redrawToggle(soundOn);
            tgLabel.setText(soundOn ? 'BẬT' : 'TẮT');
            this.tweens.add({ targets: tgKnob, x: soundOn ? tgOnX : tgOffX, duration: 160, ease: 'Quad.easeOut' });
            const muted = window.SoundMgr?.toggleMute();
            if (this.muteBtnIcon) this.muteBtnIcon.setText(muted ? '🔇' : '🔊');
            if (!muted) window.SoundMgr?.buttonClick();
        });
        container.add(tgZone);

        addDivider(pTop + 108);

        // ── Slider helper ────────────────────────────────────────────
        // Each slider: label row + track row.
        // Pointer coords are in world space; since container lives at (0,0)
        // after animation, local x = world x.
        const TRK_MARGIN = 22;
        const TRK_START  = pLeft + TRK_MARGIN;
        const TRK_END    = pLeft + pw - TRK_MARGIN;
        const TRK_W      = TRK_END - TRK_START;
        const TRK_H      = 6;
        const KNOB_R     = 12;

        const makeSlider = (labelY, trackY, labelEmoji, labelStr, initV, accentColor, onChange) => {
            // Label + percentage
            container.add(this.add.text(pLeft + 20, labelY, `${labelEmoji}  ${labelStr}`, {
                fontFamily: 'Outfit', fontSize: '13px', color: '#9999BB', resolution: 2,
            }).setOrigin(0, 0.5));

            const pctTxt = this.add.text(TRK_END + 4, labelY, '', {
                fontFamily: 'Outfit', fontSize: '12px', fontStyle: 'bold',
                color: '#7777AA', resolution: 2,
            }).setOrigin(0, 0.5);
            container.add(pctTxt);

            // Track background
            const trackBg = this.add.graphics();
            trackBg.fillStyle(0x1E1E2E, 1);
            trackBg.fillRoundedRect(TRK_START, trackY - TRK_H / 2, TRK_W, TRK_H, TRK_H / 2);
            container.add(trackBg);

            // Track fill (left portion, coloured)
            const trackFill = this.add.graphics();
            container.add(trackFill);

            // Knob
            const knob = this.add.graphics();
            container.add(knob);

            let value = initV;

            const redraw = (v) => {
                value = Math.max(0, Math.min(1, v));
                const kx = TRK_START + value * TRK_W;
                // Fill
                trackFill.clear();
                if (value > 0) {
                    trackFill.fillStyle(accentColor, 1);
                    trackFill.fillRoundedRect(TRK_START, trackY - TRK_H / 2, value * TRK_W, TRK_H, TRK_H / 2);
                }
                // Knob: glow ring + white circle
                knob.clear();
                knob.fillStyle(accentColor, 0.25);
                knob.fillCircle(kx, trackY, KNOB_R + 5);
                knob.fillStyle(0xFFFFFF, 1);
                knob.fillCircle(kx, trackY, KNOB_R);
                knob.lineStyle(2.5, accentColor, 1);
                knob.strokeCircle(kx, trackY, KNOB_R);
                // Label
                pctTxt.setText(`${Math.round(value * 100)}%`);
                onChange(value);
            };
            redraw(value);

            // Interaction: wide zone covering track + knob
            const zone = this.add.zone(
                TRK_START + TRK_W / 2, trackY,
                TRK_W + KNOB_R * 2, (KNOB_R + 5) * 2 + 4
            ).setInteractive({ useHandCursor: true });
            container.add(zone);

            let dragging = false;
            zone.on('pointerdown', (ptr) => {
                dragging = true;
                redraw((ptr.x - TRK_START) / TRK_W);
            });
            this.input.on('pointermove', (ptr) => {
                if (!dragging) return;
                redraw((ptr.x - TRK_START) / TRK_W);
            });
            this.input.on('pointerup', () => {
                if (dragging) { dragging = false; window.SoundMgr?.buttonClick(); }
            });
        };

        // ── Music volume ─────────────────────────────────────────────
        makeSlider(
            pTop + 132, pTop + 156,
            '🎵', 'Nhạc nền',
            window.SoundMgr?.musicVolume ?? 0.7,
            0x7B6CF6,
            (v) => window.SoundMgr?.setMusicVolume(v)
        );

        // ── SFX volume ───────────────────────────────────────────────
        makeSlider(
            pTop + 188, pTop + 212,
            '🎛', 'Hiệu ứng âm',
            window.SoundMgr?.sfxVolume ?? 0.5,
            0x27AE60,
            (v) => window.SoundMgr?.setSfxVolume(v)
        );

        addDivider(pTop + 240);

        // ── Reset Game (demo helper) — tap once to arm, tap again within 4s to confirm ──
        const rstY = pTop + 270;
        const rstW = pw - 36, rstH = 38;
        const rstBg = this.add.graphics(); container.add(rstBg);
        const rstLabel = this.add.text(cx, rstY, '🗑  Reset dữ liệu game', {
            fontFamily: 'Outfit', fontSize: '13px', fontStyle: 'bold', color: '#FF8A8A', resolution: 2,
        }).setOrigin(0.5); container.add(rstLabel);
        const rstHint = this.add.text(cx, rstY + 24, 'Xoá tiến trình, mở khoá & tuỳ chỉnh để demo lại', {
            fontFamily: 'Outfit', fontSize: '10px', color: '#7777AA', resolution: 2,
        }).setOrigin(0.5); container.add(rstHint);

        let rstArmed = false, rstArmTimer = null;
        const drawRst = (danger) => {
            rstBg.clear();
            rstBg.fillStyle(danger ? 0xB23A3A : 0x2A1E2E, 1);
            rstBg.fillRoundedRect(cx - rstW / 2, rstY - rstH / 2, rstW, rstH, 10);
            rstBg.lineStyle(1.5, danger ? 0xFF6B6B : 0x6A3A4A, 0.8);
            rstBg.strokeRoundedRect(cx - rstW / 2, rstY - rstH / 2, rstW, rstH, 10);
        };
        drawRst(false);

        const rstZone = this.add.zone(cx, rstY, rstW, rstH).setInteractive({ useHandCursor: true });
        container.add(rstZone);
        rstZone.on('pointerdown', () => {
            window.SoundMgr?.buttonClick();
            if (!rstArmed) {
                rstArmed = true;
                drawRst(true);
                rstLabel.setText('⚠  Chạm lần nữa để xác nhận');
                if (rstArmTimer) rstArmTimer.remove();
                rstArmTimer = this.time.delayedCall(4000, () => {
                    rstArmed = false; drawRst(false); rstLabel.setText('🗑  Reset dữ liệu game');
                });
            } else {
                if (rstArmTimer) rstArmTimer.remove();
                const keys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('bbf_')) keys.push(k);
                }
                keys.forEach((k) => localStorage.removeItem(k));
                window.location.reload();
            }
        });

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
        const DIFF_BG  = { Tutorial: 0x1A7A4A, Easy: 0x1A487A, Normal: 0x7A6A1A, Hard: 0x7A1A1A, 'Super Hard': 0x5B2C6F };
        const DIFF_HEX = { Tutorial: '#2ECC71', Easy: '#3498DB', Normal: '#F1C40F', Hard: '#E74C3C', 'Super Hard': '#9B59B6' };

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
                this.time.delayedCall(3000, () => this._openLoseModal());
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
