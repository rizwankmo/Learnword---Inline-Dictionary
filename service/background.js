// ============================================================
//  Learnword – Background Service Worker
//  Single consolidated file — no importScripts needed.
// ============================================================

const ext = typeof browser !== "undefined" ? browser : chrome;
const runtime = ext.runtime;

console.log('[Learnword] Background service worker starting…');

// ─── Constants ────────────────────────────────────────────────
const CACHE_TTL_MS     = 1000 * 60 * 60 * 24 * 7; // 7 days
const FETCH_TIMEOUT_MS = 8000;
const MAX_HISTORY_ITEMS = 500;

// ─── In-memory cache ─────────────────────────────────────────
const MEM_CACHE = new Map();
const MEM_CACHE_MAX = 800;

function memSet(key, data) {
  try {
    MEM_CACHE.set(key, { data, ts: Date.now() });
    while (MEM_CACHE.size > MEM_CACHE_MAX) {
      MEM_CACHE.delete(MEM_CACHE.keys().next().value);
    }
  } catch (e) { /* ignore */ }
}

function memGet(key) {
  try {
    const ent = MEM_CACHE.get(key);
    if (!ent) return null;
    if (Date.now() - ent.ts > CACHE_TTL_MS) { MEM_CACHE.delete(key); return null; }
    return ent.data;
  } catch (e) { return null; }
}

// ─── Storage cache ────────────────────────────────────────────
async function getCached(key) {
  try {
    const obj = await ext.storage.local.get(key);
    const cached = obj && obj[key];
    if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) return cached.data;
    if (cached) await ext.storage.local.remove(key);
    return null;
  } catch (e) { return null; }
}

async function setCached(key, data) {
  try { await ext.storage.local.set({ [key]: { ts: Date.now(), data } }); } catch (e) {}
}

async function cleanupOldCache() {
  try {
    const all = await ext.storage.local.get(null);
    const now = Date.now();
    const toRemove = Object.entries(all)
      .filter(([k, v]) => k.startsWith('def_') && v.ts && (now - v.ts) > CACHE_TTL_MS)
      .map(([k]) => k);
    if (toRemove.length) await ext.storage.local.remove(toRemove);
  } catch (e) {}
}

// ─── History ──────────────────────────────────────────────────
async function saveToHistory(wordData) {
  try {
    const { history = [] } = await ext.storage.local.get('history');
    const i = history.findIndex(e => e.word.toLowerCase() === wordData.word.toLowerCase());
    if (i !== -1) {
      const existing = history[i];
      history[i] = { ...existing, timestamp: Date.now(), lookupCount: (existing.lookupCount || 1) + 1 };
      const updated = history.splice(i, 1)[0];
      history.unshift(updated);
    } else {
      history.unshift({
        word: wordData.word,
        definition: wordData.definition,
        partOfSpeech: wordData.partOfSpeech,
        timestamp: Date.now(),
        source: wordData.source,
        lookupCount: 1,
        note: ""
      });
    }
    if (history.length > MAX_HISTORY_ITEMS) history.splice(MAX_HISTORY_ITEMS);
    await ext.storage.local.set({ history });
  } catch (e) {}
}

