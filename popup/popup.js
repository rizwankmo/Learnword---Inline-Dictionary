const ext = typeof browser !== "undefined" ? browser : chrome;
const runtime = ext.runtime;

// Add to top of file
function setSafeHTML(element, htmlString) {
    element.textContent = ''; // Clear current content
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    element.append(...doc.body.childNodes); // Append new safe nodes
}

let currentHistory = [];
let currentWord = null;

// Global error handlers to prevent silent failures and show a helpful message
window.addEventListener('error', (ev) => {
  try {
    console.error('Learnword Popup: Uncaught error', ev.message, ev.error);
    const body = document.body;
    if (body) {
      body.innerHTML = '<div style="padding:16px;color:#900;background:#fff6f6">Learnword popup failed to load. Check console for details.</div>';
    }
  } catch (e) { /* ignore */ }
});

window.addEventListener('unhandledrejection', (ev) => {
  try {
    console.error('Learnword Popup: Unhandled promise rejection', ev.reason);
    const body = document.body;
    if (body) {
      body.innerHTML = '<div style="padding:16px;color:#900;background:#fff6f6">Learnword popup encountered an error. Check console for details.</div>';
    }
  } catch (e) { /* ignore */ }
});

// Trigger instruction text updater
function updateTriggerInstructions(mode) {
  const el = document.getElementById("trigger-instructions");
  if (!el) {
    console.error('Learnword Popup: Trigger instructions element not found!');
    return;
  }

  const messages = {
    hotkey: `<strong>How to use:</strong> Select text on any webpage, then press your saved hotkey to look up definitions.`,
    instant: `<strong>How to use:</strong> Simply select any word on a webpage to instantly see its definition.`,
    button: `<strong>How to use:</strong> Select a word on any webpage, and a small button will appear. Click the button to look up the definition.`
  };

  const message = messages[mode] || messages.instant;
  console.log('Learnword Popup: Updating trigger instructions to:', message);
  setSafeHTML(el, message);
}

// ---------- Tab Switching ----------
console.log('Learnword Popup: Setting up tab switching');

// Debug function to log element visibility
function debugElementVisibility() {
  console.log('=== ELEMENT VISIBILITY DEBUG ===');
  
  const lookupContent = document.getElementById('lookup-content');
  const historyContent = document.getElementById('history-content');
  const lookupTab = document.getElementById('tab-lookup');
  const historyTab = document.getElementById('tab-history');
  
  console.log('Lookup content element:', lookupContent, lookupContent ? 'visible: ' + !lookupContent.classList.contains('hidden') : 'NOT FOUND');
  console.log('History content element:', historyContent, historyContent ? 'visible: ' + !historyContent.classList.contains('hidden') : 'NOT FOUND');
  console.log('Lookup tab element:', lookupTab, lookupTab ? 'active: ' + lookupTab.classList.contains('active') : 'NOT FOUND');
  console.log('History tab element:', historyTab, historyTab ? 'active: ' + historyTab.classList.contains('active') : 'NOT FOUND');
  
  if (historyContent) {
    console.log('History content classes:', historyContent.className);
    console.log('History content style.display:', historyContent.style.display);
    console.log('History content innerHTML length:', historyContent.innerHTML.length);
    console.log('History content offsetParent:', historyContent.offsetParent);
    console.log('History content getBoundingClientRect:', historyContent.getBoundingClientRect());
  }
  
  if (lookupContent) {
    console.log('Lookup content offsetParent:', lookupContent.offsetParent);
    console.log('Lookup content getBoundingClientRect:', lookupContent.getBoundingClientRect());
  }
  
  // Check if history content is inside lookup content
  if (historyContent && lookupContent) {
    console.log('Is history content inside lookup content?', lookupContent.contains(historyContent));
  }
}

const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

console.log('Learnword Popup: Found', tabs.length, 'tabs and', tabContents.length, 'tab contents');

