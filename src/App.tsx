import { useEffect } from 'react';
import { initRepositories } from './data/repositories';
import { timelineStore } from './state/timeline';
import { AppShell } from './ui/shell/AppShell';
import { UpdatePrompt } from './ui/update/UpdatePrompt';

export default function App(): React.JSX.Element {
  useEffect(() => {
    let cancelled = false;
    void initRepositories().then((repos) => {
      if (!cancelled) timelineStore.setRepos(repos);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <AppShell />
      <UpdatePrompt />
    </>
  );
}
