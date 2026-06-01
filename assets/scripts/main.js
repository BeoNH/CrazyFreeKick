// ============================================================
// HTTP UTILITY
// ============================================================

class Http {
    /**
     * Gửi POST request, tự động parse JSON response.
     * @param {string} url
     * @param {object|null} params
     * @param {function} onFinished - callback(error, data)
     * @param {object|null} headers
     */
    static post(url, params, onFinished, headers = null) {
        const xhr = new XMLHttpRequest();
        let called = false;

        // Encode params thành query string (dùng khi không phải JSON)
        let queryString = "";
        if (params !== null) {
            const entries = Object.keys(params);
            queryString = entries
                .filter(key => params.hasOwnProperty(key))
                .map((key, i) => {
                    const pair = encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
                    return pair;
                })
                .join("&");
        }

        // Hàm helper để chỉ gọi callback một lần
        function finish(err, data) {
            if (!called) {
                called = true;
                onFinished(err, data);
            }
        }

        xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) return;

            if (xhr.status === 200) {
                let data = null;
                let parseError = null;
                try {
                    data = JSON.parse(xhr.responseText);
                } catch (ex) {
                    parseError = ex;
                }
                finish(parseError, data);
            } else {
                finish(new Error(`XHR status: ${xhr.status}`), null);
            }
        };

        xhr.onerror   = () => finish(new Error(`XHR error, status: ${xhr.status}`), null);
        xhr.ontimeout = () => finish(new Error(`XHR timeout, status: ${xhr.status}`), null);
        xhr.onabort   = () => finish(new Error(`XHR aborted, status: ${xhr.status}`), null);

        xhr.open("POST", url, true);

        // Set custom headers nếu có
        if (typeof headers === "object" && headers !== null) {
            for (const key in headers) {
                xhr.setRequestHeader(key, headers[key]);
            }
        }

        // Gửi body
        if (headers && headers["Content-type"] === "application/json") {
            xhr.send(JSON.stringify(params));
        } else {
            xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            xhr.send(queryString);
        }
    }
}


// ============================================================
// API — giao tiếp với server game
// ============================================================

class API {
    static GAME_NAME    = "crazy-free-kick";
    static SOURCE       = API.urlParam("url_api");
    static ACCESS_TOKEN = API.urlParam("token");
    static USERNAME     = null;
    static DOMAIN       = "https://apiminigame-kh.gamebatta.com/api-minigame";

    // Lấy toàn bộ query params từ URL thành object
    static PARAMS = (() => {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    })();

    /** Đọc một query param từ URL */
    static urlParam(name) {
        const searchString = window["URL_SEARCH_PARAMS"] ?? window.location.search;
        const match = new RegExp("[\\?&]" + name + "=([^&#]*)").exec(searchString);
        return match ? (match[1] || "") : "";
    }

    /** Gửi POST request tới API server, tự đính kèm thông tin game */
    static post(path, params) {
        console.log(`[POST>>>] route: ${path}, params:`, params);

        return new Promise(resolve => {
            const data = {
                ...this.PARAMS,
                source:    this.SOURCE,
                game_name: this.GAME_NAME,
                ...(params ?? {}),
            };

            Http.post(`${this.DOMAIN}/${path}`, data, (err, responseData) => {
                console.log(`[POST<<<] route: ${path}, params: ${JSON.stringify(params)}, data:`, responseData);
                resolve(responseData);
            }, {
                "Content-type": "application/json"
            });
        });
    }

    /** Đăng nhập và lưu username. Trả về username hoặc null nếu thất bại. */
    static async login() {
        if (this.USERNAME) return this.USERNAME;

        const res = await this.post("login", { token: this.ACCESS_TOKEN });
        if (!res) return null;

        this.USERNAME = res.username;
        return this.USERNAME;
    }

    /** Lưu điểm số của người chơi */
    static async saveScore(data) {
        await this.login();
        return this.post("saveScore", { ...data, username: this.USERNAME });
    }

    /** Lấy điểm cao nhất của người chơi hiện tại */
    static async getHighScore() {
        await this.login();
        const res = await this.post("getHighestScore", { username: this.USERNAME });
        if (!res) return 0;
        return res.yourInfo.numScore;
    }

    /** Cập nhật event challenge (chỉ khi URL có ?challenge=true) */
    static async updateEventChallenge(data) {
        if (this.urlParam("challenge") !== "true") return;
        await this.login();
        return this.post("updateEventChallenge", { ...data, username: this.USERNAME });
    }

    /** Lấy lịch sử thi đấu */
    static async history() {
        await this.login();
        return this.post("getHistory", { username: this.USERNAME });
    }

    /** Lấy bảng xếp hạng */
    static async leaderboard() {
        await this.login();
        return this.post("getRankList", { username: this.USERNAME });
    }
}


// ============================================================
// HẰNG SỐ — CANVAS & GAME CONFIG
// ============================================================

const CANVAS_WIDTH  = 1360;
const CANVAS_HEIGHT = 640;
const EDGEBOARD_X   = 275;
const EDGEBOARD_Y   = 80;
const FONT_GAME     = "walibi0615bold";
const FPS_TIME      = 1000 / 24;

const DISABLE_SOUND_MOBILE = false;
const NUM_CROWD = 31;
const NUM_LEVEL = 6;
const NUM_KICK  = 5;

// Phím tắt
const SPACE_BAR = 32;
const LEFT  = 37;
const RIGHT = 39;
const UP    = 38;
const DOWN  = 40;

// Tham số chỉ báo cú sút
var SHOT_INDICATOR_SPEED;
var DECREASE_SHOT_INDICATOR_SPEED;

const RANGE_WIDTH  = 9;
const RANGE_HEIGHT = 4;
const LOW_PERCENT  = 5;
const MED_PERCENT  = 50;
const HIGH_PERCENT = 90;

// Vùng lưới mục tiêu
const MATRIX_X_START = 380;
const MATRIX_X_END   = 1040;
const MATRIX_Y_START = 235;
const MATRIX_Y_END   = 430;

var ROUND = 0;

// Kích thước UI
const MSG_BOX_WIDTH  = 744;
const MSG_BOX_HEIGHT = 450;
const GOAL_WIDTH     = 390;
const GOAL_HEIGHT    = 145;
const PLAYER_WIDTH   = 160;
const PLAYER_HEIGHT  = 239;
const WALL_WIDTH     = 119;
const WALL_HEIGHT    = 179;
const BALL_WIDTH     = 60;
const BALL_HEIGHT    = 60;

const STEP_SPEED_BALL_HITTED = 2.4;
const TOP_BARX  = 784;
const TOP_BARY  = 48;
const RIGHT_BARX = 44;
const RIGHT_BARY = 359;
const CURSOR_X  = 41;
const CURSOR_Y  = 41;

// Vị trí chọn nhân vật
const PLAYER_X_POSITION_IN_SELECTION = CANVAS_WIDTH / 2;
const PLAYER_Y_POSITION_IN_SELECTION = 350;

// Chỉ số đội tuyển
const ARGENTINA = 0;
const BRAZIL    = 1;
const GERMANY   = 2;
const ENGLAND   = 3;
const ITALY     = 4;
const FRANCE    = 5;

// Trạng thái game
const FIRST_TIME    = 0;
const STATE_LOADING = 0;
const STATE_MENU    = 1;
const STATE_HELP    = 1;
const STATE_GAME    = 3;

// Sự kiện chuột
const ON_MOUSE_DOWN = 0;
const ON_MOUSE_UP   = 1;
const ON_MOUSE_OVER = 2;
const ON_MOUSE_OUT  = 3;
const ON_DRAG_START = 4;
const ON_DRAG_END   = 5;

var ENABLE_FULLSCREEN;
var ENABLE_CHECK_ORIENTATION;
const NUM_SAVE = 8;

// Vị trí thủ môn
const GOALKEEPER_X_POSITION = CANVAS_WIDTH / 2;
const GOALKEEPER_Y_POSITION = 390;
const GOALKEEPER_WIDTH  = 91;
const GOALKEEPER_HEIGHT = 122;

// Thông tin các hành động của thủ môn
const CENTER_INFO = {
    action: "center", width: 91,  height: 122, x: CANVAS_WIDTH / 2, y: 420, frames: 4
};
const CENTER_HIGH_INFO = {
    action: "center_high", width: 106, height: 163, x: CANVAS_WIDTH / 2, y: 420, frames: 9
};
const DOWN_LEFT_INFO = {
    action: "down_left", width: 185, height: 118, x: CANVAS_WIDTH / 2 - 45, y: 420, frames: 16
};
const DOWN_RIGHT_INFO = {
    action: "down_right", width: 185, height: 118, x: CANVAS_WIDTH / 2 + 45, y: 420, frames: 17
};
const HIGH_LEFT_INFO = {
    action: "high_left", width: 295, height: 163, x: CANVAS_WIDTH / 2 - 100, y: 420, frames: 17
};
const HIGH_RIGHT_INFO = {
    action: "high_right", width: 275, height: 163, x: CANVAS_WIDTH / 2 + 90, y: 420, frames: 17
};
const MED_LEFT_INFO = {
    action: "med_left", width: 229, height: 113, x: CANVAS_WIDTH / 2 - 65, y: 420, frames: 16
};
const MED_RIGHT_INFO = {
    action: "med_right", width: 229, height: 118, x: CANVAS_WIDTH / 2 + 65, y: 420, frames: 16
};

// Chỉ số hành động thủ môn
const CENTER      = 0;
const CENTER_HIGH = 1;
const DOWN_LEFT   = 2;
const DOWN_RIGHT  = 3;
const HIGH_LEFT   = 4;
const HIGH_RIGHT  = 5;
const MED_LEFT    = 6;
const MED_RIGHT   = 7;
const OUT         = 8;


// ============================================================
// TEXT — Nội dung hiển thị
// ============================================================

var TEXT_SCORE       = "SCORE: ";
var TEXT_PAUSE       = "PAUSE";
var TEXT_BONUS       = "BONUS";
var TEXT_CONGRATS    = "CONGRATULATIONS!!";
var TEXT_GOAL_SCORED = "GOAL SCORED";
var TEXT_TEAM_0 = "ARGENTINA";
var TEXT_TEAM_1 = "BRAZIL";
var TEXT_TEAM_2 = "GERMANY";
var TEXT_TEAM_3 = "ENGLAND";
var TEXT_TEAM_4 = "ITALY";
var TEXT_TEAM_5 = "FRANCE";

var HELP_TEXT_DESKTOP = "PRESS SPACEBAR TO CHOSE POINT WHERE KICKING BALL ON HORIZONTAL AND VERTICAL AXIS!!";
var HELP_TEXT_MOBILE  = "TAP ON THE SCREEN TO CHOSE POINT WHERE KICKING BALL ON HORIZONTAL AND VERTICAL AXIS!!";
var HELP_TEXT = "TRY TO BE QUICK! THE BONUS MULTIPLIER DECREASES RAPIDLY EACH SECOND. EVERY GOAL INCREASES YOUR SCORE, MULTIPLYING IT BY THE MULTIPLIER!";

var TEXT_DEVELOPED   = "DEVELOPED BY";
var TEXT_SHARE_IMAGE = "200x200.jpg";
var TEXT_SHARE_TITLE = "Congratulations!";
var TEXT_SHARE_MSG1  = "You collected <strong>";
var TEXT_SHARE_MSG2  = " points</strong>!<br><br>Share your score with your friends!";
var TEXT_SHARE_SHARE1 = "My score is ";
var TEXT_SHARE_SHARE2 = " points! Can you do better";


// ============================================================
// BIẾN TOÀN CỤC — STATE
// ============================================================

var s_iScaleFactor = 1;
var s_bIsIphone    = false;
var s_bMobile;
var s_bAudioActive = true;
var s_bFullscreen  = false;

var s_iCntTime  = 0;
var s_iTimeElaps = 0;
var s_iPrevTime = 0;
var s_iCntFps   = 0;
var s_iCurFps   = 0;
var s_iOffsetX  = 0;
var s_iOffsetY  = 0;

var s_iTeamSelected       = ARGENTINA;
var s_szTeamSelectedSprite = "argentina";

var s_oDrawLayer, s_oStage, s_oMain, s_oSpriteLibrary;
var s_oSoundTrack = null;
var s_oCrowd;
var s_oCanvas;

var s_oMenu       = null;
var s_oSelectTeam = null;
var s_oInterface  = null;
var s_oGame;
var s_oPlayer = null;
var s_oBall   = null;
var s_oBatter = null;


// ============================================================
// MOBILE DETECTION
// ============================================================

(function (userAgent) {
    (jQuery.browser = jQuery.browser || {}).mobile =
        /android|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(ad|hone|od)|iris|kindle|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|symbian|tablet|treo|up\.(browser|link)|vodafone|wap|webos|windows (ce|phone)|xda|xiino/i.test(userAgent)
        || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|e\-|e\/|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(di|rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|xda(\-|2|g)|yas\-|your|zeto|zte\-/i.test(userAgent.substr(0, 4));
})(navigator.userAgent || navigator.vendor || window.opera);


// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function trace(msg) {
    console.log(msg);
}

function isIOS() {
    const iosDevices = "iPad Simulator;iPhone Simulator;iPod Simulator;iPad;iPhone;iPod".split(";");
    if (navigator.userAgent.toLowerCase().indexOf("iphone") !== -1) {
        s_bIsIphone = true;
    }
    while (iosDevices.length) {
        if (navigator.platform === iosDevices.pop()) return true;
    }
    s_bIsIphone = false;
    return false;
}

function inIframe() {
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}

function getParamValue(name) {
    const parts = window.location.search.substring(1).split("&");
    for (let i = 0; i < parts.length; i++) {
        const pair = parts[i].split("=");
        if (pair[0] === name) return pair[1];
    }
}

/** Lấy chiều rộng hoặc chiều cao viewport thực tế (xử lý quirk của các trình duyệt) */
function getSize(dimension) {
    const dimLower = dimension.toLowerCase();
    const doc  = window.document;
    const html = doc.documentElement;

    if (window["inner" + dimension] === undefined) {
        return html["client" + dimension];
    }

    if (window["inner" + dimension] !== html["client" + dimension]) {
        // Dùng CSS media query để phát hiện chiều chính xác
        const testBody = doc.createElement("body");
        testBody.id = "vpw-test-b";
        testBody.style.cssText = "overflow:scroll";

        const testDiv = doc.createElement("div");
        testDiv.id = "vpw-test-d";
        testDiv.style.cssText = "position:absolute;top:-1000px";
        testDiv.innerHTML = `<style>@media(${dimLower}:${html["client" + dimension]}px){body#vpw-test-b div#vpw-test-d{${dimLower}:7px!important}}</style>`;

        testBody.appendChild(testDiv);
        html.insertBefore(testBody, doc.head);

        const result = (testDiv["offset" + dimension] === 7)
            ? html["client" + dimension]
            : window["inner" + dimension];

        html.removeChild(testBody);
        return result;
    }

    return window["inner" + dimension];
}

function getIOSWindowHeight() {
    return document.documentElement.clientWidth / window.innerWidth * window.innerHeight;
}

function getHeightOfIOSToolbars() {
    const screenHeight = (window.orientation === 0) ? screen.height : screen.width;
    const diff = screenHeight - getIOSWindowHeight();
    return diff > 1 ? diff : 0;
}

/** Phát âm thanh nếu không bị tắt trên mobile */
function playSound(id, volume, loop) {
    if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
        return createjs.Sound.play(id, { loop, volume });
    }
    return null;
}

function stopSound(sound) {
    if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
        sound.stop();
    }
}

/** Tạo Bitmap với hitArea tự động */
function createBitmap(image, hitWidth, hitHeight) {
    const bitmap = new createjs.Bitmap(image);
    const hitArea = new createjs.Shape();

    if (hitWidth && hitHeight) {
        hitArea.graphics.beginFill("#fff").drawRect(0, 0, hitWidth, hitHeight);
    } else {
        hitArea.graphics.beginFill("#ff0").drawRect(0, 0, image.width, image.height);
    }

    bitmap.hitArea = hitArea;
    return bitmap;
}

