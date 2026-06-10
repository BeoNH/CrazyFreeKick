import { EventTarget } from 'cc';

const LANGUAGES: Record<string, Record<string, any>> = {
    vi: {
        score: "ĐIỂM:",
        bonus: "THƯỞNG",
        congratulations: "CONGRATULATIONS!!",
        goalScore: "Goal score:",
    },

    en: {
        score: "SCORE:",
        bonus: "BONUS",
        congratulations: "CONGRATULATIONS!!",
        goalScore: "Goal score:",
    },

    lo: {
        score: "ຄະແນນ:",
        bonus: "ໂບນັດ",
        congratulations: "ຂໍສະແດງຄວາມຍິນດີ!!",
        goalScore: "ຄະແນນປະຕູ:",
    },

    my: {
        score: "ရမှတ်:",
        bonus: "အပိုဆု",
        congratulations: "ဂုဏ်ယူပါတယ်!!",
        goalScore: "ဂိုးရမှတ်:",
    },

    kr: {
        score: "점수:",
        bonus: "보너스",
        congratulations: "축하합니다!!",
        goalScore: "골 점수:",
    },
};

// =============================================
const DEFAULT_LANG = 'en';
export class LocalizationManager extends EventTarget {
    private static _instance: LocalizationManager;
    private _currentLang: string = DEFAULT_LANG;

    static readonly EVENT_LANG_CHANGED = 'lang_changed';

    static get instance(): LocalizationManager {
        if (!this._instance) {
            this._instance = new LocalizationManager();
        }
        return this._instance;
    }

    switchLanguage(lang: string): void {
        if (!LANGUAGES[lang]) {
            console.warn(`[i18n] Language "${lang}" not found, falling back to "${DEFAULT_LANG}"`);
            lang = DEFAULT_LANG;
        }
        this._currentLang = lang;
        this.emit(LocalizationManager.EVENT_LANG_CHANGED, lang);
    }

    t(key: string, ...args: (string | number)[]): string {
        const text = this._resolve(key);
        if (text === null) {
            console.warn(`[i18n] Missing key: "${key}" in "${this._currentLang}"`);
            return '. . .';
        }
        return text.replace(/\{(\d+)\}/g, (_, i) => String(args[+i] ?? ''));
    }

    get currentLang() { return this._currentLang; }

    get availableLanguages(): string[] { return Object.keys(LANGUAGES); }

    private _resolve(key: string): string | null {
        const data = LANGUAGES[this._currentLang] ?? LANGUAGES[DEFAULT_LANG];
        const parts = key.split('.');
        let obj: any = data;
        for (const p of parts) {
            if (obj == null || typeof obj !== 'object') return null;
            obj = obj[p];
        }

        if (typeof obj !== 'string' && this._currentLang !== DEFAULT_LANG) {
            let fallback: any = LANGUAGES[DEFAULT_LANG];
            for (const p of parts) {
                if (fallback == null || typeof fallback !== 'object') return null;
                fallback = fallback[p];
            }
            return typeof fallback === 'string' ? fallback : null;
        }

        return typeof obj === 'string' ? obj : null;
    }
}

export const i18n = LocalizationManager.instance;