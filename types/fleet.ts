export type FleetStatus = "Online" | "Offline" | "Busy";

export interface Fleet {
  id: string;
  device_name: string;
  api_url: string;
  status: FleetStatus;
  tags: string[];
  credentials: {
    username?: string;
    access_key?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export type FleetAction = "launch_app" | "execute_task" | "restart" | "screenshot";

export interface ActionPayload {
  fleet_id: string;
  action: FleetAction;
  params?: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export type SessionStatus = "pending" | "active" | "reconnecting" | "closed";

export interface FleetSession {
  id: string;
  fleet_id: string;
  status: SessionStatus;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
}
