import { NT, NtTable } from "./nt.js";
import "/lib/jquery.min.js";
import "/lib/jquery-ui.min.js";

/**
 * The goal of this is to keep track of its state internally
 * and render an HTMLElement from its state.
 *
 * The state should be updated from callback methods registered by a method
 * that accepts a NetworkTable instance.
 *
 * These should also have a common interface that takes a NetworkTable
 * instance and registers all its callbacks so that they can all add
 * their own callbacks for diff keys.
 */
class App {
    private title: string;
    protected window: JQuery<HTMLElement>;
    protected uid: string;

    constructor(title: string, uid: string = title) {
        this.title = title;
        this.uid = uid;
        this.window = this.create_window();
        this.window.appendTo("#desktop");
    }

    private create_window(): JQuery<HTMLElement> {
        let titlebar = $("<div></div>").addClass("app-titlebar").append(
            $("<span></span>").text(this.title)
            // TODO add buttons to titlebar
        );
        let content_space = $("<div></div>").addClass("app-content");
        return $("<div></div>")
            .addClass("app-window")
            .attr({
                id: this.uid,
                style: "position: absolute;",
            })
            .resizable()
            .draggable({
                handle: ".app-titlebar",
            })
            .append(titlebar, content_space);
        // TODO maybe don't stack them all ontop of each other?
    }

    protected render_elem(data: JQuery<HTMLElement>) {
        let content_area = this.window.children().filter(".app-content");
        content_area.children().detach();
        data.appendTo(content_area);
    }
}

interface Nt_Input {
    publish_input(nt: NT): void;
}

interface Nt_Renderable {
    register(nt: NT): void;
    render(): void;
}

class SimpleDisplay extends App implements Nt_Renderable {
    private value: any;
    private key: string;

    constructor(key: string, title: string = key) {
        super(title, key.replace(/\//g, ""));
        this.key = key;
    }

    register(nt: NT) {
        const t = this;
        nt.add_key_listener(this.key, (_k, v, _n) => {
            t.value = v;
        });
    }

    render() {
        super.render_elem($("<h3>").text(this.value));
    }
}

class Selectable extends App implements Nt_Input, Nt_Renderable {
    private opts: string[];
    private nt_selected: string;
    private nt_default: string;

    private nt_opts_key: string;
    private nt_selected_key: string;
    private nt_default_key: string;

    constructor(selector_table: NtTable) {
        super("AUTO", "auton-selector");
        this.nt_opts_key = selector_table.path + "/options";
        this.nt_selected_key = selector_table.path + "/selected";
        this.nt_default_key = selector_table.path + "/default";
    }

    private create_form(nt_default: string, opts: string[]) {
        let f = `<form><select id='${this.uid}-selector'>`;
        opts = opts !== undefined ? opts : [""];
        opts.forEach((o) => {
            const def_tagged = o == nt_default ? "selected" : "";
            f += `<option ${def_tagged}>${o}</option>`;
        });
        return $(f + "</select></form>");
    }

    register(nt: NT) {
        const t = this;
        nt.add_key_listener(this.nt_opts_key, (_k, v, _n) => {
            t.opts = v as string[];
            console.log(t.opts);
            t.render();
        });
        nt.add_key_listener(this.nt_selected_key, (k, v, n) => {
            t.nt_selected = v;
            t.render();
        });
    }

    private user_selection(): string {
        const selector = this.window
            .find(`${this.uid}-selector`)
            .get(0) as HTMLSelectElement;
        return this.opts[selector.options.selectedIndex];
    }

    render() {
        const dropdown = this.create_form(this.nt_selected, this.opts);
        super.render_elem(dropdown);
    }

    publish_input(nt: NT) {
        nt.put_value<string>(this.nt_selected, this.nt_selected);
    }
}

$(function () {
    const nt = new NT();
    const auto_c = new Selectable(new NtTable("/SmartDashboard/AutonChooser"));
    auto_c.register(nt);
    auto_c.render();
});
