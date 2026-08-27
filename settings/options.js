const ext = typeof browser !== "undefined" ? browser : chrome;
const runtime = ext.runtime;

const defaults = {
  maxLen: 64,
  preferredApi: 'freeDictionary',
  enableFallback: true,
  merriamWebsterKey: '',
  wordnikApiKey: '',
  popupTriggerMode: 'hotkey',
  hotkey: '',
  showQuickButton: true,
  targetLanguage: 'en',
  translationProvider: 'mymemory',
  googleTranslateKey: '',
  userEmail: ''
};

const POPULAR_LANGUAGES = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'hi', 'pt'];

function $(id){ return document.getElementById(id); }

/* --- UI elements --- */
const preferredApiEl = $('preferredApi');
const enableFallbackEl = $('enableFallback');
const merriamSection = $('merriamWebsterSection');
const wordnikSection = $('wordnikSection');
const merriamKeyEl = $('merriamWebsterKey');
const wordnikKeyEl = $('wordnikApiKey');
const saveMerriamBtn = $('saveMerriamKey');
const testMerriamBtn = $('testMerriam');
const saveWordnikBtn = $('saveWordnikKey');
const testWordnikBtn = $('testWordnik');
const merriamStatus = $('merriamStatus');
const wordnikStatus = $('wordnikStatus');

const targetLanguageEl = $('targetLanguage');
const translationProviderSection = $('translationProviderSection');
const translationProviderEl = $('translationProvider');
const myMemoryInfo = $('myMemoryInfo');
const googleTranslateSection = $('googleTranslateSection');
const userEmailEl = $('userEmail');
const saveEmailBtn = $('saveEmail');
const testMyMemoryBtn = $('testMyMemory');
const myMemoryStatus = $('myMemoryStatus');
const googleTranslateKeyEl = $('googleTranslateKey');
const saveTranslateKeyBtn = $('saveTranslateKey');
const testTranslateBtn = $('testTranslate');
const translateStatus = $('translateStatus');

const popupTriggerModeEl = $('popupTriggerMode');
const hotkeyRow = $('hotkeyRow');
const buttonTriggerRow = $('buttonTriggerRow');
const instantRow = $('instantRow');
const hotkeyDisplay = $('hotkeyDisplay');
const openSetHotkeyBtn = $('openSetHotkey');
const showQuickButtonEl = $('showQuickButton');

/* ---- Modal elements ---- */
const hotkeyModal = $('hotkeyModal');
const modalBackdrop = $('modalBackdrop');
const captureBox = $('captureBox');
const captureText = $('captureText');
const keyPreview = $('keyPreview');
const saveHotkeyBtn = $('saveHotkey');
const clearHotkeyBtn = $('clearHotkey');
const cancelHotkeyBtn = $('cancelHotkey');

// Tier UI elements
const currentTierBadge = $('currentTierBadge');
const tierBadge = $('tierBadge');
const freeTierOptions = $('freeTierOptions');
const proTierOptions = $('proTierOptions');
const licenseActivationForm = $('licenseActivationForm');
const licenseKeyInput = $('licenseKeyInput');
const activateLicenseBtn = $('activateLicenseBtn');
const deactivateLicenseBtn = $('deactivateLicenseBtn');
const cancelLicenseBtn = $('cancelLicenseBtn');
const showLicenseInputBtn = $('showLicenseInput');
const licenseStatus = $('licenseStatus');
const licensedSince = $('licensedSince');
const licenseKeyDisplay = $('licenseKeyDisplay');

/* State for capturing keys */
let captureKeys = new Set();
let lastCombo = '';

/* Utility to reload content scripts after settings change */
async function reloadContentScripts() {
  try {
    const tabs = await ext.tabs.query({});
    for (const tab of tabs) {
      try {
        await ext.tabs.sendMessage(tab.id, { type: 'reloadSettings' });
      } catch (e) {
        console.log(`Could not reload content script for tab ${tab.id}:`, e.message);
      }
    }
  } catch (e) {
    console.warn('Failed to reload content scripts:', e);
  }
}

/* Utility to normalize and format combo */
function normalizeCombo(comboSet) {
  const order = ['Control', 'Alt', 'Shift', 'Meta'];
  const parts = [];
  order.forEach(m => comboSet.has(m) && parts.push(m));
  const others = [...comboSet].filter(k => !order.includes(k));
  others.forEach(k => parts.push(k));
  return parts.join('+');
}

