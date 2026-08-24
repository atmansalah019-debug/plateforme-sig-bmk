import os
import glob
import geopandas as gpd
from sqlalchemy import create_engine
import argparse

# Configuration de la base de données (Utilisation de psycopg2 pour geopandas en mode synchrone)
DATABASE_URL = os.getenv(
    "SYNC_DATABASE_URL", 
    "postgresql://postgres:postgres@127.0.0.1:5433/sig_benimellal"
)
engine = create_engine(DATABASE_URL)

def load_shapefile_to_postgis(filepath: str, table_name: str):
    """
    Charge un fichier vectoriel (Shapefile, GeoJSON) dans PostGIS.
    Effectue les géotraitements nécessaires : conversion SRID, nettoyage.
    """
    print(f"Chargement du fichier {filepath} dans la table '{table_name}'...")
    try:
        # Lire les données spatiales
        gdf = gpd.read_file(filepath, encoding='latin1')
        print(f"[{table_name}] {len(gdf)} entités lues.")

        # Vérification et conversion du SRID vers 4326 (standard GPS)
        if gdf.crs is None or gdf.crs.to_epsg() != 4326:
            print(f"[{table_name}] Reprojection en EPSG:4326...")
            gdf = gdf.to_crs(epsg=4326)

        # Assurer que les noms de colonnes sont en minuscules (convention PostgreSQL)
        gdf.columns = [col.lower() for col in gdf.columns]
        
        # S'assurer de la présence d'une colonne géométrie nommée 'geom' 
        if gdf.active_geometry_name != 'geom':
            gdf = gdf.rename_geometry('geom')

        # Insérer dans PostGIS
        gdf.to_postgis(
            name=table_name,
            con=engine,
            if_exists='replace',
            index=True,
            index_label='id'
        )
        
        print(f"[SUCCES] Les données ont été chargées dans la table '{table_name}'.\n")
    except Exception as e:
        print(f"[ERREUR] lors du chargement de {table_name} : {repr(e)}")

if __name__ == "__main__":
    data_dir = r"c:\Users\utilisateure\Desktop\ROOT\Education\TDI2\PFA_exterieur\data\CleanData"
    
    print("=== Démarrage de l'intégration PostGIS automatique ===\n")
    
    # Trouver tous les fichiers .shp
    files = glob.glob(os.path.join(data_dir, "*.shp"))
    print(f"Trouvé {len(files)} fichiers Shapefile à importer.")

    for filepath in files:
        filename = os.path.basename(filepath)
        # Nettoyer le nom du fichier pour en faire un nom de table SQL valide (ex: BMKcommunes.shp -> bmkcommunes)
        table_name = filename.replace('.shp', '').lower().replace('bmkgis_osm_', '').replace('_free_1', '').replace('_a', '')
        
        load_shapefile_to_postgis(filepath, table_name)

    print("=== Opération terminée ===")

