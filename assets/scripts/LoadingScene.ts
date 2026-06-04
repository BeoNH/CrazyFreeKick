import { _decorator, Component, director, Label, Node, Prefab, Sprite } from 'cc';
import AssetLoader from './services/AssetLoader';
const { ccclass, property } = _decorator;

@ccclass('LoadingScene')
export class LoadingScene extends Component {
    @property({ type: Sprite, tooltip: 'Thanh fill progress (anchor x = 0, left)' })
    private barFill: Sprite = null!;

    @property({ type: Label, tooltip: 'Label hiển thị phần trăm' })
    private labelPct: Label = null!;

    protected onLoad(): void {
        this.startPreload();
    }

private async startPreload(): Promise<void> {
    const sceneTask = new Promise<void>((resolve) => {
        director.preloadScene(
            'Game',
            (completed, total) => {
                this.setProgress(completed / total * 0.8);
            },
            () => resolve()
        );
    });

    const assetTask = Promise.all([
        AssetLoader.loadResAsync('prefabs/popupSelectTeam', Prefab),
    ]);

    await Promise.all([
        assetTask,
        sceneTask,
    ]);

    this.onComplete();
}

    private setProgress(ratio: number): void {
        ratio = Math.min(Math.max(ratio, 0), 1);

        this.barFill.fillRange = ratio;

        if (this.labelPct) {
            this.labelPct.string = `${Math.floor(ratio * 100)}%`;
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


