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
        this.name = path.slice(1).split("/").pop();
    }

    get has_parent(): boolean {
        return this.parent_name !== "";
    }

    get parent_name(): string {
        return this.path.split("/").slice(-2, -1)[0];
    }

    addSubtable(t: NtTable): void {
        this.subtables.add(t);
    }

    updateEntry(e: NtEntry): void {
        this.entries.add(e);
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
let entries = new Map<string, NtEntry>();

function find_parent(
    entry: NtEntry,
    flatmap_tables: Map<string, NtTable> = tables
): NtTable {
    return flatmap_tables.get(entry.parent_path);
}

table.addGlobalListener((k: string, v: any, is_new: boolean) => {
    let e = new NtEntry(k, v);
    entries.set(k, e);

    let parent_table = new NtTable(e.parent_path);
    if (tables.has(parent_table.path)) {
        tables.get(parent_table.path).updateEntry(e);
    } else {
        parent_table.updateEntry(e);
        tables.set(parent_table.path, parent_table);
    }
});
