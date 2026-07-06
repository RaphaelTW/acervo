const qEl = document.getElementById("q");
const btn = document.getElementById("searchBtn");
const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");
const viewer = document.getElementById("viewerArea");
const pdfOnlyEl = document.getElementById("pdfOnly");
const thumbsEl = document.getElementById("thumbnails");
const modeBtn = document.getElementById("modeBtn");
const exportCsvBtn = document.getElementById("exportCsv");
const exportJsonBtn = document.getElementById("exportJson");
const showFavsBtn = document.getElementById("showFavs");
const favPanel = document.getElementById("favPanel");
const favListEl = document.getElementById("favList");
const closeFavs = document.getElementById("closeFavs");
const sourceChips = document.getElementById("sourceChips");

let isDark = true;
const STORAGE_FAVS = "anarch_search_favs_v1";

const EXTRA_SEARCHERS = [
  {
    name: "Project Gutenberg",
    type: "livros",
    url: (q) => `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(q)}`,
  },
  {
    name: "Google Books",
    type: "livros",
    url: (q) => `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(q)}`,
  },
  {
    name: "WorldCat",
    type: "bibliotecas",
    url: (q) => `https://search.worldcat.org/search?q=${encodeURIComponent(q)}`,
  },
  {
    name: "SciELO",
    type: "artigos",
    url: (q) => `https://search.scielo.org/?q=${encodeURIComponent(q)}`,
  },
  {
    name: "DOAJ",
    type: "artigos",
    url: (q) => `https://doaj.org/search/articles?source=%7B%22query%22%3A%7B%22query_string%22%3A%7B%22query%22%3A%22${encodeURIComponent(q)}%22%7D%7D%7D`,
  },
  {
    name: "BASE",
    type: "academico",
    url: (q) => `https://www.base-search.net/Search/Results?lookfor=${encodeURIComponent(q)}`,
  },
  {
    name: "DuckDuckGo",
    type: "web",
    url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  },
  {
    name: "Internet Archive Torrents",
    type: "torrent livre",
    url: (q) => `https://archive.org/search?query=${encodeURIComponent(q)}&and%5B%5D=downloads%3A%22Torrents%22`,
  },
  {
    name: "Academic Torrents",
    type: "torrent academico",
    url: (q) => `https://academictorrents.com/browse.php?search=${encodeURIComponent(q)}`,
  },
  {
    name: "LinuxTracker",
    type: "torrent livre",
    url: (q) => `https://linuxtracker.org/index.php?page=torrents&search=${encodeURIComponent(q)}`,
  },
  {
    name: "Public Domain Torrents",
    type: "torrent dominio publico",
    url: (q) => `https://www.publicdomaintorrents.info/nshowcat.html?category=ALL&search=${encodeURIComponent(q)}`,
  },
];

document.body.classList.add("dark");
modeBtn.addEventListener("click", () => {
  isDark = !isDark;
  document.body.classList.toggle("dark", isDark);
  modeBtn.textContent = isDark ? "Lua" : "Sol";
});

function setStatus(text) {
  statusEl.textContent = text || "";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
  }[char]));
}

function safeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function mkThumb(url, srcName) {
  const label = escapeHtml(srcName || "sem imagem");

  if (!thumbsEl.checked) {
    return `<div class="thumb"><div class="small">${label}</div></div>`;
  }

  if (!url) {
    return `<div class="thumb"><div class="small">${label}</div></div>`;
  }

  return `<div class="thumb"><img src="${url}" alt="capa"></div>`;
}

function renderSourceChips() {
  const sources = [
    "Wikimedia",
    "Internet Archive",
    "Open Library",
    ...EXTRA_SEARCHERS.map((source) => source.name),
  ];

  sourceChips.innerHTML = sources.map((source) => `<span class="chip">${escapeHtml(source)}</span>`).join("");
}

