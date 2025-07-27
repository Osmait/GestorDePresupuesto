import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const TransactionsClient = dynamic(() => import('@/components/transactions/TransactionsClient'), { ssr: false });

function TransactionsClientWrapper() {
	return (
		<Suspense fallback={<div className="flex justify-center items-center min-h-screen"><span className="text-lg">Cargando...</span></div>}>
			<TransactionsClient />
		</Suspense>
	);
}

export default function TransactionsPage() {
	return <TransactionsClientWrapper />;
}
