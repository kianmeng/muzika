import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

export function escape_label(label: string) {
  return label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function indent_stack(stack: string) {
  return escape_label(
    stack
      .split("\n")
      .map((line) => `    ${escape_label(line)}`)
      .join("\n"),
  );
}

export function error_to_string(error: Error) {
  // must show error name, message, and stack
  return `<b>${escape_label(error.name)}: </b>${escape_label(error.message)}\n${
    indent_stack(error.stack ?? "")
  }`;
}

export class ErrorPage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "ErrorPage",
      Template: "resource:///com/vixalien/muzika/pages/error.ui",
      InternalChildren: [
        "status",
        "more",
        "text_view",
      ],
    }, this);
  }

  _status!: Adw.StatusPage;
  _more!: Gtk.Box;
  _text_view!: Gtk.TextView;

  buffer: Gtk.TextBuffer;

  constructor() {
    super();

    this._text_view.buffer = this.buffer = new Gtk.TextBuffer();
  }

  set_message(message: string) {
    this._status.set_description(message);
  }

  set_more(show: boolean, label?: string) {
    this._more.visible = show;
    if (label) {
      this.buffer.text = "";
      this.buffer.insert_markup(
        this.buffer.get_start_iter(),
        `<tt>${label.replace(/\n$/, "")}</tt>`,
        -1,
      );
    }
  }

  set_error(error: any) {
    if (error instanceof Error) {
      this.set_message(error.message);
      this.set_more(true, error_to_string(error));
    } else {
      this.set_message(error ? "Error: " + error : "Unknown error");
      this.set_more(false);
    }
  }
}
