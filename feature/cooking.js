const fs = require("fs");
const path = require("path");

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits
} = require("discord.js");

const {
  RECIPES,
  HEAT,
  getRecipe,
  getCookSeconds
} = require("./cookingRecipes");


// =====================================================
// SETTINGS
// =====================================================

const LEVELS_PATH = path.join(__dirname, "../levels.json");

// NoobV2/cooking/
const ICON_DIR = path.join(__dirname, "../cooking");

const sessions = new Map();

const CHEF_PACK_PRICE = 3;

const TASK_COST = 10;
const TASK_REWARD = 250;


// =====================================================
// CHEF PACK INGREDIENTS
// =====================================================

const CHEF_PACK_INGREDIENTS = [
  { key: "apple", name: "Apple" },
  { key: "avocado", name: "Avocado" },
  { key: "bacon", name: "Bacon" },
  { key: "bakingChocolate", name: "Baking Chocolate" },
  { key: "blueberry", name: "Blueberry" },
  { key: "caramel", name: "Caramel" },
  { key: "cherry", name: "Cherry" },
  { key: "chickenMeat", name: "Chicken Meat" },
  { key: "coconutMilk", name: "Coconut Milk" },
  { key: "cornMeal", name: "Corn Meal" },
  { key: "crushedIce", name: "Crushed Ice" },
  { key: "dough", name: "Dough" },
  { key: "egg", name: "Egg" },
  { key: "fishChunk", name: "Fish Chunk" },
  { key: "flour", name: "Flour" },
  { key: "groundBeef", name: "Ground Beef" },
  { key: "groundNutmeg", name: "Ground Nutmeg" },
  { key: "habaneroPepper", name: "Habanero Pepper" },
  { key: "honey", name: "Honey" },
  { key: "lemon", name: "Lemon" },
  { key: "lettuce", name: "Lettuce" },
  { key: "marshmallow", name: "Marshmallow" },
  { key: "milk", name: "Milk" },
  { key: "onion", name: "Onion" },
  { key: "orangeJuice", name: "Orange Juice" },
  { key: "pepper", name: "Pepper" },
  { key: "pineappleSlice", name: "Pineapple Slice" },
  { key: "potato", name: "Potato" },
  { key: "rice", name: "Rice" },
  { key: "salsa", name: "Salsa" },
  { key: "salt", name: "Salt" },
  { key: "sprigOfMint", name: "Sprig of Mint" },
  { key: "sugar", name: "Sugar" },
  { key: "sweetPotatoMash", name: "Sweet Potato Mash" },
  { key: "swissCheeseBlock", name: "Swiss Cheese Block" },
  { key: "tomato", name: "Tomato" },
  { key: "waterBucket", name: "Water Bucket" }
];


// =====================================================
// LEVELS.JSON
// =====================================================

function loadLevels() {
  if (!fs.existsSync(LEVELS_PATH)) {
    fs.writeFileSync(LEVELS_PATH, "{}");
  }

  try {
    return JSON.parse(
      fs.readFileSync(LEVELS_PATH, "utf8")
    );
  } catch (err) {
    console.error("Failed to read levels.json:", err);
    return {};
  }
}


function saveLevels(data) {
  fs.writeFileSync(
    LEVELS_PATH,
    JSON.stringify(data, null, 2)
  );
}


// =====================================================
// USER DATA
// =====================================================

function getUser(levels, userId) {
  if (!levels[userId]) {
    levels[userId] = {
      wl: 0,
      level: 1,
      xp: 0,
      items: {},
      fishBackpack: []
    };
  }

  const user = levels[userId];

  user.wl = Number(user.wl || 0);

  if (!user.items) {
    user.items = {};
  }

  if (!user.professions) {
    user.professions = {};
  }

  return user;
}


function getCooking(user) {
  if (!user.professions.cooking) {
    user.professions.cooking = {
      unlocked: false,
      level: 1,
      xp: 0
    };
  }

  const cooking = user.professions.cooking;

  cooking.level = Number(cooking.level || 1);
  cooking.xp = Number(cooking.xp || 0);

  return cooking;
}


// =====================================================
// XP
// =====================================================

function xpNeeded(level) {
  return 100 + (Math.max(1, level) - 1) * 75;
}


function addXP(cooking, amount) {
  cooking.xp += Number(amount || 0);

  let gained = 0;

  while (cooking.xp >= xpNeeded(cooking.level)) {
    cooking.xp -= xpNeeded(cooking.level);
    cooking.level++;
    gained++;
  }

  return gained;
}


// =====================================================
// SESSION
// =====================================================

function sessionFor(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      recipeId: "chips_guacamole",
      heat: "low",
      oven: "Home Oven",

      startedAt: null,
      startedRecipeId: null,
      startedHeat: null,
      startedOven: null,

      taskMode: false
    });
  }

  return sessions.get(userId);
}


function resetCookingSession(session) {
  session.startedAt = null;
  session.startedRecipeId = null;
  session.startedHeat = null;
  session.startedOven = null;
}


function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));

  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}


function formatElapsed(seconds) {
  const total = Math.max(0, Math.floor(seconds));

  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}


