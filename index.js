// Ajoute cet endpoint de test dans ton index.js (avant app.listen)

app.get("/test-hue-api", async (req, res) => {
  if (!ACCESS_TOKEN) {
    return res.json({ error: "Pas de token" });
  }

  try {
    console.log("🧪 TEST: Appel API Hue...");
    
    const response = await fetch("https://api.meethue.com/clip/v2/resource/light", {
      headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` }
    });
    
    const status = response.status;
    const contentType = response.headers.get('content-type');
    const rawText = await response.text();
    
    console.log("🧪 Status:", status);
    console.log("🧪 Content-Type:", contentType);
    console.log("🧪 Réponse (500 chars):", rawText.substring(0, 500));
    
    res.json({
      status,
      contentType,
      responsePreview: rawText.substring(0, 500),
      tokenUsed: ACCESS_TOKEN.substring(0, 10) + "..."
    });
  } catch (err) {
    console.error("🧪 Erreur:", err);
    res.status(500).json({ error: err.message });
  }
});