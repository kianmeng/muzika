import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

import { MixedItem } from "../../muse.js";

import { ObjectContainer } from "../../util/objectcontainer.js";

import { RequiredMixedItem } from "../carousel/index.js";
import { AlbumCard } from "../carousel/albumcard.js";
import { ArtistCard } from "../carousel/artistcard.js";
import { PlaylistCard } from "../carousel/playlistcard.js";
import { SongCard } from "../carousel/songcard.js";
import { VideoCard } from "../carousel/videocard.js";

export class Grid extends Gtk.GridView {
  static {
    GObject.registerClass({
      GTypeName: "Grid",
    }, this);
  }

  list_model = Gio.ListStore.new(ObjectContainer.$gtype);

  constructor() {
    super({
      max_columns: 18,
      min_columns: 2,
      single_click_activate: true,
    });

    this.remove_css_class("view");

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("bind", this.bind_cb.bind(this));

    this.factory = factory;
    this.model = Gtk.NoSelection.new(this.list_model);
    this.connect("activate", this.activate_cb.bind(this));
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const object = list_item.get_item() as ObjectContainer<RequiredMixedItem>;
    const item = object.item!;

    let card;

    switch (item.type) {
      case "song":
        card = new SongCard();
        card.set_song(item);
        break;
      case "inline-video":
        card = new VideoCard();
        card.set_inline_video(item);
        break;
      case "video":
        card = new VideoCard();
        card.set_video(item);
        break;
      case "album":
        card = new AlbumCard();
        card.set_album(item);
        break;
      case "playlist":
        card = new PlaylistCard();
        card.set_playlist(item);
        break;
      case "channel":
      case "artist":
        card = new ArtistCard();
        card.set_artist(item);
        break;
      default:
        console.warn("Invalid item in carousel", item.type);
    }

    if (card) {
      card.add_css_class("padding-6");
      card.halign = Gtk.Align.CENTER;

      list_item.set_child(card);

      const parent = card.get_parent();

      if (parent) {
        parent.margin_start = 6;
        parent.margin_bottom = 6;
        parent.add_css_class("br-9");

        parent.add_css_class("background");
      }
    }
  }

  activate_cb(_list_view: Gtk.ListView, position: number) {
    const object = this.model.get_item(position) as ObjectContainer<
      RequiredMixedItem
    >;
    const item = object.item!;

    if (!item) return;

    let uri: string | null = null;

    switch (item.type) {
      case "playlist":
      case "watch-playlist":
        uri = `playlist:${item.playlistId}`;
        break;
      case "artist":
      case "channel":
        uri = `artist:${item.browseId}`;
        break;
      case "album":
        uri = `album:${item.browseId}`;
        break;
      case "inline-video":
      case "song":
      case "video":
      case "flat-song":
        if (item.videoId) {
          this.activate_action(
            "queue.play-song",
            GLib.Variant.new_string(
              item.videoId,
            ),
          );
        }
        break;
    }

    if (uri) {
      this.activate_action(
        "navigator.visit",
        GLib.Variant.new_string("muzika:" + uri),
      );
    }
  }

  show_items(items: MixedItem[]) {
    for (const item of items) {
      if (!item) continue;

      this.list_model.append(ObjectContainer.new(item as RequiredMixedItem));
    }
  }
}
