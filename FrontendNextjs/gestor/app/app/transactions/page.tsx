import dynamic from 'next/dynamic';
const TransactionsClient = dynamic(() => import('@/components/transactions/TransactionsClient'), { ssr: false });

export default function TransactionsPage() {
	return <TransactionsClient />;
}
