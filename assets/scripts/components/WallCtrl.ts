import { _decorator, Animation, Component, Node } from 'cc';
import BroadcastReceiver from '../common/BroadcastReceiver';
import { ON_KICK_SETUP, ON_WALL_JUMP } from '../common/GameEvents';
import { IWallData, WALL_SLOT_OFFSET } from '../common/GameConfig';
import { Logger } from '../utils/Logger';

// ============================================================
// WallCtrl — Quản lý tường người chắn (max 3 người)
// Logic bám sát CWall trong file gốc:
//   - Setup số người và vị trí theo IWallData
//   - Idle loop khi chờ
//   - Jump animation khi bóng đến (ON_WALL_JUMP)
//   - WALL_SLOT_OFFSET = 79px giữa mỗi người
// ============================================================
const { ccclass, property } = _decorator;

const TAG = 'WallCtrl';

@ccclass('WallCtrl')
export default class WallCtrl extends Component {

    @property({ type: [Node], tooltip: 'Các node con làm tường' })
    private wallNodes: Node[] = [];

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        BroadcastReceiver.register(ON_KICK_SETUP, this._onKickSetup.bind(this), this);
        BroadcastReceiver.register(ON_WALL_JUMP, this._onWallJump.bind(this), this);
    }

    onDestroy(): void {
        BroadcastReceiver.unRegisterByTarget(this);
    }

    // ────────────────────────────────────────────
    // Private — Event handlers
    // ────────────────────────────────────────────

    private _onKickSetup(data: any): void {
        const wallData = data.wallData as IWallData;

        this.node.setPosition(wallData.x, wallData.y, 0);

        for (let i = 0; i < this.wallNodes.length; i++) {
            const node = this.wallNodes[i];
            node.active = i < wallData.num;
        }
    }

    private _onWallJump(): void {
        for (const node of this.wallNodes) {
            if (!node?.active) continue;

            const anim = node.getComponent(Animation);
            if (anim?.getState('wall_jump')) {
                anim.play('wall_jump');
            }
        }
    }
}
