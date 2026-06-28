// ============================================================
// Block Blast Flow! — Level Editor
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
    const CUBES_PER_CELL = CONFIG.CUBES_PER_CELL || 8;
    const DEFAULT_CAR_CAPACITY = 16;

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
            this.draggedBlockId = null;
            this.dragStartCell = null;
            this.dragStartPosition = null;
            this.dragPreview = null;
            this.suppressNextClick = false;
            this.hiddenLayers = new Set();
            this.bankFilterText = '';

            // Undo/redo history (JSON snapshots of levelData)
            this.history = [];
            this.future = [];
            this.HISTORY_LIMIT = 40;
            this.dirty = false;

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
            this.initKeyboardShortcuts();
            this.initUnsavedWarning();
            this.renderAll();
        }

        // ───────────────────────────────────────
        // Undo / Redo history
        // ───────────────────────────────────────

        snapshotState() {
            return JSON.stringify(this.levelData);
        }

        restoreState(json) {
            this.levelData = JSON.parse(json);
        }

        /** Run `mutateFn` (returns truthy on success); on success, push a pre-mutation snapshot to history. */
        withHistory(mutateFn) {
            const snapshot = this.snapshotState();
            const result = mutateFn();
            if (result) {
                this.history.push(snapshot);
                if (this.history.length > this.HISTORY_LIMIT) this.history.shift();
                this.future = [];
                this.dirty = true;
            }
            return result;
        }

        afterHistoryRestore() {
            this.selectedBlockId = null;
            this.draggedBlockId = null;
            if (!this.levelData.layers.some(l => l.index === this.activeLayer)) {
                this.activeLayer = this.levelData.layers[0] ? this.levelData.layers[0].index : 0;
            }
            this.hiddenLayers.clear();
            this.syncSettingsToUI();
            this.renderCarsConfig();
            this.refreshBlockLayerSelect();
            this.renderAll();
        }

        undo() {
            if (this.history.length === 0) {
                this.showToast('Nothing to undo', true);
                return;
            }
            this.future.push(this.snapshotState());
            this.restoreState(this.history.pop());
            this.afterHistoryRestore();
            this.showToast('Undo');
        }

        redo() {
            if (this.future.length === 0) {
                this.showToast('Nothing to redo', true);
                return;
            }
            this.history.push(this.snapshotState());
            this.restoreState(this.future.pop());
            this.afterHistoryRestore();
            this.showToast('Redo');
        }

        initKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                const tag = document.activeElement && document.activeElement.tagName;
                const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

                if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    this.undo();
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
                    e.preventDefault();
                    this.redo();
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    this.saveToBank();
                    return;
                }
                if (!inField && (e.key === 'Delete' || e.key === 'Backspace') && this.selectedBlockId) {
                    e.preventDefault();
                    const record = this.getSelectedBlockRecord();
                    if (record && this.withHistory(() => this.eraseBlockAt(record.block.row, record.block.col))) {
                        this.renderAll();
                        this.showToast('Block deleted');
                    }
                    return;
                }

                if (inField || e.ctrlKey || e.metaKey || e.altKey) return;

                const TOOL_KEYS = { b: 'draw', d: 'erase', v: 'select' };
                const tool = TOOL_KEYS[e.key.toLowerCase()];
                if (tool) {
                    e.preventDefault();
                    this.selectTool(tool);
                }
            });
        }

        initUnsavedWarning() {
            window.addEventListener('beforeunload', (e) => {
                if (!this.dirty) return;
                e.preventDefault();
                e.returnValue = '';
            });
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
                    { column: 0, color: 'red', capacity: DEFAULT_CAR_CAPACITY, queueOrder: 0 },
                    { column: 1, color: 'blue', capacity: DEFAULT_CAR_CAPACITY, queueOrder: 0 },
                    { column: 2, color: 'green', capacity: DEFAULT_CAR_CAPACITY, queueOrder: 0 },
                ],
                boosters: { magnet: 10, shuffle: 10, paintGun: 10 },
            };
        }

        getActiveLayerData() {
            return this.levelData.layers.find(l => l.index === this.activeLayer);
        }

        isLayerVisible(layerIndex) {
            return !this.hiddenLayers.has(layerIndex);
        }

        toggleLayerVisibility(layerIndex) {
            if (this.hiddenLayers.has(layerIndex)) {
                this.hiddenLayers.delete(layerIndex);
            } else {
                this.hiddenLayers.add(layerIndex);
            }

            this.renderLayers();
            this.renderGrid();
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
            return shape.unitCount * CUBES_PER_CELL;
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

            const generated = [];

            for (const item of priority) {
                let remaining = item.totalCubes;
                while (remaining > 0) {
                    const capacity = Math.min(DEFAULT_CAR_CAPACITY, remaining);
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
            const layers = [...this.levelData.layers].sort((a, b) => b.index - a.index);

            for (const layer of layers) {
                if (!this.isLayerVisible(layer.index)) continue;

                for (const block of layer.blocks) {
                    const cells = this.getBlockCells(block);
                    if (cells.some(c => c.row === row && c.col === col)) {
                        return { block, layerIndex: layer.index };
                    }
                }
            }
            return null;
        }

        findBlockRecordById(blockId) {
            if (!blockId) return null;

            for (const layer of this.levelData.layers) {
                for (const block of layer.blocks) {
                    if (block.id === blockId) {
                        return { block, layerIndex: layer.index, layer };
                    }
                }
            }

            return null;
        }

        getSelectedBlockRecord() {
            return this.findBlockRecordById(this.selectedBlockId);
        }

        getLayerData(layerIndex) {
            return this.levelData.layers.find(l => l.index === layerIndex) || null;
        }

        setActiveTool(tool) {
            this.tool = tool;
            document.querySelectorAll('#tool-buttons .tool-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.tool === tool);
            });
            this.canvas.style.cursor = tool === 'draw' ? 'crosshair'
                : tool === 'erase' ? 'not-allowed' : 'pointer';
        }

        getRotatedShapeName(shapeName) {
            const shape = SHAPES[shapeName];
            if (!shape) return null;

            const rotated = shape.cells.map(([row, col]) => [col, -row]);
            const minRow = Math.min(...rotated.map(([row]) => row));
            const minCol = Math.min(...rotated.map(([, col]) => col));
            const normalizedKey = rotated
                .map(([row, col]) => `${row - minRow},${col - minCol}`)
                .sort()
                .join('|');

            for (const [name, candidate] of Object.entries(SHAPES)) {
                const candidateKey = candidate.cells
                    .map(([row, col]) => `${row},${col}`)
                    .sort()
                    .join('|');

                if (candidateKey === normalizedKey) return name;
            }

            return null;
        }

        rotateSelectedBlock() {
            const record = this.getSelectedBlockRecord();

            if (!record) {
                this.showToast('Select a block first', true);
                return false;
            }

            const nextShape = this.getRotatedShapeName(record.block.shape);

            if (!nextShape) {
                this.showToast(`${record.block.shape} cannot rotate`, true);
                return false;
            }

            if (!this.canPlaceBlock(
                nextShape,
                record.block.row,
                record.block.col,
                record.block.id,
                record.layerIndex
            )) {
                this.showToast(`Cannot rotate ${record.block.id}: cells overlap or leave board`, true);
                return false;
            }

            record.block.shape = nextShape;
            this.selectedShape = nextShape;
            this.buildShapeGrid();
            this.renderAll();
            this.showToast(`${record.block.id} rotated to ${nextShape}`);
            return true;
        }

        setSelectedBlockColor(color) {
            const record = this.getSelectedBlockRecord();

            if (!record || !COLOR_NAMES.includes(color)) {
                this.showToast('Select a block first', true);
                return false;
            }

            record.block.color = color;
            this.selectedColor = color;
            this.buildColorGrid();
            this.renderAll();
            this.showToast(`${record.block.id} color set to ${color}`);
            return true;
        }

        setSelectedBlockShape(shapeName) {
            const record = this.getSelectedBlockRecord();

            if (!record || !SHAPES[shapeName]) {
                this.showToast('Select a block first', true);
                return false;
            }

            if (shapeName === record.block.shape) return true;

            if (!this.canPlaceBlock(
                shapeName,
                record.block.row,
                record.block.col,
                record.block.id,
                record.layerIndex
            )) {
                this.showToast(`Cannot change ${record.block.id} to ${shapeName}: cells overlap or leave board`, true);
                this.updateFrozenPanel();
                return false;
            }

            record.block.shape = shapeName;
            this.selectedShape = shapeName;
            this.buildShapeGrid();
            this.renderAll();
            this.showToast(`${record.block.id} shape set to ${shapeName}`);
            return true;
        }

        setSelectedBlockLayer(rawLayerIndex) {
            const record = this.getSelectedBlockRecord();

            if (!record) {
                this.showToast('Select a block first', true);
                return false;
            }

            const targetLayerIndex = parseInt(rawLayerIndex, 10);
            const targetLayer = this.getLayerData(targetLayerIndex);

            if (!targetLayer) {
                this.showToast('Layer not found', true);
                return false;
            }

            if (targetLayerIndex === record.layerIndex) return true;

            if (!this.canPlaceBlock(
                record.block.shape,
                record.block.row,
                record.block.col,
                record.block.id,
                targetLayerIndex
            )) {
                this.showToast(`Cannot move ${record.block.id} to L${targetLayerIndex}: cells overlap`, true);
                this.updateFrozenPanel();
                return false;
            }

            record.layer.blocks = record.layer.blocks.filter(block => block.id !== record.block.id);
            targetLayer.blocks.push(record.block);
            this.activeLayer = targetLayerIndex;

            this.renderAll();
            this.showToast(`${record.block.id} moved to L${targetLayerIndex}`);
            return true;
        }

        setSelectedBlockFrozenCount(rawValue) {
            const record = this.getSelectedBlockRecord();

            if (!record) {
                this.showToast('Select a block first', true);
                return false;
            }

            const count = Math.max(0, parseInt(rawValue || 0, 10) || 0);

            if (count > 0) {
                record.block.frozenCount = count;
            } else {
                delete record.block.frozenCount;
            }

            this.renderAll();
            this.showToast(count > 0
                ? `${record.block.id} frozen count set to ${count}`
                : `${record.block.id} frozen cleared`);

            return true;
        }

        setSelectedBlockKeyColor(color) {
            const record = this.getSelectedBlockRecord();

            if (!record) {
                this.showToast('Select a block first', true);
                return false;
            }

            if (color) {
                record.block.keyColor = color;
                delete record.block.lockColor;
            } else {
                delete record.block.keyColor;
            }

            this.renderAll();
            this.showToast(color
                ? `${record.block.id} key set to ${color}`
                : `${record.block.id} key cleared`);

            return true;
        }

        setSelectedBlockLockColor(color) {
            const record = this.getSelectedBlockRecord();

            if (!record) {
                this.showToast('Select a block first', true);
                return false;
            }

            if (color) {
                record.block.lockColor = color;
                delete record.block.keyColor;
            } else {
                delete record.block.lockColor;
            }

            this.renderAll();
            this.showToast(color
                ? `${record.block.id} lock set to ${color}`
                : `${record.block.id} lock cleared`);

            return true;
        }

        getKeyLockMatchWarnings() {
            const keyColors = new Set();
            const lockColors = new Set();

            for (const layer of this.levelData.layers) {
                for (const block of layer.blocks || []) {
                    if (block.keyColor) keyColors.add(block.keyColor);
                    if (block.lockColor) lockColors.add(block.lockColor);
                }
            }

            const warnings = [];

            for (const color of keyColors) {
                if (!lockColors.has(color)) warnings.push(`Key ${color} has no matching lock`);
            }

            for (const color of lockColors) {
                if (!keyColors.has(color)) warnings.push(`Lock ${color} has no matching key`);
            }

            return warnings;
        }

        updateFrozenPanel() {
            this.refreshBlockLayerSelect();

            const label = document.getElementById('frozen-selected-label');
            const layerSelect = document.getElementById('select-block-layer');
            const input = document.getElementById('input-frozen-count');
            const applyBtn = document.getElementById('btn-apply-frozen');
            const clearBtn = document.getElementById('btn-clear-frozen');
            const keySelect = document.getElementById('select-key-color');
            const lockSelect = document.getElementById('select-lock-color');
            const rotateBtn = document.getElementById('btn-rotate-block');
            const warning = document.getElementById('key-lock-warning');

            if (!label || !input || !applyBtn || !clearBtn || !keySelect || !lockSelect) return;

            const record = this.getSelectedBlockRecord();
            const hasSelection = !!record;

            if (layerSelect) layerSelect.disabled = !hasSelection;
            input.disabled = !hasSelection;
            applyBtn.disabled = !hasSelection;
            clearBtn.disabled = !hasSelection;
            keySelect.disabled = !hasSelection;
            lockSelect.disabled = !hasSelection;
            if (rotateBtn) rotateBtn.disabled = !hasSelection;

            if (!record) {
                label.textContent = 'Select a block to edit properties.';
                if (layerSelect) layerSelect.value = '';
                input.value = '0';
                keySelect.value = '';
                lockSelect.value = '';
                if (warning) warning.textContent = this.getKeyLockMatchWarnings().join('. ');
                return;
            }

            const count = Math.max(0, parseInt(record.block.frozenCount || 0, 10) || 0);
            label.textContent = `Selected ${record.block.id} on L${record.layerIndex}`;
            if (layerSelect) layerSelect.value = String(record.layerIndex);
            input.value = String(count);
            keySelect.value = record.block.keyColor || '';
            lockSelect.value = record.block.lockColor || '';
            if (warning) warning.textContent = this.getKeyLockMatchWarnings().join('. ');
        }

        canPlaceBlock(shape, row, col, excludeBlockId, layerIndex = this.activeLayer) {
            const shapeDef = SHAPES[shape];
            if (!shapeDef) return false;
            const cells = shapeDef.cells.map(([dr, dc]) => ({ row: row + dr, col: col + dc }));

            // Bounds check
            for (const c of cells) {
                if (c.row < 0 || c.row >= GRID_ROWS || c.col < 0 || c.col >= GRID_COLS) return false;
            }

            // Overlap check (same layer)
            const layer = this.getLayerData(layerIndex);
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
            const block = {
                id,
                shape: this.selectedShape,
                color: this.selectedColor,
                row,
                col,
            };

            layer.blocks.push(block);
            return true;
        }

        eraseBlockAt(row, col) {
            const layer = this.getActiveLayerData();
            if (!layer) return false;
            const block = this.findBlockAt(row, col);
            if (!block) return false;
            layer.blocks = layer.blocks.filter(b => b.id !== block.id);
            if (this.selectedBlockId === block.id) {
                this.selectedBlockId = null;
            }
            return true;
        }

        // ───────────────────────────────────────
        // Init UI
        // ───────────────────────────────────────

        initUI() {
            this.buildColorGrid();
            this.buildShapeGrid();
            this.buildBlockPropertySelects();
            this.buildKeyLockSelects();
            this.renderLayers();
            this.renderCarsConfig();
            this.renderValidation();

            const bankSearch = document.getElementById('bank-search');
            if (bankSearch) {
                bankSearch.addEventListener('input', () => {
                    this.bankFilterText = bankSearch.value;
                    this.renderBankList();
                });
            }
        }

        buildBlockPropertySelects() {
            this.refreshBlockLayerSelect();
        }

        refreshBlockLayerSelect() {
            const layerSelect = document.getElementById('select-block-layer');
            if (!layerSelect) return;

            const previousValue = layerSelect.value;
            layerSelect.innerHTML = '';

            for (const layer of [...this.levelData.layers].sort((a, b) => a.index - b.index)) {
                const option = document.createElement('option');
                option.value = String(layer.index);
                option.textContent = `L${layer.index}`;
                layerSelect.appendChild(option);
            }

            if ([...layerSelect.options].some(option => option.value === previousValue)) {
                layerSelect.value = previousValue;
            }
        }

        buildKeyLockSelects() {
            const selects = [
                document.getElementById('select-key-color'),
                document.getElementById('select-lock-color'),
            ].filter(Boolean);

            for (const select of selects) {
                select.innerHTML = '';

                const none = document.createElement('option');
                none.value = '';
                none.textContent = 'none';
                select.appendChild(none);

                for (const color of COLOR_NAMES) {
                    const option = document.createElement('option');
                    option.value = color;
                    option.textContent = color;
                    select.appendChild(option);
                }
            }
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
                    if (this.selectedBlockId) {
                        this.withHistory(() => this.setSelectedBlockColor(name));
                        return;
                    }
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
                    if (this.selectedBlockId) {
                        this.withHistory(() => this.setSelectedBlockShape(key));
                        return;
                    }
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
                const visible = this.isLayerVisible(layer.index);
                const el = document.createElement('div');
                el.className = [
                    'layer-item',
                    layer.index === this.activeLayer ? 'active' : '',
                    visible ? '' : 'hidden',
                ].filter(Boolean).join(' ');
                el.innerHTML = `
                    <button class="layer-visibility" data-layer="${layer.index}" title="${visible ? 'Hide layer' : 'Show layer'}">${visible ? 'ON' : 'OFF'}</button>
                    <span class="layer-badge">L${layer.index}</span>
                    <span class="layer-info">${layer.blocks.length} blocks</span>
                    ${this.levelData.layers.length > 1
                        ? `<span class="layer-delete" data-layer="${layer.index}" title="Delete layer">✕</span>`
                        : ''}
                `;
                el.addEventListener('click', (e) => {
                    if (e.target.closest('.layer-visibility')) {
                        const idx = parseInt(e.target.closest('.layer-visibility').dataset.layer);
                        this.toggleLayerVisibility(idx);
                        return;
                    }

                    if (e.target.classList.contains('layer-delete')) {
                        const idx = parseInt(e.target.dataset.layer);
                        const selectedRecord = this.getSelectedBlockRecord();
                        this.levelData.layers = this.levelData.layers.filter(l => l.index !== idx);
                        this.hiddenLayers.delete(idx);
                        if (selectedRecord && selectedRecord.layerIndex === idx) {
                            this.selectedBlockId = null;
                        }
                        if (this.activeLayer === idx) {
                            this.activeLayer = this.levelData.layers[0]?.index || 0;
                        }
                        this.renderAll();
                        return;
                    }
                    this.activeLayer = layer.index;
                    this.renderAll();
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
                    item.className = 'car-item' + (car.hidden ? ' is-hidden' : '');
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

                    // Color dot (with ? overlay when hidden)
                    const dot = document.createElement('div');
                    dot.className = 'car-color-dot' + (car.hidden ? ' mystery' : '');
                    dot.style.background = hexToCSS(COLORS[car.color]?.hex || 0x888888);
                    if (car.hidden) {
                        dot.title = 'Hidden Car — revealed when active';
                        const qMark = document.createElement('span');
                        qMark.className = 'car-mystery-q';
                        qMark.textContent = '?';
                        dot.appendChild(qMark);
                    }
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

                    // Hidden checkbox
                    const hiddenLabel = document.createElement('label');
                    hiddenLabel.className = 'car-hidden-label';
                    hiddenLabel.title = 'Mystery Car: shows "?" in queue, reveals when active';
                    const hiddenCheck = document.createElement('input');
                    hiddenCheck.type = 'checkbox';
                    hiddenCheck.checked = !!car.hidden;
                    hiddenCheck.addEventListener('change', () => {
                        car.hidden = hiddenCheck.checked;
                        this.renderCarsConfig();
                        this.renderValidation();
                    });
                    hiddenCheck.addEventListener('mousedown', (e) => e.stopPropagation());
                    hiddenLabel.appendChild(hiddenCheck);
                    hiddenLabel.appendChild(document.createTextNode('🎭'));
                    item.appendChild(hiddenLabel);

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
                        capacity: DEFAULT_CAR_CAPACITY,
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
                    const cubes = shape.unitCount * CUBES_PER_CELL;
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

                if (!pass) {
                    const hasCar = this.levelData.cars.some(c => c.color === color);
                    const fixBtn = document.createElement('button');
                    fixBtn.className = 'v-fix-btn';
                    fixBtn.textContent = hasCar ? 'Fix' : 'No car';
                    fixBtn.disabled = !hasCar;
                    fixBtn.title = hasCar
                        ? `Set ${color} car capacity to match ${cubes} cubes`
                        : `Add a ${color} car first`;
                    fixBtn.addEventListener('click', () => this.quickFixColorBalance(color, cubes));
                    row.appendChild(fixBtn);
                }

                container.appendChild(row);
            }

            if (allColors.size === 0) {
                container.innerHTML = '<div style="font-size:12px;color:#6666888;">No blocks or cars yet</div>';
            }

            const keyLockWarnings = this.getKeyLockMatchWarnings();
            for (const message of keyLockWarnings) {
                allPass = false;

                const row = document.createElement('div');
                row.className = 'validation-row fail key-lock-validation';

                const icon = document.createElement('span');
                icon.className = 'v-icon';
                icon.textContent = '!';
                row.appendChild(icon);

                const text = document.createElement('span');
                text.textContent = message;
                row.appendChild(text);

                container.appendChild(row);
            }

            // Update status dot
            const dot = document.getElementById('status-dot');
            dot.className = 'status-dot' + (allPass && allColors.size > 0 ? '' : ' error');
        }

        /** Redistribute total cube count across the existing cars of `color` so capacity matches exactly. */
        quickFixColorBalance(color, cubes) {
            const cars = this.levelData.cars.filter(c => c.color === color);
            if (cars.length === 0) {
                this.showToast(`No ${color} car to balance — add one first`, true);
                return;
            }

            this.withHistory(() => {
                const base = Math.floor(cubes / cars.length);
                let remainder = cubes - base * cars.length;
                for (const car of cars) {
                    car.capacity = base + (remainder > 0 ? 1 : 0);
                    if (remainder > 0) remainder--;
                }
                return true;
            });

            this.renderCarsConfig();
            this.renderValidation();
            this.showToast(`${color} car capacity set to match ${cubes} cubes`);
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
                if (!this.isLayerVisible(layer.index)) continue;

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

            if (this.dragPreview) {
                const record = this.findBlockRecordById(this.dragPreview.blockId);

                if (record) {
                    this.drawBlockPlacementPreview(
                        ctx,
                        record.block,
                        this.dragPreview.row,
                        this.dragPreview.col,
                        this.dragPreview.valid
                    );
                }
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
            const frozenCount = Math.max(0, parseInt(block.frozenCount || 0, 10) || 0);

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

                // Frozen Countdown overlay
                if (frozenCount > 0) {
                    ctx.globalAlpha = alpha * 0.62;
                    ctx.fillStyle = '#BDEEFF';
                    this.roundRect(ctx, x + 1, y + 1, s, s, rad);
                    ctx.fill();

                    ctx.globalAlpha = alpha * 0.85;
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 3]);
                    this.roundRect(ctx, x + 4, y + 4, s - 6, s - 6, rad);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Layer badge (small number)
                if (layerIndex > 0) {
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.font = 'bold 9px Outfit';
                    ctx.textAlign = 'right';
                    ctx.fillText('L' + layerIndex, x + s - 2, y + s - 2);
                }

                ctx.globalAlpha = 1;
            }

            if (frozenCount > 0 && cells.length > 0) {
                const validCells = cells.filter(c => c.row >= 0 && c.row < GRID_ROWS && c.col >= 0 && c.col < GRID_COLS);
                const avgCol = validCells.reduce((sum, c) => sum + c.col, 0) / Math.max(1, validCells.length);
                const avgRow = validCells.reduce((sum, c) => sum + c.row, 0) / Math.max(1, validCells.length);
                const cx = GRID_PAD + avgCol * CELL_PX + CELL_PX / 2;
                const cy = GRID_PAD + avgRow * CELL_PX + CELL_PX / 2;

                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#DDF8FF';
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(cx, cy, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#1E5A78';
                ctx.font = 'bold 18px Outfit';
                ctx.textAlign = 'center';
                ctx.fillText(String(frozenCount), cx, cy + 6);
                ctx.globalAlpha = 1;
            }

            if ((block.keyColor || block.lockColor) && cells.length > 0) {
                const validCells = cells.filter(c => c.row >= 0 && c.row < GRID_ROWS && c.col >= 0 && c.col < GRID_COLS);
                if (validCells.length > 0) {
                    const minCol = Math.min(...validCells.map(c => c.col));
                    const maxCol = Math.max(...validCells.map(c => c.col));
                    const minRow = Math.min(...validCells.map(c => c.row));
                    const maxRow = Math.max(...validCells.map(c => c.row));

                    if (block.lockColor) {
                        this.drawMetaBadge(
                            ctx,
                            GRID_PAD + (maxCol + 1) * CELL_PX - 12,
                            GRID_PAD + minRow * CELL_PX + 12,
                            block.lockColor,
                            'L',
                            alpha,
                            '#FFFFFF'
                        );
                    }

                    if (block.keyColor) {
                        this.drawMetaBadge(
                            ctx,
                            GRID_PAD + (maxCol + 1) * CELL_PX - 12,
                            GRID_PAD + (maxRow + 1) * CELL_PX - 12,
                            block.keyColor,
                            'K',
                            alpha,
                            '#F7DC6F'
                        );
                    }
                }
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

        drawMetaBadge(ctx, cx, cy, colorName, text, alpha, strokeStyle) {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = hexToCSS(COLORS[colorName]?.hex || 0x888888);
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 10px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(text, cx, cy + 4);
            ctx.globalAlpha = 1;
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

        drawBlockPlacementPreview(ctx, block, row, col, isValid) {
            const shapeDef = SHAPES[block.shape];
            const color = COLORS[block.color];
            if (!shapeDef || !color) return;

            for (const [dr, dc] of shapeDef.cells) {
                const cr = row + dr;
                const cc = col + dc;
                if (cr < 0 || cr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS) continue;

                const x = GRID_PAD + cc * CELL_PX;
                const y = GRID_PAD + cr * CELL_PX;
                const s = CELL_PX - 2;

                ctx.globalAlpha = 0.56;
                ctx.fillStyle = isValid ? hexToCSS(color.hex) : '#E74C3C';
                this.roundRect(ctx, x + 1, y + 1, s, s, 5);
                ctx.fill();

                ctx.globalAlpha = 0.95;
                ctx.strokeStyle = isValid ? '#F1C40F' : '#E74C3C';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([5, 3]);
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
            this.updateFrozenPanel();
            this.updateStatusBar();
        }

        getCanvasCellFromEvent(e) {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;

            const col = Math.floor((mx - GRID_PAD) / CELL_PX);
            const row = Math.floor((my - GRID_PAD) / CELL_PX);

            if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) {
                return null;
            }

            return { row, col };
        }

        beginBlockDrag(block, layerIndex, cell) {
            this._dragHistorySnapshot = this.snapshotState();
            this.selectedBlockId = block.id;
            this.activeLayer = layerIndex;
            this.selectedColor = block.color;
            this.selectedShape = block.shape;
            this.draggedBlockId = block.id;
            this.dragStartCell = { ...cell };
            this.dragStartPosition = {
                row: block.row,
                col: block.col,
            };
            this.dragPreview = {
                blockId: block.id,
                row: block.row,
                col: block.col,
                valid: true,
            };
            this.buildColorGrid();
            this.buildShapeGrid();
            this.renderAll();
        }

        updateBlockDrag(cell) {
            if (!this.draggedBlockId || !this.dragStartCell || !this.dragStartPosition || !cell) return;

            const record = this.findBlockRecordById(this.draggedBlockId);
            if (!record) return;

            const row = this.dragStartPosition.row + (cell.row - this.dragStartCell.row);
            const col = this.dragStartPosition.col + (cell.col - this.dragStartCell.col);
            const valid = this.canPlaceBlock(
                record.block.shape,
                row,
                col,
                record.block.id,
                record.layerIndex
            );

            this.dragPreview = {
                blockId: record.block.id,
                row,
                col,
                valid,
            };
            this.renderGrid();
        }

        endBlockDrag() {
            if (!this.draggedBlockId) return;

            const preview = this.dragPreview;
            const record = this.findBlockRecordById(this.draggedBlockId);
            const moved = record &&
                preview &&
                preview.valid &&
                (record.block.row !== preview.row || record.block.col !== preview.col);

            if (moved) {
                record.block.row = preview.row;
                record.block.col = preview.col;
                if (this._dragHistorySnapshot) {
                    this.history.push(this._dragHistorySnapshot);
                    if (this.history.length > this.HISTORY_LIMIT) this.history.shift();
                    this.future = [];
                    this.dirty = true;
                }
                this.showToast(`${record.block.id} moved to ${preview.row}, ${preview.col}`);
            } else if (preview && !preview.valid) {
                this.showToast('Cannot move block there', true);
            }

            this._dragHistorySnapshot = null;
            this.draggedBlockId = null;
            this.dragStartCell = null;
            this.dragStartPosition = null;
            this.dragPreview = null;
            this.suppressNextClick = true;
            this.renderAll();
        }

        // ───────────────────────────────────────
        // Canvas Events
        // ───────────────────────────────────────

        initCanvasEvents() {
            this.canvas.addEventListener('mousemove', (e) => {
                const cell = this.getCanvasCellFromEvent(e);

                if (cell) {
                    this.hoverCell = cell;
                    document.getElementById('grid-info').textContent = `Row: ${cell.row}  Col: ${cell.col}`;
                } else {
                    this.hoverCell = null;
                    document.getElementById('grid-info').textContent = 'Hover over grid to see coordinates';
                }

                if (this.draggedBlockId) {
                    this.updateBlockDrag(cell);
                    return;
                }

                this.renderGrid();
            });

            this.canvas.addEventListener('mouseleave', () => {
                this.hoverCell = null;
                this.renderGrid();
            });

            this.canvas.addEventListener('mousedown', (e) => {
                if (e.button !== 0 || this.tool !== 'select') return;

                const cell = this.getCanvasCellFromEvent(e);
                if (!cell) return;

                const found = this.findBlockAtAnyLayer(cell.row, cell.col);
                if (!found) return;

                this.beginBlockDrag(found.block, found.layerIndex, cell);
            });

            window.addEventListener('mouseup', () => {
                this.endBlockDrag();
            });

            this.canvas.addEventListener('click', (e) => {
                if (this.suppressNextClick) {
                    this.suppressNextClick = false;
                    return;
                }

                if (!this.hoverCell) return;
                const { row, col } = this.hoverCell;

                if (this.tool === 'draw') {
                    if (this.withHistory(() => this.placeBlock(row, col))) {
                        this.renderAll();
                        this.showToast(`Placed ${this.selectedShape} (${this.selectedColor})`);
                    }
                } else if (this.tool === 'erase') {
                    if (this.withHistory(() => this.eraseBlockAt(row, col))) {
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
                        this.renderAll();
                    }
                }
            });

            // Right-click to erase (quick erase regardless of tool)
            this.canvas.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (!this.hoverCell) return;
                if (this.withHistory(() => this.eraseBlockAt(this.hoverCell.row, this.hoverCell.col))) {
                    this.renderAll();
                    this.showToast('Block erased');
                }
            });
        }

        // ───────────────────────────────────────
        // Button Events
        // ───────────────────────────────────────

        selectTool(tool) {
            this.selectedBlockId = null;
            this.setActiveTool(tool);
            this.updateStatusBar();
            this.updateFrozenPanel();
            this.renderGrid();
        }

        initButtonEvents() {
            // Tool buttons
            document.getElementById('tool-buttons').addEventListener('click', (e) => {
                const btn = e.target.closest('.tool-btn');
                if (!btn) return;
                this.selectTool(btn.dataset.tool);
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

            document.getElementById('select-block-layer').addEventListener('change', (e) => {
                this.setSelectedBlockLayer(e.target.value);
            });

            // Frozen Countdown controls
            document.getElementById('btn-apply-frozen').addEventListener('click', () => {
                const value = document.getElementById('input-frozen-count').value;
                this.setSelectedBlockFrozenCount(value);
            });

            document.getElementById('btn-clear-frozen').addEventListener('click', () => {
                this.setSelectedBlockFrozenCount(0);
            });

            document.getElementById('select-key-color').addEventListener('change', (e) => {
                this.setSelectedBlockKeyColor(e.target.value || null);
            });

            document.getElementById('select-lock-color').addEventListener('change', (e) => {
                this.setSelectedBlockLockColor(e.target.value || null);
            });

            document.getElementById('btn-rotate-block').addEventListener('click', () => {
                this.withHistory(() => this.rotateSelectedBlock());
            });

            // Header buttons
            document.getElementById('btn-undo').addEventListener('click', () => this.undo());
            document.getElementById('btn-redo').addEventListener('click', () => this.redo());

            document.getElementById('btn-new').addEventListener('click', () => {
                if (!confirm('Create new level? Current data will be lost.')) return;
                this.levelData = this.createNewLevel();
                this.activeLayer = 0;
                this.blockIdCounter = 1;
                this.selectedBlockId = null;
                this.hiddenLayers.clear();
                this.history = [];
                this.future = [];
                this.dirty = false;
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
                        this.importFromFile(evt.target.result);
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
                this.withHistory(() => {
                    for (const layer of this.levelData.layers) {
                        layer.blocks = [];
                    }
                    this.selectedBlockId = null;
                    this.blockIdCounter = 1;
                    return true;
                });
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
            for (const layer of data.layers) {
                for (const block of layer.blocks || []) {
                    if (!COLOR_NAMES.includes(block.keyColor)) delete block.keyColor;
                    if (!COLOR_NAMES.includes(block.lockColor)) delete block.lockColor;
                    if (block.keyColor && block.lockColor) delete block.lockColor;
                }
            }
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

        extractBalancedJSON(text, opener, closer) {
            const start = text.indexOf(opener);
            if (start === -1) return null;

            let depth = 0;
            let inString = false;
            let escaped = false;

            for (let i = start; i < text.length; i++) {
                const ch = text[i];

                if (inString) {
                    if (escaped) {
                        escaped = false;
                    } else if (ch === '\\') {
                        escaped = true;
                    } else if (ch === '"') {
                        inString = false;
                    }
                    continue;
                }

                if (ch === '"') {
                    inString = true;
                    continue;
                }

                if (ch === opener) {
                    depth++;
                } else if (ch === closer) {
                    depth--;
                    if (depth === 0) {
                        return text.slice(start, i + 1);
                    }
                }
            }

            return null;
        }

        parseImportedLevelText(text) {
            const raw = text
                .trim()
                .replace(/^```(?:json|js|javascript)?\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();

            const candidates = [
                raw,
                this.extractBalancedJSON(raw, '[', ']'),
                this.extractBalancedJSON(raw, '{', '}'),
            ].filter(Boolean);

            let lastError = null;

            for (const candidate of candidates) {
                try {
                    const parsed = JSON.parse(candidate);

                    if (Array.isArray(parsed)) {
                        const firstLevel = parsed.find(item => item && item.layers && item.cars);
                        if (firstLevel) return firstLevel;
                    } else if (parsed && parsed.layers && parsed.cars) {
                        return parsed;
                    }
                } catch (err) {
                    lastError = err;
                }
            }

            throw lastError || new Error('Invalid level format: missing layers or cars');
        }

        importFromText(text) {
            const data = this.parseImportedLevelText(text);

            // Validate basic structure
            if (!data.layers || !data.cars) {
                throw new Error('Invalid level format: missing layers or cars');
            }

            this.levelData = data;
            this.hiddenLayers.clear();
            this.history = [];
            this.future = [];
            this.dirty = false;
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

                    const frozen = Math.max(0, parseInt(block.frozenCount || 0, 10) || 0);
                    if (frozen > 0) {
                        block.frozenCount = frozen;
                    } else {
                        delete block.frozenCount;
                    }

                    if (!COLOR_NAMES.includes(block.keyColor)) {
                        delete block.keyColor;
                    }

                    if (!COLOR_NAMES.includes(block.lockColor)) {
                        delete block.lockColor;
                    }

                    if (block.keyColor && block.lockColor) {
                        delete block.lockColor;
                    }
                }
            }
            this.blockIdCounter = maxId + 1;

            // Normalise hidden flag on cars (may be missing on old levels)
            for (const car of this.levelData.cars) {
                if (car.hidden !== true) {
                    delete car.hidden;
                }
            }

            this.syncSettingsToUI();
            this.buildColorGrid();
            this.buildShapeGrid();
            this.renderCarsConfig();
            this.renderAll();
        }

        // Entry point for file import — handles both single level and array of levels.
        importFromFile(text) {
            const raw = text
                .trim()
                .replace(/^```(?:json|js|javascript)?\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();

            const candidates = [
                raw,
                this.extractBalancedJSON(raw, '[', ']'),
                this.extractBalancedJSON(raw, '{', '}'),
            ].filter(Boolean);

            let lastError = null;

            for (const candidate of candidates) {
                try {
                    const parsed = JSON.parse(candidate);

                    if (Array.isArray(parsed)) {
                        const validLevels = parsed.filter(item => item && item.layers && item.cars);
                        if (validLevels.length > 0) {
                            this.importLevelsToBank(validLevels);
                            return;
                        }
                    } else if (parsed && parsed.layers && parsed.cars) {
                        this.importFromText(candidate);
                        this.showToast('Level imported!');
                        return;
                    }
                } catch (err) {
                    lastError = err;
                }
            }

            throw lastError || new Error('Invalid level format: missing layers or cars');
        }

        // Import an array of levels into the Level Bank and load the first one into the editor.
        importLevelsToBank(levels) {
            const bank = this.getLevelBank();
            let added = 0;
            let updated = 0;

            for (const level of levels) {
                const existingIdx = bank.findIndex(l => l.id === level.id);
                if (existingIdx !== -1) {
                    bank[existingIdx] = level;
                    updated++;
                } else {
                    bank.push(level);
                    added++;
                }
            }

            bank.sort((a, b) => a.id - b.id);
            this.saveLevelBank(bank);
            this.renderBankList();

            // Load the first level into the editor
            this.importFromText(JSON.stringify(levels[0]));

            const msg = updated > 0
                ? `${added + updated} levels imported (${updated} updated) — Bank refreshed`
                : `${added} levels imported to Bank`;
            this.showToast(msg);
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
            this.dirty = false;
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
                container.innerHTML = '<div class="scroll-box-empty">No saved levels yet. Use "💾 Save to Bank" to add levels.</div>';
                return;
            }

            const q = (this.bankFilterText || '').trim().toLowerCase();
            const filtered = !q ? bank : bank.filter(level =>
                String(level.id).includes(q) ||
                (level.name || '').toLowerCase().includes(q) ||
                (level.difficulty || '').toLowerCase().includes(q)
            );

            if (filtered.length === 0) {
                container.innerHTML = '<div class="scroll-box-empty">No levels match your search.</div>';
                return;
            }

            for (const level of filtered) {
                const totalBlocks = level.layers.reduce((sum, l) => sum + l.blocks.length, 0);
                const el = document.createElement('div');
                el.className = 'bank-item';
                el.innerHTML = `
                    <span class="bank-id">#${level.id}</span>
                    <span class="bank-name">${level.name || 'Untitled'}</span>
                    <span class="bank-meta">${totalBlocks}blk ${level.difficulty || ''}</span>
                    <span class="bank-play" data-id="${level.id}" title="Play Test">▶</span>
                    <span class="bank-load" data-id="${level.id}" title="Load">📂</span>
                    <span class="bank-duplicate" data-id="${level.id}" title="Duplicate">⧉</span>
                    <span class="bank-delete" data-id="${level.id}" title="Delete">✕</span>
                `;
                container.appendChild(el);
            }

            container.onclick = (e) => {
                const playBtn = e.target.closest('.bank-play');
                const loadBtn = e.target.closest('.bank-load');
                const dupBtn = e.target.closest('.bank-duplicate');
                const delBtn = e.target.closest('.bank-delete');
                if (playBtn) {
                    this.playTestForLevel(parseInt(playBtn.dataset.id));
                } else if (loadBtn) {
                    this.loadFromBank(parseInt(loadBtn.dataset.id));
                } else if (dupBtn) {
                    this.duplicateInBank(parseInt(dupBtn.dataset.id));
                } else if (delBtn) {
                    if (confirm('Delete this level from bank?')) {
                        this.deleteFromBank(parseInt(delBtn.dataset.id));
                    }
                }
            };
        }

        duplicateInBank(levelId) {
            const bank = this.getLevelBank();
            const source = bank.find(l => l.id === levelId);
            if (!source) {
                this.showToast('Level not found in Bank', true);
                return;
            }
            const newId = Math.max(...bank.map(l => l.id), 0) + 1;
            const copy = JSON.parse(JSON.stringify(source));
            copy.id = newId;
            copy.name = `${copy.name || 'Untitled'} (copy)`;
            bank.push(copy);
            bank.sort((a, b) => a.id - b.id);
            this.saveLevelBank(bank);
            this.renderBankList();
            this.showToast(`Duplicated as Level ${newId}`);
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
            const selected = this.getSelectedBlockRecord();
            const frozenText = selected && selected.block.frozenCount > 0
                ? ` | Frozen ${selected.block.frozenCount}`
                : '';
            const keyText = selected && selected.block.keyColor
                ? ` | Key ${selected.block.keyColor}`
                : '';
            const lockText = selected && selected.block.lockColor
                ? ` | Lock ${selected.block.lockColor}`
                : '';
            document.getElementById('status-blocks').textContent = `Blocks: ${totalBlocks}`;
            document.getElementById('status-selection').textContent =
                `Tool: ${this.tool} | ${this.selectedColor} ${this.selectedShape} | Layer ${this.activeLayer}${frozenText}${keyText}${lockText}`;
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
