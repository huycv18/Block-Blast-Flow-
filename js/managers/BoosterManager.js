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
        this.activeBooster = null; // null | 'magnet' | 'paintGun'
        this.highlightedBlocks = [];
    }

    // --- Magnet ---

    activateMagnet(board) {
        if (this.counts.magnet <= 0) return false;
        this.activeBooster = 'magnet';

        // Highlight visible but blocked blocks
        this.highlightedBlocks = [];
        for (const [id, block] of board.blocks) {
            if (block.state === 'blocked') {
                this.highlightedBlocks.push(block);
                if (block.container) {
                    block.container.setAlpha(1);
                    // Add glow effect
                    this.scene.tweens.add({
                        targets: block.container,
                        alpha: 0.7,
                        duration: 400,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut',
                    });
                }
            }
        }

        this.scene.events.emit('boosterTargeting', 'magnet');
        return true;
    }

    async useMagnetOn(block, board) {
        if (this.activeBooster !== 'magnet') return;
        if (block.state !== 'blocked') return;

        this.counts.magnet--;
        this.cancelTargeting();

        // Extract block like normal pull
        this.scene.gameState.setState('ANIMATING');

        // Magnetic pull VFX
        const center = block.getScreenCenter();
        const particles = this.scene.add.particles(center.x, center.y, 'particle_star', {
            speed: { min: 20, max: 60 },
            scale: { start: 0.6, end: 0 },
            lifespan: 400,
            quantity: 8,
            tint: 0x9B59B6,
        });
        this.scene.time.delayedCall(500, () => particles.destroy());

        await block.shake();
        await block.liftUp();
        const cubes = this.scene.cubeManager.spawnFromBlock(block);
        await block.blast();
        board.removeBlock(block);

        this.scene.time.delayedCall(800, () => {
            this.scene.gameState.setState('PLAYING');
            this.scene.gameState.checkWinCondition(board, this.scene.conveyor, this.scene.funnel);
        });

        this.scene.events.emit('boosterUsed', 'magnet', this.counts.magnet);
    }

    // --- Shuffle ---

    activateShuffle(board, carManager) {
        if (this.counts.shuffle <= 0) return false;
        this.counts.shuffle--;

        const pullable = board.getPullableBlocks();
        const pullableColors = new Set(pullable.map(b => b.color));
        carManager.shuffleForColors(pullableColors);

        this.scene.events.emit('boosterUsed', 'shuffle', this.counts.shuffle);
        return true;
    }

    // --- Paint Gun ---

    activatePaintGun(board) {
        if (this.counts.paintGun <= 0) return false;
        this.activeBooster = 'paintGun';

        // Highlight pullable blocks grouped by color
        this.highlightedBlocks = board.getPullableBlocks();
        for (const block of this.highlightedBlocks) {
            if (block.container) {
                this.scene.tweens.add({
                    targets: block.container,
                    alpha: 0.7,
                    duration: 300,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                });
            }
        }

        this.scene.events.emit('boosterTargeting', 'paintGun');
        return true;
    }

    async usePaintGunOn(block, board, carManager, cubeManager) {
        if (this.activeBooster !== 'paintGun') return;
        if (block.state !== 'pullable') return;

        const targetColor = block.color;
        this.counts.paintGun--;
        this.cancelTargeting();

        this.scene.gameState.setState('ANIMATING');

        // Find all pullable blocks of same color
        const targets = board.getPullableBlocks().filter(b => b.color === targetColor);

        // Blast them sequentially with stagger
        for (let i = 0; i < targets.length; i++) {
            const b = targets[i];

            // Paint splash VFX
            const center = b.getScreenCenter();
            const particles = this.scene.add.particles(center.x, center.y, 'particle_' + targetColor, {
                speed: { min: 100, max: 250 },
                scale: { start: 1, end: 0 },
                lifespan: 600,
                quantity: 15,
            });
            this.scene.time.delayedCall(700, () => particles.destroy());

            // Blast block
            await b.shake();
            await b.blast();

            // Cubes go directly to cars (skip conveyor)
            const cubeCount = SHAPES[b.shapeName].unitCount * CONFIG.CUBES_PER_CELL;
            let remaining = cubeCount;

            // Fill cars directly
            while (remaining > 0) {
                const car = carManager.findMatchingActiveCar(targetColor);
                if (!car) break;

                const toFill = Math.min(remaining, car.capacity - car.filledCount);
                for (let j = 0; j < toFill; j++) {
                    const isFull = car.addCube();
                    remaining--;
                    if (isFull) {
                        await carManager.onCarFull(car);
                        break;
                    }
                }
            }

            board.removeBlock(b);

            // Stagger between blocks
            if (i < targets.length - 1) {
                await new Promise(r => this.scene.time.delayedCall(200, r));
            }
        }

        this.scene.gameState.setState('PLAYING');
        this.scene.gameState.checkWinCondition(board, this.scene.conveyor, this.scene.funnel);
        this.scene.events.emit('boosterUsed', 'paintGun', this.counts.paintGun);
    }

    // --- Common ---

    cancelTargeting() {
        this.activeBooster = null;
        // Remove highlight tweens
        for (const block of this.highlightedBlocks) {
            if (block.container) {
                this.scene.tweens.killTweensOf(block.container);
                block.container.setAlpha(1);
            }
        }
        this.highlightedBlocks = [];
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