/** Tạo Sprite với hitArea tự động */
function createSprite(spriteSheet, animation, regX, regY, hitWidth, hitHeight) {
    const sprite = animation !== null
        ? new createjs.Sprite(spriteSheet, animation)
        : new createjs.Sprite(spriteSheet);

    const hitArea = new createjs.Shape();
    hitArea.graphics.beginFill("#000000").drawRect(-regX, -regY, hitWidth, hitHeight);
    sprite.hitArea = hitArea;
    return sprite;
}

function randomFloatBetween(min, max, decimals = 2) {
    return parseFloat(Math.min(min + Math.random() * (max - min), max).toFixed(decimals));
}

/** Xoay vector 2D tại chỗ */
function rotateVector2D(angle, vector) {
    const newX =  vector.getX() * Math.cos(angle) + vector.getY() * Math.sin(angle);
    const newY = -vector.getX() * Math.sin(angle) + vector.getY() * Math.cos(angle);
    vector.set(newX, newY);
}

function tweenVectorsOnX(start, end, t) {
    return start + t * (end - start);
}

/** Fisher-Yates shuffle */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function bubbleSort(arr) {
    let swapped;
    do {
        swapped = false;
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] > arr[i + 1]) {
                [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
                swapped = true;
            }
        }
    } while (swapped);
}

function compare(a, b) {
    if (a.index > b.index) return -1;
    if (a.index < b.index) return 1;
    return 0;
}

// Hàm easing
function easeLinear(t, start, change, duration) {
    return change * t / duration + start;
}
function easeInQuad(t, start, change, duration) {
    return change * (t / duration) * (t / duration) + start;
}
function easeInSine(t, start, change, duration) {
    return -change * Math.cos(t / duration * (Math.PI / 2)) + change + start;
}
function easeInCubic(t, start, change, duration) {
    return change * Math.pow(t / duration, 3) + start;
}
function easeOutCubic(t, start, change, duration) {
    return change * (Math.pow(t / duration - 1, 3) + 1) + start;
}

/** Lấy điểm trên đường cong Bezier bậc 2 tại tham số t [0,1] */
function getTrajectoryPoint(t, curve) {
    const point = new createjs.Point();
    const inv = 1 - t;
    point.x = inv * inv * curve.start.x + 2 * inv * t * curve.traj.x + t * t * curve.end.x;
    point.y = inv * inv * curve.start.y + 2 * inv * t * curve.traj.y + t * t * curve.end.y;
    return point;
}

/** Format mili giây thành MM:SS */
function formatTime(ms) {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds - minutes * 60);
    const mm = minutes < 10 ? "0" + minutes : String(minutes);
    const ss = seconds < 10 ? "0" + seconds : String(seconds);
    return mm + ":" + ss;
}

function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

/** Kiểm tra va chạm hình chữ nhật (có scale) */
function checkRectCollision(objA, objB) {
    const boundsA = getBounds(objA, 0.9);
    const boundsB = getBounds(objB, 0.98);
    return calculateIntersection(boundsA, boundsB);
}

/** Tính vùng giao nhau của hai hình chữ nhật */
function calculateIntersection(rectA, rectB) {
    const halfWA = rectA.width  / 2;
    const halfHA = rectA.height / 2;
    const halfWB = rectB.width  / 2;
    const halfHB = rectB.height / 2;

    const centerAx = rectA.x + halfWA;
    const centerAy = rectA.y + halfHA;
    const centerBx = rectB.x + halfWB;
    const centerBy = rectB.y + halfHB;

    const overlapX = Math.abs(centerAx - centerBx) - (halfWA + halfWB);
    const overlapY = Math.abs(centerAy - centerBy) - (halfHA + halfHB);

    if (overlapX < 0 && overlapY < 0) {
        return {
            x:      Math.max(rectA.x, rectB.x),
            y:      Math.max(rectA.y, rectB.y),
            width:  Math.min(Math.min(rectA.width, rectB.width), -overlapX),
            height: Math.min(Math.min(rectA.height, rectB.height), -overlapY),
            rect1:  rectA,
            rect2:  rectB,
        };
    }
    return null;
}

/** Tính bounding box toàn cục của một display object */
function getBounds(obj, scale) {
    const bounds = { x: Infinity, y: Infinity, width: 0, height: 0 };

    if (obj instanceof createjs.Container) {
        bounds.x2 = -Infinity;
        bounds.y2 = -Infinity;

        for (const child of obj.children) {
            const childBounds = getBounds(child, 1);
            bounds.x  = Math.min(bounds.x,  childBounds.x);
            bounds.y  = Math.min(bounds.y,  childBounds.y);
            bounds.x2 = Math.max(bounds.x2, childBounds.x + childBounds.width);
            bounds.y2 = Math.max(bounds.y2, childBounds.y + childBounds.height);
        }

        if (bounds.x  === Infinity)  bounds.x  = 0;
        if (bounds.y  === Infinity)  bounds.y  = 0;
        if (bounds.x2 === -Infinity) bounds.x2 = 0;
        if (bounds.y2 === -Infinity) bounds.y2 = 0;

        bounds.width  = bounds.x2 - bounds.x;
        bounds.height = bounds.y2 - bounds.y;
        delete bounds.x2;
        delete bounds.y2;

    } else {
        let w = 0, h = 0, regX = 0, regY = 0, src;

        if (obj instanceof createjs.Bitmap) {
            src = obj.sourceRect || obj.image;
            w   = src.width  * scale;
            h   = src.height * scale;

        } else if (obj instanceof createjs.Sprite) {
            const frame = obj.spriteSheet._frames && obj.spriteSheet._frames[obj.currentFrame];
            if (frame && frame.image) {
                const frameData = obj.spriteSheet.getFrame(obj.currentFrame);
                w    = frameData.rect.width;
                h    = frameData.rect.height;
                regX = frameData.regX;
                regY = frameData.regY;
            } else {
                bounds.x = obj.x || 0;
                bounds.y = obj.y || 0;
            }
        } else {
            bounds.x = obj.x || 0;
            bounds.y = obj.y || 0;
        }

        // Tính 4 góc sau khi transform để lấy AABB
        const corners = [
            obj.localToGlobal(-regX,      -regY),
            obj.localToGlobal(w - regX,   h - regY),
            obj.localToGlobal(w - regX,   -regY),
            obj.localToGlobal(-regX,      h - regY),
        ];

        bounds.regX   = regX;
        bounds.regY   = regY;
        bounds.x      = Math.min(...corners.map(c => c.x));
        bounds.y      = Math.min(...corners.map(c => c.y));
        bounds.width  = Math.max(...corners.map(c => c.x)) - bounds.x;
        bounds.height = Math.max(...corners.map(c => c.y)) - bounds.y;
    }

    return bounds;
}


// ============================================================
// NO CLICK DELAY — xử lý touch nhanh hơn trên mobile
// ============================================================

function NoClickDelay(element) {
    this.element = element;
    if (window.Touch) {
        this.element.addEventListener("touchstart", this, false);
    }
}

NoClickDelay.prototype = {
    handleEvent(event) {
        switch (event.type) {
            case "touchstart": this.onTouchStart(event); break;
            case "touchmove":  this.onTouchMove(event);  break;
            case "touchend":   this.onTouchEnd(event);   break;
        }
    },

    onTouchStart(event) {
        event.preventDefault();
        this.moved = false;
        this.element.addEventListener("touchmove", this, false);
        this.element.addEventListener("touchend",  this, false);
    },

    onTouchMove() {
        this.moved = true;
    },

    onTouchEnd(event) {
        this.element.removeEventListener("touchmove", this, false);
        this.element.removeEventListener("touchend",  this, false);

        if (!this.moved) {
            let target = document.elementFromPoint(
                event.changedTouches[0].clientX,
                event.changedTouches[0].clientY
            );
            // Bỏ qua text node
            if (target.nodeType === 3) target = target.parentNode;

            const clickEvent = document.createEvent("MouseEvents");
            clickEvent.initEvent("click", true, true);
            target.dispatchEvent(clickEvent);
        }
    }
};


// ============================================================
// PAGE VISIBILITY — dừng/tiếp tục game khi đổi tab
// ============================================================

(function () {
    const stateMap = {
        focus:    "visible",
        focusin:  "visible",
        pageshow: "visible",
        blur:     "hidden",
        focusout: "hidden",
        pagehide: "hidden",
    };

    function onVisibilityChange(event) {
        event = event || window.event;

        let isHidden;
        if (event.type in stateMap) {
            isHidden = stateMap[event.type] === "hidden";
        } else {
            isHidden = !!document[visibilityProp];
        }

        document.body.className = isHidden ? "hidden" : "visible";

        if (isHidden) {
            s_oMain.stopUpdate();
        } else {
            s_oMain.startUpdate();
        }
    }

    let visibilityProp = "hidden";

    if (visibilityProp in document) {
        document.addEventListener("visibilitychange", onVisibilityChange);
    } else if ((visibilityProp = "mozHidden") in document) {
        document.addEventListener("mozvisibilitychange", onVisibilityChange);
    } else if ((visibilityProp = "webkitHidden") in document) {
        document.addEventListener("webkitvisibilitychange", onVisibilityChange);
    } else if ((visibilityProp = "msHidden") in document) {
        document.addEventListener("msvisibilitychange", onVisibilityChange);
    } else if ("onfocusin" in document) {
        document.onfocusin = document.onfocusout = onVisibilityChange;
    } else {
        window.onpageshow = window.onpagehide =
        window.onfocus    = window.onblur = onVisibilityChange;
    }
})();

function ctlArcadeResume() {
    if (s_oMain !== null) s_oMain.startUpdate();
}

function ctlArcadePause() {
    if (s_oMain !== null) s_oMain.stopUpdate();
}


// ============================================================
// RESIZE & ORIENTATION
// ============================================================

$(window).resize(() => sizeHandler());
window.addEventListener("orientationchange", onOrientationChange);

function onOrientationChange() {
    if (window.matchMedia("(orientation: portrait)").matches) sizeHandler();
    if (window.matchMedia("(orientation: landscape)").matches) sizeHandler();
}

/** Kiểm tra orientation và ẩn/hiện thông báo xoay màn hình */
function _checkOrientation(width, height) {
    if (!s_bMobile || !ENABLE_CHECK_ORIENTATION) return;

    const msgContainer = $(".orientation-msg-container");
    const requiredOrientation = msgContainer.attr("data-orientation");
    const isLandscape = width > height;

    const correct = (isLandscape && requiredOrientation === "landscape")
                 || (!isLandscape && requiredOrientation === "portrait");

    if (correct) {
        msgContainer.css("display", "none");
        s_oMain.startUpdate();
    } else {
        msgContainer.css("display", "block");
        s_oMain.stopUpdate();
    }
}

/** Tính toán và áp dụng scale/offset để canvas fit màn hình */
function sizeHandler() {
    window.scrollTo(0, 1);
    if (!$("#canvas").length) return;

    // Chiều cao thực tế (iOS cần xử lý riêng)
    const isIosDevice = navigator.userAgent.match(/(iPad|iPhone|iPod)/g);
    const viewHeight  = isIosDevice ? getIOSWindowHeight() : getSize("Height");
    const viewWidth   = getSize("Width");

    _checkOrientation(viewWidth, viewHeight);

    let scale = Math.min(viewHeight / CANVAS_HEIGHT, viewWidth / CANVAS_WIDTH);
    let scaledW = CANVAS_WIDTH  * scale;
    let scaledH = CANVAS_HEIGHT * scale;

    // Căng full nếu có khoảng trống
    if (scaledH < viewHeight) {
        const diff = viewHeight - scaledH;
        scaledH += diff;
        scaledW += (CANVAS_WIDTH / CANVAS_HEIGHT) * diff;
    } else if (scaledW < viewWidth) {
        const diff = viewWidth - scaledW;
        scaledW += diff;
        scaledH += (CANVAS_HEIGHT / CANVAS_WIDTH) * diff;
    }

    let offsetTop  = viewHeight / 2 - scaledH / 2;
    let offsetLeft = viewWidth  / 2 - scaledW / 2;
    const ratio = CANVAS_WIDTH / scaledW;

    // Nếu canvas bị cắt quá nhiều, dùng scale an toàn hơn
    if (offsetLeft * ratio < -EDGEBOARD_X || offsetTop * ratio < -EDGEBOARD_Y) {
        scale    = Math.min(viewHeight / (CANVAS_HEIGHT - 2 * EDGEBOARD_Y),
                            viewWidth  / (CANVAS_WIDTH  - 2 * EDGEBOARD_X));
        scaledW  = CANVAS_WIDTH  * scale;
        scaledH  = CANVAS_HEIGHT * scale;
        offsetTop  = (viewHeight - scaledH) / 2;
        offsetLeft = (viewWidth  - scaledW) / 2;
    }

    s_iOffsetX = offsetLeft <= 0 ? -1 * offsetLeft * ratio : 0;
    s_iOffsetY = offsetTop  <= 0 ? -1 * offsetTop  * (CANVAS_WIDTH / scaledW) : 0;

    // Thông báo các panel cập nhật vị trí button
    if (s_oInterface  !== null) s_oInterface.refreshButtonPos(s_iOffsetX, s_iOffsetY);
    if (s_oMenu       !== null) s_oMenu.refreshButtonPos(s_iOffsetX, s_iOffsetY);
    if (s_oSelectTeam !== null) s_oSelectTeam.refreshButtonPos(s_iOffsetX, s_iOffsetY);

    // Áp dụng scale lên canvas
    if (s_bIsIphone) {
        const canvas = document.getElementById("canvas");
        s_oStage.canvas.width  = 2 * scaledW;
        s_oStage.canvas.height = 2 * scaledH;
        canvas.style.width  = scaledW + "px";
        canvas.style.height = scaledH + "px";
        s_iScaleFactor = 2 * Math.min(scaledW / CANVAS_WIDTH, scaledH / CANVAS_HEIGHT);
        s_oStage.scaleX = s_oStage.scaleY = s_iScaleFactor;
    } else if (s_bMobile && !isIOS()) {
        $("#canvas").css({ width: scaledW + "px", height: scaledH + "px" });
    } else {
        s_oStage.canvas.width  = scaledW;
        s_oStage.canvas.height = scaledH;
        s_iScaleFactor = Math.min(scaledW / CANVAS_WIDTH, scaledH / CANVAS_HEIGHT);
        s_oStage.scaleX = s_oStage.scaleY = s_iScaleFactor;
    }

    $("#canvas").css({
        top:  offsetTop  < 0 ? offsetTop  + "px" : "0px",
        left: offsetLeft + "px",
    });
}


// ============================================================
// SPRITE LIBRARY — quản lý tải và lưu trữ sprites
// ============================================================

function CSpriteLibrary() {
    let sprites = {};       // { key: { szPath, oSprite } }
    let totalCount  = 0;    // tổng số sprite cần tải
    let loadedCount = 0;    // số sprite đã tải xong

    let onEachLoaded;       // callback khi mỗi sprite tải xong
    let onAllLoaded;        // callback khi tất cả tải xong
    let context;            // this context cho callbacks

    this.init = function (eachCallback, allCallback, ctx) {
        loadedCount = totalCount = 0;
        onEachLoaded = eachCallback;
        onAllLoaded  = allCallback;
        context = ctx;
        sprites = {};
    };

    this.addSprite = function (key, path) {
        if (!sprites.hasOwnProperty(key)) {
            sprites[key] = { szPath: path, oSprite: new Image() };
            totalCount++;
        }
    };

    this.getSprite = function (key) {
        return sprites.hasOwnProperty(key) ? sprites[key].oSprite : null;
    };

    this._onSpriteLoaded = function () {
        onEachLoaded.call(context);
        loadedCount++;
        if (loadedCount === totalCount) {
            onAllLoaded.call(context);
        }
    };

    this.loadSprites = function () {
        const self = this;
        for (const key in sprites) {
            sprites[key].oSprite.oSpriteLibrary = self;
            sprites[key].oSprite.onload = function () {
                this.oSpriteLibrary._onSpriteLoaded();
            };
            sprites[key].oSprite.src = sprites[key].szPath;
        }
    };

    this.getNumSprites = function () {
        return totalCount;
    };
}


