'use client';

import { NextIntlClientProvider, AbstractIntlMessages } from 'next-intl';
import { ReactNode, useEffect, useState } from 'react';

interface I18nProviderProps {
    children: ReactNode;
    locale: string;
}

export function I18nProvider({ children, locale }: I18nProviderProps) {
    const [messages, setMessages] = useState<AbstractIntlMessages | null>(null);

    useEffect(() => {
        import(`@/messages/${locale}.json`)
            .then((mod) => setMessages(mod.default))
            .catch(() => {
                // Fallback to Spanish
                import('@/messages/es.json').then((mod) => setMessages(mod.default));
            });
    }, [locale]);

    if (!messages) {
        return null; // Or a loading spinner
    }

    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
        </NextIntlClientProvider>
    );
}