// ─── Language map ─────────────────────────────────────────────
const SUPPORTED_LANGUAGES = {
  en: { name: 'English', code: 'en-US', rtl: false },
  af: { name: 'Afrikaans', code: 'af-ZA', rtl: false },
  sq: { name: 'Albanian', code: 'sq-AL', rtl: false },
  am: { name: 'Amharic', code: 'am-ET', rtl: false },
  ar: { name: 'Arabic', code: 'ar-SA', rtl: true },
  hy: { name: 'Armenian', code: 'hy-AM', rtl: false },
  az: { name: 'Azerbaijani', code: 'az-AZ', rtl: false },
  eu: { name: 'Basque', code: 'eu-ES', rtl: false },
  be: { name: 'Belarusian', code: 'be-BY', rtl: false },
  bn: { name: 'Bengali', code: 'bn-BD', rtl: false },
  bs: { name: 'Bosnian', code: 'bs-BA', rtl: false },
  bg: { name: 'Bulgarian', code: 'bg-BG', rtl: false },
  ca: { name: 'Catalan', code: 'ca-ES', rtl: false },
  zh: { name: 'Chinese (Simplified)', code: 'zh-CN', rtl: false },
  'zh-TW': { name: 'Chinese (Traditional)', code: 'zh-TW', rtl: false },
  hr: { name: 'Croatian', code: 'hr-HR', rtl: false },
  cs: { name: 'Czech', code: 'cs-CZ', rtl: false },
  da: { name: 'Danish', code: 'da-DK', rtl: false },
  nl: { name: 'Dutch', code: 'nl-NL', rtl: false },
  et: { name: 'Estonian', code: 'et-EE', rtl: false },
  fi: { name: 'Finnish', code: 'fi-FI', rtl: false },
  fr: { name: 'French', code: 'fr-FR', rtl: false },
  gl: { name: 'Galician', code: 'gl-ES', rtl: false },
  ka: { name: 'Georgian', code: 'ka-GE', rtl: false },
  de: { name: 'German', code: 'de-DE', rtl: false },
  el: { name: 'Greek', code: 'el-GR', rtl: false },
  gu: { name: 'Gujarati', code: 'gu-IN', rtl: false },
  ht: { name: 'Haitian Creole', code: 'ht-HT', rtl: false },
  he: { name: 'Hebrew', code: 'he-IL', rtl: true },
  hi: { name: 'Hindi', code: 'hi-IN', rtl: false },
  hu: { name: 'Hungarian', code: 'hu-HU', rtl: false },
  is: { name: 'Icelandic', code: 'is-IS', rtl: false },
  id: { name: 'Indonesian', code: 'id-ID', rtl: false },
  ga: { name: 'Irish', code: 'ga-IE', rtl: false },
  it: { name: 'Italian', code: 'it-IT', rtl: false },
  ja: { name: 'Japanese', code: 'ja-JP', rtl: false },
  kn: { name: 'Kannada', code: 'kn-IN', rtl: false },
  kk: { name: 'Kazakh', code: 'kk-KZ', rtl: false },
  km: { name: 'Khmer', code: 'km-KH', rtl: false },
  ko: { name: 'Korean', code: 'ko-KR', rtl: false },
  ku: { name: 'Kurdish', code: 'ku-TR', rtl: false },
  ky: { name: 'Kyrgyz', code: 'ky-KG', rtl: false },
  lo: { name: 'Lao', code: 'lo-LA', rtl: false },
  lv: { name: 'Latvian', code: 'lv-LV', rtl: false },
  lt: { name: 'Lithuanian', code: 'lt-LT', rtl: false },
  mk: { name: 'Macedonian', code: 'mk-MK', rtl: false },
  ms: { name: 'Malay', code: 'ms-MY', rtl: false },
  ml: { name: 'Malayalam', code: 'ml-IN', rtl: false },
  mt: { name: 'Maltese', code: 'mt-MT', rtl: false },
  mr: { name: 'Marathi', code: 'mr-IN', rtl: false },
  mn: { name: 'Mongolian', code: 'mn-MN', rtl: false },
  ne: { name: 'Nepali', code: 'ne-NP', rtl: false },
  no: { name: 'Norwegian', code: 'no-NO', rtl: false },
  fa: { name: 'Persian', code: 'fa-IR', rtl: true },
  pl: { name: 'Polish', code: 'pl-PL', rtl: false },
  pt: { name: 'Portuguese', code: 'pt-PT', rtl: false },
  'pt-BR': { name: 'Portuguese (Brazil)', code: 'pt-BR', rtl: false },
  pa: { name: 'Punjabi', code: 'pa-IN', rtl: false },
  ro: { name: 'Romanian', code: 'ro-RO', rtl: false },
  ru: { name: 'Russian', code: 'ru-RU', rtl: false },
  sr: { name: 'Serbian', code: 'sr-RS', rtl: false },
  si: { name: 'Sinhala', code: 'si-LK', rtl: false },
  sk: { name: 'Slovak', code: 'sk-SK', rtl: false },
  sl: { name: 'Slovenian', code: 'sl-SI', rtl: false },
  so: { name: 'Somali', code: 'so-SO', rtl: false },
  es: { name: 'Spanish', code: 'es-ES', rtl: false },
  sw: { name: 'Swahili', code: 'sw-KE', rtl: false },
  sv: { name: 'Swedish', code: 'sv-SE', rtl: false },
  tl: { name: 'Tagalog', code: 'tl-PH', rtl: false },
  tg: { name: 'Tajik', code: 'tg-TJ', rtl: false },
  ta: { name: 'Tamil', code: 'ta-IN', rtl: false },
  te: { name: 'Telugu', code: 'te-IN', rtl: false },
  th: { name: 'Thai', code: 'th-TH', rtl: false },
  tr: { name: 'Turkish', code: 'tr-TR', rtl: false },
  uk: { name: 'Ukrainian', code: 'uk-UA', rtl: false },
  ur: { name: 'Urdu', code: 'ur-PK', rtl: true },
  uz: { name: 'Uzbek', code: 'uz-UZ', rtl: false },
  vi: { name: 'Vietnamese', code: 'vi-VN', rtl: false },
  cy: { name: 'Welsh', code: 'cy-GB', rtl: false },
  yi: { name: 'Yiddish', code: 'yi-YI', rtl: false },
  zu: { name: 'Zulu', code: 'zu-ZA', rtl: false }
};

