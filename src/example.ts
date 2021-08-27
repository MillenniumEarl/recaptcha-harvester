// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// Local modules
import CaptchaHarvest from ".";

// Global variables
const WEBSITE = "https://f95zone.to";
const SITEKEY = "6LcwQ5kUAAAAAAI-_CXQtlnhdMjmFDt-MruZ2gov";

async function main() {
  // Create and start harvester
  const harvester = new CaptchaHarvest();
  await harvester.start();
  console.log("Harvester started correctly");

  // Fetch the token
  try {
    const data = await harvester.getCaptchaToken(WEBSITE, SITEKEY);
    console.log(`Token retrieved: ${data.token}`);
  } catch (e) {
    console.log(e);
  }

  // Stop the harvester
  harvester.stop();
}

main();
