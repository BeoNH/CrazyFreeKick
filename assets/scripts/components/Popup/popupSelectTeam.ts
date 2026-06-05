import { _decorator, Animation, instantiate, Label, Prefab, resources, Toggle } from 'cc';
import Popup from '../../common/Popup';
import AssetLoader from '../../services/AssetLoader';
import { TEAM_KEYS, TEAM_NAMES, TeamIndex } from '../../common/GameConfig';
import { Logger } from '../../utils/Logger';
import GameManager from '../../managers/GameManager';
import { GameScene } from '../../GameScene';
import { AudioController } from '../AudioController';
const { ccclass, property } = _decorator;

@ccclass('popupSelectTeam')
export class popupSelectTeam extends Popup {

    public static async show() {
        const prefab = await AssetLoader.loadResAsync<Prefab>("prefabs/popupSelectTeam", Prefab);
        if (!prefab) return;
        let node = instantiate(prefab);
        node.getComponent(popupSelectTeam).show();
    }

    show() {
        super.show();
    }

    @property({ type: Animation, tooltip: 'Người chọn' })
    private anim: Animation = null!;

    @property({ type: Label, tooltip: 'Tên đội bóng được chọn' })
    private nameTeam: Label = null!;

    private currentTeamKey: string = TEAM_KEYS[TeamIndex.ARGENTINA];

    protected onAfterShow(): void {
        this.applyTeam(0);
    }

    private onToggleChanged(toggle: Toggle, customData: string): void {
        if (!toggle.isChecked) return;

        AudioController.instance.selectTeam();
        const teamIndex = Number(customData) as TeamIndex;
        this.applyTeam(teamIndex);
    }

    private applyTeam(teamIndex: TeamIndex): void {
        this.currentTeamKey = TEAM_KEYS[teamIndex];
        this.nameTeam.string = TEAM_NAMES[teamIndex];
        const clipName = `${this.currentTeamKey}_idle`;
        if (this.anim?.getState(clipName)) {
            this.anim.play(clipName);
        }
    }

    onSelectTeam() {
        AudioController.instance.click();
        GameScene.instance.openGame();
        GameManager.instance.startGame(this.currentTeamKey);
        this.hide();
    }
}


