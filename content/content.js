const ext = typeof browser !== "undefined" ? browser : chrome;
const runtime = ext.runtime;

// Add to top of file
function setSafeHTML(element, htmlString) {
    element.textContent = ''; // Clear current content
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    element.append(...doc.body.childNodes); // Append new safe nodes
}

(() => {
  
  let lastSelectionCoords = null;
  let currentSelectedTerm = ""; // Track current selection

  const DEFAULTS = {
    maxLen: 64,
    popupTriggerMode: "hotkey",
    customHotkey: "",
    enabled: true,
    showQuickButton: true,
    targetLanguage: "en"
  };

  const STATE = {
    lastSel: "",
    shadowHost: null,
    ui: null,
    enabled: true,
    popupTriggerMode: DEFAULTS.popupTriggerMode,
    customHotkey: DEFAULTS.customHotkey,
    maxLen: DEFAULTS.maxLen,
    justOpenedAt: 0,
    buttonTimeout: null,
    isCardVisible: false,
    isExpanded: false,
    fullData: null,
    targetLanguage: "en"
  };
  // Insert at top of content.js (or merge with existing code)
const LW_CONTAINER_ID = 'lw-card';

// create container if missing
function ensureContainer() {
  let el = document.getElementById(LW_CONTAINER_ID);
  if (el) return el;
  el = document.createElement('div');
  el.id = LW_CONTAINER_ID;
  el.setAttribute('role', 'dialog');
  el.classList.add('lw-popup-container');
  document.body.appendChild(el);
  return el;
}

// attach event handlers (close on Esc / outside click)
function attachGenericHandlers(container) {
  function onKey(e) {
    if (e.key === 'Escape') hideContainer();
  }
  function onDocClick(e) {
    if (!container.contains(e.target)) hideContainer();
  }
  document.addEventListener('keydown', onKey);
  document.addEventListener('mousedown', onDocClick);
  // store to remove later
  container.__lw_handlers = { onKey, onDocClick };
}

function removeGenericHandlers(container) {
  if (!container || !container.__lw_handlers) return;
  const { onKey, onDocClick } = container.__lw_handlers;
  document.removeEventListener('keydown', onKey);
  document.removeEventListener('mousedown', onDocClick);
  delete container.__lw_handlers;
}

function showContainerWithHtml(html, x, y) {
  const container = ensureContainer();
  setSafeHTML(container, html);
  container.style.position = 'absolute';
  // basic positioning: prefer near selection if available, else center
  if (typeof x === 'number' && typeof y === 'number') {
    container.style.left = Math.max(8, x) + 'px';
    container.style.top = Math.max(8, y) + 'px';
  } else {
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.top = '120px';
  }
  container.classList.add('show');
  attachGenericHandlers(container);

  // hook audio play button (if present)
  const audioBtn = container.querySelector('.lw-audio-btn');
  if (audioBtn) {
    audioBtn.addEventListener('click', (ev) => {
      const word = container.querySelector('.lw-word')?.textContent?.trim();
      if (!word) return;
      const lang = (container.querySelector('[data-lw-lang]')?.dataset?.lwLang) || 'en';
      // use Google TTS endpoint (module has buildGoogleTtsUrl, but content can't import module)
      const ttsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${lang}&q=${encodeURIComponent(word)}`;
      const audio = new Audio(ttsUrl);
      audio.play();
    });
  }

  // hook external source buttons (open Google, Wikipedia etc.)
  container.querySelectorAll('.lw-external-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget.dataset.target;
      const word = container.querySelector('.lw-word')?.textContent?.trim();
      if (!word) return;
      let url = '';
      if (target === 'google') url = `https://www.google.com/search?q=${encodeURIComponent(word)}+meaning`;
      if (target === 'wikipedia') url = `https://en.wikipedia.org/wiki/${encodeURIComponent(word)}`;
      if (url) window.open(url, '_blank');
    });
  });
}

function hideContainer() {
  const container = document.getElementById(LW_CONTAINER_ID);
  if (!container) return;
  removeGenericHandlers(container);
  container.classList.remove('show');
  // optional: clear content to free memory
  setSafeHTML(container, '');
  // keep element present for next show
}

// ✅ ADD TO HISTORY: Save looked-up words to extension storage
async function addToHistory(data) {
  try {
    if (!data || !data.word) return;
    
    const ext = typeof browser !== "undefined" ? browser : chrome;
    const { history = [] } = await ext.storage.local.get('history');
    
    // Check if word already exists
    const existingIndex = history.findIndex(h => h.word.toLowerCase() === data.word.toLowerCase());
    
    const historyEntry = {
      word: data.word,
      definition: data.definition || '',
      partOfSpeech: data.partOfSpeech || '',
      source: Object.keys(data.sources || {})[0] || 'unknown',
      timestamp: Date.now(),
      note: ''
    };
    
    // Move existing entry to front, or add new one
    if (existingIndex !== -1) {
      history.splice(existingIndex, 1);
    }
    history.unshift(historyEntry);
    
    // Keep only last 500 entries to avoid storage limits
    if (history.length > 500) {
      history.pop();
    }
    
    await ext.storage.local.set({ history });
    console.log('Learnword: Added to history:', data.word);
  } catch (e) {
    console.warn('Learnword: Failed to add to history:', e);
  }
}


// Public method used by your keyboard shortcut / selection handler
async function showDefinitionFor(word, clientX=null, clientY=null, lang='en') {
  console.log('[Learnword] showDefinitionFor:', word);
  if (typeof clientX === 'number' && typeof clientY === 'number') {
    lastSelectionCoords = { left: clientX, top: clientY, width: 0, height: 20 };
  }
  currentSelectedTerm = word;

  try {
    if (!STATE.ui) await createShadowUI();
    if (!STATE.ui) throw new Error('Failed to initialize popup UI');

    const res = await runtime.sendMessage({
      type: "learnword_lookup",
      word,
      lang: STATE.targetLanguage || "en"
    });

    console.log("[Learnword] Lookup response:", res);

    if (!res || !res.ok || !res.data) {
      throw new Error(res?.error || "Word not found");
    }

    // ✅ FIX: Call the correct function showCardWithData instead of undefined renderDefinition
    await showCardWithData(res.data);
    
    // Save to history
    await addToHistory(res.data);
    
    showCard();
    placeCardNearSelection();
  }
  catch (err) {
    console.warn("Learnword: lookup failed", err);

    if (!STATE.ui) {
      const created = await createShadowUI();
      if (!created || !STATE.ui) {
        console.error('Failed to create Shadow UI, cannot display error');
        return;
      }
    }

    STATE.ui.wordEl.textContent = "";
    STATE.ui.pronEl.textContent = "";
    setSafeHTML(STATE.ui.defWrapper, `<div class="lw-error">${stripHtml(err.message)}</div>`);

    STATE.ui.examplesSection.style.display = "none";
    STATE.ui.thesaurusSection.style.display = "none";
    STATE.ui.showMoreBtn.classList.add("hidden");
    STATE.ui.sourceEl.textContent = "";

    setupExternalButtons(word);
    showCard();
    placeCardNearSelection();
  }
}

// Example: attach to selection + Alt+W (you probably already have shortcuts; integrate with yours)
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key.toLowerCase() === 'w') {
    const sel = (window.getSelection && window.getSelection().toString && window.getSelection().toString().trim()) || '';
    if (!sel) return;
    const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
    const x = rect.left + window.scrollX;
    const y = rect.top + window.scrollY - 10;
    showDefinitionFor(sel, x, y, 'en');
  }
});