async function searchWikimedia(q, limit = 6) {
  const endpoints = [
    { name: "Wikipedia (en)", api: "https://en.wikipedia.org/w/api.php", base: "https://en.wikipedia.org/wiki" },
    { name: "Wikisource (en)", api: "https://en.wikisource.org/w/api.php", base: "https://en.wikisource.org/wiki" },
  ];
  const out = [];

  for (const ep of endpoints) {
    const url = `${ep.api}?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=${limit}&format=json&origin=*`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);

      const json = await res.json();
      (json.query?.search || []).forEach((item) => {
        out.push({
          id: `wiki:${ep.name}:${item.title}`,
          title: item.title,
          excerpt: (item.snippet || "").replace(/<[^>]+>/g, ""),
          url: `${ep.base}/${encodeURIComponent(item.title)}`,
          thumb: null,
          source: ep.name,
          type: "html",
        });
      });
    } catch (err) {
      out.push({
        id: `wiki_fallback:${ep.name}`,
        title: `Abrir pesquisa em ${ep.name}`,
        excerpt: `Erro ou bloqueio CORS: ${err.message}`,
        url: `${ep.base.replace("/wiki", "/w/index.php")}?search=${encodeURIComponent(q)}`,
        thumb: null,
        source: ep.name,
        type: "html",
      });
    }
  }

  return out;
}

async function searchOpenLibrary(q, limit = 6) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);

    const json = await res.json();
    return (json.docs || []).map((doc) => {
      const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null;
      const title = doc.title || doc.title_suggest || "Sem titulo";
      const authors = (doc.author_name || []).join(", ");
      const link = doc.key ? `https://openlibrary.org${doc.key}` : `https://openlibrary.org/search?q=${encodeURIComponent(title)}`;

      return {
        id: `ol:${doc.key || title}`,
        title,
        excerpt: authors ? `Autor(es): ${authors}` : `Ano: ${doc.first_publish_year || "?"}`,
        url: link,
        thumb: cover,
        source: "Open Library",
        type: "html",
        date: doc.first_publish_year,
      };
    });
  } catch (err) {
    return [{
      id: "ol_fallback",
      title: "Abrir pesquisa no Open Library",
      excerpt: `Erro ou bloqueio CORS: ${err.message}`,
      url: `https://openlibrary.org/search?q=${encodeURIComponent(q)}`,
      thumb: null,
      source: "Open Library",
      type: "html",
    }];
  }
}

async function searchInternetArchive(q, limit = 8) {
  const qParam = encodeURIComponent(q);
  const fl = ["identifier", "title", "creator", "description", "mediatype", "publicdate"]
    .map((field) => `fl[]=${encodeURIComponent(field)}`)
    .join("&");
  const url = `https://archive.org/advancedsearch.php?q=${qParam}&${fl}&rows=${limit}&output=json`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);

    const json = await res.json();
    const docs = json.response?.docs || [];

    return docs.map((doc) => {
      const id = doc.identifier;
      const title = doc.title || id || "Sem titulo";
      const description = doc.description || doc.creator || "";
      const mediatype = doc.mediatype || "";
      const urlItem = id ? `https://archive.org/details/${encodeURIComponent(id)}` : `https://archive.org/search.php?query=${qParam}`;
      const thumb = id ? `https://archive.org/services/img/${encodeURIComponent(id)}` : null;

      return {
        id: `ia:${id}`,
        title,
        excerpt: description,
        url: urlItem,
        thumb,
        source: "Internet Archive",
        type: /text|pdf|texts/.test(mediatype) ? "pdf" : "html",
        date: doc.publicdate,
      };
    });
  } catch (err) {
    return [{
      id: "ia_fallback",
      title: "Abrir pesquisa no Internet Archive",
      excerpt: `Erro ou bloqueio CORS: ${err.message}`,
      url: `https://archive.org/search.php?query=${encodeURIComponent(q)}`,
      thumb: null,
      source: "Internet Archive",
      type: "html",
    }];
  }
}

function buildExternalSearchResults(q) {
  return EXTRA_SEARCHERS.map((source) => ({
    id: `external:${source.name}:${q}`,
    title: `Buscar em ${source.name}`,
    excerpt: `Abrir pesquisa externa (${source.type}).`,
    url: source.url(q),
    thumb: null,
    source: source.name,
    sources: [source.name],
    type: source.type.includes("torrent") ? "torrent" : "html",
    external: true,
  }));
}

function normalizeTitle(title) {
  return safeText(String(title || "").toLowerCase().replace(/[\W_]+/g, " "));
}

