// ============================================================
// Car — Toy car that receives colored cubes
// ============================================================

window.Car = class Car {
    constructor(scene, carData) {
        this.scene = scene;
        this.color = carData.color;
        this.capacity = carData.capacity;
        this.column = carData.column;
        this.queueOrder = carData.queueOrder;

        // Mystery/Hidden mechanic
        this.hidden = carData.hidden === true;
        this.isRevealed = !this.hidden; // if not hidden, always revealed

        this.filledCount = 0;
        this.reservedCount = 0;
        this.isActive = (carData.queueOrder === 0);
        this.isExiting = false;

        this.container = null;
        this.fillBar = null;
        this.fillBarBg = null;
        this.capacityText = null;
        this.capacityTextShadow = null;

        // Mystery visual refs
        this._mysteryGraphics = null;
        this._mysteryText = null;
        this._normalGroup = []; // refs to normal car visuals that get hidden when mystery

        this.x = CONFIG.CAR_COL_POSITIONS[this.column];
        this.y = this.isActive ? CONFIG.CAR_ROW1_Y : CONFIG.CAR_ROW2_Y;

        this.createVisuals();
        if (!this.isActive) {
            this.container.setScale(CONFIG.CAR_ROW2_SCALE);
            this.container.setAlpha(CONFIG.CAR_ROW2_ALPHA);
        }

        // Apply initial mystery state
        this._applyMysteryState();
    }

    createVisuals() {
        const scene = this.scene;
        const w = CONFIG.CAR_WIDTH;
        const h = CONFIG.CAR_HEIGHT;
        const colorData = COLORS[this.color];

        this.container = scene.add.container(this.x, this.y);
        this.container.setDepth(20);

        // ── Normal car graphics ──────────────────────────────
        const g = scene.add.graphics();

        // Shadow
        g.fillStyle(0x000000, 0.3);
        g.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w, h, 10);

        // Body
        g.fillStyle(colorData.hex, 1);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);

        // Hood/roof (top darker area)
        g.fillStyle(colorData.dark, 1);
        g.fillRoundedRect(-w / 2 + 5, -h / 2, w - 10, h * 0.35, { tl: 8, tr: 8, bl: 0, br: 0 });

        // Cargo area (lighter, where cubes go)
        const cargoY = -h / 2 + h * 0.38;
        const cargoH = h * 0.50;
        g.fillStyle(colorData.light, 0.3);
        g.fillRect(-w / 2 + 8, cargoY, w - 16, cargoH);

        // Cargo border
        g.lineStyle(1.5, colorData.dark, 0.5);
        g.strokeRect(-w / 2 + 8, cargoY, w - 16, cargoH);

        // Wheels (4 corners)
        const wheelR = 5;
        const wx = w / 2 - 8;
        const wy = h / 2 - 4;
        g.fillStyle(0x222222, 1);
        g.fillCircle(-wx, -wy, wheelR);
        g.fillCircle(wx, -wy, wheelR);
        g.fillCircle(-wx, wy, wheelR);
        g.fillCircle(wx, wy, wheelR);

        // Wheel highlight
        g.fillStyle(0x444444, 1);
        g.fillCircle(-wx, -wy, wheelR - 2);
        g.fillCircle(wx, -wy, wheelR - 2);
        g.fillCircle(-wx, wy, wheelR - 2);
        g.fillCircle(wx, wy, wheelR - 2);

        // Shine on top
        g.fillStyle(0xFFFFFF, 0.15);
        g.fillRoundedRect(-w / 2 + 5, -h / 2 + 3, w - 10, h * 0.2, 5);

        this.container.add(g);
        this.carGraphics = g;
        this._normalGroup.push(g);

        // ── Fill bar ─────────────────────────────────────────
        const barX = -w / 2 + 9;
        const barW = w - 18;
        const barMaxH = cargoH - 2;

        this.fillBarBg = scene.add.graphics();
        this.fillBarBg.fillStyle(0x000000, 0.2);
        this.fillBarBg.fillRect(barX, cargoY + 1, barW, barMaxH);
        this.container.add(this.fillBarBg);
        this._normalGroup.push(this.fillBarBg);

        this.fillBar = scene.add.graphics();
        this.container.add(this.fillBar);
        this._normalGroup.push(this.fillBar);

        // Capacity label
        this.capacityTextShadow = scene.add.text(1, cargoY + cargoH / 2 + 1, '', {
            fontFamily: 'Outfit, Arial, sans-serif',
            fontSize: '15px',
            fontStyle: '800',
            color: '#000000',
            align: 'center',
        }).setOrigin(0.5);
        this.capacityTextShadow.setAlpha(0.5);
        this.container.add(this.capacityTextShadow);
        this._normalGroup.push(this.capacityTextShadow);

        this.capacityText = scene.add.text(0, cargoY + cargoH / 2, '', {
            fontFamily: 'Outfit, Arial, sans-serif',
            fontSize: '15px',
            fontStyle: '800',
            color: '#FFFFFF',
            stroke: '#111111',
            strokeThickness: 4,
            align: 'center',
        }).setOrigin(0.5);
        this.container.add(this.capacityText);
        this._normalGroup.push(this.capacityText);

        this._cargoY = cargoY;
        this._cargoH = cargoH;
        this._barX = barX;
        this._barW = barW;
        this._barMaxH = barMaxH;

        this.updateFillVisual();

        // ── Mystery overlay (drawn on top of normal car) ─────
        this._createMysteryOverlay(w, h);
    }

    _createMysteryOverlay(w, h) {
        const scene = this.scene;
        const mg = scene.add.graphics();

        // Mystery body shadow
        mg.fillStyle(0x000000, 0.3);
        mg.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w, h, 10);

        // Mystery body — dark grey/purple, no colour hint
        mg.fillStyle(0x3A3A55, 1);
        mg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);

        // Roof darker
        mg.fillStyle(0x26263A, 1);
        mg.fillRoundedRect(-w / 2 + 5, -h / 2, w - 10, h * 0.35, { tl: 8, tr: 8, bl: 0, br: 0 });

        // Cargo area — even darker
        const cargoY = -h / 2 + h * 0.38;
        const cargoH = h * 0.50;
        mg.fillStyle(0x1E1E30, 0.8);
        mg.fillRect(-w / 2 + 8, cargoY, w - 16, cargoH);
        mg.lineStyle(1.5, 0x555580, 0.5);
        mg.strokeRect(-w / 2 + 8, cargoY, w - 16, cargoH);

        // Wheels
        const wheelR = 5;
        const wx = w / 2 - 8;
        const wy = h / 2 - 4;
        mg.fillStyle(0x222222, 1);
        mg.fillCircle(-wx, -wy, wheelR);
        mg.fillCircle(wx, -wy, wheelR);
        mg.fillCircle(-wx, wy, wheelR);
        mg.fillCircle(wx, wy, wheelR);
        mg.fillStyle(0x333344, 1);
        mg.fillCircle(-wx, -wy, wheelR - 2);
        mg.fillCircle(wx, -wy, wheelR - 2);
        mg.fillCircle(-wx, wy, wheelR - 2);
        mg.fillCircle(wx, wy, wheelR - 2);

        // Shine
        mg.fillStyle(0xFFFFFF, 0.08);
        mg.fillRoundedRect(-w / 2 + 5, -h / 2 + 3, w - 10, h * 0.2, 5);

        this.container.add(mg);
        this._mysteryGraphics = mg;

        // "?" text — big, centred in cargo area
        const qText = scene.add.text(0, cargoY + cargoH / 2 - 2, '?', {
            fontFamily: 'Outfit, Arial Black, sans-serif',
            fontSize: '28px',
            fontStyle: '900',
            color: '#FFFFFF',
            stroke: '#7B6CF6',
            strokeThickness: 6,
            align: 'center',
        }).setOrigin(0.5);

        // Idle pulse on the "?"
        scene.tweens.add({
            targets: qText,
            alpha: { from: 0.7, to: 1 },
            scaleX: { from: 0.9, to: 1.05 },
            scaleY: { from: 0.9, to: 1.05 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        this.container.add(qText);
        this._mysteryText = qText;
    }

    // Apply or remove mystery visual state without animation
    _applyMysteryState() {
        const isMystery = this.hidden && !this.isRevealed;
        const isNormal = !isMystery;

        // Show/hide normal car visuals
        for (const obj of this._normalGroup) {
            if (obj && obj.setVisible) {
                obj.setVisible(isNormal);
            }
        }

        // Show/hide mystery overlay
        if (this._mysteryGraphics) this._mysteryGraphics.setVisible(isMystery);
        if (this._mysteryText) this._mysteryText.setVisible(isMystery);
    }

    // ────────────────────────────────────────────────────────
    // Reveal animation: mystery → normal car
    // ────────────────────────────────────────────────────────
    reveal() {
        if (this.isRevealed) return Promise.resolve();

        return new Promise(resolve => {
            this.isRevealed = true;

            const scene = this.scene;
            const cx = this.container.x;
            const cy = this.container.y;

            // Particle burst (stars)
            const particles = scene.add.particles(cx, cy, 'particle_star', {
                speed: { min: 60, max: 160 },
                angle: { min: 0, max: 360 },
                scale: { start: 0.9, end: 0 },
                lifespan: 550,
                quantity: 14,
                gravityY: 100,
                tint: [0xFFE66D, 0xFFFFFF, 0x7B6CF6],
            });
            particles.setDepth(60);
            scene.time.delayedCall(650, () => {
                if (particles && particles.destroy) particles.destroy();
            });

            // Kill slide tween and snap to final active position
            scene.tweens.killTweensOf(this.container);
            this.container.setY(CONFIG.CAR_ROW1_Y);
            this.container.setAlpha(1);

            const origScaleX = this.container.scaleX;
            const origScaleY = this.container.scaleY;

            // Flash: scale up slightly while swapping visuals
            scene.tweens.add({
                targets: this.container,
                scaleX: origScaleX * 1.18,
                scaleY: origScaleY * 1.18,
                duration: 100,
                ease: 'Power2',
                onComplete: () => {
                    // Swap visuals mid-animation
                    this._applyMysteryState(); // isRevealed=true now, shows normal

                    scene.tweens.add({
                        targets: this.container,
                        scaleX: origScaleX,
                        scaleY: origScaleY,
                        duration: 220,
                        ease: 'Back.easeOut',
                        onComplete: () => resolve(),
                    });
                },
            });

            // Camera micro-shake
            if (scene.cameras && scene.cameras.main) {
                scene.cameras.main.shake(80, 0.004);
            }
        });
    }

    updateFillVisual() {
        if (!this.fillBar) return;

        const pct = this.capacity > 0
            ? Phaser.Math.Clamp(this.filledCount / this.capacity, 0, 1)
            : 0;

        const colorData = COLORS[this.color];

        this.fillBar.clear();
        this.updateCapacityText();

        if (pct <= 0) return;

        const fillH = Math.max(2, this._barMaxH * pct);
        const fillY = this._cargoY + 1 + (this._barMaxH - fillH);

        this.fillBar.fillStyle(colorData.hex, 1);
        this.fillBar.fillRoundedRect(this._barX, fillY, this._barW, fillH, 3);

        // Shine
        this.fillBar.fillStyle(0xFFFFFF, 0.2);
        this.fillBar.fillRoundedRect(this._barX, fillY, this._barW, Math.min(4, fillH / 2), 2);
    }

    updateCapacityText() {
        if (!this.capacityText) return;

        const safeCapacity = Math.max(0, this.capacity || 0);
        const safeFilled = safeCapacity > 0
            ? Phaser.Math.Clamp(this.filledCount, 0, safeCapacity)
            : Math.max(0, this.filledCount || 0);

        const label = `${safeFilled}/${safeCapacity}`;

        this.capacityText.setText(label);

        if (this.capacityTextShadow) {
            this.capacityTextShadow.setText(label);
        }

        // Full car gets a yellow capacity label.
        if (safeCapacity > 0 && safeFilled >= safeCapacity) {
            this.capacityText.setColor('#FFE66D');
        } else {
            this.capacityText.setColor('#FFFFFF');
        }
    }

    addCube() {
        if (this.reservedCount > 0) {
            this.reservedCount--;
        }

        if (this.isFull()) return true;

        this.filledCount++;
        this.updateFillVisual();

        // Text pop effect when a cube enters the car.
        if (this.capacityText) {
            this.scene.tweens.killTweensOf(this.capacityText);
            this.capacityText.setScale(1.18);
            this.scene.tweens.add({
                targets: this.capacityText,
                scaleX: 1,
                scaleY: 1,
                duration: 120,
                ease: 'Back.easeOut',
            });
        }

        // Car pop effect
        this.scene.tweens.add({
            targets: this.container,
            scaleX: this.isActive ? 1.05 : CONFIG.CAR_ROW2_SCALE * 1.05,
            scaleY: this.isActive ? 1.05 : CONFIG.CAR_ROW2_SCALE * 1.05,
            duration: 60,
            yoyo: true,
            ease: 'Power2',
        });

        return this.isFull();
    }

    getAbsorbPosition() {
        return {
            x: this.container.x,
            y: this.container.y,
        };
    }

    isFull() {
        return this.filledCount >= this.capacity;
    }

    canAccept(cubeColor) {
        return this.color === cubeColor
            && (this.filledCount + this.reservedCount) < this.capacity
            && !this.isExiting;
    }

    reserveCube(cubeColor) {
        if (this.canAccept(cubeColor)) {
            this.reservedCount++;
            return true;
        }

        return false;
    }

    setActive(active) {
        this.isActive = active;

        if (active) {
            this.container.setScale(1);
            this.container.setAlpha(1);
        } else {
            this.container.setScale(CONFIG.CAR_ROW2_SCALE);
            this.container.setAlpha(CONFIG.CAR_ROW2_ALPHA);
        }
    }

    exitAnimation() {
        return new Promise(resolve => {
            this.isExiting = true;

            // Sparkle particles
            const particles = this.scene.add.particles(
                this.container.x,
                this.container.y,
                'particle_star',
                {
                    speed: { min: 80, max: 180 },
                    angle: { min: 0, max: 360 },
                    scale: { start: 0.8, end: 0 },
                    lifespan: 500,
                    quantity: 12,
                    gravityY: 150,
                }
            );

            particles.setDepth(50);
            this.scene.time.delayedCall(600, () => particles.destroy());

            // Bounce
            this.scene.tweens.add({
                targets: this.container,
                scaleX: 1.15,
                scaleY: 1.15,
                duration: 120,
                yoyo: true,
                ease: 'Power2',
                onComplete: () => {
                    // Drive off right
                    this.scene.tweens.add({
                        targets: this.container,
                        x: CONFIG.GAME_WIDTH + 100,
                        duration: CONFIG.CAR_EXIT_DURATION,
                        ease: 'Back.easeIn',
                        onComplete: () => {
                            this.container.setVisible(false);
                            resolve();
                        },
                    });
                },
            });
        });
    }

    slideForward(targetX, targetY) {
        return new Promise(resolve => {
            this.container.setPosition(targetX, CONFIG.CAR_ROW2_Y);
            this.container.setScale(CONFIG.CAR_ROW2_SCALE);
            this.container.setAlpha(CONFIG.CAR_ROW2_ALPHA);

            this.scene.tweens.add({
                targets: this.container,
                x: targetX,
                y: CONFIG.CAR_ROW1_Y,
                scaleX: 1,
                scaleY: 1,
                alpha: 1,
                duration: CONFIG.CAR_ADVANCE_DURATION,
                ease: 'Back.easeOut',
                onComplete: () => {
                    this.isActive = true;
                    resolve();
                },
                onStop: () => {
                    // reveal() kills this tween mid-slide — still resolve so peekCar gets shown
                    this.isActive = true;
                    resolve();
                },
            });
        });
    }

    setPosition(x, y) {
        if (this.container) {
            this.container.setPosition(x, y);
        }

        this.x = x;
        this.y = y;
    }

    destroy() {
        if (this.container) {
            this.container.destroy();
        }
    }
};