import express from "express";
import fetch from "node-fetch";
const app = express();

const PORT = process.env.PORT || 5000;
const API_URL = "http://node68.lunes.host:3052/api/pets?min_money=10000000";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const REFRESH_RATE = 2000;
const PLACE_ID = "109983668079237";

let jobData = [];
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
        a { color: #0f0; }
      </style>
    </head>
    <body>
      <h1>Job IDs</h1>
      ${jobData.length > 0 
        ? jobData.map(job => `<div class="job-id">${job.name} - ${job.jobId} - <a href="${job.link}" target="_blank">Link</a></div>`).join('') 
        : '<p>Loading...</p>'}
    </body>
    </html>
  `;
  res.send(html);
});

app.get("/jobids", (req, res) => {
  res.json(jobData);
});

async function sendToDiscord(newJobs) {
  if (!DISCORD_WEBHOOK_URL || newJobs.length === 0) return;

  for (const job of newJobs) {
    try {
      const message = {
        embeds: [{
          title: "GPT NOTIFY",
          color: 0x2b2d31,
          fields: [
            {
              name: "👑 Name",
              value: job.name,
              inline: false
            },
            {
              name: "🧬 Mutation",
              value: job.mutation,
              inline: false
            },
            {
              name: "💰 Money Per Sec (Base Value)",
              value: job.money,
              inline: false
            },
            {
              name: "🐾 Tier",
              value: job.tier,
              inline: false
            },
            {
              name: "👥 Players",
              value: job.players,
              inline: false
            },
            {
              name: "🆔 JOBID PC",
              value: `\`\`\`ansi\n\u001b[2;34m${job.jobId}\u001b[0m\n\`\`\``,
              inline: false
            },
            {
              name: "🔗 Join Link",
              value: `[Join Server](${job.link})`,
              inline: false
            }
          ]
        }]
      };

      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      if (response.ok) {
        console.log(`Sent ${job.name} to Discord`);
        sentJobIds.add(job.jobId);
      } else if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after') || 5;
        console.log(`Rate limited, waiting ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        const retryResponse = await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });
        if (retryResponse.ok) {
          console.log(`Sent ${job.name} to Discord (retry)`);
          sentJobIds.add(job.jobId);
        }
      } else {
        console.error("Discord webhook error:", response.status, response.statusText);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      console.error("Error sending to Discord:", err.message);
    }
  }
}

async function fetchJobIds() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    if (data && data.pets) {
      const seenIds = new Set();
      jobData = data.pets.map(p => {
        const link = p.chillihubLink || "";
        const jobIdMatch = link.match(/gameInstanceId=([\w-]+)/);
        if (jobIdMatch) {
          const jobId = jobIdMatch[1];
          if (seenIds.has(jobId)) return null;
          seenIds.add(jobId);
          return {
            name: p.name || "Unknown",
            mutation: p.mutation || "None",
            money: p.money || "Unknown",
            tier: p.tier || "Unknown",
            players: p.players || "?/?",
            jobId: jobId,
            link: link
          };
        }
        return null;
      }).filter(Boolean);

      console.log("Job IDs:", jobData.map(j => j.jobId));

      const newJobs = jobData.filter(job => !sentJobIds.has(job.jobId));
      if (newJobs.length > 0) {
        await sendToDiscord(newJobs);
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
