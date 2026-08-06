# Popup · 380 × 600

Anula `MASTER.md` sólo donde se indica. Todo lo demás sigue vigente.

## Por qué 380 × 600

Es el máximo cómodo de un popup de extensión (Chrome corta a 800 px de alto). 600 px dan
espacio para ~8 filas visibles sin hacer scroll, que cubre el caso de uso real: buscar una
credencial concreta, no navegar un catálogo.

## Estructura

**Revisión de agosto de 2026**, a partir de una referencia que trajo el cliente. Lo que
cambió: el marco sale del panel.

```
┌────────────────────────────────────────────┐
│                                            │  ← fondo
│  Bóveda                          ☾    🔒   │  título 24 px
│                                            │
│  ╭──────────────────────────────────────╮  │  buscador 48 px
│  │ ⌕  Buscar…                        ✕  │  │
│  ╰──────────────────────────────────────╯  │
│ ╭──────────────────────────────────────────╮  ← panel, esquinas redondeadas
│ │ ┌────┬────────┬───────┬──────────┐       │
│ │ │Todo│ Logins │ Notas │ Tarjetas │       │
│ │                                          │
│ │  Favoritos                               │  etiqueta de grupo
│ │  ┌──┐                                    │
│ │  │⚿ │ GitHub                    ⧉   ⧉  │  60 px · fila
│ │  └──┘ usuario@correo.com                 │
│ │  Todos                                   │
│ │  ┌──┐                                    │
│ │  │▤ │ Claves del router                  │
│ │  └──┘ Nota segura                        │
│ ├──────────────────────────────────────────┤
│ │ ⛑                            ( + Nuevo ) │  pie
│ ╰──────────────────────────────────────────╯
└────────────────────────────────────────────┘
```

**El título y el buscador van fuera del panel.** Es la jerarquía que la pantalla no tenía:
fuera está el marco —dónde estás y qué buscas—, dentro están tus datos. Con todo al mismo
nivel había que leer el popup entero para encontrar por dónde se empieza.

**El título es grande (24 px)** porque un popup se abre desde una barra de navegador llena
de iconos diminutos. Entrar en una superficie que empieza con una palabra grande y clara es
lo que la separa de la ventana que la ha lanzado. Cuesta 32 px de los 600 y los devuelve.

**El buscador es más alto y más redondeado que cualquier otro campo.** Es lo primero que
recibe el foco y el gesto que se repite a diario; con el mismo peso visual que un campo de
formulario cualquiera, la interfaz no dice que va de buscar.

Alto de fila **60 px** con ficha de icono de 40 px. Antes eran 56 con ficha de 32 y línea
divisoria; la línea desaparece porque en una lista de cuatro elementos tres reglas
horizontales dedican más tinta a separar que a informar. Quien separa ahora es el espacio y
la ficha, que a 40 px ancla el bloque de texto en vez de quedarse por debajo de él.

**Los favoritos se agrupan bajo su encabezado, pero sólo mientras se ojea.** Al buscar manda
la relevancia —así lo ordena `searchItems`— y agrupar entonces partiría los resultados por
un criterio que ya no decide el orden.

Todo va en **una sola `<ul>`** aunque haya dos grupos: la navegación con flechas busca los
botones dentro de esa lista, y partirla en dos rompería el recorrido justo en la frontera
entre favoritos y el resto. Los encabezados son `<li role="presentation">`.

En el pie, los iconos a la izquierda y la acción principal como píldora a la derecha. Crear
no es lo que más se hace en un gestor de contraseñas —lo que más se hace es buscar y
copiar—, así que ocupa el sitio de una acción destacada, no el de una barra entera.

## Jerarquía dentro de la fila

1. **Título** — `text-sm font-medium text-text`. Lo que el usuario busca.
2. **Subtítulo** — `text-xs text-dim`. Identifica sin revelar: usuario para logins, «Nota
   segura» para notas, `•••• 1234` para tarjetas. **Nunca la contraseña.**
3. **Icono de tipo** — `size-4` en un cuadro de 32 px con fondo `bg-<tipo>/10` y aro
   `ring-<tipo>/15`. Sin el aro, un cuadrado de color plano se lee como un hueco.
4. **Acciones** — copiar usuario / copiar contraseña. Siempre visibles en `text-dim`.

**Realce al recorrerla.** Fondo `bg-surface`, `shadow-e1` y una marca de acento de 3 px que
crece por la izquierda con `scaleY`. Responde a `hover` **y** a `focus-within`: quien
recorre la lista con las flechas tiene que ver dónde está igual de claro que quien usa el
ratón. La fila no lleva `overflow-hidden` a propósito — recortaría el anillo de foco del
botón de dentro, que se dibuja 2 px por fuera.

## Teclado

| Tecla              | Acción                                                 |
| ------------------ | ------------------------------------------------------ |
| Cualquier carácter | Enfoca la búsqueda (si el foco no está ya en un campo) |
| `↓` / `↑`          | Mueve por la lista                                     |
| `Enter`            | Abre el item seleccionado                              |
| `Esc`              | Limpia la búsqueda; si ya está vacía, vuelve atrás     |

La flecha abajo desde el campo de búsqueda salta a la primera fila: es el gesto que la
gente espera de un buscador con resultados debajo.

## Detalle del item

Sustituye la lista en la misma superficie (no es un modal: en 380 px un modal desperdicia
el ancho). Cabecera con botón de volver, campos apilados, cada uno con su botón de copiar.

