
const { EmbedBuilder } = require("discord.js");

const songs = [
  { artist: "Bruno Mars", title: "Just the Way You Are" },
  { artist: "Bruno Mars", title: "Grenade" },
  { artist: "Bruno Mars", title: "Talking to the Moon" },
  { artist: "Bruno Mars", title: "When I Was Your Man" },
  { artist: "Bruno Mars", title: "Locked Out of Heaven" },
  { artist: "Bruno Mars", title: "That's What I Like" },
  { artist: "Bruno Mars", title: "24K Magic" },
  { artist: "Bruno Mars", title: "Versace on the Floor" },
  { artist: "Bruno Mars", title: "Marry You" },
  { artist: "Bruno Mars", title: "Treasure" },

  { artist: "Charlie Puth", title: "Attention" },
  { artist: "Charlie Puth", title: "We Don't Talk Anymore" },
  { artist: "Charlie Puth", title: "One Call Away" },
  { artist: "Charlie Puth", title: "See You Again" },
  { artist: "Charlie Puth", title: "How Long" },
  { artist: "Charlie Puth", title: "Light Switch" },
  { artist: "Charlie Puth", title: "Left and Right" },
  { artist: "Charlie Puth", title: "Dangerously" },

  { artist: "Olivia Dean", title: "Dive" },
  { artist: "Olivia Dean", title: "The Hardest Part" },
  { artist: "Olivia Dean", title: "Be My Own Boyfriend" },
  { artist: "Olivia Dean", title: "Carmen" },
  { artist: "Olivia Dean", title: "Messy" },
  { artist: "Olivia Dean", title: "Nice to Each Other" },
  { artist: "Olivia Dean", title: "Man I Need" },

  { artist: "M2M", title: "The Day You Went Away" },
  { artist: "M2M", title: "Pretty Boy" },
  { artist: "M2M", title: "Mirror Mirror" },
  { artist: "M2M", title: "Don't Say You Love Me" },
  { artist: "M2M", title: "Everything You Do" },
  { artist: "M2M", title: "Girl in Your Dreams" }
];

songs.forEach((song, index) => {
  song.id = String(index);
});

async function autocomplete(interaction) {
  const query = interaction.options
    .getFocused()
    .toLowerCase();

  const matches = songs
    .filter(song =>
      `${song.artist} ${song.title}`
        .toLowerCase()
        .includes(query)
    )
    .slice(0, 25);

  return interaction.respond(
    matches.map(song => ({
      name: `${song.artist} - ${song.title}`.slice(0, 100),
      value: song.id
    }))
  );
}

async function execute(interaction) {
  const id = interaction.options.getString("select");
  const song = songs.find(s => s.id === id);

  if (!song) {
    return interaction.reply({
      content: "❌ Song not found.",
      ephemeral: true
    });
  }

  const lyrics = song.lyrics?.trim();

  const embed = new EmbedBuilder()
    .setColor("#E879A8")
    .setTitle(`🎵 ${song.title}`)
    .addFields({
      name: "Artist",
      value: song.artist
    })
    .setDescription(
      lyrics
        ? lyrics.slice(0, 4000)
        : "Full lyrics are not available in the bot's catalogue yet."
    )
    .setFooter({
      text: "NoobV2 Music • Lyrics"
    })
    .setTimestamp();

  return interaction.reply({
    embeds: [embed]
  });
}

module.exports = {
  autocomplete,
  execute
};
