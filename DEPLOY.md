# Выкладка на relaxdev.ru

## 1. Залить код на GitHub
В папке уже git-репозиторий, ветка `master`, remote пока не привязан:

```bat
git add -A
git commit -m "deploy relaxdev"
git branch -M master
git remote add origin https://github.com/<ты>/<репо>.git
git push -u origin master
```

## 2. Создать проект в панели RelaxDev
- «Добавить проект» → выбрать репозиторий → ветка **master**
  (у платформы по умолчанию `main` — переключи на `master`).
- Сборка — любой из вариантов:
  - **Автоопределение стека** (Node.js): команды подхватятся из
    `package.json` (`npm start` → `node workshop-server.js`);
  - **Свой Dockerfile** (тип сборки «Docker») — файл уже в репозитории.
- Порт настраивать не надо: сервер слушает `process.env.PORT`
  на `0.0.0.0`, платформа сама прокидывает `PORT`.
- Проверка живости: `GET /api/ping` → `{"ok":true,...}`.

## 3. База данных (чтобы воркшоп не сбрасывался)
- В панели RelaxDev: **«База данных» → создать PostgreSQL** — получишь `DATABASE_URL`
- Вставь его в **«Переменные окружения»** проекта как `DATABASE_URL`
- Сервер сам создаст таблицу `items` и будет хранить публикации в ней
- Без `DATABASE_URL` работает фолбэк на JSON-файл (сбрасывается при редеплое)

## 4. Домен
- Сразу будет адрес `имя-проекта.relaxdev.ru` с HTTPS.
- Свой домен: две A-записи `@` и `www` на IP из панели,
  добавить во вкладке «Домены» — сертификат выпустится сам.

## Что уже готово в репозитории
- `package.json` (`start`, `engines.node >= 20`), `package-lock.json`
- `Dockerfile` (Node 20, `EXPOSE 8080`)
- `workshop-server.js` слушает `PORT`/`0.0.0.0`, приватные файлы
  (`workshop-db.json` с ключами владельцев, исходники сервера,
  `.git`, `node_modules`) по HTTP не отдаются — только 404.
