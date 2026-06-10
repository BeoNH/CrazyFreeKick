import { _decorator, CCString, Component, Label, RichText } from 'cc';
import { i18n, LocalizationManager } from './LocalizationManager';

const { ccclass, property } = _decorator;

@ccclass('LocalizedLabel')
export class LocalizedLabel extends Component {

    @property({ tooltip: 'Key trong file JSON' })
    key: string = '';

    @property({ type: [CCString], tooltip: 'Tham số động {0}, {1}, ...' })
    params: string[] = [];

    private _label: Label | RichText | null = null;

    onLoad() {
        this._label = this.getComponent(Label) || this.getComponent(RichText);
        this._updateText();
        i18n.on(LocalizationManager.EVENT_LANG_CHANGED, this._updateText, this);
    }

    onDestroy() {
        i18n.off(LocalizationManager.EVENT_LANG_CHANGED, this._updateText, this);
    }

    // Cập nhật params động từ code
    setParams(...params: (string | number)[]) {
        this.params = params.map(String);
        this._updateText();
    }

    // Đổi key động từ code
    setKey(key: string, ...params: (string | number)[]) {
        this.key = key;
        this.params = params.map(String);
        this._updateText();
    }

    private _updateText = () => {
        if (!this._label || !this.key) return;
        const text = i18n.t(this.key, ...this.params);
        if (this._label instanceof Label) {
            this._label.string = text;
        } else {
            this._label.string = text; // RichText
        }
    };
}