import dotenv from "dotenv";
import { Telegraf } from "telegraf";
import OpenAI from "openai";

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Функція для отримання погоди
const getWeather = async (city) => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        city
    )}&appid=${apiKey}&units=metric&lang=ua`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Не вдалося отримати дані про погоду");
    }

    const data = await response.json();

    return `🌤 Погода у місті ${data.name}, ${data.sys.country}:
Температура: ${data.main.temp}°C
Відчувається як: ${data.main.feels_like}°C
Погода: ${data.weather[0].description}
Вологість: ${data.main.humidity}%
Вітер: ${data.wind.speed} м/с`;
};

bot.start((ctx) => {
    ctx.reply("Привіт! Напиши назву міста, щоб дізнатися погоду, або запитай мене щось інше.");
});

bot.on("text", async (ctx) => {
    const userText = ctx.message.text;

    if (/погода|weather/i.test(userText)) {
        ctx.reply("🌍 Напиши назву міста, щоб дізнатися погоду (наприклад: `Львів`).");
        return;
    }

    try {
        const weather = await getWeather(userText);
        ctx.reply(weather);
    } catch (err) {
        console.log("Не вдалося знайти місто, пробуємо GPT...");

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: userText }],
            });

            const reply = completion.choices[0].message.content;
            ctx.reply(reply);
        } catch (error) {
            console.error("Помилка GPT:", error);
            ctx.reply("Вибач, сталася помилка. Спробуй пізніше.");
        }
    }
});

bot.launch();
console.log("🤖 Бот запущено...");