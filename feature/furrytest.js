const fs = require("fs");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const HISTORY_FILE = "./furryTestHistory.json";

// Active quiz sessions in memory
const activeFurryTests = new Map();

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, "{}");
  }

  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  } catch {
    fs.writeFileSync(HISTORY_FILE, "{}");
    return {};
  }
}

function saveHistory(data) {
  fs.writeFileSync(
    HISTORY_FILE,
    JSON.stringify(data, null, 2)
  );
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function cleanOldHistory(history) {
  const now = Date.now();

  for (const userId of Object.keys(history)) {
    for (const dateKey of Object.keys(history[userId])) {
      const time = new Date(`${dateKey}T00:00:00`).getTime();

      // Keep 7 days
      if (now - time > 7 * 24 * 60 * 60 * 1000) {
        delete history[userId][dateKey];
      }
    }

    if (Object.keys(history[userId]).length === 0) {
      delete history[userId];
    }
  }

  return history;
}

// ================= QUESTION POOL =================

const questions = [
  {
    text: "Be honest, have you ever said owo unironically?",
    answers: [
      ["Yes 💀", 3],
      ["Maybe once...", 2],
      ["As a joke", 1],
      ["HELL NAH", 0]
    ]
  },

  {
    text: "Would you wear cat ears outside for $20?",
    answers: [
      ["For free tbh", 3],
      ["Yeah probably", 2],
      ["Only for $20", 1],
      ["Never", 0]
    ]
  },

  {
    text: "How do you feel about ':3'?",
    answers: [
      ["My natural language", 3],
      ["Kinda cute", 2],
      ["Funny sometimes", 1],
      ["Delete it", 0]
    ]
  },

  {
    text: "Would you rather have animal ears or a normal hat?",
    answers: [
      ["Animal ears 100%", 3],
      ["Depends which animal", 2],
      ["Maybe for fun", 1],
      ["Hat.", 0]
    ]
  },

  {
    text: "Someone calls you a good boy/girl. What happens?",
    answers: [
      ["Immediate happiness", 3],
      ["I would blush 💀", 2],
      ["I'd laugh", 1],
      ["Blocked.", 0]
    ]
  },

  {
    text: "Have you ever imagined having a tail?",
    answers: [
      ["Obviously", 3],
      ["Maybe...", 2],
      ["Once as a joke", 1],
      ["No??", 0]
    ]
  },

  {
    text: "Do you have furry memes saved?",
    answers: [
      ["A dangerous amount", 3],
      ["A few", 2],
      ["Maybe one", 1],
      ["None", 0]
    ]
  },

  {
    text: "Would you create an animal version of yourself?",
    answers: [
      ["Already did", 3],
      ["Sounds fun", 2],
      ["Maybe someday", 1],
      ["Nope", 0]
    ]
  },

  {
    text: "Your friend sends you furry art. What do you do?",
    answers: [
      ["Save it", 3],
      ["React positively", 2],
      ["Laugh", 1],
      ["Delete the chat", 0]
    ]
  },

  {
    text: "Are you secretly enjoying this furry test?",
    answers: [
      ["WAY too much", 3],
      ["A little 💀", 2],
      ["It's funny", 1],
      ["I regret everything", 0]
    ]
  },

  {
    text: "Pick a Discord profile picture.",
    answers: [
      ["Cute animal avatar", 3],
      ["Anime animal ears", 2],
      ["Normal anime pfp", 1],
      ["My face", 0]
    ]
  },

  {
    text: "Someone says 'rawr'. Your response?",
    answers: [
      ["Rawr x3", 3],
      ["Rawr back", 2],
      ["💀", 1],
      ["Leave", 0]
    ]
  },

  {
    text: "Would you wear a fluffy tail at home?",
    answers: [
      ["Yes absolutely", 3],
      ["Maybe", 2],
      ["For a dare", 1],
      ["No", 0]
    ]
  },

  {
    text: "How suspicious is your emoji usage?",
    answers: [
      [":3 >w< owo", 3],
      ["Mostly cute emojis", 2],
      ["Normal emojis", 1],
      ["I barely use emojis", 0]
    ]
  },

  {
    text: "If you had a fursona, what would it be?",
    answers: [
      ["I already know", 3],
      ["Wolf/fox probably", 2],
      ["No idea", 1],
      ["I refuse", 0]
    ]
  },

  {
    text: "Choose one.",
    answers: [
      ["Fox ears", 3],
      ["Cat ears", 3],
      ["Bunny ears", 2],
      ["Human ears", 0]
    ]
  },

  {
    text: "Do you think fluffy characters are cute?",
    answers: [
      ["EXTREMELY", 3],
      ["Yeah", 2],
      ["Sometimes", 1],
      ["Not really", 0]
    ]
  },

  {
    text: "Have you ever used 'uwu'?",
    answers: [
      ["Regularly 💀", 3],
      ["A few times", 2],
      ["Only ironically", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Would you buy a giant animal plushie?",
    answers: [
      ["Immediately", 3],
      ["If it's cute", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Your character can get one feature. Pick.",
    answers: [
      ["Big fluffy tail", 3],
      ["Animal ears", 3],
      ["Sharp fangs", 2],
      ["Cool sunglasses", 0]
    ]
  },

  {
    text: "What's worse?",
    answers: [
      ["Being called a furry", 0],
      ["Being exposed as a furry", 3],
      ["Losing your tail", 3],
      ["Running out of WiFi", 1]
    ]
  },

  {
    text: "How likely are you to say 'mrrp'?",
    answers: [
      ["Already do", 3],
      ["Could happen", 2],
      ["As a joke", 1],
      ["Never happening", 0]
    ]
  },

  {
    text: "Would you go to a furry convention if it was free?",
    answers: [
      ["I'm already packing", 3],
      ["Yeah why not", 2],
      ["Maybe with friends", 1],
      ["Absolutely not", 0]
    ]
  },

  {
    text: "Your friend gifts you cat ears.",
    answers: [
      ["Wear them instantly", 3],
      ["Wear them at home", 2],
      ["Keep them as a joke", 1],
      ["Return them", 0]
    ]
  },

  {
    text: "Pick your ideal gaming avatar.",
    answers: [
      ["Anthro wolf", 3],
      ["Anime cat person", 2],
      ["Human character", 1],
      ["Default skin", 0]
    ]
  },

  {
    text: "How do you react to fox characters?",
    answers: [
      ["Peak character design", 3],
      ["Pretty cute", 2],
      ["They're okay", 1],
      ["Just an animal bro", 0]
    ]
  },

  {
    text: "Would you rather have paws or normal hands?",
    answers: [
      ["Paws", 3],
      ["Maybe paws", 2],
      ["Depends", 1],
      ["Hands obviously", 0]
    ]
  },

  {
    text: "Have you ever searched furry art?",
    answers: [
      ["Yes intentionally", 3],
      ["Maybe once", 2],
      ["By accident", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Would you use a furry VR avatar?",
    answers: [
      ["Already do", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "What sounds better?",
    answers: [
      ["Fluffy tail", 3],
      ["Cool jacket", 1],
      ["Gaming chair", 0],
      ["Unlimited food", 0]
    ]
  },

  {
    text: "Someone says you're furry-coded.",
    answers: [
      ["They know too much", 3],
      ["Maybe they're right", 2],
      ["I'd laugh", 1],
      ["They're wrong", 0]
    ]
  },

  {
    text: "Which word has the strongest aura?",
    answers: [
      ["Floof", 3],
      ["Paws", 3],
      ["Creature", 2],
      ["Person", 0]
    ]
  },

  {
    text: "You can permanently gain one thing.",
    answers: [
      ["A tail", 3],
      ["Animal ears", 3],
      ["Night vision", 1],
      ["$20", 0]
    ]
  },

  {
    text: "Would you let someone pet your imaginary ears?",
    answers: [
      ["Absolutely", 3],
      ["Maybe someone I trust", 2],
      ["That's weird", 1],
      ["NO", 0]
    ]
  },

  {
    text: "How often do you use cute reaction images?",
    answers: [
      ["Every day", 3],
      ["Often", 2],
      ["Sometimes", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Pick your fighter.",
    answers: [
      ["Wolf", 3],
      ["Fox", 3],
      ["Cat", 2],
      ["Guy named Dave", 0]
    ]
  },

  {
    text: "Would you sleep with a giant fox plush?",
    answers: [
      ["Yes immediately", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "What would your tail do when you're happy?",
    answers: [
      ["Wag uncontrollably", 3],
      ["Move a little", 2],
      ["I shouldn't know this", 1],
      ["I DON'T HAVE ONE", 0]
    ]
  },

  {
    text: "Do animal ears make a character better?",
    answers: [
      ["Always", 3],
      ["Usually", 2],
      ["Sometimes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Someone types 'nya'.",
    answers: [
      ["Nya back", 3],
      ["Cute", 2],
      ["Bruh", 1],
      ["Mute them", 0]
    ]
  },

  {
    text: "Choose a username style.",
    answers: [
      ["FluffyWolfUwU", 3],
      ["Foxie.exe", 2],
      ["Normal nickname", 1],
      ["FirstnameLastname", 0]
    ]
  },

  {
    text: "Would you wear paw gloves?",
    answers: [
      ["Yes", 3],
      ["At home", 2],
      ["For Halloween", 1],
      ["No", 0]
    ]
  },

  {
    text: "How furry is your algorithm?",
    answers: [
      ["It's over for me", 3],
      ["Suspicious", 2],
      ["A little", 1],
      ["Completely normal", 0]
    ]
  },

  {
    text: "Do you understand furry slang?",
    answers: [
      ["Unfortunately yes", 3],
      ["Some of it", 2],
      ["Barely", 1],
      ["What slang?", 0]
    ]
  },

  {
    text: "Would you choose a wolf hoodie with ears?",
    answers: [
      ["YES", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Your Minecraft skin has animal ears.",
    answers: [
      ["Obviously", 3],
      ["Could happen", 2],
      ["Maybe as a joke", 1],
      ["Never", 0]
    ]
  },

  {
    text: "You hear 'fursuit'. First thought?",
    answers: [
      ["Looks fun", 3],
      ["Looks impressive", 2],
      ["Expensive", 1],
      ["Run", 0]
    ]
  },

  {
    text: "Could you survive being called 'good puppy'?",
    answers: [
      ["I would ascend", 3],
      ["Barely", 2],
      ["I'd laugh", 1],
      ["Delete this question", 0]
    ]
  },

  {
    text: "Do you like characters with paws?",
    answers: [
      ["Yes obviously", 3],
      ["They're cute", 2],
      ["They're fine", 1],
      ["No opinion", 0]
    ]
  },

  {
    text: "Your friend says 'your fursona would be a fox'.",
    answers: [
      ["They're correct", 3],
      ["Probably", 2],
      ["Why a fox?", 1],
      ["I have no fursona", 0]
    ]
  },

  {
    text: "Would you put animal ears on your Discord avatar?",
    answers: [
      ["Already have", 3],
      ["Yes", 2],
      ["Maybe temporarily", 1],
      ["No", 0]
    ]
  },

  {
    text: "Pick an accessory.",
    answers: [
      ["Collar with name tag", 3],
      ["Animal-ear hoodie", 3],
      ["Normal necklace", 1],
      ["Watch", 0]
    ]
  },

  {
    text: "Are wolf characters automatically cool?",
    answers: [
      ["Yes", 3],
      ["Usually", 2],
      ["Sometimes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you say 'arf' for $5?",
    answers: [
      ["I'd do it free", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["No dignity remains", 0]
    ]
  },

  {
    text: "Would you use an animated tail accessory in a game?",
    answers: [
      ["Every outfit", 3],
      ["Often", 2],
      ["Sometimes", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Do you prefer cute animal characters over realistic ones?",
    answers: [
      ["Definitely", 3],
      ["Usually", 2],
      ["Depends", 1],
      ["No", 0]
    ]
  },

  {
    text: "Have you ever thought a furry avatar looked cool?",
    answers: [
      ["Many times", 3],
      ["Yeah", 2],
      ["Maybe once", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Choose your reaction to a fluffy tail.",
    answers: [
      ["I need it", 3],
      ["Looks cute", 2],
      ["Cool", 1],
      ["It's a tail", 0]
    ]
  },

  {
    text: "Would you ever commission a character drawing?",
    answers: [
      ["Yes, furry character", 3],
      ["Maybe an animal character", 2],
      ["Normal character", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Your friend asks what animal you would be.",
    answers: [
      ["I have the answer ready", 3],
      ["Probably fox/wolf/cat", 2],
      ["Need to think", 1],
      ["Human", 0]
    ]
  },

  {
    text: "Do you like fluffy ears?",
    answers: [
      ["Very much", 3],
      ["Yeah", 2],
      ["They're okay", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you use a 'nya' soundboard?",
    answers: [
      ["Daily", 3],
      ["For trolling", 2],
      ["Maybe once", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Your Spotify playlist is called 'Floof Mode'.",
    answers: [
      ["Sounds accurate", 3],
      ["Kinda funny", 2],
      ["Maybe", 1],
      ["Absolutely not", 0]
    ]
  },

  {
    text: "If animal ears moved with your emotions, would you want them?",
    answers: [
      ["YES", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you use 'bro 💀' after saying something suspicious?",
    answers: [
      ["Every time", 2],
      ["Often", 2],
      ["Sometimes", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Would your hypothetical fursona have drip?",
    answers: [
      ["Maximum drip", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["There is no fursona", 0]
    ]
  },

  {
    text: "Pick a tail.",
    answers: [
      ["Huge fox tail", 3],
      ["Wolf tail", 3],
      ["Cat tail", 2],
      ["No tail", 0]
    ]
  },

  {
    text: "Would you use paws as slippers?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["For the meme", 1],
      ["No", 0]
    ]
  },

  {
    text: "Someone sends a cute wolf sticker.",
    answers: [
      ["Instant save", 3],
      ["React heart", 2],
      ["React lol", 1],
      ["Ignore", 0]
    ]
  },

  {
    text: "What's your opinion on furry conventions?",
    answers: [
      ["Looks fun", 3],
      ["Interesting", 2],
      ["Neutral", 1],
      ["Not for me", 0]
    ]
  },

  {
    text: "Would you own an animal-ear gaming headset?",
    answers: [
      ["Already do", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Could someone convince you to make a fursona?",
    answers: [
      ["Don't need convincing", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["Impossible", 0]
    ]
  },

  {
    text: "Pick one Discord status.",
    answers: [
      ["OwO what's this", 3],
      ["Feeling fluffy", 3],
      ["Gaming", 1],
      ["Do Not Disturb", 0]
    ]
  },

  {
    text: "Would you ever say 'boop' while touching someone's nose?",
    answers: [
      ["Absolutely", 3],
      ["Probably", 2],
      ["Maybe jokingly", 1],
      ["No", 0]
    ]
  },

  {
    text: "How much do you like fluffy animals?",
    answers: [
      ["OBSESSED", 3],
      ["A lot", 2],
      ["They're cute", 1],
      ["Normal amount", 0]
    ]
  },

  {
    text: "Do you know what a fursona is?",
    answers: [
      ["Of course", 3],
      ["Yeah", 2],
      ["Heard of it", 1],
      ["No idea", 0]
    ]
  },

  {
    text: "Would you use ':3' as your Discord bio?",
    answers: [
      ["Already there", 3],
      ["Could happen", 2],
      ["As a joke", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Would you choose ears that react to your mood?",
    answers: [
      ["Yes immediately", 3],
      ["Sounds cool", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Your friend catches you watching furry memes.",
    answers: [
      ["No shame", 3],
      ["Explain myself", 2],
      ["Close tab instantly", 1],
      ["Impossible", 0]
    ]
  },

  {
    text: "Do you think foxes have main character energy?",
    answers: [
      ["Absolutely", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Choose an emote.",
    answers: [
      [":3", 3],
      ["OwO", 3],
      ["💀", 1],
      ["👍", 0]
    ]
  },

  {
    text: "Would you ever wear ears just for a selfie?",
    answers: [
      ["Definitely", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you think tails would improve everyday life?",
    answers: [
      ["100%", 3],
      ["Maybe", 2],
      ["Not really", 1],
      ["Absolutely not", 0]
    ]
  },

  {
    text: "Would you buy a cute wolf keychain?",
    answers: [
      ["Yes instantly", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "How likely are you to choose an animal avatar in VRChat?",
    answers: [
      ["100%", 3],
      ["Very likely", 2],
      ["Maybe", 1],
      ["Never", 0]
    ]
  },

  {
    text: "What's your reaction to being called fluffy?",
    answers: [
      ["I accept", 3],
      ["Kinda cute", 2],
      ["Weird but okay", 1],
      ["No thanks", 0]
    ]
  },

  {
    text: "Would you rather have fox ears or $10?",
    answers: [
      ["Fox ears", 3],
      ["Honestly fox ears", 2],
      ["$10", 0],
      ["Why is this difficult", 2]
    ]
  },

  {
    text: "Do cute animal stickers improve a conversation?",
    answers: [
      ["Always", 3],
      ["Usually", 2],
      ["Sometimes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you have an animal-themed room?",
    answers: [
      ["Already basically do", 3],
      ["Yes", 2],
      ["Maybe a little", 1],
      ["No", 0]
    ]
  },

  {
    text: "Pick your transformation.",
    answers: [
      ["Fox", 3],
      ["Wolf", 3],
      ["Cat", 2],
      ["Stay human", 0]
    ]
  },

  {
    text: "Would you use a paw-print keyboard mat?",
    answers: [
      ["Absolutely", 3],
      ["Yeah", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you think 'floof' is a good word?",
    answers: [
      ["Best word", 3],
      ["Yes", 2],
      ["It's funny", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you ever draw yourself with animal ears?",
    answers: [
      ["Already have", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Could you identify furry art instantly?",
    answers: [
      ["Unfortunately yes", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would your fursona have lore?",
    answers: [
      ["Full cinematic universe", 3],
      ["Definitely", 2],
      ["Maybe basic lore", 1],
      ["STOP SAYING FURSONA", 0]
    ]
  },

  {
    text: "Your friend says 'nyaa~'.",
    answers: [
      ["Nyaa back", 3],
      ["Laugh", 2],
      ["Bruh 💀", 1],
      ["Leave VC", 0]
    ]
  },

  {
    text: "Do you like characters with expressive ears?",
    answers: [
      ["Peak animation", 3],
      ["Yes", 2],
      ["They're cool", 1],
      ["No preference", 0]
    ]
  },

  {
    text: "Would you choose a fluffy blanket with paw prints?",
    answers: [
      ["Yes", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "How likely are you to boop an animal character?",
    answers: [
      ["100%", 3],
      ["Likely", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you secretly understand why people like tails?",
    answers: [
      ["Yes completely", 3],
      ["Kinda", 2],
      ["Maybe", 1],
      ["No idea", 0]
    ]
  },

  {
    text: "Would you put paw prints in your username?",
    answers: [
      ["Already considered it", 3],
      ["Maybe", 2],
      ["Probably not", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Pick the most dangerous sentence.",
    answers: [
      ["I only like furry memes ironically", 3],
      ["Foxes are kinda cute", 2],
      ["I like animals", 1],
      ["I am definitely human", 1]
    ]
  },

  {
    text: "If you suddenly grew a tail, what would you do first?",
    answers: [
      ["Take 500 photos", 3],
      ["Test if it moves", 3],
      ["Panic", 1],
      ["Call a doctor", 0]
    ]
  },

  {
    text: "Would you buy an animal onesie?",
    answers: [
      ["Absolutely", 3],
      ["Yes for sleeping", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "How do you feel about wolf avatars?",
    answers: [
      ["I understand the appeal", 3],
      ["Pretty cool", 2],
      ["Okay", 1],
      ["Overrated", 0]
    ]
  },

  {
    text: "Would you ever have a furry sticker on your laptop?",
    answers: [
      ["Yes", 3],
      ["Maybe hidden somewhere", 2],
      ["As a meme", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you prefer fluffy tails or sleek tails?",
    answers: [
      ["Fluffy obviously", 3],
      ["Fluffy", 2],
      ["Either", 1],
      ["Neither", 0]
    ]
  },

  {
    text: "Would you wear a fox hoodie?",
    answers: [
      ["Yes immediately", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would your furry character be chaotic?",
    answers: [
      ["Absolutely", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["There is no character", 0]
    ]
  },

  {
    text: "Have you ever called an animal 'floofy'?",
    answers: [
      ["Frequently", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Would you choose a fox mascot for your team?",
    answers: [
      ["Yes", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "How much furry knowledge do you accidentally have?",
    answers: [
      ["Way too much", 3],
      ["A decent amount", 2],
      ["A little", 1],
      ["Zero", 0]
    ]
  },

  {
    text: "Would you use a cute animal reaction instead of typing?",
    answers: [
      ["Every time", 3],
      ["Often", 2],
      ["Sometimes", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Would you let your Discord friends choose your animal species?",
    answers: [
      ["Yes 💀", 3],
      ["Could be funny", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Your animal ears accidentally show in public.",
    answers: [
      ["Own it", 3],
      ["Pretend it's fashion", 2],
      ["Hide immediately", 1],
      ["This scenario is insane", 0]
    ]
  },

  {
    text: "Do fluffy characters have unfair charisma?",
    answers: [
      ["Absolutely", 3],
      ["Yeah kinda", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you rather have retractable claws or a tail?",
    answers: [
      ["Tail", 3],
      ["Claws", 2],
      ["Either", 1],
      ["Neither", 0]
    ]
  },

  {
    text: "Would you create custom furry emojis for Discord?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["Only as jokes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you think fox ears look better than normal ears?",
    answers: [
      ["Obviously", 3],
      ["Sometimes", 2],
      ["Depends", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you wear a tail for a Discord challenge?",
    answers: [
      ["Without hesitation", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Someone gifts you furry art of your avatar.",
    answers: [
      ["New profile picture", 3],
      ["I'd keep it", 2],
      ["Funny gift", 1],
      ["Delete", 0]
    ]
  },

  {
    text: "Do you prefer fox, wolf, or cat characters?",
    answers: [
      ["All three 💀", 3],
      ["Fox/wolf", 3],
      ["Cat", 2],
      ["Human", 0]
    ]
  },

  {
    text: "How strong are the furry allegations?",
    answers: [
      ["Unbeatable", 3],
      ["Pretty strong", 2],
      ["Weak", 1],
      ["There are no allegations", 0]
    ]
  },

  {
    text: "Would you put animal ears on your game character if they're free?",
    answers: [
      ["Instantly", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would your fursona wear your real-life clothes?",
    answers: [
      ["Yes that's actually fire", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No fursona exists", 0]
    ]
  },

  {
    text: "Someone says 'you're definitely a furry'.",
    answers: [
      ["Caught me", 3],
      ["The evidence is concerning", 2],
      ["Nahhh 💀", 1],
      ["False accusation", 0]
    ]
  },

  {
    text: "Would you use a fox emoji every day?",
    answers: [
      ["Yes", 3],
      ["Probably", 2],
      ["Sometimes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do animal-themed hoodies have aura?",
    answers: [
      ["Maximum aura", 3],
      ["Yeah", 2],
      ["Some do", 1],
      ["No", 0]
    ]
  },

  {
    text: "Pick the better nickname.",
    answers: [
      ["Floof", 3],
      ["Wolfie", 3],
      ["Bro", 1],
      ["Steve", 0]
    ]
  },

  {
    text: "Would you rather have permanent fox ears or free pizza once?",
    answers: [
      ["Fox ears", 3],
      ["This is difficult", 2],
      ["Pizza", 0],
      ["Why only once 💀", 1]
    ]
  },

  {
    text: "Could you pull off animal ears?",
    answers: [
      ["Easily", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you ever use a furry profile banner?",
    answers: [
      ["Already would", 3],
      ["Maybe", 2],
      ["As a joke", 1],
      ["Never", 0]
    ]
  },

  {
    text: "What is your reaction to a wagging tail?",
    answers: [
      ["Cute", 3],
      ["Wholesome", 2],
      ["Funny", 1],
      ["Normal", 0]
    ]
  },

  {
    text: "Would you rather have a fluffy tail or perfect WiFi?",
    answers: [
      ["Tail 💀", 3],
      ["This is impossible", 2],
      ["WiFi", 0],
      ["Both or nothing", 1]
    ]
  },

  {
    text: "Do you have a favorite animal for suspicious reasons?",
    answers: [
      ["Yes 💀", 3],
      ["Maybe", 2],
      ["Just normal reasons", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you ever name yourself after an animal online?",
    answers: [
      ["Already have", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you buy a fox-tail keychain?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["If cheap", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do furry memes make you laugh?",
    answers: [
      ["Unfortunately yes", 3],
      ["Often", 2],
      ["Sometimes", 1],
      ["No", 0]
    ]
  },

  {
    text: "How would you respond to 'owo what's this?'",
    answers: [
      ["Continue the bit", 3],
      ["Laugh", 2],
      ["💀", 1],
      ["Block", 0]
    ]
  },

  {
    text: "Would you wear a fluffy animal hoodie in winter?",
    answers: [
      ["Yes", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you think animal avatars are expressive?",
    answers: [
      ["Very", 3],
      ["Yeah", 2],
      ["Sometimes", 1],
      ["Not really", 0]
    ]
  },

  {
    text: "Would your tail match your outfit?",
    answers: [
      ["Obviously", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["WHAT TAIL", 0]
    ]
  },

  {
    text: "Would you spend money customizing a furry avatar?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["Only a little", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you like animal-themed usernames?",
    answers: [
      ["Yes", 3],
      ["Sometimes", 2],
      ["They're okay", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you rather have wolf ears or cat ears?",
    answers: [
      ["Wolf ears", 3],
      ["Cat ears", 3],
      ["Either", 2],
      ["Neither", 0]
    ]
  },

  {
    text: "If someone drew you as an animal, would you keep it?",
    answers: [
      ["Absolutely", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you understand why people like fursonas?",
    answers: [
      ["Yes", 3],
      ["Mostly", 2],
      ["Kind of", 1],
      ["Not at all", 0]
    ]
  },

  {
    text: "Would you ever have matching animal avatars with someone?",
    answers: [
      ["Yes that's cute", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Pick your dream ear type.",
    answers: [
      ["Fox", 3],
      ["Wolf", 3],
      ["Cat", 2],
      ["Normal", 0]
    ]
  },

  {
    text: "Would you call yourself a creature for the joke?",
    answers: [
      ["I already do", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you find animated tails satisfying to watch?",
    answers: [
      ["Yes 💀", 3],
      ["Kinda", 2],
      ["Sometimes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Could your Discord server convince you to wear cat ears?",
    answers: [
      ["Very easily", 3],
      ["Probably", 2],
      ["Maybe for a dare", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Would you rather be called wolfie or bro?",
    answers: [
      ["Wolfie", 3],
      ["Depends who says it", 2],
      ["Bro", 0],
      ["Neither", 0]
    ]
  },

  {
    text: "How suspicious would a furry folder on your PC be?",
    answers: [
      ["Already exists", 3],
      ["Very suspicious", 2],
      ["Just memes bro", 1],
      ["Impossible", 0]
    ]
  },

  {
    text: "Would you use an animal-themed phone wallpaper?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["Depends", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you accept free custom furry art?",
    answers: [
      ["Immediately", 3],
      ["Yeah", 2],
      ["Probably", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you think furry avatars can look cool instead of cute?",
    answers: [
      ["Definitely", 3],
      ["Yeah", 2],
      ["Sometimes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you have glowing markings on your hypothetical fursona?",
    answers: [
      ["Absolutely", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No hypothetical fursona", 0]
    ]
  },

  {
    text: "Would you wear a wolf mask for a photo?",
    answers: [
      ["Yes", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would your furry avatar have accessories?",
    answers: [
      ["Full outfit", 3],
      ["Some", 2],
      ["Maybe one", 1],
      ["No avatar", 0]
    ]
  },

  {
    text: "Do you say 'little guy' when you see cute animals?",
    answers: [
      ["Every time", 3],
      ["Often", 2],
      ["Sometimes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you rather have ears that twitch or a tail that wags?",
    answers: [
      ["Both please", 3],
      ["Tail", 3],
      ["Ears", 2],
      ["Neither", 0]
    ]
  },

  {
    text: "Do you think fluffy tails look comfortable?",
    answers: [
      ["Yes", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you ever use 'fox' or 'wolf' in your gamer tag?",
    answers: [
      ["Already have", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "How much would you defend your favorite animal character?",
    answers: [
      ["With my life", 3],
      ["A lot", 2],
      ["A little", 1],
      ["I don't have one", 0]
    ]
  },

  {
    text: "Would your furry avatar have a dramatic backstory?",
    answers: [
      ["Full lore document", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["No avatar", 0]
    ]
  },

  {
    text: "Would you use a tail emote in Discord?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["For memes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do animal characters deserve more customization options?",
    answers: [
      ["Absolutely", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["Don't care", 0]
    ]
  },

  {
    text: "Would you ever make animal noises for a dare?",
    answers: [
      ["For free", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Would you choose a furry character in a fighting game?",
    answers: [
      ["Yes", 3],
      ["If they're strong", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you like wolf or fox logos?",
    answers: [
      ["Yes", 3],
      ["Some", 2],
      ["They're okay", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you rather be fluffy or aerodynamic?",
    answers: [
      ["FLUFFY", 3],
      ["Probably fluffy", 2],
      ["Aerodynamic", 1],
      ["Human", 0]
    ]
  },

  {
    text: "Would you choose an animal-themed Discord role color?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["Doesn't matter", 1],
      ["No", 0]
    ]
  },

  {
    text: "Have furry jokes become too relatable?",
    answers: [
      ["Unfortunately", 3],
      ["Sometimes", 2],
      ["Not really", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Would you rather be a fox for a day or get $5?",
    answers: [
      ["Fox for a day", 3],
      ["Fox probably", 2],
      ["$5", 0],
      ["Why is this tempting", 2]
    ]
  },

  {
    text: "Could you recognize your friends as animal species?",
    answers: [
      ["Already assigned them", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you make a furry version of your current Discord avatar?",
    answers: [
      ["Yes immediately", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you buy a hoodie with little ears on top?",
    answers: [
      ["Yes", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you think tails should have physics in games?",
    answers: [
      ["Mandatory", 3],
      ["Yes", 2],
      ["Nice detail", 1],
      ["Don't care", 0]
    ]
  },

  {
    text: "Would you pick an animal race in an RPG?",
    answers: [
      ["Always", 3],
      ["Probably", 2],
      ["Sometimes", 1],
      ["Human every time", 0]
    ]
  },

  {
    text: "Do you like animal mascots?",
    answers: [
      ["Yes", 3],
      ["Usually", 2],
      ["Sometimes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you ever say 'I am just a silly creature'?",
    answers: [
      ["Already say it", 3],
      ["Yes 💀", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would a tail improve your outfit?",
    answers: [
      ["100%", 3],
      ["Maybe", 2],
      ["Depends", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you choose a cute animal loading icon?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["Whatever", 1],
      ["No", 0]
    ]
  },

  {
    text: "Could you survive a full day wearing cat ears?",
    answers: [
      ["Easily", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you use paws as your cursor icon?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["For one day", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do foxes look slightly too cool?",
    answers: [
      ["YES", 3],
      ["Kinda", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you rather have one giant tail or three smaller tails?",
    answers: [
      ["Three tails", 3],
      ["Giant tail", 3],
      ["Either", 2],
      ["Zero tails", 0]
    ]
  },

  {
    text: "Would your fursona have a gamer setup?",
    answers: [
      ["Obviously", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["NO FURSONA", 0]
    ]
  },

  {
    text: "Would you ever use '>:3' during an argument?",
    answers: [
      ["Absolutely", 3],
      ["Maybe", 2],
      ["As a joke", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Do you think animal ears improve anime characters?",
    answers: [
      ["100%", 3],
      ["Usually", 2],
      ["Sometimes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you use a fluffy avatar during winter?",
    answers: [
      ["Yes for immersion", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you let your friends design your fursona?",
    answers: [
      ["That sounds hilarious", 3],
      ["Maybe", 2],
      ["Only partially", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you think ears should move when characters are embarrassed?",
    answers: [
      ["YES peak detail", 3],
      ["Yeah", 2],
      ["Nice touch", 1],
      ["Don't care", 0]
    ]
  },

  {
    text: "Would you use an animal-themed nickname in a game?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["Sometimes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you rather have fluffy ears or perfect hair forever?",
    answers: [
      ["Fluffy ears", 3],
      ["Why is this hard", 2],
      ["Perfect hair", 0],
      ["Both", 1]
    ]
  },

  {
    text: "Do you like paw-print designs?",
    answers: [
      ["Yes", 3],
      ["Sometimes", 2],
      ["They're okay", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you have a furry mascot for your Discord server?",
    answers: [
      ["Absolutely", 3],
      ["Maybe", 2],
      ["Could be funny", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you choose an animal profile frame?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["Depends", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you make a tail wag emote?",
    answers: [
      ["Yes 💀", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you rather be called fluffy or handsome/pretty?",
    answers: [
      ["Fluffy", 3],
      ["Depends who says it", 2],
      ["Handsome/pretty", 1],
      ["None", 0]
    ]
  },

  {
    text: "Do you think wolf ears have aura?",
    answers: [
      ["Insane aura", 3],
      ["Yes", 2],
      ["A little", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you use a fox avatar during Halloween?",
    answers: [
      ["Yes", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you think tails would expose your emotions too much?",
    answers: [
      ["Yes but worth it", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No tail thanks", 0]
    ]
  },

  {
    text: "Would your furry character have your personality?",
    answers: [
      ["Exactly", 3],
      ["Mostly", 2],
      ["Maybe", 1],
      ["No character", 0]
    ]
  },

  {
    text: "Would you buy animal-themed headphones?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["If they sound good", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you ever use animal gifs as reactions?",
    answers: [
      ["Constantly", 3],
      ["Often", 2],
      ["Sometimes", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Would you accept being assigned a random animal by the server?",
    answers: [
      ["Yes", 3],
      ["Sounds funny", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Could you confidently say 'nya' in voice chat?",
    answers: [
      ["Easily", 3],
      ["Maybe", 2],
      ["For money", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Would you buy a plush version of your fursona?",
    answers: [
      ["Immediately", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["STOP", 0]
    ]
  },

  {
    text: "Do you think furry avatars can be intimidating?",
    answers: [
      ["Definitely", 3],
      ["Sometimes", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you wear ears during a gaming stream?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["For a challenge", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you make a wolf character your main?",
    answers: [
      ["Yes", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you think fluffy characters deserve extra points?",
    answers: [
      ["Yes automatically", 3],
      ["Maybe", 2],
      ["Depends", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you rather have expressive ears or expressive eyebrows?",
    answers: [
      ["Ears", 3],
      ["Probably ears", 2],
      ["Eyebrows", 0],
      ["Both", 1]
    ]
  },

  {
    text: "Would you have a fursona with your exact hairstyle?",
    answers: [
      ["Yes", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No fursona", 0]
    ]
  },

  {
    text: "Do you enjoy animal-character customization in games?",
    answers: [
      ["Way too much", 3],
      ["Yes", 2],
      ["Sometimes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would your tail betray you around your crush?",
    answers: [
      ["Immediately 💀", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["WHAT TAIL", 0]
    ]
  },

  {
    text: "Would you ever say 'the furry allegations are crazy'?",
    answers: [
      ["Regularly", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you use animal ears in your profile picture editor?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["For memes", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you rather have a fluffy tail or glowing eyes?",
    answers: [
      ["Fluffy tail", 3],
      ["Glowing eyes", 2],
      ["Both", 2],
      ["Neither", 0]
    ]
  },

  {
    text: "Would you pick a furry skin if it's the rarest skin?",
    answers: [
      ["Yes and proudly", 3],
      ["Yeah", 2],
      ["Only because rare", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you like exaggerated fluffy character designs?",
    answers: [
      ["Absolutely", 3],
      ["Sometimes", 2],
      ["A little", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you draw paw prints on your notebook?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["Random doodle", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you ever use 'wolf mode activated' unironically?",
    answers: [
      ["Absolutely 💀", 3],
      ["Maybe jokingly", 2],
      ["Only ironically", 1],
      ["Never", 0]
    ]
  },

  {
    text: "Do you think animal ears are better when animated?",
    answers: [
      ["Yes", 3],
      ["Probably", 2],
      ["Doesn't matter", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you use a furry-themed Discord soundboard?",
    answers: [
      ["100%", 3],
      ["Maybe", 2],
      ["For trolling", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you rather have fox ears or wolf ears in real life?",
    answers: [
      ["Fox", 3],
      ["Wolf", 3],
      ["Either", 2],
      ["Neither", 0]
    ]
  },

  {
    text: "Would you send a tail-wagging gif when happy?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["Funny idea", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would your hypothetical fursona have a cool jacket?",
    answers: [
      ["Absolutely", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["Stop asking", 0]
    ]
  },

  {
    text: "Do you think fox characters are suspiciously common?",
    answers: [
      ["For good reason", 3],
      ["Yeah", 2],
      ["Maybe", 1],
      ["Don't care", 0]
    ]
  },

  {
    text: "Would you use a furry-themed phone case?",
    answers: [
      ["Yes", 3],
      ["Maybe", 2],
      ["Subtle one", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you put a tiny tail on your Roblox avatar?",
    answers: [
      ["Already would", 3],
      ["Yes", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you choose furry emotes over normal Twitch emotes?",
    answers: [
      ["Yes", 3],
      ["Sometimes", 2],
      ["Depends", 1],
      ["No", 0]
    ]
  },

  {
    text: "Could your profile become furry-coded accidentally?",
    answers: [
      ["Already happened", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you rather have soft paws or soft hair?",
    answers: [
      ["Paws", 3],
      ["Why not both", 2],
      ["Hair", 1],
      ["Normal hands", 0]
    ]
  },

  {
    text: "Would you own a wolf plush bigger than you?",
    answers: [
      ["YES", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you use a furry avatar if nobody knew it was you?",
    answers: [
      ["Absolutely", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Do you think being fluffy is a personality trait?",
    answers: [
      ["Yes 💀", 3],
      ["Maybe", 2],
      ["As a joke", 1],
      ["No", 0]
    ]
  },

  {
    text: "Would you let someone pick your fursona name?",
    answers: [
      ["Sure", 3],
      ["Maybe", 2],
      ["I'd pick it myself", 1],
      ["There is no name", 0]
    ]
  },

  {
    text: "Would you rather have ears that flatten when embarrassed or no ears?",
    answers: [
      ["Expressive ears", 3],
      ["Obviously ears", 2],
      ["Normal ears", 0],
      ["I refuse to choose", 1]
    ]
  },

  {
    text: "Would you buy furry art if it looked genuinely cool?",
    answers: [
      ["Yes", 3],
      ["Probably", 2],
      ["Maybe", 1],
      ["No", 0]
    ]
  },

  {
    text: "Could you defend yourself against furry allegations after this quiz?",
    answers: [
      ["No chance", 3],
      ["Barely", 2],
      ["Probably", 1],
      ["Easy", 0]
    ]
  }
];

// Generates filler variations to push the pool much higher
const extraTemplates = [
  "Would you wear {thing} for an entire day?",
  "Would you use {thing} as your Discord avatar?",
  "How suspiciously cute is {thing}?",
  "Would you buy {thing} if it was cheap?",
  "Would you save a picture of {thing}?",
  "Would you choose {thing} in a game?",
  "Would you show your friends {thing}?",
  "Would you use {thing} during a stream?",
  "Would you put {thing} on your profile?",
  "Would you defend {thing} from haters?"
];

const extraThings = [
  "fox ears",
  "wolf ears",
  "cat ears",
  "a fluffy tail",
  "paw gloves",
  "a wolf hoodie",
  "a fox avatar",
  "an animal onesie",
  "a fluffy profile picture",
  "a furry sticker",
  "a paw-print keyboard",
  "a giant wolf plush",
  "a fox keychain",
  "a cat-ear headset",
  "an animated tail",
  "a wolf mask",
  "a fluffy blanket",
  "a furry game skin",
  "a fox mascot",
  "a paw-print hoodie"
];

for (const template of extraTemplates) {
  for (const thing of extraThings) {
    if (questions.length >= 260) break;

    questions.push({
      text: template.replace("{thing}", thing),
      answers: [
        ["Absolutely", 3],
        ["Probably", 2],
        ["Maybe", 1],
        ["No", 0]
      ]
    });
  }

  if (questions.length >= 260) break;
}

// ================= QUIZ LOGIC =================

function chooseQuestions(userId) {
  let history = loadHistory();

  history = cleanOldHistory(history);

  const today = getTodayKey();

  if (!history[userId]) {
    history[userId] = {};
  }

  if (!history[userId][today]) {
    history[userId][today] = [];
  }

  const usedToday = new Set(history[userId][today]);

  let available = questions
    .map((_, index) => index)
    .filter(index => !usedToday.has(index));

  // If user somehow used nearly everything today,
  // reset only today's question pool.
  if (available.length < 10) {
    history[userId][today] = [];
    available = questions.map((_, index) => index);
  }

  const selected = [];

  while (selected.length < 10 && available.length > 0) {
    const randomIndex = Math.floor(
      Math.random() * available.length
    );

    const questionIndex = available.splice(
      randomIndex,
      1
    )[0];

    selected.push(questionIndex);
  }

  history[userId][today].push(...selected);

  saveHistory(history);

  return selected;
}

function createQuestionEmbed(session) {
  const questionIndex =
    session.questions[session.currentQuestion];

  const question = questions[questionIndex];

  return new EmbedBuilder()
    .setColor("Purple")
    .setTitle("Gen Z Furry Test 🐾")
    .setDescription(
      `**Question ${session.currentQuestion + 1}/10**\n\n` +
      question.text
    )
    .setFooter({
      text: `Furry points: ${session.score}`
    });
}

function createQuestionButtons(userId, session) {
  const questionIndex =
    session.questions[session.currentQuestion];

  const question = questions[questionIndex];

  return new ActionRowBuilder().addComponents(
    question.answers.map((answer, index) =>
      new ButtonBuilder()
        .setCustomId(
          `furrytest_${userId}_${index}`
        )
        .setLabel(answer[0].slice(0, 80))
        .setStyle(
          index === 0
            ? ButtonStyle.Primary
            : index === 1
            ? ButtonStyle.Success
            : index === 2
            ? ButtonStyle.Secondary
            : ButtonStyle.Danger
        )
    )
  );
}

function getResult(percent) {
  if (percent <= 10) {
    return {
      rank: "Certified Human",
      text: "Bro survived the allegations somehow 💀"
    };
  }

  if (percent <= 25) {
    return {
      rank: "Slightly Suspicious",
      text: "There is some suspicious activity but nothing proven yet."
    };
  }

  if (percent <= 45) {
    return {
      rank: ":3 User",
      text: "You definitely know more than you're admitting."
    };
  }

  if (percent <= 65) {
    return {
      rank: "Furry Allegations",
      text: "The allegations are getting dangerously believable 💀"
    };
  }

  if (percent <= 80) {
    return {
      rank: "Suspiciously Furry",
      text: "Bro said 'I'm not a furry' then picked the tail option 7 times."
    };
  }

  if (percent <= 95) {
    return {
      rank: "Fursona Loading",
      text: "At this point you should probably start choosing your species."
    };
  }

  return {
    rank: "Final Boss Furry",
    text: "There is no defending yourself anymore. The case is closed."
  };
}

// ================= COMMAND =================

async function execute(interaction) {
  const userId = interaction.user.id;

  if (activeFurryTests.has(userId)) {
    return interaction.reply({
      content:
        "You already have a furry test running. Finish that one first 💀",
      ephemeral: true
    });
  }

  const selectedQuestions = chooseQuestions(userId);

  const session = {
    userId,
    questions: selectedQuestions,
    currentQuestion: 0,
    score: 0,
    answers: []
  };

  activeFurryTests.set(userId, session);

  const embed = createQuestionEmbed(session);
  const row = createQuestionButtons(userId, session);

  return interaction.reply({
    embeds: [embed],
    components: [row]
  });
}

// ================= BUTTONS =================

async function handleButton(interaction) {
  if (!interaction.customId.startsWith("furrytest_")) {
    return false;
  }

  const parts = interaction.customId.split("_");

  const ownerId = parts[1];
  const answerIndex = Number(parts[2]);

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content:
        "This isn't your furry test 💀 Use `/furrytest` to start your own.",
      ephemeral: true
    });

    return true;
  }

  const session = activeFurryTests.get(ownerId);

  if (!session) {
    await interaction.reply({
      content:
        "This furry test expired. Run `/furrytest` again.",
      ephemeral: true
    });

    return true;
  }

  const questionIndex =
    session.questions[session.currentQuestion];

  const question = questions[questionIndex];

  const selectedAnswer =
    question.answers[answerIndex];

  if (!selectedAnswer) {
    return true;
  }

  session.score += selectedAnswer[1];

  session.answers.push({
    question: question.text,
    answer: selectedAnswer[0],
    points: selectedAnswer[1]
  });

  session.currentQuestion++;

  // ================= NEXT QUESTION =================

  if (session.currentQuestion < 10) {
    activeFurryTests.set(ownerId, session);

    const embed = createQuestionEmbed(session);
    const row = createQuestionButtons(ownerId, session);

    await interaction.update({
      embeds: [embed],
      components: [row]
    });

    return true;
  }

  // ================= FINAL RESULT =================

  const maxScore = 30;

  let percent = Math.round(
    (session.score / maxScore) * 100
  );

  // Small Gen-Z randomness
  percent += Math.floor(Math.random() * 7) - 3;

  percent = Math.max(
    0,
    Math.min(100, percent)
  );

  const result = getResult(percent);

  const resultEmbed = new EmbedBuilder()
    .setColor("Purple")
    .setTitle("🐾 Furry Test Results")
    .setThumbnail(
      interaction.user.displayAvatarURL({
        size: 256
      })
    )
    .setDescription(
      `${interaction.user} is **${percent}% Furry** 💀\n\n` +
      `**Rank:** ${result.rank}\n\n` +
      `${result.text}`
    )
    .addFields(
      {
        name: "Test Stats",
        value:
          `Questions: **10/10**\n` +
          `Furry Points: **${session.score}/${maxScore}**\n` +
          `Result: **${percent}%**`,
        inline: true
      }
    )
    .setFooter({
      text:
        "Questions are randomized and avoid repeating on the same day."
    })
    .setTimestamp();

  activeFurryTests.delete(ownerId);

  await interaction.update({
    embeds: [resultEmbed],
    components: []
  });

  return true;
}

module.exports = {
  execute,
  handleButton
};