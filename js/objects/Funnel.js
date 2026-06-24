// ============================================================
// Funnel — Physics funnel with Matter.js walls + drain
// ============================================================

window.Funnel = class Funnel {
    constructor(scene) {
        this.scene = scene;
        this.cubesInFunnel = [];
        this.capacity = CONFIG.FUNNEL_CAPACITY;
        this.drainTimer = null;
        this.isDraining = false;

        this.createWalls();
        this.createDrainSensor();
    }

    createWalls() {
        const cx = CONFIG.CONTAINER_X;
        const w = CONFIG.CONTAINER_WIDTH;
        const gridBot = CONFIG.CONTAINER_GRID_BOTTOM;
        const funBot = CONFIG.CONTAINER_FUNNEL_BOTTOM;
        const drainW = CONFIG.FUNNEL_DRAIN_WIDTH;

        const left = cx - w / 2;
        const right = cx + w / 2;
        const drainLeft = cx - drainW / 2;
        const drainRight = cx + drainW / 2;

        // Left funnel wall
        const lMidX = (left + drainLeft) / 2;
        const lMidY = (gridBot + funBot) / 2;
        const lAngle = Math.atan2(funBot - gridBot, drainLeft - left);
        const lLen = Math.sqrt((drainLeft - left) ** 2 + (funBot - gridBot) ** 2);

        this.leftWall = this.scene.matter.add.rectangle(lMidX, lMidY, lLen, 6, {
            isStatic: true,
            friction: 0.4,
            frictionStatic: 0.8,
            angle: lAngle,
            collisionFilter: { category: 0x0001, mask: 0x0002 },
        });

        // Right funnel wall
        const rMidX = (right + drainRight) / 2;
        const rMidY = (gridBot + funBot) / 2;
        const rAngle = Math.atan2(funBot - gridBot, drainRight - right);
        const rLen = Math.sqrt((drainRight - right) ** 2 + (funBot - gridBot) ** 2);

        this.rightWall = this.scene.matter.add.rectangle(rMidX, rMidY, rLen, 6, {
            isStatic: true,
            friction: 0.4,
            frictionStatic: 0.8,
            angle: rAngle,
            collisionFilter: { category: 0x0001, mask: 0x0002 },
        });

        // Top walls (board sides) to prevent cubes from going sideways
        const topY = CONFIG.BOARD_OFFSET_Y;
        this.leftTopWall = this.scene.matter.add.rectangle(left - 3, (topY + gridBot) / 2, 6, gridBot - topY, {
            isStatic: true,
            friction: 0.3,
            frictionStatic: 0.6,
            collisionFilter: { category: 0x0001, mask: 0x0002 },
        });
        this.rightTopWall = this.scene.matter.add.rectangle(right + 3, (topY + gridBot) / 2, 6, gridBot - topY, {
            isStatic: true,
            friction: 0.3,
            frictionStatic: 0.6,
            collisionFilter: { category: 0x0001, mask: 0x0002 },
        });

        // Small drain bottom stopper (so cubes rest at drain)
        this.drainFloor = this.scene.matter.add.rectangle(cx, funBot + 3, drainW + 10, 6, {
            isStatic: true,
            friction: 0.4,
            frictionStatic: 0.8,
            collisionFilter: { category: 0x0001, mask: 0x0002 },
        });
    }

    createDrainSensor() {
        // Sensor zone at drain point
        this.drainZoneY = CONFIG.CONTAINER_FUNNEL_BOTTOM - 15;
        this.drainZoneX = CONFIG.CONTAINER_X;
    }

    addCube(cube) {
        cube.state = 'IN_FUNNEL';
        cube.stateTime = Date.now();
        this.cubesInFunnel.push(cube);
    }

    startDraining(conveyor) {
        if (this.isDraining) return;
        this.isDraining = true;

        this.drainTimer = this.scene.time.addEvent({
            delay: CONFIG.DRAIN_INTERVAL,
            callback: () => this.drainOne(conveyor),
            loop: true,
        });
    }

    drainOne(conveyor) {
        if (this.cubesInFunnel.length === 0) return;
        if (conveyor.isFull()) return;

        const cube = this.cubesInFunnel.shift();

        // Remove physics body
        if (cube.body) {
            this.scene.matter.world.remove(cube.body);
            cube.body = null;
        }

        cube.state = 'DRAINING';

        // Tween cube to conveyor entry point
        const entryPos = conveyor.getPathPosition(0);
        this.scene.tweens.add({
            targets: cube.sprite,
            x: entryPos.x,
            y: entryPos.y,
            scaleX: 0.8,
            scaleY: 0.8,
            duration: 150,
            ease: 'Power2',
            onComplete: () => {
                cube.sprite.setScale(1);
                conveyor.addCube(cube);
            }
        });
    }

    update(conveyor) {
        const cubeManager = this.scene.cubeManager;
        if (!cubeManager) return;

        const now = Date.now();

        // Check physics cubes that have settled near drain zone
        for (let i = cubeManager.active.length - 1; i >= 0; i--) {
            const cube = cubeManager.active[i];
            if (cube.state !== 'PHYSICS') continue;
            if (!cube.body) continue;

            const pos = cube.body.position;

            // Check if cube has reached funnel zone
            if (pos.y > this.drainZoneY - 30) {
                // Apply soft attract toward center
                const dx = this.drainZoneX - pos.x;
                this.scene.matter.body.applyForce(cube.body, pos, {
                    x: dx * 0.00005,
                    y: 0
                });
            }

            // If cube is near drain and mostly stopped, transition to IN_FUNNEL
            if (pos.y > this.drainZoneY &&
                Math.abs(cube.body.velocity.y) < 1.5 &&
                Math.abs(cube.body.velocity.x) < 1.5) {
                this.addCube(cube);
            }

            // Timeout: stuck cubes auto-transition after 3 seconds
            if (cube.state === 'PHYSICS' && now - cube.stateTime > 3000) {
                this.addCube(cube);
            }
        }

        // Start draining if we have cubes and conveyor reference
        if (this.cubesInFunnel.length > 0 && conveyor && !this.isDraining) {
            this.startDraining(conveyor);
        }
    }

    getCubeCount() {
        return this.cubesInFunnel.length;
    }

    clear() {
        for (const cube of this.cubesInFunnel) {
            if (cube.body) {
                this.scene.matter.world.remove(cube.body);
                cube.body = null;
            }
            cube.state = 'DONE';
        }
        this.cubesInFunnel = [];
    }

    destroy() {
        if (this.drainTimer) this.drainTimer.remove();
        this.clear();
        // Remove static bodies
        [this.leftWall, this.rightWall, this.leftTopWall, this.rightTopWall, this.drainFloor]
            .forEach(b => { if (b) this.scene.matter.world.remove(b); });
    }
};
