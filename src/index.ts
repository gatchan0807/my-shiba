import { Hono } from 'hono';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';

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

type SlackCompleteUploadResponse = {
    ok: boolean;
    error?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Initialize WASM once
let wasmInitialized = false;

async function ensureWasmInitialized() {
    if (!wasmInitialized) {
        await initWasm(resvgWasm);
        wasmInitialized = true;
    }
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

            // Post GitHub grass as PNG file to Slack
            await postToSlack(
                c.env.SLACK_BOT_TOKEN,
                channel,
                githubUsername,
                threadTs
            );
        }

        return c.json({ ok: true });
    } catch (error) {
        console.error('Error processing Slack event:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

// Helper function to add even padding to SVG
function addEvenPadding(svgText: string): string {
    // Extract the SVG tag to get width and height
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

    // Add padding (30px on all sides for balanced look)
    const padding = 30;
    const newWidth = originalWidth + padding * 2;
    const newHeight = originalHeight + padding * 2;

    // Create new SVG tag with updated dimensions and viewBox
    const newSvgTag = svgTag
        .replace(/width="\d+"/, `width="${newWidth}"`)
        .replace(/height="\d+"/, `height="${newHeight}"`)
        .replace(/<svg/, `<svg viewBox="-${padding} -${padding} ${newWidth} ${newHeight}"`);

    const result = svgText.replace(svgMatch[0], newSvgTag);
    console.log(`[addEvenPadding] Added ${padding}px padding: ${originalWidth}x${originalHeight} -> ${newWidth}x${newHeight}`);

    return result;
}

// Helper function to convert SVG to PNG and upload to Slack
async function postToSlack(
    token: string,
    channel: string,
    githubUsername: string,
    threadTs: string
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

    // Add even padding to SVG by adjusting viewBox
    svgText = addEvenPadding(svgText);

    // Convert SVG to PNG using resvg-wasm
    // Target size: 1500x260 (from original 663x104)
    console.log('[postToSlack] Converting SVG to PNG...');
    const resvg = new Resvg(svgText, {
        fitTo: {
            mode: 'width',
            value: 1500, // Increased from 1200 to 1500
        },
        background: '#ffffff', // White background for better Slack display
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    console.log(`[postToSlack] PNG converted, size: ${pngBuffer.length} bytes`);

    // Generate filename with timestamp
    const now = new Date();
    const filename = `github-grass-${githubUsername}-${now.toISOString().split('T')[0]}.png`;

    // Upload PNG to Slack using files.uploadV2
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
    console.log('[postToSlack] Upload URL response:', JSON.stringify(uploadUrlResult));

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

    // Step 3: Complete the upload and share to channel
    console.log(`[postToSlack] Completing upload for channel: ${channel}`);
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

    const completeResult = await completeResponse.json() as SlackCompleteUploadResponse;
    console.log('[postToSlack] Complete upload response:', JSON.stringify(completeResult));

    if (!completeResult.ok) {
        console.error('[postToSlack] Failed to complete upload:', completeResult);
        throw new Error(`Failed to complete upload: ${completeResult.error}`);
    }

    console.log('[postToSlack] PNG file uploaded and shared successfully!');
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
            // Initialize WASM if not already done
            if (!wasmInitialized) {
                await ensureWasmInitialized();
            }

            const githubUsername = env.GH_USERNAME;
            const channel = env.SLACK_CHANNEL_ID;

            console.log(`[scheduled] Posting daily grass report for ${githubUsername} to channel ${channel}`);

            // Post GitHub grass (without thread_ts for cron job)
            await postToSlack(
                env.SLACK_BOT_TOKEN,
                channel,
                githubUsername,
                '' // No thread for scheduled posts
            );

            console.log('[scheduled] Daily grass report posted successfully!');
        } catch (error) {
            console.error('[scheduled] Error posting daily grass report:', error);
        }
    },
};