// ─── Helpers ──────────────────────────────────────────────────
function isModernTerm(word) {
  const w = word.trim();
  return [/\b[A-Z]{2,}\b/, /\./, /\b[A-Za-z]+\d+\b/, /\d+[A-Za-z]+\b/, /-/].some(p => p.test(w));
}

function cleanWordnikText(str) {
  if (!str) return "";
  return str
    .replace(/<xref[^>]*>(.*?)<\/xref>/gi, "$1")
    .replace(/<ix[^>]*>(.*?)<\/ix>/gi, "$1")
    .replace(/<sc[^>]*>(.*?)<\/sc>/gi, "$1")
    .replace(/<pos[^>]*>(.*?)<\/pos>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function withTimeout(promise, ms = FETCH_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    promise.then(r => { clearTimeout(timer); resolve(r); })
           .catch(e => { clearTimeout(timer); reject(e); });
  });
}

async function fetchWithRetry(fetchFn, maxRetries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await fetchFn(); }
    catch (err) {
      lastErr = err;
      if (err.message.includes('404') || err.message.includes('not found')) throw err;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
    }
  }
  throw lastErr;
}

function normalizeOutput(obj) {
  return {
    word: obj.word || "",
    phonetic: obj.phonetic || "",
    partOfSpeech: obj.partOfSpeech || "",
    dictAudioUrl: obj.dictAudioUrl || "",
    dictAudioFilename: obj.dictAudioFilename || "",
    dictProvider: obj.dictProvider || "",
    definition: obj.definition || "",
    allDefinitions: obj.allDefinitions || [],
    synonyms: obj.synonyms || [],
    examples: obj.examples || [],
    source: obj.source || "",
    originalLanguage: obj.originalLanguage || 'en',
    targetLanguage: obj.targetLanguage || 'en'
  };
}

