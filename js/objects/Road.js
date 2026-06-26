// ============================================================
// Road — Horizontal road between conveyor and cars
// ============================================================

window.Road = class Road {
    constructor(scene) {
        this.scene = scene;
        this.graphics = null;
        this.draw();
    }

    draw() {
        const g = this.scene.add.graphics();
        this.graphics = g;
        g.setDepth(4);

        const y = CONFIG.ROAD_Y;
        const h = CONFIG.ROAD_HEIGHT;
        const w = CONFIG.GAME_WIDTH;

        // Road surface
        g.fillStyle(THEME.ROAD_SURFACE, 1);
        g.fillRect(0, y, w, h);

        // Edge lines
        g.lineStyle(1.5, THEME.ROAD_EDGE, 0.6);
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.strokePath();
        g.beginPath();
        g.moveTo(0, y + h);
        g.lineTo(w, y + h);
        g.strokePath();

        // Dashed center line
        const dashLen = 18;
        const gapLen = 12;
        const dashY = y + h / 2 - 1;
        g.fillStyle(THEME.ROAD_DASH, 0.8);
        for (let x = 5; x < w; x += dashLen + gapLen) {
            g.fillRect(x, dashY, dashLen, 2.5);
        }

        // Exit label
        const exitText = this.scene.add.text(8, y + h / 2, 'Exit', {
            fontFamily: 'Outfit',
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#FFFFFF',
            resolution: 2,
        }).setOrigin(0, 0.5).setDepth(5);

        // Arrow
        const arrow = this.scene.add.text(35, y + h / 2, '→', {
            fontFamily: 'Outfit',
            fontSize: '12px',
            color: '#FFFFFF',
            resolution: 2,
        }).setOrigin(0, 0.5).setDepth(5).setAlpha(0.6);

        this._exitText = exitText;
        this._arrow = arrow;
    }

    destroy() {
        if (this.graphics) this.graphics.destroy();
        if (this._exitText) this._exitText.destroy();
        if (this._arrow) this._arrow.destroy();
    }
};
