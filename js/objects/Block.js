// ============================================================
// Block — Individual puzzle block composed of colored cells
// window.Block
// ============================================================

window.Block = class Block {
    /**
     * @param {Phaser.Scene} scene
     * @param {{ id: number, shape: string, color: string, row: number, col: number }} blockData
     * @param {number} layerIndex
     */
    constructor(scene, blockData, layerIndex) {
        this.id = blockData.id;
        this.color = blockData.color;
        this.shapeName = blockData.shape;
        this.layer = layerIndex;
        this.originRow = blockData.row;
        this.originCol = blockData.col;

        // Absolute grid positions for each cell
        this.cells = [];
        this.setCellPositions();

        // Visual state
        this.state = 'pullable';

        // Phaser container holding cell sprites
        this.container = null;
        this.cellSprites = [];
        this.glowSprites = [];
        this.overlaySprites = [];

        this.createVisuals(scene);
    }

    // ----------------------------------------------------------
    // Cell position calculation
    // ----------------------------------------------------------

    /**
     * Calculate absolute grid positions from shape offsets + anchor row/col.
     */
    setCellPositions() {
        const shapeDef = window.SHAPES[this.shapeName];
        if (!shapeDef) {
            console.warn(`Block: unknown shape "${this.shapeName}"`);
            this.cells = [{ row: this.originRow, col: this.originCol }];
            return;
        }
        this.cells = shapeDef.cells.map(([dr, dc]) => ({
            row: this.originRow + dr,
            col: this.originCol + dc,
        }));
    }

    // ----------------------------------------------------------
    // Visual creation
    // ----------------------------------------------------------

    /**
     * Create Phaser Container with cell sprites at screen coordinates.
     */
    createVisuals(scene) {
        const C = window.CONFIG;

        // Calculate screen positions for each cell relative to first cell
        const sprites = [];
        const firstCell = this.cells[0];
        const anchorX = C.BOARD_OFFSET_X + firstCell.col * C.CELL_SIZE + C.CELL_SIZE / 2;
        const anchorY = C.BOARD_OFFSET_Y + firstCell.row * C.CELL_SIZE + C.CELL_SIZE / 2;

        this.cellSprites = [];
        this.glowSprites = [];
        this.overlaySprites = [];

        for (const cell of this.cells) {
            const cx = C.BOARD_OFFSET_X + cell.col * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorX;
            const cy = C.BOARD_OFFSET_Y + cell.row * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorY;

            // Main cell sprite
            const cellSprite = scene.add.image(cx, cy, `cell_${this.color}`);
            cellSprite.setDisplaySize(C.CELL_DRAW, C.CELL_DRAW);
            this.cellSprites.push(cellSprite);
            sprites.push(cellSprite);

            // Glow effect (subtle additive overlay for pullable state)
            const glow = scene.add.image(cx, cy, `cell_${this.color}`);
            glow.setDisplaySize(C.CELL_DRAW + 4, C.CELL_DRAW + 4);
            glow.setAlpha(0.15);
            glow.setBlendMode(Phaser.BlendModes.ADD);
            this.glowSprites.push(glow);
            sprites.push(glow);

            // Dark overlay for blocked state
            const overlay = scene.add.rectangle(cx, cy, C.CELL_DRAW, C.CELL_DRAW, 0x000000);
            overlay.setAlpha(0);
            this.overlaySprites.push(overlay);
            sprites.push(overlay);
        }

        // Create container at anchor position
        this.container = scene.add.container(anchorX, anchorY, sprites);

        // Apply layer overlay (darkening for deeper layers)
        const layerDim = C.LAYER_OVERLAYS[this.layer] || 0;
        if (layerDim > 0) {
            for (const overlay of this.overlaySprites) {
                overlay.setAlpha(layerDim);
            }
        }

        // Set depth based on layer (higher layer = higher depth)
        this.container.setDepth(10 + this.layer);

        // Make interactive with hit area covering all cells
        this._setupInteractive(scene);
    }

    /**
     * Set up interactive hit area that covers all cells in the block.
     */
    _setupInteractive(scene) {
        const C = window.CONFIG;
        const firstCell = this.cells[0];
        const anchorX = C.BOARD_OFFSET_X + firstCell.col * C.CELL_SIZE + C.CELL_SIZE / 2;
        const anchorY = C.BOARD_OFFSET_Y + firstCell.row * C.CELL_SIZE + C.CELL_SIZE / 2;

        // Calculate bounding box for all cells relative to container origin
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const cell of this.cells) {
            const cx = C.BOARD_OFFSET_X + cell.col * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorX;
            const cy = C.BOARD_OFFSET_Y + cell.row * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorY;
            minX = Math.min(minX, cx - C.CELL_SIZE / 2);
            minY = Math.min(minY, cy - C.CELL_SIZE / 2);
            maxX = Math.max(maxX, cx + C.CELL_SIZE / 2);
            maxY = Math.max(maxY, cy + C.CELL_SIZE / 2);
        }

        const w = maxX - minX;
        const h = maxY - minY;

        // Use a custom hit area callback for precise cell-level detection
        const hitArea = new Phaser.Geom.Rectangle(minX, minY, w, h);
        const self = this;

        this.container.setInteractive(hitArea, function (hitArea, localX, localY) {
            // Check if click is within any actual cell bounds
            const C = window.CONFIG;
            const firstCell = self.cells[0];
            const ax = C.BOARD_OFFSET_X + firstCell.col * C.CELL_SIZE + C.CELL_SIZE / 2;
            const ay = C.BOARD_OFFSET_Y + firstCell.row * C.CELL_SIZE + C.CELL_SIZE / 2;

            for (const cell of self.cells) {
                const cx = C.BOARD_OFFSET_X + cell.col * C.CELL_SIZE + C.CELL_SIZE / 2 - ax;
                const cy = C.BOARD_OFFSET_Y + cell.row * C.CELL_SIZE + C.CELL_SIZE / 2 - ay;
                const halfSize = C.CELL_SIZE / 2;

                if (localX >= cx - halfSize && localX <= cx + halfSize &&
                    localY >= cy - halfSize && localY <= cy + halfSize) {
                    return true;
                }
            }
            return false;
        });

        // Store block reference on the container for event handlers
        this.container.setData('blockRef', this);
    }

    // ----------------------------------------------------------
    // State management
    // ----------------------------------------------------------

    /**
     * Update visual appearance based on state.
     * @param {'pullable'|'blocked'|'covered'} newState
     */
    setState(newState) {
        if (this.state === newState) return;
        this.state = newState;

        if (!this.container || !this.container.scene) return;

        const C = window.CONFIG;
        const layerDim = C.LAYER_OVERLAYS[this.layer] || 0;

        switch (newState) {
            case 'pullable':
                // Full color, visible, glow active
                this.container.setVisible(true);
                this.container.setAlpha(1);
                for (const sprite of this.cellSprites) {
                    sprite.clearTint();
                    sprite.setAlpha(1);
                }
                for (const glow of this.glowSprites) {
                    glow.setAlpha(0.15);
                }
                for (const overlay of this.overlaySprites) {
                    overlay.setAlpha(layerDim);
                }
                break;

            case 'blocked':
                // Dimmed texture with dark overlay
                this.container.setVisible(true);
                this.container.setAlpha(1);
                for (const sprite of this.cellSprites) {
                    sprite.setTint(0x888888);
                    sprite.setAlpha(0.85);
                }
                for (const glow of this.glowSprites) {
                    glow.setAlpha(0);
                }
                for (const overlay of this.overlaySprites) {
                    overlay.setAlpha(Math.max(layerDim, 0.25));
                }
                break;

            case 'covered':
                // Fully hidden
                this.container.setVisible(false);
                break;
        }
    }

    // ----------------------------------------------------------
    // Position helpers
    // ----------------------------------------------------------

    /**
     * Return {x, y} center of the block in screen coordinates.
     */
    getScreenCenter() {
        const C = window.CONFIG;
        let sumX = 0, sumY = 0;
        for (const cell of this.cells) {
            sumX += C.BOARD_OFFSET_X + cell.col * C.CELL_SIZE + C.CELL_SIZE / 2;
            sumY += C.BOARD_OFFSET_Y + cell.row * C.CELL_SIZE + C.CELL_SIZE / 2;
        }
        return {
            x: sumX / this.cells.length,
            y: sumY / this.cells.length,
        };
    }

    // ----------------------------------------------------------
    // Animations
    // ----------------------------------------------------------

    /**
     * Shake animation. Returns a Promise that resolves when complete.
     */
    shake() {
        return new Promise((resolve) => {
            if (!this.container || !this.container.scene) {
                resolve();
                return;
            }
            const C = window.CONFIG;
            const scene = this.container.scene;
            const startX = this.container.x;

            scene.tweens.add({
                targets: this.container,
                x: startX + C.SHAKE_INTENSITY,
                duration: C.SHAKE_DURATION,
                yoyo: true,
                repeat: C.SHAKE_REPEATS,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    if (this.container) this.container.x = startX;
                    resolve();
                },
            });
        });
    }

    /**
     * Red tint flash + shake. Returns a Promise.
     */
    shakeBlocked() {
        return new Promise((resolve) => {
            if (!this.container || !this.container.scene) {
                resolve();
                return;
            }
            const scene = this.container.scene;

            // Flash red tint on all cell sprites
            for (const sprite of this.cellSprites) {
                sprite.setTint(0xFF4444);
            }

            // Shake and then restore tint
            this.shake().then(() => {
                // Restore to blocked tint
                if (this.state === 'blocked') {
                    for (const sprite of this.cellSprites) {
                        sprite.setTint(0x888888);
                    }
                } else {
                    for (const sprite of this.cellSprites) {
                        sprite.clearTint();
                    }
                }
                resolve();
            });
        });
    }

    /**
     * Lift block upward. Returns a Promise.
     */
    liftUp() {
        return new Promise((resolve) => {
            if (!this.container || !this.container.scene) {
                resolve();
                return;
            }
            const C = window.CONFIG;
            const scene = this.container.scene;

            scene.tweens.add({
                targets: this.container,
                y: this.container.y - C.LIFT_DISTANCE,
                rotation: Phaser.Math.DegToRad(Phaser.Math.Between(-5, 5)),
                duration: C.LIFT_DURATION,
                ease: 'Power2',
                onComplete: () => resolve(),
            });
        });
    }

    /**
     * Blast animation — scale up, then shrink & fade. Returns Promise.
     * Destroys the container on completion.
     */
    blast() {
        return new Promise((resolve) => {
            if (!this.container || !this.container.scene) {
                resolve();
                return;
            }
            const C = window.CONFIG;
            const scene = this.container.scene;
            const halfDuration = C.BLAST_DURATION / 2;

            // Phase 1: scale up
            scene.tweens.add({
                targets: this.container,
                scaleX: C.BLAST_SCALE_UP,
                scaleY: C.BLAST_SCALE_UP,
                duration: halfDuration,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    if (!this.container || !this.container.scene) {
                        resolve();
                        return;
                    }
                    // Phase 2: shrink + fade
                    scene.tweens.add({
                        targets: this.container,
                        scaleX: 0,
                        scaleY: 0,
                        alpha: 0,
                        duration: halfDuration,
                        ease: 'Quad.easeIn',
                        onComplete: () => {
                            this.destroy();
                            resolve();
                        },
                    });
                },
            });
        });
    }

    // ----------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------

    /**
     * Remove container from scene and clean up references.
     */
    destroy() {
        if (this.container) {
            this.container.removeInteractive();
            this.container.destroy();
            this.container = null;
        }
        this.cellSprites = [];
        this.glowSprites = [];
        this.overlaySprites = [];
    }
};
