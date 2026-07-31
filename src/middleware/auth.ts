import type { Request, Response, NextFunction } from "express";

let _active: ((req: Request, res: Response, next: NextFunction) => void) | undefined;

export function loadAuthMiddleware(): ((req: Request, res: Response, next: NextFunction) => void) | undefined {
  const apiKey = process.env.TERMINAI_API_KEY?.trim();

  if (!apiKey) {
    _active = undefined;
    return undefined;
  }

  const prefix = process.env.TERMINAI_AUTH_HEADER?.trim() || "x-api-key";
  const headerName = prefix.toLowerCase();

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    const raw = req.headers[headerName];
    let candidate = Array.isArray(raw) ? raw[0] : raw;

    if (!candidate && prefix === "authorization" && typeof req.headers.authorization === "string") {
      candidate = req.headers.authorization.replace(/^bearer\s+/i, "");
    }

    if (!candidate || candidate !== apiKey) {
      return res.status(401).json({ error: "Unauthorized", message: "Missing or invalid API key." });
    }

    next();
  };

  _active = middleware;
  return _active;
}

export function reloadAuthMiddleware() {
  return loadAuthMiddleware();
}

export function getActiveAuthMiddleware() {
  return _active;
}
