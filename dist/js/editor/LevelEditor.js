// ============================================================
// Block Cube Puzzle — Level Editor
// Pure vanilla JS, no dependencies beyond config/shapes/validator
// ============================================================

(function () {
    'use strict';

    const CELL_PX = 48;         // Editor cell size (larger than game for clarity)
    const GRID_PAD = 32;        // Padding around grid
    const GRID_COLS = CONFIG.GRID_COLS;  // Read from game config
    const GRID_ROWS = CONFIG.GRID_ROWS;  // Read from game config
    const CANVAS_W = GRID_COLS * CELL_PX + GRID_PAD * 2;
    const CANVAS_H = GRID_ROWS * CELL_PX + GRID_PAD * 2;

    // ─── Color helpers ───
    function hexToCSS(hex) {
        if (typeof hex === 'string') return hex;
        return '#' + hex.toString(16).padStart(6, '0');
    }

    function hexToRGBA(hex, a) {
        const h = typeof hex === 'number' ? hex : parseInt(hex.replace('#', ''), 16);
        const r = (h >> 16) & 0xff, g = (h >> 8) & 0xff, b = h & 0xff;
        return `rgba(${r},${g},${b},${a})`;
    }

    // ─── Main Editor Class ───
    class LevelEditor {
        constructor() {
            // State
            this.tool = 'draw';
            this.selectedColor = 'red';
            this.selectedShape = 'DOT';
            this.activeLayer = 0;
            this.hoverCell = null;
            this.blockIdCounter = 1;
            this.selectedBlockId = null;

            // Level data
            this.levelData = this.createNewLevel();

            // DOM refs
            this.canvas = document.getElementById('grid-canvas');
            this.ctx = this.canvas.getContext('2d');
            this.canvas.width = CANVAS_W;
            this.canvas.height = CANVAS_H;

            this.initUI();
            this.initCanvasEvents();
            this.initButtonEvents();
            this.renderAll();
        }

        // ───────────────────────────────────────
        // Data Model
        // ───────────────────────────────────────

        createNewLevel() {
            return {
                id: 1,
                name: 'New Level',
                difficulty: 'Tutorial',
                boardSize: { cols: GRID_COLS, rows: GRID_ROWS },
                conveyorCapacity: 40,
                funnelCapacity: 40,
                layers: [{ index: 0, blocks: [] }],
                cars: [
                    { column: 0, color: 'red', capacity: 8, queueOrder: 0 },
                    { column: 1, color: 'blue', capacity: 8, queueOrder: 0 },
                    { column: 2, color: 'green', capacity: 8, queueOrder: 0 },
                ],
                boosters: { magnet: 10, shuffle: 10, paintGun: 10 },
            };
        }

        getActiveLayerData() {
            return this.levelData.layers.find(l => l.index === this.activeLayer);
        }

        getAllBlocks() {
            const blocks = [];
            for (const layer of this.levelData.layers) {
                for (const block of layer.blocks) {
                    blocks.push({ ...block, layerIndex: layer.index });
                }
            }
            return blocks;
        }

        getBlockCubeCount(block) {
            const shape = SHAPES[block.shape];
            if (!shape) return 0;
            return shape.unitCount * (CONFIG.CUBES_PER_CELL || 4);
        }

        getHighestNonEmptyLayer() {
            return [...this.levelData.layers]
                .filter(layer => layer.blocks && layer.blocks.length > 0)
                .sort((a, b) => b.index - a.index)[0] || null;
        }

        getAutoCarStats() {
            const stats = {};
            const ensureColor = (color) => {
                if (!stats[color]) {
                    stats[color] = {
                        color,
                        totalBlocks: 0,
                        totalCubes: 0,
                        topBlocks: 0,
                        topCubes: 0,
                    };
                }
                return stats[color];
            };

            const topLayer = this.getHighestNonEmptyLayer();
            const topLayerIndex = topLayer ? topLayer.index : null;

            for (const layer of this.levelData.layers) {
                for (const block of layer.blocks || []) {
                    const colorStats = ensureColor(block.color);
                    const cubes = this.getBlockCubeCount(block);
                    colorStats.totalBlocks += 1;
                    colorStats.totalCubes += cubes;

                    if (layer.index === topLayerIndex) {
                        colorStats.topBlocks += 1;
                        colorStats.topCubes += cubes;
                    }
                }
            }

            const priority = Object.values(stats).sort((a, b) => {
                // Main GDD priority: colors with more blocks on the highest non-empty layer go first.
                if (b.topBlocks !== a.topBlocks) return b.topBlocks - a.topBlocks;
                if (b.topCubes !== a.topCubes) return b.topCubes - a.topCubes;
                if (b.totalBlocks !== a.totalBlocks) return b.totalBlocks - a.totalBlocks;
                if (b.totalCubes !== a.totalCubes) return b.totalCubes - a.totalCubes;
                return COLOR_NAMES.indexOf(a.color) - COLOR_NAMES.indexOf(b.color);
            });

            return { topLayerIndex, priority, stats };
        }

        getAutoCarPriorityText() {
            const { topLayerIndex, priority } = this.getAutoCarStats();
            if (!priority.length) return 'No blocks yet';

            const topColors = priority.filter(item => item.topBlocks > 0);
            const source = topColors.length ? topColors : priority;
            const parts = source.map(item => `${item.color}×${item.topBlocks || item.totalBlocks}`);
            const layerText = topLayerIndex !== null ? `Top L${topLayerIndex}` : 'No layer';
            return `${layerText}: ${parts.join(', ')}`;
        }

        normalizeCarQueueOrders() {
            const normalized = [];
            for (let col = 0; col < 3; col++) {
                const carsInCol = this.levelData.cars
                    .filter(car => car.column === col)
                    .sort((a, b) => (a.queueOrder || 0) - (b.queueOrder || 0));

                carsInCol.forEach((car, index) => {
                    car.column = col;
                    car.queueOrder = index;
                    normalized.push(car);
                });
            }

            // Keep unexpected columns instead of silently deleting imported data.
            const external = this.levelData.cars.filter(car => car.column < 0 || car.column > 2);
            this.levelData.cars = [...normalized, ...external];
        }

        getSortedCarsInColumn(column, carPool) {
            const cars = carPool || this.levelData.cars;
            return cars
                .filter(car => car.column === column)
                .sort((a, b) => (a.queueOrder || 0) - (b.queueOrder || 0));
        }

        moveCarToPosition(sourceIndex, targetColumn, targetPosition) {
            const car = this.levelData.cars[sourceIndex];
            if (!car || targetColumn < 0 || targetColumn > 2) return false;

            const remainingCars = this.levelData.cars.filter(candidate => candidate !== car);
            const columns = [0, 1, 2].map(col => this.getSortedCarsInColumn(col, remainingCars));

            const targetList = columns[targetColumn];
            const safePosition = Math.max(0, Math.min(targetPosition, targetList.length));
            car.column = targetColumn;
            targetList.splice(safePosition, 0, car);

            const normalized = [];
            for (let col = 0; col < 3; col++) {
                columns[col].forEach((item, index) => {
                    item.column = col;
                    item.queueOrder = index;
                    normalized.push(item);
                });
            }

            const external = remainingCars.filter(item => item.column < 0 || item.column > 2);
            this.levelData.cars = [...normalized, ...external];
            return true;
        }

        getCarDropIndex(listEl, clientY) {
            const items = [...listEl.querySelectorAll('.car-item:not(.dragging)')];
            let closestOffset = Number.NEGATIVE_INFINITY;
            let closestIndex = items.length;

            items.forEach((item, index) => {
                const box = item.getBoundingClientRect();
                const offset = clientY - box.top - box.height / 2;
                if (offset < 0 && offset > closestOffset) {
                    closestOffset = offset;
                    closestIndex = index;
                }
            });

            return closestIndex;
        }

        autoGenerateCarsFromBlocks() {
            const { priority } = this.getAutoCarStats();
            if (!priority.length) {
                this.showToast('Add blocks first before auto-generating cars', true);
                return;
            }

            if (this.levelData.cars.length > 0) {
                const ok = confirm('Auto Cars will replace the current car list. Continue?');
                if (!ok) return;
            }

            const defaultCapacity = 8;
            const generated = [];

            for (const item of priority) {
                let remaining = item.totalCubes;
                while (remaining > 0) {
                    const capacity = Math.min(defaultCapacity, remaining);
                    const index = generated.length;
                    generated.push({
                        column: index % 3,
                        color: item.color,
                        capacity,
                        queueOrder: Math.floor(index / 3),
                    });
                    remaining -= capacity;
                }
            }

            this.levelData.cars = generated;
            this.normalizeCarQueueOrders();
            this.renderCarsConfig();
            this.renderValidation();
            this.showToast(`Auto-created ${generated.length} cars from top-layer priority`);
        }

        getBlockCells(block) {
            const shape = SHAPES[block.shape];
            if (!shape) return [];
            return shape.cells.map(([dr, dc]) => ({
                row: block.row + dr,
                col: block.col + dc,
            }));
        }

        findBlockAt(row, col, layerIndex) {
            const layer = layerIndex !== undefined
                ? this.levelData.layers.find(l => l.index === layerIndex)
                : this.getActiveLayerData();
            if (!layer) return null;
            for (const block of layer.blocks) {
                const cells = this.getBlockCells(block);
                if (cells.some(c => c.row === row && c.col === col)) {
                    return block;
                }
            }
            return null;
        }

        findBlockAtAnyLayer(row, col) {
            for (const layer of this.levelData.layers) {
                for (const block of layer.blocks) {
                    const cells = this.getBlockCells(block);
                    if (cells.some(c => c.row === row && c.col === col)) {
                        return { block, layerIndex: layer.index };
                    }
                }
            }
            return null;
        }

        canPlaceBlock(shape, row, col, excludeBlockId) {
            const shapeDef = SHAPES[shape];
            if (!shapeDef) return false;
            const cells = shapeDef.cells.map(([dr, dc]) => ({ row: row + dr, col: col + dc }));

            // Bounds check
            for (const c of cells) {
                if (c.row < 0 || c.row >= GRID_ROWS || c.col < 0 || c.col >= GRID_COLS) return false;
            }

            // Overlap check (same layer)
            const layer = this.getActiveLayerData();
            if (layer) {
                for (const block of layer.blocks) {
                    if (excludeBlockId && block.id === excludeBlockId) continue;
                    const blockCells = this.getBlockCells(block);
                    for (const c of cells) {
                        if (blockCells.some(bc => bc.row === c.row && bc.col === c.col)) return false;
                    }
                }
            }
            return true;
        }

        placeBlock(row, col) {
            if (!this.canPlaceBlock(this.selectedShape, row, col)) return false;
            const layer = this.getActiveLayerData();
            if (!layer) return false;
            const id = 'b' + this.blockIdCounter++;
            layer.blocks.push({
                id,
                shape: this.selectedShape,
                color: this.selectedColor,
                row,
                col,
            });
            return true;
        }

        eraseBlockAt(row, col) {
            const layer = this.getActiveLayerData();
            if (!layer) return false;
            const block = this.findBlockAt(row, col);
            if (!block) return false;
            layer.blocks = layer.blocks.filter(b => b.id !== block.id);
            return true;
        }

        // ───────────────────────────────────────
        // Init UI
        // ───────────────────────────────────────

        initUI() {
            this.buildColorGrid();
            this.buildShapeGrid();
            this.renderLayers();
            this.renderCarsConfig();
            this.renderValidation();
        }

        buildColorGrid() {
            const container = document.getElementById('color-grid');
            container.innerHTML = '';
            for (const name of COLOR_NAMES) {
                const c = COLORS[name];
                const el = document.createElement('div');
                el.className = 'color-swatch' + (name === this.selectedColor ? ' active' : '');
                el.style.background = hexToCSS(c.hex);
                el.dataset.color = name;
                el.title = name;
                el.innerHTML = `<span class="color-label">${name}</span>`;
                el.addEventListener('click', () => {
                    this.selectedColor = name;
                    container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                    el.classList.add('active');
                    this.updateStatusBar();
                    this.renderGrid();
                });
                container.appendChild(el);
            }
        }

        buildShapeGrid() {
            const container = document.getElementById('shape-grid');
            container.innerHTML = '';
            for (const [key, shape] of Object.entries(SHAPES)) {
                const el = document.createElement('div');
                el.className = 'shape-item' + (key === this.selectedShape ? ' active' : '');
                el.dataset.shape = key;

                // Build mini preview
                const bounds = ShapeUtils.getBounds(key);
                const previewEl = document.createElement('div');
                previewEl.className = 'shape-preview';
                previewEl.style.gridTemplateColumns = `repeat(${bounds.cols}, 8px)`;
                previewEl.style.gridTemplateRows = `repeat(${bounds.rows}, 8px)`;

                for (let r = 0; r < bounds.rows; r++) {
                    for (let c = 0; c < bounds.cols; c++) {
                        const cellEl = document.createElement('div');
                        const isFilled = shape.cells.some(([cr, cc]) => cr === r && cc === c);
                        cellEl.className = 'shape-preview-cell ' + (isFilled ? 'filled' : 'empty');
                        previewEl.appendChild(cellEl);
                    }
                }
                el.appendChild(previewEl);

                const nameEl = document.createElement('div');
                nameEl.className = 'shape-name';
                nameEl.textContent = key;
                el.appendChild(nameEl);

                el.addEventListener('click', () => {
                    this.selectedShape = key;
                    container.querySelectorAll('.shape-item').forEach(s => s.classList.remove('active'));
                    el.classList.add('active');
                    this.updateStatusBar();
                    this.renderGrid();
                });
                container.appendChild(el);
            }
        }

        renderLayers() {
            const container = document.getElementById('layer-list');
            container.innerHTML = '';
            const sorted = [...this.levelData.layers].sort((a, b) => b.index - a.index);
            for (const layer of sorted) {
                const el = document.createElement('div');
                el.className = 'layer-item' + (layer.index === this.activeLayer ? ' active' : '');
                el.innerHTML = `
                    <span class="layer-badge">L${layer.index}</span>
                    <span class="layer-info">${layer.blocks.length} blocks</span>
                    ${this.levelData.layers.length > 1
                        ? `<span class="layer-delete" data-layer="${layer.index}" title="Delete layer">✕</span>`
                        : ''}
                `;
                el.addEventListener('click', (e) => {
                    if (e.target.classList.contains('layer-delete')) {
                        const idx = parseInt(e.target.dataset.layer);
                        this.levelData.layers = this.levelData.layers.filter(l => l.index !== idx);
                        if (this.activeLayer === idx) {
                            this.activeLayer = this.levelData.layers[0]?.index || 0;
                        }
                        this.renderLayers();
                        this.renderGrid();
                        this.renderValidation();
                        return;
                    }
                    this.activeLayer = layer.index;
                    this.renderLayers();
                    this.renderGrid();
                });
                container.appendChild(el);
            }
        }

        renderCarsConfig() {
            const container = document.getElementById('cars-config');
            container.innerHTML = '';
            this.normalizeCarQueueOrders();

            const toolbar = document.createElement('div');
            toolbar.className = 'cars-toolbar';
            toolbar.innerHTML = `
                <button class="btn btn-primary btn-sm" id="btn-auto-cars" title="Create cars from block colors, prioritizing the highest non-empty layer">⚙ Auto Cars</button>
                <span class="auto-cars-hint">${this.getAutoCarPriorityText()}</span>
            `;
            toolbar.querySelector('#btn-auto-cars').addEventListener('click', () => this.autoGenerateCarsFromBlocks());
            container.appendChild(toolbar);

            const help = document.createElement('div');
            help.className = 'cars-drag-help';
            help.textContent = 'Drag cars to reorder queue or move between columns. Q0 is the active/front car.';
            container.appendChild(help);

            for (let col = 0; col < 3; col++) {
                const group = document.createElement('div');
                group.className = 'car-column-group';

                const header = document.createElement('div');
                header.className = 'car-column-header';
                header.innerHTML = `
                    <span class="car-column-label">Column ${col}</span>
                    <button class="btn btn-outline btn-sm" data-add-car="${col}">+ Car</button>
                `;
                group.appendChild(header);

                const list = document.createElement('div');
                list.className = 'car-list';
                list.dataset.column = col;

                list.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    list.classList.add('drag-over');
                });
                list.addEventListener('dragleave', (e) => {
                    if (!list.contains(e.relatedTarget)) list.classList.remove('drag-over');
                });
                list.addEventListener('drop', (e) => {
                    e.preventDefault();
                    list.classList.remove('drag-over');
                    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
                    if (Number.isNaN(sourceIndex)) return;
                    const targetColumn = parseInt(list.dataset.column);
                    const targetPosition = this.getCarDropIndex(list, e.clientY);
                    if (this.moveCarToPosition(sourceIndex, targetColumn, targetPosition)) {
                        this.renderCarsConfig();
                        this.renderValidation();
                        this.showToast('Car order updated');
                    }
                });

                const carsInCol = this.getSortedCarsInColumn(col);

                for (let i = 0; i < carsInCol.length; i++) {
                    const car = carsInCol[i];
                    const carIndex = this.levelData.cars.indexOf(car);
                    const item = document.createElement('div');
                    item.className = 'car-item';
                    item.draggable = true;
                    item.dataset.carIndex = carIndex;
                    item.title = 'Drag to reorder this car';

                    item.addEventListener('dragstart', (e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(carIndex));
                        item.classList.add('dragging');
                    });
                    item.addEventListener('dragend', () => {
                        item.classList.remove('dragging');
                        container.querySelectorAll('.car-list.drag-over').forEach(el => el.classList.remove('drag-over'));
                    });

                    const handle = document.createElement('span');
                    handle.className = 'car-drag-handle';
                    handle.textContent = '☰';
                    item.appendChild(handle);

                    const dot = document.createElement('div');
                    dot.className = 'car-color-dot';
                    dot.style.background = hexToCSS(COLORS[car.color]?.hex || 0x888888);
                    item.appendChild(dot);

                    // Color select
                    const colorSel = document.createElement('select');
                    for (const cn of COLOR_NAMES) {
                        const opt = document.createElement('option');
                        opt.value = cn;
                        opt.textContent = cn;
                        if (cn === car.color) opt.selected = true;
                        colorSel.appendChild(opt);
                    }
                    colorSel.addEventListener('change', () => {
                        car.color = colorSel.value;
                        dot.style.background = hexToCSS(COLORS[car.color].hex);
                        this.renderValidation();
                    });
                    colorSel.addEventListener('mousedown', (e) => e.stopPropagation());
                    item.appendChild(colorSel);

                    // Capacity input
                    const capInput = document.createElement('input');
                    capInput.type = 'number';
                    capInput.min = 1;
                    capInput.max = 100;
                    capInput.value = car.capacity;
                    capInput.addEventListener('change', () => {
                        car.capacity = parseInt(capInput.value) || 4;
                        this.renderValidation();
                    });
                    capInput.addEventListener('mousedown', (e) => e.stopPropagation());
                    item.appendChild(capInput);

                    // Queue label
                    const qLabel = document.createElement('span');
                    qLabel.className = 'car-queue-label';
                    qLabel.textContent = `Q${car.queueOrder}`;
                    item.appendChild(qLabel);

                    // Delete
                    const del = document.createElement('span');
                    del.className = 'car-delete';
                    del.textContent = '✕';
                    del.addEventListener('click', () => {
                        const idx = this.levelData.cars.indexOf(car);
                        if (idx !== -1) this.levelData.cars.splice(idx, 1);
                        this.normalizeCarQueueOrders();
                        this.renderCarsConfig();
                        this.renderValidation();
                    });
                    item.appendChild(del);

                    list.appendChild(item);
                }
                group.appendChild(list);

                // Add car button
                header.querySelector('button').addEventListener('click', () => {
                    const existing = this.levelData.cars.filter(c => c.column === col);
                    const nextQueue = existing.length > 0
                        ? Math.max(...existing.map(c => c.queueOrder)) + 1
                        : 0;
                    this.levelData.cars.push({
                        column: col,
                        color: this.selectedColor,
                        capacity: 8,
                        queueOrder: nextQueue,
                    });
                    this.normalizeCarQueueOrders();
                    this.renderCarsConfig();
                    this.renderValidation();
                });

                container.appendChild(group);
            }
        }

        renderValidation() {
            const container = document.getElementById('validation-list');
            container.innerHTML = '';

            // Calculate cubes per color
            const cubesPerColor = {};
            const carCapPerColor = {};

            for (const layer of this.levelData.layers) {
                for (const block of layer.blocks) {
                    const shape = SHAPES[block.shape];
                    if (!shape) continue;
                    const cubes = shape.unitCount * (CONFIG.CUBES_PER_CELL || 4);
                    cubesPerColor[block.color] = (cubesPerColor[block.color] || 0) + cubes;
                }
            }

            for (const car of this.levelData.cars) {
                carCapPerColor[car.color] = (carCapPerColor[car.color] || 0) + car.capacity;
            }

            const allColors = new Set([...Object.keys(cubesPerColor), ...Object.keys(carCapPerColor)]);
            let allPass = true;

            for (const color of allColors) {
                const cubes = cubesPerColor[color] || 0;
                const cap = carCapPerColor[color] || 0;
                const pass = cubes === cap;
                if (!pass) allPass = false;

                const row = document.createElement('div');
                row.className = 'validation-row ' + (pass ? 'pass' : 'fail');

                const dot = document.createElement('div');
                dot.className = 'v-color-dot';
                dot.style.background = hexToCSS(COLORS[color]?.hex || 0x888888);
                row.appendChild(dot);

                const icon = document.createElement('span');
                icon.className = 'v-icon';
                icon.textContent = pass ? '✅' : '❌';
                row.appendChild(icon);

                const text = document.createElement('span');
                text.textContent = `${color}: ${cubes} cubes ${pass ? '=' : '≠'} ${cap} car cap`;
                row.appendChild(text);

                container.appendChild(row);
            }

            if (allColors.size === 0) {
                container.innerHTML = '<div style="font-size:12px;color:#6666888;">No blocks or cars yet</div>';
            }

            // Update status dot
            const dot = document.getElementById('status-dot');
            dot.className = 'status-dot' + (allPass && allColors.size > 0 ? '' : ' error');
        }

        // ───────────────────────────────────────
        // Canvas / Grid Rendering
        // ───────────────────────────────────────

        renderGrid() {
            const ctx = this.ctx;
            const w = CANVAS_W, h = CANVAS_H;

            // Background
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, w, h);

            // Draw grid
            for (let r = 0; r < GRID_ROWS; r++) {
                for (let c = 0; c < GRID_COLS; c++) {
                    this.drawEmptyCell(ctx, r, c);
                }
            }

            // Draw blocks from bottom layer to top
            const sortedLayers = [...this.levelData.layers].sort((a, b) => a.index - b.index);
            for (const layer of sortedLayers) {
                const isActive = layer.index === this.activeLayer;
                const alpha = isActive ? 1.0 : 0.35;
                for (const block of layer.blocks) {
                    this.drawBlock(ctx, block, alpha, layer.index);
                }
            }

            // Hover preview
            if (this.hoverCell && this.tool === 'draw') {
                this.drawPreview(ctx, this.hoverCell.row, this.hoverCell.col);
            }

            // Erase highlight
            if (this.hoverCell && this.tool === 'erase') {
                const block = this.findBlockAt(this.hoverCell.row, this.hoverCell.col);
                if (block) {
                    const cells = this.getBlockCells(block);
                    for (const cell of cells) {
                        const x = GRID_PAD + cell.col * CELL_PX;
                        const y = GRID_PAD + cell.row * CELL_PX;
                        ctx.strokeStyle = '#E74C3C';
                        ctx.lineWidth = 2.5;
                        ctx.setLineDash([4, 3]);
                        ctx.strokeRect(x + 1, y + 1, CELL_PX - 2, CELL_PX - 2);
                        ctx.setLineDash([]);
                    }
                }
            }

            // Select highlight
            if (this.selectedBlockId) {
                const allBlocks = this.getAllBlocks();
                const sel = allBlocks.find(b => b.id === this.selectedBlockId);
                if (sel) {
                    const cells = this.getBlockCells(sel);
                    for (const cell of cells) {
                        const x = GRID_PAD + cell.col * CELL_PX;
                        const y = GRID_PAD + cell.row * CELL_PX;
                        ctx.strokeStyle = '#F1C40F';
                        ctx.lineWidth = 3;
                        ctx.strokeRect(x + 1, y + 1, CELL_PX - 2, CELL_PX - 2);
                    }
                }
            }

            // Grid labels
            ctx.fillStyle = '#6666888';
            ctx.font = '10px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            for (let c = 0; c < GRID_COLS; c++) {
                ctx.fillText(c.toString(), GRID_PAD + c * CELL_PX + CELL_PX / 2, GRID_PAD - 8);
            }
            ctx.textAlign = 'right';
            for (let r = 0; r < GRID_ROWS; r++) {
                ctx.fillText(r.toString(), GRID_PAD - 8, GRID_PAD + r * CELL_PX + CELL_PX / 2 + 4);
            }
        }

        drawEmptyCell(ctx, row, col) {
            const x = GRID_PAD + col * CELL_PX;
            const y = GRID_PAD + row * CELL_PX;
            const s = CELL_PX - 2;
            const r = 4;

            ctx.fillStyle = '#2a2a42';
            this.roundRect(ctx, x + 1, y + 1, s, s, r);
            ctx.fill();

            ctx.strokeStyle = '#353550';
            ctx.lineWidth = 1;
            this.roundRect(ctx, x + 1, y + 1, s, s, r);
            ctx.stroke();
        }

        drawBlock(ctx, block, alpha, layerIndex) {
            const color = COLORS[block.color];
            if (!color) return;
            const cells = this.getBlockCells(block);

            for (const cell of cells) {
                if (cell.row < 0 || cell.row >= GRID_ROWS || cell.col < 0 || cell.col >= GRID_COLS) continue;
                const x = GRID_PAD + cell.col * CELL_PX;
                const y = GRID_PAD + cell.row * CELL_PX;
                const s = CELL_PX - 2;
                const rad = 5;

                // Cell fill
                ctx.globalAlpha = alpha;
                ctx.fillStyle = hexToCSS(color.hex);
                this.roundRect(ctx, x + 1, y + 1, s, s, rad);
                ctx.fill();

                // Highlight (top-left)
                ctx.fillStyle = hexToRGBA(color.light, 0.4);
                ctx.fillRect(x + 3, y + 3, s - 6, 4);

                // Shadow (bottom-right)
                ctx.fillStyle = hexToRGBA(color.dark, 0.5);
                ctx.fillRect(x + 3, y + s - 4, s - 6, 3);

                // Layer badge (small number)
                if (layerIndex > 0) {
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.font = 'bold 9px Outfit';
                    ctx.textAlign = 'right';
                    ctx.fillText('L' + layerIndex, x + s - 2, y + s - 2);
                }

                ctx.globalAlpha = 1;
            }

            // Block ID label (on first cell)
            if (cells.length > 0) {
                const c0 = cells[0];
                const x0 = GRID_PAD + c0.col * CELL_PX;
                const y0 = GRID_PAD + c0.row * CELL_PX;
                ctx.globalAlpha = alpha * 0.8;
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 9px JetBrains Mono';
                ctx.textAlign = 'left';
                ctx.fillText(block.id, x0 + 4, y0 + 13);
                ctx.globalAlpha = 1;
            }
        }

        drawPreview(ctx, row, col) {
            const shapeDef = SHAPES[this.selectedShape];
            if (!shapeDef) return;
            const color = COLORS[this.selectedColor];
            if (!color) return;

            const canPlace = this.canPlaceBlock(this.selectedShape, row, col);

            for (const [dr, dc] of shapeDef.cells) {
                const cr = row + dr, cc = col + dc;
                if (cr < 0 || cr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS) continue;
                const x = GRID_PAD + cc * CELL_PX;
                const y = GRID_PAD + cr * CELL_PX;
                const s = CELL_PX - 2;

                ctx.globalAlpha = 0.45;
                ctx.fillStyle = canPlace ? hexToCSS(color.hex) : '#E74C3C';
                this.roundRect(ctx, x + 1, y + 1, s, s, 5);
                ctx.fill();

                ctx.strokeStyle = canPlace ? '#fff' : '#E74C3C';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 3]);
                this.roundRect(ctx, x + 1, y + 1, s, s, 5);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
            }
        }

        roundRect(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        }

        renderAll() {
            this.renderGrid();
            this.renderLayers();
            this.renderCarsConfig();
            this.renderValidation();
            this.updateStatusBar();
        }

        // ───────────────────────────────────────
        // Canvas Events
        // ───────────────────────────────────────

        initCanvasEvents() {
            this.canvas.addEventListener('mousemove', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                const mx = (e.clientX - rect.left) * scaleX;
                const my = (e.clientY - rect.top) * scaleY;

                const col = Math.floor((mx - GRID_PAD) / CELL_PX);
                const row = Math.floor((my - GRID_PAD) / CELL_PX);

                if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
                    this.hoverCell = { row, col };
                    document.getElementById('grid-info').textContent = `Row: ${row}  Col: ${col}`;
                } else {
                    this.hoverCell = null;
                    document.getElementById('grid-info').textContent = 'Hover over grid to see coordinates';
                }
                this.renderGrid();
            });

            this.canvas.addEventListener('mouseleave', () => {
                this.hoverCell = null;
                this.renderGrid();
            });

            this.canvas.addEventListener('click', (e) => {
                if (!this.hoverCell) return;
                const { row, col } = this.hoverCell;

                if (this.tool === 'draw') {
                    if (this.placeBlock(row, col)) {
                        this.renderAll();
                        this.showToast(`Placed ${this.selectedShape} (${this.selectedColor})`);
                    }
                } else if (this.tool === 'erase') {
                    if (this.eraseBlockAt(row, col)) {
                        this.renderAll();
                        this.showToast('Block erased');
                    }
                } else if (this.tool === 'select') {
                    const found = this.findBlockAtAnyLayer(row, col);
                    if (found) {
                        this.selectedBlockId = found.block.id;
                        this.activeLayer = found.layerIndex;
                        this.selectedColor = found.block.color;
                        this.selectedShape = found.block.shape;
                        // Update UI
                        this.buildColorGrid();
                        this.buildShapeGrid();
                        this.renderAll();
                        this.showToast(`Selected ${found.block.id} (${found.block.shape} ${found.block.color})`);
                    } else {
                        this.selectedBlockId = null;
                        this.renderGrid();
                    }
                }
            });

            // Right-click to erase (quick erase regardless of tool)
            this.canvas.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (!this.hoverCell) return;
                if (this.eraseBlockAt(this.hoverCell.row, this.hoverCell.col)) {
                    this.renderAll();
                    this.showToast('Block erased');
                }
            });
        }

        // ───────────────────────────────────────
        // Button Events
        // ───────────────────────────────────────

        initButtonEvents() {
            // Tool buttons
            document.getElementById('tool-buttons').addEventListener('click', (e) => {
                const btn = e.target.closest('.tool-btn');
                if (!btn) return;
                this.tool = btn.dataset.tool;
                this.selectedBlockId = null;
                document.querySelectorAll('#tool-buttons .tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.canvas.style.cursor = this.tool === 'draw' ? 'crosshair'
                    : this.tool === 'erase' ? 'not-allowed' : 'pointer';
                this.updateStatusBar();
                this.renderGrid();
            });

            // Add layer
            document.getElementById('btn-add-layer').addEventListener('click', () => {
                const maxIdx = Math.max(...this.levelData.layers.map(l => l.index), -1);
                const newIdx = maxIdx + 1;
                if (newIdx > 4) {
                    this.showToast('Max 5 layers', true);
                    return;
                }
                this.levelData.layers.push({ index: newIdx, blocks: [] });
                this.activeLayer = newIdx;
                this.renderAll();
                this.showToast(`Layer ${newIdx} added`);
            });

            // Settings inputs → sync to levelData
            const syncInput = (id, path) => {
                const el = document.getElementById(id);
                el.addEventListener('change', () => {
                    const keys = path.split('.');
                    let obj = this.levelData;
                    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
                    const val = el.type === 'number' ? parseInt(el.value) || 0 : el.value;
                    obj[keys[keys.length - 1]] = val;
                });
            };
            syncInput('input-level-id', 'id');
            syncInput('input-level-name', 'name');
            syncInput('input-difficulty', 'difficulty');
            syncInput('input-conveyor-cap', 'conveyorCapacity');
            syncInput('input-funnel-cap', 'funnelCapacity');
            syncInput('input-booster-magnet', 'boosters.magnet');
            syncInput('input-booster-shuffle', 'boosters.shuffle');
            syncInput('input-booster-paint', 'boosters.paintGun');

            // Header buttons
            document.getElementById('btn-new').addEventListener('click', () => {
                if (!confirm('Create new level? Current data will be lost.')) return;
                this.levelData = this.createNewLevel();
                this.activeLayer = 0;
                this.blockIdCounter = 1;
                this.selectedBlockId = null;
                this.syncSettingsToUI();
                this.renderCarsConfig();
                this.renderAll();
                this.showToast('New level created');
            });

            document.getElementById('btn-import').addEventListener('click', () => {
                document.getElementById('import-file-input').click();
            });

            document.getElementById('import-file-input').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        this.importFromText(evt.target.result);
                        this.showToast('Level imported!');
                    } catch (err) {
                        this.showToast('Import failed: ' + err.message, true);
                    }
                };
                reader.readAsText(file);
                e.target.value = '';
            });

            document.getElementById('btn-export').addEventListener('click', () => this.exportJSON());
            document.getElementById('btn-copy').addEventListener('click', () => this.copyToClipboard());
            document.getElementById('btn-playtest').addEventListener('click', () => this.playTest());

            // Level Bank buttons
            document.getElementById('btn-save-bank').addEventListener('click', () => this.saveToBank());
            document.getElementById('btn-send-game').addEventListener('click', () => this.sendAllToGame());
            document.getElementById('btn-gen-levelsjs').addEventListener('click', () => this.generateLevelsJS());

            document.getElementById('btn-clear').addEventListener('click', () => {
                if (!confirm('Clear all blocks?')) return;
                for (const layer of this.levelData.layers) {
                    layer.blocks = [];
                }
                this.selectedBlockId = null;
                this.blockIdCounter = 1;
                this.renderAll();
                this.showToast('All blocks cleared');
            });

            // Initial bank list render
            this.renderBankList();
        }

        // ───────────────────────────────────────
        // Settings Sync
        // ───────────────────────────────────────

        syncSettingsToUI() {
            document.getElementById('input-level-id').value = this.levelData.id;
            document.getElementById('input-level-name').value = this.levelData.name;
            document.getElementById('input-difficulty').value = this.levelData.difficulty;
            document.getElementById('input-conveyor-cap').value = this.levelData.conveyorCapacity;
            document.getElementById('input-funnel-cap').value = this.levelData.funnelCapacity;
            document.getElementById('input-booster-magnet').value = this.levelData.boosters.magnet;
            document.getElementById('input-booster-shuffle').value = this.levelData.boosters.shuffle;
            document.getElementById('input-booster-paint').value = this.levelData.boosters.paintGun;
        }

        // ───────────────────────────────────────
        // Export / Import
        // ───────────────────────────────────────

        getLevelJSON() {
            this.normalizeCarQueueOrders();
            const data = JSON.parse(JSON.stringify(this.levelData));
            // Clean up: ensure ids are unique, sort layers and cars
            data.layers.sort((a, b) => a.index - b.index);
            data.cars.sort((a, b) => a.column - b.column || a.queueOrder - b.queueOrder);
            return JSON.stringify(data, null, 4);
        }

        exportJSON() {
            const json = this.getLevelJSON();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `level_${this.levelData.id}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('Level exported!');
        }

        copyToClipboard() {
            const json = this.getLevelJSON();
            navigator.clipboard.writeText(json).then(() => {
                this.showToast('JSON copied to clipboard!');
            }).catch(() => {
                // Fallback
                const ta = document.createElement('textarea');
                ta.value = json;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                this.showToast('JSON copied to clipboard!');
            });
        }

        importFromText(text) {
            // Try to parse as raw JSON or extract from JS file
            let json = text.trim();

            // If it's a JS file like levels.js, try to extract the first object
            if (json.startsWith('window.') || json.startsWith('//')) {
                const match = json.match(/\{[\s\S]*\}/);
                if (match) json = match[0];
            }

            const data = JSON.parse(json);

            // Validate basic structure
            if (!data.layers || !data.cars) {
                throw new Error('Invalid level format: missing layers or cars');
            }

            this.levelData = data;
            this.levelData.conveyorCapacity ??= CONFIG.CONVEYOR_CAPACITY;
            this.levelData.funnelCapacity ??= CONFIG.FUNNEL_CAPACITY;
            this.levelData.boosters ??= { magnet: 10, shuffle: 10, paintGun: 10 };
            this.levelData.boosters.magnet ??= 10;
            this.levelData.boosters.shuffle ??= 10;
            this.levelData.boosters.paintGun ??= 10;
            this.activeLayer = data.layers[0]?.index || 0;
            this.normalizeCarQueueOrders();

            // Recalculate blockIdCounter
            let maxId = 0;
            for (const layer of data.layers) {
                for (const block of layer.blocks) {
                    const num = parseInt(block.id.replace(/\D/g, ''));
                    if (num > maxId) maxId = num;
                }
            }
            this.blockIdCounter = maxId + 1;

            this.syncSettingsToUI();
            this.buildColorGrid();
            this.buildShapeGrid();
            this.renderCarsConfig();
            this.renderAll();
        }

        playTest() {
            const json = this.getLevelJSON();
            localStorage.setItem('editorTestLevel', json);
            window.open('index.html?testLevel=1', '_blank');
            this.showToast('Play test opened in new tab');
        }

        // ───────────────────────────────────────
        // Level Bank (localStorage multi-level)
        // ───────────────────────────────────────

        getLevelBank() {
            try {
                const raw = localStorage.getItem('levelBank');
                if (raw) return JSON.parse(raw);
            } catch (e) { /* ignore */ }
            return [];
        }

        saveLevelBank(bank) {
            localStorage.setItem('levelBank', JSON.stringify(bank));
        }

        saveToBank() {
            const bank = this.getLevelBank();
            const levelCopy = JSON.parse(this.getLevelJSON());
            const existingIdx = bank.findIndex(l => l.id === levelCopy.id);

            if (existingIdx !== -1) {
                bank[existingIdx] = levelCopy;
                this.showToast(`Level ${levelCopy.id} updated in Bank`);
            } else {
                bank.push(levelCopy);
                this.showToast(`Level ${levelCopy.id} saved to Bank`);
            }

            bank.sort((a, b) => a.id - b.id);
            this.saveLevelBank(bank);
            this.renderBankList();
        }

        loadFromBank(levelId) {
            const bank = this.getLevelBank();
            const level = bank.find(l => l.id === levelId);
            if (!level) {
                this.showToast('Level not found in Bank', true);
                return;
            }
            this.importFromText(JSON.stringify(level));
            this.showToast(`Level ${levelId} loaded from Bank`);
        }

        deleteFromBank(levelId) {
            let bank = this.getLevelBank();
            bank = bank.filter(l => l.id !== levelId);
            this.saveLevelBank(bank);
            this.renderBankList();
            this.showToast(`Level ${levelId} removed from Bank`);
        }

        sendAllToGame() {
            const bank = this.getLevelBank();
            if (bank.length === 0) {
                this.showToast('Bank is empty — save some levels first', true);
                return;
            }
            localStorage.setItem('customLevels', JSON.stringify(bank));
            this.showToast(`${bank.length} levels sent to Game! Refresh game to play.`);
        }

        generateLevelsJS() {
            const bank = this.getLevelBank();
            if (bank.length === 0) {
                this.showToast('Bank is empty — save some levels first', true);
                return;
            }
            const json = JSON.stringify(bank, null, 4);
            const content = `// ============================================================\n// Level Definitions — window.LEVELS\n// Auto-generated by Level Editor on ${new Date().toISOString()}\n// ============================================================\n\nwindow.LEVELS = ${json};\n`;
            const blob = new Blob([content], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'levels.js';
            a.click();
            URL.revokeObjectURL(url);
            this.showToast(`levels.js exported with ${bank.length} levels!`);
        }

        renderBankList() {
            const container = document.getElementById('bank-list');
            if (!container) return;
            const bank = this.getLevelBank();
            container.innerHTML = '';

            if (bank.length === 0) {
                container.innerHTML = '<div style="font-size:12px;color:#666;">No saved levels yet. Use "💾 Save to Bank" to add levels.</div>';
                return;
            }

            for (const level of bank) {
                const totalBlocks = level.layers.reduce((sum, l) => sum + l.blocks.length, 0);
                const el = document.createElement('div');
                el.className = 'bank-item';
                el.innerHTML = `
                    <span class="bank-id">#${level.id}</span>
                    <span class="bank-name">${level.name || 'Untitled'}</span>
                    <span class="bank-meta">${totalBlocks}blk ${level.difficulty || ''}</span>
                    <span class="bank-play" data-id="${level.id}" title="Play Test">▶</span>
                    <span class="bank-load" data-id="${level.id}" title="Load">📂</span>
                    <span class="bank-delete" data-id="${level.id}" title="Delete">✕</span>
                `;
                container.appendChild(el);
            }

            container.onclick = (e) => {
                const playBtn = e.target.closest('.bank-play');
                const loadBtn = e.target.closest('.bank-load');
                const delBtn = e.target.closest('.bank-delete');
                if (playBtn) {
                    this.playTestForLevel(parseInt(playBtn.dataset.id));
                } else if (loadBtn) {
                    this.loadFromBank(parseInt(loadBtn.dataset.id));
                } else if (delBtn) {
                    if (confirm('Delete this level from bank?')) {
                        this.deleteFromBank(parseInt(delBtn.dataset.id));
                    }
                }
            };
        }

        playTestForLevel(levelId) {
            const bank = this.getLevelBank();
            const level = bank.find(l => l.id === levelId);
            if (!level) return;
            localStorage.setItem('editorTestLevel', JSON.stringify(level));
            window.open('index.html?testLevel=1', '_blank');
            this.showToast(`Play testing Level ${levelId}...`);
        }

        // ───────────────────────────────────────
        // Status & Toast
        // ───────────────────────────────────────

        updateStatusBar() {
            const totalBlocks = this.getAllBlocks().length;
            document.getElementById('status-blocks').textContent = `Blocks: ${totalBlocks}`;
            document.getElementById('status-selection').textContent =
                `Tool: ${this.tool} | ${this.selectedColor} ${this.selectedShape} | Layer ${this.activeLayer}`;
        }

        showToast(msg, isError) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.style.borderColor = isError ? '#E74C3C' : 'var(--border-light)';
            toast.classList.add('show');
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
        }
    }

    // ─── Init on load ───
    window.addEventListener('DOMContentLoaded', () => {
        window.editor = new LevelEditor();
    });

})();