function progressBar(current, total, size = 14) {
  if (!total || total <= 0) {
    return "░".repeat(size);
  }

  const ratio = Math.max(
    0,
    Math.min(1, current / total)
  );

  const filled = Math.round(ratio * size);

  return (
    "█".repeat(filled) +
    "░".repeat(size - filled)
  );
}


// =====================================================
// INGREDIENTS
// =====================================================

function ingredientLines(recipe, items) {
  if (!recipe?.ingredients?.length) {
    return "No ingredients.";
  }

  return recipe.ingredients
    .map(ingredient => {
      const amount = Number(
        items[ingredient.key] || 0
      );

      const enough =
        amount >= Number(ingredient.amount || 0);

      return (
        `${enough ? "✓" : "✗"} ` +
        `${ingredient.name} x${ingredient.amount} ` +
        `(you: ${amount})`
      );
    })
    .join("\n");
}


function missingIngredients(recipe, items) {
  return recipe.ingredients.filter(
    ingredient =>
      Number(items[ingredient.key] || 0) <
      Number(ingredient.amount || 0)
  );
}


// Ingredients are consumed directly from user.items.
function consume(recipe, items) {
  for (const ingredient of recipe.ingredients) {
    const current = Number(
      items[ingredient.key] || 0
    );

    const remaining = Math.max(
      0,
      current - Number(ingredient.amount || 0)
    );

    if (remaining <= 0) {
      delete items[ingredient.key];
    } else {
      items[ingredient.key] = remaining;
    }
  }
}


// =====================================================
// TASK SYSTEM
// =====================================================

function getTask(cooking) {
  return cooking.task || null;
}


function createTask(cooking) {
  const available = Object.values(RECIPES).filter(
    recipe =>
      Number(recipe.level || 1) <= cooking.level
  );

  if (!available.length) {
    return null;
  }

  const recipe =
    available[
      Math.floor(Math.random() * available.length)
    ];

  // 3-5 dishes.
  const target =
    3 + Math.floor(Math.random() * 3);

  cooking.task = {
    recipeId: recipe.id,
    recipeName: recipe.name,

    target,
    progress: 0,

    cost: TASK_COST,
    reward: TASK_REWARD,

    acceptedAt: Date.now(),

    completed: false,
    claimed: false
  };

  return cooking.task;
}


function updateTaskProgress(cooking, recipe) {
  const task = getTask(cooking);

  if (
    !task ||
    task.claimed ||
    task.completed
  ) {
    return task;
  }

  if (task.recipeId !== recipe.id) {
    return task;
  }

  task.progress = Math.min(
    task.target,
    Number(task.progress || 0) +
      Number(recipe.outputAmount || 1)
  );

  if (task.progress >= task.target) {
    task.completed = true;
    task.completedAt = Date.now();
  }

  return task;
}


function taskEmbed(task) {
  const completed =
    task.completed ||
    task.progress >= task.target;

  return new EmbedBuilder()
    .setColor(
      completed
        ? 0x57F287
        : 0xF1C40F
    )

    .setTitle("Cooking Task")

    .setDescription(
      `Cook **${task.target}x ${task.recipeName}**`
    )

    .addFields(
      {
        name: "Progress",
        value: `**${task.progress}/${task.target}**`,
        inline: true
      },
      {
        name: "Reward",
        value: `**${TASK_REWARD} WL**`,
        inline: true
      },
      {
        name: "Task Cost",
        value: `**${TASK_COST} WL**`,
        inline: true
      },
      {
        name: "Status",
        value:
          task.claimed
            ? "Reward Claimed"
            : completed
              ? "Completed - claim your reward!"
              : "In Progress"
      },
      {
        name: "Tip",
        value:
          "Press **Cook Task** to open the required recipe. " +
          "Choose your oven and heat from the dropdowns, press **Start Cooking**, " +
          "then use **Refresh Timer** to check the real cooking time. " +
          "When it is ready, press **Take Out**."
      }
    )

    .setFooter({
      text:
        "Ingredients are consumed from your backpack when cooking starts."
    });
}


function publicTaskButtons() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("cook_task_accept")
        .setLabel(`Get Task - ${TASK_COST} WL`)
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("cook_task_status")
        .setLabel("My Task")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("cook_task_help")
        .setLabel("How It Works")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("cook_task_claim")
        .setLabel(`Claim ${TASK_REWARD} WL`)
        .setStyle(ButtonStyle.Success)
    );
}


function personalTaskButtons() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("cook_task_cook")
        .setLabel("Cook Task")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("cook_task_help")
        .setLabel("How It Works")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("cook_task_status")
        .setLabel("Refresh Task")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("cook_task_claim")
        .setLabel(`Claim ${TASK_REWARD} WL`)
        .setStyle(ButtonStyle.Success)
    );
}


// =====================================================
// TASK HELP
// =====================================================

