import { EmptyTabScreen } from '@/components/layout/empty-tab-screen';

export default function TransactionsScreen() {
  return (
    <EmptyTabScreen
      eyebrow="Transactions"
      title="Receipts and history"
      body="Private sends, receives, decrypt events, and selective reveal receipts will be organized here."
      icon="trending-up"
    />
  );
}
