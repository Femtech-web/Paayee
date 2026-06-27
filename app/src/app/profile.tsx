import { EmptyTabScreen } from '@/components/layout/empty-tab-screen';

export default function ProfileScreen() {
  return (
    <EmptyTabScreen
      eyebrow="Profile"
      title="Account and privacy settings"
      body="Smart account details, reveal preferences, supported assets, and sandbox rail status will live here."
      icon="user"
      action="Manage account"
    />
  );
}
