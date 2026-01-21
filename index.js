import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ⚡ Variables d'environnement (sécurisées sur Render)
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

let ACCESS_TOKEN = null;

// ------------------------
// OAuth Callback
// ------------------------
app.get("/hue-callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("Pas de code reçu de Hue");

  try {
    const tokenRes = await fetch("https://api.meethue.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
      })
    });

    const data = await tokenRes.json();
    ACCESS_TOKEN = data.access_token;

    console.log("Access token récupéré :", ACCESS_TOKEN);
    res.send("Token reçu ! Tu peux maintenant piloter tes lampes via /hue");
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur lors de la récupération du token OAuth");
  }
});

// ------------------------
// Endpoint pour piloter les lampes
// ------------------------
app.post("/hue", async (req, res) => {
  if (!ACCESS_TOKEN) return res.status(400).send("Pas de token, fais d'abord OAuth Hue");

  const { lightId, body } = req.body;

  try {
    const response = await fetch(
      `https://api.meethue.com/clip/v2/resource/light/${lightId}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    const result = await response.json();
    res.send({ ok: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).send({ ok: false, error: err.message });
  }
});

// ------------------------
// Test route simple
// ------------------------
app.get("/", (req, res) => {
  res.send("Serveur Hue prêt 🚀");
});

// ------------------------
// Lancement du serveur
// ------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur Hue prêt sur le port ${PORT}`));
