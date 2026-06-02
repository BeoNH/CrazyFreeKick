import { _decorator, Component } from 'cc';
import { BONUS_DECREASE, BONUS_START, KEEPER_ACTION_INFO, KeeperAction, MATRIX_X_END, MATRIX_X_START, MATRIX_Y_END, MATRIX_Y_START, NUM_LEVEL, NUM_SAVE, RANGE_HEIGHT, RANGE_WIDTH, TeamIndex, TEAM_KEYS, } from '../common/GameConfig';
import { getBallPosition, getLevelInfo, getPlayerPosIndex, getPlayerPosition, getWallData, KEEPER_COL_CONFIG, } from '../common/LevelData';
import { ON_BALL_KICK, ON_BONUS_CHANGED, ON_CROWD_EXULT, ON_EXIT_GAME, ON_GAME_OVER, ON_GAME_WIN, ON_GOAL, ON_GOALS_CHANGED, ON_KEEPER_JUMP, ON_KICK_READY, ON_KICK_SETUP, ON_KICKS_CHANGED, ON_LEVEL_COMPLETE, ON_OUT, ON_PLAYER_KICK_FRAME, ON_SAVED, ON_SCORE_CHANGED, ON_SHOT_CONFIRMED, ON_WALL_HIT, ON_WALL_JUMP, } from '../common/GameEvents';
import BroadcastReceiver from '../common/BroadcastReceiver';

const { ccclass } = _decorator;

// ────────────────────────────────────────────────
// Interfaces
// ────────────────────────────────────────────────

export interface IShotConfirmedData {
    col: number;
    row: number;
}

export interface IShotResult {
    keeperAction: KeeperAction;   // hướng bóng bay (theo col/row)
    keeperTargetAction: KeeperAction;   // action thủ môn thực tế chọn
    catchPercent: number;
    ballHitWall: boolean;
}

// ────────────────────────────────────────────────
// GameManager
// ────────────────────────────────────────────────

@ccclass('GameManager')
export default class GameManager extends Component {

    // ── Session state ──────────────────────────
    private _score: number = 0;
    private _bonus: number = BONUS_START;
    private _goalsScored: number = 0;
    private _goalsRequired: number = 0;
    private _kicksLeft: number = 0;
    private _levelIndex: number = 0;
    private _kickIndex: number = 0;
    private _teamKey: string = TEAM_KEYS[TeamIndex.ARGENTINA];
    private _totalTimeStart: number = 0;

    // ── Frame state ────────────────────────────
    private _isReadyToKick: boolean = false;
    private _isBonusRunning: boolean = false;

