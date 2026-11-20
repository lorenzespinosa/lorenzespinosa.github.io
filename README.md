# lorenzespinosa.github.io

The personal site and blog. Static HTML, CSS, and JavaScript with no build
step. Served by GitHub Pages straight from `main`.

- `index.html` is the landing page (about, work highlights, FAQ)
- `blog/` holds the long-form articles
- `styles/` holds the styles and `js/` holds the scripts. The homepage cursor
  animation in `js/swarm-motion.js` is plain, readable JavaScript.
- `sitemap.xml`, `robots.txt`, and `llms.txt` describe the site to crawlers

## Working on it

Open `index.html` directly in a browser, or serve the folder locally so
root-absolute links resolve:

    python3 -m http.server

Pushing to `main` publishes. Every page carries its own meta description,
and internal links and anchors are checked before each change.

## Other work

Public projects live in separate repositories; the profile README at
github.com/lorenzespinosa lists what is worth inspecting.
