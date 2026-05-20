import type { CommandInteraction } from "discord.js";
import { supabase } from "../services/supabase.js";

interface AuthorizedRole {
  discord_role_id: string;
  can_assign_rolls: boolean;
  can_view_audit: boolean;
}

export async function hasPermission(
  interaction: CommandInteraction,
  permission: "can_assign_rolls" | "can_view_audit",
): Promise<boolean> {
  if (!interaction.member || !("roles" in interaction.member)) {
    return false;
  }

  const memberRoles = (interaction.member as { roles: { cache: { has: (id: string) => boolean } } }).roles.cache;

  const { data: roles } = await supabase
    .from("authorized_roles")
    .select("discord_role_id, can_assign_rolls, can_view_audit");

  if (!roles || roles.length === 0) {
    return false;
  }

  for (const role of roles as AuthorizedRole[]) {
    if (memberRoles.has(role.discord_role_id) && role[permission]) {
      return true;
    }
  }

  return false;
}
