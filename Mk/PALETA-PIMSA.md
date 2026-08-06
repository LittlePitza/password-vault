# Paleta de color — PIMSA

> Referencia única de color para toda la comunicación de Plásticos de Ingeniería Mexicanos.
> Aplica a web, documentos, presentaciones, señalética y cualquier pieza futura.
> Versión 1.0 · Agosto 2026

---

## 1. La lógica de la paleta

Toda la identidad se construye sobre **dos matices** y nada más:

- **Azul 213°** — la estructura. Es el color de la ingeniería, la certificación, el dato.
- **Verde 82°** — el material. Es el color de la transformación, del producto, del ciclo.

Lo que hace coherente al sistema es que **hasta los neutros salen de esos dos matices**. El fondo `paper` no es un gris: es el verde a 18% de saturación. El texto `ink` no es negro: es el azul a 33%. Las líneas divisorias son azul a 18%. Nada en la paleta es un color "prestado" — todo pertenece.

**Regla generativa:** si necesitas un color nuevo, no lo inventes. Sácalo de 213° o de 82° ajustando saturación y luminosidad. Cualquier matiz fuera de esas dos familias es una excepción que hay que justificar por escrito.

---

## 2. La paleta

### Azules — estructura

| Token      | Hex       | RGB          | Uso                                                  |
| ---------- | --------- | ------------ | ---------------------------------------------------- |
| `navy-900` | `#0E1B2E` | 14, 27, 46   | Fondos de sección oscura, footer, portadas           |
| `navy-700` | `#1D3552` | 29, 53, 82   | Superficies elevadas sobre fondo oscuro              |
| `navy-500` | `#294466` | 41, 68, 102  | **Primario de marca.** Títulos, botones, encabezados |
| `blue-600` | `#064D79` | 6, 77, 121   | Ligas, estados hover, foco sobre fondo claro         |
| `blue-400` | `#5D86B9` | 93, 134, 185 | UI secundaria, íconos y bordes sobre oscuro          |

### Verdes — material

| Token       | Hex       | RGB           | Uso                                              |
| ----------- | --------- | ------------- | ------------------------------------------------ |
| `green-800` | `#3A5318` | 58, 83, 24    | Bloques de sustentabilidad, acento profundo      |
| `green-600` | `#5F7A2C` | 95, 122, 44   | Verde para **texto** sobre fondo claro           |
| `green-500` | `#7F9D41` | 127, 157, 65  | **Acento de marca.** CTAs sobre oscuro, gráficos |
| `green-300` | `#B0CD75` | 176, 205, 117 | Acentos sobre navy, tags, visualización de datos |

### Neutros — superficie y texto

| Token       | Hex       | RGB           | Uso                                                    |
| ----------- | --------- | ------------- | ------------------------------------------------------ |
| `paper`     | `#F7F8F5` | 247, 248, 245 | Fondo por defecto. **No usar blanco puro como página** |
| `surface`   | `#FFFFFF` | 255, 255, 255 | Tarjetas y superficies elevadas                        |
| `ink`       | `#16202C` | 22, 32, 44    | Texto de cuerpo. **No usar negro puro**                |
| `ink-muted` | `#5A6878` | 90, 104, 120  | Texto secundario, pies de foto, metadatos              |
| `line`      | `#D8DEE4` | 216, 222, 228 | Reglas capilares, divisores, retículas                 |

### Funcionales — fuera de marca, a propósito

| Token     | Hex       | Uso                                     |
| --------- | --------- | --------------------------------------- |
| `red-600` | `#DC2626` | Errores de formulario, alertas críticas |
| `red-50`  | `#FEF2F2` | Fondo de mensaje de error               |

Estos rojos **no son colores de marca** y no deben aparecer en piezas de comunicación. Existen solo para señalar error en interfaces. Su neutralidad es intencional: un rojo "de marca" haría que los errores se sintieran decorativos.

---

## 3. Proporción: 60 / 30 / 10

| Peso    | Qué         | Colores            |
| ------- | ----------- | ------------------ |
| **60%** | Respiración | `paper`, `surface` |
| **30%** | Estructura  | Familia navy       |
| **10%** | Acento      | Familia verde      |

**El verde es escaso por diseño.** Se reserva para llamados a la acción, cifras clave y el "material" en gráficos e ilustraciones. En el momento en que el verde se reparte por toda la pieza, deja de significar algo — y lo que se pierde es precisamente lo que hace distintiva a la marca.

Una pieza bien hecha se ve mayoritariamente clara, estructurada en azul, con verde apareciendo dos o tres veces.

---

## 4. Contraste — la tabla que decide

Todas las combinaciones están verificadas contra WCAG 2.1 AA (4.5:1 texto normal, 3:1 texto grande ≥24px y elementos de interfaz).

### Sobre fondo claro (`paper` / `surface`)

| Color       | Ratio vs paper | Veredicto                                                 |
| ----------- | -------------- | --------------------------------------------------------- |
| `ink`       | 15.4:1         | ✅ Texto de cuerpo                                        |
| `navy-500`  | 9.3:1          | ✅ Títulos, cualquier tamaño                              |
| `blue-600`  | 8.4:1          | ✅ Ligas                                                  |
| `ink-muted` | 5.3:1          | ✅ Texto secundario                                       |
| `green-600` | 4.6:1          | ⚠️ Pasa AA por margen mínimo. Solo texto, nunca bajo 16px |
| `blue-400`  | 3.5:1          | ⚠️ Solo texto grande, íconos y bordes. Nunca cuerpo       |
| `green-500` | 2.9:1          | ❌ **Nunca como texto sobre claro**, ni grande            |
| `green-300` | 1.7:1          | ❌ Nunca como texto. Solo fondo o gráfico                 |

