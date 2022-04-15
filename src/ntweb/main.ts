import { NT } from "./nt.js";
import "./jquery-2.2.2.min.js";

if (!("WebSocket" in window)) {
    alert("Your browser does not support websockets, this will fail!");
}

class NtTable {
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

function nt_path_to_id(nt_path: string): string {
    return nt_path.slice(1).replace(/\//g, "_").replace(/ /g, "-");
}

function update_html_table(tables: Iterable<NtTable>) {
    for (let t of tables) {
        let table_id = nt_path_to_id(t.path);
        let table = $("#" + table_id);

        // create table if doesn't exists
        console.debug(table, table_id);
        if (document.getElementById(table_id) === null) {
            $(`<h1>${t.name}</h1>`).appendTo("body");
            $("<table></table>")
                .attr("id", table_id)
                .attr("border", 1)
                .appendTo("body");
        }

        // populate it with the entries
        for (let e of t.entries) {
            let key_id = nt_path_to_id(e.key);

            if (document.getElementById(`${key_id}`) === null) {
                // create the row for the entry since it doesn't exist
                let new_row = $("<tr></tr>").appendTo(`#${table_id}`);

                // add the key and value pair into the row
                $("<td></td>").text(e.key).appendTo(new_row);
                $("<td></td>")
                    .text(e.value)
                    .attr("id", key_id)
                    .appendTo(new_row);
            } else {
                // just update the cell with the new data
                $("#" + key_id).text(e.value);
            }
        }
    }
}

setInterval(() => {
    update_html_table(tables.values());
}, 3000);
