# Sistema de diseño · PIMSA Password Vault

> **Cómo se usa:** al construir una superficie concreta, mira primero
> `design-system/pimsa-password-vault/pages/<superficie>.md`. Si existe, sus reglas
> **anulan** las de este archivo. Si no, manda este.

**Proyecto:** PIMSA Password Vault
**Categoría:** Password Manager
**Diales:** Variance 5/10 (equilibrado / moderno) · Motion 6/10 (estándar) · Density 8/10 (denso)

> **Revisión de agosto de 2026.** Movimiento subió de 3 a 6 y varianza de 3 a 5. Lo que
> cambió no es el criterio —sigue sin moverse nada que no comunique algo— sino el
> repertorio: entrada **y salida** de pantalla, acuse de pulsación, indicadores de trabajo
> real y una capa de material (marco, vidrio, elevación, ambiente).
>
> En color, el cambio es mayor: la «banda oscura» pasa a ser un **modo noche** casi negro
> que el usuario elige, y el acento pasa de `green-500` a `green-300`. Ver _Color_: el
> resumen es que sobre un fondo casi negro un acento necesita **luminosidad**, no
> saturación, y que cumplir el contraste no es lo mismo que verse bien.
>
> La estructura de la pantalla principal también cambió, a partir de una referencia que
> trajo el cliente: título grande, buscador con presencia, y el contenido en un panel
> redondeado que flota sobre el fondo. Ver `pages/popup.md`.
>
> Lo que **no** cambió: los hex de la paleta, los contrastes mínimos, el tamaño de los
> objetivos ni una sola regla de accesibilidad. Las secciones afectadas van marcadas.

---

## Procedencia de este documento

Generado con la base de datos de `ui-ux-pro-max` y luego **corregido a mano**. Lo que se
conservó y lo que no:

| Recomendación de la base                                                                                                | Decisión                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product type **Password Manager** → Minimalism + Accessible & Ethical; secundarios Dark Mode (OLED) y Trust & Authority | **Adoptada.** Es la coincidencia exacta del producto                                                                                                                                                     |
| Paleta «Trust blue + security green + dark neutral»                                                                     | **Adoptada como concepto**, con los hex de PIMSA. La descripción coincide con la marca por casualidad afortunada: azul de confianza + verde de seguridad es literalmente lo que es la paleta corporativa |
| Density 8 → escala de espaciado 2–32 px                                                                                 | **Adoptada**                                                                                                                                                                                             |
| Motion sutil → stagger 250–350 ms, `power1.out`, 0.02–0.04 s por item                                                   | **Adoptada la especificación, descartado GSAP** (ver _Movimiento_)                                                                                                                                       |
| Estilo **Exaggerated Minimalism** (`clamp(3rem,10vw,12rem)`, `font-weight: 900`)                                        | **Descartada.** Salió del `--design-system` genérico y está pensada para portfolios y editorial. En un popup de 380 px la tipografía gigante es absurda                                                  |
| Patrón de página **Trust & Authority + Conversion** (hero, logos, precios, «Contact Sales»)                             | **Descartada.** Es una estructura de landing page comercial. Este producto no tiene landing                                                                                                              |
| Tipografía **JetBrains Mono para todo**, importada de Google Fonts                                                      | **Descartada para el cuerpo, adoptada para secretos.** Ver _Tipografía_                                                                                                                                  |
| Iconos **Phosphor**                                                                                                     | **Descartada.** `lucide-react` ya está integrado y tiene los mismos glifos (`Lock`, `KeyRound`, `Eye`, `EyeOff`, `Copy`, `Search`, `Shield`). Cambiar de librería sería churn sin ganancia               |
| Checklist de pre-entrega, anti-patrones                                                                                 | **Adoptados**, con una excepción documentada en _Tamaño de los objetivos_                                                                                                                                |

---

## Color

La paleta **no se define aquí**. La fuente de verdad es, en este orden:

