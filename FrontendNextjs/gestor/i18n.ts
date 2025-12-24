import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
    // Try to get locale from cookie, default to Spanish
    const cookieStore = await cookies();
    const locale = cookieStore.get('locale')?.value || 'es';

    return {
        locale,
        messages: (await import(`./messages/${locale}.json`)).default
    };
});
