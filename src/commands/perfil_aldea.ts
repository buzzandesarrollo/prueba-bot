import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../types/index.js";
import { supabase } from "../services/supabase.js";
import { getRarityEmoji } from "../services/gacha.js";

interface ClaimReward {
  name: string;
  rarity: string;
}

interface ClaimRow {
  claimed_at: string;
  user_id: string;
  reward_id: string;
  rewards: ClaimReward | ClaimReward[] | null;
}

export default {
  data: new SlashCommandBuilder()
    .setName("perfil_aldea")
    .setDescription("Muestra el perfil de tu aldea"),

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

    if (!user.village_id || !user.villages) {
      return interaction.reply({
        content: "No perteneces a ninguna aldea.",
        ephemeral: true,
      });
    }

    const { data: claims, error: claimsError } = await supabase
      .from("reward_claims")
      .select("claimed_at, user_id, reward_id, rewards(name, rarity)")
      .eq("village_id", user.village_id)
      .eq("source", "village")
      .order("claimed_at", { ascending: false })
      .limit(25);

    console.log(`[PerfilAldea] village_id=${user.village_id}, claims=${claims?.length ?? 0}, error=${claimsError?.message ?? 'none'}`);

    let userMap: Record<string, string> = {};
    if (claims && claims.length > 0) {
      const userIds = claims.map((c) => c.user_id).filter(Boolean);
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, username")
          .in("id", userIds);
        if (users) {
          userMap = Object.fromEntries(users.map((u) => [u.id, u.username]));
        }
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`Aldea: ${user.villages.name}`)
      .setColor(0x5865f2)
      .addFields(
        { name: "Tiradas Disponibles", value: `${user.villages.village_rolls}`, inline: true },
      )
      .setTimestamp();

    if (claims && claims.length > 0) {
      const historyText = claims
        .map((c) => {
          const reward = Array.isArray(c.rewards) ? c.rewards[0] : c.rewards;
          const username = userMap[c.user_id] ?? "Desconocido";
          if (!reward) return null;
          const date = new Date(c.claimed_at).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          return `${getRarityEmoji(reward.rarity)} **${username}** obtuvo **${reward.name}** (${date})`;
        })
        .filter((line: string | null): line is string => line !== null)
        .join("\n");

      if (historyText) {
        embed.addFields({
          name: "Historial de la Aldea",
          value: historyText.length > 1024 ? historyText.slice(0, 1021) + "..." : historyText,
        });
      }
    } else {
      embed.addFields({ name: "Historial", value: "Sin premios obtenidos." });
    }

    return interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
