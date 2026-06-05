
import { _decorator, Animation, Component } from 'cc';
import BroadcastReceiver from '../common/BroadcastReceiver';
import { GOALKEEPER_POS, IKeeperActionInfo } from '../common/GameConfig';
import { Logger } from '../utils/Logger';
import { ON_KEEPER_JUMP, ON_KICK_SETUP } from '../common/GameEvents';

// ============================================================
// GoalKeeperCtrl — Điều khiển thủ môn
// Logic bám sát CGoalKeeper trong file gốc:
//   - showIdle: animation idle loop
//   - showAction: play animation theo action (center, high_left, ...)
//   - stop: dừng lại ở frame cuối sau khi xong animation
//   - Sau khi hết animation → nếu ballHitWall → gọi GameManager.onBallLanded
// ============================================================
const { ccclass, property } = _decorator;

const TAG = 'GoalKeeperCtrl';

@ccclass('GoalKeeperCtrl')
export default class GoalKeeperCtrl extends Component {

    @property({ type: Animation, tooltip: 'Hoạt ảnh thủ môn' })
    private anim: Animation = null!;

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        BroadcastReceiver.register(ON_KICK_SETUP, this._onKickSetup.bind(this), this);
        BroadcastReceiver.register(ON_KEEPER_JUMP, this._onKeeperJump.bind(this), this);
    }

    onDestroy(): void {
        BroadcastReceiver.unRegisterByTarget(this);
    }

    // ────────────────────────────────────────────
    // Public
    // ────────────────────────────────────────────

    public showIdle(): void {
        this.node.setPosition(GOALKEEPER_POS.x, GOALKEEPER_POS.y, 0);
        if (this.anim?.getState('goalkeeper_idle')) {
            this.anim.play('goalkeeper_idle');
        }
    }

    // ────────────────────────────────────────────
    // Private — Event handlers
    // ────────────────────────────────────────────

    private _onKickSetup(): void {
        this.showIdle();
    }

    private _onKeeperJump(data: IKeeperActionInfo): void {
        const clipName = `goalkeeper_${data.action}`;

        if (!this.anim?.getState(clipName)) {
            Logger.warn(TAG, `clip not found: ${clipName}`);
            return;
        }

        this.anim.play(clipName);
        Logger.info(TAG, `playing: ${clipName}`);
    }
}