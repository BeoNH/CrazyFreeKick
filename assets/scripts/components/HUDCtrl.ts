
import { _decorator, Component, Label, Node, Sprite } from 'cc';
import BroadcastReceiver from '../common/BroadcastReceiver';
import {ON_BONUS_CHANGED,ON_GOALS_CHANGED,ON_KICKS_CHANGED,ON_SCORE_CHANGED,} from '../common/GameEvents';
import { Logger } from '../utils/Logger';

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
    @property(Label) scoreLabel:     Label = null!;
    @property(Label) bonusLabel:     Label = null!;
    @property(Label) goalCountLabel: Label = null!;

    // Kick ball icons — 5 sprites, ẩn dần khi dùng hết
    @property({ type: [Node] })
    kickBallIcons: Node[] = [];   // index 0..4, gán trong Inspector

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        BroadcastReceiver.register(ON_SCORE_CHANGED, this._onScoreChanged.bind(this), this);
        BroadcastReceiver.register(ON_BONUS_CHANGED, this._onBonusChanged.bind(this), this);
        BroadcastReceiver.register(ON_KICKS_CHANGED, this._onKicksChanged.bind(this), this);
        BroadcastReceiver.register(ON_GOALS_CHANGED, this._onGoalsChanged.bind(this), this);
    }

    onDestroy(): void {
        BroadcastReceiver.unRegisterByTarget(this);
    }

    // ────────────────────────────────────────────
    // Private — Event handlers
    // ────────────────────────────────────────────

    private _onScoreChanged(data: { score: number }): void {
        if (this.scoreLabel) {
            this.scoreLabel.string = String(data.score);
        }
    }

    private _onBonusChanged(data: { bonus: number }): void {
        if (this.bonusLabel) {
            this.bonusLabel.string = String(data.bonus);
        }
    }

    private _onKicksChanged(data: { kicksLeft: number }): void {
        // Hiện đúng số icon bóng còn lại
        // kickBallIcons[0] = lượt cuối còn lại, [4] = đầy đủ
        // File gốc: ẩn từ icon cuối trở về trước
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
}
