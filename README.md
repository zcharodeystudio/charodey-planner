# Charodey Planner

Планировщик задач. Технически устроен как mealvoyage: монорепозиторий, мобильный клиент на Expo и API на NestJS + MongoDB, которое можно выложить на Render.

- `frontend/` — приложение на **Expo (SDK 56) / React Native / expo-router**.
- `backend/` — API на **NestJS + MongoDB**. Swagger в режиме разработки: `http://localhost:3000/api`.
- `packages/validation/` — общие правила полей (`@charodey/validation`) для клиента и сервера.

Ничего из этого репозитория не отправлялось на GitHub. Команды ниже только локальные.

---

## Что умеет приложение

- Регистрация в два шага: имя и email, затем пароль.
- Вход в два шага: email, затем пароль.
- Задачи на выбранный день: создать, открыть, изменить, удалить, отметить выполненной.
- Вкладка «Даты»: месяц, точки на днях, где есть задачи.
- Напоминание на время. На телефоне ставится локальное уведомление. В браузере время сохраняется и показывается на карточке.
- Нижние вкладки: Сегодня, Даты, Профиль.
- Кнопки «Назад», «Домой» на входе и аппаратная кнопка назад на Android.
- Анимация переходов между шагами и экранами.

---

## Что нужно установить

1. **Node.js 20+** и **npm 10+**. Проверка:

```powershell
node -v
npm -v
```

