import { encode, decode } from "./util.js";

type NT_Key = string;

export class NT {
    socket: WebSocket;
    robot_addr: string;
    robot_connected: boolean;
    socket_open: boolean;
    conn_listeners: Set<any>;
    robot_conn_listeners: Set<any>;
    global_listeners: Set<any>;
    key_listeners: Map<NT_Key, any>;
    cache: Map<NT_Key, any>;

    constructor(host: string = window.location.host) {
        this.socket = null;
        this.robot_addr = null;
        this.robot_connected = false;
        this.socket_open = false;
        this.conn_listeners = new Set();
        this.robot_conn_listeners = new Set();
        this.global_listeners = new Set();
        this.key_listeners = new Map();
        this.cache = new Map();
        this.createSocket(host);
    }

    createSocket(host: string) {
        const address = `ws://${host}/networktables/ws`;

        this.socket = new WebSocket(address);
        if (this.socket) {
            this.socket.binaryType = "arraybuffer";
            this.socket.onopen = () => this.onConnect(this);
            this.socket.onclose = () => this.onDisconnect(this);
            this.socket.onmessage = (msg) => this.onMessage(this, msg);
        }
    }

    onConnect(table: this) {
        console.info("Socket opened");
        table.socket_open = true;
        table.conn_listeners.forEach((f) => f(true));
    }

    onMessage(table: this, msg: MessageEvent<any>) {
        const data = decode(msg.data);

        // robot connection event
        if (data.r !== undefined) {
            table.robot_connected = data.r;
            table.robot_addr = data.a;
            table.robot_conn_listeners.forEach((f) => f(table.robot_connected));
        } else {
            // data changed on websocket
            const key = data["k"];
            const value = data["v"];
            const isNew = data["n"];

            table.cache.set(key, value);

            // notify global listeners
            table.global_listeners.forEach((f) => f(key, value, isNew));

            // notify key-specific listeners
            const listeners = table.key_listeners.get(key);
            if (listeners !== undefined) {
                listeners.forEach((f) => f(key, value, isNew));
            }
        }
    }

    onDisconnect(table: this) {
        if (table.socket_open) {
            table.conn_listeners.forEach((f) => f(false));

            table.robot_conn_listeners.forEach((f) => f(false));

            // clear ntCache, it's no longer valid
            table.cache = new Map();

            table.socket_open = false;
            table.robot_connected = false;
            table.robot_addr = null;
            console.info("Socket closed");
        }

        // respawn the websocket
        setTimeout(() => table.createSocket(window.location.host), 300);
    }

    addGlobalListener(
        callback: (key: string, value: any, isNew: boolean) => void,
        notifyImmediately: boolean = true
    ) {
        this.global_listeners.add(callback);

        if (notifyImmediately === true) {
            this.cache.forEach((value, key) => callback(key, value, true));
        }

        return function unsubscribe() {
            this.globalListeners.delete(callback);
        };
    }

    addKeyListener(
        key: NT_Key,
        callback: (k: string, v: any, isNew: boolean) => void,
        notifyImmediately: boolean = true
    ) {
        const listeners = this.key_listeners.get(key);

        if (listeners === undefined) {
            this.key_listeners.set(key, new Set([callback]));
        } else {
            listeners.add(callback);
        }

        if (notifyImmediately === true) {
            const value = this.cache.get(key);
            if (value !== undefined) {
                callback(key, value, true);
            }
        }

        return () => this.key_listeners.get(key).delete(callback);
    }

    addRobotConnectionListener(
        callback: (robot_connected: boolean) => void,
        notifyImmediately: boolean = true
    ) {
        this.robot_conn_listeners.add(callback);

        if (notifyImmediately === true) {
            callback(this.robot_connected);
        }

        return () => this.robot_conn_listeners.delete(callback);
    }

    addWsConnectionListener(
        callback: (ws_connected: boolean) => void,
        notifyImmediately: boolean = true
    ) {
        this.conn_listeners.add(callback);

        if (notifyImmediately === true) callback(this.socket_open);

        return () => this.conn_listeners.delete(callback);
    }

    putValue<T>(key: NT_Key, value: T) {
        if (!this.socket_open) return false;

        if (value === undefined)
            throw new Error(`${key}: 'undefined' passed to putValue`);

        this.socket.send(encode({ k: key, v: value }));
        return true;
    }

    getValue<T>(key: NT_Key, defaultValue: T): T {
        const val = this.cache.get(key);
        if (val === undefined) return defaultValue;
        else return val;
    }

    keySelector(key: NT_Key): string {
        return encodeURIComponent(key).replace(
            /([;&,.+*~':"!^#$%@\[\]()=>|])/g,
            "\\$1"
        );
    }

    keyToId(key: NT_Key): string {
        return encodeURIComponent(key);
    }
}
export function find_parent(
    entry: NtEntry,
    flatmap_tables: Map<string, NtTable>
): NtTable {
    return flatmap_tables.get(entry.parent_path);
}

export class NtTable {
    path: string;
    name: string;
    entries: Set<NtEntry>;

    constructor(path: string) {
        this.entries = new Set();
        this.path = path;
        this.name = path.slice(1).split("/").pop();
    }

    get has_parent(): boolean {
        return this.parent_name !== "";
    }

    get parent_name(): string {
        return this.path.split("/").slice(-2, -1)[0];
    }

    updateEntry(e: NtEntry): void {
        let found_in_set = false;
        this.entries.forEach((v) => {
            if (v.key === e.key) {
                v.value = e.value;
                found_in_set = true;
            }
        });
        if (!found_in_set) this.entries.add(e);
    }
}

export class NtEntry {
    key: string;
    value: any;

    constructor(key: string, value) {
        this.key = key;
        this.value = value;
    }

    get parent_path() {
        return this.key.split("/").slice(0, -1).join("/");
    }
}
