// ============================================================
// GAME EVENTS — Toàn bộ event name dùng với BroadcastReceiver
// Quy tắc: UPPER_CASE, nhóm theo flow
// ============================================================

// ────────────────────────────────────────────────
// UI / Screen navigation
// ────────────────────────────────────────────────

/** Boot xong, chuyển sang Menu */
export const ON_BOOT_COMPLETE = 'ON_BOOT_COMPLETE';

/** Người dùng bấm Play → mở SelectTeamPopup */
export const ON_GOTO_SELECT_TEAM = 'ON_GOTO_SELECT_TEAM';

/** Người dùng xác nhận đội → bắt đầu game */
export const ON_TEAM_SELECTED = 'ON_TEAM_SELECTED';

/** Bấm Exit trong game → về Menu */
export const ON_EXIT_GAME = 'ON_EXIT_GAME';

/** GameManager phát tại frame 4 → BallCtrl bắt đầu bay. Payload: { targetPos } */
export const ON_BALL_KICK = 'ON_BALL_KICK';

/** GameManager phát tại frame 4 → WallCtrl chuyển sang animation nhảy. Payload: { wallData } */
export const ON_WALL_JUMP = 'ON_WALL_JUMP';

/** GameManager phát tại frame 4 → GoalKeeperCtrl nhảy. Payload: { keeperInfo } */
export const ON_KEEPER_JUMP = 'ON_KEEPER_JUMP';

// ────────────────────────────────────────────────
// Kick setup (GameManager → UIManager / Controllers)
// ────────────────────────────────────────────────

/**
 * GameManager phát sau mỗi lần cần setup lượt sút mới.
 * Payload: { levelIndex, kickIndex, ballPos, playerPos, wallData, playerAlpha, teamKey }
 * UIManager lắng nghe để reposition Ball, Player, Wall.
 */
export const ON_KICK_SETUP = 'ON_KICK_SETUP';

/**
 * GameManager phát sau khi người dùng confirm col+row.
 * Payload: { targetPos, keeperTargetAction, keeperInfo, wallData, teamKey, playerPos }
 * Controllers lắng nghe để bắt đầu animation sút.
 */
export const ON_SHOT_START = 'ON_SHOT_START';

// ────────────────────────────────────────────────
// Shot Indicator (ShotIndicatorCtrl → GameManager)
// ────────────────────────────────────────────────

/** Người dùng đã chọn xong cả col + row, truyền { col, row } */
export const ON_SHOT_CONFIRMED = 'ON_SHOT_CONFIRMED';

// ────────────────────────────────────────────────
// Shot result (GameManager → Controllers)
// ────────────────────────────────────────────────

/** Bóng vào lưới — truyền { score, bonus } */
export const ON_GOAL = 'ON_GOAL';

/**
 * PlayerCtrl phát khi đến frame 4 của animation shot.
 * GameManager lắng nghe → gọi BallCtrl bắt đầu bay + GoalKeeperCtrl nhảy.
 */
export const ON_PLAYER_KICK_FRAME = 'ON_PLAYER_KICK_FRAME';

/** Bóng bị thủ môn bắt — không truyền data */
export const ON_SAVED = 'ON_SAVED';

/** Bóng đi ra ngoài (cột 0,1,7,8 hoặc row 0) — không truyền data */
export const ON_OUT = 'ON_OUT';

/** Bóng chạm tường người — không truyền data */
export const ON_WALL_HIT = 'ON_WALL_HIT';

// ────────────────────────────────────────────────
// HUD updates (GameManager → HUDCtrl)
// ────────────────────────────────────────────────

/** Cập nhật điểm hiển thị — truyền { score: number } */
export const ON_SCORE_CHANGED = 'ON_SCORE_CHANGED';

/** Cập nhật bonus hiển thị — truyền { bonus: number } */
export const ON_BONUS_CHANGED = 'ON_BONUS_CHANGED';

/** Cập nhật số lượt sút còn lại — truyền { kicksLeft: number } */
export const ON_KICKS_CHANGED = 'ON_KICKS_CHANGED';

/** Cập nhật số bàn đã ghi / cần ghi — truyền { scored, required } */
export const ON_GOALS_CHANGED = 'ON_GOALS_CHANGED';

// ────────────────────────────────────────────────
// Game session flow (GameManager → UIManager)
// ────────────────────────────────────────────────

/** Bắt đầu lượt sút mới, indicator sẵn sàng — không truyền data */
export const ON_KICK_READY = 'ON_KICK_READY';

/** Hoàn thành một level → show NextLevelPopup — truyền { levelIndex, goalsScored } */
export const ON_LEVEL_COMPLETE = 'ON_LEVEL_COMPLETE';

/** Hết lượt mà không đủ bàn → Game Over — truyền { score } */
export const ON_GAME_OVER = 'ON_GAME_OVER';

/** Qua hết 6 level → Win — truyền { score } */
export const ON_GAME_WIN = 'ON_GAME_WIN';

// ────────────────────────────────────────────────
// Crowd (GameManager → CrowdCtrl)
// ────────────────────────────────────────────────

/** Kích hoạt animation khán giả ăn mừng sau khi ghi bàn */
export const ON_CROWD_EXULT = 'ON_CROWD_EXULT';