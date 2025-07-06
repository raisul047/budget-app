require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const mime = require("mime");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { parse } = require("querystring");

// MongoDB Models
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String
}));

const Transaction = mongoose.model("Transaction", new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  type: String,
  amount: Number,
  category: String,
  date: Date,
  recurring: Boolean,
  recurringInterval: String
}));

const BudgetGoal = mongoose.model("BudgetGoal", new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  category: String,
  limit: Number
}));

// Helpers
function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not Found");
    }
    res.writeHead(200, { "Content-Type": mime.getType(filePath) });
    res.end(data);
  });
}

function parseBody(req) {
  return new Promise(resolve => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(parse(body));
      }
    });
  });
}

function setCookie(res, name, value) {
  res.setHeader("Set-Cookie", `${name}=${value}; HttpOnly; Path=/`);
}

function getCookie(req, name) {
  const cookies = (req.headers.cookie || "").split(";").reduce((acc, c) => {
    const [k, v] = c.trim().split("=");
    acc[k] = v;
    return acc;
  }, {});
  return cookies[name];
}

function auth(req, res) {
  const token = getCookie(req, "token");
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET).id;
  } catch {
    return null;
  }
}

// Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = req.url.split("?")[0];

  // Root route
  if (req.method === "GET" && parsedUrl === "/") {
    return sendFile(res, path.join("./public", "index.html"));
  }

  // Clean /dashboard route
  if (req.method === "GET" && parsedUrl === "/dashboard") {
    return sendFile(res, path.join("./public", "dashboard.html"));
  }

  // Serve static files (e.g., dashboard.html, CSS, JS)
  const staticFile = path.join("./public", parsedUrl);
  if (req.method === "GET" && fs.existsSync(staticFile)) {
    return sendFile(res, staticFile);
  }

  // Register
  if (parsedUrl === "/register" && req.method === "POST") {
    const { name, email, password } = await parseBody(req);
    const hashed = await bcrypt.hash(password, 10);
    try {
      await User.create({ name, email, password: hashed });
      res.writeHead(302, { Location: "/" });
      return res.end();
    } catch {
      res.writeHead(400);
      return res.end("Email exists");
    }
  }

  // Login
  if (parsedUrl === "/login" && req.method === "POST") {
    const { email, password } = await parseBody(req);
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.writeHead(401);
      return res.end("Invalid credentials");
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    setCookie(res, "token", token);
    res.writeHead(302, { Location: "/dashboard" }); // clean URL
    return res.end();
  }

  // Logout
  if (parsedUrl === "/logout" && req.method === "POST") {
    res.setHeader("Set-Cookie", `token=; HttpOnly; Max-Age=0; Path=/`);
    res.writeHead(302, { Location: "/" });
    return res.end();
  }

  // Get User Info
  if (parsedUrl === "/user" && req.method === "GET") {
    const uid = auth(req, res);
    if (!uid) { res.writeHead(401); return res.end(); }
    const u = await User.findById(uid);
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ email: u.email, name: u.name }));
  }

  // Create Transaction
  if (parsedUrl === "/transaction" && req.method === "POST") {
    const uid = auth(req, res);
    if (!uid) { res.writeHead(401); return res.end(); }
    const body = await parseBody(req);
    await Transaction.create({ ...body, userId: uid });
    return res.end();
  }

  // List Transactions
  if (parsedUrl === "/transactions" && req.method === "GET") {
    const uid = auth(req, res);
    if (!uid) { res.writeHead(401); return res.end(); }
    const tx = await Transaction.find({ userId: uid });
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(tx));
  }

  // Update Transaction
  if (parsedUrl.startsWith("/transaction/") && req.method === "PUT") {
    const uid = auth(req, res);
    if (!uid) { res.writeHead(401); return res.end(); }
    const id = parsedUrl.split("/")[2];
    const body = await parseBody(req);
    await Transaction.updateOne({ _id: id, userId: uid }, body);
    return res.end();
  }

  // Delete Transaction
  if (parsedUrl.startsWith("/transaction/") && req.method === "DELETE") {
    const uid = auth(req, res);
    if (!uid) { res.writeHead(401); return res.end(); }
    const id = parsedUrl.split("/")[2];
    await Transaction.deleteOne({ _id: id, userId: uid });
    return res.end();
  }

  // Budget Goals
  if (parsedUrl === "/budget-goals" && req.method === "GET") {
    const uid = auth(req, res);
    if (!uid) { res.writeHead(401); return res.end(); }
    const goals = await BudgetGoal.find({ userId: uid });
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(goals));
  }

  if (parsedUrl === "/budget-goals" && req.method === "POST") {
    const uid = auth(req, res);
    if (!uid) { res.writeHead(401); return res.end(); }
    const body = await parseBody(req);
    await BudgetGoal.deleteMany({ userId: uid });
    const docs = body.map(g => ({ ...g, userId: uid }));
    await BudgetGoal.insertMany(docs);
    return res.end();
  }

  // Analytics
  if (parsedUrl === "/analytics" && req.method === "GET") {
    const uid = auth(req, res);
    if (!uid) { res.writeHead(401); return res.end(); }
    const tx = await Transaction.find({ userId: uid });
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(tx));
  }

  // Export Transactions to CSV
  if (parsedUrl === "/export" && req.method === "GET") {
    const uid = auth(req, res);
    if (!uid) { res.writeHead(401); return res.end(); }

    const transactions = await Transaction.find({ userId: uid });
    let csv = "Type,Amount,Category,Date,Recurring,RecurringInterval\n";
    for (const t of transactions) {
      csv += [
        t.type,
        t.amount,
        `"${t.category}"`,
        new Date(t.date).toISOString(),
        t.recurring,
        t.recurringInterval || ""
      ].join(",") + "\n";
    }

    res.writeHead(200, {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=transactions.csv"
    });
    return res.end(csv);
  }

  // Fallback
  res.writeHead(404);
  res.end("Not Found");
});

// Connect DB & Start Server
mongoose.connect(process.env.MONGO_URI).then(() => {
  server.listen(3000, () => console.log("Server running on http://localhost:3000"));
});
