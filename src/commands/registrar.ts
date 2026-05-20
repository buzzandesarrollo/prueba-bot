import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../types/index.js";
import { supabase } from "../services/supabase.js";

export default {
  data: new SlashCommandBuilder()
    .setName("registrar")
    .setDescription("Registra tu cuenta en el sistema de gacha"),

  async execute(interaction) {
    const discordId = interaction.user.id;
    const username = interaction.user.username;

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("discord_id", discordId)
      .single();

    if (existingUser) {
      return interaction.reply({
        content: "Ya estas registrado en el sistema.",
        ephemeral: true,
      });
    }

    if (!interaction.guild) {
      return interaction.reply({
        content: "Este comando solo puede usarse en un servidor.",
        ephemeral: true,
      });
    }

    const { data: villages } = await supabase
      .from("villages")
      .select("id, name, discord_role_id");

    if (!villages || villages.length === 0) {
      return interaction.reply({
        content: "No hay aldeas configuradas. Contacta a un administrador.",
        ephemeral: true,
      });
    }

    const member = await interaction.guild.members.fetch(discordId);
    const memberRoleIds = member.roles.cache.map((role) => role.id);

    const matchedVillage = villages.find((v) =>
      memberRoleIds.includes(v.discord_role_id),
    );

    const { error } = await supabase.from("users").insert({
      discord_id: discordId,
      username,
      village_id: matchedVillage?.id ?? null,
      individual_rolls: 0,
    });

    if (error) {
      console.error("[Registrar] Supabase error:", error);
      return interaction.reply({
        content: "Error al registrarte. Intentalo de nuevo.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("Registro Exitoso")
      .setColor(0x5865f2)
      .setDescription(
        matchedVillage
          ? `Bienvenido **${username}**, has sido registrado en **${matchedVillage.name}**.`
          : `Bienvenido **${username}**, has sido registrado. No se detecto una aldea asignada.`,
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
