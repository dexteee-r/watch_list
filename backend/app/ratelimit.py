"""Rate limiting léger, en mémoire (fenêtre glissante), sans dépendance externe.

Conçu pour une instance unique (1 worker uvicorn sur le LXC homelab). L'état est
local au process : si l'API était un jour scalée en plusieurs workers/répliques,
il faudrait un backend partagé (ex. Redis). Pour quelques utilisateurs proches,
le compteur en mémoire suffit largement.

S'utilise comme dépendance FastAPI :

    @router.post("", dependencies=[Depends(add_show_rate_limit)])
"""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


def _client_ip(request: Request) -> str:
    """IP réelle du client. Derrière nginx (NPM → web), `X-Forwarded-For` =
    "client, proxy…" → le premier hop est le vrai client. Sinon, IP directe.

    Limite assumée : un client qui forge lui-même un en-tête `X-Forwarded-For`
    peut faire tourner sa clé de comptage et contourner la limite. Le rate-limit
    est ici une défense en profondeur (anti-brute-force / anti-hammering
    accidentel), pas le contrôle primaire — celui-ci reste le hash argon2, les
    mots de passe forts générés et l'absence de signup public. Durcissement
    possible : configurer NPM pour réécrire (et non ajouter) cet en-tête."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimiter:
    """Limite `times` requêtes par fenêtre de `seconds` secondes et par IP.

    `scope` sépare les compteurs entre familles d'endpoints (login vs ajout de série),
    pour qu'une limite n'affecte pas l'autre.
    """

    def __init__(self, times: int, seconds: int, scope: str) -> None:
        self.times = times
        self.seconds = seconds
        self.scope = scope
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    async def __call__(self, request: Request) -> None:
        key = f"{self.scope}:{_client_ip(request)}"
        now = time.monotonic()
        window_start = now - self.seconds
        hits = self._hits[key]

        # Purge les horodatages sortis de la fenêtre.
        while hits and hits[0] <= window_start:
            hits.popleft()

        if len(hits) >= self.times:
            retry_after = int(hits[0] + self.seconds - now) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de requêtes, réessaie dans un instant.",
                headers={"Retry-After": str(retry_after)},
            )

        hits.append(now)


# Instances partagées (l'état doit persister entre les requêtes).
# Login/token : protège contre le brute-force des mots de passe.
auth_rate_limit = RateLimiter(times=10, seconds=60, scope="auth")
# Ajout de série : seule route qui sort vers TVmaze côté serveur → on borne l'egress.
add_show_rate_limit = RateLimiter(times=20, seconds=10, scope="add_show")
