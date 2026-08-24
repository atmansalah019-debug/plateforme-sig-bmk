FROM python:3.11-slim

WORKDIR /app

# Installer les dépendances système requises par GeoPandas et psycopg2
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    gcc \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Variables d'environnement pour que GDAL fonctionne bien avec Python
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copier tout le backend
COPY . .

# Exposer le port de FastAPI
EXPOSE 8000

# Lancer le serveur avec Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
