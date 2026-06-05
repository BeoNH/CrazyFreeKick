// ─────────────────────────────────────────────────────────────────────────────
//  NetworkManager.ts
//  Client WebSocket + HTTP REST hợp nhất
//  ✔ Không phụ thuộc framework (không cần Cocos Creator / cc.*)
//  ✔ Generic TypeScript đầy đủ
//  ✔ Tự động kết nối lại với exponential back-off
//  ✔ Các pattern: Request/Response, Notify, lắng nghe server-push
//  ✔ Đo Ping / độ trễ mạng
//  ✔ Timeout riêng từng request + tự dọn dẹp bộ nhớ
// ─────────────────────────────────────────────────────────────────────────────



// ── Cách dùng nhanh ──────────────────────────────────────────────────────────

// // Khởi tạo một lần
// const net = NetworkManager.instance;
// net.configure({ wsHost: "game.server.com", wsPort: 9000, httpBaseUrl: "https://api.server.com" });
// net.connect();

// // WebSocket request/response
// const res = await net.request<{ score: number }>("getScore", { userId: 123 });

// // Lắng nghe server push
// const listenId = net.addNotifyListener((route, data) => { ... });

// // Khi không cần nữa:
// net.removeNotifyListener(listenId);

// // HTTP REST
// const board = await net.httpGet<ILeaderboardEntry[]>("/api/leaderboard");
// await net.httpPost("/api/saveScore", { userId: 1, score: 999 });




// ── Cấu hình ──────────────────────────────────────────────────────────────────

export interface NetworkConfig {
    /** Host WebSocket, ví dụ: "game.example.com" */
    wsHost?: string;
    /** Cổng WebSocket */
    wsPort?: number;
    /** Dùng WSS thay vì WS */
    useWSS?: boolean;
    /** Tự động kết nối lại khi bị ngắt ngoài ý muốn */
    autoReconnect?: boolean;
    /** Thời gian chờ kết nối lại ban đầu (ms) — tăng gấp đôi mỗi lần thử, tối đa maxReconnectDelay */
    reconnectBaseDelay?: number;
    /** Thời gian chờ kết nối lại tối đa (ms) */
    maxReconnectDelay?: number;
    /** Chu kỳ ping (ms) — đặt 0 để tắt */
    pingIntervalMs?: number;
    /** URL gốc cho các endpoint HTTP REST */
    httpBaseUrl?: string;
    /** Endpoint dùng để lấy access token (JWT / OAuth) trước khi gọi API */
    accessToken?: string;
}

const DEFAULT_CONFIG: Required<NetworkConfig> = {
    wsHost: "localhost",
    wsPort: 3000,
    useWSS: false,
    autoReconnect: true,
    reconnectBaseDelay: 1000,
    maxReconnectDelay: 30_000,
    pingIntervalMs: 3000,
    httpBaseUrl: `https://apiminigame-kh.gamebatta.com/api-minigame`,
    accessToken: "",
};

// ── Kiểu dữ liệu nội bộ ───────────────────────────────────────────────────────

interface WsPacket {
    msgId: number;
    route: string;
    data: Record<string, unknown>;
}

type ListenerId = string;

interface PendingRequest<T = unknown> {
    route: string;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
    timer: ReturnType<typeof setTimeout> | null;
}

type NotifyHandler = (route: string, data: unknown) => void;
type ConnectionHandler = () => void;

// ── Hàm tiện ích ──────────────────────────────────────────────────────────────

let _idCounter = 0;
function nextId(): ListenerId {
    return `lid_${++_idCounter}`;
}

function nextMsgId(current: number): number {
    const next = current + 1;
    return next > 64_999 ? 1 : next;
}

