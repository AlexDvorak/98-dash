import { NT } from "./nt.js";
import "./jquery-2.2.2.min.js";

if (!("WebSocket" in window)) {
    alert("Your browser does not support websockets, this will fail!");
}

class NtTable {
    path: string;
    name: string;
    subtables: NtTable[];
    entries: NtEntry[];

    constructor(path: string) {
        this.path = path;
        this.name = path.slice(1).split("/")[-1];
    }

    get parent() {
        return this.path.slice(1).split("/")[-2];
    }

    addSubtable(t: NtTable) {
        if (t.parent === this.name) {
            this.subtables.push(t);
        }
    }

    addEntry(e: NtEntry) {
        if (e.parent == this.name) {
            this.entries.push(e);
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

    get parent() {
        return this.key.slice(1).split("/")[-2];
    }
}

let table = new NT(window.location.host);

table.addGlobalListener((k, v, is_new) => {
    if (is_new) {
    } else {
        $(`<p>'${k}' changed to '${v}'<br>`).appendTo("body");
    }
}, true);