// Initialize history content on popup load
async function initializeHistoryTab() {
  console.log('Learnword Popup: Initializing history tab');
  try {
    await loadHistory();
    console.log('Learnword Popup: History loaded successfully');
    debugElementVisibility();
  } catch (error) {
    console.error('Learnword Popup: Error loading history:', error);
  }
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    console.log('Learnword Popup: Tab clicked -', tab.dataset.tab);
    const targetTab = tab.dataset.tab;
    
    // Debug: Log tab elements before changes
    console.log('Before tab switch - current active tabs:', document.querySelectorAll('.tab.active'));
    console.log('Before tab switch - current visible contents:', document.querySelectorAll('.tab-content:not(.hidden)'));
    
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    tabContents.forEach(content => {
      if (content.id === `${targetTab}-content`) {
        console.log('Showing content:', content.id);
        content.classList.remove('hidden');
        content.classList.add('active');
      } else {
        console.log('Hiding content:', content.id);
        content.classList.add('hidden');
        content.classList.remove('active');
      }
    });
    
    // Debug: Log tab elements after changes
    console.log('After tab switch - current active tabs:', document.querySelectorAll('.tab.active'));
    console.log('After tab switch - current visible contents:', document.querySelectorAll('.tab-content:not(.hidden)'));
    
    if (targetTab === 'history') {
      console.log('Learnword Popup: History tab clicked, refreshing history');
      loadHistory();
      
      // Additional debug after loading history
      setTimeout(() => {
        console.log('After history load - visible contents:', document.querySelectorAll('.tab-content:not(.hidden)'));
        debugElementVisibility();
      }, 100);
    }
    
    debugElementVisibility();
  });
});

// Load history when popup opens
console.log('Learnword Popup: Adding DOMContentLoaded listener for history initialization');
document.addEventListener('DOMContentLoaded', () => {
  console.log('Learnword Popup: DOM fully loaded, initializing history');
  
  // Debug: Check if all required elements exist
  const requiredElements = [
    'lookup-content', 'history-content',
    'tab-lookup', 'tab-history',
    'history-list', 'history-empty',
    'history-count'
  ];
  
  requiredElements.forEach(id => {
    const el = document.getElementById(id);
    console.log('Required element', id, ':', el ? 'FOUND' : 'NOT FOUND');
  });
  
  // Ensure history content is properly hidden on initial load
  const historyContent = document.getElementById('history-content');
  if (historyContent) {
    console.log('Initial state - history content classes before fix:', historyContent.className);
    historyContent.classList.add('hidden');
    console.log('Initial state - history content classes after fix:', historyContent.className);
  }
  
  initializeHistoryTab();
  
  // Debug initial state
  setTimeout(debugElementVisibility, 500);
});

// popup.js - Fixed PDF viewer opening logic

// ... (keep all existing code until the PDF viewer section)

// ---------- PDF Viewer Button ----------
const openPdfReaderBtn = document.getElementById('openPdfReader');

if (openPdfReaderBtn) {
  openPdfReaderBtn.addEventListener('click', async () => {
    console.log("Open PDF Reader button clicked");
    try {
      const [tab] = await ext.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        alert('No active tab found');
        return;
      }

      const url = tab.url;
      console.log("Active tab URL:", url);

      // Check if it's a direct PDF URL
      if (url.toLowerCase().endsWith('.pdf') || url.includes('.pdf?') || url.includes('.pdf#')) {
        console.log("Direct PDF URL detected, opening viewer");
        openPdfViewer(url);
        return;
      }

      // Check content script for embedded PDFs
      console.log("Checking content script for PDF");
      ext.tabs.sendMessage(tab.id, { action: "CHECK_IF_PDF" }, (resp) => {
        if (runtime.lastError) {
          console.error("Content script error:", runtime.lastError);
          alert("PDF not available on this page");
          return;
        }

        if (resp?.isPdf && resp?.pdfUrl) {
          console.log("PDF detected, opening viewer with URL:", resp.pdfUrl);
          openPdfViewer(resp.pdfUrl);
        } else {
          alert("No PDF found on this page");
        }
      });
    } catch (e) {
      console.error('Error opening PDF viewer:', e);
      alert('Error: ' + e.message);
    }
  });
}

