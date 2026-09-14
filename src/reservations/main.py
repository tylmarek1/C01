from fastapi import FastAPI

app = FastAPI(title="Sports Court Reservations")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
