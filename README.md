# Wheatherly

**Wheatherly** — веб-приложение для поиска и просмотра прогноза погоды в любом городе мира.

---

## 🛠️ Использованные технологии

* **Backend:** [FastAPI](https://fastapi.tiangolo.com/), [asyncpg](https://github.com/MagicStack/asyncpg), PostgreSQL
* **Frontend:** чистый HTML + CSS + Vanilla JS
* **Погода:** [Open-Meteo API](https://open-meteo.com/)
* **Хранение истории и статистика:** PostgreSQL (через asyncpg)
* **Docker:** быстрая сборка и запуск любого окружения

---

## ⚡ Быстрый старт

* Откройте сайт: [wheatherly-rho.vercel.app](https://wheatherly-rho.vercel.app)

---

## 📝 Что реализовано

* [x] Удобный и читаемый вывод прогноза погоды
* [x] Использование Open-Meteo API
* [x] Backend на FastAPI (Python 3.11), размещён на Render
* [x] Docker-контейнер для backend
* [x] Автодополнение при вводе города
* [x] История поиска для каждого пользователя (cookie + uuid)
* [x] API для получения статистики по городам
* [x] Простая инструкция по запуску
* [ ] Тесты для backend (не успел добавить)

---

## ℹ️ Как это работает

* **Backend** и бизнес-логика реализованы на FastAPI, сервер размещён на Render.
* **PostgreSQL** — для хранения истории поиска и статистики (также на Render).
* **Куки и UUID** — используются для идентификации пользователя без регистрации.
* **Фронтенд** — чистый JS и CSS, размещён на Vercel.
* **Автодополнение** реализовано через публичный Geocoding API Open-Meteo.
* Проект полностью готов к запуску в Docker (локально или в облаке).