function openPdfViewer(pdfUrl) {
  console.log("openPdfViewer called with pdfUrl:", pdfUrl);
  
  try {
    // First try the correct path from manifest.json
    let viewerUrl;
    try {
      viewerUrl = runtime.getURL('pdf-viewer/dist/index.html') + '?url=' + encodeURIComponent(pdfUrl);
      console.log("Trying correct path:", viewerUrl);
    } catch (e) {
      console.error("Correct path not found, trying fallback:", e);
      // Fallback to the old path
      viewerUrl = runtime.getURL('pdf_viewer/index.html') + '?url=' + encodeURIComponent(pdfUrl);
      console.log("Trying fallback path:", viewerUrl);
    }
    
    console.log("Opening viewer at:", viewerUrl);
    
    // Open in new tab
    ext.tabs.create({ url: viewerUrl }, (newTab) => {
      if (runtime.lastError) {
        console.error("Error creating tab:", runtime.lastError);
        alert("Failed to open PDF viewer. Error: " + runtime.lastError.message);
      } else {
        console.log("PDF viewer opened successfully in tab:", newTab.id);
      }
    });
  } catch (error) {
    console.error("Critical error in openPdfViewer:", error);
    alert("Critical error opening PDF viewer: " + error.message);
  }
}

// Check for PDF when popup opens and show/hide PDF button
async function checkForPDF() {
  try {
    console.log("Checking for PDF on popup open");
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.log("No active tab found");
      return;
    }

    const url = tab.url;
    const wrapper = document.getElementById('pdfViewerBtnWrapper');
    console.log("Active tab URL:", url);

    // Don't show button for chrome:// or extension pages
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      wrapper.style.display = 'none';
      return;
    }

    // Check if URL ends with .pdf
    if (url.toLowerCase().endsWith('.pdf') || url.includes('.pdf?') || url.includes('.pdf#')) {
      console.log("Direct PDF URL detected, showing button");
      wrapper.style.display = 'block';
      return;
    }

    console.log("Checking content script for embedded PDF");
    
    // Send message to content script to check for embedded PDFs
    ext.tabs.sendMessage(tab.id, { action: "CHECK_IF_PDF" }, (resp) => {
      if (runtime.lastError) {
        console.log("Content script not available:", runtime.lastError.message);
        wrapper.style.display = 'none';
        return;
      }

      if (resp?.isPdf) {
        console.log("PDF detected in content, showing button");
        wrapper.style.display = 'block';
      } else {
        console.log("No PDF detected, hiding button");
        wrapper.style.display = 'none';
      }
    });
  } catch (error) {
    console.error('Error checking for PDF:', error);
    document.getElementById('pdfViewerBtnWrapper').style.display = 'none';
  }
}

// Check for PDF when popup opens
document.addEventListener('DOMContentLoaded', checkForPDF);


// Load initial popup trigger mode
(async () => {
  const { popupTriggerMode = "instant", preferredApi = 'freeDictionary' } = await ext.storage.local.get(["popupTriggerMode","preferredApi"]);
  console.log('Learnword Popup: Loaded trigger mode from storage:', popupTriggerMode);
  updateTriggerInstructions(popupTriggerMode);
  console.log('Learnword Popup: Updated trigger instructions for mode:', popupTriggerMode);
  // Initialize current API label
  updateCurrentApiLabel(preferredApi);
})();

// Update instantly when options page changes the setting
ext.storage.onChanged.addListener((changes, area) => {
  console.log('Learnword Popup: Storage changed in area:', area, 'Changes:', changes);
  if (area === "local" && changes.popupTriggerMode) {
    const newMode = changes.popupTriggerMode.newValue;
    console.log('Learnword Popup: Trigger mode changed to:', newMode);
    updateTriggerInstructions(newMode);
    console.log('Learnword Popup: Updated trigger instructions after storage change');
  }
  if (area === 'local' && changes.preferredApi) {
    updateCurrentApiLabel(changes.preferredApi.newValue);
  }
});

function friendlyApiName(key) {
  const map = {
    freeDictionary: 'Free Dictionary',
    merriamWebster: 'Merriam-Webster',
    wordnik: 'Wordnik',
    duckDuckGo: 'DuckDuckGo',
    wiktionary: 'Wiktionary',
    merged: 'Merged'
  };
  return map[key] || key || 'Unknown';
}

