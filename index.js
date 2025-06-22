import dotenv from "dotenv";
import { Telegraf, Markup, session } from "telegraf";
import OpenAI from "openai";
import { getHourlyWeather, getTodayWeather, getFiveDayWeather } from "./weatherService.js";

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
bot.use(session());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Стартове меню
bot.start((ctx) => {
    ctx.session = {};
    ctx.reply(
        'Привіт! Я бот "Метеорологічна станція", який допоможе тобі дізнатись актуальну погоду. Обери, що тебе цікавить.',
        Markup.keyboard([
            ["🌦 Погода", "🧠 Запитання до GPT"],
        ])
            .resize()
            .oneTime()
    );
});

// Обробка вибору "Погода" або "GPT"
bot.hears("🌦 Погода", (ctx) => {
    ctx.session.awaitingCity = false;
    ctx.reply(
        "Окей! Обери вид прогнозу.",
        Markup.keyboard([
            ["Погода сьогодні"],
            ["Прогноз на 5 днів"],
            ["Поквартальний прогноз (3 години)"],
        ])
            .resize()
            .oneTime()
    );
});

bot.hears("🧠 Запитання до GPT", (ctx) => {
    ctx.session.awaitingGptQuestion = true;
    ctx.reply("Напиши своє запитання до ШІ.");
});

// Обробка тексту — вважаємо, що це назва міста
bot.on("text", async (ctx) => {
    const userText = ctx.message.text.trim();

    // Якщо користувач хоче задати питання GPT
    if (ctx.session.awaitingGptQuestion) {
        ctx.session.awaitingGptQuestion = false;

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: userText }],
            });

            const gptReply = completion.choices[0].message.content;
            ctx.reply(`🧠 GPT відповідає:\n\n${gptReply}`);
        } catch (err) {
            console.error("❌ GPT-помилка:", err);
            ctx.reply("Вибач, сталася помилка. Спробуй пізніше.");
        }

        return;
    }

    // Якщо очікуємо назву міста після вибору прогнозу
    if (ctx.session.forecastType) {
        if (["Погода сьогодні", "Прогноз на 5 днів", "Поквартальний прогноз (3 години)"].includes(userText)) {
            return;
        }

        try {
            let reply = "";

            switch (ctx.session.forecastType) {
                case "Погода сьогодні":
                    reply = await getTodayWeather(userText);
                    break;
                case "Прогноз на 5 днів":
                    reply = await getFiveDayWeather(userText);
                    break;
                case "Поквартальний прогноз (3 години)":
                    reply = await getHourlyWeather(userText);
                    break;
            }

            ctx.session.weatherInfo = reply;

            await ctx.reply(reply, Markup.inlineKeyboard([
                Markup.button.callback("🤖 Отримати пораду від ШІ", "GET_ADVICE")
            ]));

            ctx.session.forecastType = null;

            ctx.reply("Що хочеш зробити далі?", Markup.keyboard([
                ["🌦 Погода", "🧠 Запитання до GPT"],
            ]).resize());
        } catch (err) {
            console.warn("⚠️ Помилка:", err.message);
            if (
                err.message.includes("city not found") ||
                err.message.includes("Nothing to geocode")
            ) {
                ctx.reply(`⚠️ Не вдалося знайти місто "${userText}". Перевір, будь ласка, назву.`);
                return;
            }

            if (err.message.includes("Invalid API key")) {
                ctx.reply("❗️ API ключ до OpenWeatherMap недійсний або відсутній.");
                return;
            }

            ctx.reply("Сталася помилка. Спробуй ще раз пізніше.");
        }

        return;
    }

    // Якщо користувач вибрав тип прогнозу — просимо ввести місто
    if (["Погода сьогодні", "Прогноз на 5 днів", "Поквартальний прогноз (3 години)"].includes(userText)) {
        ctx.session.forecastType = userText;
        ctx.reply("Напиши, будь ласка, назву міста.");
        return;
    }

    // Невідоме повідомлення
    ctx.reply("Вибери опцію з меню або скористайся кнопками.");
});

// Обробка поради від AI
bot.action("GET_ADVICE", async (ctx) => {
    await ctx.answerCbQuery();

    if (!ctx.session.weatherInfo) {
        ctx.reply("На жаль, не можу дати пораду — спочатку запитай прогноз погоди.");
        return;
    }

    const prompt = `Дай корисну пораду людині на основі цього прогнозу погоди українською мовою:\n\n${ctx.session.weatherInfo}`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });

        const advice = completion.choices[0].message.content;
        ctx.reply(`💡 Порада:\n\n${advice}`);
    } catch (err) {
        console.error("❌ GPT-помилка:", err);
        ctx.reply("Вибач, сталася помилка при отриманні поради. Спробуй пізніше.");
    }
});

bot.launch();
console.log("🤖 Бот запущено...");