/* Display combo UI */
function renderCombo(combo) {
  keyPreview.innerHTML = '';
  if (!combo) {
    captureText.textContent = 'Waiting for keys…';
    saveHotkeyBtn.disabled = true;
    return;
  }
  captureText.textContent = 'Captured keys:';
  const parts = combo.split('+');
  parts.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'key-chip';
    chip.textContent = p;
    keyPreview.appendChild(chip);
  });
  saveHotkeyBtn.disabled = false;
}

/* Show/hide API key sections depending on preferredApi */
function updateApiKeySections(preferredApi) {
  const showMerriam = preferredApi === 'merriamWebster';
  const showWordnik = preferredApi === 'wordnik';

  merriamSection.style.display = showMerriam ? 'block' : 'none';
  merriamSection.setAttribute('aria-hidden', (!showMerriam).toString());
  wordnikSection.style.display = showWordnik ? 'block' : 'none';
  wordnikSection.setAttribute('aria-hidden', (!showWordnik).toString());
}

/* Show/hide translation sections based on language */
function updateTranslateSectionVisibility(targetLang) {
  if (targetLang === 'en') {
    translationProviderSection.style.display = 'none';
    googleTranslateSection.style.display = 'none';
  } else {
    translationProviderSection.style.display = 'block';
    updateTranslationProviderVisibility();
  }
}

/* Show/hide Google Translate section based on provider */
function updateTranslationProviderVisibility() {
  const provider = translationProviderEl.value;
  
  if (provider === 'google') {
    myMemoryInfo.style.display = 'none';
    googleTranslateSection.style.display = 'block';
  } else {
    myMemoryInfo.style.display = 'block';
    googleTranslateSection.style.display = 'none';
  }
}

/* Helper to show statuses */
function showStatus(id, msg, type='info') {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `status ${type}`;
  if (type === 'success') {
    setTimeout(()=>{ el.textContent=''; el.className='status'; }, 3500);
  }
}

/* Global status for minor updates */
function showGlobalStatus(message) {
  let global = document.getElementById('globalStatus');
  if (!global) {
    global = document.createElement('div');
    global.id = 'globalStatus';
    global.className = 'status success global';
    Object.assign(global.style, { position:'fixed', top:'20px', right:'20px', zIndex:3000 });
    document.body.appendChild(global);
  }
  global.textContent = message;
  global.style.display = 'block';
  setTimeout(()=> global.style.display='none', 2000);
}

// /**
//  * License activation handler
//  */
// async function activateLicenseFromUI() {
//   const key = licenseKeyInput.value.trim().toUpperCase();
  
//   if (!key) {
//     showLicenseStatus('Please enter a license key', 'error');
//     return;
//   }

//   activateLicenseBtn.disabled = true;
//   showLicenseStatus('Activating license...', 'info');

//   try {
//     const result = await runtime.sendMessage({
//       type: 'activateLicense',
//       licenseKey: key
//     });

//     if (!result.success) {
//       throw new Error(result.error || 'Activation failed');
//     }

//     showLicenseStatus('✓ License activated successfully!', 'success');
//     licenseKeyInput.value = '';

//     setTimeout(async () => {
//       await initializeTierUI();
//       licenseActivationForm.style.display = 'none';
//       await reloadContentScripts();
//     }, 1500);
//   } catch (err) {
//     showLicenseStatus('Error: ' + err.message, 'error');
//     activateLicenseBtn.disabled = false;
//   }
// }

/**
 * License deactivation handler
 */
// async function deactivateLicenseFromUI() {
//   if (!confirm('Are you sure? This will downgrade you to Free tier.')) {
//     return;
//   }

//   deactivateLicenseBtn.disabled = true;

//   try {
//     await ext.storage.sync.set({
//       tier: 'free',
//       licenseKey: '',
//       licensedAt: 0
//     });
    
//     await initializeTierUI();
//     await reloadContentScripts();
//   } catch (err) {
//     alert('Error deactivating license: ' + err.message);
//     deactivateLicenseBtn.disabled = false;
//   }
// }

/**
 * Show license status message
 */
