"""
ASGI config for the Yahtzee backend.

Routes HTTP to Django as usual; WebSocket routing is wired to Channels now
so Phase 3 only has to add consumers to `core/routing.py`, not touch this file.
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

django_asgi_app = get_asgi_application()

from core.routing import websocket_urlpatterns  # noqa: E402  (must import after django setup)

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": URLRouter(websocket_urlpatterns),
    }
)
