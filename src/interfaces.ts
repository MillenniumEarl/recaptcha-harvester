// Copyright (c) 2021 MillenniumEarl
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

export interface ICaptchaMessage {
  type: "Request" | "Response" | "Error";
}

export interface ICaptchaRequest extends ICaptchaMessage {
  id: string;
  siteurl: string;
  sitekey: string;
  autoClick: boolean;
}

export interface IResponseData {
  token: string;
  createdAt: Date;
}

export interface ICaptchaResponse extends ICaptchaMessage {
  data: IResponseData;
}

export interface ICaptchaError extends ICaptchaMessage {
  error: string;
}
