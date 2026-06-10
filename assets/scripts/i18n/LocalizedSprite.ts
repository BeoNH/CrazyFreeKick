import { _decorator, Component, Sprite, SpriteFrame } from 'cc';
import { i18n, LocalizationManager } from './LocalizationManager';

const { ccclass, property } = _decorator;

@ccclass('LocalizedSprite')
export class LocalizedSprite extends Component {

    @property({ type: SpriteFrame, tooltip: 'Tiếng Việt (VN)' })
    spriteVN: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'English (EN)' })
    spriteEN: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'ພາສາລາວ (LO)' })
    spriteLO: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '한국어 (KR)' })
    spriteKR: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Bahasa Melayu (MY)' })
    spriteMY: SpriteFrame | null = null;

    @property({ tooltip: 'Fallback về EN nếu ngôn ngữ hiện tại không có ảnh' })
    useFallback: boolean = true;

    private _sprite: Sprite | null = null;

    private readonly _spriteMap: Record<string, () => SpriteFrame | null> = {
        'vn': () => this.spriteVN,
        'en': () => this.spriteEN,
        'lo': () => this.spriteLO,
        'kr': () => this.spriteKR,
        'my': () => this.spriteMY,
    };

    onLoad() {
        this._sprite = this.getComponent(Sprite);
        this._updateSprite();
        i18n.on(LocalizationManager.EVENT_LANG_CHANGED, this._updateSprite, this);
    }

    onDestroy() {
        i18n.off(LocalizationManager.EVENT_LANG_CHANGED, this._updateSprite, this);
    }

    private _updateSprite = () => {
        if (!this._sprite) return;
        const frame = this._spriteMap[i18n.currentLang]?.() ?? (this.useFallback ? this.spriteEN : null);
        if (frame) this._sprite.spriteFrame = frame;
    };
}