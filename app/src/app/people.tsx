import { EmptyTabScreen } from '@/components/layout/empty-tab-screen';

export default function PeopleScreen() {
  return (
    <EmptyTabScreen
      eyebrow="People"
      title="Beneficiaries will live here"
      body="Saved recipients, wallet addresses, and NGN rail details will make chat and voice payments safer."
      icon="users"
    />
  );
}
