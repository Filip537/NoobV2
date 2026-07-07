const DEVELOPER_ID = "1108921222030426172";
const DEV_WL_AMOUNT = 999999999;

function isDeveloper(userId) {
  return userId === DEVELOPER_ID;
}

function applyDeveloperPerks(userId, data) {
  if (!isDeveloper(userId)) return data;

  data.wl = DEV_WL_AMOUNT;
  data.dev = true;

  return data;
}

function canBeRobbed(userId) {
  return !isDeveloper(userId);
}

module.exports = {
  DEVELOPER_ID,
  DEV_WL_AMOUNT,
  isDeveloper,
  applyDeveloperPerks,
  canBeRobbed
};