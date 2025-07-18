import rateLimit from "express-rate-limit";
import { sendResponse } from "../utils/response";

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 5 requests per windowMs
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendResponse(
      res,
      429,
      false,
      "Too many authentication attempts, please try again later."
    );
  },
});

export const verifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: "Too many verification attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendResponse(
      res,
      429,
      false,
      "Too many verification attempts, please try again later."
    );
  },
});
