const overlayState = {
  root: null,
  card: null,
  translationEl: null,
  originalEl: null,
  statusEl: null,
  spinnerEl: null,
  statusTextEl: null,
  languageLabel: null,
  visible: false
};

const settingsState = {
  targetLanguage: 'English',
  direction: 'ltr'
};

const RTL_REGEX = /[\u0591-\u07FF\uFB1D-\uFDFF\uFE70-\uFEFC]/;
let latestRequestToken = 0;

function ensureOverlay() {
  if (overlayState.root) {
    return overlayState;
  }

  const root = document.createElement('div');
  root.id = 'qtai-overlay-root';
  root.style.position = 'absolute';
  root.style.zIndex = '2147483647';
  root.style.display = 'none';
  root.style.pointerEvents = 'none';

  const shadow = root.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }
      *, *::before, *::after {
        box-sizing: border-box;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .card {
        min-width: 240px;
        max-width: 340px;
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(247, 248, 255, 0.88));
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 16px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
        padding: 14px 16px 16px;
        color: #0f172a;
        backdrop-filter: blur(18px);
        pointer-events: auto;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      .lang-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 600;
        padding: 4px 10px;
        background: rgba(79, 70, 229, 0.12);
        color: #4338ca;
        border-radius: 999px;
      }
      .dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #6366f1;
      }
      button.close {
        border: none;
        background: rgba(15, 23, 42, 0.04);
        color: rgba(15, 23, 42, 0.6);
        border-radius: 8px;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.2s ease, color 0.2s ease;
      }
      button.close:hover {
        background: rgba(79, 70, 229, 0.12);
        color: #4f46e5;
      }
      .translation {
        font-size: 17px;
        line-height: 1.5;
        font-weight: 600;
        white-space: pre-wrap;
        color: #111827;
      }
      .original {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid rgba(148, 163, 184, 0.3);
        font-size: 13px;
        line-height: 1.5;
        color: #475569;
        white-space: pre-wrap;
      }
      .status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #6366f1;
        margin-bottom: 12px;
      }
      .spinner {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid rgba(99, 102, 241, 0.2);
        border-top-color: #4f46e5;
        animation: spin 0.9s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .hidden {
        display: none;
      }
    </style>
    <div class="card" part="card">
      <div class="header">
        <span class="lang-chip"><span class="dot"></span><span id="language-label">Translating…</span></span>
        <button class="close" type="button" aria-label="Close translation">✕</button>
      </div>
      <div class="status" id="status">
        <span class="spinner" id="spinner" aria-hidden="true"></span>
        <span id="status-text">Translating…</span>
      </div>
      <div class="translation" id="translation" dir="ltr"></div>
      <div class="original" id="original"></div>
    </div>
  `;

  const card = shadow.querySelector('.card');
  const closeButton = shadow.querySelector('button.close');
  const translationEl = shadow.getElementById('translation');
  const originalEl = shadow.getElementById('original');
  const statusEl = shadow.getElementById('status');
  const spinnerEl = shadow.getElementById('spinner');
  const statusTextEl = shadow.getElementById('status-text');
  const languageLabel = shadow.getElementById('language-label');

  closeButton.addEventListener('click', hideOverlay);

  overlayState.root = root;
  overlayState.card = card;
  overlayState.translationEl = translationEl;
  overlayState.originalEl = originalEl;
  overlayState.statusEl = statusEl;
  overlayState.spinnerEl = spinnerEl;
  overlayState.statusTextEl = statusTextEl;
  overlayState.languageLabel = languageLabel;

  document.body.appendChild(root);

  return overlayState;
}

function hideOverlay() {
  if (!overlayState.root) {
    return;
  }
  overlayState.root.style.display = 'none';
  overlayState.visible = false;
  latestRequestToken += 1;
}

function showOverlay(rect) {
  const state = ensureOverlay();
  const root = state.root;
  root.style.display = 'block';
  root.style.visibility = 'hidden';

  const initialLeft = rect.left + window.scrollX;
  const initialTop = rect.bottom + window.scrollY + 12;
  root.style.left = `${initialLeft}px`;
  root.style.top = `${initialTop}px`;

  requestAnimationFrame(() => {
    const cardRect = state.card.getBoundingClientRect();
    const viewportLeft = window.scrollX;
    const viewportTop = window.scrollY;
    const maxLeft = viewportLeft + window.innerWidth - cardRect.width - 16;
    const maxTop = viewportTop + window.innerHeight - cardRect.height - 16;

    let left = initialLeft;
    left = Math.max(viewportLeft + 16, Math.min(left, maxLeft));

    let top = initialTop;
    if (top > maxTop) {
      top = rect.top + window.scrollY - cardRect.height - 12;
    }
    top = Math.max(viewportTop + 16, Math.min(top, maxTop));

    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    root.style.visibility = 'visible';
    overlayState.visible = true;
  });
}

function updateStatus(text, isLoading) {
  const state = ensureOverlay();
  state.statusTextEl.textContent = text;
  state.statusEl.classList.toggle('hidden', !text);
  state.spinnerEl.classList.toggle('hidden', !isLoading);
}

function updateTranslation(translation, original, direction, languageLabel) {
  const state = ensureOverlay();
  state.translationEl.textContent = translation;
  state.translationEl.setAttribute('dir', direction);
  state.translationEl.setAttribute('lang', languageLabel || '');
  state.translationEl.style.textAlign = direction === 'rtl' ? 'right' : 'left';
  state.originalEl.textContent = original;
  state.originalEl.setAttribute('dir', 'auto');
  state.originalEl.classList.toggle('hidden', !original);
  state.languageLabel.textContent = languageLabel || 'Translation';
}

function detectDirection(text, fallback) {
  if (text && RTL_REGEX.test(text)) {
    return 'rtl';
  }
  return fallback || 'ltr';
}

function handleSelection() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    return;
  }

  const text = selection.toString().trim();
  if (!text) {
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return;
  }

  showOverlay(rect);
  updateStatus('Translating…', true);
  updateTranslation('', text, settingsState.direction, settingsState.targetLanguage);

  const requestToken = ++latestRequestToken;

  chrome.runtime.sendMessage(
    {
      type: 'TRANSLATE_TEXT',
      text
    },
    (response) => {
      if (requestToken !== latestRequestToken) {
        return;
      }
      if (chrome.runtime.lastError) {
        updateStatus('Could not reach the translation service.', false);
        updateTranslation('', text, settingsState.direction, settingsState.targetLanguage);
        return;
      }

      if (!response?.success) {
        updateStatus(response?.error || 'Translation failed.', false);
        updateTranslation('', text, settingsState.direction, settingsState.targetLanguage);
        return;
      }

      const direction = detectDirection(response.translation, response.direction || settingsState.direction);
      updateStatus('', false);
      updateTranslation(response.translation, text, direction, response.targetLanguage);
    }
  );
}

function refreshSettings() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
    if (response?.success) {
      settingsState.targetLanguage = response.settings.targetLanguage;
      settingsState.direction = response.settings.direction;
    }
  });
}

refreshSettings();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') {
    return;
  }
  if (changes.targetLanguage?.newValue) {
    settingsState.targetLanguage = changes.targetLanguage.newValue;
    if (overlayState.visible && overlayState.languageLabel) {
      overlayState.languageLabel.textContent = settingsState.targetLanguage;
      overlayState.translationEl?.setAttribute('lang', settingsState.targetLanguage || '');
    }
  }
  if (changes.direction?.newValue) {
    settingsState.direction = changes.direction.newValue;
    if (overlayState.visible && overlayState.translationEl) {
      overlayState.translationEl.setAttribute('dir', settingsState.direction);
      overlayState.translationEl.style.textAlign = settingsState.direction === 'rtl' ? 'right' : 'left';
    }
  }
});

document.addEventListener('dblclick', () => {
  handleSelection();
});

document.addEventListener(
  'keydown',
  (event) => {
    if (event.key === 'Escape') {
      hideOverlay();
    }
  },
  true
);

document.addEventListener(
  'mousedown',
  (event) => {
    const state = overlayState;
    if (!state.visible || !state.card) {
      return;
    }
    const path = event.composedPath();
    if (!path.includes(state.card)) {
      hideOverlay();
    }
  },
  true
);

window.addEventListener(
  'scroll',
  () => {
    if (overlayState.visible) {
      hideOverlay();
    }
  },
  true
);
