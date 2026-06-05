import { _decorator, Component, Node, tween, UIOpacity } from 'cc';
import { popupSelectTeam } from './components/Popup/popupSelectTeam';
import { AudioController } from './components/AudioController';
const { ccclass, property } = _decorator;

@ccclass('GameScene')
export class GameScene extends Component {
    private static _instance: GameScene | null = null;

    static get instance(): GameScene {
        if (!GameScene._instance) {
            GameScene._instance = new GameScene();
        }
        return GameScene._instance;
    }
    @property({ type: Node, tooltip: 'Giao diện chơi' })
    private GamePanel: Node = null!;

    @property({ type: Node, tooltip: 'Giao diện chờ' })
    private MenuPanel: Node = null!;

    protected onLoad(): void {
        GameScene._instance = this;
    }
    
    protected start(): void {
        this.openMenu();
    }

    openMenu() {
        AudioController.instance.enterMenu();
        this.GamePanel.active = false;
        this.MenuPanel.active = true;

        const splash = this.MenuPanel?.getChildByPath(`Splash`);
        if (splash) {
            const opacity = splash.getComponent(UIOpacity);
            opacity.opacity = 200;
            tween(opacity)
                .to(0.8, { opacity: 0 }, { easing: 'quadIn' })
                .start();
        }
    }

    openGame() {
        AudioController.instance.enterGame();
        this.GamePanel.active = true;
        this.MenuPanel.active = false;
    }
    
    onSelectTeam(){
        AudioController.instance.click();
        popupSelectTeam.show()
    }
}


