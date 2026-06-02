
import { _decorator, Animation, Component, tween, Vec3 } from 'cc';
import BroadcastReceiver from '../common/BroadcastReceiver';
import { ON_BALL_KICK, ON_KICK_SETUP } from '../common/GameEvents';
import { BALL_FLIGHT_END, BALL_SCALE_MIN, BALL_SCALE_STEP, BALL_KEEPER_CHECK_SCALE, BALL_WALL_CHECK_SCALE, CANVAS_WIDTH, CANVAS_HEIGHT, STEP_SPEED_BALL, } from '../common/GameConfig';
import { Logger } from '../utils/Logger';

// ============================================================
// BallCtrl — Điều khiển bóng
// Logic bám sát CBall trong file gốc:
//   - Bay theo quadratic Bezier curve
//   - Thu nhỏ theo flightStep (giả lập phối cảnh 3D)
//   - Xoay liên tục khi bay
//   - bounce() khi bị thủ môn bắt hoặc tường chắn
//   - fadeOut() khi bóng vào lưới hoặc ra ngoài
// ============================================================

const { ccclass, property } = _decorator;

const TAG = 'BallCtrl';

@ccclass('BallCtrl')
export default class BallCtrl extends Component {

    @property(Animation)
    anim: Animation = null!;

    // ── Flight state ───────────────────────────
    private _isFlying: boolean = false;
    private _flightStep: number = 0;

    // ── Bezier curve ───────────────────────────
    private _curveStart: { x: number; y: number } = { x: 0, y: 0 };
    private _curveMid: { x: number; y: number } = { x: 0, y: 0 };
    private _curveEnd: { x: number; y: number } = { x: 0, y: 0 };