// ─── Translation ───────────────────────────────────────────────
async function translateWithMyMemory(text, targetLang, userEmail = '') {
  if (!text || targetLang === 'en') return text;
  try {
    const langCode = SUPPORTED_LANGUAGES[targetLang]?.code || targetLang;
    let url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${langCode}`;
    if (userEmail) url += `&de=${encodeURIComponent(userEmail)}`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`MyMemory ${res.status}`);
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) return data.responseData.translatedText;
    throw new Error('Translation failed');
  } catch (err) { return text; }
}

async function translateWithGoogle(text, targetLang, apiKey) {
  if (!text || targetLang === 'en' || !apiKey) return text;
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, target: targetLang, format: 'text' }),
      signal: ctrl.signal
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`Google Translate ${res.status}`);
    const data = await res.json();
    return data.data.translations[0].translatedText;
  } catch (err) { return text; }
}

async function translateBatch(texts, targetLang, provider, apiKey = '', userEmail = '') {
  if (!texts?.length || targetLang === 'en') return texts;
  return Promise.all(texts.map(t =>
    provider === 'google' && apiKey
      ? translateWithGoogle(t, targetLang, apiKey).catch(() => t)
      : translateWithMyMemory(t, targetLang, userEmail).catch(() => t)
  ));
}

async function translateDefinitionData(data, targetLang, provider, apiKey, userEmail) {
  if (!data || targetLang === 'en') return data;
  try {
    const texts = [
      data.definition,
      ...data.allDefinitions.map(d => d.text),
      ...data.examples,
      ...data.synonyms
    ];
    const translated = await translateBatch(texts, targetLang, provider, apiKey, userEmail);
    let idx = 0;
    return {
      ...data,
      definition: translated[idx++],
      allDefinitions: data.allDefinitions.map(d => ({ ...d, text: translated[idx++] })),
      examples: data.examples.map(() => translated[idx++]),
      synonyms: data.synonyms.map(() => translated[idx++]),
      originalLanguage: 'en',
      targetLanguage: targetLang
    };
  } catch (err) { return data; }
}

// ─── API Adapters ─────────────────────────────────────────────
const API_ADAPTERS = {
  freeDictionary: {
    name: "Free Dictionary API",
    requiresKey: false,
    async fetch(term) {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`, {
        cache: "no-store", headers: { Accept: 'application/json' }
      });
      if (!res.ok) throw new Error(res.status === 404
        ? `"${term}" not found in Free Dictionary`
        : `Free Dictionary error (${res.status})`);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) throw new Error('Invalid response from Free Dictionary');
      return data;
    },
    extract(raw) {
      if (!Array.isArray(raw) || !raw.length) return null;
      const entry = raw[0];
      const allDefs = [];
      const examples = [];
      const allSynonyms = [];
      const synSeen = new Set();
      (entry.meanings || []).forEach(m => {
        (m.definitions || []).forEach(d => {
          if (d.definition) allDefs.push({ text: d.definition, partOfSpeech: m.partOfSpeech || "" });
          if (d.example) examples.push(d.example);
          (d.synonyms || []).forEach(s => { if (!synSeen.has(s)) { synSeen.add(s); allSynonyms.push(s); }});
        });
        (m.synonyms || []).forEach(s => { if (!synSeen.has(s)) { synSeen.add(s); allSynonyms.push(s); }});
      });
      if (!allDefs.length) return null;
      return {
        word: entry.word || "",
        phonetic: entry.phonetic || entry.phonetics?.find(p => p.text)?.text || "",
        partOfSpeech: entry.meanings?.[0]?.partOfSpeech || "",
        dictAudioUrl: entry.phonetics?.find(p => p.audio)?.audio || "",
        dictAudioFilename: "", dictProvider: "",
        definition: allDefs[0].text,
        allDefinitions: allDefs,
        synonyms: allSynonyms,
        examples,
        source: "Free Dictionary API"
      };
    }
  },

  merriamWebster: {
    name: "Merriam-Webster",
    requiresKey: true,
    async fetch(term, apiKey) {
      const res = await fetch(`https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(term)}?key=${apiKey}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Merriam-Webster error (${res.status})`);
      return res.json();
    },
    extract(raw) {
      if (!Array.isArray(raw) || !raw.length || typeof raw[0] === 'string') return null;
      const entry = raw[0];
      const allDefinitions = [];
      (entry.def || []).forEach(defGroup => {
        (defGroup.sseq || []).forEach(senseSeq => {
          senseSeq.forEach(([type, data]) => {
            if (type === 'sense') {
              (data?.dt || []).forEach(([dt, text]) => {
                if (dt === 'text') {
                  const defText = text.replace(/\{[^}]+\}/g, '').trim();
                  if (defText) allDefinitions.push({ text: defText, partOfSpeech: entry.fl || "" });
                }
              });
            }
          });
        });
      });
      if (!allDefinitions.length && entry.shortdef) {
        entry.shortdef.forEach(d => allDefinitions.push({ text: d, partOfSpeech: entry.fl || "" }));
      }
      if (!allDefinitions.length) return null;
      const examples = [];
      (entry.def || []).forEach(defGroup => {
        (defGroup.sseq || []).forEach(senseSeq => {
          senseSeq.forEach(([type, data]) => {
            if (type === 'sense') {
              (data?.dt || []).forEach(([dt, vis]) => {
                if (dt === 'vis') vis.forEach(v => { if (v.t) examples.push(v.t.replace(/\{[^}]+\}/g, '').trim()); });
              });
            }
          });
        });
      });
      return {
        word: entry.hwi?.hw?.replace(/\*/g, '') || entry.meta?.id?.split(':')[0] || "",
        phonetic: entry.hwi?.prs?.[0]?.mw || "",
        partOfSpeech: entry.fl || "",
        dictAudioFilename: entry.hwi?.prs?.[0]?.sound?.audio || "",
        dictProvider: 'mw', dictAudioUrl: "",
        definition: allDefinitions[0].text,
        allDefinitions,
        synonyms: (entry.meta?.syns || []).flat(),
        examples,
        source: "Merriam-Webster"
      };
    }
  },

  wordnik: {
    name: "Wordnik",
    requiresKey: true,
    async fetch(term, apiKey) {
      const base = `https://api.wordnik.com/v4/word.json/${encodeURIComponent(term)}`;
      const p = `api_key=${encodeURIComponent(apiKey)}`;
      const [defsR, exR, prR, relR] = await Promise.allSettled([
        fetch(`${base}/definitions?limit=20&${p}`),
        fetch(`${base}/examples?limit=8&${p}`),
        fetch(`${base}/pronunciations?limit=2&${p}`),
        fetch(`${base}/relatedWords?relationshipTypes=synonym&limitPerRelationshipType=8&${p}`)
      ]);
      return {
        definitions: defsR.status === 'fulfilled' && defsR.value.ok ? await defsR.value.json() : [],
        examples: exR.status === 'fulfilled' && exR.value.ok ? await exR.value.json() : { examples: [] },
        pronunciations: prR.status === 'fulfilled' && prR.value.ok ? await prR.value.json() : [],
        related: relR.status === 'fulfilled' && relR.value.ok ? await relR.value.json() : [],
        term
      };
    },
    extract(raw) {
      const definitions = (raw.definitions || [])
        .filter(d => d.text)
        .map(d => ({ text: cleanWordnikText(d.text), partOfSpeech: d.partOfSpeech || "" }));
      if (!definitions.length) return null;
      return {
        word: raw.term,
        phonetic: raw.pronunciations?.[0]?.raw || "",
        partOfSpeech: definitions[0].partOfSpeech || "",
        dictAudioUrl: "", dictAudioFilename: "", dictProvider: "",
        definition: definitions[0].text,
        allDefinitions: definitions,
        synonyms: raw.related?.find(r => r.relationshipType === 'synonym')?.words || [],
        examples: (raw.examples?.examples || []).map(e => cleanWordnikText(e.text)),
        source: "Wordnik"
      };
    }
  },

  duckDuckGo: {
    name: "DuckDuckGo Instant Answer",
    requiresKey: false,
    async fetch(term) {
      try {
        const res = await fetch(`https://api.duckduckgo.com/?q=define+${encodeURIComponent(term)}&format=json&no_html=1&skip_disambig=1`, { cache: "no-store" });
        if (!res.ok) return null;
        return res.json();
      } catch (e) { return null; }
    },
    extract(raw) {
      if (!raw?.AbstractText?.trim()) return null;
      return {
        word: raw.Heading || "",
        phonetic: "", partOfSpeech: "",
        dictAudioUrl: "", dictAudioFilename: "", dictProvider: "",
        definition: raw.AbstractText.trim(),
        allDefinitions: [{ text: raw.AbstractText.trim(), partOfSpeech: "" }],
        synonyms: [], examples: [],
        source: "DuckDuckGo",
        sourceUrl: raw.AbstractURL || ""
      };
    }
  },

  wiktionary: {
    name: "Wiktionary",
    requiresKey: false,
    async fetch(term) {
      try {
        const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`, { cache: "no-store" });
        if (!res.ok) return null;
        const summary = await res.json();
        return { summary };
      } catch (e) { return null; }
    },
    extract(raw) {
      if (!raw?.summary) return null;
      const { summary } = raw;
      const definition = (summary.extract || summary.description || "").replace(/<[^>]*>/g, '').trim();
      if (!definition || ['redirect', 'disambiguation', 'see also'].some(s => definition.toLowerCase().includes(s))) return null;
      return {
        word: summary.title || "",
        phonetic: "", partOfSpeech: "",
        dictAudioUrl: "", dictAudioFilename: "", dictProvider: "",
        definition,
        allDefinitions: [{ text: definition, partOfSpeech: "" }],
        synonyms: [], examples: [],
        source: "Wiktionary",
        sourceUrl: summary.content_urls?.desktop?.page || `https://en.wiktionary.org/wiki/${encodeURIComponent(summary.title || term)}`
      };
    }
  },

  merged: {
    name: "Merged (DDG + Wiktionary)",
    requiresKey: false,
    async fetch(term) {
      const [ddgR, wikiR] = await Promise.allSettled([
        API_ADAPTERS.duckDuckGo.fetch(term).catch(() => null),
        API_ADAPTERS.wiktionary.fetch(term).catch(() => null)
      ]);
      return {
        ddg: ddgR.status === 'fulfilled' ? ddgR.value : null,
        wiki: wikiR.status === 'fulfilled' ? wikiR.value : null
      };
    },
    extract(raw) {
      let ddg = null, wiki = null;
      try { ddg = raw.ddg ? API_ADAPTERS.duckDuckGo.extract(raw.ddg) : null; } catch (e) {}
      try { wiki = raw.wiki ? API_ADAPTERS.wiktionary.extract(raw.wiki) : null; } catch (e) {}
      if (!ddg && !wiki) return null;
      const primary = ddg || wiki;
      const allDefinitions = [
        ...(ddg?.allDefinitions || []).map(d => ({ ...d, source: "DuckDuckGo" })),
        ...(wiki?.allDefinitions || []).map(d => ({ ...d, source: "Wiktionary" }))
      ];
      return { ...primary, allDefinitions, definition: ddg?.definition || wiki?.definition || "", source: "Merged (DDG + Wiktionary)" };
    }
  }
};

