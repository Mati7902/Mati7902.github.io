import type { Metadata } from "next";

import { LegalPage } from "@/components/public/legal-page";
import { getPublicSettingsSafe } from "@/server/services/public-settings";

export const metadata: Metadata = { title: "Términos de uso" };

export default async function TermsPage() {
  const { legal, "site.identity": identity } = await getPublicSettingsSafe();
  return (
    <LegalPage title="Términos de uso" version={legal.terms_version} reviewed={legal.reviewed_by_professional}>
      <h2>1. Objeto</h2>
      <p>
        {identity.platform_name} es una plataforma de apoyo a la práctica psicológica de {identity.professional_name}. Permite gestionar turnos, recibir recordatorios, acceder a materiales y realizar ejercicios entre sesiones.
      </p>
      <h2>2. Lo que la plataforma no es</h2>
      <ul>
        <li>No es un servicio de emergencia. Ante riesgo inmediato para vos o para otra persona, buscá atención de urgencia presencial o contactá a los servicios de emergencia de tu zona.</li>
        <li>No reemplaza la psicoterapia ni la evaluación profesional. Los ejercicios y materiales son herramientas de apoyo.</li>
        <li>La asistente virtual de WhatsApp realiza tareas administrativas: no diagnostica, no interpreta síntomas, no indica medicación ni brinda psicoterapia.</li>
      </ul>
      <h2>3. Cuenta y acceso</h2>
      <p>
        El acceso se habilita por invitación del profesional. Sos responsable de mantener la confidencialidad de tu contraseña y de las acciones realizadas desde tu cuenta. Avisá de inmediato ante cualquier uso no autorizado.
      </p>
      <h2>4. Turnos</h2>
      <p>
        Las solicitudes de turno quedan sujetas a disponibilidad y, según la configuración vigente, pueden requerir aprobación del profesional. Las reprogramaciones y cancelaciones desde la app respetan el plazo de anticipación informado al reservar.
      </p>
      <h2>5. Menores de edad</h2>
      <p>El uso por parte de menores de edad requiere el consentimiento de madre, padre o tutor, quien acompaña el proceso según lo acordado con el profesional.</p>
      <h2>6. Uso adecuado</h2>
      <p>Te comprometés a usar la plataforma de buena fe, sin intentar acceder a información de terceros ni vulnerar su seguridad.</p>
      <h2>7. Consentimiento para el uso de la plataforma</h2>
      <p>
        Al crear tu contraseña aceptás estos términos, la política de privacidad y el uso de la plataforma como apoyo al proceso terapéutico. Podés revocar tu consentimiento y solicitar la baja de tu cuenta en cualquier momento.
      </p>
      <h2>8. Modificaciones</h2>
      <p>Estos términos pueden actualizarse. La versión vigente estará siempre disponible en esta página.</p>
    </LegalPage>
  );
}
