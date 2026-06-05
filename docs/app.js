const state = {
  notes: [],
  filtered: [],
  activeSlug: null,
  activeTag: 'all',
};

const els = {
  noteList: document.getElementById('note-list'),
  reader: document.getElementById('reader'),
  catalogStatus: document.getElementById('catalog-status'),
};

const formatDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hashForSlug(slug) {
  return `#note=${encodeURIComponent(slug)}`;
}

function slugFromHash() {
  const match = location.hash.match(/(?:^#note=)(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function setDocumentTitle(note) {
  document.title = note ? `${note.title} · Thoughts` : 'Thoughts';
}

function getNoteBySlug(slug) {
  return state.notes.find((note) => note.slug === slug) || null;
}

function prettyTag(tag) {
  return tag
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function noteMatches(note) {
  return state.activeTag === 'all' || note.tags.includes(state.activeTag);
}

function renderCatalogStatus() {
  if (state.activeTag === 'all') {
    els.catalogStatus.textContent = 'Latest notes first';
    return;
  }

  const count = state.filtered.length;
  els.catalogStatus.textContent = `Filtered by ${prettyTag(state.activeTag)} · ${count} note${count === 1 ? '' : 's'}`;
}

function renderList() {
  if (!state.filtered.length) {
    els.noteList.innerHTML = '<div class="empty-state">No notes match this tag.</div>';
    return;
  }

  const groups = new Map();
  for (const note of state.filtered) {
    const year = note.date.slice(0, 4);
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(note);
  }

  els.noteList.innerHTML = [...groups.entries()]
    .map(
      ([year, notes]) => `
        <section class="year-group">
          <h3 class="year-heading">${escapeHtml(year)}</h3>
          <div class="year-list">
            ${notes
              .map((note) => {
                const active = note.slug === state.activeSlug;
                return `
                  <button class="note-btn" type="button" data-slug="${escapeHtml(note.slug)}" data-active="${active}">
                    <div class="note-meta-line">
                      <time datetime="${escapeHtml(note.date)}">${escapeHtml(formatDate.format(new Date(`${note.date}T12:00:00Z`)))}</time>
                    </div>
                    <h3>${escapeHtml(note.title)}</h3>
                  </button>
                `;
              })
              .join('')}
          </div>
        </section>
      `
    )
    .join('');
}

function renderTagChips(tags) {
  return tags
    .map((tag) => {
      const active = tag === state.activeTag;
      return `<button type="button" class="tag-chip tag-chip-button" data-tag="${escapeHtml(tag)}" data-active="${active}" aria-pressed="${active}">${escapeHtml(prettyTag(tag))}</button>`;
    })
    .join('');
}

function renderConnections(note) {
  const related = note.links
    .map((slug) => getNoteBySlug(slug))
    .filter(Boolean)
    .map((target) => `<a class="pill" href="${hashForSlug(target.slug)}">${escapeHtml(target.title)}</a>`)
    .join('');

  return `
    <section class="reader-section">
      <h3 class="section-label">Connected notes</h3>
      <div class="pill-row">
        ${related || '<span class="empty-state">No connected notes yet.</span>'}
      </div>
    </section>
  `;
}

function renderReferences(note) {
  if (!note.footerHtml) {
    return '';
  }

  return `
    <section class="reader-section">
      <h3 class="section-label">References</h3>
      <div class="reader-body footer-copy">${note.footerHtml}</div>
    </section>
  `;
}

function renderReader(note) {
  if (!note) {
    els.reader.innerHTML = `
      <div class="reader-empty">
        <div>
          <p class="reader-kicker">Thoughts</p>
          <h2>Select a note</h2>
          <p>Pick a note from the archive or click a tag inside a note to narrow the catalogue.</p>
        </div>
      </div>
    `;
    setDocumentTitle(null);
    return;
  }

  els.reader.innerHTML = `
    <article class="reader-article">
      <header class="reader-head">
        <p class="reader-kicker">Note</p>
        <h2>${escapeHtml(note.title)}</h2>
        <div class="reader-meta">
          <time datetime="${escapeHtml(note.date)}">${escapeHtml(formatDate.format(new Date(`${note.date}T12:00:00Z`)))}</time>
        </div>
        <div class="reader-tags">
          ${renderTagChips(note.tags)}
        </div>
      </header>

      <div class="reader-body">${note.bodyHtml}</div>
    </article>

    ${renderReferences(note)}
    ${renderConnections(note)}
  `;

  setDocumentTitle(note);
}

function scrollActiveIntoView() {
  const activeButton = document.querySelector(`[data-slug="${CSS.escape(state.activeSlug || '')}"]`);
  activeButton?.scrollIntoView({ block: 'nearest' });
}

function syncHash(note, shouldSyncHash) {
  if (!shouldSyncHash) return;

  const next = note ? hashForSlug(note.slug) : `${location.pathname}${location.search}`;
  history.replaceState(null, '', next);
}

function refreshView({ updateHash = true } = {}) {
  state.filtered = state.notes.filter(noteMatches);
  renderCatalogStatus();
  renderList();

  const current = state.filtered.find((note) => note.slug === state.activeSlug) || state.filtered[0] || null;
  state.activeSlug = current ? current.slug : null;

  renderReader(current);
  syncHash(current, updateHash);
}

function selectNote(slug, { syncHash = true } = {}) {
  const note = getNoteBySlug(slug);
  if (!note) return;

  state.activeSlug = note.slug;
  refreshView({ updateHash: syncHash });
  requestAnimationFrame(scrollActiveIntoView);
}

function setTagFilter(tag) {
  state.activeTag = state.activeTag === tag ? 'all' : tag;
  refreshView();
  requestAnimationFrame(scrollActiveIntoView);
}

async function boot() {
  const response = await fetch('./notes.json', { cache: 'no-store' });
  const data = await response.json();

  state.notes = data.notes;
  state.activeSlug = slugFromHash() || state.notes[0]?.slug || null;

  if (location.hash === '#top') {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }

  refreshView({ updateHash: true });
}

els.noteList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-slug]');
  if (!button) return;

  selectNote(button.dataset.slug);
});

els.reader.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tag]');
  if (!button) return;

  setTagFilter(button.dataset.tag);
});

window.addEventListener('hashchange', () => {
  const slug = slugFromHash();
  if (!slug || !getNoteBySlug(slug)) return;

  state.activeSlug = slug;
  refreshView({ updateHash: false });
  requestAnimationFrame(scrollActiveIntoView);
});

boot().catch((error) => {
  console.error(error);
  els.reader.innerHTML = `
    <div class="reader-empty">
      <div>
        <p class="reader-kicker">Error</p>
        <h2>Could not load notes</h2>
        <p>${escapeHtml(error.message)}</p>
      </div>
    </div>
  `;
});
