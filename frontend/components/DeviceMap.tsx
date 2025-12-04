'use client';

import { useEffect, useRef, memo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DeviceMapMarker } from '@/lib/types';
import { getAlertHexColor } from '@/lib/alerts';

// Arreglar los iconos de Leaflet
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

function DeviceMap({
  devices,
  center = [20.7042037705179, -100.4436296150508],
  zoom = 17,
  onDeviceClick,
}: DeviceMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Inicializar mapa solo una vez
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    try {
      
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
    } catch (error) {
    }

    return () => {
      if (mapRef.current) {
        try {
          markersRef.current.forEach((marker) => {
            marker.remove();
          });
          markersRef.current.clear();
          mapRef.current.remove();
          mapRef.current = null;
        } catch (error) {
        }
      }
    };
  }, []);

  // Actualizar marcadores cuando cambien los dispositivos
  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const map = mapRef.current;
    const currentMarkers = markersRef.current;
    const shouldAdjustView = currentMarkers.size === 0;

    // Actualizar o crear marcadores
    devices.forEach((device) => {
      const existingMarker = currentMarkers.get(device.deviceId);

      if (existingMarker) {
        try {
          const color = getAlertHexColor(device.alertLevel);
          const newIcon = createCustomIcon(color, device.isOnline);
          existingMarker.setIcon(newIcon);
          
          // Actualizar el contenido del popup sin recrearlo
          existingMarker.setPopupContent(createPopupContent(device));
          
        } catch (error) {
          console.error(`Error actualizando marcador ${device.deviceId}:`, error);
        }
      } else {
        try {

          const color = getAlertHexColor(device.alertLevel);
          const icon = createCustomIcon(color, device.isOnline);

          const marker = L.marker([device.latitude, device.longitude], { icon })
            .addTo(map)
            .bindPopup(createPopupContent(device), {
              maxWidth: 300,
              className: 'custom-popup',
            });

          currentMarkers.set(device.deviceId, marker);
        } catch (error) {
          console.error(`Error creando marcador ${device.deviceId}:`, error);
        }
      }
    });

    // Remover marcadores obsoletos
    const currentDeviceIds = new Set(devices.map((d) => d.deviceId));
    currentMarkers.forEach((marker, deviceId) => {
      if (!currentDeviceIds.has(deviceId)) {
        marker.remove();
        currentMarkers.delete(deviceId);
      }
    });

    // Ajustar vista SOLO en la primera carga
    if (shouldAdjustView && devices.length > 0) {
      try {
        const bounds = L.latLngBounds(devices.map((d) => [d.latitude, d.longitude]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
      } catch (error) {
        console.error('Error ajustando vista:', error);
      }
    } else {
      console.log('V1ista del mapa no se ajustó');
    }
  }, [devices]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full rounded-lg" />
    </div>
  );
}

// Crear contenido HTML del popup
function createPopupContent(device: DeviceMapMarker): string {
  const statusColor = device.isOnline ? '#22c55e' : '#9ca3af';
  const statusText = device.isOnline ? '● Online' : '○ Offline';
  const alertBadgeStyle = 
    device.alertLevel === 'CRITICAL' ? 'background-color: #ef4444; color: white;' : 
    device.alertLevel === 'WARNING' ? 'background-color: #3b82f6; color: white;' : 
    'background-color: #f3f4f6; color: #111827;';

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 250px;">
      <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 12px;">
        <h3 style="margin: 0 0 4px 0; font-size: 18px; font-weight: bold; color: #111827;">
          ${device.name}
        </h3>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-size: 14px; font-weight: 600;">Estado:</span>
        <span style="color: ${statusColor}; font-weight: 600; font-size: 14px;">
          ${statusText}
        </span>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <span style="font-size: 14px; font-weight: 600;">Nivel de Alerta:</span>
        <span style="
          ${alertBadgeStyle}
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        ">
          ${device.alertLevel}
        </span>
      </div>

      ${device.lastReading ? `
        <div style="background-color: #f9fafb; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
          <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 8px;">
            Última Lectura:
          </div>
          <div style="display: grid; gap: 6px;">
            <div style="display: flex; justify-content: space-between; font-size: 14px;">
              <span>🌡️ Temperatura:</span>
              <strong>${Number.isFinite(device.lastReading.temperature) ? device.lastReading.temperature!.toFixed(1) + '°C' : 'N/A'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 14px;">
              <span>💨 Humo:</span>
              <strong>${device.lastReading.smoke.toFixed(0)} ppm</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 14px;">
              <span>🔥 Llama:</span>
              <strong>${device.lastReading.flame}</strong>
            </div>
          </div>
        </div>
      ` : ''}

      <a 
        href="/device/${device.deviceId}"
        style="
          display: block;
          width: 100%;
          text-align: center;
          background-color: #000000;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: background-color 0.2s;
        "
        onmouseover="this.style.backgroundColor='#333333'"
        onmouseout="this.style.backgroundColor='#000000'"
      >
        Ver Detalles Completos →
      </a>
    </div>
  `;
}

// Función para crear icono personalizado de dispositivo IoT
function createCustomIcon(color: string, isOnline: boolean): L.DivIcon {
  const opacity = isOnline ? '1' : '0.6';
  const pulseAnimation = isOnline ? `
    <style>
      @keyframes device-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
    </style>
  ` : '';

  return L.divIcon({
    className: 'custom-device-marker',
    html: `
      ${pulseAnimation}
      <div style="position: relative; width: 40px; height: 40px;">
        <!-- Círculo de fondo con animación si está online -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background-color: ${color};
          border-radius: 50%;
          opacity: ${opacity};
          ${isOnline ? 'animation: device-pulse 2s ease-in-out infinite;' : ''}
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        "></div>
        
        <!-- Icono de sensor/dispositivo -->
        <svg 
          style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 24px;
            height: 24px;
          "
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <!-- Sensor/Chip icon -->
          <rect x="4" y="4" width="16" height="16" rx="2" fill="white" opacity="0.9"/>
          <path d="M9 2V4M15 2V4M9 20V22M15 20V22M2 9H4M2 15H4M20 9H22M20 15H22" 
                stroke="white" stroke-width="2" stroke-linecap="round"/>
          <circle cx="12" cy="12" r="3" fill="${color}"/>
          <path d="M12 9v6M9 12h6" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        
        <!-- Indicador online/offline -->
        ${isOnline ? `
          <div style="
            position: absolute;
            top: -2px;
            right: -2px;
            width: 12px;
            height: 12px;
            background-color: #22c55e;
            border: 2px solid white;
            border-radius: 50%;
          "></div>
        ` : `
          <div style="
            position: absolute;
            top: -2px;
            right: -2px;
            width: 12px;
            height: 12px;
            background-color: #ef4444;
            border: 2px solid white;
            border-radius: 50%;
          "></div>
        `}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
}

export default memo(DeviceMap, (prevProps, nextProps) => {
  return JSON.stringify(prevProps.devices) === JSON.stringify(nextProps.devices);
});