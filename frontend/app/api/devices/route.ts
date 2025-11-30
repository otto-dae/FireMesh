import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Obtener todos los dispositivos con sus últimas lecturas y alertas
export async function GET() {
  try {
    const devices = await prisma.device.findMany({
      include: {
        readings: {
          orderBy: { timestamp: 'desc' },
          take: 1, // Última lectura
        },
        alerts: {
          where: { isResolved: false },
          orderBy: { createdAt: 'desc' },
          take: 1, // Última alerta activa
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json(
      { error: 'Error al obtener dispositivos' },
      { status: 500 }
    );
  }
}

// POST: Crear un nuevo dispositivo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, name, location, latitude, longitude } = body;

    if (!deviceId || !name || !location || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const device = await prisma.device.create({
      data: {
        deviceId,
        name,
        location,
        latitude,
        longitude,
      },
    });

    return NextResponse.json(device, { status: 201 });
  } catch (error) {
    console.error('Error creating device:', error);
    return NextResponse.json(
      { error: 'Error al crear dispositivo' },
      { status: 500 }
    );
  }
}
