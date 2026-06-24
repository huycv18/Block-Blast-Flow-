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

        this.createCars(carsData);
    }

    createCars(carsData) {
        // Sort by column then queueOrder
        const sorted = [...carsData].sort((a, b) => {
            if (a.column !== b.column) return a.column - b.column;
            return a.queueOrder - b.queueOrder;
        });

        for (const carData of sorted) {
            const car = new Car(this.scene, carData);
            const col = this.columns[carData.column];
            if (!col) continue;

            if (carData.queueOrder === 0) {
                col.active = car;
                car.setActive(true);
                car.setPosition(CONFIG.CAR_COL_POSITIONS[carData.column], CONFIG.CAR_ROW1_Y);
            } else {
                car.setActive(false);
                car.setPosition(CONFIG.CAR_COL_POSITIONS[carData.column], CONFIG.CAR_ROW2_Y);
                col.queue.push(car);
            }
        }
    }

    getActiveCars() {
        return this.columns
            .map(col => col.active)
            .filter(car => car && !car.isExiting);
    }

    getActiveCarColors() {
        const colors = new Set();
        for (const car of this.getActiveCars()) {
            if (car.canAccept(car.color)) colors.add(car.color);
        }
        return colors;
    }

    findMatchingActiveCar(cubeColor, preferredColumn) {
        // First try preferred column
        if (preferredColumn !== undefined) {
            const col = this.columns[preferredColumn];
            if (col && col.active && col.active.canAccept(cubeColor)) {
                return col.active;
            }
        }
        // Then try any column
        for (const col of this.columns) {
            if (col.active && col.active.canAccept(cubeColor)) {
                return col.active;
            }
        }
        return null;
    }

    async onCarFull(car) {
        const colIdx = car.column;
        const col = this.columns[colIdx];
        if (!col) return;

        await car.exitAnimation();

        col.active = null;

        // Advance queue
        if (col.queue.length > 0) {
            const nextCar = col.queue.shift();
            col.active = nextCar;
            const targetX = CONFIG.CAR_COL_POSITIONS[colIdx];
            await nextCar.slideForward(targetX, CONFIG.CAR_ROW1_Y);

            // Show next queue car at row2 if exists
            if (col.queue.length > 0) {
                const peekCar = col.queue[0];
                peekCar.container.setVisible(true);
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

    canMatchAnyColor(colorSet) {
        for (const color of colorSet) {
            if (this.findMatchingActiveCar(color) !== null) return true;
        }
        return false;
    }

    shuffleForColors(pullableColors) {
        const activeCars = this.getActiveCars();
        if (activeCars.length < 2) return;

        // Sort to put matching colors first
        const sorted = [...activeCars].sort((a, b) => {
            const aMatch = pullableColors.has(a.color) ? 0 : 1;
            const bMatch = pullableColors.has(b.color) ? 0 : 1;
            return aMatch - bMatch;
        });

        // Reassign to columns with animation
        const positions = activeCars.map(car => ({
            x: car.container.x,
            y: car.container.y,
            col: car.column,
        }));

        sorted.forEach((car, i) => {
            const target = positions[i];
            car.column = this.columns.indexOf(
                this.columns.find((col, idx) => idx === activeCars[i].column)
            );

            this.scene.tweens.add({
                targets: car.container,
                x: target.x,
                duration: 300,
                ease: 'Back.easeOut',
            });

            // Update column reference
            this.columns[target.col].active = car;
            car.column = target.col;
        });
    }

    destroy() {
        for (const col of this.columns) {
            if (col.active) col.active.destroy();
            for (const car of col.queue) car.destroy();
        }
    }
};
