// ============================================================
// Conveyor — Horizontal oval/stadium loop conveyor belt
// ============================================================

window.Conveyor = class Conveyor {
    constructor(scene, capacity = CONFIG.CONVEYOR_CAPACITY) {
        this.scene = scene;
        this.cubesOnBelt = [];
        this.capacity = capacity ?? CONFIG.CONVEYOR_CAPACITY;
        this.speedMultiplier = 1;
        this.trackGfx = null;
        this.warningOverlay = null;
        this.warningState = 'none'; // 'none' | 'warning' | 'danger'
        this.warningTween = null;
        this.dashGfx = null;
        this.dashPhase = 0;
        this.dashSpacing = 0.05; // t-distance between dashes (~20 around the loop)

        // Cleanup speed-boost visual (blue glow + energy sparks) — active while speedMultiplier > 1
        this._boosting = false;
        this.boostGfx = null;
        this.boostTween = null;
        this._boostSparkTimer = null;

        // Path parameters
        this.cx = CONFIG.CONVEYOR_CENTER_X;
        this.cy = CONFIG.CONVEYOR_CENTER_Y;
        this.hw = CONFIG.CONVEYOR_WIDTH / 2;   // half width
        this.hh = CONFIG.CONVEYOR_HEIGHT / 2;  // half height
        this.cr = CONFIG.CONVEYOR_CORNER_R;

        // Stations on the bottom belt, aligned directly above each car column.
        this.stations = CONFIG.CAR_COL_POSITIONS.map((x, column) => ({
            t: this.getBottomPathTForX(x),
            column,
        }));

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

        // Animated moving dashes to sell the belt-running motion
        const dg = this.scene.add.graphics();
        dg.setDepth(5.5);
        this.dashGfx = dg;
        this.renderBeltDashes();

        this._initWarningOverlay();
    }

    renderBeltDashes() {
        const g = this.dashGfx;
        if (!g) return;
        g.clear();

        if (this._boosting) {
            // Streaking cyan-blue light trails — sells the "supercharged" cleanup speed
            g.lineStyle(4, 0x29D7FF, 0.9);
        } else {
            g.lineStyle(3, THEME.CONTAINER_STROKE, 0.5);
        }

        const dashLen = this._boosting ? 0.022 : 0.012; // t-length of each dash mark (longer streaks when boosting)
        for (let t = this.dashPhase; t < 1; t += this.dashSpacing) {
            const p1 = this.getPathPosition(t);
            const p2 = this.getPathPosition(t + dashLen);
            g.beginPath();
            g.moveTo(p1.x, p1.y);
            g.lineTo(p2.x, p2.y);
            g.strokePath();
        }
    }

    _initWarningOverlay() {
        const g = this.scene.add.graphics();
        g.setDepth(6); // above trackGfx
        g.setAlpha(0);
        this.warningOverlay = g;
    }

    _drawOverlay(color) {
        const g = this.warningOverlay;
        g.clear();
        g.fillStyle(color, 1);
        g.fillRoundedRect(
            this.cx - this.hw,
            this.cy - this.hh,
            this.hw * 2,
            this.hh * 2,
            this.cr
        );
    }

    getPathMetrics() {
        const straightW = this.hw - this.cr;
        const r = this.cr;
        const innerOffset = 10;

        const totalPerimeter = 2 * straightW * 2 + 2 * Math.PI * (r - innerOffset / 2);
        const topLen = straightW * 2;
        const rightArc = Math.PI * (r - innerOffset / 2);
        const botLen = straightW * 2;
        const leftArc = Math.PI * (r - innerOffset / 2);

        return {
            straightW,
            r,
            innerOffset,
            topFrac: topLen / totalPerimeter,
            rightFrac: rightArc / totalPerimeter,
            botFrac: botLen / totalPerimeter,
            leftFrac: leftArc / totalPerimeter,
        };
    }

    getBottomPathTForX(x) {
        const metrics = this.getPathMetrics();
        const rightX = this.cx + metrics.straightW;
        const bottomFrac = Phaser.Math.Clamp(
            (rightX - x) / (metrics.straightW * 2),
            0,
            1
        );

        return metrics.topFrac + metrics.rightFrac + bottomFrac * metrics.botFrac;
    }

    getTopPathTForX(x) {
        const metrics = this.getPathMetrics();
        const leftX = this.cx - metrics.straightW;
        const topFrac = Phaser.Math.Clamp(
            (x - leftX) / (metrics.straightW * 2),
            0,
            1
        );

        return topFrac * metrics.topFrac;
    }

    /** Returns the t value for the center of the top edge (entry point from Funnel). */
    getEntryT() {
        const { topFrac } = this.getPathMetrics();
        return topFrac / 2;
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
        const {
            straightW,
            r,
            innerOffset,
            topFrac,
            rightFrac,
            botFrac,
            leftFrac,
        } = this.getPathMetrics();

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
        const entryT = this.getEntryT();
        const entry = this.getPathPosition(entryT);
        cube.sprite.setPosition(entry.x, entry.y);

        this.cubesOnBelt.push({
            cube: cube,
            pathT: entryT,
            color: cube.color,
            absorbedByCars: new Set(), // cars already tried this lap
        });
    }

    removeCube(cubeEntry) {
        const idx = this.cubesOnBelt.indexOf(cubeEntry);
        if (idx !== -1) this.cubesOnBelt.splice(idx, 1);
    }

    update(delta, carManager) {
        if (!carManager) return;

        const speed = CONFIG.CONVEYOR_SPEED * this.speedMultiplier * (delta / 1000);
        const absorbRadius = CONFIG.CAR_ABSORB_RADIUS;
        const metrics = this.getPathMetrics();
        const botStart = metrics.topFrac + metrics.rightFrac;
        const botEnd = botStart + metrics.botFrac;

        for (let i = this.cubesOnBelt.length - 1; i >= 0; i--) {
            const entry = this.cubesOnBelt[i];
            if (entry.cube.state !== 'ON_CONVEYOR') continue;

            entry.pathT += speed;
            if (entry.pathT >= 1) {
                entry.pathT -= 1;
                entry.absorbedByCars = new Set();
            }

            const pos = this.getPathPosition(entry.pathT);
            entry.cube.sprite.setPosition(pos.x, pos.y);

            const t = entry.pathT;
            const onBottom = (t >= botStart && t <= botEnd);
            if (!onBottom) continue;

            const activeCars = carManager.getActiveCars();

            for (const car of activeCars) {
                if (!entry.absorbedByCars) entry.absorbedByCars = new Set();
                if (entry.absorbedByCars.has(car)) continue;
                if (car.color !== entry.color) continue;

                const carPos = car.getAbsorbPosition();
                const dx = Math.abs(pos.x - carPos.x);

                if (dx <= absorbRadius) {
                    if (car.reserveCube(entry.color)) {
                        entry.absorbedByCars.add(car);
                        this.matchCubeWithCar(entry, car);
                        break;
                    } else {
                        entry.absorbedByCars.add(car);
                    }
                }
            }
        }

        this.dashPhase = (this.dashPhase + speed) % this.dashSpacing;
        this.renderBeltDashes();
        this.updateWarningVisual();
    }

    matchCubeWithCar(entry, car) {
        entry.cube.state = 'MATCHING';
        this.removeCube(entry);

        const sprite = entry.cube.sprite;
        const carPos = car.getAbsorbPosition();
        const scatterX = (Math.random() - 0.5) * (CONFIG.CAR_WIDTH * 0.65);
        const scatterY = (Math.random() - 0.5) * 14;

        window.SoundMgr?.cubeAbsorb(Math.random());

        const fromX = sprite.x;
        const fromY = sprite.y;
        const toX = carPos.x + scatterX;
        const toY = carPos.y + scatterY;

        // Quadratic Bezier control point: above the midpoint for a jump arc
        const cpX = (fromX + toX) * 0.5;
        const cpY = Math.min(fromY, toY) - 65;

        const duration = CONFIG.CUBE_ABSORB_DURATION ?? 200;
        const progress = { t: 0 };

        // Arc position tween via Bezier
        this.scene.tweens.add({
            targets: progress,
            t: 1,
            duration,
            ease: 'Quad.easeIn',
            onUpdate: () => {
                const t = progress.t;
                const mt = 1 - t;
                sprite.x = mt * mt * fromX + 2 * mt * t * cpX + t * t * toX;
                sprite.y = mt * mt * fromY + 2 * mt * t * cpY + t * t * toY;
            },
            onComplete: () => {
                sprite.setVisible(false);
                entry.cube.state = 'DONE';
                const isFull = car.addCube();
                if (isFull && !car.isExiting) {
                    this.scene.events.emit('carFull', car);
                }
            },
        });

        // Spin while flying, shrink only at the very end
        const spinAngle = Phaser.Math.Between(60, 120) * (Math.random() > 0.5 ? 1 : -1);
        this.scene.tweens.add({
            targets: sprite,
            angle: spinAngle,
            duration: duration * 0.75,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: sprite,
                    scaleX: 0.4,
                    scaleY: 0.4,
                    alpha: 0,
                    duration: duration * 0.25,
                    ease: 'Quad.easeIn',
                });
            },
        });
    }

    updateWarningVisual() {
        const pct = this.getLoadPercent();

        if (pct >= CONFIG.CONV_DANGER) {
            if (this.warningState !== 'danger') {
                this.warningState = 'danger';
                this._stopWarningTween();
                this._drawOverlay(THEME.DANGER_RED);
                // Fast pulse: 0.15 → 0.55 → 0.15
                this.warningTween = this.scene.tweens.add({
                    targets: this.warningOverlay,
                    alpha: { from: 0.15, to: 0.55 },
                    duration: 250,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
            }
        } else if (pct >= CONFIG.CONV_WARNING) {
            if (this.warningState !== 'warning') {
                this.warningState = 'warning';
                this._stopWarningTween();
                this._drawOverlay(THEME.WARNING_ORANGE);
                // Slow pulse: 0.08 → 0.28 → 0.08
                this.warningTween = this.scene.tweens.add({
                    targets: this.warningOverlay,
                    alpha: { from: 0.08, to: 0.28 },
                    duration: 600,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
            }
        } else {
            if (this.warningState !== 'none') {
                this.warningState = 'none';
                this._stopWarningTween();
                if (this.warningOverlay) this.warningOverlay.setAlpha(0);
            }
        }
    }

    _stopWarningTween() {
        if (this.warningTween) {
            this.warningTween.stop();
            this.warningTween = null;
        }
    }

    resetWarningVisual() {
        this._stopWarningTween();
        this.warningState = 'none';
        if (this.warningOverlay) this.warningOverlay.setAlpha(0);
        if (this.trackGfx) this.trackGfx.setAlpha(1);
    }

    getCurrentLoad() {
        return this.cubesOnBelt.filter(e => e.cube.state === 'ON_CONVEYOR').length;
    }

    getLoadPercent() {
        return this.getCurrentLoad() / this.capacity;
    }

    setSpeedMultiplier(mult) {
        this.speedMultiplier = mult;

        const boosting = mult > 1;
        if (boosting === this._boosting) return;
        this._boosting = boosting;
        if (boosting) this._startCleanupBoost();
        else this._stopCleanupBoost();
    }

    // ── Cleanup speed-boost visual ──────────────────────────────────────
    // Triggered when the conveyor accelerates to sweep remaining cubes into
    // cars (CLEANUP state) — a strong blue glow + energy sparks to make the
    // payoff moment feel powerful, not just "faster".

    _startCleanupBoost() {
        if (!this.boostGfx) {
            this.boostGfx = this.scene.add.graphics();
            this.boostGfx.setDepth(5.6);
        }
        this._drawBoostGlow();

        this.scene.tweens.killTweensOf(this.boostGfx);
        this.boostGfx.setAlpha(0.35);
        this.boostTween = this.scene.tweens.add({
            targets: this.boostGfx,
            alpha: { from: 0.35, to: 0.95 },
            duration: 260,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        if (this._boostSparkTimer) this._boostSparkTimer.remove();
        this._boostSparkTimer = this.scene.time.addEvent({
            delay: 110, loop: true, callback: () => this._spawnBoostSpark(),
        });
    }

    _stopCleanupBoost() {
        if (this.boostTween) { this.boostTween.stop(); this.boostTween = null; }
        if (this.boostGfx) { this.boostGfx.clear(); this.boostGfx.setAlpha(0); }
        if (this._boostSparkTimer) { this._boostSparkTimer.remove(); this._boostSparkTimer = null; }
    }

    _drawBoostGlow() {
        const g = this.boostGfx;
        g.clear();
        const x = this.cx - this.hw, y = this.cy - this.hh;
        const w = this.hw * 2, h = this.hh * 2;

        // Layered strokes (wide+faint → tight+bright) fake a soft glow with plain Graphics
        const layers = [
            { pad: 10, width: 6, alpha: 0.18 },
            { pad: 5,  width: 5, alpha: 0.35 },
            { pad: 0,  width: 4, alpha: 0.9 },
        ];
        for (const L of layers) {
            g.lineStyle(L.width, 0x29D7FF, L.alpha);
            g.strokeRoundedRect(x - L.pad, y - L.pad, w + L.pad * 2, h + L.pad * 2, this.cr + L.pad);
        }
    }

    _spawnBoostSpark() {
        if (!this.scene || !this.scene.add) return;
        const pos = this.getPathPosition(Math.random());
        const e = this.scene.add.particles(pos.x, pos.y, 'particle_star', {
            speed: { min: 60, max: 170 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.9, end: 0 },
            lifespan: 280,
            quantity: 3,
            tint: [0x29D7FF, 0x7FE8FF, 0xFFFFFF],
        });
        e.setDepth(5.7);
        this.scene.time.delayedCall(60, () => { if (e && e.stop) e.stop(); });
        this.scene.time.delayedCall(400, () => { if (e && e.destroy) e.destroy(); });
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
        if (!entry || !entry.cube) continue;

        const cube = entry.cube;

        if (cube.sprite && cube.sprite.scene) {
            this.scene.tweens.killTweensOf(cube.sprite);
            cube.sprite.setVisible(false);
        }

        if (cube.body) {
            this.scene.matter.world.remove(cube.body);
            cube.body = null;
        }

        cube.state = 'DONE';
    }

    this.cubesOnBelt = [];

    this.setSpeedMultiplier(1);
    this.resetWarningVisual();
}

    destroy() {
        this.clear();

        if (this.warningOverlay) {
            this.warningOverlay.destroy();
            this.warningOverlay = null;
        }

        if (this.trackGfx) {
            this.trackGfx.destroy();
            this.trackGfx = null;
        }

        if (this.dashGfx) {
            this.dashGfx.destroy();
            this.dashGfx = null;
        }

        if (this.boostGfx) {
            this.boostGfx.destroy();
            this.boostGfx = null;
        }
    }
};
