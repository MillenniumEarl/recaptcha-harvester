// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import CaptchaHarvest from ".";

const WEBSITE = "";
const SITEKEY = "";

new CaptchaHarvest()
  .start() // Start servers and WebSocket
  .then((harvester) => {
    console.log("Harvester started correctly");
    harvester
      .getCaptchaToken(WEBSITE, SITEKEY)
      .then((data) => console.log(`Token retrieved: ${data.token}`))
      .catch((e: Error) => console.log(e.message))
      .finally(() => harvester.stop());
  });
