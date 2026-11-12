"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import { cn } from "@/lib/utils";

/**
 * A small OpenStreetMap view of one point. Leaflet is loaded in the browser
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
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapRef.current);
        // A point of the packet's own ink rather than Leaflet's image marker.
        markerRef.current = L.circleMarker([lat, lon], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: "#1e4a30",
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
      <figcaption className="pointer-events-none absolute bottom-2.5 left-2.5 z-[500] rounded-[8px] bg-panel/95 px-2.5 py-1.5 font-mono text-[12px] text-ink-soft shadow-[0_2px_8px_rgb(18_48_31/0.12)]">
        {lat.toFixed(4)}°, {lon.toFixed(4)}°
      </figcaption>
    </figure>
  );
}
