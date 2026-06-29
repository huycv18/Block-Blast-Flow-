// ============================================================
// Region progression + Car customization catalogs
// Global namespace: window.REGIONS, window.CAR_PARTS, window.CAR_CATALOG
// ============================================================

// Region unlock ladder. Stars are earned 1-per-level-win (GameStateManager.enterWin).
// `cost` is spent (deducted) from the player's star balance to unlock.
// `unlockLevel` is informational pacing context only — under the "1 star per
// level" rule, reaching `cost` stars already implies having played that many
// levels, so it is not enforced separately as a gate.
window.REGIONS = [
    {
        id: 1,
        name: 'Khởi Đầu',
        cost: 0,
        unlockLevel: 1,
        bgColor: 0x180F40,
        desc: 'Khu vực đầu tiên — học cách chơi.',
        reward: null,
    },
    {
        id: 2,
        name: 'Vùng Đất Mới',
        cost: 10,
        unlockLevel: 10,
        bgColor: 0x123B52,
        desc: 'Mở Frozen Block.',
        reward: { coin: 200 },
    },
    {
        id: 3,
        name: 'Thung Lũng Khoá',
        cost: 15,
        unlockLevel: 25,
        bgColor: 0x4A2466,
        desc: 'Mở Key & Lock, nhiều Layer hơn.',
        reward: { coin: 400, booster: 1 },
    },
    {
        id: 4,
        name: 'Sắc Màu Rực Rỡ',
        cost: 20,
        unlockLevel: 45,
        bgColor: 0x6E4A12,
        desc: 'Nhiều màu & Special Block hơn.',
        reward: { coin: 600, booster: 1 },
    },
    {
        id: 5,
        name: 'Đỉnh Cao Thử Thách',
        cost: 25,
        unlockLevel: 70,
        bgColor: 0x5C1F1A,
        desc: 'Nội dung khó hơn, nhiều mục tiêu sưu tầm.',
        reward: { coin: 800, cosmetic: true },
    },
    {
        id: 6,
        name: 'Huyền Thoại',
        cost: 30,
        unlockLevel: 100,
        bgColor: 0x14181C,
        desc: 'Nội dung late-game cao cấp.',
        reward: { coin: 1000, cosmetic: true, boosterPack: true },
    },
];

// Car customization — drawn procedurally (Phaser Graphics), no external art.
// Reuses window.COLORS for body paint so swatches match the in-game palette.
window.CAR_PARTS = {
    bodyColor: [
        { id: 'red', label: 'Đỏ', cost: 0 },
        { id: 'blue', label: 'Xanh', cost: 50 },
        { id: 'green', label: 'Lá', cost: 50 },
        { id: 'yellow', label: 'Vàng', cost: 80 },
        { id: 'orange', label: 'Cam', cost: 80 },
        { id: 'purple', label: 'Tím', cost: 100 },
        { id: 'pink', label: 'Hồng', cost: 100 },
        { id: 'cyan', label: 'Ngọc', cost: 120 },
    ],
    wheel: [
        { id: 'classic', label: 'Cổ điển', cost: 0 },
        { id: 'sport', label: 'Thể thao', cost: 60 },
        { id: 'offroad', label: 'Địa hình', cost: 90 },
    ],
    door: [
        { id: 'plain', label: 'Thường', cost: 0 },
        { id: 'racing', label: 'Đua xe', cost: 70 },
        { id: 'armor', label: 'Giáp', cost: 120 },
    ],
    decal: [
        { id: 'none', label: 'Không', emoji: null, cost: 0 },
        { id: 'star', label: 'Sao', emoji: '⭐', cost: 50 },
        { id: 'flame', label: 'Lửa', emoji: '🔥', cost: 90 },
        { id: 'heart', label: 'Tim', emoji: '💖', cost: 90 },
    ],
};

// Default equipped part per group — always owned, zero cost.
window.CAR_PARTS_DEFAULT = { bodyColor: 'red', wheel: 'classic', door: 'plain', decal: 'none' };

// Whole-new-car catalog (separate from per-part customization).
window.CAR_CATALOG = [
    { id: 'classic', name: 'Xe Cổ Điển', cost: 0, bodyColor: 'red' },
    { id: 'pickup', name: 'Xe Tải Nhỏ', cost: 500, bodyColor: 'orange' },
    { id: 'sport', name: 'Xe Thể Thao', cost: 1200, bodyColor: 'blue' },
    { id: 'limo', name: 'Limousine', cost: 2500, bodyColor: 'purple' },
];
