/// <reference types="vite/client" />

// Import crudo del backend Apps Script (se usa como plantilla copiable
// en el Admin: una sola fuente de verdad para el código del backend).
declare module "*.gs?raw" {
  const content: string;
  export default content;
}
