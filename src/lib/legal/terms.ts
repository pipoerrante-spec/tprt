export type TermsSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const GVRT_TERMS_SECTIONS: TermsSection[] = [
  {
    title: "Identificación de la empresa",
    paragraphs: [
      "El presente documento regula el uso del sitio web y los servicios ofrecidos por GVRT Revisión Técnica, empresa dedicada a la gestión de revisión técnica vehicular, incluyendo el retiro del vehículo, traslado a una planta de revisión técnica autorizada y posterior entrega al cliente.",
      "Al contratar el servicio a través del sitio web o canales oficiales, el cliente declara haber leído y aceptado estos Términos y Condiciones.",
    ],
  },
  {
    title: "Descripción del servicio",
    paragraphs: ["GVRT Revisión Técnica ofrece un servicio de gestión que incluye:"],
    bullets: [
      "Retiro del vehículo en la dirección indicada por el cliente.",
      "Traslado del vehículo a una planta de revisión técnica autorizada.",
      "Gestión del proceso de revisión técnica.",
      "Entrega del vehículo en el domicilio o lugar acordado.",
      "Entrega del certificado de revisión técnica y documentos asociados (si corresponde).",
      "GVRT Revisión Técnica no es una planta de revisión técnica, sino un servicio de intermediación y gestión del proceso.",
    ],
  },
  {
    title: "Requisitos del vehículo",
    paragraphs: ["El cliente declara que al momento del retiro el vehículo:"],
    bullets: [
      "Se encuentra en condiciones de circulación.",
      "Posee combustible suficiente para realizar el traslado.",
      "No presenta fallas mecánicas graves conocidas.",
      "No contiene objetos de valor en su interior.",
      "Cuenta con la documentación necesaria para realizar la revisión técnica.",
      "En caso de que el vehículo no cumpla estas condiciones, el servicio podrá ser cancelado o reprogramado.",
    ],
  },
  {
    title: "Proceso de contratación del servicio",
    paragraphs: ["El proceso de contratación se realiza de la siguiente manera:"],
    bullets: [
      "El cliente completa el formulario en el sitio web.",
      "Selecciona el servicio requerido.",
      "Realiza el pago mediante la plataforma de pago habilitada.",
      "Recibe un correo de confirmación del servicio.",
      "GVRT coordina el retiro del vehículo.",
    ],
  },
  {
    title: "Autorización de conducción del vehículo",
    paragraphs: [
      "Al contratar el servicio, el cliente autoriza expresamente a GVRT Revisión Técnica y a sus profesionales a:",
    ],
    bullets: [
      "Conducir el vehículo para efectos del servicio contratado.",
      "Trasladarlo hacia y desde la planta de revisión técnica.",
      "Realizar las gestiones necesarias en la planta.",
      "Previo al traslado, el profesional podrá realizar registro fotográfico del estado del vehículo y verificación básica del vehículo.",
    ],
  },
  {
    title: "Resultado de la revisión técnica",
    paragraphs: [
      "GVRT Revisión Técnica no garantiza la aprobación de la revisión técnica, ya que esta depende exclusivamente de la evaluación realizada por la planta de revisión técnica autorizada.",
      "En caso de rechazo, el vehículo será devuelto al cliente y se informarán las observaciones emitidas por la planta.",
      "El cliente podrá solicitar una nueva gestión de revisión técnica, la cual podrá tener un costo adicional.",
    ],
  },
  {
    title: "Segunda gestión en caso de rechazo de revisión técnica",
    paragraphs: [
      "En caso de rechazo, GVRT Revisión Técnica podrá ofrecer una segunda gestión, con valor preferencial exclusivo para clientes que ya contrataron el servicio.",
      "El valor será informado por correo electrónico, WhatsApp o link de pago.",
      "Es responsabilidad del cliente asegurarse de que el vehículo haya sido reparado antes de solicitar la segunda gestión.",
      "GVRT no garantiza la aprobación en la segunda inspección.",
      "El cliente podrá aceptar esta nueva gestión realizando el pago correspondiente en el link enviado por la empresa.",
    ],
    bullets: [
      "Retiro del vehículo en domicilio.",
      "Traslado a planta de revisión técnica.",
      "Gestión de la inspección.",
      "Devolución del vehículo al cliente.",
    ],
  },
  {
    title: "Cancelaciones y reprogramaciones",
    paragraphs: ["El cliente podrá cancelar o reprogramar el servicio bajo las siguientes condiciones:"],
    bullets: [
      "Cancelación con más de 24 horas de anticipación: reembolso completo del servicio.",
      "Cancelación con menos de 24 horas: podrá aplicarse un cargo administrativo.",
      "Si el profesional ya se encuentra en ruta o en el domicilio del cliente: no se realizará devolución del servicio.",
    ],
  },
  {
    title: "Derecho a retracto",
    paragraphs: [
      "De acuerdo con la Ley del Consumidor en Chile (Ley 19.496), el derecho a retracto puede no aplicar cuando el servicio ha sido coordinado o iniciado.",
      "Al aceptar estos términos, el cliente entiende que una vez asignado el profesional o programado el servicio, el derecho a retracto puede quedar sin efecto.",
    ],
  },
  {
    title: "Responsabilidad del servicio",
    paragraphs: ["GVRT Revisión Técnica se compromete a operar con personal capacitado, cuidar el vehículo y mantener registros del servicio."],
    bullets: [
      "No será responsable por fallas mecánicas preexistentes.",
      "No será responsable por rechazos en la revisión técnica.",
      "No será responsable por problemas derivados del estado del vehículo.",
    ],
  },
  {
    title: "Registro del servicio",
    paragraphs: [
      "Durante el servicio, GVRT podrá realizar registro fotográfico del vehículo y de documentos asociados a la revisión técnica para respaldo.",
    ],
  },
  {
    title: "Protección de datos personales",
    paragraphs: ["Los datos entregados por el cliente serán utilizados exclusivamente para:"],
    bullets: [
      "Coordinar el servicio.",
      "Gestión operativa.",
      "Contacto con el cliente.",
      "Cumplimiento de obligaciones legales.",
      "GVRT Revisión Técnica se compromete a proteger la información conforme a la legislación vigente.",
    ],
  },
  {
    title: "Modificación de los términos",
    paragraphs: [
      "GVRT Revisión Técnica podrá modificar estos Términos y Condiciones en cualquier momento para mejorar el servicio o adaptarse a nuevas normativas.",
    ],
  },
  {
    title: "Contacto",
    paragraphs: [
      "Correo electrónico: contacto@gvrt.cl",
      "Sitio web: www.gvrt.cl",
    ],
  },
];
