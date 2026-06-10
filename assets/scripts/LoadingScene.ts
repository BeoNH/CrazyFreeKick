import { _decorator, Component, director, Label, Node, Prefab, Sprite } from 'cc';
import AssetLoader from './services/AssetLoader';
import { NetworkManager, urlParam } from './managers/NetworkManager';
import { userDATA } from './common/GameConfig';
import { i18n } from './i18n/LocalizationManager';
const { ccclass, property } = _decorator;

@ccclass('LoadingScene')
export class LoadingScene extends Component {
    @property({ type: Sprite, tooltip: 'Thanh fill progress (anchor x = 0, left)' })
    private barFill: Sprite = null!;

    @property({ type: Label, tooltip: 'Label hiển thị phần trăm' })
    private labelPct: Label = null!;

    protected onLoad(): void {
        this.startPreload();
        i18n.switchLanguage(urlParam("lang") ?? "en");
    }

    protected async start() {
        const login = await NetworkManager.instance.httpPost("/login", { token: urlParam("token") });
        if (login) {
            userDATA.userName = login?.username;
        }
    }

    private async startPreload(): Promise<void> {
        const sceneTask = new Promise<void>((resolve) => {
            let p = 0;
            director.preloadScene('Game', (completed, total) => {
                p = Math.max(p, completed / total);
                this.setProgress(p * 0.9);
            },
                () => resolve()
            );
        });

        const assetTask = Promise.all([
            AssetLoader.loadResAsync('prefabs/popupSelectTeam', Prefab),
            AssetLoader.loadResAsync('prefabs/popupNextLevel', Prefab),
            AssetLoader.loadResAsync('prefabs/popupGameOver', Prefab),
            AssetLoader.loadResAsync('prefabs/popupGameWin', Prefab),
        ]);

        await Promise.all([
            sceneTask,
            assetTask,
        ]);

        this.onComplete();
    }

    private setProgress(ratio: number): void {
        this.barFill.fillRange = ratio;

        if (this.labelPct) {
            this.labelPct.string = `${Math.round(ratio * 100)}%`;
        }
    }

    private onComplete(): void {
        this.setProgress(1);
        this.scheduleOnce(() => {
            director.loadScene(`Game`, (err) => {
                if (err) console.error('[BootScene] loadScene error:', err);
            });
        }, 0.1);
    }
}


