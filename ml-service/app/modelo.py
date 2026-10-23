"""Estimador del modelo: regresión anclada en el promedio de los últimos 3 años.

    predicción = promedio_3 + b1·(puntaje_ultimo − promedio_3) + b2·(puntaje_anterior − promedio_3)
                            + b3·(puntaje_grupo − promedio_3)

Los b se estiman con Ridge SIN intercepto sobre el residuo (puntaje_real − promedio_3). Sin intercepto, el modelo no
puede aprender un "cambio promedio del país" de los años de entrenamiento: el promedio nacional cambia sin patrón
(−0,2, +8,3, −3,0, −9,0 y +2,1 puntos entre 2014 y 2020) y aprenderlo empeora la predicción.
Ver docs/justificacion_modelo.md.

Como todo es lineal, el modelo equivale a una regresión lineal SIN intercepto sobre las cuatro columnas:
    coef(promedio_3) = 1 − b1 − b2 − b3,  coef(ultimo) = b1,  coef(anterior) = b2,  coef(grupo) = b3
Por eso expone `coef_` e `intercept_` como una LinearRegression y se exporta a ONNX con el mismo convertidor.
"""
import numpy as np
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.linear_model import Ridge
from skl2onnx import update_registered_converter
from skl2onnx.operator_converters.linear_regressor import convert_sklearn_linear_regressor
from skl2onnx.shape_calculators.linear_regressor import calculate_linear_regressor_output_shapes

# Orden de las columnas que recibe el estimador
COLUMNAS = ["puntaje_ultimo", "puntaje_anterior", "promedio_3", "puntaje_grupo"]
ANCLA = COLUMNAS.index("promedio_3")


class AnclaPromedio3(RegressorMixin, BaseEstimator):
    def __init__(self, alpha=10.0):
        self.alpha = alpha

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        ancla = X[:, ANCLA]
        otras = [i for i in range(X.shape[1]) if i != ANCLA]
        dif = X[:, otras] - ancla[:, None]
        self.ridge_ = Ridge(alpha=self.alpha, fit_intercept=False).fit(dif, np.asarray(y, dtype=float) - ancla)
        coef = np.zeros(X.shape[1])
        coef[otras] = self.ridge_.coef_
        coef[ANCLA] = 1 - self.ridge_.coef_.sum()
        self.coef_, self.intercept_ = coef, 0.0
        self.n_features_in_ = X.shape[1]
        return self

    def predict(self, X):
        return np.asarray(X, dtype=float) @ self.coef_ + self.intercept_


update_registered_converter(AnclaPromedio3, "SaberAnclaPromedio3",
                            calculate_linear_regressor_output_shapes, convert_sklearn_linear_regressor)
