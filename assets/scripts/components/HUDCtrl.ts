
import { _decorator, Component, Label, Node, Sprite, tween, Vec3 } from 'cc';
import BroadcastReceiver from '../common/BroadcastReceiver';
import { ON_BONUS_CHANGED, ON_GOAL, ON_GOALS_CHANGED, ON_KICKS_CHANGED, ON_OUT, ON_SAVED, ON_SCORE_CHANGED, ON_WALL_HIT, } from '../common/GameEvents';
import { Logger } from '../utils/Logger';
import GameManager from '../managers/GameManager';

// ============================================================
// HUDCtrl — Hiển thị HUD trong game
// Lắng nghe events từ GameManager, chỉ render — không tính luật.
// Tương đương CInterface trong file gốc.
// ============================================================
const { ccclass, property } = _decorator;

const TAG = 'HUDCtrl';

@ccclass('HUDCtrl')
export default class HUDCtrl extends Component {

    // Labels
    @property(Label) scoreLabel: Label = null!;
    @property(Label) bonusLabel: Label = null!;
    @property(Label) goalCountLabel: Label = null!;

    // Kick ball icons — 5 sprites, ẩn dần khi dùng hết
    @property({ type: [Node] })
    kickBallIcons: Node[] = [];   // index 0..4, gán trong Inspector

    @property({ type: Node })
    resultLabel: Node = null!;

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        BroadcastReceiver.register(ON_SCORE_CHANGED, this._onScoreChanged.bind(this), this);
        BroadcastReceiver.register(ON_BONUS_CHANGED, this._onBonusChanged.bind(this), this);
        BroadcastReceiver.register(ON_KICKS_CHANGED, this._onKicksChanged.bind(this), this);
        BroadcastReceiver.register(ON_GOALS_CHANGED, this._onGoalsChanged.bind(this), this);

        BroadcastReceiver.register(ON_SAVED, () => this._onResultShow(1), this);
        BroadcastReceiver.register(ON_WALL_HIT, () => this._onResultShow(1), this);
        BroadcastReceiver.register(ON_OUT, () => this._onResultShow(2), this);
        BroadcastReceiver.register(ON_GOAL, () => this._onResultShow(0), this);
        this.resultLabel.active = false;
    }

    onDestroy(): void {
        BroadcastReceiver.unRegisterByTarget(this);
    }

    // ────────────────────────────────────────────
    // Private — Event handlers
    // ────────────────────────────────────────────

    private _onScoreChanged(data: { score: number }): void {
        if (this.scoreLabel) {
            this.scoreLabel.string = 'SCORE: ' + String(data.score);
        }
    }

    private _onBonusChanged(data: { bonus: number }): void {
        if (this.bonusLabel) {
            this.bonusLabel.string = 'BONUS x ' + String(data.bonus);
        }
    }

    private _onKicksChanged(data: { kicksLeft: number }): void {
        for (let i = 0; i < this.kickBallIcons.length; i++) {
            const node = this.kickBallIcons[i];
            if (node) {
                node.active = i < data.kicksLeft;
            }
        }
        Logger.info(TAG, `kicksLeft=${data.kicksLeft}`);
    }

    private _onGoalsChanged(data: { scored: number; required: number }): void {
        if (this.goalCountLabel) {
            this.goalCountLabel.string = `${data.scored}/${data.required}`;
        }
    }

    private _onResultShow(num: number) {
        for (let i = 0; i < this.resultLabel.children.length; i++) {
            const node = this.resultLabel.children[i];
            node.active = i == num;
        }
        this.resultLabel.active = true;

        this.resultLabel.setScale(new Vec3(0.2, 0.2, 0.2));

        tween(this.resultLabel)
            .to(0.4, {
                scale: new Vec3(1.2, 1.2, 1.2)
            })
            .to(0.2, {
                scale: new Vec3(1, 1, 1)
            })
            .delay(1)
            .call(() => {
                this.resultLabel.active = false;
                GameManager.instance.controlIfCanContinue();
            })
            .start();
    }
}
