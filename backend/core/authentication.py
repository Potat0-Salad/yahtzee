import uuid

from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from core.models import GuestProfile


class GuestTokenAuthentication(BaseAuthentication):
    """Authenticate via `Authorization: Bearer <guest-uuid>`.

    There's no password: the UUID issued by POST /api/guest-session/ *is*
    the credential, and it becomes `request.user`. Good enough for
    anonymous local/online play — a real account system can layer on top
    of GuestProfile.user later without changing this contract.
    """

    keyword = "Bearer"

    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header.startswith(f"{self.keyword} "):
            return None

        token = header[len(self.keyword) + 1 :].strip()
        try:
            guest_id = uuid.UUID(token)
        except ValueError as exc:
            raise AuthenticationFailed("Malformed guest token.") from exc

        try:
            guest = GuestProfile.objects.get(id=guest_id)
        except GuestProfile.DoesNotExist as exc:
            raise AuthenticationFailed("Unknown guest session.") from exc

        guest.last_seen_at = timezone.now()
        guest.save(update_fields=["last_seen_at"])
        return (guest, None)
