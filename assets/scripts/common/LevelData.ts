import {KeeperAction } from './GameConfig';

// ────────────────────────────────────────────────
// Interfaces
// ────────────────────────────────────────────────

export interface ILevelInfo {
    goalToScore: number;
    kickLeft:    number;
}

export interface IPosition {
    x: number;
    y: number;
}

export interface IWallData {
    x:   number;
    y:   number;
    num: number;   // số người trong tường (0 = không có)
}

// ────────────────────────────────────────────────
// Level info (goalToScore, kickLeft)
// Trích từ levelInfoList.push(...) trong CLevel._init
// ────────────────────────────────────────────────

export const LEVEL_INFO_LIST: ILevelInfo[] = [
    { goalToScore: 1, kickLeft: 5 },  // level 0
    { goalToScore: 2, kickLeft: 5 },  // level 1
    { goalToScore: 2, kickLeft: 5 },  // level 2
    { goalToScore: 3, kickLeft: 5 },  // level 3
    { goalToScore: 3, kickLeft: 5 },  // level 4
    { goalToScore: 4, kickLeft: 5 },  // level 5
];

// ────────────────────────────────────────────────
// Vị trí bóng — 3 điểm cơ sở (b[0], b[1], b[2])
// ────────────────────────────────────────────────

const B0: IPosition = { x: -250, y: -210 };
const B1: IPosition = { x:    0, y: -210 };
const B2: IPosition = { x:  260, y: -210 };

// ballPosGrid[level][kick]
export const BALL_POS_GRID: IPosition[][] = [
    [B0, B0, B0, B0, B0],  // level 0
    [B0, B0, B0, B1, B1],  // level 1
    [B1, B0, B0, B0, B2],  // level 2
    [B1, B2, B0, B1, B2],  // level 3
    [B0, B1, B2, B2, B2],  // level 4
    [B2, B1, B1, B1, B1],  // level 5
];

// ────────────────────────────────────────────────
// Vị trí cầu thủ — 3 điểm cơ sở (p[0], p[1], p[2])
// ────────────────────────────────────────────────

const P0: IPosition = { x: -300, y: -180 };
const P1: IPosition = { x:  -20, y: -180 };
const P2: IPosition = { x:  250, y: -180 };

// playerPosGrid[level][kick]
export const PLAYER_POS_GRID: IPosition[][] = [
    [P0, P0, P0, P0, P0],  // level 0
    [P0, P0, P0, P1, P1],  // level 1
    [P1, P0, P0, P0, P2],  // level 2
    [P1, P2, P0, P1, P2],  // level 3
    [P0, P1, P2, P2, P2],  // level 4
    [P2, P1, P1, P1, P1],  // level 5
];

export const PLAYER_POSITIONS_BASE: IPosition[] = [P0, P1, P2];

// ────────────────────────────────────────────────
// Vị trí tường — 9 preset (w[0]..w[8])
// wallPosGrid[level][kick]
// ────────────────────────────────────────────────

const W: IWallData[] = [
    { x:    0, y:  0, num: 0 },  // w[0] — không có tường
    { x: -155, y: 25, num: 1 },  // w[1]
    { x:   70, y: 25, num: 1 },  // w[2]
    { x: -155, y: 25, num: 2 },  // w[3]
    { x:   70, y: 25, num: 2 },  // w[4]
    { x: -155, y: 25, num: 3 },  // w[5]
    { x:   70, y: 25, num: 3 },  // w[6]
];

// wallPosGrid[level][kick]
export const WALL_POS_GRID: IWallData[][] = [
    [W[0], W[0], W[0], W[0], W[0]],  // level 0 — không tường
    [W[1], W[1], W[1], W[2], W[2]],  // level 1
    [W[4], W[3], W[2], W[2], W[2]],  // level 2
    [W[2], W[1], W[1], W[1], W[1]],  // level 3
    [W[1], W[2], W[2], W[1], W[1]],  // level 4
    [W[1], W[2], W[5], W[1], W[6]],  // level 5
];

// ────────────────────────────────────────────────
// Bảng keeper action theo [col][row]
// Trích từ CGame.animatePlayer — keeperActionMap
// ────────────────────────────────────────────────

// catchPercent: tỉ lệ % thủ môn bắt được (ballTargetX trong file gốc)
export interface IColConfig {
    catchPercent: number;           // 0 = OUT chắc chắn, không check
    rowActions: KeeperAction[];     // index 0..3 tương ứng row 0..3
}

// Các cột 0,1,7,8 → OUT hoàn toàn (catchPercent = 0, không check)
const OUT_COL: IColConfig = {
    catchPercent: 0,
    rowActions: [KeeperAction.OUT, KeeperAction.OUT, KeeperAction.OUT, KeeperAction.OUT],
};

export const KEEPER_COL_CONFIG: IColConfig[] = [
    OUT_COL, // col 0
    OUT_COL, // col 1
    {   // col 2 — LOW_PERCENT (5%)
        catchPercent: 5,
        rowActions: [
            KeeperAction.OUT,
            KeeperAction.HIGH_LEFT,
            KeeperAction.MED_LEFT,
            KeeperAction.DOWN_LEFT,
        ],
    },
    {   // col 3 — MED_PERCENT (50%)
        catchPercent: 50,
        rowActions: [
            KeeperAction.OUT,
            KeeperAction.HIGH_LEFT,
            KeeperAction.MED_LEFT,
            KeeperAction.DOWN_LEFT,
        ],
    },
    {   // col 4 — HIGH_PERCENT (90%)
        catchPercent: 90,
        rowActions: [
            KeeperAction.OUT,
            KeeperAction.CENTER_HIGH,
            KeeperAction.CENTER_HIGH,
            KeeperAction.CENTER,
        ],
    },
    {   // col 5 — MED_PERCENT (50%)
        catchPercent: 50,
        rowActions: [
            KeeperAction.OUT,
            KeeperAction.HIGH_RIGHT,
            KeeperAction.MED_RIGHT,
            KeeperAction.DOWN_RIGHT,
        ],
    },
    {   // col 6 — LOW_PERCENT (5%)
        catchPercent: 5,
        rowActions: [
            KeeperAction.OUT,
            KeeperAction.HIGH_RIGHT,
            KeeperAction.MED_RIGHT,
            KeeperAction.DOWN_RIGHT,
        ],
    },
    OUT_COL,  // col 7
    OUT_COL,  // col 8
];

// ────────────────────────────────────────────────
// Helper functions (pure, không dùng Cocos)
// ────────────────────────────────────────────────

export function getLevelInfo(levelIndex: number): ILevelInfo {
    return LEVEL_INFO_LIST[levelIndex];
}

export function getBallPosition(levelIndex: number, kickIndex: number): IPosition {
    return BALL_POS_GRID[levelIndex][kickIndex];
}

export function getPlayerPosition(levelIndex: number, kickIndex: number): IPosition {
    return PLAYER_POS_GRID[levelIndex][kickIndex];
}

export function getWallData(levelIndex: number, kickIndex: number): IWallData {
    return WALL_POS_GRID[levelIndex][kickIndex];
}

/** Trả về index vị trí cầu thủ (0/1/2) — index === 1 thì gọi changeAlpha */
export function getPlayerPosIndex(levelIndex: number, kickIndex: number): number {
    const pos = PLAYER_POS_GRID[levelIndex][kickIndex];
    return PLAYER_POSITIONS_BASE.indexOf(pos);
}