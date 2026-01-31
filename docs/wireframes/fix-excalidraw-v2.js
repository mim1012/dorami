const fs = require('fs');
const path = require('path');

// Fix a single Excalidraw file with proper baseline calculation
function fixExcalidrawFile(filePath) {
  console.log(`\nFixing: ${path.basename(filePath)}`);

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let fixedCount = 0;

  // Fix each element
  data.elements = data.elements.map((element, index) => {
    const timestamp = Date.now();

    // Add required fields for all elements
    const fixed = {
      ...element,
      version: element.version || 1,
      versionNonce: element.versionNonce || Math.floor(Math.random() * 2000000000),
      isDeleted: false,
      seed: element.seed || Math.floor(Math.random() * 2000000000),
      frameId: null,
      boundElements: element.boundElements || [],
      updated: timestamp,
      link: null,
      locked: element.locked || false
    };

    // Additional fields for text elements with proper baseline
    if (element.type === 'text') {
      const fontSize = element.fontSize || 16;

      fixed.originalText = element.text || "";
      fixed.lineHeight = element.lineHeight || 1.25;
      fixed.containerId = null;

      // Proper baseline calculation: approximately fontSize * 0.85
      fixed.baseline = Math.round(fontSize * 0.85);

      // Ensure textAlign and verticalAlign are set
      fixed.textAlign = element.textAlign || "left";
      fixed.verticalAlign = element.verticalAlign || "top";
    }

    // Ensure strokeStyle is set for all elements
    if (!fixed.strokeStyle) {
      fixed.strokeStyle = "solid";
    }

    fixedCount++;
    return fixed;
  });

  // Write fixed file
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✓ Fixed ${fixedCount} elements in ${path.basename(filePath)}`);

  return fixedCount;
}

// Get file names from command line args
const files = process.argv.slice(2);

if (files.length === 0) {
  console.error('Usage: node fix-excalidraw-v2.js <file1> <file2> ...');
  process.exit(1);
}

let totalFixed = 0;
files.forEach(file => {
  try {
    totalFixed += fixExcalidrawFile(file);
  } catch (err) {
    console.error(`Error fixing ${file}:`, err.message);
  }
});

console.log(`\n✓ Total elements fixed: ${totalFixed}`);
