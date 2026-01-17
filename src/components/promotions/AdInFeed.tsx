import { useEffect, useRef } from 'react';

interface AdInFeedProps {
    slot: string;
    layoutKey?: string;
    className?: string;
}

declare global {
    interface Window {
        adsbygoogle: any[];
    }
}

/**
 * Google AdSense In-Feed Ad Component
 * 
 * Designed to blend with content lists (trips, forecasts, etc.)
 * 
 * Usage:
 * <AdInFeed slot="1234567890" />
 */
export function AdInFeed({ slot, layoutKey = '-fb+5w+4e-db+86', className = '' }: AdInFeedProps) {
    const adRef = useRef<HTMLDivElement>(null);
    const isLoaded = useRef(false);

    useEffect(() => {
        if (isLoaded.current) return;

        const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID;

        if (!publisherId) {
            console.log('AdSense: No publisher ID configured');
            return;
        }

        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            isLoaded.current = true;
        } catch (error) {
            console.error('AdSense error:', error);
        }
    }, []);

    const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID;

    // Show placeholder in development
    if (!publisherId) {
        return (
            <div
                className={`bg-muted/30 border border-dashed border-muted-foreground/20 rounded-lg p-4 flex items-center justify-center text-muted-foreground text-sm ${className}`}
                style={{ minHeight: 120 }}
            >
                <span className="opacity-50">📢 Sponsored Content</span>
            </div>
        );
    }

    return (
        <div ref={adRef} className={className}>
            <ins
                className="adsbygoogle"
                style={{ display: 'block' }}
                data-ad-client={publisherId}
                data-ad-slot={slot}
                data-ad-format="fluid"
                data-ad-layout-key={layoutKey}
            />
        </div>
    );
}
