import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../types/index.js";
import { supabase } from "../services/supabase.js";
import { hasPermission } from "../utils/permissions.js";

export default {
  data: new SlashCommandBuilder()
    .setName("banner_aldea")
    .setDescription("Establece el banner de una aldea")
    .addStringOption((option) =>
      option
        .setName("aldea")
        .setDescription("Nombre de la aldea")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("URL de la imagen del banner")
        .setRequired(true),
    ),

  async execute(interaction) {
    if (!await hasPermission(interaction, "can_assign_rolls")) {
      return interaction.reply({
        content: "No tienes permiso para usar este comando.",
        ephemeral: true,
      });
    }

    const villageName = interaction.options.getString("aldea", true);
    const bannerUrl = interaction.options.getString("url", true);

    const { data: village, error: villageError } = await supabase
      .from("villages")
      .select("*")
      .eq("name", villageName)
      .single();

    if (villageError || !village) {
      return interaction.reply({
        content: `La aldea **${villageName}** no existe.`,
        ephemeral: true,
      });
    }

    const { error: updateError } = await supabase
      .from("villages")
      .update({ banner_url: bannerUrl })
      .eq("id", village.id);

    if (updateError) {
      console.error("[BannerAldea] Failed to update banner:", updateError);
      return interaction.reply({
        content: "Error al actualizar el banner.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Banner actualizado: ${village.name}`)
      .setColor(0x2ecc71)
      .setImage(bannerUrl)
      .setDescription(`El banner de **${village.name}** ha sido actualizado.`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
