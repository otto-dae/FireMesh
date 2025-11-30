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
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

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
        // Actualizar icono del marcador existente
        const iconHtml = `
          <div style="
            background-color: ${color};
            width: 40px;
            height: 40px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg 
              style="transform: rotate(45deg); width: 20px; height: 20px;" 
              fill="white" 
              viewBox="0 0 24 24"
            >
              <path d="M12 2c-1.1 0-2 .9-2 2 0 .74.4 1.38 1 1.72V9h2V5.72c.6-.34 1-.98 1-1.72 0-1.1-.9-2-2-2zm-1 10v9c0 .55.45 1 1 1s1-.45 1-1v-9h-2zm-7 0c0 .55.45 1 1 1h4v-2H5c-.55 0-1 .45-1 1zm10 0c0 .55.45 1 1 1h4c.55 0 1-.45 1-1s-.45-1-1-1h-4c-.55 0-1 .45-1 1z"/>
            </svg>
          </div>
        `;
        
        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-marker-icon',
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40],
        });
        
        existingMarker.setIcon(customIcon);
      } else {
        // Crear icono personalizado con SVG
        const iconHtml = `
          <div style="
            background-color: ${color};
            width: 40px;
            height: 40px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg 
              style="transform: rotate(45deg); width: 20px; height: 20px;" 
              fill="white" 
              viewBox="0 0 24 24"
            >
              <path d="M12 2c-1.1 0-2 .9-2 2 0 .74.4 1.38 1 1.72V9h2V5.72c.6-.34 1-.98 1-1.72 0-1.1-.9-2-2-2zm-1 10v9c0 .55.45 1 1 1s1-.45 1-1v-9h-2zm-7 0c0 .55.45 1 1 1h4v-2H5c-.55 0-1 .45-1 1zm10 0c0 .55.45 1 1 1h4c.55 0 1-.45 1-1s-.45-1-1-1h-4c-.55 0-1 .45-1 1z"/>
            </svg>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-marker-icon',
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40],
        });

        // Crear nuevo marcador con icono personalizado
        const marker = L.marker([device.latitude, device.longitude], {
          icon: customIcon,
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
      } catch {
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
