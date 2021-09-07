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
  socket: WebSocket;
  child: proc.ChildProcess;

  private startIPCServer() {
    ipc.config.id = "captcha-harvester-main-process";
    ipc.config.retry = 1500;
    ipc.config.silent = true;
    ipc.serve();
    ipc.server.start();
  }

  /**
   * Initialize the servers used to get and process the CAPTCHA widget.
   */
  async start(): Promise<CaptchaHarvest> {
    if (this.child) throw new Error("Harvester already initialized");

    // Start IPC server for prcess communicatio
    this.startIPCServer();

    // Start the servers and the electron process in a separate process
    const path = join(__dirname, "main.js");
    this.child = proc.exec(`electron ${path}`);

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
