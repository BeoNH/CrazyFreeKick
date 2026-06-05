import { _decorator, AudioSource, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('AudioController')
export class AudioController extends Component {
    public static instance: AudioController;

    @property({ type: Node, tooltip: 'iconInMenu' })
    private iconMenu: Node = null!;

    @property({ type: Node, tooltip: 'iconInGame' })
    private iconGame: Node = null!;

    private volume = 1;

    protected onLoad(): void {
        AudioController.instance = this;
    }

    /** Bật/tắt toàn bộ âm thanh */
    public toggleMute(): void {
        this.volume = this.volume === 1 ? 0 : 1;

        for (const child of this.node.children) {
            const audio = child.getComponent(AudioSource);
            if (audio) audio.volume = this.volume;
        }

        this.updateIcons();
    }

    /** Chuyển sang menu: phát soundtrack, tắt crowd */
    public enterMenu(): void {
        this.stop('crowd');
        this.playLoop('soundtrack');

        this.updateIcons();
    }

    /** Chuyển sang game: tắt soundtrack, phát crowd */
    public enterGame(): void {
        this.stop('soundtrack');
        this.playLoop('crowd');

        this.updateIcons();
    }

    /** Phát SFX 1 lần */
    public playSFX(name: string): void {
        const audio = this.getAudio(name);
        if (!audio) return;

        audio.stop();
        audio.play();
    }

    /** Phát nhạc nền loop */
    public playLoop(name: 'soundtrack' | 'crowd'): void {
        const audio = this.getAudio(name);
        if (!audio) return;

        audio.loop = true;
        if (audio.playing) return;
        audio.play();
    }

    /** Dừng âm thanh */
    public stop(name: string): void {
        const audio = this.getAudio(name);
        if (!audio) return;

        audio.stop();
    }

    /** Dừng hết nhạc nền */
    public stopBGM(): void {
        this.stop('soundtrack');
        this.stop('crowd');
    }

    private getAudio(name: string): AudioSource | null {
        const node = this.node.getChildByName(name);
        if (!node) return null;

        return node.getComponent(AudioSource);
    }

    private updateIcons(): void {
        const muted = this.volume === 0;

        if (this.iconMenu?.children[0]) {
            this.iconMenu.children[0].active = muted;
        }

        if (this.iconGame?.children[0]) {
            this.iconGame.children[0].active = muted;
        }
    }

    // --- Các hàm tiện gọi theo tên âm thanh ---

    public click(): void {
        this.playSFX('press_but');
    }

    public selectTeam(): void {
        this.playSFX('select_team');
    }

    public kick(): void {
        this.playSFX('kick');
    }

    public goal(): void {
        this.playSFX('goal');
    }

    public keeperSave(): void {
        this.playSFX('keeper_save');
    }

    public missGoal(): void {
        this.playSFX('miss_goal');
    }

    public gameOver(): void {
        this.playSFX('game_over');
    }

    public applause(): void {
        this.playSFX('applause');
    }

    public stopIndicator(): void {
        this.playSFX('stop_indicator');
    }
}