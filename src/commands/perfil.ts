import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../types/index.js";
import { supabase } from "../services/supabase.js";
import { getRarityColor, getRarityEmoji } from "../services/gacha.js";

interface ClaimReward {
  name: string;
  rarity: string;
}

interface ClaimUser {
  username: string;
}

interface ClaimRow {
  claimed_at: string;
  source: string;
  rewards: ClaimReward | ClaimReward[] | null;
}

export default {
  data: new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Muestra tu perfil de gacha"),

  async execute(interaction) {
    const discordId = interaction.user.id;

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

    const { data: claims } = await supabase
      .from("reward_claims")
      .select("claimed_at, source, rewards(name, rarity)")
      .eq("user_id", user.id)
      .eq("source", "individual")
      .order("claimed_at", { ascending: false })
      .limit(25);

    const embed = new EmbedBuilder()
      .setTitle(`Perfil de ${user.username}`)
      .setColor(0x5865f2)
      .addFields(
        { name: "Aldea", value: user.villages?.name ?? "Ninguna", inline: true },
        { name: "Tiradas Individuales", value: `${user.individual_rolls}`, inline: true },
        { name: "Tiradas de Aldea", value: `${user.villages?.village_rolls ?? 0}`, inline: true },
      )
      .setTimestamp();

    if (claims && claims.length > 0) {
      const historyText = claims
        .map((c: ClaimRow) => {
          const reward = Array.isArray(c.rewards) ? c.rewards[0] : c.rewards;
          if (!reward) return null;
          const date = new Date(c.claimed_at).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          return `${getRarityEmoji(reward.rarity)} **${reward.name}** (${c.source}) - ${date}`;
        })
        .filter((line: string | null): line is string => line !== null)
        .join("\n");

      if (historyText) {
        embed.addFields({
          name: "Historial Reciente",
          value: historyText.length > 1024 ? historyText.slice(0, 1021) + "..." : historyText,
        });
      }
    } else {
      embed.addFields({ name: "Historial", value: "Sin premios obtenidos." });
    }

    return interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