// ============================================================
// VECTOR 2D
// ============================================================

function CVector2(x, y) {
    let _x = x;
    let _y = y;

    this._init = function (x, y) { _x = x; _y = y; };

    this.add       = (dx, dy) => { _x += dx; _y += dy; };
    this.addV      = (v)      => { _x += v.getX(); _y += v.getY(); };
    this.subV      = (v)      => { _x -= v.getX(); _y -= v.getY(); };
    this.scalarProduct  = (s) => { _x *= s; _y *= s; };
    this.scalarDivision = (s) => { _x /= s; _y /= s; };
    this.invert    = ()       => { _x *= -1; _y *= -1; };
    this.dotProduct = (v)    => _x * v.getX() + _y * v.getY();

    this.set  = (x, y) => { _x = x; _y = y; };
    this.setV = (v)    => { _x = v.getX(); _y = v.getY(); };

    this.length  = ()  => Math.sqrt(_x * _x + _y * _y);
    this.length2 = ()  => _x * _x + _y * _y;

    this.normalize = function () {
        const len = this.length();
        if (len > 0) { _x /= len; _y /= len; }
    };

    this.getNormalize = function (out) {
        out.set(_x, _y);
        out.normalize();
    };

    this.rot90CCW = function () { const tmp = _x; _x = -_y; _y = tmp; };
    this.rot90CW  = function () { const tmp = _x; _x = _y;  _y = -tmp; };

    this.getRotCCW = function (out) { out.set(_x, _y); out.rot90CCW(); };
    this.getRotCW  = function (out) { out.set(_x, _y); out.rot90CW();  };

    this.ceil  = () => { _x = Math.ceil(_x);  _y = Math.ceil(_y); };
    this.round = () => { _x = Math.round(_x); _y = Math.round(_y); };

    this.toString = () => `Vector2: ${_x}, ${_y}`;
    this.print    = () => trace(`Vector2: ${_x}, ${_y}`);

    this.getX = () => _x;
    this.getY = () => _y;

    this._init(x, y);
}


// ============================================================
// PRELOADER — màn hình tải ban đầu
// ============================================================

function CPreloader() {
    let progressBarImage, progressBarWidth, progressBarHeight;
    let progressBarBitmap, progressMask, progressText;
    let fadeOverlay;
    let container;

    this._init = function () {
        s_oSpriteLibrary.init(this._onImagesLoaded, this._onAllImagesLoaded, this);
        s_oSpriteLibrary.addSprite("bg_menu",       "./sprites/bg_menu.jpg");
        s_oSpriteLibrary.addSprite("progress_bar",  "./sprites/progress_bar.png");
        s_oSpriteLibrary.loadSprites();

        container = new createjs.Container();
        s_oStage.addChild(container);
    };

    this.unload = function () {
        container.removeAllChildren();
    };

    this.hide = function () {
        const self = this;
        setTimeout(function () {
            createjs.Tween.get(fadeOverlay)
                .to({ alpha: 1 }, 500)
                .call(function () {
                    self.unload();
                    s_oMain.gotoMenu();
                });
        }, 1000);
    };

    this._onImagesLoaded    = function () {};
    this._onAllImagesLoaded = function () {
        this.attachSprites();
        s_oMain.preloaderReady();
    };

    this.attachSprites = function () {
        const bg = createBitmap(s_oSpriteLibrary.getSprite("bg_menu"));
        container.addChild(bg);

        progressBarImage  = s_oSpriteLibrary.getSprite("progress_bar");
        progressBarBitmap = createBitmap(progressBarImage);
        progressBarBitmap.x = CANVAS_WIDTH  / 2 - progressBarImage.width  / 2;
        progressBarBitmap.y = CANVAS_HEIGHT - 145;
        container.addChild(progressBarBitmap);

        progressBarWidth  = progressBarImage.width;
        progressBarHeight = progressBarImage.height;

        progressMask = new createjs.Shape();
        progressMask.graphics.beginFill("rgba(255,255,255,0.01)")
            .drawRect(progressBarBitmap.x, progressBarBitmap.y, 1, progressBarHeight);
        container.addChild(progressMask);
        progressBarBitmap.mask = progressMask;

        progressText = new createjs.Text("", "30px " + FONT_GAME, "#fff");
        progressText.x = CANVAS_WIDTH / 2;
        progressText.y = CANVAS_HEIGHT - 150;
        progressText.shadow        = new createjs.Shadow("#000", 2, 2, 2);
        progressText.textBaseline  = "alphabetic";
        progressText.textAlign     = "center";
        container.addChild(progressText);

        fadeOverlay = new createjs.Shape();
        fadeOverlay.graphics.beginFill("black").drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        fadeOverlay.alpha = 0;
        container.addChild(fadeOverlay);
    };

    this.refreshLoader = function (percent) {
        progressText.text = percent + "%";
        progressMask.graphics.clear();
        const fillWidth = Math.floor(percent * progressBarWidth / 100);
        progressMask.graphics
            .beginFill("rgba(255,255,255,0.01)")
            .drawRect(progressBarBitmap.x, progressBarBitmap.y, fillWidth, progressBarHeight);
    };

    this._init();
}


// ============================================================
// MAIN — khởi tạo và điều phối game
// ============================================================

function CMain(config) {
    let isRunning = false;
    let resourcesLoaded = 0;
    let resourcesTotal  = 0;
    let currentState    = STATE_LOADING;
    let gameConfig      = config;
    let preloader, currentGame;

    this.initContainer = function () {
        s_oCanvas = document.getElementById("canvas");
        s_oStage  = new createjs.Stage(s_oCanvas);
        s_oStage.preventSelection = false;

        createjs.Touch.enable(s_oStage);

        s_bMobile = jQuery.browser.mobile;

        if (!s_bMobile) {
            s_oStage.enableMouseOver(20);
            $("body").on("contextmenu", "#canvas", e => false);
        }

        s_iPrevTime = new Date().getTime();
        createjs.Ticker.addEventListener("tick", this._update);
        createjs.Ticker.setFPS(30);

        if (navigator.userAgent.match(/Windows Phone/i)) {
            DISABLE_SOUND_MOBILE = true;
        }

        s_oSpriteLibrary = new CSpriteLibrary();
        preloader = new CPreloader();

        // Đăng nhập và lấy điểm cao nhất ngay khi khởi động
        API.login().then(async () => {
            const highScore = API.getHighScore();
            console.log("highScore", highScore);
        });
    };

    this.preloaderReady = function () {
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
            this._initSounds();
        }
        this._loadImages();
        isRunning = true;
    };

    this.soundLoaded = function () {
        resourcesLoaded++;
        preloader.refreshLoader(Math.floor(resourcesLoaded / resourcesTotal * 100));
        if (resourcesLoaded === resourcesTotal) {
            this._onAllResourcesLoaded();
        }
    };

    this._initSounds = function () {
        if (!createjs.Sound.initializeDefaultPlugins()) return;

        const isOpera = navigator.userAgent.indexOf("Opera") > -1
                     || navigator.userAgent.indexOf("OPR")   > -1;

        // Opera dùng MP3 trước, các trình duyệt khác dùng OGG trước
        if (isOpera) {
            createjs.Sound.alternateExtensions = ["mp3"];
        } else {
            createjs.Sound.alternateExtensions = ["ogg"];
        }

        createjs.Sound.addEventListener("fileload", createjs.proxy(this.soundLoaded, this));

        const ext = isOpera ? "ogg" : "mp3";
        const sounds = [
            "soundtrack", "press_but", "applause", "crowd", "goal",
            "keeper_save", "kick", "miss_goal", "select_team", "game_over", "stop_indicator"
        ];
        sounds.forEach(name => {
            createjs.Sound.registerSound(`./sounds/${name}.${ext}`, name === "press_but" ? "click" : name);
        });

        resourcesTotal += sounds.length;
    };

    this._loadImages = function () {
        s_oSpriteLibrary.init(this._onImagesLoaded, this._onAllImagesLoaded, this);

        // UI & Backgrounds
        const sprites = [
            ["but_play",            "./sprites/but_play.png"],
            ["msg_box",             "./sprites/msg_box.png"],
            ["but_restart",         "./sprites/but_restart.png"],
            ["bg_menu",             "./sprites/bg_menu.jpg"],
            ["bg_game",             "./sprites/bg_game.jpg"],
            ["bg_select_team",      "./sprites/bg_select_team.jpg"],
            ["bg_next_level",       "./sprites/bg_next_level.jpg"],
            ["bg_win",              "./sprites/bg_win.jpg"],
            ["you_win",             "./sprites/you_win.png"],
            ["game_over",           "./sprites/game_over.png"],
            ["ball_kick_left",      "./sprites/ball_kick_left.png"],
            ["_oButNext",           "./sprites/arrow.png"],
            ["arrow_bar",           "./sprites/arrow_bar.png"],
            ["but_continue",        "./sprites/but_continue.png"],
            ["but_continue_small",  "./sprites/but_continue_small.png"],
            ["argentina",           "./sprites/flag_argentina.png"],
            ["brazil",              "./sprites/flag_brazil.png"],
            ["germany",             "./sprites/flag_germany.png"],
            ["england",             "./sprites/flag_england.png"],
            ["italy",               "./sprites/flag_italy.png"],
            ["france",              "./sprites/flag_france.png"],
            ["goal",                "./sprites/goal.png"],
            ["high_bar",            "./sprites/high_bar.png"],
            ["right_bar",           "./sprites/right_bar.png"],
            ["but_exit",            "./sprites/but_exit.png"],
            ["audio_icon",          "./sprites/audio_icon.png"],
            ["icon_goal",           "./sprites/icon_goal.png"],
            ["icon_kick",           "./sprites/icon_kick.png"],
            ["goal_text",           "./sprites/goal_text.png"],
            ["missed_text",         "./sprites/missed_text.png"],
            ["out_text",            "./sprites/out_text.png"],
            // Players
            ["argentina_idle",      "./sprites/players/argentina_idle.png"],
            ["brazil_idle",         "./sprites/players/brazil_idle.png"],
            ["germany_idle",        "./sprites/players/germany_idle.png"],
            ["england_idle",        "./sprites/players/england_idle.png"],
            ["italy_idle",          "./sprites/players/italy_idle.png"],
            ["france_idle",         "./sprites/players/france_idle.png"],
            ["argentina_shot",      "./sprites/players/argentina_shot.png"],
            ["brazil_shot",         "./sprites/players/brazil_shot.png"],
            ["germany_shot",        "./sprites/players/germany_shot.png"],
            ["england_shot",        "./sprites/players/england_shot.png"],
            ["italy_shot",          "./sprites/players/italy_shot.png"],
            ["france_shot",         "./sprites/players/france_shot.png"],
            // Goalkeeper
            ["goalkeeper_idle",         "./sprites/players/goalkeeper_idle.png"],
            ["goalkeeper_center",       "./sprites/players/goalkeeper_center.png"],
            ["goalkeeper_center_high",  "./sprites/players/goalkeeper_center_high.png"],
            ["goalkeeper_down_left",    "./sprites/players/goalkeeper_down_left.png"],
            ["goalkeeper_down_right",   "./sprites/players/goalkeeper_down_right.png"],
            ["goalkeeper_high_left",    "./sprites/players/goalkeeper_high_left.png"],
            ["goalkeeper_high_right",   "./sprites/players/goalkeeper_high_right.png"],
            ["goalkeeper_med_left",     "./sprites/players/goalkeeper_med_left.png"],
            ["goalkeeper_med_right",    "./sprites/players/goalkeeper_med_right.png"],
            // Wall & Ball
            ["wall_idle",    "./sprites/players/wall_idle.png"],
            ["wall_jump",    "./sprites/players/wall_jump.png"],
            ["ball",         "./sprites/ball.png"],
            // Misc
            ["but_fullscreen", "./sprites/but_fullscreen.png"],
            ["but_credits",    "./sprites/but_credits.png"],
            ["ctl_logo",       "./sprites/ctl_logo.png"],
            ["credits_bg",     "./sprites/credits_bg.jpg"],
        ];

        sprites.forEach(([key, path]) => s_oSpriteLibrary.addSprite(key, path));

        // Supporters (crowd)
        for (let i = 0; i < NUM_CROWD; i++) {
            s_oSpriteLibrary.addSprite(`supporters_${i}`, `./sprites/supporters/supporters_${i}.png`);
        }

        resourcesTotal += s_oSpriteLibrary.getNumSprites();
        s_oSpriteLibrary.loadSprites();
    };

    this._onImagesLoaded = function () {
        resourcesLoaded++;
        preloader.refreshLoader(Math.floor(resourcesLoaded / resourcesTotal * 100));
        if (resourcesLoaded === resourcesTotal) this._onAllResourcesLoaded();
    };

    this._onAllImagesLoaded = function () {};

    this._onAllResourcesLoaded = function () {
        preloader.unload();
        if (!isIOS()) {
            s_oSoundTrack = playSound("soundtrack", 1, -1);
        }
        this.gotoMenu();
    };

    this.gotoMenu = function () {
        new CMenu();
        currentState = STATE_MENU;
    };

    this.gotoSelectTeam = function () {
        new CSelectTeam();
        currentState = STATE_MENU;
    };

    this.gotoGame = function (teamSprite) {
        currentGame  = new CGame(gameConfig, teamSprite);
        currentState = STATE_GAME;
    };

    this.gotoHelp = function () {
        new CHelp();
        currentState = STATE_HELP;
    };

    this.stopUpdate = function () {
        isRunning = false;
        createjs.Ticker.paused = true;
        $("#block_game").css("display", "block");
        createjs.Sound.setMute(true);
    };

    this.startUpdate = function () {
        s_iPrevTime = new Date().getTime();
        isRunning   = true;
        createjs.Ticker.paused = false;
        $("#block_game").css("display", "none");
        if (s_bAudioActive) createjs.Sound.setMute(false);
    };

    this._update = function (event) {
        if (!isRunning) return;

        const now = new Date().getTime();
        s_iTimeElaps = now - s_iPrevTime;
        s_iCntTime  += s_iTimeElaps;
        s_iCntFps++;
        s_iPrevTime  = now;

        if (s_iCntTime >= 1000) {
            s_iCurFps  = s_iCntFps;
            s_iCntTime -= 1000;
            s_iCntFps   = 0;
        }

        if (currentState === STATE_GAME) currentGame.update();
        s_oStage.update(event);
    };

    // Áp dụng config
    ENABLE_FULLSCREEN         = config.fullscreen;
    ENABLE_CHECK_ORIENTATION  = config.check_orientation;

    s_oMain = this;
    this.initContainer();
}


// ============================================================
// TEXT BUTTON — nút có chữ
// ============================================================

