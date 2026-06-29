-- Fleet Command Orchestrator — Supabase Schema
-- Run this in your new Supabase project's SQL Editor

CREATE TABLE fleets (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_name TEXT NOT NULL,
  api_url     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Offline'
                CHECK (status IN ('Online', 'Offline', 'Busy')),
  tags        TEXT[] DEFAULT '{}',
  credentials JSONB,  -- { username, access_key } — stored encrypted at rest by Supabase
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast status filtering
CREATE INDEX idx_fleets_status ON fleets(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fleets_updated_at
  BEFORE UPDATE ON fleets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: disable for service role access (API routes use service role key)
ALTER TABLE fleets ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (Next.js API uses this)
CREATE POLICY "service_role_all" ON fleets
  FOR ALL USING (true);

-- Optional: seed a sample fleet node for testing
INSERT INTO fleets (device_name, api_url, status, tags)
VALUES (
  'Demo-Android-VM-01',
  'https://hub-cloud.browserstack.com/wd/hub',
  'Offline',
  ARRAY['Bot', 'Browser']
);

-- ─── Persistent Remote Desktop Sessions ──────────────────────────────────────

CREATE TABLE sessions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fleet_id     UUID REFERENCES fleets(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'active', 'reconnecting', 'closed')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_fleet ON sessions(fleet_id);
CREATE INDEX idx_sessions_status ON sessions(status);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON sessions FOR ALL USING (true);

-- ─── WebRTC Signaling Messages ────────────────────────────────────────────────

CREATE TABLE signals (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('offer', 'answer', 'ice-candidate')),
  origin     TEXT NOT NULL CHECK (origin IN ('host', 'client')),
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signals_session ON signals(session_id, type, origin);

ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON signals FOR ALL USING (true);

-- Auto-expire sessions older than 24h (run as a scheduled job or pg_cron)
-- DELETE FROM sessions WHERE expires_at < NOW();