1. `Mk/PALETA-PIMSA.md` — el documento de marca.
2. `src/ui/tokens.css` — traducción hex por hex de ese documento. **Único** sitio con hex.
3. `src/ui/theme.css` — capa semántica: traduce tokens a roles (`--color-accent`, `--color-danger`…).

Los componentes escriben `bg-surface`, `text-dim`, `border-field`. **Nunca un hex, nunca un
token `--pimsa-*` directamente.**

### Los dos temas

Ya no hay «banda clara» y «banda oscura» que decide el sistema operativo: hay **dos temas y
una preferencia** — `Sistema`, `Claro`, `Noche`. La elige el usuario con el botón de la
cabecera y se guarda; `Sistema` sigue al sistema operativo y reacciona cuando cambia.

|       | Fondo       | Superficie  | Texto   | Acento      | Texto sobre acento |
| ----- | ----------- | ----------- | ------- | ----------- | ------------------ |
| Claro | `paper`     | `surface`   | `ink`   | `navy-500`  | `paper`            |
| Noche | `night-950` | `night-900` | `paper` | `green-300` | **`night-950`**    |

El verde de marca sobre fondo claro da 2.90:1 y es ilegible; por eso en tema claro el acento
es `navy-500`.

### Revisión: el modo noche es casi negro y su acento es `green-300`

La primera versión del modo oscuro seguía la sección 5 del documento de marca al pie de la
letra: fondo `navy-900`, acento `green-500`. Sobre `navy-900` funcionaba. Al bajar el fondo
a casi negro **dejó de funcionar**: se veía apagado y enturbiado. Cumplía el contraste y aun
así estaba mal — el contraste garantiza que algo se lee, no que se vea bien.

El primer diagnóstico fue que el problema era el verde, y se cambió el acento a azul. Era el
diagnóstico equivocado, y vale la pena dejarlo escrito porque es un error fácil de repetir:

**El problema no era el matiz. Era la luminosidad.** `green-500` tiene luminosidad relativa
0.28 — un oliva de tono medio. Contra un fondo de luminosidad 0.002 no tiene margen para
destacar: es un color medio sobre nada, y eso se lee como suciedad. `green-300` es el mismo
matiz (82°) al doble de luminosidad (0.54), y sobre `night-950` da **11.0:1**. El verde de
marca sobre negro funciona perfectamente; el que no funcionaba era ese verde concreto.

La regla que se saca de aquí, y que aplica a cualquier color futuro sobre la banda oscura:

> Sobre un fondo casi negro, un acento necesita **luminosidad**, no saturación. Un color de
> tono medio se enturbia por muy saturado que esté. La pregunta correcta no es «¿este color
> pega?» sino «¿este color tiene luminosidad suficiente para separarse del fondo?».

Y el otro cambio, que sigue en pie:

**El fondo baja a `night-950` `#050608`.** Es 213° con la saturación muy baja: entra por la
regla generativa de la sección 1 del documento de marca — no es un negro prestado, es el
azul de la marca llevado al fondo de su escala. Por debajo del 3 % de luminosidad el matiz
es nominal y se lee neutro.

No es `#000000` exacto, y no por gusto: en OLED el píxel apagado tarda en encender y el
texto deja rastro al hacer scroll; en LCD, el negro puro contra texto blanco da un halo que
cansa en sesiones largas. Los 5/6/8 de `night-950` evitan las dos cosas.

**Sobre la regla 60/30/10.** Con el acento en verde, el verde deja de ser escaso en modo
noche: está en el botón principal, en la pestaña activa, en los favoritos y en el icono de
las credenciales. Es una desviación consciente de la sección 3 del documento de marca,
decidida por el cliente y acotada a este modo — en tema claro el acento sigue siendo
`navy-500` y el verde sigue siendo escaso. La razón es que en una interfaz oscura el acento
es prácticamente el único color que hay: repartirlo menos no lo haría más significativo, lo
haría invisible.

### La escala de noche

Cuatro superficies en vez de tres tonos de navy, con saltos cortos: en una interfaz oscura,
saltos grandes entre superficies se leen como manchas.

