import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import Popup from '../../common/Popup';
import AssetLoader from '../../services/AssetLoader';
import GameManager from '../../managers/GameManager';
import { AudioController } from '../AudioController';
const { ccclass, property } = _decorator;

@ccclass('popupNextLevel')
export class popupNextLevel extends Popup {

    public static async show() {
        const prefab = await AssetLoader.loadResAsync<Prefab>("prefabs/popupNextLevel", Prefab);
        if (!prefab) return;
        let node = instantiate(prefab);
        node.getComponent(popupNextLevel).show();
    }

    show() {
        super.show();
    }

    @property({ type: Node, tooltip: 'Số trái bóng sút vào' })
    private layoutGoal: Node = null!;

    protected onBeforeShow(): void {
        for (let i = 0; i < this.layoutGoal.children.length; i++) {
            const node = this.layoutGoal.children[i];
            node.active = i < GameManager.instance.goalsScored;
        }  
    }

    onNextLevel(){
        AudioController.instance.click();
        GameManager.instance.startNextLevel();
        this.hide();
    }
}


