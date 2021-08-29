// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// Core modules
import assert from "assert";
import { Server } from "http";

// Public modules from npm
import { BrowserWindow, ipcMain, app } from "electron";
import WebSocket from "ws";

// Local modules
import {
  ICaptchaError,
  ICaptchaRequest,
  ICaptchaResponse,
  IResponseData
} from "./interfaces";
import { VIEW_SERVER_PORT, HARVEST_SERVER_PORT } from "./constants";
import {
  startCaptchaViewServer,
  startCaptchaHarvestServer
} from "./auxiliary/server";
import { createCaptchaWindow } from "./auxiliary/captcha-window";

// Global variables and constants
const captchaWindowBank: { [s: string]: BrowserWindow } = {};
let captchaViewServer: Server = undefined;
let captchaHarvestServer: WebSocket.Server = undefined;

/**
 * It manages the creation of the window with the RECAPTCHA
 * widget and the transmission of the received token.
 */
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
    if (captchaWindowBank[args.id]) {
      captchaWindowBank[args.id].setSize(args.width, args.height);
      captchaWindowBank[args.id].center();
    }
  });

  // Captcha has failed if we haven't responded by now
  captchaWindowBank[message.id].once("closed", () => {
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
    captchaWindowBank[message.id] = null;

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

export async function startServers(): Promise<void> {
  captchaViewServer = await startCaptchaViewServer(VIEW_SERVER_PORT);
  captchaHarvestServer = startCaptchaHarvestServer(
    HARVEST_SERVER_PORT,
    handleCaptchaRequest
  );
}

export function stopServers(): void {
  captchaViewServer.close();
  captchaHarvestServer.close();
  app.quit();
}

// Start the servers when this script is called in the main process
app.on("ready", () => startServers());

// Prevent to quit this process when all the window are closed
app.on("window-all-closed", (e) => e.preventDefault());

// Stop the servers when this process is killed
app.on("before-quit", () => stopServers());
