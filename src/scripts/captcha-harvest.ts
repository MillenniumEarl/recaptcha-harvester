// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// Core modules
import proc from "child_process";
import { join, basename } from "path";

// Public modules from npm
import WebSocket from "ws";
import { v4 as uuid } from "uuid";
import ipc from "node-ipc";
import { app } from "electron";

// Local modules
import {
  ICaptchaError,
  ICaptchaMessage,
  ICaptchaRequest,
  ICaptchaResponse,
  CaptchaType,
  IResponseData
} from "./interfaces";
import { HARVEST_SERVER_PORT } from "./constants";

export default class CaptchaHarvest {
  // Fields
  /**
   * WebSocket used to communicate with the servers initialized in the child process.
   */
  socket: WebSocket | null = null;
  /**
   * Child process used start a Electron instance to show the CAPTCHA widget.
   */
  child: proc.ChildProcess | null = null;

  /**
   * Start the IPC server used to communicate with the child process.
   */
  private startIPCServer() {
    ipc.config.id = "captcha-harvester-main-process";
    ipc.config.retry = 1500;
    ipc.config.silent = true;
    ipc.serve();
    ipc.server.start();
  }

  private runChild(modulePath: string): proc.ChildProcess {
    // First check if the process is running as Electron instance
    const runAsElectron = isElectron();

    // Use exec for node process and spawn for Electron process
    // The spawn command is the implementation of the fork method
    // but without the default parameter ELECTRON_RUN_AS_NODE=1.
    // If fork is used no Electron module will be available in the child module
    const child = runAsElectron
      ? proc.spawn(getElectronBinariesPath(), [modulePath])
      : proc.execFile("electron", [modulePath], { shell: true }, (error) => {
          if (error) {
            throw new Error(`${error.code}: ${error.message}`);
          }
        });

    // Rethrow child's error
    child.on("error", (error) => {
      throw error;
    });

    return child;
  }

  /**
   * Initialize the servers used to get and process the CAPTCHA widget.
   */
  async start(type: CaptchaType): Promise<CaptchaHarvest> {
    if (this.child) throw new Error("Harvester already initialized");

    // Start IPC server for process communication
    this.startIPCServer();

    // Send the type of CAPTCHA we want
    ipc.server.on("ipc-loaded", (_, socket) =>
      ipc.server.emit(socket, "captcha-type", type)
    );

    // Start the servers and the electron process in a separate process
    const path = join(__dirname, "main.js");
    this.child = this.runChild(path);

    return new Promise((resolve) => {
      ipc.server.on("servers-ready", () => {
        // Instantiate the socket
        this.socket = new WebSocket(`ws://127.0.0.1:${HARVEST_SERVER_PORT}`);

        // Return this CaptchaHarvest
        resolve(this);
      });
    });
  }

  /**
   * Stop the servers used to get and process the CAPTCHA widget.
   */
  stop(): void {
    if (!this.child || !this.socket) throw new Error("Harvester not started");

    // Kill child process
    ipc.server.broadcast("kill");

    // Close open socket
    this.socket.close();

    // Close IPC server
    ipc.server.stop();

    // Delete the reference to the variable
    this.socket = null;
    this.child = null;
  }

  /**
   * Gets a valid token for the requested site.
   * @param url URL of the site to request the token from
   * @param sitekey Unique key associated with the site
   */
  async getCaptchaToken(url: string, sitekey: string): Promise<IResponseData> {
    // Local variables
    const SLEEP_TIME = 100;
    const TIMEOUT = 30000;
    let waitTime = 0;

    if (!this.child) throw new Error("Harvester not started");

    // Wait for the socket to be established
    while (!this.socket) {
      await sleep(SLEEP_TIME);

      waitTime += SLEEP_TIME;
      if (waitTime >= TIMEOUT) {
        throw new Error(
          `Timeout: The connection to the socket required more time than expected (${TIMEOUT})`
        );
      }
    }

    // Wait for the socket to be open
    await waitForOpenConnection(this.socket);

    // Parse and convert the url to use HTTP
    const domain = new URL(url);
    const parsedURL = `http://${domain.hostname}`;

    // Send request to harvest reCAPTCHA token
    const request: ICaptchaRequest = {
      type: "Request",
      siteurl: parsedURL,
      sitekey: sitekey,
      id: uuid()
    };
    this.socket.send(JSON.stringify(request));

    return new Promise<IResponseData>((resolve, reject) => {
      const socket = this.socket as WebSocket;
      socket.on("message", (message) => {
        // Parse the incoming response
        const parsed: ICaptchaMessage = JSON.parse(message.toString());
        if (parsed?.type === "Error") {
          const e = parsed as ICaptchaError;
          reject(new Error(e.error));
        } else if (parsed?.type === "Response") {
          const r = parsed as ICaptchaResponse;
          resolve(r.data);
        } else reject(new Error("Unexpected response message"));
      });
    });
  }
}

/**
 * Check if the current process is a Electron's Renderer instance.
 */
function isRendererProcess(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window?.process === "object" &&
    window.process.type === "renderer"
  );
}

/**
 * Check if the current process is a Electron's Main instance.
 */
function isMainProcess(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process?.versions === "object" &&
    !!process.versions.electron
  );
}

/**
 * Check if the current process is a Electron
 * instance with enabled node integration.
 */
function hasNodeIntegration(): boolean {
  return (
    typeof navigator === "object" &&
    typeof navigator.userAgent === "string" &&
    navigator.userAgent.indexOf("Electron") >= 0
  );
}

/**
 * Check if the current process is a Electron instance.
 */
function isElectron(): boolean {
  return isRendererProcess() || isMainProcess() || hasNodeIntegration();
}

/**
 * Wait for the WebSocket to open.
 * @param attemps Maximum number of opening attempts
 * @param interval Milliseconds every when to check that the socket is open
 */
function waitForOpenConnection(
  socket: WebSocket,
  attemps = 10,
  interval = 200
) {
  return new Promise<void>((resolve, reject) => {
    let currentAttempt = 0;

    // Check for opening every interval value
    const i = setInterval(() => {
      if (currentAttempt >= attemps) {
        // Too many attemps
        clearInterval(i);
        reject(new Error("Maximum number of opening attempts exceeded"));
      } else if (socket.readyState === socket.OPEN) {
        // The socket is open, exit from method
        clearInterval(i);
        resolve();
      }

      // Increment attemp counter
      currentAttempt++;
    }, interval);
  });
}

/**
 * Sleep for the specified amount of milliseconds.
 */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if the module is in an ASAR archive (i.e. with `electron-builder`).
 */
function isModulePacked() {
  return basename(app.getAppPath()).includes("app.asar") || app.isPackaged;
}

/**
 * Get the binary path of electron if this process is run as Electron.
 */
function getElectronBinariesPath() {
  const isPacked = isModulePacked();

  // This is the path to the folder app.asar.unpacked
  const asarUnpackedPath = app
    .getAppPath()
    .replace("app.asar", "app.asar.unpacked");

  // Path to Electron build of this module
  const pathToElectron = join(
    "node_modules",
    "@millenniumearl",
    "recaptcha-harvester",
    "node_modules",
    "electron",
    "dist",
    "electron.exe"
  );

  return isPacked ? join(asarUnpackedPath, pathToElectron) : process.execPath;
}
