import http from "node:http";

export function createRequest(app: any) {
  let server: http.Server | null = null;

  async function ensureServer() {
    if (!server) {
      await new Promise<void>((resolve, reject) => {
        server = app.listen(0, () => resolve());
        server.on("error", reject);
      });
    }

    const address = server!.address();
    const port = typeof address === "string" ? parseInt(address.split(":").pop() || "0", 10) : address?.port ?? 0;
    return port;
  }

  return async (options: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: any;
  }) => {
    const { method, path: reqPath, headers = {}, body } = options;
    const port = await ensureServer();
    const data = body !== undefined ? JSON.stringify(body) : undefined;

    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: reqPath,
          method,
          headers: {
            "Content-Type": "application/json",
            Connection: "close",
            ...headers,
            ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf-8");
            let parsed: any = raw;
            try {
              parsed = raw ? JSON.parse(raw) : null;
            } catch {
              // keep raw text
            }
            resolve({ status: res.statusCode ?? 0, body: parsed });
          });
        },
      );

      req.on("error", reject);
      if (data) req.write(data);
      req.end();
    });
  };
}
