import { useCallback, useEffect, useState } from 'react';
import { send } from '@/src/messaging/client';
import type { VaultSnapshot } from '@/src/core/vault/vaultService';

/**
 * Estado de la bóveda según el service worker.
 *
 * Se consulta al montar en vez de mantener un estado propio en la UI: el popup se
 * destruye cada vez que se cierra, y el auto-bloqueo puede haber ocurrido mientras
 * estaba cerrado. La única fuente de verdad es el worker.
 */
export function useVaultSnapshot() {
  const [snapshot, setSnapshot] = useState<VaultSnapshot | null>(null);

  const refresh = useCallback(async () => {
    const response = await send({ type: 'vault/snapshot' });
    if (response.ok) setSnapshot(response.value);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { snapshot, refresh };
}
