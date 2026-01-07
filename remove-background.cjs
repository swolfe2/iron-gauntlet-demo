/**
 * Background Removal Pipeline for AI-Generated Sprites
 * 
 * This script removes solid-color backgrounds from AI-generated images
 * and outputs true PNG files with alpha transparency.
 * 
 * Usage: node remove-background.cjs <input-image> [output-image]
 * 
 * The script:
 * 1. Reads the input image (JPEG or PNG)
 * 2. Detects the background color from corners
 * 3. Replaces similar colors with transparency
 * 4. Outputs a proper PNG with alpha channel
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Configuration
const TOLERANCE = 30; // Color difference tolerance (0-255)
const CORNER_SAMPLE_SIZE = 5; // Pixels to sample from each corner

async function removeBackground(inputPath, outputPath) {
    console.log(`\n[BG Removal] Processing: ${path.basename(inputPath)}`);
    
    // Read the image
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    console.log(`  Dimensions: ${metadata.width}x${metadata.height}`);
    
    // Get raw pixel data
    const { data, info } = await image
        .raw()
        .toBuffer({ resolveWithObject: true });
    
    const { width, height, channels } = info;
    console.log(`  Channels: ${channels}`);
    
    // Sample corners to detect background color
    const bgColor = detectBackgroundColor(data, width, height, channels);
    console.log(`  Detected BG Color: RGB(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`);
    
    // Create new buffer with alpha channel
    const outputChannels = 4; // RGBA
    const outputData = Buffer.alloc(width * height * outputChannels);
    
    let transparentPixels = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const srcIdx = (y * width + x) * channels;
            const dstIdx = (y * width + x) * outputChannels;
            
            const r = data[srcIdx];
            const g = data[srcIdx + 1];
            const b = data[srcIdx + 2];
            
            // Check if this pixel matches the background color
            const isBackground = isColorSimilar(r, g, b, bgColor, TOLERANCE);
            
            // Also check for checkered pattern (alternating gray tones)
            const isCheckered = isCheckeredBackground(r, g, b);
            
            if (isBackground || isCheckered) {
                // Make transparent
                outputData[dstIdx] = 0;
                outputData[dstIdx + 1] = 0;
                outputData[dstIdx + 2] = 0;
                outputData[dstIdx + 3] = 0; // Alpha = 0 (transparent)
                transparentPixels++;
            } else {
                // Keep original color
                outputData[dstIdx] = r;
                outputData[dstIdx + 1] = g;
                outputData[dstIdx + 2] = b;
                outputData[dstIdx + 3] = 255; // Alpha = 255 (opaque)
            }
        }
    }
    
    const percentTransparent = ((transparentPixels / (width * height)) * 100).toFixed(1);
    console.log(`  Transparent pixels: ${transparentPixels} (${percentTransparent}%)`);
    
    // Write output PNG
    await sharp(outputData, {
        raw: {
            width,
            height,
            channels: outputChannels
        }
    })
    .trim() // <--- ADDED: Crop transparent pixels
    .png()
    .toFile(outputPath);
    
    console.log(`  Output: ${path.basename(outputPath)}`);
    console.log(`  ✓ Done!`);
    
    return outputPath;
}

function detectBackgroundColor(data, width, height, channels) {
    const samples = [];
    
    // Sample from four corners
    const corners = [
        { x: 0, y: 0 },                          // Top-left
        { x: width - 1, y: 0 },                  // Top-right
        { x: 0, y: height - 1 },                 // Bottom-left
        { x: width - 1, y: height - 1 }          // Bottom-right
    ];
    
    for (const corner of corners) {
        for (let dx = 0; dx < CORNER_SAMPLE_SIZE; dx++) {
            for (let dy = 0; dy < CORNER_SAMPLE_SIZE; dy++) {
                const x = Math.min(Math.max(corner.x + (corner.x === 0 ? dx : -dx), 0), width - 1);
                const y = Math.min(Math.max(corner.y + (corner.y === 0 ? dy : -dy), 0), height - 1);
                const idx = (y * width + x) * channels;
                
                samples.push({
                    r: data[idx],
                    g: data[idx + 1],
                    b: data[idx + 2]
                });
            }
        }
    }
    
    // Average the samples
    const avg = samples.reduce((acc, s) => ({
        r: acc.r + s.r,
        g: acc.g + s.g,
        b: acc.b + s.b
    }), { r: 0, g: 0, b: 0 });
    
    return {
        r: Math.round(avg.r / samples.length),
        g: Math.round(avg.g / samples.length),
        b: Math.round(avg.b / samples.length)
    };
}

function isColorSimilar(r, g, b, bgColor, tolerance) {
    const dr = Math.abs(r - bgColor.r);
    const dg = Math.abs(g - bgColor.g);
    const db = Math.abs(b - bgColor.b);
    
    return dr <= tolerance && dg <= tolerance && db <= tolerance;
}

function isCheckeredBackground(r, g, b) {
    // Check for MAGENTA chroma key (#FF00FF) - PRIMARY TARGET
    // High red, low green, high blue
    if (r > 200 && g < 50 && b > 200) {
        return true;
    }
    
    // Common checkered transparency patterns use these colors:
    // Light gray: ~204, 204, 204 or ~192, 192, 192
    // Dark gray: ~153, 153, 153 or ~128, 128, 128
    
    // Check if it's a gray color (R ≈ G ≈ B)
    const isGray = Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - b) < 10;
    
    if (!isGray) return false;
    
    // Check if it matches typical checkered pattern grays
    const avg = (r + g + b) / 3;
    
    // Common checkered grays: 128, 153, 192, 204
    const checkeredGrays = [128, 153, 192, 204, 180, 170, 140];
    
    for (const gray of checkeredGrays) {
        if (Math.abs(avg - gray) < 15) {
            return true;
        }
    }
    
    return false;
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage: node remove-background.cjs <input-image> [output-image]');
    console.log('');
    console.log('Example:');
    console.log('  node remove-background.cjs player.png player-transparent.png');
    process.exit(1);
}

const inputPath = args[0];
const outputPath = args[1] || inputPath.replace(/\.(png|jpg|jpeg)$/i, '-transparent.png');

if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
}

removeBackground(inputPath, outputPath)
    .then(() => {
        console.log('\n✓ Background removal complete!');
    })
    .catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
    });
