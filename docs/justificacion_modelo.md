# Justificación del modelo

**Qué se predice:** el puntaje global promedio de Saber 11 que sacará un municipio o un colegio el año siguiente
(escala 0–500), con un intervalo "más o menos".

**Modelo elegido:** regresión anclada en el promedio de los últimos 3 años (`ml-service/app/modelo.py`).

```
predicción = promedio_3
           + b1 · (puntaje_ultimo   − promedio_3)
           + b2 · (puntaje_anterior − promedio_3)
           + b3 · (puntaje_grupo    − promedio_3)
```

Los coeficientes se estiman con Ridge (`alpha = 10`) **sin intercepto**, sobre el residuo `puntaje_real − promedio_3`.
Con los datos de 2015–2020 (versión v1) quedan así:

| Variable | Peso en la predicción |
|---|---|
| `promedio_3` | 0,830 |
| `puntaje_ultimo` | 0,253 |
| `puntaje_anterior` | −0,117 |
| `puntaje_grupo` (municipio o departamento) | 0,034 |
| intercepto | 0 |

En palabras: el modelo parte del promedio de 3 años, le suma un cuarto de lo que el último año se alejó de ese
promedio y le resta parte de lo que se alejó el año anterior. Los pesos suman 1, así que el modelo no inventa
subidas ni bajadas generales.

## Cómo se evaluó

Validación temporal (la estrategia de la Actividad 5): para cada año `t`, se entrena solo con años anteriores a `t`
y se predice `t`. Ningún dato del año que se predice entra al entrenamiento. Métrica principal: **error absoluto
medio (MAE) en puntos en las unidades de Chocó**, promediado sobre los años. Siempre se compara con dos líneas base
que no aprenden nada:

- **persistencia:** "el año siguiente saca lo mismo que el último año con datos"
- **promedio_3:** "el año siguiente saca el promedio de sus últimos 3 años con datos"

Un modelo que no le gane a estas dos líneas base no aporta nada, por sofisticado que sea.

## Qué se probó (MAE en Chocó, puntos; menor es mejor)

Años validados 2016, 2017, 2019, 2020 y 2022, usando entrenamiento + novedades 2022:

| Modelo | 2016 | 2017 | 2019 | 2020 | 2022 | **Promedio** |
|---|---|---|---|---|---|---|
| Persistencia (línea base) | 9,98 | 9,14 | 14,25 | 10,86 | 8,56 | 10,56 |
| Promedio de 3 años (línea base) | 8,74 | 7,64 | 15,38 | 7,54 | 8,57 | 9,58 |
| Ridge con todas las variables (puntajes, tamaño, hogar, tipo de unidad) | 8,69 | 8,99 | 16,59 | 8,19 | 11,57 | 10,81 |
| Ridge solo con los 4 puntajes | — | — | — | — | — | 10,11 |
| Ridge anclado + variables del hogar | 8,58 | 8,78 | 17,85 | 7,98 | 8,35 | 10,31 |
| Ridge anclado con intercepto | 8,67 | 9,71 | 18,36 | 7,37 | 8,44 | 10,51 |
| **Ridge anclado sin intercepto (elegido)** | **8,74** | **7,70** | **15,18** | **7,38** | **8,34** | **9,47** |

También se probaron, y se descartaron:

- **Gradient boosting** (`HistGradientBoostingRegressor`): error de 12,1 (municipios) y 12,4 (colegios), peor que
  todas las líneas base.
- **Agregar el cambio del promedio nacional en el último año** (y el nivel nacional): el error pasó de 11,5 a 12,7 y
  12,5 en los años 2017–2022. Solo hay 5 cambios nacionales para aprender (−0,2, +8,3, −3,0, −9,0 y +2,1 puntos
  entre 2014 y 2020) y no siguen un patrón: el modelo aprendió "si el país subió, seguirá subiendo", que es falso.

## Por qué este modelo

1. **Es el único que le gana a las dos líneas base** en el promedio (9,47 frente a 9,58 y 10,56), y gana o empata
   en 4 de los 5 años. En la versión v1 (solo hasta 2020) también gana: 9,75 frente a 9,83 y 11,06.
2. **Sin intercepto no aprende el "año bueno o malo" del país.** La mayor parte del error viene de cambios que
   afectan a todo el país en un año (en 2019 todos los modelos fallan por 14–18 puntos). Un intercepto memoriza el
   cambio promedio de los años de entrenamiento y lo aplica al año siguiente, que suele ir en otra dirección.
3. **Las variables del hogar (internet, educación de la madre, extraedad, ruralidad) no mejoran la predicción del
   año siguiente.** Explican por qué un colegio está donde está, pero eso ya está dentro de su historia de puntajes.
   Se conservan como variables informativas para el EDA.
4. **Es explicable:** cada coeficiente se lee como "cuánto pesa cada año", que se puede defender en la sustentación.
5. **Se exporta a ONNX sin pérdida:** es lineal, así que el backend en C++ obtiene exactamente las mismas
   predicciones que scikit-learn (diferencia máxima de 0,00005 puntos).

## Limitaciones (para decirlas antes de que las pregunten)

- **Gana por poco:** 0,1 puntos sobre el promedio de 3 años (alrededor de 1 %). El valor del modelo está en que
  funciona igual de bien que la mejor regla simple, y ofrece un flujo reproducible, versionado y con intervalos.
- **No puede anticipar choques nacionales** (cambios del examen, pandemia, años atípicos como 2019). Ningún modelo con
  estos datos puede.
- **Los colegios pequeños son poco predecibles:** con menos de 10 estudiantes el intervalo de 80 % es de unos
  ±22 puntos; con 30 o más, de unos ±13 a 17.
- **Faltan 2018 y 2021** en los datos abiertos. Cuando hay un año de hueco el error sube; si llegan esos datos, se
  agregan con el flujo de actualización y el modelo se reentrena sin cambiar código.
- **Predice, no explica causas:** que un coeficiente sea positivo no significa que esa variable cause el puntaje.