async function showTaskHelp(interaction) {
  const levels = loadLevels();

  const user = getUser(
    levels,
    interaction.user.id
  );

  const cooking = getCooking(user);
  const task = getTask(cooking);

  const recipe = task
    ? getRecipe(task.recipeId)
    : null;

  let recipeTip = "";

  if (recipe) {
    recipeTip =
      `\n\n**Your Current Recipe**\n` +
      `${recipe.name}\n\n` +
      `Required ingredients:\n` +
      recipe.ingredients
        .map(
          ingredient =>
            `• ${ingredient.name} x${ingredient.amount}`
        )
        .join("\n");
  }

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle("How Cooking Tasks Work")
    .setDescription(
      "**1. Get a Task**\n" +
      `Pay **${TASK_COST} WL** to receive a random Cooking task.\n\n` +

      "**2. Press Cook Task**\n" +
      "This opens the Cooking Simulator with your task recipe already selected.\n\n" +

      "**3. Check Ingredients**\n" +
      "The simulator shows ✓ if you have enough and ✗ if something is missing. " +
      "Ingredients come from your backpack/inventory.\n\n" +

      "**4. Choose an Oven**\n" +
      "Use the **Oven dropdown** to choose the oven you want to cook with.\n\n" +

      "**5. Choose Heat**\n" +
      "Use the **Heat dropdown**. Your selected heat changes the cooking time.\n\n" +

      "**6. Start Cooking**\n" +
      "Press **Start Cooking**. Required ingredients are immediately consumed from your backpack.\n\n" +

      "**7. Watch the Timer**\n" +
      "The timer uses the real time the dish was started. Press **Refresh Timer** whenever you want to see the latest elapsed time.\n\n" +

      "**8. Take Out**\n" +
      "When the required cooking time has passed, press **Take Out**. " +
      "Taking it out too early will not finish the dish. Leaving it too long can burn it.\n\n" +

      "**9. Complete the Task**\n" +
      "Every successful task recipe automatically increases your task progress.\n\n" +

      "**10. Claim Reward**\n" +
      `Once the task is complete, claim **${TASK_REWARD} WL**.` +

      recipeTip
    );

  return interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}


// =====================================================
// /SENDTASK
// =====================================================

async function sendTask(interaction) {
  if (
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    )
  ) {
    return interaction.reply({
      content:
        "You need Administrator permission.",
      ephemeral: true
    });
  }

  const channel =
    interaction.options.getChannel("channel");

  if (
    !channel ||
    !channel.isTextBased()
  ) {
    return interaction.reply({
      content:
        "Please select a valid text channel.",
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle("Cooking Tasks")
    .setDescription(
      "Accept a Cooking task and cook the required dishes.\n\n" +

      `Task Cost: **${TASK_COST} WL**\n` +
      `Reward: **${TASK_REWARD} WL**\n\n` +

      "**How to start:**\n" +
      "1. Press **Get Task**.\n" +
      "2. Press **Cook Task** after receiving your task.\n" +
      "3. Use the oven/heat dropdowns.\n" +
      "4. Start cooking and watch the real timer.\n" +
      "5. Take the food out when it is ready.\n\n" +

      "Press **How It Works** for the full guide."
    )
    .setFooter({
      text: "NoobV2 Cooking Tasks"
    });

  await channel.send({
    embeds: [embed],
    components: [
      publicTaskButtons()
    ]
  });

  return interaction.reply({
    content:
      `Cooking Task panel sent to ${channel}.`,
    ephemeral: true
  });
}


// =====================================================
// ACCEPT TASK
// =====================================================

async function acceptTask(interaction) {
  const levels = loadLevels();

  const user = getUser(
    levels,
    interaction.user.id
  );

  const cooking = getCooking(user);

  if (!cooking.unlocked) {
    return interaction.reply({
      content:
        "You must unlock Cooking first.",
      ephemeral: true
    });
  }

  const oldTask = getTask(cooking);

  if (
    oldTask &&
    !oldTask.claimed
  ) {
    return interaction.reply({
      content:
        "You already have an active Cooking task.",
      embeds: [
        taskEmbed(oldTask)
      ],
      components: [
        personalTaskButtons()
      ],
      ephemeral: true
    });
  }

  if (user.wl < TASK_COST) {
    return interaction.reply({
      content:
        `You need **${TASK_COST} WL** to accept a task. ` +
        `You currently have **${user.wl} WL**.`,
      ephemeral: true
    });
  }

  const task = createTask(cooking);

  if (!task) {
    return interaction.reply({
      content:
        "No Cooking tasks are currently available.",
      ephemeral: true
    });
  }

  // Charge only after task was successfully generated.
  user.wl -= TASK_COST;

  saveLevels(levels);

  return interaction.reply({
    content:
      `**${TASK_COST} WL** was taken from your inventory.`,
    embeds: [
      taskEmbed(task)
    ],
    components: [
      personalTaskButtons()
    ],
    ephemeral: true
  });
}


// =====================================================
// TASK STATUS
// =====================================================

async function showTask(interaction) {
  const levels = loadLevels();

  const user = getUser(
    levels,
    interaction.user.id
  );

  const cooking = getCooking(user);
  const task = getTask(cooking);

  if (
    !task ||
    task.claimed
  ) {
    return interaction.reply({
      content:
        "You don't currently have an active Cooking task.",
      ephemeral: true
    });
  }

  return interaction.reply({
    embeds: [
      taskEmbed(task)
    ],
    components: [
      personalTaskButtons()
    ],
    ephemeral: true
  });
}


// =====================================================
// OPEN TASK COOKING
// =====================================================

async function openTaskCooking(interaction) {
  const levels = loadLevels();

  const user = getUser(
    levels,
    interaction.user.id
  );

  const cooking = getCooking(user);
  const task = getTask(cooking);

  if (!cooking.unlocked) {
    return interaction.reply({
      content:
        "You must unlock Cooking first.",
      ephemeral: true
    });
  }

  if (
    !task ||
    task.claimed
  ) {
    return interaction.reply({
      content:
        "You don't have an active Cooking task.",
      ephemeral: true
    });
  }

  if (task.completed) {
    return interaction.reply({
      content:
        `Your task is already complete. Press **Claim ${TASK_REWARD} WL**.`,
      embeds: [
        taskEmbed(task)
      ],
      components: [
        personalTaskButtons()
      ],
      ephemeral: true
    });
  }

  const recipe =
    getRecipe(task.recipeId);

  if (!recipe) {
    return interaction.reply({
      content:
        "The recipe for this task could not be found.",
      ephemeral: true
    });
  }

  const session =
    sessionFor(interaction.user.id);

  if (!session.startedAt) {
    session.recipeId =
      task.recipeId;

    session.taskMode = true;
  }

  return interaction.reply({
    embeds: [
      buildCookingEmbed(
        user,
        interaction.user
      )
    ],
    components:
      buildCookingComponents(
        interaction.user.id,
        true
      ),
    ephemeral: true
  });
}


// =====================================================
// CLAIM TASK
// =====================================================

async function claimTask(interaction) {
  const levels = loadLevels();

  const user = getUser(
    levels,
    interaction.user.id
  );

  const cooking = getCooking(user);
  const task = getTask(cooking);

  if (!task) {
    return interaction.reply({
      content:
        "You don't have a Cooking task.",
      ephemeral: true
    });
  }

  if (task.claimed) {
    return interaction.reply({
      content:
        "You already claimed this reward.",
      ephemeral: true
    });
  }

  if (
    !task.completed ||
    Number(task.progress || 0) <
      Number(task.target || 0)
  ) {
    return interaction.reply({
      content:
        `Task isn't completed yet. Progress: ` +
        `**${task.progress}/${task.target}**.`,
      ephemeral: true
    });
  }

  // Same WL balance used by inventory.
  user.wl =
    Number(user.wl || 0) +
    TASK_REWARD;

  task.claimed = true;
  task.claimedAt = Date.now();

  saveLevels(levels);

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("Cooking Task Completed!")
        .setDescription(
          `You received **${TASK_REWARD} WL**.\n\n` +
          `New Balance: **${user.wl.toLocaleString()} WL**`
        )
    ],
    ephemeral: true
  });
}


