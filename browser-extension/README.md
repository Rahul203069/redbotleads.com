# RedBot Outreach Assistant

This unpacked Chrome extension runs the owner-operated outreach workflow started from a campaign page. It uses the current browser sessions for the app, Reddit, and ChatGPT. It never stores passwords and never clicks Reddit's Send button.

## Install on the admin laptop

1. Deploy the outreach database migration and app changes first.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select this `browser-extension` directory.
4. Sign in to the SaaS app, Reddit, and ChatGPT in the same Chrome profile.
5. Open an owner campaign page, choose **Outreach**, save the instructions, and run the preflight.

The manifest currently allows the local app plus `redbotleads.com`. If the production hostname differs, add that exact HTTPS hostname to both `host_permissions` and the app-page content-script `matches` list before loading the extension.

## Safety behavior

- Only score-75+ post leads from the campaign page's current date filter are queued.
- At most 100 top-sorted comments are sent to a fresh ChatGPT conversation per post.
- The server enforces one first-touch, one follow-up after seven days, and 25 confirmed sends in a rolling 24-hour period per Reddit account.
- CAPTCHA, login, layout, or rate-limit problems pause the run. The extension does not bypass them.
