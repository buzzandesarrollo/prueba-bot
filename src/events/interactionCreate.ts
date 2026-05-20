import type { ChatInputCommandInteraction, Client } from "discord.js";
import type { CommandMap } from "../types/index.js";

export function interactionCreateEvent(
  client: Client<true>,
  commandMap: CommandMap,
): void {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commandMap.get(interaction.commandName);

    if (!command) {
      return;
    }

    try {
      await command.execute(interaction as ChatInputCommandInteraction);
    } catch (error) {
      console.error(`[InteractionCreate] Error executing ${interaction.commandName}:`, error);

      const reply = "Ocurrio un error al ejecutar el comando.";

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: reply, ephemeral: true });
      } else {
        await interaction.reply({ content: reply, ephemeral: true });
      }
    }
  });
}
