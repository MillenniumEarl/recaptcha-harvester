// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import electron from "electron";
import proc from "child_process";
import WebSocket from "ws";
import uuidv4 from "uuid/v4";

class EzHarvest {
  constructor() {
    process.on("exit", () => {
      if (this.child) {
        this.child.kill();
      }
    });
  }

  start() {
    if (this.child) {
      throw new Error("ez-harvest already running");
    }

    this.child = proc.spawn(electron, [
      `${__dirname}/main.js`,
      "--programmatic"
    ]);

    return new Promise((resolve) => {
      const initInterval = setInterval(() => {
        let ws = new WebSocket("ws://127.0.0.1:8457");
        ws.on("open", () => {
          clearInterval(initInterval);
          resolve();
        });
        ws.on("error", () => {
          ws = null;
          console.log("Connecting to ez-harvest...");
        });
      }, 100);
    });
  }

  getCaptchaToken(pageUrl, sitekey, autoClick = false) {
    const ws = new WebSocket("ws://127.0.0.1:8457");

    ws.on("open", () => {
      const request = {
        type: "CaptchaRequest",
        data: {
          pageUrl: pageUrl,
          sitekey: sitekey,
          captchaId: uuidv4(),
          autoClick: autoClick
        }
      };
      ws.send(JSON.stringify(request));
    });

    return new Promise((resolve, reject) => {
      ws.once("message", (message) => {
        const parsedMessage = JSON.parse(message);
        const messageType = parsedMessage["type"];
        const messageData = parsedMessage["data"];

        switch (messageType) {
          case "CaptchaResponse":
            resolve(messageData);
            break;
          case "Error":
            reject(messageData);
        }
      });
    });
  }
}

module.exports = EzHarvest;
