const {
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
    PermissionFlagsBits
} = require('discord.js');

const axios = require('axios');
const Canvas = require('canvas');
const fs = require('fs');
const path = require('path');

const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;

const MAX_BET_WL = 10_000; // 100 DL
const BET_CLOSE_BEFORE_KICKOFF_MS = 5 * 60 * 1000;

const DATA_FOLDER = path.join(__dirname, '..', 'data');
const BETS_FILE = path.join(DATA_FOLDER, 'worldcup_bets.json');
const ECONOMY_FILE = path.join(DATA_FOLDER, 'economy.json');

const API_URL = 'https://v3.football.api-sports.io';

if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER, { recursive: true });
}

function ensureJsonFile(filePath, defaultValue = {}) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(
            filePath,
            JSON.stringify(defaultValue, null, 2),
            'utf8'
        );
    }
}

ensureJsonFile(BETS_FILE, {
    bets: [],
    leaderboard: {}
});

ensureJsonFile(ECONOMY_FILE, {});

function readJson(filePath, defaultValue = {}) {
    try {
        ensureJsonFile(filePath, defaultValue);

        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.error(`Failed to read ${filePath}:`, error);
        return defaultValue;
    }
}

function writeJson(filePath, data) {
    const temporaryFile = `${filePath}.tmp`;

    fs.writeFileSync(
        temporaryFile,
        JSON.stringify(data, null, 2),
        'utf8'
    );

    fs.renameSync(temporaryFile, filePath);
}

function getApiHeaders() {
    if (!process.env.API_FOOTBALL_KEY) {
        throw new Error('API_FOOTBALL_KEY is missing from the .env file.');
    }

    return {
        'x-apisports-key': process.env.API_FOOTBALL_KEY
    };
}

async function footballRequest(endpoint, params = {}) {
    const response = await axios.get(`${API_URL}/${endpoint}`, {
        headers: getApiHeaders(),
        params,
        timeout: 20_000
    });

    if (response.data?.errors) {
        const errors = Object.values(response.data.errors);

        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
    }

    return response.data?.response ?? [];
}

/*
|--------------------------------------------------------------------------
| Economy adapter
|--------------------------------------------------------------------------
|
| Replace these functions if your bot already has an economy database.
|
| Expected wallet format:
|
| {
|   "DISCORD_USER_ID": {
|       "wl": 500,
|       "dl": 10
|   }
| }
|
| 1 DL = 100 WL
|
*/

function getWallet(userId) {
    const economy = readJson(ECONOMY_FILE, {});

    if (!economy[userId]) {
        economy[userId] = {
            wl: 0,
            dl: 0
        };

        writeJson(ECONOMY_FILE, economy);
    }

    return economy[userId];
}

function getTotalWL(userId) {
    const wallet = getWallet(userId);

    return Number(wallet.wl || 0) + Number(wallet.dl || 0) * 100;
}

function setTotalWL(userId, totalWL) {
    const economy = readJson(ECONOMY_FILE, {});

    economy[userId] = {
        dl: Math.floor(totalWL / 100),
        wl: totalWL % 100
    };

    writeJson(ECONOMY_FILE, economy);
}

function removeWL(userId, amount) {
    const currentBalance = getTotalWL(userId);

    if (currentBalance < amount) {
        return false;
    }

    setTotalWL(userId, currentBalance - amount);
    return true;
}

function addWL(userId, amount) {
    const currentBalance = getTotalWL(userId);
    setTotalWL(userId, currentBalance + amount);
}

function formatLocks(amount) {
    const total = Math.max(0, Math.floor(Number(amount) || 0));
    const dl = Math.floor(total / 100);
    const wl = total % 100;

    if (dl > 0 && wl > 0) {
        return `${dl.toLocaleString()} DL ${wl.toLocaleString()} WL`;
    }

    if (dl > 0) {
        return `${dl.toLocaleString()} DL`;
    }

    return `${wl.toLocaleString()} WL`;
}

function formatMelbourneTime(dateValue) {
    const date = new Date(dateValue);

    return new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Melbourne',
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
    }).format(date);
}

function getDiscordTimestamp(dateValue, style = 'F') {
    const timestamp = Math.floor(new Date(dateValue).getTime() / 1000);
    return `<t:${timestamp}:${style}>`;
}

