# TripZen — Public Site

This folder contains the static website for TripZen (privacy policy, support, terms, landing page).

It is designed to be deployed to **GitHub Pages, Netlify, Vercel, or any static host** in less than 5 minutes.

## 📂 Files

| File | Purpose |
|---|---|
| `index.html` | Landing page |
| `privacy.html` | Privacy Policy (required for App Store) |
| `support.html` | Support / FAQ page (required for App Store) |
| `terms.html` | Terms of Service |

---

## 🚀 Deploy to GitHub Pages (Free, 3 minutes)

### Option 1 — Quickest (separate repo just for the site)

```bash
# 1. Create a new public repo on GitHub, e.g. tripzen-site
# 2. From this folder:
cd /app/docs
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/tripzen-site.git
git push -u origin main

# 3. On GitHub: Settings → Pages → Source: "main branch" → Save
# 4. Your URLs will be:
#    https://YOUR-USERNAME.github.io/tripzen-site/
#    https://YOUR-USERNAME.github.io/tripzen-site/privacy.html
#    https://YOUR-USERNAME.github.io/tripzen-site/support.html
```

### Option 2 — Subfolder of your existing TripZen repo

If you already have a GitHub repo for TripZen:

```bash
# Commit /app/docs to your main repo
git add docs/
git commit -m "Add public site"
git push

# On GitHub: Settings → Pages → Source: "main branch" + "/docs folder" → Save
# Your URLs:
#    https://YOUR-USERNAME.github.io/YOUR-REPO/
#    https://YOUR-USERNAME.github.io/YOUR-REPO/privacy.html
```

---

## 🌐 Deploy to Vercel (Even Faster)

```bash
npm install -g vercel
cd /app/docs
vercel --prod
# Follow prompts — get a https://tripzen-xxx.vercel.app URL instantly
```

---

## 🔗 Deploy to Netlify (Drag &amp; Drop)

1. Open https://app.netlify.com/drop
2. Drag the `/app/docs` folder into the browser window
3. Get an instant URL like `https://tripzen-xyz.netlify.app`

---

## 🎯 Use These URLs in App Store Connect

Once deployed, plug the URLs into App Store Connect:

- **Privacy Policy URL** → `https://your-domain/privacy.html`
- **Support URL** → `https://your-domain/support.html`
- **Marketing URL** (optional) → `https://your-domain/`

---

## ✏️ Custom Domain (optional)

If you own `tripzen.app`:

1. Add a `CNAME` file in `/app/docs/` containing `tripzen.app`
2. In your DNS, point `tripzen.app` to GitHub Pages / Netlify / Vercel
3. Update Privacy URL to `https://tripzen.app/privacy.html`

---

## ⚠️ Before You Go Live

Replace these placeholder values in the HTML files:
- `privacy@tripzen.app` → your real email
- `support@tripzen.app` → your real email
- `[Your registered company address]` in privacy.html
- `[Your jurisdiction]` in terms.html

Use find &amp; replace in your editor — 2 minutes max.
