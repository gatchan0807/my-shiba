import { Hono } from 'hono';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import interFont from './fonts/Inter-Regular.ttf';

// Environment variables type definition
type Bindings = {
    SLACK_BOT_TOKEN: string;
    SLACK_SIGNING_SECRET: string;
    GH_USERNAME: string;
    SLACK_CHANNEL_ID?: string; // Optional: for cron job
};

// Slack API response types
type SlackUploadUrlResponse = {
    ok: boolean;
    upload_url: string;
    file_id: string;
    error?: string;
};

type SlackApiResponse = {
    ok: boolean;
    error?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

let wasmInitPromise: Promise<void> | null = null;

function ensureWasmInitialized(): Promise<void> {
    if (!wasmInitPromise) {
        wasmInitPromise = initWasm(resvgWasm);
    }
    return wasmInitPromise;
}

// Root endpoint - Health check
app.get('/', (c) => {
    return c.json({
        message: 'Hello from my-shiba! 🐕',
        status: 'running',
    });
});

// Slack events endpoint
app.post('/slack/events', async (c) => {
    // Skip Slack retry requests to avoid duplicate processing
    const retryNum = c.req.header('X-Slack-Retry-Num');
    if (retryNum) {
        console.log(`[slack/events] Skipping retry request (retry #${retryNum})`);
        return c.json({ ok: true });
    }

    try {
        const body = await c.req.json();

        // Handle URL verification challenge from Slack
        if (body.type === 'url_verification') {
            return c.json({ challenge: body.challenge });
        }

        // Handle app_mention events
        if (body.event?.type === 'app_mention') {
            const githubUsername = c.env.GH_USERNAME;
            const channel = body.event.channel;
            const threadTs = body.event.ts;

            // Initialize WASM if not already done
            await ensureWasmInitialized();

            // Post GitHub grass as PNG file to Slack (no thread, post to channel directly)
            await postToSlack(
                c.env.SLACK_BOT_TOKEN,
                channel,
                githubUsername
            );
        }

        return c.json({ ok: true });
    } catch (error) {
        console.error('Error processing Slack event:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

// Enhance SVG: show all labels, increase font size, add uniform padding
export function enhanceSvg(svgText: string): string {
    const svgMatch = svgText.match(/<svg[^>]*>/);
    if (!svgMatch) {
        console.warn('[enhanceSvg] Could not find SVG tag, returning original');
        return svgText;
    }

    const svgTag = svgMatch[0];
    const widthMatch = svgTag.match(/width="([\d.]+)(?:px)?"/);
    const heightMatch = svgTag.match(/height="([\d.]+)(?:px)?"/);

    if (!widthMatch || !heightMatch) {
        console.warn('[enhanceSvg] Could not extract width/height, returning original');
        return svgText;
    }

    const originalWidth = parseInt(widthMatch[1], 10);
    const originalHeight = parseInt(heightMatch[1], 10);

    // Generous vertical padding to improve Slack inline preview
    // (Slack crops wide images; a ~3:1 aspect ratio displays fully)
    const paddingX = 15;
    const paddingTop = 50;
    const paddingBottom = 50;
    const newWidth = originalWidth + paddingX * 2;
    const newHeight = originalHeight + paddingTop + paddingBottom;

    let result = svgText;

    // Show hidden day labels (Sun, Tue, Thu, Sat have display:none)
    result = result.replace(/display:none;/g, '');

    // Update SVG tag with new dimensions and viewBox
    let newSvgTag = svgTag
        .replace(/width="[\d.]+(?:px)?"/, `width="${newWidth}"`)
        .replace(/height="[\d.]+(?:px)?"/, `height="${newHeight}"`);

    const newViewBox = `viewBox="-${paddingX} -${paddingTop} ${newWidth} ${newHeight}"`;

    if (/viewBox="[^"]*"/.test(newSvgTag)) {
        newSvgTag = newSvgTag.replace(/viewBox="[^"]*"/, newViewBox);
    } else {
        newSvgTag = newSvgTag.replace(/^<svg([^>]*)>/, `<svg$1 ${newViewBox}>`);
    }

    result = result.replace(svgMatch[0], newSvgTag);

    return result;
}

// Helper function to convert SVG to PNG and upload to Slack
async function postToSlack(
    token: string,
    channel: string,
    githubUsername: string
): Promise<void> {
    console.log(`[postToSlack] Starting conversion and upload for ${githubUsername}`);

    // Fetch GitHub contribution graph SVG
    const svgUrl = `https://ghchart.rshah.org/${githubUsername}`;
    console.log(`[postToSlack] Fetching SVG from: ${svgUrl}`);

    const svgResponse = await fetch(svgUrl);
    if (!svgResponse.ok) {
        throw new Error(`Failed to fetch SVG: ${svgResponse.statusText}`);
    }

    let svgText = await svgResponse.text();
    console.log(`[postToSlack] SVG fetched, size: ${svgText.length} chars`);

    // Enhance SVG: show labels, uniform padding
    svgText = enhanceSvg(svgText);

    console.log('[postToSlack] Converting SVG to PNG...');
    const fontData = await (await fetch(interFont)).arrayBuffer();
    const resvg = new Resvg(svgText, {
        fitTo: {
            mode: 'width',
            value: 1200,
        },
        background: '#ffffff',
        font: {
            fontBuffers: [fontData],
            defaultFontFamily: 'Inter',
        },
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    console.log(`[postToSlack] PNG converted, size: ${pngBuffer.length} bytes`);

    // Generate filename with timestamp
    const now = new Date();
    const filename = `github-grass-${githubUsername}-${now.toISOString().split('T')[0]}.png`;

    // Step 1: Get upload URL
    const uploadParams = new URLSearchParams({
        filename: filename,
        length: pngBuffer.length.toString(),
    });
    console.log('[postToSlack] Requesting upload URL...');

    const uploadUrlResponse = await fetch('https://slack.com/api/files.getUploadURLExternal', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${token}`,
        },
        body: uploadParams,
    });

    const uploadUrlResult = await uploadUrlResponse.json() as SlackUploadUrlResponse;

    if (!uploadUrlResult.ok) {
        throw new Error(`Failed to get upload URL: ${uploadUrlResult.error}`);
    }

    // Step 2: Upload PNG to the URL
    console.log('[postToSlack] Uploading PNG to Slack...');
    const uploadResponse = await fetch(uploadUrlResult.upload_url, {
        method: 'POST',
        body: pngBuffer,
    });

    if (!uploadResponse.ok) {
        throw new Error(`Failed to upload PNG: ${uploadResponse.statusText}`);
    }
    console.log('[postToSlack] PNG uploaded successfully');

    // Step 3: Complete the upload (without sharing to channel yet)
    console.log('[postToSlack] Completing upload...');
    const completeResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            files: [
                {
                    id: uploadUrlResult.file_id,
                    title: `GitHub Grass - ${githubUsername}`,
                },
            ],
            channel_id: channel,
            initial_comment: `🌱 GitHub Grass for @${githubUsername} (${now.toLocaleDateString('ja-JP')})`,
        }),
    });

    const completeResult = await completeResponse.json() as SlackApiResponse;

    if (!completeResult.ok) {
        console.error('[postToSlack] Failed to complete upload:', completeResult);
        throw new Error(`Failed to complete upload: ${completeResult.error}`);
    }

    console.log('[postToSlack] File uploaded and shared successfully!');
}

// Scheduled event handler for cron triggers
export default {
    async fetch(request: Request, env: Bindings): Promise<Response> {
        return app.fetch(request, env);
    },
    async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext): Promise<void> {
        console.log('[scheduled] Cron trigger fired at:', new Date(event.scheduledTime).toISOString());

        // Check if SLACK_CHANNEL_ID is configured
        if (!env.SLACK_CHANNEL_ID) {
            console.warn('[scheduled] SLACK_CHANNEL_ID not configured, skipping cron job');
            return;
        }

        try {
            await ensureWasmInitialized();

            const githubUsername = env.GH_USERNAME;
            const channel = env.SLACK_CHANNEL_ID;

            console.log(`[scheduled] Posting daily grass report for ${githubUsername} to channel ${channel}`);

            await postToSlack(
                env.SLACK_BOT_TOKEN,
                channel,
                githubUsername
            );

            console.log('[scheduled] Daily grass report posted successfully!');
        } catch (error) {
            console.error('[scheduled] Error posting daily grass report:', error);
        }
    },
};