// function showLicenseStatus(message, type = 'info') {
//   licenseStatus.textContent = message;
//   licenseStatus.className = `status ${type}`;
  
//   if (type === 'success') {
//     setTimeout(() => {
//       licenseStatus.textContent = '';
//       licenseStatus.className = 'status';
//     }, 3000);
//   }
// }

/**
 * Initialize tier UI display
 */
// async function initializeTierUI() {
//   try {
//     const { tier = 'free', licenseKey = '', licensedAt = 0 } = await ext.storage.sync.get(['tier', 'licenseKey', 'licensedAt']);
    
//     if (currentTierBadge) {
//       currentTierBadge.textContent = tier === 'pro' ? 'Pro' : 'Free';
//       currentTierBadge.setAttribute('data-tier', tier);
//     }
    
//     if (tierBadge) {
//       tierBadge.textContent = tier === 'pro' ? 'Pro' : 'Free';
//       tierBadge.setAttribute('data-tier', tier);
//     }
    
//     if (tier === 'pro' && proTierOptions) {
//       proTierOptions.style.display = 'block';
//       if (licenseActivationForm) licenseActivationForm.style.display = 'none';
      
//       if (licensedSince && licensedAt) {
//         const date = new Date(licensedAt).toLocaleDateString();
//         licensedSince.textContent = `License activated on ${date}`;
//       }
      
//       if (licenseKeyDisplay && licenseKey) {
//         const maskedKey = licenseKey.substring(0, 4) + '••••••••';
//         licenseKeyDisplay.textContent = maskedKey;
//       }
//     } else {
//       if (proTierOptions) proTierOptions.style.display = 'none';
//     }
//   } catch (error) {
//     console.error('Error initializing tier UI:', error);
//   }
// }

/* Load saved settings */
(async function load() {
  const saved = await ext.storage.local.get([
    'maxLen','preferredApi','enableFallback','merriamWebsterKey','wordnikApiKey',
    'popupTriggerMode','hotkey','showQuickButton','targetLanguage','translationProvider',
    'googleTranslateKey','userEmail','developerMode'
  ]);
  
  const s = { ...defaults, ...saved };

  preferredApiEl.value = s.preferredApi;
  enableFallbackEl.checked = !!s.enableFallback;
  merriamKeyEl.value = s.merriamWebsterKey || '';
  wordnikKeyEl.value = s.wordnikApiKey || '';
  popupTriggerModeEl.value = s.popupTriggerMode || defaults.popupTriggerMode;
  showQuickButtonEl.checked = s.showQuickButton !== false;
  targetLanguageEl.value = s.targetLanguage || 'en';
  translationProviderEl.value = s.translationProvider || 'mymemory';
  googleTranslateKeyEl.value = s.googleTranslateKey || '';
  userEmailEl.value = s.userEmail || '';

  hotkeyDisplay.textContent = s.hotkey || 'Not set';
  toggleTriggerModeUI(s.popupTriggerMode);

  updateApiKeySections(s.preferredApi);
  updateTranslateSectionVisibility(s.targetLanguage);

  if (s.merriamWebsterKey) showStatus('merriamStatus','API key loaded','success');
  if (s.wordnikApiKey) showStatus('wordnikStatus','API key loaded','success');
  if (s.googleTranslateKey) showStatus('translateStatus','API key loaded','success');
  if (s.userEmail) showStatus('myMemoryStatus','Email saved','success');

  console.log('Learnword Settings: Loaded settings', s);
})();

/* --- Event listeners --- */

/* Target Language change */
targetLanguageEl.addEventListener('change', async (e) => {
  const lang = e.target.value;
  await ext.storage.local.set({ targetLanguage: lang });
  updateTranslateSectionVisibility(lang);
  await reloadContentScripts();

  if (lang === 'en') {
    showGlobalStatus('Language set to English (Original)');
  } else {
    showGlobalStatus(`Language set to ${e.target.options[e.target.selectedIndex].text}`);
  }
});

/* Translation Provider change */
translationProviderEl.addEventListener('change', async (e) => {
  const provider = e.target.value;
  await ext.storage.local.set({ translationProvider: provider });
  updateTranslationProviderVisibility();
  await reloadContentScripts();
  
  if (provider === 'mymemory') {
    showGlobalStatus('Using MyMemory (Free) for translations');
  } else {
    showGlobalStatus('Using Google Translate (Your API key)');
  }
});

