import { NT } from "./nt.js";
import "./jquery-2.2.2.min.js";

if (!("WebSocket" in window)) {
    alert("Your browser does not support websockets, this will fail!");
}

class NtTable {
    path: string;
    name: string;
    subtables: Set<NtTable>;
    entries: Set<NtEntry>;

    constructor(path: string) {
        this.subtables = new Set();
        this.entries = new Set();
        this.path = path;
        this.name = path.slice(1).split("/").slice(-1)[0];
        console.log(this.name);
    }

    get parent() {
        return this.path.split("/")[-2];
    }

    get parent_path() {
        return this.path.split("/").slice(0, -1).join("/");
    }

    addSubtable(t: NtTable) {
        if (t.parent === this.name) {
            this.subtables.add(t);
        }
    }

    updateEntry(e: NtEntry) {
        if (e.parent_path === this.name) {
            this.entries.add(e);
        }
    }
}

class NtEntry {
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

let table = new NT(window.location.host);

let tables = new Map<string, NtTable>();

table.addGlobalListener((k: string, v: any, is_new: boolean) => {
    let e = new NtEntry(k, v);
    if (!tables.has(e.parent_path)) {
        let t = new NtTable(e.parent_path);
        tables.set(t.path, t);
    } else {
        tables.get(e.parent_path).updateEntry(e);
    }
    console.log(tables);
}, true);
