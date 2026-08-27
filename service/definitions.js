/*
  learnword-definitions.js - FIXED VERSION
  Improved with better error handling and local dictionary fallback
*/

// CACHE_TTL_MS is provided by background.js via importScripts
// Simple local dictionary as fallback
const BASIC_DICTIONARY = {
  'hello': { definition: 'a polite greeting', phonetic: 'hə-ˈlō', partOfSpeech: 'noun/interjection', examples: ['Hello, how are you?'] },
  'world': { definition: 'the earth and its inhabitants', phonetic: 'ˈwərld', partOfSpeech: 'noun', examples: ['The world is beautiful.'] },
  'learn': { definition: 'to acquire knowledge or skill', phonetic: 'ˈlərn', partOfSpeech: 'verb', examples: ['I want to learn new languages.'] },
  'word': { definition: 'a single distinct meaningful element of speech', phonetic: 'ˈwərd', partOfSpeech: 'noun', examples: ['That word has multiple meanings.'] },
  'test': { definition: 'a procedure to assess functionality', phonetic: 'ˈtest', partOfSpeech: 'noun/verb', examples: ['This is a test.'] },
};

// Utility helpers
function safeJson(res) {
  if (!res) return null;
  return res.json().catch(() => null);
}

async function storageGet(key) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([key], (items) => resolve(items[key]));
    } catch (e) {
      resolve(null);
    }
  });
}

async function storageSet(items) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(items, () => resolve(true));
    } catch (e) {
      resolve(false);
    }
  });
}

async function cacheGet(key) {
  const entry = await storageGet(`lw_cache__${key}`);
  if (!entry) return null;
  if (entry.expiry && entry.expiry < Date.now()) return null;
  return entry.value;
}

async function cacheSet(key, value, ttl = CACHE_TTL_MS) {
  const expiry = Date.now() + ttl;
  await storageSet({ [`lw_cache__${key}`]: { value, expiry } });
}

function encodeWord(word) {
  return encodeURIComponent(word.trim());
}

// ✅ NEW: Improved fetchGoogleTranslateDict with better error handling
async function fetchGoogleTranslateDict(word, lang = 'en') {
  try {
    const key = `gtrans::${lang}::${word}`;
    const cached = await cacheGet(key);
    if (cached) return { source: 'google_translate', data: cached };

    console.log(`[Learnword] Fetching Google Translate for "${word}"...`);
    
    // Try to fetch with a 2.5 second timeout (reduced)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=${lang}&dt=t&dt=bd&dj=1&q=${encodeWord(word)}`;
      const res = await fetch(url, { signal: controller.signal });
      
      if (!res.ok) {
        console.warn(`[Learnword] Google Translate returned ${res.status}`);
        return null;
      }
      
      const json = await safeJson(res);
      if (!json) {
        console.warn('[Learnword] Google Translate returned invalid JSON');
        return null;
      }
      
      console.log('[Learnword] Google Translate succeeded');
      await cacheSet(key, json);
      return { source: 'google_translate', data: json };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    console.warn(`[Learnword] Google Translate error: ${e.message}`);
    return null;
  }
}