### Sobre `navy-900`

| Color       | Ratio  | Veredicto                        |
| ----------- | ------ | -------------------------------- |
| `paper`     | 16.2:1 | ✅ Texto de cuerpo               |
| `green-300` | 9.7:1  | ✅ Acentos y texto destacado     |
| `green-500` | 5.6:1  | ✅ Texto de botón, CTAs          |
| `blue-400`  | 4.6:1  | ✅ Texto secundario, bordes      |
| `blue-600`  | 1.9:1  | ❌ Invisible. Nunca sobre oscuro |

### Las tres trampas

1. **`green-500` sobre claro es el error más frecuente.** Es el verde del logo, así que la intuición dice "usa el verde de marca para el título". Reprueba AA con 2.9:1. Para texto verde sobre fondo claro existe `green-600` — para eso se creó.

2. **`green-500` degrada sobre `navy-700`** (4.0:1, reprueba texto normal). El verde de CTA está calibrado para `navy-900`. Si una tarjeta `navy-700` lleva botón verde, el texto del botón debe ir en `navy-900`, no en verde.

3. **`blue-400` solo funciona sobre `navy-900`** (4.6:1). Sobre `navy-700` cae a 3.3:1 y sobre `navy-500` a 2.6:1. No es un azul universal para fondos oscuros — está afinado para uno solo.

---

## 5. Combinaciones aprobadas

Estas parejas están verificadas y se pueden usar sin volver a consultar la tabla.

| Banda               | Fondo       | Texto   | Acento                   |
| ------------------- | ----------- | ------- | ------------------------ |
| **Clara** (default) | `paper`     | `ink`   | `green-600` / `navy-500` |
| **Elevada**         | `surface`   | `ink`   | `blue-600`               |
| **Oscura**          | `navy-900`  | `paper` | `green-300`              |
| **Sustentabilidad** | `green-800` | `paper` | `green-300`              |

**Ritmo:** claro → oscuro → claro. Máximo dos bandas oscuras por pieza. La banda oscura es donde la marca se siente más premium, y funciona porque es escasa.

---

## 6. Aplicación fuera de la web

La paleta es la misma en todos los medios; lo que cambia es qué tanto se puede confiar en el color.

**Documentos de Office (Word, Excel, PowerPoint).** Cargar los hex como tema personalizado y usarlo en todas las plantillas. Encabezados en `navy-500`, cuerpo en `ink`, acentos de tabla en `line`. Un documento de PIMSA no lleva verde salvo en una gráfica o un dato destacado.

**Presentaciones.** Portada y separadores en `navy-900` con título en `paper` y eyebrow en `green-300`. Diapositivas de contenido en `paper`. Esto reproduce el ritmo de bandas del sitio.

**Gráficas y visualización de datos.** Serie principal `navy-500`, serie de contraste `green-500`, series adicionales `blue-400` y `green-300`. Nunca usar la familia navy completa para distinguir series: `navy-900`, `navy-700` y `navy-500` están a menos de 1.8:1 entre sí y son indistinguibles en proyector o impresión a escala de grises. Para más de cuatro series, usar patrones o etiquetas directas, no más colores.

**Impresión.** Los valores de esta paleta son RGB. **No convertir a CMYK por cuenta propia** — la conversión depende del papel y del perfil de la imprenta. Entregar los hex al proveedor y pedir prueba de color, prestando atención especial al verde: los verdes saturados son los que más se corren en CMYK.

**Señalética y aplicaciones físicas.** Pedir equivalencia Pantone al proveedor a partir de `navy-500` `#294466` y `green-500` `#7F9D41`, que son los dos colores del logo. Validar contra muestra física, no contra pantalla.

---

## 7. Cambios respecto a la versión anterior

Tres correcciones derivadas de la auditoría de contraste:

**`blue-400` pasó de `#517AAD` a `#5D86B9`.** El valor original daba 4.0:1 sobre `navy-900` y reprobaba AA. El nuevo da 4.59:1. Este cambio ya está en el código pero quedó pendiente en la retícula técnica de `globals.css`, que todavía trae el hex viejo escrito a mano.

**`forest-800` `#003F2E` se retira y se reemplaza por `green-800` `#3A5318`.** El color anterior era el único de toda la paleta fuera de las dos familias cromáticas: matiz 164° (verde azulado) contra el 82° del resto, y saturación 100% contra el rango 14–55% de todos los demás. En la práctica se leía como un color de otra marca, y junto a `navy-900` era casi indistinguible. El reemplazo conserva el rol —acento profundo para bloques de sustentabilidad— dentro de la familia verde.

**Se documenta la separación mínima entre oscuros.** `navy-900`, `navy-700`, `navy-500` e `ink` están todos entre 1.05:1 y 1.74:1 entre sí. Son colores de superficie para dar profundidad por capas, no para codificar información. Cualquier distinción que dependa de ellos se pierde en impresión, proyección o para usuarios con baja visión.

---

## 8. Cómo mantener esto

Este documento es la fuente de verdad. En código, la implementación vive en `src/styles/tokens.css` y debe coincidir hex por hex.

**Nunca escribir un hex a mano en un componente.** Siempre consumir el token. El caso de la retícula técnica es exactamente por qué: un hex hardcodeado sobrevivió a una corrección de accesibilidad y nadie se enteró.

Al agregar un color, la pregunta es: _¿pertenece a 213° o a 82°?_ Si no, la respuesta por defecto es que no entra.
