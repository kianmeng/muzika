import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";

import { match, MatchFunction, MatchResult } from "path-to-regexp";

import { ERROR_CODE, MuseError } from "./muse.js";

import { Loading } from "./components/loading.js";
import { endpoints } from "./endpoints.js";
import { ErrorPage } from "./pages/error.js";
import { AddActionEntries } from "./util/action.js";
import { AuthenticationErrorPage } from "./pages/authentication-error.js";

export type EndpointCtx = {
  match: MatchResult<Record<string, string>>;
  url: URL;
  signal: AbortSignal;
};

export type EndpointResponse = {
  title?: string;
};

export type Endpoint<C extends Gtk.Widget> = {
  uri: string;
  title: string;
  component: () => C;
  load: <D extends C>(
    component: D,
    ctx: EndpointCtx,
  ) => void | Promise<void | EndpointResponse>;
};

export interface ShowPageOptions {
  title: string;
  page: Gtk.Widget;
  endpoint: Endpoint<Gtk.Widget>;
}

export class Navigator extends GObject.Object {
  private _stack: Gtk.Stack;
  private _header: Gtk.HeaderBar;
  private _error_page: ErrorPage;
  private _auth_page: AuthenticationErrorPage;

  private match_map: Map<MatchFunction, Endpoint<Gtk.Widget>> = new Map();

  loading = false;

  private static can_go_back_spec = GObject.ParamSpec.boolean(
    "can-go-back",
    "Can go back",
    "Whether the navigator can go back",
    GObject.ParamFlags.READWRITE,
    false,
  );

  private static can_go_forward_spec = GObject.ParamSpec.boolean(
    "can-go-forward",
    "Can go forward",
    "Whether the navigator can go forward",
    GObject.ParamFlags.EXPLICIT_NOTIFY | GObject.ParamFlags.READABLE,
    false,
  );

  static {
    GObject.registerClass({
      Signals: {
        navigate: {},
        "load-start": {},
        "load-end": {},
      },
      Properties: {
        loading: GObject.ParamSpec.boolean(
          "loading",
          "Loading",
          "Whether something is loading currently",
          GObject.ParamFlags.READWRITE,
          false,
        ),
        can_go_back: this.can_go_back_spec,
        can_go_forward: this.can_go_forward_spec,
      },
    }, this);
  }

  constructor(stack: Gtk.Stack, header: Gtk.HeaderBar) {
    super();

    this._stack = stack;
    this._header = header;

    this.match_map = new Map();

    for (const endpoint of endpoints) {
      const fn = match(endpoint.uri, {});
      this.match_map.set(fn, endpoint);
    }

    this._error_page = new ErrorPage();
    this._auth_page = new AuthenticationErrorPage();

    this.add_loading_page();
    this.add_error_pages();
  }

  get_action_group() {
    const action_group = new Gio.SimpleActionGroup();

    (action_group.add_action_entries as AddActionEntries)([
      {
        name: "visit",
        parameter_type: "s",
        activate: (_action, param) => {
          if (!param) return;

          const [url] = param.get_string();

          if (url) {
            if (url.startsWith("muzika:")) {
              this.navigate(url.slice(7));
            }
          }
        },
      },
      {
        name: "back",
        activate: () => {
          this.back();
        },
      },
      {
        name: "push-state",
        parameter_type: "s",
        activate: (_action, param) => {
          if (!param) return;

          this.pushState({ uri: param.get_string()[0] });
        },
      },
      {
        name: "replace-state",
        parameter_type: "s",
        activate: (_action, param) => {
          if (!param) return;

          this.replaceState({ uri: param.get_string()[0] });
        },
      },
    ]);

    action_group.action_enabled_changed("back", this.can_go_back);

    this.connect("notify::can-go-back", () => {
      action_group.action_enabled_changed("back", this.can_go_back);
    });

    return action_group;
  }

  private add_error_pages() {
    this._stack.add_named(this._error_page, "error");
    this._stack.add_named(this._auth_page, "auth-error");
  }

  private add_loading_page() {
    const loading_page = new Loading();

    this._stack.add_named(loading_page, "loading");
  }

  set_title(title: string) {
    const label = Gtk.Label.new(title);

    label.add_css_class("heading");

    this._header.set_title_widget(label);
  }

