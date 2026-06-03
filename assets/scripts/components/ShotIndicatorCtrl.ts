
import { _decorator, Component, Node, tween, Tween, Vec3 } from 'cc';
import BroadcastReceiver from '../common/BroadcastReceiver';
import { ON_KICK_READY, ON_SHOT_CONFIRMED } from '../common/GameEvents';
import { HORIZONTAL_BAR_POS, SHOT_INDICATOR_SPEED_DECREASE, SHOT_INDICATOR_SPEED_DEFAULT, VERTICAL_BAR_POS, } from '../common/GameConfig';
import { Logger } from '../utils/Logger';

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

// Thanh ngang: arrow đi từ x trái → x phải của bar
// Tương đương barWidth trong file gốc (độ rộng vùng di chuyển arrow)
const H_BAR_HALF = 250;   // arrow đi từ -250 đến +250 quanh tâm bar

// Thanh dọc: arrow đi từ y trên → y dưới
const V_BAR_HALF = 115;   // arrow đi từ +115 đến -115

// Số điểm chia của mỗi thanh (map vị trí → col/row)
const NUM_COLS = 9;
const NUM_ROWS = 4;

@ccclass('ShotIndicatorCtrl')
export default class ShotIndicatorCtrl extends Component {

    @property(Node) horizontalBar: Node = null!;  // node HorizontalBar (chứa arrow)
    @property(Node) hArrow: Node = null!;  // arrow di chuyển X
    @property(Node) verticalBar: Node = null!;  // node VerticalBar
    @property(Node) vArrow: Node = null!;  // arrow di chuyển Y
    @property(Node) clickOverlay: Node = null!;  // invisible blocker nhận tap

    // ── State ──────────────────────────────────
    private _step: number = -1;   // -1=idle, 0=horizontal, 1=vertical
    private _col: number = 0;
    private _duration: number = SHOT_INDICATOR_SPEED_DEFAULT;
    private _hTween: Tween<Node> | null = null;
    private _vTween: Tween<Node> | null = null;

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        BroadcastReceiver.register(ON_KICK_READY, this._onKickReady.bind(this), this);

        if (this.clickOverlay) {
            this.clickOverlay.on(Node.EventType.TOUCH_END, this._onTap, this);
        }

        this._setVisible(false);
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
        this._duration = Math.max(
            400,
            SHOT_INDICATOR_SPEED_DEFAULT - SHOT_INDICATOR_SPEED_DECREASE * levelIndex,
        );
        Logger.info(TAG, `level ${levelIndex} → duration ${this._duration}ms`);
    }

    // ────────────────────────────────────────────
    // Private — Event handlers
    // ────────────────────────────────────────────

    private _onKickReady(): void {
        this._startStep0();
    }

    private _onTap(): void {
        if (this._step === 0) {
            this._onTapHorizontal();
        } else if (this._step === 1) {
            this._onTapVertical();
        }
    }

    // ────────────────────────────────────────────
    // Private — Step 0: Horizontal bar
    // ────────────────────────────────────────────

    private _startStep0(): void {
        this._step = 0;
        this._setVisible(true);

        this.horizontalBar.active = true;
        this.verticalBar.active = false;

        // Đặt arrow về bên trái
        this.hArrow.setPosition(-H_BAR_HALF, 0, 0);
        this._runHorizontal();
    }

    private _runHorizontal(): void {
        this._hTween?.stop();
        const half = H_BAR_HALF;
        const dur = this._duration / 1000;  // tween dùng giây

        // Đi từ trái → phải → trái (ping-pong vô tận)
        this._hTween = tween(this.hArrow)
            .to(dur, { position: new Vec3(half, 0, 0) })
            .to(dur, { position: new Vec3(-half, 0, 0) })
            .union()
            .repeatForever()
            .start();
    }

    private _onTapHorizontal(): void {
        this._hTween?.stop();
        this._hTween = null;

        // Map vị trí arrow → col (0-8)
        const arrowX = this.hArrow.position.x;
        // arrowX ∈ [-250, 250] → normalize về [0,1] → * NUM_COLS
        const t = (arrowX + H_BAR_HALF) / (H_BAR_HALF * 2);
        this._col = Math.min(NUM_COLS - 1, Math.floor(t * NUM_COLS));

        Logger.info(TAG, `tap H → col=${this._col} (arrowX=${arrowX.toFixed(1)})`);

        // Chuyển sang step 1
        this._startStep1();
    }

    // ────────────────────────────────────────────
    // Private — Step 1: Vertical bar
    // ────────────────────────────────────────────

    private _startStep1(): void {
        this._step = 1;

        this.horizontalBar.active = false;
        this.verticalBar.active = true;

        // Đặt arrow về trên cùng
        this.vArrow.setPosition(0, V_BAR_HALF, 0);
        this._runVertical();
    }

    private _runVertical(): void {
        this._vTween?.stop();
        const half = V_BAR_HALF;
        const dur = this._duration / 1000;

        this._vTween = tween(this.vArrow)
            .to(dur, { position: new Vec3(0, -half, 0) })
            .to(dur, { position: new Vec3(0, half, 0) })
            .union()
            .repeatForever()
            .start();
    }

    private _onTapVertical(): void {
        this._vTween?.stop();
        this._vTween = null;

        // Map vị trí arrow → row (0-3)
        // arrowY ∈ [-115, 115], Y cao = row nhỏ (hàng trên = row 0)
        const arrowY = this.vArrow.position.y;
        const t = 1 - (arrowY + V_BAR_HALF) / (V_BAR_HALF * 2);
        const row = Math.min(NUM_ROWS - 1, Math.floor(t * NUM_ROWS));

        Logger.info(TAG, `tap V → row=${row} (arrowY=${arrowY.toFixed(1)})`);

        this._step = -1;
        this._setVisible(false);

        // Phát kết quả về GameManager
        BroadcastReceiver.send(ON_SHOT_CONFIRMED, { col: this._col, row });
    }

    // ────────────────────────────────────────────
    // Private — Helpers
    // ────────────────────────────────────────────

    private _setVisible(visible: boolean): void {
        if (this.horizontalBar) this.horizontalBar.active = visible;
        if (this.verticalBar) this.verticalBar.active = false;   // chỉ hiện khi step 1
        if (this.clickOverlay) this.clickOverlay.active = visible;
    }
}
