// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// Core modules
import path from "path";
import http from "http";
import https from "https";
import { readFile } from "fs/promises";

// Public modules from npm
import express from "express";
import WebSocket from "ws";

// Local modules
import {
  ICaptchaMessage,
  ICaptchaRequest,
  ICaptchaError,
  CaptchaType
} from "../interfaces";

/**
 * Initialize the server that will provide the captcha widget.
 * @param port Listening port
 * @param protocol Protocol used in the server
 * @param type Type of CAPTCHA
 */
export async function startCaptchaViewServer(
  port: number,
  protocol: "HTTP" | "HTTPS",
  type: CaptchaType = "reCAPTCHAv2"
): Promise<http.Server | https.Server> {
  // Create the server
  // deepcode ignore UseCsurfForExpress: This is only a local server, deepcode ignore UseHelmetForExpress: This is only a local server
  const e = express();
  e.disable("x-powered-by");

  // Get the widget path
  const basePath = path.join(__dirname, "..", "..", "widget");
  const filename = type === "reCAPTCHAv2" ? "recaptcha.html" : "hcaptcha.html";
  const widgetPath = path.join(basePath, filename);

  // Serve style and scripts
  e.use("/scripts", express.static(path.join(basePath, "scripts")));
  e.use("/styles", express.static(path.join(basePath, "styles")));

  // At every GET request, serve the CAPTCHA widget
  e.get("/", (_req, res) => res.sendFile(widgetPath));

  // Load Self-Signed SSL key for HTTPS server
  const securityPath = path.join(__dirname, "..", "..", "security");
  const httpsOptions = {
    key: await readFile(path.join(securityPath, "cert.key")),
    cert: await readFile(path.join(securityPath, "cert.pem")),
    requestCert: false,
    rejectUnauthorized: false
  };

  return new Promise((resolve) => {
    const server =
      protocol === "HTTP"
        ? http.createServer(e)
        : https.createServer(httpsOptions, e);
    server.listen(port, () => resolve(server));
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