| Token       | Hex       | Uso                          | Sobre `night-950` |
| ----------- | --------- | ---------------------------- | ----------------- |
| `night-950` | `#050608` | Fondo                        | —                 |
| `night-900` | `#111419` | Panel y tarjetas             | —                 |
| `night-800` | `#171B21` | Elevado y realce de fila     | —                 |
| `night-700` | `#242A33` | Bordes y divisores           | —                 |
| `slate-400` | `#8A94A3` | Texto secundario y contornos | 6.6:1             |
| `green-300` | `#B0CD75` | Acento                       | 11.0:1            |
| `green-200` | `#C7DCA3` | Hover del acento             | 13.7:1            |
| `blue-400`  | `#5D86B9` | Distintivo de tarjetas       | 5.4:1             |

El salto de `night-950` a `night-900` es grande a propósito: el contenido se apoya en un
panel redondeado que flota sobre el fondo, y si los dos tonos se parecen, el panel deja de
existir. De `900` a `800` el salto es corto — sólo el necesario para que el realce de una
fila se note sin gritar.

El hover del acento **sube** de luminosidad (`green-200`) en vez de bajar. Ir a `green-500`
sería lo intuitivo y es justo lo que no funciona: sobre negro el botón parecería
desactivarse al pasar por encima.

`slate-400` existe porque la paleta no tiene un gris: hace falta un texto secundario que no
compita con el acento ni se confunda con un elemento pulsable.

### Cómo se aplica el tema

`data-theme` en el elemento raíz, no `prefers-color-scheme`. Lo pone `public/theme-boot.js`
**antes del primer pintado**, y ahí está el único detalle no obvio de todo el mecanismo: ese
archivo no puede ser un módulo del bundle. Un módulo se ejecuta después de que el navegador
haya parseado el documento, y para entonces ya ha pintado el fondo del CSS — un fogonazo
blanco en cada apertura del popup. La solución clásica es un `<script>` en línea, y el CSP
de esta extensión (`script-src 'self'`, sin `unsafe-inline`) no lo permite. Un archivo de
`public/` sin `defer` ni `type="module"` bloquea el parseo y se ejecuta en el sitio exacto
donde estaría el script en línea.

La preferencia vive en `localStorage` y no en `chrome.storage`: no son datos de la bóveda,
no salen del popup, y `chrome.storage` es asíncrono — un ida y vuelta al service worker
garantizaría el fogonazo que todo esto existe para evitar.

### Anti-patrón crítico: indicadores sólo por color

Está en la lista de la base de datos y aquí importa el doble: el tipo de item **siempre**
lleva icono además de color (`KeyRound` / `StickyNote` / `CreditCard`). Un usuario con
daltonismo debe distinguir una tarjeta de una nota sin ver el color.

---

## Tipografía

| Rol                                                  | Fuente             | Por qué                                                                                    |
| ---------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| Interfaz                                             | **Inter**          | Legible a 12 px, que es donde vive casi todo en un popup denso                             |
| Contraseñas, códigos de respaldo, números de tarjeta | **JetBrains Mono** | Distingue `0`/`O` y `1`/`l`. En un gestor de contraseñas eso no es estética, es corrección |

**Ambas se empaquetan localmente.** El `@import` a `fonts.googleapis.com` que sugiere la
base de datos queda descartado: una petición de red al abrir el popup delata que la
extensión está en uso, y este producto no hace **ninguna** petición de red. Es también lo
que mantiene el CSP en su forma más estricta.

> **Revisión.** Durante meses este párrafo fue falso. La pila de fuentes nombraba Inter y
> JetBrains Mono pero no había un solo `@font-face`, así que todo se dibujaba con la fuente
> del sistema. Ahora vienen de `@fontsource-variable/*` (paquetes npm, se resuelven en
> tiempo de compilación) y Vite las emite como recurso de la extensión — cero red en
> ejecución. Sólo el subconjunto `latin`: 88 kB entre las dos. Ver `src/ui/fonts.css`.

Tamaño mínimo de texto: **12 px**. Cuerpo 14 px, títulos de sección 16 px.

