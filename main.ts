import { startBot, Intents, createBot, sendMessage, Embed, editBotStatus } from "@discordeno/mod.ts";
import { ApplicationCommandOptionTypes } from "@discordeno/types/mod.ts";
import * as csv from "https://deno.land/std@0.170.0/encoding/csv.ts";
import "$std/dotenv/load.ts";

const TOKEN = Deno.env.get("TOKEN");
const GUILD_ID = Deno.env.get("GUILD_ID");

const bot = createBot({
    token: TOKEN,
    intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent | Intents.GuildMembers,
    events: {
        ready: async (bot, payload) => {
            console.log(`✅ ${payload.user.username} is online!`);

            const kv = await Deno.openKv();
            const preDeployId = (await kv.get(["deploy", "id"])).value;
            const currDeployId = Deno.env.get("DENO_DEPLOYMENT_ID");

            const channels = await bot.helpers.getChannels(GUILD_ID);
            const notifyChannel = channels.find(c => c.name === "通知");

            if (preDeployId !== currDeployId) {
                console.log("🔎 Deploy ID has been changed. Sending event notification...");
                let tmp = await loadEventData();
                const description = tmp.map(event => formatEventSummary(event)).join("\n\n");
                await sendMessage(bot, notifyChannel.id, { 
                    embeds: [{
                        title: "イベント情報更新",
                        description: description,
                        color: 0xEE7800,
                    }],
                });
                await kv.set(["deploy", "id"], currDeployId);
            } 

            editBotStatus(bot, {
                status: "online",
                activities: [{ name: "αテスト", type: 1 }],
            });

            await registerSlashCommands(bot);
        },
        interactionCreate: async (bot, interaction) => {
            if (!interaction.data) return;
            const [subCommand, subsubCommand] = interaction.data.options?.[0]?.options
                ? [interaction.data.options[0].name, interaction.data.options[0].options[0].name]
                : [interaction.data.options?.[0]?.name, ""];
            
            const commandHandlers = {
                "イベント": handleEventCommand,
                "ヘルプ": handleHelpCommand,
            };
            
            await (commandHandlers[interaction.data.name] || (() => {}))(interaction, subCommand, subsubCommand);
        },
    },
});

const registerSlashCommands = async (bot) => {
    const eventOptions = ["すべて", "開催中", "開催予定"].map((category) => ({
        name: category,
        description: `${category}のイベントを表示`,
        type: ApplicationCommandOptionTypes.SubCommandGroup,
        options: ["詳細", "まとめ"].map((type) => ({
            name: type,
            description: `${category}のイベントを${type}表示`,
            type: ApplicationCommandOptionTypes.SubCommand,
        })),
    }));
    
    await bot.helpers.upsertGuildApplicationCommands(GUILD_ID, [
        { name: "イベント", description: "イベント情報を表示します", options: eventOptions },
        { name: "ヘルプ", description: "利用可能なコマンドを表示" },
    ]);
};

const loadEventData = async () => {
    const filePath = "event_info.csv";
    const fileContent = await Deno.readTextFile(filePath);
    return await csv.parse(fileContent, {
        skipFirstRow: true,
        columns: ["イベント名", "開催期間", "画像URL", "詳細URL"],
    });
};

const getEmoji = (eventName = "") => {
    const emojiMap = {
        "公開オーディション": "<:zzz_EncryptedMasterTape:1343604018102013992>",
        "棚から「ンナンナ」": "<:zzz_BangbooTicket:1343604031573987471>",
        "データ懸賞-模擬実戦": "<:zzz_HAICulb:1343603960971395182>",
        "先遣賞金-定期掃討": "<:zzz_ScottOutpost:1343603973374083132>",
        "gamewith": "<:gamewith_logo:1343604111228272672>",
    };

    for (const key in emojiMap) {
        if (eventName.includes(key)) {
            return emojiMap[key];
        }
    }

    const eousEmojis = ["<:zzz_Eous_1:1343604058539429892>", "<:zzz_Eous_2:1343604074397831230>", "<:zzz_Eous_3:1343604086431289487>"];
    const randomEmoji = eousEmojis[Math.floor(Math.random() * eousEmojis.length)];
    return randomEmoji;
};

const handleEventCommand = async (interaction, category, type) => {
    let events = await loadEventData();
    if (category === "開催中") events = events.filter(e => !e["イベント名"].includes('【予定】'));
    if (category === "開催予定") events = events.filter(e => e["イベント名"].includes('【予定】'));
    
    if (type === "詳細") {
        await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
            type: 4,
            data: { content: "イベント情報を取得中です..." },
        });
        for (const event of events) {
            await sendMessage(bot, interaction.channelId, { embeds: [createEventEmbed(event)] });
        }
    } else {
        const description = events.map(event => formatEventSummary(event)).join("\n\n");
        await sendInteractionResponse(interaction, `**${category}のイベント情報**`, description, category === "開催予定" ? 0x777777 : 0xEE7800);
    }
};

const createEventEmbed = (event) => ({
    title: `${getEmoji(event["イベント名"])}${event["イベント名"]}${getEmoji(event["イベント名"])} `,
    description: `🗓️ **期間**: __\`${event["開催期間"]}\`__\n${event["詳細URL"] ? `${getEmoji("gamewith")} **詳細**: [gamewith](${event["詳細URL"]})` : ''}`,
    color: event["イベント名"].includes('【予定】') ? 0x777777 : 0xEE7800,
    image: event["画像URL"] ? { url: event["画像URL"] } : undefined,
});

const formatEventSummary = (event) => `**${getEmoji(event["イベント名"])}${event["イベント名"]}${getEmoji(event["イベント名"])}**\n🗓️ **期間**: __\`${event["開催期間"]}\`__\n${event["詳細URL"] ? `${getEmoji("gamewith")} **詳細**: [gamewith](${event["詳細URL"]})` : ''}`;
const sendInteractionResponse = async (interaction, title, description, color) => {
    const embed = { title, description, color };
    await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, { type: 4, data: { embeds: [embed] } });
};

const handleHelpCommand = async (interaction) => {
    const helpMessage = 
    `**利用可能なコマンド一覧**\n- \`/イベント 開催予定\`: 開催予定のイベント情報を表示します。\n- \`/イベント 開催中\`: 開催中のイベント情報を表示します。\n- \`/イベント すべて\`: すべてのイベント情報を表示します。\n- \`/イベント 詳細\`: 詳細なイベント情報を表示します。\n- \`/イベント まとめ\`: まとめたイベント情報を表示します。\n- \`/ヘルプ\`: このヘルプメッセージを表示します。`;
    await sendInteractionResponse(interaction, "ヘルプ", helpMessage, 0x5865F2);
};

// ボットの常時起動
Deno.cron("Continuous Request", "*/2 * * * *", () => {
    console.log("🔄 Bot is active!");
});

// ボットを起動
try {
    await startBot(bot);
} catch (error) {
    console.error("❌ Bot startup error!:", error);
}