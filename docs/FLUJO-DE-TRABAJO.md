# Flujo de trabajo — Inventario de Repuestos Milenium Motos

Guía operativa para trabajar día a día con el sistema. No es documentación técnica:
explica **cómo usar la app** para mantener el inventario correcto.

## Idea central que hay que entender primero

**El stock nunca se escribe a mano.** No existe un campo "cantidad en stock" que
edites. El stock de cada repuesto **se calcula solo** a partir de sus movimientos
(ingresos, salidas y ajustes). Por eso la regla de oro es:

> Si algo entró, salió o se corrigió en el almacén → se registra un **movimiento**.
> El stock, las alertas, la rotación y los reportes se actualizan automáticamente.

Esto garantiza que siempre haya trazabilidad: cada unidad tiene un historial de
quién la movió, cuándo, desde/hacia dónde y con qué código de referencia.

---

## Estructura de datos (de lo general a lo específico)

```
Grupo (categoría)  ─►  Repuesto (SKU)  ─►  Movimientos  ─►  Stock (calculado)
  ej. "Cadenas"        ej. "CAD-428"       ingreso 18         = suma de movimientos
                                            salida  16
                                            ajuste  -2
```

- **Grupo:** categoría del repuesto (Cadenas, Llantas, Filtros…).
- **Repuesto / SKU:** el ítem concreto. Tiene SKU único, descripción,
  compatibilidad, grupo y stock mínimo.
- **Movimiento:** cada entrada/salida/corrección de unidades.

---

## 1. Puesta a punto (solo al inicio o al ampliar el catálogo)

Hazlo en este orden, porque cada nivel necesita el anterior:

1. **Crear los grupos** — botón **Grupos** en Inventario. Ya vienen 10 sembrados
   (Parabrisas, Llantas, Cadenas, Pastillas de freno, Filtros, Bujías, Espejos,
   Baterías, Focos, Kits de arrastre). Agrega los que falten.
2. **Crear los repuestos** — botón **+ Repuesto**. Por cada SKU llena:
   - **SKU** (obligatorio, único): código corto, ej. `CAD-428`.
   - **Descripción** (obligatorio): ej. `Cadena 428H · 120L`.
   - **Compatibilidad** (opcional): modelos/medidas con los que sirve, ej.
     `CB / YBR`, `CB190R`, `125–160cc`, `Delantera`, `Universal`. Es solo una
     etiqueta de referencia y también sirve para buscar.
   - **Grupo** (obligatorio): a qué categoría pertenece.
   - **Mínimo** (obligatorio): umbral de reposición. Cuando el stock baja de este
     número, salta una alerta. Ponlo según cuánto vendes y cuánto tarda el proveedor.
3. **Cargar el stock inicial** — para que un repuesto tenga unidades, registra un
   **ingreso** con la cantidad que tienes hoy en almacén (ver punto 2).

---

## 2. Operación diaria: registrar movimientos

Botón **+ Registrar ingreso** (abre el formulario de movimiento). Elige el tipo:

| Situación real | Tipo | Cantidad | Efecto en stock |
|---|---|---|---|
| Llega mercadería del proveedor | **Ingreso** | número **positivo** | suma |
| Se vende / se usa un repuesto | **Salida** | número **positivo** | resta |
| El conteo físico no cuadra | **Ajuste** | positivo **o negativo** | suma o resta |

Campos del movimiento:
- **Repuesto:** el SKU afectado.
- **Cantidad:** entero. En ingreso y salida se pone en **positivo** (el sistema
  resta solo en la salida). En ajuste puedes poner negativo para descontar.
- **Origen:** de dónde viene (proveedor en un ingreso, cliente en una salida).
  El destino siempre es el almacén único, así que no se pide. Sirve para la trazabilidad.
- **Código de referencia:** orden de compra, boleta, guía, etc. (ej. `OC-1234`).
- **Comentarios (opcional):** notas libres sobre el movimiento.

**Reglas que impone el sistema:**
- No puedes registrar una **salida mayor al stock disponible** — te avisa
  "Stock insuficiente: hay N unidades disponibles". Lo mismo con un ajuste negativo
  que dejaría el stock por debajo de 0.
- La cantidad debe ser un entero distinto de 0.

**Cuándo usar Ajuste (y no ingreso/salida):** solo para **corregir diferencias**
que no son una compra ni una venta — mermas, roturas, robo, errores de conteo,
unidades encontradas. Un ajuste no representa un flujo comercial, solo cuadra el
número real con el sistema.

### Corregir un movimiento mal registrado (Anular)

Si registraste un movimiento por error (cantidad equivocada, repuesto equivocado,
etc.), **no se edita ni se borra** — se **anula**. Cada movimiento tiene un botón
**Anular**, disponible en dos sitios:

- En el **detalle del repuesto** (clic en la fila → historial de movimientos).
- En la página **Movimientos**, junto a cada movimiento.

