
import { _decorator, Component, Node, tween, Tween, Vec3 } from 'cc';
import BroadcastReceiver from '../common/BroadcastReceiver';
import { ON_KICK_READY } from '../common/GameEvents';
import { RANGE_HEIGHT, RANGE_WIDTH, SHOT_INDICATOR_SPEED_DECREASE, SHOT_INDICATOR_SPEED_DEFAULT } from '../common/GameConfig';
import { Logger } from '../utils/Logger';
import GameManager from '../managers/GameManager';

// ============================================================
// ShotIndicatorCtrl — Thanh chỉ báo cú sút (2 bước bấm)
// Logic bám sát CShotIndicatorController trong file gốc:
//   Step 0: Thanh ngang (HorizontalBar) chạy trái ↔ phải → tap → chọn col (0-8)
//   Step 1: Thanh dọc  (VerticalBar)   chạy trên ↔ dưới  → tap → chọn row (0-3)
//   Tốc độ tăng theo level (duration giảm SHOT_INDICATOR_SPEED_DECREASE mỗi level)
//   Sau step 1 emit ON_SHOT_CONFIRMED { col, row } → GameManager
// ============================================================
const { ccclass, property } = _decorator;

const TAG = 'ShotIndicatorCtrl';

const H_BAR_HALF = 350;   //  Thanh ngang: arrow đi từ x trái → x phải
const V_BAR_HALF = 145;   // Thanh dọc: arrow đi từ y trên → y dưới

@ccclass('ShotIndicatorCtrl')
export default class ShotIndicatorCtrl extends Component {

    @property({ type: Node, tooltip: 'Thanh ngang (chứa arrow)' })
    private horizontalBar: Node = null!;

    @property({ type: Node, tooltip: 'arrow di chuyển X' })
    private hArrow: Node = null!;

    @property({ type: Node, tooltip: 'Thanh dọc (chứa arrow)' })
    private verticalBar: Node = null!;

    @property({ type: Node, tooltip: 'arrow di chuyển Y' })
    private vArrow: Node = null!;

    @property({ type: Node, tooltip: 'invisible blocker nhận tap' })
    private clickOverlay: Node = null!;

    // ── State ──────────────────────────────────
    private step: number = -1;   // -1=idle, 0=horizontal, 1=vertical
    private col: number = 0;
    private duration: number = SHOT_INDICATOR_SPEED_DEFAULT;
    private hTween: Tween<Node> | null = null;
    private vTween: Tween<Node> | null = null;

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        BroadcastReceiver.register(ON_KICK_READY, this.onKickReady.bind(this), this);

        if (this.clickOverlay) {
            this.clickOverlay.on(Node.EventType.TOUCH_END, this._onTap, this);
        }

        this.setVisible(false);
    }

    onDestroy(): void {
        BroadcastReceiver.unRegisterByTarget(this);
        this.clickOverlay?.off(Node.EventType.TOUCH_END, this._onTap, this);
    }

    // ────────────────────────────────────────────
    // Public
    // ────────────────────────────────────────────

    /** Gọi khi bắt đầu level mới để cập nhật tốc độ */
    public setLevel(levelIndex: number): void {
        this.duration = Math.max(300, SHOT_INDICATOR_SPEED_DEFAULT - SHOT_INDICATOR_SPEED_DECREASE * levelIndex,);
        Logger.info(TAG, `level ${levelIndex} → duration ${this.duration}ms`);
    }

    // ────────────────────────────────────────────
    // Private — Event handlers
    // ────────────────────────────────────────────

    private onKickReady(): void {
        this.startStep0();
    }

    private _onTap(): void {
        if (this.step === 0) {
            this._onTapHorizontal();
        } else if (this.step === 1) {
            this._onTapVertical();
        }
    }

    // ────────────────────────────────────────────
    // Private — Step 0: Horizontal bar
    // ────────────────────────────────────────────

    private startStep0(): void {
        this.step = 0;
        this.setVisible(true);

        // Đặt arrow về bên trái
        this.hArrow.setPosition(-H_BAR_HALF, 0, 0);
        this.vArrow.setPosition(0, V_BAR_HALF, 0);
        this.runHorizontal();
    }

    private runHorizontal(): void {
        this.hTween?.stop();
        const dur = this.duration / 1000;  // giây

        this.hTween = tween(this.hArrow)
            .to(dur, { position: new Vec3(H_BAR_HALF, 0, 0) }, { easing: 'quadInOut' })
            .to(dur, { position: new Vec3(-H_BAR_HALF, 0, 0) }, { easing: 'quadInOut' })
            .union()
            .repeatForever()
            .start();
    }

    private _onTapHorizontal(): void {
        this.hTween?.stop();
        this.hTween = null;

        // Map vị trí arrow → col (0-8)
        const arrowX = this.hArrow.position.x;
        const t = (arrowX + H_BAR_HALF) / (H_BAR_HALF * 2);
        this.col = Math.min(RANGE_WIDTH - 1, Math.floor(t * RANGE_WIDTH));

        Logger.info(TAG, `tap H → col=${this.col} (arrowX=${arrowX.toFixed(1)})`);

        // Chuyển sang step 1
        this.startStep1();
    }

    // ────────────────────────────────────────────
    // Private — Step 1: Vertical bar
    // ────────────────────────────────────────────

    private startStep1(): void {
        this.step = 1;

        // Đặt arrow về trên cùng
        this.runVertical();
    }

    private runVertical(): void {
        this.vTween?.stop();
        const dur = this.duration / 1000 / 1.5;

        this.vTween = tween(this.vArrow)
            .to(dur, { position: new Vec3(0, -V_BAR_HALF, 0) }, { easing: 'quadInOut' })
            .to(dur, { position: new Vec3(0, V_BAR_HALF, 0) }, { easing: 'quadInOut' })
            .union()
            .repeatForever()
            .start();
    }

    private _onTapVertical(): void {
        this.vTween?.stop();
        this.vTween = null;

        // Map vị trí arrow → row (0-3)
        const arrowY = this.vArrow.position.y;
        const t = 1 - (arrowY + V_BAR_HALF) / (V_BAR_HALF * 2);
        const row = Math.min(RANGE_HEIGHT - 1, Math.floor(t * RANGE_HEIGHT));

        Logger.info(TAG, `tap V → row=${row} (arrowY=${arrowY.toFixed(1)})`);

        this.step = -1;
        this.setVisible(false);

        // Phát toạ độ bóng bay
        GameManager.instance.onShotConfirmed({ col: this.col, row })
    }

    // ────────────────────────────────────────────
    // Private — Helpers
    // ────────────────────────────────────────────

    private setVisible(visible: boolean): void {
        if (this.horizontalBar) this.horizontalBar.active = visible;
        if (this.verticalBar) this.verticalBar.active = visible;
        if (this.clickOverlay) this.clickOverlay.active = visible;
    }
}