// =====================================================
// CHEF PACK SHOP
// =====================================================

function randomChefIngredients() {
  const shuffled =
    [...CHEF_PACK_INGREDIENTS];

  for (
    let i = shuffled.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [
      shuffled[i],
      shuffled[j]
    ] = [
      shuffled[j],
      shuffled[i]
    ];
  }

  return shuffled.slice(0, 5);
}


async function openShop(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle("Cooking Shop")
    .setDescription(
      "**Chef Pack**\n\n" +

      "Contains **5 different random ingredients**.\n" +
      "You receive **5-7 of each ingredient**.\n\n" +

      `Price: **${CHEF_PACK_PRICE} WL**`
    )
    .setFooter({
      text:
        "Ingredients are added directly to your backpack."
    });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          "cook_shop_chefpack"
        )
        .setLabel(
          `Buy Chef Pack - ${CHEF_PACK_PRICE} WL`
        )
        .setStyle(
          ButtonStyle.Success
        )
    );

  return interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}


async function buyChefPack(interaction) {
  const levels = loadLevels();

  const user = getUser(
    levels,
    interaction.user.id
  );

  const cooking = getCooking(user);

  if (!cooking.unlocked) {
    return interaction.reply({
      content:
        "You must unlock Cooking first.",
      ephemeral: true
    });
  }

  if (user.wl < CHEF_PACK_PRICE) {
    return interaction.reply({
      content:
        `You need **${CHEF_PACK_PRICE} WL**. ` +
        `You currently have **${user.wl} WL**.`,
      ephemeral: true
    });
  }

  user.wl -= CHEF_PACK_PRICE;

  const ingredients =
    randomChefIngredients();

  const received = [];

  for (const ingredient of ingredients) {
    const amount =
      5 + Math.floor(Math.random() * 3);

    user.items[ingredient.key] =
      Number(
        user.items[ingredient.key] || 0
      ) + amount;

    received.push(
      `• **${ingredient.name}** x${amount}`
    );
  }

  saveLevels(levels);

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("Chef Pack Opened!")
        .setDescription(
          received.join("\n") +

          "\n\n" +

          `**${CHEF_PACK_PRICE} WL** was consumed.\n` +
          `Balance: **${user.wl.toLocaleString()} WL**`
        )
    ],
    ephemeral: true
  });
}


