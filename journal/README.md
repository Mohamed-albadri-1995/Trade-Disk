# Trade-Disk Journal frontend

Static, responsive Journal frontend prototype following the Journal design docs in `design/07-journal/`.

## Run locally

Open `index.html` in a modern browser. The UI uses synthetic demo trades; notes and theme are stored in local browser storage. No broker, server, or sync is connected.

## Cloudflare Pages

Deploy the `journal/` directory as the Pages build output directory with no build command. Create a Pages project named `trade-disk-journal` and connect the repository, or configure the GitHub Actions workflow with repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

The workflow only deploys this frontend preview. It does not provide backend persistence, broker connections, real sync, or production financial calculations.
