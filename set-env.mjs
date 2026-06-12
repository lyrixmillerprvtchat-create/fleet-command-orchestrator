// One-shot script to set DATABASE_URL on Vercel without shell interpolation issues
const TOKEN = "vca_0t08PopYH9hl5Hv5DBw6v2Il55RApSd8cwyDNjddA8hZ7Y3HDl3OHWY2";
const TEAM  = "team_poFMfnZb3A06nspVZiVy4j5G";
const PROJECT = "fleet-command-orchestrator";

const DB_URL = "postgresql://postgres.epdzbjsecfsyfhknfbca:TopGlobal2026!DB@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

const res = await fetch(
  `https://api.vercel.com/v10/projects/${PROJECT}/env?teamId=${TEAM}&upsert=true`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: "DATABASE_URL",
      value: DB_URL,
      type: "encrypted",
      target: ["production", "preview", "development"],
    }),
  }
);

const data = await res.json();
if (res.ok) {
  console.log("✓ DATABASE_URL set:", data.key);
} else {
  console.error("✗ Error:", JSON.stringify(data));
}