// ─── Smart API ordering ───────────────────────────────────────
function getSmartApiOrder(term, preferredApi, enableFallback, settings) {
  if (isModernTerm(term)) {
    const order = [];
    if (settings.wordnikApiKey) order.push('wordnik');
    if (settings.merriamWebsterKey) order.push('merriamWebster');
    order.push('freeDictionary');
    return order;
  }
  const order = preferredApi && API_ADAPTERS[preferredApi] ? [preferredApi] : [];
  if (enableFallback) {
    ['freeDictionary', 'merriamWebster', 'wordnik', 'merged', 'wiktionary', 'duckDuckGo'].forEach(api => {
      if (order.includes(api)) return;
      if (api === 'merriamWebster' && !settings.merriamWebsterKey) return;
      if (api === 'wordnik' && !settings.wordnikApiKey) return;
      order.push(api);
    });
  }
  return order;
}

// ─── Merge results ────────────────────────────────────────────
function mergeResults(extractedList) {
  const merged = {
    word: extractedList[0].data.word,
    phonetic: extractedList.find(x => x.data.phonetic)?.data.phonetic || "",
    partOfSpeech: extractedList.find(x => x.data.partOfSpeech)?.data.partOfSpeech || "",
    dictAudioUrl: extractedList.find(x => x.data.dictAudioUrl)?.data.dictAudioUrl || "",
    dictAudioFilename: extractedList.find(x => x.data.dictAudioFilename)?.data.dictAudioFilename || "",
    dictProvider: extractedList.find(x => x.data.dictProvider)?.data.dictProvider || "",
    definition: extractedList[0].data.definition,
    allDefinitions: [], synonyms: [], examples: [],
    source: extractedList.map(x => x.api).join(' + ')
  };
  const defsSeen = new Set();
  const synSeen = new Set();
  const exSeen = new Set();
  for (const { data } of extractedList) {
    data.allDefinitions.forEach(d => {
      const key = d.text.trim().toLowerCase();
      if (!defsSeen.has(key) && d.text.length > 10) { defsSeen.add(key); merged.allDefinitions.push(d); }
    });
    data.synonyms.forEach(s => {
      if (!synSeen.has(s.toLowerCase())) { synSeen.add(s.toLowerCase()); merged.synonyms.push(s); }
    });
    data.examples.forEach(e => {
      if (!exSeen.has(e.toLowerCase()) && e.length > 15) { exSeen.add(e.toLowerCase()); merged.examples.push(e); }
    });
  }
  return normalizeOutput(merged);
}

