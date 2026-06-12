import Anthropic from "@anthropic-ai/sdk";

export type DeviceAction =
  | { type: "click"; xpath: string; description: string }
  | { type: "fill"; xpath: string; text: string; description: string }
  | { type: "scroll_down"; description: string }
  | { type: "scroll_up"; description: string }
  | { type: "back"; description: string }
  | { type: "wait"; description: string }
  | { type: "done"; result: string };

export interface LLMDecision {
  reasoning: string;
  action: DeviceAction;
}

export interface LLMProvider {
  decide(
    goal: string,
    screenshotBase64: string,
    history: string[],
    iteration: number
  ): Promise<LLMDecision>;
}

export class ClaudeLLM implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async decide(
    goal: string,
    screenshotBase64: string,
    history: string[],
    iteration: number
  ): Promise<LLMDecision> {
    const historyText =
      history.length > 0
        ? `\n\nActions taken so far:\n${history.map((h, i) => `${i + 1}. ${h}`).join("\n")}`
        : "";

    const response = await this.client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      tools: [
        {
          name: "decide_action",
          description: "Decide the next UI action to take on the Android device to progress toward the goal",
          input_schema: {
            type: "object",
            properties: {
              reasoning: {
                type: "string",
                description: "Brief reasoning about the current screen state and why this action is chosen",
              },
              action: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["click", "fill", "scroll_down", "scroll_up", "back", "wait", "done"],
                    description: "The type of action to perform",
                  },
                  xpath: {
                    type: "string",
                    description: "XPath selector for the target element (required for click and fill)",
                  },
                  text: {
                    type: "string",
                    description: "Text to enter into the field (required for fill)",
                  },
                  description: {
                    type: "string",
                    description: "Human-readable description of this action",
                  },
                  result: {
                    type: "string",
                    description: "Summary of what was accomplished (required when type is done)",
                  },
                },
                required: ["type"],
              },
            },
            required: ["reasoning", "action"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "decide_action" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: screenshotBase64,
              },
            },
            {
              type: "text",
              text: `You are autonomously controlling an Android device via Appium. Analyze the screenshot carefully and decide the single best next action.

Goal: ${goal}
Iteration: ${iteration}/20${historyText}

Guidelines:
- Use "done" only when the goal is fully and verifiably achieved
- Use "wait" if the screen shows a loading spinner or transition animation
- Use "scroll_down" or "scroll_up" to reveal off-screen elements
- XPath examples: //android.widget.Button[@text='Login'], //android.widget.EditText[@resource-id='com.example:id/email']
- For "click" and "fill", you MUST provide a valid XPath selector
- For "fill", clear the field first if it already has content by clicking it first in a prior step`,
            },
          ],
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not return a tool_use block — check model/tool_choice config");
    }

    return toolUse.input as LLMDecision;
  }
}