function CTextButton(x, y, image, text, font, color, fontSize) {
    let listeners = [];
    let contexts  = [];
    let container, shadow, label;

    this._init = function (x, y, image, text, font, color, fontSize) {
        const outline = Math.ceil(fontSize / 20);

        shadow = new createjs.Text(text, fontSize + "px " + font, "#000000");
        shadow.textAlign    = "center";
        shadow.textBaseline = "alphabetic";
        const bounds = shadow.getBounds();
        shadow.x = image.width / 2 + outline;
        shadow.y = Math.floor(image.height / 2) + bounds.height / 3 + outline;

        label = new createjs.Text(text, fontSize + "px " + font, color);
        label.textAlign    = "center";
        label.textBaseline = "alphabetic";
        const labelBounds = label.getBounds();
        label.x = image.width  / 2;
        label.y = Math.floor(image.height / 2) + labelBounds.height / 3;

        container = new createjs.Container();
        container.x    = x;
        container.y    = y;
        container.regX = image.width  / 2;
        container.regY = image.height / 2;
        container.cursor = "pointer";
        container.addChild(createBitmap(image), shadow, label);
        s_oStage.addChild(container);

        this._initListener();
    };

    this._initListener = function () {
        container.on("mousedown", this.buttonDown);
        container.on("pressup",   this.buttonRelease);
    };

    this.unload = function () {
        container.off("mousedown");
        container.off("pressup");
        s_oStage.removeChild(container);
    };

    this.setVisible = function (visible) { container.visible = visible; };

    this.addEventListener = function (event, callback, ctx) {
        listeners[event] = callback;
        contexts[event]  = ctx;
    };

    this.buttonRelease = function () {
        container.scaleX = container.scaleY = 1;
        if (listeners[ON_MOUSE_UP]) listeners[ON_MOUSE_UP].call(contexts[ON_MOUSE_UP]);
    };

    this.buttonDown = function () {
        container.scaleX = container.scaleY = 0.9;
        if (listeners[ON_MOUSE_DOWN]) listeners[ON_MOUSE_DOWN].call(contexts[ON_MOUSE_DOWN]);
    };

    this.setTextPosition = function (y) { label.y = y; shadow.y = y + 2; };
    this.setPosition = function (x, y)  { container.x = x; container.y = y; };
    this.setX        = function (x)     { container.x = x; };
    this.setY        = function (y)     { container.y = y; };
    this.getButtonImage = function ()   { return container; };
    this.getX        = function ()      { return container.x; };
    this.getY        = function ()      { return container.y; };

    this._init(x, y, image, text, font, color, fontSize);
    return this;
}


// ============================================================
// TOGGLE BUTTON — nút bật/tắt (2 trạng thái)
// ============================================================

function CToggle(x, y, image, isActive, parent) {
    let sprite;
    let active = isActive;
    let listeners = [];
    let contexts  = [];
    let params    = [];
    let stage     = parent !== undefined ? parent : s_oStage;
    let downHandler, upHandler;

    this._init = function (x, y, image, isActive, parent) {
        const spriteSheet = new createjs.SpriteSheet({
            images: [image],
            frames: {
                width:  image.width  / 2,
                height: image.height,
                regX:   image.width  / 4,
                regY:   image.height / 2,
            },
            animations: {
                state_true:  [0],
                state_false: [1],
            }
        });

        sprite = createSprite(spriteSheet, "state_" + active,
            image.width / 4, image.height / 2, image.width / 2, image.height);
        sprite.x = x;
        sprite.y = y;
        sprite.stop();

        if (!s_bMobile) sprite.cursor = "pointer";

        stage.addChild(sprite);
        this._initListener();
    };

    this._initListener = function () {
        downHandler = sprite.on("mousedown", this.buttonDown);
        upHandler   = sprite.on("pressup",   this.buttonRelease);
    };

    this.unload = function () {
        sprite.off("mousedown", downHandler);
        sprite.off("pressup",   upHandler);
        stage.removeChild(sprite);
    };

    this.addEventListener = function (event, callback, ctx) {
        listeners[event] = callback;
        contexts[event]  = ctx;
    };

    this.addEventListenerWithParams = function (event, callback, ctx, extraParams) {
        listeners[event] = callback;
        contexts[event]  = ctx;
        params = extraParams;
    };

    this.setCursorType = function (type) { sprite.cursor = type; };

    this.setActive = function (state) {
        active = state;
        sprite.gotoAndStop("state_" + active);
    };

    this.buttonRelease = function () {
        sprite.scaleX = sprite.scaleY = 1;
        playSound("press_but", 1, 0);
        active = !active;
        sprite.gotoAndStop("state_" + active);
        if (listeners[ON_MOUSE_UP]) listeners[ON_MOUSE_UP].call(contexts[ON_MOUSE_UP], params);
    };

    this.buttonDown = function () {
        sprite.scaleX = sprite.scaleY = 0.9;
        if (listeners[ON_MOUSE_DOWN]) listeners[ON_MOUSE_DOWN].call(contexts[ON_MOUSE_DOWN]);
    };

    this.setPosition = function (x, y) { sprite.x = x; sprite.y = y; };

    this._init(x, y, image, isActive, parent);
}


// ============================================================
// GRAPHIC BUTTON — nút hình ảnh đơn giản
// ============================================================

function CGfxButton(x, y, image, parent) {
    let bitmap;
    let scale = 1;
    let listeners = [];
    let contexts  = [];
    let extraParams = [];
    const stage = parent || s_oStage;

    this._init = function (x, y, image) {
        bitmap = createBitmap(image);
        bitmap.x    = x;
        bitmap.y    = y;
        bitmap.regX = image.width  / 2;
        bitmap.regY = image.height / 2;
        bitmap.cursor = "pointer";
        stage.addChild(bitmap);
        this._initListener();
    };

    this._initListener = function () {
        bitmap.on("mousedown", this.buttonDown);
        bitmap.on("pressup",   this.buttonRelease);
    };

    this.unload = function () {
        bitmap.off("mousedown", this.buttonDown);
        bitmap.off("pressup",   this.buttonRelease);
        stage.removeChild(bitmap);
    };

    this.setVisible  = function (v) { bitmap.visible = v; };

    this.addEventListener = function (event, callback, ctx) {
        listeners[event] = callback;
        contexts[event]  = ctx;
    };

    this.addEventListenerWithParams = function (event, callback, ctx, params) {
        listeners[event] = callback;
        contexts[event]  = ctx;
        extraParams = params;
    };

    this.buttonRelease = function () {
        bitmap.scaleX = bitmap.scaleY = scale;
        if (listeners[ON_MOUSE_UP]) listeners[ON_MOUSE_UP].call(contexts[ON_MOUSE_UP], extraParams);
    };

    this.buttonDown = function () {
        bitmap.scaleX = bitmap.scaleY = 0.9 * scale;
        if (listeners[ON_MOUSE_DOWN]) listeners[ON_MOUSE_DOWN].call(contexts[ON_MOUSE_DOWN], extraParams);
    };

    this.setScale    = function (s) { scale = s; bitmap.scaleX = bitmap.scaleY = s; };
    this.setPosition = function (x, y) { bitmap.x = x; bitmap.y = y; };
    this.setX        = function (x) { bitmap.x = x; };
    this.setY        = function (y) { bitmap.y = y; };
    this.getButtonImage = function () { return bitmap; };
    this.getX        = function () { return bitmap.x; };
    this.getY        = function () { return bitmap.y; };

    this._init(x, y, image);
    return this;
}


// ============================================================
// MENU — màn hình chính
// ============================================================

function CMenu() {
    // Vị trí các nút
    let playBtnX, playBtnY, creditsBtnX, creditsBtnY;
    let audioBtnX, audioBtnY, fullscreenBtnX, fullscreenBtnY;

    let background, playButton, creditsButton, audioToggle, fullscreenToggle;
    let fadeOverlay;
    let requestFullscreen = null, exitFullscreen = null;
    let creditsPanel = null;

    this._init = function () {
        background = createBitmap(s_oSpriteLibrary.getSprite("bg_menu"));
        s_oStage.addChild(background);

        // Nút Play
        const playImg  = s_oSpriteLibrary.getSprite("but_play");
        playBtnX = CANVAS_WIDTH  / 2 + 300;
        playBtnY = CANVAS_HEIGHT - 110;
        playButton = new CGfxButton(playBtnX, playBtnY, playImg);
        playButton.addEventListener(ON_MOUSE_UP, this._onButPlayRelease, this);

        // Nút Credits
        const creditsImg = s_oSpriteLibrary.getSprite("but_credits");
        creditsBtnX = creditsImg.width  / 2 + 10;
        creditsBtnY = creditsImg.height / 2 + 10;
        creditsButton = new CGfxButton(creditsBtnX, creditsBtnY, creditsImg, s_oStage);
        creditsButton.addEventListener(ON_MOUSE_UP, this._onCreditsBut, this);

        // Nút Audio (nếu hỗ trợ)
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
            const audioImg = s_oSpriteLibrary.getSprite("audio_icon");
            audioBtnX = CANVAS_WIDTH - audioImg.height / 2 - 10;
            audioBtnY = audioImg.height / 2 + 10;
            audioToggle = new CToggle(audioBtnX, audioBtnY, audioImg, s_bAudioActive, s_oStage);
            audioToggle.addEventListener(ON_MOUSE_UP, this._onAudioToggle, this);
        }

        // Nút Fullscreen
        const docEl = window.document.documentElement;
        requestFullscreen = docEl.requestFullscreen || docEl.mozRequestFullScreen
                         || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen || false;
        exitFullscreen    = document.exitFullscreen || document.mozCancelFullScreen
                         || document.webkitExitFullscreen || document.msExitFullscreen;

        if (ENABLE_FULLSCREEN === false) requestFullscreen = false;

        if (requestFullscreen && !inIframe()) {
            const fsImg = s_oSpriteLibrary.getSprite("but_fullscreen");
            fullscreenBtnX = creditsBtnX + fsImg.width / 2 + 4;
            fullscreenBtnY = fsImg.height / 2 + 10;
            fullscreenToggle = new CToggle(fullscreenBtnX, fullscreenBtnY, fsImg, s_bFullscreen, s_oStage);
            fullscreenToggle.addEventListener(ON_MOUSE_UP, this._onFullscreenRelease, this);
        }

        // Fade-in overlay
        fadeOverlay = new createjs.Shape();
        fadeOverlay.graphics.beginFill("black").drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        s_oStage.addChild(fadeOverlay);
        createjs.Tween.get(fadeOverlay).to({ alpha: 0 }, 1000).call(() => {
            fadeOverlay.visible = false;
        });

        this.refreshButtonPos(s_iOffsetX, s_iOffsetY);
    };

    this.unload = function () {
        playButton.unload();
        playButton = null;
        creditsButton.unload();
        fadeOverlay.visible = false;

        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
            audioToggle.unload();
            audioToggle = null;
        }
        if (requestFullscreen && !inIframe()) fullscreenToggle.unload();

        s_oStage.removeChild(background);
        s_oMenu = background = null;
    };

    this.exitFromCredits = function () { creditsPanel = null; };

    this.refreshButtonPos = function (offsetX, offsetY) {
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
            audioToggle.setPosition(audioBtnX - offsetX, offsetY + audioBtnY);
        }
        playButton.setPosition(playBtnX, playBtnY - offsetY);
        creditsButton.setPosition(creditsBtnX + offsetX, offsetY + creditsBtnY);
        if (requestFullscreen && !inIframe()) {
            fullscreenToggle.setPosition(fullscreenBtnX + offsetX, fullscreenBtnY + offsetY);
        }
        if (creditsPanel !== null) creditsPanel.refreshButtonPos(offsetX, offsetY);
    };

    this._onAudioToggle = function () {
        createjs.Sound.setMute(s_bAudioActive);
        s_bAudioActive = !s_bAudioActive;
    };

    this._onCreditsBut = function () {
        creditsPanel = new CCreditsPanel();
    };

    this._onFullscreenRelease = function () {
        if (s_bFullscreen) {
            exitFullscreen.call(window.document);
            s_bFullscreen = false;
        } else {
            requestFullscreen.call(window.document.documentElement);
            s_bFullscreen = true;
        }
        sizeHandler();
    };

    this._onButPlayRelease = function () {
        $(s_oMain).trigger("start_session");
        this.unload();
        if (isIOS() && s_oSoundTrack === null) {
            s_oSoundTrack = playSound("soundtrack", 1, -1);
        } else {
            playSound("click", 1, 0);
        }
        s_oMain.gotoSelectTeam();
    };

    s_oMenu = this;
    this._init();
}


// ============================================================
// SELECT TEAM — màn hình chọn đội
// ============================================================

function CSelectTeam() {
    let continueBtnX, continueBtnY, exitBtnX, exitBtnY, audioBtnX, audioBtnY;
    let continueButton, exitButton, audioToggle, fullscreenToggle, fullscreenBtnX, fullscreenBtnY;

    let teamToggles = {};   // { argentina, brazil, germany, england, italy, france }
    let playerContainer, player;
    let teamNameText;
    let selectedTeamIndex = ARGENTINA;

    let requestFullscreen = null, exitFullscreen = null;

    this._init = function () {
        const bg = createBitmap(s_oSpriteLibrary.getSprite("bg_select_team"));
        s_oStage.addChild(bg);

        // Continue
        const continueImg = s_oSpriteLibrary.getSprite("but_continue");
        continueBtnX = CANVAS_WIDTH  / 2 + 300;
        continueBtnY = CANVAS_HEIGHT - 110;
        continueButton = new CGfxButton(continueBtnX, continueBtnY, continueImg, s_oStage);
        continueButton.addEventListener(ON_MOUSE_UP, this._onButNextRelease, this);

        // Exit
        const exitImg = s_oSpriteLibrary.getSprite("but_exit");
        exitBtnX = CANVAS_WIDTH  - exitImg.height / 2 - 10;
        exitBtnY = exitImg.height / 2 + 10;
        exitButton = new CGfxButton(exitBtnX, exitBtnY, exitImg, s_oStage);
        exitButton.addEventListener(ON_MOUSE_UP, this._onExit, this);

        // Audio
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
            const audioImg = s_oSpriteLibrary.getSprite("audio_icon");
            audioBtnX = exitBtnX - audioImg.width / 2 - 10;
            audioBtnY = audioImg.height / 2 + 10;
            audioToggle = new CToggle(audioBtnX, audioBtnY, audioImg, s_bAudioActive, s_oStage);
            audioToggle.addEventListener(ON_MOUSE_UP, this._onAudioToggle, this);
        }

        // Player preview
        playerContainer = new createjs.Container();
        s_oStage.addChild(playerContainer);
        player = new CPlayer(playerContainer);
        player.showIdle(PLAYER_X_POSITION_IN_SELECTION, PLAYER_Y_POSITION_IN_SELECTION, s_szTeamSelectedSprite);

        // Flag toggles
        const teamDefs = [
            { key: "argentina", img: "argentina", index: ARGENTINA, x: CANVAS_WIDTH/2 - 150, y: CANVAS_HEIGHT/2 - 125, defaultActive: false },
            { key: "brazil",    img: "brazil",    index: BRAZIL,    x: CANVAS_WIDTH/2 + 120, y: CANVAS_HEIGHT/2 - 125, defaultActive: true  },
            { key: "germany",   img: "germany",   index: GERMANY,   x: CANVAS_WIDTH/2 - 210, y: CANVAS_HEIGHT/2,       defaultActive: true  },
            { key: "england",   img: "england",   index: ENGLAND,   x: CANVAS_WIDTH/2 + 180, y: CANVAS_HEIGHT/2,       defaultActive: true  },
            { key: "italy",     img: "italy",     index: ITALY,     x: CANVAS_WIDTH/2 - 175, y: CANVAS_HEIGHT/2 + 125, defaultActive: true  },
            { key: "france",    img: "france",    index: FRANCE,    x: CANVAS_WIDTH/2 + 150, y: CANVAS_HEIGHT/2 + 125, defaultActive: true  },
        ];
        teamDefs.forEach(def => {
            const toggle = new CToggle(def.x, def.y, s_oSpriteLibrary.getSprite(def.img), def.defaultActive, s_oStage);
            toggle.addEventListenerWithParams(ON_MOUSE_UP, this._onModeToggle, this, def.index);
            teamToggles[def.key] = toggle;
        });

        // Team name display
        teamNameText = new createjs.Text(TEXT_TEAM_0, " 25px " + FONT_GAME, "#080863");
        teamNameText.x = CANVAS_WIDTH / 2 - 10;
        teamNameText.y = CANVAS_HEIGHT / 2 + 150;
        teamNameText.textAlign    = "center";
        teamNameText.textBaseline = "alphabetic";
        s_oStage.addChild(teamNameText);

        // Fullscreen
        const docEl = window.document.documentElement;
        requestFullscreen = docEl.requestFullscreen || docEl.mozRequestFullScreen
                         || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen || false;
        exitFullscreen    = document.exitFullscreen || document.mozCancelFullScreen
                         || document.webkitExitFullscreen || document.msExitFullscreen;
        if (ENABLE_FULLSCREEN === false) requestFullscreen = false;

        if (requestFullscreen && !inIframe()) {
            const fsImg = s_oSpriteLibrary.getSprite("but_fullscreen");
            fullscreenBtnX = fsImg.width / 4 + 4;
            fullscreenBtnY = fsImg.height / 2 + 10;
            fullscreenToggle = new CToggle(fullscreenBtnX, fullscreenBtnY, fsImg, s_bFullscreen, s_oStage);
            fullscreenToggle.addEventListener(ON_MOUSE_UP, this._onFullscreenRelease, this);
        }

        this.refreshButtonPos(s_iOffsetX, s_iOffsetY);
    };

    // Đội được chọn → cập nhật toggle, tên, preview nhân vật
    this._onModeToggle = function (teamIndex) {
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
            createjs.Sound.play("select_team");
        }

        const teamMap = [
            { key: "argentina", name: TEXT_TEAM_0 },
            { key: "brazil",    name: TEXT_TEAM_1 },
            { key: "germany",   name: TEXT_TEAM_2 },
            { key: "england",   name: TEXT_TEAM_3 },
            { key: "italy",     name: TEXT_TEAM_4 },
            { key: "france",    name: TEXT_TEAM_5 },
        ];

        // Bật tất cả, tắt cái được chọn
        Object.keys(teamToggles).forEach(key => {
            teamToggles[key].setActive(key !== teamMap[teamIndex].key);
        });

        selectedTeamIndex = teamIndex;
        teamNameText.text = teamMap[teamIndex].name;
        player.unload();
        player.showIdle(PLAYER_X_POSITION_IN_SELECTION, PLAYER_Y_POSITION_IN_SELECTION, teamMap[teamIndex].key);
        s_iTeamSelected = teamIndex;
    };

    this._onExit = function () { s_oMain.gotoMenu(); };

    this.unload = function () {
        Object.values(teamToggles).forEach(t => t.unload());
        player.unload();
        if (requestFullscreen && !inIframe()) fullscreenToggle.unload();
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) { audioToggle.unload(); audioToggle = null; }
        s_oSelectTeam = null;
        s_oStage.removeAllChildren();
    };

    this.refreshButtonPos = function (offsetX, offsetY) {
        exitButton.setPosition(exitBtnX - offsetX, offsetY + exitBtnY);
        continueButton.setPosition(continueBtnX, continueBtnY - offsetY);
        if (requestFullscreen && !inIframe()) fullscreenToggle.setPosition(fullscreenBtnX + offsetX, fullscreenBtnY + offsetY);
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) audioToggle.setPosition(audioBtnX - offsetX, offsetY + audioBtnY);
    };

    this._onButNextRelease = function () {
        this.unload();
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) createjs.Sound.play("click");

        const teamKeys = ["argentina", "brazil", "germany", "england", "italy", "france"];
        s_oMain.gotoGame(teamKeys[selectedTeamIndex]);
    };

    this._onAudioToggle = function () {
        createjs.Sound.setMute(s_bAudioActive);
        s_bAudioActive = !s_bAudioActive;
    };

    this._onFullscreenRelease = function () {
        if (s_bFullscreen) { exitFullscreen.call(window.document); s_bFullscreen = false; }
        else               { requestFullscreen.call(window.document.documentElement); s_bFullscreen = true; }
        sizeHandler();
    };

    s_oSelectTeam = this;
    this._init();
}


