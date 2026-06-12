export interface DeviceProvider {
  createSession(caps: Record<string, unknown>): Promise<string>;
  screenshot(sessionId: string): Promise<string>;
  getPageSource(sessionId: string): Promise<string>;
  findElement(sessionId: string, using: string, value: string): Promise<string | null>;
  click(sessionId: string, elementId: string): Promise<void>;
  setValue(sessionId: string, elementId: string, text: string): Promise<void>;
  scrollDown(sessionId: string): Promise<void>;
  scrollUp(sessionId: string): Promise<void>;
  back(sessionId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

export class AppiumDevice implements DeviceProvider {
  private baseUrl: string;
  private authHeader: string;

  constructor(apiUrl: string, username: string, accessKey: string) {
    this.baseUrl = apiUrl.replace(/\/$/, "");
    const token = Buffer.from(`${username}:${accessKey}`).toString("base64");
    this.authHeader = `Basic ${token}`;
  }

  private async wd<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as { value: T };
    if (!res.ok) {
      const msg = (json as { value?: { message?: string } }).value?.message ?? `HTTP ${res.status}`;
      throw new Error(`Appium ${method} ${path}: ${msg}`);
    }
    return json.value as T;
  }

  async createSession(caps: Record<string, unknown>): Promise<string> {
    const value = await this.wd<{ sessionId: string }>("POST", "/session", {
      capabilities: { alwaysMatch: caps },
    });
    return value.sessionId;
  }

  async screenshot(sessionId: string): Promise<string> {
    return this.wd<string>("GET", `/session/${sessionId}/screenshot`);
  }

  async getPageSource(sessionId: string): Promise<string> {
    return this.wd<string>("GET", `/session/${sessionId}/source`);
  }

  async findElement(sessionId: string, using: string, value: string): Promise<string | null> {
    try {
      const el = await this.wd<Record<string, string>>("POST", `/session/${sessionId}/element`, {
        using,
        value,
      });
      return el["element-6066-11e4-a52e-4f735466cecf"] ?? el["ELEMENT"] ?? null;
    } catch {
      return null;
    }
  }

  async click(sessionId: string, elementId: string): Promise<void> {
    await this.wd("POST", `/session/${sessionId}/element/${elementId}/click`, {});
  }

  async setValue(sessionId: string, elementId: string, text: string): Promise<void> {
    await this.wd("POST", `/session/${sessionId}/element/${elementId}/value`, { text });
  }

  async scrollDown(sessionId: string): Promise<void> {
    await this.wd("POST", `/session/${sessionId}/actions`, {
      actions: [
        {
          type: "pointer",
          id: "finger1",
          parameters: { pointerType: "touch" },
          actions: [
            { type: "pointerMove", duration: 0, x: 540, y: 800 },
            { type: "pointerDown", button: 0 },
            { type: "pointerMove", duration: 600, x: 540, y: 200 },
            { type: "pointerUp", button: 0 },
          ],
        },
      ],
    });
  }

  async scrollUp(sessionId: string): Promise<void> {
    await this.wd("POST", `/session/${sessionId}/actions`, {
      actions: [
        {
          type: "pointer",
          id: "finger1",
          parameters: { pointerType: "touch" },
          actions: [
            { type: "pointerMove", duration: 0, x: 540, y: 200 },
            { type: "pointerDown", button: 0 },
            { type: "pointerMove", duration: 600, x: 540, y: 800 },
            { type: "pointerUp", button: 0 },
          ],
        },
      ],
    });
  }

  async back(sessionId: string): Promise<void> {
    await this.wd("POST", `/session/${sessionId}/back`, {});
  }

  async deleteSession(sessionId: string): Promise<void> {
    await fetch(`${this.baseUrl}/session/${sessionId}`, {
      method: "DELETE",
      headers: { Authorization: this.authHeader },
    }).catch(() => {});
  }
}
