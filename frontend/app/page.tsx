'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import DeviceList from '@/components/DeviceList';
import { DeviceMapMarker, RealtimeDeviceData } from '@/lib/types';
import { subscribeToAllDevices } from '@/lib/realtime';
import { AlertCircle, Flame, Activity } from 'lucide-react';

// Importar mapa dinámicamente para evitar SSR issues con Leaflet
const DeviceMap = dynamic(() => import('@/components/DeviceMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-lg">
      <p className="text-gray-500">Cargando mapa...</p>
    </div>
  ),
});

export default function Dashboard() {
  const [devices, setDevices] = useState<DeviceMapMarker[]>([]);
  const [realtimeData, setRealtimeData] = useState<Record<string, RealtimeDeviceData>>({});
  const [loading, setLoading] = useState(true);

  // Cargar dispositivos desde API (PostgreSQL)
  useEffect(() => {
    async function fetchDevices() {
      try {
        const response = await fetch('/api/devices');
        if (response.ok) {
          const data = await response.json();
          
          // Transformar datos de la API a formato de mapa
          const mapDevices: DeviceMapMarker[] = data.map((device: any) => ({
            deviceId: device.deviceId,
            name: device.name,
            location: device.location,
            latitude: device.latitude,
            longitude: device.longitude,
            alertLevel: device.alerts?.[0]?.level || 'NORMAL',
            lastReading: device.readings?.[0]
              ? {
                  temperature: device.readings[0].temperature,
                  smoke: device.readings[0].smoke,
                  flame: device.readings[0].flame,
                  timestamp: new Date(device.readings[0].timestamp),
                }
              : undefined,
            isOnline: false, // Se actualizará con Firebase
          }));
          
          setDevices(mapDevices);
        }
      } catch (error) {
        console.error('Error fetching devices:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDevices();
  }, []);

  // Suscribirse a datos en tiempo real (Firebase)
  useEffect(() => {
    const unsubscribe = subscribeToAllDevices((data) => {
      setRealtimeData(data);
      
      // Actualizar dispositivos con datos en tiempo real
      setDevices((prevDevices) =>
        prevDevices.map((device) => {
          const rtData = data[device.deviceId];
          if (rtData) {
            return {
              ...device,
              alertLevel: rtData.alertLevel,
              isOnline: rtData.isOnline,
              lastReading: {
                temperature: rtData.temperature,
                smoke: rtData.smoke,
                flame: rtData.flame,
                timestamp: new Date(rtData.timestamp),
              },
            };
          }
          return device;
        })
      );
    });

    return () => unsubscribe();
  }, []);

  const criticalDevices = devices.filter((d) => d.alertLevel === 'CRITICAL');
  const warningDevices = devices.filter((d) => d.alertLevel === 'WARNING');
  const onlineDevices = devices.filter((d) => d.isOnline);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Flame className="h-6 w-6 text-orange-500" />
                Dashboard ESP32 - Detectores de Humo
              </h1>
              <p className="text-sm text-muted-foreground">
                Facultad de Informática - Monitoreo en tiempo real
              </p>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-lg">{devices.length}</div>
                <div className="text-muted-foreground">Dispositivos</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg text-green-500">{onlineDevices.length}</div>
                <div className="text-muted-foreground">Online</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg text-red-500">{criticalDevices.length}</div>
                <div className="text-muted-foreground">Alertas</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Alertas críticas */}
      {criticalDevices.length > 0 && (
        <div className="container mx-auto px-4 py-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>⚠️ Alerta Crítica</AlertTitle>
            <AlertDescription>
              {criticalDevices.length} dispositivo(s) en estado crítico:{' '}
              {criticalDevices.map((d) => d.name).join(', ')}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Dashboard principal */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
          {/* Mapa */}
          <div className="lg:col-span-2 h-full">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Mapa de Dispositivos</CardTitle>
                <CardDescription>
                  Ubicación en tiempo real de detectores en la Facultad de Informática
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[calc(100%-80px)]">
                {loading ? (
                  <div className="h-full flex items-center justify-center">
                    <Activity className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <DeviceMap
                    devices={devices}
                    center={[25.6866, -100.3161]} // Coordenadas mock - actualizar con tu ubicación
                    zoom={18}
                    onDeviceClick={(deviceId) => {
                      // Navegar a página de detalle
                      window.location.href = `/device/${deviceId}`;
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Lista de dispositivos */}
          <div className="h-full">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Dispositivos</CardTitle>
                <CardDescription>Estado actual de todos los sensores</CardDescription>
              </CardHeader>
              <CardContent className="h-[calc(100%-80px)]">
                <DeviceList
                  devices={devices}
                  onDeviceSelect={(deviceId) => {
                    window.location.href = `/device/${deviceId}`;
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
