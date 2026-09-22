from pydantic import BaseModel, Field


class PushSubscriptionCreate(BaseModel):
    """Matches the shape of a browser PushSubscription's own .toJSON(),
    flattened — the frontend reads `endpoint`/`keys.p256dh`/`keys.auth`
    straight off that object."""

    endpoint: str = Field(min_length=1, max_length=1000)
    p256dh: str = Field(min_length=1, max_length=255)
    auth: str = Field(min_length=1, max_length=255)


class VapidPublicKeyOut(BaseModel):
    public_key: str
