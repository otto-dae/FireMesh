import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Obtener un dispositivo específico con sus lecturas y alertas
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const device = await prisma.device.findUnique({
      where: { deviceId: id },
      include: {
        readings: {
          orderBy: { timestamp: 'desc' },
          take: 50, // Últimas 50 lecturas
        },
        alerts: {
          orderBy: { createdAt: 'desc' },
          take: 20, // Últimas 20 alertas
        },
      },
    });

    if (!device) {
      return NextResponse.json(
        { error: 'Dispositivo no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(device);
  } catch (error) {
    console.error('Error fetching device:', error);
    return NextResponse.json(
      { error: 'Error al obtener dispositivo' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar un dispositivo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const device = await prisma.device.update({
      where: { deviceId: id },
      data: body,
    });

    return NextResponse.json(device);
  } catch (error) {
    console.error('Error updating device:', error);
    return NextResponse.json(
      { error: 'Error al actualizar dispositivo' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar un dispositivo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.device.delete({
      where: { deviceId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting device:', error);
    return NextResponse.json(
      { error: 'Error al eliminar dispositivo' },
      { status: 500 }
    );
  }
}
