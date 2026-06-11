import { NextResponse } from "next/server";
import { Client } from "pg";

const SETUP_SECRET = process.env.SETUP_SECRET ?? "fleet-init-2026";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS fleets (
        id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        device_name TEXT NOT NULL,
        api_url     TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'Offline'
                      CHECK (status IN ('Online', 'Offline', 'Busy')),
        tags        TEXT[] DEFAULT '{}',
        credentials JSONB,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_fleets_status ON fleets(status);

      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS fleets_updated_at ON fleets;
      CREATE TRIGGER fleets_updated_at
        BEFORE UPDATE ON fleets
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();

      ALTER TABLE fleets ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "service_role_all" ON fleets;
      CREATE POLICY "service_role_all" ON fleets FOR ALL USING (true);
    `);

    // Seed a demo node if table is empty
    const { rows } = await client.query("SELECT COUNT(*) FROM fleets");
    if (parseInt(rows[0].count) === 0) {
      await client.query(`
        INSERT INTO fleets (device_name, api_url, status, tags)
        VALUES ('Demo-Android-VM-01', 'https://hub-cloud.browserstack.com/wd/hub', 'Offline', ARRAY['Bot', 'Browser'])
      `);
    }

    return NextResponse.json({ success: true, message: "Fleet database initialized" });
  } finally {
    await client.end();
  }
}
