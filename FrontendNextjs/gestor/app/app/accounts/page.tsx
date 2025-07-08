import dynamic from 'next/dynamic';
const AccountsClient = dynamic(() => import('@/components/accounts/AccountsClient'), { ssr: false });

export default function AccountsPage() {
  return <AccountsClient />;
}
