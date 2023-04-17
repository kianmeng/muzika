/* MIT License
 *
 * Copyright (c) 2023 Chris Davis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * SPDX-License-Identifier: MIT
 */

import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Adw from "gi://Adw";

import { HomePage } from "./components/home.js";
import { Navigator } from "./navigation.js";

export class Window extends Adw.ApplicationWindow {
  static {
    GObject.registerClass(
      {
        Template: "resource:///org/example/TypescriptTemplate/window.ui",
        InternalChildren: ["stack", "header_bar", "progress"],
      },
      this,
    );
  }

  _stack!: Gtk.Stack;
  _header_bar!: Gtk.HeaderBar;
  _progress!: Gtk.ProgressBar;

  navigator: Navigator;

  interval: number | null = null;

  constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProperties>) {
    super(params);

    this.navigator = new Navigator(this._stack, this._header_bar);

    this.navigator.navigate(
      "playlist:RDCLAK5uy_nygdXoGdKANvbCAAFJECxxmy9x8illDhc",
    );

    this.navigator.connect("notify::loading", () => {
      if (this.interval) clearInterval(this.interval);

      if (this.navigator.loading) {
        this._progress.pulse();

        this.interval = setInterval(() => {
          this._progress.pulse();
        }, 1000);
      } else {
        this._progress.fraction = 0;
      }
    });

    // const home_page = new HomePage();
    // home_page.load_home();
    // this._box.append(home_page);
  }
}
