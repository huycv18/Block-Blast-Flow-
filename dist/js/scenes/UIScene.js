// ============================================================
// UIScene — HUD overlay (runs parallel to GameScene)
// ============================================================

window.UIScene = class UIScene extends Phaser.Scene {
    constructor() {
        super('UIScene');
    }

    create(data) {
        this.gameScene = data?.gameScene || this.scene.get('GameScene');

        this.createHeader();
        this.createBoosterButtons();
        this.createConveyorBar();
        this.createModals();
        this.setupEventListeners();
    }

    // --- Header ---

    createHeader() {
        const hw = CONFIG.GAME_WIDTH;
        const hh = CONFIG.HEADER_HEIGHT;

        // Background
        const bg = this.add.graphics();
        bg.fillStyle(THEME.UI_PANEL, 0.8);
        bg.fillRect(0, 0, hw, hh);

        // Settings button
        const settingsBtn = this.add.image(28, hh / 2, 'settings_icon')
            .setInteractive({ useHandCursor: true })
            .setDepth(100);

        // Level info
        const levelData = LEVELS[this.gameScene.currentLevel];
        const difficulty = levelData?.difficulty || 'Tutorial';

        this.add.text(hw / 2, hh / 2 - 8, difficulty, {
            fontFamily: 'Outfit',
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#BBBBCC',
            resolution: 2,
        }).setOrigin(0.5).setDepth(100);

        // Level badge
        const levelBadge = this.add.graphics();
        levelBadge.fillStyle(THEME.BOOSTER_BG, 1);
        levelBadge.fillRoundedRect(hw / 2 - 40, hh / 2, 80, 22, 11);
        levelBadge.setDepth(100);

        this.add.text(hw / 2, hh / 2 + 11, `Level ${(levelData?.id || 1)}`, {
            fontFamily: 'Outfit',
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#FFFFFF',
            resolution: 2,
        }).setOrigin(0.5).setDepth(101);

        // Coins
        this.add.image(hw - 72, hh / 2, 'coin_icon').setDepth(100);
        this.add.text(hw - 55, hh / 2, '1200', {
            fontFamily: 'Outfit',
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#F1C40F',
            resolution: 2,
        }).setOrigin(0, 0.5).setDepth(100);

        // Plus button
        const plusBg = this.add.graphics();
        plusBg.fillStyle(THEME.SUCCESS_GREEN, 1);
        plusBg.fillCircle(hw - 16, hh / 2, 10);
        plusBg.setDepth(100);
        this.add.text(hw - 16, hh / 2, '+', {
            fontFamily: 'Outfit',
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#FFFFFF',
            resolution: 2,
        }).setOrigin(0.5).setDepth(101);
    }

    // --- Boosters ---

    createBoosterButtons() {
        const y = CONFIG.BOOSTER_AREA_Y + CONFIG.BOOSTER_BTN_SIZE / 2;
        const spacing = 70;
        const startX = CONFIG.GAME_WIDTH / 2 - spacing;
        const size = CONFIG.BOOSTER_BTN_SIZE;

        this.boosterBtns = {};

        const boosters = [
            { key: 'magnet',  icon: '🧲', x: startX },
            { key: 'shuffle', icon: '🔀', x: startX + spacing },
            { key: 'paintGun',icon: '🎨', x: startX + spacing * 2 },
        ];

        for (const b of boosters) {
            // Background
            const bg = this.add.image(b.x, y, 'booster_bg').setDepth(100);
            bg.setInteractive({ useHandCursor: true });

            // Icon
            this.add.text(b.x, y - 3, b.icon, {
                fontSize: '22px',
                resolution: 2,
            }).setOrigin(0.5).setDepth(101);

            // Count badge
            const count = this.gameScene.boosterManager?.getCount(b.key) || 0;
            const badge = this.add.text(b.x + size / 2 - 6, y + size / 2 - 8, `${count}`, {
                fontFamily: 'Outfit',
                fontSize: '11px',
                fontStyle: 'bold',
                color: '#FFFFFF',
                backgroundColor: '#E74C3C',
                padding: { x: 3, y: 1 },
                resolution: 2,
            }).setOrigin(0.5).setDepth(102);

            // Tap handler
            bg.on('pointerdown', () => this.onBoosterTap(b.key));

            this.boosterBtns[b.key] = { bg, badge };
        }
    }

    onBoosterTap(key) {
        const gs = this.gameScene;
        if (!gs || gs.gameState.isInputLocked()) return;

        if (key === 'magnet') {
            gs.boosterManager.activateMagnet(gs.board);
        } else if (key === 'shuffle') {
            gs.boosterManager.activateShuffle(gs.board, gs.carManager);
        } else if (key === 'paintGun') {
            gs.boosterManager.activatePaintGun(gs.board);
        }
    }

    // --- Conveyor Bar ---

    createConveyorBar() {
        const barX = 55;
        const barY = CONFIG.CONVEYOR_CENTER_Y + CONFIG.CONVEYOR_HEIGHT / 2 + 8;
        const barW = CONFIG.GAME_WIDTH - 110;
        const barH = 6;

        // Background
        const bg = this.add.graphics();
        bg.fillStyle(0x222233, 1);
        bg.fillRoundedRect(barX, barY, barW, barH, 3);
        bg.setDepth(100);
        this.convBarBg = bg;

        // Fill
        this.convBarFill = this.add.graphics();
        this.convBarFill.setDepth(101);

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
        this.convBarFill.fillStyle(color, 1);
        this.convBarFill.fillRoundedRect(this._barX, this._barY, fillW, this._barH, 3);
    }

    // --- Modals ---

    createModals() {
        // Win modal
        this.winModal = this.createModal(
            '🎉 Level Complete!',
            [{ text: 'Next Level', callback: () => this.gameScene.nextLevel() }]
        );
        this.winModal.container.setVisible(false);

        // Lose modal
        this.loseModal = this.createModal(
            '😔 Game Over',
            [
                { text: '🔄 Retry', callback: () => this.gameScene.retryLevel() },
                { text: '💖 Revive', callback: () => {
                    this.gameScene.revive();
                    this.loseModal.container.setVisible(false);
                }},
            ]
        );
        this.loseModal.container.setVisible(false);

        // Cleanup banner
        this.cleanupText = this.add.text(
            CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT / 2 - 50,
            '⚡ Clearing!', {
                fontFamily: 'Outfit',
                fontSize: '28px',
                fontStyle: 'bold',
                color: '#F1C40F',
                stroke: '#2D2D3D',
                strokeThickness: 4,
                resolution: 2,
            }
        ).setOrigin(0.5).setDepth(200).setVisible(false);
    }

    createModal(title, buttons) {
        const cx = CONFIG.GAME_WIDTH / 2;
        const cy = CONFIG.GAME_HEIGHT / 2;
        const pw = 320;
        const ph = 180;

        const container = this.add.container(0, 0);
        container.setDepth(500);

        // Dim overlay
        const dim = this.add.graphics();
        dim.fillStyle(0x000000, 0.6);
        dim.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        dim.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT),
            Phaser.Geom.Rectangle.Contains
        );
        container.add(dim);

        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(THEME.UI_PANEL, 1);
        panel.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 16);
        panel.lineStyle(3, THEME.UI_PANEL_BORDER, 1);
        panel.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 16);
        container.add(panel);

        // Title
        const titleText = this.add.text(cx, cy - ph / 2 + 40, title, {
            fontFamily: 'Outfit',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#FFFFFF',
            resolution: 2,
        }).setOrigin(0.5);
        container.add(titleText);

        // Buttons
        const btnStartX = cx - (buttons.length - 1) * 70;
        buttons.forEach((btn, i) => {
            const bx = btnStartX + i * 140;
            const by = cy + 30;

            const btnBg = this.add.graphics();
            btnBg.fillStyle(THEME.BOOSTER_BG, 1);
            btnBg.fillRoundedRect(bx - 60, by - 18, 120, 36, 10);
            container.add(btnBg);

            const btnText = this.add.text(bx, by, btn.text, {
                fontFamily: 'Outfit',
                fontSize: '14px',
                fontStyle: 'bold',
                color: '#FFFFFF',
                resolution: 2,
            }).setOrigin(0.5);
            container.add(btnText);

            // Hitzone
            const zone = this.add.zone(bx, by, 120, 36).setInteractive({ useHandCursor: true });
            zone.on('pointerdown', btn.callback);
            container.add(zone);
        });

        return { container };
    }

    // --- Events ---

    setupEventListeners() {
        const gs = this.gameScene;
        if (!gs) return;

        gs.events.on('stateChange', (newState) => {
            if (newState === 'WIN') {
                this.cleanupText.setVisible(false);
                this.winModal.container.setVisible(true);
            } else if (newState === 'LOSE') {
                this.loseModal.container.setVisible(true);
            } else if (newState === 'CLEANUP') {
                this.cleanupText.setVisible(true);
                this.tweens.add({
                    targets: this.cleanupText,
                    scale: { from: 0.8, to: 1.1 },
                    alpha: { from: 0.7, to: 1 },
                    duration: 500,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
            }
        });

        gs.events.on('boosterUsed', (type, remaining) => {
            if (this.boosterBtns[type]) {
                this.boosterBtns[type].badge.setText(`${remaining}`);
            }
        });
    }

    update() {
        this.updateConveyorBar();
    }
};
