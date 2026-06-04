import { _decorator, Component, Node, tween, UIOpacity } from 'cc';
import { popupSelectTeam } from './components/Popup/popupSelectTeam';
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
        this.openMenu();
    }

    openMenu() {
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
        popupSelectTeam.show()
            .then(() => {
                this.GamePanel.active = true;
                this.MenuPanel.active = false;
            })
    }
}


