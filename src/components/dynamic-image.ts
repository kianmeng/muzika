import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { Application } from "src/application.js";
import { Window } from "src/window.js";

export enum DynamicImageState {
  DEFAULT,
  LOADING,
  PLAYING,
  PAUSED,
}

export class DynamicImage extends Gtk.Overlay {
  static {
    GObject.registerClass({
      GTypeName: "DynamicImage",
      Template: "resource:///com/vixalien/muzika/components/dynamic-image.ui",
      InternalChildren: [
        "stack",
        "play",
        "play_image",
        "wave",
        "loading",
        "pause",
        "pause_image",
        "blank",
        "image_stack",
      ],
      Children: ["image", "picture"],
      Properties: {
        "icon-size": GObject.ParamSpec.int(
          "icon-size",
          "Icon size",
          "The size of the icons inside the image",
          GObject.ParamFlags.READWRITE,
          0,
          1000,
          0,
        ),
        "image-size": GObject.ParamSpec.int(
          "image-size",
          "Image size",
          "The size of the image",
          GObject.ParamFlags.READWRITE,
          0,
          1000,
          0,
        ),
        "state": GObject.ParamSpec.int(
          "state",
          "State",
          "The state of the image",
          GObject.ParamFlags.READWRITE,
          DynamicImageState.DEFAULT,
          DynamicImageState.PAUSED,
          DynamicImageState.DEFAULT,
        ),
        "persistent-play-button": GObject.ParamSpec.boolean(
          "persistent-play-button",
          "Persistent play button",
          "Whether the play button should alwas show persistent",
          GObject.ParamFlags.READWRITE,
          true,
        ),
        "show-picture": GObject.ParamSpec.boolean(
          "show-picture",
          "Show picture",
          "Whether the picture should be shown",
          GObject.ParamFlags.READWRITE,
          false,
        ),
      },
      Signals: {
        pause: {},
        play: {},
      },
    }, this);
  }

  private _stack!: Gtk.Stack;
  private _play!: Gtk.Button;
  private _play_image!: Gtk.Image;
  private _wave!: Gtk.Image;
  private _loading!: Gtk.Spinner;
  private _pause!: Gtk.Button;
  private _pause_image!: Gtk.Image;
  private _blank!: Gtk.Box;
  private _image_stack!: Gtk.Stack;

  image!: Gtk.Image;
  picture!: Gtk.Picture;

  private _state: DynamicImageState = DynamicImageState.DEFAULT;

  get state() {
    return this._state;
  }

  set state(state: DynamicImageState) {
    this._state = state;
    this.update_stack(this.controller.contains_pointer);
  }

  get icon_size() {
    return this._wave.pixel_size;
  }

  set icon_size(size: number) {
    this._loading.width_request = size;

    const images = [this._play_image, this._wave, this._pause_image];

    for (const image of images) {
      image.remove_css_class("lowres-icon");
      image.remove_css_class("icon-dropshadow");

      image.add_css_class(size < 32 ? "lowres-icon" : "icon-dropshadow");

      image.pixel_size = size;
    }
  }

  get image_size() {
    return this.image.pixel_size;
  }

  set image_size(size: number) {
    this.image.pixel_size = size;

    this.picture.height_request = size;
    this.picture.width_request = size * (16 / 9);

    ["br-6", "br-9"].map((br_class) => {
      this.remove_css_class(br_class);
    });

    if (size <= 48) {
      this.add_css_class("br-6");
    } else {
      this.add_css_class("br-9");
    }
  }

  private _persistent_play_button = true;

  get persistent_play_button() {
    return this._persistent_play_button;
  }

  set persistent_play_button(persistent: boolean) {
    this._persistent_play_button = persistent;
    this.update_stack(this.controller.contains_pointer);
  }

  get show_picture() {
    return this._image_stack.visible_child === this.picture;
  }

  set show_picture(show: boolean) {
    this._image_stack.visible_child = show ? this.picture : this.image;
  }

  private controller: Gtk.EventControllerMotion;

