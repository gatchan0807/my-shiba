import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addEvenPadding } from './index';

// Mock @resvg/resvg-wasm to avoid WASM initialization in tests
vi.mock('@resvg/resvg-wasm', () => ({
    initWasm: vi.fn(),
    Resvg: vi.fn(),
}));
vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({ default: {} }));

describe('addEvenPadding', () => {
    it('adds asymmetric padding to SVG dimensions', () => {
        const input = '<svg width="663" height="104"><rect/></svg>';
        const result = addEvenPadding(input);

        // L10 + R15 = 25, T15 + B15 = 30
        expect(result).toContain('width="688"');
        expect(result).toContain('height="134"');
    });

    it('sets viewBox with negative offsets for padding', () => {
        const input = '<svg width="663" height="104"><rect/></svg>';
        const result = addEvenPadding(input);

        expect(result).toContain('viewBox="-10 -15 688 134"');
    });

    it('handles width/height with px unit', () => {
        const input = '<svg width="663px" height="104px"><rect/></svg>';
        const result = addEvenPadding(input);

        expect(result).toContain('width="688"');
        expect(result).toContain('height="134"');
    });

    it('replaces existing viewBox', () => {
        const input = '<svg width="663" height="104" viewBox="0 0 663 104"><rect/></svg>';
        const result = addEvenPadding(input);

        expect(result).toContain('viewBox="-10 -15 688 134"');
        // Should not have duplicate viewBox
        expect(result.match(/viewBox/g)?.length).toBe(1);
    });

    it('returns original SVG if no svg tag found', () => {
        const input = '<div>not an svg</div>';
        const result = addEvenPadding(input);

        expect(result).toBe(input);
    });

    it('returns original SVG if width/height not found', () => {
        const input = '<svg><rect/></svg>';
        const result = addEvenPadding(input);

        expect(result).toBe(input);
    });
});

describe('Hono app routes', () => {
    // Dynamically import to get the app after mocks are set up
    let app: any;

    beforeEach(async () => {
        const mod = await import('./index');
        app = mod.default;
    });

    describe('GET /', () => {
        it('returns health check response', async () => {
            const res = await app.fetch(new Request('http://localhost/'));
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.status).toBe('running');
            expect(json.message).toContain('my-shiba');
        });
    });

    describe('POST /slack/events', () => {
        it('skips retry requests immediately', async () => {
            const req = new Request('http://localhost/slack/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Slack-Retry-Num': '1',
                    'X-Slack-Retry-Reason': 'http_timeout',
                },
                body: JSON.stringify({ event: { type: 'app_mention' } }),
            });

            const res = await app.fetch(req);
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.ok).toBe(true);
        });

        it('responds to url_verification challenge', async () => {
            const req = new Request('http://localhost/slack/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'url_verification',
                    challenge: 'test-challenge-token',
                }),
            });

            const res = await app.fetch(req);
            const json = await res.json();

            expect(res.status).toBe(200);
            expect(json.challenge).toBe('test-challenge-token');
        });
    });
});
