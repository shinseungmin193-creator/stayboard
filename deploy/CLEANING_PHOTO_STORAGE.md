# Cleaning photo storage deployment

Uploads must live outside the application checkout and must be writable by the PM2 user.

```bash
sudo mkdir -p /var/www/stayboard-storage/cleaning-photos
sudo chown -R <pm2-user>:<pm2-user> /var/www/stayboard-storage
```

Set these variables in the PM2 environment and restart the process:

```dotenv
FILE_STORAGE_PROVIDER=local
FILE_STORAGE_LOCAL_ROOT=/var/www/stayboard-storage/cleaning-photos
CLEANING_PHOTO_MAX_BYTES=10485760
CLEANING_PHOTO_MAX_COUNT=10
CLEANING_PHOTO_RETENTION_DAYS=7
```

Before starting the application, run `node scripts/verify-cleaning-photo-storage.mjs`. Schedule `npm run cleaning:purge-photos` once per day using the server cron or a dedicated PM2 cron process. The cleanup is not tied to page visits.

The nginx location serving StayBoard must include `client_max_body_size 12m;`; see `deploy/nginx/stayboard-cleaning-upload.conf`. Do not expose the storage directory through nginx.
