const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4172);
const host = "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
  const rel = pathname === "/" ? "main.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(root, rel);

  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }

  fs.readFile(file, (error, body) => {
    if (error) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "content-type": types[path.extname(file).toLowerCase()] || "application/octet-stream"
    });
    res.end(body);
  });
}).listen(port, host, () => {
  console.log(`PRISMA ABYSS: http://${host}:${port}/main.html`);
});
