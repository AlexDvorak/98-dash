import { NT } from "./nt.js";

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
    private window: JQuery<HTMLElement>;
    private render_ctxt: JQuery<HTMLElement>;
    private uid: string;

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
            .attr("id", this.uid)
            .resizable()
            .draggable({
                handle: ".app-titlebar",
            })
            .append(titlebar, content_space);
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
        nt.addKeyListener(this.key, (k, v, n) => {
            t.value = v;
        });
    }

    render() {
        super.render_elem($("<h3>").text(this.value));
    }
}

$(function () {
    let nt = new NT();
    let curr_pipe = new SimpleDisplay("/limelight/pipeline");
    let selected_auto = new SimpleDisplay(
        "/SmartDashboard/AutonChooser/active"
    );
    curr_pipe.register(nt);
    selected_auto.register(nt);

    function render_windows() {
        curr_pipe.render();
        selected_auto.render();
    }

    setInterval(render_windows, 1000);
});
