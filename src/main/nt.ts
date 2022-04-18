import { encode, decode } from "./util.js";

type NT_Key = string;
type KeyListener = (k: string, v: any, is_new: boolean) => void;
type ConnectionListener = (connected: boolean) => void;
type Unsubscriber = () => void;

export class NT {
    private socket: WebSocket;
    robot_addr: string;
    robot_connected: boolean;
    socket_open: boolean;
    private conn_listeners: Set<ConnectionListener>;
    private robot_conn_listeners: Set<ConnectionListener>;
    private global_listeners: Set<KeyListener>;
    private key_listeners: Map<NT_Key, Set<KeyListener>>;
    private cache: Map<NT_Key, any>;

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

    private createSocket(host: string): void {
        const address = `ws://${host}/networktables/ws`;

        this.socket = new WebSocket(address);
        if (this.socket) {
            this.socket.binaryType = "arraybuffer";
            this.socket.onopen = () => this.onConnect(this);
            this.socket.onclose = () => this.onDisconnect(this);
            this.socket.onmessage = (msg) => this.onMessage(this, msg);
        }
    }

    private onConnect(table: this): void {
        console.info("Socket opened");
        table.socket_open = true;
        table.conn_listeners.forEach((f) => f(true));
    }

    private onMessage(table: this, msg: MessageEvent<any>): void {
        const data = decode(msg.data);

        // robot connection event
        if (data.r !== undefined) {
            table.robot_connected = data.r as boolean;
            table.robot_addr = data.a as string;
            table.robot_conn_listeners.forEach((f) => f(table.robot_connected));
        } else {
            // data changed on websocket
            const key = data["k"] as string;
            const value = data["v"];
            const is_new = data["n"] as boolean;

            table.cache.set(key, value);

            // notify global listeners
            table.global_listeners.forEach((f) => f(key, value, is_new));

            // notify key-specific listeners
            const listeners = table.key_listeners.get(key);
            if (listeners !== undefined) {
                listeners.forEach((f) => f(key, value, is_new));
            }
        }
    }

    private onDisconnect(table: this): void {
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

    add_global_listener(callback: KeyListener): Unsubscriber {
        this.global_listeners.add(callback);

        this.cache.forEach((value, key) => callback(key, value, true));

        return () => this.global_listeners.delete(callback);
    }

    add_key_listener(key: NT_Key, callback: KeyListener): Unsubscriber {
        const listeners = this.key_listeners.get(key);
        const value = this.cache.get(key);

        if (value !== undefined) callback(key, value, true);

        if (listeners === undefined) {
            this.key_listeners.set(key, new Set([callback]));
        } else {
            listeners.add(callback);
        }

        return () => this.key_listeners.get(key).delete(callback);
    }

    add_robot_connection_listener(callback: ConnectionListener): Unsubscriber {
        this.robot_conn_listeners.add(callback);
        callback(this.robot_connected);
        return () => this.robot_conn_listeners.delete(callback);
    }

    add_ws_connection_listener(callback: ConnectionListener): Unsubscriber {
        this.conn_listeners.add(callback);
        callback(this.socket_open);
        return () => this.conn_listeners.delete(callback);
    }

    put_value<T>(key: NT_Key, value: T): boolean {
        if (!this.socket_open) return false;

        if (value === undefined)
            throw new Error(`${key}: 'undefined' passed to putValue`);

        this.socket.send(encode({ k: key, v: value }));
        return true;
    }

    get_value<T>(key: NT_Key, default_value: T): T {
        const val = this.cache.get(key);
        if (val === undefined) return default_value;
        else return val;
    }

    key_selector(key: NT_Key): string {
        return encodeURIComponent(key).replace(
            /([;&,.+*~':"!^#$%@\[\]()=>|])/g,
            "\\$1"
        );
    }

    key_to_id(key: NT_Key): string {
        return encodeURIComponent(key);
    }
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
