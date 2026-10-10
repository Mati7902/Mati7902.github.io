import type { Metadata } from "next";

import { LegalPage } from "@/components/public/legal-page";
import { getPublicSettingsSafe } from "@/server/services/public-settings";

export const metadata: Metadata = { title: "Política de privacidad" };

export default async function PrivacyPage() {
  const { legal, "site.identity": identity } = await getPublicSettingsSafe();
  return (
    <LegalPage title="Política de privacidad" version={legal.privacy_version} reviewed={legal.reviewed_by_professional}>
      <h2>1. Responsable</h2>
      <p>
        El responsable del tratamiento de los datos es {identity.professional_name}, {identity.professional_title.toLowerCase()} ({identity.license}), {identity.country}.
        {identity.email ? ` Contacto: ${identity.email}.` : ""}
      </p>
      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>Datos de identificación y contacto: nombre, apellido, email, teléfono, fecha de nacimiento (opcional) y contacto de emergencia (opcional).</li>
        <li>
          Ficha de ingreso, que completás vos al crear tu cuenta: datos personales, antecedentes psicológicos y médicos (incluida la medicación), historia familiar, consumo de sustancias, sueño y alimentación, y cómo estás en distintas áreas de tu vida (conducta, emociones, sensaciones, imágenes, pensamientos, relaciones y salud física). Todas las preguntas se pueden dejar en blanco.
        </li>
        <li>Datos de agenda: turnos solicitados, confirmaciones, cancelaciones y su historial.</li>
        <li>Registros personales que vos decidís guardar en la plataforma: registros emocionales, respuestas a ejercicios y preparación de sesiones.</li>
        <li>Mensajes intercambiados por WhatsApp con la asistente virtual, con fines administrativos y de agenda.</li>
        <li>Datos técnicos mínimos: registros de actividad y seguridad (fecha, acción, dirección IP).</li>
      </ul>
      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Gestionar turnos, recordatorios y comunicaciones administrativas.</li>
        <li>Que tu profesional conozca tu situación antes de la primera sesión y pueda planificar el tratamiento (ficha de ingreso).</li>
        <li>Ofrecer materiales y ejercicios como apoyo entre sesiones.</li>
        <li>Garantizar la seguridad de la plataforma y prevenir accesos no autorizados.</li>
      </ul>
      <p>No usamos tus registros para publicidad, no elaboramos perfiles comerciales y no vendemos datos a terceros.</p>
      <h2>4. Registros personales y el profesional</h2>
      <p>
        Tus registros emocionales y ejercicios son tuyos. Por defecto se comparten con tu profesional para acompañar el proceso; podés desactivar esto en cualquier momento desde tu perfil. Esta plataforma no reemplaza la historia clínica ni constituye un diagnóstico automático.
      </p>
      <p>
        La ficha de ingreso es información de salud y tiene reglas propias: mientras no la envíes es un borrador que ves solo vos; una vez enviada, la ve solo tu profesional (no el personal administrativo ni la asistente virtual de WhatsApp) y cada consulta queda registrada. Podés verla y actualizarla desde tu perfil, y pedir que se elimine escribiendo al profesional.
      </p>
      <h2>5. Seguridad</h2>
      <p>
        Aplicamos cifrado en tránsito, control de acceso por usuario (cada paciente accede únicamente a su propia información), mínimo privilegio, auditoría de acciones críticas y almacenamiento en proveedores con certificaciones de seguridad reconocidas.
      </p>
      <h2>6. WhatsApp</h2>
      <p>
        La asistente virtual de WhatsApp atiende cuestiones administrativas. WhatsApp es un servicio de un tercero (Meta) con sus propias condiciones; no garantiza confidencialidad clínica ni respuesta inmediata. Ante una emergencia, contactá a los servicios de urgencia de tu zona.
      </p>
      <p>
        Para entender mensajes escritos con libertad, el profesional puede activar un proveedor de inteligencia artificial. En ese caso, el texto del mensaje y los últimos mensajes de esa conversación de WhatsApp se envían a ese proveedor solo para identificar qué trámite necesitás. Nunca se envían tus registros emocionales, ejercicios, ficha de ingreso ni datos de la aplicación. La IA no toma decisiones: las acciones sobre turnos las ejecuta la plataforma con reglas fijas.
      </p>
      <h2>7. Calendario del profesional</h2>
      <p>
        Si el profesional conecta su calendario de Google, cada turno se refleja allí con tus iniciales, la modalidad y el estado, sin datos clínicos. Así se evitan superposiciones con otras actividades del profesional.
      </p>
      <h2>8. Conservación y derechos</h2>
      <p>
        Conservamos los datos mientras dure la relación profesional y el tiempo que exija la normativa aplicable. Podés solicitar acceso, rectificación, actualización o eliminación de tus datos escribiendo al profesional. Para menores de edad, los derechos se ejercen a través de madre, padre o tutor.
      </p>
      <h2>9. Cambios</h2>
      <p>Esta política puede actualizarse. Publicaremos la versión vigente en esta página e indicaremos la fecha de la última modificación.</p>
    </LegalPage>
  );
}
