// ============================================================
// BoosterManager — Magnet, Shuffle, Paint Gun
// ============================================================

window.BoosterManager = class BoosterManager {
    constructor(scene, boosterCounts) {
        this.scene = scene;

        this.counts = {
            magnet: boosterCounts?.magnet || 0,
            shuffle: boosterCounts?.shuffle || 0,
            paintGun: boosterCounts?.paintGun || 0,
        };

        // null | 'magnet' | 'paintGun'
        this.activeBooster = null;

        this.highlightedBlocks = [];
        this.highlightTweens = new Map();
    }

    // ----------------------------------------------------------
    // Target helpers
    // ----------------------------------------------------------

    getMagnetTargets(board) {
        if (!board || !board.blocks) return [];

        const result = [];

        for (const [id, block] of board.blocks) {
            if (block &&
                block.state === 'blocked' &&
                !(block.isFrozen && block.isFrozen()) &&
                !block.isLocked) {
                result.push(block);
            }
        }

        return result;
    }

    getPaintGunTopLayerTargets(board) {
        if (!board || !board.getPullableBlocks) return [];

        const pullable = board.getPullableBlocks().filter(block => {
            return block &&
                block.state === 'pullable' &&
                !(block.isFrozen && block.isFrozen()) &&
                !block.isLocked &&
                !block.isResolving;
        });

        if (pullable.length === 0) return [];

        // Higher layer index = visually on top.
        const topLayer = Math.max(...pullable.map(block => block.layer || 0));

        return pullable.filter(block => block.layer === topLayer);
    }

    highlightBlocks(blocks, options = {}) {
        const alpha = options.alpha ?? 0.72;
        const duration = options.duration ?? 350;

        this.highlightedBlocks = blocks;

        for (const block of blocks) {
            if (!block || !block.container || !block.container.scene) continue;

            this.scene.tweens.killTweensOf(block.container);
            block.container.setAlpha(1);

            const tween = this.scene.tweens.add({
                targets: block.container,
                alpha,
                duration,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });

            this.highlightTweens.set(block, tween);
        }
    }

    delay(ms) {
        return new Promise(resolve => {
            this.scene.time.delayedCall(ms, resolve);
        });
    }

    // ----------------------------------------------------------
    // Magnet
    // ----------------------------------------------------------

    activateMagnet(board) {
        if (this.counts.magnet <= 0) return false;

        if (this.activeBooster === 'magnet') {
            this.cancelTargeting();
            return false;
        }

        if (this.activeBooster) {
            this.cancelTargeting();
        }

        const targets = this.getMagnetTargets(board);

        if (targets.length === 0) {
            this.scene.events.emit('boosterFailed', 'magnet', 'noTargets');
            return false;
        }

        this.activeBooster = 'magnet';

        this.highlightBlocks(targets, {
            alpha: 0.70,
            duration: 400,
        });

        this.scene.events.emit('boosterTargeting', 'magnet');
        return true;
    }

    async useMagnetOn(block, board) {
        if (this.activeBooster !== 'magnet') return false;
        if (block && block.isLocked) {
            if (block.shakeLocked) await block.shakeLocked();
            return false;
        }
        if (block && block.isFrozen && block.isFrozen()) {
            if (block.shakeFrozen) await block.shakeFrozen();
            return false;
        }
        if (!block || block.state !== 'blocked') return false;
        if (this.counts.magnet <= 0) return false;

        // Magnet cubes flow through Funnel — block if Funnel is at capacity.
        if (this.scene.funnel && this.scene.funnel.isFull()) {
            this.scene.funnel.flashFull();
            return false;
        }

        this.counts.magnet--;
        this.cancelTargeting();

        block.isResolving = true;
        this.scene.gameState.setState('ANIMATING');

        const center = block.getScreenCenter();

        const particles = this.scene.add.particles(center.x, center.y, 'particle_star', {
            speed: { min: 20, max: 60 },
            scale: { start: 0.6, end: 0 },
            lifespan: 400,
            quantity: 8,
            tint: 0x9B59B6,
        });

        particles.setDepth(60);

        this.scene.time.delayedCall(500, () => {
            if (particles && particles.destroy) particles.destroy();
        });

        // Snapshot before removing so only already-revealed blocks count down.
        const frozenCountdownTargets = board.getFrozenCountdownTargets
            ? board.getFrozenCountdownTargets()
            : [];

        await block.shake();
        await block.liftUp();

        // Cubes still flow through Funnel/Conveyor per GDD.
        this.scene.cubeManager.spawnFromBlock(block);

        board.removeBlock(block);
        if (block.keyColor && board.activateKey) {
            board.activateKey(block.keyColor, block);
        }
        block.blast();

        if (board.decreaseFrozenCounts) {
            board.decreaseFrozenCounts(1, {
                animate: true,
                targets: frozenCountdownTargets,
            });
        }

        this.scene.cameras.main.shake(80, 0.005);
        this.scene.resolvePostBoardChange();

        this.scene.events.emit('boosterUsed', 'magnet', this.counts.magnet);
        return true;
    }

    // ----------------------------------------------------------
    // Shuffle
    // ----------------------------------------------------------

    activateShuffle(board, carManager) {
        if (this.counts.shuffle <= 0) return false;

        if (this.activeBooster) {
            this.cancelTargeting();
        }

        board = board || this.scene.board;
        carManager = carManager || this.scene.carManager;

        if (!board || !carManager) return false;

        const pullableBlocks = board.getPullableBlocks
            ? board.getPullableBlocks()
            : [];

        if (pullableBlocks.length === 0) {
            this.scene.events.emit('boosterFailed', 'shuffle', 'noPullableBlocks');
            return false;
        }

        const didShuffle = carManager.shuffleForPullableBlocks(pullableBlocks);

        if (!didShuffle) {
            this.scene.events.emit('boosterFailed', 'shuffle', 'noChange');
            return false;
        }

        this.counts.shuffle--;

        this.scene.events.emit('boosterUsed', 'shuffle', this.counts.shuffle);
        return true;
    }

    // ----------------------------------------------------------
    // Paint Gun
    // ----------------------------------------------------------

    activatePaintGun(board) {
        if (this.counts.paintGun <= 0) return false;

        if (this.activeBooster === 'paintGun') {
            this.cancelTargeting();
            return false;
        }

        if (this.activeBooster) {
            this.cancelTargeting();
        }

        const targets = this.getPaintGunTopLayerTargets(board);

        if (targets.length === 0) {
            this.scene.events.emit('boosterFailed', 'paintGun', 'noTargets');
            return false;
        }

        this.activeBooster = 'paintGun';

        this.highlightBlocks(targets, {
            alpha: 0.72,
            duration: 300,
        });

        this.scene.events.emit('boosterTargeting', 'paintGun');
        return true;
    }

    async usePaintGunOn(block, board, carManager, cubeManager) {
        if (this.activeBooster !== 'paintGun') return false;
        if (block && block.isLocked) {
            if (block.shakeLocked) await block.shakeLocked();
            return false;
        }
        if (block && block.isFrozen && block.isFrozen()) {
            if (block.shakeFrozen) await block.shakeFrozen();
            return false;
        }
        if (!block || block.state !== 'pullable') return false;
        if (this.counts.paintGun <= 0) return false;

        const topLayerTargets = this.getPaintGunTopLayerTargets(board);
        // Snapshot before Paint Gun removes blocks — newly revealed frozen blocks won't count down yet.
        const frozenCountdownTargets = board.getFrozenCountdownTargets
            ? board.getFrozenCountdownTargets()
            : [];

        let resolvedBlastCount = 0;

        // Only allow targeting blocks on the current top layer.
        if (!topLayerTargets.includes(block)) {
            if (block.shake) await block.shake();
            return false;
        }

        const targetColor = block.color;

        // Only blast same-color blocks on the current top layer that are pullable.
        const targets = topLayerTargets.filter(b => {
            return b &&
                b.color === targetColor &&
                b.state === 'pullable' &&
                !(b.isFrozen && b.isFrozen()) &&
                !b.isLocked &&
                !b.isResolving;
        });

        if (targets.length === 0) return false;

        const availableSlots = carManager.getPaintGunAvailableCapacity
            ? carManager.getPaintGunAvailableCapacity(targetColor)
            : 0;

        if (availableSlots <= 0) {
            this.scene.events.emit('boosterFailed', 'paintGun', 'noMatchingCar');
            return false;
        }

        this.counts.paintGun--;
        this.cancelTargeting();

        this.scene.gameState.setState('ANIMATING');

        const sourcePositions = [];
        let totalCubeCount = 0;

        for (const b of targets) {
            b.isResolving = true;

            const positions = b.getCubeSpawnPositions
                ? b.getCubeSpawnPositions()
                : [b.getScreenCenter()];

            sourcePositions.push(...positions);

            const unitCount = Array.isArray(b.cells) ? b.cells.length : 1;
            totalCubeCount += unitCount * (CONFIG.CUBES_PER_CELL || 4);
        }

        // Cap to available slots in case level data has insufficient car capacity.
        const cubeCountToSend = Math.min(totalCubeCount, availableSlots);

        // Slight stagger between blasts for a chain-reaction feel.
        const PAINT_BLOCK_STAGGER = 55;

        const blastPromises = targets.map((b, index) => {
            return this.delay(index * PAINT_BLOCK_STAGGER).then(async () => {
                if (!b || !board.blocks.has(b.id)) return;

                const center = b.getScreenCenter();

                const particles = this.scene.add.particles(center.x, center.y, 'particle_' + targetColor, {
                    speed: { min: 120, max: 280 },
                    scale: { start: 1, end: 0 },
                    lifespan: 600,
                    quantity: 18,
                });

                particles.setDepth(70);

                this.scene.time.delayedCall(650, () => {
                    if (particles && particles.destroy) particles.destroy();
                });

                await b.shake();
                await b.liftUp();

                board.removeBlock(b);
                if (b.keyColor && board.activateKey) {
                    board.activateKey(b.keyColor, b);
                }

                // Paint Gun does not spawn cubes into Funnel/Conveyor.
                b.blast();

                resolvedBlastCount++;

                this.scene.cameras.main.shake(50, 0.004);
            });
        });

        await Promise.all(blastPromises);
        // Each blasted block counts as one frozen-count decrement,
        // but only for blocks that were already revealed before Paint Gun fired.
        if (board.decreaseFrozenCounts && resolvedBlastCount > 0) {
            board.decreaseFrozenCounts(resolvedBlastCount, {
                animate: true,
                targets: frozenCountdownTargets,
            });
        }

        await this.sendPaintGunCubesBurstToCars(
            targetColor,
            cubeCountToSend,
            sourcePositions,
            carManager
        );

        this.scene.resolvePostBoardChange();
        this.scene.events.emit('boosterUsed', 'paintGun', this.counts.paintGun);

        return true;
    }

    /**
     * Paint Gun direct burst:
     * - Allocate cubes to all same-color cars with free capacity.
     * - Active and non-active queue cars can all receive cubes.
     * - Cubes fly almost at the same time, not one-by-one.
     */
    async sendPaintGunCubesBurstToCars(color, cubeCount, sourcePositions, carManager) {
        if (cubeCount <= 0) return;

        const sources = sourcePositions && sourcePositions.length > 0
            ? sourcePositions
            : [{ x: CONFIG.CONTAINER_X, y: CONFIG.CONTAINER_GRID_BOTTOM }];

        const allocations = carManager.allocatePaintGunCubes
            ? carManager.allocatePaintGunCubes(color, cubeCount)
            : [];

        if (allocations.length === 0) return;

        const flyPromises = [];
        let globalIndex = 0;

        for (const allocation of allocations) {
            const car = allocation.car;
            const amount = allocation.amount;

            if (!car || amount <= 0) continue;

            // Show non-active queue cars temporarily so the player sees cubes fly in.
            if (carManager.prepareCarForPaintGunFill) {
                carManager.prepareCarForPaintGunFill(car);
            }

            for (let i = 0; i < amount; i++) {
                const source = sources[globalIndex % sources.length];

                // Tiny stagger so cubes look like a burst, not a sequence.
                const startDelay = Math.floor(globalIndex / 6) * 12 + Phaser.Math.Between(0, 18);

                flyPromises.push(
                    this.flyPaintCubeToCarBurst(color, source, car, globalIndex, startDelay)
                        .then(() => {
                            this.addDirectCubeToCar(car);
                        })
                );

                globalIndex++;
            }
        }

        await Promise.all(flyPromises);

        // Resolve full cars only after the entire burst lands, so all cars appear to fill simultaneously.
        if (carManager.resolvePaintGunFullCars) {
            await carManager.resolvePaintGunFullCars(color);
        }
    }

    flyPaintCubeToCarBurst(color, from, car, index = 0, startDelay = 0) {
        return new Promise(resolve => {
            if (!car || !car.container || !car.container.scene) {
                resolve();
                return;
            }

            this.scene.time.delayedCall(startDelay, () => {
                if (!car || !car.container || !car.container.scene) {
                    resolve();
                    return;
                }

                const target = car.getAbsorbPosition
                    ? car.getAbsorbPosition()
                    : { x: car.container.x, y: car.container.y };

                const sprite = this.scene.add.image(from.x, from.y, 'cube_' + color);
                sprite.setDepth(90);
                sprite.setScale(0.86);
                sprite.setAlpha(1);

                const jitterX = Phaser.Math.Between(-12, 12);
                const jitterY = Phaser.Math.Between(-8, 8);

                const midX = (from.x + target.x) / 2 + Phaser.Math.Between(-25, 25);
                const midY = (from.y + target.y) / 2 - Phaser.Math.Between(20, 55);

                this.scene.tweens.add({
                    targets: sprite,
                    x: midX,
                    y: midY,
                    scaleX: 0.78,
                    scaleY: 0.78,
                    duration: 90,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        if (!sprite || !sprite.scene) {
                            resolve();
                            return;
                        }

                        this.scene.tweens.add({
                            targets: sprite,
                            x: target.x + jitterX,
                            y: target.y + jitterY,
                            scaleX: 0.48,
                            scaleY: 0.48,
                            alpha: 0.95,
                            duration: 130 + (index % 5) * 8,
                            ease: 'Cubic.easeIn',
                            onComplete: () => {
                                if (sprite && sprite.destroy) sprite.destroy();
                                resolve();
                            },
                        });
                    },
                });
            });
        });
    }

    addDirectCubeToCar(car) {
        if (!car) return false;
        if (car.isFull && car.isFull()) return true;

        car.filledCount = Math.min(car.capacity, car.filledCount + 1);

        if (car.updateFillVisual) {
            car.updateFillVisual();
        }

        if (car.container && car.container.scene) {
            const targetScale = car.isActive
                ? 1.06
                : (CONFIG.CAR_ROW2_SCALE || 0.82) * 1.06;

            this.scene.tweens.add({
                targets: car.container,
                scaleX: targetScale,
                scaleY: targetScale,
                duration: 45,
                yoyo: true,
                ease: 'Power2',
            });
        }

        return car.isFull ? car.isFull() : car.filledCount >= car.capacity;
    }

    // ----------------------------------------------------------
    // Common
    // ----------------------------------------------------------

    cancelTargeting() {
        for (const tween of this.highlightTweens.values()) {
            if (tween && tween.stop) {
                tween.stop();
            }
        }

        this.highlightTweens.clear();

        for (const block of this.highlightedBlocks) {
            if (block && block.container && block.container.scene) {
                block.container.setAlpha(1);
            }
        }

        this.highlightedBlocks = [];
        this.activeBooster = null;

        this.scene.events.emit('boosterTargeting', null);
    }

    getCount(type) {
        return this.counts[type] || 0;
    }

    isTargeting() {
        return this.activeBooster !== null;
    }

    getActiveBooster() {
        return this.activeBooster;
    }
};