Al anular, el sistema registra un **movimiento inverso** que cancela el efecto del
original en el stock. Así el error queda corregido **sin perder el historial**: el
movimiento original sigue visible, marcado como `ANULADO`, y su reversión aparece
como `ANULACIÓN`, con el registro de quién la hizo. Es el equivalente a un asiento
de corrección en contabilidad.

Reglas de la anulación:

- **No se puede anular dos veces** el mismo movimiento, ni anular una anulación.
- **No se puede anular** si eso dejaría el stock en negativo. Ejemplo: registraste
  un ingreso de 10 y ya se vendieron 8 (quedan 2); anular ese ingreso dejaría el
  stock en −8, así que el sistema lo impide. En ese caso corrige con un movimiento
  nuevo (una salida o un ajuste) en vez de anular.

**Anular vs. Ajuste:** usa **Anular** para deshacer un movimiento **equivocado**
(nunca debió existir). Usa **Ajuste** para reflejar un cambio **real** del inventario
(merma, rotura, conteo que no cuadra) que sí ocurrió.

---

## 3. Consultar el estado del inventario

- **Panel general:** vista rápida — grupos, alertas activas, movimientos de los
  últimos 7 días, alertas y movimientos recientes, y stock por grupo.
- **Inventario:** la tabla de todos los SKUs. Puedes **buscar** (por descripción,
  SKU, grupo o compatibilidad) y **filtrar por grupo**. Clic en una fila abre el
  **detalle** del repuesto con su historial completo de movimientos.

**Estados de cada repuesto** (se calculan solos):

| Estado | Cuándo | Qué hacer |
|---|---|---|
| 🟢 **Disponible** | stock igual o por encima del mínimo | nada |
| 🟠 **Stock bajo** | stock por debajo del mínimo | reponer pronto |
| 🔴 **Agotado** | 0 unidades | reponer urgente |
| 🔵 **Exceso** | stock ≥ 4× el mínimo | pausar compras |

---

## 4. Alertas — qué reponer y qué frenar

La sección **Alertas** genera avisos automáticos, ordenados por urgencia:

- **Crítica** (Agotado): 0 unidades, reposición urgente.
- **Alta** (Stock bajo): por debajo del mínimo.
- **Media** (Baja rotación): stock que cubre ≥ 60 días de ventas → considera
  promoción/descuento para moverlo.
- **Media** (Exceso de stock): tienes 4× o más del mínimo → pausa la compra.

El número rojo junto a "Alertas" en el menú lateral es la cantidad de alertas activas.

---

## 5. Reportes — decisiones de compra

La sección **Reportes** ayuda a decidir la próxima compra:

- **Compras sugeridas:** lista los SKUs bajo el mínimo con una **cantidad sugerida**
  a pedir (apunta a dejar el stock en el doble del mínimo), priorizados por urgencia.
- **Rotación por SKU:** días de cobertura estimados (menor = se vende más rápido).
- **Inventario por grupo:** cuánto pesa cada categoría en el stock total.
- KPIs: unidades a reponer y rotación lenta.

**Flujo típico de compra:** entra a Reportes → mira "Compras sugeridas" → arma el
pedido al proveedor con las cantidades sugeridas de las prioridades Crítica/Alta →
cuando llegue la mercadería, registra el **ingreso** correspondiente.

---

## 6. Mantener el catálogo (editar / eliminar)

- **Editar repuesto:** clic en la fila → botón **Editar** en el detalle. Puedes
  cambiar SKU, descripción, compatibilidad, grupo y mínimo. **No cambia el stock**
  (eso solo se hace con movimientos).
- **Eliminar repuesto:** botón **Eliminar** en el detalle. **Solo se puede borrar
  un repuesto que no tiene ningún movimiento registrado.** Si ya tuvo movimientos,
  el sistema lo impide (para no perder la trazabilidad); en ese caso, si ya no lo
  manejas, simplemente déjalo en 0 unidades.
- **Grupos:** botón **Grupos** → crear, renombrar o eliminar. **No se puede borrar
  un grupo que todavía tiene repuestos**; primero mueve o elimina esos repuestos.

---

## Resumen del ciclo de trabajo

```
Llega/sale mercadería
        │
        ▼
Registrar movimiento (ingreso / salida / ajuste)
        │
        ▼
Stock, estado, rotación y alertas se recalculan solos
        │
        ▼
Revisar Alertas y Reportes
        │
        ▼
Decidir y hacer la compra → registrar el ingreso cuando llegue
        │
        └──────────► (vuelve al inicio)
```

## Recordatorios rápidos

- El stock **siempre** se cambia con movimientos, nunca editando el repuesto.
- La **salida** y el **ingreso** se ingresan en positivo; el **ajuste** admite negativo.
- Los movimientos **no se editan ni se borran**: si te equivocaste, usa **Anular**
  (registra un inverso y conserva el historial).
- **SKU** es único y **no** se puede borrar un repuesto con historial ni un grupo con repuestos.
- Ajusta bien el **mínimo** de cada SKU: es lo que dispara las alertas y las compras sugeridas.
- Cada movimiento queda registrado con **usuario, fecha, origen/destino y código de referencia** — úsalo.
