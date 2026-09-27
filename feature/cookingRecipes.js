const RECIPES = {
  chips_guacamole: {
    id: "chips_guacamole",
    name: "Chips And Guacamole",
    outputKey: "chipsAndGuacamole",
    outputAmount: 1,
    icon: "Chips_And_Guacamole.webp",
    level: 1,
    xp: 35,
    lowSeconds: 66,
    ingredients: [
      { key: "salsa", name: "Salsa", amount: 1, at: 0 },
      { key: "waterBucket", name: "Water Bucket", amount: 1, at: 0 },
      { key: "cornMeal", name: "Corn Meal", amount: 1, at: 0 },
      { key: "lemon", name: "Lemon", amount: 1, at: 65 },
      { key: "avocado", name: "Avocado", amount: 1, at: 65 }
    ],
    optional: [{ key: "salt", name: "Salt", amount: 2 }]
  },

  sweet_potato_tots: {
    id: "sweet_potato_tots",
    name: "Sweet Potato Tots",
    outputKey: "sweetPotatoTots",
    outputAmount: 1,
    icon: "Sweet_Potato_Tots.webp",
    level: 1,
    xp: 40,
    lowSeconds: 66.3,
    ingredients: [
      { key: "flour", name: "Flour", amount: 1, at: 0 },
      { key: "onion", name: "Onion", amount: 1, at: 0 },
      { key: "egg", name: "Egg", amount: 1, at: 6.3 },
      { key: "sweetPotatoMash", name: "Sweet Potato Mash", amount: 1, at: 6.3 },
      { key: "bacon", name: "Bacon", amount: 1, at: 16.3 }
    ],
    optional: [
      { key: "salt", name: "Salt", amount: 1 },
      { key: "pepper", name: "Pepper", amount: 2 }
    ]
  },

  magnifico_carne_guacamole: {
    id: "magnifico_carne_guacamole",
    name: "Magnifico Carne Guacamole",
    outputKey: "magnificoCarneGuacamole",
    outputAmount: 1,
    icon: "Chips_And_Guacamole.webp",
    level: 2,
    xp: 55,
    lowSeconds: 66,
    ingredients: [
      { key: "groundBeef", name: "Ground Beef", amount: 1, at: 0 },
      { key: "bacon", name: "Bacon", amount: 1, at: 16 },
      { key: "tomato", name: "Tomato", amount: 1, at: 36 },
      { key: "chipsAndGuacamole", name: "Chips And Guacamole", amount: 1, at: 53 },
      { key: "lemon", name: "Lemon", amount: 1, at: 65 }
    ],
    optional: [
      { key: "salt", name: "Salt", amount: 1 },
      { key: "pepper", name: "Pepper", amount: 1 }
    ]
  }
};

const HEAT = {
  low: { label: "Low", divisor: 1 },
  medium: { label: "Medium", divisor: 2 },
  high: { label: "High", divisor: 3 }
};

function getRecipe(id) {
  return RECIPES[id] || null;
}

function getCookSeconds(recipe, heat = "low") {
  const divisor = HEAT[heat]?.divisor || 1;
  return recipe.lowSeconds / divisor;
}

module.exports = { RECIPES, HEAT, getRecipe, getCookSeconds };
