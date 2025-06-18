import dotenv from "dotenv";
import { Telegraf } from "telegraf";
import OpenAI from "openai";

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

bot.start((ctx) => {
    ctx.reply("Привіт! Напиши мені щось, і я відповім за допомогою GPT.");
});

bot.on("text", async (ctx) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: ctx.message.text }],
        });

        const reply = completion.choices[0].message.content;
        ctx.reply(reply);

    } catch (error) {
        console.error("Помилка API:", error);

        if (error.code === "insufficient_quota" || error.status === 429) {
            ctx.reply(
                "Вибач, наразі вичерпано ліміт запитів до сервісу. Спробуй, будь ласка, пізніше або звернись до адміністратора."
            );
        } else {
            ctx.reply("Вибач, сталася невідома помилка. Спробуй ще раз пізніше.");
        }
    }
});

bot.launch();
console.log("🤖 Бот запущено...");