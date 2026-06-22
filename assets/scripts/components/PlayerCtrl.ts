import { _decorator, Animation, AnimationClip, Component, UIOpacity } from 'cc';
import BroadcastReceiver from '../common/BroadcastReceiver';
import { ON_KICK_SETUP, ON_SHOT_START } from '../common/GameEvents';
import { Logger } from '../utils/Logger';
import { IKickSetupPayload, TEAM_KEYS, TeamIndex } from '../common/GameConfig';
import GameManager from '../managers/GameManager';
import AssetLoader from '../services/AssetLoader';

// ============================================================
// PlayerCtrl — Điều khiển nhân vật người sút
// Logic bám sát CPlayer trong file gốc:
//   - showIdle: animation idle theo team
//   - showShot: animation shot, frame event → trigger kickBall
//   - changeAlpha: alpha 0.5 khi player ở vị trí giữa (posIndex === 1)
// ============================================================
const { ccclass } = _decorator;

const TAG = 'PlayerCtrl';

@ccclass('PlayerCtrl')
export default class PlayerCtrl extends Component {

    // ── State ──────────────────────────────────
    private anim: Animation = null!;
    private uiOpacity: UIOpacity = null!;
    private currentTeamKey: string = TEAM_KEYS[TeamIndex.ARGENTINA];

    onLoad(): void {
        BroadcastReceiver.register(ON_KICK_SETUP, this._onKickSetup.bind(this), this);
        BroadcastReceiver.register(ON_SHOT_START, this._onShotStart.bind(this), this);

        this.anim = this.node.getComponent(Animation);
        this.uiOpacity = this.node.getComponent(UIOpacity);
    }

    onDestroy(): void {
        BroadcastReceiver.unRegisterByTarget(this);
    }

    private _onKickSetup(data: IKickSetupPayload): void {
        this.currentTeamKey = data.teamKey;

        this.node.setPosition(data.playerPos.x, data.playerPos.y, 0);

        if (this.uiOpacity) {
            this.uiOpacity.opacity = data.playerAlpha ? 128 : 255;
        }

        this.playIdle();
    }

    private _onShotStart(): void {
        this.playShot();
        this.anim.once(Animation.EventType.FINISHED, (type, state) => {
            if (state.name === `${this.currentTeamKey}_shot`) {
                this.playIdle();
            }
        }, this);
    }

    // ────────────────────────────────────────────
    // Private — Animation helpers
    // ────────────────────────────────────────────

    private async playIdle(): Promise<void> {
        const clipName = `${this.currentTeamKey}_idle`;
        if (!this.anim?.getState(clipName)) {
            const clip = await AssetLoader.loadResAsync<AnimationClip>(`animations/teams/${clipName}`, AnimationClip);
            if (!clip) {
                Logger.warn(TAG, `clip not found: ${clipName}`);
                return;
            }
            this.anim.addClip(clip, clipName);
        }
        this.anim.play(clipName);
    }

    private async playShot(): Promise<void> {
        const clipName = `${this.currentTeamKey}_shot`;
        if (!this.anim?.getState(clipName)) {
            const clip = await AssetLoader.loadResAsync<AnimationClip>(`animations/teams/${clipName}`, AnimationClip);
            if (!clip) {
                Logger.warn(TAG, `clip not found: ${clipName}`);
                return;
            }
            this.anim.addClip(clip, clipName);
        }
        this.anim.play(clipName);
    }

    // Sự kiện gắn trong anim event
    protected onKickFrame(): void {
        GameManager.instance.onPlayerKickFrame();
    }
}