2. **MongoDB** — один из вариантов:
   - Docker Desktop и команда из корня проекта: `docker compose up -d`
   - или установленный MongoDB, который слушает `mongodb://127.0.0.1:27017`
   - или бесплатный кластер [MongoDB Atlas](https://www.mongodb.com/atlas) и его строка подключения в `backend/.env`

3. Чтобы смотреть приложение:
   - проще всего — браузер (`npm run web`);
   - либо **Expo Go** на телефоне (телефон и компьютер в одной Wi-Fi);
   - либо эмулятор Android из Android Studio.

Глобальную команду `expo` лучше не использовать: у проекта свой Expo 56. Запускайте `npm start` или `npx expo start` из папки `frontend`.

---

## Шаг 1. Зависимости

Из корня проекта (`d:\Karyna\charodey-planner`):

```powershell
npm install
```

Отдельно в `frontend` и `backend` ставить ничего не нужно: npm workspaces кладёт пакеты в корневой `node_modules`.

---

## Шаг 2. Настройки

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

`backend/.env` уже содержит локальный секрет и адрес MongoDB. Для обычного запуска на этом компьютере менять его не нужно.

`frontend/.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

Другие адреса:

| Где открыто приложение | Что писать в `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Браузер на этом компьютере | `http://localhost:3000` |
| Android-эмулятор | `http://10.0.2.2:3000` |
| Телефон в той же Wi-Fi | `http://IP-вашего-компьютера:3000` |
| Уже задеплоенный API на Render | `https://имя-сервиса.onrender.com` |

IP компьютера в PowerShell: `ipconfig`, смотрите IPv4 у активного Wi-Fi.

---

## Шаг 3. База

Если стоит Docker:

```powershell
docker compose up -d
```

Проверка, что порт открыт: в браузере это не страница, но контейнер должен быть в статусе running (`docker ps`).

Без Docker поднимите свой `mongod` или впишите Atlas в `MONGO_URI` внутри `backend/.env`.

---

## Шаг 4. Бэкенд

Второй терминал, из корня:

```powershell
npm run start:backend
```

То же самое:

```powershell
cd backend
npm run start:dev
```

Когда всё хорошо, в логе будет адрес, и откроются:

- `http://localhost:3000` — ответ `{ "service": "charodey-planner-api" }`
- `http://localhost:3000/health` — `{ "status": "ok", "mongo": "connected" }`
- `http://localhost:3000/api` — Swagger

Если `/health` отвечает 503, MongoDB не запущена или неверный `MONGO_URI`.

Остановить сервер: `Ctrl+C` в этом терминале.

---

## Шаг 5. Приложение

Третий терминал:

```powershell
cd frontend
npm start
```

В меню Metro:

- `w` — открыть в браузере;
- `a` — Android-эмулятор, если он уже запущен;
- QR-код — Expo Go на телефоне.

Сброс кэша, если экран белый или старый:

```powershell
npm start -- -c
```

Дальше в приложении: «Создать аккаунт» → имя, email, пароль → вкладка «Сегодня» → «Создать задачу».

---

## Сборка

API, из корня:

```powershell
npm run build
```

Результат: `packages/validation/dist` и `backend/dist`. Запуск собранного API (нужны `.env` и MongoDB):

```powershell
cd backend
npm run start:prod
```

Веб-сборка клиента:

```powershell
cd frontend
npm run build:web
```

Статика появится в `frontend/dist`. Это проверка, что клиент собирается. Для телефона нужен не этот каталог, а APK (следующий раздел).

Проверка типов клиента:

```powershell
cd frontend
npm run typecheck
```

---

## Позже: API на новом сервисе Render

Пушить сейчас не нужно. Когда решите выкладывать:

1. Закоммитьте проект и запушьте `https://github.com/zcharodeystudio/charodey-planner` (или новый репозиторий).
2. Создайте бесплатный кластер MongoDB Atlas и пользователя базы. В Network Access для проверки можно временно разрешить `0.0.0.0/0`.
3. На [render.com](https://render.com): **New → Blueprint**, подключите репозиторий. Файл `render.yaml` уже описывает сервис `charodey-planner-api`.
   Либо вручную: **New → Web Service → Docker**, Dockerfile `./Dockerfile`, context `.`, регион Frankfurt, health check `/health`.
4. В Environment задайте:
   - `MONGO_URI` — строка из Atlas
   - `MONGO_DB_NAME` = `charodey`
   - `JWT_SECRET` — случайная строка **не короче 32 символов** (если Blueprint сгенерировал короткую, замените)
   - `NODE_ENV` = `production`
   - `TRUST_PROXY` = `1`
5. Дождитесь деплоя. Откройте `https://<имя>.onrender.com/health`. Должно быть `"mongo": "connected"`.
6. Этот URL запишите в `frontend/.env` как `EXPO_PUBLIC_API_URL` и в `frontend/eas.json` вместо `https://charodey-planner-api.onrender.com`, если имя сервиса будет другим.
7. Перезапустите Expo.

На бесплатном плане Render сервис засыпает. Первый запрос после паузы может идти около минуты.

Swagger на проде выключен.

---

## Позже: APK

1. Аккаунт на [expo.dev](https://expo.dev).
2. Из `frontend`:

```powershell
npx eas-cli login
npx eas-cli init
npm run eas:preview:android
```

`eas init` привяжет проект и допишет `projectId` в `app.json`. Сборка идёт в облаке Expo, в конце будет ссылка на APK.

Локальная установка на телефон через USB (нужны Android Studio, `JAVA_HOME` на JDK из Android Studio и отладка по USB):

```powershell
cd frontend
npx expo prebuild --platform android
npx expo run:android --device
```

---

## Если что-то не запускается

- `JWT_SECRET must be a random value of at least 32 characters` — нет `backend/.env` или секрет короче 32 символов.
- `MongoDB is not connected` / health 503 — не запущен `docker compose up -d` или неверный `MONGO_URI`.
- «Нет связи с сервером» в приложении — бэкенд не запущен, не тот адрес в `frontend/.env`, или телефон не в той же сети. После правки `.env` перезапустите `npm start`.
- `Cannot find module 'expo-router/...'` — команда была `expo start` из глобального CLI. Нужно `npm start` из папки `frontend`.
- На Windows `bcrypt` не собирается — поставьте [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) с «Разработка классических приложений на C++» и снова `npm install` из корня.
