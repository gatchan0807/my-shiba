#!/usr/bin/env node

/**
 * Test PNG generation locally without Slack upload
 */

import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import { writeFileSync } from 'fs';

// Helper function to add even padding to SVG
function addEvenPadding(svgText) {
    const svgMatch = svgText.match(/<svg[^>]*>/);
    if (!svgMatch) {
        console.warn('[addEvenPadding] Could not find SVG tag, returning original');
        return svgText;
    }

    const svgTag = svgMatch[0];
    const widthMatch = svgTag.match(/width="(\d+)"/);
    const heightMatch = svgTag.match(/height="(\d+)"/);

    if (!widthMatch || !heightMatch) {
        console.warn('[addEvenPadding] Could not extract width/height, returning original');
        return svgText;
    }

    const originalWidth = parseInt(widthMatch[1]);
    const originalHeight = parseInt(heightMatch[1]);

    const padding = 30;
    const newWidth = originalWidth + padding * 2;
    const newHeight = originalHeight + padding * 2;

    const newSvgTag = svgTag
        .replace(/width="\d+"/, `width="${newWidth}"`)
        .replace(/height="\d+"/, `height="${newHeight}"`)
        .replace(/<svg/, `<svg viewBox="-${padding} -${padding} ${newWidth} ${newHeight}"`);

    const result = svgText.replace(svgMatch[0], newSvgTag);
    console.log(`[addEvenPadding] Added ${padding}px padding: ${originalWidth}x${originalHeight} -> ${newWidth}x${newHeight}`);
    
    return result;
}

async function testPNGGeneration() {
    console.log('🧪 Testing PNG generation locally...\n');

    try {
        // Fetch GitHub contribution graph SVG
        console.log('📥 Fetching SVG from GitHub...');
        const svgUrl = 'https://ghchart.rshah.org/gatchan0807';
        const svgResponse = await fetch(svgUrl);
        let svgText = await svgResponse.text();
        console.log(`✅ SVG fetched, size: ${svgText.length} chars\n`);

        // Add even padding
        svgText = addEvenPadding(svgText);
        console.log('');

        // Initialize WASM
        console.log('🔧 Initializing WASM...');
        await initWasm(resvgWasm);
        console.log('✅ WASM initialized\n');

        // Convert SVG to PNG
        console.log('🖼️  Converting SVG to PNG...');
        const resvg = new Resvg(svgText, {
            fitTo: {
                mode: 'width',
                value: 1500,
            },
            background: '#ffffff',
        });

        const pngData = resvg.render();
        const pngBuffer = pngData.asPng();
        
        console.log(`✅ PNG converted!`);
        console.log(`   File size: ${pngBuffer.length} bytes (${(pngBuffer.length / 1024).toFixed(2)} KB)`);
        console.log(`   Output width: ${pngData.width}px`);
        console.log(`   Output height: ${pngData.height}px`);
        console.log(`   Aspect ratio: ${(pngData.width / pngData.height).toFixed(2)}\n`);

        // Save to file
        const filename = 'test-output.png';
        writeFileSync(filename, pngBuffer);
        console.log(`💾 Saved to ${filename}`);
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    }
}

testPNGGeneration();
