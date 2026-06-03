import { _decorator, Component, Vec3 } from 'cc';
import { BONUS_DECREASE, BONUS_START, KEEPER_ACTION_INFO, KeeperAction, MATRIX_X_END, MATRIX_X_START, MATRIX_Y_END, MATRIX_Y_START, NUM_LEVEL, NUM_SAVE, RANGE_HEIGHT, RANGE_WIDTH, TeamIndex, TEAM_KEYS, WALL_WIDTH, WALL_HEIGHT, IPosition, } from '../common/GameConfig';
import { getBallPosition, getLevelInfo, getPlayerPosIndex, getPlayerPosition, getWallData, KEEPER_COL_CONFIG, } from '../common/LevelData';
import { ON_BALL_KICK, ON_BONUS_CHANGED, ON_CROWD_EXULT, ON_EXIT_GAME, ON_GAME_OVER, ON_GAME_WIN, ON_GOAL, ON_GOALS_CHANGED, ON_KEEPER_JUMP, ON_KICK_READY, ON_KICK_SETUP, ON_KICKS_CHANGED, ON_LEVEL_COMPLETE, ON_OUT, ON_PLAYER_KICK_FRAME, ON_SAVED, ON_SCORE_CHANGED, ON_SHOT_CONFIRMED, ON_SHOT_START, ON_WALL_HIT, ON_WALL_JUMP, } from '../common/GameEvents';
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

@ccclass('GameManager')
export default class GameManager extends Component {
    private static _instance: GameManager | null = null;

    static get instance(): GameManager {
        if (!GameManager._instance) {
            GameManager._instance = new GameManager();
        }
        return GameManager._instance;
    }

    // ── Session state ──────────────────────────
    private gScore: number = 0;
    private gBonus: number = BONUS_START;
    private gGoalsScored: number = 0;
    private gGoalsRequired: number = 0;
    private gKicksLeft: number = 0;
    private gLevelIndex: number = 0;
    private gKickIndex: number = 0;
    private gTeamKey: string = TEAM_KEYS[TeamIndex.ARGENTINA];
    private gTotalTimeStart: number = 0;

    // ── Frame state ────────────────────────────
    private isReadyToKick: boolean = false;
    private isBonusRunning: boolean = false;

    // ── Shot result state ──────────────────────
    // Được set bởi resolveShotResult(), đọc bởi BallCtrl khi bay xong
    private LastShotResult: IShotResult | null = null;

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        GameManager._instance = this;

