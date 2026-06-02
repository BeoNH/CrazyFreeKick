// ============================================================
// GAME CONFIG — Hằng số toàn cục, trích từ main.js
// ============================================================

// Canvas
export const CANVAS_WIDTH  = 1360;
export const CANVAS_HEIGHT = 640;

// Grid mục tiêu cú sút (9 cột × 4 hàng)
export const RANGE_WIDTH  = 9;
export const RANGE_HEIGHT = 4;

// Vùng pixel của lưới mục tiêu (tọa độ CreateJS gốc, dùng để tính kickTargetPoints)
export const MATRIX_X_START = 380;
export const MATRIX_X_END   = 1040;
export const MATRIX_Y_START = 235;
export const MATRIX_Y_END   = 430;

// Tỉ lệ thủ môn bắt được bóng theo từng vùng cột
export const LOW_PERCENT  = 5;
export const MED_PERCENT  = 50;
export const HIGH_PERCENT = 90;

// Số lượng
export const NUM_LEVEL = 6;
export const NUM_KICK  = 5;
export const NUM_CROWD = 31;
export const NUM_SAVE  = 8;   // số action của thủ môn (không kể OUT)

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
export const WALL_WIDTH  = 119;
export const WALL_HEIGHT = 179;
export const BALL_WIDTH  = 60;
export const BALL_HEIGHT = 60;
export const GOAL_WIDTH  = 390;
export const GOAL_HEIGHT = 145;

// Vị trí thủ môn (tọa độ gốc CreateJS → cần convert sang Cocos)
export const GOALKEEPER_POS = { x: 0, y: -70 };

// Tốc độ thanh chỉ báo ban đầu (ms cho 1 lần đi hết thanh)
// Giá trị này được truyền vào qua game config bên ngoài file gốc.
// Đặt mặc định hợp lý, UIManager/GameManager có thể override.
export const SHOT_INDICATOR_SPEED_DEFAULT  = 1800;  // ms
export const SHOT_INDICATOR_SPEED_DECREASE = 200;   // giảm mỗi level

// Bonus
export const BONUS_START    = 1000;
export const BONUS_DECREASE = 3;    // giảm mỗi frame khi đang chờ input

// Vị trí thanh chỉ báo (tọa độ CreateJS gốc — dùng làm tham chiếu)
export const HORIZONTAL_BAR_POS = { x: 104, y: 272 };
export const VERTICAL_BAR_POS   = { x: -636, y: -39 };

// Khoảng cách các slot wall (pixel)
export const WALL_SLOT_OFFSET = WALL_WIDTH - 40;  // 79px mỗi người

// Enum hành động thủ môn
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

// Thông tin animation của từng hành động thủ môn
export interface IKeeperActionInfo {
    action: string;
    width:  number;
    height: number;
    pos:    { x: number; y: number };  // Cocos coords
    frames: number;
}

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


// ── Kick target grid — 9 cột × 4 hàng (Cocos coords) ────────
// [col][row] → { x, y }
// Tính từ: CJS x = (660/9)*col + 385, CJS y = (195/4)*row + 240
export const KICK_TARGET_GRID: { x: number; y: number }[][] = [
    // col 0
    [ {x:-295,y:80}, {x:-295,y:31}, {x:-295,y:-18}, {x:-295,y:-66} ],
    // col 1
    [ {x:-222,y:80}, {x:-222,y:31}, {x:-222,y:-18}, {x:-222,y:-66} ],
    // col 2
    [ {x:-148,y:80}, {x:-148,y:31}, {x:-148,y:-18}, {x:-148,y:-66} ],
    // col 3
    [ {x:-75, y:80}, {x:-75, y:31}, {x:-75, y:-18}, {x:-75, y:-66} ],
    // col 4
    [ {x:-2,  y:80}, {x:-2,  y:31}, {x:-2,  y:-18}, {x:-2,  y:-66} ],
    // col 5
    [ {x:72,  y:80}, {x:72,  y:31}, {x:72,  y:-18}, {x:72,  y:-66} ],
    // col 6
    [ {x:145, y:80}, {x:145, y:31}, {x:145, y:-18}, {x:145, y:-66} ],
    // col 7
    [ {x:218, y:80}, {x:218, y:31}, {x:218, y:-18}, {x:218, y:-66} ],
    // col 8
    [ {x:292, y:80}, {x:292, y:31}, {x:292, y:-18}, {x:292, y:-66} ],
];