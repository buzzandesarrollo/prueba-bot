import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../types/index.js";
import { supabase } from "../services/supabase.js";
import { weightedRandom, getRarityColor, getRarityEmoji } from "../services/gacha.js";

export default {
  data: new SlashCommandBuilder()
    .setName("reclamar")
    .setDescription("Consume una tirada y obtiene un premio")
    .addStringOption((option) =>
      option
        .setName("fuente")
        .setDescription("Tipo de tirada a consumir")
        .setRequired(false)
        .addChoices(
          { name: "Individual", value: "individual" },
          { name: "Aldea", value: "village" },
        ),
    ),

  async execute(interaction) {
    const discordId = interaction.user.id;
    const requestedSource = interaction.options.getString("fuente") as "individual" | "village" | null;

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*, villages(*)")
      .eq("discord_id", discordId)
      .single();

    if (userError || !user) {
      return interaction.reply({
        content: "No estas registrado. Usa `/registrar` primero.",
        ephemeral: true,
      });
    }

    let source: "individual" | "village" | null = null;

    if (requestedSource) {
      if (requestedSource === "individual" && user.individual_rolls > 0) {
        source = "individual";
      } else if (requestedSource === "village" && user.villages && user.villages.village_rolls > 0) {
        if (!user.village_id) {
          return interaction.reply({
            content: "No tienes aldea asignada. Usa `/asignar` primero.",
            ephemeral: true,
          });
        }
        source = "village";
      } else {
        const available: string[] = [];
        if (user.individual_rolls > 0) available.push("individual");
        if (user.villages && user.villages.village_rolls > 0) available.push("aldea");
        return interaction.reply({
          content: available.length > 0
            ? `No tienes tiradas de tipo "${requestedSource}" disponibles. Disponibles: ${available.join(", ")}`
            : "No tienes tiradas disponibles de ningun tipo.",
          ephemeral: true,
        });
      }
    } else {
      if (user.individual_rolls > 0) {
        source = "individual";
      } else if (user.villages && user.villages.village_rolls > 0) {
        source = "village";
      } else {
        return interaction.reply({
          content: "No tienes tiradas disponibles.",
          ephemeral: true,
        });
      }
    }

    const { data: rewards } = await supabase
      .from("rewards")
      .select("*")
      .eq("active", true);

    if (!rewards || rewards.length === 0) {
      return interaction.reply({
        content: "No hay premios disponibles actualmente.",
        ephemeral: true,
      });
    }

    const reward = weightedRandom(rewards);

    if (!reward) {
      return interaction.reply({
        content: "Error al seleccionar el premio. Intentalo de nuevo.",
        ephemeral: true,
      });
    }

    if (source === "individual") {
      const { error: updateError } = await supabase
        .from("users")
        .update({ individual_rolls: user.individual_rolls - 1 })
        .eq("id", user.id);

      if (updateError) {
        console.error("[Reclamar] Failed to decrement individual rolls:", updateError);
        return interaction.reply({
          content: "Error al consumir la tirada. Intentalo de nuevo.",
          ephemeral: true,
        });
      }
    }

    if (source === "village") {
      if (!user.village_id) {
        return interaction.reply({
          content: "Error: No tienes aldea asignada.",
          ephemeral: true,
        });
      }

      const { error: updateError } = await supabase
        .from("villages")
        .update({ village_rolls: user.villages.village_rolls - 1 })
        .eq("id", user.village_id);

      if (updateError) {
        console.error("[Reclamar] Failed to decrement village rolls:", updateError);
        return interaction.reply({
          content: "Error al consumir la tirada. Intentalo de nuevo.",
          ephemeral: true,
        });
      }
    }

    console.log(`[Reclamar] user_id=${user.id}, village_id=${user.village_id}, source=${source}, reward_id=${reward.id}`);

    const { error: claimError } = await supabase.from("reward_claims").insert({
      user_id: user.id,
      village_id: source === "village" ? user.village_id : null,
      reward_id: reward.id,
      source,
    });

    if (claimError) {
      console.error("[Reclamar] Failed to insert reward claim:", claimError);
      return interaction.reply({
        content: "Error al registrar el premio. Intentalo de nuevo.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${getRarityEmoji(reward.rarity)} Premio Obtenido`)
      .setDescription(`**${reward.name}**`)
      .setColor(getRarityColor(reward.rarity))
      .addFields(
        { name: "Rareza", value: `${getRarityEmoji(reward.rarity)} ${reward.rarity}`, inline: true },
        { name: "Fuente", value: source === "individual" ? "Personal" : "Aldea", inline: true },
      )
      .setTimestamp();

    if (reward.image_url) {
      embed.setImage(reward.image_url);
    }

    return interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
