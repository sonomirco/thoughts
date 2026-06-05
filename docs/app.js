const state = {
  notes: [],
  tags: [],
  years: [],
  filtered: [],
  activeSlug: null,
  selectedTag: 'all',
  selectedYear: 'all',
};

const els = {
  noteList: document.getElementById('note-list'),
  reader: document.getElementById('reader'),
  tagFilters: document.getElementById('tag-filters'),
  yearFilter: document.getElementById('year-filter'),
  clearBtn: document.getElementById('clear-btn'),
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
  if (state.selectedTag !== 'all' && !note.tags.includes(state.selectedTag)) {
    return false;
  }

  if (state.selectedYear !== 'all' && note.date.slice(0, 4) !== state.selectedYear) {
    return false;
  }

  return true;
}

function renderTagFilters() {
  const chips = ['all', ...state.tags];
  els.tagFilters.innerHTML = chips
    .map((tag) => {
      const active = tag === state.selectedTag;
      const label = tag === 'all' ? 'All tags' : prettyTag(tag);
      return `<button class="filter-chip" type="button" data-tag="${escapeHtml(tag)}" data-active="${active}">${escapeHtml(label)}</button>`;
    })
    .join('');
}

function renderYearFilter() {
  const years = ['all', ...state.years];
  els.yearFilter.innerHTML = years
    .map((year) => {
      const label = year === 'all' ? 'All dates' : year;
      return `<option value="${escapeHtml(year)}">${escapeHtml(label)}</option>`;
    })
    .join('');

  els.yearFilter.value = state.selectedYear;
}

function renderList() {
  els.noteList.innerHTML = state.filtered.length
    ? state.filtered
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
        .join('')
    : '<div class="empty-state">No notes match these filters.</div>';
}

function renderReader(note) {
  if (!note) {
    els.reader.innerHTML = `
      <div class="reader-empty">
        <div>
          <p class="reader-kicker">Thoughts</p>
          <h2>Select a note</h2>
          <p>Choose a tag or a year, then open a note from the archive.</p>
        </div>
      </div>
    `;
    setDocumentTitle(null);
    return;
  }

  els.reader.innerHTML = `
    <header class="reader-head">
      <p class="reader-kicker">Note</p>
      <h2>${escapeHtml(note.title)}</h2>
      <div class="reader-meta">
        <time datetime="${escapeHtml(note.date)}">${escapeHtml(formatDate.format(new Date(`${note.date}T12:00:00Z`)))}</time>
      </div>
      <div class="reader-tags">
        ${note.tags.map((tag) => `<span class="tag-chip">${escapeHtml(prettyTag(tag))}</span>`).join('')}
      </div>
    </header>
    <div class="reader-body">${note.bodyHtml}</div>
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

function refreshView({ syncHash = true } = {}) {
  state.filtered = state.notes.filter(noteMatches);
  renderTagFilters();
  renderYearFilter();
  renderList();

  const current = state.filtered.find((note) => note.slug === state.activeSlug) || state.filtered[0] || null;
  state.activeSlug = current ? current.slug : null;

  renderReader(current);
  syncHash(current, syncHash);
}

function selectNote(slug, { syncHash = true } = {}) {
  state.activeSlug = slug;
  refreshView({ syncHash });
  requestAnimationFrame(scrollActiveIntoView);
}

async function boot() {
  const response = await fetch('./notes.json', { cache: 'no-store' });
  const data = await response.json();

  state.notes = data.notes;
  state.tags = [...new Set(data.tags)].sort((a, b) => a.localeCompare(b));
  state.years = [...new Set(state.notes.map((note) => note.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));

  const initialSlug = slugFromHash();
  if (initialSlug) {
    state.activeSlug = initialSlug;
  } else {
    state.activeSlug = state.notes[0]?.slug || null;
  }

  if (location.hash === '#top') {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }

  refreshView({ syncHash: true });
}

els.tagFilters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tag]');
  if (!button) return;

  state.selectedTag = button.dataset.tag;
  refreshView();
});

els.yearFilter.addEventListener('change', (event) => {
  state.selectedYear = event.target.value;
  refreshView();
});

els.noteList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-slug]');
  if (!button) return;

  selectNote(button.dataset.slug);
});

els.clearBtn.addEventListener('click', () => {
  state.selectedTag = 'all';
  state.selectedYear = 'all';
  state.activeSlug = state.notes[0]?.slug || null;
  refreshView();
});

window.addEventListener('hashchange', () => {
  const slug = slugFromHash();
  if (!slug || !getNoteBySlug(slug)) return;

  state.activeSlug = slug;
  refreshView({ syncHash: false });
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
