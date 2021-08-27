// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// Core modules
import assert from "assert";
import path from "path";
import { Server } from "http";

// Public modules from npm
import { BrowserWindow, ipcMain } from "electron";
import express from "express";
import WebSocket from "ws";

// Local modules
import {
  ICaptchaError,
  ICaptchaMessage,
  ICaptchaRequest,
  ICaptchaResponse,
  IResponseData
} from "./interfaces";
import { VIEW_SERVER_PORT, HARVEST_SERVER_PORT } from "./constants";

// Global variables and constants
const captchaWindowBank: { [s: string]: BrowserWindow } = {};
let captchaViewServer = undefined;
let captchaHarvestServer = undefined;

/**
 * Create the BrowserWindow which will show the reCAPTCHA widget.
 * @param pageUrl
 * @param sitekey
 * @param id
 * @param autoClick
 */
async function createCaptchaWindow(
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
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    webPreferences: {
      devTools: false,
      preload: path.join(__dirname, "preload.js") // Use a preload script
    }
  });

  // Disable menubar
  w.setMenu(null);

  // Captcha has failed if we haven't responded by now
  w.once("closed", () => ipcMain.emit(`failed-captcha-${id}`));
  w.once("ready-to-show", () => w.show());

  await w.webContents.session.setProxy({
    mode: "fixed_servers",
    proxyRules: `http=127.0.0.1:${VIEW_SERVER_PORT};https=127.0.0.1`,
    proxyBypassRules: ".google.com, .gstatic.com"
  });

  const u = new URL(siteurl);
  u.searchParams.set("sitekey", sitekey);
  u.searchParams.set("id", id);
  w.loadURL(u.toString());

  return w;
}

async function handleCaptchaRequest(ws: WebSocket, message: ICaptchaRequest) {
  // Verify the parameters
  assert.notStrictEqual(message.siteurl, undefined);
  assert.notStrictEqual(message.sitekey, undefined);
  assert.notStrictEqual(message.id, undefined);

  // Show the window with the Captcha
  captchaWindowBank[message.id] = await createCaptchaWindow(
    message.siteurl,
    message.sitekey,
    message.id
  );

  ipcMain.on("resize", (_event, args) => {
    captchaWindowBank[args.id].setSize(args.width, args.height);
    captchaWindowBank[args.id].center();
  });

  ipcMain.once(`failed-captcha-${message.id}`, () => {
    // The window closes without verify the captcha
    const response: ICaptchaError = {
      type: "Error",
      error: "Captcha Window Closed"
    };
    ws.send(JSON.stringify(response));
  });

  ipcMain.once(`submit-captcha-${message.id}`, (_event, arg) => {
    // Captcha resolved, close the window
    captchaWindowBank[message.id].close();

    // Return the response
    const data: IResponseData = {
      token: arg.value,
      createdAt: arg.createdAt
    };
    const response: ICaptchaResponse = {
      type: "Response",
      data: data
    };
    ws.send(JSON.stringify(response));
  });
}

/**
 * Initialize the server that will provide the captcha widget.
 * @param port Listening port
 */
function startCaptchaViewServer(port: number): Server {
  // Create the server
  const e = express();

  // Get the widget path
  const widgetPath = path.join(__dirname, "widget", "captcha.html");

  // At every GET request, return the CAPTCHA widget
  e.get("/", (_req, res) => res.sendFile(widgetPath));

  // Start listening on the port
  return e.listen(port);
}

function startCaptchaHarvestServer(port: number): WebSocket.Server {
  // Create a new WebServer listening on a specific port
  const wss = new WebSocket.Server({
    port: port
  });

  wss.on("connection", (ws) => {
    ws.on("message", (message) => {
      // Parse the incoming message
      const parsedMessage: ICaptchaMessage = JSON.parse(message.toString());

      // Check if the format is valid
      if (parsedMessage?.type === "Request") {
        handleCaptchaRequest(ws, parsedMessage as ICaptchaRequest);
      } else {
        const response: ICaptchaError = {
          type: "Error",
          error: "Invalid Message Format"
        };
        ws.send(JSON.stringify(response));
      }
    });
  });

  return wss;
}

export function startServers(): void {
  captchaViewServer = startCaptchaViewServer(VIEW_SERVER_PORT);
  captchaHarvestServer = startCaptchaHarvestServer(HARVEST_SERVER_PORT);
}

export function stopServers(): void {
  captchaViewServer.close();
  captchaHarvestServer.close();
}
