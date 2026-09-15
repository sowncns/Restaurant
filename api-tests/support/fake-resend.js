const http = require("node:http");

const messages = [];
http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/emails") {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      const message = JSON.parse(raw || "{}");
      messages.unshift({ Subject: message.subject || "", To: message.to || [] });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: `api-test-${Date.now()}` }));
    });
    return;
  }
  if (req.method === "GET" && req.url === "/messages") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ messages }));
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(8025, "127.0.0.1");
