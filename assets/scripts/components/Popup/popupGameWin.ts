import { NumberScrolling } from './../../common/NumberScrolling';
import { _decorator, Component, instantiate, Label, Node, Prefab } from 'cc';
import Popup from '../../common/Popup';
import AssetLoader from '../../services/AssetLoader';
import GameManager from '../../managers/GameManager';
import { GameScene } from '../../GameScene';
import { NetworkManager } from '../../managers/NetworkManager';
import { userDATA } from '../../common/GameConfig';
const { ccclass, property } = _decorator;


@ccclass('popupGameWin')
export class popupGameWin extends Popup {

    public static async show() {
        const prefab = await AssetLoader.loadResAsync<Prefab>("prefabs/popupGameWin", Prefab);
        if (!prefab) return;
        let node = instantiate(prefab);
        node.getComponent(popupGameWin).show();
    }

    show() {
        super.show();
    }

    @property({ type: NumberScrolling, tooltip: 'Điểm số' })
    private numScore: NumberScrolling = null!;

    protected onAfterShow(): void {
        this.numScore.value = 0;
        this.numScore.to(GameManager.instance.score);

        NetworkManager.instance.httpPost("/saveScore", {
            "username": userDATA?.userName,
            "score": GameManager.instance.score,
            "time": 0
        });
    }

    onRestart() {
        GameScene.instance.openMenu();
        this.hide();
    }
}


