// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/* Called when Captcha is loaded */
function onloadCallback() {
  grecaptcha.render("g-recaptcha-container", {
    sitekey: window.shared.sitekey,
    theme: "dark",
    callback: submit
  });
  console.log("Rendering reCAPTCHA widget...");
}

/* Called when Captcha is submitted */
function submit() {
  const captchaToken = document.getElementById("g-recaptcha-response").value;
  window.api.send(`submit-captcha-${window.shared.id}`, {
    value: captchaToken,
    createdAt: Math.round(new Date() / 1000)
  });
  console.log(`Send token: ${captchaToken}`);
}
