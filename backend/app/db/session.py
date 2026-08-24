import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

# URL de connexion à PostGIS (sera configurée plus tard dans l'Étape 3)
# Format: postgresql+asyncpg://user:password@localhost:5432/dbname
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://postgres:postgres@localhost:5432/sig_benimellal"
)

engine = create_async_engine(DATABASE_URL, echo=True)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

# Dépendance pour obtenir la session de base de données dans les routes FastAPI
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
