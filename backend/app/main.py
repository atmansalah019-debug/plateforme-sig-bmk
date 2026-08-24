from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Plateforme SIG - Béni Mellal-Khénifra",
    description="API REST pour l'aide à la décision territoriale",
    version="1.0.0"
)

# CORS — autoriser le frontend React (dev sur :3000 et production sur :80)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",        # Frontend Docker (nginx port 80)
        "http://localhost:80",     # Frontend Docker (port explicite)
        "http://localhost:3000",   # Frontend développement (npm start)
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "ok",
        "app": "Plateforme SIG Béni Mellal-Khénifra",
        "version": "1.0.0",
        "docs": "/docs"
    }

from app.api.endpoints import spatial

app.include_router(spatial.router, prefix="/api/spatial", tags=["Spatial Data"])
