/* Sage Hall: schedule, venues, reels.
 *
 * Content lives in two JSON files that staff edit through Pages CMS
 * (see .pages.yml):
 *   data/events.json  -> the dance schedule
 *   data/site.json    -> announcement, venues, reels, FAQ, Google Calendar
 *
 * If site.json has a Google Calendar ID + API key, the schedule is pulled
 * from that public Google Calendar instead of events.json.
 *
 * All event times are Cache Valley wall-clock times (America/Denver).
 * Preview helper: add ?today=2026-09-12 to the URL to see the site as if it
 * were that date.
 */
(() => {
  "use strict";

  const TZ = "America/Denver";
  const DEFAULT_HOURS = 3; // calendar-export length when the venue's end time varies or isn't set
  const MAX_REELS = 3;
  const VENUE_COLORS = ["denim", "sage", "copper", "rose", "gold"];
  const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const $ = (sel, root = document) => root.querySelector(sel);

  /* Tiny DOM builder. Text is always inserted as text nodes, so anything
     typed into the CMS can't inject markup. */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  function icon(id) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", "0 0 24 24");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#i-${id}`);
    svg.append(use);
    return svg;
  }

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode etc. */ } },
  };

  /* ---------------- dates (all wall-clock strings, no tz math) ---------------- */

  function wallClock(date) {
    const parts = {};
    for (const p of new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date)) parts[p.type] = p.value;
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  }
  function todayISO() {
    const override = new URLSearchParams(location.search).get("today");
    return /^\d{4}-\d{2}-\d{2}$/.test(override || "") ? override : wallClock(new Date()).date;
  }
  const ymd = (iso) => iso.split("-").map(Number);
  const dowOf = (iso) => { const [y, m, d] = ymd(iso); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  const monthKey = (iso) => iso.slice(0, 7);
  function shiftMonth(key, n) {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  function addDays(iso, n) {
    const [y, m, d] = ymd(iso);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }
  function ordinal(n) {
    const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
    return [String(n), s];
  }
  function fmtTime(t) {
    if (!t) return "Time TBA";
    const [H, M] = t.split(":").map(Number);
    const ap = H >= 12 ? "pm" : "am";
    const h12 = H % 12 || 12;
    return M ? `${h12}:${String(M).padStart(2, "0")}${ap}` : `${h12}${ap}`;
  }
  function fmtShort(iso) { const [, m, d] = ymd(iso); return `${DOW_SHORT[dowOf(iso)]} ${MON[m - 1]} ${d}`; }
  function relativeLabel(iso, today) {
    if (iso === today) return "Tonight";
    if (iso === addDays(today, 1)) return "Tomorrow night";
    return "Next dance";
  }

  /* ---------------- data loading ---------------- */

  async function getJSON(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.json();
  }

  // IDs double as calendar-export UIDs, so they're built from the event
  // itself (not its position) to stay stable when the list is reordered.
  function fromJsonEvents(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : []).map((e) => {
      // "date" + "time" ("20:00" or "TBA"); older files used a single "start".
      const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(String(e?.date || e?.start || ""));
      if (!m) return null;
      const t = /^(\d{1,2}):(\d{2})$/.exec(String(e.time || "").trim());
      const time = t ? `${t[1].padStart(2, "0")}:${t[2]}` : (e.time ? null : m[2] || null);
      const slug = String(e.venue || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      let id = `ev-${m[1]}-${(time || "tba").replace(":", "")}-${slug}`;
      for (let n = 2; seen.has(id); n++) id = id.replace(/~\d+$/, "") + `~${n}`;
      seen.add(id);
      return {
        id,
        date: m[1], time,
        venue: String(e.venue || "").trim(),
        title: String(e.title || "").trim(),
        note: String(e.note || "").trim(),
        cancelled: Boolean(e.cancelled),
      };
    }).filter(Boolean);
  }

  async function fromGoogleCalendar({ calendar_id: id, api_key: key }) {
    const now = Date.now();
    const params = new URLSearchParams({
      key, singleEvents: "true", orderBy: "startTime", maxResults: "250",
      timeMin: new Date(now - 100 * 864e5).toISOString(),
      timeMax: new Date(now + 400 * 864e5).toISOString(),
    });
    const body = await getJSON(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?${params}`);
    return (body.items || []).filter((it) => it.status !== "cancelled").map((it) => {
      let date, time = null;
      if (it.start?.dateTime) ({ date, time } = wallClock(new Date(it.start.dateTime)));
      else date = it.start?.date;
      if (!date) return null;
      const summary = String(it.summary || "").trim();
      const cancelled = /^\s*cancel+ed\b/i.test(summary);
      const html = String(it.description || "").replace(/<br\s*\/?>|<\/(p|div|li)>/gi, "\n");
      const desc = new DOMParser().parseFromString(html, "text/html").body.textContent || "";
      return {
        id: `gc-${String(it.id).replace(/[^\w-]/g, "")}`,
        date, time,
        venue: String(it.location || "").trim(),
        title: summary.replace(/^\s*cancel+ed[\s:–-]*/i, ""),
        note: desc.split("\n").map((s) => s.trim()).find(Boolean)?.slice(0, 160) || "",
        cancelled,
        fromGoogle: true,
      };
    }).filter(Boolean);
  }

  /* Match an event's venue text to a configured venue. Google Calendar
     events may put the venue in the location or the title. */
  const GENERIC_TITLE = /^(sage hall[\s:–—-]*)?((country )?swing( dance| dancing| night)?|dance( night)?|dancing|night)?$/i;
  const TBA = /^(location\s+)?(tba|tbd)$/i;
  function resolveVenues(events, venues) {
    const byName = venues.map((v) => ({
      ...v,
      key: v.name.toLowerCase(),
      // place name + street from the address, e.g. "cache county fairgrounds", "450 s 500 w"
      addrKeys: v.address.toLowerCase().split(",").slice(0, 2).map((s) => s.trim()).filter((s) => s.length > 4),
    }));
    return events.map((ev) => {
      if (!ev.venue || TBA.test(ev.venue.trim())) {
        const v = { name: "Location TBA", address: "", color: "ink", ages21: false, note: "", tba: true };
        return { ...ev, v, ages21: /\b21\s*\+/.test(`${ev.title} ${ev.note}`) };
      }
      const loc = ev.venue.toLowerCase();
      const ttl = ev.title.toLowerCase();
      let v = byName.find((x) => x.key === loc)
        || byName.find((x) => loc && (loc.includes(x.key) || x.key.includes(loc.split(",")[0].trim())))
        || byName.find((x) => loc && x.addrKeys.some((k) => loc.includes(k)))
        || (ev.fromGoogle ? byName.find((x) => ttl.includes(x.key)) : null);
      let title = ev.title;
      if (ev.fromGoogle && v && ttl.includes(v.key)) title = title.replace(new RegExp(v.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "").replace(/^[\s·:–—-]+|[\s·:–—-]+$/g, "");
      if (ev.fromGoogle && GENERIC_TITLE.test(title.trim())) title = "";
      if (!v) v = { name: ev.venue || "Location TBA", address: ev.venue, color: "ink", ages21: false, note: "" };
      const ages21 = Boolean(v.ages21) || /\b21\s*\+/.test(`${title} ${ev.note}`);
      return { ...ev, title, v, ages21 };
    }).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  }

  /* ---------------- calendar export ---------------- */

  function stamp(date, time) { return date.replace(/-/g, "") + (time ? `T${time.replace(":", "")}00` : ""); }
  function endOf(ev) {
    if (!ev.time) return { date: addDays(ev.date, 1), time: null };
    // Venue's usual end time (e.g. "00:00"); an end at or before the start means after midnight.
    if (/^\d{2}:\d{2}$/.test(ev.v.ends || "")) return { date: ev.v.ends <= ev.time ? addDays(ev.date, 1) : ev.date, time: ev.v.ends };
    const [y, m, d] = ymd(ev.date);
    const [H, M] = ev.time.split(":").map(Number);
    const end = new Date(Date.UTC(y, m - 1, d, H + DEFAULT_HOURS, M));
    return { date: end.toISOString().slice(0, 10), time: end.toISOString().slice(11, 16) };
  }
  const eventTitle = (ev) => `Sage Hall: ${ev.title || "Country Swing"}${ev.title ? "" : ` at ${ev.v.name}`}`;
  const eventLocation = (ev) => ev.v.tba ? "" : [ev.v.name, ev.v.address && ev.v.address !== ev.v.name ? ev.v.address : ""].filter(Boolean).join(", ");
  const eventDetails = (ev) => [ev.title && !ev.v.tba ? `At ${ev.v.name}.` : "", ev.time ? "" : "Start time to be announced.", ev.v.tba ? "Location to be announced." : "", ev.note, ev.ages21 ? "21+ only." : "", "Schedule: " + location.origin + location.pathname].filter(Boolean).join(" ");

  function googleUrl(ev) {
    const end = endOf(ev);
    const p = new URLSearchParams({
      action: "TEMPLATE",
      text: eventTitle(ev),
      dates: `${stamp(ev.date, ev.time)}/${stamp(end.date, end.time)}`,
      location: eventLocation(ev),
      details: eventDetails(ev),
    });
    if (ev.time) p.set("ctz", TZ);
    return `https://calendar.google.com/calendar/render?${p}`;
  }

  const icsText = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  function icsFold(line) {
    const out = [];
    while (line.length > 74) { out.push(line.slice(0, 74)); line = " " + line.slice(74); }
    out.push(line);
    return out.join("\r\n");
  }
  function buildIcs(events) {
    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sage Hall//Dance Schedule//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VTIMEZONE", `TZID:${TZ}`,
      "BEGIN:DAYLIGHT", "TZOFFSETFROM:-0700", "TZOFFSETTO:-0600", "TZNAME:MDT", "DTSTART:19700308T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
      "BEGIN:STANDARD", "TZOFFSETFROM:-0600", "TZOFFSETTO:-0700", "TZNAME:MST", "DTSTART:19701101T020000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD",
      "END:VTIMEZONE",
    ];
    for (const ev of events) {
      const end = endOf(ev);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${ev.id.replace(/[^\w.-]/g, "")}@sagehall`,
        `DTSTAMP:${now}`,
        ev.time ? `DTSTART;TZID=${TZ}:${stamp(ev.date, ev.time)}` : `DTSTART;VALUE=DATE:${stamp(ev.date)}`,
        ev.time ? `DTEND;TZID=${TZ}:${stamp(end.date, end.time)}` : `DTEND;VALUE=DATE:${stamp(end.date)}`,
        `SUMMARY:${icsText(eventTitle(ev))}`,
        `LOCATION:${icsText(eventLocation(ev))}`,
        `DESCRIPTION:${icsText(eventDetails(ev))}`,
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");
    return lines.map(icsFold).join("\r\n") + "\r\n";
  }
  function downloadIcs(events, filename) {
    const url = URL.createObjectURL(new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" }));
    const a = h("a", { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function addToCalendar(ev, { compact = false } = {}) {
    const label = `${fmtShort(ev.date)} at ${ev.v.name}`;
    return h("details", { class: `addcal${compact ? " icon-only" : ""}` },
      h("summary", { "aria-label": `Add ${label} to your calendar`, title: "Add to calendar" },
        icon("cal"), compact ? null : h("span", { text: "Add to calendar" })),
      h("div", { class: "addcal-menu" },
        h("a", { href: googleUrl(ev), target: "_blank", rel: "noopener", text: "Google Calendar" }),
        h("button", { type: "button", text: "Apple / Outlook (.ics)", onclick: (e) => {
          downloadIcs([ev], `sage-hall-${ev.date}.ics`);
          e.currentTarget.closest("details").open = false;
        } }),
      ),
    );
  }
  function mapsUrl(v) {
    const q = v.address && v.address !== v.name ? `${v.name}, ${v.address}` : `${v.name} near Logan, UT`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  /* ---------------- rendering ---------------- */

  const state = { site: {}, venues: [], events: [], today: "", month: "", minMonth: "", maxMonth: "", view: "list", source: "json" };

  const upcoming = () => state.events.filter((e) => e.date >= state.today && !e.cancelled);
  const igHandle = () => String(state.site.instagram || "").replace(/^@/, "").trim();
  const igUrl = () => (igHandle() ? `https://www.instagram.com/${encodeURIComponent(igHandle())}/` : "https://www.instagram.com/");

  function renderAnnouncement() {
    const text = String(state.site.announcement || "").trim();
    const bar = $("#announce");
    if (!text) { bar.hidden = true; return; }
    const p = $("#announce-text");
    p.textContent = "";
    // Turn a mention of the Instagram handle into a link.
    const handle = igHandle();
    const at = handle ? text.indexOf(`@${handle}`) : -1;
    if (at >= 0) {
      p.append(text.slice(0, at), h("a", { href: igUrl(), target: "_blank", rel: "noopener", text: `@${handle}` }), text.slice(at + handle.length + 1));
    } else p.append(text);
    bar.hidden = false;
  }

  function renderSocial() {
    for (const a of document.querySelectorAll("[data-instagram-link]")) a.href = igUrl();
    for (const s of document.querySelectorAll("[data-instagram-handle]")) s.textContent = igHandle() ? `Follow @${igHandle()}` : "Follow on Instagram";
    const fb = $("#facebook-link");
    if (state.site.facebook) fb.href = state.site.facebook; else fb.closest("li").remove();
  }

  function venueBadges(ev) {
    return [
      ev.ages21 ? h("span", { class: "badge", text: "21+" }) : null,
      ev.cancelled ? h("span", { class: "badge badge-cancel", text: "Cancelled" }) : null,
    ];
  }

  function renderTicket() {
    const body = $("#next-dance .ticket-body");
    const kicker = $("#next-dance-label");
    const card = $("#next-dance");
    for (const el of card.querySelectorAll(".ticket-stub, .ticket-more")) el.remove();
    body.textContent = "";
    const list = upcoming();
    const next = list[0];

    if (!next) {
      kicker.textContent = "";
      kicker.append(icon("star"), "Next dance");
      const last = state.events.filter((e) => e.date < state.today).at(-1);
      const thisMonth = monthKey(state.today);
      const coming = last && monthKey(last.date) >= thisMonth ? shiftMonth(monthKey(last.date), 1) : thisMonth;
      body.append(h("div", { class: "ticket-empty" },
        h("h3", { text: `${MONTHS[Number(coming.slice(5)) - 1]} schedule coming soon` }),
        h("p", { text: `The flyer goes up on Instagram first.${last ? ` Last dance on the books was ${fmtShort(last.date)} at ${last.v.name}.` : ""}` }),
      ));
      card.append(h("div", { class: "ticket-stub" },
        h("a", { class: "btn btn-primary btn-small", href: igUrl(), target: "_blank", rel: "noopener" }, icon("instagram"), h("span", { text: igHandle() ? `@${igHandle()}` : "Instagram" })),
      ));
      return;
    }

    kicker.textContent = "";
    kicker.append(icon("star"), relativeLabel(next.date, state.today));
    const [, m, d] = ymd(next.date);
    body.append(...[
      h("div", { class: "ticket-when" },
        h("p", { class: "ticket-date" },
          h("span", { class: "dow", text: DOW_LONG[dowOf(next.date)].toUpperCase() }),
          h("span", { class: "md", text: `${MON[m - 1]} ${d}` })),
        h("p", { class: "ticket-time", text: fmtTime(next.time) })),
      next.title ? h("p", { class: "ticket-title", text: next.title }) : null,
      h("p", { class: `ticket-venue v-${next.v.color}` }, h("span", { class: "dot" }), h("span", { text: next.v.name }), venueBadges(next)),
      next.note ? h("p", { class: "ticket-note", text: next.note }) : null,
    ].filter(Boolean));
    card.append(h("div", { class: "ticket-stub" },
      addToCalendar(next),
      next.v.tba ? null : h("a", { class: "btn-dir", href: mapsUrl(next.v), target: "_blank", rel: "noopener" }, icon("pin"), h("span", { text: "Directions" })),
    ));
    const more = list.slice(1, 4);
    if (more.length) {
      card.append(h("div", { class: "ticket-more" },
        h("h3", { text: "Then" }),
        h("ul", null, more.map((e) => h("li", { class: `v-${e.v.color}` },
          h("span", { class: "dot" }),
          h("span", { class: "when", text: fmtShort(e.date) }),
          h("span", { text: e.v.name }),
          h("span", { class: "t", text: fmtTime(e.time) }))))));
    }
  }

  function renderLegend() {
    const used = new Set(state.events.map((e) => e.v.name));
    const items = state.venues.filter((v) => used.has(v.name));
    $("#legend").replaceChildren(...items.map((v) => h("li", { class: `v-${v.color}` }, h("span", { class: "dot" }), v.name + (v.ages21 ? " (21+)" : ""))));
  }

  function renderMonth() {
    const key = state.month;
    const [y, m] = key.split("-").map(Number);
    const title = $("#month-name");
    title.textContent = MONTHS[m - 1];
    title.append(h("span", { class: "yr", text: String(y) }));
    $("#month-prev").disabled = key <= state.minMonth;
    $("#month-next").disabled = key >= state.maxMonth;

    const monthEvents = state.events.filter((e) => monthKey(e.date) === key);
    const future = monthEvents.filter((e) => e.date >= state.today && !e.cancelled);
    const notice = $("#sched-notice");
    notice.textContent = "";
    const follow = () => h("a", { href: igUrl(), target: "_blank", rel: "noopener", text: igHandle() ? `@${igHandle()}` : "Instagram" });
    if (!monthEvents.length) {
      notice.append(`No dances posted for ${MONTHS[m - 1]} yet. The schedule usually drops near the start of the month; follow `, follow(), " to see it first.");
      notice.hidden = false;
    } else if (!future.length && key <= monthKey(state.today)) {
      notice.append(`These ${MONTHS[m - 1]} dances have already happened. The next schedule is on its way. Follow `, follow(), " for the flyer.");
      notice.hidden = false;
    } else notice.hidden = true;

    renderList(monthEvents);
    renderCalendar(key, monthEvents);

    const btn = $("#ics-month");
    btn.hidden = !future.length;
    btn.onclick = () => downloadIcs(future, `sage-hall-${key}.ics`);
    applyView();
  }

  function renderList(events) {
    $("#sched-list").replaceChildren(...events.map((ev) => {
      const [, , d] = ymd(ev.date);
      const [n, suf] = ordinal(d);
      const past = ev.date < state.today;
      const cls = ["sched-row", `v-${ev.v.color}`, past && "is-past", ev.cancelled && "is-cancelled", ev.date === state.today && "is-today"].filter(Boolean).join(" ");
      // A special night leads with its title; the venue moves to the sub-line.
      const sub = [ev.title ? ev.v.name : "", ev.note].filter(Boolean).join(" · ");
      return h("li", { class: cls, id: ev.id },
        h("span", { class: "d-num" }, n, h("sup", { text: suf })),
        h("span", { class: "d-dow", text: DOW[dowOf(ev.date)] }),
        h("div", { class: "d-main" },
          h("div", { class: "d-venue" }, h("span", { class: "dot" }), h("span", { class: `v-name${ev.title ? " is-special" : ""}`, text: ev.title || ev.v.name }), venueBadges(ev),
            ev.date === state.today && !ev.cancelled ? h("span", { class: "badge badge-today", text: "Tonight" }) : null),
          sub ? h("div", { class: "d-sub", text: sub }) : null),
        h("span", { class: "d-time", text: fmtTime(ev.time) }),
        h("span", { class: "addcal-slot" }, !past && !ev.cancelled ? addToCalendar(ev, { compact: true }) : null),
      );
    }));
  }

  function renderCalendar(key, events) {
    const first = `${key}-01`;
    const lead = dowOf(first);
    const [y, m] = key.split("-").map(Number);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = DOW_SHORT.map((d, i) => h("div", { class: "cal-dow", title: DOW_LONG[i] }, d));
    for (let i = 0; i < lead; i++) cells.push(h("div", { class: "cal-cell is-out", "aria-hidden": "true" }));
    for (let day = 1; day <= days; day++) {
      const iso = `${key}-${String(day).padStart(2, "0")}`;
      const todays = events.filter((e) => e.date === iso);
      const cls = ["cal-cell", iso < state.today && "is-past", iso === state.today && "is-today"].filter(Boolean).join(" ");
      cells.push(h("div", { class: cls },
        h("span", { class: "cal-day", text: String(day) }),
        todays.map((ev) => h("button", {
          type: "button", class: `chip v-${ev.v.color}${ev.cancelled ? " is-cancelled" : ""}`,
          "aria-label": `${fmtShort(ev.date)}, ${fmtTime(ev.time)}, ${ev.v.name}${ev.cancelled ? ", cancelled" : ""}. Show in list.`,
          onclick: () => showInList(ev.id),
        }, h("span", { class: "ct", text: ev.time ? fmtTime(ev.time) : "TBA" }), h("span", { class: "cv", text: ev.title || ev.v.name })))));
    }
    const trail = (7 - ((lead + days) % 7)) % 7;
    for (let i = 0; i < trail; i++) cells.push(h("div", { class: "cal-cell is-out", "aria-hidden": "true" }));
    $("#sched-cal").replaceChildren(...cells);
  }

  function showInList(id) {
    setView("list");
    const row = document.getElementById(id);
    if (!row) return;
    row.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    row.classList.add("is-flash");
    setTimeout(() => row.classList.remove("is-flash"), 1600);
  }

  function setView(view) {
    state.view = view === "calendar" ? "calendar" : "list";
    store.set("sagehall:view", state.view);
    applyView();
  }
  function applyView() {
    $("#sched-list").hidden = state.view !== "list";
    $("#sched-cal").hidden = state.view !== "calendar";
    for (const b of document.querySelectorAll(".view-toggle button")) b.setAttribute("aria-pressed", String(b.dataset.view === state.view));
  }

  function renderSubscribe() {
    const box = $("#subscribe");
    const id = state.site.google_calendar?.calendar_id;
    if (state.source !== "google" || !id) { box.hidden = true; return; }
    $("#sub-google").href = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(id)}`;
    $("#sub-ical").href = `webcal://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`;
    box.hidden = false;
  }

  function renderFirstTime() {
    const steps = (state.site.first_time || []).filter((s) => s?.title || s?.text);
    $("#first-time-list").replaceChildren(...steps.map((s) => h("li", null, h("h3", { text: s.title || "" }), h("p", { text: s.text || "" }))));
    const price = String(state.site.admission || "").trim();
    $("#admission").hidden = !price;
    $("#admission-price").textContent = price;
    $(".ft-bottom").classList.toggle("no-admission", !price);
    const faq = (state.site.faq || []).filter((f) => f?.question);
    $("#faq").replaceChildren(...faq.map((f) => h("details", null, h("summary", { text: f.question }), h("p", { text: f.answer || "" }))));
  }

  function renderVenues() {
    const list = upcoming();
    $("#venue-grid").replaceChildren(...state.venues.map((v) => {
      const next = list.find((e) => e.v.name === v.name);
      return h("article", { class: `venue v-${v.color}` },
        h("h3", null, v.name, v.ages21 ? h("span", { class: "badge", text: "21+" }) : null),
        v.note ? h("p", { text: v.note }) : null,
        v.address ? h("p", { class: "addr", text: v.address }) : null,
        h("a", { class: "btn-dir", href: mapsUrl(v), target: "_blank", rel: "noopener" }, icon("pin"), h("span", { text: "Directions" })),
        h("p", { class: "next" }, next ? ["Next night here: ", h("b", { text: `${fmtShort(next.date)}, ${fmtTime(next.time)}` })] : "Watch the schedule for the next night here."),
      );
    }));
  }

  /* ---------------- Instagram reels ---------------- */

  function normalizeInstagram(raw) {
    try {
      const url = new URL(String(raw).trim());
      if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return null;
      const m = url.pathname.match(/^\/(?:[\w.]+\/)?(reels?|p|tv)\/([\w-]+)/i);
      if (!m) return null;
      const kind = m[1].toLowerCase().startsWith("reel") ? "reel" : m[1].toLowerCase();
      return `https://www.instagram.com/${kind}/${m[2]}/`;
    } catch { return null; }
  }

  let igScriptRequested = false;
  function loadInstagramEmbeds() {
    if (window.instgrm?.Embeds) { window.instgrm.Embeds.process(); return; }
    if (igScriptRequested) return;
    igScriptRequested = true;
    const s = h("script", { src: "https://www.instagram.com/embed.js", async: true });
    s.onload = () => window.instgrm?.Embeds.process();
    document.body.append(s);
  }

  function renderReels() {
    const grid = $("#reel-grid");
    const urls = (state.site.reels || []).map(normalizeInstagram).filter(Boolean).slice(0, MAX_REELS);
    if (!urls.length) {
      grid.replaceChildren(...[1, 2, 3].map((i) => h("div", { class: "reel-placeholder" },
        h("span", { class: "play" }, icon("play")),
        h("strong", { text: `Reel slot ${i}` }),
        h("span", { text: "Paste an Instagram reel link in Site settings to fill this spot." }))));
      return;
    }
    grid.replaceChildren(...urls.map((u) => h("div", { class: "reel" },
      h("blockquote", { class: "instagram-media", "data-instgrm-permalink": u, "data-instgrm-version": "14" },
        h("a", { href: u, target: "_blank", rel: "noopener", text: "Watch this reel on Instagram" })))));
    // Only pull in Instagram's script once the section is close to the screen.
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { io.disconnect(); loadInstagramEmbeds(); }
      }, { rootMargin: "600px 0px" });
      io.observe(grid);
    } else loadInstagramEmbeds();
  }

  /* ---------------- chrome: nav + dropdowns ---------------- */

  function wireChrome() {
    // Keep in-page jumps flush with the sticky header. Tuck the section 1px under
    // the header's bottom border so sub-pixel rounding never shows the section above.
    const header = $(".site-header");
    const setHeaderOffset = () => document.documentElement.style.setProperty(
      "--header-offset", `${Math.max(0, Math.ceil(header.getBoundingClientRect().height) - 1)}px`);
    setHeaderOffset();
    if ("ResizeObserver" in window) new ResizeObserver(setHeaderOffset).observe(header);
    else addEventListener("resize", setHeaderOffset);

    const btn = $(".menu-btn");
    const nav = $("#site-nav");
    const close = () => { nav.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", () => {
      const open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      close();
      for (const d of document.querySelectorAll("details.addcal[open]")) d.open = false;
    });
    // Only one add-to-calendar menu open at a time; click outside closes it.
    document.addEventListener("toggle", (e) => {
      if (!e.target.matches?.("details.addcal") || !e.target.open) return;
      for (const d of document.querySelectorAll("details.addcal[open]")) if (d !== e.target) d.open = false;
    }, true);
    document.addEventListener("click", (e) => {
      for (const d of document.querySelectorAll("details.addcal[open]")) if (!d.contains(e.target)) d.open = false;
    });
    $("#month-prev").addEventListener("click", () => { state.month = shiftMonth(state.month, -1); renderMonth(); });
    $("#month-next").addEventListener("click", () => { state.month = shiftMonth(state.month, 1); renderMonth(); });
    for (const b of document.querySelectorAll(".view-toggle button")) b.addEventListener("click", () => setView(b.dataset.view));
    $("#year").textContent = state.today.slice(0, 4);
  }

  /* ---------------- themes (classic / fall) ---------------- */

  // The inline script in index.html applies the theme before first paint; this
  // keeps it in sync once site.json has loaded and wires up the switcher.
  const THEMES = ["classic", "fall"];
  const THEME_COLOR = { classic: "#20448c", fall: "#22160f" };

  function chosenTheme() {
    const q = new URLSearchParams(location.search).get("theme");
    if (THEMES.includes(q)) return q;
    const saved = store.get("sagehall:theme");
    return THEMES.includes(saved) ? saved : null;
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "fall") root.setAttribute("data-theme", "fall");
    else root.removeAttribute("data-theme");
    for (const b of document.querySelectorAll("[data-theme-choice]")) b.setAttribute("aria-pressed", String(b.dataset.themeChoice === theme));
    $('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
    setFallingLeaves(theme === "fall");
  }

  function setFallingLeaves(on) {
    const hero = $(".hero");
    const existing = hero.querySelector(".leaf-fall");
    if (!on) { existing?.remove(); return; }
    if (existing || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#ee8b3a", "#c0392b", "#f4b544", "#a0522d", "#d9682b", "#8f9a3c"];
    const box = h("div", { class: "leaf-fall", "aria-hidden": "true" });
    for (let i = 0; i < 12; i++) {
      const r = () => Math.random();
      box.append(h("span", {
        style: `--x:${(i * 8.3 + r() * 6).toFixed(1)}%;--s:${Math.round(14 + r() * 14)}px;--d:${(10 + r() * 8).toFixed(1)}s;` +
               `--delay:${(-r() * 18).toFixed(1)}s;--sway:${Math.round(30 + r() * 60)}px;color:${colors[i % colors.length]}`,
      }, icon(i % 3 ? "leaf-maple" : "leaf-oval")));
    }
    hero.prepend(box);
  }

  function initTheme() {
    const fallback = THEMES.includes(state.site.theme) ? state.site.theme : "classic";
    store.set("sagehall:default-theme", fallback); // lets the inline script avoid a flash next visit
    applyTheme(chosenTheme() || fallback);

    const sw = $("#theme-switch");
    sw.hidden = state.site.theme_switcher === false;
    for (const b of sw.querySelectorAll("[data-theme-choice]")) {
      b.addEventListener("click", () => {
        const t = b.dataset.themeChoice;
        store.set("sagehall:theme", t);
        const url = new URL(location.href);
        url.searchParams.set("theme", t); // keep the address bar shareable
        history.replaceState(null, "", url);
        applyTheme(t);
      });
    }
  }

  /* ---------------- boot ---------------- */

  async function init() {
    state.today = todayISO();
    state.view = store.get("sagehall:view") === "calendar" ? "calendar" : "list";
    wireChrome();

    try { state.site = await getJSON("data/site.json"); }
    catch (err) { console.error("Couldn't load site settings", err); state.site = {}; }
    initTheme();

    state.venues = (state.site.venues || []).filter((v) => v?.name).map((v) => ({
      name: String(v.name).trim(),
      address: String(v.address || "").trim(),
      color: VENUE_COLORS.includes(v.color) ? v.color : "ink",
      ages21: Boolean(v.ages21),
      note: String(v.note || "").trim(),
      ends: String(v.ends || "").trim(),
    }));

    let raw = [];
    const gc = state.site.google_calendar || {};
    if (gc.calendar_id && gc.api_key) {
      try { raw = await fromGoogleCalendar(gc); state.source = "google"; }
      catch (err) { console.warn("Google Calendar unavailable, falling back to data/events.json", err); }
    }
    if (state.source !== "google") {
      try { raw = fromJsonEvents((await getJSON("data/events.json")).events); }
      catch (err) { console.error("Couldn't load events", err); }
    }
    state.events = resolveVenues(raw, state.venues);

    // Month range: everything with events, plus the current month.
    const months = state.events.map((e) => monthKey(e.date));
    const thisMonth = monthKey(state.today);
    state.minMonth = [thisMonth, ...months].sort()[0];
    state.maxMonth = [thisMonth, ...months].sort().at(-1);
    const next = upcoming()[0];
    const pastMonths = months.filter((k) => k <= thisMonth);
    state.month = next ? monthKey(next.date) : (pastMonths.at(-1) || thisMonth);

    renderAnnouncement();
    renderSocial();
    renderTicket();
    renderLegend();
    renderMonth();
    renderSubscribe();
    renderFirstTime();
    renderVenues();
    renderReels();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
