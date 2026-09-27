const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder
} = require("discord.js");
const { RECIPES, HEAT, getRecipe, getCookSeconds } = require("./cookingRecipes");

const LEVELS_PATH = path.join(__dirname, "../levels.json");
const ICON_DIR = path.join(__dirname, "../cooking");
const sessions = new Map();

function loadLevels() {
  if (!fs.existsSync(LEVELS_PATH)) fs.writeFileSync(LEVELS_PATH, "{}");
  try { return JSON.parse(fs.readFileSync(LEVELS_PATH, "utf8")); }
  catch { return {}; }
}
function saveLevels(data) { fs.writeFileSync(LEVELS_PATH, JSON.stringify(data, null, 2)); }

function getUser(levels, userId) {
  if (!levels[userId]) levels[userId] = { wl: 0, level: 1, xp: 0, items: {}, fishBackpack: [] };
  const u = levels[userId];
  if (!u.items) u.items = {};
  if (!u.professions) u.professions = {};
  return u;
}
function getCooking(u) {
  if (!u.professions.cooking) u.professions.cooking = { unlocked: false, level: 1, xp: 0 };
  const c = u.professions.cooking;
  c.level = Number(c.level || 1);
  c.xp = Number(c.xp || 0);
  return c;
}
function xpNeeded(level) { return 100 + (Math.max(1, level) - 1) * 75; }
function addXP(cooking, amount) {
  cooking.xp += amount;
  let levelsGained = 0;
  while (cooking.xp >= xpNeeded(cooking.level)) {
    cooking.xp -= xpNeeded(cooking.level);
    cooking.level += 1;
    levelsGained++;
  }
  return levelsGained;
}
function sessionFor(userId) {
  if (!sessions.has(userId)) sessions.set(userId, { recipeId: "chips_guacamole", heat: "low", oven: "Home Oven", startedAt: null });
  return sessions.get(userId);
}
function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}
function ingredientLines(recipe, items) {
  return recipe.ingredients.map(i => `${(items[i.key] || 0) >= i.amount ? "✓" : "✗"} ${i.name} x${i.amount} (you: ${items[i.key] || 0})`).join("\n");
}
function missingIngredients(recipe, items) {
  return recipe.ingredients.filter(i => Number(items[i.key] || 0) < i.amount);
}
function consume(recipe, items) {
  for (const i of recipe.ingredients) items[i.key] = Math.max(0, Number(items[i.key] || 0) - i.amount);
}
function buildEmbed(user, interactionUser) {
  const cooking = getCooking(user);
  const s = sessionFor(interactionUser.id);
  const recipe = getRecipe(s.recipeId) || Object.values(RECIPES)[0];
  const seconds = getCookSeconds(recipe, s.heat);
  let status = "Ready to cook";
  if (s.startedAt) {
    const elapsed = (Date.now() - s.startedAt) / 1000;
    const left = seconds - elapsed;
    status = left > 0 ? `Cooking... ${formatTime(left)} remaining` : "READY! Press Take Out";
  }
  return new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle("Cooking Simulator")
    .setDescription(`Chef: **${interactionUser.username}**\nCooking Level: **${cooking.level}**\nXP: **${cooking.xp}/${xpNeeded(cooking.level)}**`)
    .addFields(
      { name: "Recipe", value: `**${recipe.name}**\nRequires Cooking Lv. ${recipe.level}` },
      { name: "Oven", value: s.oven, inline: true },
      { name: "Heat", value: HEAT[s.heat].label, inline: true },
      { name: "Cook Time", value: formatTime(seconds), inline: true },
      { name: "Ingredients", value: ingredientLines(recipe, user.items) || "None" },
      { name: "Status", value: status }
    )
    .setFooter({ text: "NoobV2 Cooking • ingredients are taken when cooking starts" });
}
function buildComponents(userId) {
  const s = sessionFor(userId);
  const recipeMenu = new StringSelectMenuBuilder().setCustomId(`cook_recipe_${userId}`).setPlaceholder("Choose a recipe").addOptions(
    Object.values(RECIPES).map(r => ({ label: r.name.slice(0, 100), value: r.id, description: `Lv.${r.level} • ${formatTime(r.lowSeconds)} on Low`, default: r.id === s.recipeId }))
  );
  const heatMenu = new StringSelectMenuBuilder().setCustomId(`cook_heat_${userId}`).setPlaceholder("Choose heat").addOptions(
    Object.entries(HEAT).map(([key, h]) => ({ label: h.label, value: key, default: key === s.heat }))
  );
  const ovenMenu = new StringSelectMenuBuilder().setCustomId(`cook_oven_${userId}`).setPlaceholder("Choose oven").addOptions(
    ["Home Oven", "Commercial Oven", "Taco Truck Oven", "Replicator", "Master Chef's Oven"].map(name => ({ label: name, value: name, default: name === s.oven }))
  );
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cook_start_${userId}`).setLabel("Start Cooking").setStyle(ButtonStyle.Success).setDisabled(Boolean(s.startedAt)),
    new ButtonBuilder().setCustomId(`cook_take_${userId}`).setLabel("Take Out").setStyle(ButtonStyle.Primary).setDisabled(!s.startedAt),
    new ButtonBuilder().setCustomId(`cook_refresh_${userId}`).setLabel("Refresh").setStyle(ButtonStyle.Secondary)
  );
  return [new ActionRowBuilder().addComponents(recipeMenu), new ActionRowBuilder().addComponents(ovenMenu), new ActionRowBuilder().addComponents(heatMenu), buttons];
}
async function open(interaction) {
  const levels = loadLevels();
  const user = getUser(levels, interaction.user.id);
  const cooking = getCooking(user);
  if (!cooking.unlocked) return interaction.reply({ content: "You haven't unlocked Cooking yet.", ephemeral: true });
  saveLevels(levels);
  return interaction.reply({ embeds: [buildEmbed(user, interaction.user)], components: buildComponents(interaction.user.id), ephemeral: true });
}
async function refresh(interaction) {
  const levels = loadLevels();
  const user = getUser(levels, interaction.user.id);
  return interaction.update({ embeds: [buildEmbed(user, interaction.user)], components: buildComponents(interaction.user.id) });
}
async function handleSelect(interaction) {
  if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith("cook_")) return false;
  const parts = interaction.customId.split("_");
  const type = parts[1];
  const ownerId = parts[2];
  if (interaction.user.id !== ownerId) { await interaction.reply({ content: "This cooking session isn't yours.", ephemeral: true }); return true; }
  const s = sessionFor(ownerId);
  if (s.startedAt) { await interaction.reply({ content: "Finish the current dish before changing the setup.", ephemeral: true }); return true; }
  if (type === "recipe") s.recipeId = interaction.values[0];
  if (type === "heat") s.heat = interaction.values[0];
  if (type === "oven") s.oven = interaction.values[0];
  await refresh(interaction);
  return true;
}
async function handleButton(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith("cook_")) return false;
  const parts = interaction.customId.split("_");
  const action = parts[1];
  const ownerId = parts[2];
  if (interaction.user.id !== ownerId) { await interaction.reply({ content: "This cooking session isn't yours.", ephemeral: true }); return true; }
  const levels = loadLevels();
  const user = getUser(levels, ownerId);
  const cooking = getCooking(user);
  const s = sessionFor(ownerId);
  const recipe = getRecipe(s.recipeId);
  if (!cooking.unlocked) { await interaction.reply({ content: "Cooking is locked.", ephemeral: true }); return true; }
  if (action === "refresh") { await refresh(interaction); return true; }
  if (action === "start") {
    if (!recipe) { await interaction.reply({ content: "Recipe not found.", ephemeral: true }); return true; }
    if (cooking.level < recipe.level) { await interaction.reply({ content: `You need Cooking Level ${recipe.level}.`, ephemeral: true }); return true; }
    const missing = missingIngredients(recipe, user.items);
    if (missing.length) { await interaction.reply({ content: "Missing ingredients:\n" + missing.map(i => `• ${i.name} x${i.amount} (you: ${user.items[i.key] || 0})`).join("\n"), ephemeral: true }); return true; }
    consume(recipe, user.items);
    s.startedAt = Date.now();
    s.startedRecipeId = recipe.id;
    s.startedHeat = s.heat;
    levels[ownerId] = user;
    saveLevels(levels);
    await refresh(interaction);
    return true;
  }
  if (action === "take") {
    if (!s.startedAt) { await interaction.reply({ content: "Nothing is cooking.", ephemeral: true }); return true; }
    const activeRecipe = getRecipe(s.startedRecipeId || s.recipeId);
    const required = getCookSeconds(activeRecipe, s.startedHeat || s.heat);
    const elapsed = (Date.now() - s.startedAt) / 1000;
    if (elapsed < required) { await interaction.reply({ content: `Too early! **${formatTime(required - elapsed)}** remaining.`, ephemeral: true }); return true; }
    const over = elapsed - required;
    s.startedAt = null;
    s.startedRecipeId = null;
    const burnt = over > Math.max(20, required * 0.5);
    if (burnt) {
      user.items.burntSlime = Number(user.items.burntSlime || 0) + 1;
      levels[ownerId] = user; saveLevels(levels);
      await interaction.update({ embeds: [buildEmbed(user, interaction.user)], components: buildComponents(ownerId) });
      await interaction.followUp({ content: "You left it in too long. The dish burned and became **Burnt Slime x1**.", ephemeral: true });
      return true;
    }
    user.items[activeRecipe.outputKey] = Number(user.items[activeRecipe.outputKey] || 0) + activeRecipe.outputAmount;
    const gainedLevels = addXP(cooking, activeRecipe.xp);
    levels[ownerId] = user; saveLevels(levels);
    await interaction.update({ embeds: [buildEmbed(user, interaction.user)], components: buildComponents(ownerId) });
    await interaction.followUp({ content: `Cooking success! You made **${activeRecipe.name} x${activeRecipe.outputAmount}** and gained **${activeRecipe.xp} Cooking XP**.${gainedLevels ? `\nCooking level increased to **${cooking.level}**!` : ""}`, ephemeral: true });
    return true;
  }
  return false;
}

module.exports = { open, handleButton, handleSelect };
