// Autorización de LECTURA de una plática, compartida por las rutas que sirven
// la vista de proyección (/presentar): manifest+guion, imágenes de slides y
// state file.
//
// Tres niveles de visibilidad, del más cerrado al más abierto:
//   privada                  — solo el owner.
//   shared (interno)         — cualquier usuario autenticado.
//   public_link (externo)    — cualquiera con la liga, sin cuenta ni login.
//
// El middleware (lib/auth.ts) deja pasar sin sesión los GET de /api/platicas/<id>/*
// y la página /presentar/*; el chequeo real de public_link vive aquí — mismo
// patrón que GUEST_PATHS, donde la ruta valida su propia condición.
import { auth } from '@/lib/auth';
import type { PlaticaManifest } from '@/lib/platica-schema';
import { readManifest } from '@/lib/platicas-storage';

export type PlaticaReadAccess =
  | { ok: true; manifest: PlaticaManifest; userId: string | null }
  | { ok: false; status: 401 | 403 | 404; error: string };

export async function authorizePlaticaRead(id: string): Promise<PlaticaReadAccess> {
  const manifest = readManifest(id);
  if (!manifest) {
    return { ok: false, status: 404, error: 'Plática no encontrada' };
  }
  const session = await auth();
  const userId = session?.user?.id ?? null;

  if (userId) {
    if (manifest.owner_user_id === userId || manifest.shared || manifest.public_link) {
      return { ok: true, manifest, userId };
    }
    return { ok: false, status: 403, error: 'No autorizado' };
  }

  if (manifest.public_link) {
    return { ok: true, manifest, userId: null };
  }
  return { ok: false, status: 401, error: 'No autenticado' };
}

// Identidad de datos de un visitante anónimo. Debe coincidir EXACTAMENTE con
// la que /api/token asigna al despachar el agente (`guest_<ip>`), porque de
// ella depende en qué carpeta de /data quedó la transcripción de su sesión.
export function guestUserIdFromIp(ip: string): string {
  return `guest_${ip.replace(/[^a-zA-Z0-9]/g, '_')}`;
}
