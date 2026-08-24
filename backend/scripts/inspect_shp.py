import geopandas as gpd
import os
import glob

data_dir = r"c:\Users\utilisateure\Desktop\ROOT\Education\TDI2\PFA_exterieur\data\CleanData"

# Trouver tous les fichiers .shp dans le dossier
files_to_inspect = glob.glob(os.path.join(data_dir, "*.shp"))

print(f"Trouvé {len(files_to_inspect)} fichiers Shapefile à analyser...\n")

for filepath in files_to_inspect:
    file = os.path.basename(filepath)
    try:
        # Lire seulement la première ligne pour être très rapide
        gdf = gpd.read_file(filepath, rows=1)
        print(f"--- Colonnes pour {file} ---")
        print(list(gdf.columns))
        print("-" * 40)
    except Exception as e:
        print(f"Erreur avec {file}: {e}")

