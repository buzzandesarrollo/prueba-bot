import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../types/index.js";
import { supabase } from "../services/supabase.js";
import { hasPermission } from "../utils/permissions.js";

interface AssignmentRow {
  id: string;
  assigned_by_discord_id: string;
  assigned_by_username: string | null;
  target_type: string;
  target_user_id: string | null;
  target_village_id: string | null;
  source: string;
  quantity: number;
  assigned_at: string;
}

interface UserRow {
  id: string;
  username: string;
}

interface VillageRow {
  id: string;
  name: string;
}

export default {
  data: new SlashCommandBuilder()
    .setName("auditoria")
    .setDescription("Muestra el log de tiradas asignadas")
    .addIntegerOption((option) =>
      option
        .setName("limite")
        .setDescription("Cantidad de registros a mostrar (default 25)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100),
    ),

  async execute(interaction) {
    if (!await hasPermission(interaction, "can_view_audit")) {
      return interaction.reply({
        content: "No tienes permiso para usar este comando.",
        ephemeral: true,
      });
    }

    const limit = interaction.options.getInteger("limite") ?? 25;

    const { data: assignments, error: auditError } = await supabase
      .from("roll_assignments")
      .select("*")
      .order("assigned_at", { ascending: false })
      .limit(limit);

    if (auditError) {
      console.error("[Auditoria] Failed to fetch assignments:", auditError);
      return interaction.reply({
        content: "Error al obtener el log de auditoria.",
        ephemeral: true,
      });
    }

    if (!assignments || assignments.length === 0) {
      return interaction.reply({
        content: "No hay registros de asignaciones.",
        ephemeral: true,
      });
    }

    const userIds = assignments
      .filter((a: AssignmentRow) => a.target_user_id)
      .map((a: AssignmentRow) => a.target_user_id as string);

    const villageIds = assignments
      .filter((a: AssignmentRow) => a.target_village_id)
      .map((a: AssignmentRow) => a.target_village_id as string);

    let userMap: Record<string, string> = {};
    let villageMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, username")
        .in("id", [...new Set(userIds)]);
      if (users) {
        userMap = Object.fromEntries((users as UserRow[]).map((u) => [u.id, u.username]));
      }
    }

    if (villageIds.length > 0) {
      const { data: villages } = await supabase
        .from("villages")
        .select("id, name")
        .in("id", [...new Set(villageIds)]);
      if (villages) {
        villageMap = Object.fromEntries((villages as VillageRow[]).map((v) => [v.id, v.name]));
      }
    }

    const lines = assignments.map((a: AssignmentRow) => {
      const assigner = a.assigned_by_username ?? a.assigned_by_discord_id;
      const target = a.target_type === "user"
        ? `**${userMap[a.target_user_id!] ?? a.target_user_id}**`
        : `aldea **${villageMap[a.target_village_id!] ?? a.target_village_id}**`;
      const date = new Date(a.assigned_at).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const time = new Date(a.assigned_at).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${assigner} asigno **${a.quantity}** tiradas a ${target} el ${date} a las ${time}`;
    });

    const embed = new EmbedBuilder()
      .setTitle("Log de Asignaciones")
      .setColor(0x5865f2)
      .setDescription(lines.join("\n"))
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
} satisfies Command;
