# Развёртывание openGym на VPS

Всё, что нужно, чтобы поставить [openGym](https://github.com/DuarteSantos8/openGym) на свой
сервер (VDSina, Ubuntu 22.04/24.04) с HTTPS на бесплатном адресе DuckDNS — вручную или через
локальную сессию Claude Code.

- `setup-opengym.sh` — скрипт установки, запускается на сервере от root.
- Ниже — подготовка и готовый промпт для локального Claude Code.

## 1. Что подготовить (5 минут, руками)

1. **IP сервера** и пароль root — из письма или панели VDSina.
2. **Адрес DuckDNS.** Войдите на [duckdns.org](https://www.duckdns.org), создайте поддомен
   (например `mygym-dima`) и скопируйте **token** вверху страницы. IP указывать не обязательно:
   скрипт сделает это сам, если передать ему токен.
3. **SSH-ключ на сервер**, чтобы Claude мог подключаться без пароля (пароль он ввести не может).

   macOS / Linux:
   ```bash
   [ -f ~/.ssh/id_ed25519 ] || ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
   ssh-copy-id root@ВАШ_IP
   ```

   Windows (PowerShell):
   ```powershell
   if (!(Test-Path ~/.ssh/id_ed25519)) { ssh-keygen -t ed25519 -N '""' -f "$HOME/.ssh/id_ed25519" }
   type $HOME\.ssh\id_ed25519.pub | ssh root@ВАШ_IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
   ```

   Пароль root вводится один раз. Проверка: `ssh root@ВАШ_IP` должен пустить без пароля.

## 2. Запуск через локальный Claude Code

Склонируйте этот репозиторий, перейдите в ветку и запустите Claude Code в папке `opengym-deploy`:

```bash
git clone https://github.com/dnetizen1/training.git && cd training
git checkout claude/dreamy-hopper-sswxix
cd opengym-deploy && claude
```

Вставьте промпт, подставив свои значения:

```text
Разверни openGym на моём VPS скриптом ./setup-opengym.sh из этой папки.
Сервер: root@ВАШ_IP (вход по SSH-ключу уже настроен). Домен: ИМЯ.duckdns.org.
Токен DuckDNS лежит в переменной окружения DUCKDNS_TOKEN — не выводи его в чат.

Шаги:
1. Проверь доступ: ssh -o BatchMode=yes root@ВАШ_IP 'cat /etc/os-release | head -2; free -h'.
2. Скопируй скрипт: scp ./setup-opengym.sh root@ВАШ_IP:/root/
3. Запусти: ssh root@ВАШ_IP "bash /root/setup-opengym.sh ИМЯ.duckdns.org $DUCKDNS_TOKEN"
4. Если упало — прочитай вывод, найди причину (логи: docker compose logs в /root/opengym,
   journalctl -u caddy), исправь и запусти скрипт повторно (он идемпотентный).
5. В конце проверь curl https://ИМЯ.duckdns.org/api/health и скажи мне адрес.
Ничего не удаляй на сервере без моего подтверждения.
```

Токен задайте перед запуском `claude`, чтобы он не попал в историю чата:
`export DUCKDNS_TOKEN=...` (macOS/Linux) или `$env:DUCKDNS_TOKEN="..."` (PowerShell).

## 3. Или вручную, без Claude

```bash
scp setup-opengym.sh root@ВАШ_IP:/root/
ssh root@ВАШ_IP "bash /root/setup-opengym.sh ИМЯ.duckdns.org ВАШ_DUCKDNS_TOKEN"
```

## 4. После установки

1. Откройте `https://ИМЯ.duckdns.org`, создайте профиль с passkey. **Первый профиль — админ**,
   регистрируйтесь до того, как делиться ссылкой.
2. На телефоне: меню браузера → «Добавить на главный экран».
3. Смените пароль root на сервере: `ssh root@ВАШ_IP passwd`.

| Что | Команда на сервере |
|---|---|
| Логи openGym | `cd /root/opengym && docker compose logs --tail 50` |
| Логи HTTPS | `journalctl -u caddy --no-pager -n 50` |
| Обновить openGym | `cd /root/opengym && git pull && docker compose pull && docker compose up -d` |
| Резервная копия | `cd /root/opengym && tar czf /root/backup-$(date +%F).tar.gz data/` |

Данные пользователей лежат в `/root/opengym/data` — это единственное, что нужно бэкапить.
