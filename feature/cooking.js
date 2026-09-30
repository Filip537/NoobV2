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
// PATHS / SETTINGS
// =====================================================

const LEVELS_PATH = path.join(
  __dirname,
  "../levels.json"
);

// Your icons are:
// NoobV2/cooking/
const ICON_DIR = path.join(
  __dirname,
  "../cooking"
);

const sessions = new Map();


// =====================================================
// ECONOMY SETTINGS
// =====================================================

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
    fs.writeFileSync(
      LEVELS_PATH,
      "{}"
    );
  }

  try {
    return JSON.parse(
      fs.readFileSync(
        LEVELS_PATH,
        "utf8"
      )
    );
  } catch (err) {
    console.error(
      "Failed to read levels.json:",
      err
    );

    return {};
  }
}


function saveLevels(data) {
  fs.writeFileSync(
    LEVELS_PATH,
    JSON.stringify(
      data,
      null,
      2
    )
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

  user.wl = Number(
    user.wl || 0
  );

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

  const cooking =
    user.professions.cooking;

  cooking.level = Number(
    cooking.level || 1
  );

  cooking.xp = Number(
    cooking.xp || 0
  );

  return cooking;
}


// =====================================================
// COOKING XP
// =====================================================

function xpNeeded(level) {
  return (
    100 +
    (Math.max(1, level) - 1) * 75
  );
}


function addXP(cooking, amount) {
  cooking.xp += amount;

  let levelsGained = 0;

  while (
    cooking.xp >=
    xpNeeded(cooking.level)
  ) {
    cooking.xp -=
      xpNeeded(cooking.level);

    cooking.level += 1;

    levelsGained++;
  }

  return levelsGained;
}


// =====================================================
// COOKING SESSION
// =====================================================

function sessionFor(userId) {
  if (!sessions.has(userId)) {
    sessions.set(
      userId,
      {
        recipeId: "chips_guacamole",
        heat: "low",
        oven: "Home Oven",
        startedAt: null,
        startedRecipeId: null,
        startedHeat: null
      }
    );
  }

  return sessions.get(userId);
}


function formatTime(seconds) {
  const total =
    Math.max(
      0,
      Math.ceil(seconds)
    );

  const minutes =
    Math.floor(total / 60);

  return minutes
    ? `${minutes}m ${total % 60}s`
    : `${total}s`;
}


// =====================================================
// INGREDIENT INVENTORY
// =====================================================

function ingredientLines(
  recipe,
  items
) {
  return recipe.ingredients
    .map(ingredient => {
      const amount =
        Number(
          items[
            ingredient.key
          ] || 0
        );

      const icon =
        amount >= ingredient.amount
          ? "✓"
          : "✗";

      return (
        `${icon} ${ingredient.name} ` +
        `x${ingredient.amount} ` +
        `(you: ${amount})`
      );
    })
    .join("\n");
}


function missingIngredients(
  recipe,
  items
) {
  return recipe.ingredients.filter(
    ingredient =>
      Number(
        items[
          ingredient.key
        ] || 0
      ) < ingredient.amount
  );
}


// IMPORTANT:
// This removes ingredients directly
// from user.items / backpack.
function consume(
  recipe,
  items
) {
  for (
    const ingredient
    of recipe.ingredients
  ) {
    const current =
      Number(
        items[
          ingredient.key
        ] || 0
      );

    const remaining =
      Math.max(
        0,
        current -
        Number(
          ingredient.amount || 0
        )
      );

    if (remaining <= 0) {
      delete items[
        ingredient.key
      ];
    } else {
      items[
        ingredient.key
      ] = remaining;
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
  const available =
    Object.values(RECIPES)
      .filter(
        recipe =>
          Number(recipe.level || 1) <=
          cooking.level
      );

  if (!available.length) {
    return null;
  }

  const recipe =
    available[
      Math.floor(
        Math.random() *
        available.length
      )
    ];

  // Random requirement: 3–5 dishes
  const target =
    3 +
    Math.floor(
      Math.random() * 3
    );

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


function updateTaskProgress(
  cooking,
  recipe
) {
  const task =
    getTask(cooking);

  if (
    !task ||
    task.claimed ||
    task.completed
  ) {
    return null;
  }

  if (
    task.recipeId !==
    recipe.id
  ) {
    return task;
  }

  task.progress =
    Math.min(
      task.target,
      Number(
        task.progress || 0
      ) +
      Number(
        recipe.outputAmount || 1
      )
    );

  if (
    task.progress >=
    task.target
  ) {
    task.completed = true;
    task.completedAt =
      Date.now();
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
    .setTitle(
      "Cooking Task"
    )
    .setDescription(
      `Cook **${task.target}x ${task.recipeName}**`
    )
    .addFields(
      {
        name: "Progress",
        value:
          `**${task.progress}/${task.target}**`,
        inline: true
      },

      {
        name: "Reward",
        value:
          `**${TASK_REWARD} WL**`,
        inline: true
      },

      {
        name: "Task Cost",
        value:
          `**${TASK_COST} WL**`,
        inline: true
      },

      {
        name: "Status",
        value:
          task.claimed
            ? "Reward Claimed"
            : completed
              ? "Completed - Claim your reward!"
              : "In Progress"
      }
    );
}


function taskButtons() {
  return new ActionRowBuilder()
    .addComponents(

      new ButtonBuilder()
        .setCustomId(
          "cook_task_accept"
        )
        .setLabel(
          `Get Task - ${TASK_COST} WL`
        )
        .setStyle(
          ButtonStyle.Primary
        ),

      new ButtonBuilder()
        .setCustomId(
          "cook_task_status"
        )
        .setLabel(
          "My Task"
        )
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          "cook_task_claim"
        )
        .setLabel(
          `Claim ${TASK_REWARD} WL`
        )
        .setStyle(
          ButtonStyle.Success
        )
    );
}


// =====================================================
// /SENDTASK
// =====================================================

async function sendTask(
  interaction
) {
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
    interaction.options.getChannel(
      "channel"
    );

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

  const embed =
    new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle(
        "Cooking Tasks"
      )
      .setDescription(
        "Accept a Cooking task and complete the required dishes.\n\n" +

        `Task Cost: **${TASK_COST} WL**\n` +
        `Reward: **${TASK_REWARD} WL**\n\n` +

        "Your progress is automatically counted when you successfully cook the required food."
      )
      .setFooter({
        text:
          "NoobV2 Cooking Tasks"
      });

  await channel.send({
    embeds: [embed],
    components: [
      taskButtons()
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

async function acceptTask(
  interaction
) {
  const levels =
    loadLevels();

  const user =
    getUser(
      levels,
      interaction.user.id
    );

  const cooking =
    getCooking(user);

  if (!cooking.unlocked) {
    return interaction.reply({
      content:
        "You must unlock Cooking first.",
      ephemeral: true
    });
  }

  const oldTask =
    getTask(cooking);

  if (
    oldTask &&
    !oldTask.claimed
  ) {
    return interaction.reply({
      content:
        "You already have an active Cooking task. Use **My Task** to check it.",
      ephemeral: true
    });
  }

  if (
    user.wl <
    TASK_COST
  ) {
    return interaction.reply({
      content:
        `You need **${TASK_COST} WL** to accept a Cooking task. You currently have **${user.wl} WL**.`,
      ephemeral: true
    });
  }

  // Consume 10 WL from inventory balance.
  user.wl -=
    TASK_COST;

  const task =
    createTask(cooking);

  saveLevels(levels);

  if (!task) {
    return interaction.reply({
      content:
        "No Cooking tasks are currently available.",
      ephemeral: true
    });
  }

  return interaction.reply({
    embeds: [
      taskEmbed(task)
    ],
    content:
      `**${TASK_COST} WL** was taken from your inventory.`,
    ephemeral: true
  });
}


// =====================================================
// TASK STATUS
// =====================================================

async function showTask(
  interaction
) {
  const levels =
    loadLevels();

  const user =
    getUser(
      levels,
      interaction.user.id
    );

  const cooking =
    getCooking(user);

  const task =
    getTask(cooking);

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
    ephemeral: true
  });
}


// =====================================================
// CLAIM TASK REWARD
// =====================================================

async function claimTask(
  interaction
) {
  const levels =
    loadLevels();

  const user =
    getUser(
      levels,
      interaction.user.id
    );

  const cooking =
    getCooking(user);

  const task =
    getTask(cooking);

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
    task.progress <
    task.target
  ) {
    return interaction.reply({
      content:
        `Task isn't completed yet. Progress: **${task.progress}/${task.target}**.`,
      ephemeral: true
    });
  }

  /*
   * Add the 250 WL directly to user.wl.
   * This is the SAME WL balance used
   * by the inventory system.
   */
  user.wl +=
    TASK_REWARD;

  task.claimed = true;
  task.claimedAt =
    Date.now();

  saveLevels(levels);

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(
          "Cooking Task Completed!"
        )
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
    let i =
      shuffled.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );

    [
      shuffled[i],
      shuffled[j]
    ] = [
      shuffled[j],
      shuffled[i]
    ];
  }

  return shuffled.slice(
    0,
    5
  );
}


async function openShop(
  interaction
) {
  const embed =
    new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle(
        "Cooking Shop"
      )
      .setDescription(
        "**Chef Pack**\n\n" +

        "Contains **5 different random ingredients**.\n" +
        "You receive **5–7 of each ingredient**.\n\n" +

        `Price: **${CHEF_PACK_PRICE} WL**`
      )
      .setFooter({
        text:
          "Ingredients are added directly to your backpack"
      });

  const buttons =
    new ActionRowBuilder()
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
    components: [buttons],
    ephemeral: true
  });
}


async function buyChefPack(
  interaction
) {
  const levels =
    loadLevels();

  const user =
    getUser(
      levels,
      interaction.user.id
    );

  const cooking =
    getCooking(user);

  if (!cooking.unlocked) {
    return interaction.reply({
      content:
        "You must unlock Cooking first.",
      ephemeral: true
    });
  }

  if (
    user.wl <
    CHEF_PACK_PRICE
  ) {
    return interaction.reply({
      content:
        `You need **${CHEF_PACK_PRICE} WL**. You currently have **${user.wl} WL**.`,
      ephemeral: true
    });
  }

  // Consume 3 WL
  user.wl -=
    CHEF_PACK_PRICE;

  const ingredients =
    randomChefIngredients();

  const received = [];

  for (
    const ingredient
    of ingredients
  ) {
    // Random 5–7
    const amount =
      5 +
      Math.floor(
        Math.random() * 3
      );

    user.items[
      ingredient.key
    ] =
      Number(
        user.items[
          ingredient.key
        ] || 0
      ) +
      amount;

    received.push(
      `• **${ingredient.name}** x${amount}`
    );
  }

  saveLevels(levels);

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(
          "Chef Pack Opened!"
        )
        .setDescription(
          received.join("\n") +

          "\n\n" +

          `**${CHEF_PACK_PRICE} WL** was consumed from your inventory.\n` +

          `Balance: **${user.wl.toLocaleString()} WL**`
        )
    ],
    ephemeral: true
  });
}


