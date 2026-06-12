/**
 * WebdriverIO config — routes traffic through Fleet Command Orchestrator proxy.
 *
 * The proxy injects your BrowserStack/LambdaTest Access Key server-side.
 * Your local script never needs credentials; it only needs the node UUID.
 *
 * Usage:
 *   1. Copy this file to wdio.conf.js in your test project.
 *   2. Set NODE_ID to the fleet node's UUID (visible in the dashboard).
 *   3. Run: npx wdio run wdio.conf.js
 */

const NODE_ID = process.env.FLEET_NODE_ID || "your-fleet-node-uuid-here";
const ORCHESTRATOR_HOST = "fleet-command-orchestrator.vercel.app";

exports.config = {
  protocol: "https",
  hostname: ORCHESTRATOR_HOST,
  port: 443,
  path: `/api/proxy/${NODE_ID}`,

  capabilities: [
    {
      platformName: "Android",
      "appium:deviceName": "Samsung Galaxy S22",
      "appium:platformVersion": "12.0",
      // For BrowserStack: "appium:app": "bs://your-app-hash"
      // For LambdaTest:   "appium:app": "lt://your-app-hash"
      "appium:automationName": "UiAutomator2",
    },
  ],

  framework: "mocha",
  reporters: ["spec"],

  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },

  // Session commands are automatically routed to the same remote session:
  // POST /api/proxy/{nodeId}/session          → creates session, returns { sessionId }
  // POST /api/proxy/{nodeId}/session/{id}/url → proxy forwards to same provider session
  // The sessionId lives in the URL path, so no extra sticky-session logic is needed.
};