function mergeResults(arr) {
  const map = new Map();

  for (const item of arr) {
    const key = item.url ? item.url.toLowerCase() : normalizeTitle(item.title);

    if (map.has(key)) {
      const existing = map.get(key);
      existing.sources = Array.from(new Set([...(existing.sources || []), item.source]));
      existing.excerpt = existing.excerpt || item.excerpt;
      existing.thumb = existing.thumb || item.thumb;
      existing.type = existing.type || item.type;
      existing.urls = Array.from(new Set([...(existing.urls || []), item.url]));
      continue;
    }

    const normalized = normalizeTitle(item.title || item.id);
    let found = null;

    for (const [candidateKey, value] of map.entries()) {
      if (item.external || value.external) continue;

      const candidate = normalizeTitle(value.title || "");
      if (!candidate) continue;

      if (candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate)) {
        found = candidateKey;
        break;
      }

      const a = new Set(candidate.split(" ").filter(Boolean));
      const b = new Set(normalized.split(" ").filter(Boolean));
      const intersection = [...a].filter((word) => b.has(word)).length;
      if (intersection >= Math.min(2, Math.max(a.size, b.size))) {
        found = candidateKey;
        break;
      }
    }

    if (found) {
      const existing = map.get(found);
      existing.sources = Array.from(new Set([...(existing.sources || []), item.source]));
      existing.excerpt = existing.excerpt || item.excerpt;
      existing.thumb = existing.thumb || item.thumb;
      existing.type = existing.type || item.type;
      existing.urls = Array.from(new Set([...(existing.urls || []), item.url]));
    } else {
      map.set(key, { ...item, sources: item.sources || [item.source], urls: [item.url] });
    }
  }

  return Array.from(map.values());
}

function scoreItem(item, query) {
  const q = normalizeTitle(query);
  let score = item.external ? 1 : 0;
  const title = normalizeTitle(item.title || "");
  const excerpt = normalizeTitle(item.excerpt || "");

  if (title.includes(q) && q.length > 2) score += 30;

  q.split(" ").filter(Boolean).forEach((word) => {
    if (title.includes(word)) score += 6;
    if (excerpt.includes(word)) score += 2;
  });

  if ((item.excerpt || "").length > 120) score += 3;
  if ((item.sources || []).includes("Internet Archive")) score += 10;
  if ((item.sources || []).includes("Open Library")) score += 6;
  if ((item.sources || []).some((source) => source.toLowerCase().includes("wik"))) score += 4;
  if ((item.type || "").includes("torrent")) score += 2;

  if (item.date) {
    const year = parseInt(String(item.date || "").slice(0, 4), 10);
    if (!Number.isNaN(year)) {
      const age = new Date().getFullYear() - year;
      if (age <= 1) score += 12;
      else if (age <= 5) score += 6;
      else if (age <= 20) score += 2;
    }
  }

  return score + Math.random() * 0.5;
}

function clearResults() {
  resultsEl.innerHTML = "";
  viewer.innerHTML = "";
}

function renderItems(items) {
  clearResults();

  if (!items.length) {
    resultsEl.innerHTML = "<div class=\"small\">Nenhum resultado.</div>";
    return;
  }

  items.forEach((item) => {
    const result = document.createElement("article");
    result.className = "result";

    const thumbHtml = mkThumb(item.thumb, item.sources ? item.sources.join(", ") : item.source);
    const primaryUrl = (item.urls && item.urls[0]) || item.url || "#";
    const favs = loadFavs();
    const isFav = favs.some((fav) => fav.url === primaryUrl);
    const sourceText = (item.sources || [item.source || ""]).join(", ");
    const typeLabel = item.type ? `<span class="source-type">${escapeHtml(item.type)}</span>` : "";

    result.innerHTML = `
      ${thumbHtml}
      <div class="meta">
        <h3>${escapeHtml(item.title || "Sem titulo")}</h3>
        <p class="small">${escapeHtml(item.excerpt || "")}</p>
        <div class="small source-line">Fonte(s): ${escapeHtml(sourceText)} ${typeLabel}</div>
      </div>
      <div class="actions">
        <a class="button" href="${primaryUrl}" target="_blank" rel="noopener">Abrir</a>
        ${item.type === "pdf" ? `<a class="button" data-url="${primaryUrl}" href="#" onclick="openEmbed(event)">Embed</a>` : ""}
        <div class="toolbar">
          <div class="star" title="Favoritar" data-url="${primaryUrl}" onclick="toggleFav(event)">${isFav ? "★" : "☆"}</div>
          <div class="small">Score: ${Math.round(item._score || 0)}</div>
        </div>
      </div>
    `;
    resultsEl.appendChild(result);
  });
}

window.openEmbed = function openEmbed(event) {
  event.preventDefault();
  const url = event.currentTarget.dataset.url;
  viewer.innerHTML = `
    <div class="viewer">
      <div class="small">Visualizador</div>
      <iframe src="${url}"></iframe>
    </div>
  `;
};

