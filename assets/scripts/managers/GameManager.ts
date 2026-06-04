import { _decorator, Component, Node, UITransform, Vec3 } from 'cc';
import { BONUS_DECREASE, BONUS_START, KEEPER_ACTION_INFO, KeeperAction, NUM_LEVEL, NUM_SAVE, RANGE_HEIGHT, RANGE_WIDTH, TeamIndex, TEAM_KEYS, WALL_WIDTH, WALL_HEIGHT, IPosition, IShotResult, } from '../common/GameConfig';
import { getBallPosition, getLevelInfo, getPlayerPosIndex, getPlayerPosition, getWallData, KEEPER_COL_CONFIG, } from '../common/LevelData';
import { ON_BALL_KICK, ON_BONUS_CHANGED, ON_CROWD_EXULT, ON_EXIT_GAME, ON_GAME_OVER, ON_GAME_WIN, ON_GOAL, ON_GOALS_CHANGED, ON_KEEPER_JUMP, ON_KICK_READY, ON_KICK_SETUP, ON_KICKS_CHANGED, ON_LEVEL_COMPLETE, ON_OUT, ON_PLAYER_KICK_FRAME, ON_SAVED, ON_SCORE_CHANGED, ON_SHOT_CONFIRMED, ON_SHOT_START, ON_WALL_HIT, ON_WALL_JUMP, } from '../common/GameEvents';
import BroadcastReceiver from '../common/BroadcastReceiver';
import { Logger } from '../utils/Logger';
import { popupNextLevel } from '../components/Popup/popupNextLevel';
import { popupGameOver } from '../components/Popup/popupGameOver';

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export default class GameManager extends Component {
    private static _instance: GameManager | null = null;

    static get instance(): GameManager {
        if (!GameManager._instance) {
            GameManager._instance = new GameManager();
        }
        return GameManager._instance;
    }

    @property({ type: Node, tooltip: 'Vị trí bóng bay đến' })
    private MATRIX: Node = null!;

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
    private gShotResult: IShotResult | null = null;
    
    // ── Frame state ────────────────────────────
    private isReadyToKick: boolean = false;
    private isBonusRunning: boolean = false;
    
    // ── Shot result state ──────────────────────
    private ballPos: IPosition;

    // ── Getters dùng cho Controllers khi cần đọc state ──

    public get levelIndex(): number { return this.gLevelIndex; }
    public get kickIndex(): number { return this.gKickIndex; }
    public get teamKey(): string { return this.gTeamKey; }
    public get goalsScored(): number { return this.gGoalsScored; }
    public get goalsRequired(): number { return this.gGoalsRequired; }
    public get kicksLeft(): number { return this.gKicksLeft; }
    public get score(): number { return this.gScore; }
    public get bonus(): number { return this.gBonus; }
    public get lastShotResult(): IShotResult | null { return this.gShotResult; }

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        GameManager._instance = this;

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

    protected start(): void {
        // giả lập game mới
        this.startGame(TEAM_KEYS[TeamIndex.BRAZIL]);
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


    /** Gọi sau khi NextLevelPopup đóng → bắt đầu level tiếp theo */
    public startNextLevel(): void {
        this.initLevel();
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

        this.beginKick();
    }

    /** Bắt đầu 1 lượt sút (gọi sau khi scene entities đã setup xong) */
    public beginKick(): void {
        this.gBonus = BONUS_START;
        this.isReadyToKick = true;
        this.isBonusRunning = true;
        this.gShotResult = null;
        BroadcastReceiver.send(ON_BONUS_CHANGED, { bonus: this.gBonus });
        BroadcastReceiver.send(ON_KICK_READY, null);
    }


    /**
     * Tính toán điểm rơi bóng thành công hay không
     */
    public onShotConfirmed(data: { col: number; row: number; }): void {
        // if (!this.isReadyToKick) return;
        // this.isBonusRunning = false;

        const { col, row } = data;

        this.ballPos = this.calcKickTarget(col, row);

        const colCfg = KEEPER_COL_CONFIG[col];

        // 1. Xác định keeperAction (hướng bóng bay)
        const keeperAction: KeeperAction = colCfg.rowActions[row];

        // 2. Quyết định thủ môn có bắt được không
        let ballHitKeeper = false;
        let keeperTargetAction: KeeperAction;

        if (keeperAction !== KeeperAction.OUT
            && colCfg.catchPercent > 0
            && Math.floor(Math.random() * 100) < colCfg.catchPercent
        ) {
            // Thủ môn bắt được theo xác suất
            keeperTargetAction = keeperAction;
            ballHitKeeper = true;
        } else {
            // Thủ môn nhảy ngẫu nhiên (không trùng với hướng bóng)
            do {
                keeperTargetAction = Math.floor(Math.random() * NUM_SAVE) as KeeperAction;
            } while (keeperTargetAction === keeperAction);
        }

        // 3. Kiểm tra va chạm với tường
        let ballHitWall = false;
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

        // 4. Lưu kết quả để onBallLanded đọc
        this.gShotResult = {
            keeperAction,
            keeperTargetAction,
            catchPercent: colCfg.catchPercent,
            ballHitKeeper,
            ballHitWall,
        };

        // 5. Phát ON_SHOT_START → PlayerCtrl bắt đầu animation sút
        BroadcastReceiver.send(ON_SHOT_START);
    }

    /**
     * Tính tọa độ pixel đích của bóng theo col/row.
     */
    private calcKickTarget(col: number, row: number): { x: number; y: number } {
        const worldPos = this.MATRIX.getChildByPath(`${row}/${col}`).worldPosition.clone();
        const { x, y } = this.MATRIX.getComponent(UITransform)!.convertToNodeSpaceAR(worldPos);
        return { x, y };
    }


    /**
    * Kiểm soát các anim sau fame Player sút.
    * Thông tin cú sút gShotResult có từ onShotConfirmed.
    */
    public onPlayerKickFrame(): void {
        if (!this.gShotResult) return;

        const result = this.gShotResult;

        // Phát event để BallCtrl bắt đầu bay
        BroadcastReceiver.send(ON_BALL_KICK, {
            targetPos: this.ballPos,
            hitKeeper: result.ballHitKeeper,
            hitWall: result.ballHitWall,
        });

        // Phát event để GoalKeeperCtrl nhảy
        const keeperInfo = KEEPER_ACTION_INFO[result.keeperTargetAction];
        if (keeperInfo) {
            BroadcastReceiver.send(ON_KEEPER_JUMP, { keeperInfo });
        }

        // Phát event để WallCtrl nhảy (nếu có tường)
        const wallData = getWallData(this.gLevelIndex, this.gKickIndex);
        if (wallData.num > 0) {
            BroadcastReceiver.send(ON_WALL_JUMP);
        }
    }

    /**
     * Gọi từ BallCtrl khi bóng bay xong (kết thúc flight hoặc bounce).
     * GameManager dựa vào gShotResult để phán xét.
     */
    public onBallLanded(): void {
        this.isBonusRunning = false;
        this.isReadyToKick = false;

        const result = this.gShotResult;
        if (!result) return;

        if (result.ballHitKeeper || result.ballHitWall) {
            BroadcastReceiver.send(result.ballHitKeeper ? ON_SAVED : ON_WALL_HIT, null);
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

        this.gKicksLeft--;
        BroadcastReceiver.send(ON_KICKS_CHANGED, { kicksLeft: this.gKicksLeft });
    }


    /**
     * Gọi sau khi message popup tắt — quyết định tiếp tục hay kết thúc.
     * Tương đương CGame.controlIfCanContinue trong file gốc.
     */
    public controlIfCanContinue(): void {
        if (this.gGoalsScored >= this.gGoalsRequired && this.gKicksLeft < 1) {
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
                popupNextLevel.show();
            }
            return;
        }

        if (this.gKicksLeft < 1) {
            // GAME OVER
            const totalTime = Math.round((Date.now() - this.gTotalTimeStart) / 1000);
            BroadcastReceiver.send(ON_GAME_OVER, { score: this.gScore, time: totalTime });
            popupGameOver.show();
            return;
        }
        this.gKickIndex++;

        // Báo UIManager setup entities cho lượt tiếp theo
        this.broadcastKickSetup();
    }

    private onExitGame(): void {
        this.isReadyToKick = false;
        this.isBonusRunning = false;
        this.gShotResult = null;
    }
}