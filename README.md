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
├── video-web.mp4         # optimized product video (1080p, with audio)
├── video-poster.jpg
└── dist/                 # production build (minified + optimized) — deploy this
    ├── index.html · style.css · script.js
    ├── assets/img/ (WebP + JPG + thumbnails + favicons)
    ├── assets/video/video-web.mp4
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

The original 4K master video `0722.mp4` (~149 MB) is **git-ignored** because it
exceeds GitHub's 100 MB file limit. The committed `video-web.mp4` (~41 MB, 1080p,
with audio) is what the site uses.

---

© 2026 Nakhwa Store
