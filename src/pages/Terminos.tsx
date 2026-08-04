import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";

const UPDATED = "4 de agosto de 2026";

export default function Terminos() {
  return (
    <main className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/"><BrandLogo size="md" /></Link>
          <Link to="/privacidad" className="text-sm text-muted-foreground hover:text-foreground transition">
            Política de Privacidad
          </Link>
        </div>
      </header>

      <article className="container max-w-3xl py-10 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-brand-purple">Términos de Servicio</h1>
          <p className="text-sm text-muted-foreground">Última actualización: {UPDATED}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Descripción del servicio</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            PruebaLista es una plataforma web que permite a docentes y colegios en Chile generar,
            editar, exportar y gestionar evaluaciones educativas, además de administrar un banco de
            preguntas, cursos y listados de estudiantes. El servicio es operado por Michel Castillo,
            persona natural con inicio de actividades en Chile.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Planes y renovación</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            La plataforma ofrece planes Free, Pro e Institucional, cuyos límites y beneficios se indican
            en la página de planes. La renovación es <strong>manual y no automática</strong>: no se
            realizan cobros recurrentes sin acción del usuario. Antes del vencimiento se envía o muestra
            un aviso previo, y al vencer el plan la cuenta pasa a las condiciones del plan gratuito sin
            pérdida del contenido ya creado.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Responsabilidad del colegio o UTP</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            El colegio y su Unidad Técnico Pedagógica son responsables del uso que sus docentes dan a la
            plataforma, de la administración de los accesos que otorgan y de contar con la autorización
            de los apoderados o representantes legales para el tratamiento de los datos de sus
            estudiantes cargados en el servicio.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Uso aceptable</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>Está prohibido compartir cuentas o credenciales entre varias personas.</li>
            <li>Está prohibido usar el servicio para generar, almacenar o distribuir contenido ilegal.</li>
            <li>Está prohibido cargar o difundir contenido que infrinja derechos de autor u otros derechos de terceros.</li>
            <li>Está prohibido intentar acceder a datos de otros usuarios o colegios, o interferir con la operación del servicio.</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            El incumplimiento de estas reglas puede derivar en la suspensión o cierre de la cuenta.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Limitación de responsabilidad</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            El servicio se entrega “tal cual” y “según disponibilidad”, sin garantías de disponibilidad
            ininterrumpida ni de ausencia de errores. En la máxima medida permitida por la ley, el
            responsable no será responsable por daños indirectos, lucro cesante o pérdida de datos
            derivados del uso o imposibilidad de uso de la plataforma. Se recomienda a los usuarios
            exportar y conservar copias de las evaluaciones relevantes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Eliminación de cuenta</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            El usuario puede solicitar la eliminación de su cuenta escribiendo a{" "}
            <a href="mailto:contacto@pruebalista.cl" className="text-primary underline">contacto@pruebalista.cl</a>. Al
            eliminar una cuenta se eliminan sus datos de identificación, mientras que las evaluaciones y
            preguntas del banco se conservan de forma anonimizada, sin vínculo con el usuario eliminado,
            para preservar la continuidad del trabajo institucional y del contenido compartido.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Ley aplicable</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Estos términos se rigen por las leyes de la República de Chile, y cualquier controversia se
            someterá a los tribunales competentes de Chile.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Cambios en estos términos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Estos términos pueden actualizarse. La fecha de última actualización se indica al inicio del
            documento. Consulta también nuestra{" "}
            <Link to="/privacidad" className="text-primary underline">Política de Privacidad</Link>.
          </p>
        </section>
      </article>
    </main>
  );
}
