import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../types/index.js";
import { supabase } from "../services/supabase.js";
import { hasPermission } from "../utils/permissions.js";

export default {
  data: new SlashCommandBuilder()
    .setName("asignar")
    .setDescription("Asigna tiradas individuales a un usuario")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Usuario destino")
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
    if (!await hasPermission(interaction, "can_assign_rolls")) {
      return interaction.reply({
        content: "No tienes permiso para usar este comando.",
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser("usuario", true);
    const cantidad = interaction.options.getInteger("cantidad", true);

    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("discord_id", targetUser.id)
      .single();

    if (userError || !dbUser) {
      return interaction.reply({
        content: `El usuario **${targetUser.username}** no esta registrado.`,
        ephemeral: true,
      });
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ individual_rolls: dbUser.individual_rolls + cantidad })
      .eq("id", dbUser.id);

    if (updateError) {
      console.error("[Asignar] Failed to update user rolls:", updateError);
      return interaction.reply({
        content: "Error al asignar las tiradas.",
        ephemeral: true,
      });
    }

    const { error: auditError } = await supabase.from("roll_assignments").insert({
      assigned_by_discord_id: interaction.user.id,
      assigned_by_username: interaction.user.username,
      target_type: "user",
      target_user_id: dbUser.id,
      source: "roll_assignment",
      quantity: cantidad,
    });

    if (auditError) {
      console.error("[Asignar] Failed to create audit log:", auditError);
    }

    const embed = new EmbedBuilder()
      .setTitle("Tiradas Asignadas")
      .setColor(0x2ecc71)
      .setDescription(
        `Se asignaron **${cantidad}** tiradas individuales a **${targetUser.username}**.`,
      )
      .addFields(
        { name: "Nuevo balance", value: `${dbUser.individual_rolls + cantidad} tiradas`, inline: true },
        { name: "Asignado por", value: interaction.user.username, inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
