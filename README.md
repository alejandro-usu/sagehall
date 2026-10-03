# Sage Hall: website mock-up

A concept redesign for [Sage Hall](https://sagehalldance.com), the country swing dance in Logan, Utah. It's a plain static site (HTML, CSS, a little JavaScript, no build step), so it runs on GitHub Pages as is.

**What's in it**

- **Schedule** with a flyer-style list view and a month calendar. Past nights grey out automatically. Visitors can add any night, or the whole month, to Google, Apple or Outlook calendars.
- **Next dance** ticket at the top of the page, with directions and the next few nights.
- **Staff sign-in** at `/admin` for editing the schedule, reels, venues and FAQ through simple forms ([Pages CMS](https://pagescms.org)). No code, no GitHub account needed.
- **Optional Google Calendar sync.** Paste a calendar ID and the site reads the schedule live from Google Calendar instead.
- **Instagram reels**: paste up to three reel links and they embed on the page.
- First-timer guide, FAQ, venues, and an about section.

The artwork (logo, boot bouquet, and the western pattern band) is cut from Sage Hall's September flyer.

---

## 1. Publish it on GitHub Pages

1. Merge this branch into `main`.
2. In the repo, open **Settings → Pages**. Under **Build and deployment**, pick **Deploy from a branch**, then choose `main` and `/ (root)`.
3. After a minute the site is live at `https://alejandro-usu.github.io/sagehall/`.

To preview locally, run `python3 -m http.server` in this folder and open <http://localhost:8000>. (Opening `index.html` straight from disk won't work, because the browser blocks loading the JSON files.)

**Preview a date:** add `?today=2026-09-12` to the URL to see the site as if it were that day. It's handy for demos when the posted schedule is in the past.

## 2. Set up the staff editor (Pages CMS)

Do this once, as the repo owner:

1. Go to <https://app.pagescms.org>, sign in with GitHub, and install the Pages CMS GitHub App on this repository.
2. Open the repo's `main` branch. The sidebar shows **Dance schedule** and **Site settings**. Both come from `.pages.yml`.
3. To give staff access, open **Collaborators** and invite them by email. They sign in from the emailed link and don't need a GitHub account.

From then on, staff go to `/admin` on the site and tap **Edit the dance schedule**. Each save commits to the repo, and GitHub Pages republishes within a minute or two.

> If the repo moves (for example, transferred to Sage Hall's own GitHub account) or publishes from another branch, update the two editor links in `admin/index.html`.

**Adding a new venue:** add it under **Site settings → Venues**, then add the same name to the `venue` options in `.pages.yml` so it shows in the schedule dropdown.

## 3. Optional: run the schedule from Google Calendar

If staff would rather use the Google Calendar app on their phones:

1. In Google Calendar, create a calendar (e.g. "Sage Hall Dances"). In its settings, under **Access permissions**, turn on **Make available to public**.
2. Copy the **Calendar ID** from **Integrate calendar**. It looks like `abc123@group.calendar.google.com`.
3. In the [Google Cloud Console](https://console.cloud.google.com/), create a project, enable the **Google Calendar API**, and create an **API key**. Restrict it:
   - **Application restrictions → Websites:** `https://alejandro-usu.github.io/*` (plus the real domain later)
   - **API restrictions:** Google Calendar API only

   A browser key like this is meant to be public. The restrictions keep anyone else from using it.
4. Paste the ID and key into **Site settings → Google Calendar** in the editor.

The site then reads events from Google Calendar and shows "Subscribe" links under the schedule. Put the venue name, or its address, in each event's **location**. Start a title with "Cancelled" to mark a night as cancelled. If Google can't be reached, the site falls back to `data/events.json`.

## 4. Instagram reels

In Instagram, open a reel and tap **Share → Copy link**, then paste the link under **Site settings → Instagram reels**. The first three show on the home page. Until reels are added, the section shows placeholder cards.

---

## Before showing this to Sage Hall

Some details came from older public listings and should be confirmed:

- [ ] Instagram handle `@sage.hall.utah` and the Facebook link
- [ ] Admission ($6 students / $7 general)
- [ ] Addresses for Mountain Valley Athletics and Cache Bar (blank for now, so Directions searches by name)
- [ ] About-section facts (opened 2021, founders). These come from a January 2023 Cache Valley Daily article.
- [ ] Fairgrounds street address: one source says 450 S 500 W, the 2023 Cache Valley Daily article says 490 S 500 W
- [ ] Remaining first-timer and FAQ copy (lesson nights and end times are confirmed)
- [ ] Fairgrounds Indoor Barn address (assumed to be at the Cache County Fairgrounds)
- [ ] Time and location for the Whispering Canyon Fundraiser (Oct 15) and USU Swing Club (Oct 22), both TBA on the flyer

## Where things live

| Path | What it is |
| --- | --- |
| `index.html` | The page |
| `admin/index.html` | Staff sign-in page with links to the editor and how-tos |
| `data/events.json` | The dance schedule (edited through Pages CMS) |
| `data/site.json` | Announcement, social links, venues, reels, FAQ, Google Calendar settings |
| `.pages.yml` | Pages CMS form definitions |
| `assets/js/main.js` | Schedule, calendar export, Google Calendar sync, reels |
| `assets/css/styles.css` | Styles |
| `assets/img/` | Logo, boot art, pattern band, favicon |

All times are Cache Valley local time (America/Denver).
