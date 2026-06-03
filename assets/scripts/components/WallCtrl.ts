
import { _decorator, Animation, Component, Node } from 'cc';
import BroadcastReceiver from '../common/BroadcastReceiver';
import { ON_KICK_SETUP, ON_WALL_JUMP } from '../common/GameEvents';
import { WALL_SLOT_OFFSET } from '../common/GameConfig';
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

interface IKickSetupData {
    wallData: { x: number; y: number; num: number };
}

interface IWallJumpData {
    wallData: { x: number; y: number; num: number };
}

@ccclass('WallCtrl')
export default class WallCtrl extends Component {

    // 3 node Wall_0, Wall_1, Wall_2 — gán trong Inspector
    @property({ type: [Node] })
    wallNodes: Node[] = [];

    // ────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────

    onLoad(): void {
        BroadcastReceiver.register(ON_KICK_SETUP, this._onKickSetup.bind(this), this);
        BroadcastReceiver.register(ON_WALL_JUMP,  this._onWallJump.bind(this),  this);
    }

    onDestroy(): void {
        BroadcastReceiver.unRegisterByTarget(this);
    }

    // ────────────────────────────────────────────
    // Private — Event handlers
    // ────────────────────────────────────────────

    private _onKickSetup(data: IKickSetupData): void {
        const { wallData } = data;

        // Ẩn hết trước
        for (const node of this.wallNodes) {
            node.active = false;
        }

        if (wallData.num === 0) return;

        // Hiện đúng số người, đặt vị trí
        // Các người xếp ngang, căn giữa quanh wallData.x
        // Offset: người 0 ở giữa, người 1 bên phải, người 2 bên trái
        // (theo file gốc: xPos = wall.x + slotOffset * i, với i = 0..num-1)
        for (let i = 0; i < wallData.num; i++) {
            const node = this.wallNodes[i];
            if (!node) continue;

            const posX = wallData.x + WALL_SLOT_OFFSET * i;
            node.setPosition(posX, wallData.y, 0);
            node.active = true;

            const anim = node.getComponent(Animation);
            if (anim?.getState('wall_idle')) {
                anim.play('wall_idle');
            }
        }

        Logger.info(TAG, `setup ${wallData.num} wall(s) at x=${wallData.x}`);
    }

    private _onWallJump(data: IWallJumpData): void {
        const { wallData } = data;
        if (wallData.num === 0) return;

        for (let i = 0; i < wallData.num; i++) {
            const node = this.wallNodes[i];
            if (!node?.active) continue;

            const anim = node.getComponent(Animation);
            if (anim?.getState('wall_jump')) {
                anim.play('wall_jump');
            }
        }

        Logger.info(TAG, `wall jump — ${wallData.num} person(s)`);
    }
}
