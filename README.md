# Price Tracker

Автоматический трекер цен на различных маркетплейсах. Позволяет следить за историей цены товара и легко сравнивать цены с различных площадок.

Пока реализован только Ozon. Планируется:

- Aliexpress
- Wildberries
- DNS
- и др.

## Архитектура

Проект представляет собой pnpm-монорепу:

- `apps/hub` - оркестратор и хранилище данных
- `apps/proxy-fetcher` - собирает и проверяет прокси
- `apps/price-fetcher` - читает цены
- `packages/*` - общий код

## Быстрый старт

1. Запустить сервисы
2. Обновить список прокси
3. Создать браузерные сессии
4. Добавить ссылку на товар
5. Обновить цену

### Доступ к API

Маршруты hub закрыты по умолчанию. Доступ бывает двух видов:

- **Пользователь** - товары, цены и `GET /jobs/{id}`. Регистрация: `POST /auth/register` (отвечает одинаково для свободной и занятой почты и сессию не
  выдаёт, чтобы не раскрывать, у каких почт есть аккаунт), затем вход: `POST /auth/login`;
  сессия живёт в HttpOnly cookie `session`, выход: `POST /auth/logout`. Устройства, где вошёл пользователь:
  `GET /auth/sessions`; завершить одну - `DELETE /auth/sessions/{id}`, все остальные -
  `DELETE /auth/sessions`. Смена пароля: `POST /auth/password` (нужен текущий пароль; остальные
  устройства выходят). Товары и история цен общие, но отслеживает товар каждый пользователь для себя:
  чужие товары не видны; `DELETE /products/{id}` прекращает отслеживание, а когда подписчиков не
  остаётся - удаляет товар вместе с историей.
- **Оператор** - `/proxies`, `/proxy-sources`, `/sessions` и `GET /jobs`. Нужен заголовок
  `Authorization: Bearer <HUB_API_KEY>`. Ключ задаётся переменной окружения `HUB_API_KEY` (не короче
  16 символов, например `openssl rand -hex 32`); без него эти маршруты закрыты для всех. Вошедший
  пользователь оператором не становится.

Завершённые сессии (истёкшие и отозванные больше суток назад) удаляются раз в час
(`AUTH_SESSION_PURGE_INTERVAL_MS`).

Попытки входа и регистрации ограничены (счётчики хранятся в Redis и общие для всех экземпляров hub):
по умолчанию 10 входов на почту с одного адреса, 100 входов на почту со всех адресов вместе (щедро, чтобы
постороннему не удалось заблокировать вход владельцу), 50 входов с одного адреса и 5 регистраций с одного
адреса за 15 минут (`AUTH_*_MAX_ATTEMPTS*`, `AUTH_RATE_LIMIT_WINDOW_MS`). Сверх лимита hub отвечает 429 с заголовком `Retry-After`.

Тело запроса ограничено 100 КБ, кроме импорта браузерной сессии (`POST /sessions`): там 10 МБ.

Если перед hub стоит reverse proxy, задайте `TRUST_PROXY` (число прокси перед hub): иначе все клиенты
будут «одним адресом» для лимитов и списка сессий. Адреса IPv6 в лимитах считаются по сети /64.

На пользователя действуют квоты: не больше 100 товаров (`PRODUCTS_PER_USER_MAX`) и не больше 30 добавлений
за час (`PRODUCT_ADD_MAX_ATTEMPTS`, `PRODUCT_ADD_WINDOW_MS`). Сверх них hub отвечает 403 и 429.

Запись (POST, PUT, PATCH, DELETE) из браузера проверяется по заголовку `Origin`: разрешён origin из
`PUBLIC_URL` и перечисленные в `AUTH_ALLOWED_ORIGINS` (через запятую). Открывать Swagger нужно по адресу из
`PUBLIC_URL`. Запросы не из браузера (curl, CLI) без `Origin` проходят.

### Вход через Google и GitHub

Вход через провайдера включается переменными окружения: `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`,
`GITHUB_CLIENT_ID` и `GITHUB_CLIENT_SECRET` (пара целиком, иначе hub не запустится) и `PUBLIC_URL` -
адрес hub снаружи. В настройках OAuth-приложения провайдера укажите callback
`<PUBLIC_URL>/auth/oauth/<google|github>/callback`.

Войти: откройте в браузере `GET /auth/oauth/<google|github>/start`; после входа браузер попадёт на
`AUTH_SUCCESS_REDIRECT` (по умолчанию `/auth/me`) с cookie `session`. Первый вход создаёт пользователя.
Провайдер должен подтвердить почту. Регистрация по паролю открыта и почта при ней не подтверждается,
поэтому подтверждённая провайдером почта «отбирает» такой аккаунт: пароль удаляется, почта помечается
подтверждённой, сессии прежнего владельца завершаются (иначе тот, кто зарегистрировался по чужой почте
первым, мог бы навсегда закрыть настоящему владельцу вход или сохранить доступ). Аккаунт с уже
подтверждённой почтой провайдер просто присоединяет.

### 1 (a). Запуск приложения в Docker

```sh
docker compose up -d --build
```

Порты на хосте, пароль Postgres, `HUB_API_KEY` и уровень логов задаются в `.env` в корне (`cp .env.example .env`);
без него используются значения по умолчанию как в `.env.example`. Воркеров price-fetcher можно запустить несколько: `docker compose up -d --scale price-fetcher-worker=3`.