/* MyMemory Email handlers */
saveEmailBtn.addEventListener('click', async () => {
  const email = userEmailEl.value.trim();
  await ext.storage.local.set({ userEmail: email });
  
  if (email) {
    showStatus('myMemoryStatus', 'Email saved! You now have 50K chars/day limit ✓', 'success');
  } else {
    showStatus('myMemoryStatus', 'Email removed. Using anonymous mode (5K chars/day)', 'info');
  }
  await reloadContentScripts();
});

testMyMemoryBtn.addEventListener('click', async () => {
  const email = userEmailEl.value.trim();
  showStatus('myMemoryStatus','Testing MyMemory API...','info');
  
  const result = await runtime.sendMessage({ 
    type:'testTranslateApi', 
    provider: 'mymemory',
    email: email
  });
  
  if (result && result.ok) {
    const limit = email ? '50K' : '5K';
    showStatus('myMemoryStatus',`Connection successful! (${limit} chars/day limit) ✓`,'success');
  } else {
    showStatus('myMemoryStatus', `Connection failed: ${result?.error || 'Unknown'}`,'error');
  }
});

/* Google Translate API handlers */
saveTranslateKeyBtn.addEventListener('click', async () => {
  const key = googleTranslateKeyEl.value.trim();
  if (!key) { 
    showStatus('translateStatus','Please enter an API key','error'); 
    return; 
  }
  showStatus('translateStatus','Testing API key...','info');
  await ext.storage.local.set({ googleTranslateKey: key });
  
  const result = await runtime.sendMessage({ 
    type:'testTranslateApi', 
    provider: 'google',
    apiKey: key 
  });
  
  if (result && result.ok) {
    showStatus('translateStatus','API key saved and verified! ✓','success');
    await reloadContentScripts();
  } else {
    showStatus('translateStatus', `Error: ${result?.error || 'Unknown'}`,'error');
  }
});

testTranslateBtn.addEventListener('click', async () => {
  const key = googleTranslateKeyEl.value.trim();
  if (!key) { 
    showStatus('translateStatus','Please enter an API key first','error'); 
    return; 
  }
  showStatus('translateStatus','Testing connection...','info');
  
  const result = await runtime.sendMessage({ 
    type:'testTranslateApi',
    provider: 'google',
    apiKey: key 
  });
  
  if (result && result.ok) {
    showStatus('translateStatus','Connection successful! ✓','success');
  } else {
    showStatus('translateStatus', `Connection failed: ${result?.error || 'Unknown'}`,'error');
  }
});

/* Preferred API change */
preferredApiEl.addEventListener('change', async (e) => {
  const api = e.target.value;
  await ext.storage.local.set({ preferredApi: api });
  updateApiKeySections(api);
  await reloadContentScripts();
  showGlobalStatus('Preferred API updated');
});

/* Fallback toggle */
enableFallbackEl.addEventListener('change', async (e) => {
  await ext.storage.local.set({ enableFallback: e.target.checked });
  await reloadContentScripts();
  showGlobalStatus('Fallback updated');
});

/* API Key handlers */
saveMerriamBtn.addEventListener('click', async () => {
  const key = merriamKeyEl.value.trim();
  if (!key) { showStatus('merriamStatus','Please enter an API key','error'); return; }
  showStatus('merriamStatus','Testing API key...','info');
  await ext.storage.local.set({ merriamWebsterKey: key });
  const result = await runtime.sendMessage({ type:'testApi', apiName:'merriamWebster', apiKey:key });
  if (result && result.ok) {
    showStatus('merriamStatus','API key saved and verified! ✓','success');
    await reloadContentScripts();
  } else {
    showStatus('merriamStatus', `Error: ${result?.error || 'Unknown'}`,'error');
  }
});

testMerriamBtn.addEventListener('click', async () => {
  const key = merriamKeyEl.value.trim();
  if (!key) { showStatus('merriamStatus','Please enter an API key first','error'); return; }
  showStatus('merriamStatus','Testing connection...','info');
  const result = await runtime.sendMessage({ type:'testApi', apiName:'merriamWebster', apiKey:key });
  if (result && result.ok) showStatus('merriamStatus','Connection successful! ✓','success');
  else showStatus('merriamStatus', `Connection failed: ${result?.error || 'Unknown'}`,'error');
});

