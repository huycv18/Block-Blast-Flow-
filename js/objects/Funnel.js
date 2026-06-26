// ============================================================
// Funnel — Deterministic queue funnel
// Cubes still fall with Matter.js for visual feel, but the funnel
// captures them into a stable buffer and drains them to Conveyor.
// ============================================================

window.Funnel = class Funnel {
    constructor(scene, capacity = CONFIG.FUNNEL_CAPACITY) {
        this.scene = scene;
        this.capacity = capacity ?? CONFIG.FUNNEL_CAPACITY;

        // Main buffer. A cube in this array is already owned by Funnel.
        this.cubesInFunnel = [];

        // Cubes currently tweening from Funnel to Conveyor.
        this.drainingCubes = new Set();

        // Kept for compatibility with older Revive/GameState code.
        this.drainTimer = null;
        this.isDraining = false;

        this.nextDrainAt = 0;
        this.overflowed = false;
        this.destroyed = false;

        // Cached layout values.
        this.cx = CONFIG.CONTAINER_X;
        this.gridBottom = CONFIG.CONTAINER_GRID_BOTTOM;
        this.funnelBottom = CONFIG.CONTAINER_FUNNEL_BOTTOM;
        this.containerWidth = CONFIG.CONTAINER_WIDTH;
        this.drainWidth = CONFIG.FUNNEL_DRAIN_WIDTH;

        this.catchTop = this.gridBottom - 4;
        this.catchBottom = this.funnelBottom + 26;
        this.drainX = this.cx;
        this.drainY = this.funnelBottom - 8;

        this.bodies = [];
        this.gfx = null;

        this.createVisuals();
        this.createWalls();
    }

    // ───────────────────────────────────────
    // Visual + physics walls
    // ───────────────────────────────────────

    createVisuals() {
        const g = this.scene.add.graphics();
        g.setDepth(4);
        this.gfx = g;

        const left = this.cx - this.containerWidth / 2;
        const right = this.cx + this.containerWidth / 2;
        const drainLeft = this.cx - this.drainWidth / 2;
        const drainRight = this.cx + this.drainWidth / 2;
        const topY = this.gridBottom;
        const bottomY = this.funnelBottom;

        // Soft translucent funnel body.
        g.fillStyle(THEME.CONTAINER_FILL, 0.55);
        g.lineStyle(3, THEME.CONTAINER_STROKE, 0.9);
        g.beginPath();
        g.moveTo(left, topY);
        g.lineTo(right, topY);
        g.lineTo(drainRight, bottomY);
        g.lineTo(drainLeft, bottomY);
        g.closePath();
        g.fillPath();
        g.strokePath();

        // Drain mouth.
        g.fillStyle(0x252535, 0.95);
        g.lineStyle(2, THEME.CONTAINER_STROKE, 0.8);
        g.fillRoundedRect(drainLeft - 5, bottomY - 5, this.drainWidth + 10, 14, 6);
        g.strokeRoundedRect(drainLeft - 5, bottomY - 5, this.drainWidth + 10, 14, 6);
    }

    createWalls() {
        const cx = this.cx;
        const w = this.containerWidth;
        const gridBot = this.gridBottom;
        const funBot = this.funnelBottom;
        const drainW = this.drainWidth;

        const left = cx - w / 2;
        const right = cx + w / 2;
        const drainLeft = cx - drainW / 2;
        const drainRight = cx + drainW / 2;

        const wallOptions = {
            isStatic: true,
            friction: 0.2,
            frictionStatic: 0.7,
            restitution: 0,
            collisionFilter: { category: 0x0001, mask: 0x0002 },
        };

        // Top side walls keep cubes inside the board container before they enter the funnel.
        const topY = CONFIG.BOARD_OFFSET_Y;
        this.addWall(left - 3, (topY + gridBot) / 2, 6, gridBot - topY, 0, wallOptions);
        this.addWall(right + 3, (topY + gridBot) / 2, 6, gridBot - topY, 0, wallOptions);

        // Sloped funnel walls.
        this.addSegmentWall(left, gridBot, drainLeft, funBot, 7, wallOptions);
        this.addSegmentWall(right, gridBot, drainRight, funBot, 7, wallOptions);

        // Invisible stopper under the drain.
        // It prevents physics bodies from tunneling out before Funnel.update() captures them.
        this.addWall(cx, funBot + 8, drainW + 18, 8, 0, wallOptions);
    }

    addWall(x, y, width, height, angle, options) {
        const body = this.scene.matter.add.rectangle(x, y, width, height, {
            ...options,
            angle,
        });

        this.bodies.push(body);
        return body;
    }

    addSegmentWall(x1, y1, x2, y2, thickness, options) {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        return this.addWall(midX, midY, len, thickness, angle, options);
    }

    // ───────────────────────────────────────
    // Capture logic
    // ───────────────────────────────────────

    update(conveyor) {
        if (this.destroyed) return;

        this.purgeInvalidDrainingCubes();
        this.capturePhysicsCubes();
        this.arrangeQueuedCubes(false);
        this.tryDrain(conveyor);
    }

    capturePhysicsCubes() {
        const cubeManager = this.scene.cubeManager;
        if (!cubeManager) return;

        const now = Date.now();
        const active = cubeManager.getActiveCubes
            ? cubeManager.getActiveCubes()
            : cubeManager.active;

        if (!active) return;

        for (let i = active.length - 1; i >= 0; i--) {
            const cube = active[i];

            if (!cube || cube.state !== 'PHYSICS' || !cube.body) continue;

            const pos = cube.body.position;

            // Gently guide cubes toward the center as they enter the funnel.
            if (pos.y > this.gridBottom - 18) {
                const dx = this.cx - pos.x;

                this.scene.matter.body.applyForce(cube.body, pos, {
                    x: Phaser.Math.Clamp(dx, -80, 80) * 0.00008,
                    y: 0.00003,
                });
            }

            const insideFunnel = this.isPointInsideFunnel(pos.x, pos.y);
            const belowSafetyLine = pos.y > this.catchBottom;
            const timedOut = now - cube.stateTime > 2200;

            if (insideFunnel || belowSafetyLine || timedOut) {
                this.addCube(cube);
            }
        }
    }

    isPointInsideFunnel(x, y) {
        if (y < this.catchTop || y > this.catchBottom) return false;

        const t = Phaser.Math.Clamp(
            (y - this.gridBottom) / Math.max(1, this.funnelBottom - this.gridBottom),
            0,
            1
        );

        // Funnel width narrows from container width to drain width.
        const widthAtY = Phaser.Math.Linear(this.containerWidth, this.drainWidth + 16, t);

        return Math.abs(x - this.cx) <= widthAtY / 2 + 8;
    }

    addCube(cube) {
        if (!cube || this.destroyed) return false;

        if (this.cubesInFunnel.includes(cube) || this.drainingCubes.has(cube)) {
            return true;
        }

        if (this.isFull()) {
            this.overflowed = true;
            return false;
        }

        if (cube.body) {
            cube.sprite.setPosition(cube.body.position.x, cube.body.position.y);
            this.scene.matter.world.remove(cube.body);
            cube.body = null;
        }

        this.scene.tweens.killTweensOf(cube.sprite);

        cube.state = 'IN_FUNNEL';
        cube.stateTime = Date.now();
        cube.funnelSlotIndex = null;
        cube.sprite.setVisible(true);
        cube.sprite.setAlpha(1);
        cube.sprite.setScale(0.95);

        this.cubesInFunnel.push(cube);
        this.arrangeQueuedCubes(true);

        return true;
    }

    // ───────────────────────────────────────
    // Queue layout + drain
    // ───────────────────────────────────────

    arrangeQueuedCubes(animated) {
        for (let i = 0; i < this.cubesInFunnel.length; i++) {
            const cube = this.cubesInFunnel[i];

            if (!cube || cube.state !== 'IN_FUNNEL') continue;

            const slot = this.getSlotPosition(i);

            if (cube.funnelSlotIndex === i && !animated) continue;

            cube.funnelSlotIndex = i;

            if (animated) {
                this.scene.tweens.killTweensOf(cube.sprite);

                this.scene.tweens.add({
                    targets: cube.sprite,
                    x: slot.x,
                    y: slot.y,
                    scaleX: 0.9,
                    scaleY: 0.9,
                    duration: 110,
                    ease: 'Sine.easeOut',
                });
            } else {
                cube.sprite.setPosition(slot.x, slot.y);
                cube.sprite.setScale(0.9);
            }
        }
    }

    getSlotPosition(index) {
        // Compact storage inside the funnel:
        // 8 cubes per row, up to 5 rows for 40 cap.
        const perRow = 8;
        const spacingX = 11;
        const spacingY = 10;

        const row = Math.floor(index / perRow);
        const col = index % perRow;

        const itemsInRow = Math.min(
            perRow,
            this.capacity - row * perRow,
            this.cubesInFunnel.length - row * perRow
        );

        const rowWidth = Math.max(0, (itemsInRow - 1) * spacingX);

        // Bottom row is closest to drain. Newer rows stack upward.
        return {
            x: this.cx - rowWidth / 2 + col * spacingX,
            y: this.funnelBottom - 14 - row * spacingY,
        };
    }

    tryDrain(conveyor) {
        if (!conveyor) return;
        if (this.cubesInFunnel.length === 0) return;
        if (conveyor.isFull()) return;

        const now = Date.now();

        if (now < this.nextDrainAt) return;

        const cube = this.cubesInFunnel.shift();

        if (!cube || cube.state === 'INACTIVE' || cube.state === 'DONE') {
            this.arrangeQueuedCubes(true);
            return;
        }

        cube.state = 'DRAINING';
        cube.stateTime = now;
        cube.funnelSlotIndex = null;

        this.drainingCubes.add(cube);

        this.nextDrainAt = now + (CONFIG.DRAIN_INTERVAL || 40);

        this.arrangeQueuedCubes(true);

        const entryT = conveyor.getEntryT();
        const entryPos = conveyor.getPathPosition(entryT);

        this.scene.tweens.killTweensOf(cube.sprite);

        this.scene.tweens.add({
            targets: cube.sprite,
            x: entryPos.x,
            y: entryPos.y,
            scaleX: 0.82,
            scaleY: 0.82,
            duration: 140,
            ease: 'Power2',
            onComplete: () => {
                this.drainingCubes.delete(cube);

                if (this.destroyed || cube.state === 'INACTIVE' || cube.state === 'DONE' || cube.state === 'REVIVING') {
                    return;
                }

                // Conveyor may have become full while the tween was running.
                // Put the cube back at the front instead of losing it.
                if (conveyor.isFull()) {
                    cube.state = 'IN_FUNNEL';
                    cube.stateTime = Date.now();

                    this.cubesInFunnel.unshift(cube);
                    this.arrangeQueuedCubes(true);

                    return;
                }

                cube.sprite.setScale(1);
                conveyor.addCube(cube);
            },
        });
    }

    // Kept for compatibility with old code.
    // Draining is now update-driven.
    startDraining(conveyor) {
        this.tryDrain(conveyor);
    }

    drainOne(conveyor) {
        this.tryDrain(conveyor);
    }

    // ───────────────────────────────────────
    // Queries / cleanup
    // ───────────────────────────────────────

    purgeInvalidDrainingCubes() {
        for (const cube of Array.from(this.drainingCubes)) {
            if (
                !cube ||
                cube.state === 'INACTIVE' ||
                cube.state === 'DONE' ||
                cube.state === 'REVIVING' ||
                !cube.sprite ||
                !cube.sprite.scene
            ) {
                this.drainingCubes.delete(cube);
            }
        }
    }

    getCubeCount() {
        this.purgeInvalidDrainingCubes();
        return this.cubesInFunnel.length + this.drainingCubes.size;
    }

    getLoadPercent() {
        if (this.capacity <= 0) return 1;

        return this.getCubeCount() / this.capacity;
    }

    isFull() {
        return this.getCubeCount() >= this.capacity;
    }

    // Flash red to signal the player that the Funnel is full and no more blocks can be tapped.
    flashFull() {
        if (this._flashTween) return;

        const midY = (this.gridBottom + this.funnelBottom) / 2;
        const flash = this.scene.add.rectangle(
            this.cx,
            midY,
            this.containerWidth,
            this.funnelBottom - this.gridBottom + 20,
            0xFF3333,
            0.38
        );
        flash.setDepth(30);

        this._flashTween = this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 380,
            ease: 'Quad.easeOut',
            onComplete: () => {
                flash.destroy();
                this._flashTween = null;
            },
        });
    }

    hasOverflowed() {
        return this.overflowed;
    }

    clear() {
        if (this.drainTimer) {
            this.drainTimer.remove(false);
            this.drainTimer = null;
        }

        this.isDraining = false;

        for (const cube of this.cubesInFunnel) {
            this.releaseFunnelCube(cube);
        }

        for (const cube of this.drainingCubes) {
            this.releaseFunnelCube(cube);
        }

        this.cubesInFunnel = [];
        this.drainingCubes.clear();
        this.overflowed = false;
    }

    releaseFunnelCube(cube) {
        if (!cube) return;

        if (cube.sprite && cube.sprite.scene) {
            this.scene.tweens.killTweensOf(cube.sprite);
        }

        if (cube.body) {
            this.scene.matter.world.remove(cube.body);
            cube.body = null;
        }

        cube.funnelSlotIndex = null;
        cube.state = 'DONE';
    }

    destroy() {
        this.destroyed = true;

        this.clear();

        for (const body of this.bodies) {
            if (body) {
                this.scene.matter.world.remove(body);
            }
        }

        this.bodies = [];

        if (this.gfx) {
            this.gfx.destroy();
            this.gfx = null;
        }
    }
};