const fs = require("fs");
const path = require("path");

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const LEVELS_PATH =
  path.join(
    __dirname,
    "../levels.json"
  );

const CHEF_PACK_PRICE = 3;

// These keys match the keys used by
// your Cooking recipe system.
const INGREDIENTS = [
  {
    key: "apple",
    name: "Apple"
  },
  {
    key: "avocado",
    name: "Avocado"
  },
  {
    key: "bacon",
    name: "Bacon"
  },
  {
    key: "bakingChocolate",
    name: "Baking Chocolate"
  },
  {
    key: "blueberry",
    name: "Blueberry"
  },
  {
    key: "caramel",
    name: "Caramel"
  },
  {
    key: "cherry",
    name: "Cherry"
  },
  {
    key: "chickenMeat",
    name: "Chicken Meat"
  },
  {
    key: "coconutMilk",
    name: "Coconut Milk"
  },
  {
    key: "cornMeal",
    name: "Corn Meal"
  },
  {
    key: "crushedIce",
    name: "Crushed Ice"
  },
  {
    key: "dough",
    name: "Dough"
  },
  {
    key: "egg",
    name: "Egg"
  },
  {
    key: "fishChunk",
    name: "Fish Chunk"
  },
  {
    key: "flour",
    name: "Flour"
  },
  {
    key: "groundBeef",
    name: "Ground Beef"
  },
  {
    key: "groundNutmeg",
    name: "Ground Nutmeg"
  },
  {
    key: "habaneroPepper",
    name: "Habanero Pepper"
  },
  {
    key: "honey",
    name: "Honey"
  },
  {
    key: "lemon",
    name: "Lemon"
  },
  {
    key: "lettuce",
    name: "Lettuce"
  },
  {
    key: "marshmallow",
    name: "Marshmallow"
  },
  {
    key: "milk",
    name: "Milk"
  },
  {
    key: "onion",
    name: "Onion"
  },
  {
    key: "orangeJuice",
    name: "Orange Juice"
  },
  {
    key: "pepper",
    name: "Pepper"
  },
  {
    key: "pineappleSlice",
    name: "Pineapple Slice"
  },
  {
    key: "potato",
    name: "Potato"
  },
  {
    key: "rice",
    name: "Rice"
  },
  {
    key: "salsa",
    name: "Salsa"
  },
  {
    key: "salt",
    name: "Salt"
  },
  {
    key: "sprigOfMint",
    name: "Sprig of Mint"
  },
  {
    key: "sugar",
    name: "Sugar"
  },
  {
    key: "sweetPotatoMash",
    name: "Sweet Potato Mash"
  },
  {
    key: "swissCheeseBlock",
    name: "Swiss Cheese Block"
  },
  {
    key: "tomato",
    name: "Tomato"
  },
  {
    key: "waterBucket",
    name: "Water Bucket"
  }
];

function loadLevels() {
  if (
    !fs.existsSync(
      LEVELS_PATH
    )
  ) {
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
  } catch {
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

function getUser(
  levels,
  userId
) {
  if (!levels[userId]) {
    levels[userId] = {
      wl: 0,
      level: 1,
      xp: 0,
      items: {},
      fishBackpack: []
    };
  }

  const user =
    levels[userId];

  if (!user.items) {
    user.items = {};
  }

  if (!user.professions) {
    user.professions = {};
  }

  return user;
}

function randomAmount() {
  return (
    Math.floor(
      Math.random() * 3
    ) + 5
  );
}

function randomIngredients(
  amount
) {
  const pool =
    [...INGREDIENTS];

  // Fisher-Yates shuffle
  for (
    let i =
      pool.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );

    [
      pool[i],
      pool[j]
    ] = [
      pool[j],
      pool[i]
    ];
  }

  return pool.slice(
    0,
    amount
  );
}

function buildShopEmbed() {
  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("NoobV2 Shop")
    .setDescription(
      "**Chef Pack**\n\n" +

      "Contains **5 different random Cooking ingredients**.\n" +
      "Each ingredient gives **5–7 items**.\n\n" +

      `Price: **${CHEF_PACK_PRICE} WL**\n\n` +

      "The ingredients will be added directly to your inventory."
    )
    .setFooter({
      text:
        "Chef Pack contains ingredients only"
    });
}

function buildShopButtons() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          "shop_buy_chef_pack"
        )
        .setLabel(
          `Buy Chef Pack - ${CHEF_PACK_PRICE} WL`
        )
        .setStyle(
          ButtonStyle.Success
        )
    );
}

async function openShop(
  interaction
) {
  return interaction.reply({
    embeds: [
      buildShopEmbed()
    ],

    components: [
      buildShopButtons()
    ],

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

  if (
    !user.professions
      ?.cooking
      ?.unlocked
  ) {
    return interaction.reply({
      content:
        "You must unlock the Cooking profession before buying a Chef Pack.",
      ephemeral: true
    });
  }

  if (
    Number(user.wl || 0) <
    CHEF_PACK_PRICE
  ) {
    return interaction.reply({
      content:
        `You need ${CHEF_PACK_PRICE} WL to buy a Chef Pack.`,
      ephemeral: true
    });
  }

  user.wl =
    Number(user.wl || 0) -
    CHEF_PACK_PRICE;

  const selected =
    randomIngredients(5);

  const rewards = [];

  for (
    const ingredient
    of selected
  ) {
    const amount =
      randomAmount();

    user.items[
      ingredient.key
    ] =
      Number(
        user.items[
          ingredient.key
        ] || 0
      ) + amount;

    rewards.push({
      name:
        ingredient.name,

      amount
    });
  }

  saveLevels(levels);

  const rewardText =
    rewards
      .map(
        reward =>
          `• **${reward.name}** x${reward.amount}`
      )
      .join("\n");

  const embed =
    new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(
        "Chef Pack Opened!"
      )
      .setDescription(
        `You paid **${CHEF_PACK_PRICE} WL**.\n\n` +

        "**You received:**\n" +
        rewardText +

        "\n\n" +
        `Balance: **${user.wl.toLocaleString()} WL**`
      )
      .setFooter({
        text:
          "Ingredients added to your inventory"
      });

  return interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

async function handleButton(
  interaction
) {
  if (
    !interaction.isButton() ||
    !interaction.customId
      .startsWith("shop_")
  ) {
    return false;
  }

  if (
    interaction.customId ===
    "shop_buy_chef_pack"
  ) {
    await buyChefPack(
      interaction
    );

    return true;
  }

  return false;
}

module.exports = {
  openShop,
  handleButton,
  CHEF_PACK_PRICE,
  INGREDIENTS
};