// =====================================================
// COOKING TIMER INFORMATION
// =====================================================

function getTimerInfo(session, recipe) {
  const heat =
    session.startedHeat ||
    session.heat;

  const required =
    getCookSeconds(
      recipe,
      heat
    );

  if (!session.startedAt) {
    return {
      required,
      elapsed: 0,
      remaining: required,
      ready: false,
      burnt: false
    };
  }

  const elapsed =
    (Date.now() - session.startedAt) /
    1000;

  const remaining =
    Math.max(
      0,
      required - elapsed
    );

  const burnAfter =
    required +
    Math.max(
      20,
      required * 0.5
    );

  return {
    required,
    elapsed,
    remaining,

    ready:
      elapsed >= required,

    burnt:
      elapsed > burnAfter,

    burnAfter
  };
}


// =====================================================
// COOKING EMBED
// =====================================================

function buildCookingEmbed(
  user,
  interactionUser
) {
  const cooking =
    getCooking(user);

  const session =
    sessionFor(
      interactionUser.id
    );

  let recipe = getRecipe(
    session.startedRecipeId ||
    session.recipeId
  );

  if (!recipe) {
    recipe =
      Object.values(RECIPES)[0];
  }

  const timer =
    getTimerInfo(
      session,
      recipe
    );

  const task =
    getTask(cooking);

  let status =
    "Ready to cook.";

  let timerText =
    `Required: **${formatTime(timer.required)}**`;

  if (session.startedAt) {
    const shownElapsed =
      Math.min(
        timer.elapsed,
        timer.required
      );

    timerText =
      `**${formatElapsed(timer.elapsed)} / ${formatTime(timer.required)}**\n` +
      `${progressBar(shownElapsed, timer.required)}\n`;

    if (timer.burnt) {
      status =
        "The food has been left in too long. Take it out.";
    } else if (timer.ready) {
      status =
        "READY! Press **Take Out**.";
    } else {
      status =
        `Cooking... **${formatTime(timer.remaining)}** remaining.`;
    }
  }

  let taskText =
    "No active task.";

  if (
    task &&
    !task.claimed
  ) {
    taskText =
      `**${task.recipeName}**\n` +
      `Progress: **${task.progress}/${task.target}**\n` +
      `Reward: **${TASK_REWARD} WL**`;
  }

  const taskRecipe =
    task &&
    task.recipeId === recipe.id;

  const description =
    session.taskMode && task
      ? (
          `Task Cooking Mode\n` +
          `You must cook **${task.target}x ${task.recipeName}**.\n\n` +
          `Task Progress: **${task.progress}/${task.target}**`
        )
      : (
          `Chef: **${interactionUser.username}**\n` +
          `Cooking Level: **${cooking.level}**\n` +
          `XP: **${cooking.xp}/${xpNeeded(cooking.level)}**`
        );

  return new EmbedBuilder()
    .setColor(
      timer.ready
        ? 0x57F287
        : 0xF1C40F
    )

    .setTitle(
      session.taskMode
        ? `Task Cooking - ${recipe.name}`
        : "Cooking Simulator"
    )

    .setDescription(description)

    .addFields(
      {
        name: "Recipe",
        value:
          `**${recipe.name}**\n` +
          `Requires Cooking Lv. ${recipe.level}` +
          (
            taskRecipe
              ? "\n**Required for your current task**"
              : ""
          )
      },

      {
        name: "Oven",
        value:
          session.startedOven ||
          session.oven,
        inline: true
      },

      {
        name: "Heat",
        value:
          HEAT[
            session.startedHeat ||
            session.heat
          ]?.label || "Low",
        inline: true
      },

      {
        name: "Cooking Timer",
        value: timerText,
        inline: false
      },

      {
        name: "Ingredients",
        value:
          ingredientLines(
            recipe,
            user.items
          )
      },

      {
        name: "Task",
        value: taskText
      },

      {
        name: "Status",
        value: status
      }
    )

    .setFooter({
      text:
        session.startedAt
          ? "The timer uses real elapsed time. Press Refresh Timer to update the display."
          : "Ingredients are consumed from your backpack when Start Cooking is pressed."
    });
}


// =====================================================
// NORMAL RECIPE DROPDOWN
// =====================================================

function recipeMenu(userId) {
  const session =
    sessionFor(userId);

  const options =
    Object.values(RECIPES)
      .slice(0, 25)
      .map(recipe => ({
        label:
          recipe.name.slice(0, 100),

        value:
          recipe.id,

        description:
          (
            `Lv.${recipe.level} • ` +
            `${formatTime(recipe.lowSeconds)} on Low`
          ).slice(0, 100),

        default:
          recipe.id ===
          session.recipeId
      }));

  return new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          `cook_recipe_${userId}`
        )
        .setPlaceholder(
          "Choose a recipe"
        )
        .addOptions(options)
    );
}


// =====================================================
// OVEN DROPDOWN
// =====================================================

function ovenMenu(userId) {
  const session =
    sessionFor(userId);

  const ovens = [
    "Home Oven",
    "Commercial Oven",
    "Taco Truck Oven",
    "Replicator",
    "Master Chef's Oven"
  ];

  return new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          `cook_oven_${userId}`
        )
        .setPlaceholder(
          "Choose an oven"
        )
        .addOptions(
          ovens.map(name => ({
            label: name,
            value: name,
            default:
              name === session.oven
          }))
        )
    );
}


