import { REST, Routes } from "discord.js";
import dotenv from "dotenv";

import { loadCommands } from "./handlers/commandHandler.js";

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error("DISCORD_TOKEN, CLIENT_ID, and GUILD_ID must be set in environment");
}

async function deployCommands(): Promise<void> {
  const commandMap = await loadCommands();

  const commands = [];

  for (const [, command] of commandMap) {
    commands.push(command.data.toJSON());
  }

  const rest = new REST().setToken(token as string);

  console.log(`Deploying ${commands.length} slash commands...`);

  const result = await rest.put(
    Routes.applicationGuildCommands(clientId as string, guildId as string),
    { body: commands },
  );

  console.log(`Commands deployed successfully. Count: ${(result as unknown[]).length}`);
}

deployCommands().catch((error) => {
  console.error("[Deploy] Failed to deploy commands:", error);
  process.exit(1);
});
