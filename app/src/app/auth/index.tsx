import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  getAuthProgress,
  getAuthProgressHref,
  hasReturningUser,
  WelcomeScreen,
} from '@/features/auth';

export default function AuthIndexScreen() {
  const [resumeHref, setResumeHref] = useState<ReturnType<typeof getAuthProgressHref> | undefined>();
  const [returningUser, setReturningUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    Promise.all([getAuthProgress(), hasReturningUser()])
      .then(([progress, hasReturned]) => {
        if (mounted && progress) {
          setResumeHref(getAuthProgressHref(progress));
        }
        if (mounted) {
          setReturningUser(hasReturned);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return null;
  }

  if (resumeHref) {
    return <Redirect href={resumeHref} />;
  }

  if (returningUser) {
    return <Redirect href="/auth/login" />;
  }

  return <WelcomeScreen />;
}
