import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";

const isEnabled = process.env.RATE_LIMIT_ENABLED !== "false" && process.env.NODE_ENV !== "test";
const defaultWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
const defaultMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "60", 10);

const standardHandler = (req: Request, res: Response) => {
  res.status(429).json({
    error: "Too many requests, please try again later.",
  });
};

/**
 * Default rate limiter for general routes
 * - 60 requests per 60 seconds
 * - Excludes health check endpoints
 */
export const defaultRateLimiter: RateLimitRequestHandler = isEnabled
  ? rateLimit({
      windowMs: defaultWindow,
      max: defaultMax,
      standardHeaders: true,
      legacyHeaders: false,
      handler: standardHandler,
      keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
      skip: (req) =>
        req.path === "/api/health" || req.path === "/api/runtime/status",
    })
  : ((req: Request, res: Response, next: NextFunction) => next()) as RateLimitRequestHandler;

/**
 * Strict rate limiter for heavy operations
 * - 10 requests per 5 minutes (300 seconds)
 * - Used for package manager and bootstrap install endpoints
 */
export const strictRateLimiter: RateLimitRequestHandler = isEnabled
  ? rateLimit({
      windowMs: 300000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      handler: standardHandler,
      keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
    })
  : ((req: Request, res: Response, next: NextFunction) => next()) as RateLimitRequestHandler;

/**
 * Permissive rate limiter for file operations
 * - 20 requests per 60 seconds
 * - Used for file manager routes
 */
export const permissiveRateLimiter: RateLimitRequestHandler = isEnabled
  ? rateLimit({
      windowMs: defaultWindow,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      handler: standardHandler,
      keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
    })
  : ((req: Request, res: Response, next: NextFunction) => next()) as RateLimitRequestHandler;

/**
 * System rate limiter for lightweight health/status endpoints
 * - 30 requests per 60 seconds
 */
export const systemRateLimiter: RateLimitRequestHandler = isEnabled
  ? rateLimit({
      windowMs: defaultWindow,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      handler: standardHandler,
      keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
    })
  : ((req: Request, res: Response, next: NextFunction) => next()) as RateLimitRequestHandler;