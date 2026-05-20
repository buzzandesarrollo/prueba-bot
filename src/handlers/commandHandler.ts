import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command, CommandMap } from "../types/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadCommands(): Promise<CommandMap> {
  const commandsPath = join(__dirname, "..", "commands");
  const commandFiles = await readdir(commandsPath);

  const commandMap: CommandMap = new Map();

  for (const file of commandFiles) {
    if (!file.endsWith(".ts") && !file.endsWith(".js")) {
      continue;
    }

    const filePath = join(commandsPath, file);
    const fileUrl = `file://${filePath}`;

    try {
      const module = await import(fileUrl) as { default?: Command; [key: string]: unknown };
      const command = module.default;

      if (!command) {
        console.warn(`[CommandHandler] Skipping ${file}: no default export`);
        continue;
      }

      if (!command.data || !command.execute) {
        console.warn(`[CommandHandler] Skipping ${file}: missing data or execute`);
        continue;
      }

      commandMap.set(command.data.name, command);
      console.log(`[CommandHandler] Loaded: ${command.data.name}`);
    } catch (error) {
      console.error(`[CommandHandler] Failed to load ${file}:`, error);
    }
  }

  return commandMap;
}
