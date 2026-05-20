import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";

import type { CommandMap } from "./types/index.js";
import { loadCommands } from "./handlers/commandHandler.js";
import { readyEvent } from "./events/ready.js";
import { interactionCreateEvent } from "./events/interactionCreate.js";

dotenv.config();

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error("DISCORD_TOKEN must be set in environment");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function bootstrap(): Promise<void> {
  const commandMap: CommandMap = await loadCommands();

  client.commands = new Collection();
  for (const [name, command] of commandMap) {
    client.commands.set(name, command);
  }

  client.once("ready", () => {
    readyEvent(client as Client<true>);
  });

  interactionCreateEvent(client as Client<true>, commandMap);

  await client.login(token);
}

bootstrap().catch((error) => {
  console.error("[Bootstrap] Fatal error:", error);
  process.exit(1);
});