// ============================================================
// GAME — logic chính
// ============================================================

function CGame(config, teamSprite) {
    let score         = 0;
    let bonus         = 1000;   // điểm bonus hiện tại
    let goalsScored   = 0;
    let goalsRequired = 0;
    let kicksLeft     = 0;
    let ballTargetX   = -1;
    let ballTargetY   = -1;
    let keeperAction  = -1;     // hành động thủ môn
    let levelIndex    = 0;      // level hiện tại (0-based)
    let kickIndex     = ROUND;
    let firstTime     = FIRST_TIME;

    let isAnimatingPlayer = false;
    let isShooting        = false;
    let isReadyToKick     = false;
    let ballHitWall       = false;
    let isCrowdActive     = false;
    let isUpdating        = false;

    let keeperTargetAction;     // hành động thủ môn được chọn
    let keeperActionInfo;       // thông tin action object
    let endPanel = null;
    let expectedKeeperAction;   // hành động dự đoán của thủ môn

    let keeperX = GOALKEEPER_X_POSITION;
    let keeperY = GOALKEEPER_Y_POSITION;
    let animFrameCount;

    let playerShootX, playerShootY;
    let isPlayerAnimationDone = false;
    let walls = [];

    let stageContainer;
    let levelManager, gameInterface;
    let goalObject, goalKeeperObject, playerObject, ballObject;
    let goalContainer, keeperContainer, wallContainer, ballContainer, playerContainer;
    let kickTargetPoints = [];
    let crowd;

    const totalTimeStart = Date.now();

    this._init = function () {
        trace("_iFirstTime: " + firstTime);

        if (firstTime === 0 && (DISABLE_SOUND_MOBILE === false || s_bMobile === false)) {
            s_oSoundTrack.volume = 0;
            s_oCrowd = playSound("crowd", 1, -1);
            trace("s_oCrowd: " + s_oCrowd);
        }

        bonus = 1000;
        ballTargetX = ballTargetY = -1;
        ballHitWall = isShooting = isReadyToKick = false;

        const bgGame = createBitmap(s_oSpriteLibrary.getSprite("bg_game"));
        s_oStage.addChild(bgGame);

        crowd = new CCrowd();

        if (kickIndex === 0) {
            this._initLevel();
        } else {
            gameInterface = new CInterface(levelIndex);
            this.createViewThings();
        }

        this._initKickPoints();
        console.log("start time", totalTimeStart);
    };

    this._initLevel = function () {
        goalsScored = goalsRequired = kicksLeft = 0;
        ballTargetX = ballTargetY = -1;
        isShooting = isAnimatingPlayer = isReadyToKick = false;

        stageContainer = new createjs.Container();
        s_oStage.addChild(stageContainer);

        console.log("initlevel — levelIndex:", levelIndex, "kickIndex:", kickIndex);

        levelManager = new CLevel(levelIndex, kicksLeft, stageContainer);
        if (levelIndex === 0) this.setLevelInfo();
        console.log("initlevel done");
    };

    this.setLevelInfo = function () {
        $(s_oMain).trigger("start_level", levelIndex);
        const info = levelManager.getLevelInfo(levelIndex);
        kicksLeft     = 0;
        goalsRequired = info.goalToScore;
        kicksLeft     = info.kickLeft;
        gameInterface = new CInterface(levelIndex);
        this.createViewThings();
    };

    this.createViewThings = function () {
        const ballPos   = levelManager.getBallPosition(levelIndex, kickIndex);
        const playerPos = levelManager.getPlayerPosition(levelIndex, kickIndex);
        const wallData  = levelManager.getWallPosition(levelIndex, kickIndex);

        // Goal
        goalContainer = new createjs.Container();
        s_oStage.addChild(goalContainer);
        new CGoal(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20, goalContainer);

        // Goalkeeper
        keeperContainer = new createjs.Container();
        s_oStage.addChild(keeperContainer);
        goalKeeperObject = new CGoalKeeper(keeperContainer);
        goalKeeperObject.showIdle(keeperX, keeperY);

        // Walls
        wallContainer = new createjs.Container();
        s_oStage.addChild(wallContainer);
        if (wallData.num > 0) {
            for (let i = 0; i < wallData.num; i++) {
                walls[i] = new CWall(wallData.x, wallData.y, wallContainer, i);
                walls[i].showIdle(i);
            }
        }

        // Ball
        ballContainer = new createjs.Container();
        s_oStage.addChild(ballContainer);
        ballObject = new CBall(ballPos.x, ballPos.y, ballContainer);

        // Player
        playerContainer = new createjs.Container();
        s_oStage.addChild(playerContainer);
        playerObject = new CPlayer(playerContainer);
        playerObject.showIdle(playerPos.x, playerPos.y, teamSprite);

        if (levelManager.getPlayerPosIndex(levelIndex, kickIndex) === 1) {
            playerObject.changeAlpha();
        }

        // HUD
        gameInterface.viewScore(score);
        gameInterface.viewGoalScored(goalsScored, goalsRequired);
        gameInterface.viewKickLeft(kicksLeft);
        gameInterface.viewScoreBonus(bonus, 1);
        gameInterface.refreshButtonPos(s_iOffsetX, s_iOffsetY);

        if (firstTime === 0) {
            gameInterface.help();
            firstTime = 1;
        } else {
            isReadyToKick = true;
        }
    };

    /** Xác định hướng bóng & hành động thủ môn dựa trên ô được chọn */
    this.animatePlayer = function (colIndex, rowIndex) {
        playerShootX = kickTargetPoints[colIndex][rowIndex].x;
        playerShootY = kickTargetPoints[colIndex][rowIndex].y;
        isAnimatingPlayer = true;

        // Cột → hành động thủ môn tương ứng
        const keeperActionMap = {
            0: () => { keeperAction = OUT; },
            1: () => { keeperAction = OUT; },
            7: () => { keeperAction = OUT; },
            8: () => { keeperAction = OUT; },
            2: () => {
                ballTargetX = LOW_PERCENT;
                if (rowIndex === 0) keeperAction = OUT;
                else if (rowIndex === 1) keeperAction = HIGH_LEFT;
                else if (rowIndex === 2) keeperAction = MED_LEFT;
                else if (rowIndex === 3) keeperAction = DOWN_LEFT;
            },
            3: () => {
                ballTargetX = MED_PERCENT;
                if (rowIndex === 0) keeperAction = OUT;
                else if (rowIndex === 1) keeperAction = HIGH_LEFT;
                else if (rowIndex === 2) keeperAction = MED_LEFT;
                else if (rowIndex === 3) keeperAction = DOWN_LEFT;
            },
            4: () => {
                ballTargetX = HIGH_PERCENT;
                if (rowIndex === 0) keeperAction = OUT;
                else if (rowIndex === 1 || rowIndex === 2) keeperAction = CENTER_HIGH;
                else if (rowIndex === 3) keeperAction = CENTER;
            },
            5: () => {
                ballTargetX = MED_PERCENT;
                if (rowIndex === 0) keeperAction = OUT;
                else if (rowIndex === 1) keeperAction = HIGH_RIGHT;
                else if (rowIndex === 2) keeperAction = MED_RIGHT;
                else if (rowIndex === 3) keeperAction = DOWN_RIGHT;
            },
            6: () => {
                ballTargetX = LOW_PERCENT;
                if (rowIndex === 0) keeperAction = OUT;
                else if (rowIndex === 1) keeperAction = HIGH_RIGHT;
                else if (rowIndex === 2) keeperAction = MED_RIGHT;
                else if (rowIndex === 3) keeperAction = DOWN_RIGHT;
            },
        };

        const handler = keeperActionMap[colIndex];
        if (handler) handler();

        const playerPos = levelManager.getPlayerPosition(levelIndex, kickIndex);
        playerObject.showShot(playerPos.x, playerPos.y, teamSprite);
    };

    this.kickBall = function () {
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
            createjs.Sound.play("kick");
        }
        ballObject.ballKicked(playerShootX, playerShootY);
    };

    this.showMessage = function (missed) {
        isAnimatingPlayer = false;
        const playerPos = levelManager.getPlayerPosition(levelIndex, kickIndex);
        playerObject.showIdle(playerPos.x, playerPos.y, teamSprite);

        const self = this;

        // Tạo hàm hiển thị text popup
        function showPopup(spriteKey, regX, regY, onDone) {
            const popup = createBitmap(s_oSpriteLibrary.getSprite(spriteKey));
            popup.scaleX = popup.scaleY = popup.alpha = 0;
            popup.x = CANVAS_WIDTH  / 2;
            popup.y = CANVAS_HEIGHT / 2;
            popup.regX = regX;
            popup.regY = regY;
            s_oStage.addChild(popup);
            createjs.Tween.get(popup)
                .to({ alpha: 1, scaleX: 1, scaleY: 1 }, 500)
                .wait(800)
                .call(onDone);
        }

        const wallData = levelManager.getWallPosition(levelIndex, kickIndex);

        if (missed || ballHitWall) {
            showPopup("missed_text", 206.5, 37, () => self.controlIfCanContinue());
        } else if (keeperAction === OUT) {
            showPopup("out_text", 130.5, 35, () => self.controlIfCanContinue());
            if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) createjs.Sound.play("miss_goal");
            ballObject.fadeOut();
        } else if (keeperTargetAction !== keeperAction && keeperAction !== OUT) {
            // GOAL!
            showPopup("goal_text", 399, 38, () => self.controlIfCanContinue());
            if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) createjs.Sound.play("goal");
            ballObject.fadeOut();
            goalsScored++;
            score += bonus;
            isCrowdActive = true;
        }
    };

    this.controlWall = function () {
        const ballX = ballObject.returnX();
        const ballY = ballObject.returnY();
        const wallData = levelManager.getWallPosition(levelIndex, kickIndex);

        if (wallData.num > 0 && walls[0].controlIfHitted(ballX, ballY, wallData.num)) {
            const playerPos = levelManager.getPlayerPosition(levelIndex, kickIndex);
            ballObject.bounce(playerPos.x, 0);
            if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
                createjs.Sound.play("keeper_save");
                createjs.Sound.play("miss_goal");
            }
        }
    };

    this.goalKeeperBounce = function () {
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
            createjs.Sound.play("keeper_save");
            createjs.Sound.play("miss_goal");
        }
        const playerPos = levelManager.getPlayerPosition(levelIndex, kickIndex);
        ballObject.bounce(playerPos.x, 1);
    };

    this.controlIfCanContinue = function () {
        const wallData = levelManager.getWallPosition(levelIndex, kickIndex);

        if (goalsScored >= goalsRequired && kicksLeft <= 1) {
            // Qua level
            levelIndex++;
            kickIndex = 0;
            if (levelIndex === NUM_LEVEL) {
                // Thắng game
                bonus = kickIndex = 0;
                endPanel = new CEndPanel(
                    s_oSpriteLibrary.getSprite("bg_win"),
                    s_oSpriteLibrary.getSprite("you_win")
                );
                endPanel.win(score);
            } else {
                this.unload();
                this._init();
            }
        } else if (kicksLeft <= 1) {
            this.gameOver();
        }

        if (kicksLeft > 1) {
            kicksLeft--;
            kickIndex++;
            this.unload();
            this._init();
        }
    };

    /** Khởi tạo lưới các điểm mục tiêu cú sút */
    this._initKickPoints = function () {
        kickTargetPoints = [];
        for (let col = 0; col < RANGE_WIDTH; col++) {
            kickTargetPoints[col] = [];
            for (let row = 0; row < RANGE_HEIGHT; row++) {
                const x = Math.round((MATRIX_X_END - MATRIX_X_START) / RANGE_WIDTH  * col + MATRIX_X_START) + 5;
                const y = Math.round((MATRIX_Y_END - MATRIX_Y_START) / RANGE_HEIGHT * row + MATRIX_Y_START) + 5;
                kickTargetPoints[col][row] = { x, y };
            }
        }
    };

    this.unload = function () {
        gameInterface.unload();
        createjs.Tween.removeAllTweens();
        s_oStage.removeAllChildren();
    };

    this.onExit = function () {
        $(s_oMain).trigger("end_level",         levelIndex);
        $(s_oMain).trigger("show_interlevel_ad");
        $(s_oMain).trigger("end_session");
        this.unload();
        s_oMain.gotoMenu();
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
            s_oCrowd.stop();
            s_oSoundTrack.volume = 1;
        }
        $(s_oMain).trigger("restart");
    };

    this.gameOver = function () {
        const totalTime = Math.round((Date.now() - totalTimeStart) / 1000);
        bonus = kickIndex = 0;
        endPanel = new CEndPanel(
            s_oSpriteLibrary.getSprite("bg_next_level"),
            s_oSpriteLibrary.getSprite("game_over"),
            totalTime
        );
        endPanel.show(score);
    };

    this.setUpdate    = function () { isReadyToKick = !isReadyToKick; };
    this.setCrowdOff  = function () { isCrowdActive = false; };

    /** Vòng lặp update mỗi frame */
    this.update = function () {
        if (!isReadyToKick) return;

        const wallData = levelManager.getWallPosition(levelIndex, kickIndex);

        // Khi nhân vật hoàn thành animation sút (frame 4)
        if (isAnimatingPlayer) {
            animFrameCount = playerObject.getFrame();
            if (animFrameCount === 4 && !isShooting) {

                // Thủ môn có % bắt được bóng không?
                if (Math.floor(Math.random() * 100) <= ballTargetX && keeperAction > 0 && ballTargetX > 0) {
                    keeperTargetAction = keeperAction;
                    ballHitWall = true;
                } else {
                    // Chọn ngẫu nhiên hành động khác với hành động bóng bay tới
                    do {
                        keeperTargetAction = Math.floor(Math.random() * NUM_SAVE);
                    } while (keeperTargetAction === keeperAction);
                }

                const actionInfoMap = {
                    [CENTER]:      CENTER_INFO,
                    [CENTER_HIGH]: CENTER_HIGH_INFO,
                    [DOWN_LEFT]:   DOWN_LEFT_INFO,
                    [DOWN_RIGHT]:  DOWN_RIGHT_INFO,
                    [HIGH_LEFT]:   HIGH_LEFT_INFO,
                    [HIGH_RIGHT]:  HIGH_RIGHT_INFO,
                    [MED_LEFT]:    MED_LEFT_INFO,
                    [MED_RIGHT]:   MED_RIGHT_INFO,
                };
                keeperActionInfo = actionInfoMap[keeperTargetAction];

                goalKeeperObject.showAction(
                    keeperActionInfo.x, keeperActionInfo.y, keeperActionInfo.action,
                    keeperActionInfo.frames, keeperActionInfo.width, keeperActionInfo.height
                );

                if (wallData.num > 0) {
                    for (let i = 0; i < wallData.num; i++) walls[i].showJump(i);
                    ballHitWall = true;
                }

                this.kickBall();
                isPlayerAnimationDone = isShooting = true;
            }
        }

        // Dừng animation thủ môn sau khi xong
        if (isPlayerAnimationDone && goalKeeperObject.getFrame() === keeperActionInfo.frames) {
            goalKeeperObject.stop();
            isPlayerAnimationDone = false;
        }

        // Giảm bonus mỗi frame
        if (bonus >= 4) {
            bonus -= 3;
            gameInterface.viewScoreBonus(bonus, 0);
        }

        if (isCrowdActive) crowd.showAnim();

        // Reset wall animation
        if (wallData.num > 0 && ballHitWall && walls[0].getFrame() === walls[0].frames) {
            for (let i = 0; i < wallData.num; i++) walls[i].showIdle();
            ballHitWall = false;
        }

        ballObject.update(wallData.num, ballHitWall);
    };

    SHOT_INDICATOR_SPEED          = config.shot_indicator_spd;
    DECREASE_SHOT_INDICATOR_SPEED = config.decrease_shot_indicator_spd;
    s_oGame = this;
    this._init();
}