// ─── Prefetch tracking ────────────────────────────────────────
const PREFETCH_ONGOING = new Set();

// ─── Main fetchDefinition ──────────────────────────────────────
async function fetchDefinition(term, options = {}) {
  const settings = await ext.storage.local.get([
    'preferredApi', 'enableFallback', 'merriamWebsterKey', 'wordnikApiKey',
    'targetLanguage', 'translationProvider', 'googleTranslateKey', 'userEmail'
  ]);

  const targetLang = settings.targetLanguage || 'en';
  const provider = settings.translationProvider || 'mymemory';
  const googleKey = settings.googleTranslateKey || '';
  const userEmail = settings.userEmail || '';

  const langCacheKey = `def_${term.toLowerCase()}_${targetLang}`;
  const cached = await getCached(langCacheKey);
  if (cached) { await saveToHistory(cached); return cached; }

  const apiOrder = getSmartApiOrder(term, settings.preferredApi || 'freeDictionary', settings.enableFallback !== false, settings);
  console.log(`[Learnword] Looking up "${term}" via:`, apiOrder);

  const extractedList = [];
  const errorLog = [];

  for (const apiName of apiOrder) {
    const adapter = API_ADAPTERS[apiName];
    if (!adapter) continue;
    try {
      let raw;
      if (adapter.requiresKey) {
        const keyField = apiName === 'merriamWebster' ? 'merriamWebsterKey' : 'wordnikApiKey';
        const apiKey = settings[keyField];
        if (!apiKey) { errorLog.push(`${apiName}: no API key`); continue; }
        raw = await withTimeout(fetchWithRetry(() => adapter.fetch(term, apiKey)));
      } else {
        raw = await withTimeout(fetchWithRetry(() => adapter.fetch(term)));
      }
      const extracted = adapter.extract(raw);
      if (extracted?.definition) {
        console.log(`[Learnword] ✓ ${apiName} succeeded`);
        extractedList.push({ api: apiName, data: normalizeOutput(extracted) });
        if (apiName === settings.preferredApi && !isModernTerm(term)) break;
      } else {
        errorLog.push(`${apiName}: no valid definition extracted`);
      }
    } catch (err) {
      console.warn(`[Learnword] ✗ ${apiName} failed:`, err.message);
      errorLog.push(`${apiName}: ${err.message}`);
    }
  }

  if (!extractedList.length) {
    console.error('[Learnword] All APIs failed:', errorLog);
    throw new Error(`No definition found for "${term}"`);
  }

  const finalData = extractedList.length === 1 ? extractedList[0].data : mergeResults(extractedList);
  const translated = await translateDefinitionData(finalData, targetLang, provider, googleKey, userEmail);

  await setCached(langCacheKey, translated);
  await saveToHistory(translated);
  return translated;
}

