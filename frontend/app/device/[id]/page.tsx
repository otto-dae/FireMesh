'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Thermometer, Wind, Flame, Activity, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getDeviceInfoByDeviceId, subscribeToDeviceReadings } from '@/lib/realtime';
import { FirebaseLectura } from '@/lib/types';
import { calculateAlertLevel } from '@/lib/alerts';

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [readings, setReadings] = useState<FirebaseLectura[]>([]);
  const [loading, setLoading] = useState(true);
  
  const deviceId = params.id as string;
  const deviceInfo = useMemo(() => getDeviceInfoByDeviceId(deviceId), [deviceId]);

  useEffect(() => {
    if (!deviceInfo) {
      setLoading(false);
      return;
    }

    // Suscribirse a lecturas en tiempo real
    const unsubscribe = subscribeToDeviceReadings(deviceId, (newReadings) => {
      console.log('Lecturas actualizadas:', newReadings.length);
      setReadings(newReadings);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [deviceId, deviceInfo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!deviceInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Dispositivo no encontrado</p>
        <Button onClick={() => router.push('/')}>Volver al Dashboard</Button>
      </div>
    );
  }

  const latestReading = readings[0];
  
  const alertLevel = latestReading ? calculateAlertLevel({
    temperature: undefined,
    smoke: latestReading.humo,
    flame: latestReading.fuego,
  }) : 'NORMAL';

  const chartData = readings
    .slice(0, 50)
    .reverse()
    .map((reading) => ({
      time: format(new Date(reading.timestamp || reading.serverTimestamp), 'HH:mm:ss'),
      smoke: reading.humo,
      flame: reading.fuego,
    }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{deviceInfo.name}</h1>
                <p className="text-sm text-muted-foreground">{deviceInfo.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={readings.length > 0 ? 'default' : 'secondary'}>
                {readings.length > 0 ? 'Activo' : 'Sin datos'}
              </Badge>
              <span className="text-sm text-muted-foreground">ID: {deviceInfo.deviceId}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Métricas actuales */}
        {latestReading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Temperatura</CardTitle>
                <Thermometer className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">N/A</div>
                <p className="text-xs text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {format(new Date(latestReading.serverTimestamp), "d 'de' MMM, HH:mm:ss", {
                    locale: es,
                  })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Nivel de Humo</CardTitle>
                <Wind className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latestReading.humo.toFixed(0)} ppm</div>
                <p className="text-xs text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {format(new Date(latestReading.timestamp || latestReading.serverTimestamp), "d 'de' MMM, HH:mm:ss", {
                    locale: es,
                  })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Detección de Llama</CardTitle>
                <Flame className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latestReading.fuego}</div>
                <p className="text-xs text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {format(new Date(latestReading.timestamp || latestReading.serverTimestamp), "d 'de' MMM, HH:mm:ss", {
                    locale: es,
                  })}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs con gráficas y tablas */}
        <Tabs defaultValue="charts" className="w-full">
          <TabsList>
            <TabsTrigger value="charts">Gráficas</TabsTrigger>
            <TabsTrigger value="readings">Historial de Lecturas</TabsTrigger>
          </TabsList>

          <TabsContent value="charts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Sensores</CardTitle>
                <CardDescription>Últimas 50 lecturas del dispositivo</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="smoke"
                      stroke="#6b7280"
                      name="Humo (ppm)"
                    />
                    <Line
                      type="monotone"
                      dataKey="flame"
                      stroke="#ef4444"
                      name="Llama"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="readings">
            <Card>
              <CardHeader>
                <CardTitle>Lecturas Recientes</CardTitle>
                <CardDescription>Historial detallado de mediciones</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead>Temperatura</TableHead>
                      <TableHead>Humo</TableHead>
                      <TableHead>Llama</TableHead>
                      <TableHead>Alerta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readings.slice(0, 20).map((reading, index) => {
                      const alert = calculateAlertLevel({
                        temperature: undefined,
                        smoke: reading.humo,
                        flame: reading.fuego,
                      });
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            {format(new Date(reading.timestamp || reading.serverTimestamp), "d 'de' MMM, HH:mm:ss", {
                              locale: es,
                            })}
                          </TableCell>
                          <TableCell>N/A</TableCell>
                          <TableCell>{reading.humo.toFixed(0)} ppm</TableCell>
                          <TableCell>{reading.fuego}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                alert === 'CRITICAL'
                                  ? 'destructive'
                                  : alert === 'WARNING'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {alert}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}