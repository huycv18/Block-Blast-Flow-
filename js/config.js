// ============================================================
// Block Cube Puzzle — Game Configuration
// Global namespace: window.CONFIG, window.COLORS, window.THEME
// ============================================================

window.CONFIG = {
    // --- Canvas & Layout ---
    GAME_WIDTH: 450,
    GAME_HEIGHT: 800,

    // --- Grid ---
    GRID_COLS: 6,
    GRID_ROWS: 6,
    CELL_SIZE: 42,
    CELL_DRAW: 39,
    CELL_RADIUS: 5,
    BOARD_OFFSET_X: 99,
    BOARD_OFFSET_Y: 135,

    // --- Board Container ---
    CONTAINER_X: 225,
    CONTAINER_TOP: 120,
    CONTAINER_WIDTH: 300,
    CONTAINER_GRID_BOTTOM: 400,
    CONTAINER_FUNNEL_BOTTOM: 455,
    FUNNEL_DRAIN_WIDTH: 40,
    CONTAINER_RADIUS: 16,
    CONTAINER_BORDER: 4,

    // --- Conveyor ---
    CONVEYOR_CENTER_X: 225,
    CONVEYOR_CENTER_Y: 490,
    CONVEYOR_WIDTH: 340,
    CONVEYOR_HEIGHT: 40,
    CONVEYOR_CORNER_R: 20,
    CONVEYOR_CAPACITY: 40,
    CONVEYOR_SPEED: 0.2,
    CLEANUP_SPEED_MULT: 2,

    // --- Warning ---
    CONV_WARNING: 0.75,
    CONV_DANGER: 0.90,

    // --- Road ---
    ROAD_Y: 526,
    ROAD_HEIGHT: 22,

    // --- Cars ---
    CAR_ROW1_Y: 585,
    CAR_ROW2_Y: 660,
    CAR_WIDTH: 90,
    CAR_HEIGHT: 55,
    CAR_ROW2_SCALE: 0.7,
    CAR_ROW2_ALPHA: 0.6,
    CAR_COL_POSITIONS: [82, 190, 298],
    CAR_UNLOCK_X: 390,

    // --- Cubes ---
    CUBE_SIZE: 10,
    CUBES_PER_CELL: 4,
    CUBE_POOL_SIZE: 200,

    // --- Funnel ---
    FUNNEL_CAPACITY: 40,
    DRAIN_INTERVAL: 40,

    // --- Physics ---
    GRAVITY_Y: 2,
    CUBE_RESTITUTION: 0.1,
    CUBE_FRICTION: 0.5,
    CUBE_FRICTION_STATIC: 1,
    CUBE_FRICTION_AIR: 0.05,
    CUBE_DENSITY: 0.001,
    CUBE_LINEAR_DAMPING: 0.05,

    // --- Animation ---
    SHAKE_DURATION: 0,
    SHAKE_INTENSITY: 0,
    SHAKE_REPEATS: 0,
    LIFT_DURATION: 150,
    LIFT_DISTANCE: 180,
    BLAST_SCALE_UP: 1.2,
    BLAST_DURATION: 100,
    CUBE_BURST_DELAY: 50,
    CAR_EXIT_DURATION: 500,
    CAR_ADVANCE_DURATION: 300,

    // --- Boosters ---
    BOOSTER_START_COUNT: 10,

    // --- Header & Boosters ---
    HEADER_HEIGHT: 50,
    BOOSTER_AREA_Y: 58,
    BOOSTER_BTN_SIZE: 52,

    // --- Layer ---
    LAYER_OVERLAYS: [0.0, 0.25, 0.45],
    MAX_INTERACTION_DEPTH: 3,
};

// ============================================================
// Color Definitions
// ============================================================
window.COLORS = {
    red: { hex: 0xE74C3C, css: '#E74C3C', light: 0xF1948A, dark: 0xC0392B },
    blue: { hex: 0x3498DB, css: '#3498DB', light: 0x85C1E9, dark: 0x2471A3 },
    green: { hex: 0x2ECC71, css: '#2ECC71', light: 0x82E0AA, dark: 0x1E8449 },
    yellow: { hex: 0xF1C40F, css: '#F1C40F', light: 0xF7DC6F, dark: 0xD4AC0D },
    orange: { hex: 0xE67E22, css: '#E67E22', light: 0xF0B27A, dark: 0xCA6F1E },
    purple: { hex: 0x9B59B6, css: '#9B59B6', light: 0xC39BD3, dark: 0x7D3C98 },
    pink: { hex: 0xE91E8A, css: '#E91E8A', light: 0xF48FB1, dark: 0xC2185B },
    cyan: { hex: 0x1ABC9C, css: '#1ABC9C', light: 0x76D7C4, dark: 0x148F77 },
};

window.COLOR_NAMES = Object.keys(window.COLORS);

// ============================================================
// Theme / UI Colors
// ============================================================
window.THEME = {
    BG: 0x2D2D3D,
    BG_CSS: '#2D2D3D',
    CONTAINER_FILL: 0x3A3A4A,
    CONTAINER_STROKE: 0x555568,
    GRID_EMPTY: 0x353545,
    GRID_EMPTY_LIGHT: 0x404055,
    ROAD_SURFACE: 0x555568,
    ROAD_DASH: 0xF1C40F,
    ROAD_EDGE: 0x888899,
    BOOSTER_BG: 0x4A7BD9,
    BOOSTER_BG_LIGHT: 0x5B8CE6,
    HEADER_TEXT: 0xFFFFFF,
    HEADER_SUB: 0xBBBBCC,
    UI_PANEL: 0x3A3A4A,
    UI_PANEL_BORDER: 0x555568,
    OVERLAY_DIM: 0x000000,
    WARNING_ORANGE: 0xE67E22,
    DANGER_RED: 0xE74C3C,
    SUCCESS_GREEN: 0x2ECC71,
    COIN_GOLD: 0xF1C40F,
    WHITE: 0xFFFFFF,
    TEXT_DARK: 0x2D2D3D,
};