// ─── Tier manager (minimal inline) ────────────────────────────
const TierManager = {
  async getUserTier() {
    try {
      const data = await ext.storage.sync.get(['tier']);
      return data.tier || 'free';
    } catch (e) { return 'free'; }
  },
  async getLookupProgress() {
    try {
      const data = await ext.storage.local.get(['lookupCount', 'lastResetDate']);
      return { lookupCount: data.lookupCount || 0, resetDate: data.lastResetDate || new Date().toDateString() };
    } catch (e) { return { lookupCount: 0, resetDate: new Date().toDateString() }; }
  }
};

// ─── Context menu ─────────────────────────────────────────────
ext.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'learnword-lookup' && info.selectionText) {
    ext.tabs.sendMessage(tab.id, { type: 'showFromContextMenu', term: info.selectionText })
      .catch(err => console.warn('[Learnword] Context menu send failed:', err));
  }
});

// ─── Install defaults ─────────────────────────────────────────
runtime.onInstalled.addListener(() => {
  ext.storage.local.get(['preferredApi', 'enableFallback', 'history', 'targetLanguage', 'translationProvider', 'googleTranslateKey', 'userEmail'], res => {
    const defaults = { preferredApi: 'freeDictionary', enableFallback: true, history: [], targetLanguage: 'en', translationProvider: 'mymemory', googleTranslateKey: '', userEmail: '' };
    for (const k in defaults) {
      if (res[k] === undefined) ext.storage.local.set({ [k]: defaults[k] });
    }
  });
  ext.contextMenus.create({ id: 'learnword-lookup', title: 'Look up "%s" with Learnword', contexts: ['selection'] }, () => {
    if (runtime.lastError) console.error('[Learnword] Context menu error:', String(runtime.lastError));
  });
});

