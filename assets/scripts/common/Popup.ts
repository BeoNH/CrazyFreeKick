import { _decorator, Canvas, Component, director, Node, tween, UIOpacity, Vec3, warn } from 'cc';
const { ccclass, property } = _decorator;

@ccclass
export default class Popup extends Component {
    @property({ type: Node, tooltip: 'Nền tối phía sau popup' })
    protected bg: Node | null = null;

    @property({ type: Node, tooltip: 'Khung nội dung popup' })
    protected container: Node | null = null;

    @property({ tooltip: 'Click vào bg để đóng popup' })
    protected closeOnBgTap = false;

    @property({ tooltip: 'Thời gian tween show/hide' })
    protected tweenDuration = 0.2;

    @property({ tooltip: 'Scale bắt đầu' })
    protected startScale = 0.15;

    @property({ tooltip: 'Scale khi hiện xong' })
    protected endScale = 1;

    @property({ tooltip: 'Độ mờ của bg' })
    protected bgOpacity = 100;

    private _isVisible = false;
    private _isAnimating = false;
    private _bgOpacityComp: UIOpacity | null = null;

    onLoad() {
        this._bgOpacityComp = this.bg?.getComponent(UIOpacity) ?? this.bg?.addComponent(UIOpacity) ?? null;

        if (this.bg && this.closeOnBgTap) {
            this.bg.on(Node.EventType.TOUCH_END, this.onBgTap, this);
        }

        this.node.active = false;
        this.resetVisualState();
    }

    public show(): void {
        if (this._isVisible || this._isAnimating) return;

        this.attachToPopupRoot();

        this.node.active = true;
        this._isVisible = true;
        this._isAnimating = true;

        this.onBeforeShow();
        this.resetVisualState();

        if (this.bg) {
            this.bg.active = true;
        }

        if (this._bgOpacityComp) {
            tween(this._bgOpacityComp).stop();
            this._bgOpacityComp.opacity = 0;
            tween(this._bgOpacityComp)
                .to(this.tweenDuration, { opacity: this.bgOpacity })
                .start();
        }

        if (this.container) {
            tween(this.container).stop();
            this.container.setScale(this.startScale, this.startScale, this.startScale);
            tween(this.container)
                .to(
                    this.tweenDuration,
                    { scale: new Vec3(this.endScale, this.endScale, this.endScale) },
                    { easing: 'backOut' }
                )
                .call(() => {
                    this._isAnimating = false;
                    this.onAfterShow();
                })
                .start();
        } else {
            this._isAnimating = false;
            this.onAfterShow();
        }
    }

    public hide(): void {
        if (!this._isVisible || this._isAnimating) return;

        this._isAnimating = true;
        this.onBeforeHide();

        if (this._bgOpacityComp) {
            tween(this._bgOpacityComp).stop();
            tween(this._bgOpacityComp)
                .to(this.tweenDuration, { opacity: 0 })
                .start();
        }

        if (this.container) {
            tween(this.container).stop();
            tween(this.container)
                .to(
                    this.tweenDuration,
                    { scale: new Vec3(this.startScale, this.startScale, this.startScale) },
                    { easing: 'backIn' }
                )
                .call(() => this.finishHide())
                .start();
        } else {
            this.finishHide();
        }
    }

    public isVisible(): boolean {
        return this._isVisible;
    }

    protected onBeforeShow(): void { }
    protected onAfterShow(): void { }
    protected onBeforeHide(): void { }
    protected onAfterHide(): void {
        if (this.bg) {
            this.bg.off(Node.EventType.TOUCH_END, this.onBgTap, this);
        }
        this.node.destroy();
    }

    protected onBgTap(): void {
        if (this.closeOnBgTap) {
            this.hide();
        }
    }

    private _cachedPopupRoot: Node | null = null;
    protected getPopupRoot(): Node | null {
        if (this._cachedPopupRoot) return this._cachedPopupRoot;

        const scene = director.getScene();
        if (!scene) return null;

        const canvas = scene.getComponentInChildren(Canvas);
        if (!canvas) return null;

        this._cachedPopupRoot = canvas.node.getChildByName('PopupRoot') ?? canvas.node;

        return this._cachedPopupRoot;
    }

    private attachToPopupRoot(): void {
        const popupRoot = this.getPopupRoot();
        if (!popupRoot) {
            warn('[Popup] popup root not found');
            return;
        }

        if (this.node.parent !== popupRoot) {
            this.node.setParent(popupRoot);
        }

        this.node.setSiblingIndex(popupRoot.children.length - 1);
    }

    private resetVisualState(): void {
        if (this.container) {
            this.container.setScale(this.startScale, this.startScale, this.startScale);
        }

        if (this._bgOpacityComp) {
            this._bgOpacityComp.opacity = 0;
        }
    }

    private finishHide(): void {
        this._isVisible = false;
        this._isAnimating = false;
        this.node.active = false;
        this.onAfterHide();
    }
}


