import { NextResponse } from "next/server";
import { Client } from "pg";

export const dynamic = "force-dynamic";

const SETUP_SECRET = process.env.SETUP_SECRET ?? "fleet-init-2026";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Try pooler first, fall back to direct host
  const configs = [
    { host: "aws-0-us-east-1.pooler.supabase.com", port: 5432, user: "postgres.epdzbjsecfsyfhknfbca" },
    { host: "db.epdzbjsecfsyfhknfbca.supabase.co",  port: 5432, user: "postgres" },
  ];

  let lastErr = "";
  for (const cfg of configs) {
    const client = new Client({
      ...cfg,
      database: "postgres",
      password: process.env.SUPABASE_DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });

    try {
      await client.connect();

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
        )
      `);

      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_fleets_status ON fleets(status)`
      );

      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
        $$ LANGUAGE plpgsql
      `);

      await client.query(`
        DROP TRIGGER IF EXISTS fleets_updated_at ON fleets;
        CREATE TRIGGER fleets_updated_at
          BEFORE UPDATE ON fleets
          FOR EACH ROW EXECUTE FUNCTION update_updated_at()
      `);

      await client.query(`ALTER TABLE fleets ENABLE ROW LEVEL SECURITY`);

      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename='fleets' AND policyname='service_role_all'
          ) THEN
            CREATE POLICY "service_role_all" ON fleets FOR ALL USING (true);
          END IF;
        END $$
      `);

      const { rows } = await client.query(
        "SELECT COUNT(*)::int AS count FROM fleets"
      );
      if (rows[0].count === 0) {
        await client.query(`
          INSERT INTO fleets (device_name, api_url, status, tags)
          VALUES ('Demo-Android-VM-01','https://hub-cloud.browserstack.com/wd/hub','Offline',ARRAY['Bot','Browser'])
        `);
      }

      await client.end();
      return NextResponse.json({
        success: true,
        message: `Fleet database initialized via ${cfg.host}`,
      });
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      await client.end().catch(() => null);
    }
  }

  return NextResponse.json({ error: lastErr }, { status: 500 });
}
