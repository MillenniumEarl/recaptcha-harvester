// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/*
to use this example, create an .env file
in the project root with the following values:

WEBSITE = The website containing the CAPTCHA
SITEKEY = UNIQUE-SITE-KEY
*/

// Public npm modules
import dotenv from "dotenv";

// Local modules
import { CaptchaHarvest } from ".";

// Configure the .env reader
dotenv.config();

async function main() {
  // Create and start harvester
  const harvester = new CaptchaHarvest();
  await harvester.start("reCAPTCHAv2");
  console.log("Harvester started correctly");

  // Check if the environment variables are set
  if (!process.env.WEBSITE || !process.env.SITEKEY) {
    throw new Error(
      "You must set a .env file with WEBSITE and SITEKEY variables"
    );
  }

  // Fetch the token
  try {
    const data = await harvester.getCaptchaToken(
      process.env.WEBSITE,
      process.env.SITEKEY
    );
    console.log(`Token retrieved:\n${data.token}`);
  } catch (e) {
    console.log(e);
  }

  // Stop the harvester
  harvester.stop();
  console.log("Harvester terminated");
}

main();
