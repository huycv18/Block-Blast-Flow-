// ============================================================
// BootScene — Generates all game textures programmatically
// Global namespace: window.BootScene
// ============================================================

window.BootScene = class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    create() {
        this._generateColorTextures();
        this._generateGeneralTextures();

        // Editor play-test: skip splash + home, jump straight into the game
        const params = new URLSearchParams(window.location.search);
        if (params.get('testLevel')) {
            this.scene.start('GameScene');
            return;
        }

        this.scene.start('LoadingScene');
    }

    // ----------------------------------------------------------
    // Per-color textures: cell, cell_dim, cube, particle
    // ----------------------------------------------------------
    _generateColorTextures() {
        const { CELL_DRAW, CELL_RADIUS, CUBE_SIZE } = CONFIG;

        for (const colorName of COLOR_NAMES) {
            const color = COLORS[colorName];

            // --- cell_{colorName} — 39x39 plastic rounded rect ---
            this._generateCellTexture(`cell_${colorName}`, CELL_DRAW, CELL_DRAW, CELL_RADIUS, color, false);

            // --- cell_{colorName}_dim — same with 40% black overlay ---
            this._generateCellTexture(`cell_${colorName}_dim`, CELL_DRAW, CELL_DRAW, CELL_RADIUS, color, true);

            // --- cube_{colorName} — 10x10 small rounded square ---
            this._generateCubeTexture(`cube_${colorName}`, CUBE_SIZE, color);

            // --- particle_{colorName} — 6x6 circle ---
            this._generateParticleTexture(`particle_${colorName}`, 6, color);
        }
    }

    // ----------------------------------------------------------
    // General textures: grid_cell_empty, booster_bg, particle_star, coin_icon
    // ----------------------------------------------------------
    _generateGeneralTextures() {
        this._generateGridCellEmpty();
        this._generateBoosterBg();
        this._generateStarParticle();
        this._generateCoinIcon();
        this._generateHeartIcon();
        this._generateSettingsIcon();
    }

    // ----------------------------------------------------------
    // Cell texture with plastic look: highlight + shadow
    // ----------------------------------------------------------
    _generateCellTexture(key, w, h, radius, color, isDim) {
        const gfx = this.make.graphics({ add: false });

        // Base fill
        gfx.fillStyle(color.hex, 1);
        gfx.fillRoundedRect(0, 0, w, h, radius);

        // Top-left highlight (lighter edge, 2px)
        gfx.fillStyle(color.light, 0.6);
        gfx.fillRoundedRect(0, 0, w - 2, 2, { tl: radius, tr: 0, bl: 0, br: 0 }); // top edge
        gfx.fillRoundedRect(0, 0, 2, h - 2, { tl: radius, tr: 0, bl: 0, br: 0 }); // left edge

        // Bottom-right shadow (darker edge, 2px)
        gfx.fillStyle(color.dark, 0.7);
        gfx.fillRoundedRect(2, h - 2, w - 2, 2, { tl: 0, tr: 0, bl: 0, br: radius }); // bottom edge
        gfx.fillRoundedRect(w - 2, 2, 2, h - 2, { tl: 0, tr: 0, bl: 0, br: radius }); // right edge

        // Inner shine — small white ellipse near top-left
        gfx.fillStyle(0xFFFFFF, 0.15);
        gfx.fillRoundedRect(4, 4, 14, 8, 3);

        // Dim overlay (40% black)
        if (isDim) {
            gfx.fillStyle(0x000000, 0.4);
            gfx.fillRoundedRect(0, 0, w, h, radius);
        }

        gfx.generateTexture(key, w, h);
        gfx.destroy();
    }

    // ----------------------------------------------------------
    // Cube texture — 10x10 tiny rounded square with shine dot
    // ----------------------------------------------------------
    _generateCubeTexture(key, size, color) {
        const gfx = this.make.graphics({ add: false });
        const r = 2;

        // Fill
        gfx.fillStyle(color.hex, 1);
        gfx.fillRoundedRect(0, 0, size, size, r);

        // Subtle border shadow
        gfx.lineStyle(1, color.dark, 0.5);
        gfx.strokeRoundedRect(0, 0, size, size, r);

        // White shine dot at top-left
        gfx.fillStyle(0xFFFFFF, 0.5);
        gfx.fillCircle(3, 3, 1.5);

        gfx.generateTexture(key, size, size);
        gfx.destroy();
    }

    // ----------------------------------------------------------
    // Particle texture — 6x6 solid circle
    // ----------------------------------------------------------
    _generateParticleTexture(key, size, color) {
        const gfx = this.make.graphics({ add: false });
        const half = size / 2;

        gfx.fillStyle(color.hex, 1);
        gfx.fillCircle(half, half, half);

        gfx.generateTexture(key, size, size);
        gfx.destroy();
    }

    // ----------------------------------------------------------
    // Grid cell empty — 39x39 rounded rect
    // ----------------------------------------------------------
    _generateGridCellEmpty() {
        const { CELL_DRAW, CELL_RADIUS } = CONFIG;
        const gfx = this.make.graphics({ add: false });

        // Fill
        gfx.fillStyle(THEME.GRID_EMPTY, 1);
        gfx.fillRoundedRect(0, 0, CELL_DRAW, CELL_DRAW, CELL_RADIUS);

        // Subtle lighter border
        gfx.lineStyle(1, THEME.GRID_EMPTY_LIGHT, 0.6);
        gfx.strokeRoundedRect(0.5, 0.5, CELL_DRAW - 1, CELL_DRAW - 1, CELL_RADIUS);

        gfx.generateTexture('grid_cell_empty', CELL_DRAW, CELL_DRAW);
        gfx.destroy();
    }

    // ----------------------------------------------------------
    // Booster button background — rounded square with gradient-like fill
    // ----------------------------------------------------------
    _generateBoosterBg() {
        const size = CONFIG.BOOSTER_BTN_SIZE;
        const r = 12;
        const gfx = this.make.graphics({ add: false });

        // Base fill
        gfx.fillStyle(THEME.BOOSTER_BG, 1);
        gfx.fillRoundedRect(0, 0, size, size, r);

        // Lighter top half for gradient effect
        gfx.fillStyle(THEME.BOOSTER_BG_LIGHT, 0.5);
        gfx.fillRoundedRect(0, 0, size, size / 2, { tl: r, tr: r, bl: 0, br: 0 });

        // Subtle white shine on top
        gfx.fillStyle(0xFFFFFF, 0.1);
        gfx.fillRoundedRect(4, 2, size - 8, 6, 3);

        // Border
        gfx.lineStyle(1.5, 0xFFFFFF, 0.15);
        gfx.strokeRoundedRect(0, 0, size, size, r);

        gfx.generateTexture('booster_bg', size, size);
        gfx.destroy();
    }

    // ----------------------------------------------------------
    // Star particle — 12x12 white 4-pointed star
    // ----------------------------------------------------------
    _generateStarParticle() {
        const size = 12;
        const cx = size / 2;
        const cy = size / 2;
        const outerR = 6;
        const innerR = 2;
        const gfx = this.make.graphics({ add: false });

        gfx.fillStyle(0xFFFFFF, 1);
        gfx.beginPath();

        const points = 4;
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const r = i % 2 === 0 ? outerR : innerR;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) {
                gfx.moveTo(x, y);
            } else {
                gfx.lineTo(x, y);
            }
        }

        gfx.closePath();
        gfx.fillPath();

        gfx.generateTexture('particle_star', size, size);
        gfx.destroy();
    }

    // ----------------------------------------------------------
    // Coin icon — 20x20 yellow circle with darker inner circle
    // ----------------------------------------------------------
    _generateCoinIcon() {
        const size = 20;
        const cx = size / 2;
        const cy = size / 2;
        const gfx = this.make.graphics({ add: false });

        // Outer gold circle
        gfx.fillStyle(THEME.COIN_GOLD, 1);
        gfx.fillCircle(cx, cy, 9);

        // Darker inner circle
        gfx.fillStyle(0xD4AC0D, 1);
        gfx.fillCircle(cx, cy, 6);

        // Small white highlight
        gfx.fillStyle(0xFFFFFF, 0.35);
        gfx.fillCircle(cx - 2, cy - 2, 2.5);

        gfx.generateTexture('coin_icon', size, size);
        gfx.destroy();
    }

    // ----------------------------------------------------------
    // Heart icon — 20x20 red heart shape
    // ----------------------------------------------------------
    _generateHeartIcon() {
        const s = 20;
        const gfx = this.make.graphics({ add: false });
        gfx.fillStyle(0xE74C3C, 1);
        gfx.fillCircle(s * 0.30, s * 0.34, s * 0.24);
        gfx.fillCircle(s * 0.70, s * 0.34, s * 0.24);
        gfx.fillTriangle(s * 0.04, s * 0.42, s * 0.96, s * 0.42, s * 0.50, s * 0.90);
        gfx.generateTexture('heart_icon', s, s);
        gfx.destroy();
    }

    // ----------------------------------------------------------
    // Settings icon - 24x24 simple gear-like button glyph
    // ----------------------------------------------------------
    _generateSettingsIcon() {
        const size = 24;
        const cx = size / 2;
        const cy = size / 2;
        const gfx = this.make.graphics({ add: false });

        gfx.lineStyle(3, THEME.HEADER_SUB, 1);
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const x1 = cx + Math.cos(angle) * 7;
            const y1 = cy + Math.sin(angle) * 7;
            const x2 = cx + Math.cos(angle) * 10;
            const y2 = cy + Math.sin(angle) * 10;
            gfx.beginPath();
            gfx.moveTo(x1, y1);
            gfx.lineTo(x2, y2);
            gfx.strokePath();
        }

        gfx.lineStyle(2.5, THEME.HEADER_SUB, 1);
        gfx.strokeCircle(cx, cy, 7);
        gfx.fillStyle(THEME.HEADER_SUB, 1);
        gfx.fillCircle(cx, cy, 2.5);

        gfx.generateTexture('settings_icon', size, size);
        gfx.destroy();
    }
};
