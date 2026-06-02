import { _decorator, Animation, AnimationClip, AnimationState, Component, UIOpacity } from 'cc';
import BroadcastReceiver from '../common/BroadcastReceiver';
import { ON_KICK_SETUP, ON_PLAYER_KICK_FRAME, ON_SHOT_START } from '../common/GameEvents';
import { Logger } from '../utils/Logger';

// ============================================================
// PlayerCtrl — Điều khiển nhân vật người sút
// Logic bám sát CPlayer trong file gốc:
//   - showIdle: chơi animation idle theo team
//   - showShot: chơi animation shot, frame 4 → trigger kickBall
//   - changeAlpha: alpha 0.5 khi player ở vị trí giữa (posIndex === 1)
//   - Báo GameManager khi đến frame 4 của shot animation
// ============================================================
const { ccclass, property } = _decorator;

const TAG = 'PlayerCtrl';

// Frame shot animation tại đó bóng rời chân (file gốc: animFrameCount === 4)
const KICK_TRIGGER_FRAME = 4;

interface IKickSetupData {
    playerPos:   { x: number; y: number };
    playerAlpha: boolean;
    teamKey:     string;
}

interface IShotStartData {
    playerPos: { x: number; y: number };
    teamKey:   string;
}

@ccclass('PlayerCtrl')
export default class PlayerCtrl extends Component {

    @property(Animation)
    anim: Animation = null!;

    @property(UIOpacity)
    uiOpacity: UIOpacity = null!;

    // ── State ──────────────────────────────────
    private _isPlayingShot:   boolean = false;
    private _kickTriggered:   boolean = false;
    private _currentTeamKey:  string  = 'argentina';

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        BroadcastReceiver.register(ON_KICK_SETUP,  this._onKickSetup.bind(this),  this);
        BroadcastReceiver.register(ON_SHOT_START,  this._onShotStart.bind(this),  this);
    }

    onDestroy(): void {
        BroadcastReceiver.unRegisterByTarget(this);
    }

    update(dt: number): void {
        if (!this._isPlayingShot || this._kickTriggered) return;

        const state = this.anim?.getState(this._shotClipName());
        if (!state) return;

        // Tính frame hiện tại dựa trên time (15fps theo file gốc)
        const fps          = 15;
        const currentFrame = Math.floor(state.time * fps);

        if (currentFrame >= KICK_TRIGGER_FRAME) {
            this._kickTriggered = true;
            Logger.info(TAG, 'kick frame reached → notify GameManager');
            this._notifyKickFrame();
        }
    }

    // ────────────────────────────────────────────
    // Private — Event handlers
    // ────────────────────────────────────────────

    private _onKickSetup(data: IKickSetupData): void {
        this._currentTeamKey  = data.teamKey;
        this._isPlayingShot   = false;
        this._kickTriggered   = false;

        this.node.setPosition(data.playerPos.x, data.playerPos.y, 0);

        if (this.uiOpacity) {
            this.uiOpacity.opacity = data.playerAlpha ? 128 : 255;
        }

        this._playIdle();
    }

    private _onShotStart(data: IShotStartData): void {
        this._isPlayingShot = true;
        this._kickTriggered = false;

        this.node.setPosition(data.playerPos.x, data.playerPos.y, 0);

        this._playShot();
    }

    // ────────────────────────────────────────────
    // Private — Animation helpers
    // ────────────────────────────────────────────

    private _playIdle(): void {
        const clipName = `${this._currentTeamKey}_idle`;
        if (this.anim?.getState(clipName)) {
            this.anim.play(clipName);
        } else {
            Logger.warn(TAG, `clip not found: ${clipName}`);
        }
    }

    private _playShot(): void {
        const clipName = this._shotClipName();
        if (this.anim?.getState(clipName)) {
            this.anim.play(clipName);
        } else {
            Logger.warn(TAG, `clip not found: ${clipName}`);
        }
    }

    private _shotClipName(): string {
        return `${this._currentTeamKey}_shot`;
    }

    /**
     * Thông báo GameManager để trigger kickBall.
     * Tương đương: khi animFrameCount === 4 trong CGame.update
     * GameManager sẽ lấy _lastShotResult và gọi BallCtrl.ballKicked
     */
    private _notifyKickFrame(): void {
        BroadcastReceiver.send(ON_PLAYER_KICK_FRAME, null);
    }
}