function updateCurrentApiLabel(keyOrName) {
  try {
    const el = document.getElementById('currentApi');
    if (!el) return;
    if (typeof keyOrName === 'object' && keyOrName.source) {
      el.textContent = keyOrName.source;
      return;
    }
    el.textContent = friendlyApiName(keyOrName);
  } catch (e) { console.error('Failed to update currentApi label', e); }
}

// Periodically check and refresh trigger instructions to ensure they're up to date
async function refreshTriggerInstructions() {
  try {
    const { popupTriggerMode = "instant" } = await ext.storage.local.get("popupTriggerMode");
    console.log('Learnword Popup: Refreshing trigger instructions, current mode:', popupTriggerMode);
    updateTriggerInstructions(popupTriggerMode);
  } catch (error) {
    console.error('Learnword Popup: Error refreshing trigger instructions:', error);
  }
}

// Set up periodic refresh every 30 seconds to ensure trigger instructions stay in sync
setInterval(refreshTriggerInstructions, 30000);

// Also refresh when popup becomes visible again (in case it was closed and reopened)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('Learnword Popup: Popup became visible, refreshing trigger instructions');
    refreshTriggerInstructions();
  }
});

// API Key Dropdown
(function initApiKeyDropdown() {
  const root = document.getElementById('apiKeyDropdown');
  const btn = document.getElementById('apiKeyDropdownBtn');
  const menu = document.getElementById('apiKeyDropdownMenu');

  if (!root || !btn || !menu) return;

  function openDropdown() {
    root.classList.add('open');
    root.classList.remove('closed');
    root.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-expanded', 'true');
    menu.classList.remove('hidden');
  }

  function closeDropdown() {
    root.classList.remove('open');
    root.classList.add('closed');
    root.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-expanded', 'false');
    menu.classList.add('hidden');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = root.classList.contains('open');
    if (isOpen) closeDropdown();
    else openDropdown();
  });

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) closeDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      btn.click();
    }
  });
  
  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => closeDropdown());
  });
})();

// Diagnostics panel
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"'`]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '`':'&#96;'})[s]);
}

async function openDiagnostics() {
  try {
    const panel = document.getElementById('diagnosticPanel');
    const content = document.getElementById('diagnosticContent');
    if (!panel || !content) return;
    content.textContent = 'Loading...';
    const obj = await ext.storage.local.get('apiErrors');
    const list = obj.apiErrors || [];
    if (!list.length) {
      content.textContent = 'No recent API errors recorded.';
    } else {
      const html = ['<ul style="list-style:none;padding:0;margin:0">'];
      for (const e of list) {
        const time = new Date(e.ts).toLocaleString();
        const endpoint = e.endpoint ? ` <small>(${escapeHtml(e.endpoint)})</small>` : '';
        html.push(`<li style="margin-bottom:8px;padding:8px;border-bottom:1px solid #e6e6e6;">
          <div><strong>${escapeHtml(e.api)}</strong>${endpoint} — <small>${time}</small></div>
          <pre style="white-space:pre-wrap;margin:6px 0;padding:6px;background:#fff;border-radius:4px;border:1px solid #eee">${escapeHtml(e.error)}</pre>
        </li>`);
      }
      html.push('</ul>');
      content.innerHTML = html.join('');
    }
    panel.style.display = 'block';
    panel.classList.remove('hidden');
  } catch (err) {
    console.error('Open diagnostics failed', err);
  }
}

function closeDiagnostics() {
  const panel = document.getElementById('diagnosticPanel');
  if (!panel) return;
  panel.style.display = 'none';
  panel.classList.add('hidden');
}

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'diagnosticBtn') {
    e.preventDefault();
    openDiagnostics();
  }
  if (e.target && e.target.id === 'closeDiagnosticBtn') {
    e.preventDefault();
    closeDiagnostics();
  }
});

// ---------- History Feature ----------

