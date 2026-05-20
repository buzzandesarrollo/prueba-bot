import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../types/index.js";
import { supabase } from "../services/supabase.js";
import { weightedRandom, getRarityColor, getRarityEmoji } from "../services/gacha.js";

const COOLDOWN_MS = 5 * 60 * 1000;
const MAX_BATCH = 10;

interface RewardRow {
  id: string;
  name: string;
  rarity: string;
  weight: number;
  image_url: string | null;
  active: boolean;
}

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
    )
    .addIntegerOption((option) =>
      option
        .setName("cantidad")
        .setDescription("Cantidad de premios a reclamar (1-10)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(MAX_BATCH),
    ),

  async execute(interaction) {
    const discordId = interaction.user.id;
    const requestedSource = interaction.options.getString("fuente") as "individual" | "village" | null;
    const quantity = interaction.options.getInteger("cantidad") ?? 1;

    if (quantity < 1 || quantity > MAX_BATCH) {
      return interaction.reply({
        content: `La cantidad debe ser entre 1 y ${MAX_BATCH}.`,
        ephemeral: true,
      });
    }

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

    if (user.last_claim_at) {
      const elapsed = Date.now() - new Date(user.last_claim_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        return interaction.reply({
          content: `Debes esperar **${minutes}m ${seconds}s** antes de volver a reclamar.`,
          ephemeral: true,
        });
      }
    }

    let source: "individual" | "village" | null = null;

    if (requestedSource) {
      if (requestedSource === "individual" && user.individual_rolls >= quantity) {
        source = "individual";
      } else if (requestedSource === "village" && user.villages && user.villages.village_rolls >= quantity) {
        if (!user.village_id) {
          return interaction.reply({
            content: "No tienes aldea asignada. Usa `/asignar` primero.",
            ephemeral: true,
          });
        }
        source = "village";
      } else {
        const available: string[] = [];
        if (user.individual_rolls >= quantity) available.push("individual");
        if (user.villages && user.villages.village_rolls >= quantity) available.push("aldea");
        return interaction.reply({
          content: available.length > 0
            ? `No tienes ${quantity} tiradas de tipo "${requestedSource}" disponibles. Disponibles: ${available.join(", ")}`
            : `No tienes ${quantity} tiradas disponibles de ningun tipo.`,
          ephemeral: true,
        });
      }
    } else {
      if (user.individual_rolls >= quantity) {
        source = "individual";
      } else if (user.villages && user.villages.village_rolls >= quantity) {
        source = "village";
      } else {
        return interaction.reply({
          content: `No tienes ${quantity} tiradas disponibles.`,
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

    const claimedRewards: RewardRow[] = [];
    for (let i = 0; i < quantity; i++) {
      const reward = weightedRandom(rewards);
      if (reward) claimedRewards.push(reward);
    }

    if (claimedRewards.length === 0) {
      return interaction.reply({
        content: "Error al seleccionar los premios. Intentalo de nuevo.",
        ephemeral: true,
      });
    }

    if (source === "individual") {
      const { error: updateError } = await supabase
        .from("users")
        .update({
          individual_rolls: user.individual_rolls - quantity,
          last_claim_at: new Date().toISOString(),
        })
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
        .update({ village_rolls: user.villages.village_rolls - quantity })
        .eq("id", user.village_id);

      if (updateError) {
        console.error("[Reclamar] Failed to decrement village rolls:", updateError);
        return interaction.reply({
          content: "Error al consumir la tirada. Intentalo de nuevo.",
          ephemeral: true,
        });
      }
    }

    const claimsData = claimedRewards.map((reward) => ({
      user_id: user.id,
      village_id: source === "village" ? user.village_id : null,
      reward_id: reward.id,
      source,
    }));

    const { error: claimError } = await supabase.from("reward_claims").insert(claimsData);

    if (claimError) {
      console.error("[Reclamar] Failed to insert reward claims:", claimError);
      return interaction.reply({
        content: "Error al registrar los premios. Intentalo de nuevo.",
        ephemeral: true,
      });
    }

    console.log(`[Reclamar] user_id=${user.id}, village_id=${user.village_id}, source=${source}, quantity=${quantity}`);

    const rarityCounts: Record<string, number> = {};
    for (const r of claimedRewards) {
      rarityCounts[r.rarity] = (rarityCounts[r.rarity] || 0) + 1;
    }

    const raritySummary = Object.entries(rarityCounts)
      .map(([rarity, count]) => `${getRarityEmoji(rarity)} ${rarity}: ${count}`)
      .join("\n");

    const bestReward = claimedRewards.reduce((best, r) => {
      const order = ["comun", "raro", "epico", "legendario", "mitico"];
      return order.indexOf(r.rarity) > order.indexOf(best.rarity) ? r : best;
    });

    const embed = new EmbedBuilder()
      .setTitle(`${getRarityEmoji(bestReward.rarity)} ${quantity > 1 ? `${quantity} Premios Obtenidos` : "Premio Obtenido"}`)
      .setColor(getRarityColor(bestReward.rarity))
      .addFields(
        { name: "Fuente", value: source === "individual" ? "Personal" : "Aldea", inline: true },
        { name: "Resumen de Rarezas", value: raritySummary, inline: false },
      )
      .setTimestamp();

    if (quantity === 1 && bestReward.image_url) {
      embed.setDescription(`**${bestReward.name}**`).setImage(bestReward.image_url);
    } else {
      const names = claimedRewards.map((r) => `${getRarityEmoji(r.rarity)} ${r.name}`).join("\n");
      embed.setDescription(names.length > 4096 ? names.slice(0, 4093) + "..." : names);
    }

    return interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
