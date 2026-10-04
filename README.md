# Sage Hall: website mock-up

A concept redesign for [Sage Hall](https://sagehalldance.com), the country swing dance in Logan, Utah. It's a plain static site (HTML, CSS, a little JavaScript, no build step), so it runs on GitHub Pages as is.

**What's in it**

- **Schedule** with a flyer-style list view and a month calendar. Past nights grey out automatically. Visitors can add any night, or the whole month, to Google, Apple or Outlook calendars.
- **Next dance** ticket at the top of the page, with directions and the next few nights.
- **Staff sign-in** at `/admin` for editing the schedule, reels, venues and FAQ through simple forms ([Pages CMS](https://pagescms.org)). No code, no GitHub account needed.
- **Optional Google Calendar sync.** Paste a calendar ID and the site reads the schedule live from Google Calendar instead.
- **On the floor**: a weekly *Dancers of the Week* spotlight, up to three Instagram reels, and a *This week's photos* gallery with a full-screen viewer.
- First-timer guide, FAQ, venues, and an about section.
- **Four seasonal looks** that share the same schedule and content:
  - *Spring*: Cache Valley mountains and forest, with snow on the peaks, topo-map lines, a trail-sign ribbon and drifting aspen leaves.
  - *Summer*: cream and denim, from the September flyer.
  - *Fall*: barn wood, pumpkins and autumn leaves, from the October flyer.
  - *Winter*: a snowy night, pine boughs, buffalo plaid and falling snow.

The western pattern band and boot bouquet are cut from Sage Hall's September flyer. The other seasonal artwork (mountain scene, park badge, topo lines, wood texture, pumpkin, leaves, garlands, pine, snowy hills) was drawn for this site.

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

## 4. Seasonal themes

All four looks are the same page with different styling, so they always show the same schedule and settings. There's nothing extra to host.

- **Links to share:** add `?theme=spring`, `?theme=summer`, `?theme=fall` or `?theme=winter` to the site address, e.g. `https://alejandro-usu.github.io/sagehall/?theme=winter`. Older `?theme=classic` links still work and open Summer.
- **Switch in the corner:** a Spring / Summer / Fall / Winter toggle floats in the bottom-right corner (icons only on phones). It remembers the visitor's pick.
- **Default look:** **Site settings → Site theme** sets what first-time visitors see, so staff can change it with the seasons.
- **Hide the switch** when the site goes live with **Site settings → Show theme switcher**.

Summer is the base stylesheet (`assets/css/styles.css`). Each other season is a small file on top of it (`theme-spring.css`, `theme-fall.css`, `theme-winter.css`), scoped to `<html data-theme="...">`. Venue colors stay the same in every season, so Cache Bar is always the same color.

## 5. Dancers of the Week and weekly photos

Staff update both under **Dancers of the Week & photos** in the editor (or from `/admin`):

- **Dancers of the Week:** the week, names, a short shout-out, a photo, and optionally an Instagram reel link. Leave the names blank and the site shows "Our first pick is coming soon" (that's how it starts, since this is a new tradition).
- **This week's photos:** up to 12 photos with optional captions, replaced each week. Visitors can tap one to view it full screen, and the section asks anyone who wants a photo taken down to message on Instagram.

**Phone photos are shrunk automatically.** When a photo is uploaded, `.github/workflows/shrink-photos.yml` runs `.github/scripts/shrink_photos.py`, which:

1. turns photos the right way up,
2. resizes anything bigger than 1600px,
3. strips camera data, including GPS location,
4. commits the smaller file, keeping the same name,
5. asks GitHub Pages to republish.

It needs no setup beyond GitHub Actions being enabled on the repo (the default).

## 6. Instagram reels

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
| `data/site.json` | Announcement, theme, social links, venues, reels, FAQ, Google Calendar settings |
| `data/weekly.json` | Dancers of the Week and this week's photos |
| `assets/uploads/` | Photos uploaded through the editor |
| `.github/workflows/shrink-photos.yml` | Shrinks uploaded photos and strips their location data |
| `.pages.yml` | Pages CMS form definitions |
| `assets/js/main.js` | Schedule, calendar export, Google Calendar sync, reels |
| `assets/css/styles.css` | Styles (the Summer look) |
| `assets/css/theme-spring.css`, `theme-fall.css`, `theme-winter.css` | The other seasonal looks, applied on top of the Summer styles |
| `assets/img/` | Logos (regular and light-on-dark), seasonal artwork, pattern band, favicon |

All times are Cache Valley local time (America/Denver).
