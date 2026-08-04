import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";

const UPDATED = "4 de agosto de 2026";

export default function Privacidad() {
  return (
    <main className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/"><BrandLogo size="md" /></Link>
          <Link to="/terminos" className="text-sm text-muted-foreground hover:text-foreground transition">
            Términos de Servicio
          </Link>
        </div>
      </header>

      <article className="container max-w-3xl py-10 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-brand-purple">Política de Privacidad</h1>
          <p className="text-sm text-muted-foreground">Última actualización: {UPDATED}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Responsable del tratamiento</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            El responsable del tratamiento de los datos personales es <strong>Michel Castillo</strong>,
            persona natural con inicio de actividades en Chile, quien opera la plataforma PruebaLista.
            Para cualquier consulta relacionada con privacidad o datos personales, el canal de contacto es{" "}
            <a href="mailto:soporte@cnlc.cl" className="text-primary underline">soporte@cnlc.cl</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Datos que se recopilan</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>De docentes y personal de colegios:</strong> nombre completo, correo electrónico,
            correo secundario y número de documento (RUT) cuando el usuario decide informarlo, junto con
            datos de uso de la plataforma (evaluaciones creadas, preguntas generadas, fechas de acceso y
            registros técnicos necesarios para el funcionamiento del servicio).
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>De estudiantes:</strong> nombre, apellido y RUT. Estos datos son cargados
            directamente por el colegio o su Unidad Técnico Pedagógica (UTP), quien declara contar con la
            autorización correspondiente de los apoderados o representantes legales para su tratamiento
            en la plataforma con fines de gestión de evaluaciones. La plataforma no solicita ni recopila
            datos de estudiantes por canales distintos a esa carga institucional.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Finalidad del tratamiento</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Los datos se tratan con la finalidad de prestar el servicio de generación y gestión de
            evaluaciones educativas: crear y almacenar pruebas, administrar el banco de preguntas,
            asociar evaluaciones a cursos y estudiantes, gestionar cuentas, planes y soporte al usuario.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Terceros que procesan datos</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li><strong>Supabase:</strong> hosting de la base de datos, autenticación y almacenamiento de archivos.</li>
            <li><strong>Flow.cl:</strong> procesamiento de pagos de suscripciones. No recibe datos de estudiantes.</li>
            <li><strong>Lovable Cloud:</strong> infraestructura de la aplicación y ejecución de funciones del servicio.</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Estos proveedores tratan los datos únicamente por cuenta del responsable y para las
            finalidades descritas en esta política.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Derechos ARCO</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición escribiendo a{" "}
            <a href="mailto:soporte@cnlc.cl" className="text-primary underline">soporte@cnlc.cl</a>{" "}
            desde el correo asociado a tu cuenta. En el caso de datos de estudiantes, las solicitudes se
            canalizan a través del colegio responsable de su carga.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Conservación de datos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Los datos se conservan mientras la cuenta esté activa y según lo indicado en la sección de
            eliminación de cuentas de los{" "}
            <Link to="/terminos" className="text-primary underline">Términos de Servicio</Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Visibilidad de los datos de estudiantes</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Los datos de estudiantes solo son visibles para el colegio al que pertenecen. La plataforma
            aplica políticas de seguridad a nivel de base de datos que aíslan la información por colegio,
            de modo que ningún otro colegio ni docente externo puede acceder a esos registros.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Cambios en esta política</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Esta política puede actualizarse para reflejar cambios en el servicio o en la normativa
            aplicable. La fecha de última actualización siempre se indica al inicio del documento.
          </p>
        </section>
      </article>
    </main>
  );
}