window.toggleFav = function toggleFav(event) {
  const url = event.currentTarget.dataset.url;
  const card = event.currentTarget;
  const parent = card.closest(".result");
  const title = parent.querySelector(".meta h3").textContent;
  const excerpt = parent.querySelector(".meta .small")?.textContent || "";
  const sourceText = parent.querySelector(".source-line")?.textContent || "";
  const favs = loadFavs();
  const idx = favs.findIndex((fav) => fav.url === url);

  if (idx >= 0) {
    favs.splice(idx, 1);
    card.textContent = "☆";
  } else {
    favs.push({ title, excerpt, url, source: sourceText });
    card.textContent = "★";
  }

  saveFavs(favs);
};

function loadFavs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_FAVS) || "[]");
  } catch (err) {
    return [];
  }
}

function saveFavs(arr) {
  localStorage.setItem(STORAGE_FAVS, JSON.stringify(arr));
}

function renderFavs() {
  const favs = loadFavs();

  if (!favs.length) {
    favListEl.innerHTML = "<div class=\"small\">Sem favoritos salvos.</div>";
    return;
  }

  favListEl.innerHTML = "";
  favs.forEach((fav) => {
    const item = document.createElement("div");
    item.className = "fav-item";
    item.innerHTML = `
      <div>
        <div><strong>${escapeHtml(fav.title)}</strong></div>
        <div class="small">${escapeHtml(fav.source || "")}</div>
      </div>
      <div class="fav-actions">
        <a class="button" href="${fav.url}" target="_blank" rel="noopener">Abrir</a>
        <button data-url="${fav.url}">Remover</button>
      </div>
    `;
    favListEl.appendChild(item);
    item.querySelector("button")?.addEventListener("click", () => {
      removeFav(fav.url);
      renderFavs();
    });
  });
}

function removeFav(url) {
  saveFavs(loadFavs().filter((fav) => fav.url !== url));
}

showFavsBtn.addEventListener("click", () => {
  renderFavs();
  favPanel.style.display = "block";
});

closeFavs.addEventListener("click", () => {
  favPanel.style.display = "none";
});

function exportCSV(items) {
  const headers = ["title", "excerpt", "url", "sources", "type"];
  const rows = items.map((item) => [
    item.title,
    item.excerpt,
    (item.urls && item.urls.join(" | ")) || item.url,
    (item.sources || []).join(","),
    item.type || "",
  ]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell || "").replace(/"/g, "\"\"")}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "resultados.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportJSON(items) {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "resultados.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

exportCsvBtn.addEventListener("click", () => {
  const items = window._LAST_RESULTS || [];
  if (!items.length) {
    alert("Sem resultados para exportar.");
    return;
  }
  exportCSV(items);
});

exportJsonBtn.addEventListener("click", () => {
  const items = window._LAST_RESULTS || [];
  if (!items.length) {
    alert("Sem resultados para exportar.");
    return;
  }
  exportJSON(items);
});

async function doSearch() {
  const q = safeText(qEl.value);

  if (!q) {
    setStatus("Digite termos para buscar.");
    return;
  }

  setStatus("Buscando em multiplas fontes...");
  clearResults();

  try {
    const promises = [
      searchWikimedia(q, 6),
      searchOpenLibrary(q, 6),
      searchInternetArchive(q, 8),
    ];
    const res = await Promise.all(promises);
    const all = [...res.flat().filter(Boolean), ...buildExternalSearchResults(q)];
    const merged = mergeResults(all);

    merged.forEach((item) => {
      item._score = scoreItem(item, q);
    });
    merged.sort((a, b) => (b._score || 0) - (a._score || 0));

    const pdfOnly = pdfOnlyEl.checked;
    const filtered = pdfOnly
      ? merged.filter((item) => (item.type || "").toLowerCase().includes("pdf") || (item.urls || []).some((url) => url.toLowerCase().endsWith(".pdf")))
      : merged;

    window._LAST_RESULTS = filtered;
    setStatus(`Resultados: ${filtered.length} (apos merge e ranking).`);
    renderItems(filtered);
  } catch (err) {
    setStatus(`Erro durante a busca: ${err.message}`);
  }
}

btn.addEventListener("click", doSearch);
qEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") doSearch();
});

renderSourceChips();
qEl.value = "anarchism";
doSearch();
