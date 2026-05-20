import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../types/index.js";
import { supabase } from "../services/supabase.js";

function isAdmin(interaction: Parameters<Command["execute"]>[0]): boolean {
  const adminRoleId = process.env.ADMIN_ROLE_ID;

  if (!adminRoleId) {
    return false;
  }

  if (!interaction.member || !("roles" in interaction.member)) {
    return false;
  }

  return (interaction.member as { roles: { cache: { has: (id: string) => boolean } } }).roles.cache.has(adminRoleId);
}

export default {
  data: new SlashCommandBuilder()
    .setName("asignar_aldea")
    .setDescription("Asigna tiradas a una aldea (Admin)")
    .addStringOption((option) =>
      option
        .setName("aldea")
        .setDescription("Nombre de la aldea")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("cantidad")
        .setDescription("Cantidad de tiradas")
        .setRequired(true)
        .setMinValue(1),
    ),

  async execute(interaction) {
    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: "No tienes permiso para usar este comando.",
        ephemeral: true,
      });
    }

    const villageName = interaction.options.getString("aldea", true);
    const cantidad = interaction.options.getInteger("cantidad", true);

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
      .update({ village_rolls: village.village_rolls + cantidad })
      .eq("id", village.id);

    if (updateError) {
      console.error("[AsignarAldea] Failed to update village rolls:", updateError);
      return interaction.reply({
        content: "Error al asignar las tiradas.",
        ephemeral: true,
      });
    }

    const { error: auditError } = await supabase.from("roll_assignments").insert({
      assigned_by_discord_id: interaction.user.id,
      target_type: "village",
      target_village_id: village.id,
      source: "admin_assignment",
      quantity: cantidad,
    });

    if (auditError) {
      console.error("[AsignarAldea] Failed to create audit log:", auditError);
    }

    const embed = new EmbedBuilder()
      .setTitle("Tiradas Asignadas a Aldea")
      .setColor(0x2ecc71)
      .setDescription(
        `Se asignaron **${cantidad}** tiradas a la aldea **${village.name}**.`,
      )
      .addFields(
        { name: "Nuevo balance", value: `${village.village_rolls + cantidad} tiradas`, inline: true },
        { name: "Asignado por", value: interaction.user.username, inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
