from sqlalchemy import Column, Integer, String, Float, BigInteger, Boolean
from geoalchemy2 import Geometry
from .session import Base

# --- DÉCOUPAGE ADMINISTRATIF ---

class Region(Base):
    __tablename__ = "regions"
    id = Column(Integer, primary_key=True, index=True)
    iso = Column(String)
    nom_fr = Column(String, index=True)
    nom_ar = Column(String)
    p_ensemble = Column(Float)
    p_masculin = Column(Float)
    p_feminins = Column(Float)
    p_menages = Column(Float)
    p_urbaine = Column(Float)
    p_rurale = Column(Float)
    geom = Column(Geometry('MULTIPOLYGON', srid=4326), nullable=False)

class Province(Base):
    __tablename__ = "provinces"
    id = Column(Integer, primary_key=True, index=True)
    iso = Column(String)
    nom_fr = Column(String, index=True)
    nom_ar = Column(String)
    p_ensemble = Column(Float)
    p_masculin = Column(Float)
    p_feminins = Column(Float)
    p_menages = Column(Float)
    p_urbaine = Column(Float)
    p_rurale = Column(Float)
    geom = Column(Geometry('MULTIPOLYGON', srid=4326), nullable=False)

class Commune(Base):
    __tablename__ = "communes"
    id = Column(Integer, primary_key=True, index=True)
    iso = Column(String)
    nom_fr = Column(String, index=True)
    nom_ar = Column(String)
    p_ensemble = Column(Float)
    p_masculin = Column(Float)
    p_feminins = Column(Float)
    p_menages = Column(Float)
    geom = Column(Geometry('MULTIPOLYGON', srid=4326), nullable=False)

# --- DONNÉES OSM ---

class Road(Base):
    __tablename__ = "roads"
    id = Column(Integer, primary_key=True, index=True)
    osm_id = Column(String, index=True)
    code = Column(Integer)
    fclass = Column(String, index=True)  # type de route (primary, secondary...)
    name = Column(String)
    ref = Column(String)
    oneway = Column(String)
    maxspeed = Column(Integer)
    layer = Column(Integer)
    bridge = Column(String)
    tunnel = Column(String)
    geom = Column(Geometry('MULTILINESTRING', srid=4326), nullable=False)

class Waterway(Base):
    __tablename__ = "waterways"
    id = Column(Integer, primary_key=True, index=True)
    osm_id = Column(String, index=True)
    code = Column(Integer)
    fclass = Column(String, index=True) # type d'eau (river, stream...)
    width = Column(Float)
    name = Column(String)
    geom = Column(Geometry('MULTILINESTRING', srid=4326), nullable=False)

class POI(Base):
    __tablename__ = "pois"
    id = Column(Integer, primary_key=True, index=True)
    osm_id = Column(String, index=True)
    code = Column(Integer)
    fclass = Column(String, index=True) # type de poi (hospital, school...)
    name = Column(String)
    geom = Column(Geometry('POINT', srid=4326), nullable=False)

