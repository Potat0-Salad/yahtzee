from django.contrib import admin

from core.models import GamePlayer, GameSession, GuestProfile


@admin.register(GuestProfile)
class GuestProfileAdmin(admin.ModelAdmin):
    list_display = ["id", "display_name", "created_at", "last_seen_at"]
    search_fields = ["id", "display_name"]


class GamePlayerInline(admin.TabularInline):
    model = GamePlayer
    extra = 0


@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ["id", "mode", "status", "created_by", "created_at", "ended_at"]
    list_filter = ["mode", "status"]
    inlines = [GamePlayerInline]
