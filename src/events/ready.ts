import type { Client } from "discord.js";

export function readyEvent(client: Client<true>): void {
  console.log(`[Ready] Logged in as ${client.user.tag}`);
  console.log(`[Ready] Bot is in ${client.guilds.cache.size} guild(s)`);
}
