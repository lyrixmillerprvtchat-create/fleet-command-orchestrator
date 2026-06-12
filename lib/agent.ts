import { DeviceProvider } from "./device";
import { LLMProvider, DeviceAction, LLMDecision } from "./llm";

export type AgentEvent =
  | { type: "session_created"; sessionId: string }
  | { type: "step"; iteration: number; screenshot: string; decision: LLMDecision }
  | { type: "action_result"; iteration: number; success: boolean; message: string }
  | { type: "complete"; result: string; iterations: number }
  | { type: "error"; message: string };

const MAX_ITERATIONS = 20;
const BOOT_DELAY_MS = 3000;
const STEP_DELAY_MS = 1500;

export async function* runAgent(
  goal: string,
  device: DeviceProvider,
  llm: LLMProvider,
  capabilities: Record<string, unknown>
): AsyncGenerator<AgentEvent> {
  let sessionId: string | null = null;

  try {
    sessionId = await device.createSession(capabilities);
    yield { type: "session_created", sessionId };

    await sleep(BOOT_DELAY_MS);

    const history: string[] = [];

    for (let i = 1; i <= MAX_ITERATIONS; i++) {
      const screenshot = await device.screenshot(sessionId);
      const decision = await llm.decide(goal, screenshot, history, i);

      yield { type: "step", iteration: i, screenshot, decision };

      const { action } = decision;

      if (action.type === "done") {
        yield {
          type: "complete",
          result: action.result ?? "Goal achieved",
          iterations: i,
        };
        return;
      }

      let result: { success: boolean; message: string };
      try {
        result = await executeAction(device, sessionId, action);
      } catch (err) {
        result = {
          success: false,
          message: err instanceof Error ? err.message : String(err),
        };
      }

      yield { type: "action_result", iteration: i, ...result };
      history.push(buildHistoryEntry(action, result));

      await sleep(STEP_DELAY_MS);
    }

    yield {
      type: "error",
      message: `Reached maximum iterations (${MAX_ITERATIONS}) without completing goal`,
    };
  } catch (err) {
    yield {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (sessionId) {
      await device.deleteSession(sessionId).catch(() => {});
    }
  }
}

async function executeAction(
  device: DeviceProvider,
  sessionId: string,
  action: DeviceAction
): Promise<{ success: boolean; message: string }> {
  switch (action.type) {
    case "click": {
      const el = await device.findElement(sessionId, "xpath", action.xpath);
      if (!el) return { success: false, message: `Element not found: ${action.xpath}` };
      await device.click(sessionId, el);
      return { success: true, message: `Clicked ${action.xpath}` };
    }
    case "fill": {
      const el = await device.findElement(sessionId, "xpath", action.xpath);
      if (!el) return { success: false, message: `Element not found: ${action.xpath}` };
      await device.setValue(sessionId, el, action.text);
      return { success: true, message: `Filled "${action.text}" into ${action.xpath}` };
    }
    case "scroll_down":
      await device.scrollDown(sessionId);
      return { success: true, message: "Scrolled down" };
    case "scroll_up":
      await device.scrollUp(sessionId);
      return { success: true, message: "Scrolled up" };
    case "back":
      await device.back(sessionId);
      return { success: true, message: "Pressed back" };
    case "wait":
      await sleep(3000);
      return { success: true, message: "Waited 3s" };
    default:
      return { success: false, message: `Unknown action: ${(action as DeviceAction).type}` };
  }
}

function buildHistoryEntry(
  action: DeviceAction,
  result: { success: boolean; message: string }
): string {
  const base = action.type;
  const target = "xpath" in action ? ` [${action.xpath}]` : "";
  const value = "text" in action ? ` "${action.text}"` : "";
  const status = result.success ? "ok" : `FAIL: ${result.message}`;
  return `${base}${target}${value} → ${status}`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