    // ── Collision check flags (chỉ trigger 1 lần mỗi lượt) ──
    private _keeperCheckDone: boolean = false;
    private _wallCheckDone: boolean = false;
    private _numWalls: number = 0;

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        BroadcastReceiver.register(ON_BALL_KICK, this._onBallKick.bind(this), this);
        BroadcastReceiver.register(ON_KICK_SETUP, this._onKickSetup.bind(this), this);
    }

    onDestroy(): void {
        BroadcastReceiver.unRegisterByTarget(this);
    }

    update(dt: number): void {
        if (!this._isFlying) return;
        this._updateFlight();
    }

    // ────────────────────────────────────────────
    // Public API
    // ────────────────────────────────────────────

    /** Đặt bóng về vị trí ban đầu (gọi khi setup lượt mới) */
    public resetToPosition(posX: number, posY: number): void {
        this.node.setPosition(posX, posY, 0);
        this.node.setScale(1, 1, 1);
        this.node.angle = 0;
        this._isFlying = false;
        this._flightStep = 0;
        this._keeperCheckDone = false;
        this._wallCheckDone = false;

        if (this.anim) this.anim.stop();
    }

    /** Bóng fade ra khi GOAL hoặc OUT */
    public fadeOut(): void {
        tween(this.node)
            .to(0.2, { scale: new Vec3(0, 0, 0) })
            .call(() => { this.node.active = false; })
            .start();
    }

    /** Bóng bị chặn — văng xuống dưới màn hình */
    public bounce(fromCjsX: number, isKeeperSave: boolean): void {
        this._isFlying = false;
        const goRight = fromCjsX < CANVAS_WIDTH / 2;
        const duration = isKeeperSave ? 0.7 : 0.5;

        const curPos = this.node.position;
        // Cocos Y xuống = giá trị âm → CANVAS_HEIGHT / 2 bên dưới = -CANVAS_HEIGHT / 2 trong Cocos
        const targetY = -(CANVAS_HEIGHT / 2) - 50;

        tween(this.node)
            .to(duration, {
                position: new Vec3(
                    curPos.x + (goRight ? 100 : -100),
                    targetY,
                    0,
                ),
            })
            .call(() => {
                // GameManager.onBallLanded(missed=true nếu wall, false nếu keeper)
                this._notifyLanded(!isKeeperSave);
            })
            .start();
    }

    // ────────────────────────────────────────────
    // Private — Event handlers
    // ────────────────────────────────────────────

    /** Reposition bóng về vị trí ban đầu của lượt sút */
    private _onKickSetup(data: { ballPos: { x: number; y: number } }): void {
        this.resetToPosition(data.ballPos.x, data.ballPos.y);
    }

    /** Frame 4: bóng thực sự bắt đầu bay */
    private _onBallKick(data: { targetPos: { x: number; y: number } }): void {
        const { targetPos } = data;

        const startCjsX = this.node.position.x + CANVAS_WIDTH / 2;
        const startCjsY = -this.node.position.y + CANVAS_HEIGHT / 2;

        this._curveStart = { x: startCjsX, y: startCjsY };
        this._curveEnd = { x: targetPos.x, y: targetPos.y };
        this._curveMid = this._calcMidPoint(this._curveStart, this._curveEnd);

        this._flightStep = 0;
        this._isFlying = true;
        this._keeperCheckDone = false;
        this._wallCheckDone = false;

        if (this.anim) this.anim.play('ball_thrown');

        Logger.info(TAG, 'ball kicked → target CJS', targetPos);
    }

    // ────────────────────────────────────────────
    // Private — Flight update (mỗi frame)
    // Tương đương CBall._updateBall trong file gốc
    // ────────────────────────────────────────────

    private _updateFlight(): void {
        this._flightStep += STEP_SPEED_BALL;
        this.node.angle -= 5;   // xoay bóng

        if (this._flightStep >= BALL_FLIGHT_END) {
            this._flightStep = 0;
            this._isFlying = false;
            this._notifyLanded(false);
            return;
        }

        // Quadratic Bezier: t ∈ [0,1]
        const t = this._easeOutCubic(this._flightStep, 0, 1, BALL_FLIGHT_END);
        const pos = this._bezierPoint(t);

        this.node.setPosition(pos.x, pos.y, 0);

        // Scale thu nhỏ theo phối cảnh
        const sc = this.node.scale;
        if (sc.x >= BALL_SCALE_MIN) {
            const newS = sc.x - BALL_SCALE_STEP;
            this.node.setScale(newS, newS, 1);
        }

        // Check keeper (scale <= 0.7) — chỉ 1 lần
        if (!this._keeperCheckDone && sc.x <= BALL_KEEPER_CHECK_SCALE) {
            this._keeperCheckDone = true;
            // GameManager đã set _lastShotResult.ballHitWall
            // BallCtrl không tự quyết — bounce() sẽ được GoalKeeperCtrl gọi
            // thông qua GameManager sau khi nhận ON_SHOT_START
            // (keeper animation complete → GameManager.goalKeeperBounce)
        }

        // Check wall (scale <= 0.75) — chỉ 1 lần
        if (!this._wallCheckDone && this._numWalls > 0 && sc.x <= BALL_WALL_CHECK_SCALE) {
            this._wallCheckDone = true;
            // WallCtrl sẽ gọi gameManager.controlWall() → bounce()
        }
    }

    // ────────────────────────────────────────────
    // Private — Bezier & Easing
    // ────────────────────────────────────────────

    /** Quadratic Bezier point tại t */
    private _bezierPoint(t: number): { x: number; y: number } {
        const inv = 1 - t;
        const x = inv * inv * this._curveStart.x
            + 2 * inv * t * this._curveMid.x
            + t * t * this._curveEnd.x;
        const y = inv * inv * this._curveStart.y
            + 2 * inv * t * this._curveMid.y
            + t * t * this._curveEnd.y;
        return { x, y };
    }

    /**
     * Tính điểm giữa Bezier ngẫu nhiên (tạo cảm giác xoáy bóng).
     * Tương đương CBall._calculateMidPoint trong file gốc.
     */
    private _calcMidPoint(
        start: { x: number; y: number },
        end: { x: number; y: number },
    ): { x: number; y: number } {
        const rand = Math.floor(Math.random() * 50) + 1;
        const half = CANVAS_WIDTH / 2;

        if (end.x < half) {
            return end.y > CANVAS_HEIGHT / 2
                ? { x: Math.floor(Math.random() * half) + 100, y: CANVAS_HEIGHT / 2 - 200 - rand }
                : { x: Math.floor(Math.random() * half) + 100, y: CANVAS_HEIGHT / 2 - 200 + rand };
        } else if (end.x > half) {
            return end.y > CANVAS_HEIGHT / 2
                ? { x: Math.floor(Math.random() * half) + 300, y: CANVAS_HEIGHT / 2 - 200 - rand }
                : { x: Math.floor(Math.random() * half) + 300, y: CANVAS_HEIGHT / 2 - 200 + rand };
        } else {
            return end.x > half
                ? { x: half - 50, y: Math.floor(Math.random() * (CANVAS_HEIGHT / 2 - 100)) + 100 }
                : { x: half + 50, y: Math.floor(Math.random() * (CANVAS_HEIGHT / 2 - 100)) + 100 };
        }
    }

    private _easeOutCubic(t: number, start: number, change: number, duration: number): number {
        return change * (Math.pow(t / duration - 1, 3) + 1) + start;
    }

    private _notifyLanded(missed: boolean): void {
        // Tìm GameManager qua node Managers trong scene
        const mgr = this.node.scene?.getChildByName('UIRoot')
            ?.getChildByName('Managers')
            ?.getComponent('GameManager') as import('../managers/GameManager').default | null;
        if (mgr) {
            mgr.onBallLanded(missed);
        } else {
            Logger.error(TAG, 'GameManager not found');
        }
    }
}