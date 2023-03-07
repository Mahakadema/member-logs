
import { Client, IntentsBitField, Partials, EmbedBuilder } from "discord.js";
import { readFileSync } from "fs";

const DISCORD_EPOCH = 1420070400000;
const logger = {
    info: (...msgs) => console.log(new Date().toISOString().replace(/[TZ]/g, " ").trimEnd(), ...msgs),
    error: (...msgs) => console.log(new Date().toISOString().replace(/[TZ]/g, " ").trimEnd(), ...msgs)
}

logger.info("Loading config");
const config = {};
const validSettings = {
    token: {
        name: "token",
        validator: _ => true,
        transformer: v => v
    },
    channel_ID: {
        name: "channelId",
        validator: v => /^[0-9]+$/.test(v),
        transformer: v => v
    }
};
const lines = readFileSync("./config.conf", "utf-8").split("\n").map(v => v.trim()).filter(v => v);
for (const l of lines) {
    if (!/^[a-zA-Z0-9_]+=.+$/.test(l))
        throw new Error(`Config line '${l}' is not a valid config line`);
    const key = l.split("=")[0].trim();
    const value = l.split("=").slice(1).join("=").trim();
    if (!validSettings.hasOwnProperty(key))
        throw new Error(`Unknown config option: ${key}`);
    if (!validSettings[key].validator(value))
        throw new Error(`Invalid value for config option ${key}: ${value}`);
    config[validSettings[key].name] = validSettings[key].transformer(value);
}

logger.info("Initializing client");
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers
    ],
    partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.GuildScheduledEvent,
        Partials.Message,
        Partials.Reaction,
        Partials.ThreadMember,
        Partials.User
    ]
});

client.on("ready", async client => {
    logger.info(`Logged in as ${client.user.tag}`);
    if (client.guilds.cache.size > 1)
        throw new Error("The bot cannot be in more than 1 guild");
    await fetchMembers();
    setInterval(() => fetchMembers().catch(e => logger.error("Failed to fetch members:", e)), 86_400_000);
});

client.on("guildMemberAdd", member => {
    logger.info(`Member ${member.user?.tag || member.id} has joined`);
    sendMessage("JOIN", member);
});

client.on("guildMemberRemove", member => {
    logger.info(`Member ${member.user?.tag || member.id} has left`);
    sendMessage("LEAVE", member);
});

await client.login(config.token);

async function fetchMembers() {
    const preFetchSize = client.users.cache.size;
    await client.guilds.cache.first().members.fetch();
    logger.info(`Fetched ${client.users.cache.size - preFetchSize} users`);
}

async function sendMessage(type, member) {
    try {
        const channel = client.channels.cache.get(config.channelId);
        const embed = type === "JOIN" ? joinMessage(member) : leaveMessage(member);
        for (let i = 0; i < 5; i++) {
            try {
                await channel.send({
                    content: "",
                    embeds: [embed]
                });
                break;
            } catch (e) {
                logger.error(`Failed to send message to ${config.channelId}:`, e);
            }
        }
    } catch (e) {
        logger.error("Couldn't handle event:", e);
    }
}

/**
 * @param {import("discord.js").GuildMember} member 
 */
function joinMessage(member) {
    const createTs = Number(member.id) / (1 << 22) + DISCORD_EPOCH;
    const embed = new EmbedBuilder()
        .setTitle("Member Join")
        .setColor("#07b00a")
        .setDescription(
            `<@${member.id}> ${member.user?.tag || "Unknown User"}\n` +
            `ID: ${member.id}`
        )
        .addFields({
            name: "Account Age",
            value: formatDuration(Date.now() - createTs, 2),
            inline: false
        })
        .setTimestamp(member.joinedTimestamp || Date.now());
    if (member.user?.avatarURL)
        embed.setThumbnail(member.user.avatarURL());
    return embed;
}

/**
 * @param {import("discord.js").GuildMember} member 
 */
function leaveMessage(member) {
    const embed = new EmbedBuilder()
        .setTitle("Member Leave")
        .setColor("#7a0505")
        .setDescription(
            `<@${member.id}> ${member.user?.tag || "Unknown User"}\n` +
            (member.nickname ? `Nick: ${member.nickname}\n` : "") +
            `ID: ${member.id}`
        )
        .setTimestamp(Date.now());
    if (member.joinedTimestamp)
        embed.addFields({
            name: "Joined This Server",
            value: `${formatDuration(Date.now() - member.joinedTimestamp, 2)} ago`,
            inline: false
        });
    if (member.roles?.cache) {
        const roles = member.roles.cache.filter(v => v.id !== member.guild?.id).map(v => v.toString());
        let rolesString = roles.join(" ");
        if (rolesString.length >= 1024) {
            rolesString = roles[0];
            for (let i = 1; i < roles.length; i++) {
                const endString = `and ${roles.length - i} more...`;
                if (`${rolesString} ${roles[i]} ${endString}`.length >= 1024) {
                    rolesString += " " + endString;
                    break;
                }
                rolesString += " " + roles[i];
            }
        }
        embed.addFields({
            name: "Roles",
            value: rolesString || "No Roles",
            inline: false
        });
    }
    if (member.user?.avatarURL)
        embed.setThumbnail(member.user.avatarURL());
    return embed;
}

/**
 * Returns a String Containing the Years, Days, Hours, Minutes and Seconds in human-readable format
 * @param {Number} ms
 * @param {number?} precision How many terms to return, setting to 0 will return all terms
 * @param {boolean?} useShortNames Whether to use short names
 */
function formatDuration(ms, precision = 0, useShortNames = false) {
    if (ms < 1000) {
        return ms >= 0 ? "0 " + (useShortNames ? "S" : "Seconds") : "Invalid Duration";
    }
    const periods = [
        {
            multiplier: Number.MAX_SAFE_INTEGER
        },
        {
            typeSingular: "Year",
            typePlural: "Years",
            typeShort: "Y",
            multiplier: 31536000000
        },
        {
            typeSingular: "Day",
            typePlural: "Days",
            typeShort: "D",
            multiplier: 86400000
        },
        {
            typeSingular: "Hour",
            typePlural: "Hours",
            typeShort: "H",
            multiplier: 3600000
        },
        {
            typeSingular: "Minute",
            typePlural: "Minutes",
            typeShort: "M",
            multiplier: 60000
        },
        {
            typeSingular: "Second",
            typePlural: "Seconds",
            typeShort: "S",
            multiplier: 1000
        }
    ];
    const strings = [];
    for (let i = 1; i < periods.length && (!precision || strings.length < precision); i++) {
        const val = Math.floor((ms % periods[i - 1].multiplier) / periods[i].multiplier);
        if (val > 0)
            strings.push(`${val} ${useShortNames ? periods[i].typeShort : val === 1 ? periods[i].typeSingular : periods[i].typePlural}`);
    }
    return useShortNames || strings.length < 2 ? strings.join(", ") : strings.slice(0, -1).join(", ") + " and " + strings.at(-1);
}
