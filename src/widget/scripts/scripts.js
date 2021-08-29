// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// Global constants
const MARGIN_WIDTH = 10;
const MARGIN_HEIGHT = 30;
const INITIAL_WIDTH = 300 + MARGIN_WIDTH;
const INITIAL_HEIGHT = 85 + MARGIN_HEIGHT;

function resizeReCaptcha(id) {
  // Select the reCAPTCHA popup frame (with squares)
  const challengeFrame = document.querySelectorAll("div > div > iframe")[1];

  if (challengeFrame) {
    // Get the parents of the challenge
    // frameParent CONTAINS challengeParent CONTAINS challengeFrame
    const challengeParent = challengeFrame.parentElement;
    const frameParent = challengeParent.parentElement;

    // Put the parent in the left-top corner
    challengeParent.style.position = "fixed";
    challengeParent.style.right = "";

    // Prepare resize message
    const options = {
      id: id,
      width: INITIAL_WIDTH,
      height: INITIAL_HEIGHT
    };

    if (frameParent.style.visibility === "visible") {
      options.width =
        parseInt(challengeFrame.style.width.replace("px", ""), 10) +
        MARGIN_WIDTH;
      options.height =
        parseInt(challengeFrame.style.height.replace("px", ""), 10) +
        MARGIN_HEIGHT;
    }

    // Send resize message via IPC
    console.log(`Resize: (${options.width}x${options.height})`);
    window.api.send("resize", options);
  }
}

function parseParameters() {
  /* Parse the query parameters */
  const urlSearchParams = new URLSearchParams(window.location.search);
  const params = Object.fromEntries(urlSearchParams.entries());

  /* Get our query parameters */
  window.shared.id = params["id"];
  window.shared.sitekey = params["sitekey"];
}
