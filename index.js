import express from "express";
import fetch from "node-fetch";
const app = express();

const PORT = process.env.PORT || 5000;
const API_URL = "http://node68.lunes.host:3052/api/pets?min_money=10000000";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const REFRESH_RATE = 2000;

let jobIds = [];
let sentJobIds = new Set();

app.get("/", (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Job IDs</title>
      <meta http-equiv="refresh" content="2">
      <style>
        body { font-family: monospace; background: #1a1a1a; color: #0f0; padding: 20px; }
        h1 { color: #0f0; }
        .job-id { padding: 5px 0; font-size: 16px; }
      </style>
    </head>
    <body>
      <h1>Job IDs</h1>
      ${jobIds.length > 0 
        ? jobIds.map(id => `<div class="job-id">${id}</div>`).join('') 
        : '<p>Loading...</p>'}
    </body>
    </html>
  `;
  res.send(html);
});

app.get("/jobids", (req, res) => {
  res.json(jobIds);
});

async function sendToDiscord(newJobIds) {
  if (!DISCORD_WEBHOOK_URL || newJobIds.length === 0) return;

  try {
    const message = {
      content: `**New Job IDs Found:**\n${newJobIds.map(id => `\`${id}\``).join('\n')}`
    };

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (response.ok) {
      console.log(`Sent ${newJobIds.length} job ID(s) to Discord`);
      newJobIds.forEach(id => sentJobIds.add(id));
    } else {
      console.error("Discord webhook error:", response.status, response.statusText);
    }
  } catch (err) {
    console.error("Error sending to Discord:", err.message);
  }
}

async function fetchJobIds() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    if (data && data.pets) {
      jobIds = data.pets.map(p => {
        const link = p.chillihubLink || "";
        const jobId = link.match(/gameInstanceId=([\w-]+)/);
        return jobId ? jobId[1] : null;
      }).filter(Boolean);

      console.log("Job IDs:", jobIds);

      const newJobIds = jobIds.filter(id => !sentJobIds.has(id));
      if (newJobIds.length > 0) {
        await sendToDiscord(newJobIds);
      }
    }
  } catch (err) {
    console.error("Error fetching API:", err.message);
  }
}

fetchJobIds();
setInterval(fetchJobIds, REFRESH_RATE);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
