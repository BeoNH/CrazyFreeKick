import { NumberScrolling } from './../../common/NumberScrolling';
import { _decorator, Component, instantiate, Label, Node, Prefab } from 'cc';
import Popup from '../../common/Popup';
import AssetLoader from '../../services/AssetLoader';
import GameManager from '../../managers/GameManager';
import { GameScene } from '../../GameScene';
const { ccclass, property } = _decorator;

@ccclass('popupGameOver')
export class popupGameOver extends Popup {

    public static async show() {
        const prefab = await AssetLoader.loadResAsync<Prefab>("prefabs/popupGameOver", Prefab);
        if (!prefab) return;
        let node = instantiate(prefab);
        node.getComponent(popupGameOver).show();
    }

    show() {
        super.show();
    }

    @property({ type: NumberScrolling, tooltip: 'Điểm số' })
    private numScore : NumberScrolling = null!;

    protected onAfterShow(): void {
        this.numScore.value = 0;
        this.numScore.to(GameManager.instance.score);
    }

    onRestart(){
        GameScene.instance.openMenu();
        this.hide();
    }
}


