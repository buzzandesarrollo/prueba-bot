import type { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from "discord.js";

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
}

export type CommandMap = Map<string, Command>;

export interface DbUser {
  id: string;
  discord_id: string;
  username: string;
  village_id: string | null;
  individual_rolls: number;
  created_at: string;
  updated_at: string;
}

export interface DbVillage {
  id: string;
  name: string;
  discord_role_id: string;
  village_rolls: number;
  created_at: string;
  updated_at: string;
}

export interface DbReward {
  id: string;
  name: string;
  rarity: string;
  weight: number;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbRewardClaim {
  id: string;
  user_id: string;
  village_id: string | null;
  reward_id: string;
  source: "individual" | "village";
  claimed_at: string;
}

export interface DbRollAssignment {
  id: string;
  assigned_by_discord_id: string;
  target_type: "user" | "village";
  target_user_id: string | null;
  target_village_id: string | null;
  source: string;
  quantity: number;
  assigned_at: string;
}

export interface UserWithVillage extends DbUser {
  villages: DbVillage | null;
}
