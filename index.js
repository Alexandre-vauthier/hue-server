import express from "express";
import fetch from "node-fetch";

const app = express();

// ⚡ CORS - Autorise les requêtes depuis Base44 (et autres origines)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Répond immédiatement aux requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// ⚡ Variables d'environnement (sécurisées sur Render)
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

let ACCESS_TOKEN = null;

// ------------------------
// Conversion hex -> xy Hue
// ------------------------
function hexToXY(hex) {
  const r = parseInt(hex.substr(1, 2), 16) / 255;
  const g = parseInt(hex.substr(3, 2), 16) / 255;
  const b = parseInt(hex.substr(5, 2), 16) / 255;

  const red = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  const green = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  const blue = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const X = red * 0.649926 + green * 0.103455 + blue * 0.197109;
  const Y = red * 0.234327 + green * 0.743075 + blue * 0.022598;
  const Z = red * 0.000000 + green * 0.053077 + blue * 1.035763;

  const x = X / (X + Y + Z);
  const y = Y / (X + Y + Z);

  return { x, y };
}

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
    res.send("Token reçu ! Tu peux maintenant piloter tes lampes via /set-color");
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur lors de la récupération du token OAuth");
  }
});

// ------------------------
// Endpoint simplifié pour changer la couleur de toutes les lampes
// ------------------------
app.post("/set-color", async (req, res) => {
  if (!ACCESS_TOKEN) {
    return res.status(400).json({ error: "Pas de token OAuth, fais d'abord l'authentification" });
  }

  const { color } = req.body; // ex: "#FF0000"
  
  if (!color) {
    return res.status(400).json({ error: "Couleur manquante" });
  }

  try {
    const xy = hexToXY(color);
    console.log(`🎨 Changement couleur: ${color} -> xy:`, xy);

    // Récupérer toutes les lumières
    const lightsRes = await fetch("https://api.meethue.com/clip/v2/resource/light", {
      headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` }
    });
    
    if (!lightsRes.ok) {
      throw new Error(`Erreur API Hue: ${lightsRes.status}`);
    }

    let lightsData;
    if (!lightsRes.ok) {
      const errorText = await lightsRes.text();
      console.error('❌ Erreur API Hue:', errorText.substring(0, 200));
      throw new Error('Token OAuth invalide ou expiré. Refais l\'authentification sur /hue-callback');
    }
    
    try {
      lightsData = await lightsRes.json();
    } catch (jsonError) {
      console.error('❌ Impossible de parser la réponse JSON');
      throw new Error('Réponse invalide de l\'API Hue');
    }
    
    const { data: lights } = lightsData;
    console.log(`💡 ${lights.length} lumières trouvées`);

    // Changer toutes les lumières
    const promises = lights.map(light =>
      fetch(`https://api.meethue.com/clip/v2/resource/light/${light.id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          on: { on: true },
          color: { xy },
          dynamics: { duration: 100 }
        })
      })
    );

    await Promise.all(promises);
    console.log("✅ Toutes les lumières changées");
    
    res.json({ success: true, lightsChanged: lights.length });
  } catch (err) {
    console.error("❌ Erreur:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------
// Endpoint manuel (ancien)
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