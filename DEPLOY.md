# База, Render и сборка на телефон

Один бесплатный кластер MongoDB Atlas на все приложения. Внутри него отдельная база на каждое приложение. На Render у каждого API свой сервис.

Локальный запуск на компьютере описан в `README.md`.

Сейчас для планировщика уже работает:

- сервис `charodey-planner-api`;
- проверка [https://charodey-planner-api.onrender.com/health](https://charodey-planner-api.onrender.com/health) отвечает `{"status":"ok","mongo":"connected"}`.

Сервис `mealvoyage-api` не открывайте и не меняйте. Его `MONGO_URI` и `JWT_SECRET` остаются как есть.

Дальше для телефона нужен только раздел «Сборка APK».

---

## 1. Код на GitHub

Репозиторий: `https://github.com/zcharodeystudio/charodey-planner`, ветка `main`. В корне должен лежать `render.yaml`. Файлы `.env` в git не попадают.

Пока этой ветки нет на GitHub, Render репозиторий в списке не покажет.

---

## 2. Пользователь в уже существующем кластере Atlas

Новый кластер не создавайте. Откройте проект, где уже работает mealvoyage.

1. Зайдите на [cloud.mongodb.com](https://cloud.mongodb.com) и сверху выберите тот же проект.
2. Слева в разделе **Security** нажмите **Database & Network Access**.
3. Откройте вкладку **Database Users**. Пользователя mealvoyage не меняйте.
4. Нажмите **Add New Database User**.
5. В **Authentication Method** выберите **Password**.
6. **Username:** `charodey`. **Password:** только буквы и цифры. Пароль сохраните у себя.
7. Раскройте **Specific Privileges** и нажмите **Add Specific Privilege**.
8. Роль: `readWrite`. База: `charodey`. Коллекцию оставьте пустой.
9. У стандартной **Built-in Role** нажмите **Delete**, чтобы у этого пользователя не было доступа к базе mealvoyage.
10. **Temporary User** оставьте выключенным.
11. Нажмите **Add User**.

Базу `charodey` отдельно создавать не нужно: она появится при первом сохранении данных.

На вкладке **Network Access** должна быть строка `0.0.0.0/0`. Если она уже есть, новый адрес не добавляйте.

### Строка подключения

1. Слева откройте **Database**.
2. На карточке уже существующего кластера нажмите **Connect → Drivers**.
3. Скопируйте строку и подставьте логин и пароль. Без кавычек и без скобок `< >`:

```text
mongodb+srv://charodey:ПАРОЛЬ@хост-кластера.mongodb.net/?retryWrites=true&w=majority
```

Имя базы в строку не вписывайте. Его задаёт `MONGO_DB_NAME` на Render.

---

## 3. Новый сервис на Render

Аккаунт Render тот же, что у mealvoyage. Сервис новый.

1. Откройте [dashboard.render.com](https://dashboard.render.com).
2. Справа сверху нажмите **New**, затем **Blueprint**.
3. Если GitHub ещё не подключён, нажмите **Connect account** и разрешите доступ к репозиторию `charodey-planner`.
4. В списке найдите `charodey-planner` и нажмите **Connect**.
5. **Branch** оставьте `main`. **Blueprint Path** оставьте `render.yaml`.
6. На следующем экране будет один сервис: `charodey-planner-api`, Docker, регион Frankfurt, план Free.
7. В `MONGO_URI` вставьте строку пользователя `charodey`. `MONGO_DB_NAME=charodey` подставится само.
8. `JWT_SECRET` Render заполнит сам. Если поле пустое, вставьте свою случайную строку длиннее 32 символов. Секрет mealvoyage сюда не копируйте.
9. Нажмите **Deploy Blueprint**.
10. Дождитесь статуса **Live**.

Проверка: [https://charodey-planner-api.onrender.com/health](https://charodey-planner-api.onrender.com/health)

```json
{"status":"ok","mongo":"connected"}
```

Этот адрес уже записан в `frontend/eas.json`. На бесплатном плане сервис засыпает, первый запрос после паузы может идти около минуты. Swagger на проде выключен.

### Если деплой упал с `bad auth`

Лог `MongoServerError: bad auth : Authentication failed` значит, что хост кластера верный, а логин или пароль в `MONGO_URI` нет. Строка `No open ports detected` при этом появляется потому, что приложение ждёт базу и ещё не открыло порт.

1. В Atlas: **Database Users → charodey → Edit → Edit Password**. Задайте пароль только из букв и цифр, нажмите **Update User**.
2. Снова **Connect → Drivers** и соберите строку с новым паролем.
3. В Render: **charodey-planner-api → Environment → MONGO_URI → Edit**.
4. Вставьте строку целиком и нажмите **Save, rebuild, and deploy**.

---

## 4. Сборка APK

Напоминания на телефоне приходят из установленного приложения. Браузер и Expo Go их не показывают.

1. Аккаунт на [expo.dev](https://expo.dev).
2. Из папки `frontend`:

```powershell
cd d:\Karyna\charodey-planner\frontend
npx eas-cli login
npx eas-cli init
npm run eas:preview:android
```

`eas init` один раз привяжет проект к Expo и допишет `projectId` в `app.json`. Сборка идёт в облаке 10–20 минут. В конце будет ссылка на APK.

3. Откройте ссылку на телефоне, разрешите установку и поставьте **Charodey Planner**.
4. Зарегистрируйтесь в приложении.
5. При первом напоминании разрешите уведомления. Время поставьте в будущем.

После установки регистрация и задачи идут через Render и Atlas, компьютер для этого не нужен.

Локальная установка через USB, если облачная сборка не нужна: Android Studio, `JAVA_HOME` на JDK из Android Studio и отладка по USB. Из папки `frontend`:

```powershell
npx expo prebuild --platform android
npx expo run:android --device
```

Перед этим в `frontend/.env` должен быть адрес API: `EXPO_PUBLIC_API_URL=https://charodey-planner-api.onrender.com`.
