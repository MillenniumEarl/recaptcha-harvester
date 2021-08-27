# recaptcha-harvester

`recaptcha-harvester` is a simple interface for harvesting Captcha tokens locally.
This project is based on `ez-harvest` created by Kelvin Fichter.

![screenshot](https://i.imgur.com/RDmvgt8.png)

## Overview

`recaptcha-harvester` is designed to make Captcha harvesting as easy as possible for bot and/or user in Electron applications or APIs.

**Currently, it only supports ReCaptcha V2**

## Getting Started

### Requirements

`recaptcha-harvester` requires [Node.js](https://nodejs.org/en/).

### Installation

If you're a programmer who's including `recaptcha-harvester` as part of their application, then you can easily install it via `npm`:

```
$ npm install --save recaptcha-harvester
```

### Usage

The ability to request Captcha tokens from a user is the most powerful feature of `recaptcha-harvester`. If you're using `recaptcha-harvester` to do this, you probably want to start it from your Node application. A working example is included in [src/example.ts](https://github.com/MillenniumEarl/recaptcha-harvester/blob/master/src/example.ts)

```js
// Import recaptcha-harvester
const RecaptchaHarvester = require('recaptcha-harvester');

// Create a new instance of ezHarvest
const harvester = new RecaptchaHarvester();

// Start the server up
await harvester.start();

// Fetch the token
const data = await harvester.getCaptchaToken("https://my-website-here", "UNIQUE-SITE-KEY");
console.log(`Token retrieved: ${data.token}`);

// Stop the harvester
harvester.stop();
```