// ============================================================
// INTERFACE — HUD trong game
// ============================================================

function CInterface(levelIndex) {
    // Vị trí các phần tử HUD
    const BONUS_TEXT_X    = CANVAS_WIDTH / 2 - 350;
    const SCORE_TEXT_X    = CANVAS_WIDTH / 2 - 300;
    const SCORE_TEXT_Y    = CANVAS_HEIGHT - 20;
    const KICK_ICON_X     = CANVAS_WIDTH / 2 + 180;
    const KICK_ICON_Y     = CANVAS_HEIGHT - 45;
    const GOALS_X         = CANVAS_WIDTH / 2 - 10;
    const GOALS_Y         = CANVAS_HEIGHT - 20;
    const GOAL_ICON_X     = CANVAS_WIDTH / 2 - 80;
    const GOAL_ICON_Y     = CANVAS_HEIGHT - 50;
    const KICK_BALLS_X    = CANVAS_WIDTH / 2 + 100;
    const KICK_BALLS_Y    = CANVAS_HEIGHT - 50;

    let exitBtnX, exitBtnY, audioBtnX, audioBtnY, fullscreenBtnX, fullscreenBtnY;
    let exitButton, audioToggle, fullscreenToggle;
    let requestFullscreen = null, exitFullscreen = null;

    let kickContainer;
    let horizontalIndicator, verticalIndicator;

    let bonusShadow, bonusText;
    let scoreShadow, scoreText;
    let goalsShadow, goalsText;
    let goalCountShadow, goalCountText;
    let goalIconBitmap;
    let clickOverlay;

    let indicatorStep = 0;   // 0 = horizontal, 1 = vertical, 2 = shoot
    let chosenColumn = 0;
    let chosenRow    = 0;
    let isInteractive = true;

    const self = this;

    // Keyboard handler
    function onKeyDown(event) {
        event = event || window.event;
        switch (event.keyCode) {
            case SPACE_BAR: self._handleClick(); event.preventDefault(); return false;
            case LEFT: case UP: case RIGHT: case DOWN: event.preventDefault(); return false;
        }
    }

    this._init = function () {
        indicatorStep = 0;

        const exitImg = s_oSpriteLibrary.getSprite("but_exit");
        exitBtnX = CANVAS_WIDTH - exitImg.height / 2 - 10;
        exitBtnY = exitImg.height / 2 + 10;
        exitButton = new CGfxButton(exitBtnX, exitBtnY, exitImg, s_oStage);
        exitButton.addEventListener(ON_MOUSE_UP, this._onExit, this);

        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
            const audioImg = s_oSpriteLibrary.getSprite("audio_icon");
            audioBtnX = exitBtnX - audioImg.width  / 2 - 10;
            audioBtnY = audioImg.height / 2 + 10;
            audioToggle = new CToggle(audioBtnX, audioBtnY, audioImg, s_bAudioActive, s_oStage);
            audioToggle.addEventListener(ON_MOUSE_UP, this._onAudioToggle, this);
            fullscreenBtnX = audioBtnX - audioImg.width / 2 - 10;
        } else {
            fullscreenBtnX = exitBtnX - exitImg.width - 10;
        }
        fullscreenBtnY = exitImg.height / 2 + 10;

        const docEl = window.document.documentElement;
        requestFullscreen = docEl.requestFullscreen || docEl.mozRequestFullScreen
                         || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen || false;
        exitFullscreen    = document.exitFullscreen || document.mozCancelFullScreen
                         || document.webkitExitFullscreen || document.msExitFullscreen;
        if (ENABLE_FULLSCREEN === false) requestFullscreen = false;

        if (requestFullscreen && !inIframe()) {
            const fsImg = s_oSpriteLibrary.getSprite("but_fullscreen");
            fullscreenToggle = new CToggle(fullscreenBtnX, fullscreenBtnY, fsImg, s_bFullscreen, s_oStage);
            fullscreenToggle.addEventListener(ON_MOUSE_UP, this._onFullscreenRelease, this);
        }

        kickContainer = new createjs.Container();
        s_oStage.addChild(kickContainer);

        // Tạo 2 chỉ báo (horizontal & vertical)
        const hScale = TOP_BARX / RANGE_WIDTH;
        horizontalIndicator = new CShotIndicatorController(hScale, false);

        const vScale = RIGHT_BARY / RANGE_HEIGHT;
        verticalIndicator = new CShotIndicatorController(vScale, true);

        // Tăng tốc chỉ báo theo số level
        for (let i = 0; i < levelIndex; i++) {
            horizontalIndicator.increaseSpeed();
            verticalIndicator.increaseSpeed();
        }

        // Vùng click để chọn hướng sút
        clickOverlay = new createjs.Shape();
        clickOverlay.graphics.beginFill("Black").drawRect(0, 160, CANVAS_WIDTH, CANVAS_HEIGHT - 160);
        clickOverlay.alpha = 0.01;
        s_oStage.addChild(clickOverlay);
        clickOverlay.on("mousedown", this._handleClick, this);

        if (!s_bMobile) document.onkeydown = onKeyDown;

        this.controlState();
    };

    this._handleClick = function () {
        if (!isInteractive) return;

        switch (indicatorStep) {
            case 0: // Chọn cột (horizontal)
                if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) createjs.Sound.play("stop_indicator");
                horizontalIndicator.endAnimation();
                chosenColumn = horizontalIndicator.getPositionBallEnd();
                indicatorStep++;
                self.controlState();
                break;

            case 1: // Chọn hàng (vertical)
                if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) createjs.Sound.play("stop_indicator");
                verticalIndicator.endAnimation();
                chosenRow = verticalIndicator.getPositionBallEnd();
                indicatorStep++;
                self.controlState();
                break;
        }
    };

    this.controlState = function () {
        switch (indicatorStep) {
            case 0: horizontalIndicator.startAnimation(); break;
            case 1: verticalIndicator.startAnimation();   break;
            case 2:
                horizontalIndicator.hide();
                verticalIndicator.hide();
                s_oGame.animatePlayer(chosenColumn, chosenRow);
                break;
        }
    };

    // Hiển thị text 2 lớp (shadow + màu)
    function createDoubleText(text, style, color, x, y, lineWidth, outline) {
        const shadow = new createjs.Text(text, style, "#000000");
        shadow.x = x; shadow.y = y;
        shadow.textAlign = "left"; shadow.textBaseline = "alphabetic";
        shadow.lineWidth = lineWidth;
        if (outline) shadow.outline = outline;
        s_oStage.addChild(shadow);

        const label = new createjs.Text(text, style, color);
        label.x = x; label.y = y;
        label.textAlign = "left"; label.textBaseline = "alphabetic";
        label.lineWidth = lineWidth;
        s_oStage.addChild(label);

        return { shadow, label };
    }

    this.viewScoreBonus = function (value, isFirst) {
        const text = TEXT_BONUS + " x " + value;
        if (isFirst === 1) {
            const result = createDoubleText(text, " 25px " + FONT_GAME, "#ffffff", BONUS_TEXT_X, 50, 650, 3);
            bonusShadow = result.shadow;
            bonusText   = result.label;
        } else {
            bonusShadow.text = bonusText.text = text;
        }
    };

    this.viewScore = function (value) {
        const result = createDoubleText(TEXT_SCORE + ": " + value, " 25px " + FONT_GAME, "#ffffff", SCORE_TEXT_X, SCORE_TEXT_Y, 650, 3);
        scoreShadow = result.shadow;
        scoreText   = result.label;
        console.log("viewScore");
    };

    this.viewGoalScored = function (scored, total) {
        goalIconBitmap = createBitmap(s_oSpriteLibrary.getSprite("icon_goal"));
        goalIconBitmap.x = GOAL_ICON_X;
        goalIconBitmap.y = GOAL_ICON_Y;
        s_oStage.addChild(goalIconBitmap);

        const result = createDoubleText(scored + "/" + total, " 25px " + FONT_GAME, "#ffffff", GOALS_X, GOALS_Y, 650, 3);
        goalsShadow = result.shadow;
        goalsText   = result.label;
    };

    this.viewKickLeft = function (count) {
        kickContainer.removeAllChildren();
        kickContainer.y = KICK_BALLS_Y;

        const kickIcon = createBitmap(s_oSpriteLibrary.getSprite("icon_kick"));
        kickIcon.x = KICK_BALLS_X;
        kickIcon.y = 0;
        kickContainer.addChild(kickIcon);

        for (let i = 0; i < count; i++) {
            const ball = createBitmap(s_oSpriteLibrary.getSprite("ball_kick_left"));
            ball.x = KICK_ICON_X + i * 26;
            ball.y = 0;
            kickContainer.addChild(ball);
        }
    };

    this.help = function () {
        isInteractive = false;
        const helpContainer = new createjs.Container();
        s_oStage.addChild(helpContainer);

        const bg = createBitmap(s_oSpriteLibrary.getSprite("msg_box"));
        bg.x = CANVAS_WIDTH  / 2;
        bg.y = CANVAS_HEIGHT / 2;
        bg.regX = MSG_BOX_WIDTH  / 2;
        bg.regY = MSG_BOX_HEIGHT / 2;
        helpContainer.addChild(bg);

        const helpTextStr = s_bMobile === false ? HELP_TEXT_DESKTOP : HELP_TEXT_MOBILE;
        const helpTextObj = new createjs.Text(helpTextStr, " 25px " + FONT_GAME, "#ffffff");
        helpTextObj.x = CANVAS_WIDTH / 2;
        helpTextObj.y = 180;
        helpTextObj.textAlign = "center";
        helpTextObj.textBaseline = "alphabetic";
        helpTextObj.lineWidth = 650;
        helpContainer.addChild(helpTextObj);

        const bar = createBitmap(s_oSpriteLibrary.getSprite("high_bar"));
        bar.x = CANVAS_WIDTH / 2;
        bar.y = 300;
        bar.regX = TOP_BARX / 2;
        bar.regY = TOP_BARY / 2;
        bar.scaleX = bar.scaleY = 0.8;
        helpContainer.addChild(bar);

        const arrow = createBitmap(s_oSpriteLibrary.getSprite("arrow_bar"));
        arrow.x = CANVAS_WIDTH / 2 - 130;
        arrow.y = 290;
        arrow.regX = CURSOR_X / 2;
        arrow.regY = CURSOR_Y / 2;
        arrow.scaleX = arrow.scaleY = 0.8;
        helpContainer.addChild(arrow);

        const tipText = new createjs.Text(HELP_TEXT, " 25px " + FONT_GAME, "#ffffff");
        tipText.x = CANVAS_WIDTH / 2;
        tipText.y = 380;
        tipText.textAlign = "center";
        tipText.textBaseline = "alphabetic";
        tipText.lineWidth = 650;
        helpContainer.addChild(tipText);

        helpContainer.on("mousedown", function onHelpClick() {
            s_oStage.removeChild(helpContainer);
            helpContainer.off("mousedown", onHelpClick);
            isInteractive = true;
            s_oGame.setUpdate();
        });
    };

    this.unload = function () {
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) { audioToggle.unload(); audioToggle = null; }
        if (requestFullscreen && !inIframe()) fullscreenToggle.unload();
        exitButton.unload();
        s_oInterface = null;
    };

    this.refreshButtonPos = function (offsetX, offsetY) {
        exitButton.setPosition(exitBtnX - offsetX, offsetY + exitBtnY);
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) audioToggle.setPosition(audioBtnX - offsetX, offsetY + audioBtnY);
        if (requestFullscreen && !inIframe()) fullscreenToggle.setPosition(fullscreenBtnX - offsetX, fullscreenBtnY + offsetY);

        if (bonusShadow) { bonusShadow.y = bonusText.y = 50 + offsetY; }
        if (scoreShadow) { scoreShadow.y = scoreText.y = SCORE_TEXT_Y - offsetY; }
        if (goalsShadow) { goalsShadow.y = goalsText.y = GOALS_Y - offsetY; }
        if (goalIconBitmap) goalIconBitmap.y = GOAL_ICON_Y - offsetY;
        kickContainer.y = KICK_BALLS_Y - offsetY;
    };

    this._onFullscreenRelease = function () {
        if (s_bFullscreen) { exitFullscreen.call(window.document); s_bFullscreen = false; }
        else               { requestFullscreen.call(window.document.documentElement); s_bFullscreen = true; }
        sizeHandler();
    };

    this._onAudioToggle = function () {
        createjs.Sound.setMute(s_bAudioActive);
        s_bAudioActive = !s_bAudioActive;
    };

    this._onExit = function () { s_oGame.onExit(); };

    s_oInterface = this;
    this._init();
    return this;
}


