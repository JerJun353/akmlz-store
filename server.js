require("dotenv").config();

const express = require("express");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "akmlz123";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

const DATA_FILE = path.join(__dirname, "data", "products.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- helpers ----------
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function parseNotes(raw) {
  if (raw === undefined || raw === null || raw === "") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    /* fall through to line-split */
  }
  return String(raw)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
function deleteUploadedFile(imagePath) {
  if (imagePath && imagePath.startsWith("/uploads/")) {
    const filePath = path.join(UPLOAD_DIR, path.basename(imagePath));
    fs.unlink(filePath, () => {});
  }
}

// ---------- upload handling ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = Date.now() + "-" + crypto.randomBytes(6).toString("hex") + ext;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.originalname);
    cb(ok ? null : new Error("Format gambar tidak didukung"), ok);
  },
});

// ---------- middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
      sameSite: "lax",
    },
  })
);

app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, "public")));

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: "Sesi admin habis atau belum login." });
}

// ============================================================
// PUBLIC API — dipakai oleh halaman toko (public/app.js)
// ============================================================
app.get("/api/products", (req, res) => {
  res.json(readData());
});

// ============================================================
// ADMIN AUTH
// ============================================================
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Password salah." });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/session", (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ============================================================
// ADMIN — PRODUK (Blox Fruits / Game lain)
// ============================================================
app.post("/api/admin/products", requireAdmin, upload.single("image"), (req, res) => {
  try {
    const data = readData();
    const { category, name, game, price, originalPrice, discountLabel, notes } = req.body;

    if (!category || !["bloxFruit", "otherGames"].includes(category)) {
      return res.status(400).json({ error: "Kategori tidak valid." });
    }
    if (!name || !price) {
      return res.status(400).json({ error: "Nama dan harga wajib diisi." });
    }

    const product = {
      id: category + "-" + crypto.randomBytes(4).toString("hex"),
      name,
      price,
    };
    if (game) product.game = game;
    if (originalPrice) product.originalPrice = originalPrice;
    if (discountLabel) product.discountLabel = discountLabel;
    const parsedNotes = parseNotes(notes);
    if (parsedNotes.length) product.notes = parsedNotes;
    if (req.file) product.image = "/uploads/" + req.file.filename;

    data[category].push(product);
    writeData(data);
    res.json({ ok: true, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/products/:category/:id", requireAdmin, upload.single("image"), (req, res) => {
  try {
    const { category, id } = req.params;
    const data = readData();
    if (!data[category]) return res.status(400).json({ error: "Kategori tidak valid." });

    const idx = data[category].findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "Produk tidak ditemukan." });

    const product = data[category][idx];
    const { name, game, price, originalPrice, discountLabel, notes, removeImage } = req.body;

    if (name) product.name = name;
    if (price) product.price = price;
    product.game = game || undefined;
    product.originalPrice = originalPrice || undefined;
    product.discountLabel = discountLabel || undefined;
    if (notes !== undefined) {
      const parsedNotes = parseNotes(notes);
      product.notes = parsedNotes.length ? parsedNotes : undefined;
    }

    if (req.file) {
      deleteUploadedFile(product.image);
      product.image = "/uploads/" + req.file.filename;
    } else if (removeImage === "true") {
      deleteUploadedFile(product.image);
      product.image = null;
    }

    data[category][idx] = product;
    writeData(data);
    res.json({ ok: true, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/products/:category/:id", requireAdmin, (req, res) => {
  const { category, id } = req.params;
  const data = readData();
  if (!data[category]) return res.status(400).json({ error: "Kategori tidak valid." });

  const idx = data[category].findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Produk tidak ditemukan." });

  const [removed] = data[category].splice(idx, 1);
  deleteUploadedFile(removed.image);
  writeData(data);
  res.json({ ok: true });
});

// ============================================================
// ADMIN — STOCK FRUIT
// ============================================================
app.put("/api/admin/stock", requireAdmin, (req, res) => {
  const { fruitStock } = req.body;
  if (!Array.isArray(fruitStock)) {
    return res.status(400).json({ error: "Data stok tidak valid." });
  }
  const data = readData();
  data.fruitStock = fruitStock;
  writeData(data);
  res.json({ ok: true });
});

// ============================================================
// ADMIN — PENGATURAN TOKO & JASA JOKI
// ============================================================
app.put("/api/admin/settings", requireAdmin, upload.single("logo"), (req, res) => {
  const data = readData();
  const { name, contact, heroTitle, heroSub, paymentRule, jokiTitle, jokiDescription, jokiFlow } = req.body;

  if (name) data.shop.name = name;
  if (contact) data.shop.contact = contact;
  if (heroTitle !== undefined) data.shop.heroTitle = heroTitle;
  if (heroSub !== undefined) data.shop.heroSub = heroSub;
  if (paymentRule !== undefined) data.shop.paymentRule = paymentRule;

  if (req.file) {
    deleteUploadedFile(data.shop.logo);
    data.shop.logo = "/uploads/" + req.file.filename;
  }

  if (jokiTitle !== undefined) data.joki.title = jokiTitle;
  if (jokiDescription !== undefined) data.joki.description = jokiDescription;
  if (jokiFlow !== undefined) {
    data.joki.flow = String(jokiFlow)
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  writeData(data);
  res.json({ ok: true, shop: data.shop, joki: data.joki });
});

// ============================================================
// Admin panel page (protected client-side by session check in admin.js)
// ============================================================
app.get(["/admin", "/admin/"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "index.html"));
});

// fallback ke storefront untuk root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Akmlz Store server jalan di http://localhost:" + PORT);
  console.log("Panel admin di http://localhost:" + PORT + "/admin");
});
