from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core.views import GameSessionViewSet, create_room, guest_session, health, room_detail

router = DefaultRouter()
router.register("games", GameSessionViewSet, basename="game")

urlpatterns = [
    path("health/", health, name="health"),
    path("guest-session/", guest_session, name="guest-session"),
    path("rooms/", create_room, name="create-room"),
    path("rooms/<str:room_code>/", room_detail, name="room-detail"),
    path("", include(router.urls)),
]
