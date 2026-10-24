# Learnword — Inline Dictionary (v0.1.0)
# 📘 Instant Popup Dictionary  
*A lightweight browser extension for instant word meanings — right where you read.*


---

## 🧭 Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Why Use It](#why-use-it)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration & Customization](#%EF%B8%8Fconfiguration--customization)
- [Development and Contributing](#development-and-contributing)
- [Future Enhancements](#future-enhancements)
- [License](#license)

---

## 🌊Overview
**Instant Popup Dictionary** is a browser extension that lets you select any word on a webpage and instantly view its meaning in a neat popup — without leaving your current tab.  
Perfect for readers, students, and professionals who want fast vocabulary lookups and minimal disruption while reading.

---

## ✨Features
- ⚡ **Instant Lookup** — Select or double-click a word to get its meaning.
- 🧠 **Stay in Context** — No need to switch tabs or copy text.
- 🎨 **Lightweight & Clean UI** — Simple, non-intrusive popup design.
- 🧩 **Easy to Modify** — Fully open-source and customizable.
- 🌍 **API-Ready*<img width="470" height="264" alt="learnword2" src="https://github.com/user-attachments/assets/b0b4a96c-abdd-4139-bb52-31cbd3eaf115" />
<img width="1120" height="848" alt="learnword3" src="https://github.com/user-attachments/assets/c8885eed-3066-4d45-9394-66fccd1f556e" />
* — Designed to integrate with dictionary APIs.

---

## 💡Why Use It
If you frequently read articles, blogs, or technical papers online, you’ve likely come across unfamiliar terms.  
**Instant Popup Dictionary** eliminates the need to open a new tab or app to check meanings — allowing you to stay focused and learn naturally as you read.

### Ideal For:
- 🧑‍🎓 Students expanding vocabulary  
- 📚 Avid readers and writers  
- 👩‍💻 Professionals reading research or documentation  
- 🌍 Language learners improving English fluency  

---

## <!-- ⚙️ -->Installation

### 🧩For End Users (Chrome / Chromium / Edge)
1. Clone or download the repository:
   ```bash
   git clone https://github.com/rizwankmo/Instant-Popup-Dictionary.git
   ```
2. Open your browser and go to **chrome://extensions/**
3. Enable **Developer mode** (top-right corner).
4. Click **“Load unpacked”** and select the folder containing `manifest.json`.
5. The extension will now appear in your toolbar.

✅ **Test it:**  
Open any webpage → select a word → a popup should appear with its meaning.

---

## 🧰Usage
1. Navigate to any website with selectable text.
2. **Select or double-click** a word.
3. A popup appears showing:
   - The selected word  
   - Its definition (via dictionary API)
4. Click outside the popup or press **ESC** to close it.

---

## ⚙️Configuration & Customization
- **Popup Styling:**  
  Modify `popup.css` for colors, fonts, and layout.
- **Trigger Behavior:**  
  In `content.js`, adjust the logic for triggering lookups (e.g., click, double-click, hotkey).
- **Dictionary Source:**  
  In `background.js`, replace the API endpoint with your preferred dictionary service.
- **Icons:**  
  Replace icons inside the `/icons` folder for custom branding.
- **Language Support:**  
  Extend functionality for multilingual dictionaries.

---

## Development and Contributing

Want to improve this project? Contributions are welcome!

1. **Fork** the repository  
2. **Clone** your fork:
   ```bash
   git clone https://github.com/your-username/Instant-Popup-Dictionary.git
   ```
3. **Create** a new branch:
   ```bash
   git checkout -b feature-yourfeature
   ```
4. **Make changes** and test by loading as an unpacked extension
5. **Commit** with a clear message and open a **Pull Request**

### Suggested Ideas
- Add phrase lookup support  
- Enable offline dictionary mode  
- Add user settings for font, size, or dark theme  
- Cache definitions for faster access  
- Integrate with translation APIs  

---

## 🚀Future Enhancements
- 🌐 Multi-language support  
- 🌙 Dark/Light mode themes  
- 🧭 Word lookup history  
- 🗂 Export feature for learned words  
- 🔌 Browser store publishing (Chrome, Firefox)

---

## 📄License
This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2025 Rizwan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```

---

### 💙Support
If you like this project, please **⭐ star the repo** and share it!  
Feedback and ideas are always welcome.

---


