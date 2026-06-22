import { NumberScrolling } from './../../common/NumberScrolling';
import { _decorator, instantiate, Prefab } from 'cc';
import Popup from '../../common/Popup';
import AssetLoader from '../../services/AssetLoader';
import GameManager from '../../managers/GameManager';
import { GameScene } from '../../GameScene';
import { AudioController } from '../AudioController';
import { NetworkManager } from '../../managers/NetworkManager';
import { userDATA } from '../../common/GameConfig';
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
    private numScore: NumberScrolling = null!;

    protected onAfterShow(): void {
        AudioController.instance.stopBGM();
        AudioController.instance.gameOver();
        this.numScore.value = 0;
        this.numScore.to(GameManager.instance.score);

        NetworkManager.instance.httpPost("/saveScore", {
            "username": userDATA?.userName,
            "score": GameManager.instance.score,
            "time": GameManager.instance.sessionTimeSeconds
        });
    }

    onRestart() {
        GameScene.instance.openMenu();
        this.hide();
    }
}