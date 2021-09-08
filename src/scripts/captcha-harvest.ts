// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// Core modules
import proc from "child_process";
import { join } from "path";

// Public modules from npm
import WebSocket from "ws";
import { v4 as uuid } from "uuid";
import ipc from "node-ipc";

// Local modules
import {
  ICaptchaError,
  ICaptchaMessage,
  ICaptchaRequest,
  ICaptchaResponse,
  IResponseData
} from "./interfaces";
import { HARVEST_SERVER_PORT } from "./constants";

export default class CaptchaHarvest {
  // Fields
  /**
   * WebSocket used to communicate with the servers initialized in the child process.
   */
  socket: WebSocket;
  /**
   * Child process used start a Electron instance to show the CAPTCHA widget.
   */
  child: proc.ChildProcess;

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

  /**
   * Check if the current process is a Electron's Renderer instance.
   */
  private isRendererProcess(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window?.process === "object" &&
      window.process.type === "renderer"
    );
  }

  /**
   * Check if the current process is a Electron's Main instance.
   */
  private isMainProcess(): boolean {
    return (
      typeof process !== "undefined" &&
      typeof process?.versions === "object" &&
      !!process.versions.electron
    );
  }

  /**
   * Check if the current process is a Electron
   * instance with enabled node inntegration.
   */
  private hasNodeIntegration(): boolean {
    return (
      typeof navigator === "object" &&
      typeof navigator.userAgent === "string" &&
      navigator.userAgent.indexOf("Electron") >= 0
    );
  }

  /**
   * Check if the current process is a Electron instance.
   */
  private isElectron(): boolean {
    return (
      this.isRendererProcess() ||
      this.isMainProcess() ||
      this.hasNodeIntegration()
    );
  }

  private runChild(modulePath: string): proc.ChildProcess {
    // First check if the process is running as Electron instance
    const runAsElectron = this.isElectron();

    // Use exec for node process and spawn for Electron process
    // The spawn command is the implementation of the fork method
    // but without the default parameter ELECTRON_RUN_AS_NODE=1.
    // If fork is used no Electron module will be available in the child module
    const child = runAsElectron
      ? proc.spawn(process.execPath, [modulePath])
      : proc.exec(`electron ${modulePath}`, (error) => {
          if (error) throw new Error(`${error.code}: ${error.message}`);
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
  async start(): Promise<CaptchaHarvest> {
    if (this.child) throw new Error("Harvester already initialized");

    // Start IPC server for process communication
    this.startIPCServer();

    // Start the servers and the electron process in a separate process
    const path = join(__dirname, "main.js");
    this.child = this.runChild(path);

    // Start and wait for socket to open
    ipc.server.on(
      "servers-ready",
      () =>
        (this.socket = new WebSocket(`ws://127.0.0.1:${HARVEST_SERVER_PORT}`))
    );

    return this;
  }

  /**
   * Stop the servers used to get and process the CAPTCHA widget.
   */
  stop(): void {
    if (!this.child) throw new Error("Harvester not started");

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
    if (!this.child) throw new Error("Harvester not started");

    // Wait for the socket to be ready
    while (!this.socket) await sleep(200);
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
      this.socket.on("message", (message) => {
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
