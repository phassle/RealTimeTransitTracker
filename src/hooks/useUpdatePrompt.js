import { useRegisterSW } from 'virtual:pwa-register/react';

export function useUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return {
    needRefresh,
    updateServiceWorker: () => updateServiceWorker(true),
    dismissUpdate: () => setNeedRefresh(false),
  };
}