document.addEventListener('learnword-pdf-selection', async (e) => {
  if (!STATE.enabled) return;
  
  console.log('Learnword: Received PDF selection event', e.detail);
  
  if (e.detail && e.detail.term) {
    const term = e.detail.term;
    const x = e.detail.x || null;
    const y = e.detail.y || null;
    
    // Set selection coordinates for card positioning
    if (x !== null && y !== null) {
      lastSelectionCoords = {
        left: x,
        top: y,
        width: 0,
        height: 20
      };
    }
    
    // Store current selection
    currentSelectedTerm = term;
    
    // Trigger lookup with the PDF selection
    const single = isSingleWord(term);
    
    if (!single) {
      // For phrases, show popup with TTS pronunciation
      STATE.fullData = {
        word: term,
        dictAudioUrl: "",
        dictAudioFilename: "",
        dictProvider: ""
      };
      STATE.ui.wordEl.textContent = term;
      STATE.ui.pronEl.textContent = "";
      setSafeHTML(STATE.ui.defWrapper, `<div class="lw-definition">Selected text pronunciation</div>`);
      STATE.ui.examplesSection.style.display = 'none';
      STATE.ui.thesaurusSection.style.display = 'none';
      STATE.ui.showMoreBtn.classList.add("hidden");
      
      setupExternalButtons(term);
      
      showCard();
      placeCardNearSelection();
      return;
    }
    
    // For single words, do full lookup
    await triggerLookup();
  }
}, true);

// Listen for window postMessage from PDF viewer
window.addEventListener('message', async (e) => {
  if (!STATE.enabled) return;
  
  if (e.data && e.data.type === 'LEARNWORD_PDF_SELECTION') {
    console.log('Learnword: Received PDF postMessage', e.data);
    
    if (e.data.term) {
      const term = e.data.term;
      const x = e.data.x || null;
      const y = e.data.y || null;
      
      // Set selection coordinates
      if (x !== null && y !== null) {
        lastSelectionCoords = {
          left: x,
          top: y,
          width: 0,
          height: 20
        };
      }
      
      // Store current selection
      currentSelectedTerm = term;
      
      // Trigger lookup
      const single = isSingleWord(term);
      
      if (!single) {
        STATE.fullData = {
          word: term,
          dictAudioUrl: "",
          dictAudioFilename: "",
          dictProvider: ""
        };
        STATE.ui.wordEl.textContent = term;
        STATE.ui.pronEl.textContent = "";
        setSafeHTML(STATE.ui.defWrapper, `<div class="lw-definition">Selected text pronunciation</div>`);
        STATE.ui.examplesSection.style.display = 'none';
        STATE.ui.thesaurusSection.style.display = 'none';
        STATE.ui.showMoreBtn.classList.add("hidden");
        
        setupExternalButtons(term);
        
        showCard();
        placeCardNearSelection();
        return;
      }
      
      await triggerLookup();
    }
  }
});