La contraseña sale **enmascarada** y en `font-mono`. Revelarla es una acción explícita con
`Eye`/`EyeOff`. Copiar no requiere revelar: son cosas distintas y copiar es la frecuente.

## Copiado

Al copiar aparece un aviso efímero abajo con `role="status"`, se descarta solo a los 3 s, y
dice **qué** se copió y que se limpiará. El portapapeles se limpia a los **30 s** — ver
`src/platform/clipboard.ts` para por qué eso no puede vivir en el popup.

Tres detalles del aviso que no son cosméticos:

- **Lleva una barra que se vacía en esos 3 s.** Sin ella es fácil confundir que el aviso
  desaparezca con que el portapapeles ya se limpió. Son dos relojes distintos y verlos así
  lo deja claro. Su duración sale de `TOAST_MS`, el mismo valor con el que el hook programa
  el borrado — escrita a mano en el CSS, uno podría cambiar sin el otro.
- **Se posa por encima del pie, no sobre él** (`aboveFooter`). Antes tapaba el botón
  «Nuevo» los tres segundos. Era `pointer-events-none` y se podía seguir pulsando, pero no
  ver dónde está la acción principal justo después de copiar es peor que no poder pulsarla.
- **La `key` es el id del aviso, no el texto.** Copiar dos contraseñas seguidas produce el
  mismo mensaje: React reutilizaría el nodo y el segundo aviso saldría sin animarse, que es
  justo cuando hace falta ver que el clic entró.

## Movimiento

**Revisión:** el detalle ya no entra sin animación. La razón original seguía siendo buena
—cualquier retraso tras un clic se percibe como lentitud— pero 180 ms con `ease-out-expo`
arrancan de golpe y sólo frenan al final, así que no hay nada que esperar. Lo que aporta es
continuidad: que se vea que esta pantalla ha **sustituido** a la otra y no que la ha
borrado.

| Superficie               | Entrada                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| Lista                    | `animate-row-in`, 300 ms, 30 ms por fila, tope de 10                    |
| Cambio de pantalla       | Transición de vista: sale en 160 ms, entra en 240 ms, 28 px direccional |
| Bloques de un formulario | `animate-rise-in`, 420 ms, escalonados 60–80 ms                         |
| Confirmación de borrado  | `animate-sheet-in`, 220 ms, sube desde el borde inferior                |
| Aviso de copiado         | `animate-toast-in`, 260 ms, con rebote                                  |

El cambio de pantalla anima **las dos**: la que se va y la que llega. Adelante empuja hacia
la izquierda, atrás hacia la derecha, y son 28 px y no un barrido de los 380 px completos —
en una superficie tan estrecha, un deslizamiento a página entera se lee como que la interfaz
se ha ido a otro sitio. La salida (160 ms) termina antes que la entrada (240 ms) o durante
un instante se ven las dos.

**El cromo es translúcido y la lista no.** Cabecera y pie llevan `.surface-glass`: quedan un
escalón por encima de la página y enmarcan el contenido en lugar de ser dos franjas más. La
lista no lleva ningún tratamiento — es donde están los datos, y todo lo que se le añada
compite con ellos. Por lo mismo, `.ambient` no se usa aquí: sólo en bloqueo y recuperación.

La última fila se desvanece contra el pie con un degradado. Es la señal de que hay más
abajo: una lista que termina justo en el borde parece que ha terminado de verdad.

## Alta y edición de un elemento

Dos decisiones que van contra la versión corta de «un formulario es una pila de campos»:

**Arriba se ve la fila que estás creando**, actualizándose mientras escribes. Un formulario
normal te hace guardar para descubrir qué has hecho. Aquí el resultado va delante, así que
se entiende antes de rellenar nada que lo que se monta es una entrada de la lista — y se ve
al momento que el subtítulo de una tarjeta son los cuatro últimos dígitos y el de una
credencial es el usuario. Se construye con `toSummary`, **la misma función que genera las
filas de la lista**: una vista previa dibujada aparte es una vista previa que acaba
mintiendo.

**El tipo se elige con tres tarjetas grandes**, no con tres píldoras de texto. Es la primera
decisión y la que cambia todo lo demás: si eliges mal, rellenas el formulario equivocado.
Merece el tamaño y merece el icono.

Son `<input type="radio">` de verdad en `sr-only` con la tarjeta como `<label>`, y no
botones con `role="radio"`. La diferencia no es de purismo: el rol puesto sobre un `<button>`
**anuncia** el comportamiento de radio sin implementarlo — las flechas no moverían entre las
opciones y habría que programar el tabindex móvil a mano. Con radios reales el navegador ya
lo hace. El anillo de foco se traslada a la tarjeta con `has-[:focus-visible]`, porque el
input real mide cero.

El resto de campos va agrupado en secciones con encabezado (`Identificación`, `Acceso`,
`Dónde se usa`): ordena un formulario largo sin añadirle pantallas.

## Bloqueo

Es la pantalla que más veces se ve y la única con una espera real: derivar la llave con
scrypt son ~540 ms medidos, y esa lentitud es intencional. Es también, por eso, la única
donde el movimiento hace trabajo en vez de decorar — las ondas del distintivo y el
indicador del botón cubren ese medio segundo en el que, sin ellos, la extensión parece
haberse colgado.

Al fallar, el formulario se sacude (`animate-shake`, la única animación que dice «no») y el
foco vuelve al campo. La sacudida se enciende con estado y se apaga sola al terminar, en vez
de remontar el formulario con una `key`: remontarlo repetiría la animación igual de bien y
perdería el foco justo cuando el usuario va a volver a escribir.
