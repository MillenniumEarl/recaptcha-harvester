// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// Public modules from npm
import WebSocket from "ws";
import { v4 as uuid } from "uuid";

// Local modules
import {
  ICaptchaError,
  ICaptchaMessage,
  ICaptchaRequest,
  ICaptchaResponse,
  IResponseData
} from "./interfaces";
import { startServers, stopServers } from "./main";
import { HARVEST_SERVER_PORT } from "./constants";

export default class CaptchaHarvest {
  // Fields
  initialized: boolean = false;
  socket: WebSocket = undefined;

  /**
   * Initialize the servers used to get and process the CAPTCHA widget.
   */
  async start(): Promise<CaptchaHarvest> {
    if (this.initialized) throw new Error("Harvester already initialized");

    // Start server and wait for socket to open
    startServers();
    this.socket = new WebSocket(`ws://127.0.0.1:${HARVEST_SERVER_PORT}`);
    await waitForOpenConnection(this.socket);

    this.initialized = true;
    return this;
  }

  /**
   * Stop the servers used to get and process the CAPTCHA widget.
   */
  stop(): void {
    if (!this.initialized)
      throw new Error(
        "Unable to terminate an harvester that was never started"
      );

    // Stop servers and close open socket
    stopServers();
    this.socket.close();

    this.initialized = false;
  }

  /**
   * Gets a valid token for the requested site.
   * @param url URL of the site to request the token from
   * @param sitekey Unique key associated with the site
   */
  getCaptchaToken(url: string, sitekey: string): Promise<IResponseData> {
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
        } else if (parsed?.type == "Response") {
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
