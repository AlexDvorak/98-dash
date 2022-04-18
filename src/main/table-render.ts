import { NT, NtEntry, NtTable } from "./nt.js";
import "/lib/jquery.min.js";

if (!("WebSocket" in window)) {
    alert("Your browser does not support websockets, this will fail!");
}

let table = new NT(window.location.host);

let tables = new Map<string, NtTable>();
let entries = new Map<string, NtEntry>();

table.add_global_listener((k: string, v: any, is_new: boolean) => {
    const e = new NtEntry(k, v);
    entries.set(k, e);

    let parent_table = new NtTable(e.parent_path);
    if (tables.has(parent_table.path)) {
        tables.get(parent_table.path).updateEntry(e);
    } else {
        parent_table.updateEntry(e);
        tables.set(parent_table.path, parent_table);
    }
});

table.add_robot_connection_listener((connected) => {
    if (connected) {
        $("#robot-state").text(`Connected @ ${table.robot_addr}`);
    } else {
        $("#robot-state").text("Not Connected");
    }
});

table.add_ws_connection_listener((ws_connected) => {
    $("#connect-state").text(
        ws_connected ? "Connected to server" : "Disconnected from server"
    );
});

function nt_path_to_id(nt_path: string): string {
    return nt_path.replace(/\//g, "_").replace(/ /g, "-").replace(/\./g, "_");
}

function update_html_table(tables: Iterable<NtTable>) {
    for (let t of tables) {
        const table_id = nt_path_to_id(t.path);
        let table = $("#" + table_id);

        // create table if doesn't exists
        if (!table.length) {
            $(`<h1>${t.name}</h1>`).appendTo("body");
            $("<table></table>")
                .attr("id", table_id)
                .attr("border", 1)
                .appendTo("body");
            table = $("#" + table_id);
        }

        // populate it with the entries
        for (let entry of t.entries) {
            const key_id = nt_path_to_id(entry.key);
            const entry_value_cell = $("#" + key_id);
            // create row for the entry if it doesn't exist
            if (!entry_value_cell.length) {
                // create the row for the entry since it doesn't exist
                const new_row = $("<tr></tr>").appendTo(table);
                $("<td></td>").text(entry.key).appendTo(new_row);

                if (typeof entry.value === "boolean") {
                    $("<td></td>")
                        .attr({
                            id: key_id,
                            style: `background-color: ${
                                entry.value ? "green" : "red"
                            }`,
                        })
                        .appendTo(new_row);
                } else {
                    // add the key and value pair into the row
                    $("<td></td>")
                        .text(entry.value)
                        .attr("id", key_id)
                        .appendTo(new_row);
                }
            } else {
                if (typeof entry.value === "boolean") {
                    // just update the cell with the new data
                    entry_value_cell.attr({
                        style: `background-color: ${
                            entry.value ? "green" : "red"
                        }`,
                    });
                } else {
                    entry_value_cell.text(entry.value);
                }
            }
        }
    }
}

setInterval(() => {
    update_html_table(tables.values());
}, 3000);
