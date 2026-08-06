import { useState } from 'react';
import { browser } from 'wxt/browser';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { send } from '@/src/messaging/client';
import type { VaultItem } from '@/src/core/model/item';
import type { VaultSnapshot } from '@/src/core/vault/vaultService';
import { useVaultSnapshot } from '@/src/ui/hooks/useVaultSnapshot';
import { navigate } from '@/src/ui/navigation';
import { Button } from '@/src/ui/components/Button';
import { Emblem } from '@/src/ui/components/Emblem';
import { UnlockScreen } from './UnlockScreen';
import { RecoveryScreen } from './RecoveryScreen';
import { SecurityPanel } from './SecurityPanel';
import { VaultList } from './VaultList';
import { ItemDetail } from './ItemDetail';
import { ItemForm } from './ItemForm';

/**
 * Vista actual del popup.
 *
 * Es una unión discriminada y no una ruta: el popup se destruye al cerrarse, así que no
 * hay historial que conservar ni URL que compartir. La ventaja de la unión es que hace
 * imposible estar «en el detalle» sin saber de qué item.
 */
type View =
  | { readonly name: 'list' }
  | { readonly name: 'detail'; readonly id: string }
  | { readonly name: 'form'; readonly existing: VaultItem | null }
  | { readonly name: 'security' };

const LIST: View = { name: 'list' };

export function App() {
  const { snapshot, error, refresh } = useVaultSnapshot();
  const [recovering, setRecovering] = useState(false);

  if (snapshot === null && error !== null) {
    /*
     * No se pudo hablar con el service worker y no hay nada que enseñar. Sin esta rama
     * quedaría el esqueleto de abajo girando indefinidamente: la pantalla diría «estoy
     * cargando» cuando en realidad ya se rindió, que es la peor de las dos mentiras.
     */
    return (
      <Shell>
        <div className="ambient flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <Emblem icon={AlertTriangle} tone="warn" />
          <div className="flex animate-rise-in flex-col gap-1.5 [animation-delay:80ms]">
            <h1 className="text-lg font-semibold">No se pudo abrir la bóveda</h1>
            <p className="text-sm text-dim">{error}</p>
          </div>
          <Button
            className="animate-rise-in [animation-delay:140ms]"
            onClick={() => void refresh()}
          >
            Reintentar
          </Button>
        </div>
      </Shell>
    );
  }

  if (snapshot === null) {
    /*
     * Esqueleto del cromo mientras llega el estado, no una pantalla en blanco.
     * Reproduce la silueta de lo que va a aparecer —cabecera, buscador, filas— así que la
     * lista no «salta» al llegar: ocupa el sitio que ya estaba reservado.
     */
    return (
      <Shell aria-busy="true" aria-label="Abriendo la bóveda">
        <div className="flex h-full flex-col gap-2 p-3">
          <div className="skeleton h-8" />
          <div className="skeleton h-9" />
          <div className="skeleton h-8" />
          <div className="skeleton flex-1" />
        </div>
      </Shell>
    );
  }

  switch (snapshot.status) {
    case 'uninitialized':
      return (
        <Shell>
          <div className="ambient flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <Emblem icon={ShieldCheck} />
            <div className="flex animate-rise-in flex-col gap-1.5 [animation-delay:80ms]">
              <h1 className="text-lg font-semibold">Todavía no tienes bóveda</h1>
              <p className="text-sm text-dim">
                Crea tu contraseña maestra para empezar. Todo se guardará cifrado en este
                dispositivo.
              </p>
            </div>
            <Button
              className="animate-rise-in [animation-delay:140ms]"
              onClick={() => {
                void browser.tabs.create({ url: browser.runtime.getURL('/onboarding.html') });
              }}
            >
              Crear bóveda
            </Button>
          </div>
        </Shell>
      );

    case 'locked':
      return (
        <Shell>
          {recovering ? (
            <RecoveryScreen
              onCancel={() => {
                setRecovering(false);
              }}
              onFinished={() => {
                setRecovering(false);
                void refresh();
              }}
            />
          ) : (
            <UnlockScreen
              onUnlocked={() => void refresh()}
              onForgotPassword={() => {
                setRecovering(true);
              }}
            />
          )}
        </Shell>
      );

    case 'unlocked':
      return (
        <Shell>
          <UnlockedVault snapshot={snapshot} onRefresh={refresh} />
        </Shell>
      );
  }
}

