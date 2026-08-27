const fs = require("fs");
const path = require("path");

const browsers = ['chrome', 'firefox', 'edge', 'opera'];
const root = process.cwd();

// Load base configurations
const pkgPath = path.join(root, "package.json");
const basePath = path.join(root, "manifests", "base.json");

if (!fs.existsSync(pkgPath) || !fs.existsSync(basePath)) {
    console.error("❌ Error: package.json or manifests/base.json is missing.");
    process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
const baseManifest = JSON.parse(fs.readFileSync(basePath, 'utf8'));

// Directories to copy into the build
const foldersToCopy = ["content", "popup", "service", "settings", "icons"];

console.log(`🚀 Starting simultaneous build for Learnword v${version}...`);

// Loop through each browser and build
browsers.forEach(browser => {
    const outDir = path.join(root, "build", browser);

    // 1. Clean the old build directory and create a fresh one
    if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outDir, { recursive: true });

    // 2. Read the browser-specific override (if it exists)
    const overridePath = path.join(root, "manifests", `${browser}.json`);
    const override = fs.existsSync(overridePath)
        ? JSON.parse(fs.readFileSync(overridePath, 'utf8'))
        : {};

    // 3. Merge Base + Override + Version
    const finalManifest = {
        ...baseManifest,
        ...override,
        version: version
    };

    // 4. Write the final manifest.json
    fs.writeFileSync(
        path.join(outDir, "manifest.json"),
        JSON.stringify(finalManifest, null, 2)
    );

    // 5. Copy the extension files/folders
    foldersToCopy.forEach(dir => {
        const sourcePath = path.join(root, dir);
        if (fs.existsSync(sourcePath)) {
            fs.cpSync(sourcePath, path.join(outDir, dir), { recursive: true });
        }
    });

    console.log(`✅ Compiled: ${browser}`);
});

console.log(`\n🎉 Success! All versions are ready in the /build directory.`);