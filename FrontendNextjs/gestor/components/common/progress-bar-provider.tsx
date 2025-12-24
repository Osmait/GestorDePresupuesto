'use client';

import NextTopLoader from 'nextjs-toploader';

export function ProgressBarProvider({ children }: { children: React.ReactNode }) {
    return (
        <>
            <NextTopLoader
                color="#22c55e"
                initialPosition={0.08}
                crawlSpeed={200}
                height={3}
                crawl={true}
                showSpinner={false}
                easing="ease"
                speed={200}
                shadow="0 0 10px #22c55e,0 0 5px #22c55e"
                zIndex={1600}
                showAtBottom={false}
            />
            {children}
        </>
    );
}
