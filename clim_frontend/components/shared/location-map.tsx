"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import { cn } from "@/lib/utils";

/**
 * A small satellite view of one point (Esri World Imagery, with an OpenStreetMap
 * street layer in the switcher). Leaflet is loaded in the browser
 * only (it touches `window`), and the map is re-centred, not rebuilt, when the
 * point changes.
 */
export function LocationMap({
  lat,
  lon,
  label,
  zoom = 10,
  className,
}: {
  lat: number;
  lon: number;
  label: string;
  zoom?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center: [lat, lon],
          zoom,
          scrollWheelZoom: false,
          attributionControl: true,
        });
        // Satellite imagery by default, with place names on top so the farm is easy to find.
        // A street map stays one click away in the layer switcher.
        const imagery = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 18,
            attribution:
              "Imagery: Esri, Vantor, Earthstar Geographics, and the GIS User Community",
          },
        );
        // Place names sit in their own pane: above the imagery, below the marker.
        mapRef.current.createPane("labels");
        const labelPane = mapRef.current.getPane("labels");
        if (labelPane) {
          labelPane.style.zIndex = "350";
          labelPane.style.pointerEvents = "none";
        }
        const places = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 18, pane: "labels" },
        );
        const streets = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        });
        const satellite = L.layerGroup([imagery, places]).addTo(mapRef.current);
        L.control
          .layers({ Satellite: satellite, Map: streets }, undefined, { position: "topright" })
          .addTo(mapRef.current);
        // A marigold point with a white ring reads on both imagery and the street map.
        markerRef.current = L.circleMarker([lat, lon], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: "#e2a12a",
          fillOpacity: 1,
        }).addTo(mapRef.current);
      } else {
        mapRef.current.setView([lat, lon], zoom);
        markerRef.current?.setLatLng([lat, lon]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lat, lon, zoom]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  return (
    <figure className={cn("relative isolate min-h-[200px] overflow-hidden rounded-[12px] border border-line", className)}>
      <div
        ref={containerRef}
        role="img"
        aria-label={`Map centred on ${label}`}
        className="absolute inset-0"
      />
      <figcaption className="pointer-events-none absolute top-2.5 left-12 z-[500] rounded-[8px] bg-panel/95 px-2.5 py-1.5 font-mono text-[12px] text-ink-soft shadow-[0_2px_8px_rgb(18_48_31/0.12)]">
        {lat.toFixed(4)}°, {lon.toFixed(4)}°
      </figcaption>
    </figure>
  );
}
