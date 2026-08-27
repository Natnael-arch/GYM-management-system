# Gym Access System

A comprehensive Next.js + Prisma + PostgreSQL system for managing gym memberships, printing barcode cards, and processing hardware-integrated check-ins.

## Features
- **Member Management**: Create members, upload photos, auto-generate unique 12-char barcodes.
- **Plans & Memberships**: Issue, renew, and freeze memberships based on flexible pricing plans.
- **Check-in Kiosk**: A lightning-fast, offline-resilient kiosk that actively triggers door hardware on successful scans.
- **Analytics & Reporting**: Daily visitation graphs, grid maps, and CSV exports.
- **Audit Logs & Security**: OWNER-only audit trails, IP rate-limiting, and emergency lockdown toggles.

---

## Deployment (Docker Compose)

The easiest way to run the Gym Access System in production is using Docker Compose. The provided `docker-compose.yml` spins up PostgreSQL, the Next.js Web App, and a Caddy Reverse Proxy for HTTPS.

1. Ensure Docker and Docker Compose are installed on your host.
2. Clone this repository.
3. Add a `.env` file containing your production `BETTER_AUTH_SECRET`.
4. Run:
   ```bash
   docker compose up -d --build
   ```
5. Apply database migrations:
   ```bash
   docker exec -it gym_web npx prisma db push
   ```

---

## Kiosk Auto-Launch

If this system is being run on the front-desk PC, you can automatically launch the check-in screen in fullscreen Kiosk mode on boot using Chromium:

```bash
chromium-browser --kiosk http://localhost:3000/checkin --disable-infobars --autoplay-policy=no-user-gesture-required
```

*Note: Ensure an admin logs in at least once so the browser caches the offline manifest via IndexedDB.*

---

## Backups

Automated scripts are provided in `scripts/`. They bundle a full `pg_dump` of the PostgreSQL database alongside the `public/uploads` folder containing member photos.

### Scheduling Nightly Backups
To run the backup automatically every night at 2:00 AM, add a CRON job:
```bash
crontab -e
```
Add the following line:
```cron
0 2 * * * cd /path/to/gym-access && ./scripts/backup.sh >> ./backups/backup.log 2>&1
```

*Don't forget to configure the `# TODO` section in `backup.sh` to sync the `.tar.gz` offsite using `aws s3` or `rclone`!*

### Restoring a Backup
```bash
./scripts/restore.sh ./backups/gym_backup_20260827_020000.tar.gz
```