// ============================================================
// END PANEL — màn hình kết thúc / thắng
// ============================================================

function CEndPanel(backgroundImage, iconImage, totalTimeSecs) {
    let container, restartButton;
    let restartBtnX, restartBtnY;
    let scoreShadow, scoreLabel;

    this._init = function (bg, icon) {
        const bgBitmap   = createBitmap(bg);
        const iconBitmap = createBitmap(icon);
        iconBitmap.x = CANVAS_WIDTH  / 2 - 400;
        iconBitmap.y = CANVAS_HEIGHT / 2 - 200;

        scoreShadow = new createjs.Text("", " 50px " + FONT_GAME, "#000000");
        scoreShadow.x = CANVAS_WIDTH / 2;
        scoreShadow.y = CANVAS_HEIGHT / 2;
        scoreShadow.textAlign    = "center";
        scoreShadow.textBaseline = "alphabetic";
        scoreShadow.lineWidth    = 650;
        scoreShadow.outline      = 3;

        scoreLabel = new createjs.Text("", " 50px " + FONT_GAME, "#ffe51f");
        scoreLabel.x = CANVAS_WIDTH / 2;
        scoreLabel.y = CANVAS_HEIGHT / 2;
        scoreLabel.textAlign    = "center";
        scoreLabel.textBaseline = "alphabetic";
        scoreLabel.lineWidth    = 500;

        container = new createjs.Container();
        container.alpha   = 0;
        container.visible = false;
        container.addChild(bgBitmap, scoreShadow, scoreLabel, iconBitmap);
        s_oStage.addChild(container);

        const restartImg = s_oSpriteLibrary.getSprite("but_restart");
        restartBtnX = CANVAS_WIDTH  / 2 + 300;
        restartBtnY = CANVAS_HEIGHT - 130;
        restartButton = new CGfxButton(restartBtnX, restartBtnY, restartImg);
        restartButton.addEventListener(ON_MOUSE_UP, this._onExit, this);

        this.refreshButtonPos(s_iOffsetX, s_iOffsetY);
    };

    this.show = function (score) {
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) createjs.Sound.play("game_over");

        scoreShadow.text = scoreLabel.text = TEXT_SCORE + score;
        container.visible = true;
        createjs.Tween.get(container).to({ alpha: 1 }, 500).call(() => {});

        $(s_oMain).trigger("share_event", score);
        $(s_oMain).trigger("save_score",  [score]);

        API.saveScore({ score, time: totalTimeSecs });
    };

    this.win = function (score) {
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) createjs.Sound.play("applause");

        scoreShadow.text = scoreLabel.text = TEXT_SCORE + score;
        scoreShadow.x = scoreLabel.x = CANVAS_WIDTH  / 2 - 150;
        scoreShadow.y = scoreLabel.y = CANVAS_HEIGHT / 2 + 120;
        scoreShadow.rotation = scoreLabel.rotation = 17;

        container.visible = true;
        createjs.Tween.get(container).to({ alpha: 1 }, 500).call(() => {});

        $(s_oMain).trigger("share_event", score);
        $(s_oMain).trigger("save_score",  [score]);

        console.log("winwin");
    };

    this._onExit = function () {
        s_oStage.removeChild(container);
        restartButton.unload();
        s_oGame.onExit();
    };

    this.refreshButtonPos = function (offsetX, offsetY) {
        restartButton.setPosition(restartBtnX, restartBtnY - offsetY);
    };

    this._init(backgroundImage, iconImage);
    return this;
}


// ============================================================
// GOAL — hiển thị khung thành
// ============================================================

function CGoal(x, y, parent) {
    this._init = function (x, y, parent) {
        const bitmap = createBitmap(s_oSpriteLibrary.getSprite("goal"));
        bitmap.x = x;
        bitmap.y = y;
        bitmap.regX = GOAL_WIDTH  / 2;
        bitmap.regY = GOAL_HEIGHT / 2;
        parent.addChild(bitmap);
    };

    this._init(x, y, parent);
}

s_oBatter = null;


// ============================================================
// PLAYER — nhân vật người chơi
// ============================================================

function CPlayer(parent) {
    let spriteSheet = null;
    let sprite      = null;

    this._init = function () {};

    function buildSpriteData(imageName, framerate, totalFrames) {
        return {
            images: [s_oSpriteLibrary.getSprite(imageName)],
            framerate,
            frames: {
                width:  PLAYER_WIDTH,
                height: PLAYER_HEIGHT,
                regX:   PLAYER_WIDTH / 2,
                regY:   PLAYER_WIDTH,
            },
            animations: { idle: [0, totalFrames, "idle"] }
        };
    }

    this.showIdle = function (x, y, team) {
        spriteSheet = new createjs.SpriteSheet(buildSpriteData(team + "_idle", 10, 23));
        if (sprite === null) sprite = new createjs.Sprite(spriteSheet, "idle");
        else sprite.spriteSheet = spriteSheet;

        sprite.x = x;
        sprite.y = y;
        sprite.currentAnimationFrame = 0;
        parent.addChild(sprite);
    };

    this.showShot = function (x, y, team) {
        spriteSheet = new createjs.SpriteSheet(buildSpriteData(team + "_shot", 15, 20));
        if (sprite === null) sprite = new createjs.Sprite(spriteSheet, "idle");
        else sprite.spriteSheet = spriteSheet;

        sprite.x = x;
        sprite.y = y;
        sprite.currentAnimationFrame = 0;
        parent.addChild(sprite);
    };

    this.changeAlpha = function () { sprite.alpha = 0.5; };
    this.getFrame    = function () { return sprite.currentFrame; };
    this.unload      = function () { parent.removeAllChildren(); };

    s_oPlayer = this;
    this._init(parent);
}

s_oPlayer = null;


// ============================================================
// GOALKEEPER — thủ môn
// ============================================================

function CGoalKeeper(parent) {
    let spriteSheet = null;
    let sprite      = null;

    this._init = function () {};

    this.showIdle = function (x, y) {
        spriteSheet = new createjs.SpriteSheet({
            images: [s_oSpriteLibrary.getSprite("goalkeeper_idle")],
            framerate: 15,
            frames: {
                width:  GOALKEEPER_WIDTH,
                height: GOALKEEPER_HEIGHT,
                regX:   GOALKEEPER_WIDTH  / 2,
                regY:   GOALKEEPER_WIDTH,
            },
            animations: { idle: [0, 19, "idle"] }
        });

        if (sprite === null) sprite = new createjs.Sprite(spriteSheet, "idle");
        else sprite.spriteSheet = spriteSheet;

        sprite.x = x;
        sprite.y = y;
        parent.addChild(sprite);
        sprite.gotoAndPlay("idle");
    };

    this.showAction = function (x, y, action, frames, width, height) {
        spriteSheet = new createjs.SpriteSheet({
            images: [s_oSpriteLibrary.getSprite("goalkeeper_" + action)],
            framerate: 15,
            frames: {
                width,
                height,
                regX: width  / 2,
                regY: height,
            },
            animations: { idle: [0, frames] }
        });

        if (sprite === null) sprite = new createjs.Sprite(spriteSheet, "idle");
        else sprite.spriteSheet = spriteSheet;

        sprite.x = x;
        sprite.y = y;
        parent.addChild(sprite);
        sprite.gotoAndPlay("idle");
    };

    this.stop     = function () { if (sprite) sprite.paused = true; };
    this.getFrame = function () { return sprite ? sprite.currentFrame : 0; };
    this.unload   = function () { parent.removeAllChildren(); };

    s_oPlayer = this;
    this._init(parent);
}

s_oPlayer = null;


// ============================================================
// LEVEL — dữ liệu cấu hình các màn chơi
// ============================================================

function CLevel(currentLevel, kicksLeft, parent) {
    let container = parent;
    let continueBtnX, continueBtnY;
    let continueButton, nextLevelBg;
    let goalBalls = [];

    // Dữ liệu level
    const levelInfoList = [];
    const ballPositions  = [];
    const playerPositions = [];

    const ballPosGrid   = Array.from({ length: NUM_LEVEL }, () => Array(NUM_KICK));
    const playerPosGrid = Array.from({ length: NUM_LEVEL }, () => Array(NUM_KICK));
    const wallPosGrid   = Array.from({ length: NUM_LEVEL }, () => Array(NUM_KICK));

    const wallPositions = [];

    this._init = function (level, kicks) {
        const displayLevel = level + 1;
        if (displayLevel > 1) {
            this.viewNextLevelPanel();
            this.refreshButtonPos(s_iOffsetX, s_iOffsetY);
        }

        // Cấu hình từng level (goalToScore, kickLeft)
        levelInfoList.push({ goalToScore: 1, kickLeft: 5 });
        levelInfoList.push({ goalToScore: 2, kickLeft: 5 });
        levelInfoList.push({ goalToScore: 2, kickLeft: 5 });
        levelInfoList.push({ goalToScore: 3, kickLeft: 5 });
        levelInfoList.push({ goalToScore: 3, kickLeft: 5 });
        levelInfoList.push({ goalToScore: 4, kickLeft: 5 });

        // Vị trí bóng (3 điểm)
        ballPositions.push({ x: 430, y: 530 });
        ballPositions.push({ x: 680, y: 530 });
        ballPositions.push({ x: 940, y: 530 });

        // Vị trí cầu thủ (3 điểm)
        playerPositions.push({ x: 380, y: 500 });
        playerPositions.push({ x: 660, y: 500 });
        playerPositions.push({ x: 930, y: 500 });

        // Gán lưới vị trí bóng [level][kick]
        const b = ballPositions;
        ballPosGrid[0] = [b[0], b[0], b[0], b[0], b[0]];
        ballPosGrid[1] = [b[0], b[0], b[0], b[1], b[1]];
        ballPosGrid[2] = [b[1], b[0], b[0], b[0], b[2]];
        ballPosGrid[3] = [b[1], b[2], b[0], b[1], b[2]];
        ballPosGrid[4] = [b[0], b[1], b[2], b[2], b[2]];
        ballPosGrid[5] = [b[2], b[1], b[1], b[1], b[1]];

        // Gán lưới vị trí cầu thủ [level][kick]
        const p = playerPositions;
        playerPosGrid[0] = [p[0], p[0], p[0], p[0], p[0]];
        playerPosGrid[1] = [p[0], p[0], p[0], p[1], p[1]];
        playerPosGrid[2] = [p[1], p[0], p[0], p[0], p[2]];
        playerPosGrid[3] = [p[1], p[2], p[0], p[1], p[2]];
        playerPosGrid[4] = [p[0], p[1], p[2], p[2], p[2]];
        playerPosGrid[5] = [p[2], p[1], p[1], p[1], p[1]];

        // Vị trí tường chắn (num = số người)
        const w = wallPositions;
        w.push({ x: 0,   y: 0,                           num: 0 });
        w.push({ x: 525, y: CANVAS_HEIGHT / 2 - 25,      num: 1 });
        w.push({ x: 750, y: CANVAS_HEIGHT / 2 - 25,      num: 1 });
        w.push({ x: 525, y: CANVAS_HEIGHT / 2 - 25,      num: 2 });
        w.push({ x: 750, y: CANVAS_HEIGHT / 2 - 25,      num: 2 });
        w.push({ x: 525, y: CANVAS_HEIGHT / 2 - 25,      num: 1 });
        w.push({ x: 525, y: CANVAS_HEIGHT / 2 - 25,      num: 1 });
        w.push({ x: 525, y: CANVAS_HEIGHT / 2 - 25,      num: 3 });
        w.push({ x: 525, y: CANVAS_HEIGHT / 2 - 25,      num: 2 });

        // Gán lưới vị trí tường [level][kick]
        wallPosGrid[0] = [w[0], w[0], w[0], w[0], w[0]];
        wallPosGrid[1] = [w[1], w[1], w[1], w[2], w[2]];
        wallPosGrid[2] = [w[4], w[3], w[2], w[2], w[2]];
        wallPosGrid[3] = [w[2], w[1], w[1], w[5], w[1]];
        wallPosGrid[4] = [w[1], w[2], w[2], w[6], w[6]];
        wallPosGrid[5] = [w[5], w[2], w[7], w[5], w[1]];
    };

    this._onButContinueRelease = function () {
        this.unload();
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) createjs.Sound.play("click");
        s_oGame.setLevelInfo();
    };

    this.getLevel             = (level) => level;
    this.getBallPosition      = (level, kick) => ballPosGrid[level][kick];
    this.getPlayerPosition    = (level, kick) => playerPosGrid[level][kick];
    this.getWallPosition      = (level, kick) => wallPosGrid[level][kick];

    this.getPlayerPosIndex    = function (level, kick) {
        if (playerPosGrid[level][kick] === playerPositions[0]) return 0;
        if (playerPosGrid[level][kick] === playerPositions[1]) return 1;
        if (playerPosGrid[level][kick] === playerPositions[2]) return 2;
    };

    this.getLevelInfo = function (level) {
        console.log("getLevelInfo: " + level, levelInfoList[level]);
        return levelInfoList[level];
    };

    /** Hiển thị màn hình "Chúc mừng qua level" */
    this.viewNextLevelPanel = function () {
        $(s_oMain).trigger("end_level");
        let ballOffsetX = 0;

        nextLevelBg = createBitmap(s_oSpriteLibrary.getSprite("bg_next_level"));
        container.addChild(nextLevelBg);

        const continueImg = s_oSpriteLibrary.getSprite("but_continue");
        continueBtnX = CANVAS_WIDTH  / 2 + 300;
        continueBtnY = CANVAS_HEIGHT - 150;
        continueButton = new CGfxButton(continueBtnX, continueBtnY, continueImg);
        continueButton.addEventListener(ON_MOUSE_UP, this._onButContinueRelease, this);

        // Text "Congratulations" (shadow + màu)
        const congratsShadow = new createjs.Text(TEXT_CONGRATS, " 60px " + FONT_GAME, "#000000");
        congratsShadow.x = CANVAS_WIDTH / 2 - 350; congratsShadow.y = 175;
        congratsShadow.textAlign = "left"; congratsShadow.textBaseline = "alphabetic";
        congratsShadow.lineWidth = 650; congratsShadow.outline = 3;
        container.addChild(congratsShadow);

        const congratsLabel = new createjs.Text(TEXT_CONGRATS, " 60px " + FONT_GAME, "#ffe51f");
        congratsLabel.x = CANVAS_WIDTH / 2 - 350; congratsLabel.y = 175;
        congratsLabel.textAlign = "left"; congratsLabel.textBaseline = "alphabetic";
        congratsLabel.lineWidth = 650;
        container.addChild(congratsLabel);

        // Text "Goal Scored"
        const goalShadow = new createjs.Text(TEXT_GOAL_SCORED + ": ", " 40px " + FONT_GAME, "#000000");
        goalShadow.x = CANVAS_WIDTH / 2 - 300; goalShadow.y = 275;
        goalShadow.textAlign = "left"; goalShadow.textBaseline = "alphabetic";
        goalShadow.lineWidth = 650; goalShadow.outline = 3;
        container.addChild(goalShadow);

        const goalLabel = new createjs.Text(TEXT_GOAL_SCORED + ": ", " 40px " + FONT_GAME, "#ffe51f");
        goalLabel.x = CANVAS_WIDTH / 2 - 300; goalLabel.y = 275;
        goalLabel.textAlign = "left"; goalLabel.textBaseline = "alphabetic";
        goalLabel.lineWidth = 650;
        container.addChild(goalLabel);

        // Biểu tượng bóng (số bàn thắng)
        const goalsThisLevel = levelInfoList[currentLevel] ? levelInfoList[currentLevel].goalToScore : 0;
        for (let i = 0; i < goalsThisLevel; i++, ballOffsetX += 26) {
            const ball = createBitmap(s_oSpriteLibrary.getSprite("ball_kick_left"));
            ball.x = CANVAS_WIDTH / 2 + 50 + ballOffsetX;
            ball.y = 250;
            goalBalls.push(ball);
            container.addChild(ball);
        }
    };

    this.refreshButtonPos = function (offsetX, offsetY) {
        if (continueButton) continueButton.setPosition(continueBtnX, continueBtnY - offsetY);
    };

    this.unload = function () {
        if (continueButton) { continueButton.unload(); continueButton = null; }
        s_oStage.removeChild(container);
        nextLevelBg = null;
    };

    this._init(currentLevel, kicksLeft);
}


