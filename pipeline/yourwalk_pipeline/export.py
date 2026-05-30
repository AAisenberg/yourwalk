"""GeoParquet export via DuckDB GeoPackage intermediate (GDAL lacks GeoParquet driver)."""

from __future__ import annotations

from pathlib import Path

import duckdb
import geopandas as gpd


def export_geoparquet(con: duckdb.DuckDBPyConnection, table: str, dest: Path) -> None:
    gpkg_path = dest.with_suffix(".gpkg")
    con.execute(
        f"""
        COPY {table} TO '{gpkg_path.as_posix()}'
        WITH (FORMAT GDAL, DRIVER 'GPKG')
        """
    )
    gdf = gpd.read_file(gpkg_path)
    gdf.to_parquet(dest, index=False)
    gpkg_path.unlink(missing_ok=True)
