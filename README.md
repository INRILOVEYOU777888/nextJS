# Next.js + PostgreSQL

Веб-приложение на базе Next.js с App Router и PostgreSQL, доступное из интернета через Apache и localtunnel.

---

## Стек технологий

| Технология         | Версия | Назначение                           |
| ------------------ | ------ | ------------------------------------ |
| Next.js            | 16.x   | Фреймворк (SSR, роутинг, API routes) |
| React              | 19.x   | UI (встроен в Next.js)               |
| PostgreSQL         | —      | База данных                          |
| pg (node-postgres) | 8.x    | Клиент PostgreSQL для Node.js        |
| bcryptjs           | —      | Хэширование паролей                  |
| Sass (SCSS)        | 1.x    | Стили                                |
| Apache             | 2.4    | Reverse proxy (порт 80 → 3000)       |
| localtunnel        | 2.x    | Публичный HTTPS-доступ к localhost   |
| dotenv             | 17.x   | Переменные окружения                 |

---

## Структура проекта

```
reactJS/
├── app/                        # Next.js App Router
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── route.js    # POST /api/auth/login
│   │   │   └── register/
│   │   │       └── route.js    # POST /api/auth/register
│   │   └── users/
│   │       └── route.js        # GET /api/users → PostgreSQL
│   ├── register/
│   │   └── page.js             # Страница регистрации
│   ├── dashboard/
│   │   ├── page.js             # Приветственная страница (после входа)
│   │   └── page.module.scss    # Стили дашборда
│   ├── favicon.ico
│   ├── globals.scss            # Глобальные стили + CSS-переменные тем
│   ├── layout.js               # Корневой layout
│   ├── page.js                 # Страница входа (/)
│   └── page.module.scss        # Стили форм авторизации
├── lib/
│   └── db.js                   # Пул подключений PostgreSQL (pg.Pool)
├── apache/
│   └── nextapp.conf            # Конфиг Apache reverse proxy
├── .env                        # Переменные окружения (не коммитить)
├── next.config.mjs             # Конфиг Next.js
├── jsconfig.json               # Алиас @/ → корень проекта
├── eslint.config.mjs           # ESLint
└── package.json
```

---

## Как это работает

```
Интернет
   ↓
localtunnel (HTTPS)
   ↓
Apache :80  (reverse proxy)
   ↓
Next.js :3000
   ├── /                  →  Страница входа
   ├── /register          →  Страница регистрации
   ├── /dashboard         →  Приветственная страница (требует входа)
   ├── /api/auth/login    →  Проверка email + bcrypt → пользователь
   ├── /api/auth/register →  Создание пользователя + bcrypt hash
   └── /api/users         →  Список пользователей из PostgreSQL
```

### Apache

Принимает все запросы на порт 80 и проксирует их на Next.js (порт 3000). Также проксирует WebSocket-соединения для Hot Module Replacement (HMR) в режиме разработки.

Конфиг: `apache/nextapp.conf` → `/etc/httpd/conf/conf.d/vite-app.conf`

Необходимые модули Apache: `mod_proxy`, `mod_proxy_http`, `mod_proxy_wstunnel`, `mod_rewrite`.

### Next.js API Routes

Встроенные API Routes Next.js без отдельного сервера:

- `app/api/auth/login/route.js` — проверяет email и пароль, возвращает данные пользователя
- `app/api/auth/register/route.js` — создаёт нового пользователя с хэшированным паролем
- `app/api/users/route.js` — список пользователей из БД

### Авторизация

Регистрация и вход реализованы через `bcryptjs`:

- При регистрации пароль хэшируется с cost factor 10 и сохраняется в `password_hash`
- При входе `bcrypt.compare` сравнивает введённый пароль с хэшем из БД
- Ошибка входа не раскрывает, существует ли пользователь с данным email

**POST /api/auth/register**

```json
// Запрос
{ "name": "Иван", "email": "ivan@example.com", "password": "минимум8" }

// Ответ 201
{ "user": { "id": 1, "name": "Иван", "email": "ivan@example.com" } }

// Ошибки: 400 (не все поля / пароль < 8 символов), 409 (email занят)
```

**POST /api/auth/login**

```json
// Запрос
{ "email": "ivan@example.com", "password": "минимум8" }

// Ответ 200
{ "user": { "id": 1, "name": "Иван", "email": "ivan@example.com" } }

// Ошибки: 400 (не все поля), 401 (неверный email или пароль)
```

После успешного входа сервер подписывает данные пользователя и кладёт их в httpOnly cookie `session`.
Раздел `/dashboard` защищён серверным layout: без валидной cookie пользователь перенаправляется на `/login`.
Клиентский код не хранит пользователя в `localStorage`.

### PostgreSQL

Подключение через пул `pg.Pool` в `lib/db.js`. Параметры берутся из `.env`.

Схема БД управляется SQL-миграциями из `db/migrations`.
Команда `npm run db:migrate` применяет новые миграции и записывает их checksum в таблицу `schema_migrations`.

Основные таблицы:

- `roles`, `users` — роли и пользователи
- `directions`, `teachers`, `rooms` — справочники студии
- `students` — ученики с привязкой к направлению и преподавателю
- `subscriptions` — абонементы с ограничениями по количеству и статусу
- `lessons` — расписание с проверкой времени и занятости кабинета
- `attendance` — отметки посещений

В схеме есть внешние ключи, `CHECK`-ограничения, уникальные индексы и индексы для списков/расписания.
Временные поля используют `TIMESTAMPTZ`.

## Переменные окружения

Файл `.env` в корне проекта:

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=mydb
DB_PASSWORD=secret
DB_PORT=5432
```

---

## Запуск

### 1. Установить Apache конфиг (один раз)

```bash
sudo cp apache/nextapp.conf /etc/httpd/conf/conf.d/vite-app.conf
# Включить модули в /etc/httpd/conf/httpd.conf:
# LoadModule proxy_module modules/mod_proxy.so
# LoadModule proxy_http_module modules/mod_proxy_http.so
# LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so
sudo httpd -t         # проверить конфиг
sudo systemctl restart httpd
```

### 2. Запустить PostgreSQL

```bash
sudo systemctl start postgresql
```

### 3. Применить миграции БД

```bash
npm run db:migrate
```

### 4. Запустить Next.js

```bash
npm run dev           # режим разработки (порт 3000, HMR)
# или
npm run build && npm start  # продакшн
```

### 5. Открыть публичный доступ через localtunnel

```bash
npm run tunnel        # lt --port 80
```

---

## Скрипты

| Команда          | Описание                                    |
| ---------------- | ------------------------------------------- |
| `npm run dev`    | Next.js dev-сервер (порт 3000, HMR)         |
| `npm run build`  | Продакшн-сборка                             |
| `npm start`      | Запуск продакшн-сборки                      |
| `npm run lint`   | Проверка ESLint                             |
| `npm run db:migrate` | Применить SQL-миграции PostgreSQL      |
| `npm run tunnel` | Открыть публичный туннель через localtunnel |