async function loadHistory() {
  console.log('Learnword Popup: Loading history from storage');
  try {
    const { history = [] } = await ext.storage.local.get('history');
    console.log('Learnword Popup: Retrieved history:', history);
    
    currentHistory = history;
    
    const countBadge = document.getElementById('history-count');
    if (countBadge) {
      countBadge.textContent = history.length;
      console.log('Learnword Popup: Updated history count badge to:', history.length);
    } else {
      console.error('Learnword Popup: History count badge element not found');
    }
    
    const listContainer = document.getElementById('history-list');
    const emptyState = document.getElementById('history-empty');
    
    if (!listContainer) {
      console.error('Learnword Popup: History list container not found');
      return;
    }
    if (!emptyState) {
      console.error('Learnword Popup: History empty state element not found');
      return;
    }
    
    console.log('Learnword Popup: Rendering history list');
    renderHistoryList(history);
  } catch (error) {
    console.error('Learnword Popup: Error in loadHistory:', error);
  }
}

function renderHistoryList(history) {
  console.log('Learnword Popup: Rendering history list with', history.length, 'items');
  
  const listContainer = document.getElementById('history-list');
  const emptyState = document.getElementById('history-empty');
  
  if (!listContainer) {
    console.error('Learnword Popup: History list container element not found');
    return;
  }
  if (!emptyState) {
    console.error('Learnword Popup: History empty state element not found');
    return;
  }
  
  if (history.length === 0) {
    console.log('Learnword Popup: History is empty, showing empty state');
    listContainer.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  console.log('Learnword Popup: History has items, hiding empty state');
  emptyState.classList.add('hidden');
  
  try {
    const grouped = groupHistoryByDate(history);
    console.log('Learnword Popup: Grouped history by date:', Object.keys(grouped));
    
    let html = '';
    for (const [dateLabel, items] of Object.entries(grouped)) {
      console.log(`Learnword Popup: Processing group ${dateLabel} with ${items.length} items`);
      html += `<div class="history-group">`;
      html += `<div class="history-group-label">${dateLabel} (${items.length})</div>`;
      
      items.forEach(item => {
        const notePreview = item.note ? truncate(item.note, 30) : '';
        const hasNote = item.note ? 'has-note' : '';
        
        html += `
        <div class="history-item ${hasNote}" data-word="${escapeAttr(item.word)}">
          <div class="history-item-header">
            <span class="history-word">${escapeHtml(item.word)}</span>
            <span class="history-pos">${escapeHtml(item.partOfSpeech)}</span>
          </div>
          ${notePreview ? `<div class="history-note-preview">📝 "${escapeHtml(notePreview)}"</div>` : ''}
          <div class="history-item-footer">
            <span class="history-time">${formatTimeAgo(item.timestamp)}</span>
            <div class="history-item-actions">
              <button class="btn-delete" data-word="${escapeAttr(item.word)}" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        </div>
      `;
      });
      
      html += `</div>`;
    }
    
    console.log('Learnword Popup: Generated history HTML, updating container');
    setSafeHTML(listContainer, html);
    attachHistoryListeners();
    console.log('Learnword Popup: History list rendered successfully');
  } catch (error) {
    console.error('Learnword Popup: Error rendering history list:', error);
    setSafeHTML(listContainer, '<div class="history-error">Error loading history. Please try again.</div>');
  }
}

function groupHistoryByDate(history) {
  const groups = {
    'Today': [],
    'Yesterday': [],
    'Earlier': []
  };
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  history.forEach(item => {
    const itemDate = new Date(item.timestamp);
    const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
    
    if (itemDay.getTime() === today.getTime()) {
      groups['Today'].push(item);
    } else if (itemDay.getTime() === yesterday.getTime()) {
      groups['Yesterday'].push(item);
    } else {
      groups['Earlier'].push(item);
    }
  });
  
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) delete groups[key];
  });
  
  return groups;
}

function attachHistoryListeners() {
  document.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete') || e.target.closest('.btn-delete')) {
        return;
      }
      const word = item.dataset.word;
      showDefinitionView(word);
    });
  });
  
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const word = btn.dataset.word;
      // Use custom confirmation dialog instead of native confirm
      await showDeleteConfirmation(word);
    });
  });
}

