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
    title: string;
    public window: JQuery<HTMLElement>;
    public uid: string;

    constructor(title: string, uid: string = title) {
        this.title = title;
        this.uid = uid;
        this.window = this.create_window();
        this.window.appendTo("#desktop");
    }

    private create_window(): JQuery<HTMLElement> {
        let titlebar = $("<div></div>").addClass("app-titlebar").append(
            $("<span></span>").text(this.title)
            // $(""), // todo add buttons to titlebar
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

class SimpleDisplay extends App {
    private value: any;
    private key: string;

    constructor(key: string, title: string = key) {
        super(title, key.replace(/\//g, ""));
        this.key = key;
    }

    register(nt: NT) {
        const t = this;
        nt.add_key_listener(this.key, (k, v, n) => {
            t.value = v;
        });
    }

    render() {
        super.render_elem($("<h3>").text(this.value));
    }
}

class Selectable extends App {
    private selected: string;
    private set_to: string;
    private read_opts_from: string;
    private opts: string[];
    private dropdown: JQuery<HTMLElement>;

    constructor(table_read: NtTable) {
        super("AUTO", "auton-selector");
        this.dropdown = this.create_form([""]);
    }

    create_form(opts: string[]) {
        let f = "<form><select id=" + this.uid + "-selector>";
        for (let o of opts) {
            f += "<option>" + o + "</option>";
        }
        return $(f + "</select></form>");
    }

    register(nt: NT) {
        const t = this;
        nt.add_key_listener(this.read_opts_from, (k, v, n) => {
            this.opts = v as string[];
        });
    }

    send(nt: NT) {
        nt.put_value<string>(this.set_to, this.selected);
    }
}

$(function () {
    let nt = new NT();

    let apps: SimpleDisplay[] = [];

    for (let i = 0; i < 20; i++) {
        let a = new SimpleDisplay(
            "/SmartDashboard/AutonChooser/selected",
            "LL-" + i
        );
        a.register(nt);
        apps.push(a);
    }

    function render_windows() {
        for (let i of apps) {
            i.render();
        }
        nt.put_value("/SmartDashboard/AutonChooser/selected", "Taxi Only");
    }

    setInterval(render_windows, 100);
});
