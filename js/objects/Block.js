// ============================================================
// Block — Individual puzzle block composed of colored cells
// window.Block
// Visual:
// - Cell sprites remain lightweight.
// - outlineGraphics removed.
// - connectorGraphics draws same-color bridges between cells of the SAME block.
// - connectorOverlayGraphics dims those bridges when the block is on lower layers / blocked.
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

        // Normal board depth: layer cao hơn nằm trên layer thấp khi idle.
        // Resolve depth: khi block đang bị rút/lift/blast thì luôn nằm trên cùng gameplay.
        this.baseDepth = 10 + this.layer;
        this.resolveDepth = 45 + this.layer;

        // Phaser container holding cell sprites
        this.container = null;
        this.cellSprites = [];
        this.glowSprites = [];
        this.overlaySprites = [];

        // Visual helpers
        this.shadowGraphics = null;
        this.connectorGraphics = null;

        // Overlay riêng cho connector, để phần nối cũng bị tối khi ở layer dưới/blocked.
        this.connectorOverlayGraphics = null;

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

        const sprites = [];
        const firstCell = this.cells[0];

        const anchorX = C.BOARD_OFFSET_X + firstCell.col * C.CELL_SIZE + C.CELL_SIZE / 2;
        const anchorY = C.BOARD_OFFSET_Y + firstCell.row * C.CELL_SIZE + C.CELL_SIZE / 2;

        this.cellSprites = [];
        this.glowSprites = [];
        this.overlaySprites = [];

        // Shadow nằm sau toàn bộ block.
        this.shadowGraphics = scene.add.graphics();
        this.drawBlockShadow(C, anchorX, anchorY);
        sprites.push(this.shadowGraphics);

        // Connector nằm dưới cell/glow.
        // Chỉ vẽ cầu nối giữa các cell cùng Block, không phình ra ngoài cạnh ngoài.
        this.connectorGraphics = scene.add.graphics();
        this.drawBlockConnector(C, anchorX, anchorY);
        sprites.push(this.connectorGraphics);

        // Overlay cho phần connector.
        // Phải nằm sau connectorGraphics nhưng trước cellSprites,
        // để chỉ làm tối phần nối, còn cellSprites vẫn dùng overlaySprites riêng.
        this.connectorOverlayGraphics = scene.add.graphics();
        this.drawBlockConnectorOverlay(C, anchorX, anchorY, 0);
        sprites.push(this.connectorOverlayGraphics);

        for (const cell of this.cells) {
            const cx = C.BOARD_OFFSET_X + cell.col * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorX;
            const cy = C.BOARD_OFFSET_Y + cell.row * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorY;

            // Main cell sprite
            const cellSprite = scene.add.image(cx, cy, `cell_${this.color}`);
            cellSprite.setDisplaySize(C.CELL_DRAW, C.CELL_DRAW);
            this.cellSprites.push(cellSprite);
            sprites.push(cellSprite);

            // Glow effect
            const glow = scene.add.image(cx, cy, `cell_${this.color}`);
            glow.setDisplaySize(C.CELL_DRAW + 4, C.CELL_DRAW + 4);
            glow.setAlpha(0.15);
            glow.setBlendMode(Phaser.BlendModes.ADD);
            this.glowSprites.push(glow);
            sprites.push(glow);

            // Dark overlay for blocked/layer state
            const overlay = scene.add.rectangle(cx, cy, C.CELL_DRAW, C.CELL_DRAW, 0x000000);
            overlay.setAlpha(0);
            this.overlaySprites.push(overlay);
            sprites.push(overlay);
        }

        // Create container at anchor position
        this.container = scene.add.container(anchorX, anchorY, sprites);

        // Apply layer overlay
        const layerDim = C.LAYER_OVERLAYS[this.layer] || 0;
        if (layerDim > 0) {
            for (const overlay of this.overlaySprites) {
                overlay.setAlpha(layerDim);
            }
        }

        this.updateConnectorOverlay(layerDim);

        // Set idle depth by layer
        this.container.setDepth(this.getBaseDepth());

        // Make interactive with hit area covering all cells
        this._setupInteractive(scene);
    }

    /**
     * Draw subtle shadow behind every cell of the block.
     * Kept small so shadows do not visually overlap nearby blocks too much.
     */
    drawBlockShadow(C, anchorX, anchorY) {
        if (!this.shadowGraphics) return;

        const g = this.shadowGraphics;
        const s = C.CELL_DRAW;
        const r = Math.max(5, Math.floor(s * 0.18));

        g.clear();

        // Small soft shadow under each tile.
        g.fillStyle(0x000000, 0.14);

        for (const cell of this.cells) {
            const cx = C.BOARD_OFFSET_X + cell.col * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorX;
            const cy = C.BOARD_OFFSET_Y + cell.row * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorY;

            g.fillRoundedRect(
                cx - s / 2 + 1,
                cy - s / 2 + 2,
                s,
                s,
                r
            );
        }

        // Tiny contact shadow, only at the bottom.
        g.fillStyle(0x000000, 0.07);

        for (const cell of this.cells) {
            const cx = C.BOARD_OFFSET_X + cell.col * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorX;
            const cy = C.BOARD_OFFSET_Y + cell.row * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorY;

            g.fillRoundedRect(
                cx - s / 2 + 5,
                cy + s / 2 - 4,
                s - 10,
                4,
                2
            );
        }
    }

    /**
     * Draw same-color connector layer only BETWEEN adjacent cells.
     * Connector width equals the 1x1 block visual width, so multi-cell
     * shapes look like one connected piece.
     *
     * It still does not draw outside the block silhouette:
     * - horizontal bridge only exists between left/right cells of the same block
     * - vertical bridge only exists between up/down cells of the same block
     */
    drawBlockConnector(C, anchorX, anchorY) {
        if (!this.connectorGraphics) return;

        const g = this.connectorGraphics;
        const colorData = window.COLORS[this.color] || window.COLORS.blue || {
            hex: 0x4A7BD9,
            dark: 0x2F57A5,
            light: 0x7FA7FF,
        };

        const mainColor = colorData.hex;
        const darkColor = colorData.dark ?? mainColor;
        const lightColor = colorData.light ?? mainColor;

        const { rects, s, bridgeLength } = this.getConnectorBridgeRects(C, anchorX, anchorY);

        g.clear();

        // Dark under-bridge: tạo cảm giác có độ dày nhưng vẫn nằm dưới cell.
        g.fillStyle(darkColor, 0.26);

        for (const rect of rects) {
            g.fillRoundedRect(
                rect.x + (rect.orientation === 'v' ? 2 : 0),
                rect.y + (rect.orientation === 'h' ? 2 : 0),
                rect.w,
                rect.h,
                rect.r
            );
        }

        // Main same-color bridge.
        // Nó rộng bằng tile nên nhìn I/L/T/O liền hơn nhiều.
        g.fillStyle(mainColor, 0.96);

        for (const rect of rects) {
            g.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, rect.r);
        }

        // Soft highlight on bridge surface.
        // Chỉ highlight nhẹ để không đè lên glossy cell ở trên.
        g.fillStyle(lightColor, 0.14);

        for (const rect of rects) {
            if (rect.orientation === 'h') {
                g.fillRoundedRect(
                    rect.x + 3,
                    rect.y + 4,
                    Math.max(2, bridgeLength - 6),
                    Math.max(3, s * 0.16),
                    3
                );
            } else {
                g.fillRoundedRect(
                    rect.x + 4,
                    rect.y + 3,
                    Math.max(3, s * 0.16),
                    Math.max(2, bridgeLength - 6),
                    3
                );
            }
        }
    }

    /**
     * Return bridge rects reused by connector and connector overlay.
     */
    getConnectorBridgeRects(C, anchorX, anchorY) {
        const cellKeys = new Set(this.cells.map(cell => `${cell.row},${cell.col}`));

        // Visual size of each 1x1 block tile.
        const s = C.CELL_DRAW;

        // Nét nối rộng ngang bằng tile 1x1.
        const bridgeThickness = s;

        // Khoảng cách giữa 2 mép cell sprite.
        const gap = Math.max(0, C.CELL_SIZE - s);

        // Bridge ăn nhẹ vào trong 2 cell để không bị hở seam.
        // Nếu thấy chỗ nối hơi phồng ở giao điểm T/L, giảm còn 3.
        // Nếu còn khe hở nhỏ, tăng lên 5.
        const overlap = 4;

        const bridgeLength = gap + overlap * 2;
        const radius = Math.max(4, Math.floor(s * 0.18));

        const rects = [];

        for (const cell of this.cells) {
            const cx = C.BOARD_OFFSET_X + cell.col * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorX;
            const cy = C.BOARD_OFFSET_Y + cell.row * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorY;

            const hasRight = cellKeys.has(`${cell.row},${cell.col + 1}`);
            const hasDown = cellKeys.has(`${cell.row + 1},${cell.col}`);

            if (hasRight) {
                rects.push({
                    orientation: 'h',
                    x: cx + s / 2 - overlap,
                    y: cy - bridgeThickness / 2,
                    w: bridgeLength,
                    h: bridgeThickness,
                    r: radius,
                });
            }

            if (hasDown) {
                rects.push({
                    orientation: 'v',
                    x: cx - bridgeThickness / 2,
                    y: cy + s / 2 - overlap,
                    w: bridgeThickness,
                    h: bridgeLength,
                    r: radius,
                });
            }
        }

        return {
            rects,
            s,
            bridgeLength,
            overlap,
            radius,
        };
    }

    /**
     * Draw overlay for connector bridges.
     * This fixes the issue where bridge parts stay bright when the block is in lower layers.
     */
    drawBlockConnectorOverlay(C, anchorX, anchorY, alpha) {
        if (!this.connectorOverlayGraphics) return;

        const g = this.connectorOverlayGraphics;

        g.clear();

        if (alpha <= 0) return;

        const { rects } = this.getConnectorBridgeRects(C, anchorX, anchorY);

        g.fillStyle(0x000000, alpha);

        for (const rect of rects) {
            g.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, rect.r);
        }
    }

    /**
     * Rebuild connector overlay according to current layer / blocked state.
     */
    updateConnectorOverlay(alpha) {
        if (!this.connectorOverlayGraphics) return;

        const C = window.CONFIG;
        const firstCell = this.cells[0];

        const anchorX = C.BOARD_OFFSET_X + firstCell.col * C.CELL_SIZE + C.CELL_SIZE / 2;
        const anchorY = C.BOARD_OFFSET_Y + firstCell.row * C.CELL_SIZE + C.CELL_SIZE / 2;

        this.drawBlockConnectorOverlay(C, anchorX, anchorY, alpha);
    }

    /**
     * Set up interactive hit area that covers all cells in the block.
     */
    _setupInteractive(scene) {
        const C = window.CONFIG;
        const firstCell = this.cells[0];

        const anchorX = C.BOARD_OFFSET_X + firstCell.col * C.CELL_SIZE + C.CELL_SIZE / 2;
        const anchorY = C.BOARD_OFFSET_Y + firstCell.row * C.CELL_SIZE + C.CELL_SIZE / 2;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

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

        const hitArea = new Phaser.Geom.Rectangle(minX, minY, w, h);
        const self = this;

        this.container.setInteractive(hitArea, function (hitArea, localX, localY) {
            const C = window.CONFIG;
            const firstCell = self.cells[0];

            const ax = C.BOARD_OFFSET_X + firstCell.col * C.CELL_SIZE + C.CELL_SIZE / 2;
            const ay = C.BOARD_OFFSET_Y + firstCell.row * C.CELL_SIZE + C.CELL_SIZE / 2;

            for (const cell of self.cells) {
                const cx = C.BOARD_OFFSET_X + cell.col * C.CELL_SIZE + C.CELL_SIZE / 2 - ax;
                const cy = C.BOARD_OFFSET_Y + cell.row * C.CELL_SIZE + C.CELL_SIZE / 2 - ay;
                const halfSize = C.CELL_SIZE / 2;

                if (
                    localX >= cx - halfSize &&
                    localX <= cx + halfSize &&
                    localY >= cy - halfSize &&
                    localY <= cy + halfSize
                ) {
                    return true;
                }
            }

            return false;
        });

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
                this.container.setVisible(true);
                this.container.setAlpha(1);
                this.container.setDepth(this.getBaseDepth());

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

                this.updateConnectorOverlay(layerDim);

                if (this.shadowGraphics) {
                    this.shadowGraphics.setAlpha(1);
                }

                if (this.connectorGraphics) {
                    this.connectorGraphics.setAlpha(1);
                }

                break;

            case 'blocked':
                this.container.setVisible(true);
                this.container.setAlpha(1);
                this.container.setDepth(this.getBaseDepth());

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

                this.updateConnectorOverlay(Math.max(layerDim, 0.25));

                if (this.shadowGraphics) {
                    this.shadowGraphics.setAlpha(0.65);
                }

                if (this.connectorGraphics) {
                    this.connectorGraphics.setAlpha(0.72);
                }

                break;

            case 'covered':
                this.container.setVisible(false);
                break;
        }
    }

    // ----------------------------------------------------------
    // Depth / resolve visual helpers
    // ----------------------------------------------------------

    /**
     * Normal board depth. Higher layers still render above lower layers
     * while the block is idle on the board.
     */
    getBaseDepth() {
        return this.baseDepth ?? (10 + this.layer);
    }

    /**
     * Resolve depth used while a block is being pulled, lifted, or blasted.
     */
    getResolveDepth() {
        return this.resolveDepth ?? (45 + this.layer);
    }

    /**
     * Bring this block above all other board layers while it resolves.
     */
    bringToResolveDepth(options = {}) {
        if (!this.container || !this.container.scene) return;

        const restoreColor = options.restoreColor !== false;

        this.container.setVisible(true);
        this.container.setAlpha(1);
        this.container.setDepth(this.getResolveDepth());

        if (!restoreColor) return;

        for (const sprite of this.cellSprites) {
            sprite.clearTint();
            sprite.setAlpha(1);
        }

        for (const glow of this.glowSprites) {
            glow.setAlpha(0.22);
        }

        for (const overlay of this.overlaySprites) {
            overlay.setAlpha(0);
        }

        if (this.connectorOverlayGraphics) {
            this.connectorOverlayGraphics.clear();
        }

        if (this.shadowGraphics) {
            this.shadowGraphics.setAlpha(1);
        }

        if (this.connectorGraphics) {
            this.connectorGraphics.setAlpha(1);
        }
    }

    /**
     * Restore idle board depth.
     */
    restoreBaseDepth() {
        if (!this.container || !this.container.scene) return;

        this.container.setDepth(this.getBaseDepth());
    }

    // ----------------------------------------------------------
    // Position helpers
    // ----------------------------------------------------------

    /**
     * Get screen center of this block.
     */
    getScreenCenter() {
        const C = window.CONFIG;

        let sumX = 0;
        let sumY = 0;

        for (const cell of this.cells) {
            sumX += C.BOARD_OFFSET_X + cell.col * C.CELL_SIZE + C.CELL_SIZE / 2;
            sumY += C.BOARD_OFFSET_Y + cell.row * C.CELL_SIZE + C.CELL_SIZE / 2;
        }

        return {
            x: sumX / this.cells.length,
            y: sumY / this.cells.length,
        };
    }

    /**
     * Get cube spawn positions, one per cube.
     * Each occupied cell generates CONFIG.CUBES_PER_CELL cube spawn positions.
     */
    getCubeSpawnPositions() {
        const C = window.CONFIG;
        const positions = [];
        const cubesPerCell = C.CUBES_PER_CELL || 4;

        for (const cell of this.cells) {
            const centerX = C.BOARD_OFFSET_X + cell.col * C.CELL_SIZE + C.CELL_SIZE / 2;
            const centerY = C.BOARD_OFFSET_Y + cell.row * C.CELL_SIZE + C.CELL_SIZE / 2;

            if (cubesPerCell === 1) {
                positions.push({ x: centerX, y: centerY });
                continue;
            }

            const spread = C.CELL_SIZE * 0.22;

            if (cubesPerCell === 4) {
                positions.push(
                    { x: centerX - spread, y: centerY - spread },
                    { x: centerX + spread, y: centerY - spread },
                    { x: centerX - spread, y: centerY + spread },
                    { x: centerX + spread, y: centerY + spread }
                );
            } else {
                for (let i = 0; i < cubesPerCell; i++) {
                    const angle = (Math.PI * 2 * i) / cubesPerCell;
                    positions.push({
                        x: centerX + Math.cos(angle) * spread,
                        y: centerY + Math.sin(angle) * spread,
                    });
                }
            }
        }

        return positions;
    }

    // ----------------------------------------------------------
    // Animations
    // ----------------------------------------------------------

    /**
     * Shake animation for invalid tap.
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
                    if (this.container) {
                        this.container.x = startX;
                    }

                    resolve();
                },
            });
        });
    }

    /**
     * Red flash + shake for blocked block.
     */
    shakeBlocked() {
        return new Promise((resolve) => {
            if (!this.container || !this.container.scene) {
                resolve();
                return;
            }

            for (const sprite of this.cellSprites) {
                sprite.setTint(0xFF4444);
            }

            this.shake().then(() => {
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

            // Quan trọng: đưa block lên trên tất cả layer khác trước khi lift.
            this.bringToResolveDepth({ restoreColor: true });

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
     * Blast animation — scale up, then shrink & fade.
     * Destroys the container on completion.
     */
    blast() {
        return new Promise((resolve) => {
            if (!this.container || !this.container.scene) {
                resolve();
                return;
            }

            // Đảm bảo animation blast cũng không bị layer khác đè.
            this.bringToResolveDepth({ restoreColor: true });

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

    /**
     * Small hover pulse for UX.
     */
    hoverPulse() {
        if (!this.container || !this.container.scene) return;

        this.container.scene.tweens.add({
            targets: this.container,
            scaleX: 1.04,
            scaleY: 1.04,
            duration: 90,
            yoyo: true,
            ease: 'Sine.easeInOut',
        });
    }

    // ----------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------

    /**
     * Destroy all Phaser objects.
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
        this.shadowGraphics = null;
        this.connectorGraphics = null;
        this.connectorOverlayGraphics = null;
    }
};