// =====================================================
// HEAT DROPDOWN
// =====================================================

function heatMenu(userId) {
  const session =
    sessionFor(userId);

  return new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(
          `cook_heat_${userId}`
        )
        .setPlaceholder(
          "Choose cooking heat"
        )
        .addOptions(
          Object.entries(HEAT)
            .map(([key, heat]) => ({
              label: heat.label,
              value: key,

              description:
                key === "low"
                  ? "Slowest cooking time"
                  : key === "medium"
                    ? "Faster cooking time"
                    : "Fastest cooking time",

              default:
                key === session.heat
            }))
        )
    );
}


// =====================================================
// COOKING BUTTONS
// =====================================================

function cookingButtons(userId) {
  const session =
    sessionFor(userId);

  const row =
    new ActionRowBuilder();

  if (!session.startedAt) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `cook_start_${userId}`
        )
        .setLabel(
          "Start Cooking"
        )
        .setStyle(
          ButtonStyle.Success
        ),

      new ButtonBuilder()
        .setCustomId(
          `cook_refresh_${userId}`
        )
        .setLabel(
          "Refresh"
        )
        .setStyle(
          ButtonStyle.Secondary
        )
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `cook_refresh_${userId}`
        )
        .setLabel(
          "Refresh Timer"
        )
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          `cook_take_${userId}`
        )
        .setLabel(
          "Take Out"
        )
        .setStyle(
          ButtonStyle.Primary
        )
    );
  }

  if (session.taskMode) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `cook_taskguide_${userId}`
        )
        .setLabel(
          "How It Works"
        )
        .setStyle(
          ButtonStyle.Secondary
        )
    );
  }

  return row;
}


// =====================================================
// BUILD COMPONENTS
// =====================================================

function buildCookingComponents(
  userId,
  taskMode = false
) {
  const session =
    sessionFor(userId);

  session.taskMode =
    Boolean(taskMode || session.taskMode);

  const rows = [];

  /*
   * During task mode the recipe is locked
   * to the task recipe.
   *
   * Normal cooking keeps the recipe dropdown.
   */
  if (
    !session.taskMode &&
    !session.startedAt
  ) {
    rows.push(
      recipeMenu(userId)
    );
  }

  /*
   * Don't allow changing oven/heat
   * after cooking starts.
   */
  if (!session.startedAt) {
    rows.push(
      ovenMenu(userId)
    );

    rows.push(
      heatMenu(userId)
    );
  }

  rows.push(
    cookingButtons(userId)
  );

  return rows;
}


// =====================================================
// OPEN NORMAL COOKING
// =====================================================

async function open(interaction) {
  const levels = loadLevels();

  const user = getUser(
    levels,
    interaction.user.id
  );

  const cooking = getCooking(user);

  if (!cooking.unlocked) {
    return interaction.reply({
      content:
        "You haven't unlocked Cooking yet.",
      ephemeral: true
    });
  }

  const session =
    sessionFor(
      interaction.user.id
    );

  if (!session.startedAt) {
    session.taskMode = false;
  }

  saveLevels(levels);

  return interaction.reply({
    embeds: [
      buildCookingEmbed(
        user,
        interaction.user
      )
    ],

    components:
      buildCookingComponents(
        interaction.user.id,
        false
      ),

    ephemeral: true
  });
}


// =====================================================
// REFRESH COOKING MESSAGE
// =====================================================

async function refresh(interaction) {
  const levels = loadLevels();

  const user = getUser(
    levels,
    interaction.user.id
  );

  const session =
    sessionFor(
      interaction.user.id
    );

  return interaction.update({
    embeds: [
      buildCookingEmbed(
        user,
        interaction.user
      )
    ],

    components:
      buildCookingComponents(
        interaction.user.id,
        session.taskMode
      )
  });
}


// =====================================================
// SELECT MENU HANDLER
// =====================================================

async function handleSelect(interaction) {
  if (
    !interaction.isStringSelectMenu() ||
    !interaction.customId.startsWith("cook_")
  ) {
    return false;
  }

  const parts =
    interaction.customId.split("_");

  const type = parts[1];
  const ownerId = parts[2];

  if (
    interaction.user.id !== ownerId
  ) {
    await interaction.reply({
      content:
        "This cooking session isn't yours.",
      ephemeral: true
    });

    return true;
  }

  const session =
    sessionFor(ownerId);

  if (session.startedAt) {
    await interaction.reply({
      content:
        "You cannot change the cooking setup while food is cooking.",
      ephemeral: true
    });

    return true;
  }

  if (type === "recipe") {
    if (session.taskMode) {
      await interaction.reply({
        content:
          "The recipe is locked to your current Cooking task.",
        ephemeral: true
      });

      return true;
    }

    session.recipeId =
      interaction.values[0];
  }

  if (type === "heat") {
    session.heat =
      interaction.values[0];
  }

  if (type === "oven") {
    session.oven =
      interaction.values[0];
  }

  await refresh(interaction);

  return true;
}


