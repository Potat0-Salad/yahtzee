from django.urls import re_path

from core.consumers import GameConsumer

websocket_urlpatterns = [
    re_path(r"^ws/game/(?P<room_code>[A-Za-z0-9]{6})/$", GameConsumer.as_asgi()),
]
