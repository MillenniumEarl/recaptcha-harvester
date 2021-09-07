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
import ipc from "node-ipc";

// Local modules
import {
  ICaptchaError,
  ICaptchaRequest,
  ICaptchaResponse,
  IResponseData
} from "./interfaces";
import {
  HARVEST_SERVER_PORT,
  VIEW_SERVER_PORT_HTTP,
  VIEW_SERVER_PORT_HTTPS
} from "./constants";
import {
  startCaptchaViewServer,
  startCaptchaHarvestServer
} from "./auxiliary/server";
import { createCaptchaWindow } from "./auxiliary/captcha-window";

// Global variables and constants
const CAPTCHA_WINDOWS_BANK: { [s: string]: BrowserWindow } = {};
const MAIN_PROCESS_IPC_ID = "captcha-harvester-main-process";
let captchaViewServerHTTP: Server;
let captchaViewServerHTTPS: Server;
let captchaHarvestServer: WebSocket.Server;
let ipcClient: any;

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
  CAPTCHA_WINDOWS_BANK[message.id] = await createCaptchaWindow(
    message.siteurl,
    message.sitekey,
    message.id
  );

  ipcMain.on("resize", (_event, args) => {
    if (CAPTCHA_WINDOWS_BANK[args.id]) {
      CAPTCHA_WINDOWS_BANK[args.id].setSize(args.width, args.height);
      CAPTCHA_WINDOWS_BANK[args.id].center();
    }
  });

  // Captcha has failed if we haven't responded by now
  CAPTCHA_WINDOWS_BANK[message.id].once("closed", () => {
    // The window closes without verify the captcha
    const response: ICaptchaError = {
      type: "Error",
      error: "Captcha Window Closed"
    };
    ws.send(JSON.stringify(response));
  });

  // If the Electron window doesn't load, send this error.
  // Usually is a -324:ERR_EMPTY_RESPONSE caused by HTTPS servers
  CAPTCHA_WINDOWS_BANK[message.id].webContents.on(
    "did-fail-load",
    (_e, code, description) => {
      const response: ICaptchaError = {
        type: "Error",
        error: `${code}: ${description}`
      };
      ws.send(JSON.stringify(response));
    }
  );

  ipcMain.once(`submit-captcha-${message.id}`, (_event, arg) => {
    // Captcha resolved, close the window
    CAPTCHA_WINDOWS_BANK[message.id].close();
    CAPTCHA_WINDOWS_BANK[message.id] = null;

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

function startIPCServer() {
  // Configure the IPC client
  ipc.config.id = "captcha-harvester-child-process";
  ipc.config.retry = 1500;
  ipc.config.silent = true;

  // Connnect to the main process
  ipc.connectTo(MAIN_PROCESS_IPC_ID);
  const client = ipc.of["captcha-harvester-main-process"];

  // Close servers when a "kill" message is received
  client.on("kill", () => stopServers());

  // Send the confirmation of IPC loading
  client.emit("ipc-loaded");
  return client;
}

export async function startServers(): Promise<void> {
  // Start the IPC client used to communicate with the main process
  ipcClient = startIPCServer();

  // Start the servers used to rendere the CAPTCHA in Electron
  captchaViewServerHTTP = await startCaptchaViewServer(
    VIEW_SERVER_PORT_HTTP,
    "HTTP"
  );
  captchaViewServerHTTPS = await startCaptchaViewServer(
    VIEW_SERVER_PORT_HTTPS,
    "HTTPS"
  );

  // Start the server used to fetch the local CAPTCHA
  captchaHarvestServer = startCaptchaHarvestServer(
    HARVEST_SERVER_PORT,
    handleCaptchaRequest
  );

  // Send a message to the main process to notificate that the servers are ready
  ipcClient.emit("servers-ready");
}

export function stopServers(): void {
  // Stop servers
  captchaViewServerHTTP.close();
  captchaViewServerHTTPS.close();
  captchaHarvestServer.close();

  // Close the IPC client (send a "socket.disconnected" event)
  ipc.disconnect(MAIN_PROCESS_IPC_ID);

  // Close this Electron instance
  app.exit();
}

// Start the servers when this script is called in the main process
app.on("ready", () => startServers());

// Prevent to quit this process when all the window are closed
app.on("window-all-closed", (e) => e.preventDefault());

// Stop the servers when this process is killed
app.on("before-quit", () => stopServers());