    // ── Shot result state ──────────────────────
    // Được set bởi resolveShotResult(), đọc bởi BallCtrl khi bay xong
    private _lastShotResult: IShotResult | null = null;

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        BroadcastReceiver.register(ON_SHOT_CONFIRMED, this._onShotConfirmed.bind(this), this);
        BroadcastReceiver.register(ON_PLAYER_KICK_FRAME, this._onPlayerKickFrame.bind(this), this);
        BroadcastReceiver.register(ON_EXIT_GAME, this._onExitGame.bind(this), this);
    }

    onDestroy(): void {
        BroadcastReceiver.unRegisterByTarget(this);
    }

    update(dt: number): void {
        if (!this._isBonusRunning) return;
        if (this._bonus >= BONUS_DECREASE) {
            this._bonus -= BONUS_DECREASE;
            BroadcastReceiver.send(ON_BONUS_CHANGED, { bonus: this._bonus });
        }
    }

    // ────────────────────────────────────────────
    // Public API — gọi từ UIManager
    // ────────────────────────────────────────────

    /** Khởi tạo session mới hoàn toàn (từ Menu vào game) */
    public startGame(teamKey: string): void {
        this._teamKey = teamKey;
        this._score = 0;
        this._levelIndex = 0;
        this._kickIndex = 0;
        this._totalTimeStart = Date.now();
        this._initLevel();
    }

    /** Gọi sau khi NextLevelPopup đóng → bắt đầu level tiếp theo */
    public startNextLevel(): void {
        this._initLevel();
    }

    /** Bắt đầu 1 lượt sút (gọi sau khi scene entities đã setup xong) */
    public beginKick(): void {
        this._bonus = BONUS_START;
        this._isReadyToKick = true;
        this._isBonusRunning = true;
        this._lastShotResult = null;
        BroadcastReceiver.send(ON_BONUS_CHANGED, { bonus: this._bonus });
        BroadcastReceiver.send(ON_KICK_READY, null);
    }

    /**
     * Gọi từ BallCtrl khi bóng bay xong (kết thúc flight hoặc bounce).
     * GameManager dựa vào _lastShotResult để phán xét.
     * @param missed  true nếu thủ môn bắt được (bounce → showMessage(false → isKeeperSave=false))
     *                Đặt tên theo file gốc: showMessage(missed)
     */
    public onBallLanded(missed: boolean): void {
        this._isBonusRunning = false;
        this._isReadyToKick = false;

        const result = this._lastShotResult;
        if (!result) return;

        if (missed || result.ballHitWall) {
            // Tường chắn hoặc thủ môn bắt được
            BroadcastReceiver.send(result.ballHitWall ? ON_SAVED : ON_WALL_HIT, null);
        } else if (result.keeperAction === KeeperAction.OUT) {
            BroadcastReceiver.send(ON_OUT, null);
        } else if (result.keeperTargetAction !== result.keeperAction) {
            // GOAL
            this._goalsScored++;
            this._score += this._bonus;
            BroadcastReceiver.send(ON_GOAL, { score: this._score, bonus: this._bonus });
            BroadcastReceiver.send(ON_SCORE_CHANGED, { score: this._score });
            BroadcastReceiver.send(ON_GOALS_CHANGED, { scored: this._goalsScored, required: this._goalsRequired });
            BroadcastReceiver.send(ON_CROWD_EXULT, null);
        }

        // Chờ message popup xong thì controlIfCanContinue sẽ được gọi từ UIManager/Popup callback
    }

    /**
     * Gọi sau khi message popup tắt — quyết định tiếp tục hay kết thúc.
     * Tương đương CGame.controlIfCanContinue trong file gốc.
     */
    public controlIfCanContinue(): void {
        if (this._goalsScored >= this._goalsRequired && this._kicksLeft <= 1) {
            // Qua level
            this._levelIndex++;
            this._kickIndex = 0;

            if (this._levelIndex >= NUM_LEVEL) {
                // WIN
                const totalTime = Math.round((Date.now() - this._totalTimeStart) / 1000);
                BroadcastReceiver.send(ON_GAME_WIN, { score: this._score, time: totalTime });
            } else {
                BroadcastReceiver.send(ON_LEVEL_COMPLETE, {
                    levelIndex: this._levelIndex,
                    goalsScored: this._goalsScored,
                });
            }
            return;
        }

        if (this._kicksLeft <= 1) {
            // GAME OVER
            const totalTime = Math.round((Date.now() - this._totalTimeStart) / 1000);
            BroadcastReceiver.send(ON_GAME_OVER, { score: this._score, time: totalTime });
            return;
        }

        // Còn lượt → tiếp tục
        this._kicksLeft--;
        this._kickIndex++;
        BroadcastReceiver.send(ON_KICKS_CHANGED, { kicksLeft: this._kicksLeft });

        // Báo UIManager setup entities cho lượt tiếp theo
        this._broadcastKickSetup();
    }

    // ── Getters dùng cho Controllers khi cần đọc state ──

    public get levelIndex(): number { return this._levelIndex; }
    public get kickIndex(): number { return this._kickIndex; }
    public get teamKey(): string { return this._teamKey; }
    public get goalsScored(): number { return this._goalsScored; }
    public get goalsRequired(): number { return this._goalsRequired; }
    public get kicksLeft(): number { return this._kicksLeft; }
    public get score(): number { return this._score; }
    public get bonus(): number { return this._bonus; }
    public get lastShotResult(): IShotResult | null { return this._lastShotResult; }

    // ────────────────────────────────────────────
    // Private — Level init
    // ────────────────────────────────────────────

    private _initLevel(): void {
        const info = getLevelInfo(this._levelIndex);
        this._goalsScored = 0;
        this._goalsRequired = info.goalToScore;
        this._kicksLeft = info.kickLeft;
        this._kickIndex = 0;

        BroadcastReceiver.send(ON_SCORE_CHANGED, { score: this._score });
        BroadcastReceiver.send(ON_GOALS_CHANGED, { scored: 0, required: this._goalsRequired });
        BroadcastReceiver.send(ON_KICKS_CHANGED, { kicksLeft: this._kicksLeft });

        this._broadcastKickSetup();
    }

    /**
     * Phát sự kiện để UIManager/Controllers biết cần setup entities
     * cho lượt sút hiện tại (ball pos, player pos, wall data).
     * Tương đương CGame.createViewThings trong file gốc.
     */
    private _broadcastKickSetup(): void {
        const ballPos = getBallPosition(this._levelIndex, this._kickIndex);
        const playerPos = getPlayerPosition(this._levelIndex, this._kickIndex);
        const wallData = getWallData(this._levelIndex, this._kickIndex);
        const posIndex = getPlayerPosIndex(this._levelIndex, this._kickIndex);

        // UIManager lắng nghe event này để reposition entities
        BroadcastReceiver.send(ON_KICK_SETUP, {
            levelIndex: this._levelIndex,
            kickIndex: this._kickIndex,
            ballPos,
            playerPos,
            wallData,
            playerAlpha: posIndex === 1,   // true → alpha 0.5
            teamKey: this._teamKey,
        });
    }

    // ────────────────────────────────────────────
    // Private — Shot resolution
    // Tương đương CGame.animatePlayer + frame-4 logic trong file gốc
    // ────────────────────────────────────────────

    /**
     * PlayerCtrl phát khi animation shot đến frame 4.
     * Tương đương block `if (animFrameCount === 4 && !isShooting)` trong CGame.update.
     * Lúc này _lastShotResult đã có sẵn từ _onShotConfirmed.
     */
    private _onPlayerKickFrame(): void {
        if (!this._lastShotResult) return;

        const result = this._lastShotResult;

        // Phát event để BallCtrl bắt đầu bay thật sự
        BroadcastReceiver.send(ON_BALL_KICK, {
            targetPos: this._calcKickTarget(this._pendingCol, this._pendingRow),
        });

        // Phát event để GoalKeeperCtrl nhảy
        const keeperInfo = KEEPER_ACTION_INFO[result.keeperTargetAction];
        if (keeperInfo) {
            BroadcastReceiver.send(ON_KEEPER_JUMP, { keeperInfo });
        }

        // Phát event để WallCtrl nhảy (nếu có tường)
        const wallData = getWallData(this._levelIndex, this._kickIndex);
        if (wallData.num > 0) {
            BroadcastReceiver.send(ON_WALL_JUMP, { wallData });
        }
    }

    // ── Pending shot coords (lưu lại từ _onShotConfirmed để dùng ở frame 4)
    private _pendingCol: number = 0;
    private _pendingRow: number = 0;

    private _onShotConfirmed(data: IShotConfirmedData): void {
        if (!this._isReadyToKick) return;
        this._isBonusRunning = false;

        const { col, row } = data;
        this._pendingCol = col;
        this._pendingRow = row;
        const colCfg = KEEPER_COL_CONFIG[col];

        // 1. Xác định keeperAction (hướng bóng bay)
        const keeperAction: KeeperAction = colCfg.rowActions[row];

        // 2. Quyết định thủ môn có bắt được không
        let ballHitWall = false;
        let keeperTargetAction: KeeperAction;

        const wallData = getWallData(this._levelIndex, this._kickIndex);

        if (wallData.num > 0) {
            // Tường → block chắc chắn
            ballHitWall = true;
            keeperTargetAction = keeperAction;  // không quan trọng, wall override
        } else if (
            keeperAction !== KeeperAction.OUT &&
            colCfg.catchPercent > 0 &&
            Math.floor(Math.random() * 100) < colCfg.catchPercent
        ) {
            // Thủ môn bắt được theo xác suất
            keeperTargetAction = keeperAction;
            ballHitWall = true;
        } else {
            // Thủ môn nhảy ngẫu nhiên (không trùng với hướng bóng)
            do {
                keeperTargetAction = Math.floor(Math.random() * NUM_SAVE) as KeeperAction;
            } while (keeperTargetAction === keeperAction);
        }

        // 3. Lưu kết quả để onBallLanded đọc
        this._lastShotResult = {
            keeperAction,
            keeperTargetAction,
            catchPercent: colCfg.catchPercent,
            ballHitWall,
        };

        // 4. Phát ON_SHOT_START → PlayerCtrl bắt đầu animation sút
        //    BallCtrl và GoalKeeperCtrl sẽ được trigger tại frame 4 (ON_PLAYER_KICK_FRAME)
        BroadcastReceiver.send('ON_SHOT_START', {
            teamKey: this._teamKey,
            playerPos: getPlayerPosition(this._levelIndex, this._kickIndex),
        });
    }

    /**
     * Tính tọa độ pixel đích của bóng theo col/row.
     * Tương đương _initKickPoints trong file gốc.
     */
    private _calcKickTarget(col: number, row: number): { x: number; y: number } {
        const x = Math.round((MATRIX_X_END - MATRIX_X_START) / RANGE_WIDTH * col + MATRIX_X_START) + 5;
        const y = Math.round((MATRIX_Y_END - MATRIX_Y_START) / RANGE_HEIGHT * row + MATRIX_Y_START) + 5;
        return { x, y };
    }

    private _onExitGame(): void {
        this._isReadyToKick = false;
        this._isBonusRunning = false;
        this._lastShotResult = null;
    }
}