function normalizeStatus(status) {
    return String(status || '').toUpperCase();
}

function isFinishedFixture(fixture) {
    const status = normalizeStatus(fixture?.fixture?.status?.short);

    return ['FT', 'AET', 'PEN'].includes(status);
}

function isCancelledFixture(fixture) {
    const status = normalizeStatus(fixture?.fixture?.status?.short);

    return ['CANC', 'PST', 'ABD', 'AWD', 'WO'].includes(status);
}

function getFixtureResult(fixture) {
    const homeWinner = fixture?.teams?.home?.winner;
    const awayWinner = fixture?.teams?.away?.winner;

    if (homeWinner === true) {
        return 'HOME';
    }

    if (awayWinner === true) {
        return 'AWAY';
    }

    return 'DRAW';
}

function getPredictionName(prediction, fixture) {
    if (prediction === 'HOME') {
        return fixture?.teams?.home?.name || 'Home Team';
    }

    if (prediction === 'AWAY') {
        return fixture?.teams?.away?.name || 'Away Team';
    }

    return 'Draw';
}

function getPayoutMultiplier(prediction) {
    if (prediction === 'DRAW') {
        return 2.8;
    }

    return 1.8;
}

async function getFixture(fixtureId) {
    const fixtures = await footballRequest('fixtures', {
        id: fixtureId
    });

    return fixtures[0] || null;
}

async function getUpcomingFixtures(limit = 10) {
    const fixtures = await footballRequest('fixtures', {
        league: WORLD_CUP_LEAGUE_ID,
        season: WORLD_CUP_SEASON,
        next: Math.min(limit, 20),
        timezone: 'Australia/Melbourne'
    });

    return fixtures.slice(0, limit);
}

async function getPreviousFixtures(limit = 10) {
    const fixtures = await footballRequest('fixtures', {
        league: WORLD_CUP_LEAGUE_ID,
        season: WORLD_CUP_SEASON,
        last: Math.min(limit, 20),
        timezone: 'Australia/Melbourne'
    });

    return fixtures
        .filter(isFinishedFixture)
        .slice(0, limit);
}

