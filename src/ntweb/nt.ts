import { encode, decode } from "./util.js";

type NtKey = string;

export class NT {
    socket: WebSocket;
    robotAddress: string;
    robotConnected: boolean;
    socketOpen: boolean;
    connectionListeners: Set<any>;
    robotConnectionListeners: Set<any>;
    globalListeners: Set<any>;
    keyListeners: Map<NtKey, any>;
    ntCache: Map<NtKey, any>;

    constructor(host: string) {
        this.socket = null;
        this.robotAddress = null;
        this.robotConnected = false;
        this.socketOpen = false;
        this.connectionListeners = new Set();
        this.robotConnectionListeners = new Set();
        this.globalListeners = new Set();
        this.keyListeners = new Map();
        this.ntCache = new Map();
        if (host == undefined) host = window.location.host;
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
        table.socketOpen = true;
        table.connectionListeners.forEach((f) => f(true));
    }

    onMessage(table: this, msg: MessageEvent<any>) {
        const data = decode(msg.data);

        // robot connection event
        if (data.r !== undefined) {
            table.robotConnected = data.r;
            table.robotAddress = data.a;
            table.robotConnectionListeners.forEach((f) =>
                f(table.robotConnected)
            );
        } else {
            // data changed on websocket
            const key = data["k"];
            const value = data["v"];
            const isNew = data["n"];

            table.ntCache.set(key, value);

            // notify global listeners
            table.globalListeners.forEach((f) => f(key, value, isNew));

            // notify key-specific listeners
            const listeners = table.keyListeners.get(key);
            if (listeners !== undefined) {
                listeners.forEach((f) => f(key, value, isNew));
            }
        }
    }

    onDisconnect(table: this) {
        if (table.socketOpen) {
            table.connectionListeners.forEach((f) => f(false));

            table.robotConnectionListeners.forEach((f) => f(false));

            // clear ntCache, it's no longer valid
            table.ntCache = new Map();

            table.socketOpen = false;
            table.robotConnected = false;
            table.robotAddress = null;
            console.info("Socket closed");
        }

        // respawn the websocket
        setTimeout(() => table.createSocket(window.location.host), 300);
    }

    addGlobalListener(callback, notifyImmediately) {
        this.globalListeners.add(callback);

        if (notifyImmediately === true) {
            this.ntCache.forEach((value, key) => callback(key, value, true));
        }

        return function unsubscribe() {
            this.globalListeners.delete(callback);
        };
    }

    addKeyListener(key: NtKey, callback, notifyImmediately: boolean) {
        const listeners = this.keyListeners.get(key);

        if (listeners === undefined) {
            this.keyListeners.set(key, new Set([callback]));
        } else {
            listeners.add(callback);
        }

        if (notifyImmediately === true) {
            const value = this.ntCache.get(key);
            if (value !== undefined) {
                callback(key, value, true);
            }
        }

        return () => this.keyListeners.get(key).delete(callback);
    }

    addRobotConnectionListener(callback, notifyImmediately: boolean) {
        this.robotConnectionListeners.add(callback);

        if (notifyImmediately === true) {
            callback(this.robotConnected);
        }

        return () => this.robotConnectionListeners.delete(callback);
    }

    addWsConnectionListener(callback, notifyImmediately: boolean) {
        this.connectionListeners.add(callback);

        if (notifyImmediately === true) callback(this.socketOpen);

        return () => this.connectionListeners.delete(callback);
    }

    putValue(key: NtKey, value: any) {
        if (!this.socketOpen) return false;

        if (value === undefined)
            throw new Error(key + ": 'undefined' passed to putValue");

        this.socket.send(encode({ k: key, v: value }));
        return true;
    }

    getValue(key: NtKey, defaultValue: any) {
        const val = this.ntCache.get(key);
        if (val === undefined) return defaultValue;
        else return val;
    }

    keySelector(str: string) {
        return encodeURIComponent(str).replace(
            /([;&,.+*~':"!^#$%@\[\]()=>|])/g,
            "\\$1"
        );
    }

    create_map() {
        return new Map();
    }

    keyToId(key: NtKey) {
        return encodeURIComponent(key);
    }
}