// =====================================================
// TASK GUIDE BUTTON INSIDE SIMULATOR
// =====================================================

async function showCookingGuide(interaction) {
  const levels = loadLevels();

  const user = getUser(
    levels,
    interaction.user.id
  );

  const cooking =
    getCooking(user);

  const task =
    getTask(cooking);

  const recipe =
    task
      ? getRecipe(task.recipeId)
      : null;

  const session =
    sessionFor(
      interaction.user.id
    );

  let description =
    "**How to cook this task:**\n\n" +

    "1. Check that every required ingredient has a **✓**.\n" +
    "2. Choose an **Oven** from the dropdown.\n" +
    "3. Choose **Low, Medium or High Heat**.\n" +
    "4. Press **Start Cooking**.\n" +
    "5. Your ingredients are removed from your backpack when cooking begins.\n" +
    "6. The timer starts immediately using real elapsed time.\n" +
    "7. Press **Refresh Timer** to update the displayed timer.\n" +
    "8. When the required time has passed, press **Take Out**.\n" +
    "9. Successful dishes automatically increase your task progress.\n" +
    `10. Finish the full task and claim **${TASK_REWARD} WL**.`;

  if (recipe) {
    const seconds =
      getCookSeconds(
        recipe,
        session.heat
      );

    description +=
      `\n\n**Current Task Recipe**\n` +
      `${recipe.name}\n\n` +

      `**Ingredients**\n` +
      recipe.ingredients
        .map(
          ingredient =>
            `• ${ingredient.name} x${ingredient.amount}`
        )
        .join("\n") +

      `\n\n**Current Heat:** ` +
      `${HEAT[session.heat]?.label || "Low"}\n` +

      `**Cooking Time:** ` +
      `${formatTime(seconds)}`;
  }

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(
          "Cooking Task Guide"
        )
        .setDescription(
          description
        )
    ],
    ephemeral: true
  });
}


// =====================================================
// BUTTON HANDLER
// =====================================================

