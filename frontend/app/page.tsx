'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import DeviceList from '@/components/DeviceList';
import { DeviceMapMarker } from '@/lib/types';
import { subscribeToAllDevices, getAllDeviceInfo } from '@/lib/realtime';
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
  const [loading, setLoading] = useState(true);

  // Cargar información estática de dispositivos desde Firebase
  useEffect(() => {
    async function loadDeviceInfo() {
      try {
        const deviceInfo = await getAllDeviceInfo();
        
        // Crear dispositivos iniciales con la información estática
        const initialDevices: DeviceMapMarker[] = Object.entries(deviceInfo).map(([deviceId, info]) => ({
          deviceId,
          name: info.name,
          location: info.location,
          latitude: info.latitude,
          longitude: info.longitude,
          alertLevel: 'NORMAL' as const,
          isOnline: false,
        }));
        
        setDevices(initialDevices);
      } catch (error) {
        console.error('Error cargando información de dispositivos:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDeviceInfo();
  }, []);

  // Suscribirse a datos en tiempo real (Firebase)
  useEffect(() => {
    const unsubscribe = subscribeToAllDevices((data) => {
      console.log('🔄 Actualizando dispositivos con datos en tiempo real');
      
      // Actualizar dispositivos con datos en tiempo real
      setDevices((prevDevices) =>
        prevDevices.map((device) => {
          const rtData = data[device.deviceId];
          if (rtData) {
            // Verificar si realmente hay cambios para evitar re-renders innecesarios
            const hasChanges = 
              device.alertLevel !== rtData.alertLevel ||
              device.isOnline !== rtData.isOnline ||
              !device.lastReading ||
              device.lastReading.temperature !== rtData.temperature ||
              device.lastReading.smoke !== rtData.smoke ||
              device.lastReading.flame !== rtData.flame;
            
            if (!hasChanges) {
              console.log('⏭️ Sin cambios para', device.deviceId);
              return device; // Retornar la misma referencia si no hay cambios
            }
            
            console.log('✅ Actualizando', device.deviceId, 'con nuevos datos');
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

  // Callback memoizado para evitar re-renders innecesarios
  const handleDeviceClick = useCallback((deviceId: string) => {
    window.location.href = `/device/${deviceId}`;
  }, []);

  // Calcular estadísticas memoizadas
  const stats = useMemo(() => ({
    critical: devices.filter((d) => d.alertLevel === 'CRITICAL'),
    warning: devices.filter((d) => d.alertLevel === 'WARNING'),
    online: devices.filter((d) => d.isOnline),
  }), [devices]);

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
                <div className="font-bold text-lg text-green-500">{stats.online.length}</div>
                <div className="text-muted-foreground">Online</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg text-red-500">{stats.critical.length}</div>
                <div className="text-muted-foreground">Alertas</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Alertas críticas */}
      {stats.critical.length > 0 && (
        <div className="container mx-auto px-4 py-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>⚠️ Alerta Crítica</AlertTitle>
            <AlertDescription>
              {stats.critical.length} dispositivo(s) en estado crítico:{' '}
              {stats.critical.map((d) => d.name).join(', ')}
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
                    onDeviceClick={handleDeviceClick}
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
                  onDeviceSelect={handleDeviceClick}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}