  constructor(props: DynamicImageProps = {}) {
    super(props);

    this.icon_size = props.icon_size ?? 32;
    this.image_size = props.image_size ?? 160;

    // hover events
    this.controller = new Gtk.EventControllerMotion();

    this.controller.connect("enter", () => {
      this.update_stack(true);
    });

    this.controller.connect("leave", () => {
      this.update_stack(false);
    });

    this.add_controller(this.controller);

    // pause button
    this._pause.connect("clicked", () => {
      this.emit("pause");
    });
  }

  private update_stack(hovering = false) {
    let stop_spinning = true;

    switch (this.state) {
      case DynamicImageState.DEFAULT:
        if (hovering) {
          this._stack.add_css_class("osd");
          this._stack.visible_child = this._play;
        } else {
          this._stack.remove_css_class("osd");
          if (this.persistent_play_button) {
            this._stack.visible_child = this._play;
          } else {
            this._stack.visible_child = this._blank;
          }
        }
        break;
      case DynamicImageState.LOADING:
        stop_spinning = false;
        this._stack.visible_child = this._loading;
        this._loading.spinning = true;
        this._stack.add_css_class("osd");
        break;
      case DynamicImageState.PLAYING:
        this._stack.add_css_class("osd");
        if (hovering) {
          this._stack.visible_child = this._pause;
        } else {
          this._stack.visible_child = this._wave;
        }
        break;
      case DynamicImageState.PAUSED:
        this._stack.visible_child = this._play;
        this._stack.add_css_class("osd");
        break;
    }

    if (stop_spinning && this._loading.spinning) {
      this._loading.spinning = false;
    }
  }

  private get_player() {
    return ((this.get_root() as Window)?.application as Application)
      ?.player;
  }

  private listeners: number[] = [];

  private map_listener: number | null = null;

  private setup_button = false;

  reset_listeners() {
    const player = this.get_player();

    if (player) {
      this.listeners.forEach((listener) => {
        player.disconnect(listener);
      });
    }

    this.listeners = [];
  }

  videoId: string | null = null;
  playlistId: string | null = null;

  setup_listeners(videoId: string, playlistId: string | null = null) {
    this.videoId = videoId;
    this.playlistId = playlistId;

    if (this.map_listener != null) {
      this.disconnect(this.map_listener);
    }

    this.reset_listeners();

    const player = this.get_player();

    if (!player) {
      this.map_listener = this.connect("map", () => {
        this.setup_listeners(videoId, playlistId);
      });
      return;
    }

    if (!this.setup_button) {
      this._play.connect("clicked", () => {
        this.emit("play");

        if (player.current_meta?.item?.track.videoId === this.videoId) {
          player.play();
        } else if (this.videoId) {
          if (this.playlistId) {
            this.state = DynamicImageState.LOADING;
            player.queue.play_playlist(this.playlistId, this.videoId);
          } else {
            this.state = DynamicImageState.LOADING;
            player.queue.play_song(this.videoId);
          }
        }
      });

      this._pause.connect("clicked", () => {
        if (player.current_meta?.item?.track.videoId === this.videoId) {
          player.pause();
        }
      });

      this.setup_button = true;
    }

    // if the video is already playing, we need to update the state
    if (
      player.current_meta?.item?.track.videoId === this.videoId
    ) {
      if (player.playing) {
        this.state = DynamicImageState.PLAYING;
        this.emit("play");
      } else {
        this.state = DynamicImageState.PAUSED;
        this.emit("pause");
      }
    }

    this.listeners.push(...[
      player.connect(`start-loading::${videoId}`, () => {
        this.state = DynamicImageState.LOADING;
        this.emit("play");
      }),
      player.connect(`stop-loading::${videoId}`, () => {
        if (
          player.current_meta?.item?.track.videoId === this.videoId &&
          player.playing
        ) {
          this.state = DynamicImageState.PLAYING;
        } else {
          this.state = DynamicImageState.PAUSED;
        }
      }),
      player.connect(`start-playback::${videoId}`, () => {
        this.state = DynamicImageState.PLAYING;
      }),
      player.connect(`pause-playback::${videoId}`, () => {
        this.state = DynamicImageState.PAUSED;
      }),
      player.connect(`stop-playback::${videoId}`, () => {
        this.state = DynamicImageState.DEFAULT;
      }),
    ]);
  }
}

export interface DynamicImageProps
  extends Partial<Gtk.Overlay.ConstructorProperties> {
  icon_size?: number;
  image_size?: number;
}