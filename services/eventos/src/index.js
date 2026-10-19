const express = require("express");

console.log("=========================================");
console.log("⚡ INICIANDO SERVICIO DE EVENTOS");
console.log("=========================================");

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/eventos/sequia", (req, res) => {
  console.log("[Eventos] Recibido evento de sequía");
  res.json({ status: "ok", evento: "sequia" });
});

app.post("/api/eventos/depredador", (req, res) => {
  console.log("[Eventos] Recibido evento de depredador:", req.body);
  res.json({ status: "ok", evento: "depredador" });
});

app.post("/api/admin/spawn", (req, res) => {
  const { cantidad } = req.body;
  console.log(`[Eventos] Spawn masivo de agentes: ${cantidad}`);
  res.json({ status: "ok", cantidad });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 [Eventos] Servidor API escuchando en el puerto ${PORT}`);
});
