const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const DB = path.join(__dirname, "data.json");
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "").trim();
const WA = "258852487728";

const read = () => {
  try { return JSON.parse(fs.readFileSync(DB, "utf8")); }
  catch { return { players: [] }; }
};
const write = d => fs.writeFileSync(DB, JSON.stringify(d, null, 2));

function adminOnly(req, res, next) {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "A área de administração ainda não está configurada." });
  if ((req.headers.authorization || "") !== "Bearer " + ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Acesso não autorizado." });
  }
  next();
}

app.post("/api/register", (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: "Preencha o nome e telefone." });

  const db = read();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  db.players.push({
    id,
    name: String(name).trim().slice(0, 70),
    phone: String(phone).trim().slice(0, 20),
    status: "pending",
    accessCode: null,
    created: new Date().toISOString()
  });
  write(db);

  const message = "Olá, MJ Jogos. Sou " + String(name).trim().slice(0, 70) +
    ". O meu telefone é " + String(phone).trim().slice(0, 20) +
    ". Já fiz o pagamento de 185 MT e envio esta mensagem para solicitar a confirmação. Código da inscrição: " + id + ".";

  res.json({
    ok: true,
    id,
    status: "pending",
    whatsapp: `https://wa.me/${WA}?text=${encodeURIComponent(message)}`
  });
});

app.get("/api/status/:id", (req, res) => {
  const p = read().players.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "Inscrição não encontrada." });
  res.json({ status: p.status, accessCode: p.status === "approved" ? p.accessCode : null });
});

app.get("/api/admin/players", adminOnly, (req, res) => {
  res.json(read().players.slice().reverse());
});

app.post("/api/admin/approve", adminOnly, (req, res) => {
  const { id } = req.body || {};
  const db = read();
  const p = db.players.find(x => x.id === id);
  if (!p) return res.status(404).json({ error: "Inscrição não encontrada." });
  if (p.status !== "approved") {
    p.status = "approved";
    p.accessCode = "MJ" + Math.random().toString(36).slice(2, 8).toUpperCase();
    p.approvedAt = new Date().toISOString();
    write(db);
  }
  res.json({ ok: true, player: p });
});

app.get("/api/play/:code", (req, res) => {
  const p = read().players.find(x => x.accessCode === req.params.code && x.status === "approved");
  if (!p) return res.status(403).json({ error: "Inscrição ainda não aprovada. Confirme o pagamento e consulte novamente." });

  res.json({
    ok: true,
    player: p.name,
    questions: [
      { q: "Qual é a capital de Moçambique?", a: ["Beira", "Maputo", "Quelimane"], correct: 1 },
      { q: "Quanto é 8 × 7?", a: ["54", "56", "64"], correct: 1 },
      { q: "Qual é o maior planeta do Sistema Solar?", a: ["Terra", "Marte", "Júpiter"], correct: 2 },
      { q: "Quantos lados tem um triângulo?", a: ["3", "4", "5"], correct: 0 },
      { q: "Qual é a língua oficial de Moçambique?", a: ["Português", "Inglês", "Francês"], correct: 0 }
    ]
  });
});

app.listen(PORT, () => console.log("MJ Jogos ativo na porta " + PORT));