**Cifras de ancho fijo** (`font-variant-numeric: tabular-nums`) en toda la interfaz. Los
contadores de los filtros y los bits de entropía cambian mientras se escribe; con cifras
proporcionales, pasar de «11» a «18» empuja el texto de al lado. Es un temblor pequeño y
constante y es de las cosas que más delatan una interfaz descuidada.

---

## Espaciado (density 8/10)

| Token         | Valor | Uso                            |
| ------------- | ----- | ------------------------------ |
| `--space-xs`  | 2 px  | Separación de icono a etiqueta |
| `--space-sm`  | 4 px  | Espacios en línea              |
| `--space-md`  | 8 px  | Padding estándar               |
| `--space-lg`  | 12 px | Padding de sección             |
| `--space-xl`  | 16 px | Márgenes de bloque             |
| `--space-2xl` | 24 px | Separación entre grupos        |
| `--space-3xl` | 32 px | Padding de pantallas vacías    |

En Tailwind esto es `gap-0.5 / 1 / 2 / 3 / 4 / 6 / 8`. No se inventan valores intermedios.

Radio de esquina, **dos escalones** (revisión): `rounded-lg` (8 px) en controles —botones,
campos, píldoras— y `rounded-xl` (12 px) en las superficies que los contienen —tarjetas,
paneles, filas—. Un único radio para todo aplana la jerarquía justo donde conviene que se
note qué contiene a qué. `rounded-full` sólo en avatares y píldoras.

---

## Material (sección nueva)

Cuatro recetas, todas en `@layer components` de `theme.css`. Van como clase y no como
utilidades sueltas porque cada una son cuatro o cinco propiedades que sólo significan algo
juntas.

| Clase            | Qué es                                              | Dónde                                       |
| ---------------- | --------------------------------------------------- | ------------------------------------------- |
| `.surface-glass` | Cromo translúcido con desenfoque y saturación 180 % | Cabeceras y pies de todas las pantallas     |
| `.surface-card`  | Superficie elevada con filo de luz y sombra         | Tarjetas, paneles, el generador             |
| `.ambient`       | Dos focos de luz que derivan muy despacio           | Bloqueo, recuperación, alta. Nunca la lista |
| `.press`         | Acuse de pulsación (`scale: 0.97`)                  | Todo lo pulsable                            |
| `.view-screen`   | Lo que se desliza al cambiar de pantalla            | El contenido del popup, una vez             |

Tres reglas que no son obvias y cuestan una tarde si se descubren en el navegador:

1. **La profundidad cambia de mecanismo entre bandas.** En banda clara la da la sombra; en
   oscura, el filo de luz del borde superior (`--color-hairline`), porque una sombra oscura
   sobre fondo oscuro no tiene contra qué recortarse. Las dos declaraciones están siempre y
   cada banda apaga la que no le sirve poniendo su token a `transparent`.
2. **Las sombras van teñidas de `navy-900`, no negras.** El documento de marca dice que ni
   los neutros son prestados; una sombra gris junto a una paleta construida sobre dos
   matices se nota aunque nadie sepa decir por qué.
3. **El acuse de pulsación usa la propiedad `scale`, no `transform: scale()`.** No es lo
   mismo: `transform` **sustituye** al que ya hubiera, y varios de estos botones se centran
   con `-translate-y-1/2`. Con `transform`, pulsarlos les borraba el centrado y el icono
   pegaba un salto.

El campo de luz es **la única decoración de toda la interfaz** y se le exige lo mismo que a
un color de marca: salir de 213° o de 82°. Son navy y verde a opacidad muy baja, no un
degradado de stock. Y está acotado a las pantallas de una sola cosa: detrás de la lista
competiría con los datos.

---

## Movimiento

Nivel **estándar** (revisión: era sutil). El criterio no cambió — **sólo se anima lo que
comunica algo** — pero el repertorio sí.

### Las tres curvas

Tres y no más. Cada una dice una cosa distinta:

