// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// Core modules
import path from "path";

// Public modules from npm
import { BrowserWindow, app } from "electron";

// Local modules
import { VIEW_SERVER_PORT_HTTP, VIEW_SERVER_PORT_HTTPS } from "../constants";

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
    title: `Captcha harvest: ${new URL(siteurl).hostname}`,
    width: 320,
    height: 120,
    show: true,
    frame: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    webPreferences: {
      devTools: false,
      preload: path.join(__dirname, "..", "preload.js") // Use a preload script
    }
  });

  // These lines allow Electron to use Self-Signed SSL certificates
  app.commandLine.appendSwitch("allow-insecure-localhost");
  app.commandLine.appendSwitch("ignore-certificate-errors");

  // Disable menubar
  w.setMenu(null);

  await w.webContents.session.setProxy({
    mode: "fixed_servers",
    proxyRules: `http=localhost:${VIEW_SERVER_PORT_HTTP};https=localhost:${VIEW_SERVER_PORT_HTTPS}`,
    proxyBypassRules: ".google.com, .gstatic.com, .hcaptcha.com"
  });

  // Prepare and load URL
  const u = new URL(siteurl);
  u.searchParams.set("sitekey", sitekey);
  u.searchParams.set("id", id);
  w.loadURL(u.toString());

  w.webContents.on(
    "certificate-error",
    (event, _url, _error, _certificate, callback) => {
      event.preventDefault();
      callback(true);
    }
  );

  return w;
}