  private show_error(error: any) {
    if (error instanceof DOMException && error.code == DOMException.ABORT_ERR) {
      return;
    }

    this.loading = false;
    this.last_controller = null;

    if (error instanceof MuseError && error.code === ERROR_CODE.AUTH_REQUIRED) {
      this._header.set_title_widget(Gtk.Label.new("Authentication Required"));
      this._auth_page.set_error(error);
      this._stack.set_visible_child_name("auth-error");
      return;
    } else {
      this._header.set_title_widget(Gtk.Label.new("Error"));
      this._error_page.set_error(error);
      this._stack.set_visible_child_name("error");
    }
  }

  private show_page(meta: ShowPageOptions) {
    this.set_title(meta.title);

    const got_component = this._stack.get_child_by_name(meta.endpoint.uri);
    if (got_component) {
      this._stack.remove(got_component);
    }

    this._stack.add_named(meta.page, meta.endpoint.uri);
    this._stack.set_visible_child_name(meta.endpoint.uri);
  }

  last_controller: AbortController | null = null;

  private endpoint(
    uri: string,
    match: MatchResult,
    endpoint: Endpoint<Gtk.Widget>,
    history: boolean,
  ) {
    // for (const [fn, endpoint] of this.match_map) {
    //   if (fn(uri) === match) {
    //     return endpoint;
    //   }
    // }

    const url = new URL("muzika:" + uri);
    const component = endpoint.component();

    if (this.last_controller) {
      this.last_controller.abort();
    }

    this.last_controller = new AbortController();

    let response: ReturnType<Endpoint<Gtk.Widget>["load"]>;

    try {
      response = endpoint.load(component, {
        match: match as MatchResult<Record<string, string>>,
        url,
        signal: this.last_controller.signal,
      });

      if (!response) return null;

      // temporarily show an old page if it's available
      if (this._stack.get_child_by_name(uri)) {
        this._stack.set_visible_child_name(uri);
      }

      this.loading = true;

      response.then((meta = {}) => {
        this.loading = false;
        this.last_controller = null;

        this.show_page({
          title: meta?.title ?? endpoint.title,
          page: component,
          endpoint,
        });

        if (history) {
          if (url.searchParams.has("replace")) {
            this.replaceState({ uri });
          } else {
            this.pushState({ uri });
          }
        }
      }).catch((e) => {
        this.pushState({ uri });
        this.show_error(e);
      });
    } catch (e) {
      this.pushState({ uri });
      this.show_error(e);
    }

    return null;
  }

  private history: HistoryState[] = [];
  private future: HistoryState[] = [];

  get can_go_back() {
    return this.history.length > 1;
  }

  get can_go_forward() {
    return this.future.length > 0;
  }

  pushState(state: HistoryState) {
    this.history.push(state);

    this.notify("can-go-back");
  }

  replaceState(state: HistoryState) {
    this.history[this.history.length - 1] = state;
  }

  go(n: number) {
    if (n > 0) {
      this.history.push(...this.future.splice(-n));
      this._stack.transition_type = Gtk.StackTransitionType.SLIDE_LEFT;
    } else if (n < 0) {
      this.future.push(...this.history.splice(n));
      this._stack.transition_type = Gtk.StackTransitionType.SLIDE_RIGHT;
    }

    this.notify("can-go-back");
    this.notify("can-go-forward");

    const state = this.history[this.history.length - 1];

    if (!state) {
      return;
    }

    this.navigate(state.uri, false);
  }

  back() {
    this.go(-1);
  }

  forward() {
    this.go(1);
  }

  reload() {
    this.go(0);
  }

  navigate(uri: string, history = true) {
    if (history) {
      this._stack.transition_type = Gtk.StackTransitionType.SLIDE_LEFT;
    }

    // muzika:home to
    // muzika/home
    // only when it's not escaped (i.e not prefixed with \)
    const url = new URL("muzika:" + uri);

    const path = url.pathname.replace(/(?<!\\):/g, "/");

    for (const [fn, endpoint] of this.match_map) {
      const match = fn(path);

      if (match) {
        return this.endpoint(uri, match, endpoint, history);
      }
    }
  }
}

export interface HistoryState {
  uri: string;
}
