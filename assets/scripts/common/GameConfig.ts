// ============================================================
// GAME CONFIG — Hằng số toàn cục, trích từ main.js
// ============================================================

// Canvas
export const CANVAS_WIDTH  = 1360;
export const CANVAS_HEIGHT = 640;

// Grid mục tiêu cú sút (9 cột × 4 hàng)
export const RANGE_WIDTH  = 9;
export const RANGE_HEIGHT = 4;

// Số lượng
export const NUM_LEVEL = 6;
export const NUM_KICK  = 5;

// Vật lý bóng
export const STEP_SPEED_BALL = 2.4;   // flightStep tăng mỗi frame
export const BALL_FLIGHT_END = 40;    // flightStep kết thúc bay
export const BALL_SCALE_MIN  = 0.4;   // scale nhỏ nhất khi bóng bay xa
export const BALL_SCALE_STEP = 0.03;  // giảm scale mỗi frame
export const BALL_KEEPER_CHECK_SCALE = 0.7;   // scale để check keeper bắt
export const BALL_WALL_CHECK_SCALE   = 0.75;  // scale để check wall collision

// Kích thước sprite (pixel, dùng cho spritesheet frame size)
export const PLAYER_WIDTH  = 160;
export const PLAYER_HEIGHT = 239;
export const GOALKEEPER_WIDTH  = 91;
export const GOALKEEPER_HEIGHT = 122;
export const WALL_WIDTH  = 92;
export const WALL_HEIGHT = 160;
export const BALL_WIDTH  = 60;
export const BALL_HEIGHT = 60;
export const GOAL_WIDTH  = 390;
export const GOAL_HEIGHT = 145;

// Vị trí thủ môn (tọa độ gốc CreateJS → cần convert sang Cocos)
export const GOALKEEPER_POS = { x: 0, y: -70 };

// Tốc độ thanh chỉ báo ban đầu (ms cho 1 lần đi hết thanh)
export const SHOT_INDICATOR_SPEED_DEFAULT  = 1500;  // ms
export const SHOT_INDICATOR_SPEED_DECREASE = 200;   // giảm mỗi level

// Bonus
export const BONUS_START    = 1000;
export const BONUS_DECREASE = 3;    // giảm mỗi frame khi đang chờ input

// Khoảng cách các slot wall (pixel)
export const WALL_SLOT_OFFSET = WALL_WIDTH - 40;  // 79px mỗi người

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

export interface IKeeperActionInfo {
    action: string;
    width:  number;
    height: number;
    pos:    { x: number; y: number };
    frames: number;
}

export interface IColConfig {
    catchPercent: number;           // 0 = OUT chắc chắn, không check
    rowActions: KeeperAction[];     // index 0..3 tương ứng row 0..3
}

export interface IShotResult {
    keeperAction: KeeperAction;   // hướng bóng bay (theo col/row)
    keeperTargetAction: KeeperAction;   // action thủ môn thực tế chọn
    catchPercent: number;
    ballHitKeeper: boolean;
    ballHitWall: boolean;
}


// ────────────────────────────────────────────────
// Enum
// ────────────────────────────────────────────────

// Enum hành động thủ môn
export const NUM_SAVE  = 8;   // số action của thủ môn (không kể OUT)
export enum KeeperAction {
    CENTER      = 0,
    CENTER_HIGH = 1,
    DOWN_LEFT   = 2,
    DOWN_RIGHT  = 3,
    HIGH_LEFT   = 4,
    HIGH_RIGHT  = 5,
    MED_LEFT    = 6,
    MED_RIGHT   = 7,
    OUT         = 8,
}

// Enum team
export enum TeamIndex {
    ARGENTINA = 0,
    BRAZIL    = 1,
    GERMANY   = 2,
    ENGLAND   = 3,
    ITALY     = 4,
    FRANCE    = 5,
}

export const TEAM_KEYS: Record<TeamIndex, string> = {
    [TeamIndex.ARGENTINA]: 'argentina',
    [TeamIndex.BRAZIL]:    'brazil',
    [TeamIndex.GERMANY]:   'germany',
    [TeamIndex.ENGLAND]:   'england',
    [TeamIndex.ITALY]:     'italy',
    [TeamIndex.FRANCE]:    'france',
};

export const TEAM_NAMES: Record<TeamIndex, string> = {
    [TeamIndex.ARGENTINA]: 'ARGENTINA',
    [TeamIndex.BRAZIL]:    'BRAZIL',
    [TeamIndex.GERMANY]:   'GERMANY',
    [TeamIndex.ENGLAND]:   'ENGLAND',
    [TeamIndex.ITALY]:     'ITALY',
    [TeamIndex.FRANCE]:    'FRANCE',
};

export const KEEPER_ACTION_INFO: Record<KeeperAction, IKeeperActionInfo | null> = {
    [KeeperAction.CENTER]:      { action:'center',      width:91,  height:122, pos:{x:0,   y:-100}, frames:4  },
    [KeeperAction.CENTER_HIGH]: { action:'center_high', width:106, height:163, pos:{x:0,   y:-100}, frames:9  },
    [KeeperAction.DOWN_LEFT]:   { action:'down_left',   width:185, height:118, pos:{x:-45, y:-100}, frames:16 },
    [KeeperAction.DOWN_RIGHT]:  { action:'down_right',  width:185, height:118, pos:{x:45,  y:-100}, frames:17 },
    [KeeperAction.HIGH_LEFT]:   { action:'high_left',   width:295, height:163, pos:{x:-100,y:-100}, frames:17 },
    [KeeperAction.HIGH_RIGHT]:  { action:'high_right',  width:275, height:163, pos:{x:90,  y:-100}, frames:17 },
    [KeeperAction.MED_LEFT]:    { action:'med_left',    width:229, height:113, pos:{x:-65, y:-100}, frames:16 },
    [KeeperAction.MED_RIGHT]:   { action:'med_right',   width:229, height:118, pos:{x:65,  y:-100}, frames:16 },
    [KeeperAction.OUT]:         null,
};

// Sound keys (tên file = tên key, trừ press_but → 'click')
export const SOUND_KEYS = {
    SOUNDTRACK:    'soundtrack',
    CLICK:         'click',
    APPLAUSE:      'applause',
    CROWD:         'crowd',
    GOAL:          'goal',
    KEEPER_SAVE:   'keeper_save',
    KICK:          'kick',
    MISS_GOAL:     'miss_goal',
    SELECT_TEAM:   'select_team',
    GAME_OVER:     'game_over',
    STOP_INDICATOR:'stop_indicator',
} as const;