// ─── Single consolidated message listener ─────────────────────
runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  // Ping — keeps service worker alive
  if (msg.type === '__ping__') {
    sendResponse(true);
    return false;
  }

  // PDF fetch
  if (msg.action === 'FETCH_PDF') {
    fetch(msg.url)
      .then(r => r.arrayBuffer())
      .then(buffer => {
        const binary = Array.from(new Uint8Array(buffer)).map(b => String.fromCharCode(b)).join('');
        sendResponse({ base64: btoa(binary) });
      })
      .catch(e => sendResponse({ error: String(e) }));
    return true;
  }

  // Show from PDF
  if (msg.type === 'showFromPDF') {
    ext.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) ext.tabs.sendMessage(tabs[0].id, { action: 'showPopup', text: msg.text, position: msg.position });
    });
    sendResponse({ success: true });
    return true;
  }

  // Tier progress
  if (msg.type === 'getProgress') {
    TierManager.getLookupProgress()
      .then(progress => sendResponse({ ok: true, progress }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  // License activate
  if (msg.type === 'activateLicense') {
    // Minimal implementation — accept and store
    ext.storage.sync.set({ tier: 'pro', licenseKey: msg.licenseKey, licensedAt: Date.now() })
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: String(err) }));
    return true;
  }

  // Prefetch (fire and forget)
  if (msg.type === 'prefetch' && msg.term) {
    const term = String(msg.term).trim();
    const target = msg.targetLang || 'en';
    const cacheKey = `def_${term.toLowerCase()}_${target}`;
    if (memGet(cacheKey)) { sendResponse({ ok: true, cached: true }); return false; }
    if (PREFETCH_ONGOING.has(cacheKey)) { sendResponse({ ok: true, queued: true }); return false; }
    PREFETCH_ONGOING.add(cacheKey);
    fetchDefinition(term, {}).then(data => memSet(cacheKey, data)).catch(() => {}).finally(() => PREFETCH_ONGOING.delete(cacheKey));
    sendResponse({ ok: true, started: true });
    return false;
  }

  // ── Main lookup handlers ──────────────────────────────────
  // Handles both the old "lookup" type (content.js) and "learnword_lookup"
  const isLookup = msg.type === 'lookup' || msg.type === 'learnword_lookup' || msg.action === 'lookupWord';
  if (isLookup) {
    const term = msg.term || msg.word || "";
    const targetLang = msg.targetLang || msg.lang || 'en';

    if (!term) {
      sendResponse({ ok: false, error: 'No term provided' });
      return false;
    }

    const cacheKey = `def_${String(term).toLowerCase()}_${targetLang}`;
    const inMem = memGet(cacheKey);
    if (inMem) { sendResponse({ ok: true, data: inMem, cached: true }); return false; }

    (async () => {
      try {
        const result = await fetchDefinition(term, { targetLang });
        try { memSet(cacheKey, result); } catch (e) {}
        sendResponse({ ok: true, data: result });
      } catch (err) {
        console.error('[Learnword] Lookup error:', err.message);
        sendResponse({ ok: false, error: err.message || String(err) });
      }
    })();
    return true; // keep channel open for async response
  }

  return false;
});

// ─── Periodic cache cleanup ───────────────────────────────────
setInterval(cleanupOldCache, 60 * 60 * 1000);

console.log('[Learnword] Background service worker ready.');