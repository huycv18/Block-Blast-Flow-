// ============================================================
// Block — Individual puzzle block composed of colored cells
// window.Block
// Visual:
// - Cell sprites remain lightweight.
// - outlineGraphics removed.
// - connectorGraphics draws same-color bridges between cells of the SAME block.
// - connectorOverlayGraphics dims those bridges when the block is on lower layers / blocked.
// - Layer overlay is based on visualLayerDepth, not raw layer index.
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

        // 0 = top visible layer, 1 = one layer below, etc.
        // Board recalculates this after all block states are known.
        this.visualLayerDepth = 0;

        this.cells = [];
        this.setCellPositions();

        this.state = 'pullable';

        this.baseDepth = 10 + this.layer;
        this.resolveDepth = 45 + this.layer;

        this.container = null;
        this.cellSprites = [];
        this.glowSprites = [];
        this.overlaySprites = [];

        this.shadowGraphics = null;
        this.connectorGraphics = null;
        this.connectorOverlayGraphics = null;

        this.createVisuals(scene);
    }

    // ----------------------------------------------------------
    // Cell position calculation
    // ----------------------------------------------------------

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

    createVisuals(scene) {
        const C = window.CONFIG;

        const sprites = [];
        const firstCell = this.cells[0];

        const anchorX = C.BOARD_OFFSET_X + firstCell.col * C.CELL_SIZE + C.CELL_SIZE / 2;
        const anchorY = C.BOARD_OFFSET_Y + firstCell.row * C.CELL_SIZE + C.CELL_SIZE / 2;

        this.cellSprites = [];
        this.glowSprites = [];
        this.overlaySprites = [];

        this.shadowGraphics = scene.add.graphics();
        this.drawBlockShadow(C, anchorX, anchorY);
        sprites.push(this.shadowGraphics);

        this.connectorGraphics = scene.add.graphics();
        this.drawBlockConnector(C, anchorX, anchorY);
        sprites.push(this.connectorGraphics);

        this.connectorOverlayGraphics = scene.add.graphics();
        this.drawBlockConnectorOverlay(C, anchorX, anchorY, 0);
        sprites.push(this.connectorOverlayGraphics);

        for (const cell of this.cells) {
            const cx = C.BOARD_OFFSET_X + cell.col * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorX;
            const cy = C.BOARD_OFFSET_Y + cell.row * C.CELL_SIZE + C.CELL_SIZE / 2 - anchorY;

            const cellSprite = scene.add.image(cx, cy, `cell_${this.color}`);
            cellSprite.setDisplaySize(C.CELL_DRAW, C.CELL_DRAW);
            this.cellSprites.push(cellSprite);
            sprites.push(cellSprite);

            const glow = scene.add.image(cx, cy, `cell_${this.color}`);
            glow.setDisplaySize(C.CELL_DRAW + 4, C.CELL_DRAW + 4);
            glow.setAlpha(0.15);
            glow.setBlendMode(Phaser.BlendModes.ADD);
            this.glowSprites.push(glow);
            sprites.push(glow);

            const overlay = scene.add.rectangle(cx, cy, C.CELL_DRAW, C.CELL_DRAW, 0x000000);
            overlay.setAlpha(0);
            this.overlaySprites.push(overlay);
            sprites.push(overlay);
        }

        this.container = scene.add.container(anchorX, anchorY, sprites);

        const layerDim = this.getLayerOverlayAlpha();

        if (layerDim > 0) {
            for (const overlay of this.overlaySprites) {
                overlay.setAlpha(layerDim);
            }

            this.updateConnectorOverlay(layerDim);
        }

        this.container.setDepth(this.getBaseDepth());

        this._setupInteractive(scene);
    }

    drawBlockShadow(C, anchorX, anchorY) {
        if (!this.shadowGraphics) return;

        const g = this.shadowGraphics;
        const s = C.CELL_DRAW;
        const r = Math.max(5, Math.floor(s * 0.18));

        g.clear();

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

        g.fillStyle(mainColor, 0.96);

        for (const rect of rects) {
            g.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, rect.r);
        }

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

    getConnectorBridgeRects(C, anchorX, anchorY) {
        const cellKeys = new Set(this.cells.map(cell => `${cell.row},${cell.col}`));

        const s = C.CELL_DRAW;
        const bridgeThickness = s;
        const gap = Math.max(0, C.CELL_SIZE - s);

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

    updateConnectorOverlay(alpha) {
        if (!this.connectorOverlayGraphics) return;

        const C = window.CONFIG;
        const firstCell = this.cells[0];

        const anchorX = C.BOARD_OFFSET_X + firstCell.col * C.CELL_SIZE + C.CELL_SIZE / 2;
        const anchorY = C.BOARD_OFFSET_Y + firstCell.row * C.CELL_SIZE + C.CELL_SIZE / 2;

        this.drawBlockConnectorOverlay(C, anchorX, anchorY, alpha);
    }

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
    // Layer overlay helpers
    // ----------------------------------------------------------

    getLayerOverlayAlpha() {
        const C = window.CONFIG;

        const depth = typeof this.visualLayerDepth === 'number'
            ? this.visualLayerDepth
            : 0;

        return C.LAYER_OVERLAYS[depth] || 0;
    }

    getBlockedOverlayAlpha() {
        const layerDim = this.getLayerOverlayAlpha();

        // Giảm số này nếu Block bị blocked vẫn quá tối.
        return Math.max(layerDim, 0.16);
    }

    // ----------------------------------------------------------
    // State management
    // ----------------------------------------------------------

    /**
     * @param {'pullable'|'blocked'|'covered'} newState
     * @param {boolean} force Force visual refresh even if state is unchanged.
     */
    setState(newState, force = false) {
        if (this.state === newState && !force) return;

        this.state = newState;

        if (!this.container || !this.container.scene) return;

        const layerDim = this.getLayerOverlayAlpha();

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

                {
                    const blockedDim = this.getBlockedOverlayAlpha();

                    for (const overlay of this.overlaySprites) {
                        overlay.setAlpha(blockedDim);
                    }

                    this.updateConnectorOverlay(blockedDim);
                }

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

    getBaseDepth() {
        return this.baseDepth ?? (10 + this.layer);
    }

    getResolveDepth() {
        return this.resolveDepth ?? (45 + this.layer);
    }

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

    restoreBaseDepth() {
        if (!this.container || !this.container.scene) return;

        this.container.setDepth(this.getBaseDepth());
    }

    // ----------------------------------------------------------
    // Position helpers
    // ----------------------------------------------------------

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

    liftUp() {
        return new Promise((resolve) => {
            if (!this.container || !this.container.scene) {
                resolve();
                return;
            }

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

    blast() {
        return new Promise((resolve) => {
            if (!this.container || !this.container.scene) {
                resolve();
                return;
            }

            this.bringToResolveDepth({ restoreColor: true });

            const C = window.CONFIG;
            const scene = this.container.scene;
            const halfDuration = C.BLAST_DURATION / 2;

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