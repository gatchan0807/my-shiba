import { Hono } from 'hono';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';

// Environment variables type definition
type Bindings = {
    SLACK_BOT_TOKEN: string;
    SLACK_SIGNING_SECRET: string;
    GITHUB_USERNAME: string;
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
            const githubUsername = c.env.GITHUB_USERNAME;
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

    const svgText = await svgResponse.text();
    console.log(`[postToSlack] SVG fetched, size: ${svgText.length} chars`);

    // Convert SVG to PNG using resvg-wasm
    console.log('[postToSlack] Converting SVG to PNG...');
    const resvg = new Resvg(svgText, {
        fitTo: {
            mode: 'width',
            value: 1200,
        },
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

export default app;