/**
 * Todo lo que ocurre con la bóveda abierta.
 *
 * Va en su propio componente para recibir el `snapshot` ya estrechado a `unlocked`: si
 * viviera dentro del `switch` de arriba habría que ir arrastrando comprobaciones de nulo
 * que el flujo ya descartó.
 */
function UnlockedVault({
  snapshot,
  onRefresh,
}: {
  readonly snapshot: VaultSnapshot;
  readonly onRefresh: () => Promise<void>;
}) {
  const [view, setView] = useState<View>(LIST);

  /**
   * Todo cambio de pantalla pasa por aquí.
   *
   * Es el único sitio de la aplicación que llama a `navigate`, y a propósito: si cada
   * pantalla decidiera su propia animación, tarde o temprano una entraría por el lado
   * contrario al que salió la anterior. Con la dirección puesta aquí, «entrar» y «volver»
   * son opuestos por construcción.
   */
  const go = (next: View) => {
    navigate('forward', () => {
      setView(next);
    });
  };

  const backToList = () => {
    navigate('back', () => {
      setView(LIST);
    });
  };

  const backAndRefresh = () => {
    navigate('back', () => {
      setView(LIST);
    });
    void onRefresh();
  };

  switch (view.name) {
    case 'detail':
      return (
        <ItemDetail
          id={view.id}
          onBack={backToList}
          onEdit={(item) => {
            go({ name: 'form', existing: item });
          }}
          onDeleted={backAndRefresh}
        />
      );

    case 'form':
      return <ItemForm existing={view.existing} onCancel={backToList} onSaved={backAndRefresh} />;

    case 'security':
      return (
        <SecurityPanel missingRecoveryCode={snapshot.missingRecoveryCode} onBack={backAndRefresh} />
      );

    case 'list':
      return (
        <VaultList
          items={snapshot.items}
          damagedCount={snapshot.damagedCount}
          missingRecoveryCode={snapshot.missingRecoveryCode}
          onOpen={(id) => {
            go({ name: 'detail', id });
          }}
          onCreate={() => {
            go({ name: 'form', existing: null });
          }}
          onSecurity={() => {
            go({ name: 'security' });
          }}
          onLock={() => {
            void (async () => {
              await send({ type: 'vault/lock' });
              backAndRefresh();
            })();
          }}
        />
      );
  }
}

/**
 * Superficie del popup: 380 × 600 fijos.
 *
 * `overflow-hidden` acota los focos de luz del fondo — que se salen del recuadro a
 * propósito, para que se lean como iluminación y no como dos círculos dibujados— y evita
 * que Chrome saque una barra de scroll alrededor de todo el popup.
 *
 * `.frame` le pone el borde. Un popup no tiene ventana propia: Chrome lo recorta y lo pega
 * a la barra, así que sin marco la interfaz se derrama sobre el navegador. Con la banda
 * oscura encima de una barra clara, la diferencia entre tener borde y no tenerlo es la
 * diferencia entre un objeto y una mancha.
 *
 * El `.view-screen` de dentro es lo que se desliza al cambiar de pantalla. Va en un
 * elemento aparte para que el marco quede fuera de la animación: si se moviera él también,
 * se vería el borde despegarse del popup en cada navegación.
 */
function Shell({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="frame h-[600px] w-[380px] overflow-hidden bg-bg text-text" {...props}>
      <div className="view-screen h-full">{children}</div>
    </div>
  );
}
