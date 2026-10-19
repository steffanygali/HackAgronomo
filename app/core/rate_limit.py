"""Limitador de tasa (Rate Limiter) en memoria por ventana deslizante (OWASP API4:2023).

Implementación ligera basada en la biblioteca estándar (`collections.deque` y
`time.monotonic`) sin dependencias externas adicionales, evitando problemas de
compatibilidad en Python 3.14. En despliegues multi-worker actúa como defensa en
profundidad junto al rate limiting del proxy inverso.
"""

from __future__ import annotations

import threading
import time
from collections import deque


class SlidingWindowRateLimiter:
    """Limitador por clave (IP + bucket) usando ventana deslizante de 60 segundos."""

    def __init__(
        self,
        default_per_minute: int = 120,
        predict_per_minute: int = 30,
        enabled: bool = True,
        window_seconds: float = 60.0,
    ) -> None:
        self.default_per_minute = max(1, default_per_minute)
        self.predict_per_minute = max(1, predict_per_minute)
        self.enabled = enabled
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def allow_request(self, client_ip: str, is_predict: bool = False) -> bool:
        """Registra una solicitud y devuelve True si está dentro del límite."""
        if not self.enabled:
            return True

        limit = self.predict_per_minute if is_predict else self.default_per_minute
        bucket_key = f"{client_ip}:{'predict' if is_predict else 'default'}"
        now = time.monotonic()
        cutoff = now - self.window_seconds

        with self._lock:
            queue = self._hits.get(bucket_key)
            if queue is None:
                queue = deque()
                self._hits[bucket_key] = queue

            while queue and queue[0] <= cutoff:
                queue.popleft()

            if len(queue) >= limit:
                return False

            queue.append(now)
            return True

    def reset(self) -> None:
        """Limpia el estado de conteo (útil en pruebas automatizadas)."""
        with self._lock:
            self._hits.clear()
