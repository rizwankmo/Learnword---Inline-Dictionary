# Learnword Debug Report

## Executive Summary
The extension has **6 critical bugs** preventing it from displaying word definitions properly. The main issues are in the content script's definition rendering pipeline and API integration.

---

## Critical Issues Found

### 🔴 **Issue #1: Missing `renderDefinition()` Function (CRITICAL)**
**File:** [content/content.js](content/content.js#L162)  
**Line:** 162

**Problem:**
```javascript
renderDefinition(res.result);   // ❌ This function doesn't exist!
```

The function `renderDefinition()` is called but never defined anywhere in the codebase. This prevents definitions from being displayed.

**Impact:** Definitions are never rendered to the UI. The function silently fails, leaving no visual feedback.

**Solution:** Call the correct function `showCardWithData()` instead:
```javascript
await showCardWithData(res.result);
```

---

### 🔴 **Issue #2: Duplicate Variable Declaration (CRITICAL)**
**File:** [content/content.js](content/content.js#L150-L160)  
**Lines:** 150-160

**Problem:**
```javascript
async function showDefinitionFor(word, clientX=null, clientY=null, lang='en') {
  // ... code ...
  
  // FIRST declaration (line 150 - gets overwritten!)
  const res = await runtime.sendMessage({
    type: "learnword_lookup",
    word,
    lang: STATE.targetLanguage || "en"
  });
  
  // ... positioning code ...
  
  // SECOND declaration (line 153 - overwrites the first!)
  const res = await runtime.sendMessage({
    type: "learnword_lookup",
    word,
    lang: STATE.targetLanguage || "en"
  });

  // Rest of code tries to use `res`...
  if (!res || !res.ok || !res.result) {
    throw new Error(res?.error || "Word not found");
  }
}
```

**Impact:** JavaScript error: "Identifier 'res' has already been declared". The function crashes in strict mode.

**Solution:** Remove the first declaration, keep only one `const res =` assignment.

---

### 🔴 **Issue #3: Missing History Storage Integration**
**File:** [content/content.js](content/content.js#L162-L200)  
**Lines:** 162-200

**Problem:**
When a word is looked up successfully, it's never saved to the browser's storage history. The `showCardWithData()` function doesn't add the word to history.

**Impact:** History is loaded and displayed, but never populated. The history tab always appears empty.

**Solution:** After successfully displaying a definition, save it to storage:
```javascript
// Add this after showing the definition
const historyEntry = {
  word: res.result.word,
  definition: res.result.definition,
  source: Object.keys(res.result.sources || {})[0] || 'unknown',
  timestamp: Date.now(),
  note: ''
};

const { history = [] } = await ext.storage.local.get('history');
const exists = history.some(h => h.word.toLowerCase() === word.toLowerCase());
if (!exists) {
  history.unshift(historyEntry);
  await ext.storage.local.set({ history });
}
```

---

### 🟡 **Issue #4: Incomplete API Data Transformation**
**File:** [service/definitions.js](service/definitions.js#L190-L210)  
**Lines:** 190-210

**Problem:**
The Google Translate API response is not being properly parsed:
```javascript
definition: gtResult.data.sentence ? gtResult.data.sentence[0]?.trans : word,
```

Google Translate API returns a complex nested structure that isn't well-suited for definitions. The current approach just extracts a sentence translation.

**Impact:** Definitions are generic translations, not actual dictionary definitions.

**Solution:** Prioritize the Free Dictionary API (already in manifest) before falling back to Google Translate:

```javascript
// Try Free Dictionary API first (best quality)
async function fetchFreeDict(word) {
  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeWord(word)}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return null;
    
    const entry = data[0];
    return {
      word: entry.word,
      phonetic: entry.phonetic || '',
      definition: entry.meanings?.[0]?.definitions?.[0]?.definition || '',
      partOfSpeech: entry.meanings?.[0]?.partOfSpeech || '',
      allDefinitions: entry.meanings?.[0]?.definitions || [],
      examples: entry.meanings?.[0]?.definitions?.map(d => d.example) || [],
      synonyms: entry.meanings?.[0]?.synonyms || [],
      source: 'free-dictionary'
    };
  } catch (e) {
    console.warn('Free Dictionary error:', e);
    return null;
  }
}
```

---

### 🟡 **Issue #5: Undefined UI State on Definition Display**
**File:** [content/content.js](content/content.js#L168-L182)  
**Lines:** 168-182

**Problem:**
In the error handling path, the code accesses `STATE.ui` without checking if `createShadowUI()` was successful:
```javascript
if (!STATE.ui) {
  await createShadowUI();  // May fail silently
}

STATE.ui.wordEl.textContent = "";  // ❌ STATE.ui might still be null!
STATE.ui.pronEl.textContent = "";
```

**Impact:** If Shadow DOM creation fails, the next line crashes with "Cannot read property of null".

**Solution:** Check that `STATE.ui` exists after creation:
```javascript
if (!STATE.ui) {
  const created = await createShadowUI();
  if (!created || !STATE.ui) {
    console.error('Failed to create Shadow UI');
    return;
  }
}
```

---

### 🟡 **Issue #6: Response Flow Inconsistency**  
**File:** [service/background.js](service/background.js#L19)  
**Lines:** 19

**Problem:**
background.js returns both `data` and `result`:
```javascript
sendResponse({ ok: true, data: result, result });
```

This is confusing and inconsistent with other parts of the code.

**Impact:** Mixed usage of `res.data` and `res.result` throughout the codebase. Maintainability issue.

**Solution:** Use consistent naming - either always use `data` or always use `result`. Recommended: use `data` everywhere:
```javascript
sendResponse({ ok: true, data: result });
```

---

## Data Flow Diagram
```
User selects text → Alt+W hotkey triggered
         ↓
content.js: showDefinitionFor(word)
         ↓
Send message to background: { type: "learnword_lookup", word }
         ↓
background.js: receives message
         ↓
definitions.js: lookup(word) - queries APIs in order:
  1. Free Dictionary API (BEST - not implemented yet)
  2. Google Translate (current fallback)
  3. DuckDuckGo (secondary fallback)
  4. Local dictionary (final fallback)
         ↓
Returns: { ok: true, data: definition_object }
         ↓
content.js: receives response
         ↓
❌ BROKEN: calls renderDefinition() which doesn't exist
         ✅ SHOULD: call showCardWithData(res.result)
         ↓
showCardWithData() populates STATE.ui elements
         ↓
showCard() displays the popup card
         ↓
❌ BROKEN: history never updated
         ✅ SHOULD: save to ext.storage.local.set({ history })
```

---

## Recommendation Priority

| Priority | Issue | Fix Time |
|----------|-------|----------|
| 🔴 P0 | Missing `renderDefinition()` function | 5 min |
| 🔴 P0 | Duplicate `const res` declaration | 5 min |
| 🔴 P0 | History not saved | 10 min |
| 🟡 P1 | API data transformation incomplete | 20 min |
| 🟡 P1 | Missing Shadow UI error handling | 5 min |
| 🟠 P2 | Response naming inconsistency | 10 min |

**Total Fix Time:** ~55 minutes

---

## Testing Checklist
After fixes:
- [ ] Select text and press Alt+W → Definition appears in popup
- [ ] Definition shows correct word, pronunciation, part of speech
- [ ] Multiple definitions displayed (if available)
- [ ] Examples section shows (if available)
- [ ] History tab shows the looked-up word
- [ ] Clicking history item shows full definition
- [ ] API status shows which service provided the definition
- [ ] Fallback works when online APIs unavailable
