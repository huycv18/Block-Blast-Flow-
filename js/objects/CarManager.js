// ============================================================
// CarManager — 3 car columns with queues
// ============================================================

window.CarManager = class CarManager {
    constructor(scene, carsData) {
        this.scene = scene;

        this.columns = [
            { active: null, queue: [] },
            { active: null, queue: [] },
            { active: null, queue: [] },
        ];

        this.layoutVersion = 0;
        this.isShuffling = false;
        this.isResolvingPaintGun = false;

        this.createCars(carsData);
    }

    createCars(carsData) {
        const byColumn = this.columns.map(() => []);

        carsData.forEach((carData, index) => {
            const col = this.columns[carData.column];
            if (!col) return;

            byColumn[carData.column].push({
                ...carData,
                _sourceIndex: index,
            });
        });

        byColumn.forEach((columnCars, columnIndex) => {
            columnCars.sort((a, b) => {
                if (a.queueOrder !== b.queueOrder) return a.queueOrder - b.queueOrder;
                return a._sourceIndex - b._sourceIndex;
            });

            columnCars.forEach((carData, queueIndex) => {
                const car = new Car(this.scene, carData);
                const col = this.columns[columnIndex];

                car.column = columnIndex;

                if (queueIndex === 0) {
                    col.active = car;
                    car.setActive(true);
                    car.setPosition(CONFIG.CAR_COL_POSITIONS[columnIndex], CONFIG.CAR_ROW1_Y);
                    car.container.setVisible(true);
                    car.container.setAlpha(1);
                } else {
                    col.queue.push(car);
                    car.setActive(false);
                    car.setPosition(CONFIG.CAR_COL_POSITIONS[columnIndex], CONFIG.CAR_ROW2_Y);

                    const visible = queueIndex === 1;
                    car.container.setVisible(visible);
                    car.container.setAlpha(visible ? 1 : 0);
                }
            });
        });
    }

    getActiveCars() {
        return this.columns
            .map(col => col.active)
            .filter(car => car && !car.isExiting);
    }

    getActiveCarColors() {
        const colors = new Set();

        for (const car of this.getActiveCars()) {
            if (car.canAccept(car.color)) {
                colors.add(car.color);
            }
        }

        return colors;
    }

    findMatchingActiveCar(cubeColor, preferredColumn) {
        if (preferredColumn !== undefined) {
            const col = this.columns[preferredColumn];

            if (col && col.active && col.active.canAccept(cubeColor)) {
                return col.active;
            }
        }

        for (const col of this.columns) {
            if (col.active && col.active.canAccept(cubeColor)) {
                return col.active;
            }
        }

        return null;
    }

    async onCarFull(car) {
        if (!car || car.isExiting) return;

        const colIdx = car.column;
        const col = this.columns[colIdx];

        if (!col) return;

        await car.exitAnimation();

        col.active = null;

        if (col.queue.length > 0) {
            const nextCar = col.queue.shift();

            col.active = nextCar;
            nextCar.column = colIdx;

            const targetX = CONFIG.CAR_COL_POSITIONS[colIdx];

            nextCar.container.setVisible(true);
            nextCar.container.setAlpha(1);
            nextCar.setActive(true);

            // Reveal hidden car before/during slide into active row
            if (nextCar.hidden && !nextCar.isRevealed) {
                // Start reveal mid-slide for a dramatic effect
                const slidePromise = nextCar.slideForward(targetX, CONFIG.CAR_ROW1_Y);
                // Trigger reveal partway through the slide
                this.scene.time.delayedCall(CONFIG.CAR_ADVANCE_DURATION * 0.45, () => {
                    nextCar.reveal();
                });
                await slidePromise;
            } else {
                await nextCar.slideForward(targetX, CONFIG.CAR_ROW1_Y);
            }

            if (col.queue.length > 0) {
                const peekCar = col.queue[0];

                peekCar.container.setVisible(true);
                peekCar.container.setAlpha(1);
                peekCar.setPosition(CONFIG.CAR_COL_POSITIONS[colIdx], CONFIG.CAR_ROW2_Y);
                peekCar.setActive(false);
            }
        }
    }

    allCarsComplete() {
        for (const col of this.columns) {
            if (col.active) return false;
            if (col.queue.length > 0) return false;
        }

        return true;
    }

    hasTransitioningCars() {
        if (this.isShuffling) return true;
        if (this.isResolvingPaintGun) return true;

        for (const col of this.columns) {
            if (col.active && col.active.isExiting) return true;

            for (const car of col.queue) {
                if (car.isExiting) return true;
            }
        }

        return false;
    }

    hasReservedActiveCubes() {
        for (const car of this.getActiveCars()) {
            if ((car.reservedCount || 0) > 0) return true;
        }

        return false;
    }

    canMatchAnyColor(colorSet) {
        for (const color of colorSet) {
            if (this.findMatchingActiveCar(color) !== null) {
                return true;
            }
        }

        return false;
    }

    // ----------------------------------------------------------
    // Shuffle Booster
    // ----------------------------------------------------------

    shuffleForPullableBlocks(pullableBlocks) {
        if (this.isShuffling || this.isResolvingPaintGun) {
            return false;
        }

        if (!Array.isArray(pullableBlocks) || pullableBlocks.length === 0) {
            return false;
        }

        const allCars = this.collectAllRemainingCars();

        if (allCars.length < 2) return false;

        for (const car of allCars) {
            if ((car.reservedCount || 0) > 0) {
                return false;
            }

            if (car.isExiting) {
                return false;
            }
        }

        const oldSignature = this.getCarOrderSignature();

        const FRONT_LAYER_INDEX = 0;

        const layer1PullableBlocks = pullableBlocks.filter(block => {
            return block &&
                block.state === 'pullable' &&
                block.layer === FRONT_LAYER_INDEX;
        });

        const priorityColors = this.pickPriorityColorsFromLayer1(layer1PullableBlocks, 3);
        const finalCars = this.buildShuffleCarOrder(allCars, priorityColors);

        this.redistributeCarsToColumns(finalCars);

        const newSignature = this.getCarOrderSignature();

        if (oldSignature === newSignature) {
            return false;
        }

        this.animateCarLayout();

        return true;
    }

    pickPriorityColorsFromLayer1(layer1PullableBlocks, maxColors = 3) {
        if (!Array.isArray(layer1PullableBlocks) || layer1PullableBlocks.length === 0) {
            return [];
        }

        const shuffledBlocks = this.shuffleArray([...layer1PullableBlocks]);
        const result = [];
        const usedColors = new Set();

        for (const block of shuffledBlocks) {
            if (!block || !block.color) continue;
            if (usedColors.has(block.color)) continue;

            usedColors.add(block.color);
            result.push(block.color);

            if (result.length >= maxColors) break;
        }

        return result;
    }

    buildShuffleCarOrder(allCars, priorityColors) {
        const remainingCars = [...allCars];
        const frontCars = [];

        for (const color of priorityColors) {
            const index = remainingCars.findIndex(car => car.color === color);

            if (index === -1) continue;

            const [car] = remainingCars.splice(index, 1);
            frontCars.push(car);

            if (frontCars.length >= this.columns.length) break;
        }

        const randomCars = this.shuffleArray(remainingCars);

        while (frontCars.length < this.columns.length && randomCars.length > 0) {
            frontCars.push(randomCars.shift());
        }

        return [...frontCars, ...randomCars];
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Phaser.Math.Between(0, i);
            const temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }

        return array;
    }

    collectAllRemainingCars() {
        const cars = [];

        for (const col of this.columns) {
            if (col.active) {
                cars.push(col.active);
            }

            for (const car of col.queue) {
                cars.push(car);
            }
        }

        return cars;
    }

    redistributeCarsToColumns(finalCars) {
        for (const col of this.columns) {
            col.active = null;
            col.queue = [];
        }

        for (let i = 0; i < finalCars.length; i++) {
            const car = finalCars[i];
            const columnIndex = i % this.columns.length;
            const rowIndex = Math.floor(i / this.columns.length);
            const col = this.columns[columnIndex];

            car.column = columnIndex;

            if (rowIndex === 0) {
                col.active = car;
                car.setActive(true);
            } else {
                col.queue.push(car);
                car.setActive(false);
            }
        }

        this.applyCarVisibilityImmediately();
    }

    applyCarVisibilityImmediately() {
        for (let columnIndex = 0; columnIndex < this.columns.length; columnIndex++) {
            const col = this.columns[columnIndex];

            if (col.active) {
                const car = col.active;

                car.column = columnIndex;
                car.setActive(true);
                car.container.setVisible(true);
                car.container.setAlpha(1);
                car.container.setScale(1);
                car.container.setDepth(20);

                // Reveal hidden car that has been shuffled/advanced to active slot
                if (car.hidden && !car.isRevealed) {
                    car.reveal();
                }
            }

            for (let queueIndex = 0; queueIndex < col.queue.length; queueIndex++) {
                const car = col.queue[queueIndex];
                const visible = queueIndex === 0;

                car.column = columnIndex;
                car.setActive(false);
                car.container.setVisible(visible);
                car.container.setAlpha(visible ? 1 : 0);
                car.container.setScale(CONFIG.CAR_ROW2_SCALE || 0.82);
                car.container.setDepth(18);
            }
        }
    }

    animateCarLayout() {
        this.layoutVersion++;
        const version = this.layoutVersion;

        this.isShuffling = true;

        let pendingTweens = 0;

        const finishTween = () => {
            pendingTweens--;

            if (pendingTweens <= 0 && this.layoutVersion === version) {
                this.isShuffling = false;
                this.applyCarVisibilityImmediately();
            }
        };

        const addTween = (car, tweenConfig) => {
            if (!car || !car.container || !car.container.scene) return;

            pendingTweens++;

            this.scene.tweens.killTweensOf(car.container);

            this.scene.tweens.add({
                ...tweenConfig,
                targets: car.container,
                onComplete: () => {
                    if (this.layoutVersion !== version) return;

                    if (typeof tweenConfig._safeComplete === 'function') {
                        tweenConfig._safeComplete();
                    }

                    finishTween();
                },
            });
        };

        for (let columnIndex = 0; columnIndex < this.columns.length; columnIndex++) {
            const col = this.columns[columnIndex];
            const x = CONFIG.CAR_COL_POSITIONS[columnIndex];

            if (col.active) {
                const car = col.active;

                car.column = columnIndex;
                car.setActive(true);
                car.container.setVisible(true);
                car.container.setAlpha(1);
                car.container.setDepth(20);

                addTween(car, {
                    x,
                    y: CONFIG.CAR_ROW1_Y,
                    scaleX: 1.08,
                    scaleY: 1.08,
                    alpha: 1,
                    duration: 160,
                    ease: 'Quad.easeOut',
                    _safeComplete: () => {
                        if (this.isCarCurrentActive(car)) {
                            car.container.setVisible(true);
                            car.container.setAlpha(1);

                            this.scene.tweens.add({
                                targets: car.container,
                                scaleX: 1,
                                scaleY: 1,
                                duration: 160,
                                ease: 'Back.easeOut',
                            });
                        }
                    },
                });
            }

            for (let queueIndex = 0; queueIndex < col.queue.length; queueIndex++) {
                const car = col.queue[queueIndex];
                const visible = queueIndex === 0;

                car.column = columnIndex;
                car.setActive(false);
                car.container.setVisible(true);
                car.container.setDepth(18);

                addTween(car, {
                    x,
                    y: CONFIG.CAR_ROW2_Y,
                    scaleX: CONFIG.CAR_ROW2_SCALE || 0.82,
                    scaleY: CONFIG.CAR_ROW2_SCALE || 0.82,
                    alpha: visible ? 1 : 0,
                    duration: 240,
                    ease: 'Back.easeOut',
                    _safeComplete: () => {
                        if (this.layoutVersion !== version) return;

                        if (this.isCarCurrentActive(car)) {
                            car.container.setVisible(true);
                            car.container.setAlpha(1);
                            car.container.setScale(1);
                            return;
                        }

                        if (this.isCarCurrentQueue(car, columnIndex, queueIndex)) {
                            car.container.setVisible(visible);
                            car.container.setAlpha(visible ? 1 : 0);
                            car.container.setScale(CONFIG.CAR_ROW2_SCALE || 0.82);
                        }
                    },
                });
            }
        }

        if (pendingTweens === 0) {
            this.isShuffling = false;
            this.applyCarVisibilityImmediately();
        }

        this.scene.time.delayedCall(420, () => {
            if (this.layoutVersion !== version) return;

            this.isShuffling = false;
            this.applyCarVisibilityImmediately();
        });
    }

    isCarCurrentActive(car) {
        for (const col of this.columns) {
            if (col.active === car) return true;
        }

        return false;
    }

    isCarCurrentQueue(car, columnIndex, queueIndex) {
        const col = this.columns[columnIndex];
        if (!col) return false;

        return col.queue[queueIndex] === car;
    }

    getCarOrderSignature() {
        const parts = [];

        for (let columnIndex = 0; columnIndex < this.columns.length; columnIndex++) {
            const col = this.columns[columnIndex];

            const activeId = col.active ? col.active.id : 'none';
            parts.push(`C${columnIndex}:A:${activeId}`);

            for (let i = 0; i < col.queue.length; i++) {
                parts.push(`C${columnIndex}:Q${i}:${col.queue[i].id}`);
            }
        }

        return parts.join('|');
    }

    // ----------------------------------------------------------
    // Paint Gun Direct Burst Fill
    // ----------------------------------------------------------

    getPaintGunCandidateCars(color) {
        const cars = [];

        // 1. Active row first.
        for (const col of this.columns) {
            if (this.canPaintGunFillCar(col.active, color)) {
                cars.push(col.active);
            }
        }

        // 2. Queue[0] visible row.
        for (const col of this.columns) {
            const car = col.queue[0];

            if (this.canPaintGunFillCar(car, color)) {
                cars.push(car);
            }
        }

        // 3. Deeper queue cars.
        for (const col of this.columns) {
            for (let i = 1; i < col.queue.length; i++) {
                const car = col.queue[i];

                if (this.canPaintGunFillCar(car, color)) {
                    cars.push(car);
                }
            }
        }

        return cars;
    }

    getPaintGunAvailableCapacity(color) {
        let total = 0;

        for (const car of this.getPaintGunCandidateCars(color)) {
            total += Math.max(0, car.capacity - car.filledCount);
        }

        return total;
    }

    canPaintGunFillCar(car, color) {
        if (!car) return false;
        if (car.color !== color) return false;
        if (car.isExiting) return false;
        if (car.filledCount >= car.capacity) return false;

        return true;
    }

    /**
     * Allocate cubes across all same-color cars.
     *
     * This allows active and non-active cars to fill together.
     * The distribution is round-robin so the visual looks like many cars
     * receiving cubes at the same time.
     */
    allocatePaintGunCubes(color, cubeCount) {
        const candidates = this.getPaintGunCandidateCars(color);

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

    prepareCarForPaintGunFill(car) {
        if (!car || !car.container) return;

        const location = this.getCarLocation(car);

        if (!location) return;

        if (location.type === 'active') {
            car.container.setVisible(true);
            car.container.setAlpha(1);
            car.container.setScale(1);
            car.container.setDepth(24);
            return;
        }

        if (location.type === 'queue') {
            const x = CONFIG.CAR_COL_POSITIONS[location.column];
            const y = CONFIG.CAR_ROW2_Y;

            car.setActive(false);
            car.setPosition(x, y);
            car.container.setVisible(true);

            // Deep-queue cars are temporarily shown so the player sees cubes flying in.
            car.container.setAlpha(CONFIG.CAR_ROW2_ALPHA || 0.72);
            car.container.setScale(CONFIG.CAR_ROW2_SCALE || 0.82);
            car.container.setDepth(22);

            // Reveal hidden car immediately when Paint Gun is going to fill it
            if (car.hidden && !car.isRevealed) {
                car.reveal();
            }
        }
    }

    async resolvePaintGunFullCars(color) {
        this.isResolvingPaintGun = true;

        // Refresh fill visuals to make sure they're up to date.
        for (const car of this.getPaintGunCandidateCars(color)) {
            if (car.updateFillVisual) {
                car.updateFillVisual();
            }
        }

        // Process one at a time to prevent queue/active advancing simultaneously — fill already happened simultaneously.
        let loopGuard = 0;

        while (loopGuard < 50) {
            loopGuard++;

            const fullCar = this.findNextFullPaintGunCar(color);

            if (!fullCar) break;

            await this.handlePaintGunFilledCarFull(fullCar);
            await this.delay(80);
        }

        this.refreshQueueVisibility();
        this.isResolvingPaintGun = false;
    }

    findNextFullPaintGunCar(color) {
        // Active cars exit first so the queue advances correctly.
        for (const col of this.columns) {
            const car = col.active;

            if (car &&
                car.color === color &&
                !car.isExiting &&
                car.filledCount >= car.capacity) {
                return car;
            }
        }

        // Then handle full queue cars.
        for (const col of this.columns) {
            for (const car of col.queue) {
                if (car &&
                    car.color === color &&
                    !car.isExiting &&
                    car.filledCount >= car.capacity) {
                    return car;
                }
            }
        }

        return null;
    }

    async handlePaintGunFilledCarFull(car) {
        if (!car || car.isExiting) return;

        const location = this.getCarLocation(car);

        if (!location) return;

        if (location.type === 'active') {
            await this.onCarFull(car);
            this.refreshQueueVisibility();
            return;
        }

        if (location.type === 'queue') {
            const col = this.columns[location.column];

            if (!col) return;

            const idx = col.queue.indexOf(car);

            if (idx !== -1) {
                col.queue.splice(idx, 1);
            }

            car.setActive(false);

            if (car.container) {
                car.container.setVisible(true);
                car.container.setAlpha(CONFIG.CAR_ROW2_ALPHA || 0.72);
                car.container.setScale(CONFIG.CAR_ROW2_SCALE || 0.82);
                car.container.setDepth(22);
            }

            await car.exitAnimation();

            this.refreshQueueVisibility();
        }
    }

    getCarLocation(car) {
        for (let columnIndex = 0; columnIndex < this.columns.length; columnIndex++) {
            const col = this.columns[columnIndex];

            if (col.active === car) {
                return {
                    type: 'active',
                    column: columnIndex,
                    queueIndex: -1,
                };
            }

            const queueIndex = col.queue.indexOf(car);

            if (queueIndex !== -1) {
                return {
                    type: 'queue',
                    column: columnIndex,
                    queueIndex,
                };
            }
        }

        return null;
    }

    refreshQueueVisibility() {
        for (let columnIndex = 0; columnIndex < this.columns.length; columnIndex++) {
            const col = this.columns[columnIndex];
            const x = CONFIG.CAR_COL_POSITIONS[columnIndex];

            if (col.active && col.active.container && !col.active.isExiting) {
                col.active.column = columnIndex;
                col.active.setActive(true);
                col.active.container.setVisible(true);
                col.active.container.setAlpha(1);
                col.active.container.setScale(1);
                col.active.container.setDepth(20);
                col.active.setPosition(x, CONFIG.CAR_ROW1_Y);
            }

            for (let queueIndex = 0; queueIndex < col.queue.length; queueIndex++) {
                const car = col.queue[queueIndex];
                const visible = queueIndex === 0;

                car.column = columnIndex;
                car.setActive(false);
                car.setPosition(x, CONFIG.CAR_ROW2_Y);

                if (car.container && !car.isExiting) {
                    car.container.setVisible(visible);
                    car.container.setAlpha(visible ? (CONFIG.CAR_ROW2_ALPHA || 0.72) : 0);
                    car.container.setScale(CONFIG.CAR_ROW2_SCALE || 0.82);
                    car.container.setDepth(18);
                }
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => {
            this.scene.time.delayedCall(ms, resolve);
        });
    }

    // ----------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------

    destroy() {
        this.layoutVersion++;
        this.isShuffling = false;
        this.isResolvingPaintGun = false;

        for (const col of this.columns) {
            if (col.active) {
                col.active.destroy();
            }

            for (const car of col.queue) {
                car.destroy();
            }
        }
    }
};