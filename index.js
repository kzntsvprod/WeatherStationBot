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

// Старт з меню вибору виду прогнозу
bot.start((ctx) => {
    ctx.session = {};
    ctx.reply(
        'Привіт! Я бот "Метеорологічна станція", який допоможе тобі дізнатись актуальну погоду. Обери вид прогнозу.',
        Markup.keyboard([
            ["Погода сьогодні"],
            ["Прогноз на 5 днів"],
            ["Поквартальний прогноз (3 години)"],
        ])
            .resize()
            .oneTime()
    );
});

// Обробка вибору виду прогнозу
bot.hears(["Погода сьогодні", "Прогноз на 5 днів", "Поквартальний прогноз (3 години)"], (ctx) => {
    ctx.session.forecastType = ctx.message.text;
    ctx.reply("Напиши, будь ласка, назву міста");
});

// Обробка тексту — вважаємо, що це назва міста
bot.on("text", async (ctx) => {
    const userText = ctx.message.text.trim();

    if (!ctx.session.forecastType) {
        ctx.reply("Будь ласка, спочатку обери вид прогнозу, натиснувши на кнопку.");
        return;
    }

    // Якщо користувач випадково повторно натиснув кнопку, не обробляємо
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
            default:
                reply = "Невідомий тип прогнозу.";
        }

        ctx.reply(reply);

        // Скидаємо вибір виду прогнозу, щоб можна було обрати знову
        ctx.session.forecastType = null;

        ctx.reply(
            "Що хочеш дізнатись ще?",
            Markup.keyboard([
                ["Погода сьогодні"],
                ["Прогноз на 5 днів"],
                ["Поквартальний прогноз (3 години)"],
            ])
                .resize()
                .oneTime()
        );

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

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: userText }],
            });

            const gptReply = completion.choices[0].message.content;
            ctx.reply(gptReply);
        } catch (error) {
            console.error("❌ Помилка GPT:", error);
            ctx.reply("Вибач, сталася помилка. Спробуй пізніше.");
        }
    }
});

bot.launch();
console.log("🤖 Бот запущено...");