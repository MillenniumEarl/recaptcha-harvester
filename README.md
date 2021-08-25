# ez-harvest

`ez-harvest` is a simple interface for harvesting Captcha tokens locally.

![screenshot](https://i.imgur.com/RDmvgt8.png)

## Overview

`ez-harvest` is designed to make Captcha harvesting as easy as possible. Currently, it only supports ReCaptcha, but we have plans to support other legacy Captcha systems. `ez-harvest` is designed to be used by bots. It's similar to `captcha-harvester`, except that you'll only see a Captcha challenge window when the bot requests it.

## Getting Started

### Requirements

`ez-harvest` requires [Node.js](https://nodejs.org/en/).

### Installation

If you're a programmer who's including `ez-harvest` as part of their bot, then you can easily install `ez-harvest` via `npm`:

```
$ npm install --save ez-harvest
```

### Usage

The ability to request Captcha tokens from a user is the most powerful feature of `ez-harvest`. If you're using `ez-harvest` to do this, you probably want to start it from your Node application. 

```js
// Import ez-harvest
const EzHarvest = require('ez-harvest');

// Create a new instance of ezHarvest
const ezHarvest = new EzHarvest();

// Start the server up
ezHarvest.start().then(() => {
  // Request a captcha token
  return ezHarvest.getCaptchaToken('http://www.ayinope.com', '6LdTNzIUAAAAAJxPWnEnY7PFdlXyZBO5LO8k4eP7');
}).then((captchaToken) => {
  // { value: '03ANcjospQ-VHb2nxNL28YKobvN9b84e2...', createdAt: 1520910198 }
  console.log(captchaToken);
}).catch((err) => {
  // Catch any errors, possibly: "Captcha Window Closed"
  console.log(err);
});

```