| Token             | Curva                               | Qué comunica                                              |
| ----------------- | ----------------------------------- | --------------------------------------------------------- |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)`     | Algo **entra**. Arranca de golpe y frena largo            |
| `--ease-out-quad` | `cubic-bezier(0.25, 0.46, .45,.94)` | Un estado **cambia**. Hover, foco, color                  |
| `--ease-spring`   | `cubic-bezier(0.34, 1.4, 0.64, 1)`  | Una acción se **confirma**. Sólo si la provocó el usuario |

### El repertorio

| Animación                | Duración  | Qué comunica                                                |
| ------------------------ | --------- | ----------------------------------------------------------- |
| `animate-row-in`         | 300 ms    | La lista acaba de descifrarse (escalonado 30 ms, tope 10)   |
| `animate-view-in`        | 180 ms    | Esta pantalla ha **sustituido** a la otra, no la ha borrado |
| `animate-rise-in`        | 420 ms    | Los bloques de una pantalla de formulario, escalonados      |
| `animate-pop-in`         | 420 ms    | Algo aparece y hay que mirarlo                              |
| `animate-toast-in`       | 260 ms    | Confirmación de algo que el usuario acaba de hacer          |
| `animate-shake`          | 400 ms    | La única animación que dice «no»: contraseña incorrecta     |
| `animate-halo`/`breathe` | 1.8 s/4 s | Trabajo real en curso / reposo. Decorativas                 |
| `animate-drain`          | 3 s       | Cuánto le queda al aviso en pantalla                        |

**Ocupado y deshabilitado se pintan distinto.** Los dos impiden pulsar, pero deshabilitado
dice «esto todavía no se puede hacer» y ocupado dice «se está haciendo». Pintados igual, el
medio segundo que tarda scrypt se leía como que el botón se había apagado al pulsarlo.

**GSAP se descarta.** La base de datos entrega los snippets en GSAP, pero para opacidad,
desplazamiento y escala son ~70 kB de dependencia en un paquete de 400 kB. Todo lo de arriba
sale de `@keyframes`, corre en el compositor igual y no añade un byte de JavaScript.

### Entrada **y salida** de pantalla

Una animación de entrada se hace con `@keyframes`. Una de salida no: cuando React deja de
renderizar un componente, el nodo desaparece del DOM en ese mismo fotograma y no queda nada
que animar. La solución habitual es una librería que retrasa el desmontaje —`framer-motion`,
`react-transition-group`— manteniendo vivo el árbol viejo un rato, y **eso aquí significaría
mantener vivo un rato el componente que tiene una contraseña descifrada en su estado**.

Se usa la API de transiciones de vista del navegador, que no hace eso: toma una captura de
la pantalla anterior, deja que React desmonte, y anima la imagen. Cuando la animación corre,
el componente viejo ya no existe — lo que se mueve es un mapa de bits. Sale gratis en
memoria, sale gratis en secretos y no añade una dependencia.

Tres detalles que cuestan una tarde si se descubren en el navegador:

1. **`flushSync` es obligatorio.** El navegador captura el estado nuevo en cuanto vuelve el
   callback; React 19 agrupa las actualizaciones y las aplica después. Sin `flushSync` se
   captura la pantalla vieja dos veces y no se mueve nada.
2. **Se anima `screen`, no `root`.** Animando la raíz se desliza el documento entero y el
   marco del popup va dentro: se vería el borde despegarse de su sitio. Con nombre propio
   para el contenido, el marco se queda quieto y por dentro cambia la pantalla.
3. **La dirección se decide en un solo sitio** (`App.tsx`). Si cada pantalla eligiera la
   suya, tarde o temprano una entraría por el lado contrario al que salió la anterior.

### `prefers-reduced-motion`

Respetado globalmente en `theme.css`, y con una corrección que importa: además de poner las
duraciones a 0.01 ms hay que fijar `animation-iteration-count: 1`. Sin eso, una animación
infinita no se detiene — se queda repitiéndose cada 0.01 ms para siempre, que es peor que
dejarla correr.

---

## Tamaño de los objetivos

La checklist de la base de datos pide **44 × 44 px**. Es la guía táctil de iOS/Android y
**no se aplica aquí**: esto es un popup de escritorio de 380 px manejado con ratón. El
estándar que corresponde es **WCAG 2.2 AA, criterio 2.5.8 (Target Size Minimum): 24 × 24 px**.

Regla adoptada: **mínimo 32 × 32 px** de área activa, con 8 px de separación entre botones
adyacentes. Supera el requisito web con margen y mantiene la densidad que exige un popup.

---

## Accesibilidad — no negociable

- Contraste 4.5:1 en texto, 3:1 en bordes de controles. Ya garantizado por los roles de
  `theme.css`; **no lo rompas usando un token crudo**.
- Foco visible en todo control (`:focus-visible` global, 2 px de acento con 2 px de offset).
- **Nada depende sólo del hover.** Los botones de copiar están siempre visibles, atenuados;
  el hover los realza, no los revela.
- Orden de tabulación = orden visual.
- Toda acción alcanzable por teclado. En la lista: `↑`/`↓` mueven, `Enter` abre, `Esc`
  retrocede, escribir enfoca la búsqueda.
- Botones con sólo icono llevan `aria-label`.
- Estados de carga con esqueleto, nunca pantalla en blanco.
- `role="status"` en los avisos efímeros (copiado), `role="alert"` en los errores.

---

## Estados vacíos y sin resultados

Son distintos y se tratan distinto:

| Situación               | Qué se muestra                                                      |
| ----------------------- | ------------------------------------------------------------------- |
| Bóveda sin items        | Icono, «Tu bóveda está vacía» y **un botón que crea el primero**    |
| Búsqueda sin resultados | «Nada coincide con _término_» y **un botón que limpia la búsqueda** |

Nunca «0 resultados» a secas, nunca un hueco en blanco.

---

## Anti-patrones prohibidos

- Emoji como icono → SVG de lucide.
- Indicadores sólo por color → icono + color.
- Decoración excesiva → si un elemento no comunica estado o jerarquía, sobra. El campo de
  luz de `.ambient` es la única excepción, y está acotada por escrito.
- Quitar el anillo de foco.
- Cambios de estado instantáneos (0 ms) o lentos (>300 ms) — salvo las entradas de vista,
  que llegan a 420 ms porque no bloquean nada.
- Hover como única vía a una acción.
- Hex crudo en un componente. **Ni una sombra ni una curva a mano**, por el mismo motivo:
  están en `theme.css` como `shadow-e1..e3` y `--ease-*`.
- Texto por debajo de 12 px.
- Hovers que desplazan el layout. En una fila de lista el realce es fondo, sombra y una
  marca de acento que crece con `scaleY` sobre un elemento que ya ocupa su sitio; `scale`
  sobre la fila entera empujaría a las de abajo.
- `transform: scale()` para el acuse de pulsación → propiedad `scale`, que compone en vez
  de sustituir.
- `transition-all` cuando el elemento lleva `.press`: interpola de más y arrastra la
  pulsación. Lista explícita de propiedades, con `scale` dentro.
- Animación infinita sin `animation-iteration-count: 1` en el bloque de `reduced-motion`.

---

## Checklist antes de entregar UI

- [ ] Sin emoji como icono; todos los iconos de lucide
- [ ] `cursor-pointer` en todo lo clicable
- [ ] Transiciones de 150–300 ms en hover
- [ ] Contraste ≥ 4.5:1 en **las dos** bandas, comprobado
- [ ] Foco visible y orden de tabulación correcto
- [ ] `prefers-reduced-motion` respetado, **animaciones infinitas incluidas**
- [ ] Objetivos ≥ 32 × 32 px con 8 px de separación
- [ ] Estado vacío y estado sin resultados, ambos con acción
- [ ] Acuse de pulsación en todo lo pulsable (`.press`)
- [ ] Los estados «ocupado» y «deshabilitado» no se pintan igual
- [ ] Ningún hex crudo (`grep -rn "#[0-9a-fA-F]\{6\}" src/ui/components entrypoints`)
- [ ] Ninguna petición de red — **también las fuentes**
