# Password Vault

Gestor de contraseñas local para Chrome y Edge. La bóveda se cifra en el dispositivo y
nunca sale de él: no hay servidor, no hay cuenta, no hay sincronización.

Extensión Manifest V3 construida con [WXT](https://wxt.dev), React 19 y TypeScript.

## Estado

Funciona de extremo a extremo: crear la bóveda, guardar credenciales, notas y tarjetas,
buscar, copiar con borrado automático del portapapeles, bloqueo por inactividad, código de
respaldo y exportación/importación cifrada.

Lo que **todavía no** hace, y conviene saber antes de instalarla:

- **No autocompleta formularios.** El flujo es abrir el popup, buscar y copiar. El
  manifest declara `activeTab`, `scripting`, `tabs` y `<all_urls>` anticipando esa función,
  pero no hay content script que los use. Antes de publicarla hay que implementarlo o
  retirar esos permisos: pedir `<all_urls>` sin código que lo justifique es motivo
  frecuente de rechazo en la Chrome Web Store.
- **No se puede cambiar la contraseña maestra desde la interfaz.** El caso de uso existe y
  está probado (`VaultService.changeMasterPassword`), pero ninguna pantalla lo invoca aún.
- **No hay pantalla de ajustes.** El bloqueo automático (15 min) y el borrado del
  portapapeles (30 s) están fijos en `src/core/policy.ts`.
- **No hay tests de interfaz.** Los 158 tests cubren núcleo, criptografía y adaptadores;
  ningún componente de React está cubierto.

## Modelo de seguridad

```
Contraseña maestra ──scrypt──▶ KEK-maestra ──┐
                                             ├──AES-GCM──▶ DEK ──▶ cada item
Código de respaldo ──scrypt──▶ KEK-respaldo ─┘
```

Cifrado por sobres con **dos destinatarios** sobre una única DEK. Cualquiera de los dos
envoltorios la abre, y son independientes: cambiar la contraseña maestra no invalida el
código de respaldo, y los items nunca se re-cifran — sólo cambian 32 bytes de envoltorio.

- **Derivación**: scrypt (`@noble/hashes`, auditado por Cure53) con N=2¹⁷, r=8, p=2 —el
  doble del mínimo OWASP con su misma huella de memoria—. En JS puro a propósito, para
  mantener el CSP en su forma más estricta (`script-src 'self'`, sin `wasm-unsafe-eval`).
  Los parámetros se guardan en la cabecera de la bóveda, así que endurecerlos en el futuro
  no invalida bóvedas existentes.
- **Cifrado**: AES-256-GCM de WebCrypto, con IV nuevo en cada operación. Al ser cifrado
  autenticado, alterar un byte hace fallar el descifrado en vez de devolver datos
  manipulados.
- **Las llaves viven sólo en el service worker.** Ni el popup ni ninguna página las ven:
  piden operaciones por mensaje y reciben únicamente los datos del item que solicitaron.
- **La DEK vive sólo en `storage.session`**, que es memoria y nunca toca el disco.
  Sobrevive a que MV3 mate el service worker, y bloquear la borra de verdad.
- Los mensajes se **validan con zod al llegar** al worker, aunque vengan de la propia
  extensión.

### Lo que este diseño no puede hacer

Si olvidas la contraseña maestra **y** pierdes el código de respaldo, el contenido se
pierde. No hay puerta trasera; es la consecuencia directa de que no exista servidor.

El código de respaldo devuelve el _acceso_; el archivo de exportación devuelve los _datos_.
Ante un disco muerto hacen falta los dos. Ese archivo **es** la bóveda: guardarlo en una
carpeta sincronizada sube una copia completa a la nube, justo lo que este proyecto evita.

## Desarrollo

```bash
npm install
npm run dev          # Edge con recarga en caliente
npm run dev:chrome   # Chrome
```

Para cargarla a mano: `chrome://extensions` → modo desarrollador → «Cargar descomprimida»
→ `.output/chrome-mv3`.

```bash
npm run check        # tsc --noEmit + eslint + vitest   ← lo que corre el pre-commit
npm test
npm run build        # producción (Edge); build:chrome para Chrome
npm run zip          # paquete para la tienda
```

`npm run dev` requiere las rutas de los binarios del navegador en `web-ext.config.ts`, que
está fuera del control de versiones por ser propio de cada máquina.

## Estructura

```
src/core/        Núcleo puro: cripto, modelo, casos de uso. Sin APIs del navegador
  crypto/          scrypt, AES-GCM, jerarquía de llaves, código de respaldo
  vault/           servicio, repositorio, respaldo, búsqueda, política de contraseñas
  model/           esquemas zod — los tipos se infieren de ellos, no se declaran aparte
src/platform/    Adaptadores: storage, sesión, alarmas, portapapeles
src/messaging/   Protocolo tipado entre el worker y la interfaz
src/ui/          Componentes, hooks y sistema de diseño
entrypoints/     background (service worker), popup, onboarding, offscreen
```

La separación no es decorativa: una regla de ESLint impide que `src/core/**` importe nada
del navegador. Por eso el núcleo se prueba entero en Node, sin extensión de por medio, y
por eso los dobles de test caben en 40 líneas.

## Licencia

Sin licencia definida. Todos los derechos reservados.