        BroadcastReceiver.register(ON_PLAYER_KICK_FRAME, this.onPlayerKickFrame.bind(this), this);
        BroadcastReceiver.register(ON_EXIT_GAME, this.onExitGame.bind(this), this);
    }

    onDestroy(): void {
        BroadcastReceiver.unRegisterByTarget(this);
    }

    update(dt: number): void {
        if (!this.isBonusRunning) return;
        if (this.gBonus >= BONUS_DECREASE) {
            this.gBonus -= BONUS_DECREASE;
            BroadcastReceiver.send(ON_BONUS_CHANGED, { bonus: this.gBonus });
        }
    }

    // ────────────────────────────────────────────
    // Public API — gọi từ UIManager
    // ────────────────────────────────────────────

    /** Khởi tạo session mới hoàn toàn (từ Menu vào game) */
    public startGame(teamKey: string): void {
        this.gTeamKey = teamKey;
        this.gScore = 0;
        this.gLevelIndex = 0;
        this.gKickIndex = 0;
        this.gTotalTimeStart = Date.now();
        this.initLevel();
    }

    /** Gọi sau khi NextLevelPopup đóng → bắt đầu level tiếp theo */
    public startNextLevel(): void {
        this.initLevel();
    }

    /** Bắt đầu 1 lượt sút (gọi sau khi scene entities đã setup xong) */
    public beginKick(): void {
        this.gBonus = BONUS_START;
        this.isReadyToKick = true;
        this.isBonusRunning = true;
        this.LastShotResult = null;
        BroadcastReceiver.send(ON_BONUS_CHANGED, { bonus: this.gBonus });
        BroadcastReceiver.send(ON_KICK_READY, null);
    }

    /**
     * Gọi từ BallCtrl khi bóng bay xong (kết thúc flight hoặc bounce).
     * GameManager dựa vào _lastShotResult để phán xét.
     * @param missed  true nếu thủ môn bắt được (bounce → showMessage(false → isKeeperSave=false))
     *                Đặt tên theo file gốc: showMessage(missed)
     */
    public onBallLanded(missed: boolean): void {
        this.isBonusRunning = false;
        this.isReadyToKick = false;

        const result = this.LastShotResult;
        if (!result) return;

        if (missed || result.ballHitWall) {
            // Tường chắn hoặc thủ môn bắt được
            BroadcastReceiver.send(result.ballHitWall ? ON_SAVED : ON_WALL_HIT, null);
        } else if (result.keeperAction === KeeperAction.OUT) {
            BroadcastReceiver.send(ON_OUT, null);
        } else if (result.keeperTargetAction !== result.keeperAction) {
            // GOAL
            this.gGoalsScored++;
            this.gScore += this.gBonus;
            BroadcastReceiver.send(ON_GOAL, { score: this.gScore, bonus: this.gBonus });
            BroadcastReceiver.send(ON_SCORE_CHANGED, { score: this.gScore });
            BroadcastReceiver.send(ON_GOALS_CHANGED, { scored: this.gGoalsScored, required: this.gGoalsRequired });
            BroadcastReceiver.send(ON_CROWD_EXULT, null);
        }

        // Chờ message popup xong thì controlIfCanContinue sẽ được gọi từ UIManager/Popup callback
    }

    /**
     * Gọi sau khi message popup tắt — quyết định tiếp tục hay kết thúc.
     * Tương đương CGame.controlIfCanContinue trong file gốc.
     */
    public controlIfCanContinue(): void {
        if (this.gGoalsScored >= this.gGoalsRequired && this.gKicksLeft <= 1) {
            // Qua level
            this.gLevelIndex++;
            this.gKickIndex = 0;

            if (this.gLevelIndex >= NUM_LEVEL) {
                // WIN
                const totalTime = Math.round((Date.now() - this.gTotalTimeStart) / 1000);
                BroadcastReceiver.send(ON_GAME_WIN, { score: this.gScore, time: totalTime });
            } else {
                BroadcastReceiver.send(ON_LEVEL_COMPLETE, {
                    levelIndex: this.gLevelIndex,
                    goalsScored: this.gGoalsScored,
                });
            }
            return;
        }

        if (this.gKicksLeft <= 1) {
            // GAME OVER
            const totalTime = Math.round((Date.now() - this.gTotalTimeStart) / 1000);
            BroadcastReceiver.send(ON_GAME_OVER, { score: this.gScore, time: totalTime });
            return;
        }

        // Còn lượt → tiếp tục
        this.gKicksLeft--;
        this.gKickIndex++;
        BroadcastReceiver.send(ON_KICKS_CHANGED, { kicksLeft: this.gKicksLeft });

        // Báo UIManager setup entities cho lượt tiếp theo
        this.broadcastKickSetup();
    }

    // ── Getters dùng cho Controllers khi cần đọc state ──

    public get levelIndex(): number { return this.gLevelIndex; }
    public get kickIndex(): number { return this.gKickIndex; }
    public get teamKey(): string { return this.gTeamKey; }
    public get goalsScored(): number { return this.gGoalsScored; }
    public get goalsRequired(): number { return this.gGoalsRequired; }
    public get kicksLeft(): number { return this.gKicksLeft; }
    public get score(): number { return this.gScore; }
    public get bonus(): number { return this.gBonus; }
    public get lastShotResult(): IShotResult | null { return this.LastShotResult; }

    // ────────────────────────────────────────────
    // Private — Level init
    // ────────────────────────────────────────────

    private initLevel(): void {
        const info = getLevelInfo(this.gLevelIndex);
        this.gGoalsScored = 0;
        this.gGoalsRequired = info.goalToScore;
        this.gKicksLeft = info.kickLeft;
        this.gKickIndex = 0;

        BroadcastReceiver.send(ON_SCORE_CHANGED, { score: this.gScore });
        BroadcastReceiver.send(ON_GOALS_CHANGED, { scored: 0, required: this.gGoalsRequired });
        BroadcastReceiver.send(ON_KICKS_CHANGED, { kicksLeft: this.gKicksLeft });

        this.broadcastKickSetup();
    }

    /**
     * Phát sự kiện để UIManager/Controllers biết cần setup entities
     * cho lượt sút hiện tại (ball pos, player pos, wall data).
     * Tương đương CGame.createViewThings trong file gốc.
     */
    private broadcastKickSetup(): void {
        const ballPos = getBallPosition(this.gLevelIndex, this.gKickIndex);
        const playerPos = getPlayerPosition(this.gLevelIndex, this.gKickIndex);
        const wallData = getWallData(this.gLevelIndex, this.gKickIndex);
        const posIndex = getPlayerPosIndex(this.gLevelIndex, this.gKickIndex);

        // UIManager lắng nghe event này để reposition entities
        BroadcastReceiver.send(ON_KICK_SETUP, {
            levelIndex: this.gLevelIndex,
            kickIndex: this.gKickIndex,
            ballPos,
            playerPos,
            wallData,
            playerAlpha: posIndex === 1,   // true → alpha 0.5
            teamKey: this.gTeamKey,
        });
    }

    /**
     * PlayerCtrl phát khi animation shot đến frame 4.
     * Tương đương block `if (animFrameCount === 4 && !isShooting)` trong CGame.update.
     * Lúc này _lastShotResult đã có sẵn từ _onShotConfirmed.
     */
    private onPlayerKickFrame(): void {
        if (!this.LastShotResult) return;

        const result = this.LastShotResult;

        // Phát event để BallCtrl bắt đầu bay thật sự
        BroadcastReceiver.send(ON_BALL_KICK, {
            targetPos: this.ballPos,
        });

        // Phát event để GoalKeeperCtrl nhảy
        const keeperInfo = KEEPER_ACTION_INFO[result.keeperTargetAction];
        if (keeperInfo) {
            BroadcastReceiver.send(ON_KEEPER_JUMP, { keeperInfo });
        }

        // Phát event để WallCtrl nhảy (nếu có tường)
        const wallData = getWallData(this.gLevelIndex, this.gKickIndex);
        if (wallData.num > 0) {
            BroadcastReceiver.send(ON_WALL_JUMP, { wallData });
        }
    }

    private ballPos: IPosition;

    // Tính toán điểm rơi bóng thành công hay không
    public onShotConfirmed(data: IShotConfirmedData): void {
        if (!this.isReadyToKick) return;
        this.isBonusRunning = false;

        const { col, row } = data;

        this.ballPos = this.calcKickTarget(col, row);

        const colCfg = KEEPER_COL_CONFIG[col];

        // 1. Xác định keeperAction (hướng bóng bay)
        const keeperAction: KeeperAction = colCfg.rowActions[row];

        // 2. Quyết định thủ môn có bắt được không
        let ballHitWall = false;
        let keeperTargetAction: KeeperAction;

        if (keeperAction !== KeeperAction.OUT
            && colCfg.catchPercent > 0
            && Math.floor(Math.random() * 100) < colCfg.catchPercent
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

        // Kiểm tra va chạm với tường
        const wallData = getWallData(this.gLevelIndex, this.gKickIndex);
        if (wallData.num > 0) {
            // Tường chặn được bóng
            const totalWidth = WALL_WIDTH * wallData.num;
            const halfWidth = totalWidth / 2;
            const halfHeight = WALL_HEIGHT / 2;

            const ballP = this.ballPos;

            const hitWall = (
                ballP.x >= wallData.x - halfWidth &&
                ballP.x <= wallData.x + halfWidth &&
                ballP.y >= wallData.y - halfHeight &&
                ballP.y <= wallData.y + halfHeight
            );

            if (hitWall) {
                ballHitWall = true;
            }
        }

        // 3. Lưu kết quả để onBallLanded đọc
        this.LastShotResult = {
            keeperAction,
            keeperTargetAction,
            catchPercent: colCfg.catchPercent,
            ballHitWall,
        };

        // 4. Phát ON_SHOT_START → PlayerCtrl bắt đầu animation sút
        //    BallCtrl và GoalKeeperCtrl sẽ được trigger tại frame 4 (ON_PLAYER_KICK_FRAME)
        BroadcastReceiver.send(ON_SHOT_START, {
            teamKey: this.gTeamKey,
            playerPos: getPlayerPosition(this.gLevelIndex, this.gKickIndex),
        });
    }

    /**
     * Tính tọa độ pixel đích của bóng theo col/row.
     * Tương đương _initKickPoints trong file gốc.
     */
    private calcKickTarget(col: number, row: number): { x: number; y: number } {
        const x = Math.round((MATRIX_X_END - MATRIX_X_START) / RANGE_WIDTH * col + MATRIX_X_START) + 5;
        const y = Math.round((MATRIX_Y_END - MATRIX_Y_START) / RANGE_HEIGHT * row + MATRIX_Y_START) + 5;
        return { x, y };
    }

    private onExitGame(): void {
        this.isReadyToKick = false;
        this.isBonusRunning = false;
        this.LastShotResult = null;
    }
}