// ============================================================
// BALL — quả bóng
// ============================================================

function CBall(startX, startY, parent) {
    let flightStep = 0;
    let isFlying   = false;
    let isIdle     = true;
    let spriteDef, ballSprite;
    let startPos = { x: 0, y: 0 };
    let targetPos = { x: 0, y: 0 };
    let curve;

    this._init = function (x, y, container) {
        spriteDef = {
            images: [s_oSpriteLibrary.getSprite("ball")],
            framerate: 20,
            frames: {
                width:  BALL_WIDTH,
                height: BALL_HEIGHT,
                regX:   BALL_WIDTH  / 2,
                regY:   BALL_HEIGHT / 2,
            },
            animations: {
                idle:   0,
                thrown: [0, 6, "thrown"],
            }
        };

        const sheet = new createjs.SpriteSheet(spriteDef);
        ballSprite  = createSprite(sheet, "idle", 0, 0, BALL_WIDTH, BALL_HEIGHT);
        ballSprite.x = x;
        ballSprite.y = y;
        ballSprite.rotation = 0;
        container.addChild(ballSprite);
        ballSprite.gotoAndStop("idle");

        startPos.x = ballSprite.x;
        startPos.y = ballSprite.y;
    };

    this._calculateMidPoint = function (start, end) {
        const rand = Math.floor(Math.random() * 50) + 1;
        let mid;

        if (end.x < CANVAS_WIDTH / 2) {
            mid = end.y > CANVAS_HEIGHT / 2
                ? new createjs.Point(Math.floor(Math.random() * CANVAS_WIDTH / 2) + 100, CANVAS_HEIGHT / 2 - 200 - rand)
                : new createjs.Point(Math.floor(Math.random() * CANVAS_WIDTH / 2) + 100, CANVAS_HEIGHT / 2 - 200 + rand);
        } else if (end.x > CANVAS_WIDTH / 2) {
            mid = end.y > CANVAS_HEIGHT / 2
                ? new createjs.Point(Math.floor(Math.random() * CANVAS_WIDTH / 2) + 300, CANVAS_HEIGHT / 2 - 200 - rand)
                : new createjs.Point(Math.floor(Math.random() * CANVAS_WIDTH / 2) + 300, CANVAS_HEIGHT / 2 - 200 + rand);
        } else {
            mid = end.x > CANVAS_WIDTH / 2
                ? new createjs.Point(CANVAS_WIDTH / 2 - 50, Math.floor(Math.random() * CANVAS_HEIGHT / 2 - 100) + 100)
                : new createjs.Point(CANVAS_WIDTH / 2 + 50, Math.floor(Math.random() * CANVAS_HEIGHT / 2 - 100) + 100);
        }

        curve = { start, end, traj: mid };
    };

    this.fadeOut = function () {
        createjs.Tween.get(ballSprite)
            .to({ alpha: 0 }, 200)
            .call(() => ballSprite.gotoAndStop("idle"));
    };

    this.ballKicked = function (endX, endY) {
        targetPos.x = endX;
        targetPos.y = endY;
        curve   = { start: startPos, end: targetPos, traj: targetPos };
        isFlying = true;
        isIdle   = false;
        ballSprite.gotoAndPlay("thrown");
    };

    this.returnX = function () { return ballSprite.x; };
    this.returnY = function () { return ballSprite.y; };

    this._updateBall = function (numWalls, hitWall) {
        flightStep += STEP_SPEED_BALL_HITTED;
        ballSprite.rotation += 5;

        if (flightStep > 40) {
            flightStep = 0;
            isFlying   = false;
            isIdle     = true;
            s_oGame.showMessage(false);
            return;
        }

        const t = easeOutCubic(flightStep, 0, 1, 40);
        const pos = getTrajectoryPoint(t, curve);
        ballSprite.x = pos.x;
        ballSprite.y = pos.y;

        // Kiểm tra thủ môn bắt bóng
        if (hitWall && ballSprite.scaleX <= 0.7) s_oGame.goalKeeperBounce();

        // Kiểm tra tường chắn
        if (numWalls > 0 && ballSprite.scaleX <= 0.75) s_oGame.controlWall();

        // Thu nhỏ bóng khi bay xa
        if (ballSprite.scaleX >= 0.4) {
            ballSprite.scaleX -= 0.03;
            ballSprite.scaleY -= 0.03;
        }
    };

    /** Bóng bị chặn — văng ra ngoài màn hình */
    this.bounce = function (fromX, isKeeperSave) {
        isFlying = false;
        const goRight  = fromX < CANVAS_WIDTH / 2;
        const duration = isKeeperSave ? 700 : 500;

        createjs.Tween.get(ballSprite).to({
            x: ballSprite.x + (goRight ? 100 : -100),
            y: CANVAS_HEIGHT + 50,
        }, duration).call(() => {
            s_oGame.showMessage(!isKeeperSave);
        });
    };

    this.unload = function () { ballSprite = null; parent.removeAllChildren(); };

    this.update = function (numWalls, hitWall) {
        if (isFlying) this._updateBall(numWalls, hitWall);
    };

    s_oBall = this;
    this._init(startX, startY, parent);
}

s_oBall = null;


// ============================================================
// WALL — tường người chắn bóng
// ============================================================

function CWall(baseX, baseY, parent, index) {
    let idleSheet = null;
    let sprite    = null;

    this._init = function (x, y, wallIndex) {
        if (wallIndex === 0) {
            parent.x = x;
            parent.y = y;
        }
    };

    this.showIdle = function (slotIndex) {
        const sheetData = {
            images: [s_oSpriteLibrary.getSprite("wall_idle")],
            framerate: 10,
            frames: {
                width:  WALL_WIDTH,
                height: WALL_HEIGHT,
                regX:   WALL_WIDTH / 2,
                regY:   0,
            },
            animations: { idle: [0, 23, "idle"] }
        };

        idleSheet = new createjs.SpriteSheet(sheetData);
        if (sprite === null) sprite = new createjs.Sprite(idleSheet, "idle");
        else sprite.spriteSheet = idleSheet;

        sprite.x = (WALL_WIDTH - 40) * slotIndex;
        sprite.y = 0;
        sprite.currentAnimationFrame = 0;
        parent.addChild(sprite);
    };

    this.showJump = function (slotIndex) {
        if (sprite !== null) parent.removeChild(sprite);

        const sheetData = {
            images: [s_oSpriteLibrary.getSprite("wall_jump")],
            framerate: 15,
            frames: {
                width:  WALL_WIDTH,
                height: WALL_HEIGHT,
                regX:   WALL_WIDTH / 2,
            },
            animations: {
                start: [0],
                jump:  [0, 20, "start"],
            }
        };

        const jumpSheet = new createjs.SpriteSheet(sheetData);
        sprite = new createjs.Sprite(jumpSheet, "jump");
        sprite.x = (WALL_WIDTH - 40) * slotIndex;
        parent.addChild(sprite);
    };

    this.stopAction = function () { sprite.stop(0); };
    this.getFrame   = function () { return sprite.currentFrame; };
    this.getX       = function () { return sprite.x; };

    /** Kiểm tra bóng có va chạm với tường không */
    this.controlIfHitted = function (ballX, ballY, wallCount) {
        return ballY < parent.y + WALL_HEIGHT
            && ballY > parent.y
            && ballX > parent.x
            && ballX < parent.x + (WALL_WIDTH - 60) * wallCount;
    };

    this.unload = function () { sprite = null; parent.removeChild(sprite); };

    this._init(baseX, baseY, index);
}


// ============================================================
// CROWD — khán giả
// ============================================================

function CCrowd() {
    let frames     = [];
    let frameIndex = 0;
    let timeAccum  = 0;

    this._init = function () {
        for (let i = 0; i < NUM_CROWD; i++) {
            const bitmap = createBitmap(s_oSpriteLibrary.getSprite("supporters_" + i));
            bitmap.x = 0;
            bitmap.y = 90;
            bitmap.visible = false;
            s_oStage.addChild(bitmap);
            frames.push(bitmap);
        }
        frames[0].visible = true;
    };

    this.exult = function () {
        frames[frameIndex].visible = false;
        frameIndex++;
        frames[frameIndex].visible = true;
    };

    this.showAnim = function () {
        timeAccum += s_iTimeElaps;
        if (timeAccum >= 30) {
            this.exult();
            if (frameIndex === NUM_CROWD - 1) {
                frames[frameIndex].visible = false;
                frameIndex = 0;
                frames[0].visible = true;
                s_oGame.setCrowdOff();
            }
            timeAccum = 0;
        }
    };

    s_oPlayer = this;
    this._init();
}

s_oPlayer = null;


// ============================================================
// SHOT INDICATOR CONTROLLER — thanh chỉ báo cú sút
// ============================================================

function CShotIndicatorController(scale, isVertical) {
    let container, arrowBitmap, barBitmap;
    let isVisible = true;
    let isVerticalMode = isVertical;
    let speed;
    let startPos    = new CVector2(0, 0);
    let endPos      = new CVector2(0, 0);
    let startX, startY, endX, endY;
    let goingForward = true;

    this.init = function (scale, vertical) {
        isVerticalMode = vertical;
        container = new createjs.Container();
        s_oStage.addChild(container);

        if (!vertical) {
            // Thanh ngang (horizontal)
            const barImg = s_oSpriteLibrary.getSprite("high_bar");
            barBitmap = createBitmap(barImg);
            container.addChild(barBitmap);
            container.x = 290;
            container.y = CANVAS_HEIGHT / 2 - 170;

            const arrowImg = s_oSpriteLibrary.getSprite("arrow_bar");
            arrowBitmap = createBitmap(arrowImg);
            arrowBitmap.x = 0;
            arrowBitmap.y = -10;
            container.addChild(arrowBitmap);

            startX = 20;
            startY = CANVAS_HEIGHT / 2 - 150;
            endX   = TOP_BARX - 50;
            endY   = CANVAS_HEIGHT / 2 - 150;
        } else {
            // Thanh dọc (vertical)
            const barImg = s_oSpriteLibrary.getSprite("right_bar");
            barBitmap = createBitmap(barImg);
            container.addChild(barBitmap);
            container.x = CANVAS_WIDTH / 2 + 345;
            container.y = CANVAS_HEIGHT / 2 - 130;

            const arrowImg = s_oSpriteLibrary.getSprite("arrow_bar");
            arrowBitmap = createBitmap(arrowImg);
            arrowBitmap.x = 60;
            arrowBitmap.y = 0;
            arrowBitmap.rotation = 90;
            container.addChild(arrowBitmap);

            startX = CANVAS_WIDTH / 2 + 375;
            startY = 0;
            endX   = CANVAS_WIDTH / 2 + 375;
            endY   = RIGHT_BARY - 50;
        }

        this.reset();
    };

    this.reset = function () {
        speed = SHOT_INDICATOR_SPEED;
        startPos.set(startX, startY);
        endPos.set(endX, endY);
    };

    this.increaseSpeed = function () {
        speed -= DECREASE_SHOT_INDICATOR_SPEED;
    };

    this.show = function () { isVisible = true;  container.visible = true;  };
    this.hide = function () { isVisible = false; container.visible = false; };

    this.getPositionBallEnd = function () {
        return isVerticalMode
            ? Math.floor(arrowBitmap.y / scale)
            : Math.floor(arrowBitmap.x / scale);
    };

    this.startAnimation = function () {
        const self = this;
        if (isVerticalMode) {
            const target = goingForward ? endY : startY;
            createjs.Tween.get(arrowBitmap, { override: true })
                .to({ y: target }, speed, createjs.Ease.quadInOut)
                .call(() => { goingForward = !goingForward; self.startAnimation(); });
        } else {
            const target = goingForward ? endX : startX;
            createjs.Tween.get(arrowBitmap, { override: true })
                .to({ x: target }, speed, createjs.Ease.quadInOut)
                .call(() => { goingForward = !goingForward; self.startAnimation(); });
        }
    };

    this.endAnimation = function () {
        if (isVerticalMode) {
            createjs.Tween.get(arrowBitmap, { override: true }).to({ y: arrowBitmap.y }, 0).call(() => {});
        } else {
            createjs.Tween.get(arrowBitmap, { override: true }).to({ x: arrowBitmap.x }, 0).call(() => {});
        }
    };

    this.update = function () {};

    this.init(scale, isVertical);
}


// ============================================================
// CREDITS PANEL — màn hình credits
// ============================================================

function CCreditsPanel() {
    let container, exitButton, clickOverlay, clickHandler;
    let exitBtnX, exitBtnY;

    this._init = function () {
        container = new createjs.Container();
        s_oStage.addChild(container);

        // Background
        const bg = createBitmap(s_oSpriteLibrary.getSprite("credits_bg"));
        container.addChild(bg);

        // "Developed by" text (shadow + màu)
        function addText(text, size, color, y) {
            const label = new createjs.Text(text, " " + size + "px " + FONT_GAME, color);
            label.x = CANVAS_WIDTH / 2;
            label.y = y;
            label.textAlign    = "center";
            label.textBaseline = "middle";
            label.lineWidth    = 300;
            container.addChild(label);
            return label;
        }

        addText(TEXT_DEVELOPED, 30, "#000").outline = 2;
        addText(TEXT_DEVELOPED, 30, "#fcff00", 255);
        addText("www.codethislab.com", 26, "#000", 390).outline = 2;
        addText("www.codethislab.com", 26, "#fcff00", 390);

        // Logo
        const logoImg = s_oSpriteLibrary.getSprite("ctl_logo");
        const logo    = createBitmap(logoImg);
        logo.regX = logoImg.width  / 2;
        logo.regY = logoImg.height / 2;
        logo.x = CANVAS_WIDTH  / 2;
        logo.y = CANVAS_HEIGHT / 2;
        container.addChild(logo);

        // Clickable overlay → link ke trang web
        clickOverlay = new createjs.Shape();
        clickOverlay.graphics.beginFill("#0f0f0f").drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        clickOverlay.alpha = 0.01;
        clickHandler = clickOverlay.on("click", this._onLogoButRelease);
        container.addChild(clickOverlay);

        // Exit button
        const exitImg = s_oSpriteLibrary.getSprite("but_exit");
        exitBtnX = CANVAS_WIDTH - exitImg.width  / 2 - 10;
        exitBtnY = exitImg.height / 2 + 10;
        exitButton = new CGfxButton(exitBtnX, exitBtnY, exitImg, container);
        exitButton.addEventListener(ON_MOUSE_UP, this.unload, this);

        this.refreshButtonPos(s_iOffsetX, s_iOffsetY);
    };

    this.unload = function () {
        clickOverlay.off("click", clickHandler);
        s_oStage.removeChild(container);
        exitButton.unload();
        s_oMenu.exitFromCredits();
    };

    this.refreshButtonPos = function (offsetX, offsetY) {
        exitButton.setPosition(exitBtnX - offsetX, offsetY + exitBtnY);
    };

    this._onLogoButRelease = function () {
        window.open("http://www.codethislab.com/index.php?&l=en");
    };

    this._init();
}
