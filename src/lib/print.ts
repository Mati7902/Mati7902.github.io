/**
 * CSS de impresión con un pie en cada hoja (para documentos del panel que se imprimen o se
 * guardan en PDF). El texto se escapa para que no pueda cerrar la cadena ni la etiqueta <style>.
 */
export function printFooterCss(text: string): string {
  const safe = text.replace(/[\\"]/g, "\\$&").replace(/[<>\r\n]/g, " ");
  return `@media print { @page { @bottom-center { content: "${safe}"; font-size: 9px; color: #555; } } }`;
}
