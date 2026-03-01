import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Mail, Clock } from "lucide-react";

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

        {/* FAQ Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-primary">Preguntas Frecuentes</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>¿Qué documentos debo presentar?</AccordionTrigger>
              <AccordionContent>
                Debe presentar el Certificado de Revisión Técnica anterior, Certificado de Emisiones Contaminantes y su Permiso de Circulación o Padrón.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>¿Qué pasa si mi revisión está vencida?</AccordionTrigger>
              <AccordionContent>
                Puede realizar la revisión normalmente, sin embargo, se expone a multas por circular con la documentación vencida.
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
