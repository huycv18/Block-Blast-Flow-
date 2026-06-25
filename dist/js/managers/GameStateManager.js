// ============================================================
// GameStateManager — State machine for game flow
// ============================================================

window.GameStateManager = class GameStateManager {
    constructor(scene) {
        this.scene = scene;
        this.state = 'IDLE';
        this.previousState = null;
        this.isReviving = false;
    }

    setState(newState) {
        const validTransitions = {
            'IDLE': ['PLAYING'],
            'PLAYING': ['ANIMATING', 'CLEANUP', 'WIN', 'LOSE'],
            'ANIMATING': ['PLAYING', 'CLEANUP', 'WIN', 'LOSE'],
            'CLEANUP': ['WIN', 'LOSE', 'PLAYING'],
            'WIN': ['IDLE'],
            'LOSE': ['PLAYING', 'IDLE'],
        };

        const allowed = validTransitions[this.state];

        if (!allowed || !allowed.includes(newState)) {
            console.warn(`State transition ${this.state} → ${newState} (non-standard)`);
        }

        this.previousState = this.state;
        this.state = newState;
        this.scene.events.emit('stateChange', newState, this.previousState);
    }

    getState() {
        return this.state;
    }

    isInputLocked() {
        return this.state !== 'PLAYING';
    }

    /**
     * GDD Win Condition:
     * WIN only when Board is empty AND all Cars are complete.
     */
    checkWinCondition(board, carManager) {
        if (!board || !carManager) return false;
        if (!board.isEmpty()) return false;
        if (!carManager.allCarsComplete()) return false;

        this.enterWin();
        return true;
    }

    /**
     * Lose can happen during PLAYING or CLEANUP.
     */
    checkLoseCondition(conveyor, carManager, board = null, funnel = null, cubeManager = null) {
        if (this.isReviving) return false;
        if (this.state === 'WIN' || this.state === 'LOSE' || this.state === 'IDLE') return false;
        if (!conveyor || !carManager) return false;

        const flowBusy = this.isFlowBusy(funnel, cubeManager, carManager);

        // Normal lose:
        // Conveyor full + no cube can be handled by active cars.
        if (conveyor.isFull()) {
            if (flowBusy) return false;

            const cubeColors = conveyor.getCubeColors();

            if (!carManager.canMatchAnyColor(cubeColors)) {
                this.enterLose();
                return true;
            }
        }

        // Cleanup deadlock:
        // Board empty, no cubes left, but cars still not cleared.
        if (this.state === 'CLEANUP' && board && board.isEmpty() && !carManager.allCarsComplete()) {
            const conveyorEmpty = conveyor.getCurrentLoad() === 0;
            const funnelEmpty = !funnel || funnel.getCubeCount() === 0;
            const noActiveCubes = !cubeManager || cubeManager.getActiveCubes().length === 0;

            if (conveyorEmpty && funnelEmpty && noActiveCubes && !flowBusy) {
                this.enterLose();
                return true;
            }
        }

        return false;
    }

    isFlowBusy(funnel = null, cubeManager = null, carManager = null) {
        if (carManager && carManager.hasTransitioningCars && carManager.hasTransitioningCars()) {
            return true;
        }

        if (!cubeManager) return false;

        return cubeManager.getActiveCubes().some(cube =>
            cube.state === 'SPAWNING' ||
            cube.state === 'PHYSICS' ||
            cube.state === 'DRAINING' ||
            cube.state === 'MATCHING' ||
            cube.state === 'REVIVING'
        );
    }

    enterCleanup(conveyor) {
        if (this.state !== 'CLEANUP') {
            this.setState('CLEANUP');
        }

        if (conveyor) {
            conveyor.setSpeedMultiplier(CONFIG.CLEANUP_SPEED_MULT);
        }
    }

    enterWin() {
        this.setState('WIN');

        this.scene.cameras.main.flash(300, 255, 255, 255, true);
        this.scene.cameras.main.shake(200, 0.01);

        const cx = CONFIG.GAME_WIDTH / 2;
        const cy = CONFIG.GAME_HEIGHT / 2;

        const emitter = this.scene.add.particles(cx, cy, 'particle_star', {
            speed: { min: 150, max: 400 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            lifespan: 1200,
            quantity: 30,
            gravityY: 200,
        });

        emitter.setDepth(80);

        this.scene.time.delayedCall(500, () => {
            if (emitter && emitter.stop) emitter.stop();
        });

        this.scene.time.delayedCall(2000, () => {
            if (emitter && emitter.destroy) emitter.destroy();
        });
    }

    enterLose() {
        this.setState('LOSE');
        this.scene.cameras.main.shake(300, 0.02);
    }

    // ----------------------------------------------------------
    // Revive
    // ----------------------------------------------------------

    /**
     * Revive logic:
     * - Does NOT destroy Blocks.
     * - Does NOT reset Board.
     * - Does NOT delete Cubes instantly.
     * - Collects every existing Cube and sends them directly into Cars,
     *   similar to Paint Gun / Booster 3.
     *
     * Accepts:
     * revive({
     *   conveyor,
     *   funnel,
     *   cubeManager,
     *   carManager,
     *   boosterManager
     * })
     */
    async revive(systems) {
        if (this.isReviving) return false;

        const conveyor = systems?.conveyor;
        const funnel = systems?.funnel;
        const cubeManager = systems?.cubeManager;
        const carManager = systems?.carManager;
        const boosterManager = systems?.boosterManager;

        if (!cubeManager || !carManager) {
            console.warn('[Revive] Missing cubeManager or carManager.');
            this.setState('PLAYING');
            return false;
        }

        this.isReviving = true;

        if (boosterManager && boosterManager.cancelTargeting) {
            boosterManager.cancelTargeting();
        }

        this.scene.cameras.main.flash(160, 120, 220, 255, true);

        // Nếu có cube đang bay vào car từ Conveyor thì reservedCount có thể đang giữ slot ảo.
        // Revive sẽ tự xử lý lại toàn bộ cube, nên reset reserved trước khi allocate.
        this.resetAllCarReservations(carManager);

        // Lấy toàn bộ cube hiện đang tồn tại trong gameplay.
        const reviveCubes = this.collectAllReviveCubes({
            conveyor,
            funnel,
            cubeManager,
        });

        // Reset Conveyor/Funnel logic sau khi đã lấy cube ra.
        if (conveyor) {
            if (conveyor.setSpeedMultiplier) {
                conveyor.setSpeedMultiplier(1);
            }

            if (conveyor.resetWarningVisual) {
                conveyor.resetWarningVisual();
            }
        }

        if (reviveCubes.length === 0) {
            this.setState('PLAYING');
            this.isReviving = false;
            return true;
        }

        // Cho toàn bộ cube bay ào ạt vào cars giống Booster 3.
        await this.sendReviveCubesToCarsBurst(reviveCubes, carManager, cubeManager);

        this.setState('PLAYING');

        this.scene.time.delayedCall(100, () => {
            this.isReviving = false;
        });

        return true;
    }

    /**
     * Collect cubes from:
     * - Conveyor
     * - Funnel
     * - CubeManager active cubes
     *
     * Cubes are not destroyed here.
     * They are marked REVIVING and later fly into cars.
     */
    collectAllReviveCubes({ conveyor, funnel, cubeManager }) {
        const result = [];

        // 1. Conveyor cubes
        if (conveyor && Array.isArray(conveyor.cubesOnBelt)) {
            for (const entry of conveyor.cubesOnBelt) {
                if (!entry || !entry.cube) continue;

                const cube = entry.cube;

                this.prepareCubeForRevive(cube);

                result.push({
                    cube,
                    color: cube.color,
                    x: cube.sprite ? cube.sprite.x : CONFIG.CONTAINER_X,
                    y: cube.sprite ? cube.sprite.y : CONFIG.CONTAINER_FUNNEL_BOTTOM,
                });
            }

            conveyor.cubesOnBelt = [];
        }

        // 2. Funnel cubes
        if (funnel) {
            if (funnel.drainTimer) {
                funnel.drainTimer.remove(false);
                funnel.drainTimer = null;
            }

            funnel.isDraining = false;

            if (Array.isArray(funnel.cubesInFunnel)) {
                for (const cube of funnel.cubesInFunnel) {
                    if (!cube) continue;
                    if (cube.state === 'REVIVING') continue;

                    this.prepareCubeForRevive(cube);

                    result.push({
                        cube,
                        color: cube.color,
                        x: cube.sprite ? cube.sprite.x : CONFIG.CONTAINER_X,
                        y: cube.sprite ? cube.sprite.y : CONFIG.CONTAINER_FUNNEL_BOTTOM,
                    });
                }

                funnel.cubesInFunnel = [];
            }
        }

        // 3. Any remaining active cubes:
        // spawning / physics / draining / matching.
        if (cubeManager && Array.isArray(cubeManager.active)) {
            for (const cube of cubeManager.active) {
                if (!cube) continue;
                if (cube.state === 'INACTIVE') continue;
                if (cube.state === 'DONE') continue;
                if (cube.state === 'REVIVING') continue;

                this.prepareCubeForRevive(cube);

                result.push({
                    cube,
                    color: cube.color,
                    x: cube.sprite ? cube.sprite.x : CONFIG.CONTAINER_X,
                    y: cube.sprite ? cube.sprite.y : CONFIG.CONTAINER_FUNNEL_BOTTOM,
                });
            }
        }

        return result.filter(item => item && item.cube && item.color);
    }

    prepareCubeForRevive(cube) {
        if (!cube) return;

        if (cube.sprite && cube.sprite.scene) {
            this.scene.tweens.killTweensOf(cube.sprite);
            cube.sprite.setVisible(true);
            cube.sprite.setAlpha(1);
            cube.sprite.setScale(1);
            cube.sprite.setDepth(95);
        }

        if (cube.body) {
            this.scene.matter.world.remove(cube.body);
            cube.body = null;
        }

        cube.state = 'REVIVING';
        cube.stateTime = Date.now();
    }

    async sendReviveCubesToCarsBurst(reviveCubes, carManager, cubeManager) {
        if (!Array.isArray(reviveCubes) || reviveCubes.length === 0) return;

        const byColor = new Map();

        for (const item of reviveCubes) {
            if (!byColor.has(item.color)) {
                byColor.set(item.color, []);
            }

            byColor.get(item.color).push(item);
        }

        const allFlyPromises = [];
        const colorsToResolve = new Set();

        for (const [color, cubes] of byColor.entries()) {
            const allocations = this.allocateReviveCubesToCars(color, cubes.length, carManager);

            if (allocations.length === 0) {
                console.warn(`[Revive] No matching car capacity for ${color}.`);
                continue;
            }

            let cubeIndex = 0;

            for (const allocation of allocations) {
                const car = allocation.car;
                const amount = allocation.amount;

                if (!car || amount <= 0) continue;

                this.prepareCarForReviveFill(car, carManager);

                for (let i = 0; i < amount; i++) {
                    const item = cubes[cubeIndex];

                    if (!item) break;

                    const globalIndex = allFlyPromises.length;

                    const startDelay =
                        Math.floor(globalIndex / 8) * 10 +
                        Phaser.Math.Between(0, 18);

                    allFlyPromises.push(
                        this.flyReviveCubeToCar(item, car, startDelay)
                            .then(() => {
                                this.addDirectCubeToCar(car);

                                if (cubeManager && cubeManager.release) {
                                    cubeManager.release(item.cube);
                                } else {
                                    if (item.cube.sprite) {
                                        item.cube.sprite.setVisible(false);
                                    }

                                    item.cube.state = 'DONE';
                                }
                            })
                    );

                    cubeIndex++;
                    colorsToResolve.add(color);
                }
            }

            // Nếu có cube không allocate được do level data thiếu capacity,
            // vẫn phải release để tránh kẹt object cũ.
            // Trường hợp level đúng capacity thì đoạn này sẽ không chạy.
            for (let i = cubeIndex; i < cubes.length; i++) {
                const item = cubes[i];

                console.warn(`[Revive] Unallocated cube ${item.color}. Check car capacity data.`);

                if (item.cube && item.cube.sprite && item.cube.sprite.scene) {
                    this.scene.tweens.add({
                        targets: item.cube.sprite,
                        alpha: 0,
                        scaleX: 0.2,
                        scaleY: 0.2,
                        duration: 180,
                        ease: 'Quad.easeIn',
                        onComplete: () => {
                            if (cubeManager && cubeManager.release) {
                                cubeManager.release(item.cube);
                            }
                        },
                    });
                }
            }
        }

        await Promise.all(allFlyPromises);

        // Sau khi toàn bộ cube bay xong, xử lý car full.
        // Fill diễn ra cùng lúc, nhưng exit xử lý lần lượt để không phá queue.
        for (const color of colorsToResolve) {
            await this.resolveFullCarsAfterRevive(color, carManager);
        }
    }

    /**
     * Allocate revive cubes round-robin across all same-color cars,
     * including active and non-active queue cars.
     */
    allocateReviveCubesToCars(color, cubeCount, carManager) {
        const candidates = this.getReviveCandidateCars(color, carManager);

        if (candidates.length === 0 || cubeCount <= 0) return [];

        const allocationMap = new Map();

        for (const car of candidates) {
            allocationMap.set(car, 0);
        }

        let remaining = cubeCount;

        while (remaining > 0) {
            let addedThisRound = false;

            for (const car of candidates) {
                if (remaining <= 0) break;

                const alreadyAllocated = allocationMap.get(car) || 0;
                const free = car.capacity - car.filledCount - alreadyAllocated;

                if (free <= 0) continue;

                allocationMap.set(car, alreadyAllocated + 1);
                remaining--;
                addedThisRound = true;
            }

            if (!addedThisRound) break;
        }

        return candidates
            .map(car => ({
                car,
                amount: allocationMap.get(car) || 0,
            }))
            .filter(item => item.amount > 0);
    }

    getReviveCandidateCars(color, carManager) {
        const cars = [];

        if (!carManager || !Array.isArray(carManager.columns)) return cars;

        // Active row first.
        for (const col of carManager.columns) {
            if (this.canReviveFillCar(col.active, color)) {
                cars.push(col.active);
            }
        }

        // Queue[0] next.
        for (const col of carManager.columns) {
            const car = col.queue && col.queue[0];

            if (this.canReviveFillCar(car, color)) {
                cars.push(car);
            }
        }

        // Deeper queue cars.
        for (const col of carManager.columns) {
            if (!Array.isArray(col.queue)) continue;

            for (let i = 1; i < col.queue.length; i++) {
                const car = col.queue[i];

                if (this.canReviveFillCar(car, color)) {
                    cars.push(car);
                }
            }
        }

        return cars;
    }

    canReviveFillCar(car, color) {
        if (!car) return false;
        if (car.color !== color) return false;
        if (car.isExiting) return false;
        if (car.filledCount >= car.capacity) return false;

        return true;
    }

    prepareCarForReviveFill(car, carManager) {
        if (!car || !car.container) return;

        const location = this.getCarLocation(car, carManager);

        if (!location) return;

        if (location.type === 'active') {
            car.setActive(true);
            car.container.setVisible(true);
            car.container.setAlpha(1);
            car.container.setScale(1);
            car.container.setDepth(28);
            return;
        }

        if (location.type === 'queue') {
            const x = CONFIG.CAR_COL_POSITIONS[location.column];
            const y = CONFIG.CAR_ROW2_Y;

            car.setActive(false);
            car.setPosition(x, y);
            car.container.setVisible(true);
            car.container.setAlpha(CONFIG.CAR_ROW2_ALPHA || 0.72);
            car.container.setScale(CONFIG.CAR_ROW2_SCALE || 0.82);
            car.container.setDepth(26);
        }
    }

    flyReviveCubeToCar(item, car, startDelay = 0) {
        return new Promise(resolve => {
            if (!item || !item.cube || !item.cube.sprite || !car || !car.container) {
                resolve();
                return;
            }

            this.scene.time.delayedCall(startDelay, () => {
                const sprite = item.cube.sprite;

                if (!sprite || !sprite.scene || !car.container || !car.container.scene) {
                    resolve();
                    return;
                }

                const target = car.getAbsorbPosition
                    ? car.getAbsorbPosition()
                    : { x: car.container.x, y: car.container.y };

                sprite.setVisible(true);
                sprite.setAlpha(1);
                sprite.setScale(0.88);
                sprite.setDepth(100);

                const fromX = sprite.x;
                const fromY = sprite.y;

                const midX = (fromX + target.x) / 2 + Phaser.Math.Between(-35, 35);
                const midY = (fromY + target.y) / 2 - Phaser.Math.Between(20, 70);

                const jitterX = Phaser.Math.Between(-12, 12);
                const jitterY = Phaser.Math.Between(-8, 8);

                this.scene.tweens.add({
                    targets: sprite,
                    x: midX,
                    y: midY,
                    scaleX: 0.78,
                    scaleY: 0.78,
                    duration: CONFIG.REVIVE_FLY_DURATION_1 ?? 180,
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
                            scaleX: 0.45,
                            scaleY: 0.45,
                            alpha: 0.96,
                            duration: CONFIG.REVIVE_FLY_DURATION_2 ?? 260,
                            ease: 'Cubic.easeIn',
                            onComplete: () => {
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

    async resolveFullCarsAfterRevive(color, carManager) {
        if (!carManager) return;

        // Nếu CarManager đã có logic của Booster3 thì dùng lại.
        if (carManager.resolvePaintGunFullCars) {
            await carManager.resolvePaintGunFullCars(color);
            return;
        }

        // Fallback an toàn.
        let guard = 0;

        while (guard < 50) {
            guard++;

            const fullCar = this.findNextFullReviveCar(color, carManager);

            if (!fullCar) break;

            await this.handleFullReviveCar(fullCar, carManager);
            await this.delay(80);
        }

        if (carManager.refreshQueueVisibility) {
            carManager.refreshQueueVisibility();
        }
    }

    findNextFullReviveCar(color, carManager) {
        if (!carManager || !Array.isArray(carManager.columns)) return null;

        for (const col of carManager.columns) {
            const car = col.active;

            if (
                car &&
                car.color === color &&
                !car.isExiting &&
                car.filledCount >= car.capacity
            ) {
                return car;
            }
        }

        for (const col of carManager.columns) {
            if (!Array.isArray(col.queue)) continue;

            for (const car of col.queue) {
                if (
                    car &&
                    car.color === color &&
                    !car.isExiting &&
                    car.filledCount >= car.capacity
                ) {
                    return car;
                }
            }
        }

        return null;
    }

    async handleFullReviveCar(car, carManager) {
        const location = this.getCarLocation(car, carManager);

        if (!location) return;

        if (location.type === 'active') {
            if (carManager.onCarFull) {
                await carManager.onCarFull(car);
            }

            return;
        }

        if (location.type === 'queue') {
            const col = carManager.columns[location.column];

            if (!col) return;

            const index = col.queue.indexOf(car);

            if (index !== -1) {
                col.queue.splice(index, 1);
            }

            car.setActive(false);

            if (car.container) {
                car.container.setVisible(true);
                car.container.setAlpha(CONFIG.CAR_ROW2_ALPHA || 0.72);
                car.container.setScale(CONFIG.CAR_ROW2_SCALE || 0.82);
            }

            if (car.exitAnimation) {
                await car.exitAnimation();
            }
        }
    }

    getCarLocation(car, carManager) {
        if (!carManager || !Array.isArray(carManager.columns)) return null;

        for (let columnIndex = 0; columnIndex < carManager.columns.length; columnIndex++) {
            const col = carManager.columns[columnIndex];

            if (col.active === car) {
                return {
                    type: 'active',
                    column: columnIndex,
                    queueIndex: -1,
                };
            }

            if (Array.isArray(col.queue)) {
                const queueIndex = col.queue.indexOf(car);

                if (queueIndex !== -1) {
                    return {
                        type: 'queue',
                        column: columnIndex,
                        queueIndex,
                    };
                }
            }
        }

        return null;
    }

    resetAllCarReservations(carManager) {
        if (!carManager || !Array.isArray(carManager.columns)) return;

        for (const col of carManager.columns) {
            if (col.active) {
                col.active.reservedCount = 0;
            }

            if (Array.isArray(col.queue)) {
                for (const car of col.queue) {
                    car.reservedCount = 0;
                }
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => {
            this.scene.time.delayedCall(ms, resolve);
        });
    }
};