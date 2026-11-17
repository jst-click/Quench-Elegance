"""Quench Elegance API — FastAPI + PostgreSQL.

Run (from the backend folder):  uvicorn app.main:app --reload --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import CLIENT_DIST, UPLOAD_DIR, settings
from .routers import admin, auth, shop
from .seed import init_db
from .utils import ApiError


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print(f"OTP provider: {settings.otp_provider}{' (dev mode: OTP shown on screen)' if settings.otp_dev_mode else ''}", flush=True)
    yield


app = FastAPI(
    title="Quench Elegance API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.is_prod else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.is_prod else "/api/openapi.json",
)

app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_methods=["*"], allow_headers=["*"])


# ---- Errors are always {"message": "..."} so the React app can show them directly ----
@app.exception_handler(ApiError)
async def api_error(_: Request, exc: ApiError):
    return JSONResponse({"message": exc.message, **exc.extra}, status_code=exc.status)


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    return JSONResponse({"message": exc.detail if isinstance(exc.detail, str) else "Request failed."}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    return JSONResponse({"message": f"Invalid value for {field}." if field else "Invalid request."}, status_code=400)


@app.exception_handler(IntegrityError)
async def integrity_error(_: Request, exc: IntegrityError):
    return JSONResponse({"message": "This record already exists."}, status_code=409)


@app.get("/api/health")
def health():
    return {"ok": True}


app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(admin.protected)
app.include_router(shop.router)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ---- Serve the built React app (client/dist) in production ----
if CLIENT_DIST.exists():
    app.mount("/assets", StaticFiles(directory=CLIENT_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse({"message": "Not found."}, status_code=404)
        candidate = (CLIENT_DIST / full_path).resolve()
        if full_path and candidate.is_file() and CLIENT_DIST.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(CLIENT_DIST / "index.html")