// =====================================================
// COOKING EMBED
// =====================================================

function buildEmbed(
  user,
  interactionUser
) {
  const cooking =
    getCooking(user);

  const session =
    sessionFor(
      interactionUser.id
    );

  const recipe =
    getRecipe(
      session.recipeId
    ) ||
    Object.values(
      RECIPES
    )[0];

  const seconds =
    getCookSeconds(
      recipe,
      session.heat
    );

  let status =
    "Ready to cook";

  if (session.startedAt) {
    const elapsed =
      (
        Date.now() -
        session.startedAt
      ) / 1000;

    const left =
      seconds -
      elapsed;

    status =
      left > 0
        ? `Cooking... ${formatTime(left)} remaining`
        : "READY! Press Take Out";
  }

  const task =
    getTask(cooking);

  let taskText =
    "No active task";

  if (
    task &&
    !task.claimed
  ) {
    taskText =
      `Cook ${task.target}x ${task.recipeName}\n` +
      `Progress: ${task.progress}/${task.target}\n` +
      `Reward: ${TASK_REWARD} WL`;
  }

  return new EmbedBuilder()
    .setColor(0xF1C40F)

    .setTitle(
      "Cooking Simulator"
    )

    .setDescription(
      `Chef: **${interactionUser.username}**\n` +
      `Cooking Level: **${cooking.level}**\n` +
      `XP: **${cooking.xp}/${xpNeeded(cooking.level)}**`
    )

    .addFields(
      {
        name: "Recipe",
        value:
          `**${recipe.name}**\n` +
          `Requires Cooking Lv. ${recipe.level}`
      },

      {
        name: "Oven",
        value:
          session.oven,
        inline: true
      },

      {
        name: "Heat",
        value:
          HEAT[
            session.heat
          ].label,
        inline: true
      },

      {
        name: "Cook Time",
        value:
          formatTime(
            seconds
          ),
        inline: true
      },

      {
        name: "Ingredients",
        value:
          ingredientLines(
            recipe,
            user.items
          ) || "None"
      },

      {
        name: "Task",
        value:
          taskText
      },

      {
        name: "Status",
        value:
          status
      }
    )

    .setFooter({
      text:
        "NoobV2 Cooking • ingredients are taken from your backpack when cooking starts"
    });
}


