// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// Core modules
import path from "path";

// Public modules from npm
import { BrowserWindow } from "electron";

// Local modules
import { VIEW_SERVER_PORT } from "../constants";

/**
 * Create the BrowserWindow which will show the reCAPTCHA widget.
 * @param siteurl HTTP URL of the website where harvest the captcha
 * @param sitekey Unique alphanumeric code associate with the website
 * @param id ID for this specific captcha harvest
 */
export async function createCaptchaWindow(
  siteurl: string,
  sitekey: string,
  id: string
): Promise<BrowserWindow> {
  // Create the window
  const w = new BrowserWindow({
    width: 320,
    height: 92,
    show: true,
    frame: true,
    // resizable: false,
    // minimizable: false,
    // maximizable: false,
    // alwaysOnTop: true,
    webPreferences: {
      //devTools: false,
      preload: path.join(__dirname, "..", "preload.js") // Use a preload script
    }
  });

  // Disable menubar
  //w.setMenu(null);

  await w.webContents.session.setProxy({
    mode: "fixed_servers",
    proxyRules: `http=127.0.0.1:${VIEW_SERVER_PORT}`,
    proxyBypassRules: ".google.com, .gstatic.com"
  });

  const u = new URL(siteurl);
  u.searchParams.set("sitekey", sitekey);
  u.searchParams.set("id", id);
  w.loadURL(u.toString());

  return w;
}
