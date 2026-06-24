// ============================================================
// Conveyor — Horizontal oval/stadium loop conveyor belt
// ============================================================

window.Conveyor = class Conveyor {
    constructor(scene) {
        this.scene = scene;
        this.cubesOnBelt = [];
        this.capacity = CONFIG.CONVEYOR_CAPACITY;
        this.speedMultiplier = 1;
        this.trackGfx = null;
        this.beltOffset = 0;
        this.warningTween = null;

        // Path parameters
        this.cx = CONFIG.CONVEYOR_CENTER_X;
        this.cy = CONFIG.CONVEYOR_CENTER_Y;
        this.hw = CONFIG.CONVEYOR_WIDTH / 2;   // half width
        this.hh = CONFIG.CONVEYOR_HEIGHT / 2;  // half height
        this.cr = CONFIG.CONVEYOR_CORNER_R;

        // Stations (bottom half, aligned with car columns)
        this.stations = [
            { t: 0.55, column: 0 },
            { t: 0.625, column: 1 },
            { t: 0.70, column: 2 },
        ];

        this.drawTrack();
    }

    drawTrack() {
        const g = this.scene.add.graphics();
        this.trackGfx = g;
        g.setDepth(5);

        // Track outline (stadium/pill shape)
        g.lineStyle(3, THEME.CONTAINER_STROKE, 1);
        g.fillStyle(THEME.CONTAINER_FILL, 1);

        const x = this.cx - this.hw;
        const y = this.cy - this.hh;
        const w = CONFIG.CONVEYOR_WIDTH;
        const h = CONFIG.CONVEYOR_HEIGHT;

        g.fillRoundedRect(x, y, w, h, this.cr);
        g.strokeRoundedRect(x, y, w, h, this.cr);

        // Inner track (darker)
        g.fillStyle(0x252535, 1);
        g.fillRoundedRect(x + 6, y + 6, w - 12, h - 12, this.cr - 4);

        // Station markers (small triangles pointing down)
        for (const station of this.stations) {
            const pos = this.getPathPosition(station.t);
            g.fillStyle(THEME.CONTAINER_STROKE, 0.6);
            g.fillTriangle(pos.x - 4, pos.y - 3, pos.x + 4, pos.y - 3, pos.x, pos.y + 3);
        }

        // Direction arrows on track
        this.drawDirectionArrows(g);
    }

    drawDirectionArrows(g) {
        g.lineStyle(1.5, THEME.CONTAINER_STROKE, 0.4);

        // Top: arrows pointing right
        for (let i = 0; i < 3; i++) {
            const t = 0.05 + i * 0.12;
            const pos = this.getPathPosition(t);
            const pos2 = this.getPathPosition(t + 0.02);
            const angle = Math.atan2(pos2.y - pos.y, pos2.x - pos.x);
            g.beginPath();
            g.moveTo(pos.x - 5 * Math.cos(angle), pos.y - 5 * Math.sin(angle));
            g.lineTo(pos.x + 5 * Math.cos(angle), pos.y + 5 * Math.sin(angle));
            g.strokePath();
        }
    }

    /**
     * Convert t (0-1) to screen position on the oval path.
     * Path: stadium shape going clockwise from top-center.
     * 
     * Segments:
     * 0.0-0.25: Top edge, left to right (adjusted: start from center-top going right)
     * 0.25-0.30: Right semicircle
     * 0.30-0.80: Bottom edge, right to left
     * 0.80-0.85: Left semicircle  
     * 0.85-1.0: Top edge continues to start
     * 
     * Simplified: Use parametric oval (rounded rect approximation)
     */
    getPathPosition(t) {
        // Normalize t to 0-1
        t = ((t % 1) + 1) % 1;

        const cx = this.cx;
        const cy = this.cy;
        const straightW = this.hw - this.cr; // Straight section half-width
        const r = this.cr;
        const innerOffset = 10; // Distance from track edge to cube path

        const totalPerimeter = 2 * straightW * 2 + 2 * Math.PI * (r - innerOffset / 2);
        const topLen = straightW * 2;
        const rightArc = Math.PI * (r - innerOffset / 2);
        const botLen = straightW * 2;
        const leftArc = Math.PI * (r - innerOffset / 2);

        const topFrac = topLen / totalPerimeter;
        const rightFrac = rightArc / totalPerimeter;
        const botFrac = botLen / totalPerimeter;
        const leftFrac = leftArc / totalPerimeter;

        let x, y;

        if (t < topFrac) {
            // Top edge: left to right
            const frac = t / topFrac;
            x = cx - straightW + frac * 2 * straightW;
            y = cy - this.hh + innerOffset;
        } else if (t < topFrac + rightFrac) {
            // Right semicircle
            const frac = (t - topFrac) / rightFrac;
            const angle = -Math.PI / 2 + frac * Math.PI;
            x = cx + straightW + (r - innerOffset) * Math.cos(angle);
            y = cy + (r - innerOffset) * Math.sin(angle);
        } else if (t < topFrac + rightFrac + botFrac) {
            // Bottom edge: right to left
            const frac = (t - topFrac - rightFrac) / botFrac;
            x = cx + straightW - frac * 2 * straightW;
            y = cy + this.hh - innerOffset;
        } else {
            // Left semicircle
            const frac = (t - topFrac - rightFrac - botFrac) / leftFrac;
            const angle = Math.PI / 2 + frac * Math.PI;
            x = cx - straightW + (r - innerOffset) * Math.cos(angle);
            y = cy + (r - innerOffset) * Math.sin(angle);
        }

        return { x, y };
    }

    addCube(cube) {
        cube.state = 'ON_CONVEYOR';
        cube.stateTime = Date.now();
        const entry = this.getPathPosition(0);
        cube.sprite.setPosition(entry.x, entry.y);

        this.cubesOnBelt.push({
            cube: cube,
            pathT: 0,
            color: cube.color,
        });
    }

    removeCube(cubeEntry) {
        const idx = this.cubesOnBelt.indexOf(cubeEntry);
        if (idx !== -1) this.cubesOnBelt.splice(idx, 1);
    }

    update(delta, carManager) {
        if (!carManager) return;

        const speed = CONFIG.CONVEYOR_SPEED * this.speedMultiplier * (delta / 1000);

        for (let i = this.cubesOnBelt.length - 1; i >= 0; i--) {
            const entry = this.cubesOnBelt[i];
            if (entry.cube.state !== 'ON_CONVEYOR') continue;

            const oldT = entry.pathT;
            entry.pathT += speed;
            if (entry.pathT >= 1) entry.pathT -= 1;

            // Update position
            const pos = this.getPathPosition(entry.pathT);
            entry.cube.sprite.setPosition(pos.x, pos.y);

            // Check stations
            for (const station of this.stations) {
                // Check if cube just passed this station
                const crossedForward = (oldT < station.t && entry.pathT >= station.t);
                const crossedWrap = (oldT > station.t && entry.pathT < station.t); // Handle path wrap

                if (crossedForward || crossedWrap) {
                    const car = carManager.findMatchingActiveCar(entry.color, station.column);
                    if (car && car.canAccept(entry.color)) {
                        this.matchCubeWithCar(entry, car);
                        this.removeCube(entry); // Already removed in matchCubeWithCar, but ensure clean
                        break;
                    }
                }
            }
        }

        // Update belt animation
        this.beltOffset += speed * 50;

        // Update warning visual
        this.updateWarningVisual();
    }

    matchCubeWithCar(entry, car) {
        entry.cube.state = 'MATCHING';
        this.removeCube(entry);

        // Tween cube to car position
        const carPos = car.getAbsorbPosition();
        this.scene.tweens.add({
            targets: entry.cube.sprite,
            x: carPos.x,
            y: carPos.y,
            scaleX: 0.5,
            scaleY: 0.5,
            alpha: 0.7,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                entry.cube.sprite.setVisible(false);
                entry.cube.state = 'DONE';
                const isFull = car.addCube();
                if (isFull) {
                    this.scene.events.emit('carFull', car);
                }
            }
        });
    }

    updateWarningVisual() {
        const pct = this.getLoadPercent();

        if (pct >= CONFIG.CONV_DANGER && !this.warningTween) {
            // Red flash
            this.warningTween = this.scene.tweens.add({
                targets: this.trackGfx,
                alpha: 0.5,
                duration: 300,
                yoyo: true,
                repeat: -1,
            });
        } else if (pct < CONFIG.CONV_DANGER && this.warningTween) {
            this.warningTween.stop();
            this.warningTween = null;
            this.trackGfx.setAlpha(1);
        }
    }

    getCurrentLoad() {
        return this.cubesOnBelt.filter(e => e.cube.state === 'ON_CONVEYOR').length;
    }

    getLoadPercent() {
        return this.getCurrentLoad() / this.capacity;
    }

    setSpeedMultiplier(mult) {
        this.speedMultiplier = mult;
    }

    getCubeColors() {
        const colors = new Set();
        for (const entry of this.cubesOnBelt) {
            if (entry.cube.state === 'ON_CONVEYOR') {
                colors.add(entry.color);
            }
        }
        return colors;
    }

    isFull() {
        return this.getCurrentLoad() >= this.capacity;
    }

    clear() {
        for (const entry of this.cubesOnBelt) {
            entry.cube.sprite.setVisible(false);
            entry.cube.state = 'DONE';
        }
        this.cubesOnBelt = [];
    }

    destroy() {
        if (this.trackGfx) this.trackGfx.destroy();
        if (this.warningTween) this.warningTween.stop();
        this.clear();
    }
};