async function settleWorldCupBets(client) {
    const data = readJson(BETS_FILE, {
        bets: [],
        leaderboard: {}
    });

    const unsettledBets = data.bets.filter(
        bet => bet.status === 'OPEN'
    );

    if (unsettledBets.length === 0) {
        return {
            checked: 0,
            settled: 0
        };
    }

    const fixtureIds = [
        ...new Set(unsettledBets.map(bet => bet.fixtureId))
    ];

    let settledCount = 0;

    for (const fixtureId of fixtureIds) {
        try {
            const fixture = await getFixture(fixtureId);

            if (!fixture) {
                continue;
            }

            const relatedBets = data.bets.filter(
                bet =>
                    bet.fixtureId === fixtureId &&
                    bet.status === 'OPEN'
            );

            if (isCancelledFixture(fixture)) {
                for (const bet of relatedBets) {
                    addWL(bet.userId, bet.amountWL);

                    bet.status = 'REFUNDED';
                    bet.settledAt = new Date().toISOString();
                    bet.refundWL = bet.amountWL;

                    settledCount++;
                }

                continue;
            }

            if (!isFinishedFixture(fixture)) {
                continue;
            }

            const result = getFixtureResult(fixture);

            for (const bet of relatedBets) {
                const won = bet.prediction === result;

                bet.status = won ? 'WON' : 'LOST';
                bet.result = result;
                bet.settledAt = new Date().toISOString();

                if (won) {
                    const payout = Math.floor(
                        bet.amountWL * bet.multiplier
                    );

                    addWL(bet.userId, payout);

                    bet.payoutWL = payout;

                    if (!data.leaderboard[bet.userId]) {
                        data.leaderboard[bet.userId] = {
                            bets: 0,
                            wins: 0,
                            losses: 0,
                            wageredWL: 0,
                            profitWL: 0
                        };
                    }

                    data.leaderboard[bet.userId].wins++;
                    data.leaderboard[bet.userId].profitWL +=
                        payout - bet.amountWL;
                } else {
                    bet.payoutWL = 0;

                    if (!data.leaderboard[bet.userId]) {
                        data.leaderboard[bet.userId] = {
                            bets: 0,
                            wins: 0,
                            losses: 0,
                            wageredWL: 0,
                            profitWL: 0
                        };
                    }

                    data.leaderboard[bet.userId].losses++;
                    data.leaderboard[bet.userId].profitWL -=
                        bet.amountWL;
                }

                data.leaderboard[bet.userId].bets++;
                data.leaderboard[bet.userId].wageredWL +=
                    bet.amountWL;

                settledCount++;

                try {
                    const user = await client.users.fetch(bet.userId);

                    const teamName = getPredictionName(
                        bet.prediction,
                        fixture
                    );

                    await user.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(won ? 0x57F287 : 0xED4245)
                                .setTitle(
                                    won
                                        ? '🏆 World Cup Bet Won!'
                                        : '💔 World Cup Bet Lost'
                                )
                                .setDescription(
                                    [
                                        `**Match:** ${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
                                        `**Your prediction:** ${teamName}`,
                                        `**Bet:** ${formatLocks(bet.amountWL)}`,
                                        won
                                            ? `**Payout:** ${formatLocks(bet.payoutWL)}`
                                            : '**Payout:** 0 WL'
                                    ].join('\n')
                                )
                                .setTimestamp()
                        ]
                    });
                } catch {
                    // The user may have DMs disabled.
                }
            }
        } catch (error) {
            console.error(
                `Failed to settle fixture ${fixtureId}:`,
                error.message
            );
        }
    }

    writeJson(BETS_FILE, data);

    return {
        checked: unsettledBets.length,
        settled: settledCount
    };
}

async function createLeaderboardCanvas(client) {
    const data = readJson(BETS_FILE, {
        bets: [],
        leaderboard: {}
    });

    const entries = Object.entries(data.leaderboard)
        .map(([userId, stats]) => ({
            userId,
            ...stats
        }))
        .sort((a, b) => {
            if (b.profitWL !== a.profitWL) {
                return b.profitWL - a.profitWL;
            }

            return b.wins - a.wins;
        })
        .slice(0, 10);

    const width = 1000;
    const height = 190 + Math.max(entries.length, 1) * 85;

    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const background = ctx.createLinearGradient(
        0,
        0,
        width,
        height
    );

    background.addColorStop(0, '#10182d');
    background.addColorStop(1, '#29174d');

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fillRect(35, 30, width - 70, height - 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px Arial';
    ctx.fillText('WORLD CUP BETTING', 65, 88);

    ctx.fillStyle = '#c9bbff';
    ctx.font = '24px Arial';
    ctx.fillText('Top WL earners', 67, 125);

    if (entries.length === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '28px Arial';
        ctx.fillText(
            'No completed World Cup bets yet.',
            65,
            205
        );

        return canvas.toBuffer('image/png');
    }

    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        const y = 165 + index * 85;

        ctx.fillStyle =
            index % 2 === 0
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(255, 255, 255, 0.04)';

        ctx.fillRect(55, y, width - 110, 70);

        let username = `User ${entry.userId}`;

        try {
            const user = await client.users.fetch(entry.userId);
            username = user.globalName || user.username;
        } catch {
            // Keep fallback name.
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 27px Arial';
        ctx.fillText(
            `#${index + 1}  ${username}`.slice(0, 32),
            80,
            y + 31
        );

        ctx.fillStyle = '#c8c8d4';
        ctx.font = '18px Arial';
        ctx.fillText(
            `${entry.wins} wins • ${entry.losses} losses`,
            80,
            y + 56
        );

        ctx.textAlign = 'right';
        ctx.fillStyle =
            entry.profitWL >= 0 ? '#67f59d' : '#ff7474';

        ctx.font = 'bold 25px Arial';
        ctx.fillText(
            `${entry.profitWL >= 0 ? '+' : ''}${formatLocks(
                entry.profitWL
            )}`,
            width - 80,
            y + 42
        );

        ctx.textAlign = 'left';
    }

    return canvas.toBuffer('image/png');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('worldcup')
        .setDescription('World Cup matches, statistics and WL betting')
        .addSubcommand(subcommand =>
            subcommand
                .setName('schedule')
                .setDescription('Show upcoming World Cup matches')
                .addIntegerOption(option =>
                    option
                        .setName('limit')
                        .setDescription('Number of matches to show')
                        .setMinValue(1)
                        .setMaxValue(15)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('results')
                .setDescription('Show previous World Cup results')
                .addIntegerOption(option =>
                    option
                        .setName('limit')
                        .setDescription('Number of results to show')
                        .setMinValue(1)
                        .setMaxValue(15)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('match')
                .setDescription('Check a specific match and its statistics')
                .addIntegerOption(option =>
                    option
                        .setName('fixture_id')
                        .setDescription('API-Football fixture ID')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('player')
                .setDescription('Search for World Cup player statistics')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Player name')
                        .setRequired(true)
                        .setMinLength(2)
                        .setMaxLength(50)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('bet')
                .setDescription('Bet WL on a World Cup match')
                .addIntegerOption(option =>
                    option
                        .setName('fixture_id')
                        .setDescription(
                            'Fixture ID shown in /worldcup schedule'
                        )
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('prediction')
                        .setDescription('Your match prediction')
                        .setRequired(true)
                        .addChoices(
                            {
                                name: 'Home team wins',
                                value: 'HOME'
                            },
                            {
                                name: 'Draw',
                                value: 'DRAW'
                            },
                            {
                                name: 'Away team wins',
                                value: 'AWAY'
                            }
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription(
                            'Bet amount in WL — maximum 10,000 WL'
                        )
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(MAX_BET_WL)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('mybets')
                .setDescription('View your World Cup bets')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('Show the World Cup betting leaderboard')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('settle')
                .setDescription('Settle completed World Cup bets')
        ),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'schedule') {
                await interaction.deferReply();

                const limit =
                    interaction.options.getInteger('limit') || 8;

                const fixtures = await getUpcomingFixtures(limit);

                if (fixtures.length === 0) {
                    return interaction.editReply({
                        content:
                            'There are no upcoming World Cup matches available.'
                    });
                }

                const description = fixtures
                    .map(fixture => {
                        const fixtureId = fixture.fixture.id;
                        const kickoff = fixture.fixture.date;
                        const round =
                            fixture.league.round ||
                            'World Cup match';

                        return [
                            `### ${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
                            `🏆 ${round}`,
                            `🕒 ${getDiscordTimestamp(kickoff, 'F')} • ${getDiscordTimestamp(kickoff, 'R')}`,
                            `🌏 Melbourne: ${formatMelbourneTime(kickoff)}`,
                            `🎟️ Fixture ID: \`${fixtureId}\``
                        ].join('\n');
                    })
                    .join('\n\n');

                const embed = new EmbedBuilder()
                    .setColor(0x8B5CF6)
                    .setTitle('⚽ Upcoming World Cup Matches')
                    .setDescription(description)
                    .setFooter({
                        text:
                            'Use /worldcup bet with the fixture ID • Bets close 5 minutes before kickoff'
                    })
                    .setTimestamp();

                return interaction.editReply({
                    embeds: [embed]
                });
            }

            if (subcommand === 'results') {
                await interaction.deferReply();

                const limit =
                    interaction.options.getInteger('limit') || 8;

                const fixtures = await getPreviousFixtures(limit);

                if (fixtures.length === 0) {
                    return interaction.editReply({
                        content:
                            'No completed World Cup matches were found.'
                    });
                }

                const description = fixtures
                    .map(fixture => {
                        const homeScore =
                            fixture.goals.home ?? 0;

                        const awayScore =
                            fixture.goals.away ?? 0;

                        const penaltyHome =
                            fixture.score?.penalty?.home;

                        const penaltyAway =
                            fixture.score?.penalty?.away;

                        const penalties =
                            penaltyHome !== null &&
                            penaltyHome !== undefined
                                ? `\n🎯 Penalties: ${penaltyHome}-${penaltyAway}`
                                : '';

                        return [
                            `### ${fixture.teams.home.name} ${homeScore}–${awayScore} ${fixture.teams.away.name}`,
                            `🏆 ${fixture.league.round || 'World Cup'}`,
                            `📅 ${getDiscordTimestamp(
                                fixture.fixture.date,
                                'D'
                            )}${penalties}`,
                            `🎟️ Fixture ID: \`${fixture.fixture.id}\``
                        ].join('\n');
                    })
                    .join('\n\n');

                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x5865F2)
                            .setTitle(
                                '📊 Previous World Cup Results'
                            )
                            .setDescription(description)
                            .setTimestamp()
                    ]
                });
            }

            if (subcommand === 'match') {
                await interaction.deferReply();

                const fixtureId =
                    interaction.options.getInteger('fixture_id');

                const [fixture, statistics] = await Promise.all([
                    getFixture(fixtureId),
                    footballRequest('fixtures/statistics', {
                        fixture: fixtureId
                    })
                ]);

                if (!fixture) {
                    return interaction.editReply({
                        content:
                            'That World Cup fixture could not be found.'
                    });
                }

                const fields = statistics
                    .map(teamStats => {
                        const wantedStats = [
                            'Ball Possession',
                            'Total Shots',
                            'Shots on Goal',
                            'Corner Kicks',
                            'Fouls',
                            'Yellow Cards',
                            'Red Cards',
                            'expected_goals'
                        ];

                        const text = teamStats.statistics
                            .filter(stat =>
                                wantedStats.includes(stat.type)
                            )
                            .map(
                                stat =>
                                    `**${stat.type}:** ${
                                        stat.value ?? 'N/A'
                                    }`
                            )
                            .join('\n');

                        return {
                            name: teamStats.team.name,
                            value:
                                text ||
                                'Statistics are not available yet.',
                            inline: true
                        };
                    })
                    .slice(0, 2);

                const embed = new EmbedBuilder()
                    .setColor(0x8B5CF6)
                    .setTitle(
                        `${fixture.teams.home.name} vs ${fixture.teams.away.name}`
                    )
                    .setThumbnail(fixture.league.logo)
                    .setDescription(
                        [
                            `**Score:** ${fixture.goals.home ?? 0}–${fixture.goals.away ?? 0}`,
                            `**Round:** ${fixture.league.round || 'Unknown'}`,
                            `**Status:** ${fixture.fixture.status.long}`,
                            `**Kickoff:** ${getDiscordTimestamp(
                                fixture.fixture.date,
                                'F'
                            )}`,
                            `**Venue:** ${
                                fixture.fixture.venue?.name ||
                                'Not announced'
                            }`
                        ].join('\n')
                    )
                    .addFields(fields)
                    .setFooter({
                        text: `Fixture ID: ${fixtureId}`
                    })
                    .setTimestamp();

                return interaction.editReply({
                    embeds: [embed]
                });
            }

            if (subcommand === 'player') {
                await interaction.deferReply();

                const playerName =
                    interaction.options.getString('name');

                const players = await footballRequest('players', {
                    search: playerName,
                    league: WORLD_CUP_LEAGUE_ID,
                    season: WORLD_CUP_SEASON
                });

                if (players.length === 0) {
                    return interaction.editReply({
                        content: `No World Cup statistics were found for **${playerName}**.`
                    });
                }

                const result = players[0];
                const player = result.player;
                const stats = result.statistics?.[0];

                const games = stats?.games || {};
                const goals = stats?.goals || {};
                const passes = stats?.passes || {};
                const cards = stats?.cards || {};
                const shots = stats?.shots || {};

                const embed = new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setTitle(`⭐ ${player.name}`)
                    .setThumbnail(player.photo)
                    .setDescription(
                        [
                            `**Country:** ${player.nationality || 'Unknown'}`,
                            `**Age:** ${player.age || 'Unknown'}`,
                            `**Team:** ${stats?.team?.name || 'Unknown'}`,
                            `**Position:** ${games.position || 'Unknown'}`
                        ].join('\n')
                    )
                    .addFields(
                        {
                            name: 'Appearances',
                            value: String(
                                games.appearences ?? 0
                            ),
                            inline: true
                        },
                        {
                            name: 'Minutes',
                            value: String(games.minutes ?? 0),
                            inline: true
                        },
                        {
                            name: 'Rating',
                            value: String(
                                games.rating
                                    ? Number(
                                          games.rating
                                      ).toFixed(2)
                                    : 'N/A'
                            ),
                            inline: true
                        },
                        {
                            name: 'Goals',
                            value: String(goals.total ?? 0),
                            inline: true
                        },
                        {
                            name: 'Assists',
                            value: String(goals.assists ?? 0),
                            inline: true
                        },
                        {
                            name: 'Shots on Target',
                            value: String(shots.on ?? 0),
                            inline: true
                        },
                        {
                            name: 'Key Passes',
                            value: String(passes.key ?? 0),
                            inline: true
                        },
                        {
                            name: 'Yellow Cards',
                            value: String(cards.yellow ?? 0),
                            inline: true
                        },
                        {
                            name: 'Red Cards',
                            value: String(cards.red ?? 0),
                            inline: true
                        }
                    )
                    .setFooter({
                        text: 'World Cup 2026 player statistics'
                    })
                    .setTimestamp();

                return interaction.editReply({
                    embeds: [embed]
                });
            }

            if (subcommand === 'bet') {
                await interaction.deferReply({
                    ephemeral: true
                });

                const fixtureId =
                    interaction.options.getInteger('fixture_id');

                const prediction =
                    interaction.options.getString('prediction');

                const amountWL =
                    interaction.options.getInteger('amount');

                if (amountWL > MAX_BET_WL) {
                    return interaction.editReply({
                        content:
                            'The maximum World Cup bet is **10,000 WL / 100 DL**.'
                    });
                }

                const fixture = await getFixture(fixtureId);

                if (!fixture) {
                    return interaction.editReply({
                        content:
                            'That fixture ID could not be found.'
                    });
                }

                if (
                    Number(fixture.league.id) !==
                        WORLD_CUP_LEAGUE_ID ||
                    Number(fixture.league.season) !==
                        WORLD_CUP_SEASON
                ) {
                    return interaction.editReply({
                        content:
                            'You can only bet on World Cup 2026 fixtures.'
                    });
                }

                const kickoffTime = new Date(
                    fixture.fixture.date
                ).getTime();

                const betClosingTime =
                    kickoffTime -
                    BET_CLOSE_BEFORE_KICKOFF_MS;

                if (Date.now() >= betClosingTime) {
                    return interaction.editReply({
                        content:
                            'Betting for this match is already closed. Bets close five minutes before kickoff.'
                    });
                }

                const status = normalizeStatus(
                    fixture.fixture.status.short
                );

                if (!['NS', 'TBD'].includes(status)) {
                    return interaction.editReply({
                        content:
                            'This match has already started or is no longer available for betting.'
                    });
                }

                const data = readJson(BETS_FILE, {
                    bets: [],
                    leaderboard: {}
                });

                const existingBet = data.bets.find(
                    bet =>
                        bet.userId === interaction.user.id &&
                        bet.fixtureId === fixtureId &&
                        bet.status === 'OPEN'
                );

                if (existingBet) {
                    return interaction.editReply({
                        content:
                            'You already have an active bet on this match.'
                    });
                }

                if (
                    prediction === 'DRAW' &&
                    String(fixture.league.round || '')
                        .toLowerCase()
                        .includes('final')
                ) {
                    return interaction.editReply({
                        content:
                            'Draw betting is disabled for knockout finals because the match must produce a winner.'
                    });
                }

                const balance = getTotalWL(
                    interaction.user.id
                );

                if (balance < amountWL) {
                    return interaction.editReply({
                        content: `You only have **${formatLocks(
                            balance
                        )}**.`
                    });
                }

                const removed = removeWL(
                    interaction.user.id,
                    amountWL
                );

                if (!removed) {
                    return interaction.editReply({
                        content:
                            'Your balance changed before the bet was placed. Please try again.'
                    });
                }

                const multiplier =
                    getPayoutMultiplier(prediction);

                const bet = {
                    id: `${interaction.user.id}-${fixtureId}-${Date.now()}`,
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    channelId: interaction.channelId,

                    fixtureId,

                    homeTeam: fixture.teams.home.name,
                    awayTeam: fixture.teams.away.name,

                    prediction,
                    predictionName: getPredictionName(
                        prediction,
                        fixture
                    ),

                    amountWL,
                    multiplier,

                    possiblePayoutWL: Math.floor(
                        amountWL * multiplier
                    ),

                    kickoff: fixture.fixture.date,

                    status: 'OPEN',
                    createdAt: new Date().toISOString()
                };

                data.bets.push(bet);
                writeJson(BETS_FILE, data);

                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x57F287)
                            .setTitle(
                                '✅ World Cup Bet Confirmed'
                            )
                            .setDescription(
                                [
                                    `**Match:** ${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
                                    `**Prediction:** ${bet.predictionName}`,
                                    `**Bet:** ${formatLocks(amountWL)}`,
                                    `**Multiplier:** ${multiplier}x`,
                                    `**Possible payout:** ${formatLocks(
                                        bet.possiblePayoutWL
                                    )}`,
                                    `**Kickoff:** ${getDiscordTimestamp(
                                        fixture.fixture.date,
                                        'F'
                                    )}`,
                                    '',
                                    `Remaining balance: **${formatLocks(
                                        getTotalWL(
                                            interaction.user.id
                                        )
                                    )}**`
                                ].join('\n')
                            )
                            .setFooter({
                                text:
                                    'Virtual server currency only • Results are settled using API-Football'
                            })
                            .setTimestamp()
                    ]
                });
            }

            if (subcommand === 'mybets') {
                const data = readJson(BETS_FILE, {
                    bets: [],
                    leaderboard: {}
                });

                const userBets = data.bets
                    .filter(
                        bet =>
                            bet.userId ===
                            interaction.user.id
                    )
                    .sort(
                        (a, b) =>
                            new Date(b.createdAt) -
                            new Date(a.createdAt)
                    )
                    .slice(0, 10);

                if (userBets.length === 0) {
                    return interaction.reply({
                        content:
                            'You have not placed any World Cup bets yet.',
                        ephemeral: true
                    });
                }

                const description = userBets
                    .map(bet => {
                        const statusEmoji = {
                            OPEN: '🕒',
                            WON: '✅',
                            LOST: '❌',
                            REFUNDED: '↩️'
                        }[bet.status];

                        return [
                            `### ${statusEmoji || '🎟️'} ${bet.homeTeam} vs ${bet.awayTeam}`,
                            `Prediction: **${bet.predictionName}**`,
                            `Bet: **${formatLocks(bet.amountWL)}**`,
                            `Status: **${bet.status}**`,
                            bet.status === 'WON'
                                ? `Payout: **${formatLocks(
                                      bet.payoutWL
                                  )}**`
                                : null,
                            `Fixture ID: \`${bet.fixtureId}\``
                        ]
                            .filter(Boolean)
                            .join('\n');
                    })
                    .join('\n\n');

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x8B5CF6)
                            .setTitle(
                                `⚽ ${interaction.user.username}'s World Cup Bets`
                            )
                            .setDescription(description)
                            .setTimestamp()
                    ],
                    ephemeral: true
                });
            }

            if (subcommand === 'leaderboard') {
                await interaction.deferReply();

                const image =
                    await createLeaderboardCanvas(client);

                const attachment = new AttachmentBuilder(
                    image,
                    {
                        name: 'worldcup-leaderboard.png'
                    }
                );

                return interaction.editReply({
                    files: [attachment]
                });
            }

            if (subcommand === 'settle') {
                if (
                    !interaction.member.permissions.has(
                        PermissionFlagsBits.ManageGuild
                    )
                ) {
                    return interaction.reply({
                        content:
                            'You need the **Manage Server** permission to manually settle bets.',
                        ephemeral: true
                    });
                }

                await interaction.deferReply({
                    ephemeral: true
                });

                const result =
                    await settleWorldCupBets(client);

                return interaction.editReply({
                    content: `Checked **${result.checked}** open bets and settled **${result.settled}** bets.`
                });
            }
        } catch (error) {
            console.error('World Cup command error:', error);

            const message =
                error.response?.status === 429
                    ? 'The football API request limit has been reached. Please try again later.'
                    : `World Cup command error: ${error.message}`;

            if (
                interaction.deferred ||
                interaction.replied
            ) {
                return interaction.editReply({
                    content: message,
                    embeds: [],
                    files: []
                });
            }

            return interaction.reply({
                content: message,
                ephemeral: true
            });
        }
    },

    settleWorldCupBets
};