// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// Core modules
import path from "path";
import { Server } from "http";

// Public modules from npm
import express from "express";
import WebSocket from "ws";

// Local modules
import { ICaptchaMessage, ICaptchaRequest, ICaptchaError } from "../interfaces";

/**
 * Initialize the server that will provide the captcha widget.
 * @param port Listening port
 */
export function startCaptchaViewServer(port: number): Promise<Server> {
  // Create the server
  const e = express();

  // Get the widget path
  const basePath = path.join(__dirname, "..", "..", "widget");
  const widgetPath = path.join(basePath, "captcha.html");

  // Serve style and scripts
  //e.use("/scripts", express.static(path.join(basePath, "scripts")));
  //e.use("/styles", express.static(path.join(basePath, "styles")));

  // At every GET request, serve the CAPTCHA widget
  e.get("/", (_req, res) => res.sendFile(widgetPath));

  return new Promise((resolve) => {
    const server = e.listen(port, () => resolve(server));
  });
}

/**
 * Initialize the server that will handle token obtaining requests.
 * @param port Listening port
 */
export function startCaptchaHarvestServer(
  port: number,
  handle: (ws: WebSocket, message: ICaptchaRequest) => void
): WebSocket.Server {
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
        handle(ws, parsedMessage as ICaptchaRequest);
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
