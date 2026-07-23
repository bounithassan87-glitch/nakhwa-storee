# Nakhwa Store — بوركيني Cache Terazo (Production Build)

Static, framework-free landing page. No build step required — every file in this
folder is production-ready and can be served as-is.

## Structure

```
dist/
├── index.html            # minified page
├── style.css             # minified styles
├── script.js             # minified logic
├── 404.html
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── _headers              # Netlify security + cache headers
├── _redirects            # Netlify SPA/redirect rule
├── netlify.toml          # Netlify config
├── vercel.json           # Vercel config
└── assets/
    ├── img/              # optimized JPG + WebP + thumbnails + favicons
    └── video/            # video-web.mp4 (1080p, with audio)
```

## Deploy

### Vercel
1. `npm i -g vercel`
2. From this `dist/` folder: `vercel --prod`
   (No framework, no build command — it's a static directory.)

Or drag-and-drop this folder in the Vercel dashboard → "Add New Project" → deploy.

### Netlify
- Drag-and-drop this `dist/` folder onto https://app.netlify.com/drop
- Or CLI: `npm i -g netlify-cli` then `netlify deploy --prod --dir .`

### Any static host (GitHub Pages, Cloudflare Pages, S3…)
Upload the contents of this folder to the web root.

## Before going live
- Replace `REPLACE-WITH-YOUR-DOMAIN` in `robots.txt` and `sitemap.xml`.
- (Optional) set absolute `og:image` / `twitter:image` URLs in `index.html`.

## Notes
- WhatsApp orders are sent to **+212 624273714**.
- Images are served as WebP with JPG fallback via `<picture>`.
- The product video autoplays; if the browser blocks autoplay-with-sound,
  a "شغّلي بالصوت" button appears so the customer can start it (with audio) in one tap.
