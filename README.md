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

### 1 (a). Запуск приложения в Docker

```sh
docker compose up -d --build
```

Порты на хосте, пароль Postgres и уровень логов задаются в `.env` в корне (`cp .env.example .env`);
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

Собрать и проверить прокси: `POST /proxy-sources/{source}/refresh`

Прогресс: `GET /jobs/{jobId}`

Результат: `GET /proxies`.

### 3. Создать браузерные сессии

`pnpm sessions:onboard --hub http://localhost:3000` - замените url хаба на свой и выполните эту команду для создания сессий и загрузки их в хаб. Ниже объясняется зачем это нужно.

Маркетплейсы обычно ограничивают автоматический сбор информации. Что бы программно получить цену товара необходимо хотя бы один раз открыть любую страницу маркетплейса обычным "живым" браузером и позволить серверу записать cookies - создать сессию. Далее price-fetcher присоединяет сессию к своим запросам и маркетплейсы отдают нужные данные.

`pnpm sessions:onboard --hub http://localhost:3000` по очереди открывает окна браузера для каждого
прокси; в окне пройдите антибот-проверку, сессия загрузится в hub и привяжется к прокси сама. Обычно антибот-проверка не требует явных действий от пользователя, но может потребоваться и решение несложной капчи.

Прокси с сессией получает `ready: true` в `GET /proxies`. Если маркетплейс снова требует проверку
или сменился выходной IP, сессия становится `stale`, и прокси снова попадает в выборку
`sessions:onboard`.

Бесплатные прокси часто меняют IP, поэтому сессии на них живут недолго. Необходимо периодически подкидывать свежие сессии в систему с помощью `pnpm sessions:onboard`.

### 4. Добавить ссылку на товар

`POST /products`

### 5. Запустить задачу обновления цены

Запуск задачи: `POST /products/{id}/prices`.

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