saveWordnikBtn.addEventListener('click', async () => {
  const key = wordnikKeyEl.value.trim();
  if (!key) { showStatus('wordnikStatus','Please enter an API key','error'); return; }
  showStatus('wordnikStatus','Testing API key...','info');
  await ext.storage.local.set({ wordnikApiKey: key });
  const result = await runtime.sendMessage({ type:'testApi', apiName:'wordnik', apiKey:key });
  if (result && result.ok) {
    showStatus('wordnikStatus','API key saved and verified! ✓','success');
    await reloadContentScripts();
  } else {
    showStatus('wordnikStatus', `Error: ${result?.error || 'Unknown'}`,'error');
  }
});

testWordnikBtn.addEventListener('click', async () => {
  const key = wordnikKeyEl.value.trim();
  if (!key) { showStatus('wordnikStatus','Please enter an API key first','error'); return; }
  showStatus('wordnikStatus','Testing connection...','info');
  const result = await runtime.sendMessage({ type:'testApi', apiName:'wordnik', apiKey:key });
  if (result && result.ok) showStatus('wordnikStatus','Connection successful! ✓','success');
  else showStatus('wordnikStatus', `Connection failed: ${result?.error || 'Unknown'}`,'error');
});

/* Popup trigger mode change */
popupTriggerModeEl.addEventListener('change', async (e) => {
  const mode = e.target.value;
  console.log('Learnword Settings: Trigger mode changed to', mode);
  
  await ext.storage.local.set({ popupTriggerMode: mode });
  toggleTriggerModeUI(mode);
  await reloadContentScripts();
  showGlobalStatus('Popup trigger updated');
  
  // Notify all content scripts about the trigger mode change
  try {
    const { hotkey = '' } = await ext.storage.local.get('hotkey');
    const tabs = await ext.tabs.query({});
    console.log('Learnword Settings: Notifying', tabs.length, 'tabs about trigger mode change');
    
    for (const tab of tabs) {
      try {
        await ext.tabs.sendMessage(tab.id, {
          type: 'triggerModeChanged',
          mode: mode,
          hotkey: hotkey
        });
        console.log('Learnword Settings: Notified tab', tab.id);
      } catch (error) {
        console.log('Learnword Settings: Could not notify tab', tab.id, ':', error.message);
      }
    }
  } catch (error) {
    console.error('Learnword Settings: Error notifying tabs:', error);
  }
});

/* Toggle UI subrows for trigger modes */
function toggleTriggerModeUI(mode) {
  console.log('Learnword Settings: Toggling UI for mode', mode);
  
  if (mode === 'hotkey') {
    hotkeyRow.classList.remove('hidden');
    buttonTriggerRow.classList.add('hidden');
    instantRow.classList.add('hidden');
  } else if (mode === 'button') {
    hotkeyRow.classList.add('hidden');
    buttonTriggerRow.classList.remove('hidden');
    instantRow.classList.add('hidden');
  } else {
    hotkeyRow.classList.add('hidden');
    buttonTriggerRow.classList.add('hidden');
    instantRow.classList.remove('hidden');
  }
}

/* show quick button toggle save */
showQuickButtonEl.addEventListener('change', async (e) => {
  await ext.storage.local.set({ showQuickButton: e.target.checked });
  await reloadContentScripts();
  showGlobalStatus('Quick button setting updated');
});

/* --- Hotkey modal logic --- */

openSetHotkeyBtn.addEventListener('click', (e) => {
  console.log('Learnword Settings: Set hotkey button clicked');
  e.preventDefault();
  e.stopPropagation();
  openHotkeyModal();
});

function openHotkeyModal() {
  console.log('Learnword Settings: Opening hotkey modal');
  captureKeys.clear();
  lastCombo = '';
  renderCombo('');
  hotkeyModal.classList.remove('hidden');
  setTimeout(() => {
    captureBox.focus();
    console.log('Learnword Settings: Hotkey modal opened and focused');
  }, 100);
}

function closeHotkeyModal() {
  console.log('Learnword Settings: Closing hotkey modal');
  hotkeyModal.classList.add('hidden');
  captureKeys.clear();
  renderCombo('');
}

