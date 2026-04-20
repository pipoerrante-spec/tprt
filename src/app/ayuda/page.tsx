import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Mail, Clock, AlertTriangle, CarFront, FileBadge2 } from "lucide-react";

const HELP_INFO_SECTIONS = [
  {
    icon: CarFront,
    title: "¿Cómo funciona?",
    body: [
      "Retiramos tu vehículo en la dirección que indiques, gestionamos la revisión técnica y lo devolvemos en tu domicilio una vez finalizado el proceso.",
      "Para realizar el retiro, es necesario que cuentes con un estacionamiento disponible, donde el conductor pueda dejar su vehículo al momento de retirar el tuyo.",
    ],
  },
  {
    icon: FileBadge2,
    title: "¿Qué documentos necesito?",
    body: ["Para realizar la gestión de tu revisión técnica, debes contar con:"],
    items: [
      "Permiso de circulación vigente",
      "Padrón del vehículo",
      "SOAP vigente",
      "Revisión técnica anterior o certificado de homologación (según corresponda)",
    ],
    footer: "Asegúrate de tener estos documentos disponibles al momento del retiro.",
  },
  {
    icon: AlertTriangle,
    title: "¿Qué pasa si mi vehículo es rechazado?",
    body: [
      "Si tu vehículo es rechazado por motivos simples, como luces o grabado de patente, el conductor podrá ayudarte a gestionar la solución en el momento. En este caso, se te enviará un link de pago por el costo del servicio adicional solicitado.",
      "Si el rechazo se debe a otros motivos, podrás solicitar una segunda gestión con un 50% de descuento sobre el valor original, una vez realizadas las reparaciones necesarias.",
    ],
    footer: "Recuerda que la aprobación de la revisión técnica depende del estado general y mantención de tu vehículo.",
  },
];

export default function HelpPage() {
  return (
    <main className="bg-white min-h-screen pb-20 pt-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-12">

        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-primary">Centro de Ayuda GVRT</h1>
          <p className="text-xl text-gray-600">¿En qué podemos ayudarte hoy?</p>
        </div>

        {/* Contact Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="text-center hover:shadow-md transition-shadow">
            <CardHeader>
              <Mail className="w-8 h-8 mx-auto text-primary mb-2" />
              <CardTitle className="text-lg">Soporte Email</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-2">Consultas generales y reclamos</p>
              <p className="font-bold text-primary">contacto@gvrt.cl</p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-md transition-shadow">
            <CardHeader>
              <Clock className="w-8 h-8 mx-auto text-secondary mb-2" />
              <CardTitle className="text-lg">Horarios Plantas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-2">Revisa el horario específico</p>
              <Button variant="link" asChild className="p-0 h-auto font-bold text-primary">
                <Link href="/plantas">Ver Plantas</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-primary">Información importante</h2>
            <p className="text-gray-600">Aquí encontrarás lo principal antes de coordinar el retiro de tu vehículo.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {HELP_INFO_SECTIONS.map(({ icon: Icon, title, body, items, footer }) => (
              <Card key={title} className="border-gray-200 shadow-sm">
                <CardHeader className="space-y-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6 text-gray-600">
                  {body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {items ? (
                    <ul className="list-disc space-y-2 pl-5 text-gray-700">
                      {items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {footer ? <p className="font-medium text-gray-700">{footer}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-primary">Preguntas Frecuentes</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>¿Qué documentos debo presentar?</AccordionTrigger>
              <AccordionContent>
                Para realizar la gestión debes tener disponible tu permiso de circulación vigente, padrón del vehículo, SOAP vigente y tu revisión técnica anterior o certificado de homologación, según corresponda.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>¿Qué pasa si mi revisión está vencida?</AccordionTrigger>
              <AccordionContent>
                Puede realizar la revisión, pero se expone claramente a multas y al envío del vehículo a corrales por circular con la documentación vencida.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>¿Cuánto demora el proceso?</AccordionTrigger>
              <AccordionContent>
                El proceso de inspección dura aproximadamente 20-30 minutos. Sin embargo, el tiempo total dependerá de la demanda en la planta. Recomendamos reservar hora.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>¿Cómo reservo una hora?</AccordionTrigger>
              <AccordionContent>
                Puede reservar en línea a través de nuestro sitio web en la sección <Link href="/reservar" className="text-primary underline">Reservar Hora</Link>.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>¿Qué pasa si mi vehículo es rechazado?</AccordionTrigger>
              <AccordionContent>
                Si el rechazo es por algo simple, como luces o grabado de patente, podemos ayudarte a resolverlo en el momento y te enviaremos un link de pago por ese servicio adicional. Si el rechazo es por otros motivos, podrás pedir una segunda gestión con 50% de descuento una vez hechas las reparaciones.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Action Banner */}
        <div className="bg-gray-50 border p-8 rounded-lg text-center space-y-4">
          <h3 className="text-xl font-bold text-gray-800">¿No encontraste lo que buscabas?</h3>
          <div className="flex justify-center gap-4">
            <Button asChild>
              <Link href="/reservar">Agendar Revisión</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/terminos">Ver Términos</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Volver al Inicio</Link>
            </Button>
          </div>
        </div>

      </div>
    </main>
  );
}