// ✅ NEW: DuckDuckGo with better error handling
async function fetchDuckDuckGo(word, lang = 'en') {
  try {
    const key = `ddg::${lang}::${word}`;
    const cached = await cacheGet(key);
    if (cached) return { source: 'ddg', data: cached };

    console.log(`[Learnword] Fetching DuckDuckGo for "${word}"...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout
    
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeWord(word)}&format=json&pretty=1`;
      const res = await fetch(url, { signal: controller.signal });
      
      if (!res.ok) {
        console.warn(`[Learnword] DuckDuckGo returned ${res.status}`);
        return null;
      }
      
      const json = await safeJson(res);
      if (!json) {
        console.warn('[Learnword] DuckDuckGo returned invalid JSON');
        return null;
      }
      
      console.log('[Learnword] DuckDuckGo succeeded');
      await cacheSet(key, json);
      return { source: 'ddg', data: json };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    console.warn(`[Learnword] DuckDuckGo error: ${e.message}`);
    return null;
  }
}

// ✅ NEW: Format local dictionary data
function formatLocalDefinition(word) {
  const normalized = word.toLowerCase().trim();
  const entry = BASIC_DICTIONARY[normalized];
  
  if (!entry) return null;
  
  return {
    word: word,
    definition: entry.definition,
    phonetic: entry.phonetic,
    partOfSpeech: entry.partOfSpeech,
    allDefinitions: [{ text: entry.definition, partOfSpeech: entry.partOfSpeech }],
    examples: entry.examples || [],
    synonyms: [],
    sources: { local: true }
  };
}

// ✅ NEW: Fetch from Free Dictionary API (Best quality, no key required)
async function fetchFreeDictionary(word) {
  try {
    const key = `freedict::${word}`;
    const cached = await cacheGet(key);
    if (cached) return { source: 'free_dictionary', data: cached };

    console.log(`[Learnword] Fetching Free Dictionary for "${word}"...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout
    
    try {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeWord(word)}`;
      const res = await fetch(url, { signal: controller.signal });
      
      if (!res.ok) {
        console.warn(`[Learnword] Free Dictionary returned ${res.status}`);
        return null;
      }
      
      const json = await safeJson(res);
      if (!json || !Array.isArray(json) || !json[0]) {
        console.warn('[Learnword] Free Dictionary returned invalid data');
        return null;
      }
      
      const entry = json[0];
      
      // Transform API response to our format
      const allDefs = [];
      const examples = [];
      const synonyms = new Set();
      
      if (entry.meanings && Array.isArray(entry.meanings)) {
        entry.meanings.forEach(meaning => {
          if (meaning.definitions && Array.isArray(meaning.definitions)) {
            meaning.definitions.forEach(def => {
              allDefs.push({
                text: def.definition || '',
                partOfSpeech: meaning.partOfSpeech || ''
              });
              if (def.example) examples.push(def.example);
            });
          }
          if (meaning.synonyms && Array.isArray(meaning.synonyms)) {
            meaning.synonyms.forEach(syn => synonyms.add(syn));
          }
        });
      }
      
      const result = {
        word: entry.word || word,
        phonetic: entry.phonetic || '',
        partOfSpeech: entry.meanings?.[0]?.partOfSpeech || '',
        definition: allDefs[0]?.text || '',
        allDefinitions: allDefs,
        examples: examples,
        synonyms: Array.from(synonyms),
        sources: { free_dictionary: true }
      };
      
      console.log('[Learnword] Free Dictionary succeeded');
      await cacheSet(key, result);
      return { source: 'free_dictionary', data: result };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e) {
    console.warn(`[Learnword] Free Dictionary error: ${e.message}`);
    return null;
  }
}

// Main lookup function
async function lookup(word, options = {}) {
  const lang = options.lang || 'en';
  
  if (!word || typeof word !== 'string') {
    console.error('[Learnword] Invalid word:', word);
    return {
      word: word || '',
      definition: 'No definition available',
      phonetic: '',
      partOfSpeech: '',
      allDefinitions: [],
      examples: [],
      synonyms: [],
      sources: {}
    };
  }

  const cacheKey = `merged::${lang}::${word}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    console.log(`[Learnword] Returning cached result for "${word}"`);
    return cached;
  }

  console.log(`[Learnword] Looking up "${word}"...`);

  try {
    // ✅ TRY FREE DICTIONARY API FIRST (Best quality, no key needed)
    console.log('[Learnword] Trying Free Dictionary API...');
    const freeDictResult = await Promise.race([
      fetchFreeDictionary(word),
      new Promise(resolve => setTimeout(() => resolve(null), 4000)) // 4s timeout
    ]);
    
    if (freeDictResult && freeDictResult.data) {
      console.log('[Learnword] Using Free Dictionary result');
      await cacheSet(cacheKey, freeDictResult.data);
      return freeDictResult.data;
    }

    // Try Google Translate as fallback for English
    console.log('[Learnword] Trying Google Translate API...');
    const gtResult = await Promise.race([
      fetchGoogleTranslateDict(word, lang),
      new Promise(resolve => setTimeout(() => resolve(null), 3000)) // 3s timeout
    ]);
    
    if (gtResult && gtResult.data) {
      const result = {
        word: word,
        definition: gtResult.data.sentence ? gtResult.data.sentence[0]?.trans : word,
        phonetic: '',
        partOfSpeech: '',
        allDefinitions: [{ text: gtResult.data.sentence?.[0]?.trans || word, partOfSpeech: '' }],
        examples: [],
        synonyms: [],
        sources: { google_translate: true }
      };
      await cacheSet(cacheKey, result);
      return result;
    }

    // Try DuckDuckGo as fallback
    console.log('[Learnword] Trying DuckDuckGo API...');
    const ddgResult = await Promise.race([
      fetchDuckDuckGo(word, lang),
      new Promise(resolve => setTimeout(() => resolve(null), 3000)) // 3s timeout
    ]);
    
    if (ddgResult && ddgResult.data && ddgResult.data.AbstractText) {
      const result = {
        word: word,
        definition: ddgResult.data.AbstractText,
        phonetic: '',
        partOfSpeech: '',
        allDefinitions: [{ text: ddgResult.data.AbstractText, partOfSpeech: '' }],
        examples: [],
        synonyms: [],
        sources: { ddg: true }
      };
      await cacheSet(cacheKey, result);
      return result;
    }
  } catch (e) {
    console.warn(`[Learnword] API lookup error: ${e.message}`);
  }

  // ✅ FALLBACK: Use local dictionary if online APIs fail
  console.log(`[Learnword] APIs failed, checking local dictionary for "${word}"`);
  const localResult = formatLocalDefinition(word);
  if (localResult) {
    console.log(`[Learnword] Found in local dictionary: "${word}"`);
    await cacheSet(cacheKey, localResult);
    return localResult;
  }

  // ✅ FINAL FALLBACK: Return generic definition
  console.log(`[Learnword] No definition found for "${word}"`);
  const fallback = {
    word: word,
    definition: `Definition for "${word}" not found. Try searching online or check the spelling.`,
    phonetic: '',
    partOfSpeech: '',
    allDefinitions: [],
    examples: [],
    synonyms: [],
    sources: { fallback: true }
  };
  await cacheSet(cacheKey, fallback);
  return fallback;
}