// Check if Wikipedia page exists for a term
async function checkWikipediaExists(term) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(term)}&origin=*`;
    const response = await fetch(url);
    const data = await response.json();
    
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    
    // If pageId is -1, page doesn't exist
    return pageId !== '-1';
  } catch (error) {
    console.error('Wikipedia check failed:', error);
    return false;
  }
}

async function showDefinitionView(word) {
  const item = currentHistory.find(h => h.word.toLowerCase() === word.toLowerCase());
  if (!item) return;
  
  currentWord = item;
  
  document.getElementById('history-list-view').classList.add('hidden');
  document.getElementById('definition-view').classList.remove('hidden');
  
  const result = await new Promise(resolve => {
    runtime.sendMessage({ type: "learnword_lookup", word: item.word }, res => {
      resolve(res);
    });
  });
  
  document.getElementById('detail-word').textContent = item.word;
  
  const phoneticSpan = document.getElementById('detail-phonetic');
  const audioBtn = document.getElementById('detail-audio-btn');
  
  if (result && result.ok && result.data) {
    const data = result.data;
    
    const phoneticText = [data.phonetic, data.partOfSpeech].filter(Boolean).join(' • ');
    phoneticSpan.textContent = phoneticText;
    
    if (data.audio) {
      audioBtn.style.display = 'inline-block';
      audioBtn.onclick = () => playAudioInPopup(data.audio, data.word);
    } else {
      audioBtn.style.display = 'inline-block';
      audioBtn.onclick = () => speakTextInPopup(data.word);
    }
    
    const definitionsContainer = document.getElementById('detail-definitions');
    if (data.allDefinitions && data.allDefinitions.length > 0) {
      let defsHtml = '';
      data.allDefinitions.forEach((def, idx) => {
        const number = data.allDefinitions.length > 1 ? `<span class="definition-number">${idx + 1}.</span>` : '';
        const pos = def.partOfSpeech ? `<em>(${escapeHtml(def.partOfSpeech)})</em> ` : '';
        defsHtml += `<div class="definition-item">${number}${pos}${escapeHtml(def.text)}</div>`;
      });
      setSafeHTML(definitionsContainer, defsHtml);
    } else {
      setSafeHTML(definitionsContainer, `<div class="definition-item">${escapeHtml(data.definition || item.definition)}</div>`);
    }
  } else {
    phoneticSpan.textContent = item.partOfSpeech || '';
    audioBtn.style.display = 'none';
    setSafeHTML(document.getElementById('detail-definitions'), `<div class="definition-item">${escapeHtml(item.definition)}</div>`);
  }
  
  // Update source label and popup's active API name
  document.getElementById('detail-source').textContent = item.source;
  if (result && result.ok && result.data) updateCurrentApiLabel(result.data.source || item.source);
  else updateCurrentApiLabel(item.source);
  
  // Setup external buttons
  setupExternalButtons(item.word);
  
  updateNoteDisplay(item.note || '');
}

function setupExternalButtons(word) {
  const googleBtn = document.getElementById('google-search-btn');
  const wikiBtn = document.getElementById('wikipedia-btn');
  
  // Google button - always active
  googleBtn.onclick = () => {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(word)}`;
    ext.tabs.create({ url: searchUrl });
  };
  
  // Wikipedia button - check if page exists
  wikiBtn.classList.remove('active');
  wikiBtn.onclick = null;
  
  checkWikipediaExists(word).then(exists => {
    if (exists) {
      wikiBtn.classList.add('active');
      wikiBtn.onclick = () => {
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(word.replace(/ /g, '_'))}`;
        ext.tabs.create({ url: wikiUrl });
      };
    }
  });
}

function playAudioInPopup(url, fallbackWord) {
  try {
    const audio = new Audio(url);
    audio.addEventListener('error', () => { 
      if (fallbackWord) speakTextInPopup(fallbackWord); 
    });
    audio.play().catch(() => { 
      if (fallbackWord) speakTextInPopup(fallbackWord); 
    });
  } catch (e) { 
    if (fallbackWord) speakTextInPopup(fallbackWord); 
  }
}

function speakTextInPopup(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    speechSynthesis.speak(utterance);
  } catch (e) {}
}

function updateNoteDisplay(noteText) {
  const addNoteBtn = document.getElementById('add-note-btn');
  const notePreview = document.getElementById('note-preview');
  const noteEditor = document.getElementById('note-editor');
  
  if (noteText) {
    addNoteBtn.classList.add('hidden');
    notePreview.classList.remove('hidden');
    noteEditor.classList.add('hidden');
    setSafeHTML(document.getElementById('note-preview-text'), noteText);
  } else {
    addNoteBtn.classList.remove('hidden');
    notePreview.classList.add('hidden');
    noteEditor.classList.add('hidden');
  }
}

function showNoteEditor(existingNote = '') {
  const addNoteBtn = document.getElementById('add-note-btn');
  const notePreview = document.getElementById('note-preview');
  const noteEditor = document.getElementById('note-editor');
  const textarea = document.getElementById('note-textarea');
  
  addNoteBtn.classList.add('hidden');
  notePreview.classList.add('hidden');
  noteEditor.classList.remove('hidden');
  
  textarea.value = existingNote;
  updateCharCount();
  textarea.focus();
}

function updateCharCount() {
  const textarea = document.getElementById('note-textarea');
  const charCount = document.getElementById('char-count');
  charCount.textContent = `${textarea.value.length}/500`;
}

async function saveNote() {
  if (!currentWord) return;
  
  const textarea = document.getElementById('note-textarea');
  const noteText = textarea.value.trim();
  
  const { history = [] } = await ext.storage.local.get('history');
  const index = history.findIndex(h => h.word.toLowerCase() === currentWord.word.toLowerCase());
  
  if (index !== -1) {
    history[index].note = noteText;
    await ext.storage.local.set({ history });
    currentWord.note = noteText;
    updateNoteDisplay(noteText);
  }
}

async function deleteNote() {
  if (!currentWord) return;
  
  const { history = [] } = await ext.storage.local.get('history');
  const index = history.findIndex(h => h.word.toLowerCase() === currentWord.word.toLowerCase());
  
  if (index !== -1) {
    history[index].note = '';
    await ext.storage.local.set({ history });
    currentWord.note = '';
    updateNoteDisplay('');
  }
}

async function clearAllHistory() {
  // Actually clear the history (called after confirmation)
  await ext.storage.local.set({ history: [] });
  await loadHistory();
}

async function deleteHistoryEntry(word) {
  const { history = [] } = await ext.storage.local.get('history');
  const filtered = history.filter(h => h.word.toLowerCase() !== word.toLowerCase());
  await ext.storage.local.set({ history: filtered });
  await loadHistory();
}

function filterHistory(searchTerm) {
  if (!searchTerm) {
    renderHistoryList(currentHistory);
    return;
  }
  
  const term = searchTerm.toLowerCase();
  const filtered = currentHistory.filter(item => 
    item.word.toLowerCase().includes(term) ||
    item.definition.toLowerCase().includes(term) ||
    (item.note && item.note.toLowerCase().includes(term))
  );
  
  renderHistoryList(filtered);
}

function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/"/g, '&quot;');
}

// ---------- Confirmation Dialog with "Don't Ask Again" ----------

// Store the current confirmation action and type
let currentConfirmAction = null;
let currentConfirmationType = null; // 'deleteItem' or 'clearAll'

// Check if user has disabled confirmations
async function shouldShowConfirmation(type) {
  const { confirmationSettings = {} } = await ext.storage.local.get('confirmationSettings');
  return !confirmationSettings[type]; // Return false if user checked "don't ask again"
}

// Save confirmation preference
async function saveConfirmationPreference(type, dontAskAgain) {
  const { confirmationSettings = {} } = await ext.storage.local.get('confirmationSettings');
  confirmationSettings[type] = dontAskAgain;
  await ext.storage.local.set({ confirmationSettings });
}

// Show confirmation dialog for deleting a single word
async function showDeleteConfirmation(word) {
  // Check if user disabled this confirmation
  const shouldShow = await shouldShowConfirmation('deleteItem');
  if (!shouldShow) {
    // Execute directly without showing dialog
    await deleteHistoryEntry(word);
    return;
  }

  const dialog = document.getElementById('confirmDialog');
  const title = document.getElementById('confirmTitle');
  const message = document.getElementById('confirmMessage');
  const confirmBtn = document.getElementById('confirmBtn');
  const checkbox = document.getElementById('dontAskAgain');
  
  title.textContent = 'Delete from history?';
  message.textContent = `Delete "${word}" from your history? This cannot be undone.`;
  confirmBtn.textContent = 'Delete';
  checkbox.checked = false; // Reset checkbox
  
  currentConfirmationType = 'deleteItem';
  
  // Store the action to perform on confirm
  currentConfirmAction = async () => {
    await deleteHistoryEntry(word);
  };
  
  dialog.style.display = 'flex';
}

// Show confirmation dialog for clearing all history
async function showClearConfirmation() {
  // Check if user disabled this confirmation
  const shouldShow = await shouldShowConfirmation('clearAll');
  if (!shouldShow) {
    // Execute directly without showing dialog
    await clearAllHistory();
    return;
  }

  const dialog = document.getElementById('confirmDialog');
  const title = document.getElementById('confirmTitle');
  const message = document.getElementById('confirmMessage');
  const confirmBtn = document.getElementById('confirmBtn');
  const checkbox = document.getElementById('dontAskAgain');
  
  title.textContent = 'Clear all history?';
  message.textContent = 'This will delete all your lookup history. This cannot be undone.';
  confirmBtn.textContent = 'Clear All';
  checkbox.checked = false; // Reset checkbox
  
  currentConfirmationType = 'clearAll';
  
  // Store the action to perform on confirm
  currentConfirmAction = async () => {
    await clearAllHistory();
  };
  
  dialog.style.display = 'flex';
}

// Optional: Reset all confirmation preferences (can be called from settings)
async function resetConfirmationPreferences() {
  await ext.storage.local.set({ confirmationSettings: {} });
  console.log('Confirmation preferences reset');
}

// ---------- Event Listeners ----------

document.getElementById('back-to-history').addEventListener('click', () => {
  document.getElementById('definition-view').classList.add('hidden');
  document.getElementById('history-list-view').classList.remove('hidden');
  currentWord = null;
});

document.getElementById('add-note-btn').addEventListener('click', () => {
  showNoteEditor('');
});

document.getElementById('edit-note-btn').addEventListener('click', () => {
  showNoteEditor(currentWord?.note || '');
});

document.getElementById('delete-note-btn').addEventListener('click', async () => {
  await deleteNote();
});

document.getElementById('save-note-btn').addEventListener('click', async () => {
  await saveNote();
});

document.getElementById('cancel-note-btn').addEventListener('click', () => {
  updateNoteDisplay(currentWord?.note || '');
});

document.getElementById('note-textarea').addEventListener('input', updateCharCount);

document.getElementById('history-search').addEventListener('input', (e) => {
  filterHistory(e.target.value);
});

// Cancel button - hide dialog
document.getElementById('cancelBtn').addEventListener('click', () => {
  document.getElementById('confirmDialog').style.display = 'none';
  currentConfirmAction = null;
  currentConfirmationType = null;
});

// Confirm button - execute the stored action
document.getElementById('confirmBtn').addEventListener('click', async () => {
  const checkbox = document.getElementById('dontAskAgain');
  
  // Save preference if checkbox is checked
  if (checkbox.checked && currentConfirmationType) {
    await saveConfirmationPreference(currentConfirmationType, true);
  }
  
  // Execute the stored action
  if (currentConfirmAction) {
    await currentConfirmAction();
    currentConfirmAction = null;
  }
  
  currentConfirmationType = null;
  document.getElementById('confirmDialog').style.display = 'none';
});

// Clear all history button
document.getElementById('clear-history-btn').addEventListener('click', showClearConfirmation);

// Close dialog on overlay click
document.getElementById('confirmDialog').addEventListener('click', (e) => {
  if (e.target.id === 'confirmDialog') {
    document.getElementById('confirmDialog').style.display = 'none';
    currentConfirmAction = null;
    currentConfirmationType = null;
  }
});

(async () => {
  const { history = [] } = await ext.storage.local.get('history');
  document.getElementById('history-count').textContent = history.length;
})();
// In your popup.js
// Show custom confirmation dialog
function showClearConfirmation() 
{
  document.getElementById('confirmDialog').style.display = 'flex';
}