async function handleButton(interaction) {
  if (
    !interaction.isButton() ||
    !interaction.customId.startsWith("cook_")
  ) {
    return false;
  }


  // ===================================================
  // PUBLIC / PERSONAL TASK BUTTONS
  // ===================================================

  if (
    interaction.customId ===
    "cook_task_accept"
  ) {
    await acceptTask(interaction);
    return true;
  }


  if (
    interaction.customId ===
    "cook_task_status"
  ) {
    await showTask(interaction);
    return true;
  }


  if (
    interaction.customId ===
    "cook_task_help"
  ) {
    await showTaskHelp(interaction);
    return true;
  }


  if (
    interaction.customId ===
    "cook_task_cook"
  ) {
    await openTaskCooking(interaction);
    return true;
  }


  if (
    interaction.customId ===
    "cook_task_claim"
  ) {
    await claimTask(interaction);
    return true;
  }


  // ===================================================
  // SHOP
  // ===================================================

  if (
    interaction.customId ===
    "cook_shop_chefpack"
  ) {
    await buyChefPack(interaction);
    return true;
  }


  // ===================================================
  // USER-SPECIFIC COOKING BUTTONS
  // ===================================================

  const parts =
    interaction.customId.split("_");

  const action = parts[1];
  const ownerId = parts[2];

  if (
    interaction.user.id !== ownerId
  ) {
    await interaction.reply({
      content:
        "This cooking session isn't yours.",
      ephemeral: true
    });

    return true;
  }


  // ===================================================
  // TASK GUIDE
  // ===================================================

  if (action === "taskguide") {
    await showCookingGuide(interaction);
    return true;
  }


  const levels = loadLevels();

  const user = getUser(
    levels,
    ownerId
  );

  const cooking =
    getCooking(user);

  const session =
    sessionFor(ownerId);

  const recipe =
    getRecipe(
      session.recipeId
    );


  if (!cooking.unlocked) {
    await interaction.reply({
      content:
        "Cooking is locked.",
      ephemeral: true
    });

    return true;
  }


  // ===================================================
  // REFRESH TIMER
  // ===================================================

  if (action === "refresh") {
    await refresh(interaction);
    return true;
  }


  // ===================================================
  // START COOKING
  // ===================================================

  if (action === "start") {
    if (session.startedAt) {
      await interaction.reply({
        content:
          "You already have food cooking.",
        ephemeral: true
      });

      return true;
    }

    if (!recipe) {
      await interaction.reply({
        content:
          "Recipe not found.",
        ephemeral: true
      });

      return true;
    }


    /*
     * TASK MODE:
     * Make sure they are cooking exactly
     * the recipe assigned to the task.
     */
    if (session.taskMode) {
      const task =
        getTask(cooking);

      if (
        !task ||
        task.claimed
      ) {
        session.taskMode = false;

        await interaction.reply({
          content:
            "You no longer have an active Cooking task.",
          ephemeral: true
        });

        return true;
      }

      if (task.completed) {
        await interaction.reply({
          content:
            `Your task is already complete. Claim your **${TASK_REWARD} WL** reward.`,
          ephemeral: true
        });

        return true;
      }

      if (
        session.recipeId !==
        task.recipeId
      ) {
        session.recipeId =
          task.recipeId;
      }
    }


    if (
      cooking.level <
      Number(recipe.level || 1)
    ) {
      await interaction.reply({
        content:
          `You need Cooking Level ${recipe.level}.`,
        ephemeral: true
      });

      return true;
    }


    const missing =
      missingIngredients(
        recipe,
        user.items
      );


    if (missing.length) {
      await interaction.reply({
        content:
          "**Missing ingredients:**\n" +

          missing
            .map(
              ingredient =>
                `• ${ingredient.name} x${ingredient.amount} ` +
                `(you: ${user.items[ingredient.key] || 0})`
            )
            .join("\n") +

          "\n\nBuy a **Chef Pack** from `/shop` if you need more ingredients.",

        ephemeral: true
      });

      return true;
    }


    /*
     * Consume ingredients immediately.
     */
    consume(
      recipe,
      user.items
    );


    session.startedAt =
      Date.now();

    session.startedRecipeId =
      recipe.id;

    session.startedHeat =
      session.heat;

    session.startedOven =
      session.oven;


    levels[ownerId] =
      user;

    saveLevels(levels);


    await interaction.update({
      embeds: [
        buildCookingEmbed(
          user,
          interaction.user
        )
      ],

      components:
        buildCookingComponents(
          ownerId,
          session.taskMode
        )
    });


    return true;
  }


  // ===================================================
  // TAKE OUT
  // ===================================================

  if (action === "take") {
    if (!session.startedAt) {
      await interaction.reply({
        content:
          "Nothing is cooking.",
        ephemeral: true
      });

      return true;
    }


    const activeRecipe =
      getRecipe(
        session.startedRecipeId ||
        session.recipeId
      );


    if (!activeRecipe) {
      resetCookingSession(session);

      await interaction.reply({
        content:
          "The active recipe could not be found. Cooking session reset.",
        ephemeral: true
      });

      return true;
    }


    const required =
      getCookSeconds(
        activeRecipe,
        session.startedHeat ||
        session.heat
      );


    const elapsed =
      (
        Date.now() -
        session.startedAt
      ) / 1000;


    // TOO EARLY
    if (elapsed < required) {
      await interaction.reply({
        content:
          `Too early! **${formatTime(required - elapsed)}** remaining.\n` +
          "Press **Refresh Timer** to check the timer again.",

        ephemeral: true
      });

      return true;
    }


    const over =
      elapsed -
      required;


    const burnt =
      over >
      Math.max(
        20,
        required * 0.5
      );


    // Clear active cooking.
    resetCookingSession(session);


    // =================================================
    // BURNT
    // =================================================

    if (burnt) {
      user.items.burntSlime =
        Number(
          user.items.burntSlime || 0
        ) + 1;


      levels[ownerId] =
        user;

      saveLevels(levels);


      await interaction.update({
        embeds: [
          buildCookingEmbed(
            user,
            interaction.user
          )
        ],

        components:
          buildCookingComponents(
            ownerId,
            session.taskMode
          )
      });


      await interaction.followUp({
        content:
          "The food was left in too long and burned. You received **Burnt Slime x1**.\n\n" +
          "Task progress was **not** increased.",

        ephemeral: true
      });


      return true;
    }


    // =================================================
    // SUCCESS
    // =================================================

    user.items[
      activeRecipe.outputKey
    ] =
      Number(
        user.items[
          activeRecipe.outputKey
        ] || 0
      ) +
      Number(
        activeRecipe.outputAmount || 1
      );


    const gainedLevels =
      addXP(
        cooking,
        activeRecipe.xp
      );


    /*
     * Automatically increases task progress
     * ONLY if this is the assigned recipe.
     */
    const task =
      updateTaskProgress(
        cooking,
        activeRecipe
      );


    levels[ownerId] =
      user;

    saveLevels(levels);


    await interaction.update({
      embeds: [
        buildCookingEmbed(
          user,
          interaction.user
        )
      ],

      components:
        buildCookingComponents(
          ownerId,
          session.taskMode
        )
    });


    let message =
      `Cooking success! You made ` +
      `**${activeRecipe.name} x${activeRecipe.outputAmount || 1}**.\n` +
      `+**${activeRecipe.xp} Cooking XP**`;


    if (gainedLevels > 0) {
      message +=
        `\nCooking Level increased to **${cooking.level}**!`;
    }


    if (
      task &&
      task.recipeId ===
      activeRecipe.id &&
      !task.claimed
    ) {
      message +=
        `\n\n**Task Progress:** ` +
        `${task.progress}/${task.target}`;


      if (task.completed) {
        message +=
          `\n\n**TASK COMPLETE!**\n` +
          `Press **Claim ${TASK_REWARD} WL** on your task panel.`;
      } else {
        message +=
          `\nCook **${task.target - task.progress} more** ` +
          `${task.recipeName}.`;
      }
    }


    await interaction.followUp({
      content: message,
      ephemeral: true
    });


    return true;
  }


  return false;
}



module.exports = {
  open,
  openShop,
  sendTask,
  handleButton,
  handleSelect
};