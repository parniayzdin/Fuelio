import { useEffect, useRef } from 'react';

interface AdBannerProps {
    slot: string;
    format?: 'banner' | 'rectangle' | 'leaderboard' | 'responsive' | 'skyscraper' | 'vertical';
    className?: string;
}

declare global {
    interface Window {
        adsbygoogle: any[];
    }
}

const AD_SIZES = {
    banner: { width: 728, height: 90 },
    rectangle: { width: 300, height: 250 },
    leaderboard: { width: 728, height: 90 },
    responsive: { width: '100%', height: 'auto' },
    skyscraper: { width: 160, height: 600 },
    vertical: { width: 120, height: 240 },
};

/**
 * Google AdSense Banner Component
 * 
 * Usage:
 * <AdBanner slot="1234567890" format="rectangle" />
 * 
 * Note: Requires VITE_ADSENSE_PUBLISHER_ID env var and AdSense script in index.html
 */
export function AdBanner({ slot, format = 'responsive', className = '' }: AdBannerProps) {
    const adRef = useRef<HTMLDivElement>(null);
    const isLoaded = useRef(false);

    useEffect(() => {
        // Only load ad once
        if (isLoaded.current) return;

        const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID;

        // Don't try to load ads if no publisher ID
        if (!publisherId) {
            console.log('AdSense: No publisher ID configured');
            return;
        }

        try {
            // Push ad to AdSense
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            isLoaded.current = true;
        } catch (error) {
            console.error('AdSense error:', error);
        }
    }, []);

    const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID;
    const size = AD_SIZES[format];

    // Show placeholder in development or when no publisher ID
    if (!publisherId) {
        return (
            <div
                className={`bg-muted/50 border border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center text-muted-foreground text-sm ${className}`}
                style={{
                    width: typeof size.width === 'number' ? size.width : '100%',
                    height: typeof size.height === 'number' ? size.height : 100,
                    minHeight: 90
                }}
            >
                <span className="opacity-50">Ad Space ({format})</span>
            </div>
        );
    }

    return (
        <div ref={adRef} className={className}>
            <ins
                className="adsbygoogle"
                style={{
                    display: 'block',
                    width: typeof size.width === 'number' ? size.width : '100%',
                    height: typeof size.height === 'number' ? size.height : 'auto',
                }}
                data-ad-client={publisherId}
                data-ad-slot={slot}
                data-ad-format={format === 'responsive' ? 'auto' : undefined}
                data-full-width-responsive={format === 'responsive' ? 'true' : undefined}
            />
        </div>
    );
}
