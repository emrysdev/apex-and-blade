const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

const buildDir = path.join(__dirname, "build");

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

const server = http.createServer((req, res) => {
  let requestPath = decodeURIComponent(req.url.split("?")[0]);

  let filePath = path.join(
    buildDir,
    requestPath === "/" ? "index.html" : requestPath
  );

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath);

      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
      });

      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // React Router fallback
    const indexPath = path.join(buildDir, "index.html");

    fs.readFile(indexPath, (indexErr, data) => {
      if (indexErr) {
        res.writeHead(500);
        res.end("Frontend build not found.");
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/html",
      });

      res.end(data);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Frontend running on http://${HOST}:${PORT}`);
});