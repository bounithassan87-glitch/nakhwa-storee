# Nakhwa Store — بوركيني Cache Terazo (Landing Page)

Premium, mobile-first, Arabic/RTL **COD landing page** for the Moroccan market.
Static and framework-free (HTML + CSS + vanilla JS) — deploys anywhere.

**Orders are WhatsApp-native (COD):** the order form builds a single WhatsApp
message (product, quantity, per-piece size/color, total) and sends it to
**+212 624273714**.

## Highlights

- Two-column premium hero (stacked on mobile) with real product-photo color switcher.
- Product video with audio (autoplays; one-tap "play with sound" fallback when the
  browser blocks autoplay-with-audio).
- Offers: 1 piece 299 DH / 2 pieces 549 DH, with a smart single-order form
  (choose 2 pieces → pick a different size & color for each).
- Gallery lightbox (swipe / zoom / keyboard), sizes L · XL · 2XL · 3XL,
  sticky CTA, floating WhatsApp button.
- SEO (Open Graph, Twitter, JSON-LD), accessibility, lazy loading, WebP images.

## Structure

```
.
├── index.html            # dev source (edit here)
├── style.css
├── script.js
├── DSC*.jpg / png.png    # source product photos + logo
├── 2026.mp4              # hero video, web rendition (1080x1920, with audio)
├── 2026-poster.jpg       # poster frame taken from 2026.mp4
└── dist/                 # production build (minified + optimized) — deploy this
    ├── index.html · style.css · script.js
    ├── assets/img/ (WebP + JPG + thumbnails + favicons)
    ├── assets/video/2026.mp4
    ├── robots.txt · sitemap.xml · site.webmanifest · 404.html
    └── vercel.json · netlify.toml · _headers · _redirects
```

## Run locally

Open `index.html` directly, or serve the folder:

```bash
npx serve .
```

## Deploy (production build in `dist/`)

- **Netlify:** drag-and-drop the `dist/` folder onto https://app.netlify.com/drop
- **Vercel:** from `dist/` run `vercel --prod`
- **Any static host:** upload the contents of `dist/`

Before going live, replace `REPLACE-WITH-YOUR-DOMAIN` in `dist/robots.txt` and
`dist/sitemap.xml`.

## Note

4K masters are **git-ignored** — they exceed GitHub's 100 MB file limit:
`2026-master.mp4` (155 MB, 2160×3840) for the current hero video and
`0722.mp4` (149 MB) for the previous one. What the site serves is the
committed web rendition `2026.mp4` (16.7 MB, 1080×1920, 3.1 Mbps, with audio).

Regenerate it from a master with:

```bash
ffmpeg -i 2026-master.mp4 -vf "scale=1080:1920:flags=lanczos" \
  -c:v libx264 -profile:v high -level 4.0 -preset slower -crf 30 \
  -pix_fmt yuv420p -g 60 -maxrate 3000k -bufsize 6000k \
  -c:a aac -b:a 96k -ac 2 -movflags +faststart 2026.mp4
```

`-movflags +faststart` is required: without it the MP4 index sits at the end of
the file and the browser must download the whole thing before the first frame.
The poster comes from the same source — `ffmpeg -ss 1.5 -i 2026-master.mp4
-frames:v 1 -vf "scale=1080:1920" -q:v 4 2026-poster.jpg`.

Give a replacement a **new filename**: `/assets/video/*` and `/assets/img/*` are
served `immutable`, so reusing a name would keep the old file on every device
that has already visited.

---

© 2026 Nakhwa Store
