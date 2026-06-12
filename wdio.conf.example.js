/**
 * Fleet Command Orchestrator — Dispatch API example
 *
 * Instead of a WebDriver proxy, the orchestrator runs an autonomous AI agent
 * that controls the device based on a natural language goal.
 *
 * Flow:
 *   POST /api/dispatch  →  Claude (Opus 4.8 vision) takes screenshots,
 *                          plans actions, and executes them via Appium
 *                          until the goal is achieved or 20 iterations pass.
 *
 * Response: Server-Sent Events (SSE) stream — one JSON event per line.
 *
 * Usage:
 *   1. Find the fleet node UUID in the dashboard.
 *   2. POST to /api/dispatch with the node ID and your goal.
 *   3. Consume the SSE stream to follow progress in real time.
 */

const ORCHESTRATOR = "https://fleet-command-orchestrator.vercel.app";
const NODE_ID = process.env.FLEET_NODE_ID || "your-fleet-node-uuid-here";

// --- Minimal Node.js fetch example ---

async function runGoal(goal, capabilities) {
  const res = await fetch(`${ORCHESTRATOR}/api/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nodeId: NODE_ID,
      natural_language_goal: goal,
      // Optional: override Appium session capabilities
      capabilities: capabilities ?? {
        platformName: "Android",
        "appium:automationName": "UiAutomator2",
        "appium:deviceName": "Samsung Galaxy S22",
        "appium:platformVersion": "12.0",
        // "appium:app": "bs://your-bs-app-hash",
      },
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`Dispatch failed: ${err.error}`);
  }

  // Parse SSE stream line by line
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const event = JSON.parse(line.slice(6));
      handleEvent(event);
    }
  }
}

function handleEvent(event) {
  switch (event.type) {
    case "session_created":
      console.log(`[session] ${event.sessionId}`);
      break;
    case "step":
      console.log(`[step ${event.iteration}] ${event.decision.reasoning}`);
      console.log(`  → action: ${event.decision.action.type}`);
      break;
    case "action_result":
      console.log(`  result: ${event.success ? "✓" : "✗"} ${event.message}`);
      break;
    case "complete":
      console.log(`[done in ${event.iterations} steps] ${event.result}`);
      break;
    case "error":
      console.error(`[error] ${event.message}`);
      break;
  }
}

// Example run
runGoal("Open the Settings app and enable Dark Mode").catch(console.error);
