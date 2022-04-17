import { NT, NtEntry, NtTable } from "./nt.js";
// import "jquery";
// import "jquery-ui";

interface AppWindow {
    title: string;
    register(nt: NT): void;
    render(win: JQuery<HTMLElement>): JQuery<HTMLElement>;
}
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
class App implements AppWindow {
    title: string;
    data_table: JQuery<HTMLElement>;
    pipe: any;

    constructor(title: string) {
        this.title = title;
        // this.data_table = $('<table')
    }

    register(nt: NT): void {
        let t = this;
        nt.addKeyListener("/limelight/pipeline", (k, v, is_new) => {
            t.pipe = v as number;
        });
    }

    render(): JQuery<HTMLElement> {
        return $("<h2>").text("Pipeline Active => " + this.pipe);
    }
}

$(function () {
    let nt = new NT();
    let w = new App("Limelight Pipeline");
    w.register(nt);
    let app_win = $("#app-window");
    $("#titlebar span").text(w.title);
    $("#app-content").append(w.render());

    let k;
    app_win.resizable();
    app_win.draggable({
        handle: "#titlebar",
        containment: $("#desktop"),
    });
    $("#close-win").on("click", (event) => (k = app_win.detach()));
    $("#windows-button").on("click", (event) => $("#desktop").append(k));
    function render() {
        $("#app-content").html("").append(w.render());
    }
    setInterval(render, 1000);
});
