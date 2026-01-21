import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const CLIENT_ID = "TON_CLIENT_ID";
const CLIENT_SECRET = "TON_CLIENT_SECRET";
const REDIRECT_URI = "https://MON_SERVEUR.onrender.com/hue-callback"; // remplace par ton URL Render
let ACCESS_TOKEN = null;

app.get("/hue-callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("Pas de code reçu");

  const tokenRes = await fetch("https://api.meethue.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_
