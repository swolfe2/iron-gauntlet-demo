// Quick script to check if PNGs have true alpha transparency
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2] || 'public/assets/sprites/player/body.png';

// Read PNG file header to check for alpha channel
const buffer = fs.readFileSync(filePath);

// PNG signature: 137 80 78 71 13 10 26 10
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
const isPng = pngSignature.every((byte, i) => buffer[i] === byte);

if (!isPng) {
    console.log('Not a valid PNG file');
    process.exit(1);
}

// Find IHDR chunk (should be first chunk after signature)
// IHDR starts at byte 8 (after signature)
// Format: length (4 bytes) + "IHDR" (4 bytes) + data
const ihdrLength = buffer.readUInt32BE(8);
const ihdrType = buffer.slice(12, 16).toString();

if (ihdrType !== 'IHDR') {
    console.log('Could not find IHDR chunk');
    process.exit(1);
}

// IHDR data starts at byte 16
const width = buffer.readUInt32BE(16);
const height = buffer.readUInt32BE(20);
const bitDepth = buffer[24];
const colorType = buffer[25];

// Color types:
// 0 = Grayscale
// 2 = RGB (Truecolor)
// 3 = Indexed-color (palette)
// 4 = Grayscale with alpha
// 6 = RGBA (Truecolor with alpha) <-- This is what we want

const colorTypeNames = {
    0: 'Grayscale (no alpha)',
    2: 'RGB (no alpha)',
    3: 'Indexed/Palette',
    4: 'Grayscale with ALPHA',
    6: 'RGBA (has ALPHA channel)'
};

console.log('File:', filePath);
console.log('Dimensions:', width, 'x', height);
console.log('Bit Depth:', bitDepth);
console.log('Color Type:', colorType, '-', colorTypeNames[colorType] || 'Unknown');
console.log('Has True Alpha:', colorType === 4 || colorType === 6 ? 'YES ✓' : 'NO ✗');