function safePayload(data: unknown): Record<string, unknown> {
    return data !== null && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

// ── NetworkManager ────────────────────────────────────────────────────────────

export class NetworkManager {
    // ── Singleton ────────────────────────────────────────────────────────────

    private static _instance: NetworkManager | null = null;

    static get instance(): NetworkManager {
        if (!NetworkManager._instance) {
            NetworkManager._instance = new NetworkManager();
        }
        return NetworkManager._instance;
    }

    /** Thay thế instance singleton — hữu ích khi viết test. */
    static resetInstance(config?: NetworkConfig): NetworkManager {
        NetworkManager._instance = new NetworkManager(config);
        return NetworkManager._instance;
    }

    // ── Theo dõi độ trễ (chỉ đọc từ bên ngoài) ───────────────────────────────

    /** Thời gian khứ hồi của lần ping gần nhất (ms). */
    public ping = 0;
    /** RTT thấp nhất từng đo được (ms). -1 = chưa đo lần nào. */
    public minPing = -1;
    /** Độ lệch đồng hồ ước tính: server_time ≈ Date.now() - timeDistance */
    public timeDistance = 0;

    /** Ước tính thời gian hiện tại của server (ms kể từ epoch). */
    serverNow(): number {
        return Date.now() - this.timeDistance + Math.round(this.minPing / 2);
    }

    // ── Trạng thái nội bộ ─────────────────────────────────────────────────────

    private cfg: Required<NetworkConfig>;
    private ws: WebSocket | null = null;
    private forceClose = false;
    private reconnectAttempt = 0;
    private pingTimer: ReturnType<typeof setInterval> | null = null;
    private msgId = 0;

    /** Các request đang chờ phản hồi, khoá theo msgId. */
    private pending = new Map<number, PendingRequest>();

    /** Danh sách listener nhận server-push (notify). */
    private notifyListeners = new Map<ListenerId, NotifyHandler>();

    /** Danh sách listener sự kiện onOpen. */
    private openListeners = new Map<ListenerId, ConnectionHandler>();

    /** Danh sách listener sự kiện onClose. */
    private closeListeners = new Map<ListenerId, ConnectionHandler>();

    // ── Khởi tạo ──────────────────────────────────────────────────────────────

    constructor(config?: NetworkConfig) {
        this.cfg = { ...DEFAULT_CONFIG, ...config };
    }

    /** Cập nhật cấu hình trong lúc chạy. */
    configure(config: Partial<NetworkConfig>): void {
        Object.assign(this.cfg, config);
    }

    // ── Kết nối WebSocket ─────────────────────────────────────────────────────

    /** Mở kết nối WebSocket. An toàn khi gọi nhiều lần. */
    connect(): void {
        this.forceClose = false;

        if (this.ws) {
            if (this.ws.readyState === WebSocket.OPEN) return; // đã mở rồi
            this.ws.close();
            this.ws = null;
        }

        const protocol = this.cfg.useWSS ? "wss" : "ws";
        const url = `${protocol}://${this.cfg.wsHost}:${this.cfg.wsPort}`;
        console.log(`[NetworkManager] Đang kết nối → ${url}`);

        this.ws = new WebSocket(url);
        this.ws.binaryType = "arraybuffer";
        this.ws.onopen = this._onOpen.bind(this);
        this.ws.onmessage = this._onMessage.bind(this);
        this.ws.onerror = this._onError.bind(this);
        this.ws.onclose = this._onClose.bind(this);
    }

    /** Đóng WebSocket một cách an toàn và tắt tự động kết nối lại. */
    disconnect(): void {
        this.forceClose = true;
        this._clearPing();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    // ── Xử lý sự kiện WebSocket ───────────────────────────────────────────────

    private _onOpen(_ev: Event): void {
        console.log("[NetworkManager] WebSocket đã mở");
        this.reconnectAttempt = 0;
        this._startPing();
        this.openListeners.forEach((cb) => { try { cb(); } catch (e) { console.error(e); } });
    }

    private _onMessage(ev: MessageEvent): void {
        let raw: unknown;
        try {
            // Dùng msgpack nếu có sẵn toàn cục (ví dụ: msgpack-lite).
            // Đổi sang JSON.parse nếu server dùng transport JSON.
            raw = (typeof msgpack !== "undefined")
                ? msgpack.decode(new Uint8Array(ev.data as ArrayBuffer))
                : JSON.parse(ev.data as string);
        } catch (e) {
            console.error("[NetworkManager] Giải mã tin nhắn thất bại", e);
            return;
        }

        const pack = raw as WsPacket;
        if (!pack || typeof pack.msgId !== "number") return;

        if (pack.msgId === 0) {
            // Tin nhắn server-push / notify
            console.log(`[NetworkManager] PUSH  ${pack.route}`, pack.data);
            this.notifyListeners.forEach((cb) => {
                try { cb(pack.route, pack.data); } catch (e) { console.error(e); }
            });
        } else {
            // Phản hồi cho một request cụ thể
            const entry = this.pending.get(pack.msgId);
            if (entry) {
                if (entry.timer !== null) clearTimeout(entry.timer);
                this.pending.delete(pack.msgId);
                console.log(`[NetworkManager] RESP  ${entry.route}`, pack.data);
                entry.resolve(pack.data);
            }
        }
    }

    private _onError(ev: Event): void {
        console.error("[NetworkManager] Lỗi WebSocket", ev);
    }

    private _onClose(_ev: CloseEvent): void {
        console.warn("[NetworkManager] WebSocket đã đóng");
        this._clearPing();

        // Từ chối toàn bộ request đang chờ
        this.pending.forEach((entry) => {
            if (entry.timer !== null) clearTimeout(entry.timer);
            entry.reject(new Error(`Kết nối đóng trước khi nhận phản hồi cho route "${entry.route}"`));
        });
        this.pending.clear();

        this.closeListeners.forEach((cb) => { try { cb(); } catch (e) { console.error(e); } });

        if (this.cfg.autoReconnect && !this.forceClose) {
            const delay = Math.min(
                this.cfg.reconnectBaseDelay * Math.pow(2, this.reconnectAttempt),
                this.cfg.maxReconnectDelay,
            );
            this.reconnectAttempt++;
            console.log(`[NetworkManager] Kết nối lại sau ${delay}ms (lần thứ ${this.reconnectAttempt})…`);
            setTimeout(() => {
                if (!this.forceClose) this.connect();
            }, delay);
        }
    }

    // ── Gửi dữ liệu ──────────────────────────────────────────────────────────

    private _send(packet: WsPacket): boolean {
        if (!this.isConnected()) {
            console.warn("[NetworkManager] Không thể gửi — chưa kết nối");
            return false;
        }
        try {
            const encoded = (typeof msgpack !== "undefined")
                ? msgpack.encode(packet)
                : JSON.stringify(packet);
            this.ws!.send(encoded);
            return true;
        } catch (e) {
            console.error("[NetworkManager] Lỗi khi gửi dữ liệu", e);
            return false;
        }
    }

    /**
     * Gửi request và trả về Promise sẽ resolve khi có phản hồi từ server.
     * @param route      Chuỗi route phía server
     * @param data       Dữ liệu gửi kèm (tuỳ chọn)
     * @param timeoutMs  Thời gian chờ tối đa trước khi reject (ms, 0 = không giới hạn)
     */
    request<TRes = unknown, TReq = unknown>(
        route: string,
        data?: TReq,
        timeoutMs = 45_000,
    ): Promise<TRes> {
        return new Promise<TRes>((resolve, reject) => {
            this.msgId = nextMsgId(this.msgId);
            const id = this.msgId;

            let timer: ReturnType<typeof setTimeout> | null = null;
            if (timeoutMs > 0) {
                timer = setTimeout(() => {
                    if (this.pending.has(id)) {
                        this.pending.delete(id);
                        reject(new Error(`[NetworkManager] Timeout route "${route}" sau ${timeoutMs}ms`));
                    }
                }, timeoutMs);
            }

            this.pending.set(id, { route, resolve: resolve as (v: unknown) => void, reject, timer });
            console.log(`[NetworkManager] REQ   ${route}`, data);

            const ok = this._send({ msgId: id, route, data: safePayload(data) });
            if (!ok) {
                if (timer !== null) clearTimeout(timer);
                this.pending.delete(id);
                reject(new Error(`[NetworkManager] Gửi request "${route}" thất bại — chưa kết nối`));
            }
        });
    }

    /**
     * Gửi thông báo một chiều — không chờ phản hồi.
     */
    notify(route: string, data?: unknown): void {
        console.log(`[NetworkManager] NOTIFY ${route}`, data);
        this._send({ msgId: 0, route, data: safePayload(data) });
    }

    // ── Ping ──────────────────────────────────────────────────────────────────

    private _startPing(): void {
        this._clearPing();
        if (this.cfg.pingIntervalMs <= 0) return;
        this.pingTimer = setInterval(() => this._doPing(), this.cfg.pingIntervalMs);
        this._doPing();
    }

    private _clearPing(): void {
        if (this.pingTimer !== null) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    private _doPing(): void {
        const t0 = Date.now();
        this.request<{ time: number }>("ping", null, 5_000)
            .then((res) => {
                const rtt = Date.now() - t0;
                this.ping = rtt;
                if (this.minPing < 0 || rtt < this.minPing) {
                    this.minPing = rtt;
                    this.timeDistance = Date.now() - res.time;
                }
                console.log(`[NetworkManager] Ping ${rtt}ms (thấp nhất ${this.minPing}ms)`);
            })
            .catch(() => { /* ping timeout không gây lỗi nghiêm trọng */ });
    }

    // ── Đăng ký listener ──────────────────────────────────────────────────────

    /**
     * Đăng ký handler nhận tin nhắn server-push.
     * @returns ListenerId — truyền vào `removeNotifyListener` khi không cần nữa.
     */
    addNotifyListener(handler: NotifyHandler): ListenerId {
        const id = nextId();
        this.notifyListeners.set(id, handler);
        return id;
    }

    removeNotifyListener(id: ListenerId): void {
        this.notifyListeners.delete(id);
    }

    /** Đăng ký handler cho sự kiện WebSocket mở. */
    addOpenListener(handler: ConnectionHandler): ListenerId {
        const id = nextId();
        this.openListeners.set(id, handler);
        return id;
    }

    removeOpenListener(id: ListenerId): void {
        this.openListeners.delete(id);
    }

    /** Đăng ký handler cho sự kiện WebSocket đóng. */
    addCloseListener(handler: ConnectionHandler): ListenerId {
        const id = nextId();
        this.closeListeners.set(id, handler);
        return id;
    }

    removeCloseListener(id: ListenerId): void {
        this.closeListeners.delete(id);
    }

    // ── HTTP REST ─────────────────────────────────────────────────────────────

    /** Cập nhật URL gốc cho các endpoint HTTP trong lúc chạy. */
    setHttpBaseUrl(url: string): void {
        this.cfg.httpBaseUrl = url;
    }

    /** Cập nhật access token dùng cho xác thực API (Bearer token) trong runtime. */
    setAccessToken(token: string): void {
        this.cfg.accessToken = token;
    }
    get hasAccessToken(): boolean {
        return !!this.cfg.accessToken;
    }

    /**
     * Gửi HTTP request JSON tổng quát.
     * @param path   Đường dẫn endpoint, ví dụ: "/api/leaderboard"
     * @param init   RequestInit chuẩn (method, headers, body…)
     */
    async httpRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
        const url = `${this.cfg.httpBaseUrl}${path}`;

        if (init.body) {
            console.log(`[NetworkManager] HTTP ${init.method ?? "GET"} ${url}`, JSON.parse(init.body as string));
        } else {
            console.log(`[NetworkManager] HTTP ${init.method ?? "GET"} ${url}`);
        }

        try {
            const response = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + this.cfg.accessToken,
                    ...(init.headers ?? {})
                },
                ...init,
                body: init.body && JSON.stringify({
                    ...JSON.parse(init.body as string),
                    ...PARAMS,
                    source: urlParam("url_api"),
                    game_name: "crazy-free-kick"
                })
            });
            if (!response.ok) {
                console.warn(`[NetworkManager] HTTP ${response.status} ${response.statusText} — ${url}`);
                return null;
            }

            const data = await response.json() as T;
            console.log(`[NetworkManager] HTTP RES ${url}`, data);
            return data;

        } catch (e) {
            console.warn(`[NetworkManager] ${e}`);
            return null;
        }
    }

    /** Tiện ích: HTTP GET */
    httpGet<T>(path: string): Promise<T> {
        return this.httpRequest<T>(path, {
            method: "GET"
        });
    }

    /** Tiện ích: HTTP POST với body JSON */
    httpPost<TRes = any, TReq = unknown>(path: string, body: TReq): Promise<TRes> {
        return this.httpRequest<TRes>(path, {
            method: "POST",
            body: JSON.stringify(body),
        });
    }
}

export function urlParam(name: string): string | null {
    const results = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search);
    return results !== null ? (results[1] || '') : null;
}

const PARAMS = (() => {
    const params = new URLSearchParams(window.location.search);
    const obj = {};
    for (const [key, value] of params) {
        obj[key] = value;
    }
    return obj;
})();

// ── Khai báo kiểu cho msgpack (được load từ bên ngoài) ────────────────────────
declare const msgpack: {
    encode(value: unknown): Uint8Array | string;
    decode(data: Uint8Array): unknown;
};
