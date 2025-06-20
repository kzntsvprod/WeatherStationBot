import dotenv from 'dotenv';

dotenv.config();

// Погода сьогодні (поточна)
export const getTodayWeather = async (city) => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        city
    )}&appid=${apiKey}&units=metric&lang=ua`;

    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Помилка при запиті погоди");
    }
    const data = await response.json();

    return `🌤 Погода сьогодні у місті ${data.name}, ${data.sys.country}:
    
Температура: ${data.main.temp}°C
Відчувається як: ${data.main.feels_like}°C
Погода: ${data.weather[0].description}
Вологість: ${data.main.humidity}%
Вітер: ${data.wind.speed} м/с`;
};

// 5-денний прогноз (включаючи сьогодні)
export const getFiveDayWeather = async (city) => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
        city
    )}&appid=${apiKey}&units=metric&lang=ua`;

    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Помилка при запиті прогнозу");
    }

    const data = await response.json();

    // Групування по датах
    const daysMap = {};
    data.list.forEach(item => {
        const date = new Date(item.dt * 1000).toLocaleDateString("uk-UA");
        if (!daysMap[date]) daysMap[date] = [];
        daysMap[date].push(item);
    });

    // Отримати відсортовані дати
    const sortedDays = Object.entries(daysMap).sort((a, b) =>
        new Date(a[0]) - new Date(b[0])
    );

    // Завжди беремо перший день (навіть якщо записів < 8)
    const resultDays = [sortedDays[0]];

    // Потім додаємо ще 5 повних днів (8 записів)
    for (let i = 1; i < sortedDays.length && resultDays.length < 6; i++) {
        const [_, items] = sortedDays[i];
        if (items.length === 8) {
            resultDays.push(sortedDays[i]);
        }
    }

    let reply = `📅 Прогноз погоди для ${data.city.name}:\n\n`;

    for (const [date, items] of resultDays) {
        const temps = items.map(i => i.main.temp);
        const humidities = items.map(i => i.main.humidity);
        const weatherDescriptions = items.map(i => i.weather[0].description);

        const minTemp = Math.min(...temps).toFixed(1);
        const maxTemp = Math.max(...temps).toFixed(1);
        const avgHumidity = Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length);

        const freqDesc = weatherDescriptions.sort((a, b) =>
            weatherDescriptions.filter(v => v === a).length - weatherDescriptions.filter(v => v === b).length
        ).pop();

        const incompleteNote = items.length < 8 ? " (неповний день)" : "";

        reply += `${date}: ${freqDesc}, температура від ${minTemp}°C до ${maxTemp}°C, вологість: ${avgHumidity}%${incompleteNote}\n`;
    }

    return reply;
};

// Поквартальний прогноз (3 години)
export const getHourlyWeather = async (city) => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
        city
    )}&appid=${apiKey}&units=metric&lang=ua`;

    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Помилка при запиті прогнозу");
    }

    const data = await response.json();

    let reply = `🕒 Поквартальний прогноз (3 години) для ${data.city.name}:\n\n`;

    // Перші 8 записів = 24 години (3 години крок)
    data.list.slice(0, 8).forEach((item) => {
        const time = new Date(item.dt * 1000).toLocaleTimeString("uk-UA", {
            hour: "2-digit",
            minute: "2-digit",
        });
        reply += `${time}: ${item.weather[0].description}, темп: ${item.main.temp}°C\n`;
    });

    return reply;
};