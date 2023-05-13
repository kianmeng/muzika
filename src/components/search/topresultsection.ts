import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { SearchContent, TopResult } from "../../muse.js";
import { InlineCard } from "./inlinecard.js";
import { TopResultCard } from "./topresultcard.js";

export class TopResultSection extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "TopResultSection",
      Template:
        "resource:///com/vixalien/muzika/components/search/topresultsection.ui",
      InternalChildren: ["title", "flowbox", "content"],
    }, this);
  }

  _title!: Gtk.Label;
  _flowbox!: Gtk.FlowBox;
  _content!: Gtk.ListBox;

  constructor() {
    super();

    this._flowbox.connect("child-activated", this.child_activated.bind(this));
  }

  child_activated(_: this, child: TopResultCard) {
    if (!(child instanceof TopResultCard) || !(child.result)) return;

    let uri: string | null = null;

    switch (child.result.type) {
      case "artist":
        uri = `artist:${child.result.browseId}`;
        break;
      case "album":
        uri = `album:${child.result.browseId}`;
        break;
    }

    if (uri) {
      const root = this.get_root() as Gtk.Window;

      if (!root) return;

      const app = root.application;

      app.activate_action("navigate", GLib.Variant.new("s", "muzika:" + uri));
    }
  }

  add_more_content(content: SearchContent) {
    let card = new InlineCard();

    switch (content.type) {
      case "song":
        card.set_song(content);
        break;
      case "video":
        card.set_video(content);
        break;
      case "album":
        card.set_album(content);
        break;
      case "artist":
        card.set_artist(content);
        break;
      case "playlist":
        card.set_playlist(content);
        break;
      default:
        console.error("Unknown search content type", content.type);
        return;
    }

    this._content.append(card);
  }

  show_top_result(top_result: TopResult) {
    let card = new TopResultCard();

    switch (top_result.type) {
      case "song":
        card.set_song(top_result);
        break;
      case "video":
        card.set_video(top_result);
        break;
      case "album":
        card.set_album(top_result);
        break;
      case "artist":
        card.set_artist(top_result);
        break;
        // default:
        //   console.error("Unknown top result type", top_result.type);
        //   return;
    }

    if (top_result.more && top_result.more.length > 0) {
      top_result.more.forEach(this.add_more_content.bind(this));
    } else {
      const second_flowbox = this._flowbox.get_child_at_index(1);
      if (second_flowbox) {
        second_flowbox.visible = false;
      }
      this._flowbox.max_children_per_line = 1;
    }

    this._flowbox.prepend(card);
  }
}
