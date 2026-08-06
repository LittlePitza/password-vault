import { useCallback, useEffect, useState } from 'react';
import { send } from '@/src/messaging/client';
import { describeAnyError } from '@/src/core/vault/errors';
import type { VaultSnapshot } from '@/src/core/vault/vaultService';

/**
 * Estado de la bóveda según el service worker.
 *
 * Se consulta al montar en vez de mantener un estado propio en la UI: el popup se
 * destruye cada vez que se cierra, y el auto-bloqueo puede haber ocurrido mientras
 * estaba cerrado. La única fuente de verdad es el worker.
 *
 * ── Por qué el error se devuelve y no se traga ────────────────────────────────
 * Si esta consulta falla, `snapshot` se queda en `null` y la pantalla enseña su esqueleto
 * de carga. Sin exponer el fallo, ese esqueleto se queda ahí **para siempre**: el popup
 * parece estar cargando cuando en realidad ya se rindió. Devolver el error permite que
 * quien renderiza distinga «todavía no ha llegado» de «no va a llegar».
 */
export function useVaultSnapshot() {
  const [snapshot, setSnapshot] = useState<VaultSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await send({ type: 'vault/snapshot' });

    if (response.ok) {
      setSnapshot(response.value);
      setError(null);
    } else {
      // El snapshot anterior se conserva: si ya había algo en pantalla, un refresco
      // fallido no es motivo para vaciarla. Quien renderiza decide qué priorizar.
      setError(describeAnyError(response.error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { snapshot, error, refresh };
}
