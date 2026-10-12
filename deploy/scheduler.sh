#!/bin/sh
# Calls the app's scheduled endpoints with the shared secret.
#   every minute : drain the notification outbox (low-stock emails)
#   02:30 IST    : nightly backup (when BACKUP_PASSPHRASE is configured)
#   09:00 IST    : daily reminders (bills pending more than 30 days) and housekeeping
set -eu
# curl and tzdata come from deploy/scheduler.Dockerfile.
export TZ=Asia/Kolkata

call() {
  curl -fsS -m 300 -X POST -H "Authorization: Bearer ${CRON_SECRET}" "http://app:3000$1" >/dev/null \
    || echo "$(date -Iseconds) $1 failed"
}

last_backup_day=""
last_reminder_day=""
while true; do
  call /api/cron/outbox
  today=$(date +%F)
  if [ "$(date +%H%M)" -ge 0230 ] && [ "$last_backup_day" != "$today" ]; then
    call /api/cron/backup
    last_backup_day=$today
  fi
  if [ "$(date +%H%M)" -ge 0900 ] && [ "$last_reminder_day" != "$today" ]; then
    call /api/cron/reminders
    call /api/cron/cleanup
    last_reminder_day=$today
  fi
  sleep 60
done
