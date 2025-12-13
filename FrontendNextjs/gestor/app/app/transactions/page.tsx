import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { TransactionsPageSkeleton } from '@/components/transactions/TransactionsPageSkeleton';

const TransactionsClient = dynamic(() => import('@/components/transactions/TransactionsClient'), { ssr: false });

function TransactionsClientWrapper() {
	return (
		<Suspense fallback={<TransactionsPageSkeleton />}>
			<TransactionsClient />
		</Suspense>
	);
}

export default function TransactionsPage() {
	return <TransactionsClientWrapper />;
}
