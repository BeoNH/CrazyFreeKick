
import { _decorator, Animation, Component } from 'cc';
import BroadcastReceiver from '../common/BroadcastReceiver';
import { GOALKEEPER_POS, IKeeperActionInfo} from '../common/GameConfig';
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

    @property(Animation)
    anim: Animation = null!;

    // ── State ──────────────────────────────────
    private _isActing:         boolean = false;
    private _actionFrameTotal: number  = 0;
    private _actionDone:       boolean = false;

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        BroadcastReceiver.register(ON_KEEPER_JUMP, this._onKeeperJump.bind(this), this);
        BroadcastReceiver.register(ON_KICK_SETUP,  this._onKickSetup.bind(this),  this);
    }

    onDestroy(): void {
        BroadcastReceiver.unRegisterByTarget(this);
    }

    update(dt: number): void {
        if (!this._isActing || this._actionDone) return;

        const state = this._currentActionState();
        if (!state) return;

        const fps          = 15;
        const currentFrame = Math.floor(state.time * fps);

        if (currentFrame >= this._actionFrameTotal) {
            this._actionDone = true;
            this._isActing   = false;
            if (this.anim) this.anim.pause();
            Logger.info(TAG, 'action done, stopping');
        }
    }

    // ────────────────────────────────────────────
    // Public
    // ────────────────────────────────────────────

    public showIdle(): void {
        this.node.setPosition(GOALKEEPER_POS.x, GOALKEEPER_POS.y, 0);
        this._isActing   = false;
        this._actionDone = false;
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

        // Reposition keeper theo action info
        this.node.setPosition(data.pos.x, data.pos.y, 0);

        this._actionFrameTotal = data.frames;
        this._isActing         = true;
        this._actionDone       = false;

        this.anim.play(clipName);
        Logger.info(TAG, `playing: ${clipName}`);
    }

    private _currentActionState(): import('cc').AnimationState | null {
        if (!this.anim) return null;
        // Lấy state đang play hiện tại
        const clips = this.anim.clips;
        for (const clip of clips) {
            if (!clip) continue;
            const state = this.anim.getState(clip.name);
            if (state?.isPlaying) return state;
        }
        return null;
    }
}