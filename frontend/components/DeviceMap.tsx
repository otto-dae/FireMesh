'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DeviceMapMarker } from '@/lib/types';
import { getAlertHexColor } from '@/lib/alerts';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface DeviceMapProps {
  devices: DeviceMapMarker[];
  center?: [number, number];
  zoom?: number;
  onDeviceClick?: (deviceId: string) => void;
}

export default function DeviceMap({
  devices,
  center = [20.7042037705179, -100.4436296150508], 
  zoom = 17,
  onDeviceClick,
}: DeviceMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());

  useEffect(() => {
    // Inicializar mapa solo una vez
    if (!mapRef.current) {
      mapRef.current = L.map('map-container').setView(center, zoom);

      // capa de OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    return () => {
      // Cleanup: remover mapa al desmontar
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [center, zoom]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const currentMarkers = markersRef.current;

    // Actualizar o crear marcadores
    devices.forEach((device) => {
      const color = getAlertHexColor(device.alertLevel);
      const existingMarker = currentMarkers.get(device.deviceId);

      if (existingMarker) {
        // Actualizar color del marcador existente
        existingMarker.setStyle({ fillColor: color, color: color });
      } else {
        // Crear nuevo marcador
        const marker = L.circleMarker([device.latitude, device.longitude], {
          radius: 12,
          fillColor: color,
          color: color,
          weight: 3,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(map);

        // Popup con información del dispositivo
        const popupContent = `
          <div class="p-2">
            <h3 class="font-bold text-sm mb-1">${device.name}</h3>
            <p class="text-xs text-gray-600 mb-2">${device.location}</p>
            ${
              device.lastReading
                ? `
              <div class="text-xs space-y-1">
                <div>🌡️ Temp: ${device.lastReading.temperature.toFixed(1)}°C</div>
                <div>💨 Humo: ${device.lastReading.smoke.toFixed(0)} ppm</div>
                <div>🔥 Llama: ${device.lastReading.flame.toFixed(0)}</div>
              </div>
            `
                : '<div class="text-xs text-gray-400">Sin lecturas</div>'
            }
            <div class="mt-2">
              <span class="inline-block px-2 py-1 text-xs rounded" style="background-color: ${color}20; color: ${color}">
                ${device.alertLevel}
              </span>
              <span class="inline-block ml-2 text-xs ${device.isOnline ? 'text-green-500' : 'text-gray-400'}">
                ${device.isOnline ? '🟢 Online' : '🔴 Offline'}
              </span>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);

        // Evento de click
        if (onDeviceClick) {
          marker.on('click', () => onDeviceClick(device.deviceId));
        }

        currentMarkers.set(device.deviceId, marker);
      }
    });

    // Remover marcadores de dispositivos que ya no existen
    const currentDeviceIds = new Set(devices.map((d) => d.deviceId));
    currentMarkers.forEach((marker, deviceId) => {
      if (!currentDeviceIds.has(deviceId)) {
        marker.remove();
        currentMarkers.delete(deviceId);
      }
    });

    // Ajustar vista para mostrar todos los dispositivos si hay al menos uno
    if (devices.length > 0) {
      try {
        const latlngs = devices.map((d) => [d.latitude, d.longitude] as [number, number]);
        const bounds = L.latLngBounds(latlngs);
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.15));
        }
      } catch (e) {
        // No bloquear si hay error al ajustar bounds
      }
    }
  }, [devices, onDeviceClick]);

  return (
    <div className="relative h-full w-full">
      <div id="map-container" className="h-full w-full rounded-lg" />
    </div>
  );
}
