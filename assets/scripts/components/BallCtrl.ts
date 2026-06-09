
import { _decorator, Animation, Component, tween, UIOpacity, Vec3 } from 'cc';
import BroadcastReceiver from '../common/BroadcastReceiver';
import { ON_BALL_KICK, ON_KICK_SETUP } from '../common/GameEvents';
import { BALL_FLIGHT_END, BALL_SCALE_MIN, BALL_SCALE_STEP, BALL_KEEPER_CHECK_SCALE, BALL_WALL_CHECK_SCALE, CANVAS_WIDTH, CANVAS_HEIGHT, STEP_SPEED_BALL, IPosition, } from '../common/GameConfig';
import { Logger } from '../utils/Logger';
import GameManager from '../managers/GameManager';
import { AudioController } from './AudioController';

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

    @property({ type: UIOpacity, tooltip: 'Độ mờ bóng xoáy' })
    private opacity: UIOpacity = null!;

    @property({ type: Animation, tooltip: 'Hoạt ảnh bóng xoáy' })
    private anim: Animation = null!;

    @property({ tooltip: 'Tốc độ xoay bóng (độ/giây)' })
    private spinSpeed: number = 360;

    // ── Flight state ───────────────────────────
    private isFlying: boolean = false;
    private flightElapsed: number = 0;   // thời gian đã bay (giây)
    private flightDuration: number = 0.45;

    // ── Bezier curve ───────────────────────────
    private curveStart: { x: number; y: number } = { x: 0, y: 0 };
    private curveMid: { x: number; y: number } = { x: 0, y: 0 };
    private curveEnd: { x: number; y: number } = { x: 0, y: 0 };

    // ── Collision flags ────────────────────────
    private hitKeeper: boolean = false;
    private hitWall: boolean = false;

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        BroadcastReceiver.register(ON_KICK_SETUP, this._onBallSetup.bind(this), this);
        BroadcastReceiver.register(ON_BALL_KICK, this._onBallKick.bind(this), this);
    }

    onDestroy(): void {
        BroadcastReceiver.unRegisterByTarget(this);
    }

    update(dt: number): void {
        if (!this.isFlying) return;

        this.flightElapsed += dt;

        // t ∈ [0, 1] chuẩn, clamp để tránh overshoot
        const rawT = Math.min(this.flightElapsed / this.flightDuration, 1);

        // Easing: bóng phóng nhanh rồi giảm tốc khi vào khung
        const t = this.easeOutQuart(rawT);
        const pos = this.bezierPoint(t);
        this.node.setPosition(pos.x, pos.y, 0);

        const sc = Math.max(1 - t, 0.6);
        this.node.setScale(sc, sc, 1);

        // this.node.angle -= this.spinSpeed * dt;

        // ── Kết thúc lượt bay ──────────────────
        if (rawT >= 1) {
            this.isFlying = false;
            this.flightElapsed = 0;
            this.onFlightFinished();
        }
    }

    // ────────────────────────────────────────────
    // Private — Flight result
    // ────────────────────────────────────────────

    private onFlightFinished(): void {
        if (this.hitKeeper) {
            this.bounce(true);
        } else if (this.hitWall) {
            this.bounce(false);
        } else {
            this.fadeOut();
        }
    }

    public fadeOut(): void {
        tween(this.opacity).to(0.25, { opacity: 0 }, { easing: 'quadIn' })
            .call(() => GameManager.instance.onBallLanded())
            .start();
    }

    private bounce(isKeeperSave: boolean): void {
        const curPos = this.node.position;
        const goRight = curPos.x < 0;
        const duration = isKeeperSave ? 0.55 : 0.4;
        const targetY = -(CANVAS_HEIGHT / 2) - 60;
        const offsetX = curPos.x + (goRight ? 120 : -120);

        tween(this.node)
            .to(duration * 0.35, {
                position: new Vec3(curPos.x + (goRight ? 30 : -30), curPos.y + 30, 0),
                scale: new Vec3(0.75, 0.75, 1),
            }, { easing: 'quadOut' })
            .to(duration * 0.6, {
                position: new Vec3(offsetX, targetY, 0)
            }, { easing: 'quadIn' })
            .call(() => GameManager.instance.onBallLanded())
            .start();
    }

    // ────────────────────────────────────────────
    // Private — Event handlers
    // ────────────────────────────────────────────

    private _onBallSetup(data: any): void {
        const ballPos = data.ballPos as IPosition;

        this.opacity.opacity = 255;
        this.node.setPosition(ballPos.x, ballPos.y, 0);
        this.node.setScale(1, 1, 1);
        this.node.angle = 0;

        this.isFlying = false;
        this.flightElapsed = 0;
        this.hitKeeper = false;
        this.hitWall = false;

        if (this.anim) this.anim.stop();
    }

    private _onBallKick(data: { targetPos: IPosition; hitKeeper: boolean; hitWall: boolean; }): void {
        const { targetPos, hitKeeper, hitWall } = data;
        this.hitKeeper = hitKeeper;
        this.hitWall = hitWall;

        const startPos = this.node.position.clone();
        this.curveStart = { x: startPos.x, y: startPos.y };
        this.curveEnd = { x: targetPos.x, y: targetPos.y };
        this.curveMid = this.calcMidPoint(this.curveStart, this.curveEnd);

        this.flightElapsed = 0;
        this.isFlying = true;

        if (this.anim) this.anim.play();

        AudioController.instance.kick();
        // Logger.info(TAG, 'ball kicked → target', targetPos);
    }

    // ────────────────────────────────────────────
    // Private — Bezier & Math
    // ────────────────────────────────────────────

    private bezierPoint(t: number): { x: number; y: number } {
        const inv = 1 - t;
        return {
            x: inv * inv * this.curveStart.x + 2 * inv * t * this.curveMid.x + t * t * this.curveEnd.x,
            y: inv * inv * this.curveStart.y + 2 * inv * t * this.curveMid.y + t * t * this.curveEnd.y,
        };
    }

    /** easeOutQuart: f(t) = 1 - (1-t)^4  — mượt, bóng nhanh ban đầu */
    private easeOutQuart(t: number): number {
        return 1 - Math.pow(1 - t, 4);
    }

    /**
     * Điểm giữa Bezier: dùng tỉ lệ khoảng cách thay vì px cứng.
     * curveBulge = 0.35 → cung phình 35% tổng khoảng cách.
     */
    private calcMidPoint(
        start: { x: number; y: number },
        end: { x: number; y: number },
    ): { x: number; y: number } {
        const rand = Math.floor(Math.random() * 80) + 20;
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2 + 50;

        if (end.x < 0) {
            return { x: midX - rand, y: midY };
        } else if (end.x > 0) {
            return { x: midX + rand, y: midY };
        } else {
            const sign = Math.random() < 0.5 ? -1 : 1;
            return { x: midX + sign * rand, y: midY };
        }
    }
}