Далее см. [Swagger](http://localhost:3000/docs).

### 1 (b). Запуск приложения без Docker (pnpm)

Нужны Node.js (требуемая версия в `.nvmrc`), pnpm версии из `packageManager` в `package.json`, Postgres и Redis. Postgres и Redis
проще всего поднять из `docker-compose.yml`; можно и свои - адреса задаются в `.env`.

```sh
nvm use
npm install -g pnpm@11.3.0 # Corepack в Node.js 25+ не поставляется
pnpm install
pnpm --filter price-fetcher exec playwright install chromium
cp apps/hub/.env.example apps/hub/.env
cp apps/price-fetcher/.env.example apps/price-fetcher/.env
docker compose up -d postgres redis # если локально не подняты
pnpm build

# приложения читают переменные окружения, а не файл .env
set -a; source apps/hub/.env; set +a
pnpm --filter hub migrate:deploy
```

Запустить каждый сервис в своём терминале:

```sh
# hub
set -a; source apps/hub/.env; set +a; pnpm --filter hub start
# proxy-fetcher
pnpm --filter proxy-fetcher start
# price-fetcher
set -a; source apps/price-fetcher/.env; set +a
xvfb-run -a pnpm --filter price-fetcher start:worker
```

В сеансе Wayland воркер запускайте через `env -u WAYLAND_DISPLAY XDG_SESSION_TYPE=x11 xvfb-run -a …`,
иначе Chromium будет открывать окно прямо на рабочем столе.

Далее см. [Swagger](http://localhost:3000/docs).

### 2. Обновить список прокси

Собрать и проверить прокси (нужен ключ оператора): `POST /proxy-sources/{source}/refresh`

Прогресс: `GET /jobs` (оператор; `GET /jobs/{jobId}` отдаёт задачу только тому пользователю, кто её запросил)

Результат: `GET /proxies`.

### 3. Создать браузерные сессии

`HUB_API_KEY=<ключ> pnpm sessions:onboard --hub http://localhost:3000` - замените url хаба на свой, подставьте ключ оператора (он нужен, чтобы загрузить сессии в hub) и выполните эту команду для создания сессий и загрузки их в хаб. Ниже объясняется зачем это нужно.

Маркетплейсы обычно ограничивают автоматический сбор информации. Что бы программно получить цену товара необходимо хотя бы один раз открыть любую страницу маркетплейса обычным "живым" браузером и позволить серверу записать cookies - создать сессию. Далее price-fetcher присоединяет сессию к своим запросам и маркетплейсы отдают нужные данные.

`pnpm sessions:onboard --hub http://localhost:3000` по очереди открывает окна браузера для каждого
прокси; в окне пройдите антибот-проверку, сессия загрузится в hub и привяжется к прокси сама. Обычно антибот-проверка не требует явных действий от пользователя, но может потребоваться и решение несложной капчи.

Прокси с сессией получает `ready: true` в `GET /proxies`. Если маркетплейс снова требует проверку
или сменился выходной IP, сессия становится `stale`, и прокси снова попадает в выборку
`sessions:onboard`.

Бесплатные прокси часто меняют IP, поэтому сессии на них живут недолго. Необходимо периодически подкидывать свежие сессии в систему с помощью `pnpm sessions:onboard`.

### 4. Добавить ссылку на товар

Сначала зарегистрируйтесь (`POST /auth/register`) и войдите (`POST /auth/login`), затем `POST /products`.

### 5. Получить цену

Отдельного запроса цены нет: чтение первой цены ставится в очередь при добавлении товара
(`POST /products` возвращает `jobId`, если у товара ещё нет цены и есть через какие прокси её читать).
Позже обновление цен будет идти по расписанию.

Прогресс: `GET /jobs/{jobId}`

Результат: `GET /products/{id}/prices`

## Разработка

### Разработка в Docker

Контейнеры запускают исходники с этой машины в `tsx watch` и перезапускаются при любой правке, включая
`packages/*`. Используются `node_modules` этой машины, поэтому сначала нужен `pnpm install`.

Контейнеры работают от `1000:1000`, чтобы созданные ими файлы принадлежали вам. Для rootless Docker
задайте `DEV_USER=0:0` в `.env` в корне (см. `.env.example`), для другого uid - `DEV_USER=<uid>:<gid>`.

Запуск:

```sh
pnpm install
cp apps/price-fetcher/.env.example apps/price-fetcher/.env # необязательно: настройки воркера
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Миграции применяет сервис `migrate`, Prisma-клиент генерирует hub при старте. Далее см.
[Swagger](http://localhost:3000/docs).

Чтобы не указывать оба файла в каждой команде, задайте их в переменной окружения текущего терминала:

```sh
export COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml
docker compose up -d --build        # запустить в фоне
docker compose logs -f hub          # логи сервиса
docker compose up -d hub            # только hub (с postgres, redis и migrate)
docker compose restart price-fetcher-worker
docker compose down                 # остановить; данные postgres и redis сохраняются
```

После изменения зависимостей повторите `pnpm install` и `--build`: образ price-fetcher ставит Chromium
под версию Playwright из lockfile.

После изменения `schema.prisma` создайте миграцию на этой машине и перезапустите `migrate` и `hub`
(`DATABASE_URL` в `apps/hub/.env` должен указывать на `POSTGRES_PORT`):

```sh
set -a; source apps/hub/.env; set +a
pnpm --filter hub exec prisma migrate dev --name <имя>
docker compose up -d --force-recreate migrate hub
```

`pnpm sessions:onboard` открывает окно браузера, поэтому запускается на этой машине, а не в контейнере.