captureBox.addEventListener('keydown', (ev) => {
  ev.preventDefault();
  ev.stopPropagation();

  const k = normalizeKey(ev);
  if (!k) return;

  captureKeys.add(k);
  lastCombo = normalizeCombo(captureKeys);
  renderCombo(lastCombo);
  console.log('Learnword Settings: Captured key combo:', lastCombo);
});

saveHotkeyBtn.addEventListener('click', async () => {
  if (!lastCombo) {
    console.warn('Learnword Settings: No hotkey combo to save');
    return;
  }
  
  console.log('Learnword Settings: Saving hotkey:', lastCombo);
  await ext.storage.local.set({ hotkey: lastCombo });
  hotkeyDisplay.textContent = lastCombo;
  closeHotkeyModal();
  await reloadContentScripts();
  showGlobalStatus('Hotkey saved');

  // Notify all content scripts about the hotkey change
  try {
    const { popupTriggerMode = 'hotkey' } = await ext.storage.local.get('popupTriggerMode');
    const tabs = await ext.tabs.query({});
    console.log('Learnword Settings: Notifying', tabs.length, 'tabs about hotkey change');
    
    for (const tab of tabs) {
      try {
        await ext.tabs.sendMessage(tab.id, {
          type: 'triggerModeChanged',
          mode: popupTriggerMode,
          hotkey: lastCombo
        });
        console.log('Learnword Settings: Notified tab', tab.id);
      } catch (error) {
        console.log('Learnword Settings: Could not notify tab', tab.id, ':', error.message);
      }
    }
  } catch (error) {
    console.error('Learnword Settings: Error notifying tabs:', error);
  }
});

clearHotkeyBtn.addEventListener('click', async () => {
  console.log('Learnword Settings: Clearing hotkey');
  await ext.storage.local.set({ hotkey: '' });
  hotkeyDisplay.textContent = 'Not set';
  lastCombo = '';
  captureKeys.clear();
  renderCombo('');
  await reloadContentScripts();
  showGlobalStatus('Hotkey cleared');
});

cancelHotkeyBtn.addEventListener('click', () => {
  console.log('Learnword Settings: Hotkey modal cancelled');
  closeHotkeyModal();
});

modalBackdrop.addEventListener('click', () => {
  console.log('Learnword Settings: Modal backdrop clicked');
  closeHotkeyModal();
});

captureBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
  }
});

function normalizeKey(ev) {
  if (ev.ctrlKey) captureKeys.add('Control');
  if (ev.shiftKey) captureKeys.add('Shift');
  if (ev.altKey) captureKeys.add('Alt');
  if (ev.metaKey) captureKeys.add('Meta');

  const key = ev.key;
  const ignored = ['Shift','Control','Alt','Meta','Dead'];
  if (ignored.includes(key)) return null;

  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key[0].toUpperCase() + key.slice(1);
}

function debounce(fn, wait){ let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); }; }

document.addEventListener('keydown', (e) => {
  if (!hotkeyModal.classList.contains('hidden') && e.key === 'Escape') {
    closeHotkeyModal();
  }
});

/* License activation event listeners */
// document.addEventListener('click', (e) => {
//   if (e.target && e.target.id === 'showLicenseInput') {
//     e.preventDefault();
//     const form = document.getElementById('licenseActivationForm');
//     const input = document.getElementById('licenseKeyInput');
//     if (form) {
//       form.style.display = 'block';
//       if (input) input.focus();
//     }
//   }
// });

// if (activateLicenseBtn) {
//   activateLicenseBtn.addEventListener('click', activateLicenseFromUI);
// }

// if (cancelLicenseBtn) {
//   cancelLicenseBtn.addEventListener('click', () => {
//     licenseActivationForm.style.display = 'none';
//     licenseKeyInput.value = '';
//     licenseStatus.textContent = '';
//     licenseStatus.className = 'status';
//   });
// }

// if (deactivateLicenseBtn) {
//   deactivateLicenseBtn.addEventListener('click', deactivateLicenseFromUI);
// }

// if (licenseKeyInput) {
//   licenseKeyInput.addEventListener('keypress', (e) => {
//     if (e.key === 'Enter') {
//       activateLicenseFromUI();
//     }
//   });
// }

console.log('Learnword Settings: options.js loaded and initialized');