console.log('Learnword: PDF viewer integration ready');

  async function loadSettings() {
    try {
      const saved = await ext.storage.local.get(["popupTriggerMode", "hotkey", "maxLen", "enabled", "showQuickButton", "targetLanguage"]);
      STATE.popupTriggerMode = saved.popupTriggerMode || DEFAULTS.popupTriggerMode;
      STATE.customHotkey = saved.hotkey || DEFAULTS.customHotkey;
      STATE.maxLen = saved.maxLen || DEFAULTS.maxLen;
      STATE.enabled = saved.enabled !== false;
      STATE.showQuickButton = saved.showQuickButton !== false;
      STATE.targetLanguage = saved.targetLanguage || "en";
    } catch (e) {
      console.warn("loadSettings failed", e);
    }
  }

  function isRTLLanguage(lang) {
    return ['ar', 'he', 'fa', 'ur', 'yi'].includes(lang);
  }

  async function createShadowUI() {
    if (STATE.shadowHost) return;

    const host = document.createElement("learnword-root");
    host.style.cssText = "all:initial;position:absolute;top:0;left:0;z-index:2147483647;";
    document.documentElement.appendChild(host);

    const root = host.attachShadow({ mode: "open" });

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = runtime.getURL("content/content.css");
    
    await new Promise((resolve) => {
      link.onload = () => {
        console.log("Successfully loaded content.css");
        resolve();
      };
      link.onerror = () => {
        console.error("Failed to load content.css. Ensure it is listed in web_accessible_resources in manifest.json.");
        resolve();
      };
      root.appendChild(link);
    });

    const card = document.createElement("div");
    card.id = "lw-card";
    card.setAttribute("hidden", "");

    card.innerHTML = `
      <div class="lw-header">
        <div class="lw-header-text">
          <div class="lw-word" id="lw-word"></div>
          <div class="lw-pron" id="lw-pron"></div>
        </div>
        <div class="lw-controls">
          <button class="lw-audio-btn" id="lw-audio" type="button" title="Play pronunciation">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="lw-content-scroll">
        <div id="lw-def-wrapper"></div>
        
        <div class="lw-section" id="examplesSection" style="display:none;">
          <span class="lw-label">Examples</span>
          <div class="lw-examples" id="lw-examples"></div>
        </div>

        <div class="lw-section thesaurus-section" id="thesaurusSection" style="display:none;">
          <span class="lw-label">Synonyms</span>
          <div class="thesaurus-content" id="thesaurusContent"></div>
        </div>
        
        <button class="lw-show-more hidden" id="showMoreBtn">Show More</button>
      </div>

      <div class="lw-footer" id="lw-footer">
        <div class="lw-footer-left">
          <span id="lw-source"></span>
          <div class="lw-external-buttons">
            <button class="lw-external-btn lw-google-btn" id="lw-google-btn" type="button" title="Search on Google">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </button>
            <button class="lw-external-btn lw-wikipedia-btn" id="lw-wikipedia-btn" type="button" title="Open Wikipedia">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.18-.225.18l-.564.046c-.101.015-.45.135-.45.438 0 .15.076.3.227.619l4.123 9.144 2.695-5.83c.11-.24.165-.42.165-.54 0-.12-.075-.27-.226-.42-.075-.061-.24-.135-.494-.24-.19-.12-.285-.27-.285-.449v-.419l.051-.045h4.678l.051.045v.434c0 .09-.075.15-.226.18l-.527.074c-.375.045-.674.194-.9.449-.21.24-.315.54-.315.899 0 .12.061.271.181.421l2.816 6.318 2.171-5.77c.075-.18.12-.345.12-.494 0-.434-.24-.719-.72-.854l-.54-.12c-.12-.075-.18-.149-.18-.239v-.434l.045-.045h3.961l.051.045v.434c0 .09-.045.149-.136.18-.211.074-.436.149-.676.239-.271.12-.496.315-.676.584-.165.27-.345.719-.555 1.364l-3.346 8.41c-.181.479-.436.75-.765.811-.314.045-.54-.104-.675-.448l-2.4-5.351-2.551 5.351Z"/>
              </svg>
            </button>
          </div>
        </div>
        <span>ESC to close</span>
      </div>
    `;

    const quickBtn = document.createElement("img");
    quickBtn.id = "lw-quick-btn";
    quickBtn.alt = "Learnword";
    quickBtn.setAttribute("hidden", "");
    quickBtn.style.maxWidth = "30px";
    quickBtn.style.maxHeight = "30px";
    quickBtn.style.objectFit = "contain";
    quickBtn.style.objectPosition = "center";
    try { quickBtn.src = runtime.getURL("icons/lw_logo.png"); } catch (e) { console.error('Failed to load logo:', e); }
    quickBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await triggerLookup();
      try { quickBtn.setAttribute("hidden", ""); } catch {}
    });

    root.append(card, quickBtn);

    STATE.shadowHost = host;
    STATE.ui = {
      root,
      card,
      quickBtn,
      get wordEl() { return root.getElementById("lw-word"); },
      get pronEl() { return root.getElementById("lw-pron"); },
      get audioBtn() { return root.getElementById("lw-audio"); },
      get defWrapper() { return root.getElementById("lw-def-wrapper"); },
      get examplesSection() { return root.getElementById("examplesSection"); },
      get examplesEl() { return root.getElementById("lw-examples"); },
      get thesaurusSection() { return root.getElementById("thesaurusSection"); },
      get thesaurusContent() { return root.getElementById("thesaurusContent"); },
      get showMoreBtn() { return root.getElementById("showMoreBtn"); },
      get sourceEl() { return root.getElementById("lw-source"); }
    };

    STATE.ui.audioBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const word = STATE.ui.wordEl.textContent;
      const data = STATE.fullData;
      const audioBtn = STATE.ui.audioBtn;
      audioBtn.classList.add('speaking');
      playPronunciation(word, {
        dictAudioUrl: data.dictAudioUrl || undefined,
        dictAudioFilename: data.dictAudioFilename || undefined,
        dictProvider: data.dictProvider || undefined,
        speechOptions: { lang: STATE.targetLanguage === 'en' ? 'en-US' : STATE.targetLanguage }
      }).finally(() => audioBtn.classList.remove('speaking'));
    });

    STATE.ui.showMoreBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      expandCard();
    });

    card.addEventListener("wheel", (ev) => {
      const scrollableDiv = STATE.ui.root.querySelector(".lw-content-scroll");
      if (!scrollableDiv) return;
      
      const isAtTop = scrollableDiv.scrollTop === 0;
      const isAtBottom = scrollableDiv.scrollTop + scrollableDiv.clientHeight >= scrollableDiv.scrollHeight;
      
      if ((ev.deltaY < 0 && !isAtTop) || (ev.deltaY > 0 && !isAtBottom)) {
        ev.stopPropagation();
      }
    }, { passive: false });

    card.addEventListener("click", ev => ev.stopPropagation());
  }

  async function checkWikipediaExists(term) {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(term)}&origin=*`;
      const response = await fetch(url);
      const data = await response.json();
      
      const pages = data.query.pages;
      const pageId = Object.keys(pages)[0];
      
      return pageId !== '-1';
    } catch (error) {
      console.error('Wikipedia check failed:', error);
      return false;
    }
  }

  // FIX #2: Setup external buttons with current selection (even on error)
  function setupExternalButtons(word) {
    try {
      const googleBtn = STATE.ui.root.getElementById('lw-google-btn');
      const wikiBtn = STATE.ui.root.getElementById('lw-wikipedia-btn');
      
      if (!googleBtn || !wikiBtn) {
        console.warn('External buttons not found in shadow DOM');
        return;
      }
      
      // Google button - always active with current selection
      googleBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(word)}`;
        window.open(searchUrl, '_blank', 'noopener,noreferrer');
      };
      
      // Wikipedia button - check if page exists
      wikiBtn.classList.remove('active');
      wikiBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
      };
      
      checkWikipediaExists(word).then(exists => {
        if (exists && wikiBtn) {
          wikiBtn.classList.add('active');
          wikiBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(word.replace(/ /g, '_'))}`;
            window.open(wikiUrl, '_blank', 'noopener,noreferrer');
          };
        }
      }).catch(err => {
        console.warn('Wikipedia check error:', err);
      });
    } catch (error) {
      console.error('setupExternalButtons error:', error);
    }
  }

  // TTS implementation with caching and fallbacks
  const DB_NAME = 'LearnwordTTSCache';
  const DB_VERSION = 1;
  const STORE_NAME = 'audio';
  const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
  let voicesReadyPromise = null;
  let dbPromise = null;
  
  // Utilities
  function normalizeWord(w) {
    return (w || '').toString().trim().toLowerCase();
  }
  
  function openDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            store.createIndex('timestamp', 'timestamp');
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return dbPromise;
  }
  
  async function getCachedAudio(key) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const item = await new Promise((resolve) => {
        const req = store.get(key);
        req.onsuccess = () => {
          const result = req.result;
          if (result) {
            result.timestamp = Date.now();
            store.put(result);
          }
          resolve(result);
        };
        req.onerror = () => resolve(null);
      });
      return item ? item.blob : null;
    } catch (e) {
      console.warn('Cache get failed', e);
      return null;
    }
  }
  
  async function setCachedAudio(key, blob) {
    try {
      const db = await openDB();
      const size = blob.size;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const allItems = await new Promise((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve([]);
      });
      let totalSize = allItems.reduce((sum, item) => sum + (item.size || 0), 0);
      if (totalSize + size > MAX_CACHE_SIZE) {
        allItems.sort((a, b) => a.timestamp - b.timestamp);
        for (const item of allItems) {
          if (totalSize + size <= MAX_CACHE_SIZE) break;
          await new Promise((resolve) => {
            const req = store.delete(item.key);
            req.onsuccess = resolve;
            req.onerror = resolve;
          });
          totalSize -= item.size || 0;
        }
      }
      await new Promise((resolve) => {
        const req = store.put({ key, blob, timestamp: Date.now(), size });
        req.onsuccess = resolve;
        req.onerror = resolve;
      });
    } catch (e) {
      console.warn('Cache set failed', e);
    }
  }

  function initTTS() {
    if (!('speechSynthesis' in window)) {
      voicesReadyPromise = Promise.resolve([]);
      return;
    }
    voicesReadyPromise = new Promise(resolve => {
      let v = speechSynthesis.getVoices();
      if (v && v.length) return resolve(v);
      const handler = () => {
        const voices = speechSynthesis.getVoices();
        speechSynthesis.onvoiceschanged = null;
        resolve(voices);
      };
      speechSynthesis.onvoiceschanged = handler;
      setTimeout(() => resolve(speechSynthesis.getVoices()), 800);
    });
  }

  function mwAudioUrlForFilename(filename) {
    if (!filename) return null;
    const fn = filename.split('/').pop();
    const lc = fn.toLowerCase();
    let folder = lc[0];
    if (lc.startsWith('bix')) folder = 'bix';
    else if (lc.startsWith('gg')) folder = 'gg';
    else if (/^[0-9]/.test(lc[0])) folder = 'number';
    const base = 'https://media.merriam-webster.com/soundc00';
    return `${base}/${folder}/${fn}`;
  }

  function playAudioUrl(url, cacheKey = null) {
    return new Promise((resolve, reject) => {
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        let resolved = false;
        const cleanup = () => {
          audio.oncanplaythrough = null;
          audio.onended = null;
          audio.onerror = null;
        };
        audio.oncanplaythrough = async () => {
          audio.play().catch(err => {
            if (!resolved) {
              resolved = true;
              cleanup();
              reject(err);
            }
          });
        };
        audio.onended = () => {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve();
          }
        };
        audio.onerror = (e) => {
          if (!resolved) {
            resolved = true;
            cleanup();
            reject(new Error('Audio error'));
          }
        };
        if (cacheKey) {
          fetch(url)
            .then(resp => {
              if (!resp.ok) throw new Error('fetch failed');
              return resp.blob();
            })
            .then(blob => {
              setCachedAudio(cacheKey, blob).catch(()=>{});
              const blobUrl = URL.createObjectURL(blob);
              audio.src = blobUrl;
              audio.onended = () => {
                URL.revokeObjectURL(blobUrl);
                resolve();
              };
            })
            .catch(err => {
              audio.src = url;
            });
        } else {
          audio.src = url;
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  async function speakWithWebSpeech(word, opts = {}) {
    if (!('speechSynthesis' in window)) throw new Error('No Web Speech API');
    const voices = await voicesReadyPromise;
    const utter = new SpeechSynthesisUtterance(word);
    utter.lang = opts.lang || 'en-US';
    utter.rate = typeof opts.rate === 'number' ? opts.rate : 0.98;
    utter.pitch = typeof opts.pitch === 'number' ? opts.pitch : 1;
    utter.voice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en')) || voices[0] || null;

    return new Promise((resolve, reject) => {
      let started = false;
      const onStart = () => { started = true; };
      const onEnd = () => {
        cleanup();
        resolve();
      };
      const onError = (e) => {
        cleanup();
        reject(e || new Error('Speech error'));
      };
      const cleanup = () => {
        utter.onstart = null;
        utter.onend = null;
        utter.onerror = null;
      };
      utter.onstart = onStart;
      utter.onend = onEnd;
      utter.onerror = onError;
      try {
        speechSynthesis.speak(utter);
        setTimeout(() => {
          if (!started) {
            try {
              speechSynthesis.cancel();
              speechSynthesis.speak(utter);
            } catch (err) {
              cleanup();
              reject(new Error('Speech did not start'));
            }
          }
        }, 300);
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  }

  async function playPronunciation(word, options = {}) {
    const w = normalizeWord(word);
    if (!w) throw new Error('Empty word');

    if (!voicesReadyPromise) initTTS();

    try {
      const cachedBlob = await getCachedAudio(`audio:${w}`);
      if (cachedBlob) {
        const url = URL.createObjectURL(cachedBlob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play().catch(() => {});
        return;
      }
    } catch (e) {
      console.warn('Cache read failed', e);
    }

    try {
      if (options.dictAudioUrl) {
        await playAudioUrl(options.dictAudioUrl, `audio:${w}`);
        return;
      }
      if (options.dictAudioFilename && options.dictProvider === 'mw') {
        const url = mwAudioUrlForFilename(options.dictAudioFilename);
        if (url) {
          await playAudioUrl(url, `audio:${w}`);
          return;
        }
      }
    } catch (e) {
      console.warn('Dict audio failed', e);
    }

    const retries = options.retries != null ? options.retries : 2;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await speakWithWebSpeech(word, options.speechOptions || {});
        return;
      } catch (err) {
        console.warn('WebSpeech attempt failed', attempt, err);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
          continue;
        }
        throw new Error('All TTS attempts failed');
      }
    }
  }

  function renderDefinitions(allDefinitions, topDefinition, limit = null) {
  if (!allDefinitions || !allDefinitions.length) {
    return `<div class="lw-definition">${stripHtml(topDefinition || "No definition available")}</div>`;
  }
  
  const defsToShow = limit ? allDefinitions.slice(0, limit) : allDefinitions;
  
  return defsToShow.map((def, idx) => {
    const part = def.partOfSpeech ? `<span class="lw-def-pos">${stripHtml(def.partOfSpeech)}</span>` : "";
    const number = allDefinitions.length > 1 ? `<strong>${idx + 1}. </strong>` : "";
    return `<div class="lw-definition">${number}${part}${stripHtml(def.text)}</div>`;
  }).join("");
  }

  function renderExamples(examples, limit = null) {
  if (!examples || !examples.length) return "";
  
  const exToShow = limit ? examples.slice(0, limit) : examples;
  
  return exToShow.map(ex => 
    `<div class="lw-example-item">${stripHtml(ex)}</div>`
  ).join("");
  }

  function renderSynonyms(synonyms, limit = null) {
  if (!synonyms || !synonyms.length) {
    return "";
  }
  
  const synsToShow = limit ? synonyms.slice(0, limit) : synonyms;
  
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;">${synsToShow.map(s => 
    `<div class="lw-chip" role="button" tabindex="0" data-syn="${escapeAttr(s)}">${stripHtml(s)}</div>`
  ).join("")}</div>`;
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/[&<>"'`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]));
  }

  function stripHtml(s) {
  if (s === null || s === undefined) return "";
  // Remove HTML tags but preserve entities
  return String(s)
    .replace(/<[^>]+>/g, '') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ') // Convert &nbsp; to space
    .replace(/&amp;/g, '&')  // Convert entities back
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
  }
  
  function escapeAttr(s) {
    return (s === null || s === undefined) ? "" : String(s).replace(/"/g,'&quot;');
  }

  function getSelectionPosition() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const scrollX = (window.scrollX !== undefined) ? window.scrollX : window.pageXOffset;
    const scrollY = (window.scrollY !== undefined) ? window.scrollY : window.pageYOffset;
    return {
      left: rect.left + scrollX,
      top: rect.top + scrollY,
      width: rect.width,
      height: rect.height
    };
  }

  function placeCardNearSelection() {
    const pos = lastSelectionCoords;
    if (!pos) return;
    const card = STATE.ui.card;
    card.style.position = "absolute";
    const popupWidth = card.offsetWidth || 420;
    const popupHeight = card.offsetHeight || 300;
    const padding = 8;

    let left = pos.left + pos.width / 2 - popupWidth / 2;
    let top = pos.top - popupHeight - 12;

    if (left < padding) left = padding;
    if (left + popupWidth > document.documentElement.scrollWidth - padding)
      left = document.documentElement.scrollWidth - popupWidth - padding;
    if (top < window.scrollY + padding)
      top = pos.top + pos.height + 12;

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function placeButtonNearSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const btn = STATE.ui.quickBtn;
    if (!btn) return;
    let left = rect.right + 8;
    let top = rect.bottom + 8;
    if (left + 38 > window.innerWidth - 8) left = window.innerWidth - 46;
    if (top + 38 > window.innerHeight - 8) top = rect.top - 46;
    btn.style.left = `${Math.round(left)}px`;
    btn.style.top = `${Math.round(top)}px`;
    btn.removeAttribute("hidden");
    clearTimeout(STATE.buttonTimeout);
    STATE.buttonTimeout = setTimeout(() => { 
      try { btn.setAttribute("hidden", ""); } catch(e){} 
    }, 5000);
  }

  function getSelectionString() {
    try {
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) return sel.toString().trim();
      const frames = document.querySelectorAll("iframe, frame");
      for (const f of frames) {
        try {
          const s = f.contentWindow.getSelection();
          if (s && s.toString().trim()) return s.toString().trim();
        } catch (e) {}
      }
    } catch (e) {}
    return "";
  }

  function isSingleWord(term) {
    if (!term) return false;
    const t = term.replace(/\u00A0/g, ' ').trim();
    if (!t) return false;
    if (t.length === 0 || t.length > (STATE.maxLen || DEFAULTS.maxLen)) return false;
    // single token only
    if (/\s/.test(t)) return false;
    // must contain at least one letter
    try {
      if (!/[\p{L}]/u.test(t)) return false;
      // allow letters, combining marks, apostrophes and hyphens
      if (!/^[\p{L}\p{M}’'`-]+$/u.test(t)) return false;
    } catch (e) {
      // Fallback for environments without Unicode property support
      if (!/[A-Za-z]/.test(t)) return false;
      if (!/^[A-Za-z'`-]+$/.test(t)) return false;
    }
    return true;
  }

  function lookup(term) {
    return new Promise(resolve => {
      try {
        if (!runtime?.id) {
          console.warn('Extension context invalidated');
          resolve({ ok: false, error: "Extension reloaded. Please refresh the page." });
          return;
        }

        runtime.sendMessage({ type: "lookup", term }, res => {
          if (runtime.lastError) {
            console.error("lookup runtime.lastError:", runtime.lastError);
            const errorMsg = runtime.lastError.message;
            
            if (errorMsg.includes('context invalidated') || errorMsg.includes('Extension context')) {
              resolve({ ok: false, error: "Extension reloaded. Please refresh the page.",isWarning: true});
            } else {
              resolve({ ok: false, error: errorMsg });
            }
            return;
          }
          console.log('Learnword: Lookup response received:', {
          ok: res?.ok,
          hasData: !!res?.data,
          word: res?.data?.word,
          phonetic: res?.data?.phonetic,
          partOfSpeech: res?.data?.partOfSpeech,
          fullData: res?.data
        });

          resolve(res || { ok: false, error: "No response" });
        });
      } catch (err) {
        console.error('lookup error:', err);
        resolve({ ok: false, error: err.message || String(err) });
      }
    });
  }

  function repositionExpandedCard() {
    const card = STATE.ui.card;
    const padding = 8;

    if (!lastSelectionCoords) return;

    const pos = lastSelectionCoords;
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;

    let left = pos.left + pos.width / 2 - cardWidth / 2;
    let top = pos.top - cardHeight - 12;

    if (left < padding) left = padding;
    if (left + cardWidth > document.documentElement.scrollWidth - padding)
      left = document.documentElement.scrollWidth - cardWidth - padding;

    if (top < window.scrollY + padding)
      top = pos.top + pos.height + 12;

    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }

  function expandCard() {
    if (!STATE.fullData) return;

    STATE.isExpanded = true;
    STATE.ui.card.classList.add("expanded");
    STATE.ui.showMoreBtn.classList.add("hidden");

    const data = STATE.fullData;

    // Build expanded content HTML
    let contentHtml = '';

    // Primary definition
    if (data.definition) {
      contentHtml += `<div class="lw-definition">${stripHtml(data.definition)}</div>`;
    }

    // Extended explanation (for merged API)
    if (data.extendedExplanation && data.extendedExplanation !== data.definition) {
      contentHtml += `
        <div class="lw-section">
          <span class="lw-label">Extended Explanation</span>
          <div class="lw-extended-explanation">${stripHtml(data.extendedExplanation)}</div>
        </div>
      `;
    }

    // All definitions
    if (data.allDefinitions && data.allDefinitions.length > 1) {
      const additionalDefs = data.allDefinitions.slice(1); // Skip first one as it's already shown
      if (additionalDefs.length > 0) {
        contentHtml += `<div class="lw-section"><span class="lw-label">All Definitions</span>${additionalDefs.map((def, idx) => {
          const part = def.partOfSpeech ? `<span class="lw-def-pos">${stripHtml(def.partOfSpeech)}</span>` : "";
          const source = def.source ? `<span class="lw-def-source">(${stripHtml(def.source)})</span>` : "";
          return `<div class="lw-definition">${idx + 2}. ${part}${stripHtml(def.text)} ${source}</div>`;
        }).join('')}</div>`;
      }
    }

    setSafeHTML(STATE.ui.defWrapper, contentHtml);

    // Show ALL examples when expanded
    if (data.examples && data.examples.length > 0) {
      STATE.ui.examplesSection.style.display = 'block';
      setSafeHTML(STATE.ui.examplesEl, renderExamples(data.examples));
    }

    // Show ALL synonyms when expanded
    if (data.synonyms && data.synonyms.length > 0) {
      STATE.ui.thesaurusSection.style.display = 'block';
      const synsHtml = renderSynonyms(data.synonyms);
      setSafeHTML(STATE.ui.thesaurusContent, synsHtml);
      attachSynonymHandlers();
    }

    requestAnimationFrame(() => {
      repositionExpandedCard();
    });
  }

  function attachSynonymHandlers() {
    Array.from(STATE.ui.thesaurusContent.querySelectorAll(".lw-chip")).forEach(chip => {
      chip.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const word = chip.getAttribute("data-syn");
        if (word) {
          const res = await lookup(word);
          if (res && res.ok && res.data) {
            await showCardWithData(res.data);
          }
        }
      });
    });
  }

  // ✅ COMPLETE FIX: showCardWithData function - updates card with full definition data
  async function showCardWithData(data) {
    if (!STATE.ui || !data) {
      console.error('Learnword: showCardWithData called with invalid state or data');
      return;
    }
    
    console.log('Learnword: showCardWithData called with:', data);
    
    // Store full data for later use
    STATE.fullData = data;
    
    // Update word
    STATE.ui.wordEl.textContent = stripHtml(data.word || '');
    
    // Update pronunciation
    if (data.phonetic) {
      STATE.ui.pronEl.textContent = `[${stripHtml(data.phonetic)}]`;
    } else {
      STATE.ui.pronEl.textContent = '';
    }
    
    // Update definitions
    if (data.allDefinitions && data.allDefinitions.length > 0) {
      const defsHtml = renderDefinitions(data.allDefinitions, data.definition, 2);
      setSafeHTML(STATE.ui.defWrapper, defsHtml);
    } else if (data.definition) {
      setSafeHTML(STATE.ui.defWrapper, `<div class="lw-definition">${stripHtml(data.definition)}</div>`);
    } else {
      setSafeHTML(STATE.ui.defWrapper, `<div class="lw-definition">No definition available</div>`);
    }
    
    // Handle examples
    if (data.examples && data.examples.length > 0) {
      STATE.ui.examplesSection.style.display = 'block';
      setSafeHTML(STATE.ui.examplesEl, renderExamples(data.examples, 2));
    } else {
      STATE.ui.examplesSection.style.display = 'none';
    }
    
    // Handle synonyms
    if (data.synonyms && data.synonyms.length > 0) {
      STATE.ui.thesaurusSection.style.display = 'block';
      const synsHtml = renderSynonyms(data.synonyms, 5);
      setSafeHTML(STATE.ui.thesaurusContent, synsHtml);
      attachSynonymHandlers();
    } else {
      STATE.ui.thesaurusSection.style.display = 'none';
    }
    
    // Show "More" button if there are more definitions
    if (data.allDefinitions && data.allDefinitions.length > 2) {
      STATE.ui.showMoreBtn.classList.remove('hidden');
    } else {
      STATE.ui.showMoreBtn.classList.add('hidden');
    }
    
    // Update source/part of speech
    if (data.partOfSpeech) {
      STATE.ui.sourceEl.textContent = `(${stripHtml(data.partOfSpeech)})`;
    } else {
      STATE.ui.sourceEl.textContent = '';
    }
    
    // Setup external buttons (Google, Wikipedia)
    setupExternalButtons(data.word || '');
  }

  async function triggerLookup() {
    try {
      if (!STATE.enabled) return;
      const term = getSelectionString();
      if (!term) return;
      const selPos = getSelectionPosition();
      lastSelectionCoords = selPos;
      
      // Store current selection
      currentSelectedTerm = term;
      
      if (!isSingleWord(term)) {
        // For phrases, show popup with TTS pronunciation
        STATE.fullData = {
          word: term,
          dictAudioUrl: "",
          dictAudioFilename: "",
          dictProvider: ""
        };
        STATE.ui.wordEl.textContent = term;
        STATE.ui.pronEl.textContent = "";
        STATE.ui.defWrapper.innerHTML = `<div class="lw-definition">Selected text pronunciation</div>`;
        STATE.ui.examplesSection.style.display = 'none';
        STATE.ui.thesaurusSection.style.display = 'none';
        STATE.ui.showMoreBtn.classList.add("hidden");

        setupExternalButtons(term);

        showCard();
        placeCardNearSelection();
        return;
      }
      
      // FIX #1: Clear everything for clean loading screen
      STATE.ui.wordEl.textContent = "";
      STATE.ui.pronEl.textContent = "";
      STATE.ui.defWrapper.innerHTML = `<div class="lw-loading">Looking up...</div>`;
      STATE.ui.examplesSection.style.display = 'none';
      STATE.ui.thesaurusSection.style.display = 'none';
      STATE.ui.showMoreBtn.classList.add("hidden");
      STATE.ui.sourceEl.textContent = "";
      
      showCard();
      placeCardNearSelection();
      
      // ✅ FIXED: Call background service using message with timeout
      const lookupPromise = new Promise((resolve, reject) => {
        try {
          if (!runtime) {
            reject(new Error("Runtime not available - extension may not be loaded"));
            return;
          }
          
          console.log('[Learnword] Sending lookup message for:', term);
          const msgPayload = { type: "learnword_lookup", word: term, lang: STATE.targetLanguage || "en" };
          
          runtime.sendMessage(msgPayload, (response) => {
            console.log('[Learnword] Got response from background:', response);
            
            if (runtime.lastError) {
              console.error('[Learnword] Runtime error:', runtime.lastError);
              reject(new Error(runtime.lastError.message || "Background service error"));
              return;
            }
            
            resolve(response || { ok: false, error: "Empty response from background service" });
          });
        } catch (err) {
          console.error('[Learnword] Error sending message:', err);
          reject(err);
        }
      }).catch(err => {
        console.error('[Learnword] Lookup promise error:', err);
        return { ok: false, error: err.message || "Failed to communicate with background service" };
      });
      
      // Add timeout to prevent hanging indefinitely (increased to 15 seconds for slow APIs)
      const timeoutPromise = new Promise((resolve) => 
        setTimeout(() => {
          console.warn('[Learnword] ⏱️ Lookup timeout - API not responding after 15 seconds');
          resolve({ ok: false, error: "Lookup timeout - API not responding. Using offline dictionary instead." });
        }, 15000)  // Increased from 10 to 15 seconds
      );
      
      const res = await Promise.race([lookupPromise, timeoutPromise]);
      
      if (!res || !res.ok || !res.data) {
        // FIX #1: Keep clean layout on error
        STATE.ui.wordEl.textContent = "";
        STATE.ui.pronEl.textContent = "";
        setSafeHTML(STATE.ui.defWrapper, `<div class="lw-error">${stripHtml(res?.error || "Definition not found")}</div>`);

        setupExternalButtons(currentSelectedTerm);
        
        return;
      }
      
      await showCardWithData(res.data);
      placeCardNearSelection();
    } catch (err) {
      console.error("triggerLookup error", err);
    }
  }

  function showCard() {
    if (!STATE.ui) return;
    STATE.justOpenedAt = Date.now();
    STATE.isCardVisible = true;
    STATE.ui.card.removeAttribute("hidden");
    requestAnimationFrame(() => {
      STATE.ui.card.classList.add("show");
      placeCardNearSelection();
    });
  }

  function hideCard() {
    if (!STATE.ui) return;
    STATE.isCardVisible = false;
    STATE.isExpanded = false;
    STATE.ui.card.classList.remove("show");
    STATE.ui.card.classList.remove("expanded");
    STATE.ui.card.removeAttribute('dir');
    setTimeout(() => STATE.ui.card.setAttribute("hidden", ""), 180);
  }

  function debounce(fn, wait = 80) {
    let t;
    return (...a) => { 
      clearTimeout(t); 
      t = setTimeout(() => fn(...a), wait); 
    };
  }

  document.addEventListener("mouseup", debounce(async () => {
    if (!STATE.enabled) return;
    if (!runtime?.id) return;
    
    const term = getSelectionString();
    if (!term) {
      try { STATE.ui.quickBtn.setAttribute("hidden", ""); } catch {}
      return;
    }

    const selPos = getSelectionPosition();
    if (!selPos || (selPos.width === 0 && selPos.height === 0)) {
      // No valid bounding rect for selection - ignore to avoid misplaced popups
      try { STATE.ui.quickBtn.setAttribute("hidden", ""); } catch {}
      return;
    }

    const single = isSingleWord(term);
    const mode = STATE.popupTriggerMode;

    if (mode === "instant") {
      if (!single) {
        try {
          STATE.fullData = {
            word: term,
            dictAudioUrl: "",
            dictAudioFilename: "",
            dictProvider: ""
          };
          STATE.ui.wordEl.textContent = term;
          STATE.ui.pronEl.textContent = "";
          STATE.ui.defWrapper.innerHTML = `<div class="lw-definition">Selected text pronunciation</div>`;
          STATE.ui.examplesSection.style.display = 'none';
          STATE.ui.thesaurusSection.style.display = 'none';
          STATE.ui.showMoreBtn.classList.add("hidden");
          setupExternalButtons(term);
          showCard();
          placeCardNearSelection();
        } catch (e) {}
        return;
      }
      await triggerLookup();
      return;
    }

    if (mode === "button") {
      // In 'button' trigger mode we should never open the popup automatically.
      // Always show the quick button (if enabled) so user can click to open the popup.
      if (STATE.showQuickButton !== false) {
        placeButtonNearSelection();
      }
      return;
    }
  }, 0), true);

  // Hotkey event listener - only active when trigger mode is 'hotkey'
  function setupHotkeyListener() {
    // Remove any existing hotkey listener
    document.removeEventListener("keydown", hotkeyListener);
    
    // Only add hotkey listener if trigger mode is 'hotkey'
    if (STATE.popupTriggerMode === "hotkey" && STATE.customHotkey) {
      document.addEventListener("keydown", hotkeyListener, true);
      console.log('Learnword: Hotkey listener activated for mode:', STATE.popupTriggerMode, 'Hotkey:', STATE.customHotkey);
    } else {
      console.log('Learnword: Hotkey listener deactivated. Current mode:', STATE.popupTriggerMode);
    }
  }
  
  // Separate hotkey listener function for better management
  function hotkeyListener(e) {
    // Only process hotkey if we're still in hotkey mode
    if (STATE.popupTriggerMode !== "hotkey") {
      return;
    }
    
    const hotkey = STATE.customHotkey || "";
    if (!hotkey) return;
    
    const parts = [];
    if (e.ctrlKey) parts.push("Control");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Meta");
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (key) parts.push(key);
    const combo = parts.join("+");
    
    if (combo.toLowerCase() === hotkey.toLowerCase()) {
      e.preventDefault();
      console.log('Learnword: Hotkey triggered, calling triggerLookup');
      triggerLookup();
    }
  }
  
  // Setup hotkey listener initially
  setupHotkeyListener();

  document.addEventListener("click", (e) => {
    if (!STATE.isCardVisible) return;
    if (Date.now() - STATE.justOpenedAt < 200) return;
    const path = e.composedPath ? e.composedPath() : (e.path || [e.target]);
    if (path.includes(STATE.shadowHost)) return;
    hideCard();
    try { STATE.ui.quickBtn.setAttribute("hidden", ""); } catch(e) {}
  }, true);

  runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      // PING — keeps Firefox background alive
      if (msg.type === "__ping__") {
        sendResponse(true);
        return false;
      }

      // Trigger mode changed from settings page
      if (msg.type === "triggerModeChanged") {
        console.log('[Learnword] Trigger mode changed to:', msg.mode);
        STATE.popupTriggerMode = msg.mode;
        STATE.customHotkey = msg.hotkey || STATE.customHotkey;
        setupHotkeyListener();
        sendResponse({ ok: true });
        return false;
      }

      // PDF detection
      if (msg.action === "CHECK_IF_PDF") {
        const pdfObjects = document.querySelectorAll('embed[type="application/pdf"], object[type="application/pdf"], iframe[src$=".pdf"]');
        if (pdfObjects.length > 0) {
          let pdfUrl = null;
          for (const obj of pdfObjects) {
            if (obj.src) { pdfUrl = obj.src; break; }
            else if (obj.data) { pdfUrl = obj.data; break; }
          }
          sendResponse({ isPdf: true, pdfUrl });
        } else {
          sendResponse({ isPdf: false });
        }
        return false;
      }

      // Show popup from context menu or background
      if (msg.type === "showFromContextMenu" && msg.term) {
        const term = msg.term.trim();
        if (term) {
          currentSelectedTerm = term;
          triggerLookup();
        }
        sendResponse({ ok: true });
        return false;
      }

    } catch (error) {
      console.error('[Learnword] Message listener error:', error);
      sendResponse({ ok: false, error: error.message });
    }
    return false;
  });

  window.addEventListener("scroll", () => {
    if (STATE.isCardVisible) placeCardNearSelection();
  }, true);

  window.addEventListener("resize", () => {
    if (STATE.isCardVisible) placeCardNearSelection();
  });

  (async () => {
    await loadSettings();
    await createShadowUI();
    initTTS();
    console.log("Learnword content script loaded (with clean loading and fixed external buttons).");
  })();
})();