// =====================================================
// COOKING COMPONENTS
// =====================================================

function buildComponents(
  userId
) {
  const session =
    sessionFor(userId);

  const recipeMenu =
    new StringSelectMenuBuilder()

      .setCustomId(
        `cook_recipe_${userId}`
      )

      .setPlaceholder(
        "Choose a recipe"
      )

      .addOptions(
        Object.values(
          RECIPES
        ).map(recipe => ({
          label:
            recipe.name.slice(
              0,
              100
            ),

          value:
            recipe.id,

          description:
            `Lv.${recipe.level} • ${formatTime(recipe.lowSeconds)} on Low`,

          default:
            recipe.id ===
            session.recipeId
        }))
      );


  const heatMenu =
    new StringSelectMenuBuilder()

      .setCustomId(
        `cook_heat_${userId}`
      )

      .setPlaceholder(
        "Choose heat"
      )

      .addOptions(
        Object.entries(
          HEAT
        ).map(
          ([key, heat]) => ({
            label:
              heat.label,

            value:
              key,

            default:
              key ===
              session.heat
          })
        )
      );


  const ovenMenu =
    new StringSelectMenuBuilder()

      .setCustomId(
        `cook_oven_${userId}`
      )

      .setPlaceholder(
        "Choose oven"
      )

      .addOptions(
        [
          "Home Oven",
          "Commercial Oven",
          "Taco Truck Oven",
          "Replicator",
          "Master Chef's Oven"
        ].map(name => ({
          label: name,
          value: name,

          default:
            name ===
            session.oven
        }))
      );


  const buttons =
    new ActionRowBuilder()
      .addComponents(

        new ButtonBuilder()
          .setCustomId(
            `cook_start_${userId}`
          )
          .setLabel(
            "Start Cooking"
          )
          .setStyle(
            ButtonStyle.Success
          )
          .setDisabled(
            Boolean(
              session.startedAt
            )
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
          .setDisabled(
            !session.startedAt
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


  return [
    new ActionRowBuilder()
      .addComponents(
        recipeMenu
      ),

    new ActionRowBuilder()
      .addComponents(
        ovenMenu
      ),

    new ActionRowBuilder()
      .addComponents(
        heatMenu
      ),

    buttons
  ];
}


// =====================================================
// OPEN COOKING
// =====================================================

async function open(
  interaction
) {
  const levels =
    loadLevels();

  const user =
    getUser(
      levels,
      interaction.user.id
    );

  const cooking =
    getCooking(user);

  if (!cooking.unlocked) {
    return interaction.reply({
      content:
        "You haven't unlocked Cooking yet.",
      ephemeral: true
    });
  }

  saveLevels(levels);

  return interaction.reply({
    embeds: [
      buildEmbed(
        user,
        interaction.user
      )
    ],

    components:
      buildComponents(
        interaction.user.id
      ),

    ephemeral: true
  });
}


// =====================================================
// REFRESH
// =====================================================

async function refresh(
  interaction
) {
  const levels =
    loadLevels();

  const user =
    getUser(
      levels,
      interaction.user.id
    );

  return interaction.update({
    embeds: [
      buildEmbed(
        user,
        interaction.user
      )
    ],

    components:
      buildComponents(
        interaction.user.id
      )
  });
}


// =====================================================
// SELECT MENUS
// =====================================================

async function handleSelect(
  interaction
) {
  if (
    !interaction.isStringSelectMenu() ||
    !interaction.customId.startsWith(
      "cook_"
    )
  ) {
    return false;
  }

  const parts =
    interaction.customId.split(
      "_"
    );

  const type =
    parts[1];

  const ownerId =
    parts[2];

  if (
    interaction.user.id !==
    ownerId
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
        "Finish the current dish before changing the setup.",
      ephemeral: true
    });

    return true;
  }

  if (type === "recipe") {
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

  await refresh(
    interaction
  );

  return true;
}


// =====================================================
// BUTTON HANDLER
// =====================================================

async function handleButton(
  interaction
) {
  if (
    !interaction.isButton() ||
    !interaction.customId.startsWith(
      "cook_"
    )
  ) {
    return false;
  }


  // ===================================================
  // TASK BUTTONS
  // ===================================================

  if (
    interaction.customId ===
    "cook_task_accept"
  ) {
    await acceptTask(
      interaction
    );

    return true;
  }


  if (
    interaction.customId ===
    "cook_task_status"
  ) {
    await showTask(
      interaction
    );

    return true;
  }


  if (
    interaction.customId ===
    "cook_task_claim"
  ) {
    await claimTask(
      interaction
    );

    return true;
  }


  // ===================================================
  // SHOP BUTTON
  // ===================================================

  if (
    interaction.customId ===
    "cook_shop_chefpack"
  ) {
    await buyChefPack(
      interaction
    );

    return true;
  }


  // ===================================================
  // NORMAL COOKING BUTTONS
  // ===================================================

  const parts =
    interaction.customId.split(
      "_"
    );

  const action =
    parts[1];

  const ownerId =
    parts[2];


  if (
    interaction.user.id !==
    ownerId
  ) {
    await interaction.reply({
      content:
        "This cooking session isn't yours.",
      ephemeral: true
    });

    return true;
  }


  const levels =
    loadLevels();

  const user =
    getUser(
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
  // REFRESH
  // ===================================================

  if (
    action ===
    "refresh"
  ) {
    await refresh(
      interaction
    );

    return true;
  }


  // ===================================================
  // START COOKING
  // ===================================================

  if (
    action ===
    "start"
  ) {
    if (!recipe) {
      await interaction.reply({
        content:
          "Recipe not found.",
        ephemeral: true
      });

      return true;
    }


    if (
      cooking.level <
      recipe.level
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
          "Missing ingredients:\n" +

          missing
            .map(
              ingredient =>
                `• ${ingredient.name} x${ingredient.amount} ` +
                `(you: ${user.items[ingredient.key] || 0})`
            )
            .join("\n"),

        ephemeral: true
      });

      return true;
    }


    /*
     * THIS consumes the actual ingredients
     * from the player's backpack.
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


    levels[ownerId] =
      user;

    saveLevels(levels);


    await refresh(
      interaction
    );

    return true;
  }


  // ===================================================
  // TAKE FOOD OUT
  // ===================================================

  if (
    action ===
    "take"
  ) {
    if (
      !session.startedAt
    ) {
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


    if (
      elapsed <
      required
    ) {
      await interaction.reply({
        content:
          `Too early! **${formatTime(required - elapsed)}** remaining.`,
        ephemeral: true
      });

      return true;
    }


    const over =
      elapsed -
      required;


    session.startedAt =
      null;

    session.startedRecipeId =
      null;


    const burnt =
      over >
      Math.max(
        20,
        required * 0.5
      );


    // =================================================
    // BURNT
    // =================================================

    if (burnt) {
      user.items.burntSlime =
        Number(
          user.items.burntSlime ||
          0
        ) + 1;


      levels[ownerId] =
        user;

      saveLevels(levels);


      await interaction.update({
        embeds: [
          buildEmbed(
            user,
            interaction.user
          )
        ],

        components:
          buildComponents(
            ownerId
          )
      });


      await interaction.followUp({
        content:
          "You left it in too long. The dish burned and became **Burnt Slime x1**.",
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
      activeRecipe.outputAmount;


    const gainedLevels =
      addXP(
        cooking,
        activeRecipe.xp
      );


    // Update Cooking Task
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
        buildEmbed(
          user,
          interaction.user
        )
      ],

      components:
        buildComponents(
          ownerId
        )
    });


    let message =
      `Cooking success! You made **${activeRecipe.name} x${activeRecipe.outputAmount}** ` +
      `and gained **${activeRecipe.xp} Cooking XP**.`;


    if (gainedLevels) {
      message +=
        `\nCooking level increased to **${cooking.level}**!`;
    }


    if (
      task &&
      task.recipeId ===
      activeRecipe.id
    ) {
      message +=
        `\n\nTask Progress: **${task.progress}/${task.target}**`;

      if (task.completed) {
        message +=
          `\nTask completed! Press **Claim ${TASK_REWARD} WL** on the Cooking Task panel.`;
      }
    }


    await interaction.followUp({
      content:
        message,
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